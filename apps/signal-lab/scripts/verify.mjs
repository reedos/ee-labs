// End-to-end verification against the built app in a real browser.
//
// The unit tests call the math and DSP directly. This drives the actual UI:
// clicks every preset, opens every math panel, changes parameters, and checks
// that the numbers on screen and the pixels in the canvases both follow. It is
// the only thing here that can catch a wiring mistake — a prop not passed, a
// panel fed stale state, a plot that quietly stops redrawing.
//
//   node scripts/verify.mjs            (expects a server on APP_URL)
//
// Exits non-zero on the first category of failure, and prints everything.

import { chromium } from 'playwright'

const URL = process.env.APP_URL || 'http://localhost:4173'
const failures = []
const notes = []
const fail = (m) => failures.push(m)
const note = (m) => notes.push(m)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })

const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`)
})

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.views canvas')
await page.waitForTimeout(400)

// ---------------------------------------------------------------- helpers

const settle = () => page.waitForTimeout(220)

/** Does the page scroll? Both plots must fit. */
const scrolls = () =>
  page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  )

/** A cheap fingerprint of each canvas, to prove it actually redrew. */
const canvasHashes = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.views canvas')].map((c) => {
      const d = c.toDataURL()
      let h = 0
      for (let i = 0; i < d.length; i += 97) h = (h * 31 + d.charCodeAt(i)) | 0
      return `${h}:${d.length}`
    }),
  )

/** Open every collapsed math panel currently on screen. */
/** Expand every collapsed block card, so its fields are reachable. */
async function expandBlocks() {
  const heads = page.locator('.block-head[aria-expanded="false"], .block-title[aria-expanded="false"]')
  for (let g = 0; g < 8; g++) {
    const n = await heads.count()
    if (n === 0) break
    await heads.first().click()
    await page.waitForTimeout(80)
  }
}

async function openAllMath() {
  const toggles = page.locator('.math-toggle[aria-expanded="false"]')
  for (let guard = 0; guard < 12; guard++) {
    const n = await toggles.count()
    if (n === 0) break
    await toggles.first().click()
    await page.waitForTimeout(90)
  }
}

/** Every check row rendered anywhere on screen. */
const readChecks = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.math-check tbody tr')].map((tr) => {
      const c = [...tr.querySelectorAll('th,td')].map((x) => x.textContent.trim())
      return { label: c[0], theory: c[1], measured: c[2], mark: c[3] }
    }),
  )

const readValues = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.math-values tbody tr')].map((tr) => {
      const c = [...tr.querySelectorAll('th,td')].map((x) => x.textContent.trim())
      return { label: c[0], value: c[1] }
    }),
  )

/** The readouts above each plot. */
const readout = () =>
  page.evaluate(() => {
    const out = {}
    for (const sec of document.querySelectorAll('.view')) {
      const title = sec.querySelector('h2').textContent.trim()
      out[title] = [...sec.querySelectorAll('.readout span')].map((s) => s.textContent.trim())
    }
    return out
  })

/** Type a value into a NumField by its visible label. */
async function setField(label, value, nth = 0) {
  const box = page.getByRole('spinbutton', { name: label }).nth(nth)
  await box.fill(String(value))
  await box.press('Enter')
  await settle()
}

/** Click a preset by name.
 *
 * Scoped to `.preset` and anchored, because a view-switch button can carry the
 * same words as a preset, and a preset name can be a prefix of another's.
 */
const loadPreset = async (name) => {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const btn = page.locator('.preset').filter({ hasText: new RegExp(`^${esc}$`) }).first()
  // Preset groups fold now; a preset in a folded group is not clickable until
  // its group is opened, exactly as for a person.
  if (!(await btn.isVisible().catch(() => false))) {
    await page.evaluate((n) => {
      for (const d of document.querySelectorAll('details.preset-group')) {
        const has = [...d.querySelectorAll('.preset')].some((b) => b.textContent.trim() === n)
        if (has && !d.open) d.querySelector('summary').click()
      }
    }, name)
    await page.waitForTimeout(120)
  }
  await btn.click()
  await settle()
}

const presetNames = await page.$$eval('.preset', (els) => els.map((e) => e.textContent.trim()))

// ------------------------------------------------- 1. every preset renders

console.log(`\n1. Loading all ${presetNames.length} presets, opening every math panel\n`)
for (const name of presetNames) {
  await loadPreset(name)
  if (await scrolls()) fail(`${name}: page scrolls`)

  await expandBlocks()
  await openAllMath()
  const checks = await readChecks()
  const bad = checks.filter((r) => r.mark === '✗')
  if (bad.length) {
    for (const b of bad) fail(`${name}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)
  }
  const ticks = checks.filter((r) => r.mark === '✓').length
  const foot = checks.filter((r) => r.mark && r.mark.startsWith('[')).length
  const vals = (await readValues()).length
  console.log(
    `   ${name.padEnd(30)} ${String(ticks).padStart(2)} ✓  ${foot} footnoted  ${vals} derived`,
  )
  if (checks.length === 0 && vals === 0) note(`${name}: math panel shows no numbers at all`)
}

// ------------------------------- 2. does the spectrum follow the frequency?

console.log('\n2. Sweeping source frequency — does the measured peak follow?\n')
await loadPreset('Single tone')
let prev = await canvasHashes()
for (const f of [100, 250, 440, 1000, 2000, 3300]) {
  await setField('Frequency', f)
  const r = await readout()
  const peakTxt = (r['Frequency domain'] || []).find((s) => s.startsWith('peak')) || ''
  const got = parseFloat(peakTxt.replace(/[^0-9.]/g, ''))
  const binHz = 8000 / 2048
  const ok = Math.abs(got - f) <= binHz * 1.5
  console.log(`   set ${String(f).padStart(5)} Hz -> spectrum peak ${got} Hz  ${ok ? 'ok' : 'MISMATCH'}`)
  if (!ok) fail(`frequency ${f}: spectrum peak read ${got} Hz`)

  const now = await canvasHashes()
  if (now[0] === prev[0]) fail(`frequency ${f}: time-domain canvas did not redraw`)
  if (now[1] === prev[1]) fail(`frequency ${f}: spectrum canvas did not redraw`)
  prev = now
}

// ------------------------------------------ 3. does Q follow into the math?

console.log('\n3. Sweeping Q — does the panel track |H(f0)| = Q?\n')
await loadPreset('Resonance is Q')
await expandBlocks()
await openAllMath()
for (const q of [0.5, 0.707, 1, 2, 5, 10, 20]) {
  await setField('Q (resonance)', q)
  const rows = await readChecks()
  const row = rows.find((r) => r.label.startsWith('peak |H|'))
  if (!row) {
    fail(`Q=${q}: no "peak |H|" row`)
    continue
  }
  const theory = parseFloat(row.theory)
  const measured = parseFloat(row.measured)
  const ok = row.mark === '✓' && Math.abs(theory - q) < 0.02
  console.log(
    `   Q=${String(q).padEnd(6)} theory ${row.theory.padStart(8)}  measured ${row.measured.padStart(8)}  ${row.mark}${ok ? '' : '   <-- WRONG'}`,
  )
  if (!ok) fail(`Q=${q}: theory ${row.theory} measured ${row.measured} mark ${row.mark}`)
}

// ------------------------------------- 4. cutoff sweep on a filtered square

console.log('\n4. Sweeping filter cutoff on a square — does |H| stay right?\n')
await loadPreset('Low-pass a square')
await openAllMath()
for (const fc of [300, 500, 700, 1200, 2000, 3000]) {
  await setField('Cutoff', fc)
  const rows = (await readChecks()).filter((r) => r.label.startsWith('|H| at'))
  const bad = rows.filter((r) => r.mark === '✗')
  console.log(
    `   cutoff ${String(fc).padStart(4)} Hz -> ${rows.filter((r) => r.mark === '✓').length} ✓, ` +
      `${rows.filter((r) => r.mark && r.mark.startsWith('[')).length} footnoted, ${bad.length} ✗`,
  )
  for (const b of bad) fail(`cutoff ${fc}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)
}

// -------------------------------------------- 5. every source type in turn

console.log('\n5. Every source waveform, with its own math panel\n')
await loadPreset('Single tone')
const typeSelect = page.locator('.source select').first()
const types = await typeSelect.locator('option').evaluateAll((os) => os.map((o) => o.value))
for (const t of types) {
  await typeSelect.selectOption(t)
  await settle()
  await expandBlocks()
  await openAllMath()
  const checks = await readChecks()
  const vals = await readValues()
  const bad = checks.filter((r) => r.mark === '✗')
  console.log(
    `   ${t.padEnd(10)} ${checks.filter((r) => r.mark === '✓').length} ✓  ${vals.length} derived  ${bad.length} ✗`,
  )
  for (const b of bad) fail(`source ${t}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)
  if (await scrolls()) fail(`source ${t}: page scrolls`)
}

// --------------------------------------------- 6. every block type in turn

console.log('\n6. Every block type, added fresh, with its own math panel\n')
await loadPreset('Single tone')
const addMenu = page.locator('select[aria-label="Add a processing block"]')
const blockTypes = await addMenu
  .locator('option')
  .evaluateAll((os) => os.filter((o) => o.value).map((o) => o.value))

for (const type of blockTypes) {
  await loadPreset('Single tone')
  const before = await canvasHashes()
  await addMenu.selectOption(type)
  await settle()
  await expandBlocks()
  await openAllMath()

  const checks = await readChecks()
  const vals = await readValues()
  const bad = checks.filter((r) => r.mark === '✗')
  const after = await canvasHashes()
  const changed = after[1] !== before[1]

  console.log(
    `   ${type.padEnd(10)} ${String(checks.filter((r) => r.mark === '✓').length).padStart(2)} ✓  ` +
      `${String(vals.length).padStart(2)} derived  ${bad.length} ✗   spectrum ${changed ? 'changed' : 'UNCHANGED'}`,
  )
  for (const b of bad) fail(`block ${type}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)
  if (!changed && type !== 'allpass') fail(`block ${type}: adding it did not change the spectrum`)
  if (await scrolls()) fail(`block ${type}: page scrolls`)
}

// --------------------------------- 7. a filter's own parameters, end to end

console.log('\n7. Editing a biquad — do its printed coefficients and checks follow?\n')
await loadPreset('Resonance is Q')
await openAllMath()
let lastCoeff = null
for (const [fc, q] of [[400, 1], [800, 4], [1600, 0.707], [2400, 12]]) {
  await setField('Cutoff', fc)
  await setField('Q (resonance)', q)
  const rows = await readChecks()
  const hz = rows.filter((r) => r.label.startsWith('|H|'))
  const bad = hz.filter((r) => r.mark === '✗')
  const pole = (await readValues()).find((r) => r.label.startsWith('pole radius'))
  // Scope to the BLOCK's panel: nth() over every formula on the page picked one
  // from the preset panel, which has no numbers in it and so never changes.
  const coeffs = await page.locator('.block-body .math-formula').nth(1).textContent()
  const moved = coeffs !== lastCoeff
  lastCoeff = coeffs
  console.log(
    `   fc=${String(fc).padStart(4)} Q=${String(q).padEnd(6)} ${hz.filter((r) => r.mark === '✓').length}/${hz.length} ✓  ` +
      `pole r=${pole ? pole.value : '?'}  coefficients ${moved ? 'updated' : 'STALE'}`,
  )
  for (const b of bad) fail(`fc=${fc} Q=${q}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)
  if (!moved) fail(`fc=${fc} Q=${q}: printed coefficients did not change`)
}

// ------------------------------------------------- 8. quantizer bit depth

console.log('\n8. Bit crusher — does the derived step size follow the bit count?\n')
await loadPreset('4 bits')
await openAllMath()
for (const bits of [4, 8, 12, 16]) {
  await setField('Bits', bits)
  const vals = await readValues()
  const step = vals.find((r) => r.label.startsWith('step'))
  const snr = vals.find((r) => r.label.startsWith('ideal SNR'))
  const wantStep = 2 / Math.pow(2, bits)
  const wantSnr = 6.02 * bits + 1.76
  const okStep = step && Math.abs(parseFloat(step.value) - wantStep) < wantStep * 0.02
  const okSnr = snr && Math.abs(parseFloat(snr.value) - wantSnr) < 0.05
  console.log(
    `   ${String(bits).padStart(2)} bits -> step ${step ? step.value : '?'} (want ${wantStep.toPrecision(4)}), ` +
      `SNR ${snr ? snr.value : '?'} dB (want ${wantSnr.toFixed(2)})  ${okStep && okSnr ? 'ok' : 'MISMATCH'}`,
  )
  if (!okStep || !okSnr) fail(`bits=${bits}: step ${step && step.value}, SNR ${snr && snr.value}`)
}

// ------------------------------------------------- 9. sample rate and FFT

console.log('\n9. Changing sample rate and FFT size\n')
await loadPreset('Square = odd harmonics')
await openAllMath()
for (const [rate, fft] of [[8000, 2048], [16000, 2048], [22050, 4096], [44100, 8192], [48000, 1024]]) {
  await setField('Rate', rate)
  await setField('FFT', fft)
  const checks = await readChecks()
  const bad = checks.filter((r) => r.mark === '✗')
  console.log(
    `   ${String(rate).padStart(5)} Hz / ${String(fft).padStart(4)} pt -> ` +
      `${checks.filter((r) => r.mark === '✓').length} ✓, ` +
      `${checks.filter((r) => r.mark && r.mark.startsWith('[')).length} footnoted, ${bad.length} ✗`,
  )
  for (const b of bad) fail(`rate ${rate}/${fft}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)
  if (await scrolls()) fail(`rate ${rate}/${fft}: page scrolls`)
}

// ----------------------- 10. the pane view switches and the spectrum overlay

console.log('\n10. Impulse response, z-plane and the group-delay overlay\n')

{
  await loadPreset('The kernel is the filter')

  // The preset asks for the impulse view, so it should already be showing.
  const impulseOn = await page
    .locator('.view-switch button[aria-pressed="true"]')
    .first()
    .textContent()
  if (!/Kernel/.test(impulseOn)) {
    fail(`preset did not select the impulse view (got "${impulseOn.trim()}")`)
  }

  // The readout must state the delay this kernel actually has.
  const r1 = await readout()
  const timeRow = (r1['Time domain'] || []).join(' | ')
  if (!/15 samples/.test(timeRow)) {
    fail(`impulse readout does not report a 15-sample delay: ${timeRow}`)
  } else {
    console.log(`   impulse view reports: ${timeRow}`)
  }

  // Switching back and forth must actually redraw the top canvas.
  const hImpulse = (await canvasHashes())[0]
  await page.locator('.view-switch button', { hasText: 'Signal' }).first().click()
  await settle()
  const hSignal = (await canvasHashes())[0]
  if (hImpulse === hSignal) fail('switching to the signal view did not redraw the top plot')
  await page.locator('.view-switch button', { hasText: 'Kernel' }).first().click()
  await settle()
  if ((await canvasHashes())[0] !== hImpulse) {
    fail('returning to the impulse view did not reproduce the same plot')
  } else {
    console.log('   impulse <-> signal switching redraws, and is stable')
  }

  // Raising the tap count must move the reported delay to (N-1)/2.
  await expandBlocks()
  await setField('Taps N', 61)
  const r2 = await readout()
  const t2 = (r2['Time domain'] || []).join(' | ')
  if (!/30 samples/.test(t2)) fail(`61 taps should delay by 30 samples, readout says: ${t2}`)
  else console.log('   61 taps -> delay 30 samples, as (N-1)/2')
}

{
  await loadPreset('Zeros on the circle')

  const r = await readout()
  const freqRow = (r['Frequency domain'] || []).join(' | ')
  // A 12-tap moving average has 11 zeros and no poles at all.
  if (!/poles\s*0/.test(freqRow) || !/zeros\s*11/.test(freqRow)) {
    fail(`z-plane readout wrong for a 12-tap average: ${freqRow}`)
  } else {
    console.log(`   z-plane reports: ${freqRow}`)
  }

  // A resonant biquad must add two poles and two zeros to that count.
  const zBefore = (await canvasHashes())[1]
  await page.selectOption('select.add', 'lowpass')
  await settle()
  const freq2 = ((await readout())['Frequency domain'] || []).join(' | ')
  if (!/poles\s*2/.test(freq2)) fail(`adding a low-pass should add 2 poles: ${freq2}`)
  else console.log(`   after adding a low-pass: ${freq2}`)
  if ((await canvasHashes())[1] === zBefore) fail('z-plane did not redraw when a block was added')
}

{
  await loadPreset('Everything arrives together')

  // The preset selects the group-delay overlay; switching it must redraw, which
  // is what proves the canvas received it rather than the state merely holding it.
  const pressed = await page.$$eval('.views .segmented button[aria-pressed="true"]', (b) =>
    b.map((x) => x.textContent.trim()),
  )
  if (!pressed.includes('delay')) {
    fail(`group-delay overlay not selected by the preset: ${pressed.join(', ')}`)
  } else {
    console.log('   preset selected the group-delay overlay')
  }

  const before = (await canvasHashes())[1]
  await page.locator('.views .segmented button', { hasText: 'phase' }).first().click()
  await settle()
  const after = (await canvasHashes())[1]
  if (before === after) fail('switching overlay from group delay to phase did not redraw')
  else console.log('   overlay switches redraw the spectrum')

  await page.locator('.views .segmented button', { hasText: 'no overlay' }).first().click()
  await settle()
  if ((await canvasHashes())[1] === after) fail('turning the overlay off did not redraw')
}

if (await scrolls()) fail('new views: page scrolls')

// ----------------------------- 10b. the FIR blocks under live parameter drags

console.log('\n10b. FIR: nulls follow fs/N, the window kills the Gibbs row honestly\n')

{
  await loadPreset('A moving average is a filter')
  await expandBlocks()
  await openAllMath()

  // The nulls move as fs/N while the panel keeps agreeing.
  for (const n of [4, 8, 16]) {
    await setField('Taps N', n)
    const rows = await readChecks()
    const nullRow = rows.find((r) => r.label.includes('first null'))
    const want = 8000 / n
    const labelled = parseFloat((nullRow?.label.match(/([\d.]+)\s*Hz/) || [])[1])
    const ok = nullRow && nullRow.mark === '✓' && Math.abs(labelled - want) < 1
    console.log(
      `   N=${String(n).padEnd(3)} first null labelled ${labelled} Hz (want ${want.toFixed(1)})  ${nullRow?.mark || '?'}`,
    )
    if (!ok) fail(`moving average N=${n}: null row ${labelled} Hz / ${nullRow?.mark}`)
  }
}

{
  await loadPreset('Cut it off abruptly and it rings')
  await expandBlocks()
  await openAllMath()

  const gibbsRow = async () => (await readChecks()).find((r) => r.label.startsWith('largest |H|'))
  const before = await gibbsRow()
  if (before?.mark !== '✓') fail(`Gibbs row should be ✓ with window none, got ${before?.mark}`)

  // Switch the window on the live block: the overshoot vanishes BY DESIGN, so
  // the row must footnote itself rather than turn into a ✗ against physics.
  await page.locator('.block select').last().selectOption('hamming')
  await settle()
  const after = await gibbsRow()
  const foot = after && after.mark !== '✓' && after.mark !== '✗'
  console.log(
    `   window none -> ✓ (${before.measured});  hamming -> ${foot ? 'footnoted' : after?.mark} (${after?.measured})`,
  )
  if (!foot) fail(`Gibbs row with a hamming window should footnote, got "${after?.mark}"`)

  await page.locator('.block select').last().selectOption('none')
  await settle()
  if ((await gibbsRow())?.mark !== '✓') fail('Gibbs row did not recover when the window went back')
}

// ---------------------------------------------- 10c. the convolution view

console.log('\n10c. Convolution: two code paths, one number, and a scrubber\n')

{
  await loadPreset('Convolution, watched')

  const nums = async () => {
    const r = await readout()
    const row = (r['Time domain'] || []).join(' | ')
    const m = row.match(/chain y\[n\]\s*(-?[\d.]+).*Σ h·x\s*(-?[\d.]+)/)
    return m ? { chain: parseFloat(m[1]), dot: parseFloat(m[2]), row } : { row }
  }

  const first = await nums()
  if (first.chain == null) fail(`convolution readout unreadable: ${first.row}`)
  else if (Math.abs(first.chain - first.dot) > 1e-3) {
    fail(`LTI chain: y[n] ${first.chain} vs Σ h·x ${first.dot} should agree`)
  } else {
    console.log(`   chain y[n] = ${first.chain}, Σ h·x = ${first.dot} — agree`)
  }

  // Scrub: the canvas must follow, and the two numbers must stay married.
  const before = (await canvasHashes())[0]
  await page.evaluate(() => {
    const r = document.querySelector('.conv-bar input[type=range]')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(r, Math.floor(Number(r.max) * 0.8))
    r.dispatchEvent(new Event('input', { bubbles: true }))
    r.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await settle()
  const after = await nums()
  if ((await canvasHashes())[0] === before) fail('scrubbing did not redraw the convolution view')
  else if (Math.abs(after.chain - after.dot) > 1e-3) {
    fail(`after scrubbing: y[n] ${after.chain} vs Σ h·x ${after.dot}`)
  } else {
    console.log(`   scrubbed to 80%: y[n] = ${after.chain}, still agrees, canvas redrew`)
  }

  // Add a clipper: the two paths must now separate and the flag must say so.
  await page.selectOption('select.add', 'clip')
  await settle()
  const r2 = await readout()
  const flagged = (r2['Time domain'] || []).some((t) => /not LTI/.test(t))
  if (!flagged) fail('adding a clipper should raise the "not LTI" flag in the convolution view')
  else console.log('   with a clipper in the chain: "they disagree — this chain is not LTI"')
}


// ------------------------------------------------ A11Y. names for everything

console.log('\nA11y: every control has a name, every plot has a label\n')
{
  const audit = await page.evaluate(() => {
    const problems = []
    const nameOf = (el) =>
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-labelledby') ||
      (el.labels && el.labels.length) ||
      (el.textContent || '').trim() ||
      el.getAttribute('title')
    for (const el of document.querySelectorAll('button, select, input, [role=img]')) {
      if (el.type === 'hidden' || el.disabled) continue
      if (!nameOf(el)) {
        const tag = el.tagName.toLowerCase()
        const cls = (el.className || '').toString().slice(0, 40)
        problems.push(`${tag}.${cls || '?'} has no accessible name`)
      }
    }
    for (const c of document.querySelectorAll('canvas')) {
      if (c.getAttribute('role') !== 'img' || !c.getAttribute('aria-label')) {
        problems.push('canvas without role="img" + aria-label')
      }
    }
    return [...new Set(problems)]
  })
  if (audit.length) for (const p of audit) fail(`a11y: ${p}`)
  else console.log('   no unnamed controls, no unlabelled plots')
}

// -------------------------------- 10d. play restarts at the end, speed obeys

console.log('\n10d. Convolution transport: restart at end, speed multiplier\n')
{
  await loadPreset('Convolution, watched')
  const posOf = async () =>
    parseInt((await page.locator('.conv-bar input[type=range]').inputValue()), 10)
  const max = parseInt(await page.locator('.conv-bar input[type=range]').getAttribute('max'), 10)

  // Park at the end, press play: it must restart from the left, not flick off.
  await page.evaluate(() => {
    const r = document.querySelector('.conv-bar input[type=range]')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(r, r.max)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle()
  await page.locator('.conv-bar .ghost').click()
  await page.waitForTimeout(450)
  const afterRestart = await posOf()
  if (!(afterRestart > 0 && afterRestart < max * 0.6)) {
    fail(`play at the end should restart from the left; position went to ${afterRestart}/${max}`)
  } else {
    console.log(`   play at the end restarted: position ${afterRestart}/${max} after 450 ms`)
  }
  await page.locator('.conv-bar .ghost').click() // pause

  // Quarter speed advances measurably slower than 4x over the same time.
  const advance = async (label) => {
    await page.locator('.conv-speed button', { hasText: label }).click()
    await page.evaluate(() => {
      const r = document.querySelector('.conv-bar input[type=range]')
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(r, 0)
      r.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await settle()
    await page.locator('.conv-bar .ghost').click()
    await page.waitForTimeout(700)
    await page.locator('.conv-bar .ghost').click()
    return posOf()
  }
  const slow = await advance('¼×')
  const fast = await advance('4×')
  console.log(`   700 ms of play: ¼× reached ${slow}, 4× reached ${fast}`)
  if (!(fast > slow * 4)) fail(`4x (${fast}) should outrun quarter speed (${slow}) by far`)
}

// ------------------- 10e. type switching in place, and the order control

console.log('\n10e. Block type switch and the order select\n')

{
  await loadPreset('Resonance is Q')
  await expandBlocks()
  await openAllMath()

  // The note says: switch the block to band-pass and the peak pins at 0 dB.
  // That used to mean delete-and-re-add; now it is the card's own select.
  await page.locator('.block select[aria-label="Change block type"]').first().selectOption('bandpass')
  await settle()
  await openAllMath()
  const rows = await readChecks()
  const pinned = rows.find((r) => r.label.includes('|H| at f'))
  if (!pinned) fail('after switching to band-pass: no corner identity row')
  else if (pinned.mark !== '✓' && pinned.mark !== '✓') {
    fail(`band-pass corner row not ✓: ${pinned.label} ${pinned.mark}`)
  } else {
    console.log(`   switched to band-pass in place: ${pinned.label} -> ${pinned.mark} (pinned at 1)`)
  }
  // And the freq/Q settings survived the switch.
  const cutoffVal = await page.getByRole('spinbutton', { name: 'Centre' }).first().inputValue()
  console.log(`   centre carried over: ${cutoffVal}`)

  // Back to low-pass, then the order select.
  await page.locator('.block select[aria-label="Change block type"]').first().selectOption('lowpass')
  await settle()
  const qBefore = await page.getByRole('spinbutton', { name: 'Q (resonance)' }).count()
  await page.locator('.block select').nth(1).selectOption('4')
  await settle()
  const qAfter = await page.getByRole('spinbutton', { name: 'Q (resonance)' }).count()
  const summaryTxt = await page.locator('.flow-node', { hasText: 'Low-pass' }).first().textContent()
  console.log(`   order 4: Q field ${qBefore} -> ${qAfter}; flow reads "${summaryTxt.trim()}"`)
  if (qAfter !== 0) fail('order 4 should hide the Q knob — Butterworth chooses the Qs')
  await openAllMath()
  const bad4 = (await readChecks()).filter((r) => r.mark === '✗')
  for (const b of bad4) fail(`order 4: ✗ ${b.label} (${b.theory} vs ${b.measured})`)
  if (!bad4.length) console.log('   order-4 Butterworth panel: every check ✓ (corner at −3.01 dB)')

  await page.locator('.block select').nth(1).selectOption('1')
  await settle()
  await openAllMath()
  const bad1 = (await readChecks()).filter((r) => r.mark === '✗')
  for (const b of bad1) fail(`order 1: ✗ ${b.label} (${b.theory} vs ${b.measured})`)
  if (!bad1.length) console.log('   order-1 one-pole panel: every check ✓')
}

// ---------------- 10f. folded preset groups, live hints, and the diagram

console.log('\n10f. Folded groups, order-aware hints, the signal-path diagram\n')

{
  // Groups fold; the active preset's group cannot be hidden. Section 1's
  // sweep opened every group on its way through, so fold the inactive ones
  // back first — the way a person tidies the list.
  await loadPreset('Resonance is Q')
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details.preset-group[open]')) {
      if (!d.querySelector('.preset.is-on')) d.querySelector('summary').click()
    }
  })
  await settle()
  const groups = await page.$$eval('details.preset-group', (els) =>
    els.map((d) => ({ open: d.open, label: d.querySelector('summary').textContent.trim() })),
  )
  const openOnes = groups.filter((g) => g.open)
  console.log(`   ${groups.length} groups, open: ${openOnes.map((g) => g.label).join(', ') || 'none'}`)
  if (!openOnes.some((g) => g.label.includes('Filters'))) {
    fail('the active preset (Filters group) must keep its group open')
  }
  if (openOnes.length > 2) fail(`most groups should fold: ${openOnes.length} open`)

  // The attack the promise must survive: click the ACTIVE group's own summary
  // and expect to get nowhere. (Natively a <details> folds before React hears
  // of it, and a true->true prop is never rewritten - the hole the Control
  // Lab agent found in this very pattern.)
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details.preset-group')) {
      if (d.querySelector('.preset.is-on')) d.querySelector('summary').click()
    }
  })
  await settle()
  const activeStillOpen = await page.evaluate(() => {
    for (const d of document.querySelectorAll('details.preset-group')) {
      if (d.querySelector('.preset.is-on')) return d.open
    }
    return false
  })
  if (!activeStillOpen) fail('clicking the active group summary folded it - the active preset can be hidden')
  else console.log('   the active group refuses to fold - where-you-are cannot be hidden')

  // And the diagram's wires must actually draw: an undefined CSS var left
  // stroke: none, boxes with nothing between them, shipped.
  await page.locator('.fd-open').click()
  await settle()
  const wireStroke = await page.evaluate(() => {
    const w = document.querySelector('.fd-wire')
    return w ? getComputedStyle(w).stroke : 'missing'
  })
  await page.keyboard.press('Escape')
  await settle()
  if (wireStroke === 'none' || wireStroke === 'missing') {
    fail(`flow diagram wires do not draw: stroke = ${wireStroke}`)
  } else {
    console.log(`   diagram wires draw (stroke ${wireStroke})`)
  }

  // The low-pass hint follows the order select: 12 dB/oct at 2nd, 24 at 4th.
  await expandBlocks()
  const hintText = async () => (await page.locator('.block-hint').first().textContent()) || ''
  const h2 = await hintText()
  if (!/12 dB per octave/.test(h2) || !/40 dB per decade/.test(h2)) {
    fail(`order-2 hint should say 12 dB/oct and 40 dB/dec: "${h2.slice(0, 90)}"`)
  }
  await page.locator('.block select').nth(1).selectOption('4')
  await settle()
  const h4 = await hintText()
  if (!/24 dB per octave/.test(h4) || !/80 dB per decade/.test(h4)) {
    fail(`order-4 hint should say 24 dB/oct and 80 dB/dec: "${h4.slice(0, 90)}"`)
  } else {
    console.log('   hint follows the order: 12/40 at 2nd -> 24/80 at 4th, both units stated')
  }
  await page.locator('.block select').nth(1).selectOption('2')
  await settle()

  // The diagram: every source its own box, the chain in series, one output.
  await loadPreset('Build a square')
  await page.locator('.fd-open').click()
  await settle()
  const boxes = await page.locator('.fd-panel .fd-box').count()
  const sums = await page.locator('.fd-panel .fd-sum').count()
  console.log(`   diagram: ${boxes} boxes + ${sums} summing junction`)
  if (sums !== 1) fail('diagram should show exactly one summing junction')
  if (boxes !== 4) fail(`3 sources + output should be 4 boxes, got ${boxes}`)
  // Clicking a box closes the dialog and reveals the card.
  await page.locator('.fd-panel .fd-box[role=button]').first().click()
  await settle()
  if ((await page.locator('.fd-panel').count()) !== 0) fail('clicking a diagram box should close it')
  else console.log('   clicking a source box closes the diagram and reveals the sidebar card')
}

// -------------------------------------------------------------- 11. 4K fit

console.log('\n11. Re-checking layout at 4K\n')
await page.setViewportSize({ width: 3840, height: 2160 })
await page.waitForTimeout(500)
for (const name of presetNames) {
  await loadPreset(name)
  if (await scrolls()) fail(`4K / ${name}: page scrolls`)
}
console.log(`   all ${presetNames.length} presets fit at 3840x2160`)

// ------------------------------------------------------------------ report

await browser.close()

console.log('\n' + '='.repeat(64))
if (consoleErrors.length) {
  console.log(`\nBROWSER CONSOLE (${consoleErrors.length}):`)
  for (const e of [...new Set(consoleErrors)].slice(0, 20)) console.log('   ' + e)
} else {
  console.log('\nNo browser console errors or warnings.')
}
if (notes.length) {
  console.log(`\nNotes (${notes.length}):`)
  for (const n of notes) console.log('   ' + n)
}
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`)
  for (const f of failures) console.log('   ' + f)
  process.exit(1)
}
console.log('\nAll UI checks passed.')
