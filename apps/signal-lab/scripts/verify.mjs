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
  await page.locator('.preset').filter({ hasText: new RegExp(`^${esc}$`) }).first().click()
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
  const pressed = await page.$$eval('.controls .segmented button[aria-pressed="true"]', (b) =>
    b.map((x) => x.textContent.trim()),
  )
  if (!pressed.includes('Group delay')) {
    fail(`group-delay overlay not selected by the preset: ${pressed.join(', ')}`)
  } else {
    console.log('   preset selected the group-delay overlay')
  }

  const before = (await canvasHashes())[1]
  await page.locator('.controls .segmented button', { hasText: 'Phase' }).first().click()
  await settle()
  const after = (await canvasHashes())[1]
  if (before === after) fail('switching overlay from group delay to phase did not redraw')
  else console.log('   overlay switches redraw the spectrum')

  await page.locator('.controls .segmented button', { hasText: 'None' }).first().click()
  await settle()
  if ((await canvasHashes())[1] === after) fail('turning the overlay off did not redraw')
}

if (await scrolls()) fail('new views: page scrolls')

// -------------------------------------------------------------- 11. 4K fit

console.log('\n11. Re-checking layout at 4K\n')
await page.setViewportSize({ width: 3840, height: 2160 })
await page.waitForTimeout(500)
for (const name of presetNames) {
  await page.locator('.preset', { hasText: name }).first().click()
  await page.waitForTimeout(120)
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
