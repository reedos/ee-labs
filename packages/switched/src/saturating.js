// Periodic steady state when the inductance is not a constant.
//
// `steady.js` solves a converter whose switching pattern is known before the
// state is: on for DT, off for the rest, with at most one state event (the
// diode blocking) inside the off interval. A saturating inductor adds events
// that can fall anywhere: |i_L| crosses I_sat on the way up and again on the
// way down, and the circuit is a different linear circuit on each side. The
// pattern is no longer a list of two.
//
// So the period is walked instead. Each clock interval starts in the
// topology its state names and runs until a margin changes sign, and that
// instant is closed by bisection on the exact segment solution, the same way
// events.js closes a diode's. The walk is exact inside each piece and the
// pieces are joined at crossings placed to 1e-13 of the period, which is the
// whole claim of the piecewise-linear model.
//
// Periodicity is then a fixed point of the period map. The map is piecewise
// affine rather than affine, so it cannot be inverted in one solve. Newton on
// the residual x(T) − x(0), started from the non-saturating solution, lands
// in a handful of walks wherever the fixed point sits inside one piece; where
// it sits on a boundary the step is backtracked, and where backtracking gets
// nowhere the map is simply iterated. A dissipative converter's period map is
// a contraction, so iterating it always arrives, only slowly, and Newton
// finishes from wherever it leaves off.

import { steadyState } from './steady.js'
import { eye, matAdd, solve, vecAdd, vecScale } from './linalg.js'
import { sample, stateAt, bisect } from './segment.js'

// The topology a clock interval starts in, and where it can go from there.
//
// `events.js` reads the topology off the state with one memoryless rule, and
// that is right for a rectifier, whose diodes have no history. It is wrong at
// a knee: the state |i| = I_sat belongs to both sides, so a memoryless rule
// hands the instant after the crossing back to the topology the crossing just
// left, and the walk chatters at a zero-length segment. So each state here
// says what makes it stop rather than what makes it start, with a strict
// inequality, and no state can be re-entered at the instant it was left.

/** Which topology a clock interval begins in, at state x. */
function entryState(conv, phase, x) {
  const hot = Math.abs(x[0]) > conv.Isat
  if (phase === 'on') return hot ? 'on·sat' : 'on'
  if (conv.hasDead && x[0] <= 0) return 'dead'
  return hot ? 'off·sat' : 'off'
}

/** Where topology `name` goes at state x, or null while it holds. */
function exitTo(conv, phase, name, x) {
  if (name === 'dead') return null
  if (phase === 'off' && conv.hasDead && x[0] < 0) return 'dead'
  const hot = Math.abs(x[0]) > conv.Isat
  const cool = Math.abs(x[0]) < conv.Isat
  const sat = name.endsWith('·sat')
  if (!sat && hot) return phase === 'on' ? 'on·sat' : 'off·sat'
  if (sat && cool) return phase === 'on' ? 'on' : 'off'
  return null
}

/** How far state x is from leaving topology `name`: positive while it holds. */
function margin(conv, phase, name, x) {
  if (name === 'dead') return Infinity
  const knee = name.endsWith('·sat') ? Math.abs(x[0]) - conv.Isat : conv.Isat - Math.abs(x[0])
  if (phase === 'on' || !conv.hasDead) return knee
  return Math.min(knee, x[0])
}

/**
 * One period from x0, as segments with their absolute start times.
 *
 * Each clock interval is walked from the topology it begins in: the state is
 * scanned for the instant its margin changes sign, that instant is closed by
 * bisection on the exact segment solution, and the interval continues in
 * whatever `exitTo` names there. Three topologies is the most any interval
 * needs, and `maxCuts` is the tripwire that says so.
 */
export function saturatingWalk(conv, x0, { scan = 64, tol = 1e-13, maxCuts = 8 } = {}) {
  const T = conv.T
  const tOn = conv.p.D * T
  const phases = [
    ['on', tOn],
    ['off', T - tOn],
  ]
  const segs = []
  let x = x0
  let base = 0
  for (const [phase, dur] of phases) {
    if (dur <= 0) continue
    let t = 0
    let name = entryState(conv, phase, x)
    let cuts = 0
    while (t < dur) {
      const state = conv.states[name]
      const seg = { name, state, A: state.A, f: state.f, x0: x, T: dur - t, t0: base + t }
      const m = Math.max(8, Math.round((scan * (dur - t)) / dur))
      const pts = sample(seg, m)
      const dt = (dur - t) / m
      let k = 1
      while (k <= m && exitTo(conv, phase, name, pts[k]) === null) k++
      if (k > m || cuts >= maxCuts) {
        segs.push(seg)
        x = pts[m]
        break
      }
      // The crossing is where the margin changes sign; the bisection closes
      // it on the exact solution, and the topology just past it is read at a
      // point that is strictly across.
      const lo = (k - 1) * dt
      const hi = k * dt
      const root = bisect((tau) => margin(conv, phase, name, stateAt(seg, tau)), lo, hi, tol * T)
      seg.T = root
      x = stateAt(seg, root)
      const after = exitTo(conv, phase, name, stateAt(seg, Math.min(hi, root + Math.max(tol * T, 1e-13 * T)))) || exitTo(conv, phase, name, pts[k])
      segs.push(seg)
      t += root
      name = after
      // The dead interval is the model's own: the current is pinned at zero.
      if (name === 'dead') x = [0, x[1]]
      cuts++
    }
    base += dur
  }
  return { segs, xEnd: x }
}

/**
 * The periodic steady state of a converter with a saturating inductor.
 *
 * `mode` is SAT when any part of the period runs on the collapsed
 * inductance, DCM when the diode blocks early, CCM otherwise — the three
 * words the top bar's mode chip uses.
 */
export function saturatingSteadyState(conv, { rounds = 24, settle = 60, tol = 1e-12, ...opts } = {}) {
  const T = conv.T
  const tOn = conv.p.D * T
  // The linear converter's own fixed point is the starting guess: it is the
  // answer whenever nothing saturates, and it is close whenever a little
  // does.
  let x = steadyState(conv).x0
  const step1 = (y) => saturatingWalk(conv, y, opts).xEnd
  const residual = (y) => vecAdd(step1(y), vecScale(y, -1))
  let r = residual(x)
  let size = Math.hypot(...r)
  const scale = () => Math.max(1e-12, Math.abs(x[0]), Math.abs(x[1]), conv.p.Vin)
  const done = () => Math.max(Math.abs(r[0]), Math.abs(r[1])) <= tol * scale()
  let iter = 0
  for (let round = 0; round < rounds && !done(); round++) {
    // dP/dx by central differences, then Newton on P(x) − x, with the step
    // backtracked while it does not shrink the residual. A knee inside the
    // period makes P piecewise affine, so a full Newton step can land on the
    // wrong piece; halving walks it back onto the piece the last one came
    // from.
    const J = [
      [0, 0],
      [0, 0],
    ]
    for (let j = 0; j < 2; j++) {
      const h = Math.max(1e-7 * Math.abs(x[j]), 1e-10 * scale())
      const up = [...x]
      const dn = [...x]
      up[j] += h
      dn[j] -= h
      const pu = step1(up)
      const pd = step1(dn)
      for (let i = 0; i < 2; i++) J[i][j] = (pu[i] - pd[i]) / (2 * h)
    }
    let step = null
    try {
      const s = solve(matAdd(eye(2), J, -1), r)
      if (s.every(Number.isFinite)) step = s
    } catch {
      step = null
    }
    let moved = false
    for (let back = 0; step && back < 8; back++) {
      const f = 1 / 2 ** back
      const cand = vecAdd(x, vecScale(step, f))
      const rc = residual(cand)
      iter++
      if (Math.hypot(...rc) < size) {
        x = cand
        r = rc
        size = Math.hypot(...r)
        moved = true
        break
      }
    }
    if (moved) continue
    // Newton has nothing to offer on this piece. The period map of a
    // dissipative converter is a contraction, so iterating it always
    // arrives; a block of iterations moves onto the piece the circuit
    // actually settles on, and Newton finishes from there.
    for (let k = 0; k < settle && !done(); k++) {
      x = step1(x)
      r = residual(x)
      iter++
    }
    size = Math.hypot(...r)
  }
  const { segs } = saturatingWalk(conv, x, opts)
  const live = segs.filter((s) => s.T > 0)
  const saturated = live.some((s) => s.name.endsWith('·sat'))
  const dead = live.find((s) => s.name === 'dead')
  // The diode's blocking instant, measured from the start of the off
  // interval, as `measures` and the panes read it.
  const td = dead ? dead.t0 - tOn : T - tOn
  return {
    mode: saturated ? 'SAT' : dead ? 'DCM' : 'CCM',
    saturated,
    conv,
    T,
    tOn,
    tOff: T - tOn,
    td,
    x0: x,
    segments: segs,
    iterations: iter,
    residual: Math.hypot(...r),
    // The circuit has arrived when one more period returns the same state.
    // A setting that does not arrive is reported rather than drawn.
    converged: Math.max(Math.abs(r[0]), Math.abs(r[1])) <= tol * Math.max(1e-12, Math.abs(x[0]), Math.abs(x[1]), conv.p.Vin),
  }
}

/** The instant, and the current, at which the walk first crossed the knee. */
export function saturationEvent(ss) {
  for (const s of ss.segments) {
    if (s.T > 0 && s.name.endsWith('·sat')) return { t: s.t0, i: s.x0[0], state: s.name }
  }
  return null
}

/** The state at an instant inside the period, for the conduction scrub. */
export function stateAtTime(ss, t) {
  const live = ss.segments.filter((s) => s.T > 0)
  for (const s of live) if (t >= s.t0 && t <= s.t0 + s.T) return { seg: s, x: stateAt(s, t - s.t0) }
  const last = live[live.length - 1]
  return { seg: last, x: stateAt(last, last.T) }
}
