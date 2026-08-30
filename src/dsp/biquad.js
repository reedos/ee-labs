// Second-order IIR sections, from the Robert Bristow-Johnson audio EQ cookbook.
//
// One section, not a cascade. A single biquad with a Q knob teaches more than a
// Butterworth order selector: Q is directly visible as the height of the resonant
// peak (|H(f0)| = Q exactly, for a lowpass — see the tests), and the time-domain
// ringing that comes with it is visible in the same glance.

export const BIQUAD_MODES = [
  'lowpass',
  'highpass',
  'bandpass',
  'notch',
  'peaking',
  'allpass',
]

// Kept well inside the unit circle. The UI clamps to these too, so isStable()
// should never be able to fail from user input.
export const FREQ_MIN = 1
export const FREQ_MAX_RATIO = 0.499
export const Q_MIN = 0.05
export const Q_MAX = 40

/**
 * Coefficients for one section, already normalised by a0 so that a0 = 1.
 * Returns `{ b0, b1, b2, a1, a2 }`.
 */
export function designBiquad({ mode, freq, q = Math.SQRT1_2, gainDb = 0 }, sampleRate) {
  const f0 = Math.min(Math.max(freq, FREQ_MIN), sampleRate * FREQ_MAX_RATIO)
  const Q = Math.min(Math.max(q, Q_MIN), Q_MAX)

  const w0 = (2 * Math.PI * f0) / sampleRate
  const cosw = Math.cos(w0)
  const sinw = Math.sin(w0)
  const alpha = sinw / (2 * Q)
  const A = Math.pow(10, gainDb / 40)

  let b0
  let b1
  let b2
  let a0
  let a1
  let a2

  switch (mode) {
    case 'lowpass':
      b0 = (1 - cosw) / 2
      b1 = 1 - cosw
      b2 = (1 - cosw) / 2
      a0 = 1 + alpha
      a1 = -2 * cosw
      a2 = 1 - alpha
      break
    case 'highpass':
      b0 = (1 + cosw) / 2
      b1 = -(1 + cosw)
      b2 = (1 + cosw) / 2
      a0 = 1 + alpha
      a1 = -2 * cosw
      a2 = 1 - alpha
      break
    case 'bandpass': // constant 0 dB peak gain
      b0 = alpha
      b1 = 0
      b2 = -alpha
      a0 = 1 + alpha
      a1 = -2 * cosw
      a2 = 1 - alpha
      break
    case 'notch':
      b0 = 1
      b1 = -2 * cosw
      b2 = 1
      a0 = 1 + alpha
      a1 = -2 * cosw
      a2 = 1 - alpha
      break
    case 'peaking':
      b0 = 1 + alpha * A
      b1 = -2 * cosw
      b2 = 1 - alpha * A
      a0 = 1 + alpha / A
      a1 = -2 * cosw
      a2 = 1 - alpha / A
      break
    case 'allpass':
      b0 = 1 - alpha
      b1 = -2 * cosw
      b2 = 1 + alpha
      a0 = 1 + alpha
      a1 = -2 * cosw
      a2 = 1 - alpha
      break
    default:
      throw new Error(`unknown biquad mode: ${mode}`)
  }

  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

/**
 * |H(f)|, from substituting z = e^{jw} into (b0 + b1 z^-1 + b2 z^-2)/(1 + a1 z^-1 + a2 z^-2).
 *
 * This is the naive form on purpose — it reads as the definition. The RBJ appendix
 * gives a cancellation-free variant in terms of phi = sin^2(w/2) that is better
 * conditioned at a deep notch, where numerator terms cancel to ~1e-16. The true
 * value there is 0, so the loss of precision is harmless for plotting, and one
 * implementation is worth more than two.
 */
export function biquadResponse({ b0, b1, b2, a1, a2 }, f, sampleRate) {
  const w = (2 * Math.PI * f) / sampleRate
  const c1 = Math.cos(w)
  const s1 = Math.sin(w)
  const c2 = Math.cos(2 * w)
  const s2 = Math.sin(2 * w)

  const numRe = b0 + b1 * c1 + b2 * c2
  const numIm = -(b1 * s1 + b2 * s2)
  const denRe = 1 + a1 * c1 + a2 * c2
  const denIm = -(a1 * s1 + a2 * s2)

  const den = Math.hypot(denRe, denIm)
  if (den === 0) return Infinity
  return Math.hypot(numRe, numIm) / den
}

/** arg H(f) in radians. Not plotted yet, but free and useful for the allpass story. */
export function biquadPhase({ b0, b1, b2, a1, a2 }, f, sampleRate) {
  const w = (2 * Math.PI * f) / sampleRate
  const c1 = Math.cos(w)
  const s1 = Math.sin(w)
  const c2 = Math.cos(2 * w)
  const s2 = Math.sin(2 * w)
  const numRe = b0 + b1 * c1 + b2 * c2
  const numIm = -(b1 * s1 + b2 * s2)
  const denRe = 1 + a1 * c1 + a2 * c2
  const denIm = -(a1 * s1 + a2 * s2)
  return Math.atan2(numIm, numRe) - Math.atan2(denIm, denRe)
}

/**
 * Magnitude of the pole radius. The impulse response decays as r^n, which is what
 * sets how long the filter rings — and therefore how much pre-roll the chain needs
 * before an FFT frame is clean.
 */
export function poleRadius({ a1, a2 }) {
  const disc = a1 * a1 - 4 * a2
  if (disc < 0) return Math.sqrt(Math.abs(a2)) // complex pair
  const r = (Math.abs(a1) + Math.sqrt(disc)) / 2
  return Math.max(Math.abs(r), Math.abs(a2) / (r || 1))
}

/** Poles strictly inside the unit circle. */
export function isStable({ a1, a2 }) {
  return Math.abs(a2) < 1 && Math.abs(a1) < 1 + a2
}

/** Samples until the impulse response has decayed below `eps`. */
export function settleSamples(coeffs, eps = 1e-6) {
  const r = poleRadius(coeffs)
  if (!(r > 0) || r >= 1) return Infinity
  return Math.ceil(Math.log(eps) / Math.log(r))
}

/**
 * A stateful Direct Form I section. `process(x)` is literally the difference
 * equation:
 *
 *   y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
 *
 * Transposed Direct Form II is the usual professional choice — it needs two state
 * variables instead of four and has better numerical behaviour in fixed point or
 * float32. Neither matters at float64 with Q <= 40, and DF-I has the property that
 * counts here: the code is the equation on the page.
 */
export function makeBiquad(coeffs) {
  const { b0, b1, b2, a1, a2 } = coeffs
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  return (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    return y
  }
}
