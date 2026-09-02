// Periodic steady state of a circuit whose topology is chosen by its state.
//
// A PWM converter switches on a clock, so its segment pattern is known before
// the state is (steady.js). A rectifier does not: a diode conducts when the
// source exceeds the capacitor and stops when its current runs out, and both
// instants depend on where the capacitor voltage sits. So here the circuit
// declares its topologies and one rule — `pick(x)`, which topology holds at
// state x — and the period is walked: propagate in the current topology
// until `pick` changes, locate that instant on the exact solution by
// bisection, switch, continue. Every segment is still an LTI circuit with a
// constant drive, so everything in segment.js applies to it unchanged.
// The next segment starts at the event with the topology read just past it,
// so a tie at the instant itself (two line voltages equal, a diode current
// at exactly zero) cannot open a zero-length segment or pick the wrong side.
//
// A sinusoidal source is made constant-coefficient by carrying it as state:
// two components (s, c) with ṡ = ωc, ċ = −ωs are Vp·sin ωt and Vp·cos ωt
// exactly, and every phase of a polyphase source is a linear form in them.
// Their values at t = 0 are known, so the only unknowns at the period's
// start are the circuit's own states, and periodicity is a shooting problem
// in those alone. For one unknown (a capacitor) it is a bracketed bisection
// on v(T) − v(0), which is monotone for anything that stores energy.

import { sample, stateAt, integral, quadrature, illinois } from './segment.js'
import { evalSignal } from './topologies.js'

/**
 * Walk one period from x0. `model` has `T`, `states` (name → {A, f, signals,
 * name}), and `pick(x)` → state name. Returns the segments and x(T).
 *
 * `scan` is the number of trial points per period at which `pick` is
 * consulted before bisection narrows an event; a conduction interval
 * shorter than T/scan could be missed, so it is generous.
 */
export function walkPeriod(model, x0, { scan = 720, tol = 1e-13, maxSegments = 400 } = {}) {
  const { T, states } = model
  const segs = []
  let t = 0
  let x = x0
  let name = model.pick(x)
  while (t < T) {
    const state = states[name]
    const remain = T - t
    const seg = { name, state, A: state.A, f: state.f, x0: x, T: remain, t0: t }
    const m = Math.max(8, Math.ceil((scan * remain) / T))
    const pts = sample(seg, m)
    const dt = remain / m
    let k = 1
    while (k <= m && model.pick(pts[k]) === name) k++
    if (k > m) {
      // No event before the period ends.
      segs.push(seg)
      x = pts[m]
      t = T
      break
    }
    // The topology changes between (k−1)dt and k·dt. With a `guard` — the
    // signed margin by which state x still belongs to the current topology —
    // the instant is a root and regula falsi finds it in a few steps; without
    // one, `pick` is bisected on the exact solution. Either way the bracket
    // closes to tol·T.
    const lo = (k - 1) * dt
    const hi = k * dt
    let root = null
    if (model.guard) {
      const margin = (tau) => model.guard(stateAt(seg, tau), name)
      const rlo = margin(lo)
      const rhi = margin(hi)
      // The guard is trusted only where it brackets the root. It can sit at
      // zero on the pick's side of the bracket: a segment entered at a tie
      // (the pair that took over at a line-voltage crossing has no margin
      // over the pair it replaced until the instant after), or a scan point
      // on the event itself. Cutting there would open a zero-length segment
      // and start the next topology early — a diode conducting backwards
      // for a fraction of a scan step. Then `pick`, which named this
      // segment, is what gets bisected.
      if (rlo > 0 && rhi < 0) root = illinois(margin, lo, hi, tol * T, { rlo, rhi })
    }
    if (root === null) {
      let a = lo
      let b = hi
      while (b - a > tol * T) {
        const mid = (a + b) / 2
        if (model.pick(stateAt(seg, mid)) === name) a = mid
        else b = mid
      }
      root = b
    }
    // The segment is cut at the event, and the next topology is read a hair
    // past it, where a tie between two rules is broken. If nothing has changed
    // there, the event was not where the guard said and the scan point is
    // used instead: it is known to differ.
    let next = name
    let probe = root
    let step = Math.max(tol * T, 1e-12 * T)
    while (next === name) {
      if (probe >= hi) {
        next = model.pick(pts[k])
        break
      }
      probe = Math.min(hi, probe + step)
      next = model.pick(probe === hi ? pts[k] : stateAt(seg, probe))
      step *= 2
    }
    seg.T = root
    segs.push(seg)
    x = stateAt(seg, root)
    t += root
    name = next
    if (segs.length > maxSegments) throw new Error(`more than ${maxSegments} topology changes in one period: the model chatters`)
  }
  return { segs, xEnd: x }
}

/**
 * The periodic steady state when one component of x is unknown at t = 0.
 * `model.start(v)` builds the full x0 from the unknown; `model.unknown` is
 * its index and `[lo, hi]` a bracket within which v(T) − v(0) changes sign.
 */
export function eventSteadyState(model, opts = {}) {
  const { index, lo, hi } = model.unknown
  const residual = (v) => walkPeriod(model, model.start(v), opts).xEnd[index] - v
  const rlo = residual(lo)
  const rhi = residual(hi)
  if (rlo * rhi > 0) throw new Error('the steady-state bracket does not contain a sign change')
  // Regula falsi to rounding: the residual is smooth and nearly linear in v
  // near the root for a capacitor fed through a diode, so it lands in a
  // handful of walks, and the bracket keeps the bad steps safe.
  const target = 1e-13 * Math.max(Math.abs(lo), Math.abs(hi), 1)
  const v = illinois(residual, lo, hi, target, { rlo, rhi })
  const x0 = model.start(v)
  const { segs, xEnd } = walkPeriod(model, x0, opts)
  return { mode: 'line', conv: model, T: model.T, x0, xEnd, segments: segs }
}

/** ∫ g(x, t) dt of an arbitrary function over the whole period, by segment quadrature. */
export function periodIntegral(ss, g) {
  let acc = 0
  for (const seg of ss.segments) {
    if (seg.T <= 0) continue
    acc += quadrature(seg, (x, tau) => g(x, seg.t0 + tau))
  }
  return acc
}

/** Average of a signal over the period, from exact segment integrals. */
export function signalAverage(ss, name) {
  let acc = 0
  for (const seg of ss.segments) {
    if (seg.T <= 0) continue
    const ix = integral(seg)
    const s = seg.state.signals[name]
    let y = s.d * seg.T
    for (let i = 0; i < s.c.length; i++) y += s.c[i] * ix[i]
    acc += y
  }
  return acc / ss.T
}

/** Statistics of every declared signal on the exact waveform. */
export function signalStats(ss, names) {
  const T = ss.T
  const live = ss.segments.filter((s) => s.T > 0)
  const out = {}
  const dense = live.map((seg) => ({ seg, pts: sample(seg, 256) }))
  for (const name of names) {
    let min = Infinity
    let max = -Infinity
    for (const { seg, pts } of dense) {
      for (const x of pts) {
        const y = evalSignal(seg.state, name, x)
        if (y < min) min = y
        if (y > max) max = y
      }
    }
    const ms = live.reduce((acc, seg) => acc + quadrature(seg, (x) => evalSignal(seg.state, name, x) ** 2), 0) / T
    out[name] = { avg: signalAverage(ss, name), rms: Math.sqrt(Math.max(0, ms)), min, max, pp: max - min }
  }
  return out
}
