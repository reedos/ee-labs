// End-to-end verification for the System Lab, in a real browser.
//
// The unit tests analyse every experiment directly and check every note against
// that analysis. `App.smoke.test.jsx` server-renders the tree, which catches a
// prop the shell forgot to pass. Neither of them lays the page out, so neither
// can measure the plan's §11 risk: a table of six rows by four columns at
// 390 px with nothing scrolling sideways. A CSS rule that says `min-width: 0`
// is a proxy for that claim, and this script is the claim itself.
//
//   npm run build --workspace apps/system-lab
//   npm run preview --workspace apps/system-lab   (serves dist/ on :4182)
//   npm run verify --workspace apps/system-lab
//
// `SYSTEM_LAB_PLAN.md` §7 asks for four checks and this file makes all four.
// One block's gain moves one column and no other. The block that dominates the
// noise budget is named, and the name changes when a knob crosses over. The
// table holds both of its orientations. Nothing scrolls sideways at 390 px.

import { chromium } from 'playwright'
import { EXPERIMENTS, GROUPS, VIEW_LABELS, byId } from '../src/experiments.js'
import { COLUMNS } from '../src/view.js'

// `vite preview` binds to localhost, which resolves to ::1 on Windows, so the
// name is the address here rather than 127.0.0.1. Override with APP_URL.
const URL = process.env.APP_URL || 'http://localhost:4182'
const failures = []
const fail = (m) => failures.push(m)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })

const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`)
})

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.app')
await page.waitForTimeout(300)

const settle = () => page.waitForTimeout(140)
const text = async (sel) => ((await page.locator(sel).count()) ? (await page.locator(sel).first().textContent()).trim() : '')
const all = async (sel) => (await page.locator(sel).allTextContents()).map((s) => s.trim())

/** Choose an experiment by id: open its group's tab, then its row. */
async function pick(id) {
  const exp = byId[id]
  await page.locator(`.group-tab[data-group="${exp.group}"]`).click()
  await settle()
  await page.locator(`.preset[data-id="${id}"]`).click()
  await settle()
}

/** Open one view from the switch. */
async function openView(view) {
  await page.locator('.view-switch').getByRole('button', { name: VIEW_LABELS[view].label, exact: true }).click()
  await settle()
}

/** Set a knob by its key, through the field the shell renders for it. */
async function setKnob(key, value) {
  if (!(await page.locator(`.knob[data-knob="${key}"] input`).count())) {
    await page.evaluate(() => {
      const d = document.querySelector('details.more-knobs')
      if (d && !d.open) d.open = true
    })
    await settle()
  }
  const field = page.locator(`.knob[data-knob="${key}"] input`).first()
  await field.fill(String(value))
  await field.press('Enter')
  await settle()
}

/** The page is wider than the screen, which is the plan's first risk arriving. */
const scrollsX = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

/** Anything whose right edge is past the screen, which the shell clips without saying so. */
const clipped = () =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth + 1
    return [...document.querySelectorAll('.view, .view-head, .view-head .segmented, .sys-table-pane, .sys-plot, .sys-numbers, .sys-table')]
      .filter((el) => el.getBoundingClientRect().right > w)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]}`)
  })

/** Every cell of the budget table, keyed by its row and its column. */
const cells = () =>
  page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.sys-table td[data-cell]')].map((td) => [td.getAttribute('data-cell'), td.textContent.trim()])))

/** What the numbers pane reads, by the label in front of each row. */
const numberRows = () =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('.sys-numbers .sys-row')].map((r) => [r.querySelector('.sys-row-label').textContent.trim(), r.querySelector('.sys-row-value').textContent.trim()]),
    ),
  )

/** What each pane must have put on the page, beyond not throwing. */
const VIEW_SHOWS = {
  table: '.sys-table[data-role=budget-table] tbody tr[data-row=total]',
  levels: '[data-role=level-rows] .sys-level-row',
  numbers: '.sys-numbers .sys-row',
}

// ------------------------------------------------ every experiment, every view

console.log(`System Lab: ${EXPERIMENTS.length} experiments in ${GROUPS.length} group${GROUPS.length === 1 ? '' : 's'}`)

for (const exp of EXPERIMENTS) {
  await pick(exp.id)

  const position = await text('[data-role=position]')
  if (!position.includes(`of ${EXPERIMENTS.length}`)) fail(`${exp.id}: the position reads "${position}"`)
  const see = await text('[data-role=see]')
  if (see.length < 40) fail(`${exp.id}: the note under the title is ${see.length} characters`)

  const headline = await text('[data-role=headline]')
  if (!headline || /NaN|undefined|—/.test(headline)) fail(`${exp.id}: the headline reads "${headline}"`)

  // The chain strip sits above every view, so it is drawn once per experiment.
  const blocks = await page.locator('.chain [data-block]').count()
  const want = exp.chain(Object.fromEntries(exp.params.map((k) => [k.key, k.default]))).length
  if (blocks !== want) fail(`${exp.id}: the strip draws ${blocks} blocks and the chain has ${want}`)

  for (const view of exp.views) {
    await openView(view)
    if ((await page.locator(VIEW_SHOWS[view]).count()) === 0) fail(`${exp.id} ${view}: nothing matched ${VIEW_SHOWS[view]}`)
    if (await scrollsX()) fail(`${exp.id} ${view}: the page scrolls sideways`)
    const over = await clipped()
    if (over.length) fail(`${exp.id} ${view}: clipped at the right edge, ${over.join(', ')}`)
    const shown = await all(`${VIEW_SHOWS[view]} *`)
    const bad = shown.filter((t) => /NaN|undefined/.test(t))
    if (bad.length) fail(`${exp.id} ${view}: a reading shows "${bad[0]}"`)
  }

  // Every try step, applied through the chip the reader clicks. A step whose
  // knobs never reach the page leaves the headline where it was.
  await openView(exp.view)
  const before = await text('[data-role=headline]')
  let moved = false
  for (let i = 0; i < exp.try.length; i++) {
    await page.locator('.try-line .chip').first().click()
    await settle()
    if ((await text('[data-role=headline]')) !== before) moved = true
    // The step nav disables its forward button on the last step, so a blind
    // click there waits for an element that never becomes clickable.
    const next = page.locator('.lesson-nav button[aria-label="Next step"]').first()
    if ((await next.count()) && (await next.isEnabled())) await next.click()
    await settle()
  }
  if (!moved && exp.try.some((t) => Object.keys(t.set || {}).length)) fail(`${exp.id}: no try step moved the headline off "${before}"`)
}
console.log('   every experiment loads, every view it offers draws, and its steps move the headline')

// ------------------------------------- one knob moves one column and no other

await pick('a4')
await openView('table')
const beforeCells = await cells()
await setKnob('lnaGainDb', 15)
const same = await cells()
for (const [k, v] of Object.entries(beforeCells)) if (same[k] !== v) fail(`a4: setting the amplifier back to its default moved ${k} from ${v} to ${same[k]}`)

// The IF amplifier is the last block, so its gain moves the gain column and
// nothing else. Nothing sits behind it to take its noise, and nothing ahead of
// it sees a different drive.
await setKnob('ifGainDb', 10)
const after = await cells()
const changed = Object.keys(after).filter((k) => after[k] !== beforeCells[k])
const wrong = changed.filter((k) => !k.endsWith('-gain'))
if (wrong.length) fail(`a4: the last block's gain also moved ${wrong.join(', ')}`)
if (!changed.some((k) => k.endsWith('-gain'))) fail('a4: the last block’s gain moved no gain cell at all')
await setKnob('ifGainDb', 22)
console.log('   turning one block’s gain moves one column and leaves the others where they were')

// ----------------------------- the block that dominates a budget, and its share

await pick('a4')
await openView('numbers')
const atDefault = await numberRows()
const dominates = Object.keys(atDefault).find((k) => k.startsWith('Largest noise share'))
if (!dominates) fail('a4: the numbers pane never names the block with the largest noise share')
else if (!/Low-noise amplifier/.test(atDefault[dominates])) fail(`a4: at the defaults the largest noise share reads "${atDefault[dominates]}"`)

// Raising the amplifier shrinks every share behind it and leaves the two in
// front of it alone, so the amplifier keeps the budget and takes more of it.
await setKnob('lnaGainDb', 25)
const raised = await numberRows()
if (dominates && !/Low-noise amplifier/.test(raised[dominates])) fail(`a4: with the amplifier at 25 dB the largest noise share reads "${raised[dominates]}"`)
if (raised['Cascaded noise figure'] === atDefault['Cascaded noise figure']) fail('a4: the cascaded noise figure did not move when the amplifier did')

// Lower it instead and the mixer's 8 dB noise figure is no longer divided by
// enough gain, so the mixer takes the budget over. The crossover is between
// 8 dB and 15 dB of amplifier gain, and the mark has to follow it.
await setKnob('lnaGainDb', 5)
const starved = await numberRows()
if (dominates && !/Mixer/.test(starved[dominates])) fail(`a4: with the amplifier at 5 dB the largest noise share reads "${starved[dominates]}"`)
await setKnob('lnaGainDb', 15)
const back = await numberRows()
if (dominates && !/Low-noise amplifier/.test(back[dominates])) fail(`a4: the mark did not come back to the amplifier at 15 dB, it reads "${back[dominates]}"`)
if (back['Cascaded noise figure'] !== atDefault['Cascaded noise figure']) fail('a4: the noise figure did not return to its default after the knob did')
console.log('   the block that dominates the noise budget is named, and the name follows the knob across')

// ------------------------------------------ the shares close at 100 % on screen

await pick('a4')
await openView('table')
await page.locator('.sys-table-head .segmented').getByRole('button', { name: 'Share', exact: true }).click()
await settle()
const shares = await cells()
for (const col of ['nf', 'iip3', 'power']) {
  if (shares[`total-${col}`] !== '100.0 %') fail(`a4: the ${col} shares total "${shares[`total-${col}`]}" rather than 100.0 %`)
}
if (!/dB$/.test(shares['total-gain'])) fail(`a4: the gain total reads "${shares['total-gain']}" in share mode`)

// The header's unit row has to follow the switch that changed the cells under
// it, or three of the four columns say decibels over a column of percentages.
const shareUnits = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.sys-table thead em[data-role^=unit-]')].map((e) => [e.getAttribute('data-role'), e.textContent.trim()])))
if (JSON.stringify(shareUnits) !== JSON.stringify({ 'unit-gain': 'dB', 'unit-nf': '%', 'unit-iip3': '%', 'unit-power': '%' })) fail(`a4: in share mode the units read ${JSON.stringify(shareUnits)}`)

// And so does the sentence over the unit. A header still hovering "the
// cumulative noise figure" over a column of percentages is the same defect one
// line higher up.
const titlesNow = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.sys-table thead th[data-col]')].map((e) => [e.getAttribute('data-col'), e.getAttribute('title')])))
const shareTitles = await titlesNow()
for (const c of COLUMNS) if (shareTitles[c.key] !== c.shareTitle) fail(`a4: in share mode the ${c.key} header says "${shareTitles[c.key]}"`)

await page.locator('.sys-table-head .segmented').getByRole('button', { name: 'Cumulative', exact: true }).click()
await settle()
const cumTitles = await titlesNow()
for (const c of COLUMNS) if (cumTitles[c.key] !== c.title) fail(`a4: in cumulative mode the ${c.key} header says "${cumTitles[c.key]}"`)
const cumUnits = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.sys-table thead em[data-role^=unit-]')].map((e) => [e.getAttribute('data-role'), e.textContent.trim()])))
if (JSON.stringify(cumUnits) !== JSON.stringify({ 'unit-gain': 'dB', 'unit-nf': 'dB', 'unit-iip3': 'dBm', 'unit-power': 'mW' })) fail(`a4: in cumulative mode the units read ${JSON.stringify(cumUnits)}`)
console.log('   the share mode’s total row closes at 100 %, and the unit and the sentence follow the switch')

// ------------------------------------ the levels view names both of its lines

await pick('a4')
await openView('levels')
const keys = await all('[data-role=level-keys] .sys-key')
if (keys.length !== 2) fail(`a4: the levels plot has ${keys.length} keys for two lines`)
for (const word of ['Signal', 'Noise']) if (!keys.some((k) => k.includes(word))) fail(`a4: no key names the ${word.toLowerCase()} line`)
const heads = await all('.sys-level-row.is-head .sys-level-value')
if (heads.join(' | ') !== 'Signal, dBm | Noise, dBm | Ratio, dB') fail(`a4: the level columns read "${heads.join(' | ')}"`)
console.log('   both lines of the levels plot are named, and so is every column under it')

// ---------------------------------- the strip names each of a block's readings

const tagged = await page.evaluate(() =>
  [...document.querySelectorAll('.chain [data-block]')].map((b) => ({
    id: b.getAttribute('data-block'),
    tags: [...b.querySelectorAll('em i')].map((i) => i.textContent.trim()),
  })),
)
for (const b of tagged) if (b.tags.join(' ') !== 'G NF Out') fail(`a4: the strip tags ${b.id} as "${b.tags.join(' ')}" rather than G NF Out`)
console.log('   the strip tags each block’s gain, noise figure and output level')

// ------------------------------------------- the corners a knob can reach

await pick('a3')
await setKnob('lossDb', 0)
const zeroLoss = await text('[data-role=headline]')
if (/NaN|undefined/.test(zeroLoss)) fail(`a3: a filter with no loss reads "${zeroLoss}"`)
await setKnob('lossDb', 2)
await setKnob('tempK', 4)
const cold = await numberRows()
if (!cold['Noise factor']) fail('a3: the numbers pane loses the noise factor when the filter is cooled')
console.log('   a filter with no loss and a filter at 4 K both read as numbers, not as residue')

// ------------------------------------------------------------- the narrow screen

await page.setViewportSize({ width: 390, height: 844 })
await settle()
for (const exp of EXPERIMENTS) {
  await pick(exp.id)
  for (const view of exp.views) {
    await openView(view)
    if (await scrollsX()) fail(`${exp.id} ${view}: the page scrolls sideways at 390 px`)
    const over = await clipped()
    if (over.length) fail(`${exp.id} ${view}: clipped at 390 px, ${over.join(', ')}`)
  }
}

// The table transposes below 900 px into one card per block, and every cell
// grows the label its column header used to carry. A bare number with nothing
// naming it is the plan's §11 risk arriving by the other route.
await pick('a4')
await openView('table')
const labelled = await page.evaluate(() =>
  [...document.querySelectorAll('.sys-table td')].map((td) => ({ label: td.getAttribute('data-label'), before: getComputedStyle(td, '::before').content })),
)
const unlabelled = labelled.filter((c) => !c.label || c.before === 'none' || c.before === 'normal')
if (unlabelled.length) fail(`a4: ${unlabelled.length} table cells at 390 px carry no column name`)
const heading = await page.locator('.sys-table thead').evaluate((el) => getComputedStyle(el).display)
if (heading !== 'none') fail(`a4: the table still draws its header row at 390 px, as ${heading}`)
console.log('   the shell holds at 390 px, and the table names every cell it transposes')

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
