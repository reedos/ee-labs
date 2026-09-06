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
// It has now been run. The first run, against the built app, found the app
// rendering an empty page: every count printed at zero significant figures and
// `toPrecision(0)` threw inside React's commit phase. Nothing in the unit
// suite could see it.
//
// REVIEW_PLAYBOOK section 11: a probe that finds no instances of a thing
// reports no failures, which reads exactly like the thing being correct. Every
// loop below counts what it walked and fails on a zero, and every measurement
// is taken from the element a reader actually scrolls.
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

/**
 * Everything the main pane shows, canvases and text together.
 *
 * The canvas fingerprint alone is a proxy for "the screen changed". Six
 * experiments answer a knob in their readouts rather than in their plot, and
 * one of them draws a table and no canvas at all, so a check written against
 * the canvases reported those as controls that did nothing.
 */
const paneFingerprint = async () => {
  const hashes = await canvasHashes()
  const text = await page.evaluate(
    () => document.querySelector('.panes')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
  )
  return `${hashes.join()}|${text}`
}

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

// Counts, so that a loop finding nothing reads as a failure rather than as a
// pass. Section 11 of the playbook is about exactly this.
let readoutsSeen = 0
let estimatesSeen = 0
let viewsSeen = 0
let chipsPressed = 0

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
  const rows = await readouts()
  if (rows.length === 0) fail(`${id}: the pane printed no readouts at all`)
  readoutsSeen += rows.length
  for (const r of rows) {
    if (r.kind.includes('estimate')) {
      estimatesSeen += 1
      if (r.value.includes('no interval')) fail(`${id}: "${r.label}" printed without an interval`)
      if (!r.value.includes('±')) fail(`${id}: "${r.label}" is an estimate with no ± on screen`)
      if (!/interval/.test(r.note)) fail(`${id}: "${r.label}" does not state its level`)
    }
    if (/NaN|Infinity|undefined/.test(r.value)) {
      fail(`${id}: "${r.label}" reads "${r.value}"`)
    }
    // A decibel is a logarithm and a percentage is a ratio, so neither takes an
    // engineering prefix. "911.2 mdB" and "510 m%" both shipped.
    if (/\s[munpfkMG](dB|%)\b/.test(r.value)) {
      fail(`${id}: "${r.label}" reads "${r.value}", which prefixes a unit that takes none`)
    }
  }

  // Every view the experiment offers must draw, and must draw something the
  // previous view did not. The comparison is against the view drawn before it,
  // not against the state before the click: view 0 is already on screen when an
  // experiment loads, so clicking it never changes a pixel and the old check
  // reported that as a note against every experiment.
  const views = await page.locator('.view-switch button').count()
  if (views === 0) fail(`${id}: no view switch`)
  viewsSeen += views
  let previous = null
  for (let v = 0; v < views; v++) {
    await page.locator('.view-switch button').nth(v).click()
    await settle()
    const after = await canvasHashes()
    const label = await page.locator('.view-switch button').nth(v).textContent()
    if (after.length === 0 && !(await page.locator('.panes table').count())) {
      fail(`${id}: view "${label}" drew nothing`)
    }
    if (previous && after.length && previous === after.join()) {
      note(`${id}: view "${label}" draws what the view before it drew`)
    }
    previous = after.join()
  }

  // Every chip must apply something. A chip that changes no pixel is a control
  // that reads as broken, and twenty-one steps carried one before the app
  // stopped offering a chip for a step that only asks the reader to look.
  //
  // Each chip is pressed from the experiment's own starting point rather than
  // on top of the chip before it. Pressed in sequence, D4's third step sets
  // what its second step already set, and the check would have called a working
  // control broken.
  // A chip that returns the reader to the value the experiment opened on is a
  // legitimate second half of a pair ("set the seed to 2", "set it back to 1"),
  // and it moves nothing when pressed first. That is a note. A lesson whose
  // chips ALL move nothing is the defect, and it is the shape section 11 warns
  // about: a count of zero that reads like a pass.
  const chips = await page.locator('.try-chips .chip').count()
  let chipsThatMoved = 0
  for (let c = 0; c < chips; c++) {
    await openExperiment(i)
    const label = await page.locator('.try-chips .chip').nth(c).textContent()
    const before = await paneFingerprint()
    await page.locator('.try-chips .chip').nth(c).click()
    await settle()
    chipsPressed += 1
    const after = await paneFingerprint()
    if (before === after) note(`${id}: try chip ${label} sets what the experiment already opened on`)
    else chipsThatMoved += 1
  }
  if (chips > 0 && chipsThatMoved === 0) {
    fail(`${id}: none of its ${chips} try chips changed anything on screen`)
  }
}

// The zeroes. Each of these loops would have reported nothing wrong had its
// selector stopped matching, which is the way a probe lies.
if (readoutsSeen === 0) fail('no readouts were measured at all')
if (estimatesSeen === 0) fail('no estimate readout was measured, so the interval rule went unchecked')
if (viewsSeen < total) fail(`${viewsSeen} view buttons across ${total} experiments`)
if (chipsPressed === 0) fail('no try chip was pressed, so the one-click rule went unchecked')

// ------------------------------------------------- 2. the knobs change things

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
// Not `if (await g3.count())`. A renamed experiment would have made this whole
// section vanish, silently, and the section exists because another lab depends
// on what it measures.
if (!(await g3.count())) fail('G3: the Monte Carlo experiment is not in the picker')
else {
  await g3.first().click()
  await settle()
  const found = (await readouts()).find((r) => r.label.toLowerCase().includes('yield'))
  if (!found) fail('G3: no yield readout')
  else if (!found.value.includes('±')) fail('G3: the yield is printed without its interval')
}

// --------------------------------------------------------------- 4. the fold

// The featured knob has to be on screen without scrolling at a laptop fold,
// which is what the cold walk measured for every other lab. Every experiment,
// not the first one: the note above the knob is a different length in each.
let foldsMeasured = 0
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  await page.setViewportSize(viewport)
  for (let i = 0; i < total; i++) {
    await openExperiment(i)
    const id = await page.locator('.picker button.on .id').textContent()
    const box = await page.locator('.featured').boundingBox()
    if (!box) {
      fail(`${id}: no featured knob at ${viewport.width}x${viewport.height}`)
      continue
    }
    foldsMeasured += 1
    if (box.y + box.height > viewport.height) {
      fail(
        `${id}: the featured knob sits ${Math.round(box.y + box.height - viewport.height)} px ` +
          `below the fold at ${viewport.width}x${viewport.height}`,
      )
    }
  }
}
if (foldsMeasured < total * 2) fail(`the fold was measured ${foldsMeasured} times, wanted ${total * 2}`)

// ----------------------------------------------------------------- 5. phone

await page.setViewportSize({ width: 390, height: 844 })
await openExperiment(0)
await settle()

// The shell gives html, body and #root `height: 100%` and hands the scrolling
// to #root below 900 px, so `document.documentElement` reports the viewport and
// never overflows. Measuring it was a probe that could not fail: three pixels
// of sideways scroll inside #root read as clean. Measure whichever element is
// actually the scroller.
const overflow = await page.evaluate(() => {
  const el = [document.getElementById('root'), document.documentElement].find(
    (e) => e && e.scrollHeight > e.clientHeight + 1,
  )
  const scroller = el || document.documentElement
  return {
    who: scroller.id || scroller.tagName.toLowerCase(),
    sideways: scroller.scrollWidth - scroller.clientWidth,
    scrolls: scroller.scrollHeight - scroller.clientHeight,
  }
})
if (overflow.sideways > 1) {
  fail(`the page scrolls ${overflow.sideways} px sideways at 390 px, on ${overflow.who}`)
}
// A page that does not scroll at all at 390 px is not a short page. It is a
// page whose foot cannot be reached, which is how the picker became
// unreachable.
if (overflow.scrolls <= 0) fail(`nothing scrolls at 390 px, so the foot of the page cannot be reached`)

// The lesson comes first on a phone, as it does in every other lab.
const lessonTop = (await page.locator('.lesson').boundingBox())?.y ?? 0
const viewTop = (await page.locator('.panes').boundingBox())?.y ?? 0
if (lessonTop > viewTop) fail('the lesson is below the views at 390 px')

// And the note and the first knob are both on the first screen, which is the
// rule every lab's cold walk measured.
const seeBox = await page.locator('.lesson .see').boundingBox()
const knobBox = await page.locator('.featured').boundingBox()
if (!seeBox || !knobBox) fail('the note or the featured knob is missing at 390 px')
else if (knobBox.y + knobBox.height > 844) {
  fail(`the featured knob sits ${Math.round(knobBox.y + knobBox.height - 844)} px below the first screen at 390 px`)
}

// ---------------------------------------------------------------- 6. report

for (const e of consoleErrors) fail(e)

console.log(`\nRandom Signals Lab: ${total} experiments walked at ${URL}`)
console.log(
  `  counted  ${readoutsSeen} readouts, ${estimatesSeen} of them estimates · ` +
    `${viewsSeen} views · ${chipsPressed} chips pressed · ${foldsMeasured} folds measured`,
)
for (const n of notes) console.log(`  note  ${n}`)
if (failures.length) {
  console.log(`\n${failures.length} failures:`)
  for (const f of failures) console.log(`  FAIL  ${f}`)
} else {
  console.log('  clean')
}

await browser.close()
process.exit(failures.length ? 1 : 0)
