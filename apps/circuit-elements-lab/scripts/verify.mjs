// End-to-end verification for the Circuit Elements Lab, in a real browser.
//
// The unit tests solve the circuits directly and check every note against a
// solve. This drives the page: loads every experiment, opens every math panel,
// reads every check mark, switches every lower view, moves knobs and confirms
// the schematic's meters and the panes follow. It is the only thing that can
// catch a prop not passed or a pane fed stale state.
//
//   npm run preview   (in another shell; serves dist/ on :4176)
//   npm run verify

import { chromium } from 'playwright'

const URL = process.env.APP_URL || 'http://localhost:4176'
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
await page.waitForSelector('.views .schematic')
await page.waitForTimeout(400)

const settle = () => page.waitForTimeout(200)

const scrolls = () =>
  page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1)
const scrollsX = () =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
// The shell clips the app at the viewport, so a pane that grew wider than the
// screen never made the page scroll — its last buttons simply vanished. Name
// anything in a pane header that ends past the right edge.
const clipped = () =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth + 1
    return [...document.querySelectorAll('.view, .view-head, .view-head .segmented, .view-head .readout, .schematic')]
      .filter((el) => el.getBoundingClientRect().right > w)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className.split(' ')[0]} → ${Math.round(el.getBoundingClientRect().right)}px`)
  })

async function openAllMath() {
  const toggles = page.locator('.math-toggle[aria-expanded="false"]')
  for (let g = 0; g < 8; g++) {
    if ((await toggles.count()) === 0) break
    await toggles.first().click()
    await page.waitForTimeout(80)
  }
}

const readChecks = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.math-check tbody tr')].map((tr) => {
      const c = [...tr.querySelectorAll('th,td')].map((x) => x.textContent.trim())
      return { label: c[0], theory: c[1], measured: c[2], mark: c[3] }
    }),
  )

/** The meter labels drawn on the schematic. */
const meters = () => page.$$eval('.schematic .sch-meter', (els) => els.map((e) => e.textContent.trim()))

/** The outcome node in the topbar flow. */
const outcome = () => page.locator('[data-role=outcome]').textContent()

/** Parse "5.033k" -> 5033, "-2.4m" -> -0.0024. */
function si(text) {
  if (!text) return NaN
  const m = String(text).match(/(-?[\d.]+)\s*([afpnµumkMGT]?)/)
  if (!m) return NaN
  const mult = { a: 1e-18, f: 1e-15, p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, '': 1, k: 1e3, M: 1e6, G: 1e9, T: 1e12 }
  return parseFloat(m[1]) * (mult[m[2]] ?? 1)
}

// Knobs are in engineering mode: a bare number is read in the prefix on
// display, so values are typed WITH a prefix the way a person would.
async function setField(label, value) {
  const box = page.getByRole('spinbutton', { name: label }).first()
  await box.fill(String(value))
  await box.press('Enter')
  await settle()
}

const names = await page.$$eval('.presets .preset', (els) => els.map((e) => e.textContent.trim()))
const pick = async (name) => {
  const btn = page.getByRole('button', { name, exact: true })
  if (!(await btn.isVisible().catch(() => false))) {
    await page.evaluate((n) => {
      for (const d of document.querySelectorAll('details.preset-group')) {
        const has = [...d.querySelectorAll('.preset')].some((b) => b.textContent.trim() === n)
        if (has && !d.open) d.querySelector('summary').click()
      }
    }, name)
    await page.waitForTimeout(100)
  }
  await btn.click()
  await settle()
}
const viewButtons = () => page.$$eval('.view-switch button', (els) => els.map((e) => e.textContent.trim()))

// ------------------------------------ 1. every experiment, every panel, every view

console.log(`\n1. Loading all ${names.length} experiments, opening every math panel, every view\n`)
for (const name of names) {
  await pick(name)
  if (await scrolls()) fail(`${name}: page scrolls`)
  await openAllMath()
  const checks = await readChecks()
  const bad = checks.filter((r) => r.mark === '✗')
  for (const b of bad) fail(`${name}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)

  const out = (await outcome()).replace(/\s+/g, ' ').trim()
  const refused = /no solution/.test(out)
  const m = await meters()
  if (!refused && m.length === 0) fail(`${name}: solved but no meters on the schematic`)
  if (refused && (await page.locator('[data-role=refusal]').count()) === 0) fail(`${name}: refused without showing why`)

  // Every lower view the experiment offers renders something.
  const views = await viewButtons()
  let rendered = 0
  for (const v of views) {
    // Exact name: a substring match on "Power" would also pick up "AC power".
    await page.locator('.view-switch').getByRole('button', { name: v, exact: true }).click()
    await page.waitForTimeout(120)
    const has = await page.evaluate(() => {
      const body = document.querySelectorAll('.view .view-body')[1]
      return !!body && (body.querySelector('[data-role], canvas') !== null || /Nothing to show/.test(body.textContent))
    })
    if (!has) fail(`${name}: view "${v}" rendered nothing`)
    else rendered++
  }
  console.log(
    `   ${name.padEnd(30)} ${String(checks.filter((r) => r.mark === '✓').length).padStart(2)} ✓  ${bad.length} ✗  ` +
      `${String(m.length).padStart(2)} meters  ${rendered}/${views.length} views  ${refused ? 'REFUSED' : out.slice(0, 30)}`,
  )
}

// ------------------------------------------- 2. the meters follow the knobs

console.log('\n2. KCL at a node: the meters and the equations follow R₂\n')
const kclName = names.find((n) => /current in equals current out/i.test(n))
await pick(kclName)
await openAllMath()
await page.locator('.view-switch').getByRole('button', { name: 'Equations', exact: true }).click()
for (const [txt, r2] of [
  // Typed with the displayed prefix in mind: the field shows kΩ, so a bare 500 is 500 kΩ.
  ['0.5k', 500],
  ['4k', 4000],
  ['10k', 10000],
]) {
  await setField('R₂', txt)
  const rp = (r2 * 3000) / (r2 + 3000)
  const vA = (12 * rp) / (1000 + rp)
  const want = vA / r2
  const m = await meters()
  // Readings carry no id, so look for the value i_R2 = v_A/R₂ among the ammeters.
  const iR2 = m.filter((t) => /A$/.test(t)).find((t) => Math.abs(si(t) - want) / want < 0.01)
  const shownV = si((await page.locator('.readout').first().textContent()).match(/v_A\s*([\d.]+\s*\S*)V/)?.[1])
  const okV = Math.abs(shownV - vA) / vA < 0.01
  // Every KCL row in the equations pane sums to (numerically) zero.
  const sums = await page.$$eval('.eq-sum b', (els) => els.map((e) => e.textContent.trim()))
  for (const s of sums) if (!(Math.abs(si(s)) < 1e-9)) fail(`B1 R2=${txt}: KCL row sums to ${s}`)
  const bad = (await readChecks()).filter((x) => x.mark === '✗')
  console.log(
    `   R2=${txt.padStart(4)} -> v_A ${vA.toFixed(4)} V  readout ${Number.isFinite(shownV) ? shownV.toFixed(4) : '?'}  ` +
      `i_R2 want ${(want * 1e3).toFixed(3)} mA  meters ${m.length}  ${okV ? 'ok' : 'MISMATCH'}  ${bad.length} ✗`,
  )
  if (!okV) fail(`B1 R2=${txt}: readout v_A ${shownV} vs ${vA}`)
  if (!iR2) fail(`B1 R2=${txt}: no ammeter reads i_R2 = ${want}: ${m.join(' | ')}`)
  for (const b of bad) fail(`B1 R2=${txt}: ✗ ${b.label}`)
}
// The note retires once a knob has moved.
{
  const pristine = await page.locator('[data-role=note]').getAttribute('data-pristine')
  if (pristine !== 'false') fail('the note should retire after a knob moves')
  else console.log('   note retired after the knob moved')
}

// -------------------------------- 3. the meter mode switches what is written

console.log('\n3. Meter modes: currents, voltages, powers, none\n')
{
  await pick(kclName)
  const seen = {}
  for (const mode of ['currents', 'voltages', 'powers', 'none']) {
    await page.getByRole('button', { name: mode, exact: true }).click()
    await settle()
    seen[mode] = await meters()
  }
  if (seen.none.length !== 0) fail(`"none" still shows ${seen.none.length} meters`)
  if (!seen.currents.some((t) => /A$/.test(t))) fail(`currents mode should print amperes: ${seen.currents.join(' | ')}`)
  if (!seen.voltages.some((t) => /V$/.test(t))) fail(`voltages mode should print volts: ${seen.voltages.join(' | ')}`)
  if (!seen.powers.some((t) => /W$/.test(t))) fail(`powers mode should print watts: ${seen.powers.join(' | ')}`)
  console.log(`   currents: ${seen.currents.slice(0, 3).join(', ')} …`)
  console.log(`   voltages: ${seen.voltages.slice(0, 3).join(', ')} …`)
  console.log(`   powers:   ${seen.powers.slice(0, 3).join(', ')} …`)
}

// -------------------------------------------- 4. the refusal, and its lifting

console.log('\n4. E3: the ideal comparator refuses, finite gain lifts it\n')
{
  await pick(names.find((n) => /comparator/i.test(n)))
  const ref = page.locator('[data-role=refusal]')
  if ((await ref.count()) === 0) fail('E3 at defaults should show a refusal')
  else {
    const code = await ref.getAttribute('data-code')
    const text = await ref.textContent()
    if (code !== 'opamp-open-loop') fail(`E3 refusal code ${code}`)
    if (!/no feedback path/.test(text)) fail(`E3 refusal text: ${text}`)
    console.log(`   refused: ${text.replace(/\s+/g, ' ').trim().slice(0, 90)}…`)
    // The topbar chip gives the reason in words; the machine code stays in the data attribute and the report.
    const chip = (await outcome()).replace(/\s+/g, ' ').trim()
    if (/opamp-open-loop|[a-z]+-[a-z]+/.test(chip)) fail(`E3 topbar shows a machine code: ${chip}`)
    if (!/no feedback path/.test(chip)) fail(`E3 topbar should give the reason: ${chip}`)
    else console.log(`   topbar: ${chip}`)
  }
  await setField('Gain A (0 = ideal)', '100000')
  if ((await ref.count()) !== 0) fail('E3 with A = 10⁵ should solve')
  const v = si((await page.locator('.readout').first().textContent()).match(/v_out\s*([\d.]+\s*\S*)V/)?.[1])
  if (Math.abs(v - 100) > 0.01) fail(`E3 finite gain: v_out ${v}, want 100`)
  else console.log(`   A = 10⁵ -> v_out ${v} V, solved`)
}

// ----------------------------------------- 5. the sweep pane and the marker

console.log('\n5. D6: the sweep redraws and the peak sits at R_s\n')
{
  await pick(names.find((n) => /power transfer/i.test(n)))
  const hash = () =>
    page.evaluate(() => {
      const c = document.querySelector('.views canvas')
      if (!c) return null
      const d = c.toDataURL()
      let h = 0
      for (let i = 0; i < d.length; i += 97) h = (h * 31 + d.charCodeAt(i)) | 0
      return `${h}:${d.length}`
    })
  const h0 = await hash()
  if (!h0) fail('D6: no sweep canvas')
  await setField('Load R_L', '2k')
  const h1 = await hash()
  if (h1 === h0) fail('D6: sweep canvas did not redraw when R_L moved')
  await setField('Source R_s', '1k')
  const near = (await page.locator('.readout').nth(1).textContent()).match(/near\s*([\d.]+\s*\S*)Ω/)?.[1]
  const rOpt = si(near)
  if (!(rOpt > 940 && rOpt < 1060)) fail(`D6: peak reported near ${near}, want ~1 kΩ`)
  else console.log(`   Rs = 1 kΩ -> peak near ${near}Ω, canvas redrew`)
}

// ------------------------------------------------ A11Y. names for everything

console.log('\nA11y: every control has a name, every plot has a label\n')
{
  await pick(names.find((n) => /power transfer/i.test(n)))
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
      if (!nameOf(el)) problems.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40) || '?'} has no accessible name`)
    }
    for (const c of document.querySelectorAll('canvas')) {
      if (c.getAttribute('role') !== 'img' || !c.getAttribute('aria-label')) problems.push('canvas without role="img" + aria-label')
    }
    return [...new Set(problems)]
  })
  if (audit.length) for (const p of audit) fail(`a11y: ${p}`)
  else console.log('   no unnamed controls, no unlabelled plots')
}

// ------------------------------------------- 6. phone width and 4K, no scroll

console.log('\n6. Layout at 390 px and 4K\n')
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(400)
for (const name of names) {
  await pick(name)
  await page.waitForTimeout(80)
  if (await scrollsX()) fail(`390px / ${name}: page scrolls sideways`)
  const over = await clipped()
  if (over.length) fail(`390px / ${name}: clipped at the right edge: ${over.join(', ')}`)
}
console.log(`   no sideways scroll or clipped pane at 390 px across ${names.length} experiments`)
await page.setViewportSize({ width: 3840, height: 2160 })
await page.waitForTimeout(400)
for (const name of names) {
  await pick(name)
  await page.waitForTimeout(80)
  if (await scrolls()) fail(`4K / ${name}: page scrolls`)
}
console.log(`   all ${names.length} experiments fit at 3840x2160`)

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
