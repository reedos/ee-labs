// The machine on the grid: the swing equation, the equal areas, and the time
// solution under a labelled integrator.
//
// The electrical half of the machine is the Machines Lab's synchronous
// machine, imported rather than written a second time (GRID_LAB_PLAN.md
// Decision 6). `swing()` there returns the inertia M = 2H/ω_elec, the
// equilibrium angle, the synchronising coefficient K, the exact linearisation
// as a second-order plant, and the energy integral this file reads.
//
// Two answers come out of the swing equation and they are of different kinds.
//
// The EQUAL-AREA ANSWER IS EXACT. Integrating M δ̈ = P_m − P_max sin δ once
// gives an energy relation with no approximation in it. The critical clearing
// angle solves
//
//     cos δ_cr = [P_m(δ_max − δ_0) + P_3 cos δ_max − P_2 cos δ_0] / (P_3 − P_2)
//
// and the peak of the first swing after clearing at (δ_c, ω_c) solves
//
//     (M/2) ω_c² + P_m(δ_pk − δ_c) + P_3(cos δ_pk − cos δ_c) = 0.
//
// Both are root-finds on a closed form, and both are presented without a
// hedge (the counter-rule in CORE_SCOPE.md).
//
// The TIME SOLUTION RUNS UNDER A LABELLED INTEGRATOR. Getting δ(t), and
// therefore a clearing time rather than a clearing angle, needs numerical
// integration. The equation is not linear and not a circuit, so it cannot go
// through `packages/network`'s `dynamics`, which builds dx/dt = Ax + Bu from a
// netlist and solves it by the matrix exponential (Decision 5). The method
// here is fixed-step RK4, the step never crosses the clearing instant, and the
// guard is the energy relation itself: the integrated peak must match the
// closed-form peak to `PEAK_GUARD_DEG`, and the step halves until it does.

import { swing } from '@ee-labs/machines'

/** The agreement the integrated peak must reach before a step is accepted. */
export const PEAK_GUARD_DEG = 0.01
/** The step the integrator starts at, and the smallest it is allowed to reach. */
export const STEP_START = 1e-3
export const STEP_FLOOR = 1e-6

const deg = (r) => (r * 180) / Math.PI

/**
 * A stability study: one machine, three transfers, and everything the equal-
 * area criterion and the integrator have to say about them.
 *
 * @param machine  a Machines Lab spec, for H, f and P_m
 * @param pre      the transfer before the fault, per unit
 * @param during   the transfer while the fault is on
 * @param post     the transfer after the fault is cleared and a line trips
 */
export function stability(machine, { pre = 2, during = 0.5, post = 1.5 } = {}) {
  const before = swing(machine, { Pmax: pre })
  const after = swing(machine, { Pmax: post })
  if (!before.stable) throw new Error('pre: the transfer before the fault is below the mechanical power, so there is no equilibrium to start from')
  if (!after.stable) throw new Error('post: the transfer after the fault is below the mechanical power, so the machine cannot return to step')
  const M = before.M
  const Pm = before.Pm
  const delta0 = before.delta0
  const deltaMax = after.deltaMax

  // The critical clearing angle, from the energy relation. Its cosine can fall
  // outside [−1, 1] when the fault is mild enough that the machine never loses
  // step, and that case is named rather than returned as NaN.
  const top = Pm * (deltaMax - delta0) + post * Math.cos(deltaMax) - during * Math.cos(delta0)
  const cosCr = top / (post - during)
  const alwaysStable = cosCr < -1
  // The other end of the same test. A critical angle at or below the angle the
  // machine starts from means there is no clearing time that saves it: the
  // transfer it returns to leaves too little room to decelerate in, so even
  // clearing at the instant the fault arrives loses synchronism.
  const raw = cosCr > 1 ? delta0 : alwaysStable ? deltaMax : Math.acos(cosCr)
  const neverStable = !alwaysStable && raw <= delta0
  const deltaCr = neverStable ? delta0 : raw

  /** The area under (P_m − P_max sin δ) between two angles, by quadrature. */
  const quadrature = (from, to, Pmax, n = 200000) => {
    let sum = 0
    const h = (to - from) / n
    for (let k = 0; k < n; k++) {
      const d = from + h * (k + 0.5)
      sum += (Pm - Pmax * Math.sin(d)) * h
    }
    return sum
  }
  const areaAccel = quadrature(delta0, deltaCr, during)
  const areaDecel = -quadrature(deltaCr, deltaMax, post)
  const areaError = neverStable || alwaysStable ? 0 : Math.abs(areaAccel - areaDecel)

  /** The angle the first swing reaches after clearing at (δ_c, ω_c). */
  const peakFrom = (deltaC, omegaC) => {
    const g = (d) => (M / 2) * omegaC * omegaC + Pm * (d - deltaC) + post * (Math.cos(d) - Math.cos(deltaC))
    if (g(deltaMax) > 0) return { peak: NaN, stable: false }
    let lo = deltaC
    let hi = deltaMax
    for (let k = 0; k < 200; k++) {
      const mid = (lo + hi) / 2
      if (g(mid) > 0) lo = mid
      else hi = mid
    }
    return { peak: (lo + hi) / 2, stable: true }
  }

  /** One RK4 step of [δ, ω] under a transfer. */
  const step4 = (y, h, Pmax) => {
    const f = (s) => [s[1], (Pm - Pmax * Math.sin(s[0])) / M]
    const k1 = f(y)
    const k2 = f([y[0] + (h / 2) * k1[0], y[1] + (h / 2) * k1[1]])
    const k3 = f([y[0] + (h / 2) * k2[0], y[1] + (h / 2) * k2[1]])
    const k4 = f([y[0] + h * k3[0], y[1] + h * k3[1]])
    return [
      y[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
      y[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    ]
  }

  /**
   * δ(t) for a fault cleared at `tc`, integrated at a stated step. The step
   * divides the clearing instant exactly, so no step straddles the moment the
   * transfer changes.
   */
  const integrate = (tc, { step = STEP_START, tEnd = null, Pmax = null } = {}) => {
    const end = tEnd ?? Math.max(2, 3 * after.period)
    const nBefore = Math.max(1, Math.round(tc / step))
    const h1 = tc > 0 ? tc / nBefore : step
    let y = [delta0, 0]
    const trace = [{ t: 0, delta: y[0], omega: y[1], on: true }]
    for (let k = 0; k < nBefore && tc > 0; k++) {
      y = step4(y, h1, Pmax ?? during)
      trace.push({ t: (k + 1) * h1, delta: y[0], omega: y[1], on: true })
    }
    const cleared = { delta: y[0], omega: y[1] }
    const nAfter = Math.max(1, Math.round((end - tc) / step))
    const h2 = (end - tc) / nAfter
    let peak = y[0]
    let peakAt = tc
    let turned = false
    for (let k = 0; k < nAfter; k++) {
      const prev = y
      y = step4(y, h2, post)
      const t = tc + (k + 1) * h2
      trace.push({ t, delta: y[0], omega: y[1], on: false })
      if (y[0] > peak) {
        peak = y[0]
        peakAt = t
      }
      if (!turned && prev[1] > 0 && y[1] <= 0) {
        turned = true
        // Refine the turning point on the quadratic through the last two speeds.
        const frac = prev[1] / (prev[1] - y[1])
        peak = prev[0] + frac * (y[0] - prev[0])
        peakAt = t - h2 + frac * h2
      }
      if (y[0] > deltaMax + Math.PI) break
    }
    return { trace, cleared, peak, peakAt, turned, step, tc }
  }

  /**
   * The first swing after clearing at `tc`, both ways, with the step chosen by
   * the guard. The step halves until the integrated peak matches the closed
   * form, and the pane prints the step it settled on.
   */
  const clearAt = (tc, { step = STEP_START, guard = true, tEnd = null } = {}) => {
    let h = step
    let run = integrate(tc, { step: h, tEnd })
    const exact = peakFrom(run.cleared.delta, run.cleared.omega)
    if (!exact.stable || !run.turned)
      return {
        tc,
        stable: false,
        step: h,
        trace: run.trace,
        cleared: run.cleared,
        peak: NaN,
        peakExact: NaN,
        says: 'The machine does not turn back after this clearing time, so the first swing has no peak and the machine loses synchronism.',
      }
    const tries = []
    let err = Math.abs(deg(run.peak) - deg(exact.peak))
    tries.push({ step: h, error: err })
    while (guard && err > PEAK_GUARD_DEG && h > STEP_FLOOR) {
      h /= 2
      run = integrate(tc, { step: h, tEnd })
      const ex = peakFrom(run.cleared.delta, run.cleared.omega)
      err = Math.abs(deg(run.peak) - deg(ex.peak))
      tries.push({ step: h, error: err })
    }
    const finalExact = peakFrom(run.cleared.delta, run.cleared.omega)
    return {
      tc,
      stable: true,
      step: h,
      tries,
      error: err,
      trace: run.trace,
      cleared: run.cleared,
      peak: run.peak,
      peakAt: run.peakAt,
      peakExact: finalExact.peak,
      method: 'fixed-step RK4',
      says: `Fixed-step RK4 at ${h < 1e-3 ? `${(h * 1e6).toFixed(0)} µs` : `${(h * 1e3).toFixed(1)} ms`}, and the integrated peak matches the energy relation to ${err.toFixed(4)}°.`,
    }
  }

  /**
   * The critical clearing time: the instant during the fault at which the
   * angle reaches δ_cr. It is a root of the integrated solution rather than a
   * closed form, so it comes from the same integrator with the same guard.
   */
  const criticalTime = ({ step = 1e-5 } = {}) => {
    if (alwaysStable) return { tcr: Infinity, cycles: Infinity, says: 'This fault never takes the machine past its critical angle.' }
    let y = [delta0, 0]
    let t = 0
    let last = y
    while (y[0] < deltaCr && t < 10) {
      last = y
      y = step4(y, step, during)
      t += step
    }
    // One linear step back onto the angle, which is exact to the step's square.
    const frac = (deltaCr - last[0]) / (y[0] - last[0])
    const tcr = t - step + frac * step
    return { tcr, cycles: tcr * (machine.f ?? 60), step }
  }

  /**
   * The closed form for the special case where the fault cuts the transfer to
   * zero. Then P_e is zero throughout the fault, δ(t) = δ_0 + P_m t²/2M, and
   * the clearing time follows from the angle with no integration at all.
   */
  const closedFormTime = () => {
    const zero = stability(machine, { pre, during: 0, post })
    return { tcr: Math.sqrt((2 * M * (zero.deltaCr - delta0)) / Pm), deltaCr: zero.deltaCr }
  }

  const crit = alwaysStable ? { tcr: Infinity, cycles: Infinity } : neverStable ? { tcr: 0, cycles: 0 } : criticalTime()
  return {
    machine,
    pre,
    during,
    post,
    M,
    H: before.H,
    Pm,
    delta0,
    deltaMax,
    deltaCr,
    alwaysStable,
    neverStable,
    areaAccel,
    areaDecel,
    areaError,
    Kpre: before.K,
    Kpost: after.K,
    fnPre: before.fn,
    fnPost: after.fn,
    periodPost: after.period,
    plant: after.plant,
    tcr: crit.tcr,
    cycles: crit.cycles,
    swingBefore: before,
    swingAfter: after,
    quadrature,
    peakFrom,
    integrate,
    clearAt,
    criticalTime,
    closedFormTime,
    /** The three power curves, for the P–δ plane. */
    curves: (points = 361) => {
      const delta = []
      const P = { pre: [], during: [], post: [] }
      for (let k = 0; k < points; k++) {
        const d = (Math.PI * k) / (points - 1)
        delta.push(d)
        P.pre.push(pre * Math.sin(d))
        P.during.push(during * Math.sin(d))
        P.post.push(post * Math.sin(d))
      }
      return { delta, ...P, Pm }
    },
  }
}
