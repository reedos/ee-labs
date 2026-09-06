// End-to-end verification against the built app in a real browser.
//
// The unit tests call the analysis directly. This drives the actual interface:
// walks every experiment, opens every view, moves the featured knob, and checks
// that the readouts and the canvases both follow. It is the only thing here
// that can catch a wiring mistake, meaning a prop not passed, a pane fed stale
// state, or a plot that quietly stopped redrawing.
//
//   npx vite preview --outDir apps/random-lab/dist --port 4306 --strictPort &
//   cd apps/random-lab && APP_URL=http://localhost:4306 node scripts/verify.mjs
//
// Written in this program and not run in it, because this environment has no
// browser. It is the first thing to run in front of one.
//
// Exits non-zero on the first category of failure, and prints everything.

import { chromium } from 'playwright'

const URL = process.env.APP_URL || 'http://localhost:4306'
const failures = []
const notes = []
const fail = (m) => failures.push(m)
const note = (m) => notes.push(m)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })

const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(`${m.type()}: ${m.text()}`)
})

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.panes canvas, .panes table')
await page.waitForTimeout(400)

// ---------------------------------------------------------------- helpers

const settle = () => page.waitForTimeout(220)

/** A cheap fingerprint of each canvas, to prove it actually redrew. */
const canvasHashes = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.panes canvas')].map((c) => {
      const d = c.toDataURL()
      let h = 0
      for (let i = 0; i < d.length; i += 97) h = (h * 31 + d.charCodeAt(i)) | 0
      return `${h}:${d.length}`
    }),
  )

/** Every readout on screen, as label and value. */
const readouts = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.readout')].map((r) => ({
      kind: r.className.replace('readout ', ''),
      label: r.querySelector('.label')?.textContent ?? '',
      value: r.querySelector('.value')?.textContent ?? '',
      note: r.querySelector('.note')?.textContent ?? '',
    })),
  )

/** Unfold every group in the picker, the way a person would. */
async function unfoldPicker() {
  await page.evaluate(() => {
    document.querySelectorAll('.picker details').forEach((d) => {
      d.open = true
    })
  })
}

/** Open the experiment at sidebar position `i`, zero based. */
async function openExperiment(i) {
  await unfoldPicker()
  const buttons = page.locator('.picker button')
  await buttons.nth(i).click()
  await settle()
}

const experimentCount = async () => {
  await unfoldPicker()
  return page.locator('.picker button').count()
}

// ------------------------------------------------------- 1. every experiment

const total = await experimentCount()
if (total !== 30) fail(`the picker lists ${total} experiments, the plan has 30`)

for (let i = 0; i < total; i++) {
  await openExperiment(i)
  const id = await page.locator('.picker button.on .id').textContent()
  const name = await page.locator('.lesson h2').textContent()

  // A view that draws nothing is the failure a unit test cannot see.
  const canvases = await page.locator('.panes canvas').count()
  const tables = await page.locator('.panes table').count()
  if (canvases + tables === 0) fail(`${id}: no view rendered`)

  // Every experiment shows its lesson, its try line and its featured knob.
  if (!(await page.locator('.lesson .see').count())) fail(`${id}: no note`)
  if (!(await page.locator('.try-line').count())) fail(`${id}: no try line`)
  if (!(await page.locator('.featured').count())) fail(`${id} ${name}: no featured knob`)

  // The house rule of this lab, checked on the screen rather than in a test.
  // Every readout of class `estimate` prints an interval, and none reads
  // "no interval", which is what the component renders when it is handed a
  // bare number.
  for (const r of await readouts()) {
    if (r.kind.includes('estimate')) {
      if (r.value.includes('no interval')) fail(`${id}: "${r.label}" printed without an interval`)
      if (!r.value.includes('±')) fail(`${id}: "${r.label}" is an estimate with no ± on screen`)
      if (!/interval/.test(r.note)) fail(`${id}: "${r.label}" does not state its level`)
    }
    if (/NaN|Infinity|undefined/.test(r.value)) {
      fail(`${id}: "${r.label}" reads "${r.value}"`)
    }
  }

  // Every view the experiment offers must draw.
  const views = await page.locator('.view-switch button').count()
  for (let v = 0; v < views; v++) {
    const before = await canvasHashes()
    await page.locator('.view-switch button').nth(v).click()
    await settle()
    const after = await canvasHashes()
    if (after.length === 0 && !(await page.locator('.panes table').count())) {
      const label = await page.locator('.view-switch button').nth(v).textContent()
      fail(`${id}: view "${label}" drew nothing`)
    }
    if (before.length && after.length && before.join() === after.join() && views > 1) {
      note(`${id}: view ${v} looks identical to the previous one`)
    }
  }
}

// ------------------------------------------------- 2. the knobs change things

await openExperiment(0)
for (const step of [1, 2, 3]) {
  const before = await canvasHashes()
  const chip = page.locator('.try-chips .chip').nth(step - 1)
  if (!(await chip.count())) continue
  await chip.click()
  await settle()
  const after = await canvasHashes()
  if (before.join() === after.join()) fail(`A1: try chip ${step} changed nothing on screen`)
}

// The seed is the control this lab rests on. Moving it must move every pixel
// and no claim.
await openExperiment(1)
const seedBefore = await canvasHashes()
await page.evaluate(() => {
  const input = [...document.querySelectorAll('.controls input')].find((i) =>
    i.closest('label,div')?.textContent?.toLowerCase().includes('seed'),
  )
  if (input) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, '99')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.blur()
  }
})
await settle()
if ((await canvasHashes()).join() === seedBefore.join()) {
  fail('A2: changing the seed changed nothing on screen')
}

// ------------------------------------------------ 3. the ensemble view's props

// The Applied Analog Lab reads the band and the count. G3 is the experiment
// that draws both, so the corner must carry the pass count, the run count and
// the standard error rather than a bare percentage.
await unfoldPicker()
const g3 = page.locator('.picker button', { hasText: 'Monte Carlo' })
if (await g3.count()) {
  await g3.first().click()
  await settle()
  const found = (await readouts()).find((r) => r.label.toLowerCase().includes('yield'))
  if (!found) fail('G3: no yield readout')
  else if (!found.value.includes('±')) fail('G3: the yield is printed without its interval')
}

// --------------------------------------------------------------- 4. the fold

// The featured knob has to be on screen without scrolling at a laptop fold,
// which is what the cold walk measured for every other lab.
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  await page.setViewportSize(viewport)
  await openExperiment(0)
  const box = await page.locator('.featured').boundingBox()
  if (box && box.y + box.height > viewport.height) {
    fail(`the featured knob sits ${Math.round(box.y + box.height - viewport.height)} px below the fold at ${viewport.width}x${viewport.height}`)
  }
}

// ----------------------------------------------------------------- 5. phone

await page.setViewportSize({ width: 390, height: 844 })
await openExperiment(0)
await settle()
const sideways = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
)
if (sideways) fail('the page scrolls sideways at 390 px')

// The lesson comes first on a phone, as it does in every other lab.
const lessonTop = (await page.locator('.lesson').boundingBox())?.y ?? 0
const viewTop = (await page.locator('.panes').boundingBox())?.y ?? 0
if (lessonTop > viewTop) fail('the lesson is below the views at 390 px')

// ---------------------------------------------------------------- 6. report

for (const e of consoleErrors) fail(e)

console.log(`\nRandom Signals Lab: ${total} experiments walked at ${URL}`)
for (const n of notes) console.log(`  note  ${n}`)
if (failures.length) {
  console.log(`\n${failures.length} failures:`)
  for (const f of failures) console.log(`  FAIL  ${f}`)
} else {
  console.log('  clean')
}

await browser.close()
process.exit(failures.length ? 1 : 0)
