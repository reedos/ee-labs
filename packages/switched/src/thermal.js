// Loss, read as temperature.
//
// Every watt the ledger accounts for leaves as heat, and heat flows down a
// network of resistances and capacitances that is the same object the rest of
// this package solves. A thermal resistance carries kelvins per watt, a
// thermal capacitance joules per kelvin, and the equations are Ohm's and
// Kirchhoff's with °C on the nodes. So the propagator that steps an RC filter
// steps a heatsink, exactly, and a pulsed load is a periodic steady state
// found by the same linear solve.
//
// ------------------------------------------------------- two networks
//
// A datasheet gives Z_th(t), the junction's rise per watt against time, and a
// **Foster** network is what is fitted to it: stages of R_i in parallel with
// C_i, in series. Its step response is Σ R_i(1 − e^{−t/τ_i}) in closed form,
// which is why it is the fitted form, and its internal nodes are not
// temperatures of anything. A **Cauer** ladder is built from the geometry
// instead: die, then solder, then case, then sink, with a capacitance to
// ambient at each. Its nodes ARE temperatures, and it can be cut open.
//
// The two are not the same network. Given the same R_i and τ_i they reach the
// same final rise, because both have the same total resistance, and they take
// different routes there. `thermalNetwork` builds either, and the lab draws
// both from one set of numbers so the difference is on screen rather than in
// a footnote.
//
// ------------------------------------------------------- the ceiling
//
// A device has a maximum junction temperature. With an ambient and a network,
// that fixes the power it may dissipate, and through the loss model it fixes
// a switching frequency. `frequencyCeiling` is that number, and it is the
// point where §4's G1 tradeoff stops being about efficiency and starts being
// about whether the part survives.

import { propagator } from './propagator.js'
import { clockedSteadyState } from './clocked.js'
import { matVec } from './linalg.js'
import { sample, integral } from './segment.js'

export const THERMAL_MODELS = ['foster', 'cauer']

export const THERMAL_DEFAULTS = {
  Ta: 25,
  Tjmax: 150,
  // Three stages: the die in milliseconds, the case in tenths of a second,
  // the heatsink in minutes.
  R1: 0.6,
  tau1: 1e-3,
  R2: 1.4,
  tau2: 0.1,
  R3: 8,
  tau3: 300,
  model: 'foster',
}

/** The three stages a knob set describes, as R and τ pairs. */
export function stagesOf(p = {}) {
  const q = { ...THERMAL_DEFAULTS, ...p }
  return [
    { Rth: q.R1, tau: q.tau1 },
    { Rth: q.R2, tau: q.tau2 },
    { Rth: q.R3, tau: q.tau3 },
  ]
}

/**
 * A thermal network as a state space, with the power in watts as its input.
 *
 * Foster: each stage is R_i ∥ C_i and the state is that stage's own rise, so
 * A is diagonal with −1/τ_i and every stage sees the whole power.
 *
 *     dΔT_i/dt = P/C_i − ΔT_i/τ_i,      ΔT_j = Σ ΔT_i
 *
 * Cauer: the state is each node's rise above ambient, the power enters the
 * first, and each node is tied to the next by R_i and to ambient by C_i.
 *
 *     C_i dT_i/dt = (T_{i−1} − T_i)/R_{i−1} − (T_i − T_{i+1})/R_i
 *
 * with T_0 replaced by the injected power and T_{n+1} the ambient, which is
 * zero in rise. Both have the same Σ R_i, so both settle at P·ΣR.
 */
export function thermalNetwork(model, stages) {
  if (!THERMAL_MODELS.includes(model)) throw new Error(`unknown thermal network "${model}"`)
  const n = stages.length
  for (const s of stages) {
    if (!(s.Rth > 0)) throw new Error('Rth: a thermal resistance must be positive')
    if (!(s.tau > 0)) throw new Error('tau: a thermal time constant must be positive')
  }
  const C = stages.map((s) => s.tau / s.Rth)
  const A = Array.from({ length: n }, () => new Array(n).fill(0))
  const b = new Array(n).fill(0)
  const read = new Array(n).fill(0)
  if (model === 'foster') {
    for (let i = 0; i < n; i++) {
      A[i][i] = -1 / stages[i].tau
      b[i] = 1 / C[i]
      read[i] = 1
    }
  } else {
    for (let i = 0; i < n; i++) {
      const Ri = stages[i].Rth
      A[i][i] = -1 / (Ri * C[i])
      if (i > 0) {
        const Rp = stages[i - 1].Rth
        A[i][i] -= 1 / (Rp * C[i])
        A[i][i - 1] = 1 / (Rp * C[i])
      }
      if (i + 1 < n) A[i][i + 1] = 1 / (Ri * C[i])
    }
    b[0] = 1 / C[0]
    read[0] = 1
  }
  return {
    model,
    n,
    stages,
    A,
    b,
    read,
    C,
    Rtotal: stages.reduce((a, s) => a + s.Rth, 0),
    Ctotal: C.reduce((a, c) => a + c, 0),
    taus: stages.map((s) => s.tau),
  }
}

/** The junction's rise above ambient for a state vector. */
export const junctionOf = (net, x) => net.read.reduce((a, c, i) => a + c * x[i], 0)

/** The steady rise a constant power makes: P times the sum of the resistances. */
export const steadyRise = (net, P) => P * net.Rtotal

/**
 * The junction's rise from rest under a step of P, at a list of times.
 * One propagator per time, exact, no step size.
 */
export function stepRise(net, P, times) {
  const f = net.b.map((v) => v * P)
  return times.map((t) => {
    if (t <= 0) return 0
    const { phi1 } = propagator(net.A, t)
    return junctionOf(net, matVec(phi1, f))
  })
}

/**
 * The transient thermal impedance: the rise per watt, which is what a
 * datasheet plots. A Foster network's is Σ R_i(1 − e^{−t/τ_i}) in closed
 * form, and `fosterZth` is that formula, kept as the independent oracle the
 * propagator is held against.
 */
export const zth = (net, times) => stepRise(net, 1, times)

export function fosterZth(stages, t) {
  return stages.reduce((a, s) => a + s.Rth * (1 - Math.exp(-t / s.tau)), 0)
}

/**
 * A pulsed load, in periodic steady state.
 *
 * The power is P for a fraction `duty` of every `period` and zero for the
 * rest, so the network sees a fixed pattern and one period is the same affine
 * map every converter in this package is. No settling run: the answer is the
 * solution of (I − Φ)x₀ = d, and the peak is at the end of the pulse.
 */
export function pulsedRise(net, { P, duty, period, points = 240 }) {
  const d = Math.min(0.999999, Math.max(1e-6, duty))
  const hot = { name: 'on', A: net.A, f: net.b.map((v) => v * P) }
  const cold = { name: 'off', A: net.A, f: net.b.map(() => 0) }
  const plan = [
    { state: hot, T: d * period },
    { state: cold, T: (1 - d) * period },
  ]
  const ss = clockedSteadyState(plan, net.n)
  const trace = []
  for (const seg of ss.segments) {
    if (seg.T <= 0) continue
    const m = Math.max(8, Math.round((points * seg.T) / period))
    const pts = sample(seg, m)
    for (let i = 0; i <= m; i++) trace.push({ t: seg.t0 + (i * seg.T) / m, rise: junctionOf(net, pts[i]) })
  }
  const rises = trace.map((q) => q.rise)
  const peak = Math.max(...rises)
  const valley = Math.min(...rises)
  // The period average, from the exact segment integrals rather than the
  // drawn trace. Averaging the state equation over a closed period leaves
  // ⟨ΔT⟩ = ⟨P⟩·ΣR, so this number and `flat` below are the same identity read
  // two ways, and the test holds them together.
  const acc = new Array(net.n).fill(0)
  for (const seg of ss.segments) {
    if (seg.T <= 0) continue
    const ix = integral(seg)
    for (let i = 0; i < net.n; i++) acc[i] += ix[i]
  }
  return {
    trace,
    peak,
    valley,
    swing: peak - valley,
    mean: junctionOf(net, acc.map((v) => v / period)),
    // The average power a duty-cycled pulse delivers, and the rise it would
    // make if the network could not follow the pulse at all.
    Pavg: P * d,
    flat: P * d * net.Rtotal,
    duty: d,
    period,
    ss,
  }
}

/** Junction temperature from an ambient and a rise. */
export const junctionTemp = (Ta, rise) => Ta + rise

/**
 * The power a package may dissipate before the junction reaches its limit,
 * and the margin the present loss leaves.
 */
export function derating(net, { Ta, Tjmax, P = 0 }) {
  const Pmax = (Tjmax - Ta) / net.Rtotal
  const Tj = Ta + P * net.Rtotal
  return {
    Pmax,
    Tj,
    rise: P * net.Rtotal,
    headroom: Tjmax - Tj,
    margin: Pmax > 0 ? P / Pmax : Infinity,
    // The ambient past which even zero loss cannot keep the junction under
    // its limit is the limit itself, so what derating means is this slope.
    slope: -net.Rtotal,
  }
}

/**
 * The switching frequency at which a device reaches its junction limit.
 *
 * Conduction does not follow the frequency and the edges do, so the loss is
 * P_cond + k·f_s with k = ½·V·I·(t_r+t_f). Setting T_a + R_th·P = T_jmax and
 * solving gives the ceiling. It is infinite when the edges cost nothing and
 * negative when conduction alone already exceeds the limit, and both of those
 * are reported rather than clamped.
 */
export function frequencyCeiling({ Rtotal, Ta, Tjmax, Pcond, kSw }) {
  const budget = (Tjmax - Ta) / Rtotal
  if (!(kSw > 0)) return { budget, fs: Infinity, feasible: budget > Pcond }
  return { budget, fs: (budget - Pcond) / kSw, feasible: budget > Pcond }
}

/** The per-watt slope of the loss against frequency, from a converter's edges. */
export const edgeCost = ({ Vblk, iOn, iOff, tr, tf }) => 0.5 * Vblk * (Math.abs(iOn) * tr + Math.abs(iOff) * tf)
