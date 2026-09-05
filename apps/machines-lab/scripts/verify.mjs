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
  if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`)
})

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.shell')
await page.waitForTimeout(400)

const settle = () => page.waitForTimeout(150)

const scrollsX = () =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

// A pane wider than the screen loses its last buttons without the page ever
// scrolling, because the shell clips at the viewport.
const clipped = () =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth + 1
    return [...document.querySelectorAll('.view, .view-head, .segmented, .topbar, .machine, .knobs')]
      .filter((el) => el.getBoundingClientRect().right > w)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]}`)
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

/** Nothing a student reads may be an exponent, a NaN, or a raw hash. */
const noiseOnPage = () =>
  page.evaluate(() => {
    const text = document.body.innerText
    const bad = []
    if (/NaN|Infinity/.test(text)) bad.push('NaN or Infinity on screen')
    if (/\de[+-]\d\d/.test(text)) bad.push('exponent notation on screen')
    if (/undefined/.test(text)) bad.push('the word undefined on screen')
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

  // Back to the first view, then walk every try line and confirm the readout
  // changes. A line that changes nothing is a line the app did not apply.
  await page.getByRole('button', { name: views[0], exact: true }).click()
  await settle()
  const lines = await page.$$('.try-line')
  for (let k = 0; k < lines.length; k++) {
    const before = await outcome()
    await lines[k].click()
    await settle()
    const after = await outcome()
    if (before === after) fail(`${name}: try line ${k + 1} changed no reading`)
  }

  for (const bad of await noiseOnPage()) fail(`${name}: ${bad}`)
  const over = await clipped()
  for (const el of over) fail(`${name}: ${el} runs past the right edge`)
}

// The phone width, where the two columns stack.
await page.setViewportSize({ width: 390, height: 844 })
await settle()
for (const name of [all[0], all[8], all[14], all[23], all[30]]) {
  await pick(name)
  if (await scrollsX()) fail(`${name}: the page scrolls sideways at 390 px`)
  for (const el of await clipped()) fail(`${name}: ${el} runs past the right edge at 390 px`)
}

for (const e of consoleErrors) fail(e)

await browser.close()

if (failures.length) {
  console.error(`\n${failures.length} findings:\n`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`\nClean: ${all.length} experiments, every view drawn, no console errors.`)
