// The sampled loop: a computer in the feedback path, and what that costs.
//
// ── ADMISSION (Rule 1 of /CORE_SCOPE.md) ──
//
// Two objects live in this file and they are not the same kind of thing.
//
// EXACT, admitted without a hedge. A continuous plant driven through a
// zero-order hold and read at the sample instants is a rational function of z,
// with no error at all. `zoh` and `discretize` compute it from one matrix
// exponential, and the sampled output of the discrete model equals the
// continuous plant's output at every sample instant to floating point. This is
// not a discretisation scheme among several. It is the plant, sampled.
//
// APPROXIMATE, and guarded (Rule 3). `emulate` takes a controller designed in
// s and substitutes a difference operator for s. That is a different object
// from the controller it came from, it is labelled one, and `emulationGuard`
// carries its threshold: at fewer than SAMPLES_PER_CYCLE samples per cycle at
// the loop's crossover the substitution is not usable and the pane says so.
//
// DECLINED (Rule 2). The hold's own response, (1 - e^(-sT))/s, is
// transcendental and has no finite poles or zeros, so it is not admitted as a
// transfer function in s. Its magnitude and phase at a frequency are exact
// numbers and are returned as numbers. Nothing here builds a Pade version of it.

import { bilinear, closeLoop, polyAdd, polyMul, roots } from './tf.js'
import { toStateSpace } from './tf.js'
import { expmWithHold, stateSpace, toTransferFunction } from './ss.js'
import { mulVec } from './matrix.js'

/** Thrown where a sampled object is asked for something it cannot exactly give. */
export class DiscreteError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'DiscreteError'
    this.code = code
  }
}

/**
 * The samples per cycle at crossover below which an emulated controller stops
 * describing the loop it was designed for.
 *
 * Twenty, the same threshold the sampled-filter link already refuses below
 * (`CORE_SCOPE.md` Rule 2's first precedent). At twenty samples per cycle the
 * hold's own phase lag at crossover is 9 degrees, which a design with any
 * margin absorbs. At five it is 36 degrees, which most designs do not.
 */
export const SAMPLES_PER_CYCLE = 20

/**
 * Discretise a state space under a zero-order hold, exactly.
 *
 * x[k+1] = Phi x[k] + Gamma u[k], with Phi = e^(A T) and Gamma the integral of
 * e^(A tau) B over one sample. Both come from a single exponential of the
 * augmented matrix, so there is no quadrature and no error to bound. C and D
 * are unchanged, because sampling the output does not change how the output is
 * formed from the state.
 *
 * @returns {{ A, B, C, D, n, Ts }} a state space in z, carrying its sample time
 */
export function zoh(ss, Ts) {
  const s = stateSpace(ss)
  if (!(Ts > 0)) throw new DiscreteError('The sample time must be positive.', 'bad-sample-time')
  if (s.n === 0) return { ...s, Ts }
  const { Phi, Gamma } = expmWithHold(s.A, s.B, Ts)
  return { A: Phi, B: Gamma, C: [...s.C], D: s.D, n: s.n, Ts }
}

/**
 * A continuous transfer function to its exact zero-order-hold equivalent in z.
 *
 * Through the state space, because the conversion each way is exact and the
 * hold's integral is a matrix exponential. The result is a rational function of
 * z whose step response equals the continuous plant's at the sample instants.
 */
export function discretize(tf, Ts) {
  const dss = zoh(toStateSpace(tf), Ts)
  const out = toTransferFunction(dss)
  return { ...out, Ts }
}

/**
 * Discrete-time stability: every pole strictly inside the unit circle.
 *
 * The s-plane's left half becomes the z-plane's interior under z = e^(sT), so
 * the same question is asked of a different region. The margin below one is
 * relative, for the reason `isStable` gives about absolute epsilons.
 */
export function isStableDiscrete(tfz) {
  if (!tfz.a.length || !tfz.a.some((v) => v !== 0)) return false
  return roots(tfz.a).every(([re, im]) => Math.hypot(re, im) < 1 - 1e-9)
}

/**
 * The response of a discrete state space to an input sequence, by the exact
 * recursion. `u(k)` is the input at step k.
 */
export function simulateDiscrete(dss, u, { steps = 60, x0 = null } = {}) {
  const { A, B, C, D, n, Ts } = dss
  const k = new Int32Array(steps)
  const t = new Float64Array(steps)
  const y = new Float64Array(steps)
  const xs = []
  let x = x0 ? [...x0] : new Array(n).fill(0)
  for (let i = 0; i < steps; i++) {
    const uu = u(i)
    k[i] = i
    t[i] = i * Ts
    y[i] = D * uu + (n ? C.reduce((s, c, j) => s + c * x[j], 0) : 0)
    xs.push([...x])
    if (n) x = mulVec(A, x).map((v, j) => v + B[j] * uu)
  }
  return { k, t, y, x: xs }
}

/** The unit-step response of a discrete state space. */
export const stepDiscrete = (dss, opts) => simulateDiscrete(dss, () => 1, opts)

/**
 * The step response of a discrete transfer function in z, by long division of
 * the polynomials into a difference equation.
 *
 * a[0] y[k] = sum b[i] u[k - i] - sum a[j] y[k - j]. Exact, and independent of
 * the state-space route, so the two can be compared against each other.
 */
export function stepDiscreteTF(tfz, steps = 60) {
  const a = [...tfz.a]
  const b = [...tfz.b]
  while (a.length && a[0] === 0) a.shift()
  if (!a.length) throw new DiscreteError('A denominator of zero is not a system.', 'degenerate')
  // Align the numerator on the same highest power as the denominator.
  const pad = new Array(a.length).fill(0)
  for (let i = 0; i < b.length && i < a.length; i++) pad[a.length - 1 - i] = b[b.length - 1 - i]
  const y = new Float64Array(steps)
  for (let k = 0; k < steps; k++) {
    let acc = 0
    for (let i = 0; i < pad.length; i++) {
      const idx = k - i
      acc += pad[i] * (idx >= 0 ? 1 : 0)
    }
    for (let j = 1; j < a.length; j++) {
      const idx = k - j
      acc -= a[j] * (idx >= 0 ? y[idx] : 0)
    }
    y[k] = acc / a[0]
  }
  const k = Int32Array.from({ length: steps }, (_, i) => i)
  const t = tfz.Ts ? Float64Array.from(k, (i) => i * tfz.Ts) : Float64Array.from(k)
  return { k, t, y }
}

/**
 * The magnitude of the zero-order hold at a frequency, exactly.
 *
 * The hold turns each sample into a rectangle one sample wide, whose Fourier
 * transform is T sinc(omega T / 2). At DC it is T, and it falls to zero at the
 * sample rate.
 */
export function zohGain(Ts, omega) {
  const x = (omega * Ts) / 2
  return Math.abs(x) < 1e-12 ? Ts : (Ts * Math.sin(x)) / x
}

/**
 * The phase the zero-order hold costs at a frequency, exactly, in radians.
 *
 * Minus omega T over two, at every frequency, which is a delay of half a
 * sample. Holding a sample for a whole sample period places its energy on
 * average half a period late, and half a period of delay at frequency omega is
 * that many radians of lag. It is exact and is stated without a hedge.
 */
export const zohPhaseLag = (Ts, omega) => -(omega * Ts) / 2

/** The half-sample delay in seconds, which is what the phase lag above is. */
export const zohDelay = (Ts) => Ts / 2

/**
 * The reason the hold is not a transfer function in s.
 *
 * Kept as an exported string so the app can print exactly what the test pins.
 */
export const ZOH_TF_DECLINED =
  'The hold\'s response is (1 - e^(-sT))/s, which has no finite poles or zeros. ' +
  'It is not a rational function of s, so this package does not carry it as one. ' +
  'Its magnitude and phase at a frequency are exact, and zohGain and zohPhaseLag return them. ' +
  'A Pade version would be a different object, and it is not offered here.'

/**
 * Asked for the hold as a transfer function in s, this declines with the
 * reason. The refusal is the feature, and a test measures it.
 */
export function zohTransferFunction() {
  throw new DiscreteError(ZOH_TF_DECLINED, 'zoh-not-rational')
}

/**
 * Substitute a first-order map from s to z into a transfer function.
 *
 * s = num(z) / den(z), with num and den written highest power first. The
 * expansion is the one `bilinear` does for its own map, generalised so the
 * three emulation rules share it.
 */
export function substituteS(tf, num, den) {
  const n = Math.max(tf.a.length, tf.b.length) - 1
  const pad = (c) => [...new Array(n + 1 - c.length).fill(0), ...c]
  const B = pad(tf.b)
  const A = pad(tf.a)
  const powerOf = (base, e) => {
    let r = [1]
    for (let i = 0; i < e; i++) r = polyMul(r, base)
    return r
  }
  const width = n * Math.max(num.length, den.length) - n + 1
  const outNum = new Array(width).fill(0)
  const outDen = new Array(width).fill(0)
  for (let i = 0; i <= n; i++) {
    const e = n - i
    const term = polyMul(powerOf(num, e), powerOf(den, n - e))
    const shift = width - term.length
    for (let j = 0; j < term.length; j++) {
      outNum[shift + j] += B[i] * term[j]
      outDen[shift + j] += A[i] * term[j]
    }
  }
  const g = outDen.find((v) => v !== 0) ?? 1
  return { b: outNum.map((v) => v / g), a: outDen.map((v) => v / g) }
}

/**
 * The three emulation rules, each a different object from the controller it
 * came from.
 *
 * tustin    s = (2/T)(z - 1)/(z + 1). The trapezoid rule. Maps the left half
 *           plane onto the unit disc, so a stable controller stays stable.
 * backward  s = (z - 1)/(T z). Backward rectangles. Also maps stable to
 *           stable, and damps more than the original.
 * forward   s = (z - 1)/T. Forward rectangles. Does NOT map the left half
 *           plane into the disc, so a stable controller can emulate to an
 *           unstable difference equation. That failure is the lesson.
 *
 * The result is labelled: every returned object carries `method`, `Ts` and
 * `approximate: true`. Nothing in this file returns an emulated controller
 * without that label.
 */
export function emulate(tf, Ts, method = 'tustin') {
  if (!(Ts > 0)) throw new DiscreteError('The sample time must be positive.', 'bad-sample-time')
  let out
  if (method === 'tustin') out = bilinear(tf, 1 / Ts)
  else if (method === 'backward') out = substituteS(tf, [1 / Ts, -1 / Ts], [1, 0])
  else if (method === 'forward') out = substituteS(tf, [1 / Ts, -1 / Ts], [0, 1])
  else {
    throw new DiscreteError(
      `"${method}" is not one of the three emulation rules. They are tustin, backward and forward.`,
      'unknown-method',
    )
  }
  return { ...out, Ts, method, approximate: true }
}

/**
 * The guard on an emulated design: is the loop sampled fast enough for the
 * substitution to describe it?
 *
 * The threshold is SAMPLES_PER_CYCLE samples per cycle at the loop's gain
 * crossover. Below it the guard does not hold, and the caller shows the reason
 * rather than the emulated design's predicted margins.
 *
 * `phaseLagDeg` is the exact phase the hold costs at crossover, which is the
 * quantity the threshold is really about. It is reported whether the guard
 * holds or not, because the reader who is near the threshold wants the number
 * and not the verdict.
 *
 * @param crossoverHz the loop's gain crossover, in hertz, as `margins` returns
 */
export function emulationGuard(crossoverHz, Ts) {
  if (crossoverHz == null || !(crossoverHz > 0)) {
    return {
      samplesPerCycle: null,
      threshold: SAMPLES_PER_CYCLE,
      holds: false,
      phaseLagDeg: null,
      reason: 'The loop has no gain crossover, so there is no frequency at which to judge the sample rate.',
    }
  }
  const samplesPerCycle = 1 / (crossoverHz * Ts)
  const phaseLagDeg = (-zohPhaseLag(Ts, 2 * Math.PI * crossoverHz) * 180) / Math.PI
  const holds = samplesPerCycle >= SAMPLES_PER_CYCLE
  return {
    samplesPerCycle,
    threshold: SAMPLES_PER_CYCLE,
    holds,
    phaseLagDeg,
    reason: holds
      ? null
      : `At ${samplesPerCycle.toFixed(1)} samples per cycle at crossover the hold alone costs ${phaseLagDeg.toFixed(1)} degrees of phase. The emulated controller is a different object from the one designed in s, and below ${SAMPLES_PER_CYCLE} samples per cycle it does not describe this loop. Design in z instead.`,
  }
}

/**
 * The discrete loop a digital controller and a held plant make.
 *
 * The plant is discretised exactly and the controller is already in z, so the
 * open loop is their product and the closed loop is L/(1 + L) with the same
 * polynomial algebra the continuous side uses. Nothing about closing a loop
 * cares which variable the polynomials are in.
 */
export function discreteLoop(plantTf, controllerZ, Ts) {
  const Pz = discretize(plantTf, Ts)
  const open = { b: polyMul(controllerZ.b, Pz.b), a: polyMul(controllerZ.a, Pz.a), Ts }
  return {
    plant: Pz,
    controller: controllerZ,
    open,
    closed: { ...closeLoop(open), Ts },
    error: { b: open.a, a: polyAdd(open.b, open.a), Ts },
  }
}

/**
 * The equivalent continuous pole of a discrete one: s = ln(z) / T.
 *
 * The exact inverse of z = e^(sT) on the principal branch, and the reason a
 * pole at z = 0.9 with T = 0.1 s is a mode with a 0.95 s time constant. Poles
 * on or outside the unit circle come back with a non-negative real part, which
 * is the same verdict the z-plane gives.
 */
export function sOfZ(z, Ts) {
  const [re, im] = z
  const mag = Math.hypot(re, im)
  if (mag === 0) return [-Infinity, 0]
  return [Math.log(mag) / Ts, Math.atan2(im, re) / Ts]
}
