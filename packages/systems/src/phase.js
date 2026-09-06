// The phase plane, and the exact trajectory that draws it.
//
// ── ADMISSION (Rule 1 of /CORE_SCOPE.md) ──
//
// This file is not a general nonlinear integrator, and refusing to be one is
// the point. A loop whose only nonlinearity is piecewise-linear has, inside
// each region, a constant state equation with a closed-form solution. So the
// trajectory is exact everywhere except at the instants it changes region, and
// those instants are found by bisecting a scalar function of the exact
// solution. There is no step size, and there is no error that shrinks when you
// ask for more points.
//
// A smooth nonlinearity has no regions and is declined (`nonlinear.js`).
//
// The loop this file integrates is the standard one, with the nonlinearity
// where an actuator is:
//
//   r --> (+/-) --> C(s) --> u --> f(u) --> v --> P(s) --> y
//              ^                                            |
//              +--------------------------------------------+
//
// with C and P as state spaces. The combined state is the controller's state
// stacked on the plant's, which is exactly what makes the picture worth
// drawing: two states, two axes, and the loop's whole life is one curve.

import { mulVec, zeros } from './matrix.js'
import { expmWithHold, stateSpace } from './ss.js'
import { NonlinearError, pwlRegionOf, pwlRegions, pwlValue } from './nonlinear.js'

/** Thrown where the loop's shape stops the exact integration. */
export class PhaseError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'PhaseError'
    this.code = code
  }
}

/**
 * The reason a plant with direct feedthrough cannot be integrated in this loop.
 *
 * With D nonzero the plant's output depends on the nonlinearity's output at the
 * same instant, and the nonlinearity's input depends on that output. The two
 * equations have to be solved together at every instant, which for a
 * discontinuous slope has no single answer. The suite's plants are strictly
 * proper, so this is a guard rather than a limitation anybody meets.
 */
export const ALGEBRAIC_LOOP_DECLINED =
  'The plant has direct feedthrough, so its output responds to the nonlinearity in the same instant that the nonlinearity responds to it. ' +
  'That is an algebraic loop through a discontinuous slope, and it has no single solution. ' +
  'Use a strictly proper plant, which every plant in this lab is.'

/**
 * Build the three affine region dynamics of the saturated loop.
 *
 * In region g the nonlinearity is v = slope * u + offset, and u is a linear
 * function of the state plus the reference. Substituting gives
 * z-dot = M z + m, with M and m constant. Exactly three of these exist, and the
 * trajectory is a walk between them.
 *
 * @returns {{ regions, gOf, n, nc, np, splitAt }}
 */
export function loopRegions({ ctrl, plant, kind = 'saturation', delta, reference = 0 }) {
  const c = stateSpace(ctrl)
  const p = stateSpace(plant)
  if (Math.abs(p.D) > 0) throw new PhaseError(ALGEBRAIC_LOOP_DECLINED, 'algebraic-loop')
  const { segments } = pwlRegions(kind, delta)
  const nc = c.n
  const np = p.n
  const n = nc + np

  // u = Cc xc + Dc e, e = r - Cp xp  ->  u = Cc xc - Dc Cp xp + Dc r
  const uRow = new Array(n).fill(0)
  for (let j = 0; j < nc; j++) uRow[j] = c.C[j]
  for (let j = 0; j < np; j++) uRow[nc + j] = -c.D * p.C[j]
  const uConst = c.D * reference

  // e = r - Cp xp, needed for the controller's own state equation.
  const eRow = new Array(n).fill(0)
  for (let j = 0; j < np; j++) eRow[nc + j] = -p.C[j]
  const eConst = reference

  const regions = {}
  for (const key of ['-1', '0', '1']) {
    const { slope, offset } = segments[key]
    const M = zeros(n)
    const m = new Array(n).fill(0)
    for (let i = 0; i < nc; i++) {
      for (let j = 0; j < nc; j++) M[i][j] += c.A[i][j]
      for (let j = 0; j < n; j++) M[i][j] += c.B[i] * eRow[j]
      m[i] += c.B[i] * eConst
    }
    for (let i = 0; i < np; i++) {
      for (let j = 0; j < np; j++) M[nc + i][nc + j] += p.A[i][j]
      for (let j = 0; j < n; j++) M[nc + i][j] += p.B[i] * slope * uRow[j]
      m[nc + i] += p.B[i] * (slope * uConst + offset)
    }
    regions[key] = { M, m, slope, offset }
  }

  return {
    regions,
    n,
    nc,
    np,
    uRow,
    uConst,
    yRow: (() => {
      const row = new Array(n).fill(0)
      for (let j = 0; j < np; j++) row[nc + j] = p.C[j]
      return row
    })(),
    uOf: (z) => uRow.reduce((s, v, i) => s + v * z[i], 0) + uConst,
    delta,
    kind,
    reference,
  }
}

/** The flow of z-dot = M z + m over a time t: exact, from one exponential. */
function flow(M, m, t) {
  return expmWithHold(M, m, t)
}

/**
 * The exact trajectory of the saturated loop.
 *
 * Samples land on a uniform grid so a canvas can draw them, but the state is
 * advanced by the exact flow of whichever region it is in, and a region change
 * inside a step is found by bisection and applied at the instant it happens.
 * `events` records every one of them, with the time and the region entered.
 *
 * `maxEvents` bounds the walk. A trajectory that needs more than that is
 * chattering on a switching surface, which is the sliding mode an ideal relay
 * produces and which `nonlinear.js` declines. Hitting the bound is reported in
 * the result rather than silently truncating the picture.
 */
export function pwlTrajectory(spec, { x0, duration, points = 601, maxEvents = 4000 }) {
  const L = loopRegions(spec)
  const { n } = L
  if (!x0 || x0.length !== n) {
    throw new PhaseError(`The initial state needs ${n} entries, one per state.`, 'bad-initial-state')
  }
  const h = duration / (points - 1)
  const cache = {}
  const stepOf = (key) => {
    if (!cache[key]) cache[key] = flow(L.regions[key].M, L.regions[key].m, h)
    return cache[key]
  }

  const t = new Float64Array(points)
  const y = new Float64Array(points)
  const u = new Float64Array(points)
  const v = new Float64Array(points)
  const xs = []
  const events = []

  let z = [...x0]
  let hitBound = false

  const record = (i) => {
    // The grid time, not an accumulated one. The walk inside a step adds and
    // subtracts its own intervals, and a running sum of those drifts away
    // from i times h.
    t[i] = i * h
    const uu = L.uOf(z)
    u[i] = uu
    v[i] = pwlValue(L.kind, uu, L.delta)
    y[i] = L.yRow.reduce((s, c, k) => s + c * z[k], 0)
    xs.push([...z])
  }

  /**
   * The breakpoint the state crosses on its way out of region `key`.
   *
   * Leaving the middle region, it is whichever side the state is heading for.
   * Leaving a saturated region, it is that region's own edge, whatever region
   * the state ends up in. Reading the destination instead put the wrong sign
   * on every return into the linear region, and bisected towards a boundary
   * the state was nowhere near. The trajectory then depended on the grid,
   * which is the one thing an exact integrator must not do.
   */
  const breakpointBetween = (key, keyNext) => {
    if (key === '0') return keyNext === '1' ? L.delta : -L.delta
    return key === '1' ? L.delta : -L.delta
  }

  for (let i = 0; i < points; i++) {
    record(i)
    if (i === points - 1) break
    let remaining = h
    let guard = 0
    while (remaining > 0) {
      const key = String(pwlRegionOf(L.uOf(z), L.delta))
      const { M, m } = L.regions[key]
      const advance = (s) => mulVec(s.Phi, z).map((val, k) => val + s.Gamma[k])
      const step = remaining === h ? stepOf(key) : flow(M, m, remaining)
      const zNext = advance(step)
      const keyNext = String(pwlRegionOf(L.uOf(zNext), L.delta))
      if (keyNext === key) {
        z = zNext
        remaining = 0
        break
      }
      // The region changed inside this step. Find when, exactly, by bisecting
      // the switching function on the region's own exact flow.
      const target = breakpointBetween(key, keyNext)
      const at = (dt) => advance(flow(M, m, dt))
      const gLo = L.uOf(z) - target
      let lo = 0
      let hi = remaining
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2
        const g = L.uOf(at(mid)) - target
        if (gLo < 0 === g < 0) lo = mid
        else hi = mid
      }
      const dt = (lo + hi) / 2
      z = at(dt)
      remaining -= dt
      // Nudge across the boundary so the next region is entered rather than
      // sat on. The nudge is one part in 1e12 of a step, far below anything
      // the picture or a pinned number can see.
      const tiny = h * 1e-12
      if (remaining > tiny) {
        z = advance(flow(M, m, tiny))
        remaining -= tiny
      }
      events.push({ t: i * h + (h - remaining), region: pwlRegionOf(L.uOf(z), L.delta), u: L.uOf(z) })
      guard++
      if (events.length >= maxEvents || guard > 200) {
        hitBound = true
        remaining = 0
      }
    }
    if (hitBound) {
      // Fill the rest of the grid with the last state, and say so.
      for (let j = i + 1; j < points; j++) record(j)
      break
    }
  }

  return {
    t,
    y,
    u,
    v,
    x: xs,
    events,
    hitBound,
    reason: hitBound
      ? 'The trajectory changed region more times than the bound allows, which is a slide along the switching surface rather than a walk between regions.'
      : null,
    n,
    nc: L.nc,
    np: L.np,
  }
}

/**
 * The amplitude and frequency of a sustained oscillation in a sampled signal,
 * measured over its last cycles.
 *
 * Amplitude is half the peak-to-peak of the last full cycles, and the frequency
 * comes from the mean interval between upward zero crossings of the signal
 * about its own mean, with each crossing refined by linear interpolation
 * between the two samples that bracket it. Null when the signal does not cross
 * at least three times, which is the honest answer for a trace that has not
 * settled into a cycle.
 *
 * `settled` is the relative change in amplitude between the last two cycles. A
 * caller that wants to claim a limit cycle checks it, rather than assuming a
 * long enough simulation has converged.
 */
export function oscillationOf(t, signal, { tailFraction = 0.5 } = {}) {
  const n = signal.length
  const start = Math.floor(n * (1 - tailFraction))
  let mean = 0
  for (let i = start; i < n; i++) mean += signal[i] / (n - start)
  const crossings = []
  for (let i = start + 1; i < n; i++) {
    const a = signal[i - 1] - mean
    const b = signal[i] - mean
    if (a <= 0 && b > 0) {
      const frac = b === a ? 0 : -a / (b - a)
      crossings.push(t[i - 1] + frac * (t[i] - t[i - 1]))
    }
  }
  if (crossings.length < 3) return null
  const periods = []
  for (let i = 1; i < crossings.length; i++) periods.push(crossings[i] - crossings[i - 1])
  const period = periods.reduce((s, p) => s + p, 0) / periods.length
  const cycleAmp = (from, to) => {
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < n; i++) {
      if (t[i] < from || t[i] > to) continue
      lo = Math.min(lo, signal[i])
      hi = Math.max(hi, signal[i])
    }
    return (hi - lo) / 2
  }
  const last = cycleAmp(crossings[crossings.length - 2], crossings[crossings.length - 1])
  const prev = cycleAmp(crossings[crossings.length - 3], crossings[crossings.length - 2])
  return {
    amplitude: last,
    period,
    frequency: 1 / period,
    omega: (2 * Math.PI) / period,
    cycles: crossings.length - 1,
    settled: prev > 0 ? Math.abs(last - prev) / prev : Infinity,
  }
}

/**
 * The vector field of the loop over a rectangle of the phase plane, for a
 * second-order state.
 *
 * Each arrow is the exact state derivative at that point, which is the region's
 * M z + m. The switching lines are where the nonlinearity's input reaches its
 * breakpoints, and a reader who follows an arrow across one sees the field
 * change slope there.
 */
export function phaseField(spec, { xMin, xMax, yMin, yMax, nx = 17, ny = 17 }) {
  const L = loopRegions(spec)
  if (L.n !== 2) {
    throw new PhaseError(
      `The phase plane draws two states, and this loop has ${L.n}. A higher-order loop is drawn as a projection, and this routine does not guess which one.`,
      'not-planar',
    )
  }
  const arrows = []
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const x = xMin + ((xMax - xMin) * i) / (nx - 1)
      const yv = yMin + ((yMax - yMin) * j) / (ny - 1)
      const z = [x, yv]
      const key = String(pwlRegionOf(L.uOf(z), L.delta))
      const { M, m } = L.regions[key]
      arrows.push({ x, y: yv, dx: M[0][0] * x + M[0][1] * yv + m[0], dy: M[1][0] * x + M[1][1] * yv + m[1], region: Number(key) })
    }
  }
  return { arrows, uRow: L.uRow, uConst: L.uConst, delta: L.delta }
}

/**
 * The two switching lines, as the coefficients of a x + b y = c.
 *
 * The nonlinearity's input is a linear function of the state, so the set where
 * it reaches a breakpoint is a straight line. Drawing those two lines is what
 * turns the phase plane from a picture of a curve into a picture of a
 * mechanism.
 */
export function switchingLines(spec) {
  const L = loopRegions(spec)
  return [
    { a: L.uRow[0], b: L.uRow[1] ?? 0, c: L.delta - L.uConst, level: L.delta },
    { a: L.uRow[0], b: L.uRow[1] ?? 0, c: -L.delta - L.uConst, level: -L.delta },
  ]
}

/**
 * The equilibrium of each region, and whether it lies inside the region it
 * belongs to.
 *
 * An equilibrium of the saturated dynamics that sits outside the saturated
 * region is not an equilibrium of the loop, it is what a textbook calls a
 * virtual one. Saying which are real is how the phase plane explains a loop
 * that has one resting point and a loop that has three.
 */
export function equilibria(spec) {
  const L = loopRegions(spec)
  const out = []
  for (const key of ['-1', '0', '1']) {
    const { M, m } = L.regions[key]
    // Solve M z = -m.
    const n = L.n
    const A = M.map((r) => [...r])
    const b = m.map((v) => -v)
    const z = solveSmall(A, b)
    if (!z) {
      out.push({ region: Number(key), point: null, real: false, reason: 'This region has no isolated resting point.' })
      continue
    }
    const inRegion = String(pwlRegionOf(L.uOf(z), L.delta)) === key
    out.push({ region: Number(key), point: z, real: inRegion, u: L.uOf(z) })
  }
  return out
}

/** A small dense solve, kept local so this file does not re-export matrix.js. */
function solveSmall(A, b) {
  const n = A.length
  const M = A.map((r, i) => [...r, b[i]])
  let scaleOf = 0
  for (const row of A) for (const val of row) scaleOf = Math.max(scaleOf, Math.abs(val))
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    if (Math.abs(M[piv][c]) < 1e-13 * Math.max(scaleOf, Number.MIN_VALUE)) return null
    if (piv !== c) {
      const tmp = M[piv]
      M[piv] = M[c]
      M[c] = tmp
    }
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = new Array(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n]
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]
    x[r] = s / M[r][r]
  }
  return x
}

/**
 * A quadratic Lyapunov function V = z^T P z for the linear region, and the rate
 * at which it falls.
 *
 * P solves A^T P + P A = -Q for the region's own A, so V-dot is exactly
 * -z^T Q z inside that region, which is negative everywhere but the origin.
 * That is the Lyapunov argument, written so a pane can draw the level sets and
 * a test can check that V falls along the trajectory.
 *
 * The argument holds where the loop is linear. Outside the switching lines the
 * dynamics are the saturated ones, and `lyapunovRate` reports V-dot there too,
 * measured rather than assumed, so a reader can see where the guarantee stops.
 */
export function lyapunovRate(spec, P, z) {
  const L = loopRegions(spec)
  const key = String(pwlRegionOf(L.uOf(z), L.delta))
  const { M, m } = L.regions[key]
  const dz = M.map((row, i) => row.reduce((s, val, j) => s + val * z[j], 0) + m[i])
  let v = 0
  let dv = 0
  for (let i = 0; i < z.length; i++) {
    for (let j = 0; j < z.length; j++) {
      v += z[i] * P[i][j] * z[j]
      dv += dz[i] * P[i][j] * z[j] + z[i] * P[i][j] * dz[j]
    }
  }
  return { V: v, Vdot: dv, region: Number(key) }
}

export { NonlinearError }
