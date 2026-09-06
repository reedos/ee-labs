import { fft } from './fft.js'
import { windowFn } from './spectrum.js'

// Estimating a spectrum from a finite record, and why one FFT is not enough.
//
// `spectrum()` in this package returns the amplitude of each sinusoid in a
// frame, which is the right answer for a signal made of sinusoids. For a random
// signal there are no sinusoids to find. What exists is a power spectral
// density, a function of frequency whose integral over a band is the power in
// that band, and a finite record can only ever give an estimate of it.
//
// The fact that makes this a subject rather than a formula: the periodogram, the
// squared magnitude of one FFT, does NOT get better as the record gets longer.
// Its variance stays at about the square of the true density however many
// samples go in. A longer record buys finer frequency spacing and no reduction
// in scatter at all, which is visible the first time anyone plots one.
//
// The fix is averaging. Split the record into K pieces, take K periodograms and
// average them, and the variance falls as 1/K while the resolution falls by the
// same factor. Bartlett's method does this with abutting pieces, Welch's with
// overlapping windowed pieces, and the choice between resolution and scatter is
// the whole content of the method.
//
// The other route is a model. Assume the signal came from white noise through an
// all-pole filter of order p, fit that filter, and plot its response. That gives
// a smooth spectrum with sharp peaks from very few samples, and it is exactly as
// good as the assumption behind it.

/**
 * The power the window itself contributes, for the density normalisation.
 *
 * A periodogram is scaled by fs * sum(w^2) so that its integral over frequency
 * is the signal's mean power, whatever window was used. Getting this wrong makes
 * every quoted density wrong by a window-dependent factor, which is the reason
 * it is a named function rather than an inline term.
 */
export function windowPower(w) {
  let acc = 0
  for (let i = 0; i < w.length; i++) acc += w[i] * w[i]
  return acc
}

/** Round up to a power of two, which is what the radix-2 transform needs. */
const pow2 = (n) => {
  let p = 1
  while (p < n) p *= 2
  return p
}

/**
 * The periodogram: one FFT, squared, scaled to a one-sided power density.
 *
 *   P[k] = |X[k]|^2 / (fs * sum(w^2)),  doubled except at DC and Nyquist
 *
 * Returns `{ freqs, psd, df }` with psd in units of power per hertz. Summing
 * psd * df over the returned bins gives the mean power of the windowed record,
 * which is the property that makes the scaling checkable rather than a
 * convention.
 */
export function periodogram(x, sampleRate, { window = 'none' } = {}) {
  const n = pow2(x.length)
  const w = windowFn(window, x.length)
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let i = 0; i < x.length; i++) re[i] = x[i] * w[i]
  fft(re, im)
  const u = windowPower(w)
  const half = n / 2
  const freqs = new Float64Array(half + 1)
  const psd = new Float64Array(half + 1)
  for (let k = 0; k <= half; k++) {
    const p = re[k] * re[k] + im[k] * im[k]
    const fold = k === 0 || k === half ? 1 : 2
    freqs[k] = (k * sampleRate) / n
    psd[k] = (fold * p) / (sampleRate * u)
  }
  return { freqs, psd, df: sampleRate / n, segments: 1, n }
}

/**
 * Bartlett's method: K abutting segments, no window, averaged.
 *
 * The variance of the average falls as 1/K because the segments are independent.
 * The bin spacing rises by K for the same reason, so the resolution is exactly
 * what is traded away. Both halves of that sentence are measured in the tests.
 */
export function bartlett(x, sampleRate, { segments = 8 } = {}) {
  return welch(x, sampleRate, { segments, overlap: 0, window: 'none' })
}

/**
 * Welch's method: overlapping windowed segments, averaged.
 *
 * Two changes from Bartlett. A window on each segment stops the leakage that
 * would otherwise put a strong component's skirts across the whole estimate, and
 * overlapping recovers the samples the window's taper threw away. At 50 % overlap
 * with a Hann window the segments are no longer independent, so K segments reduce
 * the variance by about K/1.1 rather than by K, and that factor is stated where a
 * lesson quotes a reduction.
 *
 * `segments` counts the segments produced, and the segment length follows from it
 * and the overlap. Returns the same shape as `periodogram`, plus the segment
 * length and count actually used.
 */
export function welch(x, sampleRate, { segments = 8, overlap = 0.5, window = 'hann' } = {}) {
  const K = Math.max(1, Math.round(segments))
  const ov = Math.min(0.95, Math.max(0, overlap))
  // With K segments of length L overlapping by a fraction ov, the record covers
  // L + (K-1) L (1-ov) samples. Solve for L, then floor to a power of two so the
  // radix-2 transform runs without padding.
  const raw = x.length / (1 + (K - 1) * (1 - ov))
  let L = 1
  while (L * 2 <= raw) L *= 2
  const step = Math.max(1, Math.round(L * (1 - ov)))
  const w = windowFn(window, L)
  const u = windowPower(w)
  const half = L / 2
  const psd = new Float64Array(half + 1)
  const freqs = new Float64Array(half + 1)
  for (let k = 0; k <= half; k++) freqs[k] = (k * sampleRate) / L

  let used = 0
  for (let s = 0; s + L <= x.length && used < K; s += step) {
    const re = new Float64Array(L)
    const im = new Float64Array(L)
    for (let i = 0; i < L; i++) re[i] = x[s + i] * w[i]
    fft(re, im)
    for (let k = 0; k <= half; k++) {
      const p = re[k] * re[k] + im[k] * im[k]
      const fold = k === 0 || k === half ? 1 : 2
      psd[k] += (fold * p) / (sampleRate * u)
    }
    used++
  }
  if (used > 0) for (let k = 0; k <= half; k++) psd[k] /= used
  return { freqs, psd, df: sampleRate / L, segments: used, n: L, overlap: ov, window }
}

/** Mean and variance of an estimate over a band, for the scatter comparisons. */
export function bandStats({ freqs, psd }, from, to) {
  let n = 0
  let sum = 0
  let sum2 = 0
  for (let k = 0; k < freqs.length; k++) {
    if (freqs[k] < from || freqs[k] > to) continue
    n++
    sum += psd[k]
    sum2 += psd[k] * psd[k]
  }
  const mean = n ? sum / n : 0
  const variance = n > 1 ? sum2 / n - mean * mean : 0
  return { n, mean, variance, cv: mean > 0 ? Math.sqrt(Math.max(0, variance)) / mean : 0 }
}

/**
 * Levinson-Durbin: the order-p all-pole model of a sequence, from its
 * autocorrelation.
 *
 * Returns `{ a, sigma2, reflection }` where a[0] is 1 and the prediction filter
 * is 1 + a[1] z^-1 + ... + a[p] z^-p. Each step adds one pole and reduces the
 * prediction error by the factor (1 - k^2), so the error is monotone in the
 * order and the reflection coefficients are all inside the unit interval. A
 * model built this way is always stable, which is the reason this recursion is
 * used rather than a general least squares.
 */
export function levinson(r, order) {
  const p = Math.max(1, Math.round(order))
  const a = new Float64Array(p + 1)
  const reflection = new Float64Array(p)
  a[0] = 1
  let err = r[0]
  if (!(err > 0)) return { a, sigma2: 0, reflection, singular: true }
  for (let m = 1; m <= p; m++) {
    let acc = r[m]
    for (let i = 1; i < m; i++) acc += a[i] * r[m - i]
    const k = -acc / err
    reflection[m - 1] = k
    const prev = Float64Array.from(a.subarray(0, m))
    for (let i = 1; i < m; i++) a[i] = prev[i] + k * prev[m - i]
    a[m] = k
    err *= 1 - k * k
    if (!(err > 0)) return { a, sigma2: Math.max(0, err), reflection, singular: true }
  }
  return { a, sigma2: err, reflection, singular: false }
}

/**
 * An autoregressive model of `x` by the Yule-Walker equations.
 *
 * The biased autocorrelation is used, which is what makes the Toeplitz matrix
 * positive definite and the resulting model stable at any order. The unbiased
 * estimate has lower bias and can produce an unstable model, which is a real
 * trade and is named here rather than hidden.
 */
export function arYuleWalker(x, order) {
  const p = Math.max(1, Math.round(order))
  const r = new Float64Array(p + 1)
  for (let k = 0; k <= p; k++) {
    let acc = 0
    for (let i = k; i < x.length; i++) acc += x[i] * x[i - k]
    r[k] = acc / x.length
  }
  return { ...levinson(r, p), r, order: p }
}

/**
 * The power spectral density of an AR model, on the frequencies given.
 *
 *   P(f) = sigma2 / (fs |A(e^{j2 pi f/fs})|^2)
 *
 * Doubled below Nyquist to match the one-sided convention the estimators above
 * use, so the two can be plotted on one axis and compared without a fudge.
 */
export function arSpectrum({ a, sigma2 }, freqs, sampleRate) {
  const out = new Float64Array(freqs.length)
  for (let i = 0; i < freqs.length; i++) {
    const w = (2 * Math.PI * freqs[i]) / sampleRate
    let re = 0
    let im = 0
    for (let k = 0; k < a.length; k++) {
      re += a[k] * Math.cos(k * w)
      im -= a[k] * Math.sin(k * w)
    }
    const d = re * re + im * im
    const fold = freqs[i] <= 0 || freqs[i] >= sampleRate / 2 ? 1 : 2
    out[i] = d > 0 ? (fold * sigma2) / (sampleRate * d) : Infinity
  }
  return out
}

/**
 * The order-selection criteria, so the choice of p is a measurement rather than
 * a preference.
 *
 * Both add a penalty for parameters to the log of the prediction error. Akaike's
 * is 2p/N and the minimum description length's is p ln(N)/N, so the MDL is more
 * severe and picks a lower order on the same data. Returning both, with the
 * order each one selects, makes the disagreement visible.
 */
export function arOrderCriteria(x, maxOrder) {
  const rows = []
  for (let p = 1; p <= maxOrder; p++) {
    const m = arYuleWalker(x, p)
    const N = x.length
    const ln = Math.log(Math.max(1e-300, m.sigma2))
    rows.push({ order: p, sigma2: m.sigma2, aic: ln + (2 * p) / N, mdl: ln + (p * Math.log(N)) / N })
  }
  const pick = (key) => rows.reduce((a, b) => (b[key] < a[key] ? b : a), rows[0]).order
  return { rows, aicOrder: pick('aic'), mdlOrder: pick('mdl') }
}

/**
 * What a radix-2 FFT of length N costs, against the sum it replaces.
 *
 * The direct sum is N^2 complex multiplies. The transform splits into log2(N)
 * stages of N/2 butterflies, each one complex multiply, so it costs
 * (N/2) log2(N). The ratio is 2N/log2(N), and at N = 1024 that is 205, which is
 * the number the FFT group opens on.
 */
export function fftCost(n) {
  const N = pow2(Math.max(2, Math.round(n)))
  const stages = Math.round(Math.log2(N))
  return {
    n: N,
    stages,
    butterflies: (N / 2) * stages,
    direct: N * N,
    ratio: (N * N) / ((N / 2) * stages),
  }
}

/**
 * The bit-reversal permutation of length N, as the index each position takes.
 *
 * The decimation-in-time transform reads its input in this order and writes its
 * output in natural order. The permutation is its own inverse, and applying it
 * twice returns the identity, which is what the test checks.
 */
export function bitReversal(n) {
  const N = pow2(Math.max(2, Math.round(n)))
  const bits = Math.round(Math.log2(N))
  const out = new Uint32Array(N)
  for (let i = 0; i < N; i++) {
    let r = 0
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b)
    out[i] = r
  }
  return out
}

/**
 * One radix-2 butterfly, written out so a lesson can step through it.
 *
 *   X = a + W b,   Y = a - W b,   W = e^{-j 2 pi k / N}
 *
 * Two complex additions and one complex multiply produce two outputs, which is
 * the whole of the transform repeated (N/2) log2(N) times.
 */
export function butterfly(a, b, k, n) {
  const ang = (-2 * Math.PI * k) / n
  const wr = Math.cos(ang)
  const wi = Math.sin(ang)
  const tr = b[0] * wr - b[1] * wi
  const ti = b[0] * wi + b[1] * wr
  return {
    x: [a[0] + tr, a[1] + ti],
    y: [a[0] - tr, a[1] - ti],
    twiddle: [wr, wi],
  }
}

/** The direct sum, for the FFT group's comparison against the transform. */
export function dft(re, im) {
  const n = re.length
  const outRe = new Float64Array(n)
  const outIm = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    let sr = 0
    let si = 0
    for (let t = 0; t < n; t++) {
      const ang = (-2 * Math.PI * k * t) / n
      const c = Math.cos(ang)
      const s = Math.sin(ang)
      sr += re[t] * c - im[t] * s
      si += re[t] * s + im[t] * c
    }
    outRe[k] = sr
    outIm[k] = si
  }
  return { re: outRe, im: outIm }
}
