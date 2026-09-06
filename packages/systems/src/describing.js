// The describing function: the one approximation in this package, with its
// guard.
//
// ── APPROXIMATION, GUARDED (Rule 3 of /CORE_SCOPE.md) ──
//
// A describing function replaces a nonlinearity by the gain it would have if
// its input were a pure sine and only the fundamental of its output mattered.
// The second half of that sentence is a hypothesis about the loop, not a fact
// about the nonlinearity: the linear part has to attenuate the harmonics the
// nonlinearity makes, or the sine the method assumed is not what the
// nonlinearity actually sees.
//
// So every prediction here carries HARMONIC_LIMIT, computed from the loop's own
// response at the third harmonic and the nonlinearity's own third-harmonic
// coefficient. Above the threshold the prediction is returned with `holds:
// false` and a reason, and the pane shows the reason instead of the number.
//
// A predicted limit cycle is also never presented alone. `phase.js` integrates
// the same loop exactly, and the app prints the difference between the two
// amplitudes. An approximation whose error is on screen is a lesson. One whose
// error is not is a claim nobody checked.

import { evalAtFreq } from './tf.js'
import { NonlinearError, SMOOTH_DECLINED, RELAY_DECLINED } from './nonlinear.js'

/**
 * The filter hypothesis's threshold.
 *
 * The third harmonic that arrives back at the nonlinearity's input, relative to
 * the fundamental that arrives there. The nonlinearities here are odd, so the
 * second harmonic is exactly zero and the third is the one that matters.
 *
 * Five per cent, and the number is chosen from a measurement rather than a
 * convention. Fuzzed against the exact piecewise-linear simulation over a
 * range of gains and limits, the amplitude this method gets wrong is the same
 * size as this ratio, within a factor of 1.5 either way (describing.test.js).
 * So a ratio of five per cent means a predicted amplitude that is right to
 * within about five per cent, and a ratio above it means an error the pane
 * should not print a number for.
 */
export const HARMONIC_LIMIT = 0.05

/**
 * The describing function of a saturation, exactly.
 *
 *   N(A) = 1                                       for A <= delta
 *   N(A) = (2/pi)(asin(r) + r sqrt(1 - r^2))       for A > delta, r = delta/A
 *
 * It is real, because the saturation is odd and memoryless, so it has no
 * memory with which to shift phase. It is at most 1 and falls towards zero as
 * the input grows, which is the whole mechanism: a loop that is unstable at
 * small signals grows until the saturation has taken away exactly enough gain,
 * and then stops growing.
 */
export function saturationDescribing(delta, A) {
  if (!(delta > 0)) throw new NonlinearError('The saturation limit must be positive.', 'bad-limit')
  if (!(A > 0)) return 1
  if (A <= delta) return 1
  const r = delta / A
  return (2 / Math.PI) * (Math.asin(r) + r * Math.sqrt(1 - r * r))
}

/**
 * The describing function of a deadzone, exactly. It is 1 minus the
 * saturation's, which is what the two shapes adding to a straight line means.
 */
export function deadzoneDescribing(delta, A) {
  return 1 - saturationDescribing(delta, A)
}

/**
 * The Fourier sine coefficient of a saturation's output at the n-th harmonic,
 * for odd n, when the input is A sin(theta).
 *
 * b_1 is A times the describing function, which is the definition. b_3 is what
 * the filter hypothesis is judged on. Even harmonics are exactly zero because
 * the saturation is odd, and the function returns zero for them rather than a
 * rounding-noise number.
 */
export function saturationHarmonic(delta, A, n) {
  if (!(A > 0) || !(delta > 0)) return 0
  if (n % 2 === 0) return 0
  if (A <= delta) return n === 1 ? A : 0
  const alpha = Math.asin(delta / A)
  if (n === 1) return A * saturationDescribing(delta, A)
  // b_n = (4/pi) [ A * int_0^alpha sin(t) sin(n t) dt + delta * int_alpha^{pi/2} sin(n t) dt ]
  const first =
    (Math.sin((n - 1) * alpha) / (n - 1) - Math.sin((n + 1) * alpha) / (n + 1)) / 2
  const second = (Math.cos(n * alpha) - Math.cos((n * Math.PI) / 2)) / n
  return (4 / Math.PI) * (A * first + delta * second)
}

/**
 * The amplitude at which a saturation's describing function equals a target
 * gain, by bisection on delta/A.
 *
 * N is 1 at A = delta and falls monotonically towards zero, so a target in
 * (0, 1] has exactly one solution and bisection finds it to machine precision.
 * A target above 1 has none, which is what "the loop is gain stable, and the
 * saturation only helps" means.
 */
export function saturationAmplitudeFor(delta, target) {
  if (!(target > 0) || target > 1) return null
  if (target === 1) return delta
  let lo = 1e-12
  let hi = 1
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const N = (2 / Math.PI) * (Math.asin(mid) + mid * Math.sqrt(1 - mid * mid))
    if (N < target) lo = mid
    else hi = mid
  }
  const r = (lo + hi) / 2
  return delta / r
}

/**
 * The frequencies where the loop's locus crosses the negative real axis, with
 * the gain there.
 *
 * The describing function of an odd memoryless nonlinearity is real and
 * positive, so -1/N sits on the negative real axis. The intersection with the
 * locus can only happen where the locus is on that axis, which is exactly the
 * phase crossover `margins` already finds. Crossings are bracketed on the
 * caller's grid and refined by bisection, so the frequency is exact rather than
 * interpolated.
 */
export function negativeRealCrossings(L, freqs) {
  const at = (f) => {
    const [re, im] = evalAtFreq(L, f)
    return { re, im, mag: Math.hypot(re, im) }
  }
  const out = []
  let prev = at(freqs[0])
  for (let i = 1; i < freqs.length; i++) {
    const cur = at(freqs[i])
    if (prev.im * cur.im < 0) {
      let lo = freqs[i - 1]
      let hi = freqs[i]
      let flo = prev.im
      for (let k = 0; k < 80; k++) {
        const mid = Math.sqrt(lo * hi)
        const fm = at(mid).im
        if (flo < 0 === fm < 0) {
          lo = mid
          flo = fm
        } else hi = mid
      }
      const f = Math.sqrt(lo * hi)
      const v = at(f)
      if (v.re < 0 && v.mag > 1e-12) out.push({ f, omega: 2 * Math.PI * f, gain: v.mag })
    }
    prev = cur
  }
  return out
}

/**
 * The limit cycle a saturation's describing function predicts in the loop L.
 *
 * The condition is 1 + N(A) L(j omega) = 0. N is real and positive, so the
 * frequency is where L crosses the negative real axis and the amplitude is the
 * one at which N(A) equals 1/|L| there. Since N is at most 1, a solution exists
 * only where |L| at that frequency is at least 1, which is to say only where
 * the linear loop would already be unstable. A loop with gain margin above one
 * gets `null` and the reason, and that refusal is the content: a saturation
 * does not make a stable loop oscillate.
 *
 * `amplitude` is measured at the nonlinearity's INPUT, which is the controller
 * output when the saturation is the actuator's. The exact simulation in
 * `phase.js` measures the same signal, so the two numbers compare directly.
 *
 * @returns {null | {
 *   amplitude, omega, frequency, N, loopGain,
 *   harmonicRatio, threshold, holds, reason,
 * }}
 */
export function describingLimitCycle(L, { kind = 'saturation', delta }, freqs) {
  if (kind === 'relay') throw new NonlinearError(RELAY_DECLINED, 'relay-declined')
  if (kind !== 'saturation') throw new NonlinearError(SMOOTH_DECLINED, 'smooth-declined')
  if (!(delta > 0)) throw new NonlinearError('The saturation limit must be positive.', 'bad-limit')

  const crossings = negativeRealCrossings(L, freqs)
  if (!crossings.length) {
    return {
      predicted: null,
      reason:
        'The loop never reaches -180 degrees, so its locus never touches the negative real axis. A real describing function has nothing to intersect, and no limit cycle is predicted.',
    }
  }
  // The binding crossing is the one whose gain is largest: it is the first the
  // amplitude reaches on the way up, and the one a growing signal settles on.
  const c = crossings.reduce((m, x) => (x.gain > m.gain ? x : m))
  const target = 1 / c.gain
  if (target > 1) {
    return {
      predicted: null,
      reason: `At the phase crossover the loop gain is ${c.gain.toPrecision(4)}, below 1. The saturation can only reduce gain, so it cannot bring this loop to the -1 point, and no limit cycle is predicted.`,
      loopGain: c.gain,
      omega: c.omega,
      frequency: c.f,
    }
  }
  const amplitude = saturationAmplitudeFor(delta, target)
  const N = saturationDescribing(delta, amplitude)

  // The filter hypothesis, measured on this loop rather than assumed.
  const third = Math.hypot(...evalAtFreq(L, 3 * c.f))
  const fund = c.gain
  const b1 = saturationHarmonic(delta, amplitude, 1)
  const b3 = saturationHarmonic(delta, amplitude, 3)
  const harmonicRatio = b1 !== 0 && fund !== 0 ? Math.abs((third * b3) / (fund * b1)) : Infinity
  const holds = harmonicRatio <= HARMONIC_LIMIT

  return {
    predicted: { amplitude, omega: c.omega, frequency: c.f, N },
    amplitude,
    omega: c.omega,
    frequency: c.f,
    N,
    loopGain: c.gain,
    harmonicRatio,
    threshold: HARMONIC_LIMIT,
    holds,
    reason: holds
      ? null
      : `The third harmonic arrives back at the nonlinearity at ${(harmonicRatio * 100).toFixed(1)} per cent of the fundamental, above the ${(HARMONIC_LIMIT * 100).toFixed(0)} per cent this method assumes. The input to the saturation is not the sine the describing function was derived for, so the predicted amplitude is not usable here.`,
    crossings,
  }
}

/**
 * How far the describing function's prediction was from the exact simulation,
 * as a signed relative error.
 *
 * Returned so a pane can print it, and so a test can pin it. There is no code
 * path that reports the prediction without this being available beside it.
 */
export function predictionError(predicted, measured) {
  if (predicted == null || measured == null) return null
  if (!(measured.amplitude > 0) || !(measured.frequency > 0)) return null
  return {
    amplitude: (predicted.amplitude - measured.amplitude) / measured.amplitude,
    frequency: (predicted.frequency - measured.frequency) / measured.frequency,
  }
}
