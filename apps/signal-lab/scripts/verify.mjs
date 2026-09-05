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
import { foldProbe, phoneProbe, LAPTOP_VIEWPORTS, PHONE_VIEWPORT } from '@ee-labs/ui/verify/foldProbe.mjs'
import { tapTargetProbe, FLOOR, HARD_FLOOR } from '@ee-labs/ui/verify/tapTargetProbe.mjs'

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
await page.evaluate(() => document.fonts.ready)

// ---------------------------------------------------------------- helpers

// Waits out the animation frame AND lets web fonts finish loading. Text set
// in a web font measures narrower/shorter before it swaps in — a box read
// during that window is optimistic, and the gap is not theoretical: the
// laptop fold probe below (10i) first reported "Order is a choice" fitting
// at 1366x768, and only measuring after `document.fonts.ready` reproduced
// the ~8 px overflow a real student's browser shows once its fonts settle.
const settle = async () => {
  await page.waitForTimeout(220)
  await page.evaluate(() => document.fonts.ready)
}

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
// The Rate box reads in kHz (engineering mode), so it is typed the way a
// reader types it: "16", not "16000".
for (const [rate, fft] of [[8000, 2048], [16000, 2048], [22050, 4096], [44100, 8192], [48000, 1024]]) {
  await setField('Rate', rate / 1000)
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

// ------------------------ 10g. the lesson nav, chips, and the two readouts

console.log('\n10g. Next/prev/reset, one-click chips, and the readouts the review caught\n')

{
  const activeName = async () => (await page.locator('.preset.is-on').first().textContent()).trim()
  const navCount = async () => (await page.locator('.lesson-nav-count').textContent()).trim()
  const freqPeak = async () =>
    ((await readout())['Frequency domain'] || []).find((s) => s.startsWith('peak')) || ''

  await loadPreset('Single tone')
  if ((await navCount()) !== `1 of ${presetNames.length}`) fail(`nav count on Single tone: ${await navCount()}`)
  await page.locator('.lesson-nav-step', { hasText: 'next' }).click()
  await settle()
  const afterNext = await activeName()
  if (afterNext !== 'Square = odd harmonics') fail(`next from Single tone landed on "${afterNext}"`)
  else console.log(`   next -> "${afterNext}" (${await navCount()})`)
  await page.locator('.lesson-nav-step', { hasText: 'prev' }).click()
  await settle()
  if ((await activeName()) !== 'Single tone') fail('prev did not return to Single tone')

  // Reset appears once a knob moves, and puts the preset back.
  if ((await page.locator('.lesson-nav-reset').count()) !== 0) fail('reset shown before anything moved')
  await setField('Frequency', 300)
  if ((await page.locator('.lesson-nav-reset').count()) !== 1) fail('reset did not appear after moving Frequency')
  await page.locator('.lesson-nav-reset').click()
  await settle()
  const back = await page.getByRole('spinbutton', { name: 'Frequency' }).first().inputValue()
  if (back !== '250') fail(`reset left Frequency at ${back}`)
  else if ((await page.locator('.lesson-nav-reset').count()) !== 0) fail('reset button stayed after resetting')
  else console.log('   moved Frequency -> reset appeared -> reset put 250 back and hid itself')

  // Chips: one click does what the try line says, and reads as pressed.
  await loadPreset('Aliasing')
  await page.locator('.try-chips .chip', { hasText: '6000 Hz' }).click()
  await settle()
  const aliasPeak = await freqPeak()
  const chipOn = await page.locator('.try-chips .chip.is-on').textContent()
  if (!/2000\.0 Hz/.test(aliasPeak)) fail(`Aliasing chip 6000 Hz: readout "${aliasPeak}"`)
  else if (chipOn.trim() !== '6000 Hz') fail(`active chip reads "${chipOn}"`)
  else console.log(`   Aliasing chip 6000 Hz -> ${aliasPeak}, chip marked active`)

  // The two readouts the review read against the notes.
  await loadPreset('Beating')
  const beat = await freqPeak()
  if (!/250\.0 and 255\.0 Hz/.test(beat)) fail(`Beating readout names one line: "${beat}"`)
  else console.log(`   Beating: ${beat}`)
  // ...and straight from Beating's 8192-point frame into Nyquist.
  await loadPreset('Exactly at Nyquist')
  const nyq = await freqPeak()
  const fft = await page.getByRole('spinbutton', { name: 'FFT' }).first().inputValue()
  if (!/4000\.0 Hz/.test(nyq)) fail(`Exactly at Nyquist after Beating reads "${nyq}" (FFT ${fft})`)
  else if (fft !== '2048') fail(`Exactly at Nyquist inherited FFT ${fft} from Beating`)
  else console.log(`   Exactly at Nyquist after Beating: ${nyq}, FFT ${fft}`)

  // Groups: moving to another group folds the one you left. The bug: React
  // fired onToggle on the initial open render, so the first group was
  // recorded as hand-opened and never folded again.
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await loadPreset('Resonance is Q')
  const openAfterMove = await page.$$eval('details.preset-group[open] > summary', (els) =>
    els.map((e) => e.textContent.trim()),
  )
  if (openAfterMove.some((g) => g.startsWith('Signals'))) {
    fail(`moving to Filters left "Signals and Fourier" open: ${openAfterMove.join(', ')}`)
  } else if (openAfterMove.length !== 1) {
    fail(`after moving to Filters ${openAfterMove.length} groups are open: ${openAfterMove.join(', ')}`)
  } else {
    console.log(`   fresh load -> Resonance is Q: open groups = ${openAfterMove.join(', ')}`)
  }
  // A group opened by hand stays open until the next experiment loads.
  await page.locator('details.preset-group > summary', { hasText: 'Sampling' }).click()
  await settle()
  const handOpened = await page.$$eval('details.preset-group[open]', (els) => els.length)
  if (handOpened !== 2) fail(`hand-opening Sampling should give 2 open groups, got ${handOpened}`)
  await loadPreset('Aliasing')
  const afterAliasing = await page.$$eval('details.preset-group[open] > summary', (els) =>
    els.map((e) => e.textContent.trim()),
  )
  if (afterAliasing.length !== 1 || !afterAliasing[0].startsWith('Sampling')) {
    fail(`loading Aliasing should leave only Sampling open: ${afterAliasing.join(', ')}`)
  } else {
    console.log('   hand-opened Sampling, loaded Aliasing: only Sampling stays open')
  }
}

// ---------------------- 10h. the math panel does not push the knobs away

console.log('\n10h. Opening the experiment math leaves the first Frequency field in place (1440x900)\n')

{
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  // Position within the sidebar's content, not the viewport: the toggle sits
  // below the fold, and a Playwright click would scroll to it, which is not
  // the movement this check is about. The click goes through the DOM.
  const freqY = () =>
    page
      .getByRole('spinbutton', { name: 'Frequency' })
      .first()
      .evaluate((el) => el.getBoundingClientRect().top + document.querySelector('.controls').scrollTop)
  const toggle = () => page.evaluate(() => document.querySelector('#math .math-toggle').click())
  const before = await freqY()
  await toggle()
  await settle()
  const opened = await page.locator('#math .math-body').count()
  const after = await freqY()
  const moved = Math.abs(after - before)
  if (!opened) fail('the experiment math did not open')
  if (moved > 1) fail(`opening the math moved the Frequency field by ${moved.toFixed(0)} px`)
  else console.log(`   Frequency field at y=${before.toFixed(0)} in the sidebar before and y=${after.toFixed(0)} after opening the math`)
  await toggle()
  await settle()
}

// ---------------- 10i. the fold: named knobs on screen at laptop sizes

console.log(`\n10i. Fold probe: all ${presetNames.length} presets — try line, chips and featured knob(s) inside 1366x768 and 1440x900\n`)

{
  const fresh = (name) => async () => {
    await page.waitForSelector('.views canvas')
    await loadPreset(name)
  }
  // Built from what each preset ACTUALLY renders — not a hand-picked few —
  // so a preset that grows a longer note or a second featured knob after
  // this script was written is still covered. `.chip` alone would also match
  // a NumField's own log-scale quick-value buttons (they share the class),
  // so every locator here is scoped under `.try-line`.
  //
  // `.featured-item` rather than `.featured .num`: a featured control used to
  // be a NumField every time, but a source's Type, a block's Bypass, the
  // chain's Window and its Overlay are a select, a checkbox and a segmented
  // group — every one wrapped in `.featured-item` regardless of what it
  // renders inside, which is the one thing every featured control shares.
  const cases = []
  for (const name of presetNames) {
    await page.waitForSelector('.views canvas')
    await loadPreset(name)
    const must = ['.preset.is-on', '.try-line']
    const featuredCount = await page.locator('.featured .featured-item').count()
    const chipCount = await page.locator('.try-line .chip').count()
    if (featuredCount) {
      must.push('.featured .featured-item')
      if (featuredCount > 1) {
        const lastFeatured = (p) => p.locator('.featured .featured-item').nth(featuredCount - 1)
        lastFeatured.label = `.featured .featured-item[${featuredCount - 1}]`
        must.push(lastFeatured)
      }
    }
    if (chipCount) {
      const lastChip = (p) => p.locator('.try-line .chip').nth(chipCount - 1)
      lastChip.label = `.try-line .chip[${chipCount - 1}]`
      must.push(lastChip)
    }
    cases.push({ name, load: fresh(name), must })
  }
  const r = await foldProbe(page, { url: URL, cases, viewports: LAPTOP_VIEWPORTS })
  for (const m of r.measured) {
    if (!m.control.includes('.featured') && m.control !== '.try-line') continue
    const b = m.box ? `${(m.box.y + m.box.height).toFixed(0)} px` : 'missing'
    console.log(`   ${m.viewport.padEnd(9)} ${m.lesson.padEnd(34)} ${m.control.padEnd(24)} bottom ${b}`)
  }
  for (const f of r.failures) fail(`fold: ${f}`)
  if (r.ok) console.log(`   all ${cases.length} presets: every named control sits inside the viewport with the sidebar at the top`)
}

// ------------------------- 10j. phone: both plots in the first viewport

console.log('\n10j. Phone 390x844: time AND spectrum canvases above the fold\n')

{
  const fresh = (name) => async () => {
    await page.waitForSelector('.views canvas')
    await loadPreset(name)
  }
  const timeCanvas = (p) => p.locator('.views canvas').nth(0)
  timeCanvas.label = 'time canvas'
  const specCanvas = (p) => p.locator('.views canvas').nth(1)
  specCanvas.label = 'spectrum canvas'
  const r = await phoneProbe(page, {
    url: URL,
    cases: [
      { name: 'Single tone', load: fresh('Single tone'), must: [timeCanvas, specCanvas] },
      { name: 'Aliasing', load: fresh('Aliasing'), must: [timeCanvas, specCanvas] },
      // The one preset with two featured knobs at once (see styles.css):
      // its mobile sidebar budget grew to fit both stacked and never
      // checked what that took from the spectrum canvas below — 887 px on
      // an 844 px phone, 43 px permanently unreachable (Reed's review).
      // Neither of the two cases above has a second featured item, so
      // neither could ever have caught it.
      { name: 'Order is a choice', load: fresh('Order is a choice'), must: [timeCanvas, specCanvas] },
    ],
  })
  for (const m of r.measured) {
    const b = m.box ? `${(m.box.y + m.box.height).toFixed(0)} px` : 'missing'
    console.log(`   ${m.lesson.padEnd(14)} ${m.control.padEnd(16)} bottom ${b} (fold 844)`)
  }
  for (const f of r.failures) fail(`phone: ${f}`)
  if (r.ok) console.log('   both canvases fit on a 390x844 phone')
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
}

// -------- 10k. phone: the lesson itself, inside the sidebar's OWN scroller

console.log('\n10k. Phone 390x844: title + try line inside the sidebar box; both canvases ≥ 120 px\n')

{
  // The shared phoneProbe pins ONE scroller (#root, by contract) at the top
  // before measuring. This lab nests a second scroller inside it — `.controls`
  // itself, capped to keep both plots on screen (see styles.css) — and a
  // control sitting below THAT scroller's own bottom edge is exactly as
  // unreachable on a fresh load as one below the page fold, which the shared
  // probe cannot see. So this one is local: it scrolls both to the top, then
  // checks the lesson's title and try line against `.controls`' own box
  // rather than the viewport's.
  await page.setViewportSize({ width: 390, height: 844 })
  const insideBox = (box, outer, label, ctx) => {
    if (!box) { fail(`phone lesson / ${ctx}: ${label} not rendered`); return }
    const bottom = box.y + box.height
    const outerBottom = outer.y + outer.height
    if (box.y < outer.y || bottom > outerBottom) {
      fail(`phone lesson / ${ctx}: ${label} bottom ${bottom.toFixed(0)} outside sidebar box [${outer.y.toFixed(0)}, ${outerBottom.toFixed(0)}]`)
    } else {
      console.log(`   ${ctx.padEnd(14)} ${label.padEnd(10)} bottom ${bottom.toFixed(0)} (sidebar box to ${outerBottom.toFixed(0)})`)
    }
  }
  for (const name of ['Single tone', 'Aliasing', 'Resonance is Q']) {
    await page.goto(URL, { waitUntil: 'load' })
    await page.waitForSelector('.views canvas')
    await loadPreset(name)
    await page.evaluate(() => {
      const el = document.querySelector('.controls')
      if (el) el.scrollTop = 0
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(60)

    const sidebarBox = await page.locator('.controls').boundingBox()
    const titleBox = await page.locator('.note-title').boundingBox().catch(() => null)
    const tryBox = await page.locator('.try-line').boundingBox().catch(() => null)
    insideBox(titleBox, sidebarBox, 'title', name)
    insideBox(tryBox, sidebarBox, 'try-line', name)

    const canvases = page.locator('.views canvas')
    const count = await canvases.count()
    for (let i = 0; i < count; i++) {
      const box = await canvases.nth(i).boundingBox()
      const label = i === 0 ? 'time canvas' : 'spectrum canvas'
      if (!box) { fail(`phone lesson / ${name}: ${label} not rendered`); continue }
      const bottom = box.y + box.height
      if (bottom > 844) fail(`phone lesson / ${name}: ${label} bottom ${bottom.toFixed(0)} > fold 844`)
      if (box.height < 120) fail(`phone lesson / ${name}: ${label} height ${box.height.toFixed(0)} < 120`)
      console.log(`   ${name.padEnd(14)} ${label.padEnd(16)} y ${box.y.toFixed(0)} h ${box.height.toFixed(0)} bottom ${bottom.toFixed(0)}`)
    }
  }
  if (!failures.some((f) => f.startsWith('phone lesson'))) {
    console.log('   title, try line and both ≥120px canvases all sit inside their own boxes on Single tone, Aliasing and Resonance is Q')
  }
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
}

// -------- 10k2. phone: EVERY preset's title, try line AND EVERY featured
// control, fully inside the sidebar's own clipped box — not merely in the DOM
//
// 10k above checks three sample presets and only the title/try-line, which is
// exactly the gap Reed's review named: the probe held the title and the try
// line on screen and never checked the FEATURED KNOB the try line names — the
// one control a lesson actually asks a student to touch. That let a knob
// render 97% clipped (7 of 226 px visible, Single tone measured) while every
// existing check stayed green. This one holds all three, for every preset the
// sidebar can load, against `.controls`' own box exactly as 10k does.

console.log(`\n10k2. Phone 390x844: all ${presetNames.length} presets — title, try line AND every featured control inside the sidebar box\n`)

{
  await page.setViewportSize({ width: 390, height: 844 })
  const insideBox = (box, outer, label, ctx) => {
    if (!box) { fail(`phone featured / ${ctx}: ${label} not rendered`); return false }
    const bottom = box.y + box.height
    const outerBottom = outer.y + outer.height
    // Half a pixel of slack absorbs sub-pixel layout rounding, not a real miss.
    if (box.y < outer.y - 0.5 || bottom > outerBottom + 0.5) {
      fail(`phone featured / ${ctx}: ${label} bottom ${bottom.toFixed(1)} outside sidebar box [${outer.y.toFixed(1)}, ${outerBottom.toFixed(1)}]`)
      return false
    }
    return true
  }
  let allOk = true
  for (const name of presetNames) {
    await page.goto(URL, { waitUntil: 'load' })
    await page.waitForSelector('.views canvas')
    await loadPreset(name)
    await page.evaluate(() => {
      const el = document.querySelector('.controls')
      if (el) el.scrollTop = 0
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(60)

    const sidebarBox = await page.locator('.controls').boundingBox()
    const titleBox = await page.locator('.note-title').boundingBox().catch(() => null)
    const tryBox = await page.locator('.try-line').boundingBox().catch(() => null)
    let ok = insideBox(titleBox, sidebarBox, 'title', name)
    ok = insideBox(tryBox, sidebarBox, 'try-line', name) && ok

    const items = page.locator('.featured .featured-item')
    const n = await items.count()
    for (let i = 0; i < n; i++) {
      const box = await items.nth(i).boundingBox()
      ok = insideBox(box, sidebarBox, `featured[${i}]`, name) && ok
    }
    if (!ok) allOk = false
  }
  if (allOk) {
    console.log(
      `   all ${presetNames.length} presets: title, try line and every featured control sit fully ` +
        "inside the sidebar's clipped box — not merely present in the DOM",
    )
  }
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
}

// -------- 10k3. phone: the sidebar scroller announces itself
//
// `.controls` clips to keep both plots on the first screen (styles.css), and
// on a touch OS a native scrollbar draws only mid-gesture — invisible in a
// still screenshot, which is how the rest of the curriculum went unannounced
// (Reed's review). Confirms the cue is actually there while content remains,
// and actually gone once the scroller reaches its true end — not just present
// unconditionally, which would be its own kind of lie.

console.log('\n10k3. Phone 390x844: the sidebar scroller announces itself\n')

{
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await loadPreset('Single tone')
  await page.evaluate(() => {
    document.querySelector('.controls').scrollTop = 0
  })
  await page.waitForTimeout(60)

  const overflowing = await page.evaluate(() => {
    const el = document.querySelector('.controls')
    return el.scrollHeight - el.clientHeight > 1
  })
  if (!overflowing) fail('phone scroller: expected .controls to overflow on Single tone — cannot check the announcement')

  if (!(await page.locator('.controls.has-more').count())) {
    fail('phone scroller: .controls has more content below but carries no .has-more — nothing announces the scroller')
  } else {
    console.log('   .controls carries .has-more while content remains below the clip (drives the scroll shadow)')
  }

  await page.evaluate(() => {
    const el = document.querySelector('.controls')
    el.scrollTop = el.scrollHeight
  })
  await page.waitForTimeout(80)
  if (await page.locator('.controls.has-more').count()) {
    fail('phone scroller: .has-more is still present after scrolling to the true end')
  } else {
    console.log('   .has-more clears once the scroller reaches its true end')
  }

  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
}

// -------- 10k4. the sidebar returns to the lesson after a real tap, not
// only after prev/next
//
// 10k/10k2/10k3 above all force `.controls.scrollTop = 0` before measuring —
// which is exactly why the pane's own scroll position surviving a sidebar
// tap went uncaught (Reed's review). A student does the opposite of that
// reset: opens a folded group and taps a preset inside it, and Playwright's
// own `.click()` scrolls the button into view first, precisely mirroring
// where a person's tap would leave the pane. Nothing here re-homes the
// scroll afterward — the app itself has to, on load. Two cases: a phone,
// where the sidebar is its own short scroller, and a laptop with more than
// one group left open by "browsing ahead", the review's other measured
// case (1500+ px, no page scrollbar to hint at it).

console.log('\n10k4. Tapping a lesson deep in the list lands the try line and every featured control on screen — no scroll reset first\n')

async function checkLessonVisible(ctx) {
  const sidebarBox = await page.locator('.controls').boundingBox()
  const tryBox = await page.locator('.try-line').boundingBox().catch(() => null)
  const items = page.locator('.featured .featured-item')
  const n = await items.count()
  const boxes = [{ label: 'try-line', box: tryBox }]
  for (let i = 0; i < n; i++) boxes.push({ label: `featured[${i}]`, box: await items.nth(i).boundingBox() })
  let ok = true
  for (const { label, box } of boxes) {
    if (!box) {
      fail(`tap-nav / ${ctx}: ${label} not rendered`)
      ok = false
      continue
    }
    const bottom = box.y + box.height
    const outerBottom = sidebarBox.y + sidebarBox.height
    console.log(
      `   ${ctx.padEnd(28)} ${label.padEnd(12)} top ${box.y.toFixed(0)} bottom ${bottom.toFixed(0)}` +
        ` (sidebar [${sidebarBox.y.toFixed(0)}, ${outerBottom.toFixed(0)}])`,
    )
    if (box.y < sidebarBox.y - 0.5 || bottom > outerBottom + 0.5) {
      fail(
        `tap-nav / ${ctx}: ${label} outside the sidebar's visible box [${sidebarBox.y.toFixed(0)}, ` +
          `${outerBottom.toFixed(0)}], got [${box.y.toFixed(0)}, ${bottom.toFixed(0)}]`,
      )
      ok = false
    }
  }
  return ok
}

{
  // Phone: open Nonlinearity by hand-scrolling the list, then tap Ring
  // modulator — the review's own example (495 px above the fold before the
  // fix).
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await loadPreset('Ring modulator')
  await page.waitForTimeout(80)
  if (await checkLessonVisible('phone / Ring modulator')) {
    console.log('   phone: Ring modulator, tapped after opening Nonlinearity, lands inside the sidebar box')
  }
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
}

{
  // 1440x900: hand-open a second group ahead of the active one — "browsing
  // ahead", which the review calls a normal way to use the sidebar — then
  // tap a preset in a third, later group while the second is still open.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await loadPreset('Single tone')
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details.preset-group')) {
      if (d.querySelector('summary')?.childNodes[0]?.textContent.trim() === 'Filters' && !d.open) {
        d.querySelector('summary').click()
      }
    }
  })
  await page.waitForTimeout(80)
  const heightsBefore = await page.evaluate(() => {
    const el = document.querySelector('.controls')
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }
  })
  console.log(
    `   1440x900: Signals-and-Fourier + Filters both open, .controls scrollHeight ${heightsBefore.scrollHeight}` +
      ` vs clientHeight ${heightsBefore.clientHeight}`,
  )
  await loadPreset('Ring modulator')
  await page.waitForTimeout(80)
  if (await checkLessonVisible('1440x900 / Ring modulator')) {
    console.log('   1440x900: Ring modulator, tapped with a second group already open, lands inside the sidebar box')
  }
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
}

{
  // 1440x900, no tap at all: Single tone stays loaded and every OTHER group
  // gets opened by hand, one at a time — the review's "browsing ahead"
  // case. `.preset-list` sits above `.lesson` in the DOM at this width, so
  // this alone pushes the still-active lesson down the pane with the
  // scroll position never moving (measured before the fix: the try line at
  // 937-1011 px and the featured knob at 1024-1131 px, both below a 900 px
  // sidebar box whose scrollHeight had grown to 2164).
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await loadPreset('Single tone')
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details.preset-group')) {
      const label = d.querySelector('summary')?.childNodes[0]?.textContent.trim()
      if (['Sampling', 'Filters', 'FIR and the z-plane', 'Nonlinearity'].includes(label) && !d.open) {
        d.querySelector('summary').click()
      }
    }
  })
  await page.waitForTimeout(80)
  const heights = await page.evaluate(() => {
    const el = document.querySelector('.controls')
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }
  })
  console.log(
    `   1440x900: Single tone stays loaded, every other group hand-opened, .controls scrollHeight ` +
      `${heights.scrollHeight} vs clientHeight ${heights.clientHeight}`,
  )
  if (await checkLessonVisible('1440x900 / Single tone, groups opened by hand')) {
    console.log('   1440x900: Single tone stays fully visible while every other group is opened, no tap at all')
  }
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
}

// ---------------- 10l. Single tone: Amplitude is a real micro-experiment now

console.log('\n10l. Single tone: Amplitude is a real micro-experiment now, not just a baseline\n')
{
  await loadPreset('Single tone')
  const ampField = page.locator('.featured').getByRole('spinbutton', { name: 'Amplitude' })
  if ((await ampField.count()) === 0) {
    fail('Single tone: no featured Amplitude control under the try line')
  } else {
    const ampOf = (r) => (r['Frequency domain'] || []).find((s) => s.startsWith('amp')) || ''
    const numOf = (s) => Number((s.match(/[\d.]+/) || [])[0])
    const before = numOf(ampOf(await readout()))
    await setField('Amplitude', 0.5)
    const after = numOf(ampOf(await readout()))
    console.log(`   amp before ${before}, after dragging to 0.5: ${after}`)
    if (!(before > 0) || Math.abs(after / before - 0.5) > 0.05) {
      fail(`Single tone: dragging Amplitude to 0.5 did not halve the readout (before ${before}, after ${after})`)
    } else {
      console.log('   dragging Amplitude to 0.5 halves the line — 6.02 dB down, as the try line claims')
    }
  }
}

// ------------------ 10m. Convolution's mirrored play button actually plays

console.log("\n10m. Convolution: the mirrored play button under the try line actually plays\n")
{
  await loadPreset('Convolution, watched')
  const playBtn = page.locator('.featured .try-play')
  if ((await playBtn.count()) === 0) {
    fail('Convolution, watched: no mirrored play button under the try line')
  } else {
    const before = await canvasHashes()
    await playBtn.click()
    await page.waitForTimeout(350)
    const after = await canvasHashes()
    if (JSON.stringify(before) === JSON.stringify(after)) {
      fail('Convolution, watched: clicking the mirrored play button did not advance the animation')
    } else {
      console.log('   the play button mirrored under the try line advances the same scrubber as the canvas transport')
    }
    await playBtn.click() // pause again, tidy
  }
}

// ------------- 10n. Bypass, featured under the try line, IS the block's own switch

console.log("\n10n. Bypass featured under the try line matches the block's own switch\n")
{
  for (const [name, blockIndex] of [['Two filters are steeper', 1], ['Two tones, one nonlinearity', 0]]) {
    await loadPreset(name)
    await expandBlocks()
    const featChk = page.locator('.featured .check input[type="checkbox"]')
    if ((await featChk.count()) === 0) {
      fail(`${name}: no featured bypass checkbox under the try line`)
      continue
    }
    const cardIcon = page.locator('.block').nth(blockIndex).locator('.block-head .icon')
    const before = await cardIcon.getAttribute('aria-pressed')
    await featChk.check()
    await settle()
    const after = await cardIcon.getAttribute('aria-pressed')
    if (before === after) {
      fail(`${name}: the featured bypass toggle did not flip the block card's own switch (stayed ${after})`)
    } else {
      console.log(`   ${name}: featured Bypass flips the block card's own ⏻ switch (${before} → ${after})`)
    }
  }
}

// -------- 10o. Chain-global featured controls: FFT, Rate, Window, Overlay

console.log('\n10o. Chain-global controls (FFT, Rate, Window, Overlay) featured under their try lines\n')
{
  const cases = [
    { name: 'Beating', kind: 'spin', label: 'FFT' },
    { name: 'Turn the rate down', kind: 'spin', label: 'Rate' },
    { name: 'Resolution needs time', kind: 'spin', label: 'FFT' },
    { name: 'Spectral leakage', kind: 'select' },
    { name: 'Phase is invisible here', kind: 'segmented' },
  ]
  for (const c of cases) {
    await loadPreset(c.name)
    const n =
      c.kind === 'spin'
        ? await page.locator('.featured').getByRole('spinbutton', { name: c.label }).count()
        : c.kind === 'select'
          ? await page.locator('.featured select').count()
          : await page.locator('.featured .segmented button').count()
    if (n === 0) fail(`${c.name}: no featured ${c.kind === 'spin' ? c.label : c.kind} control under the try line`)
    else console.log(`   ${c.name}: featured ${c.kind === 'spin' ? c.label : c.kind} control is under the try line`)
  }
}

// --------- 10p. The one hand-over out: a real link only when deployed beside
//
// This section used to assert one thing only — that no link is drawn — and it
// was run only against `vite preview` on a bare port, where labUrl() resolves
// null and there is nothing to draw. So it passed by describing the fallback
// and never once looked at the link a student actually gets.
//
// That is how Signal Lab shipped a 115x16 px hand-over link on a phone while
// section 12 below reported every element clearing the 44 px floor. Nothing
// was on an exception list. The link was not in the DOM to be measured, and a
// probe over an empty set passes. Served under a real `/signal-lab/` path the
// same unmodified probe failed on its first run, and the deployed layout puts
// 4111 interactive elements on the page against a bare port's 4075 — 36 that
// no run had ever measured.
//
// So the assertion now depends on which layout it is looking at, and each
// branch is a real claim. On a bare port: no link, because there is no sibling
// to point at. On the deployed path: a link that resolves to the sibling AND
// carries a thumb-sized box, checked here rather than left to section 12, so
// this one cannot go back to being measured only when someone remembers to.
//
// Run it against the deployed layout with:
//   node scripts/assemble-site.mjs --serve
//   APP_URL=http://localhost:47600/signal-lab/ node apps/signal-lab/scripts/verify.mjs

console.log('\n10p. Circuit Lab hand-over: absent on a bare port, thumb-sized when deployed\n')
{
  await loadPreset('Resonance is Q')
  // The deployed site serves each lab from its own folder beside its
  // siblings; `vite preview` serves one lab at the root of a bare port. That
  // is exactly the condition deeplink.js keys on, so it is what we key on.
  const deployed = /\/(signal|circuit|control|circuit-elements|power)-lab\/?$/.test(new global.URL(URL).pathname)
  const link = page.locator('.circuit-forward a').first()
  const count = await link.count()

  if (!deployed) {
    if (count) fail('Resonance is Q: the hand-over drew a link on a bare dev port — labUrl should resolve null there')
    else console.log('   bare port: no link, as designed (labUrl resolves null off the deployed path)')
  } else if (!count) {
    fail('Resonance is Q: the hand-over drew NO link on the deployed path — labUrl should resolve a sibling there')
  } else {
    const href = await link.getAttribute('href')
    if (!/circuit-lab\//.test(href || '')) fail(`Resonance is Q: hand-over href does not point at Circuit Lab: ${href}`)

    await page.setViewportSize(PHONE_VIEWPORT)
    await page.evaluate(() => document.fonts.ready)
    const box = await link.boundingBox()
    if (!box) fail('Resonance is Q: the deployed hand-over link has no box to measure')
    else if (box.height < 44 || box.width < 44) {
      fail(`Resonance is Q: deployed hand-over link is ${Math.round(box.width)}x${Math.round(box.height)}px, under the 44px floor`)
    } else {
      console.log(`   deployed: link to ${href}, ${Math.round(box.width)}x${Math.round(box.height)}px at 390x844`)
    }
    await page.setViewportSize({ width: 1280, height: 900 })
  }
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

// -------------------------------------------- 12. touch targets at 390x844
//
// Two student testers on phones found this ("it constantly asks the student
// to pinpoint instead of tap", "the navigation buttons are too small and too
// close together"), and a walk of the released labs measured it: every
// interactive element here ran under 44x44 CSS px. FLOOR = 44 — the Apple
// HIG / Material touch-target guideline, chosen over the bare 24px WCAG 2.2
// SC 2.5.8 legal minimum because this is a dense, numbers-heavy tool meant
// to be poked quickly and often. tapTargetProbe.mjs (packages/ui/verify)
// walks the page, crediting an invisible ::before/::after hit area
// (position:relative + a negative inset) where a control keeps its visible
// glyph small on purpose, and a checkbox's wrapping <label> in place of its
// own tiny native box (this lab wraps its "enable source" checkbox in one
// for exactly this reason — it had no label at all before).
//
// One documented exception, held to the 24px HARD_FLOOR instead: a control
// inside a PLOT pane (.views — the block-diagram opener, a view switch, the
// convolution transport's play button and speed chips). Its options often
// touch with no real gap (a true segmented control), so an invisible hit
// area would let a thumb bridge two, and growing it for real at 44 costs
// more of the two-plots-on-screen budget (both canvases ≥120px, item 10j)
// than this lab can spare — so the plot pane's own chrome stays at WCAG's
// legal floor rather than the suite's 44px target.
console.log('\n12. Touch targets at 390x844 (button, link, summary, role=button, checkbox)\n')
{
  await page.setViewportSize(PHONE_VIEWPORT)
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')

  const exceptionFloor = (el) => (el.inViews || el.inLabNav ? HARD_FLOOR : null)

  let checked = 0
  for (const name of presetNames) {
    await loadPreset(name)
    const res = await tapTargetProbe(page, { exceptionFloor })
    checked += res.checked
    for (const f of res.failures) fail(`touch target · ${name}: ${f}`)
  }
  console.log(`   ${presetNames.length} presets: ${checked} interactive elements checked at 390x844, every one clears the ${FLOOR}px floor (the plot panes' own chrome held to the ${HARD_FLOOR}px floor instead)`)
}

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
