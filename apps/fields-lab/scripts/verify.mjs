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

/**
 * Anything on screen whose right edge is past the screen, which the shell clips
 * silently.
 *
 * The topbar is in this list because it was not, and the headline's label ran
 * off the phone's right edge for every experiment in the lab: a reader saw
 * "Force between the" and no scrollbar to tell them there was more.
 */
const clipped = () =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth + 1
    return [...document.querySelectorAll('.view, .view-head, .view-head .segmented, .fieldmap, .fields-table, .topbar, .flow, .flow-node, .fieldmap-ticks, .fields-row')]
      .filter((el) => el.getBoundingClientRect().right > w)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]}`)
  })

/** What a plot put on the page for a reader to read a number off it. */
const plotChrome = () =>
  page.evaluate(() => {
    const map = document.querySelector('.fieldmap[data-mode="2d"]')
    const profile = document.querySelector('.fieldmap[data-mode="profile"]')
    if (map) {
      return {
        kind: '2d',
        colourScale: Boolean(map.querySelector('[data-role=colour-scale]')),
        arrows: /direction only/.test(map.textContent || ''),
        axesNamed: Boolean(map.querySelector('[data-role=map-axes]')),
      }
    }
    if (profile) {
      const panels = [...profile.querySelectorAll('[data-role=profile-panel]')]
      return {
        kind: 'profile',
        panels: panels.length,
        valueTicks: panels.map((el) => el.querySelectorAll('[data-role=value-axis-left] .fieldmap-vtick').length),
        rightAxes: panels.map((el) => (el.querySelector('[data-role=value-axis-right]') ? 1 : 0)),
        secondCurves: panels.map((el) => (el.querySelector('[data-role=panel-scales]') ? 1 : 0)),
        axisNamed: Boolean(profile.querySelector('[data-role=axis-name]')),
        axisName: (profile.querySelector('[data-role=axis-name]') || {}).textContent || '',
        labelledTicks: profile.querySelectorAll('[data-labelled="true"] .fieldmap-tick').length,
      }
    }
    return null
  })

/** The engineering prefixes a knob's unit label can carry. */
const PREFIX_MULT = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, '': 1, m: 1e-3, 'µ': 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 }

/**
 * Set a knob by its key, typing what a reader types.
 *
 * A knob in engineering mode shows a mantissa beside a prefixed unit, and a
 * bare number typed into it is read in the prefix on display: a field showing
 * "25" beside "mm" reads a typed "0.05" as 0.05 mm, not 0.05 m. So this reads
 * the prefix off the screen and types the mantissa that belongs to it. Typing
 * the SI value instead measured the wrong thing entirely, which is how the
 * first run of this script put the probe a twentieth of a millimetre from the
 * corner and then blamed the solver.
 */
async function setKnob(key, value) {
  const knob = page.locator(`.knob[data-knob="${key}"]`)
  if (!(await knob.count())) {
    // The knob may be folded under "More knobs".
    await page.evaluate(() => {
      const d = document.querySelector('details.more-knobs')
      if (d && !d.open) d.open = true
    })
    await settle()
  }
  if (!(await knob.count())) throw new Error(`no knob ${key} on the page`)
  const spec = byId[await page.evaluate(() => document.querySelector('.preset.is-on')?.dataset.id)]
  const unit = (spec?.params.find((k) => k.key === key) || {}).unit ?? ''
  const shown = (await knob.locator('.num-unit').count()) ? (await knob.locator('.num-unit').first().textContent()).trim() : ''
  const prefix = unit && shown.endsWith(unit) ? shown.slice(0, shown.length - unit.length) : shown
  const mult = PREFIX_MULT[prefix]
  if (mult === undefined) fail(`${key}: the unit beside it reads "${shown}", which carries no prefix this script knows`)
  const typed = Number((value / (mult ?? 1)).toPrecision(12))
  const field = knob.locator('input.num-input').first()
  await field.fill(String(typed))
  await field.press('Enter')
  await settle()
  const now = await field.inputValue()
  if (now.trim() === '') fail(`${key}: the field is empty after typing ${typed}`)
}

/** What a knob's field is showing, read back through its own unit label, in SI. */
async function knobValue(exp, key) {
  const knob = page.locator(`.knob[data-knob="${key}"]`)
  if (!(await knob.count())) return null
  const input = knob.locator('input.num-input').first()
  if (!(await input.count())) return null
  const unit = (exp.params.find((k) => k.key === key) || {}).unit ?? ''
  const shown = (await knob.locator('.num-unit').count()) ? (await knob.locator('.num-unit').first().textContent()).trim() : ''
  const prefix = unit && shown.endsWith(unit) ? shown.slice(0, shown.length - unit.length) : shown
  const mult = PREFIX_MULT[prefix]
  if (mult === undefined) return null
  const shownNumber = Number(await input.inputValue())
  return Number.isFinite(shownNumber) ? shownNumber * mult : null
}

/**
 * Whether a try step's settings reached the knobs.
 *
 * The first version of this asked whether the headline moved, which is a proxy
 * and a bad one: C4's whole lesson is that moving the Gauss contour changes the
 * charge not at all, so the honest step failed and a step whose knobs never
 * arrived would pass wherever a number happened to differ. This reads the knobs
 * the step names back off the page instead.
 */
async function stepReached(exp, i) {
  const set = (exp.try[i] || {}).set || {}
  for (const [key, want] of Object.entries(set)) {
    const knob = exp.params.find((k) => k.key === key)
    if (!knob) {
      fail(`${exp.id} step ${i + 1}: sets ${key}, which is not one of its knobs`)
      continue
    }
    if (knob.kind) continue // a toggle or a choice is not a typed field
    // A folded knob is still a knob, so unfold the way a reader would.
    if (!(await page.locator(`.knob[data-knob="${key}"] input.num-input`).count())) {
      await page.evaluate(() => {
        const d = document.querySelector('details.more-knobs')
        if (d && !d.open) d.open = true
      })
      await settle()
    }
    const got = await knobValue(exp, key)
    if (got == null) {
      fail(`${exp.id} step ${i + 1}: the ${key} knob reads nothing back`)
      continue
    }
    const rel = Math.abs(got - want) / Math.max(1e-30, Math.abs(want))
    if (rel > 1e-3) fail(`${exp.id} step ${i + 1}: ${key} should read ${want} and reads ${got}`)
  }
}

// ------------------------------------------------ every experiment, every view

console.log(`Fields Lab: ${EXPERIMENTS.length} experiments in ${GROUPS.length} groups`)
let plotsSeen = 0
let mapsWithColour = 0
let mapsWithArrows = 0

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
  wave: '[data-role=wave-pane] .fields-row, [data-role=polarisation-pane] .fields-row',
  interface: '[data-role=interface-pane] .fields-row, [data-role=oblique-pane] .fields-row',
}

// A view with no entry above is measured for nothing but not throwing, so name
// them out loud rather than letting the gap read as a pass.
{
  const offered = [...new Set(EXPERIMENTS.flatMap((e) => e.views))]
  const unchecked = offered.filter((v) => !VIEW_SHOWS[v])
  console.log(`   views offered: ${offered.join(', ')}`)
  if (unchecked.length) console.log(`   views with no content check: ${unchecked.join(', ')}`)
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

    // A picture a reader cannot read a number off is a decoration. Both modes
    // shipped without one: the map with no position axis and no colour scale,
    // the profile with no numbers up its value axis at all.
    const chrome = await plotChrome()
    if (chrome && chrome.kind === '2d') {
      plotsSeen += 1
      if (!chrome.axesNamed) fail(`${exp.id} ${view}: the map does not name its axes`)
      // A map is a colour field, a field of arrows, or both. Whichever it is,
      // the reader is told what the drawing means: E1 and E2 are arrows alone,
      // because a Biot-Savart sum at every pixel of a colour field would take
      // minutes.
      if (!chrome.colourScale && !chrome.arrows) fail(`${exp.id} ${view}: the map says nothing about what it drew`)
      if (chrome.colourScale) mapsWithColour += 1
      if (chrome.arrows) mapsWithArrows += 1
    }
    if (chrome && chrome.kind === 'profile') {
      plotsSeen += 1
      if (!chrome.axisNamed) fail(`${exp.id} ${view}: the profile's position axis has no name`)
      if (/\bm\)/.test(chrome.axisName) && /Frequency/.test(chrome.axisName)) {
        fail(`${exp.id} ${view}: a frequency axis measured in metres — "${chrome.axisName.trim()}"`)
      }
      if (!chrome.labelledTicks) fail(`${exp.id} ${view}: the position axis carries no labelled tick`)
      chrome.valueTicks.forEach((n, i) => {
        if (n < 2) fail(`${exp.id} ${view}: panel ${i + 1} has ${n} numbers up its value axis`)
      })
      chrome.secondCurves.forEach((second, i) => {
        if (second && !chrome.rightAxes[i]) fail(`${exp.id} ${view}: panel ${i + 1} draws two curves on one axis`)
      })
    }
  }

  // Every try step, walked the way a reader walks it: the chip applies the step
  // on screen, and "next" moves to the one after it and applies that. The last
  // step has nothing after it, so its next button is disabled by design and the
  // walk asks about that instead of waiting on it.
  const nextStep = () => page.locator('.lesson-nav button[aria-label="Next step"]').first()
  const stepWait = () => page.waitForTimeout(exp.kind === 'grid' ? 900 : 200)
  let walked = 0
  await page.locator('.try-line .chip').first().click()
  await stepWait()
  walked += 1
  await stepReached(exp, 0)
  for (let i = 1; i < exp.try.length; i++) {
    if (!(await nextStep().count())) {
      fail(`${exp.id}: no next-step button at step ${i + 1} of ${exp.try.length}`)
      break
    }
    if (await nextStep().isDisabled()) {
      fail(`${exp.id}: the next-step button is dead at step ${i} of ${exp.try.length}`)
      break
    }
    await nextStep().click()
    await stepWait()
    walked += 1
    const count = await text('.lesson-nav-count')
    if (count && count !== `${i + 1} of ${exp.try.length}`) {
      fail(`${exp.id}: after ${i} presses of next the counter reads "${count}"`)
    }
    await stepReached(exp, i)
  }
  if (walked !== exp.try.length) fail(`${exp.id}: ${walked} of ${exp.try.length} try steps were reachable`)
  if ((await nextStep().count()) && !(await nextStep().isDisabled())) {
    fail(`${exp.id}: the next-step button is still live at the last of ${exp.try.length} steps`)
  }
}
console.log('   every experiment loads, and every view it offers draws something')
// A count of zero is a result to check, not a pass.
if (!plotsSeen) fail('no map or profile was measured for its axes at all')
console.log(`   ${plotsSeen} plot views carry an axis a reader can read a number off`)
if (!mapsWithColour) fail('no map drew a colour field at all, so the colour-scale check measured nothing')
if (!mapsWithArrows) fail('no map drew arrows at all, so the arrows check measured nothing')
console.log(`   ${mapsWithColour} maps carry a colour scale, ${mapsWithArrows} say their arrows are direction only`)

// ---------------------------------------------------- the guard, where there is one

for (const id of ['c2', 'c5', 'd4', 'e5', 'f3', 'f4']) {
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

// The phone is one page. The lesson's note and the view switch both land in the
// first screen, and nothing inside the page is a box scrolling a taller column:
// the shell's 45vh sidebar held this lab's note, its try line and every knob
// below the fold, and a reader who never scrolled that box saw none of them.
const phoneFirstScreen = () =>
  page.evaluate(() => {
    const h = window.innerHeight
    const top = (sel) => {
      const el = document.querySelector(sel)
      return el ? el.getBoundingClientRect().top : Infinity
    }
    const innerScrollers = [...document.querySelectorAll('#root *')]
      .filter((el) => {
        const cs = getComputedStyle(el)
        return /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1 && el.scrollHeight > h
      })
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ${el.clientHeight}px showing ${el.scrollHeight}px`)
    return { note: top('[data-role=see]'), tryLine: top('.try-line'), views: top('.view-switch'), innerScrollers }
  })

for (const id of ['a1', 'b2', 'c3', 'd4', 'e5', 'f4', 'g2', 'h1']) {
  await pick(id)
  await page.evaluate(() => window.scrollTo(0, 0))
  await settle()
  if (await scrollsX()) fail(`${id}: the page scrolls sideways at 390 px`)
  const over = await clipped()
  if (over.length) fail(`${id}: clipped at 390 px — ${over.join(', ')}`)
  const first = await phoneFirstScreen()
  if (!(first.note < 844)) fail(`${id}: at 390 px the note starts at ${Math.round(first.note)} px, below the first screen`)
  if (!(first.tryLine < 844)) fail(`${id}: at 390 px the try line starts at ${Math.round(first.tryLine)} px, below the first screen`)
  if (!(first.views < 844)) fail(`${id}: at 390 px the view switch starts at ${Math.round(first.views)} px, below the first screen`)
  if (first.innerScrollers.length) fail(`${id}: at 390 px something scrolls inside the page — ${first.innerScrollers.join(', ')}`)
}
console.log('   at 390 px the note, the try line and the view switch are all in the first screen')
console.log('   the shell holds at 390 px with no sideways scroll and no box scrolling inside it')

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
