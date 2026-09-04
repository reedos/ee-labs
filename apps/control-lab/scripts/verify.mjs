// End-to-end verification for Control Lab, in a real browser.
//
// The unit tests compose loops directly. This drives the page, and its most
// valuable check is one the unit tests cannot make: that the number in the
// topbar predicts what happens when you act on it. The gain margin claims the
// loop can take so much more gain before it sings — so the harness turns the
// gain up to just under it and just over it, and requires the app to agree.

import { chromium } from 'playwright'
import { foldProbe, phoneProbe, PHONE_VIEWPORT } from '@ee-labs/ui/verify/foldProbe.mjs'
import { tapTargetProbe, FLOOR, HARD_FLOOR } from '@ee-labs/ui/verify/tapTargetProbe.mjs'
// Defect 2's own cue table, imported rather than re-typed: item 33 below
// scans what is ACTUALLY on screen with the same CUES the app itself scans
// lesson prose against, so a future cue word landing only inside a
// formatted number cannot ship past this probe unnoticed a second time.
import { CUES, TERMS } from '../src/terms.js'

const URL = process.env.APP_URL || 'http://localhost:4176'
const failures = []
const fail = (m) => failures.push(m)

const browser = await chromium.launch()
// hasTouch: the item-32 probes must press with a real tap (.tap()), not a
// mouse click standing in for one — Playwright refuses .tap() without it.
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, hasTouch: true })

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

/**
 * Text-overlap probing for the canvases (items 24, 25, 27): hook
 * fillText and lineTo on every CanvasRenderingContext2D so a probe can ask,
 * after a redraw, exactly what text was painted where and what the traces'
 * own pixel paths were — the only way to catch a caption printed over
 * another caption, or over a trace, from outside the canvas.
 *
 * useCanvas (packages/ui) calls ctx.setTransform(dpr,...) before every draw,
 * so fillText/lineTo coordinates ARE CSS pixels; no DPR conversion needed
 * here. A ResizeObserver in useCanvas redraws on any element resize
 * regardless of React's own deps, so nudging the viewport (or any layout
 * change that resizes the canvas) is enough to force a fresh, hooked draw.
 */
async function installProbeHooks(page) {
  await page.evaluate(() => {
    window.__texts = []
    window.__lines = []
    window.__arcs = []
    if (window.__probeHooked) return
    window.__probeHooked = true
    let nextId = 1
    const idOf = (canvas) => {
      if (!canvas.dataset.probeId) canvas.dataset.probeId = String(nextId++)
      return canvas.dataset.probeId
    }
    const origFillText = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      const w = this.measureText(text).width
      const align = this.textAlign || 'start'
      const baseline = this.textBaseline || 'alphabetic'
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font)
      const fontPx = m ? parseFloat(m[1]) : 10
      let left = x
      if (align === 'center') left = x - w / 2
      else if (align === 'right' || align === 'end') left = x - w
      let top = y
      if (baseline === 'middle') top = y - fontPx / 2
      else if (baseline === 'bottom') top = y - fontPx
      else if (baseline === 'alphabetic') top = y - fontPx * 0.8
      window.__texts.push({ canvas: idOf(this.canvas), text, x: left, y: top, w, h: fontPx })
      return origFillText.apply(this, arguments)
    }
    // lineTo/arc record through the CURRENT TRANSFORM, not the raw
    // arguments: the root locus's cancelling/near-merge marks are drawn
    // after a ctx.translate (LocusCanvas.jsx nudges the pole one way, the
    // zero the other, to pull two coincident or near-coincident points
    // apart), and that offset is invisible in the raw path arguments — it
    // is applied by the canvas only at stroke time. Nothing else in this
    // app's canvases rotates a line or an arc, so this is a pure
    // translation everywhere else too (identity where nothing translated),
    // and item 30's legibility check needs the ACTUAL screen position.
    const origLineTo = CanvasRenderingContext2D.prototype.lineTo
    CanvasRenderingContext2D.prototype.lineTo = function (x, y) {
      const p = this.getTransform().transformPoint(new DOMPoint(x, y))
      window.__lines.push({ canvas: idOf(this.canvas), x: p.x, y: p.y, color: String(this.strokeStyle) })
      return origLineTo.apply(this, arguments)
    }
    // A circle mark (root locus's open-loop zeros, among others) is drawn
    // with ctx.arc, never ctx.lineTo — item 30's pole/zero legibility check
    // needs to see the zero's own circle, not just the pole's cross.
    const origArc = CanvasRenderingContext2D.prototype.arc
    CanvasRenderingContext2D.prototype.arc = function (x, y, radius, startAngle, endAngle) {
      const p = this.getTransform().transformPoint(new DOMPoint(x, y))
      window.__arcs.push({ canvas: idOf(this.canvas), x: p.x, y: p.y, radius, color: String(this.strokeStyle) })
      return origArc.apply(this, arguments)
    }
  })
}

/** Force every hooked canvas to redraw (see installProbeHooks) and read back what it painted. */
async function probeDraw(page, act) {
  await page.evaluate(() => {
    window.__texts = []
    window.__lines = []
    window.__arcs = []
  })
  await act()
  await page.waitForTimeout(250)
  return page.evaluate(() => ({
    texts: window.__texts || [],
    lines: window.__lines || [],
    arcs: window.__arcs || [],
  }))
}

/** Do two axis-aligned boxes overlap by more than a hairline (`tol` px)? */
function boxesOverlap(a, b, tol = 1) {
  return a.x < b.x + b.w - tol && a.x + a.w > b.x + tol && a.y < b.y + b.h - tol && a.y + a.h > b.y + tol
}

/**
 * useCanvas's effect calls render() once directly AND creates a fresh
 * ResizeObserver that (per spec) fires its own initial callback for the
 * newly-observed canvas — so every deps-triggered redraw draws everything
 * TWICE, bit-identically. That is not the bug this probe looks for (two
 * IDENTICAL boxes are the same paint, not an overprint), so duplicates are
 * collapsed before anything is compared.
 */
function dedupeTexts(texts) {
  const seen = new Set()
  const out = []
  for (const t of texts) {
    const key = `${t.canvas}|${t.text}|${Math.round(t.x)}|${Math.round(t.y)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

/** Every pair of text boxes on the SAME canvas, checked for overlap. */
function findTextOverlaps(texts) {
  const problems = []
  const byCanvas = new Map()
  for (const t of dedupeTexts(texts)) {
    if (!byCanvas.has(t.canvas)) byCanvas.set(t.canvas, [])
    byCanvas.get(t.canvas).push(t)
  }
  for (const group of byCanvas.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (boxesOverlap(group[i], group[j])) {
          problems.push(`"${group[i].text}" overlaps "${group[j].text}"`)
        }
      }
    }
  }
  return problems
}

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
  if (!/steady-state error 0/.test(distReadout)) fail('after the PI chip the disturbance should be erased')
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
  await page.locator('.try-line .chip', { hasText: '0.9 × gain margin' }).click()
  await settle()
  if (!(await isStable())) fail('0.9 × gain margin should leave the loop stable')
  await page.locator('.try-line .chip', { hasText: '1.1 × gain margin' }).click()
  await settle()
  if (await isStable()) fail('1.1 × gain margin should tip the loop unstable')
  console.log('   the 0.9× / 1.1× gain-margin chips bracket the boundary')

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
const erased = /steady-state error 0/.test(distText)
console.log(`   disturbance under PI: ${erased ? 'steady-state error 0, the integrator removes it' : 'not erased'}`)
if (!erased) fail('PI should erase a plant-input disturbance exactly')
await clickBtn('Reference')

// The settle readout confesses when the plot's right edge arrives first: a
// very slow loop's plot is capped at 400 s, and there the trace is visibly
// short of the destination the readout names.
await clickPreset('Integrator')
await clickBtn('Proportional')
await setField('Kp', 0.005)
const slowText = await page.locator('.readout').last().textContent()
const flagged = /not settled/.test(slowText)
console.log(`   slow loop at the 400 s cap: ${flagged ? 'flagged as not settled' : 'NOT flagged'}`)
if (!flagged) fail('a loop that cannot settle inside the plot should say so in the readout')
await setField('Kp', 1)
if (/not settled/.test(await page.locator('.readout').last().textContent())) {
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
  // settled — slider 60 of 600, early in whatever window the loop's own
  // settling time earns it. The old threshold of 0.3 "passed" only because
  // the readout printed "223 m" and the parse read it as 223 — a check
  // green on the very bug the audit removed.
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

// ------------------------------------------------- 6b. Reed's Math tab report
//
// Reed's own report: "on mobile phone, if you scroll down and click the math
// button to the right of root locus, the plots become absurdly tall and do
// not revert to a good shape." Two halves, both probed — a probe that only
// checked the first would have missed the half he actually noticed:
//   (a) opening Math must not make ANY plot (Bode's included, not just the
//       lesson's own) absurdly tall, and
//   (b) switching back to another view must restore that plot to (within a
//       few px of) the height it had before Math was ever opened — including
//       after Math has been toggled on and off more than once.
//
// Cause: the lower row is a CSS Grid `1fr 1fr` track inside `.views`, which
// itself sits in a phone `.app` whose height is `auto` (min-height: 100dvh
// is only a floor). With an indefinite container height, Grid resolves every
// `1fr` track from the SAME flex-fraction — the largest max-content
// contribution of ANY track's content, applied to every track alike. The
// Math pane is real KaTeX prose, easily 1500-2000px tall on a narrow phone;
// opening it inflated both rows to match, Bode's canvas included, though
// Bode has no content of its own demanding that height. Switching back did
// not revert it because useCanvas.js (packages/ui, not owned by this app)
// burns the measured box straight into the canvas's own width/height
// attributes, which become its intrinsic size and feed right back into the
// same max-content calculation on the NEXT layout — so the row stayed
// inflated even with Math gone. Fixed locally in this app's styles.css by
// pinning every phone plot (canvas or math pane) to a flat height, so no
// pane ever contributes indefinite content to the grid's track sizing.
console.log('\n6b. Math tab on phone: no plot goes absurdly tall, and switching back restores it\n')
{
  // Four lessons, four different default ("primary") views — the weighted
  // split hands the named view a bigger share of the row, and that share is
  // exactly what the Math pane's real content used to blow out.
  const phoneMathLessons = [
    { name: 'Proportional cannot get there', view: 'Step' },
    { name: 'Watch the integrator take over', view: 'Watch' },
    { name: 'Everything is about one point', view: 'Nyquist' },
    { name: 'Watch the poles cross', view: 'Root locus' },
  ]
  const mathViewports = [
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 768, height: 1024 },
  ]

  // The PRIMARY pane is whichever section carries `.is-primary` (the lower,
  // lesson-named pane on a weighted lesson) — it is the one whose content
  // swaps between a canvas and the Math pane. BODE is the always-on pane
  // beside it, which should show nothing of Math's but is exactly the pane
  // that inflated too, since a `1fr` grid track's blow-out is not confined
  // to the track that caused it.
  const measurePanes = () =>
    page.evaluate(() => {
      const out = {}
      for (const sec of document.querySelectorAll('.views > .view')) {
        const el = sec.querySelector('canvas.plot') || sec.querySelector('.math-pane')
        if (!el) continue
        const r = el.getBoundingClientRect()
        out[sec.classList.contains('is-primary') ? 'primary' : 'bode'] = {
          tag: el.className,
          h: r.height,
          w: r.width,
        }
      }
      return out
    })

  const checkBound = (panes, bound, when, vp, name) => {
    for (const key of ['primary', 'bode']) {
      const p = panes[key]
      if (!p) continue
      if (p.h > bound) {
        fail(
          `phone math/${vp.width}x${vp.height}/${name}: ${when} the ${key} pane (${p.tag}) is ${p.h.toFixed(0)}px tall — over the ${bound.toFixed(0)}px bound (45% of the ${vp.height}px viewport)`,
        )
      }
      if (p.h > p.w * 2) {
        fail(
          `phone math/${vp.width}x${vp.height}/${name}: ${when} the ${key} pane (${p.tag}) is ${p.h.toFixed(0)}x${p.w.toFixed(0)} — more than twice as tall as it is wide`,
        )
      }
    }
  }

  for (const vp of mathViewports) {
    await page.setViewportSize(vp)
    const bound = vp.height * 0.45
    for (const { name, view } of phoneMathLessons) {
      await page.goto(URL, { waitUntil: 'networkidle' })
      await page.waitForSelector('.views canvas')
      await loadLesson(name)

      // Reed's own path: scroll down FIRST, then open Math.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(80)
      const before = await measurePanes()
      checkBound(before, bound, 'before Math', vp, name)

      await clickBtn('Math')
      await page.waitForTimeout(120)
      const afterMath = await measurePanes()
      checkBound(afterMath, bound, 'after opening Math', vp, name) // half (a)

      await clickBtn(view)
      await page.waitForTimeout(120)
      const afterBack = await measurePanes()
      checkBound(afterBack, bound, 'after switching back', vp, name)

      // Repeated toggling — "does not revert" is the half a one-shot check
      // would miss, so toggle twice more before measuring again.
      await clickBtn('Math')
      await clickBtn(view)
      await clickBtn('Math')
      await clickBtn(view)
      await page.waitForTimeout(120)
      const afterRepeat = await measurePanes()
      checkBound(afterRepeat, bound, 'after repeated toggling', vp, name)

      // Half (b): the shape must come BACK, not merely stay under the bound.
      for (const [snapLabel, snap] of [
        ['switching back once', afterBack],
        ['toggling repeatedly', afterRepeat],
      ]) {
        for (const key of ['primary', 'bode']) {
          const b0 = before[key]
          const b1 = snap[key]
          if (!b0 || !b1) continue
          if (Math.abs(b1.h - b0.h) > 4) {
            fail(
              `phone math/${vp.width}x${vp.height}/${name}: after ${snapLabel}, the ${key} pane did not revert — was ${b0.h.toFixed(0)}px before Math, is ${b1.h.toFixed(0)}px now`,
            )
          }
        }
      }

      console.log(
        `   ${vp.width}x${vp.height} ${name.padEnd(34)} primary before ${before.primary?.h.toFixed(0)}px, ` +
          `Math ${afterMath.primary?.h.toFixed(0)}px, reverted ${afterBack.primary?.h.toFixed(0)}px, ` +
          `after repeat ${afterRepeat.primary?.h.toFixed(0)}px (bode held at ${before.bode?.h.toFixed(0)}/${afterMath.bode?.h.toFixed(0)}px)`,
      )
    }

    // Reverse order, once per viewport: open Math FIRST, then scroll — the
    // bound must hold either way round.
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.waitForSelector('.views canvas')
    await loadLesson(phoneMathLessons[0].name)
    await clickBtn('Math')
    await page.waitForTimeout(120)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(80)
    const reversePanes = await measurePanes()
    checkBound(reversePanes, bound, 'Math opened before scrolling', vp, phoneMathLessons[0].name)
  }
  console.log(
    '   Math tab on phone: no plot ever exceeds 45% of the viewport, and every plot returns to its pre-Math height on switching back — including after repeated toggling and in reverse order',
  )
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

  // Phone: the lesson's named view in the first screen — lessons 1, 3 and 9,
  // spanning the step/watch/nyquist views (item 23).
  const phoneLessons = [
    'Proportional cannot get there', // lesson 1, step
    'Watch the integrator take over', // lesson 3, watch
    'Everything is about one point', // lesson 9, nyquist
  ]
  const phone = await phoneProbe(page, {
    url: URL,
    cases: phoneLessons.map((name) => ({
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

  // Phone: the note title and try line must sit inside the SIDEBAR's own
  // visible box — its clipped max-height (.app.has-lesson .controls, 40vh =
  // 338px at 844px tall), not the page's full 844px. foldProbe's generic
  // check above cannot see this bug: the PAGE never scrolls (only .controls
  // does internally), so an element sitting past the sidebar's clipped
  // bottom still reports a y comfortably inside 844 and would pass a plain
  // viewport check — which is exactly how "note at y 411, try line at y 488,
  // both past the 338px box" shipped unnoticed.
  await page.setViewportSize(PHONE_VIEWPORT)
  for (const name of phoneLessons) {
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.waitForSelector('.views canvas')
    await loadLesson(name)
    await page.evaluate(() => {
      const el = document.querySelector('.controls')
      if (el) el.scrollTop = 0
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(60)
    const sidebar = await page.locator('.controls').boundingBox()
    const title = await page.locator('.note-title').first().boundingBox()
    const tryLine = await page.locator('.try-line').first().boundingBox()
    for (const [label, box] of [
      ['note title', title],
      ['try line', tryLine],
    ]) {
      if (!box) {
        fail(`phone/${name}: ${label} not rendered`)
        continue
      }
      if (box.y < sidebar.y - 0.5 || box.y + box.height > sidebar.y + sidebar.height + 0.5) {
        fail(
          `phone/${name}: ${label} outside the sidebar's visible box (${box.y.toFixed(0)}–${(box.y + box.height).toFixed(0)} vs sidebar ${sidebar.y.toFixed(0)}–${(sidebar.y + sidebar.height).toFixed(0)})`,
        )
      }
    }
    console.log(`   390x844 ${name.padEnd(34)} note title + try line inside the sidebar's ${sidebar.height.toFixed(0)}px box`)
  }
}

// ------------------------------------------------------- 8. text overprints

console.log('\n8. Overprinting captions and labels (items 24, 25, 26, 27)\n')

// 24: the watch view's prose captions vs the liveValue readouts, on a
// narrow (< 500px) canvas — "the error e (dashed) — its gain stretches it
// into Kp·e" used to run into "Kp·e = −0.1" on the same line.
{
  await page.setViewportSize(PHONE_VIEWPORT)
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('.views canvas')
  await loadLesson('Watch the integrator take over')
  await installProbeHooks(page)
  const slider = page.getByRole('slider', { name: 'Moment in the response' })
  const { texts } = await probeDraw(page, () => slider.fill('300'))
  const watchId = await page.evaluate(
    () => document.querySelector('canvas[aria-label^="The loop watched"]')?.dataset.probeId,
  )
  const watchTexts = dedupeTexts(texts.filter((t) => t.canvas === watchId))
  const overlaps24 = findTextOverlaps(watchTexts)
  for (const o of overlaps24) fail(`watch view narrow captions: ${o}`)
  console.log(
    `   390px watch canvas: ${watchTexts.length} labels drawn, ${overlaps24.length ? overlaps24.length + ' OVERLAPS' : 'no overlaps'}`,
  )
}

// 25: the Nyquist "−1" / GM / PM labels at the boundary gain, where the
// curve passes through −1 exactly and all three used to land on top of
// each other. Wide: stacked and readable. Narrow (< 500px): dropped.
// Each viewport gets its OWN fresh navigation and its own "act" that
// changes React state directly (clicking the crossing chip again, an
// idempotent value that still creates new ctrlP/loop objects) — a viewport
// resize alone is not a reliable redraw trigger here: useCanvas's
// ResizeObserver only re-fires when the CANVAS ELEMENT's own rect actually
// changes, and a small viewport nudge can be absorbed entirely by
// surrounding flex layout without moving the canvas at all.
{
  const nyqId = () =>
    page.evaluate(() => document.querySelector('canvas[aria-label^="Nyquist plot"]')?.dataset.probeId)
  const setup = async (vp) => {
    await page.setViewportSize(vp)
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.waitForSelector('.views canvas')
    await loadLesson('Everything is about one point')
    await page.locator('.try-line .chip', { hasText: /on the axis/ }).click()
    await settle()
  }

  await setup({ width: 1440, height: 900 })
  await installProbeHooks(page)
  let { texts } = await probeDraw(page, () =>
    page.locator('.try-line .chip', { hasText: /on the axis/ }).click(),
  )
  let id = await nyqId()
  let nyqTexts = dedupeTexts(texts.filter((t) => t.canvas === id))
  const haveGM = nyqTexts.some((t) => /^GM/.test(t.text))
  const havePM = nyqTexts.some((t) => /^PM/.test(t.text))
  if (!haveGM || !havePM) {
    fail(`nyquist wide: expected GM and PM labels at the boundary gain, got [${nyqTexts.map((t) => t.text).join(', ')}]`)
  }
  const overlaps25 = findTextOverlaps(nyqTexts)
  for (const o of overlaps25) fail(`nyquist 1440x900 at Kp≈11.25: ${o}`)
  console.log(
    `   1440x900 nyquist at the boundary gain: ${nyqTexts.map((t) => t.text).join(' / ')} — ${overlaps25.length ? overlaps25.length + ' OVERLAPS' : 'no overlaps'}`,
  )

  await setup(PHONE_VIEWPORT)
  await installProbeHooks(page)
  ;({ texts } = await probeDraw(page, () =>
    page.locator('.try-line .chip', { hasText: /on the axis/ }).click(),
  ))
  id = await nyqId()
  nyqTexts = dedupeTexts(texts.filter((t) => t.canvas === id))
  if (nyqTexts.some((t) => /^GM|^PM/.test(t.text))) {
    fail(`nyquist narrow (390px): GM/PM labels should be dropped, got [${nyqTexts.map((t) => t.text).join(', ')}]`)
  }
  console.log(
    `   390px nyquist at the boundary gain: GM/PM labels dropped (left: ${nyqTexts.map((t) => t.text).join(', ') || 'none'})`,
  )
}

// 26: the flow strip's verdict sentence must not force a clip a reader
// never thinks to scroll for — no .flow-node (or its em) may run wider than
// itself at phone width. (.flow itself is DELIBERATELY horizontally
// scrollable — that is not the bug — so only the nodes inside it are
// checked, not the strip's own container.)
{
  await page.setViewportSize(PHONE_VIEWPORT)
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('.views canvas')
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('.flow-node, .flow-node em')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.className || el.tagName} (${el.scrollWidth} > ${el.clientWidth})`),
  )
  for (const c of clipped) fail(`flow strip clips at 390px: ${c}`)
  console.log(`   390px flow strip: ${clipped.length ? clipped.length + ' CLIPPED nodes' : 'no node scrolls past its own width'}`)
}

// 27: the Bode "gain = 1" label must sit clear of both the magnitude and
// phase traces — checked on L11 ("The plant that needs feedback", where it
// used to overprint the phase trace, top right) at 1440x900 and on phone.
// The redraw is forced by toggling the phase overlay off then back ON — a
// real prop change (showPhase), not a viewport nudge the canvas might not
// actually resize for — landing on the same showPhase=true the bug needs.
{
  const magColor = '#38e0b0' // COLORS.trace
  const phaseColor = '#b98cf0' // COLORS.phase
  for (const vp of [{ width: 1440, height: 900 }, PHONE_VIEWPORT]) {
    await page.setViewportSize(vp)
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.waitForSelector('.views canvas')
    await loadLesson('The plant that needs feedback')
    // The lesson now LOADS at Kp = 0.5 (item 2, student review: the latch is
    // the first picture, not a chip away) — and at that gain the open loop's
    // DC magnitude is already 0.5, below 1 forever, so it genuinely has no
    // gain crossover to label. Kp = 5 is the gain the original "gain = 1"
    // overprint bug was filed against, so set it explicitly rather than
    // leaning on whatever the lesson's own default happens to be.
    await setField('Kp', 5)
    const phaseGroup = page.locator('[aria-label="Phase overlay"]')
    await phaseGroup.getByRole('button', { name: 'no phase', exact: true }).click()
    await settle()
    await installProbeHooks(page)
    const { texts, lines } = await probeDraw(page, () =>
      phaseGroup.getByRole('button', { name: 'phase', exact: true }).click(),
    )
    const bodeId = await page.evaluate(
      () => document.querySelector('canvas[aria-label^="Open-loop Bode"]')?.dataset.probeId,
    )
    const label = dedupeTexts(texts).find((t) => t.canvas === bodeId && t.text === 'gain = 1')
    if (!label) {
      fail(`bode ${vp.width}x${vp.height} L11: "gain = 1" label not drawn`)
      continue
    }
    const pad = 2
    const clashing = lines.filter(
      (l) =>
        l.canvas === bodeId &&
        (l.color === magColor || l.color === phaseColor) &&
        l.x >= label.x - pad &&
        l.x <= label.x + label.w + pad &&
        l.y >= label.y - pad &&
        l.y <= label.y + label.h + pad,
    )
    if (clashing.length) {
      fail(`bode ${vp.width}x${vp.height} L11: "gain = 1" label overlaps a trace (${clashing.length} points)`)
    }
    console.log(
      `   ${vp.width}x${vp.height} L11 "gain = 1" label: ${clashing.length ? clashing.length + ' CLASHING trace points' : 'clear of both traces'}`,
    )
  }
}

// ------------------------------------------- 28. terms reachable in the picker
//
// Defect 1: a plant or controller click clears the lesson, and before this
// fix there was nowhere left to look up phase margin, gain margin, "-1",
// the shaded half, or the characteristic equation once that happened.
console.log('\n28. Terms reachable in the picker, no lesson loaded\n')
{
  await clickPreset('First order lag')
  if (await page.locator('.hint.note').count()) fail('picker: a lesson note is still showing after a plant click')
  const link = page.locator('.picker-terms .terms-link')
  if (!(await link.count())) fail('picker: no "terms used here" affordance with no lesson active')
  await link.click()
  await page.waitForTimeout(80)
  const dts = await page.locator('.picker-terms .terms-list dt').allTextContents()
  if (dts.length < 5) fail(`picker: expected several terms offered, found ${dts.length}`)
  for (const want of ['Phase margin', 'Gain margin', 'Crossover frequency', 'Steady-state error']) {
    if (!dts.some((t) => t.trim() === want)) fail(`picker: top bar term "${want}" not offered`)
  }
  console.log(`   First order lag / Proportional, no lesson: ${dts.length} terms offered (${dts.slice(0, 4).join(', ')}...)`)

  // The lower view adds its own vocabulary — the Nyquist view's "-1" (via
  // the Nyquist-plot definition), the locus's shaded half and open- vs
  // closed-loop poles, and the Math tab's characteristic equation.
  await clickBtn('Nyquist')
  const nyqDts = await page.locator('.picker-terms .terms-list dt').allTextContents()
  if (!nyqDts.some((t) => /Nyquist plot/.test(t))) fail('picker: Nyquist view should offer the Nyquist-plot term')

  await clickBtn('Root locus')
  const locusDts = await page.locator('.picker-terms .terms-list dt').allTextContents()
  if (!locusDts.some((t) => /shaded half/i.test(t))) fail('picker: root locus should offer "the shaded half"')
  if (!locusDts.some((t) => /open-loop poles/i.test(t))) fail('picker: root locus should offer open- vs closed-loop poles')

  await clickBtn('Math')
  const mathDts = await page.locator('.picker-terms .terms-list dt').allTextContents()
  if (!mathDts.some((t) => /characteristic equation/i.test(t))) fail('picker: the Math tab should offer the characteristic equation')
  await clickBtn('Step')
  console.log('   Nyquist, root locus and Math each add their own view-specific terms')
}

// --------------------------------------- 29. the gain margin points the right way
//
// Defect 2: the top bar warned on the unstable plant's SAFE margin
// (~0.20x, too little gain being the safe direction there) while a loop
// genuinely thin on its own margin must still warn.
console.log('\n29. The gain margin warns toward the boundary, not by raw size\n')
{
  const gmWarn = () => page.locator('.topbar-field', { hasText: 'gain margin' }).locator('b.warn').count()
  for (const ctrl of ['PI', 'PID']) {
    await clickPreset('Unstable plant')
    await clickBtn(ctrl)
    const warn = await gmWarn()
    const gm = (await topbar())['gain margin']
    console.log(`   Unstable plant + ${ctrl}: gain margin ${gm}, warn styled: ${warn ? 'YES' : 'no'}`)
    if (warn) fail(`Unstable plant + ${ctrl}: gain margin ${gm} is the safe direction and should not warn`)
  }
  // A loop genuinely thin on its own gain margin still must warn.
  await clickPreset('Three lags')
  await clickBtn('Proportional')
  await setField('Kp', 10.7) // just inside the 11.25 boundary
  const thinWarn = await gmWarn()
  const thinGm = (await topbar())['gain margin']
  console.log(`   Three lags + Proportional at Kp 10.7 (near its 11.25 boundary): gain margin ${thinGm}, warn styled: ${thinWarn ? 'yes' : 'NO'}`)
  if (!thinWarn) fail(`a loop genuinely near its own boundary (gain margin ${thinGm}) should warn`)
  await clickPreset('First order lag')
}

// ------------------------------------------------ 30. the root locus framing
//
// Defect 3 and 6: a far zero (Three lags x PI/PID) no longer sets the
// frame, and an exactly-cancelling pole/zero (First order x Lead) is drawn
// legibly rather than as one overlapping mark.
console.log('\n30. Root locus framing: no far zero squeeze, cancellation legible\n')
{
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('.views canvas')

  const readLocusTexts = async (act) => {
    // Force a real redraw: useCanvas's effect fires on a genuine prop
    // change, so the act toggles the controller away and back (same
    // pattern as item 4's "does the view redraw" checks) rather than
    // trying to poke the canvas directly.
    const { texts } = await probeDraw(page, act)
    const id = await page.evaluate(() => document.querySelector('canvas[aria-label^="Root locus"]')?.dataset.probeId)
    return dedupeTexts(texts).filter((t) => t.canvas === id)
  }

  await clickPreset('First order lag')
  await clickBtn('Lead')
  await clickBtn('Root locus')
  await settle()
  await installProbeHooks(page)
  const leadTexts = await readLocusTexts(async () => {
    await clickBtn('Proportional')
    await clickBtn('Lead')
  })
  const cancelLabel = leadTexts.find((t) => /cancel exactly/i.test(t.text))
  if (!cancelLabel) fail('locus: First order x Lead should label the coincident pole and zero as cancelling')
  else console.log(`   First order lag + Lead: "${cancelLabel.text}" drawn on the canvas`)

  // Defect 1, the walk's own repro: dragging the lead's zero away from the
  // plant's pole at -1 by 30%, 50% and 100% (1.3, 1.5, 2.0) must never read
  // "pole and zero cancel exactly" — the old cancelEps, a fraction of THIS
  // frame's own wide extent (this lesson's own lead pole reaches 10-20
  // rad/s), called all three a cancellation and stopped only at 2.0.
  const traceColor = '#38e0b0' // COLORS.trace — the pole's own cross (ctx.lineTo)
  const responseColor = '#5fa8ff' // COLORS.response — the zero's own circle (ctx.arc)
  const lineCenter = (lines, canvasId, color) => {
    const pts = lines.filter((l) => l.canvas === canvasId && l.color === color)
    if (!pts.length) return null
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
  }
  const arcCenter = (arcs, canvasId, color) => {
    const a = arcs.find((a) => a.canvas === canvasId && a.color === color)
    return a ? { x: a.x, y: a.y } : null
  }
  for (const zeroAt of [1.3, 1.5, 2.0]) {
    const { texts, lines, arcs } = await probeDraw(page, () => setField('Zero at', zeroAt))
    const locusId = await page.evaluate(() => document.querySelector('canvas[aria-label^="Root locus"]')?.dataset.probeId)
    const dedup = dedupeTexts(texts).filter((t) => t.canvas === locusId)
    const wrongly = dedup.find((t) => /cancel exactly/i.test(t.text))
    if (wrongly) fail(`locus: zero at ${zeroAt} vs pole -1 (${((zeroAt - 1) * 100).toFixed(0)}% apart) is not a cancellation and must not read "cancel exactly"`)
    // Past the threshold, the walk's second half: the two marks must still
    // read as two, not merge into one indistinguishable blob with nothing
    // said about it.
    const poleC = lineCenter(lines, locusId, traceColor)
    const zeroC = arcCenter(arcs, locusId, responseColor)
    if (!poleC || !zeroC) {
      fail(`locus: zero at ${zeroAt} — pole or zero mark missing from the canvas entirely`)
    } else {
      const d = Math.hypot(poleC.x - zeroC.x, poleC.y - zeroC.y)
      // A mark's own radius is 7px at 1:1 scale, so two centers under 10px
      // apart still overlap visibly; comfortably separated (both a stale
      // raw-blob and a genuine merge-and-offset land in the teens or above)
      // is the actual bar, not merely "not exactly the same point".
      if (d < 10) fail(`locus: zero at ${zeroAt} vs pole -1 — the two marks still overlap on screen (${d.toFixed(1)}px apart)`)
      console.log(`   zero at ${zeroAt} vs pole -1 (${((zeroAt - 1) * 100).toFixed(0)}% apart): ${wrongly ? 'WRONGLY labelled cancelling' : 'no false "cancel exactly"'}, marks ${d.toFixed(1)}px apart`)
    }
  }
  await setField('Zero at', 1) // restored for the sections after this one

  // The frame itself must reframe on a PLANT change while still parked on
  // Root locus, not just on a gain drag — the bug this pinned: switching
  // from First order lag x Lead (extent ~27, just above) straight to Three
  // lags x PID (its own content needs ~6) without ever leaving the locus
  // view once held the wider frame (stickyExtent's hold band reaches down
  // to a sixth of it), which both squeezed the pole cluster AND, with the
  // stale wide extent inflating the cancellation tolerance, mislabelled the
  // PID's own integrator pole and its near-origin zero as an exact
  // cancellation.
  await clickPreset('Three lags')
  await clickBtn('PID')
  await clickBtn('Root locus')
  await settle()
  await installProbeHooks(page)
  const threeLagsPidTexts = await readLocusTexts(async () => {
    await clickBtn('Step')
    await clickBtn('Root locus')
  })
  const wrongCancel = threeLagsPidTexts.find((t) => /cancel exactly/i.test(t.text))
  if (wrongCancel) fail('locus: Three lags x PID should not report a cancellation — its pole and zero are merely close, not exact')
  const axisTick = threeLagsPidTexts.find((t) => t.text === '20' || t.text === '15')
  console.log(`   Three lags + PID reframes on the plant switch: ${wrongCancel ? 'WRONGLY reports a cancellation' : 'no false cancellation'}, real axis reaches ${axisTick ? axisTick.text : '?'} (not the stale 80)`)

  // First order lag x PID: the derivative zero pair puts one zero at -9.9,
  // well past the pole cluster's own frame (extent ~3, widened to ~8.8 on
  // the real axis by the canvas's own aspect) — the far-zero case, distinct
  // from Three lags x PID above, where the SAME zero (-19.8) turns out to
  // sit just inside the aspect-widened frame and draws as an ordinary mark,
  // which is a correct outcome too (the pole cluster, not the zero, still
  // set the scale).
  await clickPreset('First order lag')
  await clickBtn('PID')
  await clickBtn('Root locus')
  await settle()
  await installProbeHooks(page)
  const pidTexts = await readLocusTexts(async () => {
    await clickBtn('Step')
    await clickBtn('Root locus')
  })
  const edgeZero = pidTexts.find((t) => /^zero at/.test(t.text))
  if (!edgeZero) fail('locus: First order lag x PID should mark its far zero at the frame edge rather than losing it')
  else console.log(`   First order lag + PID: far zero marked "${edgeZero.text}"`)
}

// ------------------------------------ 31. the "unstable half" label, on phone
//
// Defect 4: the annotation lost its last word off the right edge at 390px
// on Three lags x PID. Fixed by fitting the longest wording that fits, the
// same fallback ladder packages/ui's pole-zero plot uses.
console.log('\n31. Root locus "unstable half" label does not clip at 390px\n')
{
  await page.setViewportSize(PHONE_VIEWPORT)
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('.views canvas')
  await clickPreset('Three lags')
  await clickBtn('PID')
  await clickBtn('Root locus')
  await settle()
  await installProbeHooks(page)
  const { texts } = await probeDraw(page, async () => {
    await clickBtn('Nyquist')
    await clickBtn('Root locus')
  })
  const locusId = await page.evaluate(() => document.querySelector('canvas[aria-label^="Root locus"]')?.dataset.probeId)
  const box = await page.locator('.views canvas').last().boundingBox()
  const all = dedupeTexts(texts).filter((t) => t.canvas === locusId)
  // Any rung of the fallback ladder (LocusCanvas.jsx) counts as present —
  // the point of the fallback is that a narrow canvas gets the SHORTER
  // wording instead of a clipped long one, so the short form is success,
  // not failure.
  const label = all.find((t) => /unstable half|a pole here grows/.test(t.text))
  if (!label) fail('locus phone: no "unstable half" annotation (any wording) drawn at 390px')
  else {
    const clipped = label.x + label.w > box.width + 1
    console.log(`   390px Three lags + PID: "${label.text}" (${label.x.toFixed(0)}-${(label.x + label.w).toFixed(0)} of ${box.width.toFixed(0)}px), ${clipped ? 'CLIPPED' : 'fits'}`)
    if (clipped) fail(`locus phone: "${label.text}" runs past the canvas's right edge`)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
}

// --------------------------------------------- 32. hover-only explanations
//
// Defect 5: the crossover field's rad/s conversion and the Math tab's "[N]"
// footnote lived only in title attributes, unreachable without a mouse.
console.log('\n32. Hover-only explanations reachable with taps alone at 390x844\n')
{
  await page.setViewportSize(PHONE_VIEWPORT)
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('.views canvas')

  await clickPreset('Three lags')
  await clickBtn('Proportional')
  await setField('Kp', 4)
  const info = page.locator('.topbar-info')
  if (!(await info.count())) fail('phone: no tap target for the crossover rad/s conversion')
  else {
    if (await page.locator('.topbar-field-note').count()) {
      fail('phone: the crossover note should not render before it is tapped open')
    }
    await info.tap()
    await page.waitForTimeout(80)
    const note = page.locator('.topbar-field-note')
    const visible = (await note.count()) && (await note.first().isVisible())
    const text = visible ? (await note.first().textContent()) || '' : ''
    console.log(`   crossover rad/s note at 390px, after a tap: ${visible ? 'visible' : 'HIDDEN'} ("${text.trim()}")`)
    if (!visible) fail('phone: tapping the crossover info button did not reveal the rad/s note')
    if (!/rad\/s/.test(text)) fail(`phone: the crossover note should carry rad/s, reads "${text}"`)
  }

  // A row the current settings make unmeasurable: Second order + Proportional
  // has no integrator, so the rule-of-thumb row is footnoted "[1]".
  await clickPreset('Second order')
  await clickBtn('Proportional')
  await clickBtn('Math')
  await page.waitForTimeout(150)
  const marked = page.locator('.math-check .unchecked[title]').first()
  if (!(await marked.count())) {
    fail('phone: expected an unchecked/footnoted math row on Second order + Proportional')
  } else {
    const li = page.locator('.math-notes li').first()
    const before = await li.evaluate((el) => el.className)
    await marked.tap()
    await page.waitForTimeout(150)
    const after = await li.evaluate((el) => el.className)
    console.log(`   tapping the math "[N]" mark: note class "${before}" -> "${after}"`)
    if (!/is-flash/.test(after)) fail('phone: tapping the footnote mark should flash its matching note into view')
  }
  await clickBtn('Step')
}

// ------------------------------------- 33. every cue word on screen is defined
//
// Defect 2, round one: chromeTermIds scanned the plant hint, the controller
// hint and a hand-written VIEW_CHROME string, but never the live numeric
// readouts — so a word that only ever appears INSIDE a formatted number (the
// top bar's "20.1 dB") or a controller-dependent readout strip ("Kp·e =
// 0.184") never fired its cue at all. That got patched for three specific
// ids (db, radpersec, kpe) against four hand-picked combos — and the SAME
// hole regrew in the other branch of every readout the patch touched: the
// ROUTINE "past the boundary" sentence, the ROUTINE "crossed the axis" line,
// the plants whose hint prose happens not to repeat "−180°", and the Step
// pane's ordinary overshoot line.
//
// Round two fixed THAT by building the loop the picker's own default click
// would (buildLoop + ctrlDefaultsFor) and calling the SAME note functions
// App.jsx renders from (verdictBadge, bodeMarginNote, locusHereNote,
// overshootOf) — and left the cause: every one of those was still computed
// from DEFAULT gains, never the live ones a dragged slider has long since
// moved away from, and the toggle/arrival state chromeTermIds had no
// parameter to even receive. This section used to prove only that the 140
// DEFAULT states resolve every cue — which cannot catch a fold that goes
// stale the moment something changes, because nothing here ever changed
// anything. 33a-33c below drive the interactions the cold walk found: a
// knob past a stable loop's boundary and back, the disturbance toggle
// across a spread of plant x controller pairs, and an arrival link.
//
// This scans the WHOLE cue table (terms.js's CUES), not a chosen few,
// across every plant x every controller x all five views (7x4x5 = 140
// default states, the same spread chrome.test.js checks against the pure
// function) with no lesson loaded — reading what the browser ACTUALLY
// renders and requiring every match to have its definition offered, no
// exceptions beyond the two below.
//
// Round four found this scan itself had two blind spots, both from an
// adversarial walk rather than a reported instance:
//
//   1. The Math tab's derivation body (.math-pane) was excluded outright,
//      on the premise that it was hand-audited prose rather than
//      cue-scanned prose. That premise was false: on the plainest state
//      there is (First order lag × Proportional, Math open), the pane's own
//      opening paragraph reads "whether that has a solution in the right
//      half plane — which is why the Nyquist view is a plot of L", and
//      neither "right-half-plane pole" nor "Nyquist plot" was offered.
//      Custom H(s) × Lead read "There is no integrator in the loop" with
//      the same gap. The exclusion is gone; .math-pane is scanned exactly
//      like every other container below, and chrome.js's chromeTermIds now
//      calls loopMath itself (mathProseText) instead of a hand-picked
//      stand-in, so a term the pane can print is a term this scan and the
//      app's own offered list agree on.
//   2. visibleChrome() walked child nodes and text content only, so a `title`
//      attribute was invisible to it regardless of which element carried
//      it. verdict.js's steadyErrorOf builds the steady-error field's
//      tooltip, ending "a negative steady error means the output overshoots
//      its destination and stays there" — reachable only by hover, and
//      wrong besides (overshoot is a transient peak that comes back down;
//      this describes a loop that never does, so the sentence borrowed a
//      defined term for a different idea). Reworded rather than newly
//      offered, since a word reachable only by hover is invisible on a
//      touch device regardless of whether it is defined. Every element this
//      scan reads is now read for its `title` too, not only its text.
//
// ALLOWLIST — the only text excluded from the scan, each entry earning its
// place for a STRUCTURAL reason, never because the prose was audited and
// found sufficient (that was round four's own false premise, above):
//   1. A button's OWN label (structural: textAndTitles strips every
//      <button> element's text, though not its title, before scanning its
//      container). A button names itself — "Integrator", "Three lags",
//      "Disturbance" — and "Disturbance" alone fires CUES.disturbance
//      sitting right inside the Step/Watch readout's own reference/
//      disturbance toggle, with no sentence beside it to define. Doing this
//      structurally means a NEW button can never need a new hand-typed
//      entry either.
//   2. The "back to lesson" link's lesson-TITLE suffix (.back-to-lesson):
//      a picker click remembers the lesson it just left so one click can
//      undo it, and the opening lesson's own title starts with the word
//      "Proportional" — a lesson NAME, not the concept-prose word.
console.log('\n33. Every cue word on screen resolves — every plant x controller x view, no lesson loaded\n')
{
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('.views canvas')

  const views = ['Step', 'Watch', 'Nyquist', 'Root locus', 'Math']
  const cueIds = Object.keys(CUES)

  const visibleChrome = () =>
    page.evaluate(() => {
      // A container's text AND every element's `title` attribute along the
      // way, with every nested <button>'s own label removed (allowlist
      // entry 1) — a button still contributes its title, and its
      // non-button siblings (e.g. the toggle's surrounding readout), just
      // not its own caption. Reading titles is what round four added: a
      // definition living only in a tooltip (verdict.js's steadyErrorOf,
      // before this round reworded it) used to be invisible here no matter
      // which container held it.
      const textAndTitles = (el) => {
        let out = (el.getAttribute && el.getAttribute('title')) || ''
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) out += node.textContent
          else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'BUTTON') out += ' ' + (node.getAttribute('title') || '')
            else out += ' ' + textAndTitles(node)
          }
        }
        return out
      }
      const bits = []
      // .topbar: the verdict badge and its sentence, the phase/gain margin
      // and crossover fields, and the steady-error field's own title.
      // .readout: both the Bode pane's margin sentence and the lower view's
      // own readout. .view-head h2: each pane's own title, which repeats
      // some of VIEW_CHROME's static text. .math-pane: the Math tab's own
      // derivation — no longer excluded (round four, above).
      for (const sel of ['.topbar', '.readout', '.view-head h2', '.math-pane']) {
        for (const el of document.querySelectorAll(sel)) bits.push(textAndTitles(el))
      }
      // Every .hint EXCEPT the back-to-lesson one (allowlist entry 2) — the
      // plant hint, the controller hint, and any affordability notice.
      for (const el of document.querySelectorAll('.hint')) {
        if (el.classList.contains('back-to-lesson')) continue
        bits.push(textAndTitles(el))
      }
      return bits.join(' \n ')
    })

  let termsLinkOpened = false
  const offeredNames = async () => {
    if (!termsLinkOpened) {
      await page.locator('.picker-terms .terms-link').click()
      await page.waitForTimeout(80)
      termsLinkOpened = true
    }
    return (await page.locator('.picker-terms .terms-list dt').allTextContents()).map((t) => t.trim())
  }

  let cueMatches = 0
  let states = 0
  for (const plant of plants) {
    await clickPreset(plant)
    for (const ctrl of ctrls) {
      await clickBtn(ctrl)
      for (const view of views) {
        await clickBtn(view)
        await settle()
        states++
        const text = await visibleChrome()
        const names = await offeredNames()
        for (const id of cueIds) {
          if (!CUES[id].test(text)) continue
          const termName = TERMS[id]?.name
          cueMatches++
          if (!names.includes(termName)) {
            fail(`picker/${plant} x ${ctrl} x ${view}: "${id}" cue is on screen but "${termName}" is not offered`)
          }
        }
      }
    }
  }
  if (states !== plants.length * ctrls.length * views.length) {
    fail(`item 33: expected ${plants.length * ctrls.length * views.length} states, walked ${states}`)
  }

  // A probe that only ever reads the 140 DEFAULT states cannot catch any of
  // the three consequences the cold walk found — chromeTermIds went stale
  // precisely because nothing ever moved a knob, toggled the step input, or
  // followed a hand-over link while the fold was open. The three sections
  // below drive exactly those three interactions and re-run the same
  // whole-cue-table scan against what the browser actually renders.
  let extraStates = 0

  // 33a. A knob dragged past a STABLE loop's own boundary, and back — Three
  // lags + Proportional, whose 11.25x boundary section 2 above already
  // measured directly from the app's own gain-margin claim. Before the fix
  // this fired the identical fold at Kp = 1 and Kp = 80 (both times the
  // ctrlDefaultsFor default, Kp = 1) — the top bar plainly disagreeing with
  // the picker's own glossary is exactly the "fold goes stale" defect.
  console.log('\n   33a. A knob dragged past a stable loop\'s own boundary, and back\n')
  await clickPreset('Three lags')
  await clickBtn('Proportional')
  await clickBtn('Step')
  await setField('Kp', 1)
  extraStates++
  {
    const text = await visibleChrome()
    if (CUES.runsaway.test(text) || CUES.boundary.test(text)) {
      fail('tuned knob (Kp = 1, stable): the fold already reads "past the boundary" before any drag — not a clean before/after')
    }
    const names = await offeredNames()
    for (const id of cueIds) {
      if (!CUES[id].test(text)) continue
      cueMatches++
      const termName = TERMS[id]?.name
      if (!names.includes(termName)) fail(`tuned knob (Kp = 1): "${id}" cue is on screen but "${termName}" is not offered`)
    }
  }
  await setField('Kp', 80)
  extraStates++
  {
    const text = await visibleChrome()
    const sawRunsaway = CUES.runsaway.test(text)
    const sawBoundary = CUES.boundary.test(text)
    if (!sawRunsaway || !sawBoundary) {
      fail(
        `tuned knob (Kp = 80, past the 11.25x boundary): expected "runs away" and "boundary" on screen, ` +
          `got runsaway=${sawRunsaway} boundary=${sawBoundary} — the fold did not follow the live gain`,
      )
    }
    const names = await offeredNames()
    for (const id of cueIds) {
      if (!CUES[id].test(text)) continue
      cueMatches++
      const termName = TERMS[id]?.name
      if (!names.includes(termName)) fail(`tuned knob (Kp = 80): "${id}" cue is on screen but "${termName}" is not offered`)
    }
  }
  console.log(`      Kp 1 -> stable fold, Kp 80 -> "runs away" / "boundary" both resolved`)
  await setField('Kp', 1)

  // 33b. The disturbance toggle, across a spread of plant x controller
  // pairs — App.jsx's Step heading swaps to "Response to a disturbance at
  // the plant input" only then, and no plant or controller hint contains
  // the bare word "disturbance" (the toggle button's own label is excluded
  // structurally, allowlist entry 1) to rescue it by accident.
  console.log('\n   33b. The disturbance toggle, across every plant x controller pair\n')
  await clickBtn('Disturbance')
  for (const plant of plants) {
    await clickPreset(plant)
    for (const ctrl of ctrls) {
      await clickBtn(ctrl)
      await settle()
      extraStates++
      const text = await visibleChrome()
      if (!CUES.disturbance.test(text)) {
        fail(`disturbance toggle/${plant} x ${ctrl}: expected the pane heading to name "disturbance"`)
      }
      const names = await offeredNames()
      for (const id of cueIds) {
        if (!CUES[id].test(text)) continue
        cueMatches++
        const termName = TERMS[id]?.name
        if (!names.includes(termName)) {
          fail(`disturbance toggle/${plant} x ${ctrl}: "${id}" cue is on screen but "${termName}" is not offered`)
        }
      }
    }
  }
  console.log(`      ${plants.length} plants x ${ctrls.length} controllers = ${plants.length * ctrls.length} states, "disturbance" resolved every time`)
  await clickBtn('Reference')

  // 33c. An arrival link with from=circuit: — the cold walk's own repro for
  // consequence 3. An Integrator plant under a Lead controller settles with
  // zero steady error, so the hand-over banner prints "with an integrator in
  // the loop the error is erased exactly", and neither the Integrator
  // plant's hint nor the Lead controller's hint contains the bare word.
  console.log('\n   33c. An arrival link (from=circuit:) with no lesson loaded\n')
  await page.goto('about:blank')
  await page.goto(`${URL}#plant=integrator:1&ctrl=lead:1:1:10&from=circuit:xyz`, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await settle()
  // A fresh navigation reloads the DOM, so the terms fold is collapsed again
  // regardless of whether it was open on the page this replaced.
  termsLinkOpened = false
  extraStates++
  {
    const text = await visibleChrome()
    if (!CUES.integrator.test(text)) {
      fail('arrival link (from=circuit:): expected the banner to name "integrator"')
    }
    const names = await offeredNames()
    for (const id of cueIds) {
      if (!CUES[id].test(text)) continue
      cueMatches++
      const termName = TERMS[id]?.name
      if (!names.includes(termName)) {
        fail(`arrival link (from=circuit:): "${id}" cue is on screen but "${termName}" is not offered`)
      }
    }
  }
  console.log(`      #plant=integrator:1&ctrl=lead:1:1:10&from=circuit:xyz -> "integrator" resolved`)

  console.log(
    `\n   ${plants.length} plants x ${ctrls.length} controllers x ${views.length} views = ${states} default states, ` +
      `+ ${extraStates} driven states (a knob past its boundary and back, the disturbance toggle across ` +
      `${plants.length * ctrls.length} pairs, one arrival link): ${cueMatches} total cue matches against the ` +
      `whole ${cueIds.length}-id table, all defined`,
  )
  await clickBtn('Step')
  await clickPreset('First order lag')
}

// -------------------------------------------- 34. touch targets at 390x844
//
// Two student testers on phones found this ("it constantly asks the student
// to pinpoint instead of tap", "the navigation buttons are too small and too
// close together"), and a walk of the released labs measured it: every
// interactive element here ran under 44x44 CSS px, the worst (the info
// mark) at 12x10. FLOOR = 44 — the Apple HIG / Material touch-target
// guideline, chosen over the bare 24px WCAG 2.2 SC 2.5.8 legal minimum
// because this is a dense, numbers-heavy tool meant to be poked quickly and
// often. tapTargetProbe.mjs (packages/ui/verify) walks the page, crediting
// an invisible ::before/::after hit area (position:relative + a negative
// inset) where a control keeps its visible glyph small on purpose, and a
// checkbox's wrapping <label> in place of its own tiny native box.
//
// One documented exception, held to the 24px HARD_FLOOR instead: a control
// inside a PLOT pane (.views — a view switch, the Reference/Disturbance
// toggle in the readout, the watch transport's play button). Its options
// often touch with no real gap (a true segmented control), so an invisible
// hit area would let a thumb bridge two, and growing it for real at 44
// pushed the pane's own canvas off the bottom of a phone screen (measured:
// 825px to 915px, past the 844px fold) — the fold probes elsewhere in this
// file hold that canvas on screen, so the plot pane's chrome stays at
// WCAG's legal floor rather than the suite's 44px target.
console.log('\n34. Touch targets at 390x844 (button, link, summary, role=button, checkbox)\n')
{
  await page.setViewportSize(PHONE_VIEWPORT)
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')

  const exceptionFloor = (el) => (el.inViews || el.inLabNav ? HARD_FLOOR : null)

  const lessonNames = await page.evaluate(() =>
    [...document.querySelectorAll('#lessons details.preset-group .preset')].map((b) => b.textContent.trim()),
  )
  let checked = 0
  for (const name of lessonNames) {
    await loadLesson(name)
    const res = await tapTargetProbe(page, { exceptionFloor })
    checked += res.checked
    for (const f of res.failures) fail(`touch target · ${name}: ${f}`)
  }
  // The picker state (no lesson loaded) has its own controls — the plant
  // and controller cards, the Nyquist/locus view tabs with nothing named.
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  const picker = await tapTargetProbe(page, { exceptionFloor })
  checked += picker.checked
  for (const f of picker.failures) fail(`touch target · picker: ${f}`)
  console.log(`   ${lessonNames.length} lessons + the picker: ${checked} interactive elements checked at 390x844, every one clears the ${FLOOR}px floor (the plot panes' own chrome held to the ${HARD_FLOOR}px floor instead)`)
}

// ---------------------------- 35. the zero-denominator plant refuses everywhere
//
// The worst defect class this suite claims never to ship: a broken plant
// declared solved, with a tick. Custom H(s) with b0 = 1 and a2 = a1 = a0 = 0
// is P(s) = 1/0 — undefined at every s. buildLoop (systems.js) now refuses
// there, once, and every pane reads that one refusal instead of computing
// its own number from a division by zero. This loads the exact hash the
// student's repro used and checks every surface: the badge, the steady
// error field, the Math tab, Nyquist, and root locus.
console.log('\n35. The zero-denominator plant: every pane refuses, none ticks a wrong number\n')
{
  await page.goto(`${URL}#plant=custom:0:0:1:0:0:0&ctrl=p:1`, { waitUntil: 'load' })
  // Not '.views canvas': an undefined plant now refuses on the Bode pane too
  // (item 2 of this review), so on THIS exact hash no canvas exists anywhere
  // on the page at all — Bode refuses, and Step (the default view) already
  // refused before this fix. The topbar badge is what every other wait in
  // this file settles for once a canvas exists; it is what this section
  // reads first anyway, so it is the honest ready-signal here.
  await page.waitForSelector('.flow-node')
  await settle()

  const REASON = 'This H(s) has an all-zero denominator'

  const bar = await topbar()
  if (/\bstable\b/i.test(bar.verdict) || /settles/i.test(bar.verdict)) {
    fail(`zero-denominator: topbar badge should not claim stable/settles, read "${bar.verdict}"`)
  }
  if (!bar.verdict.includes(REASON)) {
    fail(`zero-denominator: topbar badge should give the reason, read "${bar.verdict}"`)
  }
  if (bar['steady error'] !== '—') {
    fail(`zero-denominator: steady error should refuse ('—'), read "${bar['steady error']}"`)
  }
  if (bar['phase margin'] !== '—' || bar['gain margin'] !== '—') {
    fail(`zero-denominator: phase/gain margin should both read '—', got ${JSON.stringify(bar)}`)
  }
  console.log(`   topbar: badge names the reason, steady error and margins all read "—"`)

  // The Math tab: no check row (nothing to tick), no NaN, one sentence.
  await openMath()
  const checks = await readChecks()
  if (checks.length) fail(`zero-denominator: Math tab should show no check rows, found ${checks.length}`)
  const mathText = (await page.locator('.math-pane').textContent().catch(() => '')) || ''
  if (!mathText.includes(REASON)) fail(`zero-denominator: Math tab should give the reason, read "${mathText.slice(0, 120)}"`)
  console.log(`   Math tab: no check rows, refuses with the reason`)
  await closeMath()

  // Nyquist and root locus: words, not a blank canvas.
  await clickBtn('Nyquist')
  const nyqHint = (await page.locator('[data-role="undefined-plant"]').first().textContent().catch(() => '')) || ''
  if (!nyqHint.includes(REASON)) fail(`zero-denominator: Nyquist pane should refuse with the reason, read "${nyqHint}"`)
  await clickBtn('Root locus')
  const locusHint = (await page.locator('[data-role="undefined-plant"]').first().textContent().catch(() => '')) || ''
  if (!locusHint.includes(REASON)) fail(`zero-denominator: root locus pane should refuse with the reason, read "${locusHint}"`)
  console.log(`   Nyquist and root locus: both refuse with the reason instead of a blank canvas`)

  // Step and Watch already refused before this fix — pinned here so a
  // regression on any ONE pane is caught the same way as the others.
  await clickBtn('Step')
  const stepHint = (await page.locator('[data-role="sim-too-stiff"]').first().textContent().catch(() => '')) || ''
  if (!stepHint.includes(REASON)) fail(`zero-denominator: Step pane should still refuse with the reason, read "${stepHint}"`)
  await clickBtn('Watch')
  const watchHint = (await page.locator('[data-role="sim-too-stiff"]').first().textContent().catch(() => '')) || ''
  if (!watchHint.includes(REASON)) fail(`zero-denominator: Watch pane should still refuse with the reason, read "${watchHint}"`)
  console.log(`   Step and Watch: still refuse with the same reason`)

  await clickBtn('Step')
  await clickPreset('First order lag')
}

// --------------------------- 36. root locus axis matches Bode's own convention
//
// Defect 3: the locus axis printed raw digits (600000000, -0.003) while the
// Bode plot beside it, on the same screen, formats the same kind of
// quantity (a frequency in rad/s or 1/s) with SI prefixes. A first-order
// lag with a very short time constant puts a pole at ~1e7 rad/s, which is
// exactly the scale the shipped defect was filed against.
console.log('\n36. Formatting: the root locus axis uses the suite\'s own SI-prefixed formatter\n')
{
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await clickPreset('First order lag')
  await clickBtn('Proportional')
  await setField('Time constant τ', 1e-7)
  await clickBtn('Root locus')
  await settle()
  await installProbeHooks(page)
  const { texts } = await probeDraw(page, async () => {
    await clickBtn('Nyquist')
    await clickBtn('Root locus')
  })
  const locusId = await page.evaluate(() => document.querySelector('canvas[aria-label^="Root locus"]')?.dataset.probeId)
  const dedup = dedupeTexts(texts).filter((t) => t.canvas === locusId)
  const numeric = dedup.filter((t) => /^-?\d+(\.\d+)?[kMGTmµn]?$/.test(t.text))
  const rawDigits = numeric.filter((t) => /^-?\d{4,}$/.test(t.text))
  const prefixed = numeric.filter((t) => /[kMGTmµn]$/.test(t.text))
  if (rawDigits.length) {
    fail(`root locus axis: expected SI-prefixed ticks the way the Bode plot already reads, got raw digits: ${rawDigits.map((t) => t.text).join(', ')}`)
  }
  if (!prefixed.length) {
    fail(`root locus axis: expected at least one SI-prefixed tick at this scale (a pole near 1e7 rad/s), got: ${numeric.map((t) => t.text).join(', ') || '(no numeric ticks read)'}`)
  } else {
    console.log(`   root locus axis ticks at τ = 1e-7 s: ${numeric.map((t) => t.text).join(', ')}`)
  }
  await setField('Time constant τ', 1)
  await clickPreset('First order lag')
}

// ------------------------------ 37. the watch row's own formatting convention
//
// Defect 3's other half: Kp·e, Ki·∫e, Kd·ė and u are the same kind of
// quantity read from the same row, and a knob at its extreme must not leave
// one term in exponential notation beside another as a raw many-digit
// integer. Swept across PID at its gain extremes, on a plant with poles
// fast enough to make the effort huge and a scrub position late enough to
// let it get there.
console.log('\n37. Formatting: the watch row never mixes exponential and raw-digit notation\n')
{
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  const extremes = [
    { plant: 'Unstable plant', kp: 1000, ki: 1000, kd: 100 },
    { plant: 'Motor position', kp: 0.001, ki: 0.001, kd: 0.0001 },
    { plant: 'Three lags', kp: 1000, ki: 0.001, kd: 100 },
  ]
  let sawExponential = false
  let sawRawDigits = false
  for (const ex of extremes) {
    await clickPreset(ex.plant)
    await clickBtn('PID')
    await setField('Kp', ex.kp)
    await setField('Ki', ex.ki)
    await setField('Kd', ex.kd)
    await clickBtn('Watch')
    const slider = page.getByRole('slider', { name: 'Moment in the response' })
    for (const pos of [1, 60, 300, 598]) {
      await slider.fill(String(pos))
      await settle()
      const values = await page.locator('.readout b').allTextContents()
      for (const v of values) {
        if (/e[+-]\d/.test(v)) sawExponential = true
        if (/^-?\d{5,}$/.test(v.replace(/[,\s]/g, ''))) sawRawDigits = true
        if (/e[+-]\d/.test(v) || /^-?\d{5,}$/.test(v.replace(/[,\s]/g, ''))) {
          fail(`watch row formatting: "${v}" (plant ${ex.plant}, Kp=${ex.kp} Ki=${ex.ki} Kd=${ex.kd}, pos ${pos}) should read the suite's compact form, not raw JS Number.toString()`)
        }
      }
    }
  }
  console.log(`   swept PID across ${extremes.length} plants at their gain extremes: no exponential notation, no raw 5+-digit integers (exponential seen pre-fix: ${sawExponential}, raw digits seen pre-fix: ${sawRawDigits})`)
  await setField('Kp', 1)
  await setField('Ki', 1)
  await setField('Kd', 0.1)
  await clickBtn('Step')
  await clickPreset('First order lag')
}

// -------------------------------------- 38. a hash edited in an already-open tab
//
// Defect 4: editing the address bar's hash, or pasting the app's own share
// link into a tab where the lab is already loaded, is a same-document
// navigation — the mount-time boot state never runs again. App.jsx now
// listens for the browser's own 'hashchange' event and applies it the same
// way a fresh load would.
console.log('\n38. A hash edited in an already-open tab is applied, not ignored\n')
{
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await clickPreset('First order lag')
  await clickBtn('Proportional')

  // Same-document navigation: set the hash directly, the way editing the
  // address bar (or a script) would, WITHOUT a fresh page.goto/reload.
  await page.evaluate(() => {
    window.location.hash = 'plant=motor:1&ctrl=pid:3:2:1'
  })
  await settle()
  await page.waitForTimeout(200)

  const flowNames = await page.locator('.flow-node em').allTextContents().catch(() => [])
  const flowText = (await page.locator('.flow').textContent().catch(() => '')) || ''
  if (!/Motor position/.test(flowText)) {
    fail(`hashchange: expected the loop to switch to Motor position after an in-tab hash edit, flow reads "${flowText}"`)
  }
  if (!/PID/.test(flowText)) {
    fail(`hashchange: expected the controller to switch to PID after an in-tab hash edit, flow reads "${flowText}"`)
  }
  console.log(`   editing window.location.hash in an already-open tab switched the loop: "${flowText.replace(/\s+/g, ' ').trim().slice(0, 80)}"`)
  await clickPreset('First order lag')
}

// ------------------------------------- 39. the Bode plot's own reading lesson
//
// Item 2: a student review of this exact plot ("mostly noise", "never told
// how to read it", "the margin is the distance from the phase curve to
// −180° is the sentence nobody ever gave them") — taught once, in the
// picture, on each margin's own first lesson (BodeCanvas.jsx: `teach`).
console.log('\n39. The Bode plot marks the margin it is teaching, once per lesson\n')
{
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await installProbeHooks(page)

  const bodeTextsFor = async (name) => {
    const { texts } = await probeDraw(page, () => loadLesson(name))
    const id = await page.evaluate(() => document.querySelector('canvas[aria-label^="Open-loop Bode"]')?.dataset.probeId)
    return dedupeTexts(texts).filter((t) => t.canvas === id).map((t) => t.text)
  }

  const phaseTexts = await bodeTextsFor('...and what it costs')
  if (!phaseTexts.includes('phase margin')) fail(`Bode teaching: "...and what it costs" should mark "phase margin" on the plot, drew: ${phaseTexts.join(', ')}`)
  if (!phaseTexts.some((t) => t === '−180°')) fail(`Bode teaching: "...and what it costs" should mark the −180° boundary, drew: ${phaseTexts.join(', ')}`)
  console.log(`   "...and what it costs": phase margin bracket and −180° line both drawn`)

  const gainTexts = await bodeTextsFor('The margin says exactly how far')
  if (!gainTexts.includes('gain margin')) fail(`Bode teaching: "The margin says exactly how far" should mark "gain margin" on the plot, drew: ${gainTexts.join(', ')}`)
  console.log(`   "The margin says exactly how far": gain margin bracket drawn`)

  // Every OTHER lesson stays exactly as it was — the annotation is gated
  // to these two, not a global change to the Bode plot.
  const otherTexts = await bodeTextsFor('Turn it up until it sings')
  if (otherTexts.includes('phase margin') || otherTexts.includes('gain margin')) {
    fail(`Bode teaching: "Turn it up until it sings" should NOT carry the reading-lesson annotation, drew: ${otherTexts.join(', ')}`)
  }
  console.log(`   every other lesson's Bode plot is unchanged`)

  await clickPreset('First order lag')
}

// ----------------------------- 40. the eng-field commit echo, and Reed's exact case

console.log('\n40. The eng-field commit echo (silent thousand-fold reinterpretation)\n')
{
  // Reed's reproduction, verbatim: a proportional gain field sitting at 0.99
  // displays "990" next to a milli prefix. Typing a bare "1.0001" (meaning a
  // gain of about one) is read in that displayed prefix and would commit
  // 1.0001 MILLI — 0.0010001, a thousand times too small — with nothing on
  // screen saying so before Enter. NumField now shows what will actually
  // land, live, before commit; this drives the field into exactly that state
  // and requires the warning to already be on screen before Enter is pressed.
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await clickBtn('PI') // a second field (Ki) alongside Kp, for the blur checks below
  await settle()

  const kpField = page.locator('.num').filter({ has: page.getByRole('spinbutton', { name: 'Kp' }) }).first()
  const kp = kpField.getByRole('spinbutton', { name: 'Kp' })
  const echo = kpField.locator('.num-echo')
  const ki = page.getByRole('spinbutton', { name: 'Ki' }).first()

  await kp.fill('0.99')
  await kp.press('Enter')
  await settle()
  const shownBefore = await kp.inputValue()
  if (shownBefore !== '990') fail(`gain echo setup: expected the field to show "990" (0.99 with a milli prefix), got "${shownBefore}"`)

  // Type the bare number WITHOUT committing yet.
  await kp.fill('1.0001')
  await page.waitForTimeout(80)
  const stillOldValue = await kp.getAttribute('aria-valuenow')
  if (stillOldValue !== '0.99') fail(`gain echo: typing alone should not commit — Kp read ${stillOldValue}, expected it to still read 0.99`)
  const echoVisible = (await echo.getAttribute('data-visible')) !== null
  if (!echoVisible) fail('gain echo: typing "1.0001" under a displayed milli prefix should show the commit echo before Enter, but nothing is visible')
  const echoText = (await echo.textContent()) || ''
  if (!echoText.includes('1.0001 m')) fail(`gain echo: expected the typed reading "1.0001 m" in the echo, got "${echoText}"`)
  if (!echoText.includes('0.0010001')) fail(`gain echo: expected the full committed value "0.0010001" in the echo, got "${echoText}"`)
  console.log(`   before Enter, echo reads: "${echoText}"`)

  // Commit it, and the echo goes quiet again — it only speaks about a draft.
  await kp.press('Enter')
  await settle()
  const committed = Number(await kp.getAttribute('aria-valuenow'))
  if (!(Math.abs(committed - 0.001) < 1e-6)) fail(`gain echo: expected the reinterpreted commit to land near 0.001, got ${committed}`)
  const echoAfterCommit = (await echo.textContent()) || ''
  if (echoAfterCommit.trim() !== '') fail(`gain echo: should go quiet once committed, still showing "${echoAfterCommit}"`)
  console.log(`   bare "1.0001" under a displayed milli prefix committed as ${committed} (the kept, documented rule) — and the echo warned first`)

  // The interrupt this task also had to answer: does blurring an UNEDITED
  // field ever rescale it again? Move focus off Kp with nothing further
  // typed, twice, and require the value to hold exactly.
  await ki.click()
  await settle()
  const afterFirstBlur = Number(await kp.getAttribute('aria-valuenow'))
  await kp.click()
  await ki.click()
  await settle()
  const afterSecondBlur = Number(await kp.getAttribute('aria-valuenow'))
  if (afterFirstBlur !== committed) fail(`gain echo: blurring to another field with no edit moved Kp from ${committed} to ${afterFirstBlur}`)
  if (afterSecondBlur !== afterFirstBlur) fail(`gain echo: a second blur with no edit moved Kp again, from ${afterFirstBlur} to ${afterSecondBlur} — re-commit is not idempotent`)
  console.log(`   two further blurs with nothing retyped: Kp held at ${afterSecondBlur}, no repeated rescale`)

  // An explicit prefix or a ratio entry has nothing to warn about — the echo
  // stays quiet even while an active (non-unity) prefix is on display.
  await kp.fill('5G')
  await page.waitForTimeout(80)
  if ((await echo.getAttribute('data-visible')) !== null) fail(`gain echo: an explicitly typed prefix ("5G") should not show the echo, saw "${await echo.textContent()}"`)
  await kp.fill('*2')
  await page.waitForTimeout(80)
  if ((await echo.getAttribute('data-visible')) !== null) fail(`gain echo: a ratio entry ("*2") should not show the echo, saw "${await echo.textContent()}"`)
  await kp.press('Escape')
  await settle()
  console.log('   explicit prefix and ratio entries stay quiet, as designed')
}

// ------------------------------------------- 41. the math panel's phase fold
//
// Regression of a bug already fixed once: phase.test.js pins "the unstable
// plant under Kp 5 reads 78.5°, not 438.5°" for the TOPBAR's own phase
// margin (margins(), folded at the source). The Math tab's own "phase
// accounting" row computed the same identity, PM = 180° + ∠L at the
// crossover, a SECOND way — reading it off bode()'s continuously unwrapped,
// per-transfer-function-anchored curve instead of the loop's own
// principal-value angle — and for the unstable plant under every controller
// the panel's row sat exactly 360° off the topbar's own number (87.1° vs
// 447.134° at Kp = 20). math.js now folds this once (phaseMarginAt) and
// both readings come from it; this drives the actual repro in the browser.
console.log('\n41. The math panel\'s phase-accounting row agrees with the topbar — the 360° regression\n')
{
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await clickPreset('Unstable plant')
  await clickBtn('Proportional')

  const readMathValues = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.math-values tr')].map((tr) => {
        const c = [...tr.querySelectorAll('th,td')]
        return {
          label: c[0]?.textContent.trim(),
          value: c[1]?.textContent.trim(),
          unit: c[2]?.textContent.trim(),
          note: c[3]?.textContent.trim(),
        }
      }),
    )

  for (const kp of [5, 20, 80]) {
    await setField('Kp', kp)
    const pmText = (await topbar())['phase margin']
    await openMath()
    const values = await readMathValues()
    const panelRow = values.find((r) => r.note === 'the phase margin' && r.label !== 'phase margin')
    await closeMath()
    if (!panelRow) {
      fail(`Kp ${kp}: expected the math panel's own phase-margin row ("the phase margin" note)`)
      continue
    }
    const panelVal = parseFloat(panelRow.value)
    const topbarVal = parseFloat(pmText)
    console.log(`   Kp ${kp}: topbar ${pmText}, math panel "${panelRow.label}" = ${panelRow.value}°`)
    if (Math.abs(panelVal) > 180.001) {
      fail(`Kp ${kp}: math panel's phase-margin row reads ${panelRow.value}° — off the circle`)
    }
    if (Math.abs(panelVal - topbarVal) > 0.2) {
      fail(`Kp ${kp}: math panel's phase-margin row (${panelRow.value}°) disagrees with the topbar (${pmText})`)
    }
  }
  await clickPreset('First order lag')
}

// --------------------------------------- 42. the Bode pane on an undefined plant
//
// Defect: the magnitude trace correctly drew nothing for the zero-
// denominator custom plant (bode() hands back NaN, and a canvas ignores a
// NaN coordinate), but the phase trace drew a confident flat line at
// exactly 0° — bode() never touches its phase array when |H| is undefined
// at every frequency, and a Float64Array's own zero fill stood in as if it
// were a measured value. The Bode pane now refuses the same way every
// other pane already does (Nyquist, root locus, Step, Watch, the Math tab),
// with the same reason, rather than drawing a picture of nothing.
console.log('\n42. The Bode pane refuses on an undefined plant, rather than drawing a false phase line\n')
{
  await page.goto(`${URL}#plant=custom:0:0:1:0:0:0&ctrl=p:1`, { waitUntil: 'load' })
  // Not '.views canvas': this is the exact state under test, where no
  // canvas exists anywhere on the page (see item 35's own comment above,
  // fixed the same way for the same reason).
  await page.waitForSelector('.flow-node')
  await settle()

  const bodeCanvasCount = await page.locator('canvas[aria-label^="Open-loop Bode"]').count()
  if (bodeCanvasCount !== 0) fail(`Bode pane: expected no canvas for an undefined plant, found ${bodeCanvasCount}`)

  const bodeSection = page.locator('.views > .view').first()
  const reasonCount = await bodeSection.locator('[data-role="undefined-plant"]').count()
  if (!reasonCount) fail('Bode pane: expected the undefined-plant reason in place of the canvas')
  console.log(`   Bode canvas: ${bodeCanvasCount === 0 ? 'absent' : 'STILL DRAWN'}; refusal text present: ${reasonCount > 0}`)

  await clickPreset('First order lag')
}

// ------------------------------------------- 43. the loop diagram's own rounding
//
// Cosmetic: the diagram box rounded a gain to three significant figures
// (11.3) while the sidebar field beside it, for the SAME live value, showed
// four (11.25) — one number, two readings. summarize() (LoopDiagram.jsx)
// now matches the sidebar field's own four-figure precision (packages/ui's
// NumField, snap() — NEEDS.md).
console.log('\n43. The loop diagram quotes a gain to the same precision as the sidebar field\n')
{
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')
  await clickPreset('Three lags')
  await clickBtn('Proportional')
  await setField('Kp', 11.25)
  const fieldValue = await page.getByRole('spinbutton', { name: 'Kp' }).first().inputValue()
  await page.getByRole('button', { name: '⧉ diagram' }).click()
  await page.waitForTimeout(200)
  const svgText = await page.locator('.fd-svg').textContent()
  console.log(`   sidebar field reads "${fieldValue}", diagram box: ${svgText.includes('Kp 11.25') ? 'Kp 11.25' : 'MISMATCH'}`)
  if (!svgText.includes('Kp 11.25')) {
    fail(`diagram: expected "Kp 11.25" (matching the sidebar field "${fieldValue}"); the box read something else in "${svgText}"`)
  }
  if (svgText.includes('Kp 11.3')) fail('diagram: still rounding to three significant figures (Kp 11.3)')
  await page.keyboard.press('Escape')
  await settle()
  await clickPreset('First order lag')
}

// -------------------------------------------- 44. Nyquist and root locus, introduced
//
// Defect: both tabs are one click away from lesson 1 onward, well before
// their own lesson (9 and 8 respectively) ever loads — a student review's
// single most annoying finding was not knowing whether a prerequisite was
// missing. Each tab's pane now says what it is and where its own lesson
// sits, until the reader has reached (or passed) it.
console.log('\n44. Nyquist and root locus say what they are before their own lesson arrives\n')
{
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')

  // The picker state, no lesson at all: both previews should show.
  await clickBtn('Nyquist')
  let intro = (await page.locator('[data-role="view-intro"]').textContent().catch(() => '')) || ''
  if (!/lesson 9/.test(intro)) fail(`Nyquist, no lesson: expected a preview of lesson 9, read "${intro}"`)
  console.log(`   Nyquist, no lesson: "${intro.trim()}"`)

  await clickBtn('Root locus')
  intro = (await page.locator('[data-role="view-intro"]').textContent().catch(() => '')) || ''
  if (!/lesson 8/.test(intro)) fail(`Root locus, no lesson: expected a preview of lesson 8, read "${intro}"`)
  console.log(`   Root locus, no lesson: "${intro.trim()}"`)

  // Loaded straight to the dedicated lesson: no preview line, the lesson's
  // own note is doing the introducing now.
  await loadLesson('Watch the poles cross') // lesson 8, view locus
  if (await page.locator('[data-role="view-intro"]').count()) {
    fail('Root locus: the preview line should not show on its own lesson (8)')
  }
  await loadLesson('Everything is about one point') // lesson 9, view nyquist
  if (await page.locator('[data-role="view-intro"]').count()) {
    fail('Nyquist: the preview line should not show on its own lesson (9)')
  }
  console.log('   neither preview line shows once its own lesson has loaded')

  // An EARLIER lesson, tab switched manually: still a preview (has not
  // reached the dedicated lesson yet).
  await loadLesson('Proportional cannot get there') // lesson 1
  await clickBtn('Nyquist')
  intro = (await page.locator('[data-role="view-intro"]').textContent().catch(() => '')) || ''
  if (!/lesson 9/.test(intro)) fail(`Nyquist from lesson 1: expected the preview line, read "${intro}"`)
  console.log(`   Nyquist from lesson 1 (before lesson 9): "${intro.trim()}"`)

  // A LATER lesson, tab switched back: no preview (already past it).
  await loadLesson('Lead does it without the noise') // lesson 13, the last
  await clickBtn('Root locus')
  if (await page.locator('[data-role="view-intro"]').count()) {
    fail('Root locus from lesson 13: should not show the preview, already past lesson 8')
  }
  console.log('   no preview once a later lesson has been reached')

  await clickBtn('Step')
  await clickPreset('First order lag')
}

// ------------------------------------------------ 45. definitions on contact
//
// Defect, and it repeats across the suite: the terms fold sat only after
// the WHOLE note, behind a small link a skim reader never noticed — the
// same pattern that cost Circuit Lab two of two skim readers concluding it
// has no glossary at all. The first use of a lesson's own listed term in
// its note is now a tappable word (student review, item 3), the pattern
// Circuit Elements Lab already ships (that lab's grader reported no
// vocabulary problem under it). The "terms used here" fold stays, for
// anything the note never spells out.
console.log('\n45. Definitions on contact: a first-use term in the note is tappable\n')
{
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views canvas')

  // "Everything is about one point": the note's own first sentence names
  // the Nyquist view. A skim reader who never notices "terms used here"
  // should still be able to tap the word itself.
  await loadLesson('Everything is about one point')
  const nyquistDfn = page.locator('.hint.note dfn.term[data-term="nyquistplot"]')
  const nyquistCount = await nyquistDfn.count()
  if (nyquistCount !== 1) {
    fail(`terms on contact: expected exactly one marked "Nyquist" word in the note, found ${nyquistCount}`)
  } else {
    const before = await page.locator('[data-role="def"]').count()
    if (before) fail('terms on contact: no definition card should be open before a tap')
    await nyquistDfn.click()
    await settle()
    const card = page.locator('[data-role="def"][data-term="nyquistplot"]')
    if ((await card.count()) !== 1) fail('terms on contact: tapping the marked word should open its definition card')
    const cardText = (await card.textContent()) || ''
    if (!/Nyquist plot/.test(cardText)) fail(`terms on contact: expected the Nyquist-plot definition, card read "${cardText}"`)
    console.log(`   "Everything is about one point": tapping "Nyquist" opened its card ("${cardText.trim().slice(0, 50)}...")`)
    // Tapping the same word again closes it.
    await nyquistDfn.click()
    await settle()
    if (await card.count()) fail('terms on contact: tapping the same word again should close its card')
    console.log('   tapping the same word again closes the card')
  }
  // The fold survives unchanged, for the terms the note never spells out.
  if (!(await page.locator('.terms-link').count())) fail('terms on contact: the "terms used here" fold should still be offered')

  // "The margin says exactly how far": the note's first sentence names the
  // gain margin.
  await loadLesson('The margin says exactly how far')
  const gmDfn = page.locator('.hint.note dfn.term[data-term="gainmargin"]')
  const gmCount = await gmDfn.count()
  if (gmCount !== 1) {
    fail(`terms on contact: expected a marked "gain margin" in the note, found ${gmCount}`)
  } else {
    await gmDfn.click()
    await settle()
    const card = page.locator('[data-role="def"][data-term="gainmargin"]')
    if ((await card.count()) !== 1) fail('terms on contact: tapping "gain margin" should open its card')
    console.log('   "The margin says exactly how far": tapping "gain margin" opened its card')
  }

  // Switching lessons closes whatever card the last one left open.
  await loadLesson('A margin thin enough to feel')
  if (await page.locator('[data-role="def"]').count()) {
    fail("terms on contact: a fresh lesson load should not carry over the previous one's open card")
  }
  console.log('   loading a new lesson closes the previous one\'s open definition')

  await clickPreset('First order lag')
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
