// Closing the loop: the averaged model, and the exact engine it answers to.
//
// A converter is not a linear system. Over one switching period it is two
// linear systems in succession, and the state-space average
//
//     A_avg = D·A_on + D′·A_off,      f_avg = D·f_on + D′·f_off
//
// is the linear system whose trajectory runs through the middle of the real
// one. Linearising it about its own fixed point X = −A_avg⁻¹ f_avg gives the
// control-to-output transfer function every compensator is designed against:
//
//     G_vd(s) = C (sI − A_avg)⁻¹ E + F,
//     E = (A_on − A_off) X + (f_on − f_off),   F = (c_on − c_off)·X
//
// Nothing here is typed in from a textbook. E and F are built from the same
// state matrices the exact solver steps, so the buck's V_out/(1 + s/(Qω₀) +
// s²/ω₀²) and the boost's right-half-plane zero at D′²R/L come out of the
// arithmetic rather than out of a table, and they carry whatever winding
// resistance, switch resistance and capacitor ESR the knobs have set.
//
// Two rules from CORE_SCOPE.md govern this file.
//
// Rule 2, a refused bridge is a finished feature: the two-interval average is
// a statement about a converter whose period has two intervals. In
// discontinuous conduction it has three, the inductor current is pinned at
// zero for one of them, and the resulting model has a different order.
// `averagingRefusal` says so and `averagedModel` throws rather than reporting
// the continuous-conduction answer for a circuit that is not in continuous
// conduction.
//
// Rule 3, no approximation without a guard: averaging discards everything at
// the switching frequency and above. `averagingGuard` carries the threshold,
// f_s/5, and warns from f_s/10, so a panel that quotes a crossover can say
// which side of it the number is on.

import { steadyState } from './steady.js'
import { propagator01 } from './propagator.js'
import { integral, firstDownCrossing, sample } from './segment.js'
import { evalSignal } from './topologies.js'
import { solve, matVec, vecAdd, vecScale, matAdd, matScale } from './linalg.js'

/** Above this share of f_s an averaged model is refused; from a tenth it warns. */
export const AVERAGING_REFUSE = 1 / 5
export const AVERAGING_WARN = 1 / 10

/**
 * Why this converter has no two-interval average, or null if it has one.
 *
 * The message is content: it names the third interval and how much of the
 * period it takes, so a reader who lightens the load until the model declines
 * can see what changed.
 */
export function averagingRefusal(conv) {
  if (!conv.states || !conv.states.on || !conv.states.off) {
    return 'the averaged model needs one on interval and one off interval, and this circuit has neither'
  }
  if (!conv.hasDead) return null
  const ss = steadyState(conv)
  if (ss.mode === 'CCM') return null
  const dead = ((ss.tOff - ss.td) / ss.T) * 100
  return `the inductor current reaches zero and the diode blocks for ${dead.toFixed(1)} % of the period, so the period has three intervals rather than two and this two-interval average is not this circuit's model`
}

/**
 * The averaged state-space model at the operating point, and the small-signal
 * vectors the transfer function is built from.
 *
 * `X` is the operating point, the fixed point of the averaged system. `E` is
 * how the state's derivative moves with duty, `C` the averaged output row and
 * `F` the direct term the output's own switching leaves.
 */
export function averagedModel(conv) {
  const why = averagingRefusal(conv)
  if (why) throw new Error(`averagedModel: ${why}`)
  const D = conv.p.D
  const Dp = 1 - D
  const on = conv.states.on
  const off = conv.states.off
  const A = matAdd(matScale(on.A, D), matScale(off.A, Dp))
  const f = vecAdd(vecScale(on.f, D), vecScale(off.f, Dp))
  // A X + f = 0 at the operating point. A load makes A invertible; a converter
  // with no load has no operating point and `solve` says so.
  const X = solve(A, vecScale(f, -1))
  const cOn = on.signals.vout.c
  const cOff = off.signals.vout.c
  const dOn = on.signals.vout.d
  const dOff = off.signals.vout.d
  const C = cOn.map((c, i) => D * c + Dp * cOff[i])
  const dOut = D * dOn + Dp * dOff
  const dA = matAdd(on.A, off.A, -1)
  const E = vecAdd(matVec(dA, X), vecAdd(on.f, off.f, -1))
  const F = cOn.reduce((s, c, i) => s + (c - cOff[i]) * X[i], 0) + (dOn - dOff)
  return { conv, D, Dp, A, f, X, C, dOut, E, F, T: conv.T, fs: conv.p.fs }
}

/** The operating-point output the averaged model holds. */
export const averagedOutput = (model) => model.C.reduce((s, c, i) => s + c * model.X[i], 0) + model.dOut

/**
 * G_vd(s) as a rational function, numerator and denominator in descending
 * powers of s.
 *
 * For a 2×2 state matrix, (sI − A)⁻¹ = adj/det with det = s² − tr·s + |A|, so
 * the whole transfer function is two quadratics and no matrix inverse is ever
 * formed.
 */
export function controlToOutput(conv) {
  const model = averagedModel(conv)
  const { A, C, E, F } = model
  const tr = A[0][0] + A[1][1]
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
  const cE = C[0] * E[0] + C[1] * E[1]
  const n0 = C[0] * (-A[1][1] * E[0] + A[0][1] * E[1]) + C[1] * (A[1][0] * E[0] - A[0][0] * E[1])
  const num = [F, cE - F * tr, n0 + F * det]
  const den = [1, -tr, det]
  const dc = num[2] / den[2]
  const w0 = Math.sqrt(Math.abs(det))
  const Q = w0 / Math.max(1e-300, -tr)
  return { model, num, den, dc, w0, Q, ...zeroOf(num), kind: conv.kind, fs: conv.p.fs }
}

/**
 * Where the numerator vanishes. With no capacitor ESR the numerator is first
 * order, so there is one zero and its sign is the whole story: a positive
 * root is a right-half-plane zero, and the step response starts the wrong way.
 */
export function zeroOf(num) {
  const [a, b, c] = num
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c))
  if (!(scale > 0)) return { zeros: [], wz: Infinity, rhp: false }
  if (Math.abs(a) <= 1e-12 * scale) {
    if (Math.abs(b) <= 1e-12 * scale) return { zeros: [], wz: Infinity, rhp: false }
    const z = -c / b
    return { zeros: [z], wz: Math.abs(z), rhp: z > 0 }
  }
  const disc = b * b - 4 * a * c
  if (disc >= 0) {
    const r = Math.sqrt(disc)
    const zs = [(-b + r) / (2 * a), (-b - r) / (2 * a)]
    const rhp = zs.filter((z) => z > 0)
    return { zeros: zs, wz: rhp.length ? Math.min(...rhp.map(Math.abs)) : Math.min(...zs.map(Math.abs)), rhp: rhp.length > 0 }
  }
  const re = -b / (2 * a)
  const im = Math.sqrt(-disc) / (2 * a)
  return { zeros: [{ re, im }, { re, im: -im }], wz: Math.hypot(re, im), rhp: re > 0 }
}

/** A polynomial in descending powers, at s = jω. */
function polyAt(p, w) {
  let re = 0
  let im = 0
  const n = p.length - 1
  for (let i = 0; i <= n; i++) {
    const k = n - i
    // (jω)^k cycles 1, j, −1, −j.
    const m = p[i] * w ** k
    if (k % 4 === 0) re += m
    else if (k % 4 === 1) im += m
    else if (k % 4 === 2) re -= m
    else im -= m
  }
  return { re, im }
}

/** Magnitude and phase (degrees) of a rational transfer function at f hertz. */
export function tfAt(tf, f) {
  const w = 2 * Math.PI * f
  const n = polyAt(tf.num, w)
  const d = polyAt(tf.den, w)
  const dd = d.re * d.re + d.im * d.im
  const re = (n.re * d.re + n.im * d.im) / dd
  const im = (n.im * d.re - n.re * d.im) / dd
  return { re, im, mag: Math.hypot(re, im), phase: (Math.atan2(im, re) * 180) / Math.PI }
}

/**
 * Whether an averaged model may be quoted at a frequency.
 *
 * The average throws away the switching ripple, so it says nothing about what
 * happens within a period. `AVERAGING_REFUSE` is the plan's f_s/5; between
 * f_s/10 and it the model is still reported and the level says `warn`.
 */
export function averagingGuard({ f, fs }) {
  if (!(fs > 0)) return { level: 'refuse', ratio: Infinity, limit: 0, reason: 'a switching frequency of zero has no average to take' }
  const ratio = Math.abs(f) / fs
  const limit = fs * AVERAGING_REFUSE
  if (ratio >= AVERAGING_REFUSE) {
    return {
      level: 'refuse',
      ratio,
      limit,
      reason: `${fmtHz(f)} is above f_s/5 = ${fmtHz(limit)}, where the ripple the average discards is the same size as the signal it reports`,
    }
  }
  if (ratio >= AVERAGING_WARN) {
    return { level: 'warn', ratio, limit, reason: `${fmtHz(f)} is past f_s/10 = ${fmtHz(fs * AVERAGING_WARN)}, so the average carries a few per cent of error` }
  }
  return { level: 'ok', ratio, limit, reason: null }
}

const fmtHz = (f) => (f >= 1e6 ? `${(f / 1e6).toPrecision(3)} MHz` : f >= 1e3 ? `${(f / 1e3).toPrecision(3)} kHz` : `${f.toPrecision(3)} Hz`)

/** The same converter at another duty. Only the interval lengths change. */
export function withDuty(conv, D) {
  return { ...conv, p: { ...conv.p, D } }
}

/**
 * The exact converter, walked period by period from x0, with the waveform
 * sampled and each period's own average taken in closed form.
 *
 * The two intervals are fixed in length, so a period is a chain of two
 * segments and no event has to be found. A diode converter whose current
 * reaches zero during the walk is not that, and `dcm` says so at the period
 * it first happened.
 */
export function cycleWalk(conv, x0, { periods = 40, n = 8 } = {}) {
  const T = conv.T
  const tOn = conv.p.D * T
  const tOff = T - tOn
  const t = []
  const vout = []
  const iL = []
  const cycles = []
  let x = x0
  let dcm = -1
  for (let k = 0; k < periods; k++) {
    const base = k * T
    let acc = 0
    for (const [state, len, t0] of [
      [conv.states.on, tOn, base],
      [conv.states.off, tOff, base + tOn],
    ]) {
      const seg = { name: state.name, state, A: state.A, f: state.f, x0: x, T: len, t0 }
      if (len > 0) {
        if (dcm < 0 && conv.hasDead && state === conv.states.off && firstDownCrossing(seg, 0) !== null) dcm = k
        const m = Math.max(2, Math.round((n * len) / T))
        const pts = sample(seg, m)
        const dt = len / m
        for (let i = 0; i <= m; i++) {
          t.push(t0 + i * dt)
          vout.push(evalSignal(state, 'vout', pts[i]))
          iL.push(evalSignal(state, 'iL', pts[i]))
        }
        const ix = integral(seg)
        const s = state.signals.vout
        acc += s.d * len + s.c[0] * ix[0] + s.c[1] * ix[1]
        x = pts[m]
      }
    }
    cycles.push({ k, t: base + T / 2, vout: acc / T, x })
  }
  return { t, vout, iL, cycles, T, periods, dcm: dcm >= 0 ? dcm : null, xEnd: x }
}

/**
 * The averaged model's own trajectory from x0, sampled on the same grid and
 * averaged over the same periods, so the two curves are the same measurement
 * taken two ways.
 */
export function averagedWalk(model, x0, { periods = 40, n = 8 } = {}) {
  const T = model.T
  const dt = T / n
  const { phi0, phi1 } = propagator01(model.A, dt)
  const drive = matVec(phi1, model.f)
  const out = (v) => model.C.reduce((s, c, i) => s + c * v[i], 0) + model.dOut
  const t = []
  const vout = []
  const cycles = []
  let x = x0
  for (let k = 0; k < periods; k++) {
    const start = x
    for (let i = 0; i < n; i++) {
      t.push(k * T + i * dt)
      vout.push(out(x))
      x = vecAdd(matVec(phi0, x), drive)
    }
    const ix = integral({ A: model.A, f: model.f, x0: start, T })
    cycles.push({ k, t: k * T + T / 2, vout: (model.C[0] * ix[0] + model.C[1] * ix[1]) / T + model.dOut, x })
  }
  t.push(periods * T)
  vout.push(out(x))
  return { t, vout, cycles, T, periods, xEnd: x }
}

/**
 * A duty step, seen twice: the exact converter walked from its old steady
 * state, and the averaged model run from the same state.
 *
 * `gap` is the largest disagreement between the two period averages, as a
 * share of the step the output takes. `ripple` is what the average discards,
 * the peak-to-peak of the exact output in the last period walked.
 */
export function dutyStep(conv, dD, { periods = 60, n = 8 } = {}) {
  const before = conv
  const after = withDuty(conv, conv.p.D + dD)
  const refused = averagingRefusal(before) || averagingRefusal(after)
  const ss0 = steadyState(before)
  const x0 = ss0.x0
  const xBar = averageState(ss0)
  const exact = cycleWalk(after, x0, { periods, n })
  const start = exact.cycles.length ? exact.cycles[0] : null
  const v0 = evalSignal(before.states.on, 'vout', x0)
  const model = refused ? null : averagedModel(after)
  const avg = model ? averagedWalk(model, xBar, { periods, n }) : null
  const ssEnd = steadyState(after)
  const endAvg = cycleAverage(ssEnd, 'vout')
  const startAvg = cycleAverage(ss0, 'vout')
  const step = endAvg - startAvg
  let gap = 0
  if (avg) for (let k = 0; k < exact.cycles.length; k++) gap = Math.max(gap, Math.abs(exact.cycles[k].vout - avg.cycles[k].vout))
  // The peak-to-peak of the last period walked: the ripple the average is
  // blind to, measured on the same waveform the average was taken from.
  const tail = exact.t.length - Math.round(exact.t.length / periods) - 1
  const last = exact.vout.slice(Math.max(0, tail))
  const ripple = Math.max(...last) - Math.min(...last)
  // How far the output goes the wrong way before it goes the right way, in
  // period averages: zero for a minimum-phase converter, the undershoot for
  // one with a zero in the right half plane.
  const dip = Math.min(...exact.cycles.map((c) => c.vout)) - startAvg
  const rise = Math.max(...exact.cycles.map((c) => c.vout)) - startAvg
  const dipAt = exact.cycles.reduce((a, c) => (c.vout < a.vout ? c : a), exact.cycles[0]).t
  const dipModel = avg ? Math.min(...avg.cycles.map((c) => c.vout)) - startAvg : null
  const slope = exact.cycles.length > 1 ? (exact.cycles[1].vout - exact.cycles[0].vout) / exact.T : 0
  return {
    dD,
    D0: before.p.D,
    D1: after.p.D,
    x0,
    xBar,
    v0,
    before,
    after,
    exact,
    avg,
    model,
    refused,
    startAvg,
    endAvg,
    step,
    gap,
    gapShare: step !== 0 ? gap / Math.abs(step) : 0,
    ripple,
    dip,
    dipAt,
    dipModel,
    rise,
    slope,
    start,
    tf: refused ? null : controlToOutput(after),
  }
}

/**
 * The period average of the state itself.
 *
 * This, and not the state at the switching instant, is what an averaged
 * model's state variable means: the moving average over one period. Starting
 * the averaged run from the instantaneous state instead starts it half a
 * ripple away from where the model says it is, and the whole trajectory
 * carries that offset as a ring.
 */
export function averageState(ss) {
  const acc = [0, 0]
  for (const seg of ss.segments) {
    if (seg.T <= 0) continue
    const ix = integral(seg)
    acc[0] += ix[0]
    acc[1] += ix[1]
  }
  return [acc[0] / ss.T, acc[1] / ss.T]
}

/** The period average of a signal on a solved steady state. */
export function cycleAverage(ss, name) {
  let acc = 0
  for (const seg of ss.segments) {
    if (seg.T <= 0) continue
    const ix = integral(seg)
    const s = seg.state.signals[name]
    acc += s.d * seg.T + s.c[0] * ix[0] + s.c[1] * ix[1]
  }
  return acc / ss.T
}

/**
 * The slope the averaged model gives the output the instant the duty steps,
 * which for a numerator of degree one is its s coefficient.
 *
 * For an ideal boost that coefficient is −i_L/C: the extra duty takes the
 * diode out of the circuit for longer, and until the inductor current has
 * grown the capacitor is left alone with the load. That is the whole of the
 * right-half-plane zero, in one number with a sign.
 */
export function initialSlope(tf, dD = 1) {
  return dD * (tf.num[1] - tf.num[0] * tf.den[1])
}

/** The coefficients a plant hand-over carries: G_vd as a rational in s. */
export function plantCoefficients(conv) {
  const tf = controlToOutput(conv)
  return {
    num: tf.num.slice(),
    den: tf.den.slice(),
    dc: tf.dc,
    w0: tf.w0,
    Q: tf.Q,
    wz: tf.wz,
    rhp: tf.rhp,
    fs: conv.p.fs,
    guard: averagingGuard({ f: tf.w0 / (2 * Math.PI), fs: conv.p.fs }),
  }
}
