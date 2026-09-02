import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { extrema, complex as cx } from '@ee-labs/network'
import { fmt } from '@ee-labs/ui'
import { EXPERIMENTS, byId, defaultsOf, isDynamic } from './experiments.js'
import { MARKS, PLOT_OF, marksFor, timeMarks } from './marks.js'
import { analyse, atDrive, dampingSweep, experimentMath, settleAnalytic, turnedLabel } from './math.js'
import { num } from './format.js'
import PlotMarks from './components/PlotMarks.jsx'
import { alignZero, extentOf, freqSpan, rightSpan, spanOf, sweepSpan } from './components/timePlot.js'
import { yTick } from './components/SweepCanvas.jsx'

// The marks a plot draws are data (marks.js): each one a closed form of the
// knobs. These tests hold every mark against the engine's own reading of the
// same circuit, read the caption that lists them, and measure the plot
// repairs of step 3 — no hidden traces, a right axis that holds its data, the
// damping curve free of grid noise.

const at = (id, over = {}, cursor) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p, cursor) }
}
const html = (el) => renderToStaticMarkup(el)
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

describe('every mark is the engine’s number', () => {
  it('F3: E is where v_C heads, the point at τ is 63.2 % of the way, the tangent reaches E at τ', () => {
    for (const over of [{}, { v0: 4 }, { E: -6, v0: 2, R1: 4700, C1: 220e-9 }]) {
      const { exp, p, x } = at('f3', over)
      const tau = p.R1 * p.C1
      const [level, point, seg] = marksFor(exp, p, x, 'scope')
      expect(level.y).toBe(p.E)
      expect(point.x).toBeCloseTo(tau, 12)
      expect(point.y).toBeCloseTo(x.tr.at(tau).sol.volt.C1, 9)
      expect((point.y - p.v0) / (p.E - p.v0)).toBeCloseTo(1 - Math.exp(-1), 12)
      // The tangent: the initial slope of the engine's trace, read over a step a millionth of τ.
      const h = 1e-6 * tau
      const slope = (x.tr.at(h).sol.volt.C1 - x.tr.at(0).sol.volt.C1) / h
      expect((seg.y1 - seg.y0) / (seg.x1 - seg.x0)).toBeCloseTo(slope, -Math.log10(Math.abs(slope)) + 4)
      expect(seg.x1).toBeCloseTo(tau, 12)
      expect(seg.value).toBe(seg.x1)
    }
  })

  it('F4: v_B settles at V_th, and v_A starts where the three resistors alone put it', () => {
    for (const over of [{}, { R1: 470, R2: 3300, R3: 1200 }]) {
      const { exp, p, x } = at('f4', over)
      const [level, start] = marksFor(exp, p, x, 'scope')
      expect(level.y).toBeCloseTo((p.E * p.R2) / (p.R1 + p.R2), 12)
      const tau = (p.R3 + (p.R1 * p.R2) / (p.R1 + p.R2)) * p.C1
      // The trace's own approach: v_B is within e^(-t/τ) of the level at every sample.
      const t = x.tr.t
      const vB = x.tr.series('v', 'B')
      for (let i = 0; i < t.length; i += 25) expect(Math.abs(vB[i] - level.y)).toBeCloseTo(Math.abs(level.y) * Math.exp(-t[i] / tau), 9)
      expect(start.x).toBe(0)
      expect(start.y).toBeCloseTo(x.tr.at(0).sol.v.A, 9)
    }
  })

  it('F6: the spark is I₀·R_off at 0⁺, the trickle is where i_L settles; an ideal switch has no marks', () => {
    const { exp, p, x } = at('f6')
    const [spark, trickle] = marksFor(exp, p, x, 'scope')
    expect(spark.axis).toBe('right')
    expect(spark.y).toBeCloseTo(x.tr.at(0).sol.volt.S1, 6)
    expect(spark.y).toBeCloseTo((p.E / p.R1) * p.Roff, 9)
    const tau = p.L1 / (p.R1 + p.Roff)
    const iL = (t) => x.tr.at(t).sol.i.L1
    const I0 = p.E / p.R1
    expect(iL(3 * tau) - trickle.y).toBeCloseTo((I0 - trickle.y) * Math.exp(-3), 12)
    expect(marksFor(exp, { ...p, ideal: true }, analyse(exp, { ...p, ideal: true }), 'scope')).toEqual([])
  })

  it('G4: the first peak is where the engine’s trace peaks, and its percentage is the label’s', () => {
    for (const over of [{}, { R1: 20 }, { R1: 120, C1: 470e-9 }]) {
      const { exp, p, x } = at('g4', over)
      const marks = marksFor(exp, p, x, 'scope')
      const peak = marks.find((m) => m.kind === 'point')
      const f = (t) => x.tr.at(t).sol.volt.C1
      const first = extrema(x.tr.t, x.tr.series('volt', 'C1'), f).find((e) => e.kind === 'max')
      expect(peak.x).toBeCloseTo(first.t, 9)
      expect(peak.y).toBeCloseTo(first.y, 9)
      const pct = ((peak.y - p.E) / p.E) * 100
      expect(peak.label).toBe(`first peak: ${pct.toFixed(1)} % over E`)
    }
    const heavy = at('g4', { R1: 500 })
    expect(marksFor(heavy.exp, heavy.p, heavy.x, 'scope').map((m) => m.kind)).toEqual(['level'])
  })

  it('C3: the unloaded line is the Thévenin open-circuit voltage of the divider', () => {
    for (const over of [{}, { R1: 2200, R2: 680, E: 5 }]) {
      const { exp, p, x } = at('c3', over)
      const [line] = marksFor(exp, p, x, 'sweep')
      expect(line.kind).toBe('level')
      expect(line.y).toBeCloseTo(x.thevenin.voc, 12)
      // And it is the sweep's own ceiling: the load voltage never reaches it.
      expect(Math.max(...x.sweep.points.map((q) => q.v))).toBeLessThan(line.y)
    }
  })

  it('D6: the sweep peaks at E²/4R_s where R_L = R_s, and the efficiency there is one half', () => {
    for (const over of [{}, { Rs: 75, E: 9 }]) {
      const { exp, p, x } = at('d6', over)
      const [pmax, eff] = marksFor(exp, p, x, 'sweep')
      const top = x.sweep.points.reduce((b, q) => (q.p > b.p ? q : b))
      expect(pmax.y).toBeGreaterThanOrEqual(top.p)
      expect(pmax.y).toBeCloseTo(top.p, 6)
      expect(Math.abs(Math.log(top.R / pmax.x))).toBeLessThan(Math.log(1.02))
      const match = analyse(exp, { ...p, RL: p.Rs })
      expect(match.sol.p.RL).toBeCloseTo(pmax.y, 12)
      expect(eff.axis).toBe('right')
      expect(match.sol.p.RL / -match.sol.p.V1).toBeCloseTo(eff.y, 12)
      expect(eff.value).toBe(50)
    }
  })

  it('H4: |Z| = R at f₀ and |V_C|/|V_s| peaks at Q there, on the engine’s complex solve', () => {
    for (const over of [{}, { R1: 20 }]) {
      const { exp, p, x } = at('h4', over)
      const [zr, curve] = marksFor(exp, p, x, 'freq')
      const f0 = 1 / (2 * Math.PI * Math.sqrt(p.L1 * p.C1))
      expect(zr.x).toBeCloseTo(f0, 9)
      const on = analyse(exp, { ...p, f: f0 })
      const d = atDrive(exp, on)
      expect(cx.cabs(d.Z)).toBeCloseTo(zr.y, 9)
      expect(cx.cabs(d.H)).toBeCloseTo(curve.value, 6)
      // The overlay is the sweep's own |H|, scaled to 0.9 of the frame at its peak.
      expect(Math.max(...curve.ys)).toBeCloseTo(0.9, 12)
      const peakAt = curve.xs[[...curve.ys].indexOf(Math.max(...curve.ys))]
      expect(Math.abs(Math.log(peakAt / f0))).toBeLessThan(0.02)
    }
  })

  it('H6: −3.01 dB at f_c and −20 dB per decade along the asymptote, on the engine’s complex solve', () => {
    const { exp, p, x } = at('h6')
    const [level, corner, slope] = marksFor(exp, p, x, 'freq')
    const dB = (h) => 20 * Math.log10(cx.cabs(h))
    const fc = 1 / (2 * Math.PI * p.R1 * p.C1)
    expect(corner.x).toBeCloseTo(fc, 9)
    expect(dB(atDrive(exp, analyse(exp, { ...p, f: fc })).H)).toBeCloseTo(level.y, 9)
    expect(level.y).toBeCloseTo(-3.0103, 4)
    // The asymptote's far end sits within 0.001 dB of the real response a decade or more out.
    expect(slope.x1 / fc).toBeGreaterThanOrEqual(10)
    expect(Math.abs(dB(atDrive(exp, analyse(exp, { ...p, f: slope.x1 })).H) - slope.y1)).toBeLessThan(0.001)
    expect((slope.y1 - slope.y0) / Math.log10(slope.x1 / slope.x0)).toBeCloseTo(-20, 9)
    expect(slope.value).toBe(-20)
  })

  it('every declared experiment has its marks on one plot it shows, and no other experiment has any', () => {
    for (const exp of EXPERIMENTS) {
      const p = defaultsOf(exp.id)
      const x = analyse(exp, p)
      const declared = exp.id in MARKS
      const all = marksFor(exp, p, x)
      expect(all.length > 0, exp.id).toBe(declared)
      if (!declared) continue
      const plot = PLOT_OF[exp.id]
      const shown = { scope: ['scope'], freq: ['impedance', 'bode'], sweep: ['sweep'] }[plot]
      expect(shown.some((v) => exp.views.includes(v)), exp.id).toBe(true)
      for (const other of ['scope', 'freq', 'sweep'].filter((q) => q !== plot)) expect(marksFor(exp, p, x, other)).toEqual([])
      for (const m of all) {
        expect(typeof m.label).toBe('string')
        expect(m.label.length).toBeGreaterThan(3)
        expect(Number.isFinite(m.value), `${exp.id}: ${m.label}`).toBe(true)
        if (m.kind === 'curve') expect(m.xs.length).toBe(m.ys.length)
        else if (m.kind !== 'level') expect(Number.isFinite(m.kind === 'segment' ? m.x0 + m.x1 : m.x)).toBe(true)
      }
    }
  })
})

describe('the caption', () => {
  it('lists every mark with its glyph, label and formatted value, and is absent when there are none', () => {
    for (const id of Object.keys(MARKS)) {
      const { exp, p, x } = at(id)
      const marks = marksFor(exp, p, x)
      const h = html(<PlotMarks marks={marks} />)
      expect(h.startsWith('<ul class="plot-marks" data-role="marks">')).toBe(true)
      expect((h.match(/<li /g) || []).length).toBe(marks.length)
      for (const m of marks) {
        expect(strip(h)).toContain(m.label)
        const value = m.unit === '%' ? `${m.value.toFixed(0)} %` : m.unit === 'dB/decade' ? `${m.value} dB/decade` : m.unit === '×' ? `×${num(m.value, '', 3)}` : num(m.value, m.unit, 3)
        expect(h, `${id}: ${m.label}`).toContain(`<b class="mark-value">${value}</b>`)
        expect(h).toContain(`data-kind="${m.kind}"`)
      }
    }
    expect(html(<PlotMarks marks={[]} />)).toBe('')
  })

  it('the scope’s instants join the caption as time marks in seconds', () => {
    const { exp, p, x } = at('f3')
    const m = experimentMath(exp, p, x)
    const tm = timeMarks(m.marks)
    expect(tm.length).toBe(m.marks.length)
    for (const t of tm) {
      expect(t.kind).toBe('time')
      expect(t.unit).toBe('s')
      expect(t.value).toBe(t.x)
    }
    expect(timeMarks(undefined)).toEqual([])
  })
})

describe('no hidden traces', () => {
  const scoped = EXPERIMENTS.filter((e) => e.scope && isDynamic(e))

  it('the right-hand scale holds every right-hand series, zero-aligned only when they still fill 40 % of the frame', () => {
    for (const exp of scoped) {
      if (!exp.scope.right) continue
      const p = defaultsOf(exp.id)
      const x = analyse(exp, p)
      const left = exp.scope.left.traces.map((q) => x.tr.series(q.q, q.key))
      const right = exp.scope.right.traces.map((q) => x.tr.series(q.q, q.key))
      const lSpan = spanOf(left)
      const own = spanOf(right)
      const { span, aligned } = rightSpan(lSpan, own)
      const finite = (ys) => [...ys].filter(Number.isFinite)
      const lo = Math.min(...right.map((ys) => Math.min(...finite(ys))))
      const hi = Math.max(...right.map((ys) => Math.max(...finite(ys))))
      expect(span[0], exp.id).toBeLessThanOrEqual(lo)
      expect(span[1], exp.id).toBeGreaterThanOrEqual(hi)
      const fill = (hi - lo) / (span[1] - span[0])
      expect(fill, `${exp.id} fills ${fill.toFixed(2)} of its right scale`).toBeGreaterThanOrEqual(0.4)
      if (aligned) {
        expect(span).toEqual(alignZero(lSpan, own))
        // One zero row for both scales.
        expect(-span[0] / (span[1] - span[0])).toBeCloseTo(-lSpan[0] / (lSpan[1] - lSpan[0]), 12)
      } else expect(span).toEqual(own)
    }
  })

  it('no two traces of one scope draw the same pixels in the same style', () => {
    for (const exp of scoped) {
      const p = defaultsOf(exp.id)
      const x = analyse(exp, p)
      const style = (q) => `${q.dim ? 'dim' : 'bright'}/${q.dash ? 'dash' : 'solid'}`
      const left = exp.scope.left.traces.map((q) => ({ q, ys: x.tr.series(q.q, q.key), side: 'left' }))
      const right = (exp.scope.right?.traces || []).map((q) => ({ q, ys: x.tr.series(q.q, q.key), side: 'right' }))
      const lSpan = spanOf(left.map((t) => t.ys))
      const { span: rSpan } = rightSpan(lSpan, spanOf(right.map((t) => t.ys)))
      const norm = (t) => {
        const [lo, hi] = t.side === 'left' ? lSpan : rSpan
        return Float64Array.from(t.ys, (v) => (v - lo) / (hi - lo))
      }
      const all = [...left, ...right].map((t) => ({ ...t, px: norm(t) }))
      for (let a = 0; a < all.length; a++)
        for (let b = a + 1; b < all.length; b++) {
          let gap = 0
          for (let i = 0; i < all[a].px.length; i++) {
            const d = Math.abs(all[a].px[i] - all[b].px[i])
            if (Number.isFinite(d) && d > gap) gap = d
          }
          const same = style(all[a].q) === style(all[b].q)
          // Coincident traces are allowed only when their styles tell them apart.
          if (gap < 1e-9) expect(same, `${exp.id}: ${all[a].q.label} and ${all[b].q.label} coincide in the same style`).toBe(false)
        }
    }
  })

  it('F6 keeps its switch voltage dashed over the coincident current; F7 no longer draws the current twice', () => {
    expect(byId.f6.scope.right.traces[0].dash).toBe(true)
    expect(byId.f7.scope.right).toBeUndefined()
  })
})

describe('the plot repairs', () => {
  it('G3: the analytic settling time is the engine’s, at six resistances across the three faces', () => {
    const { exp, p } = at('g3')
    for (const R1 of [50, 100, 160, 200, 300, 1000]) {
      const x = analyse(exp, { ...p, R1 })
      const alpha = R1 / (2 * p.L1)
      const w0 = 1 / Math.sqrt(p.L1 * p.C1)
      const zeta = alpha / w0
      const q = { alpha, w0, zeta, wd: zeta < 1 ? Math.sqrt(w0 * w0 - alpha * alpha) : 0 }
      const settle = settleAnalytic(q, p.E, 0.02 * p.E)
      expect(settle / x.damping.at.settle, `R = ${R1}`).toBeCloseTo(1, 6)
    }
  })

  it('G3: the sweep is the closed form with no grid — monotone above critical, every cliff a drop, the minimum a little below critical', () => {
    const { exp, p } = at('g3')
    const sw = dampingSweep(exp, p)
    const above = sw.points.filter((q) => q.R > sw.Rcrit)
    for (let k = 1; k < above.length; k++) expect(above[k].settle).toBeGreaterThan(above[k - 1].settle)
    // Below the fastest point the curve is sawtoothed — a peak leaving the band
    // drops the time — but each sample is a smooth function of R between the cliffs.
    const below = sw.points.filter((q) => q.R < sw.fastest.R)
    let cliffs = 0
    for (let k = 1; k < below.length; k++) {
      const ratio = below[k].settle / below[k - 1].settle
      if (ratio < 0.97) cliffs++
      else expect(ratio, `R = ${below[k].R}`).toBeLessThan(1.06)
    }
    expect(cliffs).toBeGreaterThan(3)
    expect(sw.fastest.R).toBeLessThan(sw.Rcrit)
    expect(sw.fastest.R).toBeGreaterThan(0.75 * sw.Rcrit)
    for (const q of sw.points) expect(q.overshoot).toBeCloseTo(q.zeta < 1 ? Math.exp((-Math.PI * q.zeta) / Math.sqrt(1 - q.zeta ** 2)) : 0, 12)
  })

  it('D6: the power axis reads in milliwatts, and the efficiency has its own percent axis', () => {
    const { x } = at('d6')
    const top = Math.max(...x.sweep.points.map((q) => q.p))
    for (const v of [top, top / 2, top / 4]) expect(yTick('W')(v)).toMatch(/^\d+(\.\d+)? m?W$/)
    expect(yTick('W')(top)).toBe(fmt(top, 'W', 2))
    const sweep = src('./components/SweepCanvas.jsx')
    expect(sweep).toContain("drawRightAxis(ctx, area, w, 0, 100, (v) => `${v}%`, 'Efficiency (%)'")
    expect(sweep).toContain('frameArea(w, h, { rightAxis: efficiency })')
  })

  it('H1: the cursor opens inside the transient, under 5τ; H2 reads θ as cycles plus a wrapped angle', () => {
    const p = defaultsOf('h1')
    expect(byId.h1.cursor * byId.h1.window(p)).toBeLessThan(5 * p.R1 * p.C1)
    expect(byId.h1.cursor * byId.h1.window(p)).toBeGreaterThan(p.R1 * p.C1)
    expect(src('./components/PhasorCanvas.jsx')).toContain('turnedLabel(omega, tc)')
    expect(turnedLabel(2 * Math.PI * 100, 0.0325)).toBe('3 cycles + 90.0°')
  })
})

// The feature fills the frame (student review, Phase 7): on every chart the
// bright traces stand at least 40 % of the frame tall, measured with the very
// span functions the canvases use. The exceptions are listed, not hidden —
// each is a lesson the small trace teaches (a filter attenuating its drive,
// a flat line from an ideal source) and a new one would fail here.
describe('the features fill the frame', () => {
  const MIN_FILL = 0.4
  const ys = (marks, side) => Float64Array.from(marks.filter((m) => m.axis === side).flatMap((m) => (m.kind === 'level' || m.kind === 'point' ? [m.y] : m.kind === 'segment' ? [m.y0, m.y1] : [])))
  const fillOf = ([lo, hi], series) => {
    const [a, b] = extentOf(series)
    return (b - a) / (hi - lo)
  }

  it('scope: every side’s bright traces fill 40 % of their scale, except where a dim drive is the tall one', () => {
    const exempt = []
    for (const exp of EXPERIMENTS) {
      if (!exp.views.includes('scope')) continue
      const p = defaultsOf(exp.id)
      const x = analyse(exp, p)
      const math = experimentMath(exp, p, x)
      const marks = [...marksFor(exp, p, x, 'scope'), ...timeMarks(math?.marks)]
      const series = (traces, t) => traces.map((q) => t.series(q.q, q.key))
      const left = series(exp.scope.left.traces, x.tr)
      const gLeft = x.ghost ? series(exp.scope.left.traces, x.ghost) : []
      const guides = (math?.guides || []).map((g) => Float64Array.from(x.tr.t, (tt) => g.f(tt)))
      const leftSpan = spanOf([...left, ...gLeft, ...guides, ys(marks, 'left')])
      const sides = [['left', exp.scope.left.traces, left, leftSpan]]
      if (exp.scope.right) {
        const right = series(exp.scope.right.traces, x.tr)
        const gRight = x.ghost ? series(exp.scope.right.traces, x.ghost) : []
        sides.push(['right', exp.scope.right.traces, right, rightSpan(leftSpan, spanOf([...right, ...gRight, ys(marks, 'right')])).span])
      }
      for (const [side, traces, data, span] of sides) {
        const bright = data.filter((_, i) => !traces[i].dim)
        const dim = data.filter((_, i) => traces[i].dim)
        if (!bright.length) {
          exempt.push(`${exp.id} ${side}: no bright trace`)
          continue
        }
        const fill = fillOf(span, bright)
        if (fill >= MIN_FILL) continue
        const [bLo, bHi] = extentOf(bright)
        const [dLo, dHi] = dim.length ? extentOf(dim) : [0, 0]
        // A response smaller than its drive is the lesson (F7's current, H6's filtered output), not a hidden trace.
        if (dim.length && dHi - dLo >= bHi - bLo) {
          exempt.push(`${exp.id} ${side}: the drive is the tall one`)
          continue
        }
        expect(fill, `${exp.id} ${side}`).toBeGreaterThanOrEqual(MIN_FILL)
      }
    }
    // A rectifier's drive is always the taller trace — the input swings both
    // ways and the output only one — and showing it beside the output is the
    // whole point of the picture.
    expect(exempt.sort().join('\n')).toBe(
      [
        'f7 left: the drive is the tall one',
        'h5 left: no bright trace',
        'h6 left: the drive is the tall one',
        'i4 left: the drive is the tall one',
        'i5 left: the drive is the tall one',
        'i6 left: the drive is the tall one',
        'i7 left: the drive is the tall one',
      ]
        .sort()
        .join('\n'),
    )
  })

  it('energy: the stack stands at least 40 % of its frame from zero, on every experiment that keeps the books', () => {
    let n = 0
    for (const exp of EXPERIMENTS) {
      if (!exp.views.includes('energy')) continue
      const x = analyse(exp, defaultsOf(exp.id))
      const pts = x.energy.points
      const top = pts.map((q) => q.storedEach.reduce((a, b) => a + b, 0) + q.dissipated)
      const sup = pts.map((q) => q.supplied + x.energy.stored0)
      const [lo, hi] = spanOf([top, sup])
      const [a, b] = extentOf([top, sup, [0]])
      expect((b - a) / (hi - lo), exp.id).toBeGreaterThanOrEqual(MIN_FILL)
      n++
    }
    expect(n).toBeGreaterThanOrEqual(4)
  })

  it('impedance and bode: the magnitude curve fills 40 % of the rounded frame', () => {
    let n = 0
    for (const exp of EXPERIMENTS) {
      for (const mode of ['impedance', 'bode']) {
        if (!exp.views.includes(mode)) continue
        const x = analyse(exp, defaultsOf(exp.id))
        const series = mode === 'bode' ? x.freq.H : x.freq.Z
        const mag = series.map((z) => (mode === 'bode' ? 20 * Math.log10(cx.cabs(z)) : Math.log10(cx.cabs(z))))
        const { lo, hi } = freqSpan(mag, mode)
        expect(fillOf([lo, hi], [mag]), `${exp.id} ${mode}`).toBeGreaterThanOrEqual(MIN_FILL)
        n++
      }
    }
    expect(n).toBeGreaterThanOrEqual(3)
  })

  it('sweep: the load curve fills 40 % of its frame, except the flat line an ideal source draws', () => {
    const exempt = []
    for (const exp of EXPERIMENTS) {
      if (!exp.views.includes('sweep')) continue
      const p = defaultsOf(exp.id)
      const x = analyse(exp, p)
      const y = exp.sweepY || 'p'
      const data = x.sweep.points.map((q) => q[y])
      const marks = marksFor(exp, p, x, 'sweep')
      const span = sweepSpan(data, marks.filter((m) => m.axis !== 'right').flatMap((m) => (m.kind === 'level' || m.kind === 'point' ? [m.y] : m.kind === 'segment' ? [m.y0, m.y1] : [])))
      const [a, b] = extentOf([data])
      if (b - a <= 1e-9 * Math.max(Math.abs(a), Math.abs(b))) {
        exempt.push(`${exp.id}: flat`)
        continue
      }
      expect(fillOf(span, [data]), exp.id).toBeGreaterThanOrEqual(MIN_FILL)
    }
    expect(exempt).toEqual(['e8: flat'])
  })
})
