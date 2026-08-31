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
// Q_MAX tracks the widest Q a hand-over from Circuit Lab can name: a series
// RLC reaches the old ceiling of 40 with ordinary component values, and a
// design clamp BELOW the UI's knob silently rebuilt a different filter than
// the knob claimed. At float64 a Q of 100 is still nowhere near trouble —
// the pole pair sits at radius ≈ 1 − w0/(2Q), fully resolved.
export const FREQ_MIN = 1
export const FREQ_MAX_RATIO = 0.499
export const Q_MIN = 0.05
export const Q_MAX = 100

/**
 * Coefficients for one section, already normalized by a0 so that a0 = 1.
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

/**
 * The section's poles and zeros as points on the z-plane.
 *
 * Multiply the difference equation through by z^2 and the transfer function is
 * (b0 z^2 + b1 z + b2) / (z^2 + a1 z + a2), so both sets are the roots of an
 * ordinary quadratic and no iterative solver is needed. Returned as
 * `{ poles, zeros }`, each a list of `[re, im]`.
 *
 * This is the same filter said a third way. The magnitude curve is what these
 * marks do to a point walking around the unit circle: close to a pole the
 * response rises, close to a zero it falls, and a zero exactly ON the circle
 * puts an exact null at that frequency. Q, which the curve shows as peak height,
 * is here the pole's distance from the circle.
 */
export function biquadPolesZeros({ b0, b1, b2, a1, a2 }) {
  return { poles: quadRoots(1, a1, a2), zeros: quadRoots(b0, b1, b2) }
}

/**
 * Roots of a z^2 + b z + c, degenerating gracefully as the degree drops.
 *
 * A TRAILING zero coefficient lowers the degree in z^-1 — a first-order
 * section stored as {b0, b1, 0} is (b0 z + b1)/z after multiplying through,
 * one genuine root plus a pole at the origin that is only delay bookkeeping.
 * Dividing the common z out first keeps the z-plane free of phantom marks at
 * the centre.
 */
function quadRoots(a, b, c) {
  if (Math.abs(c) < 1e-18) {
    // Degree drops: az^2 + bz = z(az + b) — the z root is bookkeeping.
    if (Math.abs(b) < 1e-18) return []
    if (Math.abs(a) < 1e-18) return []
    return [[-b / a, 0]]
  }
  if (Math.abs(a) < 1e-18) {
    if (Math.abs(b) < 1e-18) return []
    return [[-c / b, 0]]
  }
  const disc = b * b - 4 * a * c
  if (disc >= 0) {
    const s = Math.sqrt(disc)
    return [
      [(-b + s) / (2 * a), 0],
      [(-b - s) / (2 * a), 0],
    ]
  }
  const s = Math.sqrt(-disc)
  return [
    [-b / (2 * a), s / (2 * a)],
    [-b / (2 * a), -s / (2 * a)],
  ]
}

/**
 * Samples until the impulse response has decayed below `eps`.
 *
 * Floored at 2: the decay model r^n only describes the recursive part, but the
 * numerator holds two samples of input memory whatever the poles do. With the
 * poles at (or numerically indistinguishable from) the origin — f0 = fs/4 at
 * Q = 0.5 lands exactly there — the formula alone said "settled after 1 sample"
 * of a kernel whose second tap is 0.5, and renderChain trusted it.
 */
export function settleSamples(coeffs, eps = 1e-6) {
  const r = poleRadius(coeffs)
  if (Number.isNaN(r) || r >= 1) return Infinity
  return Math.max(2, r > 0 ? Math.ceil(Math.log(eps) / Math.log(r)) : 0)
}

/**
 * A stateful Direct Form I section. `process(x)` is literally the difference
 * equation:
 *
 *   y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
 *
 * Transposed Direct Form II is the usual professional choice — it needs two state
 * variables instead of four and has better numerical behavior in fixed point or
 * float32. Neither matters at float64 with Q <= 100, and DF-I has the property that
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

// ------------------------------------------------------------- filter order

/**
 * Butterworth section Qs for a cascade of total order N (even): the k-th
 * section needs Q = 1/(2 cos((2k+1)π/2N)). For N = 4 that is 0.5412 and
 * 1.3066 — and NOT 0.7071 twice, which is the whole content of the "Order is
 * a choice" lesson.
 */
export function butterworthQs(order) {
  const out = []
  for (let k = 0; k < order / 2; k++) {
    out.push(1 / (2 * Math.cos(((2 * k + 1) * Math.PI) / (2 * order))))
  }
  return out
}

/**
 * A first-order section — one pole, and for the high-pass one zero at DC —
 * from the bilinear transform with the corner pre-warped so |H(fc)| is
 * exactly 1/√2. Expressed in the same {b0,b1,b2,a1,a2} shape (b2 = a2 = 0),
 * so every downstream consumer — makeBiquad, biquadResponse, the z-plane —
 * works unchanged.
 *
 * There is no Q. That is not a missing feature: one pole cannot resonate,
 * which is exactly what the order control exists to teach.
 */
export function designFirstOrder({ mode, freq }, sampleRate) {
  const f0 = Math.min(Math.max(freq, FREQ_MIN), sampleRate * FREQ_MAX_RATIO)
  const K = Math.tan((Math.PI * f0) / sampleRate)
  const a0 = K + 1
  if (mode === 'highpass') {
    return { b0: 1 / a0, b1: -1 / a0, b2: 0, a1: (K - 1) / a0, a2: 0 }
  }
  return { b0: K / a0, b1: K / a0, b2: 0, a1: (K - 1) / a0, a2: 0 }
}

/**
 * The cascade for a low-pass or high-pass of a chosen order, as a list of
 * sections. Order 2 is the plain RBJ section with the user's Q; order 1 has
 * no Q to set; order 4 is a true Butterworth, whose section Qs are decided by
 * the mathematics rather than the knob.
 */
export function designCascade({ mode, freq, q, order = 2 }, sampleRate) {
  const n = Number(order) || 2
  if (n === 1) return [designFirstOrder({ mode, freq }, sampleRate)]
  if (n === 2) return [designBiquad({ mode, freq, q }, sampleRate)]
  return butterworthQs(n).map((bq) => designBiquad({ mode, freq, q: bq }, sampleRate))
}
