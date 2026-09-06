// Autocorrelation, and its exact partner the power spectral density.
//
// The Wiener-Khinchin theorem is a statement about a process: the power
// spectral density is the Fourier transform of the autocorrelation function.
// On a finite record it is also an identity about arithmetic, and this module
// is built around that identity rather than around an approximation to it.
//
// The identity: the **biased** autocorrelation estimate of an N-sample record,
// divided by N rather than by the number of overlapping terms, has a discrete
// Fourier transform exactly equal to `|X[k]|^2 / N`, which is the periodogram.
// The unbiased estimate does not, and its transform can go negative, which
// would be a power spectral density with negative power in it. So the biased
// estimate is the default here, and `psd.js` and this file agree to floating
// point rather than to a tolerance. `corr.test.js` measures that.

import { fft } from '@ee-labs/dsp'

/**
 * The autocorrelation estimate of a record.
 *
 * @param {ArrayLike<number>} x
 * @param {number} maxLag  lags 0..maxLag are returned. Defaults to N-1.
 * @param {object} [opts]
 * @param {boolean} [opts.biased=true]      divide by N, not by N-m
 * @param {boolean} [opts.removeMean=true]  subtract the sample mean first
 *
 * @returns {{ lags: Float64Array, r: Float64Array, r0: number,
 *             normalised: Float64Array, biased: boolean, n: number }}
 *   `r[m]` is in signal units squared. `normalised[m]` is `r[m]/r[0]`, which is
 *   1 at zero lag and is what a plot of correlation against lag shows.
 */
export function autocorrelation(x, maxLag, opts = {}) {
  const { biased = true, removeMean = true } = opts
  const n = x.length
  const M = Math.min(maxLag === undefined ? n - 1 : maxLag, n - 1)
  let mu = 0
  if (removeMean) {
    for (let i = 0; i < n; i++) mu += x[i]
    mu /= n
  }
  const r = new Float64Array(M + 1)
  const lags = new Float64Array(M + 1)
  for (let m = 0; m <= M; m++) {
    let acc = 0
    for (let i = 0; i < n - m; i++) acc += (x[i] - mu) * (x[i + m] - mu)
    r[m] = acc / (biased ? n : n - m)
    lags[m] = m
  }
  const normalised = new Float64Array(M + 1)
  for (let m = 0; m <= M; m++) normalised[m] = r[0] === 0 ? 0 : r[m] / r[0]
  return { lags, r, r0: r[0], normalised, biased, n }
}

/**
 * The one-sided power spectral density from a two-sided autocorrelation, by
 * Wiener-Khinchin.
 *
 * `r` holds lags 0..M as `autocorrelation` returns them, and the sequence is
 * mirrored here because a real process has an even autocorrelation. The
 * transform length is the next power of two at or above `2M + 1`, so the
 * mirrored sequence wraps without folding a lag onto another lag.
 *
 * @returns {{ freqs, psd, nfft }}  `psd` in signal units squared per hertz.
 */
export function psdFromAcf(r, sampleRate, opts = {}) {
  const M = r.length - 1
  const need = 2 * M + 1
  let nfft = opts.nfft || 1
  while (nfft < need) nfft *= 2
  if (nfft < need) throw new Error(`psdFromAcf: nfft ${nfft} is shorter than ${need}`)
  const re = new Float64Array(nfft)
  const im = new Float64Array(nfft)
  re[0] = r[0]
  for (let m = 1; m <= M; m++) {
    re[m] = r[m]
    re[nfft - m] = r[m]
  }
  fft(re, im)
  const half = nfft / 2
  const freqs = new Float64Array(half + 1)
  const psd = new Float64Array(half + 1)
  for (let k = 0; k <= half; k++) {
    freqs[k] = (k * sampleRate) / nfft
    const fold = k === 0 || k === half ? 1 : 2
    // The transform of an even real sequence is real. The imaginary part is
    // rounding, and dropping it is not an approximation, so no guard is stated.
    psd[k] = (fold * re[k]) / sampleRate
  }
  return { freqs, psd, nfft }
}

/**
 * The autocorrelation from a one-sided power spectral density: the other
 * direction of the same theorem.
 *
 * @returns {Float64Array} lags 0..maxLag in signal units squared.
 */
export function acfFromPsd(psd, sampleRate, maxLag) {
  const half = psd.length - 1
  const nfft = 2 * half
  const df = sampleRate / nfft
  const M = Math.min(maxLag === undefined ? half : maxLag, nfft - 1)
  const r = new Float64Array(M + 1)
  for (let m = 0; m <= M; m++) {
    // Every bin carries weight one, including DC and Nyquist. The one-sided
    // density already doubled the bins between them, and the two bins with no
    // mirror partner were left alone, so the folding cancels exactly here.
    let acc = 0
    for (let k = 0; k <= half; k++) {
      acc += psd[k] * Math.cos((2 * Math.PI * k * m) / nfft) * df
    }
    r[m] = acc
  }
  return r
}

/**
 * The cross-correlation of `x` with `y`, lags 0..maxLag, biased.
 * Used by the Wiener filter's right-hand side.
 */
export function crossCorrelation(x, y, maxLag, opts = {}) {
  const { removeMean = false } = opts
  const n = Math.min(x.length, y.length)
  let mx = 0
  let my = 0
  if (removeMean) {
    for (let i = 0; i < n; i++) {
      mx += x[i]
      my += y[i]
    }
    mx /= n
    my /= n
  }
  const M = Math.min(maxLag, n - 1)
  const p = new Float64Array(M + 1)
  for (let m = 0; m <= M; m++) {
    let acc = 0
    for (let i = 0; i < n - m; i++) acc += (x[i] - mx) * (y[i + m] - my)
    p[m] = acc / n
  }
  return p
}
