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
import { foldProbe } from '@ee-labs/ui/verify/foldProbe.mjs'

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
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]} → ${Math.round(el.getBoundingClientRect().right)}px`)
  })

async function openAllMath() {
  // The working sits under the explanation fold (Phase 8). Open it first.
  await page.evaluate(() => {
    const d = document.querySelector('[data-role=deeper]')
    if (d && !d.open) d.open = true
  })
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

// A finished experiment wears a ✓ in the picker (aria-hidden, so the button's
// name is still the experiment's); read names without it.
const names = await page.$$eval('.presets .preset', (els) => els.map((e) => e.textContent.replace(/✓/g, '').trim()))
// The list is folded under the picker; unfold it, then the group, then click.
// Choosing folds the list again, as it does for a student.
const pick = async (name) => {
  const btn = page.getByRole('button', { name, exact: true })
  if (!(await btn.isVisible().catch(() => false))) {
    await page.evaluate((n) => {
      const cur = document.querySelector('.picker-current')
      if (cur && cur.getAttribute('aria-expanded') !== 'true') cur.click()
      for (const d of document.querySelectorAll('details.preset-group')) {
        const has = [...d.querySelectorAll('.preset')].some((b) => b.textContent.replace(/✓/g, '').trim() === n)
        if (has && !d.open) d.querySelector('summary').click()
      }
    }, name)
    await page.waitForTimeout(100)
  }
  await btn.click()
  await settle()
}
const viewButtons = () => page.$$eval('.view-switch button', (els) => els.map((e) => e.textContent.trim()))

// Arithmetic noise must never reach the student: no femto-anything, no
// exponent notation, and no raw URL hash anywhere on the page.
const noiseOnPage = () =>
  page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const found = []
    let n
    while ((n = walker.nextNode())) {
      const t = n.textContent
      if (/\d\s?f(V|A|W|J|Ω)\b/.test(t) || /\de[-+]\d/.test(t) || /#circuit=/.test(t)) found.push(t.trim().slice(0, 60))
    }
    return found
  })

// No text on a chart covers other text. Every canvas records the box of every
// fillText it made (timePlot.js trackText) in CSS pixels; read them back and
// name any two that overlap once each is shrunk by a pixel. A chart with no
// text at all is a chart that did not draw.
const textOverlaps = () =>
  page.evaluate(() => {
    const out = []
    for (const c of document.querySelectorAll('canvas.plot')) {
      const boxes = c.__texts
      if (!boxes || !boxes.length) {
        out.push(`${c.className}: no text recorded`)
        continue
      }
      const shrink = 1
      // Boxes are in CSS pixels; a label written past the edge is drawn clipped, which no overlap test sees.
      const cw = c.clientWidth || c.width
      const ch = c.clientHeight || c.height
      for (const p of boxes) if (p.x0 < -shrink || p.y0 < -shrink || p.x1 > cw + shrink || p.y1 > ch + shrink) out.push(`${c.className}: “${p.text}” runs off the canvas`)
      for (let a = 0; a < boxes.length; a++)
        for (let b = a + 1; b < boxes.length; b++) {
          const p = boxes[a]
          const q = boxes[b]
          if (p.x0 + shrink < q.x1 - shrink && q.x0 + shrink < p.x1 - shrink && p.y0 + shrink < q.y1 - shrink && q.y0 + shrink < p.y1 - shrink)
            out.push(`${c.className}: “${p.text}” over “${q.text}”`)
        }
    }
    return out
  })

/** The sentence under the plot, if the view has a plot: its text, and whether it carries numbers. */
const captionOn = () =>
  page.evaluate(() => {
    const canvas = document.querySelector('.view canvas.plot')
    const cap = document.querySelector('[data-role=caption]')
    return { plot: canvas !== null, caption: cap ? cap.textContent.trim() : null, bold: cap ? cap.querySelectorAll('b').length : 0 }
  })

/** Walk the plot views of the current experiment: every chart clear of overlapping text, every plot captioned. */
async function checkPlots(label) {
  const views = await viewButtons()
  let plots = 0
  for (const v of views) {
    await page.locator('.view-switch').getByRole('button', { name: v, exact: true }).click()
    await page.waitForTimeout(120)
    const c = await captionOn()
    if (!c.plot) continue
    plots++
    for (const o of await textOverlaps()) fail(`${label} / ${v}: ${o}`)
    if (c.caption === null) fail(`${label} / ${v}: a plot with no caption under it`)
    else if (!/\d/.test(c.caption) || c.bold === 0) fail(`${label} / ${v}: the caption carries no number: “${c.caption}”`)
  }
  return plots
}

// ------------------------------------ 1. every experiment, every panel, every view

console.log(`\n1. Loading all ${names.length} experiments, opening every math panel, every view\n`)
const marked = new Map()
const captions = new Map()
let plotted = 0
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

  // The headline leads the Analysis pane in every view, the bridge follows it,
  // and the schematic's callout reads the same number.
  const views = await viewButtons()
  let rendered = 0
  for (const v of views) {
    // Exact name: a substring match on "Power" would also pick up "AC power".
    await page.locator('.view-switch').getByRole('button', { name: v, exact: true }).click()
    await page.waitForTimeout(120)
    const seen = await page.evaluate(() => {
      const body = document.querySelectorAll('.view .view-body')[1]
      if (!body) return null
      const kids = [...body.children]
      const own = body.querySelector('[data-role]:not([data-role=headline]):not([data-role=bridge]), canvas')
      return {
        has: own !== null || /No solution to plot/.test(body.textContent),
        headlineFirst: kids[0]?.getAttribute('data-role') === 'headline',
        bridgeSecond: kids[1]?.getAttribute('data-role') === 'bridge',
        headline: [body.querySelector('.headline-tag')?.textContent, body.querySelector('.headline-value strong')?.textContent].join(' = '),
        refused: body.querySelector('.headline.is-refused') !== null,
        callout: document.querySelector('.schematic .sch-callout')?.textContent.trim() ?? null,
        marks: [...body.querySelectorAll('[data-role=marks] li')].map((li) => li.textContent.trim()),
      }
    })
    // The plot's caption: every mark the canvas draws is listed with its number.
    for (const t of seen?.marks || []) if (!/\d/.test(t)) fail(`${name} / ${v}: a plot mark without its number: “${t}”`)
    if (seen?.marks?.length) marked.set(name, [...(marked.get(name) || []), ...seen.marks])
    if (!seen || !seen.has) fail(`${name}: view "${v}" rendered nothing`)
    else rendered++
    if (!seen?.headlineFirst) fail(`${name} / ${v}: the headline is not the first thing in the Analysis pane`)
    if (!seen?.bridgeSecond) fail(`${name} / ${v}: no bridge sentence under the headline`)
    // The headline's tag is typeset (v_out reads as v with a real subscript); the
    // callout's is plain text. Compare them letter for letter with the typesetting
    // undone: KaTeX's zero-width joiners, its ∣ for |, subscript digits and marks.
    const plain = (s) =>
      (s || '')
        .replace(/[\u200b_]/g, '')
        .replace(/∣/g, '|')
        .replace(/[₀₁₂₃]/g, (c) => '₀₁₂₃'.indexOf(c))
        .replace(/⁺/g, '+')
    if (seen && !seen.refused && seen.callout !== null && plain(seen.callout) !== plain(seen.headline)) {
      fail(`${name} / ${v}: callout “${seen.callout}” ≠ headline “${seen.headline}”`)
    }
    if (seen?.refused && seen.callout !== null) fail(`${name} / ${v}: refused, yet a callout is drawn: “${seen.callout}”`)
    for (const t of await noiseOnPage()) fail(`${name} / ${v}: arithmetic noise on screen: “${t}”`)
    // A plot: its text clear of itself, a sentence under it with the numbers in bold.
    const cap = await captionOn()
    if (cap.plot) {
      plotted++
      for (const o of await textOverlaps()) fail(`1920px / ${name} / ${v}: ${o}`)
      if (cap.caption === null) fail(`${name} / ${v}: a plot with no caption under it`)
      else if (!/\d/.test(cap.caption) || cap.bold === 0) fail(`${name} / ${v}: the caption carries no number: “${cap.caption}”`)
      else captions.set(`${name} / ${v}`, cap.caption)
    }
  }
  console.log(
    `   ${name.padEnd(30)} ${String(checks.filter((r) => r.mark === '✓').length).padStart(2)} ✓  ${bad.length} ✗  ` +
      `${String(m.length).padStart(2)} meters  ${rendered}/${views.length} views  ${refused ? 'REFUSED' : out.slice(0, 30)}`,
  )
}

// The eight experiments whose plots carry data marks (marks.js) list them
// under the plot, and the time-constant experiment names the 63.2 % point.
if (marked.size < 8) fail(`only ${marked.size} experiments list plot marks; marks.js declares 8`)
const tauName = names.find((n) => /the time constant$/i.test(n))
if (!(marked.get(tauName) || []).some((t) => /63\.2 %/.test(t))) fail(`${tauName}: the 63.2 % mark is not listed under the scope`)
// Every plot view had a caption with numbers (the loop failed the ones that did not).
if (plotted < 40) fail(`only ${plotted} plot views seen; the lab has more than 40`)
console.log(`\n   ${plotted} plot views checked for overlapping text and a captioned sentence (${captions.size} captions read; failures listed at the end)`)

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
// The note retires once a knob has moved — and its numbers re-read: at R₂ = 10 kΩ
// the written "5.45 mA" no longer stands, so the note reprints it, marked.
{
  const pristine = await page.locator('[data-role=note]').getAttribute('data-pristine')
  if (pristine !== 'false') fail('the note should retire after a knob moves')
  else console.log('   note retired after the knob moved')
  const changed = await page.$$eval('[data-role=note] b.live[data-changed="true"]', (els) => els.map((e) => e.textContent))
  if (!changed.length) fail('B1 at R₂ = 10 kΩ: no number in the note re-read (expected a marked b.live)')
  else console.log(`   live note re-read: ${changed.join(', ')}`)
  const prov = (await page.locator('[data-role=note] .prov').textContent()).trim()
  if (!/re-read/.test(prov)) fail(`B1 note provenance should say the numbers re-read: "${prov}"`)
}

// ------------------------------ 2b. the lesson answers back: terms, predict, thread

console.log('\n2b. Terms on tap, predict before you turn, the thread\n')
{
  await pick(names[0]) // A1
  // A first-use term is marked in the note and opens its card under the note.
  const dfns = await page.$$eval('[data-role=note] dfn.term', (els) => els.map((e) => e.dataset.term))
  if (!dfns.includes('voltage') || !dfns.includes('current')) fail(`A1 should mark voltage and current in the note: ${dfns.join(', ')}`)
  await page.locator('[data-role=note] dfn.term[data-term=voltage]').click()
  await settle()
  const card = page.locator('[data-role=def][data-term=voltage]')
  if ((await card.count()) !== 1) fail('tapping "voltage" should open its definition card')
  else {
    const text = await card.textContent()
    if (!/energy/i.test(text)) fail(`the voltage card should define it: ${text.slice(0, 80)}`)
    else console.log(`   voltage card: ${text.replace(/\s+/g, ' ').trim().slice(0, 70)}…`)
  }
  if ((await page.locator('details.terms').count()) !== 0) fail('the "Terms used here" fold should be gone')
  await page.locator('[data-role=def] .def-close').click()
  if ((await page.locator('[data-role=def]').count()) !== 0) fail('the definition card should close')
  // Predict: three readings, the right one sets the knob and reveals the step.
  const options = await page.$$eval('[data-role=predict] .predict-option', (els) => els.map((e) => [e.dataset.rule, e.textContent.trim()]))
  if (options.length !== 3) fail(`A1 predict should offer three answers, got ${options.length}`)
  const solver = options.find(([rule]) => rule === 'solver')
  if (!solver || solver[1] !== '120 mA') fail(`A1 predict: the solver's answer should be 120 mA: ${JSON.stringify(options)}`)
  const wrong = options.find(([rule]) => rule === 'same')
  await page.locator(`[data-role=predict] .predict-option[data-rule=${wrong[0]}]`).click()
  await settle()
  const state = await page.locator('[data-role=predict]').getAttribute('data-state')
  if (state !== 'wrong') fail(`picking "${wrong[1]}" should read as wrong, got ${state}`)
  const reveal = (await page.locator('[data-role=predict-reveal]').textContent()).replace(/\s+/g, ' ').trim()
  if (!/nothing would change/.test(reveal) || !/120 mA/.test(reveal)) fail(`the reveal should name the habit and the reading: ${reveal}`)
  else console.log(`   predict wrong → ${reveal.slice(0, 80)}…`)
  const rNow = await page.getByRole('spinbutton', { name: 'R', exact: true }).first().inputValue()
  if (!/^100\b/.test(rNow.trim())) fail(`answering should set R to 100 Ω, the field shows "${rNow}"`)
  const m = await meters()
  if (!m.some((t) => /^120\s*mA$/.test(t))) fail(`after the prediction the meters should read 120 mA: ${m.join(' | ')}`)
  // The thread: A1 leads to A2; the chip goes there.
  const leads = await page.$$eval('[data-role=leads-to] .thread-chip', (els) => els.map((e) => e.textContent.trim()))
  if (!leads.includes('A2')) fail(`A1 should lead to A2: ${leads.join(', ')}`)
  await page.locator('[data-role=leads-to] .thread-chip', { hasText: 'A2' }).click()
  await settle()
  const now = (await page.locator('.picker-current b').textContent()).trim()
  if (now !== 'A2') fail(`the A2 chip should open A2, now at ${now}`)
  const builds = await page.$$eval('[data-role=builds-on] .thread-chip', (els) => els.map((e) => e.textContent.trim()))
  if (!builds.includes('A1')) fail(`A2 should build on A1: ${builds.join(', ')}`)
  else console.log(`   thread: A1 → A2 (builds on ${builds.join(', ')})`)
  // The group's sentence sits, folded, on the experiment that opens the group and nowhere else.
  if ((await page.locator('[data-role=group-intro]').count()) !== 0) fail('A2 should carry no group intro')
  await pick(names[0])
  if ((await page.locator('[data-role=group-intro]').count()) !== 1) fail('A1 should carry the Group A intro')
}

// -------------------------------- 3. the meter mode switches what is written

console.log('\n3. Meter modes: currents, voltages, powers, none\n')
{
  await pick(kclName)
  const seen = {}
  const hues = {}
  for (const mode of ['currents', 'voltages', 'powers', 'none']) {
    await page.getByRole('button', { name: mode, exact: true }).click()
    await settle()
    seen[mode] = await meters()
    // The meters take the hue of the quantity they show — the same hue the plots draw it in.
    hues[mode] = await page.evaluate((mode) => {
      const token = { currents: '--q-current', voltages: '--q-voltage', powers: '--q-power' }[mode]
      const el = document.querySelector('.schematic text.sch-meter')
      if (!el || !token) return null
      const hex = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
      const m = hex.match(/^#([0-9a-f]{6})$/i)
      const want = m ? `rgb(${parseInt(m[1].slice(0, 2), 16)}, ${parseInt(m[1].slice(2, 4), 16)}, ${parseInt(m[1].slice(4, 6), 16)})` : hex
      return { fill: getComputedStyle(el).fill, want }
    }, mode)
  }
  for (const mode of ['currents', 'voltages', 'powers']) {
    if (!hues[mode]) fail(`${mode}: no meter to read the hue of`)
    else if (hues[mode].fill !== hues[mode].want) fail(`${mode}: the meters are painted ${hues[mode].fill}, the plots use ${hues[mode].want}`)
  }
  if (hues.currents && hues.voltages && hues.currents.fill === hues.voltages.fill) fail('currents and voltages are painted the same hue')
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
  // The op-amp is a switch: ideal refuses; "finite gain" hands over to the gain knob (default 10⁵).
  await page.locator('[data-role=toggle][data-key=ideal]').getByRole('button', { name: 'finite gain' }).click()
  await settle()
  if ((await ref.count()) !== 0) fail('E3 with finite gain A = 10⁵ should solve')
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
// The phone is one page: the lesson's first line and the Analysis view switch
// both land in the first screen, and nothing scrolls inside the page except the
// page (the sidebar used to be a 380 px box holding a 1500 px column).
const phoneFirstScreen = () =>
  page.evaluate(() => {
    const h = window.innerHeight
    const top = (sel) => {
      const el = document.querySelector(sel)
      return el ? el.getBoundingClientRect().top : Infinity
    }
    // #root is the page's own scroller on a phone; anything inside it that
    // scrolls a column taller than the screen is the box this rules out.
    const innerScrollers = [...document.querySelectorAll('#root *')]
      .filter((el) => {
        const cs = getComputedStyle(el)
        return /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1 && el.scrollHeight > h
      })
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ${el.clientHeight}px showing ${el.scrollHeight}px`)
    return { note: top('[data-role=note]'), views: top('.view-switch'), innerScrollers }
  })
let phonePlots = 0
for (const name of names) {
  await pick(name)
  await page.waitForTimeout(80)
  await page.evaluate(() => window.scrollTo(0, 0))
  if (await scrollsX()) fail(`390px / ${name}: page scrolls sideways`)
  const over = await clipped()
  if (over.length) fail(`390px / ${name}: clipped at the right edge: ${over.join(', ')}`)
  const first = await phoneFirstScreen()
  if (!(first.note < 844)) fail(`390px / ${name}: the note starts at ${Math.round(first.note)} px, below the first screen`)
  if (!(first.views < 844)) fail(`390px / ${name}: the Analysis view switch starts at ${Math.round(first.views)} px, below the first screen`)
  if (first.innerScrollers.length) fail(`390px / ${name}: scrolls inside the page: ${first.innerScrollers.join(', ')}`)
  phonePlots += await checkPlots(`390px / ${name}`)
}
console.log(`   no sideways scroll or clipped pane at 390 px across ${names.length} experiments`)
console.log('   the note and the Analysis view switch are in the first screen; nothing scrolls inside the page')
console.log(`   ${phonePlots} plot views at 390 px checked for overlapping text and a caption`)

// The tab bar (Phase 8): four parts of the page named at the foot of the phone
// screen; Knobs brings the knobs up, Lesson brings the note back.
await pick(names[0])
await page.evaluate(() => window.scrollTo(0, 0))
const tabs = page.locator('[data-role=tabbar] button')
if (!(await page.locator('[data-role=tabbar]').isVisible())) fail('390px: the tab bar is not visible')
if ((await tabs.count()) !== 4) fail(`390px: the tab bar has ${await tabs.count()} buttons, not 4`)
const inView = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return false
    const r = el.getBoundingClientRect()
    // Near the top of the screen — or, for the last section of a short page that cannot scroll it there, whole on the screen.
    return r.top >= -1 && (r.top < window.innerHeight * 0.6 || r.bottom <= window.innerHeight)
  }, sel)
await tabs.filter({ hasText: 'Knobs' }).click()
await page.waitForTimeout(900)
if (!(await inView('.controls > .knobs'))) fail('390px: tapping Knobs did not bring the knobs into view')
if ((await page.locator('[data-role=tabbar] button.on').textContent()) !== 'Knobs') fail('390px: the Knobs tab is not lit after going to the knobs')
await tabs.filter({ hasText: 'Lesson' }).click()
await page.waitForTimeout(900)
if (!(await inView('[data-role=note]'))) fail('390px: tapping Lesson did not bring the note into view')
console.log('   the tab bar shows four parts; Knobs and Lesson go where they say')

// Desktop: the note begins near the top of the sidebar and the first knob is on
// screen when the experiment opens, for every experiment.
await page.setViewportSize({ width: 1280, height: 900 })
await page.waitForTimeout(400)
let deskPlots = 0
let wholeSidebar = 0
for (const name of names) {
  await pick(name)
  await page.waitForTimeout(80)
  const m = await page.evaluate(() => {
    const note = document.querySelector('[data-role=note]')
    const knob = document.querySelector('.knobs input, .knobs .segmented button')
    const r = knob ? knob.getBoundingClientRect() : null
    const knobs = document.querySelector('.controls > .knobs')
    const deeper = document.querySelector('.controls > .deeper')
    return {
      noteTop: note ? note.getBoundingClientRect().top : Infinity,
      knobBottom: r ? r.bottom : Infinity,
      knobTop: r ? r.top : Infinity,
      knobsBottom: knobs ? knobs.getBoundingClientRect().bottom : Infinity,
      deeperBottom: deeper ? deeper.getBoundingClientRect().bottom : Infinity,
    }
  })
  // Above the note: the suite nav, the title, one line of subtitle, the report
  // link, the section cap and the one-line picker — about 200 px, 220 when the
  // experiment's name wraps. The eight open groups put it near 700.
  if (!(m.noteTop < 230)) fail(`1280px / ${name}: the note starts at ${Math.round(m.noteTop)} px (want < 230)`)
  if (!(m.knobBottom <= 900 && m.knobTop >= 0)) fail(`1280px / ${name}: the first knob is off screen on load (${Math.round(m.knobTop)}–${Math.round(m.knobBottom)} px)`)
  // The screen as one composition (Phase 8): the lesson and every knob on
  // screen at once on a laptop, so the student never scrolls to turn a knob.
  if (!(m.knobsBottom <= 900)) fail(`1280px / ${name}: the Knobs section ends at ${Math.round(m.knobsBottom)} px, below the screen`)
  if (m.deeperBottom <= 900) wholeSidebar++
  deskPlots += await checkPlots(`1280px / ${name}`)
}
console.log(`   1280×900: the note starts above 230 px and the first knob is on screen for all ${names.length} experiments`)
console.log(`   1280×900: the whole Knobs section is on screen for all ${names.length}; the whole sidebar, Deeper included, for ${wholeSidebar}`)
console.log(`   ${deskPlots} plot views at 1280 px checked for overlapping text and a caption`)

// The play button sweeps the cursor across the window and stops itself at
// the end; the cursor readout follows it.
await pick(tauName)
const range = page.locator('.cursor-row input[type=range]')
const tMax = parseFloat(await range.getAttribute('max'))
const t0 = parseFloat(await range.inputValue())
const playBtn = page.locator('[data-role=play]')
await playBtn.click()
await page.waitForTimeout(1500)
const midway = parseFloat(await range.inputValue())
if ((await playBtn.getAttribute('aria-pressed')) !== 'true') fail('play: the button does not read as pressed while playing')
if (!(midway > t0 + tMax * 0.2 && midway < tMax)) fail(`play: after 1.5 s the cursor is at ${midway} (from ${t0}) of ${tMax}, not sweeping`)
await page.waitForTimeout(3500)
const atEnd = parseFloat(await range.inputValue())
if (Math.abs(atEnd - tMax) > 1e-9 * tMax) fail(`play: the cursor stopped at ${atEnd}, not the end of the window ${tMax}`)
if ((await playBtn.getAttribute('aria-pressed')) !== 'false') fail('play: the button did not release at the end of the window')
const tText = await page.locator('[data-role=cursor-time] b').textContent()
if (!/\d/.test(tText)) fail(`play: the cursor readout reads “${tText}”`)
console.log(`   play: the cursor swept to the end of the window (t = ${tText}) and the button released`)
await page.setViewportSize({ width: 3840, height: 2160 })
await page.waitForTimeout(400)
for (const name of names) {
  await pick(name)
  await page.waitForTimeout(80)
  if (await scrolls()) fail(`4K / ${name}: page scrolls`)
}
console.log(`   all ${names.length} experiments fit at 3840x2160`)

// ------------------------------------ 6b. the fold: every knob on screen
//
// Round-trip review defect: F7's own step 3 says to flip the op-amp to finite
// gain using the Gain knob, and at 1366×768 that knob — the last of six — sat
// below the fold, with no visible scrollbar hinting there was more. Seven
// more experiments (E2, G6, H1, H4, H6, I6, I7) clipped their last knob too,
// G6's worst of all, fully off screen. The lab tested 390, 1280×900 and
// 3840×2160 and never the laptop size students actually use. The other labs'
// shared foldProbe (packages/ui/verify/foldProbe.mjs) is reused here rather
// than hand-rolled, at its default 1366×768 and 1440×900.
console.log('\n6b. Fold probe at 1366×768 and 1440×900: every knob of every experiment reachable\n')
{
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.waitForTimeout(200)
  // Each experiment's own knob-slot keys, read off the DOM once: this is
  // exactly the set the sidebar renders (the window knob already lives under
  // the schematic, not here), so the probe checks what a student would need.
  const knobKeysOf = {}
  for (const name of names) {
    await pick(name)
    knobKeysOf[name] = await page.$$eval('.knob-slot', (els) => els.map((e) => e.dataset.key))
  }
  const cases = names.map((name) => ({
    name,
    load: async (pg) => {
      await pg.waitForSelector('.views .schematic')
      await pick(name)
    },
    must: knobKeysOf[name].map((k) => `.knob-slot[data-key="${k}"]`),
  }))
  const res = await foldProbe(page, { cases, url: URL })
  for (const f of res.failures) fail(`fold: ${f}`)
  const totalKnobs = names.reduce((n, name) => n + knobKeysOf[name].length, 0)
  console.log(
    `   ${res.ok ? `every knob of all ${names.length} experiments (${totalKnobs} knobs) stays on screen at 1366×768 and 1440×900` : `${res.failures.length} fold failures`}`,
  )
  // F7's Gain knob (named by its own step 3) and G6's i_L(0) (the worst
  // offender, fully off screen before the fix): named explicitly so a
  // regression here reads as these two experiments, not just a count.
  const boxOf = (lessonRe, key) =>
    res.measured.find((m) => m.viewport === '1366x768' && lessonRe.test(m.lesson) && m.control === `.knob-slot[data-key="${key}"]`)
  const f7 = boxOf(/op-amp integrator/i, 'G')
  const g6 = boxOf(/Initial conditions/i, 'i0')
  if (!f7?.box) fail('fold: F7’s Gain knob was not measured')
  else console.log(`   F7 Gain knob at 1366×768: y ${f7.box.y.toFixed(0)}–${(f7.box.y + f7.box.height).toFixed(0)} of 768`)
  if (!g6?.box) fail('fold: G6’s i_L(0) knob was not measured')
  else console.log(`   G6 i_L(0) knob at 1366×768: y ${g6.box.y.toFixed(0)}–${(g6.box.y + g6.box.height).toFixed(0)} of 768`)
}

// ------------------------------------------------ 7. numbers and names

console.log('\n7. Numbers and names: Σ power arrives with B3, the size chip explains itself, chips fit one line\n')
await page.setViewportSize({ width: 1280, height: 900 })
await page.waitForTimeout(300)
const topbarText = () => page.locator('.topbar').textContent()
await pick(names[0])
if (/Σ power/.test(await topbarText())) fail('A1: the topbar shows Σ power before power has been introduced')
await pick(names.find((n) => /Power, and the sign of it/i.test(n)))
if (!/Σ power/.test(await topbarText())) fail('B3: the topbar should show Σ power from the experiment that introduces power')
const sizeTitle = await page.locator('[data-role=system-size]').getAttribute('title')
if (!sizeTitle || !/junction/i.test(sizeTitle) || !/unknown/i.test(sizeTitle)) fail(`the nodes/unknowns chip should explain both words on hover (got “${sizeTitle}”)`)
// The topbar speaks the student's words (Phase 8): the solver's are in the hover titles.
const tb = (await topbarText()).replace(/\s+/g, ' ')
if (/solved|residual|unknown/i.test(tb)) fail(`the topbar uses the solver's words on its face: “${tb}”`)
console.log('   Σ power absent on A1, present on B3; the size chip explains nodes and unknowns; no solver-speak on the topbar')

// -------------------------- 7b. the topbar chips open on tap, not only hover
//
// Round-trip review defect: the node-count chip's explanation lived only in
// a title attribute, so a phone — first-class for at least three of the
// student sittings — could never open it, unlike the note's terms, which
// already open on tap.
console.log('\n7b. The node-count and outcome chips open their explanation on tap, phone width included\n')
{
  await pick(names[0])
  const sizeChip = page.locator('[data-role=system-size]')
  if ((await sizeChip.evaluate((el) => el.tagName)) !== 'BUTTON') fail('the node-count chip is not a real button — a touch screen could not open it')
  await sizeChip.click()
  await settle()
  const sizePop = page.locator('[data-role=chip-pop][data-chip=size]')
  if ((await sizePop.count()) !== 1) fail('tapping the node-count chip did not open its explanation')
  else {
    const text = (await sizePop.textContent()).replace(/\s+/g, ' ')
    if (!/junction/i.test(text) || !/unknown/i.test(text)) fail(`the tapped explanation should still explain nodes and unknowns: ${text.slice(0, 90)}`)
    else console.log(`   size chip tapped open: ${text.slice(0, 70)}…`)
  }
  await page.locator('.chip-pop-close').click()
  if ((await page.locator('[data-role=chip-pop]').count()) !== 0) fail('the chip explanation did not close')

  // The outcome chip carries its extra sentence (the residual) only once
  // solved; A1 is solved at its defaults.
  const outChip = page.locator('[data-role=outcome]')
  if ((await outChip.evaluate((el) => el.tagName)) !== 'BUTTON') fail('the outcome chip is not a real button')
  await outChip.click()
  await settle()
  const outPop = page.locator('[data-role=chip-pop][data-chip=outcome]')
  if ((await outPop.count()) !== 1) fail('tapping the outcome chip did not open its explanation')
  else if (!/residual/i.test(await outPop.textContent())) fail('the outcome explanation should name the residual')
  else console.log('   outcome chip tapped open, names the residual')
  await page.locator('.chip-pop-close').click()

  // Phone width: no hover exists at all, so the tap is the only way in.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)
  await page.locator('[data-role=system-size]').click()
  await settle()
  if ((await page.locator('[data-role=chip-pop][data-chip=size]').count()) !== 1) fail('390px: tapping the node-count chip did not open its explanation')
  else console.log('   390px: the node-count chip opens on tap')
  await page.locator('.chip-pop-close').click()
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.waitForTimeout(200)
}

// Every preset chip reads as one line: a value with its unit, never a wrapped
// bare number. The chips belong to the knobs of each experiment; only the open
// knob shows them, so open each in turn.
const tall = []
for (const name of names) {
  await pick(name)
  const slots = await page.locator('.knob-slot').count()
  for (let k = 0; k < slots; k++) {
    await page.locator('.knob-slot').nth(k).click()
    await page.waitForTimeout(40)
    const wrapped = await page.$$eval('.knobs .num-chips .chip', (els) =>
      els.filter((b) => b.getBoundingClientRect().height > 30 || !/[A-Za-zΩ°]$/.test(b.textContent.trim())).map((b) => b.textContent.trim()),
    )
    for (const w of wrapped) tall.push(`${name}: “${w}”`)
  }
}
for (const t of tall) fail(`preset chip wrapped or unit-less: ${t}`)
console.log(`   every preset chip is one line and ends in its unit`)

// ------------------------------------------ 8. the screen as one composition

console.log('\n8. The screen as one composition: the path, the lit knob, the schematic answering back\n')

// Start as a new student: the sections above have already turned A1's knobs.
await page.evaluate(() => localStorage.removeItem('ee-labs/elements/progress'))
await page.reload({ waitUntil: 'load' })
await page.waitForSelector('.views .schematic')
await page.waitForTimeout(300)
// The active step names a knob; that knob is the open one and is marked.
await pick(names[0])
const a1Slot = await page.evaluate(() => {
  const li = document.querySelector('[data-role=try] li[data-state=active]')
  const slot = document.querySelector('.knob-slot[data-named]')
  return { step: li ? li.getAttribute('data-step') : null, key: slot ? slot.getAttribute('data-key') : null, open: slot ? slot.getAttribute('data-open') : null, opens: document.querySelectorAll('.knob-slot[data-open=true]').length }
})
if (a1Slot.step !== '0') fail(`A1: the active step on arrival is ${a1Slot.step}, not the first`)
if (a1Slot.key !== 'R1' || a1Slot.open !== 'true') fail(`A1: step 1 sets R1, but the marked knob is ${a1Slot.key} (open: ${a1Slot.open})`)
if (a1Slot.opens !== 1) fail(`A1: ${a1Slot.opens} knobs are open; one should be`)
// What the step says to read is lit on the schematic.
if ((await page.locator('.schematic .sch-el[data-el=R1].is-lit').count()) !== 1) fail('A1: step 1 reads i_R1, but R1 is not lit on the schematic')
// A closed knob opens on a tap, and the sliders come back.
await page.locator('.knob-slot[data-key=E]').click()
await page.waitForTimeout(60)
if ((await page.locator('.knob-slot[data-key=E][data-open=true] .num-slider').count()) !== 1) fail('A1: tapping the closed E knob did not open it with its slider')
console.log('   A1: step 1 lights the R knob and R1; a tapped knob opens')

// Walking A1's three steps: each ticks off as the screen meets it; the picker
// marks the experiment; the next experiment is offered.
await page.locator('[data-role=predict] .predict-option').first().click()
await page.waitForTimeout(100)
await setField('R', '100')
let states = () => page.$$eval('[data-role=try] li', (els) => els.map((li) => li.getAttribute('data-state')))
let s = await states()
if (s[0] !== 'done' || s[1] !== 'active') fail(`A1: after R = 100 Ω the steps read ${s.join(', ')} (want done, active, ahead)`)
await setField('Source V₁', '5')
await page.getByRole('button', { name: 'voltages', exact: true }).click()
await settle()
s = await states()
if (!s.every((v) => v === 'done')) fail(`A1: after E = 5 V and the meters on voltages the steps read ${s.join(', ')}`)
if ((await page.locator('[data-role=next-up]').count()) !== 1) fail('A1: every step done, but no next-up offer')
const nextText = await page.locator('[data-role=next-up] button').textContent()
if (!/A2/.test(nextText)) fail(`A1: the next-up offer reads “${nextText}”, not A2`)
await page.evaluate(() => document.querySelector('.picker-current').click())
await page.waitForTimeout(80)
const doneMarks = await page.$$eval('.presets .preset[data-done]', (els) => els.map((e) => e.textContent.replace(/✓/g, '').trim()))
if (!doneMarks.includes(names[0])) fail(`picker: A1 is complete but not marked (marked: ${doneMarks.join(', ') || 'none'})`)
if ((await page.locator('[data-role=course-arc]').count()) !== 1) fail('picker: no course arc after the first experiment is complete')
const arcText = await page.locator('[data-role=group-arc]').first().textContent()
if (!/^1\/\d+$/.test(arcText.trim())) fail(`picker: the group arc reads “${arcText}”, not 1/N`)
await page.evaluate(() => document.querySelector('.picker-current').click())
// Progress survives a reload.
await page.reload({ waitUntil: 'load' })
await page.waitForSelector('.views .schematic')
await page.waitForTimeout(300)
s = await states()
if (!s.every((v) => v === 'done')) fail(`A1: after a reload the steps read ${s.join(', ')}; progress was not kept`)
console.log('   A1: three steps ticked by turning the knobs and switching the meters; marked in the picker; kept across a reload')

// A3: tap a node and it becomes the reference — it reads 0, the others shift
// by what it read, the elements do not move. Tap again for ground.
await pick(names.find((n) => /ground a choice/i.test(n)))
const readNode = (n) => page.locator(`.readout [data-node=${n}] b`).textContent().then((t) => si(t.replace(/\s*V$/, '')))
const vA0 = await readNode('A')
const vIn0 = await readNode('in')
// The ammeters, read before and after: a reference is a choice about voltages
// only. The node labels' voltages share the meter class and are left out.
await page.getByRole('button', { name: 'currents', exact: true }).click()
await settle()
const ammeters = () => page.$$eval('.schematic .sch-el .sch-meter', (els) => els.map((e) => e.textContent.trim()))
const r1Before = (await ammeters()).join(' ')
if (!/A( |$)/.test(r1Before)) fail(`A3: no ammeters on the schematic in currents mode (${r1Before})`)
await page.locator('.schematic [data-node=A]').click()
await settle()
const vA1 = await readNode('A')
const vIn1 = await readNode('in')
if (Math.abs(vA1) > 1e-6) fail(`A3: A tapped as reference reads ${vA1} V, not 0`)
if (Math.abs(vIn1 - (vIn0 - vA0)) > 1e-3 * Math.abs(vIn0)) fail(`A3: with A the reference, in reads ${vIn1} V; want ${vIn0 - vA0}`)
if ((await page.locator('.schematic [data-node=A].is-ref').count()) !== 1) fail('A3: the reference node wears no ring')
if ((await page.locator('.schematic [data-node=gnd].is-aside').count()) !== 1) fail('A3: ground does not step aside while A is the reference')
if (!/is the reference/.test(await page.locator('[data-role=ref-hint]').textContent())) fail('A3: the hint under the schematic does not say A is the reference')
if ((await ammeters()).join(' ') !== r1Before) fail(`A3: element currents moved with the reference: ${r1Before} → ${(await ammeters()).join(' ')}`)
await page.locator('.schematic [data-node=A]').click()
await settle()
if (Math.abs((await readNode('A')) - vA0) > 1e-3 * Math.abs(vA0)) fail('A3: tapping A again did not restore ground as the reference')
console.log('   A3: a tapped node becomes the reference and back; element readings hold')

// F3: tap the switch and the clock restarts.
await pick(tauName)
const rangeF3 = page.locator('.cursor-row input[type=range]')
const tEndF3 = parseFloat(await rangeF3.getAttribute('max'))
await page.locator('.schematic [data-el=S1]').click()
await page.waitForTimeout(250)
const tAfter = parseFloat(await rangeF3.inputValue())
if (!(tAfter >= 0 && tAfter < 0.25 * tEndF3)) fail(`F3: tapping the switch left the cursor at ${tAfter} of ${tEndF3}; want a restart from 0`)
if ((await page.locator('[data-role=play]').getAttribute('aria-pressed')) !== 'true') fail('F3: tapping the switch did not start the sweep')
await page.locator('[data-role=play]').click()
console.log('   F3: tapping the switch restarts the clock')

// Equations view: a row under the pointer lights its node on the schematic.
await pick(names[0])
await page.locator('.view-switch').getByRole('button', { name: 'Equations', exact: true }).click()
await page.waitForTimeout(150)
// On A1 the working is folded under its summary; open it to reach the rows.
await page.evaluate(() => {
  const d = document.querySelector('[data-role=eq-fold]')
  if (d && !d.open) d.open = true
})
await page.locator('.eq-row[data-node=in]').first().hover()
await page.waitForTimeout(100)
if ((await page.locator('.schematic [data-node=in].is-lit').count()) !== 1) fail('A1: hovering the KCL row for “in” does not light the node')
await page.locator('.eq-row[data-el]').first().hover()
await page.waitForTimeout(100)
const litEl = await page.$$eval('.schematic .sch-el.is-lit', (els) => els.map((e) => e.getAttribute('data-el')))
const rowEl = await page.locator('.eq-row[data-el]').first().getAttribute('data-el')
if (!litEl.includes(rowEl)) fail(`A1: hovering the row for ${rowEl} lights ${litEl.join(', ') || 'nothing'}`)
console.log('   A1: rows in the Equations pane light their node and element on the schematic')

// -------------------- 9. glossary: j, dB and Tellegen defined and reachable
//
// Round-trip review defects: j (first named in G4's note on complex roots)
// and dB (load-bearing from the CMRR figure E7 gives, and again from H6's
// Bode plot) were used throughout without ever being defined; Tellegen's
// theorem was named in A4 and B3's Power pane with no way to read what it is.
console.log("\n9. Glossary: j and dB defined and linked at first use; Tellegen's theorem tappable in the Power pane\n")
{
  // G4: "the roots are complex, −α ± jω_d" — j has not been said to mean anything before this.
  await pick(names.find((n) => /Underdamped: ringing/i.test(n)))
  const jDfn = page.locator('[data-role=note] dfn.term[data-term=j]')
  if ((await jDfn.count()) !== 1) fail('G4: the note should mark j on first use')
  else {
    await jDfn.click()
    await settle()
    const card = page.locator('[data-role=def][data-term=j]')
    const text = (await card.textContent()).replace(/\s+/g, ' ')
    if (!/current/i.test(text) || !/−1/.test(text)) fail(`G4: the j definition should say it is √−1 and that i already means current: ${text.slice(0, 90)}`)
    else console.log(`   G4 j card: ${text.slice(0, 80)}…`)
    await page.locator('[data-role=def] .def-close').click()
  }

  // E7: the CMRR figure is given "in dB" in the why — open Deeper to reach it.
  await pick(names.find((n) => /difference amplifier/i.test(n)))
  await openAllMath()
  const dbDfn = page.locator('[data-role=why] dfn.term[data-term=dB]')
  if ((await dbDfn.count()) !== 1) fail('E7: the why should mark dB on first use')
  else {
    await dbDfn.click()
    await settle()
    const card = page.locator('[data-role=def][data-term=dB]')
    const text = (await card.textContent()).replace(/\s+/g, ' ')
    if (!/log/i.test(text)) fail(`E7: the dB definition should explain the log ratio: ${text.slice(0, 90)}`)
    else console.log(`   E7 dB card: ${text.slice(0, 80)}…`)
    await page.locator('[data-role=def] .def-close').click()
  }

  // A4 and B3 default straight into the Power pane, where Tellegen's theorem
  // used to be a name with nowhere to go.
  for (const name of [names.find((n) => /passive sign convention/i.test(n)), names.find((n) => /Power, and the sign of it/i.test(n))]) {
    await pick(name)
    const term = page.locator('.power dfn.term[data-term=tellegen]')
    if ((await term.count()) !== 1) fail(`${name}: the Power pane should name Tellegen's theorem as a tappable term`)
    else {
      await term.click()
      await settle()
      const card = page.locator('.power [data-role=def][data-term=tellegen]')
      if ((await card.count()) !== 1) fail(`${name}: tapping Tellegen's theorem did not open its card`)
      else console.log(`   ${name}: Tellegen's theorem opens its own card in the Power pane`)
      await page.locator('.power .def-close').click()
    }
  }
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
