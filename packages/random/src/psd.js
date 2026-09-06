// The periodogram, and the averaged periodogram that makes it usable.
//
// One periodogram frame of white noise is not a flat line. It is a flat line
// times a chi-square with two degrees of freedom, so each bin's estimate has a
// standard deviation equal to its own mean and the picture is spray. That is
// the first thing this lab has to show, and the second is the fix: average M
// independent frames and the relative spread falls as `1/sqrt(M)`.
//
// Both statements are exact, not empirical. The periodogram of Gaussian white
// noise at bin k is `S * chi^2_2 / 2`, the average of M of them is
// `S * chi^2_2M / (2M)`, and the interval this module returns is that
// chi-square interval. `psd.test.js` measures the coverage rather than assuming
// it.
//
// Units. `psd` is signal units squared per hertz, one-sided, so integrating it
// from zero to `sampleRate/2` returns the variance. `asd` is its square root,
// signal units per root hertz, which is the unit an Electronics noise pane
// prints. Group O of the Electronics Lab calls `averagedPeriodogram` and reads
// `asd`, `integral` and `ci`, and the shape below is fixed for that caller.

import { fft, windowFn } from '@ee-labs/dsp'
import { chi2Inv } from './dist.js'

/**
 * The periodogram of one frame.
 *
 * @param {ArrayLike<number>} x   one frame. Any length; a power of two is fastest.
 * @param {number} sampleRate     hertz
 * @param {object} [opts]
 * @param {string} [opts.window='none']  a window name from `@ee-labs/dsp`
 * @param {boolean} [opts.removeMean=false]
 *
 * @returns {{ freqs, psd, asd, df, window, n }}
 *
 * The window's power is divided out, not its coherent gain. A periodogram
 * measures power per hertz, so the normaliser is `sum(w^2)`. Dividing by
 * `sum(w)^2` instead, which is what an amplitude spectrum does, would read a
 * Hann-windowed white floor 1.76 dB low.
 */
export function periodogram(x, sampleRate, opts = {}) {
  const { window = 'none', removeMean = false } = opts
  const n = x.length
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new Error(`periodogram: frame length must be a power of two, got ${n}`)
  }
  const w = windowFn(window, n)
  let mu = 0
  if (removeMean) {
    for (let i = 0; i < n; i++) mu += x[i]
    mu /= n
  }
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  let wpow = 0
  for (let i = 0; i < n; i++) {
    re[i] = (x[i] - mu) * w[i]
    wpow += w[i] * w[i]
  }
  fft(re, im)
  const half = n / 2
  const freqs = new Float64Array(half + 1)
  const psd = new Float64Array(half + 1)
  const asd = new Float64Array(half + 1)
  const norm = sampleRate * wpow
  for (let k = 0; k <= half; k++) {
    freqs[k] = (k * sampleRate) / n
    const fold = k === 0 || k === half ? 1 : 2
    psd[k] = (fold * (re[k] * re[k] + im[k] * im[k])) / norm
    asd[k] = Math.sqrt(psd[k])
  }
  return { freqs, psd, asd, df: sampleRate / n, window, n }
}

/**
 * The correlation between the periodograms of two segments `d` samples apart,
 * for a given window, under a white input.
 *
 * `rho_d = |sum w[i] w[i+d]|^2 / (sum w^2)^2`. Non-overlapping segments give
 * zero and the averaged periodogram then has exactly `2M` degrees of freedom.
 * Overlapping segments are correlated, they carry fewer degrees of freedom than
 * their count suggests, and this is the number that says how many fewer.
 */
export function overlapCorrelation(w, d) {
  if (d >= w.length) return 0
  let num = 0
  let den = 0
  for (let i = 0; i < w.length; i++) den += w[i] * w[i]
  for (let i = 0; i + d < w.length; i++) num += w[i] * w[i + d]
  return den === 0 ? 0 : (num * num) / (den * den)
}

/**
 * The averaged periodogram.
 *
 * The record is cut into `segments` frames of `segment` samples, each is
 * transformed, and the frames are averaged bin by bin. With no overlap the
 * frames are independent, the estimate at each bin is `S * chi^2_2M / (2M)`,
 * and the interval returned is that chi-square interval exactly.
 *
 * With overlap the frames share samples and are correlated, so the effective
 * degrees of freedom are fewer than `2M`. `dof` is then computed from the
 * window's own overlap correlation, under the white-Gaussian hypothesis, and
 * `dofExact` is false to say the interval rests on that hypothesis. This is the
 * one approximation in the file, and `dofExact` is its guard.
 *
 * @param {ArrayLike<number>} x
 * @param {number} sampleRate
 * @param {object} [opts]
 * @param {number} [opts.segment=256]     samples per frame, a power of two
 * @param {number} [opts.overlap=0]       fraction in [0, 0.9]
 * @param {string} [opts.window='hann']
 * @param {number} [opts.level=0.95]
 *
 * @returns {{
 *   freqs, psd, asd, ci: Array<[lo, hi]>, relativeSe,
 *   segments, dof, dofExact, df, level, window, segment,
 *   integral: number, flatness: number, band: [number, number], interior
 * }}
 *   `integral` is the variance the density accounts for, by the trapezoid rule
 *   over `band`. `flatness` is the relative standard deviation of the estimate
 *   across bins, which for a genuinely flat spectrum estimates `sqrt(2/dof)`.
 *
 * `flatness` is measured over the interior bins, and `interior` gives the range
 * it used. The two end bins are excluded for a reason worth stating on the pane
 * rather than hiding. A one-sided density doubles every bin that has a mirror
 * partner at a negative frequency, and DC and Nyquist have none, so they are not
 * doubled. Their periodogram estimate therefore sits at half the flat level and
 * carries half the degrees of freedom. Including them in a spread across bins
 * puts two half-height outliers into a 129-bin sample, which at 256 averages
 * doubles the measured variance and makes the estimator look 41 % worse than it
 * is. The end bins are still returned, still plotted and still in `integral`.
 * They are excluded from this one statistic, which is a statement about the rest.
 */
export function averagedPeriodogram(x, sampleRate, opts = {}) {
  const { segment = 256, overlap = 0, window = 'hann', level = 0.95, removeMean = false } = opts
  if (segment < 2 || (segment & (segment - 1)) !== 0) {
    throw new Error(`averagedPeriodogram: segment must be a power of two, got ${segment}`)
  }
  if (!(overlap >= 0 && overlap <= 0.9)) {
    throw new Error(`averagedPeriodogram: overlap must be in [0, 0.9], got ${overlap}`)
  }
  const step = Math.max(1, Math.round(segment * (1 - overlap)))
  const M = Math.floor((x.length - segment) / step) + 1
  if (M < 1) {
    throw new Error(
      `averagedPeriodogram: ${x.length} samples hold no ${segment}-sample segment`,
    )
  }
  const half = segment / 2
  const psd = new Float64Array(half + 1)
  let freqs = null
  for (let s = 0; s < M; s++) {
    const from = s * step
    const frame = new Float64Array(segment)
    for (let i = 0; i < segment; i++) frame[i] = x[from + i]
    const p = periodogram(frame, sampleRate, { window, removeMean })
    if (!freqs) freqs = p.freqs
    for (let k = 0; k <= half; k++) psd[k] += p.psd[k]
  }
  for (let k = 0; k <= half; k++) psd[k] /= M

  const w = windowFn(window, segment)
  let dof = 2 * M
  let dofExact = true
  if (step < segment) {
    let corr = 0
    for (let j = 1; j < M; j++) corr += (1 - j / M) * overlapCorrelation(w, j * step)
    dof = (2 * M) / (1 + 2 * corr)
    dofExact = false
  }

  const asd = new Float64Array(half + 1)
  const ci = []
  const loF = dof / chi2Inv(1 - (1 - level) / 2, dof)
  const hiF = dof / chi2Inv((1 - level) / 2, dof)
  for (let k = 0; k <= half; k++) {
    asd[k] = Math.sqrt(psd[k])
    ci.push([psd[k] * loF, psd[k] * hiF])
  }

  const df = sampleRate / segment
  // The bins that carry the full `dof`. See the note on `flatness` above.
  const interior = [1, half - 1]
  return {
    freqs,
    psd,
    asd,
    ci,
    interior,
    // The relative standard deviation the chi-square predicts for one bin.
    relativeSe: Math.sqrt(2 / dof),
    segments: M,
    dof,
    dofExact,
    df,
    level,
    window,
    segment,
    overlap,
    band: [0, sampleRate / 2],
    integral: integratePsd({ freqs, psd }),
    flatness: relativeSpread(psd.subarray(interior[0], interior[1] + 1)),
  }
}

/**
 * The variance a one-sided density accounts for, by the trapezoid rule over a
 * band. With no band it integrates the whole density, and the answer is the
 * process variance.
 *
 * The trapezoid rule is exact for a density that is flat or linear between
 * bins, which is the case for the white and first-order spectra the lab pins.
 * For a sharp resonance it is not, and the error is a function of the bin
 * spacing that a lesson can measure by halving the spacing.
 */
export function integratePsd({ freqs, psd }, band) {
  const lo = band ? band[0] : freqs[0]
  const hi = band ? band[1] : freqs[freqs.length - 1]
  let acc = 0
  for (let k = 0; k + 1 < freqs.length; k++) {
    const f0 = freqs[k]
    const f1 = freqs[k + 1]
    if (f1 <= lo || f0 >= hi) continue
    const a = Math.max(f0, lo)
    const b = Math.min(f1, hi)
    const t = (v) => psd[k] + ((psd[k + 1] - psd[k]) * (v - f0)) / (f1 - f0)
    acc += 0.5 * (t(a) + t(b)) * (b - a)
  }
  return acc
}

/** The standard deviation of a buffer divided by its mean. */
export function relativeSpread(y) {
  let m = 0
  for (let i = 0; i < y.length; i++) m += y[i]
  m /= y.length
  if (m === 0) return 0
  let ss = 0
  for (let i = 0; i < y.length; i++) ss += (y[i] - m) * (y[i] - m)
  return Math.sqrt(ss / (y.length - 1)) / m
}

/**
 * White noise's one-sided density, from its variance.
 * `S = 2 sigma^2 / f_s`, so that the integral to `f_s/2` is `sigma^2`.
 */
export function whitePsd(variance, sampleRate) {
  return (2 * variance) / sampleRate
}

/**
 * The output density of a filter driven by a known input density.
 *
 * `S_out(f) = |H(f)|^2 S_in(f)`. The identity is exact for a linear
 * time-invariant filter and a wide-sense stationary input, and it is presented
 * with no hedge (CORE_SCOPE counter-rule).
 *
 * @param {Float64Array} psdIn
 * @param {(f:number)=>number} magnitude  |H(f)|, not in decibels
 */
export function filteredPsd(freqs, psdIn, magnitude) {
  const out = new Float64Array(psdIn.length)
  for (let k = 0; k < psdIn.length; k++) {
    const h = magnitude(freqs[k])
    out[k] = h * h * psdIn[k]
  }
  return out
}
