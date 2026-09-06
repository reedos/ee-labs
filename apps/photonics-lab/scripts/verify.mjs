// End-to-end verification for the Photonics Lab, in a real browser.
//
// The unit tests analyse every experiment directly and check every note against
// that analysis. This drives the page: it loads every experiment, opens every
// view the experiment offers, moves knobs, and reads back what the panes show.
// It is the only thing that catches a prop the shell forgot to pass, a pane fed
// stale state, or a canvas that draws nothing because its range came out zero.
//
//   npm run build --workspace apps/photonics-lab
//   npm run preview --workspace apps/photonics-lab   (serves dist/ on :4181)
//   npm run verify --workspace apps/photonics-lab
//
// `PHOTONICS_LAB_PLAN.md` §7 names this file. It was written in the sitting
// that built Groups A, E and F, extended in the sitting that built C and D,
// and has not been run against a browser, because neither environment had one.
// Treat a first run as a review of this script as much as of the page, and
// `BACKLOG.md` carries that as an open item.

import { chromium } from 'playwright'
import { EXPERIMENTS, GROUPS, VIEW_LABELS, byId } from '../src/experiments.js'

const URL = process.env.APP_URL || 'http://localhost:4181'
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
  await settle()
}

/** Open one view from the switch. */
async function openView(view) {
  await page.locator('.view-switch').getByRole('button', { name: VIEW_LABELS[view].label, exact: true }).click()
  await settle()
}

/** The width of the page against the viewport: a lab that scrolls sideways has a pane too wide. */
const scrollsX = () =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

/** Anything whose right edge is past the screen, which the shell clips silently. */
const clipped = () =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth + 1
    return [...document.querySelectorAll('.view, .view-head, .view-head .segmented, .numbers, .waterfall, .link-strip, .schematic, .eqn-terms')]
      .filter((el) => el.getBoundingClientRect().right > w)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]}`)
  })

/** Set a knob by its key, through the field the shell renders for it. */
async function setKnob(key, value) {
  const box = page.locator(`.knob[data-knob="${key}"] input`).first()
  // A knob past the first four is inside the closed "More knobs" fold, where it
  // is in the DOM and not on the screen. Counting it finds it and filling it
  // does not, which is REVIEW_PLAYBOOK.md §7's own trap. So the test is
  // visibility, and the harness opens the fold the way a person would.
  if (!(await box.count()) || !(await box.isVisible())) {
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

console.log(`Photonics Lab: ${EXPERIMENTS.length} experiments in ${GROUPS.length} groups`)

/** What each view must have put on the page, beyond not throwing. */
const VIEW_SHOWS = {
  schematic: '.sch-wrap svg.schematic [data-el="D1"]',
  curve: '.pane-fill canvas.plot',
  equations: '[data-role=equations] .eqn-terms tbody tr',
  modulation: '.modulation [data-role=modulation-readouts] dd',
  step: '.step [data-role=step-readouts] dd',
  pulse: '.pulse [data-role=pulse-readouts] dd',
  link: '.link [data-role=waterfall] tbody tr',
  cavity: '.cavity [data-role=cavity-readouts] dd',
  spectrum: '.spectrum [data-role=spectrum-readouts] dd',
  numbers: '[data-role=numbers] tbody tr',
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
    await openView(view)
    const want = VIEW_SHOWS[view]
    if (want && (await page.locator(want).count()) === 0) fail(`${exp.id} ${view}: nothing matched ${want}`)
    if (await scrollsX()) fail(`${exp.id} ${view}: the page scrolls sideways`)
    const over = await clipped()
    if (over.length) fail(`${exp.id} ${view}: clipped at the right edge — ${over.join(', ')}`)
  }

  // Every try step, applied through the chip the reader clicks, with the main
  // area read back after each. A step whose knobs do not reach the page leaves
  // everything on it where it was.
  //
  // The probe is the headline AND the pane under it, not the headline alone. An
  // experiment may teach that its own headline does not move: C4's headline is
  // the threshold current, and its third step exists to show that raising the
  // differential efficiency changes the slope and leaves the threshold where it
  // is. A headline-only probe reads that lesson as a broken knob.
  const shown = async () => `${await text('[data-role=headline]')}‖${await text('.view-body')}`
  const before = await shown()
  let moved = false
  for (let i = 0; i < exp.try.length; i++) {
    await page.locator('.try-line button, .try-line .chip').first().click()
    await settle()
    if ((await shown()) !== before) moved = true
    // The step navigation disables its own next button on the last step, so a
    // click there waits thirty seconds for an element that will never enable.
    const next = page.locator('.lesson-nav button[aria-label="Next step"]').first()
    if ((await next.count()) && (await next.isEnabled())) await next.click()
    await settle()
  }
  if (!moved && exp.try.some((t) => Object.keys(t.set || {}).length)) {
    fail(`${exp.id}: no try step changed anything the headline or the pane shows`)
  }
}
console.log('   every experiment loads, and every view it offers draws something')

// --------------------------------- the photodiode is a circuit, and it stays flat

await pick('a2')
const flat = []
for (const v of [2, 5, 10, 20]) {
  await setKnob('bias', v)
  flat.push(await text('[data-role=headline]'))
}
if (new Set(flat).size !== 1) fail(`a2: the current moved with the bias, reading ${flat.join(' then ')}`)
await setKnob('bias', 5)
await setKnob('power', '1m')
await setKnob('load', '100k')
await openView('schematic')
const starved = await text('.sch-wrap')
if (!/c/.test(starved)) fail('a2: the schematic lost its node labels when the junction turned forward')
console.log('   the photocurrent is flat against reverse bias, and the circuit still draws when it is not')

// ------------------------------------------ a setting the engine declines, by name

await pick('e4')
await setKnob('n2', 1.5)
const declined = await text('[data-role=declined]')
if (!/must be larger than the cladding index/.test(declined)) fail(`e4: a cladding above the core shows "${declined}"`)
if ((await page.locator('canvas.plot').count()) !== 0) fail('e4: a declined setting still draws a curve')
await setKnob('n2', 1.4622)
if ((await page.locator('canvas.plot').count()) === 0) fail('e4: the curve did not come back when the fibre did')
console.log('   a cladding above the core is declined by name, and the drawing comes back')

// ---------------------------------- the two limits, and which one binds where

await pick('e5')
await openView('link')
const binds = await text('[data-role=binds]')
if (binds !== 'dispersion') fail(`e5: at 10 Gbit/s the binding limit reads "${binds}"`)
await setKnob('rate', '100M')
if ((await text('[data-role=binds]')) !== 'loss') fail('e5: at 100 Mbit/s the binding limit did not become loss')
await setKnob('rate', '10G')
await setKnob('length', '200k')
const margin = await text('[data-role=margin]')
if (!margin.startsWith('−') && !margin.startsWith('-')) fail(`e5: a 200 km link still reads a positive margin of "${margin}"`)
console.log('   the binding limit follows the bit rate, and the margin goes negative when the link opens')

// ------------------------------- the reflectance moves the finesse and the loss

await pick('f1')
await openView('cavity')
const loose = await text('[data-role=cavity-readouts]')
await setKnob('r', 0.99)
const tight = await text('[data-role=cavity-readouts]')
if (loose === tight) fail('f1: raising the reflectance moved nothing in the cavity readouts')
const refusal = await text('[data-role=cavity-refusal]')
if (!/transcendental/.test(refusal)) fail(`f1: the cavity pane's refusal reads "${refusal}"`)
console.log('   the facet reflectance moves the finesse, and the refusal is on the pane')

// ------------------------ one junction, one current, and two different lights

await pick('c1')
await openView('schematic')
const both = await text('.sch-wrap .caption')
if (!/As an LED/.test(both) || !/as a laser/.test(both)) fail(`c1: the caption names one device, reading "${both}"`)
await setKnob('drive', 1.8)
const dim = await text('[data-role=headline]')
await setKnob('drive', 3.3)
const bright = await text('[data-role=headline]')
if (dim === bright) fail('c1: moving the supply did not move the junction current')
console.log('   one junction carries one current, and the caption names both devices it could be')

// --------------------------- the facet moves the threshold and the resonance

await pick('c5')
await openView('numbers')
const threshold = async () => await text('[data-role=headline]')
await setKnob('r', 0.1)
const loosened = await threshold()
await setKnob('r', 0.9)
const tightened = await threshold()
if (loosened === tightened) fail('c5: the facet reflectance did not move the threshold current')
// The same cavity's free spectral range is on this pane, so one reflectance
// moves a threshold here and a resonance spacing in F1. A pane that showed one
// without the other would hide the link the two groups share.
const rows = await text('[data-role=numbers]')
if (!/Free spectral range/.test(rows)) fail('c5: the numbers pane does not carry the cavity’s free spectral range')
console.log('   the facet reflectance moves the threshold, and the same cavity is on the pane')

// -------------------------------- the guard, drawn, flagged, and then withdrawn

await pick('d4')
await openView('step')
await setKnob('depth', 0.02)
if ((await page.locator('.step-predicted').count()) === 0) fail('d4: at 2 per cent depth the prediction is not drawn')
if ((await page.locator('.step-predicted.is-estimate').count()) !== 0) fail('d4: at 2 per cent depth the prediction is already flagged')
await setKnob('depth', 0.2)
if ((await page.locator('.step-predicted.is-estimate').count()) === 0) fail('d4: at 20 per cent depth the prediction is not flagged')
await setKnob('depth', 0.5)
if ((await page.locator('.step-predicted').count()) !== 0) fail('d4: at 50 per cent depth the prediction is still drawn')
const says = await text('[data-role=guard-says]')
if (!/stops drawing it/.test(says)) fail(`d4: past the decline threshold the guard reads "${says}"`)
const refuses = await text('[data-role=large-signal-refusal]')
if (!/cannot be told apart from physics/.test(refuses)) fail(`d4: the large-signal refusal reads "${refuses}"`)
const flag = await text('[data-role=guard-flag]')
if (!/guard/.test(flag)) fail(`d4: the topbar guard flag reads "${flag}"`)
console.log('   the modulation guard draws, flags and then withdraws the linear prediction')

// ------------------- the relaxation frequency follows the square root of I/I_th

await pick('d3')
await openView('modulation')
const readout = await text('[data-role=modulation-readouts]')
if (!/textbook/i.test(readout)) fail('d3: the modulation pane does not print the textbook form beside the exact one')
const slow = await text('[data-role=headline]')
await setKnob('current', '60m')
const fast = await text('[data-role=headline]')
if (slow === fast) fail('d3: raising the drive current did not move the relaxation frequency')
// Below threshold there are no photons and no oscillation, and the pane says
// so rather than drawing a frequency the cancellation made up.
await setKnob('current', '5m')
const nothing = await text('[data-role=declined]')
if (!/no photons in the cavity/.test(nothing)) fail(`d3: below threshold the pane shows "${nothing}"`)
console.log('   the relaxation frequency follows the drive, and below threshold the pane declines by name')

// ------------------------------------------------------------- the narrow screen

await page.setViewportSize({ width: 390, height: 844 })
await settle()
for (const exp of EXPERIMENTS) {
  await pick(exp.id)
  for (const view of exp.views) {
    await openView(view)
    if (await scrollsX()) fail(`${exp.id} ${view}: the page scrolls sideways at 390 px`)
    const over = await clipped()
    if (over.length) fail(`${exp.id} ${view}: clipped at 390 px — ${over.join(', ')}`)
  }
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
