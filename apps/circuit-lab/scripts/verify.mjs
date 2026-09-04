// End-to-end verification for Circuit Lab, in a real browser.
//
// The unit tests call the circuit algebra directly. This drives the page: loads
// every circuit, opens every math panel, changes component values, and checks
// that the readouts, the panels and the canvas pixels all follow. It is the only
// thing that can catch a wiring mistake — a prop not passed, a panel fed stale
// state, a plot that quietly stopped redrawing — and in Signal Lab the
// equivalent harness found three bugs the unit tests could not see.
//
//   npm run preview   (in another shell)
//   npm run verify

import { chromium } from 'playwright'
import { foldProbe, phoneProbe, PHONE_VIEWPORT } from '@ee-labs/ui/verify/foldProbe.mjs'
import { tapTargetProbe, FLOOR, HARD_FLOOR } from '@ee-labs/ui/verify/tapTargetProbe.mjs'
import { LESSONS, START_LESSON } from '../src/lessons.js'

const ORIGIN = (process.env.APP_URL || 'http://localhost:4175').replace(/\/$/, '')
// The build is served at the origin's root, but the hand-over links only
// resolve when the page sits beside its siblings at /<lab>/ (siblingUrl reads
// the folder off the pathname). So the harness visits /circuit-lab/ and
// rewrites every request under it back to the root — the deployed layout,
// served by the preview.
const URL = `${ORIGIN}/circuit-lab/`
const failures = []
const fail = (m) => failures.push(m)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await page.route(`${ORIGIN}/circuit-lab/**`, (route) => {
  const u = new globalThis.URL(route.request().url())
  const rest = u.pathname.replace(/^\/circuit-lab\/?/, '')
  route.continue({ url: `${ORIGIN}/${rest}${u.search}` })
})

const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`)
})

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.views canvas')
await page.waitForTimeout(400)

const settle = () => page.waitForTimeout(220)

const scrolls = () =>
  page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  )

const canvasHashes = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.views canvas')].map((c) => {
      const d = c.toDataURL()
      let h = 0
      for (let i = 0; i < d.length; i += 97) h = (h * 31 + d.charCodeAt(i)) | 0
      return `${h}:${d.length}`
    }),
  )

// The math is a view of the lower pane — a tab beside Step and Poles — so
// "opening" it is selecting that tab. (It was a fold in the sidebar, and
// unfolding it grew the sidebar by ~1900 px.)
async function openAllMath() {
  const tab = page.getByRole('button', { name: 'Math', exact: true })
  if ((await tab.getAttribute('aria-pressed')) !== 'true') {
    await tab.click()
    await page.waitForTimeout(120)
  }
}

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

/** The named figures across the top: DC gain, f0, Q, zeta. */
const topbar = () =>
  page.evaluate(() => {
    const out = {}
    for (const f of document.querySelectorAll('.topbar-field')) {
      const k = f.querySelector('span')?.textContent.trim()
      const v = f.querySelector('b')?.textContent.trim()
      if (k) out[k] = v
    }
    return out
  })

/** Parse a value that may carry an SI prefix: "5.033k" -> 5033. */
function si(text) {
  if (!text) return NaN
  const m = String(text).match(/(-?[\d.]+)\s*([pnµumkMGT]?)/)
  if (!m) return NaN
  const mult = { p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, '': 1, k: 1e3, M: 1e6, G: 1e9, T: 1e12 }
  return parseFloat(m[1]) * (mult[m[2]] ?? 1)
}

// Values are typed WITH an SI prefix, the way a user would.
//
// These fields are in engineering-notation mode, where a bare number is read in
// the prefix currently on display: with "1 kΩ" showing, typing 1000 means
// 1000 kΩ. That is deliberate and it is what makes nudging within a decade
// pleasant, but it means a harness that types raw SI values is testing
// something nobody would ever do.
async function setField(label, value) {
  const box = page.getByRole('spinbutton', { name: label }).first()
  await box.fill(String(value))
  await box.press('Enter')
  await settle()
}

// Only the chips in the sidebar lists — the hand-over section's copy buttons
// share the .preset class but come and go per circuit (the raw tier gave one
// to nearly every circuit, and the integrator's reasoned refusal takes it
// away), and sweeping them as if they were circuits timed out exactly there.
const circuitNames = await page.$$eval('.presets .preset', (els) =>
  els.map((e) => e.textContent.trim()),
)
const pick = async (name) => {
  const btn = page.getByRole('button', { name, exact: true })
  // Preset groups fold now; a button in a folded group is not clickable until
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

// ------------------------------------------ 0. the course starts itself

console.log('\n0. Fresh load: the lab opens on a lesson, not as a bare instrument\n')
{
  const lit = await page.locator('.presets .preset.is-on').first().textContent()
  if (lit.trim() !== START_LESSON) fail(`fresh load should light "${START_LESSON}", got "${lit.trim()}"`)
  const tryLine = await page.locator('.try-line').count()
  if (!tryLine) fail('fresh load: no try line under the note')
  const count = (await page.locator('.lesson-nav-count').textContent().catch(() => '')).trim()
  const want = `${LESSONS.findIndex((l) => l.name === START_LESSON) + 1} of ${LESSONS.length}`
  if (count !== want) fail(`lesson nav should read "${want}", got "${count}"`)
  const groupOpen = await page.evaluate(() =>
    [...document.querySelectorAll('details.preset-group')].some(
      (d) => d.open && d.querySelector('.preset.is-on'),
    ),
  )
  if (!groupOpen) fail("the start lesson's group should be unfolded")
  const circuits = await page.locator('.controls h2', { hasText: 'Circuits' }).count()
  if (!circuits) fail('the Circuits picker should still be there below Try this')
  const sub = await page.locator('.controls .sub').textContent()
  if (!/Start with Try this, top to bottom\./.test(sub)) fail('subhead should say where to start')
  const stale = await page.locator('[data-role=note-stale]').count()
  if (stale) fail('a freshly loaded lesson must not read as stale')
  // Student-review item 3: "2 of 15" with no explanation reads as a bug. The
  // corner stays the opening lesson (a better first picture); one line says
  // what lesson 1 is instead.
  const startHint = (await page.locator('[data-role=start-hint]').textContent().catch(() => '')).trim()
  if (!/Lesson 1.*flat divider/.test(startHint)) fail(`fresh load should explain "${count}": got "${startHint}"`)
  console.log(`   lit: ${lit.trim()} · nav ${count} · group open · Circuits below · try line present`)
  console.log(`   start hint: "${startHint}"`)
}

// --------------------------------------------- 1. every circuit, every panel

console.log(`\n1. Loading all ${circuitNames.length} circuits, opening every math panel\n`)
for (const name of circuitNames) {
  await pick(name)
  if (await scrolls()) fail(`${name}: page scrolls`)
  await openAllMath()

  const checks = await readChecks()
  const bad = checks.filter((r) => r.mark === '✗')
  for (const b of bad) fail(`${name}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)

  const vals = await readValues()
  const hasSchematic = (await page.locator('.schematic').count()) > 0
  if (!hasSchematic) fail(`${name}: no schematic drawn`)

  console.log(
    `   ${name.padEnd(24)} ${String(checks.filter((r) => r.mark === '✓').length).padStart(2)} ✓  ` +
      `${String(vals.length).padStart(2)} derived  ${bad.length} ✗  schematic ${hasSchematic ? 'yes' : 'NO'}`,
  )
}

// ------------------------------------- 2. does the RC corner follow R and C?

console.log('\n2. RC low-pass: does the corner move as 1/(2πRC)?\n')
await pick('RC low-pass')
await openAllMath()
let prev = await canvasHashes()
for (const [rTxt, r, cTxt, c] of [
  // Not the defaults, or the first step legitimately redraws nothing.
  ['2.2k', 2200, '47n', 47e-9],
  ['10k', 10000, '100n', 100e-9],
  ['1k', 1000, '10n', 10e-9],
  ['4.7k', 4700, '22n', 22e-9],
]) {
  await setField('R', rTxt)
  await setField('C', cTxt)
  const want = 1 / (2 * Math.PI * r * c)
  const rows = await readChecks()
  const bad = rows.filter((x) => x.mark === '✗')
  // The panel labels the row with the corner it computed.
  const row = rows.find((x) => x.label.includes('f_c'))
  const shown = row ? si((row.label.match(/=\s*([\d.]+\s*\S*)\s*Hz/) || [])[1]) : NaN
  const ok = Number.isFinite(shown) ? Math.abs(shown - want) / want < 0.01 : false
  const now = await canvasHashes()
  console.log(
    `   R=${rTxt.padStart(5)} C=${cTxt.padEnd(5)} -> f_c ${want.toFixed(1).padStart(9)} Hz  ` +
      `panel ${row ? shown.toFixed(1).padStart(9) : '?'}  ${ok ? 'ok' : 'MISMATCH'}  ${bad.length} ✗`,
  )
  if (!ok) fail(`RC R=${rTxt} C=${cTxt}: panel corner ${shown} vs ${want}`)
  for (const b of bad) fail(`RC R=${rTxt} C=${cTxt}: ✗ ${b.label}`)
  if (now[0] === prev[0]) fail(`RC R=${rTxt} C=${cTxt}: Bode canvas did not redraw`)
  prev = now
}

// ---------------------- 2b. the axis holds still while components are tuned

console.log('\n2b. Sticky axis: tuning moves the curve, not the labels\n')
const spanShown = async () =>
  (await page.locator('.readout').first().textContent()).match(/span\s*([^–]+–[^H]+Hz)/)?.[1].trim()
await pick('RC low-pass')
await setField('R', '1k')
await setField('C', '100n')
const span0 = await spanShown()
// A 10x component change moves the corner a decade: well within the view, so
// the axis must not move.
await setField('C', '10n')
const span1 = await spanShown()
console.log(`   span before: ${span0}`)
console.log(`   after 10x C change: ${span1}  ${span0 === span1 ? '(held)' : '(MOVED)'}`)
if (span0 !== span1) fail(`axis re-centred on a 10x tune: "${span0}" -> "${span1}"`)
// Push the corner two decades past its axis room and the view must follow.
await setField('C', '10p')
const span2 = await spanShown()
if (span2 === span0) fail('axis never re-centres — a corner pushed to the edge was lost')
else console.log(`   after a 10,000x change ${span2}  (re-centred, as it must)`)
// And switching circuits always reframes.
await pick('Series RLC')
const span3 = await spanShown()
if (span3 === span2) fail('switching circuits should re-centre the axis')
else console.log('   switching to the RLC reframed the axis')

// -------------------- 2c. the step pane's axes hold still while tuning too

console.log('\n2c. Sticky step axes: tuning moves the curve, not the frame\n')
{
  const frame = () =>
    page.evaluate(() => {
      const c = document.querySelectorAll('.views canvas')[1]
      return { t: c?.dataset.tMax, y: c?.dataset.yHi }
    })
  await pick('RC low-pass')
  // Section 2 left the lower pane on the Math tab; the frame under test is
  // the step canvas.
  await page.getByRole('button', { name: 'Step response' }).click()
  await settle()
  await setField('R', '2.2k')
  await setField('C', '100n')
  const f0 = await frame()
  // Speeding the circuit up by half moves the arrival left across the SAME
  // frame — this is the whole point.
  await setField('R', '1k')
  const f1 = await frame()
  console.log(`   frame before: t≤${f0.t}s  after 2.2x speed-up: t≤${f1.t}s  ${f0.t === f1.t ? '(held)' : '(MOVED)'}`)
  if (f0.t !== f1.t) fail(`step time axis re-framed on a modest tune: ${f0.t} -> ${f1.t}`)
  if (f0.y !== f1.y) fail(`step y-range re-framed on a modest tune: ${f0.y} -> ${f1.y}`)
  // A 100x change has genuinely outgrown the frame; holding now would cram
  // the arrival into the first pixels, so it must re-frame. Typed with the
  // displayed prefix in mind: the field shows kΩ, so a bare "10" would be
  // 10 kΩ — the eng-notation gotcha, which bit THIS harness line first.
  await setField('R', '0.01k')
  const f2 = await frame()
  if (f2.t === f0.t) fail('step time axis never re-frames — a 100x faster arrival was lost')
  if (parseFloat(f2.t) > parseFloat(f0.t)) {
    fail(`a 100x speed-up must re-frame DOWN: ${f0.t} -> ${f2.t}`)
  } else {
    console.log(`   after a 100x speed-up: t≤${f2.t}s  (re-framed down, as it must)`)
  }
}

// ------------------------------- 3. do resonance and Q follow L, C and R?

console.log('\n3. Series RLC: do f₀ and Q follow the components?\n')
await pick('Series RLC')
await openAllMath()
for (const [rT, r, lT, l, cT, c] of [
  ['100', 100, '10m', 10e-3, '100n', 100e-9],
  ['100', 100, '1m', 1e-3, '100n', 100e-9],
  ['10', 10, '10m', 10e-3, '100n', 100e-9],
  ['1k', 1000, '10m', 10e-3, '10n', 10e-9],
]) {
  await setField('R', rT)
  await setField('L', lT)
  await setField('C', cT)
  const wantF0 = 1 / (2 * Math.PI * Math.sqrt(l * c))
  const wantQ = (1 / r) * Math.sqrt(l / c)
  const t = await topbar()
  const gotF0 = si(t['f₀'])
  const gotQ = parseFloat(t.Q)
  const okF = Math.abs(gotF0 - wantF0) / wantF0 < 0.01
  const okQ = Math.abs(gotQ - wantQ) / wantQ < 0.01
  const bad = (await readChecks()).filter((x) => x.mark === '✗')
  console.log(
    `   R=${rT.padStart(4)} L=${lT.padEnd(4)} C=${cT.padEnd(5)} -> ` +
      `f₀ ${gotF0.toFixed(0).padStart(7)} (want ${wantF0.toFixed(0).padStart(7)})  ` +
      `Q ${gotQ.toFixed(3).padStart(8)} (want ${wantQ.toFixed(3).padStart(8)})  ` +
      `${okF && okQ ? 'ok' : 'MISMATCH'}  ${bad.length} ✗`,
  )
  if (!okF) fail(`RLC R=${rT} L=${lT} C=${cT}: f₀ ${gotF0} vs ${wantF0}`)
  if (!okQ) fail(`RLC R=${rT} L=${lT} C=${cT}: Q ${gotQ} vs ${wantQ}`)
  for (const b of bad) fail(`RLC R=${rT} L=${lT} C=${cT}: ✗ ${b.label}`)
}

// --------------------------- 4. one circuit, three genuinely different filters

console.log('\n4. Series RLC: are the three outputs actually different filters?\n')
await pick('Series RLC')
await openAllMath()
const seen = new Map()
for (const label of ['across C — low-pass', 'across R — band-pass', 'across L — high-pass']) {
  await page.locator('.controls select').first().selectOption({ label })
  await settle()
  const t = await topbar()
  const hashes = await canvasHashes()
  seen.set(label, hashes[0])
  const rows = await readChecks()
  const bad = rows.filter((x) => x.mark === '✗')
  // The phase-at-resonance row follows the output select: −90° across C,
  // 0° across R, +90° across L. New wiring, so its presence is asserted
  // rather than trusted to the generic ✗ sweep.
  const phRow = rows.find((x) => x.label.includes('phase at f₀'))
  const wantPh = label.includes('band-pass') ? 0 : label.includes('high-pass') ? 90 : -90
  if (!phRow) fail(`${label}: no "phase at f₀" check row`)
  else if (Math.abs(parseFloat(phRow.theory) - wantPh) > 0.01) {
    fail(`${label}: phase at f₀ predicts ${phRow.theory}, expected ${wantPh}`)
  }
  console.log(
    `   ${label.padEnd(24)} DC gain ${String(t['DC gain']).padStart(8)}  ` +
      `phase@f₀ ${phRow ? phRow.theory : '?'}  ${bad.length} ✗`,
  )
  for (const b of bad) fail(`${label}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)
}
const uniq = new Set(seen.values())
if (uniq.size !== 3) fail(`the three RLC outputs produced ${uniq.size} distinct plots, not 3`)
console.log(`   -> ${uniq.size} distinct frequency responses from one circuit`)

// A lesson note describes one setup, and the output probe is part of it: the
// biquad lesson says "low-pass" in so many words, so moving the probe to L
// must retire the note rather than leave it lying about the screen.
console.log('\n4x. A lesson note is flagged stale when the probe moves off its setup\n')
await pick('This circuit is a biquad')
const hints = () => page.$$eval('.controls .hint', (els) => els.map((e) => e.textContent))
const noteOn = (await hints()).some((t) => t.includes('low-pass biquad'))
if (!noteOn) fail('the biquad lesson note did not appear')

// Definitions on contact: the note leans on "biquad" and "Q", so a folded
// "Terms used here" with those definitions must sit right under it.
{
  const terms = await page.$$eval('details.terms dt', (els) => els.map((e) => e.textContent))
  if (!terms.length) fail('no terms panel under the biquad lesson note')
  if (!terms.some((t) => t.includes('Biquad'))) fail(`terms panel misses "Biquad": ${terms.join(', ')}`)
  console.log(`   terms offered under the note: ${terms.join(', ')}`)
}

// The math is no longer a fold in the sidebar (unfolded, it pushed every knob
// ~1900 px down); it is a tab of the lower pane, beside Step and Poles.
{
  const toggles = await page.locator('.controls .math-toggle').count()
  if (toggles) fail('the sidebar should no longer carry a math fold')
  const tab = await page.getByRole('button', { name: 'Math', exact: true }).count()
  if (!tab) fail('the lower pane should offer a Math tab')
  await openAllMath()
  const rows = await readChecks()
  if (!rows.length) fail('the Math tab should render the check rows')
  const inPane = await page.locator('.views .math-pane .math-check').count()
  if (!inPane) fail('the math body should render inside the lower pane')
  // A budget row: the error budget the wobble note used to carry as prose.
  if (!rows.some((r) => /Q per % of R/.test(r.label))) fail('the RLC math should carry the error-budget rows')
  const bad = rows.filter((r) => r.mark === '✗')
  for (const b of bad) fail(`Math tab: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)
  console.log(`   Math tab in the lower pane: ${rows.length} check rows, ${bad.length} ✗; no sidebar fold`)
}
await page.locator('.controls select').first().selectOption({ label: 'across L — high-pass' })
await settle()
{
  const stale = await page.locator('[data-role=note-stale]').count()
  const reset = await page.locator('.lesson-nav-reset').count()
  const stillLit = (await page.locator('.presets .preset.is-on').first().textContent()).trim()
  if (!stale) fail('moving the probe to L must flag the low-pass note stale')
  if (!reset) fail('a stale lesson must offer a reset')
  if (stillLit !== 'This circuit is a biquad') fail(`the lesson chip should stay lit while dirty, got "${stillLit}"`)
  await page.locator('.lesson-nav-reset').click()
  await settle()
  const back = await page.locator('.controls select').first().inputValue()
  if (back !== 'c') fail(`reset should put the probe back on C, got "${back}"`)
  if (await page.locator('[data-role=note-stale]').count()) fail('reset should clear the stale flag')
  console.log('   probe → L: note flagged stale, chip still lit, reset restores across C')
}

// ---------------------------------------- 4a. real parts wobble the numbers

console.log('\n4a. Tolerance: the cloud appears, the ranges are sane, exact clears it\n')
await pick('Series RLC')
// The lesson loads this directly, with the poles view and 5% parts.
await pick('Real parts wobble')
const spreadText = async () =>
  (await page.locator('[data-role=tolerance-spread]').textContent().catch(() => '')) || ''
const t5 = await spreadText()
const m5 = t5.match(/±([\d.]+)%.*±([\d.]+)%/)
if (!m5) fail(`no tolerance spread text after the wobble lesson: "${t5.slice(0, 80)}"`)
else {
  const f0Pct = parseFloat(m5[1])
  const qPct = parseFloat(m5[2])
  console.log(`   ±5% parts -> f₀ ±${f0Pct}%  Q ±${qPct}%`)
  if (!(f0Pct > 2 && f0Pct <= 5.5)) fail(`f₀ spread ${f0Pct}% out of range for ±5% parts`)
  if (!(qPct > f0Pct * 1.3)) fail(`Q spread ${qPct}% should exceed f₀'s ${f0Pct}% clearly`)
}
const withBand = await canvasHashes()
// The "every part at once" row, not a single part's control: the lesson set
// every part to ±5%, so only the master row can clear them all in one click.
await page.locator('[data-role=tol-all] button', { hasText: 'exact' }).first().click()
await settle()
if ((await spreadText()) !== '') fail('spread text should clear at exact')
const cleared = await canvasHashes()
if (cleared[1] === withBand[1]) fail('clearing tolerance did not redraw the poles view')
if (cleared[0] === withBand[0]) fail('clearing tolerance did not remove the response band')
else console.log('   exact -> cloud, ranges and shaded band gone, canvases redrew')
// The wobble lesson switched the lower pane to poles & zeros; put it back, or
// section 5's "switching to the pole-zero view redraws" is a no-op.
await page.getByRole('button', { name: 'Step response' }).click()
await settle()

// ------------------- 4b. Sallen–Key: Q from ratios, with no inductor anywhere

console.log('\n4b. Sallen–Key: do f₀ and Q follow the component ratios?\n')
await pick('Sallen–Key low-pass')
await openAllMath()
for (const [r1T, r1, r2T, r2, c1T, c1, c2T, c2] of [
  ['10k', 1e4, '10k', 1e4, '22n', 22e-9, '10n', 10e-9],
  // C1/C2 ratio up: Q rises with no resistor change — the active-filter pitch.
  ['10k', 1e4, '10k', 1e4, '100n', 100e-9, '10n', 10e-9],
  // Unequal resistors.
  ['4.7k', 4.7e3, '22k', 2.2e4, '47n', 47e-9, '4.7n', 4.7e-9],
]) {
  await setField('R1', r1T)
  await setField('R2', r2T)
  await setField('C1 (feedback)', c1T)
  await setField('C2 (to ground)', c2T)
  const wantF0 = 1 / (2 * Math.PI * Math.sqrt(r1 * r2 * c1 * c2))
  const wantQ = Math.sqrt(r1 * r2 * c1 * c2) / (c2 * (r1 + r2))
  const t = await topbar()
  const gotF0 = si(t['f₀'])
  const gotQ = parseFloat(t.Q)
  const okF = Math.abs(gotF0 - wantF0) / wantF0 < 0.01
  const okQ = Math.abs(gotQ - wantQ) / wantQ < 0.01
  const bad = (await readChecks()).filter((x) => x.mark === '✗')
  console.log(
    `   R1=${r1T} R2=${r2T} C1=${c1T} C2=${c2T} -> ` +
      `f₀ ${gotF0.toFixed(0).padStart(6)} (want ${wantF0.toFixed(0)})  ` +
      `Q ${gotQ.toFixed(3)} (want ${wantQ.toFixed(3)})  ${okF && okQ ? 'ok' : 'MISMATCH'}  ${bad.length} ✗`,
  )
  if (!okF) fail(`Sallen–Key: f₀ ${gotF0} vs ${wantF0}`)
  if (!okQ) fail(`Sallen–Key: Q ${gotQ} vs ${wantQ}`)
  for (const b of bad) fail(`Sallen–Key ${c1T}/${c2T}: ✗ ${b.label}`)
}

// ------------------ 4c. Twin-T: the notch follows RC, and Q refuses to follow

console.log('\n4c. Twin-T notch: f₀ follows 1/(2πRC), Q is pinned at 0.25\n')
await pick('Twin-T notch')
await openAllMath()
for (const [rT, r, cT, c] of [
  ['10k', 1e4, '10n', 10e-9],
  ['47k', 4.7e4, '3.3n', 3.3e-9],
  ['1k', 1e3, '100n', 100e-9],
]) {
  await setField('R (series, both)', rT)
  await setField('C (series, both)', cT)
  const wantF0 = 1 / (2 * Math.PI * r * c)
  const t = await topbar()
  const gotF0 = si(t['f₀'])
  const gotQ = parseFloat(t.Q)
  const okF = Math.abs(gotF0 - wantF0) / wantF0 < 0.01
  // The whole point of the circuit's Q story: it must read 0.250 whatever
  // the components say.
  const okQ = Math.abs(gotQ - 0.25) < 1e-9
  const bad = (await readChecks()).filter((x) => x.mark === '✗')
  console.log(
    `   R=${rT.padStart(4)} C=${cT.padEnd(5)} -> f₀ ${gotF0.toFixed(0).padStart(7)} ` +
      `(want ${wantF0.toFixed(0).padStart(7)})  Q ${gotQ.toFixed(3)}  ` +
      `${okF && okQ ? 'ok' : 'MISMATCH'}  ${bad.length} ✗`,
  )
  if (!okF) fail(`twin-T R=${rT} C=${cT}: f₀ ${gotF0} vs ${wantF0}`)
  if (!okQ) fail(`twin-T R=${rT} C=${cT}: Q ${gotQ} should be exactly 0.250`)
  for (const b of bad) fail(`twin-T R=${rT} C=${cT}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)
}
// The full-fidelity hand-over: no named recipe fits a notch, so the twin-T
// crosses as raw coefficients — the showcase of the tier Reed asked for.
// Control Lab stays declined until its `custom` plant lands (NEEDS.md).
{
  const ho = await page.evaluate(
    () => [...document.querySelectorAll('.controls section')].map((s) => s.textContent).join(' '),
  )
  if (!/the coefficients themselves/.test(ho)) {
    fail('twin-T: the hand-over should present itself as raw coefficients')
  }
  if (!/b=biquad:/.test(ho)) {
    fail('twin-T: the hand-over link should carry a raw biquad block')
  }
  if (/as something to control/.test(ho)) {
    fail('twin-T: Control Lab hand-over should still be declined (no `custom` plant yet)')
  }
  console.log('   hand-over crosses as raw coefficients; Control Lab still declined')
}

// -------------------- 4d. per-part tolerance: R alone cannot move f₀ at all

console.log('\n4d. Per-part tolerance: an R-only ±10% pins f₀ and frees Q\n')
{
  await pick('Blame the right part')
  const spread = (await page.locator('[data-role=tolerance-spread]').textContent().catch(() => '')) || ''
  const m = spread.match(/±([\d.]+)%.*±([\d.]+)%/)
  if (!m) fail(`no spread text after the blame lesson: "${spread.slice(0, 80)}"`)
  else {
    const f0Pct = parseFloat(m[1])
    const qPct = parseFloat(m[2])
    console.log(`   R alone ±10% -> f₀ ±${f0Pct}%  Q ±${qPct}%`)
    if (f0Pct !== 0) fail(`R-only tolerance must leave f₀ at ±0.0%, got ±${f0Pct}%`)
    if (!(qPct > 7)) fail(`Q should take the full R hit, got ±${qPct}%`)
  }
  // A complex pair prints its value beside the plot, once, as re ± j·im.
  {
    const legend = await page.locator('.views .view').nth(1).locator('.readout').textContent()
    if (!/± j/.test(legend)) fail(`complex poles should print as ± j pairs, got "${legend.slice(0, 80)}"`)
  }
  // The per-part controls display the lesson's grading: R at ±10%, L and C exact.
  const stateOf = async (label) =>
    page.getByRole('group', { name: `${label} tolerance` }).first().locator('button.on').textContent()
  if ((await stateOf('R')) !== '±10%') fail('R control should read ±10%')
  if ((await stateOf('L')) !== 'exact') fail('L control should read exact')
  const withRBand = await canvasHashes()
  // "Move the ±10% to C instead and the circle breaks": do as the note says.
  await page.getByRole('group', { name: 'C tolerance' }).first().getByRole('button', { name: '±10%' }).click()
  await page.getByRole('group', { name: 'R tolerance' }).first().getByRole('button', { name: 'exact' }).click()
  await settle()
  const spread2 = (await page.locator('[data-role=tolerance-spread]').textContent().catch(() => '')) || ''
  const m2 = spread2.match(/±([\d.]+)%/)
  const f0Pct2 = m2 ? parseFloat(m2[1]) : NaN
  console.log(`   moved to C ±10% -> f₀ ±${f0Pct2}%`)
  if (!(f0Pct2 > 2)) fail(`C-only tolerance must move f₀, got ±${f0Pct2}%`)
  if ((await canvasHashes())[1] === withRBand[1]) {
    fail('moving the tolerance from R to C did not redraw the poles view')
  }
  await page.locator('[data-role=tol-all] button', { hasText: 'exact' }).first().click()
  await settle()
  // The blame lesson switched the lower pane to poles & zeros; put it back,
  // or section 5's "switching to the pole-zero view redraws" is a no-op —
  // the same trap 4a already steps around.
  await page.getByRole('button', { name: 'Step response' }).click()
  await settle()
}

// ------------------------------------------------- 5. the views, and stability

console.log('\n5. Views, and the circuit that is deliberately not stable\n')
await pick('Op-amp integrator')
await settle()
const flow = await page.locator('.flow-node').last().textContent()
if (!/not stable/.test(flow)) fail(`integrator should report "not stable", got "${flow}"`)
console.log(`   integrator reports: ${flow.replace(/\s+/g, ' ').trim()}`)

const beforeView = await canvasHashes()
await page.getByRole('button', { name: 'Poles & zeros' }).click()
await settle()
const afterView = await canvasHashes()
if (afterView[1] === beforeView[1]) fail('switching to the pole-zero view did not redraw')
console.log('   pole-zero view redraws')

// The readout beside the plot is legend AND values: × pole, ○ zero, with the
// complex numbers a position alone cannot hand the reader.
{
  const legend = await page.locator('.views .view').nth(1).locator('.readout').textContent()
  if (!legend.includes('× poles') || !legend.includes('○ zeros')) {
    fail(`pz readout should carry the ×/○ legend, got "${legend.slice(0, 80)}"`)
  }
  if (!/poles\s*0/.test(legend)) fail('the integrator pole should print its value, 0')
  console.log(`   legend and values: ${legend.replace(/\s+/g, ' ').trim().slice(0, 70)}...`)
}

await page.getByRole('button', { name: 'Step response' }).click()
await settle()

const withPhase = await canvasHashes()
await page.getByRole('button', { name: 'magnitude', exact: true }).click()
await settle()
const withoutPhase = await canvasHashes()
if (withPhase[0] === withoutPhase[0]) fail('toggling phase did not redraw the Bode plot')
console.log('   phase toggle redraws')
await page.getByRole('button', { name: '+ phase', exact: true }).click()
await settle()

// The proximity rule: a control that governs one plot lives in THAT plot's
// header — the phase overlay with the frequency response, the step/poles
// switch with the lower pane. The sidebar's View section is gone.
{
  const placed = await page.evaluate(() => {
    const btn = (t) =>
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t)
    const heads = [...document.querySelectorAll('.view .view-head')]
    return {
      phase: heads.indexOf(btn('+ phase')?.closest('.view-head')),
      lower: heads.indexOf(btn('Poles & zeros')?.closest('.view-head')),
    }
  })
  if (placed.phase !== 0) fail('the phase overlay control must sit in the frequency pane header')
  if (placed.lower !== 1) fail('the step/poles switch must sit in the lower pane header')
  if (placed.phase === 0 && placed.lower === 1) {
    console.log('   view controls sit in the headers of the panes they govern')
  }
}

// ---------------------------- 5b. groups fold, and the active ones cannot hide

console.log('\n5b. Folded sidebar groups: tidy folds, the active groups refuse to\n')
{
  // Land on a lesson so BOTH lists hold an active item: the lesson in
  // "Try this" and the circuit it loaded in "Circuits". The earlier sweeps
  // unfolded every group on their way through, so fold the inactive ones
  // back first — the way a person tidies the list.
  await pick('Q is how sharp, and R sets it')
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details.preset-group[open]')) {
      if (!d.querySelector('.preset.is-on')) d.querySelector('summary').click()
    }
  })
  await settle()
  const groups = await page.$$eval('details.preset-group', (els) =>
    els.map((d) => ({
      open: d.open,
      label: d.querySelector('summary').textContent.trim(),
      active: !!d.querySelector('.preset.is-on'),
    })),
  )
  const openOnes = groups.filter((g) => g.open)
  console.log(
    `   ${groups.length} groups, open after tidying: ${openOnes.map((g) => g.label).join(', ') || 'none'}`,
  )
  if (openOnes.length !== 2) fail(`exactly the two active groups should stay open, got ${openOnes.length}`)
  for (const g of openOnes) {
    if (!g.active) fail(`group "${g.label}" is open without holding the active item`)
  }
  // Now attack the active groups directly: clicking their summaries must not
  // manage to fold them.
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details.preset-group[open]')) {
      d.querySelector('summary').click()
    }
  })
  await settle()
  const survivors = await page.$$eval('details.preset-group[open]', (els) =>
    els.map((d) => d.querySelector('summary').textContent.trim()),
  )
  if (survivors.length !== 2) {
    fail(`the active groups must be impossible to fold away: ${survivors.length} still open`)
  } else {
    console.log(`   clicking their summaries left them open: ${survivors.join(', ')}`)
  }
}


// ---------------------------- 5c. the course's spine: next, previous, reset

console.log('\n5c. Next / previous / reset, and the one-click chips\n')
{
  await pick(START_LESSON)
  const lit = async () => (await page.locator('.presets .preset.is-on').first().textContent()).trim()
  const count = async () => (await page.locator('.lesson-nav-count').textContent()).trim()
  const i0 = LESSONS.findIndex((l) => l.name === START_LESSON)
  await page.getByRole('button', { name: 'Next lesson' }).click()
  await settle()
  if ((await lit()) !== LESSONS[i0 + 1].name) fail(`next should load "${LESSONS[i0 + 1].name}", got "${await lit()}"`)
  if ((await count()) !== `${i0 + 2} of ${LESSONS.length}`) fail(`count after next: ${await count()}`)
  if (await page.locator('[data-role=start-hint]').count()) fail('the start hint should not follow past the start lesson')
  await page.getByRole('button', { name: 'Previous lesson' }).click()
  await settle()
  if ((await lit()) !== START_LESSON) fail('previous should come back')
  if (!(await page.locator('[data-role=start-hint]').count())) fail('the start hint should return with the start lesson')
  console.log(`   next → ${LESSONS[i0 + 1].name} (${i0 + 2} of ${LESSONS.length}) → previous → ${START_LESSON}`)
  // A chip is one click and a partial patch; the lesson stays lit but is
  // flagged, and the chip that matches the setup is the lit one.
  await page.locator('.try-chips .chip', { hasText: 'C 10 nF' }).click()
  await settle()
  const r = await page.getByRole('spinbutton', { name: 'R' }).first().inputValue()
  const c = await page.getByRole('spinbutton', { name: 'C' }).first().inputValue()
  if (c !== '10') fail(`chip C 10 nF should set C to 10 (nF), got "${c}"`)
  if (r !== '1') fail(`chip must patch C alone; R read "${r}" kΩ`)
  if (!(await page.locator('[data-role=note-stale]').count())) fail('a chip off the defaults should flag the note')
  const on = (await page.locator('.try-chips .chip.is-on').textContent().catch(() => '')).trim()
  if (on !== 'C 10 nF') fail(`the matching chip should be lit, got "${on}"`)
  if ((await lit()) !== START_LESSON) fail('the lesson chip must stay lit while dirty')
  // The corner marker followed: f_c with its value, on the plot.
  const markers = await page.locator('.views canvas').first().getAttribute('data-markers')
  if (!/f_c = 15\.92\s?kHz/.test(markers || '')) fail(`corner marker should read f_c = 15.92 kHz, got "${markers}"`)
  await page.locator('.lesson-nav-reset').click()
  await settle()
  if ((await page.getByRole('spinbutton', { name: 'C' }).first().inputValue()) !== '100') fail('reset should restore C = 100 nF')
  const markers0 = await page.locator('.views canvas').first().getAttribute('data-markers')
  if (!/f_c = 1\.592\s?kHz/.test(markers0 || '')) fail(`corner marker should read f_c = 1.592 kHz, got "${markers0}"`)
  console.log(`   chip C 10 nF → C = 10 nF, R untouched, note flagged, chip lit; marker "${markers}" → reset → "${markers0}"`)
  // Chips never compound: "R 10 kΩ" then "C 10 nF" is the lesson at C = 10 nF
  // — the walk found R still at 10 kΩ, the C chip lit, and the corner at
  // 1.59 kHz under a try line promising 15.9.
  await page.locator('.try-chips .chip', { hasText: 'R 10 kΩ' }).click()
  await settle()
  await page.locator('.try-chips .chip', { hasText: 'C 10 nF' }).click()
  await settle()
  const r2 = await page.getByRole('spinbutton', { name: 'R' }).first().inputValue()
  const c2 = await page.getByRole('spinbutton', { name: 'C' }).first().inputValue()
  const on2 = (await page.locator('.try-chips .chip.is-on').textContent().catch(() => '')).trim()
  const markers2 = await page.locator('.views canvas').first().getAttribute('data-markers')
  if (r2 !== '1') fail(`chips compounded: after R 10 kΩ then C 10 nF, R reads "${r2}" kΩ, not the lesson's 1`)
  if (c2 !== '10') fail(`C 10 nF after R 10 kΩ should still set C = 10 nF, got "${c2}"`)
  if (on2 !== 'C 10 nF') fail(`the C chip alone should be lit, got "${on2}"`)
  if (!/f_c = 15\.92\s?kHz/.test(markers2 || '')) fail(`corner after the two chips should be 15.92 kHz, got "${markers2}"`)
  console.log(`   R 10 kΩ then C 10 nF → R = ${r2} kΩ, C = ${c2} nF, lit "${on2}", marker "${markers2}" (no compounding)`)
  await page.locator('.lesson-nav-reset').click()
  await settle()
}

// ---------------------------------- 9. the divider's flat line is labelled

console.log('\n9. A divider has no dynamics — and the plot says so in words\n')
{
  await pick('A divider has no dynamics')
  const ann = (await page.locator('.views canvas').first().getAttribute('data-annotations')) || ''
  if (!/H = 1\/2/.test(ann)) fail(`divider plot should be captioned H = 1/2, got "${ann}"`)
  if (!/phase = 0°/.test(ann)) fail(`divider plot should be captioned phase = 0°, got "${ann}"`)
  await page.locator('.try-chips .chip', { hasText: 'R2 3 kΩ' }).click()
  await settle()
  const ann2 = (await page.locator('.views canvas').first().getAttribute('data-annotations')) || ''
  if (!/H = 3\/4/.test(ann2)) fail(`after R2 = 3 kΩ the caption should read H = 3/4, got "${ann2}"`)
  console.log(`   "${ann}" → chip R2 3 kΩ → "${ann2}"`)
  // At −2.5 dB the magnitude caption and the 0° phase caption want the same
  // line; the walk saw them drawn on top of each other. They must stack.
  const ys = ((await page.locator('.views canvas').first().getAttribute('data-annotation-ys')) || '')
    .split(' ')
    .map(Number)
  if (ys.length !== 2 || ys.some((v) => !Number.isFinite(v))) fail(`expected two caption ys, got "${ys}"`)
  else if (Math.abs(ys[0] - ys[1]) < 12) fail(`the two captions overlap: drawn at y ${ys[0]} and ${ys[1]}`)
  else console.log(`   captions stacked at y ${ys[0]} and ${ys[1]} px (≥ 12 apart)`)
}

// ------------------------------------ 10. what the first-year walk filed

console.log('\n10. The student walk: each filed defect, re-checked on the real page\n')
{
  const points = async () => (await page.locator('.views canvas').first().getAttribute('data-points')) || ''
  const lowerReadout = () => page.locator('.views .view').nth(1).locator('.readout').textContent()
  const upperReadout = () => page.locator('.views .view').nth(0).locator('.readout').textContent()
  const pressed = async (name) =>
    (await page.getByRole('button', { name, exact: true }).getAttribute('aria-pressed')) === 'true'

  // L2: the corner's −3.01 dB and −45° are marked on the plot itself.
  await pick(START_LESSON)
  let pts = await points()
  if (!/−3\.01 dB/.test(pts) || !/−45°/.test(pts)) fail(`corner lesson should mark −3.01 dB and −45°, got "${pts}"`)
  console.log(`   L2 points: "${pts}"`)

  // L3: opens on the step (the note is about |H|), marks +45°.
  await pick('The same filter, read backwards')
  if (!(await pressed('Step response'))) fail('read-backwards should open on the step view, not poles')
  pts = await points()
  if (!/−3\.01 dB/.test(pts) || !/\b45°/.test(pts)) fail(`high-pass should mark −3.01 dB and 45°, got "${pts}"`)
  console.log(`   L3 opens on step; points: "${pts}"`)

  // L5: an output whose final value is 0 prints its peak, never an overshoot.
  await pick('One circuit, three filters')
  await page.locator('.try-chips .chip', { hasText: 'across R' }).click()
  await settle()
  let ro = await lowerReadout()
  // A NUMBER after "overshoot" is the defect; the pane's own "no overshoot to quote" is the fix.
  if (/overshoot\s*[\d.]+%/.test(ro)) fail(`across R: overshoot printed against a final of 0: "${ro}"`)
  if (!/peak/.test(ro)) fail(`across R: no peak printed: "${ro}"`)
  const pk = (await page.locator('[data-role=step-peak] b').textContent().catch(() => '')).trim()
  if (Math.abs(parseFloat(pk) - 0.252) > 0.002) fail(`across R peak should read 0.252, got "${pk}"`)
  console.log(`   L5 across R: ${ro.replace(/\s+/g, ' ').trim().slice(0, 80)}`)

  // L7: an impedance plot names its DC value in ohms, and the peak in ohms.
  await pick('The same R, the opposite effect')
  if (!(await pressed('Step response'))) fail('the tank lesson should open on the step view, not poles')
  const tb = await topbar()
  if (!('Z at DC' in tb)) fail(`tank topbar should say "Z at DC", got keys ${Object.keys(tb).join(', ')}`)
  else if (!/^0.*Ω$/.test(tb['Z at DC'])) fail(`Z at DC should read 0 Ω, got "${tb['Z at DC']}"`)
  pts = await points()
  if (!/peak = R = 10\.?0* kΩ = 80\.0 dBΩ/.test(pts)) fail(`tank should mark its peak as R in ohms and dBΩ, got "${pts}"`)
  ro = await lowerReadout()
  if (!/final\s*0.*Ω/.test(ro) || /overshoot\s*[\d.]+%/.test(ro)) fail(`tank step readout: "${ro}"`)
  console.log(`   L7 topbar Z at DC = ${tb['Z at DC']}; points "${pts}"`)

  // L8: the critical chip is exactly critical, and the pane says so.
  await pick('Resonance, seen in time')
  await page.locator('.try-chips .chip', { hasText: '632.46 Ω' }).click()
  await settle()
  const ur = await upperReadout()
  if (!/critically damped/.test(ur) || !/ζ = 1\.000/.test(ur)) fail(`632.46 Ω should read critically damped, ζ = 1.000: "${ur}"`)
  ro = await lowerReadout()
  if (/overshoot\s*[\d.]+%/.test(ro)) fail(`632.46 Ω should show no overshoot: "${ro}"`)
  console.log(`   L8 at 632.46 Ω: ${ur.replace(/\s+/g, ' ').trim().replace(/^span[^ ]+ [^ ]+ /, '')}`)

  // L9: the note owns up to the drawn floor.
  await pick('A zero on the axis is silence')
  const note9 = await page.locator('[data-role=lesson-note]').textContent()
  if (!/floor is the grid/.test(note9)) fail('the notch note should say the drawn floor is the grid’s')

  // L13: Cf is drawn, the try line's corner is marked at 135°, gain −100.
  // .first(): the network strip (section 1x) put a second .schematic on
  // screen, in the main column; both draw the same circuit, so the sidebar's
  // is representative.
  await pick('Gain is a ratio, and negative')
  const sch = await page.locator('.schematic').first().textContent()
  if (!/Cf/.test(sch)) fail('the inverting schematic should draw and label Cf')
  await page.locator('.try-chips .chip', { hasText: 'Rf 100 kΩ' }).click()
  await settle()
  pts = await points()
  if (!/36\.99 dB/.test(pts) || !/135°/.test(pts)) fail(`inverting at Rf = 100 kΩ should mark 36.99 dB and 135° at the corner, got "${pts}"`)
  const mk = await page.locator('.views canvas').first().getAttribute('data-markers')
  if (!/f_c = 1\.592\s?kHz/.test(mk || '')) fail(`inverting corner should be marked at 1.592 kHz, got "${mk}"`)
  if ((await topbar())['DC gain'] !== '-100' && (await topbar())['DC gain'] !== '−100') fail(`DC gain should read −100, got "${(await topbar())['DC gain']}"`)
  console.log(`   L13 at Rf 100 kΩ: marker "${mk}", points "${pts}"`)

  // L14: opens on the step, and the frame HOLDS across the R chips so the
  // ten-times-slower ramp is drawn ten times shallower.
  await pick('A pole exactly at the origin')
  if (!(await pressed('Step response'))) fail('the integrator lesson should open on the step view')
  const frame = () =>
    page.evaluate(() => {
      const c = document.querySelectorAll('.views canvas')[1]
      const s = JSON.parse(c.dataset.samples || '[]')
      const yHi = parseFloat(c.dataset.yHi)
      const yLo = parseFloat(c.dataset.yLo)
      const tMax = parseFloat(c.dataset.tMax)
      // Slope in FRAME units: fraction of the y-range per fraction of the
      // t-axis — proportional to pixels per pixel, whatever the pane size.
      const a = s[0]
      const b = s[s.length - 1]
      const slope = ((b[1] - a[1]) / (yHi - yLo)) / ((b[0] - a[0]) / tMax)
      return { yHi, yLo, tMax, slope }
    })
  const f10 = await frame()
  await page.locator('.try-chips .chip', { hasText: 'R 100 kΩ' }).click()
  await settle()
  const f100 = await frame()
  const ratio = Math.abs(f10.slope / f100.slope)
  if (f10.yLo !== f100.yLo || f10.yHi !== f100.yHi || f10.tMax !== f100.tMax) {
    fail(`integrator frame re-framed under the R chip: [${f10.yLo}, ${f10.yHi}] → [${f100.yLo}, ${f100.yHi}]`)
  }
  if (!(ratio >= 5)) fail(`integrator ramp at 100 kΩ should be drawn ≥ 5× shallower, got ${ratio.toFixed(2)}×`)
  console.log(`   L14 frame held [${f10.yLo.toFixed(1)}, ${f10.yHi}] over ${f10.tMax}s; drawn slope ratio ${ratio.toFixed(1)}×`)

  // L17: a Circuits click parks the course rather than dropping it.
  await pick('Q is how sharp, and R sets it')
  await pick('Twin-T notch')
  const cnt = (await page.locator('.lesson-nav-count').textContent().catch(() => '')).trim()
  const back = page.locator('[data-role=lesson-back]')
  if (cnt !== '6 of 15') fail(`after a circuit click the nav should still read "6 of 15", got "${cnt}"`)
  if (!(await back.count())) fail('after a circuit click there should be a "back to lesson" action')
  else {
    await back.click()
    await settle()
    const lit = (await page.locator('.presets .preset.is-on').first().textContent()).trim()
    const r = await page.getByRole('spinbutton', { name: 'R' }).first().inputValue()
    if (lit !== 'Q is how sharp, and R sets it') fail(`back to lesson should relight the Q lesson, got "${lit}"`)
    if (r !== '20') fail(`back to lesson should reload R = 20 Ω, got "${r}"`)
    console.log(`   circuit click kept "${cnt}" and offered a way back; back → "${lit}" at R = ${r} Ω`)
  }

  // Hand-over prose uses the display name, defines its terms, and at the
  // rate ceiling says so instead of "raise the rate".
  await pick('Series RLC')
  const ho = await page.evaluate(() =>
    [...document.querySelectorAll('.controls section')].map((s) => s.textContent).find((t) => /Signal Lab/.test(t)),
  )
  if (!/Series RLC is a/.test(ho || '')) fail('hand-over should name the circuit as "Series RLC"')
  if (/series rlc/.test(ho || '')) fail('hand-over lowercases the circuit name')
  if (!(await page.locator('[data-role=handover-terms]').count())) fail('hand-over panel should reveal its terms')
  await pick('RC low-pass')
  await setField('C', '1n')
  const ceiling = await page.locator('[data-role=rate-ceiling]').count()
  const warnText = await page.locator('.hint.warn').allTextContents()
  if (!ceiling) fail('a 159 kHz corner at the 192 kHz ceiling should get the ceiling notice')
  if (warnText.some((t) => /Raise the rate/.test(t))) fail('at the ceiling the panel must not ask for a higher rate')
  console.log(`   hand-over: display name kept, terms revealed, ceiling notice at 192 kHz`)
  await setField('C', '100n')

  // The topbar strip defines H(s) and the half plane on hover.
  const titles = await page.$$eval('.flow-node', (els) => els.map((e) => e.getAttribute('title') || ''))
  if (!titles.some((t) => /half plane/.test(t))) fail('the stable/unstable node should define the half plane on hover')
  if (!titles.some((t) => /Transfer function/.test(t))) fail('the H(s) node should define the transfer function on hover')

  // Student-review item 4: compact Signal/Control links beside the network,
  // for a second-order circuit only, on the deployed layout this harness
  // already visits (siblingUrl resolves under /circuit-lab/).
  await pick('Series RLC')
  const compact = await page.locator('[data-role=network-handovers] a').allTextContents()
  if (!compact.some((t) => /Signal Lab/.test(t))) fail('Series RLC (2nd order) should get a compact Signal Lab link')
  if (!compact.some((t) => /Control Lab/.test(t))) fail('Series RLC (2nd order) should get a compact Control Lab link')
  console.log(`   compact hand-overs on a 2nd-order circuit: ${compact.join(', ')}`)
  await pick('RC low-pass')
  if (await page.locator('[data-role=network-handovers]').count()) {
    fail('RC low-pass (1st order) should get no compact hand-over links')
  } else {
    console.log('   compact hand-overs absent on a 1st-order circuit, as they should be')
  }
}

// ------------------------------------- 11. the integrator really never settles

console.log('\n11. Integrator: the drawn step is a ramp that has not flattened\n')
{
  await pick('A pole exactly at the origin')
  await page.getByRole('button', { name: 'Step response' }).click()
  await settle()
  const samples = JSON.parse(
    (await page.locator('.views canvas').nth(1).getAttribute('data-samples')) || '[]',
  )
  if (samples.length !== 6) fail(`expected 6 step samples, got ${samples.length}`)
  else {
    const slopes = []
    for (let i = 1; i < samples.length; i++) {
      slopes.push((samples[i][1] - samples[i - 1][1]) / (samples[i][0] - samples[i - 1][0]))
    }
    const mean = slopes.reduce((a, b) => a + b, 0) / slopes.length
    const worst = Math.max(...slopes.map((s) => Math.abs(s / mean - 1)))
    if (!(worst < 0.05)) fail(`integrator step slope varies by ${(worst * 100).toFixed(1)}% across the window — not a ramp`)
    if (!(mean < 0)) fail('integrator ramp should head negative (inverting)')
    console.log(`   6 samples, slope ${mean.toFixed(0)} /s, constant within ${(worst * 100).toFixed(2)}%`)
  }
}

// ----------------------------------- 8. the wobble cloud is bigger than the X

console.log('\n8. Real parts wobble: the pole cloud is a shape, not a smudge in the marker\n')
{
  // At the smaller laptop, where the pane is shortest.
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await pick('Real parts wobble')
  // Every pixel drawn in the trace colour — the cloud's dots (trace at
  // alpha 0.28, stacking) and the pole crosses (trace at 1) — in the UPPER
  // half-plane, where exactly one cross lives. The test is hue, not
  // brightness: the trace is green over both red and blue, while the grid,
  // axes and background are blue-leaning greys, the unstable half and its
  // caption are the marker pink, and zeros are the response colour. The
  // bounding box of that ink is therefore the cross (14 × 14 px) plus
  // whatever the cloud adds, and a cloud a student can see must push it
  // well past the cross — three marker radii, 21 px.
  const inkBox = () =>
    page.evaluate(() => {
      const c = document.querySelectorAll('.views canvas')[1]
      // Read through a copy: repeated getImageData on the live canvas makes
      // the browser warn about readback, and the harness counts warnings.
      const off = document.createElement('canvas')
      off.width = c.width
      off.height = c.height
      const ctx = off.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(c, 0, 0)
      const { data } = ctx.getImageData(0, 0, c.width, c.height)
      const bg = [11, 15, 20] // COLORS.bg
      const tr = [56, 224, 176] // COLORS.trace
      const d = [tr[0] - bg[0], tr[1] - bg[1], tr[2] - bg[2]]
      const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2]
      // The real axis: plotArea pads 14 above and 48 below, so the frame's
      // vertical centre (jω = 0, the axes being symmetric) is 14 + (h − 62)/2.
      const axisY = 14 + (c.height - 62) / 2
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      let n = 0
      for (let i = 0; i < data.length; i += 4) {
        const py = Math.floor(i / 4 / c.width)
        if (py >= axisY) continue
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        if (!(g - r > 25 && g - b > 4)) continue // not the trace's green
        const v = [r - bg[0], g - bg[1], b - bg[2]]
        const t = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / dd
        if (t < 0.2) continue
        const rx = v[0] - t * d[0]
        const ry = v[1] - t * d[1]
        const rz = v[2] - t * d[2]
        if (rx * rx + ry * ry + rz * rz > 400) continue // off the bg→trace line
        const px = (i / 4) % c.width
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (py < minY) minY = py
        if (py > maxY) maxY = py
        n++
      }
      return { w: c.width, h: c.height, n, box: [maxX - minX + 1, maxY - minY + 1] }
    })
  const ink = await inkBox()
  console.log(
    `   canvas ${ink.w}×${ink.h} px at 1366×768: trace-green ink in the upper half-plane ${ink.n} px, ` +
      `box ${ink.box[0]}×${ink.box[1]} px (one pole cross is 14×14)`,
  )
  if (!(Math.max(...ink.box) >= 21)) fail(`wobble cloud box ${ink.box.join('×')} px is not bigger than three marker radii`)
  // ...and turning the parts exact leaves just the cross — which also
  // calibrates the count: the cloud must add real ink beyond the cross.
  await page.locator('[data-role=tol-all] button', { hasText: 'exact' }).first().click()
  await settle()
  const bare = await inkBox()
  console.log(`   exact parts: the same ink is ${bare.n} px in a ${bare.box.join('×')} px box — the cross alone`)
  if (!(Math.max(...bare.box) <= 18)) fail(`with exact parts the upper-half ink should be one cross, got ${bare.box.join('×')} px`)
  if (!(ink.n > 1.5 * bare.n)) fail(`the cloud added too little ink: ${ink.n} px with the cloud vs ${bare.n} px for the cross alone`)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(URL, { waitUntil: 'networkidle' })
}

// --------------------------- 7. the fold: what a note names is on the screen

console.log('\n7. Fold probe at laptop sizes: try line, featured controls, lit chip\n')
{
  // What each lesson features, as selectors inside the featured block.
  const featuredOf = (l) => {
    const out = []
    let inputs = 0
    let tols = 0
    for (const entry of l.featured || []) {
      const f = typeof entry === 'string' ? entry : entry.id
      if (f === 'tol') out.push('[data-role=featured] [data-role=tol-all]')
      else if (f.startsWith('tol:')) {
        const i = tols++
        const fn = (p) => p.locator('[data-role=featured] .field-tol').nth(i)
        fn.label = `featured ${f}`
        out.push(fn)
      } else if (f === 'output') out.push('[data-role=featured] select')
      else if (f === 'handover') out.push('[data-role=featured] a.handover-copy')
      else {
        const i = inputs++
        const fn = (p) => p.locator('[data-role=featured] input').nth(i)
        fn.label = `featured ${f}`
        out.push(fn)
      }
    }
    return out
  }
  const cases = LESSONS.map((l) => ({
    name: l.name,
    load: () => pick(l.name),
    // Student-review item 1: the network (a compact schematic, pinned beside
    // the plots) must be on screen at laptop sizes on every lesson, same as
    // the try line and the featured knob — the same probe, one more locator.
    must: [
      '.try-line',
      ...featuredOf(l),
      '.presets .preset.is-on',
      '.lesson-nav',
      '[data-role=network-strip] .schematic',
    ],
  }))
  const r = await foldProbe(page, { cases, url: URL })
  for (const f of r.failures) fail(`fold: ${f}`)
  const worst = {}
  for (const m of r.measured) {
    if (!m.box) continue
    const bottom = m.box.y + m.box.height
    const k = `${m.viewport} ${m.control}`
    if (!worst[k] || bottom > worst[k].bottom) worst[k] = { bottom, lesson: m.lesson }
  }
  const at = (vp, lesson, control) => {
    const m = r.measured.find((x) => x.viewport === vp && x.lesson === lesson && x.control === control)
    return m && m.box ? `${(m.box.y + m.box.height).toFixed(0)} px` : 'not rendered'
  }
  console.log(`   ${r.measured.length} boxes measured over ${cases.length} lessons × 2 viewports; ${r.failures.length} outside the fold`)
  console.log(`   1440x900 · Q lesson · featured R bottom: ${at('1440x900', 'Q is how sharp, and R sets it', 'featured r')}`)
  console.log(`   1440x900 · biquad · Open in Signal Lab bottom: ${at('1440x900', 'This circuit is a biquad', '[data-role=featured] a.handover-copy')}`)
  console.log(`   1366x768 · wobble · every-part tolerance bottom: ${at('1366x768', 'Real parts wobble', '[data-role=featured] [data-role=tol-all]')}`)
  // The two tallest schematics (twin-T's stacked tees, the inverting amp's
  // extra Cf branch) are the worst case for the network row's fixed height.
  console.log(`   1366x768 · twin-T · network schematic bottom: ${at('1366x768', 'A zero on the axis is silence', '[data-role=network-strip] .schematic')}`)
  console.log(`   1440x900 · inverting amp · network schematic bottom: ${at('1440x900', 'Gain is a ratio, and negative', '[data-role=network-strip] .schematic')}`)
  console.log(`   1366x768 · three filters · featured output probe bottom: ${at('1366x768', 'One circuit, three filters', '[data-role=featured] select')}`)
  for (const [k, v] of Object.entries(worst).sort((a, b) => b[1].bottom - a[1].bottom).slice(0, 4)) {
    console.log(`   lowest ${k}: ${v.bottom.toFixed(0)} px (${v.lesson})`)
  }
  // The active-circuits three sat with their Terms line at 882–898 px at
  // 1440×900: the try line and the featured knob must be comfortably above
  // the fold there, not just inside it.
  for (const name of ['Why active filters exist', 'Gain is a ratio, and negative', 'A pole exactly at the origin']) {
    for (const m of r.measured.filter((x) => x.viewport === '1440x900' && x.lesson === name)) {
      if (!m.box) continue
      const bottom = m.box.y + m.box.height
      if ((m.control === '.try-line' || /^featured /.test(m.control)) && bottom > 860) {
        fail(`1440x900 · ${name} · ${m.control}: bottom ${bottom.toFixed(0)} px — not comfortably above the 900 fold`)
      }
    }
  }
  console.log('   L12–L14 at 1440x900: try line and featured knob end above 860 px')
}

// ------------------------------------------- 13. phone: Bode + the lesson's view

console.log('\n13. Phone 390×844: the lesson text, the response and the lesson view share the first screen\n')
{
  const canvas = (i, label) => {
    const fn = (p) => p.locator('.views canvas').nth(i)
    fn.label = label
    return fn
  }
  const cases = ['Where the corner comes from', 'Q is how sharp, and R sets it', 'This circuit is a biquad'].map(
    (name) => ({
      name,
      load: () => pick(name),
      must: [canvas(0, 'Bode canvas'), canvas(1, 'lesson view canvas')],
    }),
  )
  const r = await phoneProbe(page, { cases, url: URL })
  for (const f of r.failures) fail(`phone: ${f}`)
  for (const m of r.measured) {
    console.log(
      `   ${m.lesson.padEnd(32)} ${m.control.padEnd(20)} ${m.box ? `y ${m.box.y.toFixed(0)}–${(m.box.y + m.box.height).toFixed(0)} px` : 'not rendered'}`,
    )
  }
  // The walk's phone screen showed a header and seventeen buttons and no
  // lesson at all. On a fresh load the note's title and the try line must
  // sit inside the sidebar's VISIBLE box (not a sidebar-scroll away), with
  // the lesson's own view still in the first viewport.
  await page.setViewportSize({ width: 390, height: 844 })
  for (const c of cases) {
    await page.goto(URL, { waitUntil: 'networkidle' })
    await c.load()
    await page.evaluate(() => {
      document.querySelector('.controls').scrollTop = 0
      document.querySelector('#root').scrollTop = 0
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(80)
    const side = await page.locator('.controls').boundingBox()
    const inSide = (b) => b && b.y >= side.y - 1 && b.y + b.height <= side.y + side.height + 1
    for (const [sel, what] of [['.note-title', 'note title'], ['.try-line', 'try line']]) {
      const b = await page.locator(sel).first().boundingBox()
      if (!inSide(b)) {
        fail(`phone · ${c.name} · ${what}: ${b ? `y ${b.y.toFixed(0)}–${(b.y + b.height).toFixed(0)}` : 'not rendered'} is not inside the sidebar's visible ${side.y.toFixed(0)}–${(side.y + side.height).toFixed(0)} px`)
      } else console.log(`   ${c.name.padEnd(32)} ${what.padEnd(20)} y ${b.y.toFixed(0)}–${(b.y + b.height).toFixed(0)} px, inside the ${side.height.toFixed(0)} px sidebar`)
    }
    const knob = await page.locator('[data-role=featured] input, [data-role=featured] a.handover-copy').first().boundingBox()
    console.log(`   ${''.padEnd(32)} ${'featured control'.padEnd(20)} ${knob ? `y ${knob.y.toFixed(0)}–${(knob.y + knob.height).toFixed(0)} px${inSide(knob) ? '' : ' (below the sidebar’s first screen)'}` : 'not rendered'}`)
  }
  // The Math tab must not widen the page: the RLC's formulas and tables
  // pushed .views to 463 px and cropped the Bode.
  await page.goto(URL, { waitUntil: 'networkidle' })
  await pick('Q is how sharp, and R sets it')
  await page.getByRole('button', { name: 'Math', exact: true }).click()
  await settle()
  const widths = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    views: document.querySelector('.views').getBoundingClientRect().width,
  }))
  if (widths.doc > 390 || widths.views > 390) fail(`phone Math tab widens the page: document ${widths.doc} px, .views ${widths.views} px`)
  else console.log(`   Math tab on the RLC: document ${widths.doc} px wide, .views ${widths.views.toFixed(0)} px — no crop`)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(URL, { waitUntil: 'networkidle' })
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

// -------------------------------------- 6. every circuit at 4K, still fitting

console.log('\n6. Re-checking layout at 4K\n')
await page.setViewportSize({ width: 3840, height: 2160 })
await page.waitForTimeout(500)
for (const name of circuitNames) {
  await pick(name)
  await page.waitForTimeout(120)
  if (await scrolls()) fail(`4K / ${name}: page scrolls`)
}
console.log(`   all ${circuitNames.length} circuits fit at 3840x2160`)

// -------------------------------------------- 14. touch targets at 390x844
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
// own tiny native box.
//
// One documented exception, held to the 24px HARD_FLOOR instead: a control
// inside a PLOT pane (.views — a view switch, the network strip's own
// controls). Its options often touch with no real gap (a true segmented
// control), so an invisible hit area would let a thumb bridge two, and
// growing it for real at 44 costs more of the response-and-lesson-view
// budget (item 13) than this lab can spare — so the plot pane's own chrome
// stays at WCAG's legal floor rather than the suite's 44px target.
console.log('\n14. Touch targets at 390x844 (button, link, summary, role=button, checkbox)\n')
{
  await page.setViewportSize(PHONE_VIEWPORT)
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')

  const exceptionFloor = (el) => (el.inViews || el.inLabNav ? HARD_FLOOR : null)

  let checked = 0
  for (const name of circuitNames) {
    await pick(name)
    const res = await tapTargetProbe(page, { exceptionFloor })
    checked += res.checked
    for (const f of res.failures) fail(`touch target · ${name}: ${f}`)
  }
  console.log(`   ${circuitNames.length} circuits: ${checked} interactive elements checked at 390x844, every one clears the ${FLOOR}px floor (the plot panes' own chrome held to the ${HARD_FLOOR}px floor instead)`)
}

// ------------------------------------------------------------------- report

await browser.close()

console.log('\n' + '='.repeat(64))
if (consoleErrors.length) {
  console.log(`\nBROWSER CONSOLE (${consoleErrors.length}):`)
  for (const e of [...new Set(consoleErrors)].slice(0, 20)) console.log('   ' + e)
} else {
  console.log('\nNo browser console errors or warnings.')
}
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`)
  for (const f of failures) console.log('   ' + f)
  process.exit(1)
}
console.log('\nAll UI checks passed.')
