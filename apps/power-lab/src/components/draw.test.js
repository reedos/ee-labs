// The scope and the sweep as drawings: what lands on the canvas, and where.
//
// The review's complaints about the plots were about pixels — a ripple too
// small to see, a legend written over the trace, a current on the voltage
// axis, a number in the note with nothing on the plot to point at. These run
// the pure draw functions against a recording context and restate each
// complaint as a measurement.

import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, TRACES, SWEEP_Y, byId, defaultsOf } from '../experiments.js'
import { analyse } from '../analysis.js'
import { sweepFor } from '../App.jsx'
import { scopeMarks, sweepMarks } from '../marks.js'
import { drawScope } from './ScopeCanvas.jsx'
import { drawSweep, sweepLegend, atLabel, sweepRange, FRAME_SHARE } from './SweepCanvas.jsx'
import { drawFlux, drawSpectrum } from './panes.jsx'
import { fakeCtx, texts, textBox, overlaps } from './fakeCanvas.js'

const W = 850
const H = 360
const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p), base: analyse(exp, defaultsOf(id)) }
}
const scope = (id, over = {}, traces = null) => {
  const { exp, x, base } = at(id, over)
  const ctx = fakeCtx()
  const g = drawScope(ctx, W, H, { wf: x.wf, baseWf: base.wf, traces: traces || exp.traces, marks: scopeMarks(exp, x) })
  return { exp, x, base, ctx, g }
}
const sweep = (id, over = {}) => {
  const { exp, p, x, base } = at(id, over)
  const s = sweepFor(exp, p, x)
  const b = sweepFor(exp, defaultsOf(id), base)
  const ctx = fakeCtx()
  const marks = sweepMarks(exp, x, s)
  const g = drawSweep(ctx, W, H, { points: s.points, basePoints: b.points, sweep: exp.sweep, at: s.at, atY: s.atY, atY2: s.atY2, marks })
  return { exp, x, s, b, ctx, g, marks }
}
/** One sweep drawn at a given size, for the axis probes below. */
const sweepAt = (id, W2, H2) => {
  const { exp, p, x, base } = at(id)
  const s = sweepFor(exp, p, x)
  const b = sweepFor(exp, defaultsOf(id), base)
  const ctx = fakeCtx()
  const marks = sweepMarks(exp, x, s)
  const g = drawSweep(ctx, W2, H2, { points: s.points, basePoints: b.points, sweep: exp.sweep, at: s.at, atY: s.atY, atY2: s.atY2, marks })
  return { exp, x, s, ctx, g, marks }
}
const traceLabels = new Set(Object.values(TRACES).map((t) => t.label))

describe('the scope', () => {
  it('writes no trace name over the traces: the legend is the chips in the pane header', () => {
    for (const e of EXPERIMENTS) {
      if (e.scope === false) continue
      const { ctx } = scope(e.id)
      const drawn = texts(ctx).filter((t) => traceLabels.has(t.text))
      expect(drawn, `${e.id}: ${drawn.map((t) => t.text).join(', ')}`).toEqual([])
    }
  })

  it('puts currents in their own strip below the voltages, on one time axis', () => {
    const { g } = scope('b3', {}, ['iL', 'vout'])
    expect(g.strips.map((s) => s.axis)).toEqual(['V', 'A'])
    const [v, a] = g.strips
    expect(a.area.y).toBeGreaterThanOrEqual(v.area.y + v.area.h)
    expect(a.area.x).toBe(v.area.x)
    expect(a.area.w).toBe(v.area.w)
  })

  it('labels time once, under the lower strip', () => {
    const { ctx, g } = scope('b3', {}, ['iL', 'vout'])
    const time = texts(ctx).filter((t) => t.text === 'Time')
    expect(time).toHaveLength(1)
    const lower = g.strips[1].area
    expect(time[0].y).toBeGreaterThan(lower.y + lower.h)
    // Every time tick label is below the lower strip too.
    const ticks = texts(ctx).filter((t) => /s$/.test(t.text) && t.text !== 'Time')
    expect(ticks.length).toBeGreaterThan(2)
    for (const t of ticks) expect(t.y, t.text).toBeGreaterThan(lower.y + lower.h)
  })

  it('names an edge only where the name fits before the next edge or the frame (found on the step-8 walk: B5’s zero-length dead interval put "dea" at the edge and "dead" over "on")', () => {
    const { ctx, g, x } = scope('b5')
    const names = new Set(x.wf.edges.map((e) => e.name))
    const labels = texts(ctx).filter((t) => names.has(t.text))
    expect(labels.length).toBeGreaterThan(2)
    const right = g.strips[0].area.x + g.strips[0].area.w
    const width = (t) => ctx.measureText(t.text).width
    for (const t of labels) expect(t.x + width(t), `${t.text} at ${t.x}`).toBeLessThanOrEqual(right + 1)
    const byX = [...labels].sort((a, b) => a.x - b.x)
    for (let i = 1; i < byX.length; i++) {
      expect(byX[i].x - byX[i - 1].x, `${byX[i - 1].text} then ${byX[i].text}`).toBeGreaterThanOrEqual(width(byX[i - 1]))
    }
  })

  it('gives one strip to an experiment showing one kind of trace', () => {
    expect(scope('a3').g.strips.map((s) => s.axis)).toEqual(['V'])
    expect(scope('b5').g.strips.map((s) => s.axis)).toEqual(['V', 'A'])
  })

  it('lets the ripple the note names take at least 15 % of its strip', () => {
    for (const id of ['a3', 'b3']) {
      const { x, g } = scope(id, {}, ['vout'])
      const v = g.strips[0]
      const px = Math.abs(v.sy(x.m.sig.vout.max) - v.sy(x.m.sig.vout.min))
      expect(px / v.area.h, id).toBeGreaterThanOrEqual(0.15)
      expect(px / v.area.h, id).toBeLessThan(0.5)
    }
  })

  it('holds the frame still while the ripple halves', () => {
    const a = scope('a3', {}, ['vout'])
    const b = scope('a3', { C: 2 * defaultsOf('a3').C }, ['vout'])
    expect(b.g.strips[0].lo).toBe(a.g.strips[0].lo)
    expect(b.g.strips[0].hi).toBe(a.g.strips[0].hi)
    const px = (r) => Math.abs(r.g.strips[0].sy(r.x.m.sig.vout.max) - r.g.strips[0].sy(r.x.m.sig.vout.min))
    expect(px(b)).toBeLessThan(px(a) * 0.6)
  })
})

describe("the scope's marks", () => {
  it("draws the chopper's mean and RMS as labelled lines at their own heights", () => {
    const { x, ctx, g } = scope('a2')
    const v = g.strips[0]
    const drawn = texts(ctx)
    const mean = drawn.find((t) => t.text.startsWith('⟨v⟩ = 5'))
    const rms = drawn.find((t) => t.text.startsWith('V_rms = 7.75'))
    expect(mean).toBeTruthy()
    expect(rms).toBeTruthy()
    // The label sits just above its line, and the line is at the value.
    expect(Math.abs(mean.y - v.sy(x.m.sig.vout.avg))).toBeLessThan(6)
    expect(Math.abs(rms.y - v.sy(x.m.sig.vout.rms))).toBeLessThan(6)
    // Independently of sy: the line's height is where the value falls in the range.
    const frac = (x.m.sig.vout.rms - v.lo) / (v.hi - v.lo)
    expect(Math.abs(v.sy(x.m.sig.vout.rms) - (v.area.y + v.area.h - frac * v.area.h))).toBeLessThan(1)
  })

  it("shades the rectifier's conduction interval and labels it with the angle", () => {
    const { x, ctx, g } = scope('e1')
    const [mk] = scopeMarks(byId.e1, x).filter((m) => m.type === 'span')
    expect(mk).toBeTruthy()
    expect(mk.label).toBe(`${x.m.angle.toFixed(1)}°`)
    expect(mk.label).toBe('42.9°')
    // The span really is the conduction angle.
    expect((((mk.t1 - mk.t0) / x.T) * 360)).toBeCloseTo(x.m.angle, 6)
    const label = texts(ctx).find((t) => t.text === mk.label)
    expect(label).toBeTruthy()
    // Centred on the interval, within a pixel; and that centre is where the
    // interval falls along the time axis.
    const mid = (g.sx(mk.t0 * g.unit) + g.sx(mk.t1 * g.unit)) / 2
    expect(Math.abs(label.x - mid)).toBeLessThan(1)
    const area = g.strips[0].area
    const frac = ((mk.t0 + mk.t1) / 2) * g.unit
    expect(Math.abs(mid - (area.x + ((frac - g.xMin) / (g.xMax - g.xMin)) * area.w))).toBeLessThan(1)
    const fill = ctx.calls.find((c) => c.name === 'fillRect' && Math.abs(c.args[0] - g.sx(mk.t0 * g.unit)) < 1)
    expect(fill).toBeTruthy()
  })
})

describe('the sweep', () => {
  it('writes no legend over the curves: the legend is a list under the plot', () => {
    for (const e of EXPERIMENTS) {
      if (!e.sweep) continue
      const { ctx, s } = sweep(e.id)
      const legend = sweepLegend(s.points, e.sweep, s.label).map((i) => i.text)
      expect(legend.length).toBeGreaterThan(0)
      const drawn = texts(ctx).map((t) => t.text)
      for (const item of legend) expect(drawn, `${e.id}: "${item}"`).not.toContain(item)
      expect(drawn.some((t) => /measured|dashed|dotted|right axis|shaded/.test(t)), `${e.id}: ${drawn.join(' | ')}`).toBe(false)
    }
  })

  it('frames its axis on the defaults, so a knob moves the curve and not the frame', () => {
    const a = sweep('b5')
    const b = sweep('b5', { L: defaultsOf('b5').L * 1.5 })
    expect(b.g.sy(0.5)).toBe(a.g.sy(0.5))
    expect(b.g.sy(1)).toBe(a.g.sy(1))
  })

  // Whether a fillText was drawn under a rotate: the calls since the last save.
  const rotated = (ctx, text) => {
    const calls = ctx.calls
    const i = calls.findIndex((c) => c.name === 'fillText' && String(c.args[0]) === text)
    expect(i, `"${text}" is drawn`).toBeGreaterThan(-1)
    let last = 0
    for (let j = 0; j < i; j++) if (calls[j].name === 'save') last = j
    return calls.slice(last, i).some((c) => c.name === 'rotate')
  }

  it('writes a one-glyph axis title upright (found on the step-8 walk: C2’s rotated η read as a stray mark)', () => {
    expect(rotated(sweep('c2').ctx, 'η')).toBe(false)
    // A worded title still runs down the axis, as titles do.
    expect(rotated(sweep('c5').ctx, 'V_out (V)')).toBe(true)
  })

  // The same failure, on the other axis: B6, B7 and B8 sweep η with no y2,
  // so the bare glyph is the LEFT axis's title — drawFrame's own, not
  // SweepCanvas's y2 code, and drawFrame rotates every title it is given.
  // C2's fix reached the right axis only; the left one kept rotating a lone
  // η until this test (2026-09-03, the same review that found the giant
  // empty A1 sweep).
  it('the left axis keeps the same rule: B6, B7 and B8 also sweep η alone, and it stays upright there too', () => {
    for (const id of ['b6', 'b7', 'b8']) expect(rotated(sweep(id).ctx, 'η'), id).toBe(false)
  })

  // Reed, 2026-09-03: A1's marker read "5 Ω → 4.935 V" — the nearest of the
  // 61 sampled loads, not the 5 V every other pane on screen agreed on.
  it("the \"at\" marker draws the exact analysed value, not the sweep's nearest sampled point", () => {
    const { x, ctx, g, s } = sweep('a1')
    // The default load, 5 Ω, is not one of the sweep's own 61 log-spaced
    // samples, so a marker reading the nearest one would print something
    // other than 5 V here.
    expect(s.points.some((q) => Math.abs(q.x - 5) < 1e-9)).toBe(false)
    expect(x.m.sig.vout.avg).toBeCloseTo(5, 9)
    const text = texts(ctx).find((t) => /→/.test(t.text))
    expect(text, 'the marker’s label is drawn').toBeTruthy()
    expect(text.text).toBe('5 Ω → 5 V')
    // The dot itself sits at the exact value, not a resampled one: its
    // centre is at the cursor's own x (g.sx(g.X(5))) and at 5 V's y, not at
    // whichever sample happens to be nearest 5 Ω.
    const cx = g.sx(g.X(5))
    const cy = g.sy(g.Y(5))
    const ring = ctx.calls.find((c) => c.name === 'arc' && Math.abs(c.args[0] - cx) < 0.5 && Math.abs(c.args[1] - cy) < 0.5)
    expect(ring, 'the dot is drawn at the exact cursor and value').toBeTruthy()
  })

  it("marks the boost's peak on its curve, at the exact D it happens — not the sweep grid's nearest sample to it", () => {
    const { x, ctx, g, marks } = sweep('c2')
    const peak = marks.find((m) => m.type === 'point')
    expect(peak).toBeTruthy()
    expect(peak.label).toMatch(/^peak M = \d+\.\d\d at D = 0\.\d\d$/)
    // The same number the math panel's "the peak this R_L allows" row shows
    // (x.formulas.Mpeak/Dpeak) — the exact analytic peak, which need not
    // land on one of sweepD's 61 samples the way A1's design load did not
    // land on its own sweep's samples (2026-09-03).
    expect(peak.y).toBeCloseTo(x.formulas.Mpeak, 9)
    expect(peak.x).toBeCloseTo(x.formulas.Dpeak, 9)
    const label = texts(ctx).find((t) => t.text === peak.label)
    expect(label).toBeTruthy()
    const k = g.area.k
    // Anchored 7k beside the point, within a pixel; and the point is where D falls on the axis.
    expect(Math.abs(Math.abs(label.x - g.sx(peak.x)) - 7 * k)).toBeLessThan(1)
    expect(Math.abs(g.sx(peak.x) - (g.area.x + ((peak.x - g.xMin) / (g.xMax - g.xMin)) * g.area.w))).toBeLessThan(1)
    const ring = ctx.calls.find((c) => c.name === 'arc' && Math.abs(c.args[0] - g.sx(peak.x)) < 1 && Math.abs(c.args[1] - g.sy(peak.y)) < 1)
    expect(ring).toBeTruthy()
  })

  it('marks the boundary load on the light-load sweep', () => {
    const { x, ctx, g, marks } = sweep('b5')
    const line = marks.find((m) => m.type === 'vline')
    const pt = marks.find((m) => m.type === 'point')
    expect(line.x).toBe(x.formulas.Rcrit)
    expect(line.label).toMatch(/^R_crit = \d/)
    expect(pt.x).toBe(x.formulas.Rcrit)
    const label = texts(ctx).find((t) => t.text === line.label)
    expect(label).toBeTruthy()
    const k = g.area.k
    expect(Math.abs(label.x - (g.sx(Math.log10(line.x)) + 4 * k))).toBeLessThan(1)
    // The boundary point sits on the measured curve: M there lies between the
    // sweep points either side of R_crit.
    const { s } = sweep('b5')
    const i = s.points.findIndex((q) => q.x >= x.formulas.Rcrit)
    const lo = Math.min(s.points[i - 1].M, s.points[i].M)
    const hi = Math.max(s.points[i - 1].M, s.points[i].M)
    expect(pt.y).toBeGreaterThanOrEqual(lo - 1e-12)
    expect(pt.y).toBeLessThanOrEqual(hi + 1e-12)
    const ring = ctx.calls.find((c) => c.name === 'arc' && Math.abs(c.args[0] - g.sx(Math.log10(pt.x))) < 1)
    expect(ring).toBeTruthy()
  })
})
// REVIEW_PLAYBOOK.md class 4: an axis is a quantity, a unit and a range a
// reader can read a value off. The third of those went missing across the
// lab. `drawFrame` sizes its tick step from how much room the plot has, and
// `niceStep` rounds that up to 1, 2 or 5 times a power of ten, so a short
// frame can be handed a step as large as its own range. Forty of the lab's
// scope strips came out with one or two labels on them: G4's output strip ran
// 4.63 to 4.69 V and said "4.65 V", C3's ran 33.485 to 33.505 V and said
// "33.5 V", D1's flux ran +/-400 mT and said "0 T", and F4's carrier sweep
// spanned 300 Hz to 8 kHz and said "1 kHz". Every one of those is an axis a
// student cannot measure anything against.
describe('every axis carries a scale, not just a quantity and a unit', () => {
  // A desktop pane, a squeezed one, and a phone. The steps are chosen from the
  // frame's height and width, so all three have to hold.
  const SIZES = [
    [850, 360],
    [850, 210],
    [330, 300],
  ]
  const MIN = 3
  /** The y tick labels drawn against one framed area: `drawFrame` puts them at x = area.x - 8k. */
  const yTicksOf = (ctx, area) =>
    texts(ctx).filter(
      (t) => Math.abs(t.x - (area.x - 8 * (area.k || 1))) < 2 && t.y >= area.y - 2 && t.y <= area.y + area.h + 2,
    )
  /** The x tick labels: at y = area.y + area.h + 14k. */
  const xTicksOf = (ctx, area) => texts(ctx).filter((t) => Math.abs(t.y - (area.y + area.h + 14 * (area.k || 1))) < 2)

  it('gives every scope strip at least three tick labels, all different', () => {
    for (const [W, H] of SIZES) {
      for (const e of EXPERIMENTS) {
        if (e.scope === false) continue
        const { exp, x } = at(e.id)
        const ctx = fakeCtx()
        const g = drawScope(ctx, W, H, { wf: x.wf, baseWf: x.wf, traces: exp.traces, marks: scopeMarks(exp, x) })
        for (const s of g.strips) {
          const ticks = yTicksOf(ctx, s.area).map((t) => t.text)
          expect(ticks.length, `${W}x${H} ${e.id} ${s.axis}: [${ticks.join(' | ')}] over ${s.lo}..${s.hi}`).toBeGreaterThanOrEqual(MIN)
          expect(new Set(ticks).size, `${W}x${H} ${e.id} ${s.axis}: ${ticks.join(' | ')}`).toBe(ticks.length)
        }
      }
    }
  }, 120000)

  it('gives every sweep at least three tick labels on each axis, all different', () => {
    for (const [W, H] of SIZES) {
      for (const e of EXPERIMENTS) {
        if (!e.sweep) continue
        const { s, ctx, g } = sweepAt(e.id, W, H)
        expect(g, e.id).toBeTruthy()
        expect(s.points.length).toBeGreaterThan(2)
        for (const [which, ticks] of [
          ['y', yTicksOf(ctx, g.area).map((t) => t.text)],
          ['x', xTicksOf(ctx, g.area).map((t) => t.text)],
        ]) {
          expect(ticks.length, `${W}x${H} ${e.id} ${which}: [${ticks.join(' | ')}]`).toBeGreaterThanOrEqual(MIN)
          expect(new Set(ticks).size, `${W}x${H} ${e.id} ${which}: ${ticks.join(' | ')}`).toBe(ticks.length)
        }
      }
    }
  }, 120000)

  it("gives the flux plot a scale too, and spends its height on the polarity the flux has", () => {
    for (const [W, H] of SIZES) {
      for (const id of ['d1', 'd2']) {
        const { x } = at(id)
        const ctx = fakeCtx()
        const g = drawFlux(ctx, W, H, { flux: x.flux, T: x.T })
        const ticks = yTicksOf(ctx, g.area).map((t) => t.text)
        expect(ticks.length, `${W}x${H} ${id}: [${ticks.join(' | ')}] over ${g.lo}..${g.hi}`).toBeGreaterThanOrEqual(MIN)
        expect(new Set(ticks).size, `${W}x${H} ${id}: ${ticks.join(' | ')}`).toBe(ticks.length)
        // Both cores carry their flux one way, so the frame starts at zero and
        // draws the one ceiling the trace runs at.
        expect(Math.min(...x.flux.B), id).toBeGreaterThanOrEqual(0)
        expect(g.lo, id).toBe(0)
        expect(g.levels, id).toEqual([x.flux.Bsat])
        // The ceiling stays in frame whether the flux reaches it or not.
        expect(g.hi, id).toBeGreaterThan(x.flux.Bsat)
      }
    }
  })

  it('doubles what the flux swing gets, now that no height goes to a sign the flux never has', () => {
    const { x } = at('d1')
    const ctx = fakeCtx()
    const g = drawFlux(ctx, 850, 360, { flux: x.flux, T: x.T })
    const B = x.flux.B
    const px = Math.abs(g.sy(Math.min(...B)) - g.sy(Math.max(...B)))
    // The old frame ran -400 to 400 mT; this one runs 0 to 400 mT, so the same
    // 18.2 mT of swing covers twice the pixels it did.
    const old = (Math.max(...B) - Math.min(...B)) / 0.8
    expect(px / g.area.h).toBeCloseTo(2 * old, 3)
  })
})
// REVIEW_PLAYBOOK.md class 6: when two things share coordinates, give them
// different weights and check a screenshot. Three sets of labels shared them.
// F2's spectrum clusters five sidebands around m_f = 63, a few pixels apart,
// and every one cleared the bar that lets a bar speak: two "27 %" printed on
// each other and read "27 27 %", two "39 %" read "39%%". B7 and B8 sweep an
// efficiency along the top of the frame, so the marker's own reading was drawn
// above the ceiling and clipped away, leaving a dot and no number. G2 put the
// boundary's label, the R_crit point's and the knob marker's in one spot.
describe('no label is drawn on top of another, or off the plot', () => {
  const SIZES = [
    [850, 360],
    [850, 210],
    [330, 300],
  ]

  it('draws every spectrum percentage clear of the others and of the caption', () => {
    for (const [W2, H2] of SIZES) {
      for (const e of EXPERIMENTS) {
        if (!e.views.includes('spectrum')) continue
        const { x } = at(e.id)
        const sp = x.m.spectrum || { unit: 'A' }
        const I1 = sp.unit === 'V' ? x.m.harmonics[0].rms : x.m.I1
        const ctx = fakeCtx()
        const g = drawSpectrum(ctx, W2, H2, { harmonics: x.m.harmonics, I1, phases: x.conv?.threePhase ? 3 : 1, unit: sp.unit })
        const drawn = texts(ctx).filter((t) => /%$/.test(t.text) || /fundamental/.test(t.text))
        for (let i = 0; i < drawn.length; i++)
          for (let j = i + 1; j < drawn.length; j++)
            expect(overlaps(drawn[i], drawn[j]), `${W2}x${H2} ${e.id}: "${drawn[i].text}" over "${drawn[j].text}"`).toBe(false)
        // The fundamental keeps its label whatever the crowd, and so does the
        // tallest bar of every cluster that got one.
        expect(g.labelled.some((q) => q.k === 1), e.id).toBe(true)
      }
    }
  }, 60000)

  it('keeps the loudest bar of a cluster and drops the neighbour it would have sat on', () => {
    // F2 at m_f = 63: the carrier and its sidebands all clear 25 % of the
    // fundamental, and there is room for some of them, not all.
    const { x } = at('f2')
    const ctx = fakeCtx()
    const g = drawSpectrum(ctx, 850, 360, { harmonics: x.m.harmonics, I1: x.m.harmonics[0].rms, phases: 1, unit: 'V' })
    expect(g.wanted).toBeGreaterThan(g.labelled.length)
    expect(g.labelled.map((q) => q.k)).toContain(x.m.carrier.k)
  })

  it('keeps every sweep label inside its frame and clear of the others', () => {
    for (const [W2, H2] of SIZES) {
      for (const e of EXPERIMENTS) {
        if (!e.sweep) continue
        const { ctx, g } = sweepAt(e.id, W2, H2)
        const inFrame = texts(ctx).filter(
          (t) => t.x > g.area.x - 1 && t.x < g.area.x + g.area.w + 1 && t.y > g.area.y - 1 && t.y < g.area.y + g.area.h + 1,
        )
        for (const t of inFrame) {
          const b = textBox(t)
          expect(b.y0, `${W2}x${H2} ${e.id}: "${t.text}" starts above the frame`).toBeGreaterThanOrEqual(g.area.y - 1)
          expect(b.y1, `${W2}x${H2} ${e.id}: "${t.text}" runs below the frame`).toBeLessThanOrEqual(g.area.y + g.area.h + 1)
        }
        for (let i = 0; i < inFrame.length; i++)
          for (let j = i + 1; j < inFrame.length; j++)
            expect(overlaps(inFrame[i], inFrame[j]), `${W2}x${H2} ${e.id}: "${inFrame[i].text}" over "${inFrame[j].text}"`).toBe(false)
      }
    }
  }, 120000)

  it('never lands a label on the dot or ring it is naming', () => {
    for (const [W2, H2] of SIZES) {
      for (const e of EXPERIMENTS) {
        if (!e.sweep) continue
        const { ctx, g } = sweepAt(e.id, W2, H2)
        // Every marker the sweep draws is an arc: x, y, radius.
        const dots = ctx.calls.filter((c) => c.name === 'arc').map((c) => ({ cx: c.args[0], cy: c.args[1], r: c.args[2] }))
        expect(dots.length, e.id).toBeGreaterThan(0)
        const inFrame = texts(ctx).filter(
          (t) => t.x > g.area.x - 1 && t.x < g.area.x + g.area.w + 1 && t.y > g.area.y - 1 && t.y < g.area.y + g.area.h + 1,
        )
        for (const t of inFrame) {
          const b = textBox(t)
          for (const d of dots)
            expect(
              b.x0 < d.cx + d.r && b.x1 > d.cx - d.r && b.y0 < d.cy + d.r && b.y1 > d.cy - d.r,
              `${W2}x${H2} ${e.id}: "${t.text}" sits on the marker at ${Math.round(d.cx)},${Math.round(d.cy)}`,
            ).toBe(false)
        }
      }
    }
  }, 120000)

  it('draws a marker reading that sits on the ceiling, which the frame used to swallow', () => {
    // B8's efficiency rode the top of a 0 to 100 % frame, and its label, drawn
    // above a point two pixels under the ceiling, fell outside the clip: a dot
    // and no number. The frame is the curve's own now, so put the marker back
    // on the ceiling by hand and check the reading survives there.
    const { exp, p, x, base } = at('b8')
    const s = sweepFor(exp, p, x)
    const b = sweepFor(exp, defaultsOf('b8'), base)
    const [, hi] = sweepRange(s.points, b.points, 'eta', SWEEP_Y.eta)
    const ctx = fakeCtx()
    const g = drawSweep(ctx, 850, 360, { points: s.points, basePoints: b.points, sweep: exp.sweep, at: s.at, atY: hi, marks: [] })
    expect(g.sy(g.Y(hi)) - g.area.y).toBeLessThan(1)
    const label = texts(ctx).find((t) => t.text === atLabel(exp.sweep, s.at, hi))
    expect(label, 'the marker carries its reading').toBeTruthy()
    const box = textBox(label)
    expect(box.y0).toBeGreaterThanOrEqual(g.area.y - 1)
    expect(box.y1).toBeLessThanOrEqual(g.area.y + g.area.h + 1)
  })
})
// REVIEW_PLAYBOOK.md classes 4 and 5: a fixed range that the content cannot
// fill hides the feature the lesson exists to show. Six of the lab's sweeps
// drew a line pinned along one edge of an empty frame. B8's efficiency runs
// 99.5 % down to 95.4 % as its switching frequency rises, which is the whole
// of "The edges", and on a 0 to 100 % axis that fall was four pixels of four
// hundred. B7, G1, G3 and G4 sweep the same quantity the same way. D4's
// half-bridge steps 48 V down by four, so its M never passes a quarter of the
// unity its axis was framed on.
describe('a sweep spends its frame on the curve', () => {
  /** How much of the frame's height the curve covers. */
  const fill = (id) => {
    const { s, g } = sweepAt(id, 850, 360)
    const ys = s.points.map((q) => q[byId[id].sweep.y]).filter(Number.isFinite).map((v) => g.sy(g.Y(v)))
    return (Math.max(...ys) - Math.min(...ys)) / g.area.h
  }

  it('gives every sweep at least a third of its frame', () => {
    for (const e of EXPERIMENTS) {
      if (!e.sweep) continue
      expect(fill(e.id), `${e.id}: ${e.sweep.x} against ${e.sweep.y}`).toBeGreaterThan(0.33)
    }
  }, 120000)

  it('lets go of the declared 0 to 100 % where the curve cannot fill it', () => {
    // The five efficiency sweeps that never leave the top of the range.
    for (const id of ['b7', 'b8', 'g1', 'g3', 'g4']) {
      const { s } = sweepAt(id, 850, 360)
      const etas = s.points.map((q) => q.eta).filter(Number.isFinite)
      expect(Math.max(...etas) - Math.min(...etas), id).toBeLessThan(FRAME_SHARE)
      const [lo, hi] = sweepRange(s.points, s.points, 'eta', SWEEP_Y.eta)
      expect(hi - lo, id).toBeLessThan(1)
      expect(lo, id).toBeGreaterThan(0)
    }
    // And keeps it where the curve does fill it: B6 sweeps efficiency from
    // nothing to 94 %, and G2's runs 53 % to 98 %.
    for (const id of ['b6', 'g2']) {
      const { s } = sweepAt(id, 850, 360)
      expect(sweepRange(s.points, s.points, 'eta', SWEEP_Y.eta)).toEqual([0, 1])
    }
  })

  it("drops M's unity line only when unity is not a number the converter reaches", () => {
    // The half-bridge's M is n*D with a 4:1 transformer.
    const { s } = sweepAt('d4', 850, 360)
    const [, hi] = sweepRange(s.points, s.points, 'M', SWEEP_Y.M, { withPred: true })
    expect(Math.max(...s.points.map((q) => q.M))).toBeLessThan(0.25)
    expect(hi).toBeLessThan(0.25)
    // The buck reaches unity at D = 1, and its axis keeps it.
    const b = sweepAt('b3', 850, 360)
    expect(sweepRange(b.s.points, b.s.points, 'M', SWEEP_Y.M, { withPred: true })[1]).toBeGreaterThanOrEqual(1)
  })

  it('frames on the sweep at the defaults, so a knob never re-frames the plot', () => {
    // The share that decides the framing is read off the defaults, like the
    // range itself: G1 at its own switching frequency and at four times it.
    const base = sweepAt('g1', 850, 360)
    const moved = (() => {
      const exp = byId.g1
      const p = { ...defaultsOf('g1'), fs: defaultsOf('g1').fs * 4 }
      const x2 = analyse(exp, p)
      const s2 = sweepFor(exp, p, x2)
      const b2 = sweepFor(exp, defaultsOf('g1'), analyse(exp, defaultsOf('g1')))
      return sweepRange(s2.points, b2.points, 'eta', SWEEP_Y.eta)
    })()
    expect(moved).toEqual(sweepRange(base.s.points, base.s.points, 'eta', SWEEP_Y.eta))
  })
})
