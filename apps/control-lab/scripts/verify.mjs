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
