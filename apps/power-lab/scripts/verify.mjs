// End-to-end verification for Power Lab, in a real browser.
//
// The unit tests solve every converter and check every note against a solve.
// This drives the built page and restates, in pixels, the complaints the
// 2026-09-02 review made (POWER_LAB_PLAN.md §11): a ripple the eye cannot see,
// a Math button below the fold, a headline that contradicts its note, a
// sidebar that needs scrolling before its first knob, a phone that clips.
// Every probe here failed on d8bd978 before its fix landed; a probe that
// passes on the build it was written against measures nothing.
//
//   npm run preview -- --port 4500   (in another shell; serves dist/)
//   npm run verify                   (APP_URL to point elsewhere;
//                                     BROWSERS=chromium,firefox to add Firefox)

import { chromium, firefox } from 'playwright'

const URL = process.env.APP_URL || 'http://localhost:4500/'
const BROWSERS = (process.env.BROWSERS || 'chromium').split(',').map((s) => s.trim()).filter(Boolean)
const DESKTOP = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]
const WIDTHS = [1280, 1366, 1440, 1920]

const failures = []
const fail = (m) => failures.push(m)

/** The scope's trace colours, as drawn (ScopeCanvas.TRACE_COLORS / plot COLORS). */
const RGB = { vout: [56, 224, 176], iL: [95, 168, 255], vsw: [240, 162, 60] }

for (const name of BROWSERS) {
  const engine = name === 'firefox' ? firefox : chromium
  let browser
  try {
    browser = await engine.launch()
  } catch (e) {
    console.log(`\n${name}: not installed (${e.message.split('\n')[0]}) — skipped`)
    continue
  }
  console.log(`\n${'='.repeat(64)}\n${name}\n${'='.repeat(64)}`)
  await run(browser, name)
  await browser.close()
}

console.log('\n' + '='.repeat(64))
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`)
  for (const f of failures) console.log('   ' + f)
  process.exit(1)
}
console.log('\nAll UI checks passed.')

// ------------------------------------------------------------------------

async function run(browser, tag) {
  const page = await browser.newPage({ viewport: DESKTOP[1], deviceScaleFactor: 1 })
  const consoleErrors = []
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    // The willReadFrequently hint is about this script's own getImageData probes.
    if ((m.type() === 'error' || m.type() === 'warning') && !/willReadFrequently/.test(m.text())) consoleErrors.push(`${m.type()}: ${m.text()}`)
  })
  const F = (m) => fail(`${tag}: ${m}`)

  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.views')
  await page.waitForTimeout(400)
  const settle = (ms = 160) => page.waitForTimeout(ms)

  // -------------------------------------------------------------- helpers

  const ids = await page.$$eval('.presets .preset', (els) => els.map((e) => e.dataset.id))
  const nameOf = Object.fromEntries(await page.$$eval('.presets .preset', (els) => els.map((e) => [e.dataset.id, e.textContent.trim()])))

  /** Open an experiment by id; unfolds its group first, as a reader would. */
  const pick = async (id) => {
    await page.evaluate((id) => {
      const btn = document.querySelector(`.preset[data-id="${id}"]`)
      const panel = btn.closest('.presets')
      if (panel && panel.hidden) document.querySelector(`.group-tab[data-group="${panel.dataset.group}"]`).click()
    }, id)
    await page.locator(`.preset[data-id="${id}"]`).click()
    await settle()
  }
  const viewButtons = () => page.$$eval('.view-switch button', (els) => els.map((e) => e.textContent.trim()))
  const showView = async (label) => {
    await page.locator('.view-switch').getByRole('button', { name: label, exact: true }).click()
    await settle(120)
  }
  const topbar = () => page.locator('.topbar').textContent().then((s) => s.replace(/\s+/g, ' ').trim())
  const bodyText = () => page.evaluate(() => document.body.innerText)
  const scrolls = () =>
    page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1)
  const scrollsX = () =>
    page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

  /** Anything that ends past the right edge of the window. */
  const clipped = () =>
    page.evaluate(() => {
      const w = document.documentElement.clientWidth + 1
      return [...document.querySelectorAll('.app, .topbar, .topbar-field, .flow-node, .view, .view-head, .view-head .segmented, .readout, .table')]
        .filter((el) => el.getBoundingClientRect().right > w)
        .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} → ${Math.round(el.getBoundingClientRect().right)}px`)
    })
  /** Elements whose content is wider than the box that holds it. */
  const overflowing = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.app, .topbar, .views, .view, .view-body, .controls')]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ${el.scrollWidth}>${el.clientWidth}`),
    )

  /**
   * Pixel probe of the scope canvas: for a trace colour, the rows and columns
   * it occupies, as fractions of the canvas. Anti-aliased edges are excluded
   * by matching the core colour within a small tolerance.
   */
  const traceExtent = (rgb, sel = '.views canvas') =>
    page.evaluate(
      ([r, g, b, sel]) => {
        const c = document.querySelector(sel)
        if (!c) return null
        const ctx = c.getContext('2d')
        const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
        let top = Infinity
        let bottom = -Infinity
        let left = Infinity
        let right = -Infinity
        let n = 0
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4
            if (Math.abs(data[i] - r) <= 6 && Math.abs(data[i + 1] - g) <= 6 && Math.abs(data[i + 2] - b) <= 6) {
              n++
              if (y < top) top = y
              if (y > bottom) bottom = y
              if (x < left) left = x
              if (x > right) right = x
            }
          }
        }
        if (!n) return { n: 0 }
        return { n, top: top / height, bottom: bottom / height, left: left / width, right: right / width, height }
      },
      [...rgb, sel],
    )

  /** A hash of one strip of the scope canvas, for "the frame did not move". */
  const stripHash = (x0, x1) =>
    page.evaluate(
      ([x0, x1]) => {
        const c = document.querySelector('.views canvas')
        if (!c) return null
        const ctx = c.getContext('2d')
        const w = Math.round(c.width * (x1 - x0))
        const { data } = ctx.getImageData(Math.round(c.width * x0), 0, w, c.height)
        let h = 0
        for (let i = 0; i < data.length; i += 4) h = (h * 31 + data[i] + data[i + 1] * 3 + data[i + 2] * 7) | 0
        return h
      },
      [x0, x1],
    )

  async function setField(label, value) {
    const box = page.getByRole('spinbutton', { name: label }).first()
    await box.fill(String(value))
    await box.press('Enter')
    await settle()
  }

  // ------------------------------------- 1. every experiment, every view

  console.log(`\n1. ${ids.length} experiments × every view at 1440×900: renders, no scroll, no dust, no clipping\n`)
  for (const id of ids) {
    await pick(id)
    if (await scrolls()) F(`${id}: page scrolls`)
    const views = await viewButtons()
    let rendered = 0
    for (const v of views) {
      await showView(v)
      const has = await page.evaluate(() => {
        const bodies = document.querySelectorAll('.view .view-body')
        const body = bodies[bodies.length - 1]
        return !!body && body.querySelector('canvas, table, .math-body, .power-list') !== null
      })
      if (!has) F(`${id}: view "${v}" rendered nothing`)
      else rendered++
      const over = await clipped()
      if (over.length) F(`${id}/${v}: clipped at the right edge: ${over.join(', ')}`)
      const ov = await overflowing()
      if (ov.length) F(`${id}/${v}: overflows its box: ${ov.join(', ')}`)
      // Table cells stacked down the first column: the shared `.num` block rule
      // leaking into a table.
      const stacked = await page.$$eval('.table td.num', (els) => els.filter((e) => getComputedStyle(e).display !== 'table-cell').length)
      if (stacked) F(`${id}/${v}: ${stacked} table cells are not table cells`)
    }
    const text = await bodyText()
    const dust = text.match(/\d(\.\d+)?\s?[fpa](V|A|W|s|C)\b/g)
    if (dust) F(`${id}: rounding dust on screen: ${[...new Set(dust)].join(', ')}`)
    console.log(`   ${id.padEnd(3)} ${nameOf[id].padEnd(40)} ${rendered}/${views.length} views`)
  }

  // ------------------------------------------- 2. the claims the review made

  console.log('\n2. The headline says what the note says\n')
  {
    await pick('a2')
    const t = await topbar()
    if (!/7\.75/.test(t) || !/5\.00/.test(t)) F(`A2 topbar should carry V_rms 7.75 against ⟨v⟩ 5.00: ${t}`)
    if (/100/.test(t)) F(`A2 topbar shows η = 100 %, the opposite of its lesson: ${t}`)
    else console.log(`   A2: ${t.slice(0, 110)}`)
    await pick('a3')
    const t3 = await topbar()
    if (/\bK\b|K_crit/.test(t3)) F(`A3 topbar names K before the curriculum has met it: ${t3}`)
    else console.log(`   A3: no K in the top bar`)
    const letters = (await bodyText()).match(/\b[A-N]\d\b/g)
    if (letters) F(`group letters on screen: ${[...new Set(letters)].join(', ')}`)
    else console.log('   no group letters on any surface')
  }

  // ----------------------------------------------- 3. the ripple is visible

  console.log('\n3. The ripple the note names spans ≥ 15 % of its strip at the defaults\n')
  for (const id of ['a3', 'b3']) {
    await pick(id)
    // Only v_out on the scope, so its strip is the whole frame: the frame is
    // the canvas less the plot's fixed gutters (plotArea: 30k above, 48k below).
    for (const b of await page.locator('.traces button[aria-pressed=true]').all()) {
      if ((await b.textContent()).trim() !== 'v_out') await b.click()
    }
    await settle()
    const e = await traceExtent(RGB.vout)
    if (!e || !e.n) F(`${id}: no v_out trace drawn`)
    else {
      const box = await page.locator('.views canvas').first().boundingBox()
      const k = Math.max(1, Math.min(2.2, box.width / 1150))
      const strip = box.height - 78 * k
      const span = ((e.bottom - e.top) * box.height) / strip
      if (span < 0.15) F(`${id}: v_out spans ${(span * 100).toFixed(1)} % of its strip — a flat line, not a ripple`)
      else console.log(`   ${id}: v_out spans ${(span * 100).toFixed(1)} % of its strip`)
    }
  }

  // ------------------------------------ 4. two strips, currents below volts

  console.log('\n4. Voltages above, currents below: the current colour never enters the voltage strip\n')
  {
    await pick('b3') // iL and vout
    const v = await traceExtent(RGB.vout)
    const i = await traceExtent(RGB.iL)
    if (!v?.n || !i?.n) F('B3: expected both v_out and i_L on the scope')
    else if (i.top < v.bottom) F(`B3: i_L (rows ${(i.top * 100).toFixed(0)}–${(i.bottom * 100).toFixed(0)} %) overlaps v_out (rows ${(v.top * 100).toFixed(0)}–${(v.bottom * 100).toFixed(0)} %) — one axis, two quantities`)
    else console.log(`   B3: v_out ends at ${(v.bottom * 100).toFixed(0)} %, i_L begins at ${(i.top * 100).toFixed(0)} %`)
  }

  // ------------------------------------------ 5. the frame holds still

  console.log('\n5. A knob change inside the frame moves the curve, not the axis\n')
  {
    await pick('a3')
    const before = await stripHash(0, 0.07)
    const e0 = await traceExtent(RGB.vout)
    await setField('C', '200µ')
    const after = await stripHash(0, 0.07)
    const e1 = await traceExtent(RGB.vout)
    if (before !== after) F('A3: doubling C redrew the left axis — the frame is fitted to the data, not anchored')
    else if (!(e1.bottom - e1.top < (e0.bottom - e0.top) * 0.7)) F(`A3: doubling C should visibly halve the ripple (${((e0.bottom - e0.top) * 100).toFixed(1)} % → ${((e1.bottom - e1.top) * 100).toFixed(1)} %)`)
    else console.log(`   A3: axis unchanged, ripple ${((e0.bottom - e0.top) * 100).toFixed(1)} % → ${((e1.bottom - e1.top) * 100).toFixed(1)} % of the canvas`)
    const pristine = await page.locator('[data-role=note]').getAttribute('data-pristine')
    if (pristine !== 'false') F('the note should retire after a knob moves')
    // The way back: the reset chip beside the retired note restores the defaults.
    const reset = page.locator('[data-role=reset]')
    if ((await reset.count()) === 0) F('no reset chip beside the retired note')
    else {
      await reset.click()
      await settle()
      if ((await page.locator('[data-role=note]').getAttribute('data-pristine')) !== 'true') F('reset did not restore the defaults')
      else console.log('   reset chip restores the defaults and the note')
    }
  }

  // ------------------------------------ 5b. bars sized to their pane

  {
    await pick('a1')
    const bar = await page.locator('.power-row .bar').first().boundingBox()
    const pane = await page.locator('.view').first().boundingBox()
    if (!bar) F('A1: no loss bar on screen')
    else if (bar.height < 24 || bar.width < pane.width * 0.4) F(`A1: loss bars are ${Math.round(bar.height)} px tall and ${Math.round(bar.width)} px wide in a ${Math.round(pane.width)} px pane — sized to a phone row, not to the pane`)
    else console.log(`   A1: loss bars ${Math.round(bar.height)} px tall, ${Math.round(bar.width)} of ${Math.round(pane.width)} px wide`)
  }

  // ------------------------------------ 5c. the drawing is not letterboxed

  {
    // `max-height` on an SVG does not shrink its box, it letterboxes the
    // picture inside it: the drawing was rendering at 69 % of its own units,
    // floating in a slot half again as wide as it needed, which put 9 px
    // labels on screen at 6 px. Nothing in the suite could see it — the
    // markup was identical either way (Reed, 2026-09-02: "the circuit
    // schematics are far too small"). This measures the scale it actually
    // draws at, on the taller of the two desktops, where the sidebar has the
    // room. At 1366×768 it is deliberately capped; the fold check owns that.
    for (const id of ['a1', 'b1', 'e2']) {
      await pick(id)
      const m = await page.evaluate(() => {
        const svg = document.querySelector('.controls .schematic')
        if (!svg) return null
        const r = svg.getBoundingClientRect()
        const [, , w, h] = (svg.getAttribute('viewBox') || '0 0 0 0').split(/\s+/).map(Number)
        const scale = Math.min(r.width / w, r.height / h)
        return { drawn: Math.round(w * scale), box: Math.round(r.width), scale: +scale.toFixed(3) }
      })
      // The rule is legibility, not tidiness: every size in these drawings —
      // the 9 px labels most of all — is written in the frame's own units, so
      // a frame rendered below 1:1 is type below the size it was drawn at.
      if (!m) F(`${id}: no schematic in the sidebar`)
      else if (m.scale < 1)
        F(`${id}: the drawing renders at ${m.scale}× its own units, so its 9 px labels are ${(9 * m.scale).toFixed(1)} px on screen`)
      else console.log(`   ${id}: drawn at ${m.scale}× (${m.drawn} px of a ${m.box} px slot)`)
    }
  }

  // ----------------------------------------------- 6. marks on the plot

  console.log('\n6. The note\'s numbers are drawn where they happen\n')
  {
    await pick('e1')
    const marks = await page.$$eval('.views canvas', (els) => els.map((c) => c.dataset.marks || '').join('|'))
    if (!/42\.9°/.test(marks)) F(`E1: the conduction angle 42.9° is not marked on the scope (marks: ${marks || 'none'})`)
    else console.log(`   E1: ${marks.split('|')[0]}`)
    await pick('a2')
    const m2 = await page.$$eval('.views canvas', (els) => els.map((c) => c.dataset.marks || '').join('|'))
    if (!/7\.75/.test(m2) || !/5\.00|5 V/.test(m2)) F(`A2: ⟨v⟩ and V_rms are not drawn as lines on the scope (marks: ${m2 || 'none'})`)
    else console.log(`   A2: ${m2.split('|')[0]}`)
    await pick('c2')
    const m3 = await page.$$eval('.views canvas', (els) => els.map((c) => c.dataset.marks || '').join('|'))
    if (!/peak/.test(m3)) F(`C2: the peak is not marked on the sweep (marks: ${m3 || 'none'})`)
    else console.log(`   C2: ${m3}`)
    await pick('b5')
    const m4 = await page.$$eval('.views canvas', (els) => els.map((c) => c.dataset.marks || '').join('|'))
    if (!/R_crit/.test(m4)) F(`B5: the boundary is not marked on the sweep (marks: ${m4 || 'none'})`)
    else console.log(`   B5: ${m4}`)
  }

  // --------------------------------------------- 7. next and previous

  console.log('\n7. A path: next and previous walk the list in order\n')
  {
    await pick(ids[0])
    const counter = await page.locator('[data-role=position]').textContent().catch(() => '')
    if (!new RegExp(`1 of ${ids.length}`).test(counter)) F(`position should read "1 of ${ids.length}": "${counter}"`)
    let walked = 1
    for (let i = 1; i < ids.length; i++) {
      const next = page.locator('[data-role=next]')
      if ((await next.count()) === 0 || (await next.isDisabled())) {
        F(`no next from ${ids[i - 1]}`)
        break
      }
      await next.click()
      await settle(120)
      const on = await page.$eval('.preset.is-on', (e) => e.dataset.id)
      if (on !== ids[i]) {
        F(`next from ${ids[i - 1]} landed on ${on}, not ${ids[i]}`)
        break
      }
      walked++
    }
    const last = page.locator('[data-role=next]')
    if ((await last.count()) && !(await last.isDisabled())) F('the last experiment still offers a next')
    console.log(`   walked ${walked} of ${ids.length} with next; position "${counter}"; last has no next`)
    // Every note ends with where it leads, and the link goes there.
    let links = 0
    for (const id of ids) {
      await pick(id)
      const a = page.locator('[data-role=next-link]')
      if ((await a.count()) === 0) continue
      const target = await a.getAttribute('data-target')
      if (!ids.includes(target)) F(`${id}: next link points at ${target}, which is not an experiment`)
      links++
    }
    console.log(`   ${links} notes carry a next link`)
    // The next link goes where it says.
    await pick(ids[0])
    await page.locator('[data-role=next-link]').click()
    await settle(120)
    const landed = await page.$eval('.preset.is-on', (e) => e.dataset.id)
    if (landed !== ids[1]) F(`the note's next link from ${ids[0]} landed on ${landed}, not ${ids[1]}`)
    else console.log(`   the note's next link walks ${ids[0]} → ${ids[1]}`)
    // The terms line is fresh (named, in the accent) on the first visit of an
    // experiment this session and plain on a return.
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('.views')
    const first = await page.$eval('details.terms', (d) => d.classList.contains('is-fresh'))
    await pick('a2')
    await pick('a1')
    const again = await page.$eval('details.terms', (d) => d.classList.contains('is-fresh'))
    if (!first) F('the terms line is not marked fresh on the first visit')
    else if (again) F('the terms line is still marked fresh on a return visit')
    else console.log('   the terms line is fresh on the first visit and plain on a return')
    // The try line's chip puts the keyboard on the knob it names.
    await pick('b3')
    await page.locator('.try .knob-chip').click()
    const focused = await page.evaluate(() => document.activeElement.closest('[data-knob]')?.dataset.knob)
    if (focused !== 'fs') F(`B3's try chip focused ${focused}, not f_s`)
    else console.log('   the try chip focuses the knob it names')
  }

  // ------------------------------------- 7b. a multi-step try is performed

  console.log("\n7b. B4's multi-step try: each chip advances to the next step and actually flips the mode\n")
  {
    await pick('b4')
    // .innerText() reflects the CSS text-transform on .try-label, so "Try"
    // renders "TRY" — match case-insensitively rather than the source string.
    const tryText = () => page.locator('[data-role=try]').innerText()
    // The mode node, not the whole flow strip: B4's own NAME is "Light load:
    // discontinuous conduction", so a substring test against the full strip
    // would always find "discontinuous" whatever the mode actually reads.
    const modeText = () => page.locator('.flow-node:not(.is-name):not(.is-out)').innerText()
    const t0 = await tryText()
    if (!/try 1\/3/i.test(t0)) F(`B4 should open on step 1 of 3: "${t0.slice(0, 40)}"`)
    // Step 1: synchronous switch on — CCM, the current goes negative.
    await page.locator('.try .knob-chip').click()
    await settle()
    const t1 = await tryText()
    if (!/try 2\/3/i.test(t1)) F(`B4's step 1 chip should advance to step 2 of 3: "${t1.slice(0, 40)}"`)
    const syncOn = await page.evaluate(() => document.querySelector('[data-knob="sync"] button[aria-pressed="true"]')?.textContent.trim())
    if (syncOn !== 'synchronous switch') F(`B4 step 1 should turn Freewheel to synchronous switch, reads "${syncOn}"`)
    const mode1 = await modeText()
    if (!mode1.startsWith('continuous conduction')) F(`B4 step 1 (synchronous switch) should read continuous conduction: "${mode1}"`)
    // Step 2: back to diode — DCM returns, 8.52 V.
    await page.locator('.try .knob-chip').click()
    await settle()
    const t2 = await tryText()
    if (!/try 3\/3/i.test(t2)) F(`B4's step 2 chip should advance to step 3 of 3: "${t2.slice(0, 40)}"`)
    const mode2 = await modeText()
    if (!mode2.startsWith('discontinuous conduction')) F(`B4 step 2 (diode restored) should read discontinuous conduction: "${mode2}"`)
    const topbarDcm = await topbar()
    if (!/8\.51/.test(topbarDcm)) F(`B4 step 2 (diode restored) should read close to 8.52 V out: "${topbarDcm.slice(0, 120)}"`)
    // Step 3: R = 5 Ω — continuous conduction on its own, 5.00 V.
    await page.locator('.try .knob-chip').click()
    await settle()
    const rNow = await page.evaluate(() => document.querySelector('[data-knob="R"] input')?.value)
    if (Math.abs(Number(rNow) - 5) > 0.01) F(`B4 step 3 should set R_load to 5 Ω, reads ${rNow}`)
    const mode3 = await modeText()
    if (!mode3.startsWith('continuous conduction')) F(`B4 step 3 (R = 5 Ω) should read continuous conduction: "${mode3}"`)
    console.log('   B4: step 1/3 → 2/3 → 3/3, the switch and the load each flip the mode a click asks for')
  }

  // ---------------------------------------------- 8. above the fold

  console.log('\n8. Above the fold: note, schematic, first knob and the Math button, without scrolling\n')
  for (const vp of DESKTOP) {
    await page.setViewportSize(vp)
    await settle(300)
    let bad = 0
    for (const id of ids) {
      await pick(id)
      const m = await page.evaluate(() => {
        const box = (sel) => {
          const el = document.querySelector(sel)
          return el ? el.getBoundingClientRect() : null
        }
        const note = box('[data-role=note]')
        const sch = box('.schematic')
        const knob = box('.controls .num')
        const math = [...document.querySelectorAll('.view-switch button')].find((b) => b.textContent.trim() === 'Math')
        const mb = math ? math.getBoundingClientRect() : null
        return {
          note: note ? note.bottom : Infinity,
          sch: sch ? sch.bottom : Infinity,
          knob: knob ? knob.bottom : Infinity,
          math: mb ? mb.bottom : Infinity,
          h: window.innerHeight,
        }
      })
      const probs = []
      if (!(m.note <= m.h)) probs.push(`note ends at ${Math.round(m.note)}`)
      if (!(m.sch <= m.h)) probs.push(`schematic ends at ${Math.round(m.sch)}`)
      if (!(m.knob <= m.h)) probs.push(`first knob ends at ${Math.round(m.knob)}`)
      if (!(m.math <= m.h)) probs.push(`Math button at ${Math.round(m.math)}`)
      if (probs.length) {
        bad++
        F(`${vp.width}×${vp.height} / ${id}: below the fold — ${probs.join(', ')} (window ${m.h})`)
      }
    }
    console.log(`   ${vp.width}×${vp.height}: ${ids.length - bad}/${ids.length} experiments have everything above the fold`)
  }

  // ------------------------------------------- 9. the weighted split

  console.log('\n9. The pane the experiment is about gets the height\n')
  {
    await page.setViewportSize(DESKTOP[0])
    await settle(300)
    let bad = 0
    for (const id of ids) {
      await pick(id)
      const m = await page.evaluate(() => {
        const main = document.querySelector('main.views')
        const panes = [...main.querySelectorAll(':scope > .view')].map((p) => p.getBoundingClientRect().height)
        const primary = main.querySelector(':scope > .view.is-primary')
        return { panes, primary: primary ? primary.getBoundingClientRect().height : null, total: main.getBoundingClientRect().height }
      })
      if (m.panes.length === 1) continue
      if (m.primary === null) {
        bad++
        F(`${id}: no pane is marked primary`)
      } else if (m.primary / m.total < 0.55) {
        bad++
        F(`${id}: the primary pane has ${((100 * m.primary) / m.total).toFixed(0)} % of the height (want ≥ 55 %)`)
      }
    }
    console.log(`   ${ids.length - bad}/${ids.length} experiments give their primary pane ≥ 55 %`)
  }

  // -------------------------------------------- 10. widths, no overflow

  console.log('\n10. Nothing overflows at 1280, 1366, 1440 and 1920 wide\n')
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    await settle(300)
    let bad = 0
    for (const id of ids) {
      await pick(id)
      for (const v of await viewButtons()) {
        await showView(v)
        const over = await clipped()
        const ov = await overflowing()
        if (over.length || ov.length || (await scrollsX())) {
          bad++
          F(`${width}px / ${id}/${v}: ${[...over, ...ov].join(', ') || 'page scrolls sideways'}`)
        }
      }
    }
    console.log(`   ${width}px: ${bad ? `${bad} overflow${bad > 1 ? 's' : ''}` : 'clean'}`)
  }

  // ------------------------------------- 10b. the claim chip is in view

  // The top bar's strip reads name → mode → outcome, and the outcome is the
  // number the experiment is about. On the step-8 walk it was scrolled out
  // of sight for B4, C1–C5 and E1–E6 at both desktop sizes: the strip
  // scrolls sideways rather than truncating, so nothing above caught it.
  console.log('\n10b. The outcome chip of the top bar is in view at 1280, 1366 and 1440 wide\n')
  for (const width of [1280, 1366, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await settle(300)
    let bad = 0
    for (const id of ids) {
      await pick(id)
      const m = await page.evaluate(() => {
        const flow = document.querySelector('.flow')
        const out = document.querySelector('.flow-node.is-out')
        const f = flow.getBoundingClientRect()
        const o = out.getBoundingClientRect()
        const cut = [...flow.querySelectorAll('.flow-node')].filter((n) => n.scrollWidth > n.clientWidth + 1 && n.style.textOverflow !== 'ellipsis' && getComputedStyle(n).textOverflow !== 'ellipsis').length
        return { hidden: flow.scrollWidth > flow.clientWidth + 1 || o.right > f.right + 1 || o.left < f.left - 1, cut, text: out.textContent.trim() }
      })
      if (m.hidden || m.cut) {
        bad++
        F(`${width}px / ${id}: outcome chip "${m.text}" ${m.hidden ? 'is scrolled out of view' : 'is truncated'}`)
      }
    }
    console.log(`   ${width}px: ${ids.length - bad}/${ids.length} experiments show their outcome chip whole`)
  }

  // ---------------------------------------------------- 11. the phone

  console.log('\n11. 390×844: the top bar wraps and never truncates, the title appears once, the schematic is on the first screen\n')
  {
    await page.setViewportSize({ width: 390, height: 844 })
    await settle(400)
    let bad = 0
    for (const id of ids) {
      await pick(id)
      await page.evaluate(() => window.scrollTo(0, 0))
      const m = await page.evaluate(() => {
        const cut = [...document.querySelectorAll('.topbar-field, .flow-node')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.trim())
        const titles = document.querySelectorAll('h3.note-title').length
        const sch = [...document.querySelectorAll('.schematic')].map((s) => s.getBoundingClientRect()).find((r) => r.width > 0)
        return { cut, titles, schTop: sch ? sch.top : Infinity, schBottom: sch ? sch.bottom : Infinity, x: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }
      })
      const probs = []
      if (m.cut.length) probs.push(`truncated: ${m.cut.join(' | ')}`)
      if (m.titles !== 1) probs.push(`${m.titles} titles`)
      if (!(m.schTop >= 0 && m.schBottom <= 844)) probs.push(`schematic at ${Math.round(m.schTop)}–${Math.round(m.schBottom)}`)
      if (m.x) probs.push('scrolls sideways')
      if (probs.length) {
        bad++
        F(`390px / ${id}: ${probs.join('; ')}`)
      }
    }
    await pick('a1')
    const bars = await page.locator('.power-row').count()
    if (!bars) {
      bad++
      F('390px / a1: the loss bars are not on screen')
    }
    console.log(`   ${ids.length - bad}/${ids.length} experiments pass at 390 px`)
  }

  // ------------------------------------------------ a11y and the console

  await page.setViewportSize(DESKTOP[1])
  await settle(300)
  await pick('b3')
  const audit = await page.evaluate(() => {
    const problems = []
    const nameOf = (el) =>
      el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.labels && el.labels.length) || (el.textContent || '').trim() || el.getAttribute('title')
    for (const el of document.querySelectorAll('button, select, input, [role=img]')) {
      if (el.type === 'hidden' || el.disabled) continue
      if (!nameOf(el)) problems.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40) || '?'} has no accessible name`)
    }
    for (const c of document.querySelectorAll('canvas')) {
      if (c.getAttribute('role') !== 'img' || !c.getAttribute('aria-label')) problems.push('canvas without role="img" + aria-label')
    }
    return [...new Set(problems)]
  })
  for (const p of audit) F(`a11y: ${p}`)
  if (!audit.length) console.log('\nA11y: no unnamed controls, no unlabelled plots')

  if (consoleErrors.length) {
    console.log(`\nBROWSER CONSOLE (${consoleErrors.length}):`)
    for (const e of [...new Set(consoleErrors)].slice(0, 20)) console.log('   ' + e)
    F(`${consoleErrors.length} console errors/warnings`)
  } else console.log('No browser console errors or warnings.')

  await page.close()
}
