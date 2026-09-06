// End-to-end verification for the Machines Lab, in a real browser.
//
// The unit tests solve every machine directly and check every note against a
// solve. This drives the page. It loads every experiment, presses every try
// line, switches every view, moves knobs, and confirms the meters and the
// panes follow. It is the only thing that can catch a prop not passed, a pane
// fed stale state, or a plot that stopped redrawing.
//
//   npm run build --workspace apps/machines-lab
//   npx vite preview --outDir apps/machines-lab/dist --port 4322 --strictPort &
//   cd apps/machines-lab && npm run verify
//
// It is written here and run when a browser is available. Every failure is
// collected rather than thrown, so one run reports everything.

import { chromium } from 'playwright'

const URL = process.env.APP_URL || 'http://localhost:4322'
const failures = []
const fail = (m) => failures.push(m)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })

const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  // The willReadFrequently hint is about this script's own getImageData probes,
  // not about anything the app does. Power Lab's harness drops it for the same
  // reason.
  if ((m.type() === 'error' || m.type() === 'warning') && !/willReadFrequently/.test(m.text()))
    consoleErrors.push(`${m.type()}: ${m.text()}`)
})

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.shell')
await page.waitForTimeout(400)

const settle = () => page.waitForTimeout(150)

const scrollsX = () =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

// A pane wider than the screen loses its last buttons without the page ever
// scrolling, because the shell clips at the viewport.
//
// The count comes back with the findings. Playbook §11: a selector that
// stopped matching reports no failures, which reads exactly like the layout
// being right, so the caller asserts the sweep saw something.
const clipped = () =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth + 1
    // `.machine-scroll` rather than `.machine`: the drawing inside it is
    // deliberately wider than a phone and reachable by scrolling that box.
    // What must never exceed the viewport is the box.
    const all = [...document.querySelectorAll('.view, .view-head, .segmented, .topbar, .machine-scroll, .knobs')]
    return {
      seen: all.length,
      over: all
        .filter((el) => el.getBoundingClientRect().right > w)
        .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]}`),
    }
  })

/** The experiment names in the picker, unfolding it the way a person would. */
async function names() {
  await page.evaluate(() => {
    const cur = document.querySelector('.picker-current')
    if (cur && cur.getAttribute('aria-expanded') !== 'true') cur.click()
  })
  await settle()
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details.preset-group')) if (!d.open) d.querySelector('summary').click()
  })
  await settle()
  return page.$$eval('.presets .preset', (els) => els.map((e) => e.textContent.trim()))
}

/** Choose an experiment by name, unfolding the picker first. */
async function pick(name) {
  await page.evaluate(() => {
    const cur = document.querySelector('.picker-current')
    if (cur && cur.getAttribute('aria-expanded') !== 'true') cur.click()
  })
  await settle()
  await page.evaluate((n) => {
    for (const d of document.querySelectorAll('details.preset-group')) {
      const has = [...d.querySelectorAll('.preset')].some((b) => b.textContent.trim() === n)
      if (has && !d.open) d.querySelector('summary').click()
    }
  }, name)
  await settle()
  await page.getByRole('button', { name, exact: true }).click()
  await settle()
}

const viewButtons = () => page.$$eval('.view-switch button', (els) => els.map((e) => e.textContent.trim()))
const readout = () => page.$$eval('table.readout tr', (rows) => rows.map((r) => r.textContent.trim()))
const outcome = () => page.locator('[data-role=outcome]').textContent()

/**
 * Everything the experiment SHOWS, as one string: the topbar reading, the
 * circuit with its meters, and the open pane, canvases included.
 *
 * The knobs are deliberately left out. A knob field redraws itself from the
 * value the click wrote, so including it would let a setting that never
 * reached the analysis look as though it had arrived.
 *
 * This replaces a probe that compared only the topbar's first meter. That
 * meter is one quantity out of nine, and it is the wrong one for most
 * lessons: A1 teaches the state matrix and the topbar reads the speed, so
 * every step of A1 was reported as changing nothing. Forty-two of the
 * forty-three findings in the first run were that mistake, and the one real
 * failure was indistinguishable from them.
 */
const shown = () =>
  page.evaluate(() => {
    const text = (sel) => (document.querySelector(sel) || {}).textContent || ''
    let canvas = ''
    for (const c of document.querySelectorAll('.view canvas')) {
      try {
        canvas += c.toDataURL()
      } catch {
        canvas += 'unreadable'
      }
    }
    return `${text('[data-role=outcome]')}|${text('.machine')}|${text('.view')}|${canvas}`
  })

/** Nothing a student reads may be an exponent, a NaN, or a raw hash. */
const noiseOnPage = () =>
  page.evaluate(() => {
    const text = document.body.innerText
    const bad = []
    if (/NaN|Infinity/.test(text)) bad.push('NaN or Infinity on screen')
    // One exponent digit is as unreadable as two. The old pattern demanded two,
    // so C6's "1.05e-8, 6.88e-9 %" sat on screen through every green run.
    const exp = text.match(/\de[+-]\d+/)
    if (exp) bad.push(`exponent notation on screen, "${exp[0]}"`)
    if (/undefined/.test(text)) bad.push('the word undefined on screen')
    // A speed is read off a nameplate as 1500 rev/min, never as 1.5 krev/min,
    // and a ratio printed as "887.3 m" has lost both its meaning and its unit.
    const speed = text.match(/[\d.]+\s[kMG]rev\/min/)
    if (speed) bad.push(`a speed carries an SI prefix, "${speed[0]}"`)
    return bad
  })

/** A canvas that drew nothing is a blank rectangle. */
const canvasIsBlank = (selector) =>
  page.evaluate((sel) => {
    const c = document.querySelector(sel)
    if (!c) return 'missing'
    const ctx = c.getContext('2d')
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    for (let k = 3; k < d.length; k += 4) if (d[k] !== 0) return false
    return true
  }, selector)

const all = await names()
if (all.length !== 35) fail(`the picker lists ${all.length} experiments, expected 35`)

for (const name of all) {
  await pick(name)

  const out = (await outcome()) || ''
  if (!out.trim()) fail(`${name}: the topbar outcome is empty`)

  const views = await viewButtons()
  if (!views.length) fail(`${name}: no views offered`)

  for (const v of views) {
    await page.getByRole('button', { name: v, exact: true }).click()
    await settle()
    const canvas = await page.$('.view canvas')
    if (canvas) {
      const blank = await canvasIsBlank('.view canvas')
      if (blank === true) fail(`${name} / ${v}: the canvas drew nothing`)
      if (blank === 'missing') fail(`${name} / ${v}: the canvas is missing`)
    } else {
      const rows = await page.$$('.pane tr')
      if (!rows.length) fail(`${name} / ${v}: neither a canvas nor a table`)
    }
  }

  // Back to the experiment's own opening view, then walk every try line and
  // confirm what the reader sees changes. A line that changes nothing on
  // screen is a line the app did not apply, or one whose result the open
  // view has no way to show.
  await page.getByRole('button', { name: views[0], exact: true }).click()
  await settle()
  const lines = await page.$$('.try-line')
  // Playbook §11: a count of zero is a result to check. Every experiment in
  // this lab carries try lines, so none is a lesson that lost its steps.
  if (!lines.length) fail(`${name}: no try lines to press`)
  const atRest = await shown()
  for (let k = 0; k < lines.length; k++) {
    await lines[k].click()
    await settle()
    if ((await shown()) === atRest) fail(`${name}: try line ${k + 1} changed nothing the reader can see`)
  }

  for (const bad of await noiseOnPage()) fail(`${name}: ${bad}`)
  const wide = await clipped()
  if (wide.seen < 4) fail(`${name}: the clipping sweep found only ${wide.seen} panes to measure`)
  for (const el of wide.over) fail(`${name}: ${el} runs past the right edge`)
}

// The phone width, where the two columns stack.
await page.setViewportSize({ width: 390, height: 844 })
await settle()
for (const name of [all[0], all[8], all[14], all[23], all[30]]) {
  await pick(name)
  if (await scrollsX()) fail(`${name}: the page scrolls sideways at 390 px`)
  const narrow = await clipped()
  if (narrow.seen < 4) fail(`${name}: the clipping sweep found only ${narrow.seen} panes to measure at 390 px`)
  for (const el of narrow.over) fail(`${name}: ${el} runs past the right edge at 390 px`)

  // The 390 px rule: the note and the first knob are on the first screen, so
  // a reader knows what the experiment is and has something to turn without
  // scrolling for it.
  const firstKnob = await page.evaluate(() => {
    const k = document.querySelector('.knobs')
    return k ? k.getBoundingClientRect().top : null
  })
  if (firstKnob === null) fail(`${name}: no knobs at 390 px`)
  else if (firstKnob > 844) fail(`${name}: the first knob sits ${Math.round(firstKnob)} px down, past the first screen`)
}

for (const e of consoleErrors) fail(e)

await browser.close()

if (failures.length) {
  console.error(`\n${failures.length} findings:\n`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`\nClean: ${all.length} experiments, every view drawn, no console errors.`)
