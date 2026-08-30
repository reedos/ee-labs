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

const URL = process.env.APP_URL || 'http://localhost:4175'
const failures = []
const fail = (m) => failures.push(m)

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

async function openAllMath() {
  const toggles = page.locator('.math-toggle[aria-expanded="false"]')
  for (let g = 0; g < 8; g++) {
    if ((await toggles.count()) === 0) break
    await toggles.first().click()
    await page.waitForTimeout(90)
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

const circuitNames = await page.$$eval('.preset', (els) => els.map((e) => e.textContent.trim()))
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
console.log('\n4x. A lesson note dies when the probe moves off the setup it describes\n')
await pick('This circuit is a biquad')
const hints = () => page.$$eval('.controls .hint', (els) => els.map((e) => e.textContent))
const noteOn = (await hints()).some((t) => t.includes('low-pass biquad'))
if (!noteOn) fail('the biquad lesson note did not appear')
await page.locator('.controls select').first().selectOption({ label: 'across L — high-pass' })
await settle()
const noteAfter = (await hints()).some((t) => t.includes('low-pass biquad'))
if (noteAfter) fail('the biquad note still claims a low-pass while the probe is on L')
else console.log('   note shown at load, gone once the output select moved to L')

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
const withCloud = (await canvasHashes())[1]
await page.locator('.segmented button', { hasText: 'exact' }).first().click()
await settle()
if ((await spreadText()) !== '') fail('spread text should clear at exact')
if ((await canvasHashes())[1] === withCloud) fail('clearing tolerance did not redraw the poles view')
else console.log('   exact -> cloud and ranges gone, canvas redrew')
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

await page.getByRole('button', { name: 'Step response' }).click()
await settle()

const withPhase = await canvasHashes()
await page.getByRole('checkbox', { name: 'Show phase' }).uncheck()
await settle()
const withoutPhase = await canvasHashes()
if (withPhase[0] === withoutPhase[0]) fail('toggling phase did not redraw the Bode plot')
console.log('   phase toggle redraws')
await page.getByRole('checkbox', { name: 'Show phase' }).check()
await settle()

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
