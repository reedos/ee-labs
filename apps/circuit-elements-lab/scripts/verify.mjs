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
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]} → ${Math.round(el.getBoundingClientRect().right)}px`)
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
// The list is folded under the picker; unfold it, then the group, then click.
// Choosing folds the list again, as it does for a student.
const pick = async (name) => {
  const btn = page.getByRole('button', { name, exact: true })
  if (!(await btn.isVisible().catch(() => false))) {
    await page.evaluate((n) => {
      const cur = document.querySelector('.picker-current')
      if (cur && cur.getAttribute('aria-expanded') !== 'true') cur.click()
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
        has: own !== null || /Nothing to show/.test(body.textContent),
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

// Desktop: the note begins near the top of the sidebar and the first knob is on
// screen when the experiment opens, for every experiment.
await page.setViewportSize({ width: 1280, height: 900 })
await page.waitForTimeout(400)
let deskPlots = 0
for (const name of names) {
  await pick(name)
  await page.waitForTimeout(80)
  const m = await page.evaluate(() => {
    const note = document.querySelector('[data-role=note]')
    const knob = document.querySelector('.knobs input, .knobs .segmented button')
    const r = knob ? knob.getBoundingClientRect() : null
    return { noteTop: note ? note.getBoundingClientRect().top : Infinity, knobBottom: r ? r.bottom : Infinity, knobTop: r ? r.top : Infinity }
  })
  // Above the note: the suite nav, the title, one line of subtitle, the report
  // link, the section cap and the one-line picker — about 200 px, 220 when the
  // experiment's name wraps. The eight open groups put it near 700.
  if (!(m.noteTop < 230)) fail(`1280px / ${name}: the note starts at ${Math.round(m.noteTop)} px (want < 230)`)
  if (!(m.knobBottom <= 900 && m.knobTop >= 0)) fail(`1280px / ${name}: the first knob is off screen on load (${Math.round(m.knobTop)}–${Math.round(m.knobBottom)} px)`)
  deskPlots += await checkPlots(`1280px / ${name}`)
}
console.log(`   1280×900: the note starts above 230 px and the first knob is on screen for all ${names.length} experiments`)
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
console.log('   Σ power absent on A1, present on B3; the size chip explains nodes and unknowns')

// Every preset chip reads as one line: a value with its unit, never a wrapped
// bare number. The chips belong to the knobs of each experiment.
const tall = []
for (const name of names) {
  await pick(name)
  const wrapped = await page.$$eval('.knobs .num-chips .chip', (els) =>
    els.filter((b) => b.getBoundingClientRect().height > 30 || !/[A-Za-zΩ°]$/.test(b.textContent.trim())).map((b) => b.textContent.trim()),
  )
  for (const w of wrapped) tall.push(`${name}: “${w}”`)
}
for (const t of tall) fail(`preset chip wrapped or unit-less: ${t}`)
console.log(`   every preset chip is one line and ends in its unit`)

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
