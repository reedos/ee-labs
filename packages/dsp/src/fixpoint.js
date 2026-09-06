import { poleRadius, isStable, biquadPolesZeros, biquadResponse } from './biquad.js'

// What happens when the coefficients and the state are not real numbers.
//
// Every filter in this package is designed in float64 and run in float64, which
// is close enough to exact arithmetic that the difference never appears. Real
// hardware stores a coefficient in sixteen bits and a state variable in
// sixteen more, and four separate things then go wrong. Each has its own
// experiment, and each is exactly computable:
//
//   - Coefficient quantisation. Rounding a1 and a2 to a grid moves the poles to
//     a grid too, and a high-Q section's poles sit close together near the unit
//     circle where that grid is coarsest. The quantised filter is still exactly
//     rational, so its H(z) is admitted and its poles are printed. Nothing about
//     it is approximate, and the plan says so: the approximation happened at
//     design time, and what is left is a different filter, stated exactly.
//   - Limit cycles. Rounding inside the feedback loop makes the recursion
//     nonlinear, and a filter with an input of exactly zero can then oscillate
//     forever between a small set of states. The state is a vector of integers,
//     so the sequence must eventually repeat, and the repeat can be detected
//     rather than estimated.
//   - Overflow. A sum past the largest representable number either wraps to the
//     other end of the range or sticks at it. Wrapping turns a small excursion
//     into a full-scale jump, and in a recursive filter that jump comes back
//     round the loop.
//   - Rounding noise. Each rounding is an error of at most half a step, and a
//     model that treats those errors as white noise of power delta^2/12 predicts
//     the output noise to within a decibel. That model is an approximation with
//     a guard, and the guard is that the signal must exercise many codes.

export const ROUNDING = ['round', 'truncate']
export const OVERFLOW = ['saturate', 'wrap']

/**
 * A fixed-point grid: `bits` total, one sign bit, and `intBits` bits before the
 * binary point. The step is delta = 2^-(bits - 1 - intBits), and the range runs
 * from -2^intBits to 2^intBits - delta, which is the two's complement range.
 *
 * `q(x)` returns a number that is exactly an integer multiple of delta, so a
 * quantised coefficient set has exactly representable values and the resulting
 * H(z) is exact.
 */
export function quantizer({ bits = 16, intBits = 0, rounding = 'round', overflow = 'saturate' } = {}) {
  const b = Math.max(2, Math.round(bits))
  const i = Math.round(intBits)
  const delta = Math.pow(2, -(b - 1 - i))
  const top = Math.pow(2, i) - delta
  const bottom = -Math.pow(2, i)
  const span = Math.pow(2, i + 1)
  const q = (x) => {
    let n = x / delta
    n = rounding === 'truncate' ? Math.trunc(n) : Math.round(n)
    let v = n * delta
    if (v > top || v < bottom) {
      if (overflow === 'saturate') v = v > top ? top : bottom
      else {
        // Two's complement wrap: fold into [bottom, top] by the range's period.
        v = v - span * Math.floor((v - bottom) / span)
      }
    }
    return v
  }
  q.delta = delta
  q.bits = b
  q.intBits = i
  q.top = top
  q.bottom = bottom
  q.rounding = rounding
  q.overflow = overflow
  /** The noise power of one rounding, on the white-error model. */
  q.noisePower = (delta * delta) / 12
  return q
}

/**
 * A biquad's five coefficients on the grid, with the poles both filters have.
 *
 * Returns the quantised section, its poles, and how far each pole moved. The
 * exact filter and the quantised one are both exactly rational, so the
 * comparison is between two admitted objects rather than between an object and
 * an approximation of it.
 */
export function quantizeBiquad(coeffs, q) {
  const out = {
    b0: q(coeffs.b0),
    b1: q(coeffs.b1),
    b2: q(coeffs.b2),
    a1: q(coeffs.a1),
    a2: q(coeffs.a2),
  }
  const exact = biquadPolesZeros(coeffs)
  const grid = biquadPolesZeros(out)
  const moved = exact.poles.map((p, i) => {
    const g = grid.poles[i]
    return g ? Math.hypot(p[0] - g[0], p[1] - g[1]) : NaN
  })
  return {
    coeffs: out,
    poles: grid.poles,
    zeros: grid.zeros,
    exactPoles: exact.poles,
    moved,
    radius: poleRadius(out),
    stable: isStable(out),
    delta: q.delta,
  }
}

/**
 * The number of distinct pole positions a quantised second-order section can
 * reach, and the fraction of the unit disc they cover.
 *
 * With a1 and a2 on a grid of step delta, the complex pole pair sits at
 * r^2 = a2 and cos(theta) = -a1/(2r). The reachable points crowd near the real
 * axis and thin out near z = 1, which is exactly where a low-frequency
 * high-Q section needs them. That is the direct form's weakness, and the
 * coupled form's reason to exist.
 */
export function poleGrid(q, { maxRadius = 1 } = {}) {
  const pts = []
  const delta = q.delta
  const steps = Math.round(2 / delta)
  for (let ia = -steps; ia <= steps; ia++) {
    const a1 = ia * delta
    if (Math.abs(a1) > 2) continue
    for (let ib = 0; ib <= steps; ib++) {
      const a2 = ib * delta
      if (a2 > maxRadius * maxRadius) continue
      const disc = a1 * a1 - 4 * a2
      if (disc >= 0) continue
      const re = -a1 / 2
      const im = Math.sqrt(-disc) / 2
      pts.push([re, im])
    }
  }
  return pts
}

/**
 * A Direct Form I biquad with quantisation inside the loop.
 *
 * `coeffQ` rounds the coefficients once, at build time. `stateQ` rounds every
 * stored value at every sample, which is what makes the recursion nonlinear and
 * what produces limit cycles. Passing no stateQ gives an exactly linear filter
 * with quantised coefficients, which is the object whose poles are printed.
 */
export function makeFixedBiquad(coeffs, { coeffQ = null, stateQ = null } = {}) {
  const c = coeffQ
    ? {
        b0: coeffQ(coeffs.b0),
        b1: coeffQ(coeffs.b1),
        b2: coeffQ(coeffs.b2),
        a1: coeffQ(coeffs.a1),
        a2: coeffQ(coeffs.a2),
      }
    : { ...coeffs }
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  const step = (x) => {
    const xi = stateQ ? stateQ(x) : x
    const acc = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
    const y = stateQ ? stateQ(acc) : acc
    x2 = x1
    x1 = xi
    y2 = y1
    y1 = y
    return y
  }
  step.coeffs = c
  step.state = () => [x1, x2, y1, y2]
  step.setState = (s) => {
    x1 = s[0]
    x2 = s[1]
    y1 = s[2]
    y2 = s[3]
  }
  return step
}

/**
 * Look for a zero-input limit cycle: a state the quantised recursion returns to.
 *
 * The state is four values, each an exact multiple of the quantiser's step, so
 * there are finitely many of them and a zero-input run must either reach the
 * all-zero state or repeat. Repetition is detected by remembering every state
 * seen, which is exact rather than a threshold on "close enough".
 *
 * Returns `{ found, period, amplitude, samples, states }`. `amplitude` is the
 * largest output in the cycle, in the same units as the signal, and is the
 * number a lesson quotes: a filter that should have decayed to nothing instead
 * sits at that level forever.
 */
export function findLimitCycle(step, { start = null, maxSamples = 20000 } = {}) {
  if (start) step.setState(start)
  const seen = new Map()
  const outs = []
  for (let n = 0; n < maxSamples; n++) {
    const key = step.state().join(',')
    if (seen.has(key)) {
      const at = seen.get(key)
      const cycle = outs.slice(at)
      const amplitude = cycle.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
      return {
        found: amplitude > 0,
        period: n - at,
        amplitude,
        samples: n,
        states: cycle.length,
      }
    }
    seen.set(key, n)
    outs.push(step(0))
  }
  return { found: false, period: 0, amplitude: 0, samples: maxSamples, states: 0 }
}

/**
 * The output noise power a rounding quantiser inside a biquad produces, on the
 * white-error model.
 *
 * One rounding of power delta^2/12 enters at the output node and is then shaped
 * by the recursive part of the filter only, so the noise gain is the sum of the
 * squared impulse response of 1/A(z). Computed by running that recursion rather
 * than by a closed form, so it holds for any stable section.
 *
 * This is an approximation with a guard (CORE_SCOPE rule 3). The guard is that
 * the error sequence must be close to white, which needs a signal that moves
 * across many codes. At one or two codes the error is a deterministic function
 * of the signal and the model is wrong by tens of decibels, which is the
 * undithered bit-crusher's spurious tones seen from the other side.
 */
export function roundingNoise(coeffs, q, { taps = 4096 } = {}) {
  const { a1, a2 } = coeffs
  let y1 = 0
  let y2 = 0
  let gain = 0
  for (let n = 0; n < taps; n++) {
    const x = n === 0 ? 1 : 0
    const y = x - a1 * y1 - a2 * y2
    gain += y * y
    y2 = y1
    y1 = y
  }
  const source = q.noisePower
  return { noiseGain: gain, power: source * gain, source, rmsOut: Math.sqrt(source * gain) }
}

/**
 * The headroom a filter needs, as the peak gain from input to the accumulator.
 *
 * The L1 norm of the impulse response is the largest output any input bounded by
 * one can produce, so it is the exact bound on the accumulator and the number a
 * scaling decision has to respect. The L2 norm is the smaller, likelier figure
 * for a signal that is not adversarial, and both are printed because choosing
 * between them is the design decision.
 */
export function scalingNorms(coeffs, sampleRate, { taps = 4096 } = {}) {
  const { b0, b1, b2, a1, a2 } = coeffs
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  let l1 = 0
  let l2 = 0
  for (let n = 0; n < taps; n++) {
    const x = n === 0 ? 1 : 0
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    l1 += Math.abs(y)
    l2 += y * y
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
  }
  // The peak of |H| is the bound for a single sine, which is the third of the
  // three answers a scaling table gives.
  let peak = 0
  const n = 512
  for (let i = 0; i <= n; i++) {
    const f = (i * sampleRate) / (2 * n)
    peak = Math.max(peak, biquadResponse(coeffs, f, sampleRate))
  }
  return { l1, l2: Math.sqrt(l2), peak, bits: Math.ceil(Math.log2(Math.max(1, l1))) }
}
