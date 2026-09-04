// Marks: the note's numbers, drawn where they happen.
//
// A note that says "the diode conducts for 42.9°" and a scope that shows a
// pulse leave the reader to connect the two. The mark does it for them: the
// conduction interval is shaded and labelled on the scope, the chopper's mean
// and RMS are lines across its trace, the boundary load is a point on the
// sweep, the boost's peak is a point at its top. Every mark is computed from
// the same solve the note is pinned to, so it cannot disagree with the text.
//
// Scope marks (time domain):
//   { type: 'hline', axis: 'V' | 'A', value, label, color? }
//   { type: 'span',  t0, t1, label }               — an interval, on every strip
// Sweep marks (one quantity against one knob, x in the knob's units):
//   { type: 'vline', x, label }
//   { type: 'point', x, y, label }                 — y in the swept quantity

import { fmt } from '@ee-labs/ui'
import { COLORS } from '@ee-labs/ui'
import { LINREG_DESIGN_R } from './analysis.js'

/** Marks for the scope of `exp` at the solve `x`. */
export function scopeMarks(exp, x) {
  const m = x.m
  const marks = []
  if (exp.kind === 'chopper') {
    marks.push({ type: 'hline', axis: 'V', value: m.sig.vout.avg, label: `⟨v⟩ = ${fmt(m.sig.vout.avg, 'V', 3)}`, color: COLORS.trace })
    marks.push({ type: 'hline', axis: 'V', value: m.sig.vout.rms, label: `V_rms = ${fmt(m.sig.vout.rms, 'V', 3)}`, color: COLORS.phase })
  }
  if (exp.kind === 'rectifier' && Number.isFinite(m.angle)) {
    // The first whole conduction interval on the scope: an 'on' edge and the
    // 'off' that follows it. Its width is the conduction angle.
    const edges = x.wf.edges
    const i = edges.findIndex((e, j) => e.name === 'on' && edges[j + 1] && edges[j + 1].name === 'off')
    if (i >= 0) marks.push({ type: 'span', t0: edges[i].t, t1: edges[i + 1].t, label: `${m.angle.toFixed(1)}°` })
  }
  return marks
}

/** Marks for the sweep of `exp` (`sweep` is the App's `{ points, at }`). */
export function sweepMarks(exp, x, sweep) {
  const marks = []
  if (!exp.sweep || !sweep || !sweep.points.length) return marks
  const { points } = sweep
  const s = exp.sweep
  if (s.x === 'R' && Number.isFinite(x.formulas?.Rcrit) && x.formulas.Rcrit > 0) {
    const Rc = x.formulas.Rcrit
    marks.push({ type: 'vline', x: Rc, label: `R_crit = ${fmt(Rc, 'Ω', 3)}` })
    // Where the curve crosses the boundary: the swept quantity at R_crit,
    // interpolated in log R between the two points around it.
    const y = interpLog(points, s.y, Rc)
    if (Number.isFinite(y)) marks.push({ type: 'point', x: Rc, y, label: `boundary` })
  }
  if (exp.kind === 'linreg' && s.y === 'Vout') {
    // The one load the resistor was sized for: the curve crosses 5 V here and
    // nowhere else.
    marks.push({ type: 'vline', x: LINREG_DESIGN_R, label: `designed for ${fmt(LINREG_DESIGN_R, 'Ω', 3)}` })
  }
  if (s.x === 'D' && s.y === 'M' && (exp.kind === 'boost' || exp.kind === 'buckboost')) {
    // The exact peak (analysis.js's boostPeak), not the sweep grid's nearest
    // sample to it: the same number the math panel's "the peak this R_L
    // allows" row shows, so the two cannot disagree the way A1's marker and
    // top bar once did.
    const exact = Number.isFinite(x.formulas?.Mpeak) && Number.isFinite(x.formulas?.Dpeak)
    let px
    let py
    if (exact) {
      px = x.formulas.Dpeak
      py = x.formulas.Mpeak
    } else {
      let best = 0
      for (let i = 1; i < points.length; i++) if (Math.abs(points[i].M) > Math.abs(points[best].M)) best = i
      px = points[best].x
      py = points[best].M
    }
    marks.push({ type: 'point', x: px, y: py, label: `peak M = ${py.toFixed(2)} at D = ${px.toFixed(2)}` })
  }
  return marks
}

function interpLog(points, key, xAt) {
  const lx = Math.log10(xAt)
  for (let i = 1; i < points.length; i++) {
    const a = Math.log10(points[i - 1].x)
    const b = Math.log10(points[i].x)
    if (lx >= a && lx <= b) {
      const f = b === a ? 0 : (lx - a) / (b - a)
      return points[i - 1][key] + f * (points[i][key] - points[i - 1][key])
    }
  }
  return NaN
}

/** The labels of some marks, for the canvas's `data-marks` attribute. */
export const markLabels = (marks) => marks.map((m) => m.label).join(', ')
