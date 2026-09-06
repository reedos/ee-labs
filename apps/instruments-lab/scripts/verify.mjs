// End-to-end verification for the Instruments Lab, in a real browser.
//
// The unit tests solve the circuits directly and measure every sentence against
// a solve. This drives the page instead: it loads all twenty-five experiments,
// opens every math panel and reads every check mark off the screen, switches
// every view each experiment offers, turns a knob and confirms the meters and
// the panes follow, and holds the whole page to 390 px with no horizontal
// scroll. It is the only thing that catches a prop not passed, a pane fed stale
// state, or a plot that stopped redrawing.
//
//   npm run build --workspace apps/instruments-lab
//   npx vite preview --outDir apps/instruments-lab/dist --port 4321 --strictPort &
//   cd apps/instruments-lab && APP_URL=http://localhost:4321 node scripts/verify.mjs
//
// Exit code 1 when anything is reported. Screenshots land in shots/, which is
// gitignored, and REVIEW_PLAYBOOK.md §11 is how they are read.

import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const URL = process.env.APP_URL || 'http://localhost:4321'
const SHOTS = process.env.SHOTS_DIR || 'shots'
const failures = []
const fail = (m) => failures.push(m)
mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })

const noise = []
page.on('pageerror', (e) => noise.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') noise.push(`${m.type()}: ${m.text()}`)
})

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.views .schematic')
await page.waitForTimeout(400)

const settle = () => page.waitForTimeout(180)
const scrollsX = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
// The shell clips the app at the viewport, so a pane wider than the screen
// never made the page scroll — its last buttons simply vanished. Name anything
// in a pane header that ends past the right edge.
const clipped = () =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth + 1
    return [...document.querySelectorAll('.view, .view-head, .view-head .segmented, .view-head .readout, .schematic, .topbar')]
      .filter((el) => el.getBoundingClientRect().right > w)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]} → ${Math.round(el.getBoundingClientRect().right)}px`)
  })

/** Open the Deeper fold and every math group inside it. */
async function openAllMath() {
  await page.evaluate(() => {
    const d = document.querySelector('[data-role=deeper]')
    if (d && !d.open) d.open = true
  })
  const toggles = page.locator('.math-toggle[aria-expanded="false"]')
  for (let g = 0; g < 8; g++) {
    if ((await toggles.count()) === 0) break
    await toggles.first().click()
    await page.waitForTimeout(60)
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
/** Every canvas on the page, and whether it has any ink in it. */
const canvasesPainted = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('canvas.plot')].map((c) => {
      const ctx = c.getContext('2d')
      const { width, height } = c
      if (!width || !height) return { cls: c.className, painted: false }
      const d = ctx.getImageData(0, 0, width, height).data
      let ink = 0
      for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 8) ink++
      return { cls: c.className, painted: ink > 20 }
    }),
  )

/** Open every folded group in the picker, the way a reader does. */
async function unfoldGroups() {
  const groups = page.locator('.picker-row[aria-expanded="false"]')
  for (let g = 0; g < 12; g++) {
    if ((await groups.count()) === 0) break
    await groups.first().click()
    await page.waitForTimeout(40)
  }
}

/** Choose an experiment by id through the picker. */
async function choose(id) {
  await page.locator('.picker-current').click()
  await settle()
  // Its group may be folded; open every group, then take the row.
  await unfoldGroups()
  await page.locator(`.preset:has(b:text-is("${id.toUpperCase()}"))`).first().click()
  await page.waitForSelector('.views .schematic')
  await settle()
}

// The picker holds every experiment, so the list comes from the page itself.
// Every click has to be awaited. The list and each group's rows are rendered
// after the click that opens them, so a synchronous click-and-read inside one
// evaluate() reads the picker before React has drawn a single row, and comes
// back with nothing.
await page.locator('.picker-current').click()
await settle()
await unfoldGroups()
const ids = (await page.locator('.preset b').allTextContents()).map((t) => t.trim().toLowerCase())
await page.locator('.picker-current').click()
await settle()
if (ids.length !== 25) fail(`the picker lists ${ids.length} experiments, expected 25`)

for (const id of ids) {
  await choose(id)
  const name = await page.locator('[data-role=instrument] em').textContent()

  // 1. The circuit solved, and its meters are numbers rather than blanks.
  const outcome = await page.locator('[data-role=outcome]').textContent()
  if (!/balances/.test(outcome)) fail(`${id}: ${outcome.trim()}`)
  const m = await meters()
  if (!m.length) fail(`${id}: the schematic shows no meters`)
  if (m.some((t) => !t || t === 'NaN' || /undefined/.test(t))) fail(`${id}: a meter reads "${m.find((t) => !t || /NaN|undefined/.test(t))}"`)
  // A schematic where every meter reads zero is a picture of a dead circuit.
  // Six experiments shipped that way: solveDC evaluates a sine at t = 0, and a
  // sine is zero there, so A3, A5, B2, D1, D2 and F4 all opened at 0 V.
  if (m.every((t) => /^-?0(\.0+)?\s/.test(t))) fail(`${id}: every meter on the schematic reads zero (${m[0]})`)

  // Every try step is readable where it is drawn. The step button is not a
  // block box by default, so it grew past its cell and the lesson card clipped
  // the sentence mid-word with no ellipsis to say that it had.
  const cut = await page.evaluate(() =>
    [...document.querySelectorAll('[data-role=try-step]')]
      .map((b, i) => ({ i, right: b.getBoundingClientRect().right, edge: b.closest('.lesson').getBoundingClientRect().right, over: b.scrollWidth > b.clientWidth + 1 }))
      .filter((r) => r.right > r.edge + 1 || r.over)
      .map((r) => `step ${r.i + 1} runs ${Math.round(r.right - r.edge)}px past the card`),
  )
  if (cut.length) fail(`${id}: a try step is cut off (${cut.join(', ')})`)

  // 2. Every check row in the math panel ticks, on screen and not only in a test.
  await openAllMath()
  const rows = await readChecks()
  if (!rows.length) fail(`${id}: the math panel has no check rows`)
  for (const r of rows) if (!/✓|✔/.test(r.mark)) fail(`${id}: check "${r.label}" is ${r.mark} (${r.theory} vs ${r.measured})`)

  // 3. Every view this experiment offers draws something.
  const views = await page.locator('.view-head .view-switch button').allTextContents()
  for (const label of views) {
    await page.locator('.view-head .view-switch button', { hasText: label }).first().click()
    await settle()
    const painted = await canvasesPainted()
    if (painted.some((c) => !c.painted)) fail(`${id}: the ${label} view has a canvas with nothing drawn in it`)
    const body = await page.locator('.view').nth(1).locator('.view-body').innerText()
    if (/No solution to plot/.test(body)) fail(`${id}: the ${label} view has nothing to show`)
    const over = await clipped()
    if (over.length) fail(`${id}: the ${label} view is clipped (${over.join(', ')})`)
  }

  // 4. A try step turns its knobs and the first screen answers.
  //
  // It used to compare the schematic's meters alone, which is a proxy and not
  // the claim. A4's first step moves the trimmer, and the calibrator's edge
  // changes while the settled meters do not; F1's steps change the display and
  // not the circuit at all. What a step promises is that a number the reader is
  // looking at moves, so the meters and the topbar's own readings are compared
  // together, and the failure names which of them was asked.
  const stepCount = await page.locator('[data-role=try-step]').count()
  if (stepCount < 2) fail(`${id}: ${stepCount} try steps, expected at least two`)
  const firstScreen = async () => [...(await meters()), '|', ...(await page.locator('[data-role=headline]').allTextContents())].join('|')
  const before = await firstScreen()
  await page.locator('[data-role=try-step]').first().click()
  await settle()
  if (before === (await firstScreen())) fail(`${id}: the first try step moved no meter and no headline reading`)
  if (!/balances/.test(await page.locator('[data-role=outcome]').textContent())) fail(`${id}: the first try step left the circuit unsolvable`)

  await page.screenshot({ path: `${SHOTS}/${id}-wide.png`, fullPage: true })
  if (name === null) fail(`${id}: the topbar does not name the experiment`)
}

// 5. A phone. One column, no horizontal scroll, on the first experiment and on
// one from each group that draws a wide schematic.
await page.setViewportSize({ width: 390, height: 844 })
for (const id of ['a1', 'a5', 'c5', 'd3', 'e1', 'f1']) {
  await choose(id)
  await settle()
  if (await scrollsX()) fail(`${id}: the page scrolls sideways at 390 px`)
  const over = await clipped()
  if (over.length) fail(`${id}: clipped at 390 px (${over.join(', ')})`)
  await page.screenshot({ path: `${SHOTS}/${id}-phone.png`, fullPage: true })
}

for (const n of noise) fail(n)

await browser.close()
if (failures.length) {
  console.error(`${failures.length} problem${failures.length === 1 ? '' : 's'}:`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`ok — ${ids.length} experiments, every check row ticked, every view drawn, ${SHOTS}/ written`)
