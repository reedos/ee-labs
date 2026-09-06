// The rate equations: two states, an exact steady state, and one linearisation.
//
// The pair this module solves, in the form PHOTONICS_LAB_PLAN.md §2.6 writes:
//
//   dN/dt = I/(qV) - N/tau_c - G(N) S
//   dS/dt = Gamma G(N) S - S/tau_p + Gamma beta N/tau_c
//
// with G(N) = g0 (N - N_tr) the gain, Gamma the confinement factor, tau_c the
// carrier lifetime, tau_p the photon lifetime and beta the spontaneous coupling.
//
// CORE_SCOPE.md class, restated where the work happens.
//
//   EXACT, never hedged: the threshold, which is the carrier density at which
//   the round-trip gain equals the cavity loss, and the current that reaches
//   it; the steady state at any current, which is one root of a quadratic and
//   is returned without approximation for any spontaneous coupling; the
//   linearisation about that steady state, which is the Jacobian's own
//   characteristic polynomial and is therefore an exactly rational H(s),
//   admitted to @ee-labs/systems in full and presented without a hedge.
//
//   GUARDED (Rule 3): the linear answer USED AS A PREDICTION OF A LARGE STEP.
//   `depthGuard` measures the error at the modulation depth it is asked about
//   and returns the sentence that goes on the pane. The threshold is a depth,
//   the measurement behind it is `stepOvershoot`, and neither number is typed.
//
//   DECLINED, with the reason diode.js gives: the rate equations solved in
//   time as an answer. `refuseLargeSignal` throws with that reason.
//   `stepOvershoot` integrates the same equations, and it exists to MEASURE the
//   linearisation's error rather than to answer a question about a laser. Its
//   own comment says so, and nothing in the app draws it as physics except
//   beside the prediction it is measuring.
//
// One correction to the plan's §2.6 is made here, and it is a claim about
// physics rather than a preference. The plan quotes the textbook relaxation
// frequency, omega_r = sqrt((I/I_th - 1)/(tau_p tau_c)). That form drops the
// transparency density: it holds when Gamma g0 N_tr is small beside 1/tau_p.
// At the plan's own parameters Gamma g0 N_tr is 7.5e11 per second and 1/tau_p
// is 5.0e11 per second, so the term it drops is the larger of the two. The
// exact linearisation of the equations above gives omega_r^2 = g0 S / tau_p,
// which is what this module returns. `smallSignal` also returns the textbook
// form beside it, labelled, and the ratio between them, because D3 teaches the
// difference rather than hiding it.

import { C0, H_PLANCK, PhotonicsError, Q_E, fraction, nonNegative, positive, require_ } from './const.js'
import { facetReflectance, photonLifetime } from './cavity.js'

/**
 * The chip the whole lab's laser is, as a cavity.
 *
 * A cleaved edge emitter 100 micrometres long in a semiconductor of index 3.5,
 * with no coating on either facet. The reflectance is what that index gives
 * against air, computed rather than typed, and the internal loss is zero so
 * that the only loss is the light leaving through the ends.
 *
 * This exists so that the lab holds ONE laser. The photon lifetime is not a
 * number typed beside the other five: it is what this cavity's mirror loss
 * gives, in cavity.js's own convention. C5 turns the facet reflectance of this
 * chip and reads the threshold move, and the threshold it reads at the default
 * reflectance is the same number D2 pins, because it is the same device.
 *
 * The convention matters and is stated where it is used. `mirrorLoss` is
 * PHOTONICS_LAB_PLAN.md §2.8's (1/2L) ln(1/R), where a single pass loses the
 * factor R. A text that spreads the same reflectance over a round trip quotes
 * twice the loss, halves this lifetime and reaches 18.771 mA instead of the
 * 13.389 mA below. The threshold current is a factor of two in the convention,
 * so the convention is named here.
 */
export const LASER_CHIP = { n: 3.5, L: 100e-6, r: facetReflectance({ n1: 3.5 }), loss: 0 }

/**
 * The laser PHOTONICS_LAB_PLAN.md §4.3 quotes, as one object.
 *
 * Five device parameters plus the lifetime the chip above gives. Each of the
 * five is a number a datasheet or a materials measurement supplies, and each is
 * a knob in Groups C and D.
 *
 * The spontaneous coupling is zero by default. At zero the steady state is the
 * pair of closed forms the plan writes, the threshold is a corner rather than a
 * soft bend, and the relaxation frequency is exactly proportional to the square
 * root of I/I_th - 1. Raising it is a knob, and `steadyState` solves the
 * quadratic that any positive coupling leaves.
 */
export const LASER_DEFAULTS = {
  g0: 2.5e-12, // the differential gain, cubic metres a second
  ntr: 1.0e24, // the transparency carrier density, per cubic metre
  gamma: 0.3, // the confinement factor
  tauC: 2.0e-9, // the carrier lifetime, seconds
  tauP: photonLifetime(LASER_CHIP).tauP, // the photon lifetime the chip's facets give
  V: 1.0e-16, // the active volume, cubic metres
  beta: 0, // the spontaneous emission coupled into the lasing mode
}

/** Every parameter checked, with the defaults filled in for what a caller left out. */
export function laserSpec(spec = {}) {
  const s = { ...LASER_DEFAULTS, ...spec }
  positive(s.g0, 'g0')
  positive(s.ntr, 'ntr')
  positive(s.tauC, 'tauC')
  positive(s.tauP, 'tauP')
  positive(s.V, 'V')
  fraction(s.gamma, 'gamma')
  require_(s.gamma > 0, 'The confinement factor must be above zero. A mode that overlaps none of the active region has no gain.', { field: 'gamma' })
  nonNegative(s.beta, 'beta')
  require_(
    s.beta < 1,
    `The spontaneous coupling is the fraction of spontaneous emission that lands in the lasing mode, so it is below one, and it is ${s.beta}.`,
    { field: 'beta' },
  )
  return s
}

/**
 * The threshold: the carrier density at which the gain clamps, and the current
 * that reaches it.
 *
 *   Gamma g0 (N_th - N_tr) = 1/tau_p    so    N_th = N_tr + 1/(Gamma g0 tau_p)
 *   I_th = q V N_th / tau_c
 *
 * Both are algebra over the parameters. The threshold is defined at zero
 * spontaneous coupling, which is what makes it a number rather than a soft
 * corner: with any coupling at all the output rises smoothly through it, and
 * the threshold is still where the gain stops rising.
 */
export function threshold(spec = {}) {
  const s = laserSpec(spec)
  const gain = 1 / (s.gamma * s.g0 * s.tauP) // N_th - N_tr, the density the gain needs
  const nth = s.ntr + gain
  return { spec: s, nth, gain, ith: (Q_E * s.V * nth) / s.tauC, gth: 1 / s.tauP }
}

/**
 * The steady state, exactly, at one current.
 *
 * Setting both derivatives to zero leaves one quadratic. It is solved in the
 * DISTANCE BELOW THRESHOLD, delta = N_th - N, rather than in N itself, because
 * above threshold N sits within a part in ten thousand of N_th and a quadratic
 * in N loses those digits to cancellation. In delta the cavity's own detuning,
 * 1/tau_p - Gamma G(N), is exactly Gamma g0 delta, and nothing cancels.
 *
 *   (1 - beta) delta^2 + [u + beta (N_th + m)] delta - beta N_th m = 0
 *
 * with u = I tau_c/(qV) - N_th, which is positive above threshold, and
 * m = N_th - N_tr. The physical root is the positive one, and there is exactly
 * one because the constant term is negative.
 *
 * At beta = 0 this returns the closed forms the plan quotes: N is the smaller
 * of N_th and I tau_c/(qV), and the photon density above threshold is
 * Gamma tau_p (I - I_th)/(qV).
 */
export function steadyState(spec = {}) {
  const { current, ...rest } = spec
  const t = threshold(rest)
  const s = t.spec
  nonNegative(current, 'current')
  const a = (current * s.tauC) / (Q_E * s.V) // the carrier density with no photons
  const m = t.gain
  const u = a - t.nth

  // The positive root, by the form that does not subtract two close numbers.
  const c2 = 1 - s.beta
  const c1 = u + s.beta * (t.nth + m)
  const c0 = -s.beta * t.nth * m
  let delta
  if (s.beta === 0) delta = Math.max(0, -u)
  else {
    const disc = c1 * c1 - 4 * c2 * c0 // c0 is negative, so this is positive
    const q = -0.5 * (c1 + Math.sign(c1 || 1) * Math.sqrt(disc))
    delta = c1 > 0 ? c0 / q : q / c2
  }

  const n = t.nth - delta
  // Two ways to read the photon density off the same solution. Above threshold
  // delta is near zero, so the carrier equation is the conditioned one. Below
  // it the carrier equation is the difference of two close densities, and the
  // photon equation is the conditioned one.
  const near = s.beta > 0 && delta > 0.5 * Math.abs(u)
  const photons = near ? (s.beta * n) / (s.tauC * s.g0 * delta) : (u + delta) / (s.tauC * s.g0 * (m - delta))

  return {
    spec: s,
    nth: t.nth,
    ith: t.ith,
    gain: m,
    current,
    n,
    delta,
    s: Math.max(0, photons),
    above: current > t.ith,
    // The photon density the plan's closed form gives, which is the exact
    // answer at beta = 0 and the asymptote above threshold at any beta.
    sIdeal: current > t.ith ? (s.gamma * s.tauP * (current - t.ith)) / (Q_E * s.V) : 0,
  }
}

/**
 * Each term of each equation, at the steady state, with its own value.
 *
 * D1 prints this. Every term is a rate of density, per cubic metre a second,
 * and each sum is zero to the arithmetic's own floor. `floor` is that floor:
 * the largest term times the machine epsilon, so a test compares a sum against
 * the scale of what was added rather than against a chosen epsilon.
 */
export function rateTerms(spec = {}) {
  const x = steadyState(spec)
  const s = x.spec
  const g = s.g0 * (x.n - s.ntr)
  const carriers = [
    { name: 'Pump', formula: 'I/(qV)', value: x.current / (Q_E * s.V) },
    { name: 'Recombination', formula: '−N/τ_c', value: -x.n / s.tauC },
    { name: 'Stimulated emission', formula: '−G(N) S', value: -g * x.s },
  ]
  const photons = [
    { name: 'Stimulated emission', formula: 'Γ G(N) S', value: s.gamma * g * x.s },
    { name: 'Cavity loss', formula: '−S/τ_p', value: -x.s / s.tauP },
    { name: 'Spontaneous', formula: 'Γ β N/τ_c', value: (s.gamma * s.beta * x.n) / s.tauC },
  ]
  const scale = (list) => Math.max(...list.map((t) => Math.abs(t.value)))
  const sum = (list) => list.reduce((a, t) => a + t.value, 0)
  return {
    ...x,
    gain: g,
    carriers,
    photons,
    carrierSum: sum(carriers),
    photonSum: sum(photons),
    carrierFloor: 8 * Number.EPSILON * scale(carriers),
    photonFloor: 8 * Number.EPSILON * scale(photons),
  }
}

/**
 * The linearisation about that steady state, as an exactly rational H(s).
 *
 * The Jacobian of the pair at the steady state is
 *
 *   [ -1/tau_c - g0 S        -g0 (N - N_tr)              ]
 *   [ Gamma g0 S + Gamma beta/tau_c    Gamma g0 (N - N_tr) - 1/tau_p ]
 *
 * so the photon density's response to a current perturbation is
 *
 *   H(s) = (dg/dN) / (qV) / (s^2 + gamma s + omega_r^2)
 *
 * with gamma the negative trace and omega_r^2 the determinant. Both are exact.
 * At zero spontaneous coupling and above threshold they reduce to
 * gamma = 1/tau_c + g0 S and omega_r^2 = g0 S/tau_p, and the low-frequency
 * gain to Gamma tau_p/(qV), which is the slope of the steady-state curve.
 * Invariant 6 measures that against the curve's own derivative.
 *
 * `wrText` is the textbook form, sqrt((I/I_th - 1)/(tau_p tau_c)), which drops
 * the transparency density. It is returned so that D3 can print both and the
 * reader can see what the familiar formula assumes.
 */
export function smallSignal(spec = {}, current) {
  const x = steadyState({ ...spec, current })
  const s = x.spec
  const g = s.g0 * (x.n - s.ntr)
  const fnn = -1 / s.tauC - s.g0 * x.s
  const fns = -g
  const gsn = s.gamma * s.g0 * x.s + (s.gamma * s.beta) / s.tauC
  const gss = s.gamma * g - 1 / s.tauP
  const damping = -(fnn + gss)
  const det = fnn * gss - fns * gsn
  // With no photons in the cavity the two equations are not coupled, so there
  // is no second-order response to linearise. That happens below threshold at
  // zero spontaneous coupling, and it is a real state rather than an error in
  // the arithmetic: the photon density is zero and stays zero. Returning a
  // frequency here would be reporting the cancellation of two equal numbers.
  require_(
    x.s > 0,
    'Below threshold with no spontaneous emission coupled into the mode there are no photons in the cavity. The two equations are uncoupled there, so no relaxation oscillation is defined. Drive the laser above its threshold current, or raise the spontaneous coupling above zero.',
    { field: 'current' },
  )
  require_(
    det > 0 && damping > 0,
    'This steady state has no damped second-order response, so no relaxation oscillation is defined at it. Lower the drive or raise the confinement factor.',
    { field: 'current' },
  )
  const wr = Math.sqrt(det)
  const zeta = damping / (2 * wr)
  const dc = gsn / (Q_E * s.V * det)
  // A second-order low pass peaks only while zeta is under one over root two,
  // and the peak is at the damped frequency rather than at omega_r.
  const resonant = zeta < Math.SQRT1_2
  const peakW = resonant ? wr * Math.sqrt(1 - 2 * zeta * zeta) : 0
  const peak = resonant ? 1 / (2 * zeta * Math.sqrt(1 - zeta * zeta)) : 1
  // The half-power frequency of omega_r^2/(s^2 + gamma s + omega_r^2), which is
  // one root of a quadratic in omega squared.
  const k = 2 * wr * wr - damping * damping
  const w3 = Math.sqrt((k + Math.sqrt(k * k + 4 * wr ** 4)) / 2)
  const ratio = current / x.ith
  return {
    ...x,
    wr,
    fr: wr / (2 * Math.PI),
    gamma: damping,
    zeta,
    resonant,
    peak,
    peakDb: 20 * Math.log10(peak),
    peakHz: peakW / (2 * Math.PI),
    f3db: w3 / (2 * Math.PI),
    dc,
    overshoot: zeta < 1 ? Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)) : 0,
    // The hand-over to @ee-labs/systems, in that package's own coefficient
    // order: the numerator and the denominator in descending powers of s.
    b: [dc * det],
    a: [1, damping, det],
    // The textbook form, and what it costs to use it here.
    wrText: ratio > 1 ? Math.sqrt((ratio - 1) / (s.tauP * s.tauC)) : 0,
    frText: ratio > 1 ? Math.sqrt((ratio - 1) / (s.tauP * s.tauC)) / (2 * Math.PI) : 0,
  }
}

/** The magnitude of that H(s) at a frequency, normalised to its own low-frequency value. */
export function modulationAt(sm, f) {
  const w = 2 * Math.PI * nonNegative(f, 'f')
  const re = sm.wr * sm.wr - w * w
  return (sm.wr * sm.wr) / Math.hypot(re, sm.gamma * w)
}

// ------------------------------------------------------- the guard, and its measurement

/**
 * Past this modulation depth the pane draws the linear prediction as an
 * estimate, and the number came from `stepOvershoot` rather than from taste.
 *
 * PHOTONICS_LAB_PLAN.md §11 sets the bar: a warn threshold whose own measured
 * error passes a tenth has to move. At the plan's laser, biased at twice
 * threshold, the measured overshoot error is 1.0853 per cent at 1 per cent
 * depth, 5.2638 per cent at 5, 10.152 per cent at 10, 26.760 per cent at 30 and
 * 45.596 per cent at 60. Ten per cent depth costs 10.152 per cent, which is
 * over the bar, so the unflagged region stops at five.
 */
export const DEPTH_WARN = 0.05

/**
 * Past this modulation depth the pane stops drawing the linear prediction.
 *
 * The measured error at it is 26.760 per cent, which is over the quarter the
 * plan's invariant 8 asks a decline threshold to have passed.
 */
export const DEPTH_DECLINE = 0.3

/**
 * The step the guard is measured on, integrated.
 *
 * This function exists to MEASURE the linearisation's error, and its own
 * answer is never presented as a description of a laser. A timestep solution's
 * error cannot be told apart from physics, which is the reason `diode.js`
 * gives and the reason `refuseLargeSignal` declines the same thing as an
 * answer. What is legitimate is the comparison: the linear prediction against
 * the integrated one, with the difference reported as the error it is.
 *
 * The integrator is fourth-order Runge-Kutta at a step of one fiftieth of the
 * fastest time constant in the pair, and it stops one relaxation period after
 * the first maximum of the photon density.
 */
export function stepOvershoot(spec = {}, current, depth) {
  const before = steadyState({ ...spec, current })
  const s = before.spec
  fraction(depth, 'depth')
  require_(depth > 0, 'A modulation depth of zero is no step, and the overshoot of no step is not defined.', { field: 'depth' })
  const sm = smallSignal(spec, current)
  const drive = current * (1 + depth)
  const after = steadyState({ ...spec, current: drive })

  const pump = drive / (Q_E * s.V)
  const dn = (n, ph) => pump - n / s.tauC - s.g0 * (n - s.ntr) * ph
  const ds = (n, ph) => s.gamma * s.g0 * (n - s.ntr) * ph - ph / s.tauP + (s.gamma * s.beta * n) / s.tauC

  const dt = Math.min(s.tauP, s.tauC, 1 / sm.wr) / 50
  const stop = Math.min(200000, Math.ceil((12 * Math.PI) / (sm.wr * dt)) + 4)
  let n = before.n
  let ph = before.s
  let peak = ph
  let peakAt = 0
  const t = [0]
  const trace = [ph]
  const every = Math.max(1, Math.floor(stop / 240))
  for (let k = 1; k <= stop; k++) {
    const k1n = dn(n, ph)
    const k1s = ds(n, ph)
    const k2n = dn(n + (dt / 2) * k1n, ph + (dt / 2) * k1s)
    const k2s = ds(n + (dt / 2) * k1n, ph + (dt / 2) * k1s)
    const k3n = dn(n + (dt / 2) * k2n, ph + (dt / 2) * k2s)
    const k3s = ds(n + (dt / 2) * k2n, ph + (dt / 2) * k2s)
    const k4n = dn(n + dt * k3n, ph + dt * k3s)
    const k4s = ds(n + dt * k3n, ph + dt * k3s)
    n += (dt / 6) * (k1n + 2 * k2n + 2 * k3n + k4n)
    ph += (dt / 6) * (k1s + 2 * k2s + 2 * k3s + k4s)
    if (!Number.isFinite(n) || !Number.isFinite(ph)) break
    if (ph > peak) {
      peak = ph
      peakAt = k * dt
    }
    if (k % every === 0) {
      t.push(k * dt)
      trace.push(ph)
    }
  }

  // What the linearisation predicts for the same step: the steady rise its own
  // low-frequency gain gives, plus the overshoot its damping ratio gives.
  const rise = sm.dc * (drive - current)
  const predicted = before.s + rise * (1 + sm.overshoot)
  const error = rise > 0 ? Math.abs(peak - predicted) / rise : 0
  return {
    depth,
    current,
    drive,
    start: before.s,
    final: after.s,
    measured: peak,
    peakAt,
    predicted,
    rise,
    error,
    t,
    trace,
    dt,
    steps: stop,
    // The prediction as a curve, so the pane draws the two on one axis.
    predict: (time) => before.s + rise * linearStep(sm, time),
  }
}

/** The step response of omega_r^2/(s^2 + gamma s + omega_r^2), from zero to one. */
export function linearStep(sm, time) {
  const t = Math.max(0, time)
  const sigma = sm.gamma / 2
  if (sm.zeta < 1) {
    const wd = sm.wr * Math.sqrt(1 - sm.zeta * sm.zeta)
    return 1 - Math.exp(-sigma * t) * (Math.cos(wd * t) + (sigma / wd) * Math.sin(wd * t))
  }
  const root = Math.sqrt(sm.zeta * sm.zeta - 1) * sm.wr
  const p1 = -sigma + root
  const p2 = -sigma - root
  if (p1 === p2) return 1 - Math.exp(p1 * t) * (1 - p1 * t)
  return 1 - (p1 * Math.exp(p2 * t) - p2 * Math.exp(p1 * t)) / (p1 - p2)
}

/**
 * The guard on the linearisation, as a modulation depth with the error
 * measured at it.
 *
 * The two thresholds are a choice, and the number that justifies each is the
 * measured error returned beside it. `PHOTONICS_LAB_PLAN.md` §11 says the
 * threshold moves if the measured error at it exceeds ten per cent, so the
 * test that pins this measures the error at both thresholds rather than
 * asserting the thresholds themselves.
 */
export function depthGuard(spec = {}, current, depth) {
  const step = stepOvershoot(spec, current, depth)
  const ok = depth <= DEPTH_WARN
  const declined = depth > DEPTH_DECLINE
  const pct = (v) => `${(100 * v).toPrecision(4)} %`
  const says = declined
    ? `At ${pct(depth)} modulation the linear prediction misses the overshoot by ${pct(step.error)}, so the pane stops drawing it. The steady state at each current is still exact.`
    : ok
      ? `At ${pct(depth)} modulation the linear prediction misses the overshoot by ${pct(step.error)}, which is inside the ${pct(DEPTH_WARN)} the pane draws without a flag.`
      : `At ${pct(depth)} modulation the linear prediction misses the overshoot by ${pct(step.error)}. Past ${pct(DEPTH_WARN)} the prediction is drawn as an estimate, and past ${pct(DEPTH_DECLINE)} it is not drawn.`
  return {
    depth,
    warn: DEPTH_WARN,
    decline: DEPTH_DECLINE,
    ok,
    declined,
    error: step.error,
    measured: step.measured,
    predicted: step.predicted,
    ratio: step.predicted > step.start ? (step.measured - step.start) / (step.predicted - step.start) : 1,
    step,
    says,
  }
}

// -------------------------------------------------------------------- declined

/**
 * The rate equations solved in time, as an answer, declined with the reason.
 *
 * The wording is `diode.js`'s. A timestep solver's error cannot be told apart
 * from physics, so a turn-on transient drawn as a curve would be teaching the
 * integrator's step size. The steady state here is exact at every current and
 * the small-signal response is exact about it, and between them they carry
 * Group D. `PHOTONICS_LAB_PLAN.md` §10 names where the large-signal work lives.
 */
export function refuseLargeSignal(what = 'the turn-on transient') {
  throw new PhotonicsError(
    `${what} needs the two rate equations integrated in time, and a timestep solver's error cannot be told apart from physics. This package returns the steady state exactly at every current and the linearised response exactly about it, and declines to draw a large-signal solution as though it were measured.`,
    { field: 'time' },
  )
}

/** The same refusal as a sentence, for a pane that has to explain rather than throw. */
export const largeSignalAvailable = () => {
  try {
    refuseLargeSignal()
    return null
  } catch (err) {
    return err.message
  }
}

/** The photon energy in joules at a wavelength, which the output power is counted in. */
export const quantumOf = (lambda) => (H_PLANCK * C0) / positive(lambda, 'lambda')
