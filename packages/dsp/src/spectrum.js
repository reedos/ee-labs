import { fft } from './fft.js'

// Analysis windows.
//
// A rectangular window (i.e. none) is only honest when the signal completes a
// whole number of cycles inside the frame. Otherwise the discontinuity at the
// frame edge smears energy across every bin — spectral leakage. Hann trades a
// wider main lobe for far lower side lobes, which is usually the better deal
// when you are trying to see what is actually present.

export const WINDOWS = ['hann', 'hamming', 'blackman', 'none']

export function windowFn(name, n) {
  const w = new Float64Array(n)
  // A one-point window is the degenerate [1] whatever its shape — the
  // symmetric formula's (n - 1) denominator would make it 0/0, and evaluating
  // a taper AT its endpoint would make it 0.
  if (n === 1) {
    w[0] = 1
    return w
  }
  for (let i = 0; i < n; i++) {
    const x = (2 * Math.PI * i) / (n - 1)
    switch (name) {
      case 'hann':
        w[i] = 0.5 - 0.5 * Math.cos(x)
        break
      case 'hamming':
        w[i] = 0.54 - 0.46 * Math.cos(x)
        break
      case 'blackman':
        w[i] = 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x)
        break
      case 'none':
        w[i] = 1
        break
      default:
        throw new Error(`unknown window: ${name}`)
    }
  }
  return w
}

/**
 * Single-sided amplitude spectrum of a real signal.
 *
 * Returns `{ freqs, amps }` where `amps[k]` is the amplitude in signal units
 * of the sinusoid at `freqs[k]` Hz. A pure sine of amplitude A placed exactly
 * on a bin centre reads back A, whatever window is applied — that is what the
 * coherent-gain division by sum(w) buys.
 *
 * Bins are doubled to fold the negative-frequency half back in, except DC and
 * Nyquist which have no mirror partner.
 */
export function spectrum(buf, sampleRate, windowName = 'hann') {
  const n = buf.length
  const w = windowFn(windowName, n)

  const re = new Float64Array(n)
  const im = new Float64Array(n)
  let coherentGain = 0
  for (let i = 0; i < n; i++) {
    re[i] = buf[i] * w[i]
    coherentGain += w[i]
  }

  fft(re, im)

  const half = n / 2
  const freqs = new Float64Array(half + 1)
  const amps = new Float64Array(half + 1)
  for (let k = 0; k <= half; k++) {
    const mag = Math.hypot(re[k], im[k])
    const fold = k === 0 || k === half ? 1 : 2
    freqs[k] = (k * sampleRate) / n
    amps[k] = (fold * mag) / coherentGain
  }
  return { freqs, amps }
}

/**
 * Two-sided amplitude spectrum of a COMPLEX signal, ordered -fs/2 to +fs/2.
 *
 * A complex baseband signal has no conjugate symmetry, so its spectrum is not
 * symmetric about zero: an LO frequency offset slides the whole thing sideways.
 * Taking the spectrum of the real part alone folds that into a misleadingly
 * symmetric picture.
 */
export function spectrumComplex(bufRe, bufIm, sampleRate, windowName = 'hann') {
  const n = bufRe.length
  const w = windowFn(windowName, n)
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  let coherentGain = 0
  for (let i = 0; i < n; i++) {
    re[i] = bufRe[i] * w[i]
    im[i] = bufIm[i] * w[i]
    coherentGain += w[i]
  }
  fft(re, im)

  const freqs = new Float64Array(n)
  const amps = new Float64Array(n)
  const half = n / 2
  for (let k = 0; k < n; k++) {
    // Rotate so negative frequencies come first and the array is monotonic,
    // which is what a plot needs.
    const src = (k + half) % n
    freqs[k] = ((k - half) * sampleRate) / n
    amps[k] = Math.hypot(re[src], im[src]) / coherentGain
  }
  return { freqs, amps }
}

/** Amplitude ratio to decibels, floored so log(0) cannot escape. */
export function toDb(amp, floorDb = -120) {
  if (amp <= 0) return floorDb
  const db = 20 * Math.log10(amp)
  return db < floorDb ? floorDb : db
}
