// Closing the loop: the averaged converter, and where it stops being the
// converter.
//
// A switched converter is not an LTI system. Over one period it is two of
// them, and the duty says how long each runs. State-space averaging replaces
// the pair with their weighted mean,
//
//     A = D·A_on + D′·A_off,      f = D·f_on + D′·f_off
//
// whose equilibrium X = −A⁻¹ f is the cycle average the exact solver already
// finds. Perturbing the duty about that point gives one rational transfer
// function from duty to output,
//
//     Ĝ_vd(s) = c (sI − A)⁻¹ B_d + E_d,
//     B_d = (A_on − A_off) X + (f_on − f_off),
//     E_d = (c_on − c_off) X + (d_on − d_off)
//
// with c the averaged output form. For the two-state converters here the
// denominator is det(sI − A), a quadratic, and the numerator is at most a
// quadratic, so the whole model is six real coefficients. That is exactly the
// currency `@ee-labs/systems` trades in, and exactly what Control Lab's
// `plant=custom` carries.
//
// It is an approximation, and CORE_SCOPE.md Rule 3 says an approximation
// ships with its guard. `averagingGuard` is that guard: the model describes
// the converter below f_s/5 and says so, and a feature of the model above
// that frequency is a feature of the averaging rather than of the circuit.
//
// Nothing here iterates towards an answer. The step response of the switched
// converter is the propagator run period by period from the old operating
// point, and the step response of the averaged model is one matrix
// exponential of A. The two are compared, cycle average against smooth
// curve, by `stepAgreement`.

import { propagator01 } from './propagator.js'
import { matAdd, matScale, matVec, vecAdd, vecScale, solve } from './linalg.js'
import { steadyState, signalIntegral } from './steady.js'
import { sample } from './segment.js'
import { evalSignal } from './topologies.js'

/** The output the model is about: every converter here regulates v_out. */
const OUT = 'vout'

/**
 * The averaged circuit at duty D: its matrices, its equilibrium, and the
 * output there.
 *
 * The equilibrium is a linear solve, not a search, so it costs one 2×2
 * elimination. A converter whose averaged A is singular (no load, nothing to
 * pin the state) throws from `solve` rather than returning NaNs.
 */
export function averagedModel(conv, D = conv.p.D) {
  const { on, off } = conv.states
  const Dp = 1 - D
  const A = matAdd(matScale(on.A, D), matScale(off.A, Dp))
  const f = vecAdd(vecScale(on.f, D), vecScale(off.f, Dp))
  const s1 = on.signals[OUT]
  const s2 = off.signals[OUT]
  const c = [D * s1.c[0] + Dp * s2.c[0], D * s1.c[1] + Dp * s2.c[1]]
  const d = D * s1.d + Dp * s2.d
  const X = solve(A, vecScale(f, -1))
  const Vo = c[0] * X[0] + c[1] * X[1] + d
  return { conv, D, A, f, c, d, X, Vo, Iin: 0 }
}

/** The real roots of b₂s² + b₁s + b₀, largest magnitude first, [] if none. */
function realRoots([b2, b1, b0]) {
  if (b2 === 0) return b1 === 0 ? [] : [-b0 / b1]
  const disc = b1 * b1 - 4 * b2 * b0
  if (disc < 0) return []
  const r = Math.sqrt(disc)
  return [(-b1 + r) / (2 * b2), (-b1 - r) / (2 * b2)]
}

/**
 * The control-to-output transfer function of the averaged converter, as six
 * coefficients: G(s) = (b₂s² + b₁s + b₀)/(a₂s² + a₁s + a₀), a₂ = 1.
 *
 * `wz` is the zero nearest the origin and `rhp` says which half plane it is
 * in — the boost's is in the right one, which is the whole of H3.
 * `slope0` is c·B_d, the initial slope of the output after a unit step in
 * duty, in volts per second per unit duty. It is what makes the output of a
 * boost move the wrong way first.
 */
export function gvd(conv, D = conv.p.D) {
  const model = averagedModel(conv, D)
  const { A, X, c } = model
  const { on, off } = conv.states
  const s1 = on.signals[OUT]
  const s2 = off.signals[OUT]
  const Bd = vecAdd(matVec(matAdd(on.A, off.A, -1), X), vecAdd(on.f, off.f, -1))
  const Ed = (s1.c[0] - s2.c[0]) * X[0] + (s1.c[1] - s2.c[1]) * X[1] + (s1.d - s2.d)
  const a1 = -(A[0][0] + A[1][1])
  const a0 = A[0][0] * A[1][1] - A[0][1] * A[1][0]
  // c·adj(sI − A)·B_d = n₁ s + n₀.
  const n1 = c[0] * Bd[0] + c[1] * Bd[1]
  const n0 = c[0] * (-A[1][1] * Bd[0] + A[0][1] * Bd[1]) + c[1] * (A[1][0] * Bd[0] - A[0][0] * Bd[1])
  const b = [Ed, n1 + Ed * a1, n0 + Ed * a0]
  const a = [1, a1, a0]
  const zeros = realRoots(b)
  const near = zeros.length ? zeros.reduce((p, q) => (Math.abs(q) < Math.abs(p) ? q : p)) : null
  return {
    b,
    a,
    dc: b[2] / a[2],
    w0: Math.sqrt(Math.abs(a0)),
    Q: a1 !== 0 ? Math.sqrt(Math.abs(a0)) / a1 : Infinity,
    wz: near === null ? Infinity : Math.abs(near),
    rhp: near !== null && near > 0,
    zeros,
    slope0: n1,
    step0: Ed,
    Bd,
    Ed,
    model,
    fs: conv.p.fs,
  }
}

/** G(jω) at frequency f, in hertz. */
export function gvdAt(tf, f) {
  const w = 2 * Math.PI * f
  const num = { re: -tf.b[0] * w * w + tf.b[2], im: tf.b[1] * w }
  const den = { re: -tf.a[0] * w * w + tf.a[2], im: tf.a[1] * w }
  const q = den.re * den.re + den.im * den.im
  const re = (num.re * den.re + num.im * den.im) / q
  const im = (num.im * den.re - num.re * den.im) / q
  return { re, im, mag: Math.hypot(re, im), phase: Math.atan2(im, re) }
}

/**
 * The textbook forms of §1.5, for the row that sits beside the measured
 * coefficients. Ideal parts only, which is what makes them short.
 */
export function gvdClosedForm(kind, { Vin, D, L, C, R }) {
  const Dp = 1 - D
  const w0 = kind === 'buck' ? 1 / Math.sqrt(L * C) : Dp / Math.sqrt(L * C)
  const Q = (kind === 'buck' ? 1 : Dp) * R * Math.sqrt(C / L)
  const dc = kind === 'buck' ? Vin : Vin / (Dp * Dp)
  const wz = rhpZero(kind, { D, L, R })
  return { dc, w0, Q, wz, f0: w0 / (2 * Math.PI), fz: wz / (2 * Math.PI) }
}

/**
 * Where the right-half-plane zero sits, in radians per second.
 *
 * The inductor has to divert its current away from the output before it can
 * deliver more, so more duty buys less output for a moment. The buck's
 * inductor feeds the output in both switch positions and has no such zero.
 */
export function rhpZero(kind, { D, R, L }) {
  const Dp = 1 - D
  if (kind === 'boost') return (Dp * Dp * R) / L
  if (kind === 'buckboost') return (Dp * Dp * R) / (D * L)
  return Infinity
}

/** How far above the model's own features the averaging stays honest. */
export const AVERAGING_RATIO = 5

/**
 * The guard the averaged model ships with (CORE_SCOPE.md Rule 3).
 *
 * Averaging throws away everything inside one switching period, so it says
 * nothing about behaviour near f_s. The threshold the suite uses is f_s/5:
 * below it the model is the converter, above it a feature belongs to the
 * averaging rather than to the circuit. `at` is any extra frequency the
 * caller cares about, such as a loop crossover.
 */
export function averagingGuard(tf, fs = tf.fs, { at = 0 } = {}) {
  const limit = fs / AVERAGING_RATIO
  const f0 = tf.w0 / (2 * Math.PI)
  const fz = Number.isFinite(tf.wz) ? tf.wz / (2 * Math.PI) : 0
  const highest = Math.max(f0, fz, at)
  const ratio = highest / limit
  // Two bands, as §2 of CORE_SCOPE asks: warn while a feature is within a
  // factor of two of the ceiling, refuse once it is past it.
  const state = ratio > 1 ? 'refuse' : ratio > 0.5 ? 'warn' : 'ok'
  const reasons = {
    ok: null,
    warn: `The model describes the converter below f_s/5, which is ${limit.toPrecision(4)} Hz here. Its highest feature sits at ${highest.toPrecision(4)} Hz, ${(ratio * 100).toFixed(0)} % of the way to that ceiling.`,
    refuse: `The averaged model discards everything inside one switching period, so it describes the converter below f_s/5. Here that ceiling is ${limit.toPrecision(4)} Hz and the model puts a feature at ${highest.toPrecision(4)} Hz. Nothing above the ceiling is the circuit.`,
  }
  return { limit, f0, fz, at, highest, ratio, ok: state === 'ok', state, reason: reasons[state] }
}

/** The fixed on/off pattern of a converter, as a plan of segments. */
function ccmPlan(conv) {
  const tOn = conv.p.D * conv.T
  return [
    { state: conv.states.on, T: tOn },
    { state: conv.states.off, T: conv.T - tOn },
  ]
}

/**
 * The switched converter through a step: `conv0`'s periodic state, then
 * `conv1` run forward period by period with the propagator.
 *
 * The walk knows nothing of `conv1`'s own steady state, so where it arrives
 * is a measurement rather than a restatement. `blocked` is true if the
 * inductor current went negative in a converter whose freewheel path is a
 * diode: the fixed pattern is then wrong, and the caller is told rather than
 * given a waveform the circuit does not have.
 */
export function switchedStep(conv0, conv1, { periods = 40, n = 24 } = {}) {
  const x0 = steadyState(conv0).x0
  const T = conv1.T
  const plan = ccmPlan(conv1)
  const t = []
  const sig = { vout: [], iL: [] }
  const cycles = []
  let x = x0
  let blocked = false
  for (let k = 0; k < periods; k++) {
    const base = k * T
    let vAcc = 0
    let iAcc = 0
    let t0 = 0
    for (const { state, T: dt } of plan) {
      if (dt <= 0) continue
      const seg = { name: state.name, state, A: state.A, f: state.f, x0: x, T: dt, t0: 0 }
      const m = Math.max(2, Math.round((n * dt) / T))
      const pts = sample(seg, m)
      const h = dt / m
      for (let i = 0; i <= m; i++) {
        t.push(base + t0 + i * h)
        sig.vout.push(evalSignal(state, OUT, pts[i]))
        sig.iL.push(pts[i][0])
        if (conv1.hasDead && pts[i][0] < 0) blocked = true
      }
      vAcc += signalIntegral(seg, OUT)
      iAcc += signalIntegral(seg, 'iL')
      x = pts[m]
      t0 += dt
    }
    cycles.push({ k, t: base + T / 2, vout: vAcc / T, iL: iAcc / T })
  }
  return { t, sig, vout: sig.vout, iL: sig.iL, cycles, T, periods, blocked, x0, xEnd: x }
}

/**
 * The averaged model through the same step: one exponential of A, sampled.
 *
 * It starts at `conv0`'s averaged equilibrium, which is the cycle average
 * the switched walk starts from, and relaxes towards `conv1`'s. There is no
 * ripple in it, and that absence is the lesson.
 */
export function averagedStep(conv0, conv1, { periods = 40, n = 24 } = {}) {
  const m0 = averagedModel(conv0)
  const m1 = averagedModel(conv1)
  const T = conv1.T
  const steps = Math.max(2, Math.round(n))
  const dt = T / steps
  const { phi0, phi1 } = propagator01(m1.A, dt)
  const drive = matVec(phi1, m1.f)
  const t = []
  const sig = { vout: [], iL: [] }
  let x = m0.X
  const y = (q) => m1.c[0] * q[0] + m1.c[1] * q[1] + m1.d
  const push = (tt, q) => {
    t.push(tt)
    sig.vout.push(y(q))
    sig.iL.push(q[0])
  }
  push(0, x)
  for (let k = 1; k <= periods * steps; k++) {
    x = vecAdd(matVec(phi0, x), drive)
    push(k * dt, x)
  }
  return { t, sig, vout: sig.vout, T, from: { vout: m0.Vo, iL: m0.X[0] }, to: { vout: m1.Vo, iL: m1.X[0] }, x0: m0.X, xEnd: x }
}

/** Linear interpolation of a sampled curve at `at`. */
function interp(t, y, at) {
  if (at <= t[0]) return y[0]
  if (at >= t[t.length - 1]) return y[y.length - 1]
  let lo = 0
  let hi = t.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (t[mid] <= at) lo = mid
    else hi = mid
  }
  const f = (at - t[lo]) / (t[hi] - t[lo])
  return y[lo] + f * (y[hi] - y[lo])
}

/**
 * The two stories, held against each other: the exact cycle average of the
 * switched output over each period, and the averaged model at the middle of
 * that period.
 *
 * `worst` is the largest gap as a fraction of the step the output makes, so
 * a converter that barely moves is not judged against its own rounding.
 * `ripple` is the peak-to-peak of the last period of the switched waveform,
 * which is what averaging discarded.
 */
export function stepAgreement(conv0, conv1, { periods = 40, n = 24, out = OUT } = {}) {
  const sw = switchedStep(conv0, conv1, { periods, n })
  const av = averagedStep(conv0, conv1, { periods, n })
  let worst = 0
  let at = 0
  const pairs = sw.cycles.map((q) => {
    const smooth = interp(av.t, av.sig[out], q.t)
    return { t: q.t, exact: q[out], averaged: smooth, gap: q[out] - smooth }
  })
  const span = Math.max(1e-12, Math.abs(av.to[out] - av.from[out]))
  for (const q of pairs) {
    const rel = Math.abs(q.gap) / span
    if (rel > worst) {
      worst = rel
      at = q.t
    }
  }
  const last = sw.sig[out].slice(-Math.max(2, Math.round(n)))
  const ripple = Math.max(...last) - Math.min(...last)
  const values = sw.cycles.map((q) => q[out])
  return {
    pairs,
    worst,
    at,
    span,
    ripple,
    out,
    from: av.from[out],
    to: av.to[out],
    dip: Math.min(...values),
    peak: Math.max(...values),
    blocked: sw.blocked,
    switched: sw,
    averaged: av,
  }
}

/**
 * The DC gain the exact solver gives, by a central difference of the periodic
 * steady state in duty.
 *
 * This is the model's one claim that the switched engine can check outright,
 * and it uses none of the averaging: two full steady-state solves and a
 * subtraction.
 */
export function dcGainMeasured(conv, make, { dD = 1e-4 } = {}) {
  const D = conv.p.D
  const up = make(D + dD)
  const down = make(D - dD)
  const vo = (c) => {
    const ss = steadyState(c)
    let acc = 0
    for (const seg of ss.segments) if (seg.T > 0) acc += signalIntegral(seg, OUT)
    return acc / ss.T
  }
  return (vo(up) - vo(down)) / (2 * dD)
}
