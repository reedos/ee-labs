import { windowFn } from './spectrum.js'

// Finite impulse response filters — the other half of the subject.
//
// Everything in biquad.js has feedback: each output sample is fed back into the
// next one, so the impulse response goes on forever and stability is a question
// you have to ask. An FIR has no feedback at all. Its output is a weighted sum
// of the last N inputs and nothing else:
//
//   y[n] = sum_k h[k] * x[n-k]
//
// which is the definition of convolution, and it is the whole filter. Three
// consequences follow immediately, and each is worth seeing rather than being
// told:
//
//   - It cannot be unstable. There is no pole to put anywhere; a bounded input
//     gives a bounded output for any coefficients whatsoever.
//   - It forgets completely after N samples. `settle` is exactly N-1, not an
//     estimate from a decay rate the way settleSamples() has to be for an IIR.
//   - If h is symmetric, the phase is EXACTLY linear, so every frequency is
//     delayed by the same (N-1)/2 samples. No IIR can do that, and it is the
//     reason FIRs are used where waveform shape matters.
//
// The cost is order: matching a 3-coefficient biquad's skirt can take a hundred
// taps. That trade is the point of having both in the same rack.

export const FIR_MODES = ['lowpass', 'highpass']

export const TAPS_MIN = 2
export const TAPS_MAX = 201

/** sin(pi x)/(pi x), with the removable singularity filled in. */
export function sinc(x) {
  if (x === 0) return 1
  const px = Math.PI * x
  return Math.sin(px) / px
}

/**
 * The N-tap moving average: h[k] = 1/N.
 *
 * The simplest filter that does anything, and the one whose response is worth
 * knowing by heart. Summing N samples and dividing puts an exact null wherever
 * a whole number of cycles fits in the window — at every multiple of fs/N — so
 * the nulls are evenly spaced and their positions are a property of N alone.
 */
export function movingAverage(taps) {
  const n = clampTaps(taps)
  return new Float64Array(n).fill(1 / n)
}

const clampTaps = (n) =>
  Math.max(TAPS_MIN, Math.min(TAPS_MAX, Math.round(Number(n) || TAPS_MIN)))

/** Force an odd length, so a symmetric kernel has a real centre tap. */
const oddTaps = (n) => {
  const c = clampTaps(n)
  return c % 2 === 0 ? c + 1 : c
}

/**
 * A windowed-sinc kernel, normalized to unit gain in the passband.
 *
 * The ideal low-pass is a rectangle in frequency, and the inverse transform of a
 * rectangle is a sinc that runs to infinity in both directions. You cannot have
 * that, so you cut it off — and cutting it off abruptly is itself a rectangular
 * window, whose leaky transform is what produces the ripple either side of the
 * corner. That ripple does not shrink as taps are added; it only gets narrower.
 * Gibbs again, and the same fix: taper the ends.
 *
 * The window choice is therefore not a detail. It is the transition-width versus
 * stopband-depth trade, and `window: 'none'` is worth clicking precisely because
 * it is the one that looks wrong.
 *
 * Length is forced odd so the kernel is Type I: symmetric about a real centre
 * tap, giving exactly linear phase and an INTEGER group delay of (N-1)/2.
 */
export function designFir({ mode = 'lowpass', taps = 31, freq = 1000, window = 'hamming' }, sampleRate) {
  const N = oddTaps(taps)
  const M = (N - 1) / 2
  // Away from the edges by a hair: fc = 0 or fc = fs/2 gives an all-zero kernel
  // that no normalization can rescue.
  const fc = Math.min(Math.max(freq, 1), sampleRate * 0.499)
  const fn = fc / sampleRate // cycles per sample
  const w = windowFn(window, N)

  const h = new Float64Array(N)
  let sum = 0
  for (let k = 0; k < N; k++) {
    h[k] = 2 * fn * sinc(2 * fn * (k - M)) * w[k]
    sum += h[k]
  }
  // Normalize on the low-pass, where the passband is DC and the sum of the taps
  // IS H(0). Doing it here rather than after the inversion below keeps the
  // high-pass's DC null exact.
  if (sum !== 0) for (let k = 0; k < N; k++) h[k] /= sum

  if (mode === 'highpass') {
    // Spectral inversion: subtract the low-pass from an all-pass delayed by the
    // same M samples, so the two line up in time before they cancel. Needs the
    // odd length above to have a centre tap to put the impulse on.
    for (let k = 0; k < N; k++) h[k] = -h[k]
    h[M] += 1
  }

  return h
}

/** H(e^{jw}) = sum_k h[k] e^{-jwk}, as `{ re, im }`. */
export function firAt(h, f, sampleRate) {
  const w = (2 * Math.PI * f) / sampleRate
  let re = 0
  let im = 0
  for (let k = 0; k < h.length; k++) {
    const a = w * k
    re += h[k] * Math.cos(a)
    im -= h[k] * Math.sin(a)
  }
  return { re, im }
}

export function firResponse(h, f, sampleRate) {
  const { re, im } = firAt(h, f, sampleRate)
  return Math.hypot(re, im)
}

export function firPhase(h, f, sampleRate) {
  const { re, im } = firAt(h, f, sampleRate)
  return Math.atan2(im, re)
}

/** True when h[k] == h[N-1-k] to within `eps` — the linear-phase condition. */
export function isSymmetric(h, eps = 1e-12) {
  for (let k = 0, j = h.length - 1; k < j; k++, j--) {
    if (Math.abs(h[k] - h[j]) > eps) return false
  }
  return true
}

/**
 * Group delay in samples.
 *
 * For a symmetric kernel this is exactly (N-1)/2 at every frequency, which is
 * the claim worth making: the filter delays the whole signal and distorts its
 * shape not at all. Asymmetric kernels get the honest numerical answer.
 */
export function firGroupDelay(h) {
  return (h.length - 1) / 2
}

/**
 * A stateful FIR, as a delay line and a dot product — literally the convolution
 * sum, one output sample at a time.
 */
export function makeFir(h) {
  const N = h.length
  const buf = new Float64Array(N)
  let i = 0
  return (x) => {
    buf[i] = x
    let y = 0
    // Walk backwards from the newest sample, so buf[i-k] is x[n-k].
    let j = i
    for (let k = 0; k < N; k++) {
      y += h[k] * buf[j]
      j = j === 0 ? N - 1 : j - 1
    }
    i = i === N - 1 ? 0 : i + 1
    return y
  }
}

/**
 * Zeros of an FIR, as points on the z-plane.
 *
 * H(z) = sum h[k] z^-k = z^-(N-1) * (h[0] z^(N-1) + ... + h[N-1]), so the zeros
 * are the roots of that polynomial in z and there are exactly N-1 of them. An
 * FIR has no poles anywhere except a pile of them at the origin, which is only
 * bookkeeping for the delay and is not drawn.
 *
 * Durand-Kerner, the same solver packages/systems uses for continuous-time
 * roots — a polynomial does not care which plane it is being read in.
 */
export function firZeros(h) {
  // Leading coefficient first, in z.
  const c = Array.from(h)
  while (c.length > 1 && Math.abs(c[c.length - 1]) < 1e-18) c.pop() // trailing zeros in z^-1
  while (c.length > 1 && Math.abs(c[0]) < 1e-18) c.shift()
  const n = c.length - 1
  if (n < 1) return []

  const a = c.map((v) => v / c[0])
  let re = []
  let im = []
  for (let k = 0; k < n; k++) {
    const ang = (2 * Math.PI * k) / n + 0.4
    re.push(0.9 * Math.cos(ang))
    im.push(0.9 * Math.sin(ang))
  }

  const evalPoly = (x, y) => {
    let pr = 1
    let pi = 0
    for (let k = 1; k <= n; k++) {
      const nr = pr * x - pi * y + a[k]
      const ni = pr * y + pi * x
      pr = nr
      pi = ni
    }
    return [pr, pi]
  }

  for (let iter = 0; iter < 500; iter++) {
    let moved = 0
    for (let k = 0; k < n; k++) {
      const [pr, pi] = evalPoly(re[k], im[k])
      let dr = 1
      let di = 0
      for (let j = 0; j < n; j++) {
        if (j === k) continue
        const xr = re[k] - re[j]
        const xi = im[k] - im[j]
        const nr = dr * xr - di * xi
        const ni = dr * xi + di * xr
        dr = nr
        di = ni
      }
      const den = dr * dr + di * di
      if (den < 1e-300) continue
      const qr = (pr * dr + pi * di) / den
      const qi = (pi * dr - pr * di) / den
      re[k] -= qr
      im[k] -= qi
      moved = Math.max(moved, Math.hypot(qr, qi))
    }
    if (moved < 1e-14) break
  }

  return re.map((r, k) => [r, im[k]])
}
