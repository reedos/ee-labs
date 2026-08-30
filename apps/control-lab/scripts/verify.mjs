// End-to-end verification for Control Lab, in a real browser.
//
// The unit tests compose loops directly. This drives the page, and its most
// valuable check is one the unit tests cannot make: that the number in the
// topbar predicts what happens when you act on it. The gain margin claims the
// loop can take so much more gain before it sings — so the harness turns the
// gain up to just under it and just over it, and requires the app to agree.

import { chromium } from 'playwright'

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

async function openMath() {
  const t = page.locator('.math-toggle[aria-expanded="false"]')
  if (await t.count()) {
    await t.first().click()
    await page.waitForTimeout(150)
  }
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
  await page.getByRole('button', { name, exact: true }).click()
  await settle()
}

const plants = ['First order lag', 'Integrator', 'Second order', 'Motor position', 'Three lags', 'Unstable plant']
const ctrls = ['Proportional', 'PI', 'PID', 'Lead']

// ------------------------------------- 1. every plant against every controller

console.log(`\n1. All ${plants.length} plants x ${ctrls.length} controllers\n`)
for (const p of plants) {
  const row = []
  for (const c of ctrls) {
    await clickBtn(p)
    await clickBtn(c)
    await openMath()
    const bad = (await readChecks()).filter((r) => r.mark === '✗')
    for (const b of bad) fail(`${p} + ${c}: ✗ ${b.label} (theory ${b.theory}, measured ${b.measured})`)
    if (await scrolls()) fail(`${p} + ${c}: page scrolls`)
    row.push(`${c}:${bad.length ? bad.length + '✗' : 'ok'}`)
  }
  console.log(`   ${p.padEnd(18)} ${row.join('  ')}`)
}

// ------------------------------- 2. does the gain margin predict what happens?

console.log('\n2. Does the gain margin actually predict instability?\n')
await clickBtn('Three lags')
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
await clickBtn('First order lag')
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
await clickBtn('First order lag')
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

// The unstable plant fails the other way round: too LITTLE gain is the problem.
await clickBtn('Unstable plant')
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
await clickBtn('Second order')
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
await clickBtn('Three lags')
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
await clickBtn('Three lags')
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
  await clickBtn(p)
  if (await scrolls()) fail(`4K / ${p}: page scrolls`)
}
console.log(`   all ${plants.length} plants fit at 3840x2160`)

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
