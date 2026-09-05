// Periodic steady state for a circuit whose switching pattern is a clock.
//
// `steady.js` solves the two-interval converter and `events.js` the circuit
// whose topology is chosen by its state. Between them sits the case an
// inverter is: many intervals, all of them known before the state is,
// because a comparator against a carrier fixes every edge in advance. Then
// one period is an affine map again,
//
//     x(T) = Φ x(0) + d,     Φ = Πφ0,   d accumulated through the same φ0's
//
// and periodicity is the linear solve (I − Φ) x0 = d, exactly as in CCM,
// only with a hundred and twenty-seven factors instead of two.
//
// The Fourier coefficients of a signal on such a solution are here too,
// because that is what an inverter is judged by. A signal that is constant
// within each segment — the bridge output is — integrates against a sine in
// closed form, so the whole spectrum of the switched waveform costs two
// trigonometric calls per segment per order. A signal that moves within a
// segment is integrated by Gauss–Legendre, on the panels the segment's own
// rule already cuts (short against the circuit's time constants) plus more
// wherever those are not also short against the harmonic's own period.

import { propagator01 } from './propagator.js'
import { eye, matMul, matVec, matAdd, vecAdd, solve, norm1 } from './linalg.js'
import { quadrature, stateAt, sample } from './segment.js'
import { evalSignal } from './topologies.js'
import { signalIntegral } from './steady.js'

/**
 * Chain a plan of `{ state, T }` from x0, returning the segments and x(T).
 * Every segment carries its absolute start time, so an integral against a
 * function of time knows where it is.
 */
export function chainPlan(plan, x0) {
  const segs = []
  let x = x0
  let t0 = 0
  for (const { state, T } of plan) {
    if (T <= 0) continue
    segs.push({ name: state.name, state, A: state.A, f: state.f, x0: x, T, t0 })
    const { phi0, phi1 } = propagator01(state.A, T)
    x = vecAdd(matVec(phi0, x), matVec(phi1, state.f))
    t0 += T
  }
  return { segs, xEnd: x }
}

/** The periodic state of a fixed pattern: the solution of (I − Φ) x0 = d. */
export function clockedSteadyState(plan, n = 2) {
  let Phi = eye(n)
  let d = Array.from({ length: n }, () => 0)
  for (const { state, T } of plan) {
    if (T <= 0) continue
    const { phi0, phi1 } = propagator01(state.A, T)
    Phi = matMul(phi0, Phi)
    d = vecAdd(matVec(phi0, d), matVec(phi1, state.f))
  }
  const x0 = solve(matAdd(eye(n), Phi, -1), d)
  const { segs, xEnd } = chainPlan(plan, x0)
  return { x0, segments: segs, xEnd, Phi, d }
}

/** Whether a signal is constant inside every segment of a solution. */
export function isPiecewiseConstant(ss, name) {
  return ss.segments.every((seg) => {
    const s = seg.state.signals[name]
    return s && s.c.every((v) => v === 0)
  })
}

/**
 * Fourier coefficients of a signal at harmonic k of 1/T: { a, b } for
 * a·cos kωt + b·sin kωt, with rms = hypot(a, b)/√2.
 *
 * A piecewise-constant signal is integrated in closed form. Anything else is
 * integrated on panels short against the harmonic's own period.
 */
export function fourierAt(ss, name, k, { panelsPerCycle = 8 } = {}) {
  const T = ss.T
  const w = (2 * Math.PI) / T
  let a = 0
  let b = 0
  const flat = isPiecewiseConstant(ss, name)
  for (const seg of ss.segments) {
    if (seg.T <= 0) continue
    const t0 = seg.t0
    const t1 = t0 + seg.T
    if (flat) {
      const y = evalSignal(seg.state, name, seg.x0)
      if (k === 0) {
        a += y * seg.T
        continue
      }
      a += (y * (Math.sin(k * w * t1) - Math.sin(k * w * t0))) / (k * w)
      b += (y * (Math.cos(k * w * t0) - Math.cos(k * w * t1))) / (k * w)
      continue
    }
    // The segment's own quadrature already cuts it into pieces short against
    // the circuit's time constants; sub-panels are added only where that is
    // not also short against the harmonic's period.
    const want = Math.ceil((panelsPerCycle * k * seg.T) / T)
    const have = Math.max(1, Math.ceil((norm1(seg.A) * seg.T) / 0.5))
    const panels = Math.max(1, Math.ceil(want / have))
    if (panels === 1) {
      // The segment itself, so the ten-point nodes are the cached ones every
      // other integral on this waveform already paid for.
      a += quadrature(seg, (x, tau) => evalSignal(seg.state, name, x) * Math.cos(k * w * (t0 + tau)))
      b += quadrature(seg, (x, tau) => evalSignal(seg.state, name, x) * Math.sin(k * w * (t0 + tau)))
      continue
    }
    const h = seg.T / panels
    for (let q = 0; q < panels; q++) {
      const sub = { state: seg.state, A: seg.A, f: seg.f, x0: q === 0 ? seg.x0 : stateAt(seg, q * h), T: h }
      const base = t0 + q * h
      a += quadrature(sub, (x, tau) => evalSignal(seg.state, name, x) * Math.cos(k * w * (base + tau)))
      b += quadrature(sub, (x, tau) => evalSignal(seg.state, name, x) * Math.sin(k * w * (base + tau)))
    }
  }
  return k === 0 ? { a: a / T, b: 0 } : { a: (2 * a) / T, b: (2 * b) / T }
}

/** Harmonics 1…kMax of a signal, each with its RMS. */
export function spectrumOf(ss, name, kMax, opts) {
  const out = []
  for (let k = 1; k <= kMax; k++) {
    const { a, b } = fourierAt(ss, name, k, opts)
    out.push({ k, a, b, rms: Math.hypot(a, b) / Math.SQRT2 })
  }
  return out
}

/**
 * Average, RMS and extremes of every named signal on a solved waveform.
 * `dense` is how many points each segment is scanned at for the extremes;
 * a solution with a hundred segments does not need two hundred and fifty-six
 * of them each.
 */
export function statsOf(ss, names, { dense = 256 } = {}) {
  const T = ss.T
  const live = ss.segments.filter((s) => s.T > 0)
  const pts = live.map((seg) => ({ seg, xs: sample(seg, dense) }))
  const out = {}
  for (const name of names) {
    let min = Infinity
    let max = -Infinity
    let ms = 0
    let avg = 0
    for (const { seg, xs } of pts) {
      for (const x of xs) {
        const y = evalSignal(seg.state, name, x)
        if (y < min) min = y
        if (y > max) max = y
      }
      ms += quadrature(seg, (x) => evalSignal(seg.state, name, x) ** 2)
      // The average is the exact segment integral, not a quadrature: a
      // linear form of the state has one in closed form.
      avg += signalIntegral(seg, name)
    }
    out[name] = { avg: avg / T, rms: Math.sqrt(Math.max(0, ms / T)), min, max, pp: max - min }
  }
  return out
}

/** ⟨a·b⟩ over the period, for a power. */
export function meanProduct(ss, a, b) {
  let acc = 0
  for (const seg of ss.segments) {
    if (seg.T <= 0) continue
    acc += quadrature(seg, (x) => evalSignal(seg.state, a, x) * evalSignal(seg.state, b, x))
  }
  return acc / ss.T
}
