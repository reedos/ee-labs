// End-to-end verification for Control Lab, in a real browser.
//
// The unit tests compose loops directly. This drives the page, and its most
// valuable check is one the unit tests cannot make: that the number in the
// topbar predicts what happens when you act on it. The gain margin claims the
// loop can take so much more gain before it sings — so the harness turns the
// gain up to just under it and just over it, and requires the app to agree.

import { chromium } from 'playwright'
import { foldProbe, phoneProbe } from '@ee-labs/ui/verify/foldProbe.mjs'

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
await page.waitForSelector('.views canvas')
await page.waitForTimeout(400)

const settle = () => page.waitForTimeout(240)

// ------------------------------------------------- 0. what the page opens on

console.log('\n0. The first minute\n')
{
  // A bare visit opens on the first lesson, its group open, its try line
  // and its knob on screen — not on a solved motor with Try this folded.
  const on = await page.locator('.preset.is-on').first().textContent().catch(() => '')
  if (on.trim() !== 'Proportional cannot get there') fail(`the page should open on the first lesson, opened on "${on}"`)
  const groupOpen = await page.evaluate(() => {
    const b = document.querySelector('.preset.is-on')
    return b ? b.closest('details.preset-group').open : false
  })
  if (!groupOpen) fail('the opening lesson\'s group should be open')
  const tryLine = await page.locator('.try-line').count()
  if (!tryLine) fail('the opening lesson should show its try line')
  const settles = await page.locator('.readout').last().textContent()
  if (!/settles to\s*0?\.?9|settles to\s*900 m/.test(settles)) fail(`the opening picture should settle at 0.9, readout: "${settles}"`)
  console.log(`   opens on "${on.trim()}", group open, try line present; ${settles.trim().slice(0, 40)}`)
}
const scrolls = () =>
  page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  )

const canvasHashes = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.views canvas')].map((c) => {
      const d = c.toDataURL()
      let h = 0
      for (let i = 0; i < d.length; i += 97) h = (h * 31 + d.charCodeAt(i)) | 0
      return `${h}:${d.length}`
    }),
  )

const topbar = () =>
  page.evaluate(() => {
    const out = {}
    for (const f of document.querySelectorAll('.topbar-field')) {
      const k = f.querySelector('span')?.textContent.trim()
      const v = f.querySelector('b')?.textContent.trim()
      if (k) out[k] = v
    }
    out.verdict = document.querySelector('.flow-node.is-out, .flow-node.is-off')?.textContent || ''
    return out
  })

const readChecks = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.math-check tbody tr')].map((tr) => {
      const c = [...tr.querySelectorAll('th,td')].map((x) => x.textContent.trim())
      return { label: c[0], theory: c[1], measured: c[2], mark: c[3] }
    }),
  )

// The math is a pane tab now, not a sidebar well: open it, read it, and go
// back to the step view so the sections after can read the step readout.
async function openMath() {
  await page.locator('[aria-label="Lower view"] button', { hasText: /^Math$/ }).click()
  await page.waitForTimeout(150)
}
async function closeMath() {
  await page.locator('[aria-label="Lower view"] button', { hasText: /^Step$/ }).click()
  await page.waitForTimeout(120)
}

const isStable = async () => !/UNSTABLE/.test((await topbar()).verdict)

/**
 * Always type an explicit SI prefix.
 *
 * These fields read a BARE number in the prefix currently on display, so with
 * "200 m" showing, typing 20 means 0.02. Emitting a prefix every time — 20
 * becomes "0.02k" — makes the value absolute regardless of what was there
 * before, which is what a harness needs even though a person would not bother.
 */
const absolute = (v) => {
  const a = Math.abs(v)
  if (a >= 1e6) return `${v / 1e6}M`
  if (a >= 1) return `${v / 1e3}k`
  if (a >= 1e-3) return `${v * 1e3}m`
  return `${v * 1e6}u`
}

async function setField(label, value) {
  const box = page.getByRole('spinbutton', { name: label }).first()
  await box.fill(absolute(Number(value)))
  await box.press('Enter')
  await settle()
}
const clickBtn = async (name) => {
  await page.getByRole('button', { name, exact: true }).first().click()
  await settle()
}

/**
 * Load a lesson by name. Lesson groups fold now; a lesson in a folded group is
 * not clickable until its group is opened, exactly as for a person.
 */
const loadLesson = async (name) => {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const btn = page.locator('.preset').filter({ hasText: new RegExp(`^${esc}$`) }).first()
  if (!(await btn.isVisible().catch(() => false))) {
    await page.evaluate((n) => {
      for (const d of document.querySelectorAll('details.preset-group')) {
        const has = [...d.querySelectorAll('.preset')].some((b) => b.textContent.trim() === n)
        if (has && !d.open) d.querySelector('summary').click()
      }
    }, name)
    await page.waitForTimeout(120)
  }
  await btn.click()
  await settle()
}

// Plants live behind the same folds as lessons now; clicking one goes
// through the unfold-first path, exactly as for a person.
const clickPreset = loadLesson

const plants = ['First order lag', 'Integrator', 'Second order', 'Motor position', 'Three lags', 'Unstable plant', 'Custom H(s)']
const ctrls = ['Proportional', 'PI', 'PID', 'Lead']

// ------------------------------------- 1. every plant against every controller

console.log(`\n1. All ${plants.length} plants x ${ctrls.length} controllers\n`)
for (const p of plants) {
  const row = []
  for (const c of ctrls) {
    await clickPreset(p)
    await clickBtn(c)
    await openMath()
    const bad = (await readChecks()).filter((r) => r.mark === '✗')
    for (const b of bad) fail(`${p} + ${c}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)
    if (await scrolls()) fail(`${p} + ${c}: page scrolls`)
    await closeMath()
    row.push(`${c}:${bad.length ? bad.length + '✗' : 'ok'}`)
  }
  console.log(`   ${p.padEnd(18)} ${row.join('  ')}`)
}

// ------------------------------------ 1b. every lesson loads, and stays visible

console.log('\n1b. Loading every lesson through the folded groups\n')
{
  // The groups collapse to headers, so the lesson names live behind a fold.
  // Collect them from the DOM rather than a hardcoded list, open each group as
  // a person would, and require the loaded lesson to keep its group open.
  const lessonNames = await page.evaluate(() =>
    [...document.querySelectorAll('#lessons details.preset-group .preset')].map((b) => b.textContent.trim()),
  )
  if (lessonNames.length < 10) fail(`expected the full lesson list, found ${lessonNames.length}`)
  for (const name of lessonNames) {
    await loadLesson(name)
    await openMath()
    const bad = (await readChecks()).filter((r) => r.mark === '✗')
    for (const b of bad) fail(`${name}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)
    if (await scrolls()) fail(`${name}: page scrolls`)
    await closeMath()
    // The try line, with at least one chip, under every note.
    const tryText = (await page.locator('.try-line .try-text').textContent().catch(() => '')) || ''
    if (!/^Try/.test(tryText.trim())) fail(`${name}: no try line under the note`)
    if (!(await page.locator('.try-line .chip').count())) fail(`${name}: no chips on the try line`)
    // The lesson's own knob rendered under it.
    if (!(await page.locator('.featured').count())) fail(`${name}: no featured knob under the try line`)
    const state = await page.evaluate(() => {
      const on = document.querySelector('details.preset-group .preset.is-on')
      const group = on ? on.closest('details.preset-group') : null
      return { active: !!on, open: group ? group.open : false }
    })
    if (!state.active) fail(`${name}: no lesson button marked active after loading`)
    if (!state.open) fail(`${name}: the active lesson's group is folded shut`)
    // A phase margin is an angle to −1 and lives on a circle. The unstable
    // plant once read 438.5° here — the raw 180° + ∠L off an anchor a full
    // turn up — so every lesson's displayed margin is range-checked.
    const pmText = (await topbar())['phase margin']
    if (pmText !== '—' && !(Math.abs(parseFloat(pmText)) <= 180)) {
      fail(`${name}: phase margin reads ${pmText} — off the circle`)
    }
    // Definitions on contact: every lesson offers its terms from the note.
    const termsLink = page.locator('.terms-link')
    if (!(await termsLink.count())) fail(`${name}: no terms link on the note`)
    await termsLink.click()
    await page.waitForTimeout(80)
    const termCount = await page.locator('.terms-list dt').count()
    if (termCount < 1) fail(`${name}: no "terms used here" definitions offered`)
    await termsLink.click()
    await page.waitForTimeout(80)
    console.log(`   ${name.padEnd(34)} ${bad.length ? bad.length + '✗' : 'ok'}  ${termCount} terms`)
  }

  // The active group must be impossible to fold away: click its summary and
  // it has to stay open, because the fold must never hide where you are.
  // (React reasserts the open attribute on its next render, so the state is
  // read after a beat rather than synchronously off the click.)
  await page.evaluate(() => {
    document
      .querySelector('details.preset-group .preset.is-on')
      .closest('details.preset-group')
      .querySelector('summary')
      .click()
  })
  await page.waitForTimeout(150)
  const stillOpen = await page.evaluate(() =>
    document
      .querySelector('details.preset-group .preset.is-on')
      .closest('details.preset-group').open,
  )
  console.log(`   active group after clicking its own summary: ${stillOpen ? 'still open' : 'FOLDED'}`)
  if (!stillOpen) fail("the active lesson's group folded away when its summary was clicked")

  // An inactive group folds and unfolds freely — the fold is real, not stuck open.
  const foldsFreely = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('details.preset-group')]
    const idle = groups.find((g) => !g.querySelector('.preset.is-on'))
    const before = idle.open
    idle.querySelector('summary').click()
    const after = idle.open
    idle.querySelector('summary').click()
    return after !== before
  })
  if (!foldsFreely) fail('an inactive lesson group did not toggle when its summary was clicked')

  // The plant groups fold now too, and the active plant's group is pinned
  // exactly like the active lesson's: click its summary, it must stay open.
  await page.evaluate(() => {
    document
      .querySelector('#plant .preset.is-on')
      .closest('details.preset-group')
      .querySelector('summary')
      .click()
  })
  await page.waitForTimeout(150)
  const plantGroupOpen = await page.evaluate(
    () => document.querySelector('#plant .preset.is-on').closest('details.preset-group').open,
  )
  if (!plantGroupOpen) fail("the active plant's group folded away when its summary was clicked")

  // A lesson note describes ONE step input. Flipping the toggle no longer
  // clears the lesson (that un-highlighted the chip and left no way back):
  // the lesson turns DIRTY — the note dims, a reset appears — and reset
  // puts the toggle back and clears both.
  await loadLesson('Proportional cannot get there')
  const noteBefore = await page.locator('.hint.note').first().textContent()
  if (!/90%/.test(noteBefore)) fail('expected the lesson note on screen before the toggle')
  if (await page.locator('.lesson-nav-reset').count()) fail('a freshly loaded lesson should not offer reset')
  await clickBtn('Disturbance')
  if (!(await page.locator('.hint.note.is-dirty').count())) fail('flipping to Disturbance should mark the note dirty')
  if (!(await page.locator('.lesson-nav-reset').count())) fail('a moved lesson should offer reset')
  if (!(await page.locator('.preset.is-on').count())) fail('the lesson chip should stay highlighted while dirty')
  await page.locator('.lesson-nav-reset').click()
  await settle()
  const refOnAfterReset = await page
    .locator('[aria-label="Where the step is applied"] button.on')
    .textContent()
  if (refOnAfterReset.trim() !== 'Reference') fail('reset should put the step toggle back to Reference')
  if (await page.locator('.lesson-nav-reset').count()) fail('reset should clear the dirty state')
  if (await page.locator('.hint.note.is-dirty').count()) fail('reset should un-dim the note')

  // Next / previous walk the course in order.
  const count = await page.locator('.lesson-nav-count').textContent()
  if (count.trim() !== '1 of 13') fail(`lesson nav should read "1 of 13" on the first lesson, reads "${count}"`)
  await page.getByRole('button', { name: 'Next lesson' }).click()
  await settle()
  const second = await page.locator('.preset.is-on').first().textContent()
  if (second.trim() !== 'The integrator closes the gap') fail(`next should load the second lesson, loaded "${second}"`)
  await page.getByRole('button', { name: 'Previous lesson' }).click()
  await settle()
  const first = await page.locator('.preset.is-on').first().textContent()
  if (first.trim() !== 'Proportional cannot get there') fail(`previous should load the first lesson again, loaded "${first}"`)
  console.log('   step toggle marks the lesson dirty; reset restores it; next/previous walk the course')

  // The chips do what their labels say, in one click.
  await loadLesson('A shove at the plant input')
  await page.locator('.try-line .chip', { hasText: 'switch to PI' }).click()
  await settle()
  const ctrlOn = await page.locator('#controller .preset.is-on').textContent()
  if (ctrlOn.trim() !== 'PI') fail(`the "switch to PI" chip should select PI, selected "${ctrlOn}"`)
  const distReadout = await page.locator('.readout').last().textContent()
  if (!/rejected completely/.test(distReadout)) fail('after the PI chip the disturbance should be erased')
  const chipOn = await page.locator('.try-line .chip.is-on').textContent().catch(() => '')
  if (chipOn.trim() !== 'switch to PI') fail(`the applied chip should be highlighted, highlighted "${chipOn}"`)
  // The step toggle is the lesson's featured control, right under the chips.
  await page.locator('.featured[data-featured="disturbance"] button', { hasText: 'Reference' }).click()
  await settle()
  const h2Ref = await page.locator('.views .view-head h2').last().textContent()
  if (!/step response/i.test(h2Ref)) fail(`the featured toggle should flip the step, heading reads "${h2Ref}"`)
  console.log('   chips switch the controller; the featured toggle flips the step — one click each')

  // The margin lesson's chips read the live gain margin.
  await loadLesson('The margin says exactly how far')
  await page.locator('.try-line .chip', { hasText: '0.9 × GM' }).click()
  await settle()
  if (!(await isStable())) fail('0.9 × GM should leave the loop stable')
  await page.locator('.try-line .chip', { hasText: '1.1 × GM' }).click()
  await settle()
  if (await isStable()) fail('1.1 × GM should tip the loop unstable')
  console.log('   the 0.9× / 1.1× GM chips bracket the boundary')

  // The locus readout says where you are and where the branch crosses.
  await loadLesson('Watch the poles cross')
  const here = (await page.locator('[data-role="locus-here"]').textContent().catch(() => '')) || ''
  if (!/you are here: Kp = 4/.test(here)) fail(`locus: expected "you are here: Kp = 4", got "${here}"`)
  if (!/crosses the axis at Kp = 11\.25/.test(here)) fail(`locus: expected the crossing at Kp = 11.25, got "${here}"`)
  console.log(`   locus readout: ${here.trim()}`)

  // The lead lesson draws its uncompensated loop as a ghost.
  await loadLesson('Lead does it without the noise')
  const withLead = (await canvasHashes())[0]
  await clickBtn('Proportional')
  const withoutLead = (await canvasHashes())[0]
  if (withLead === withoutLead) fail('the lead lesson should draw a ghost the proportional loop lacks')
  console.log('   the lead lesson ghosts K·P(s) on the Bode')

  // Leave no lesson active so later sections start from plain plant clicks.
  await clickPreset('First order lag')
}

// ------------------------------- 2. does the gain margin predict what happens?

console.log('\n2. Does the gain margin actually predict instability?\n')
await clickPreset('Three lags')
await clickBtn('Proportional')
const gmText = (await topbar())['gain margin']
const gmDb = parseFloat(gmText)
const gm = Math.pow(10, gmDb / 20)
console.log(`   at Kp = 1 the app claims a gain margin of ${gmText} (${gm.toFixed(2)}x)`)

for (const [factor, expect] of [
  [0.5, true],
  [0.9, true],
  [1.1, false],
  [3, false],
]) {
  await setField('Kp', (gm * factor).toPrecision(4))
  const ok = await isStable()
  const verdict = ok ? 'stable' : 'unstable'
  const good = ok === expect
  console.log(
    `   Kp = ${(gm * factor).toFixed(3).padStart(7)}  (${String(factor).padStart(4)}x the margin) -> ${verdict.padEnd(9)} ${good ? 'as predicted' : 'WRONG'}`,
  )
  if (!good) fail(`Kp at ${factor}x the gain margin: ${verdict}, expected ${expect ? 'stable' : 'unstable'}`)
}

// ------------------------------------------- 3. what each controller is for

console.log('\n3. Does each controller do the thing it exists for?\n')
await clickPreset('First order lag')
await clickBtn('Proportional')
await setField('Kp', 9)
const errP = (await topbar())['steady error']
console.log(`   proportional on a plant with no integrator -> steady error ${errP}`)
if (errP === 'none') fail('proportional control should leave a steady-state error here')

await clickBtn('PI')
const errPI = (await topbar())['steady error']
console.log(`   PI on the same plant                        -> steady error ${errPI}`)
if (errPI !== 'none') fail(`PI should remove steady-state error, got ${errPI}`)

// The disturbance toggle: the same loop poked at the plant input. Under P the
// shove leaves exactly P(0)/(1+L(0)); under PI the integrator erases it.
await clickPreset('First order lag')
await clickBtn('Proportional')
await setField('Kp', 9)
await clickBtn('Disturbance')
// The readout is in engineering notation — "100 m" is 0.1 — so the suffix
// must be read along with the number.
const distRaw = (await page.locator('.readout').last().textContent()).match(
  /settles to\s*(-?[\d.]+)\s*([mµu]?)/,
)
const distVal = distRaw
  ? parseFloat(distRaw[1]) * ({ m: 1e-3, 'µ': 1e-6, u: 1e-6, '': 1 })[distRaw[2]]
  : NaN
console.log(`   disturbance under P (Kp=9, K=1, so 1/(1+9)): settles to ${distVal}`)
if (Math.abs(distVal - 0.1) > 0.005) {
  fail(`disturbance under P should settle to 0.1, got ${distVal}`)
}
await clickBtn('PI')
const distText = await page.locator('.readout').last().textContent()
const erased = /rejected completely/.test(distText)
console.log(`   disturbance under PI: ${erased ? 'rejected completely — the integrator erases it' : 'NOT erased'}`)
if (!erased) fail('PI should erase a plant-input disturbance exactly')
await clickBtn('Reference')

// The settle readout confesses when the plot's right edge arrives first: a
// very slow loop's plot is capped at 400 s, and there the trace is visibly
// short of the destination the readout names.
await clickPreset('Integrator')
await clickBtn('Proportional')
await setField('Kp', 0.005)
const slowText = await page.locator('.readout').last().textContent()
const flagged = /not there yet/.test(slowText)
console.log(`   slow loop at the 400 s cap: ${flagged ? 'flagged as not settled' : 'NOT flagged'}`)
if (!flagged) fail('a loop that cannot settle inside the plot should say so in the readout')
await setField('Kp', 1)
if (/not there yet/.test(await page.locator('.readout').last().textContent())) {
  fail('a settled loop should not carry the not-settled flag')
}

// The unstable plant fails the other way round: too LITTLE gain is the problem.
await clickPreset('Unstable plant')
await clickBtn('Proportional')
await setField('Kp', 0.2)
const lowGain = await isStable()
await setField('Kp', 20)
const highGain = await isStable()
console.log(
  `   unstable plant: Kp 0.2 -> ${lowGain ? 'stable' : 'unstable'}, Kp 20 -> ${highGain ? 'stable' : 'unstable'}`,
)
if (lowGain) fail('unstable plant with too little gain should not be stable')
if (!highGain) fail('unstable plant with enough gain should be stable')

// ------------------- 3b. derivative action, and lead, do what they claim to

console.log('\n3b. Kd buys damping; lead buys phase margin\n')

// The overshoot readout only exists where overshoot is well defined — a
// closed loop that IS second order. Plant + P is; plant + PID is order three
// and the app rightly declines to name a ζ for it. So overshoot is swept with
// proportional gain (raising Kp divides ζ by √(1+KpK): a real second-order
// fact), and the derivative claim is read from the phase margin instead,
// which the topbar always carries.
await clickPreset('Second order')
await clickBtn('Proportional')
await clickBtn('Step')
await setField('Damping ζ', 0.3)
const overshootShown = async () => {
  const m = (await page.locator('.readout').last().textContent()).match(/overshoot\s*([\d.]+)\s*%/)
  return m ? parseFloat(m[1]) : 0
}
const byKp = []
for (const kp of [1, 4, 16]) {
  await setField('Kp', kp)
  byKp.push(await overshootShown())
}
console.log(`   overshoot at Kp 1 / 4 / 16: ${byKp.map((v) => v.toFixed(1) + '%').join('  ')}`)
if (!(byKp[0] < byKp[1] && byKp[1] < byKp[2])) {
  fail(`raising Kp on a second-order plant must raise overshoot, got ${byKp.join(', ')}`)
}
if (byKp[2] < 40) fail(`Kp=16 should push ζ well under 0.1 and overshoot past 40%, got ${byKp[2]}%`)

// Derivative action adds phase. Same plant under PID, Kd swept: the margin
// must climb monotonically.
await clickBtn('PID')
await setField('Kp', 2)
await setField('Ki', 1)
const pmByKd = []
for (const kd of [0.001, 0.2, 0.5]) {
  await setField('Kd', kd)
  pmByKd.push(parseFloat((await topbar())['phase margin']))
}
console.log(`   phase margin at Kd 0.001 / 0.2 / 0.5: ${pmByKd.map((v) => v + '°').join('  ')}`)
if (!(pmByKd[0] < pmByKd[1] && pmByKd[1] < pmByKd[2])) {
  fail(`derivative action should raise the phase margin monotonically, got ${pmByKd.join(', ')}`)
}

// Lead on the three-lag plant: same low-frequency gain as plain proportional,
// but with phase added back where the loop crosses over.
await clickPreset('Three lags')
await clickBtn('Proportional')
await setField('Kp', 3)
const pmP = parseFloat((await topbar())['phase margin'])
await clickBtn('Lead')
await setField('Gain', 3)
await setField('Zero at', 1)
await setField('Pole at', 20)
const pmLead = parseFloat((await topbar())['phase margin'])
console.log(`   phase margin: proportional ${pmP}°  ->  lead ${pmLead}°`)
if (!(pmLead > pmP + 10)) {
  fail(`a lead 1..20 rad/s should add well over 10° of margin (got ${pmP}° -> ${pmLead}°)`)
}

// --------------------------------------------------------- 4. the three views

console.log('\n4. All three lower views\n')
await clickPreset('Three lags')
await clickBtn('Proportional')
let prev = await canvasHashes()
for (const view of ['Nyquist', 'Root locus', 'Step']) {
  await clickBtn(view)
  const now = await canvasHashes()
  const changed = now[1] !== prev[1]
  console.log(`   ${view.padEnd(11)} ${changed ? 'redraws' : 'UNCHANGED'}`)
  if (!changed) fail(`switching to ${view} did not redraw`)
  prev = now
}

// The locus names WHOSE poles it draws — Reed's say-the-name rule.
await clickBtn('Root locus')
const locusH2 = await page.locator('.views .view').last().locator('h2').textContent()
if (!/closed-loop poles/.test(locusH2)) {
  fail(`the locus heading should say whose poles it draws; it reads "${locusH2}"`)
}
await clickBtn('Step')


// --------------------------------------- 4b. the loop diagram, and its wiring

console.log('\n4b. The loop diagram: live parameters, and the step entry wired to the toggle\n')
{
  // A known setup so the parameter summaries have known contents.
  await clickPreset('Motor position')
  await clickBtn('PI')
  await setField('Kp', 3)
  await setField('Ki', 0.5)

  const openDiagram = async () => {
    await page.getByRole('button', { name: '⧉ diagram' }).click()
    await page.waitForTimeout(200)
  }
  await openDiagram()
  if (!(await page.locator('.fd-panel').count())) fail('diagram: panel did not open')

  // The boxes carry the CURRENT parameters, not a stock picture.
  const svgText = await page.locator('.fd-svg').textContent()
  for (const want of [
    'C(s) — PI',
    'P(s) — Motor position',
    'Kp 3',
    // Plain 0.5, not "500 m": a dimensionless gain carries no unit for a
    // prefix to belong to. (This pin once read "Ki 500 m" — the diagram was
    // verified against the very formatting bug the audit removed.)
    'Ki 0.5',
    'r − y',
    // Reed's rule: the view says the name of the thing it enacts.
    'transfer functions multiply — L = C·P',
  ]) {
    if (!svgText.includes(want)) fail(`diagram: expected "${want}" in the drawing, not found`)
  }
  console.log('   C and P boxes carry the live controller and plant parameters')

  // The injected-entry marker follows the Reference/Disturbance toggle, and
  // clicking an entry drives the toggle — the diagram and the toggle are two
  // views of one piece of state.
  const injected = () => page.locator('.fd-entry.is-inject').getAttribute('aria-label')
  if (!/reference/i.test(await injected())) fail('diagram: with Reference selected, r should be marked as the entry')
  await page.locator('.fd-entry[aria-label*="plant input"]').click()
  await settle()
  if (!/plant input/i.test(await injected())) fail('diagram: clicking d should move the injection marker')
  await page.keyboard.press('Escape')
  await settle()
  if (await page.locator('.fd-panel').count()) fail('diagram: Escape should close it')
  // Scoped to the step-input group: since the view controls moved into the
  // pane headers, several segmented groups have an "on" button at once.
  const distOn = await page
    .locator('[aria-label="Where the step is applied"] button.on')
    .textContent()
    .catch(() => '')
  if (distOn.trim() !== 'Disturbance') fail(`diagram: clicking d should select the Disturbance step, toggle reads "${distOn}"`)
  const heading = await page.locator('.views .view-head h2').last().textContent()
  if (!/disturbance at the plant input/i.test(heading)) {
    fail(`diagram: after choosing d the lower view should answer the disturbance question, heading reads "${heading}"`)
  }
  console.log('   clicking d in the diagram selects the Disturbance step and the plot follows')

  // And back: r restores the reference step.
  await openDiagram()
  await page.locator('.fd-entry[aria-label*="reference"]').click()
  await settle()
  await page.keyboard.press('Escape')
  await settle()
  const refOn = await page
    .locator('[aria-label="Where the step is applied"] button.on')
    .textContent()
  if (refOn.trim() !== 'Reference') fail('diagram: clicking r should select the Reference step again')

  // Clicking a box closes the diagram and points at the sidebar card.
  await openDiagram()
  await page.locator('.fd-box[aria-label*="plant"]').click()
  await page.waitForTimeout(200)
  if (await page.locator('.fd-panel').count()) fail('diagram: clicking the P box should close it')
  console.log('   the P box hands off to the plant card in the sidebar')

  // A wiring diagram whose wires do not draw is the failure Signal Lab ships
  // today (stroke: var(--axis) with --axis defined nowhere), so the computed
  // stroke of a wire is checked outright.
  await openDiagram()
  const stroke = await page
    .locator('.fd-wire')
    .first()
    .evaluate((el) => getComputedStyle(el).stroke)
  if (stroke === 'none' || stroke === '') fail(`diagram: wires have no stroke (computed "${stroke}")`)
  console.log(`   wires actually draw (computed stroke ${stroke})`)
  await page.keyboard.press('Escape')
  await settle()
}

// ------------------------------------- 4c. the axis holds still while tuning

console.log('\n4c. The frequency axis: sticky under tuning, reframed on structure\n')
{
  // The tick-label strip of the Bode canvas, byte-compared. (The x-axis
  // TITLE never changes, so the clip must sit on the labels above it — a
  // probe on the title strip proves nothing, as the first draft of this
  // check demonstrated.)
  const axisStrip = async () => {
    const box = await page.locator('.views canvas').first().boundingBox()
    const buf = await page.screenshot({
      clip: { x: box.x, y: box.y + box.height - 62, width: box.width, height: 26 },
    })
    return buf.toString('base64')
  }
  await clickPreset('Motor position')
  await clickBtn('Proportional')
  const before = await axisStrip()
  await setField('Time constant τ', 0.8)
  if ((await axisStrip()) !== before) {
    fail('tuning τ inside the guard band moved the frequency axis — it must hold still')
  }
  await setField('Time constant τ', 0.002)
  if ((await axisStrip()) === before) {
    fail('a 2.4-decade τ move left the axis unchanged — the window must re-frame')
  }
  await setField('Time constant τ', 0.5)
  console.log('   still under a small τ move, reframed after a 2.4-decade one')

  // Both unit systems on the crossover: the plot speaks Hz, the textbook
  // rad/s, and the readout must say both.
  const openReadout = await page.locator('.views .view').first().locator('.readout').textContent()
  if (!/rad\/s/.test(openReadout)) fail('the crossover readout should carry its rad/s twin')
}

// ---------------------------------------- 4d. the watch view and its transport

console.log('\n4d. The watch view: scrub, play, and the transport rules\n')
{
  await clickPreset('First order lag')
  await clickBtn('PI')
  await clickBtn('Watch')
  const slider = page.getByRole('slider', { name: 'Moment in the response' })
  if (!(await slider.count())) fail('watch: no scrubber on the watch view')
  if (await scrolls()) fail('watch view: page scrolls at 1080p')

  // Scrubbing moves the cursor readouts and redraws the canvas.
  const readNow = async () => (await page.locator('.readout').last().textContent()).trim()
  await slider.fill('60')
  await settle()
  const early = await readNow()
  const hashEarly = (await canvasHashes())[1]
  await slider.fill('550')
  await settle()
  const late = await readNow()
  const hashLate = (await canvasHashes())[1]
  if (early === late) fail('watch: scrubbing did not move the e/u readouts')
  if (hashEarly === hashLate) fail('watch: scrubbing did not redraw the canvas')
  console.log('   scrubbing moves the readouts and the picture')

  // The early moment tells the lesson's story: e still substantial, far from
  // settled. The physics: this loop pole-zero cancels to L = 1/s, e = e^-t,
  // and slider 60 of 600 on the laddered 15 s window is t = 1.5 → e ≈ 0.223.
  // The old threshold of 0.3 "passed" only because the readout printed
  // "223 m" and the parse read it as 223 — a check green on the very bug the
  // audit removed.
  const eEarly = parseFloat((early.match(/e now\s*(-?[\d.]+)/) || [])[1])
  if (!(eEarly > 0.15)) fail(`watch: early in the step e should still be substantial, readout says ${early}`)

  // Play: at the end it restarts, sweeps, and pauses itself at the end again.
  await page.getByRole('button', { name: /4×/ }).click()
  await slider.fill('599')
  await settle()
  await page.getByRole('button', { name: '▶ play', exact: true }).click()
  await page.waitForTimeout(500)
  const during = Number(await slider.inputValue())
  if (!(during > 0 && during < 599)) {
    fail(`watch: play at the end should restart and advance (slider at ${during})`)
  }
  // A 1× sweep is ~12 s (halved from the convolution view's pace on Reed's
  // review), so 4× needs ~3 s to cross.
  await page.waitForTimeout(3400)
  const after = Number(await slider.inputValue())
  const btnNow = await page.getByRole('button', { name: /play|pause/ }).first().textContent()
  if (after !== 599) fail(`watch: a 4× sweep should reach the end (slider at ${after})`)
  if (!/play/.test(btnNow)) fail('watch: playback should pause itself at the end')
  console.log('   play restarts from the end, sweeps at 4×, and parks itself')

  // Loading a lesson rewinds the story to the OPENING cursor — a little way
  // in, where both controller terms are visibly still at work. It used to
  // park at the end, where the handoff the lesson narrates was already over
  // (Kp·e ≈ 3e-7, Ki·∫e = 1).
  await slider.fill('100')
  await settle()
  await loadLesson('Watch the integrator take over')
  const reset = Number(await slider.inputValue())
  if (!(reset > 0 && reset < 599)) fail(`watch: loading a lesson should open the cursor inside the window (at ${reset})`)
  const partValue = async (key) => {
    const txt = (await page.locator(`.readout [data-part="${key}"] b`).textContent().catch(() => '')) || ''
    const m = txt.match(/(-?[\d.]+)\s*([mµu]?)/)
    return m ? parseFloat(m[1]) * ({ m: 1e-3, µ: 1e-6, u: 1e-6, '': 1 })[m[2]] : NaN
  }
  const pOpen = await partValue('p')
  const iOpen = await partValue('i')
  console.log(`   opening cursor at ${reset}/599: Kp·e = ${pOpen}, Ki·∫e = ${iOpen}`)
  if (!(Math.abs(pOpen) > 0.05)) fail(`watch: at the opening cursor Kp·e should be visibly nonzero, reads ${pOpen}`)
  if (!(Math.abs(iOpen) > 0.05)) fail(`watch: at the opening cursor Ki·∫e should be visibly nonzero, reads ${iOpen}`)
  // Reset to the same lesson rewinds too.
  await slider.fill('500')
  await settle()
  await page.getByRole('button', { name: 'Next lesson' }).click()
  await settle()
  await page.getByRole('button', { name: 'Previous lesson' }).click()
  await settle()
  if (Number(await slider.inputValue()) !== reset) fail('watch: coming back to the lesson should rewind to the opening cursor')
  await slider.fill('500')
  await settle()
  await setField('Ki', 2)
  await page.locator('.lesson-nav-reset').click()
  await settle()
  if (Number(await slider.inputValue()) !== reset) fail('watch: reset should rewind to the opening cursor')
  const heading = await page.locator('.views .view').last().locator('h2').textContent()
  if (!/watched/i.test(heading)) fail('watch: the lesson should land on the watch view')
  console.log('   a lesson load resets the transport')

  // The disturbance story is one click away, same as the step view.
  await clickBtn('Disturbance')
  const h2 = await page.locator('.views .view').last().locator('h2').textContent()
  if (!/shove/i.test(h2)) fail('watch: the Disturbance toggle should switch the watched story')
  await clickBtn('Reference')

  // The proximity rule, migrated from Signal Lab: each pane's controls live
  // in ITS header — the view switch on the lower pane, the phase toggle on
  // the Bode pane — not in a sidebar a screen-width (on a phone, a screen-
  // height) away.
  const lowerHead = page.locator('.views .view').last().locator('.view-head')
  if (!(await lowerHead.getByRole('button', { name: 'Nyquist', exact: true }).count())) {
    fail('the lower view switch should live in the lower pane header')
  }
  const bodeHead = page.locator('.views .view').first().locator('.view-head')
  if (!(await bodeHead.getByRole('button', { name: 'phase', exact: true }).count())) {
    fail('the phase toggle should live on the Bode pane header')
  }
  const withPhase = (await canvasHashes())[0]
  await bodeHead.getByRole('button', { name: 'no phase', exact: true }).click()
  await settle()
  if ((await canvasHashes())[0] === withPhase) fail('the phase toggle should redraw the Bode pane')
  await bodeHead.getByRole('button', { name: 'phase', exact: true }).click()
  await settle()
  console.log('   controls live on the panes they govern; the phase toggle redraws')

  // The sidebar names its cards with the loop's symbols — the topbar, the
  // diagram and the math panel all speak C(s) and P(s), and the cards must
  // say which is which.
  const plantH2 = await page.locator('#plant h2').textContent()
  const ctrlH2 = await page.locator('#controller h2').textContent()
  if (!/P\(s\)/.test(plantH2)) fail(`the Plant card should say P(s); it reads "${plantH2}"`)
  if (!/C\(s\)/.test(ctrlH2)) fail(`the Controller card should say C(s); it reads "${ctrlH2}"`)
  // The controller card comes BEFORE the plant card: every lesson is about
  // the controller, and the plant's Gain K must not be the first slider on
  // a lesson that says "raise Kp".
  const order = await page.evaluate(() => {
    const c = document.getElementById('controller').getBoundingClientRect().top
    const p = document.getElementById('plant').getBoundingClientRect().top
    return c < p
  })
  if (!order) fail('the controller card should sit above the plant card')
  // And the sidebar math well is gone — the math is a pane tab now.
  if (await page.locator('.controls .math').count()) fail('the math should no longer live in the sidebar')

  // The custom plant's equation is defined LIVE under its coefficients:
  // type a value, see it in the typeset H(s).
  await clickPreset('Custom H(s)')
  const texBefore = await page.locator('.live-tf').innerHTML()
  await setField('b₀', 5)
  const texAfter = await page.locator('.live-tf').innerHTML()
  if (texBefore === texAfter) fail('editing a coefficient should re-typeset the live H(s)')
  if (!/5/.test(texAfter)) fail('the live H(s) should carry the coefficient just typed')
  // The broken case the live formula itself exposed: a fractional
  // coefficient once snapped to the default step of 1 and became 0.
  await setField('a₂', 0.0001)
  const mantissa = await page.getByRole('spinbutton', { name: 'a₂' }).first().inputValue()
  if (mantissa === '0') fail('a coefficient of 1e-4 snapped to 0 — the step is wrong again')
  const texTiny = await page.locator('.live-tf').innerHTML()
  if (!/s\^?/.test(texTiny) || texTiny === texAfter) {
    fail('a small a₂ should put an s² term into the live H(s)')
  }
  console.log('   the custom plant typesets the equation being defined, live — tiny coefficients included')
  await clickPreset('First order lag')
  await clickBtn('Step')
}

// ------------------------------------ 4e. arriving from Circuit Lab, oriented

console.log('\n4e. Arrival from a circuit: named, oriented, the drive labelled\n')
{
  // Via about:blank: navigating from the loaded page to the same URL plus a
  // hash is a same-document navigation, and the app's startup link read
  // never re-runs.
  await page.goto('about:blank')
  await page.goto(
    `${URL}#plant=firstOrder:1:1&ctrl=p:9&from=circuit:rc:${encodeURIComponent('My RC low-pass')}`,
    { waitUntil: 'load' },
  )
  await page.waitForSelector('.views canvas')
  await page.waitForTimeout(400)

  const banner = await page.locator('.hint.from-link').first().textContent()
  if (!/My RC low-pass/.test(banner)) fail('arrival: the banner should name the circuit')

  // The orientation notice names the SAME number the top bar shows — the
  // exact confusion this exists for ("whose steady error is this?").
  const notice = (await page.locator('.hint.from-link').nth(1).textContent()) || ''
  const errShown = (await topbar())['steady error']
  if (!/CLOSED LOOP/.test(notice)) fail('arrival: the orientation notice is missing')
  if (!notice.includes(errShown.replace('%', ''))) {
    fail(`arrival: the notice should name the top bar's steady error (${errShown}); it reads "${notice}"`)
  }

  // The diagram titles the P(s) box as the circuit, keeps the named plant as
  // the subtitle, and labels the drive into the plant under P-control.
  await page.getByRole('button', { name: '⧉ diagram' }).click()
  await page.waitForTimeout(200)
  let svgText = await page.locator('.fd-svg').textContent()
  if (!/My RC low-pass/.test(svgText)) fail('diagram: the P(s) box should be titled as the circuit')
  if (!/First order lag/.test(svgText)) fail('diagram: the named plant should remain as the subtitle')
  if (!/driven by Kp·\(r − y\)/.test(svgText)) fail('diagram: the drive label should show under P-control')
  await page.keyboard.press('Escape')
  await settle()

  // Switching to PI erases the error — the notice must follow, and the Kp
  // drive label is proportional control's alone.
  await clickBtn('PI')
  const noticePI = (await page.locator('.hint.from-link').nth(1).textContent()) || ''
  if (!/erased exactly/.test(noticePI)) fail('arrival: after PI the notice should say the error is erased')
  await page.getByRole('button', { name: '⧉ diagram' }).click()
  await page.waitForTimeout(200)
  if (/driven by Kp/.test(await page.locator('.fd-svg').textContent())) {
    fail('diagram: the Kp drive label should not outlive proportional control')
  }
  await page.keyboard.press('Escape')
  await settle()

  // Choosing a different plant sheds the borrowed identity.
  await clickPreset('Three lags')
  await page.getByRole('button', { name: '⧉ diagram' }).click()
  await page.waitForTimeout(200)
  if (/My RC low-pass/.test(await page.locator('.fd-svg').textContent())) {
    fail('diagram: provenance should not survive choosing a different plant')
  }
  await page.keyboard.press('Escape')
  await settle()
  console.log('   circuit named in banner and diagram; notice tracks the controller; identity sheds on plant change')

  // The reverse hand-over is exact-only AND deployed-only: on a bare dev
  // port there is no Circuit Lab beside this page, so nothing is drawn.
  // (The mapping itself is measured in toCircuitLab.test.js.)
  await clickPreset('First order lag')
  if (await page.locator('.circuit-back').count()) {
    fail('the "Open in Circuit Lab" line should not render where the sibling URL resolves to null')
  }

  // A clean page for the sections after this one (blank first, same reason).
  await page.goto('about:blank')
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await page.waitForTimeout(400)
}

// ------------------------------------------------ A11Y. names for everything

console.log('\nA11y: every control has a name, every plot has a label\n')
{
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
      if (!nameOf(el)) {
        const tag = el.tagName.toLowerCase()
        const cls = (el.className || '').toString().slice(0, 40)
        problems.push(`${tag}.${cls || '?'} has no accessible name`)
      }
    }
    for (const c of document.querySelectorAll('canvas')) {
      if (c.getAttribute('role') !== 'img' || !c.getAttribute('aria-label')) {
        problems.push('canvas without role="img" + aria-label')
      }
    }
    return [...new Set(problems)]
  })
  if (audit.length) for (const p of audit) fail(`a11y: ${p}`)
  else console.log('   no unnamed controls, no unlabelled plots')
}

// ----------------------------------------------------------------- 5. at 4K

console.log('\n5. Layout at 4K\n')
await page.setViewportSize({ width: 3840, height: 2160 })
await page.waitForTimeout(500)
for (const p of plants) {
  await clickPreset(p)
  if (await scrolls()) fail(`4K / ${p}: page scrolls`)
}
// The watch view adds a transport row inside the pane; the layout budget
// must absorb it at 4K too.
await clickBtn('Watch')
if (await scrolls()) fail('4K / watch view: page scrolls')
await clickBtn('Step')
console.log(`   all ${plants.length} plants fit at 3840x2160, watch view included`)

// ------------------------------------------------------------ 6. at phone size

console.log('\n6. Phone width\n')
{
  // The layout stacks below 900px, so vertical scroll is expected there —
  // HORIZONTAL scroll is the failure (a control clipped off the right edge
  // is how Signal Lab's Window select shipped broken at 390px).
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(500)
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  if (sideways) fail('390px: the page scrolls horizontally')
  await clickBtn('Watch')
  const sideways2 = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  if (sideways2) fail('390px / watch view: the page scrolls horizontally')
  await clickBtn('Step')
  console.log('   no horizontal scroll at 390px, watch view included')
}

// ------------------------------------ 7. the fold: every lesson's knob on screen

console.log('\n7. Fold probe at 1366×768 and 1440×900\n')
{
  // For every lesson: the try line, the featured knob(s), the controller
  // card's header and the active lesson chip must sit inside the viewport
  // with the sidebar at the top — the way a student finds it.
  const lessonNames = await page.evaluate(() =>
    [...document.querySelectorAll('#lessons details.preset-group .preset')].map((b) => b.textContent.trim()),
  )
  // Each lesson's featured keys, read off the page after loading it (React
  // renders after the click settles, so this cannot be one in-page loop).
  const featuredOf = {}
  for (const name of lessonNames) {
    await loadLesson(name)
    featuredOf[name] = await page.evaluate(() =>
      [...document.querySelectorAll('.featured')].map((f) => f.dataset.featured),
    )
  }
  // The deployed page carries the LabNav row above the title (26 px); a dev
  // port has no siblings so it hides. Stand a placeholder in, so the fold
  // measured here is the fold a student gets on the site.
  const withLabNav = (pg) =>
    pg.evaluate(() => {
      if (document.querySelector('.labnav, .labnav-stand-in')) return
      const h = document.querySelector('.controls header')
      if (h) h.insertAdjacentHTML('afterbegin', '<div class="labnav-stand-in" style="height:16px;margin:0 0 10px"></div>')
    })
  const cases = lessonNames.map((name) => ({
    name,
    load: async (pg) => {
      await pg.waitForSelector('.views canvas')
      await withLabNav(pg)
      await loadLesson(name)
    },
    must: [
      '.try-line',
      ...(featuredOf[name] || []).map((k) => `.featured[data-featured="${k}"]`),
      '#controller h2',
      '#lessons .preset.is-on',
    ],
  }))
  const res = await foldProbe(page, { cases, url: URL })
  for (const m of res.measured) {
    if (m.viewport === '1440x900' && /data-featured/.test(m.control) && m.box) {
      console.log(`   ${m.viewport} ${m.lesson.padEnd(34)} ${m.control.padEnd(34)} y ${m.box.y.toFixed(0)}–${(m.box.y + m.box.height).toFixed(0)}`)
    }
  }
  for (const f of res.failures) fail(`fold: ${f}`)
  console.log(`   ${res.ok ? 'every lesson\'s try line, knob, controller header and chip inside the fold' : res.failures.length + ' fold failures'}`)

  // Phone: the lesson's named view in the first screen.
  const phone = await phoneProbe(page, {
    url: URL,
    cases: ['Proportional cannot get there', 'Watch the integrator take over'].map((name) => ({
      name,
      load: async (pg) => {
        await pg.waitForSelector('.views canvas')
        await loadLesson(name)
      },
      must: ['.views .view.is-primary canvas'],
    })),
  })
  for (const m of phone.measured) {
    if (m.box) console.log(`   390x844 ${m.lesson.padEnd(34)} view canvas y ${m.box.y.toFixed(0)}–${(m.box.y + m.box.height).toFixed(0)}`)
  }
  for (const f of phone.failures) fail(`phone: ${f}`)
  console.log(`   ${phone.ok ? 'phone: the lesson\'s view is in the first screen' : phone.failures.length + ' phone failures'}`)
}

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
