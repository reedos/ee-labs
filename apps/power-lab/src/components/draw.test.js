// The scope and the sweep as drawings: what lands on the canvas, and where.
//
// The review's complaints about the plots were about pixels — a ripple too
// small to see, a legend written over the trace, a current on the voltage
// axis, a number in the note with nothing on the plot to point at. These run
// the pure draw functions against a recording context and restate each
// complaint as a measurement.

import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, TRACES, byId, defaultsOf } from '../experiments.js'
import { analyse } from '../analysis.js'
import { sweepFor } from '../App.jsx'
import { scopeMarks, sweepMarks } from '../marks.js'
import { drawScope } from './ScopeCanvas.jsx'
import { drawSweep, sweepLegend } from './SweepCanvas.jsx'
import { fakeCtx, texts } from './fakeCanvas.js'

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
  const { exp, p, x } = at(id, over)
  const s = sweepFor(exp, p)
  const b = sweepFor(exp, defaultsOf(id))
  const ctx = fakeCtx()
  const marks = sweepMarks(exp, x, s)
  const g = drawSweep(ctx, W, H, { points: s.points, basePoints: b.points, sweep: exp.sweep, at: s.at, marks })
  return { exp, x, s, b, ctx, g, marks }
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

  it("marks the boost's peak on its curve, at the D it happens", () => {
    const { ctx, g, marks, s } = sweep('c2')
    const peak = marks.find((m) => m.type === 'point')
    expect(peak).toBeTruthy()
    expect(peak.label).toMatch(/^peak M = \d+\.\d\d at D = 0\.\d\d$/)
    expect(peak.y).toBe(Math.max(...s.points.map((q) => q.M)))
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
