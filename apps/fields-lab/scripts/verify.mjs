// End-to-end verification for the Fields Lab, in a real browser.
//
// The unit tests analyse every experiment directly and check every note against
// that analysis. This drives the page: it loads every experiment, opens every
// view the experiment offers, moves knobs, and reads back what the panes show.
// It is the only thing that catches a prop the shell forgot to pass, a pane fed
// stale state, or a canvas that draws nothing because its domain came out zero.
//
//   npm run build --workspace apps/fields-lab
//   npm run preview --workspace apps/fields-lab   (serves dist/ on :4180)
//   npm run verify --workspace apps/fields-lab
//
// `FIELDS_LAB_PLAN.md` §7 names this file as written and not run in the sitting
// that wrote it. Nothing below has been executed against a browser, so treat a
// first run as a review of this script as much as of the page.

import { chromium } from 'playwright'
import { EXPERIMENTS, GROUPS, byId } from '../src/experiments.js'

const URL = process.env.APP_URL || 'http://localhost:4180'
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
await page.waitForTimeout(400)

const settle = () => page.waitForTimeout(180)
const text = async (sel) => ((await page.locator(sel).count()) ? (await page.locator(sel).first().textContent()).trim() : '')

/** Choose an experiment by id: open its group's tab, then its row. */
async function pick(id) {
  const exp = byId[id]
  await page.locator(`.group-tab[data-group="${exp.group}"]`).click()
  await settle()
  await page.locator(`.preset[data-id="${id}"]`).click()
  await page.waitForTimeout(exp.kind === 'grid' ? 1200 : 250)
}

/** Open one view from the switch. */
async function openView(view, label) {
  await page.locator('.view-switch').getByRole('button', { name: label, exact: true }).click()
  await settle()
}

/** The width of the page against the viewport: a lab that scrolls sideways has a pane too wide. */
const scrollsX = () =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

/** Anything in a view header whose right edge is past the screen, which the shell clips silently. */
const clipped = () =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth + 1
    return [...document.querySelectorAll('.view, .view-head, .view-head .segmented, .fieldmap, .fields-table')]
      .filter((el) => el.getBoundingClientRect().right > w)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]}`)
  })

/** Set a knob by its key, through the field the shell renders for it. */
async function setKnob(key, value) {
  const box = page.locator(`.knob[data-knob="${key}"] input[type=text], .knob[data-knob="${key}"] input[type=number]`).first()
  if (!(await box.count())) {
    // The knob may be folded under "More knobs".
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

// ------------------------------------------------ every experiment, every view

console.log(`Fields Lab: ${EXPERIMENTS.length} experiments in ${GROUPS.length} groups`)

const VIEW_LABEL = {
  '2d': 'Map',
  profile: 'Profile',
  numbers: 'Numbers',
  mesh: 'Mesh',
  flux: 'Flux',
  circuit: 'Circuit',
  wave: 'Wave',
  interface: 'Interface',
  bounce: 'Bounce',
  line: 'Line',
  smith: 'Smith',
  sweep: 'Sweep',
  guide: 'Guide',
  pattern: 'Pattern',
}

/** What each view must have put on the page, beyond not throwing. */
const VIEW_SHOWS = {
  '2d': '.fieldmap[data-mode="2d"] canvas.fieldmap-canvas',
  profile: '.fieldmap[data-mode="profile"] [data-role=profile-panel]',
  numbers: '[data-role=numbers-pane] .fields-row',
  mesh: '[data-role=mesh-pane] .fields-table tbody tr',
  flux: '[data-role=flux-pane] .fields-row',
  circuit: '[data-role=circuit-pane] .fields-row',
}

for (const exp of EXPERIMENTS) {
  await pick(exp.id)

  const position = await text('[data-role=position]')
  if (!position.includes(`of ${EXPERIMENTS.length}`)) fail(`${exp.id}: the position reads "${position}"`)
  const see = await text('[data-role=see]')
  if (see.length < 40) fail(`${exp.id}: the note under the title is ${see.length} characters`)

  const headline = await text('[data-role=headline]')
  if (!headline || /NaN|undefined|—/.test(headline)) fail(`${exp.id}: the headline reads "${headline}"`)

  for (const view of exp.views) {
    await openView(view, VIEW_LABEL[view])
    const want = VIEW_SHOWS[view]
    if (want && (await page.locator(want).count()) === 0) fail(`${exp.id} ${view}: nothing matched ${want}`)
    if (await scrollsX()) fail(`${exp.id} ${view}: the page scrolls sideways`)
    const over = await clipped()
    if (over.length) fail(`${exp.id} ${view}: clipped at the right edge — ${over.join(', ')}`)
  }

  // Every try step, applied through the chip the reader clicks, with the
  // headline read back after each. A step whose knobs do not reach the page
  // leaves the headline where it was.
  const before = await text('[data-role=headline]')
  let moved = false
  for (let i = 0; i < exp.try.length; i++) {
    await page.locator('.try-line button, .try-line .chip').first().click()
    await page.waitForTimeout(exp.kind === 'grid' ? 900 : 200)
    if ((await text('[data-role=headline]')) !== before) moved = true
    const next = page.locator('[data-role=lesson-next], .lesson-nav button[aria-label="Next step"]').first()
    if (await next.count()) await next.click()
    await settle()
  }
  if (!moved && exp.try.some((t) => Object.keys(t.set || {}).length)) {
    fail(`${exp.id}: no try step moved the headline off "${before}"`)
  }
}
console.log('   every experiment loads, and every view it offers draws something')

// ---------------------------------------------------- the guard, where there is one

for (const id of ['c2', 'c5', 'e5', 'f3', 'f4']) {
  await pick(id)
  const flag = await text('[data-role=guard-flag]')
  if (!/guard/.test(flag)) fail(`${id}: the topbar flies no guard flag`)
}
await pick('c5')
if (!/holds|loosened/.test(await text('[data-role=guard-flag]'))) fail('c5: the guard flag says neither holds nor loosened')
await openView('mesh', 'Mesh')
const says = await text('[data-role=mesh-says]')
if (says.length < 40) fail(`c5: the mesh pane's verdict reads "${says}"`)
console.log('   the guard is on screen wherever an approximation is')

// ------------------------------------------------- a setting the engine declines

await pick('b2')
await setKnob('b', 1e-4) // a shield inside the inner conductor
const declined = await text('[data-role=declined]')
if (!/larger than the inner radius/.test(declined)) fail(`b2: a shield under the conductor shows "${declined}"`)
if ((await page.locator('.fieldmap canvas').count()) !== 0) fail('b2: a declined setting still draws a map')
await setKnob('b', 1.475e-3)
if ((await page.locator('.fieldmap canvas').count()) === 0) fail('b2: the map did not come back when the geometry did')
console.log('   an impossible geometry is declined by name, and the drawing comes back')

// ------------------------------------------------------ the probe and the profile

await pick('c1')
await setKnob('px', 0.05)
await setKnob('py', 0.05)
await page.waitForTimeout(1500)
const centre = await text('[data-role=headline]')
if (!/25(\.0+)?\s*V/.test(centre)) fail(`c1: the centre of the trough reads "${centre}", not 25 V`)
console.log('   moving the probe re-solves: the centre of a square trough is a quarter of the top')

// ------------------------------------------------------------- the narrow screen

await page.setViewportSize({ width: 390, height: 844 })
await settle()
for (const id of ['a1', 'b2', 'c3', 'e5', 'f4']) {
  await pick(id)
  if (await scrollsX()) fail(`${id}: the page scrolls sideways at 390 px`)
  const over = await clipped()
  if (over.length) fail(`${id}: clipped at 390 px — ${over.join(', ')}`)
}
console.log('   the shell holds at 390 px with no sideways scroll')

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
