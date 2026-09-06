// The channels, and their three different standings under CORE_SCOPE.
//
//   AWGN       exact arithmetic on a seeded sequence. What is estimated is the
//              error rate, not the channel, and `ber.js` carries that guard.
//   Multipath  a tapped delay line, exactly rational in z. Admitted in full,
//              and its response, zeros and group delay come from `dsp`.
//   Fading     a labelled statistical model. It is neither exact nor guarded by
//              a threshold, so it prints its three assumptions instead.

import { rng } from '@ee-labs/random'
import { at, put, cmul } from './chain.js'

/**
 * The noise variance one dimension carries, from Eb/N0 and the constellation.
 *
 * The symbols have unit mean square, so `Es = 1` and `Eb = 1 / bits`. Then
 * `N0 = Eb / gamma_b` and each dimension carries `N0 / 2`. At `sps` samples a
 * symbol the same total noise is spread over `sps` samples, so the per-sample
 * variance is `sps` times larger and the matched filter takes it back out.
 */
export function noiseVariance({ ebN0Db, bitsPerSymbol, sps = 1 }) {
  const gammaB = 10 ** (ebN0Db / 10)
  const n0 = 1 / (bitsPerSymbol * gammaB)
  return { n0, sigma2: (n0 / 2) * sps, sigma: Math.sqrt((n0 / 2) * sps) }
}

/**
 * Additive white Gaussian noise at a stated Eb/N0.
 *
 * Two independent Gaussian samples per complex sample, from the seeded
 * generator in `@ee-labs/random`. The same seed gives the same waveform in the
 * scope buffer and in the bit error count, so a reader can check one against
 * the other.
 */
export function awgn(syms, { ebN0Db, bitsPerSymbol, sps = 1, seed = 1 }) {
  const { n0, sigma, sigma2 } = noiseVariance({ ebN0Db, bitsPerSymbol, sps })
  const r = rng(seed)
  const out = new Float64Array(syms.length)
  for (let i = 0; i < syms.length; i++) out[i] = syms[i] + r.normal(0, sigma)
  return { out, sigma, sigma2, n0 }
}

/**
 * A tapped delay line over interleaved complex samples.
 * `taps` is interleaved as well, so an echo may carry a phase.
 */
export function multipath(syms, taps) {
  const n = syms.length / 2
  const m = taps.length / 2
  const out = new Float64Array(syms.length)
  for (let i = 0; i < n; i++) {
    let re = 0
    let im = 0
    for (let k = 0; k < m; k++) {
      if (i - k < 0) continue
      const s = at(syms, i - k)
      const t = [taps[2 * k], taps[2 * k + 1]]
      const p = cmul(s, t)
      re += p[0]
      im += p[1]
    }
    put(out, i, re, im)
  }
  return out
}

/**
 * The two-ray channel of the plan's §4.3, as interleaved taps.
 * One direct path and one echo of amplitude `a`, `delay` samples late.
 */
export function twoRay(a = 0.5, delay = 4) {
  const taps = new Float64Array(2 * (delay + 1))
  taps[0] = 1
  taps[2 * delay] = a
  return taps
}

/** Real taps as an interleaved set, for the places a real kernel is wanted. */
export function realTaps(values) {
  const out = new Float64Array(2 * values.length)
  for (let i = 0; i < values.length; i++) out[2 * i] = values[i]
  return out
}

/** The real part of an interleaved tap set, which is what `dsp` takes. */
export function tapsReal(taps) {
  const out = new Float64Array(taps.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = taps[2 * i]
  return out
}

/** `H(f)` of an interleaved tap set at one frequency. */
export function channelAt(taps, f, sampleRate) {
  const m = taps.length / 2
  let re = 0
  let im = 0
  for (let k = 0; k < m; k++) {
    const w = (-2 * Math.PI * f * k) / sampleRate
    const c = Math.cos(w)
    const s = Math.sin(w)
    re += taps[2 * k] * c - taps[2 * k + 1] * s
    im += taps[2 * k] * s + taps[2 * k + 1] * c
  }
  return [re, im]
}

/**
 * The magnitude response of a tap set, with its notch depth and spacing.
 *
 * For a two-ray channel `|H(f)|^2 = 1 + a^2 + 2a cos(2 pi f tau)`, so the peak
 * is `1 + a` and the notch is `1 - a`. The notches repeat every `fs / delay`,
 * and the first sits at half that.
 */
export function channelResponse(taps, sampleRate, points = 481) {
  const freqs = new Float64Array(points)
  const mag = new Float64Array(points)
  let peak = 0
  let notch = Infinity
  for (let i = 0; i < points; i++) {
    const f = (i * sampleRate) / 2 / (points - 1)
    freqs[i] = f
    const h = channelAt(taps, f, sampleRate)
    const m = Math.hypot(h[0], h[1])
    mag[i] = m
    if (m > peak) peak = m
    if (m < notch) notch = m
  }
  // The delay of the last non-zero tap sets the notch spacing.
  let delay = 0
  for (let k = taps.length / 2 - 1; k > 0; k--) {
    if (Math.abs(taps[2 * k]) > 1e-15 || Math.abs(taps[2 * k + 1]) > 1e-15) {
      delay = k
      break
    }
  }
  const spacing = delay > 0 ? sampleRate / delay : Infinity
  return {
    freqs,
    mag,
    peak,
    notch,
    peakDb: 20 * Math.log10(peak),
    notchDb: 20 * Math.log10(notch),
    notchSpacing: spacing,
    firstNotch: delay > 0 ? spacing / 2 : Infinity,
    coherenceBandwidth: delay > 0 ? sampleRate / delay / 2 : Infinity,
  }
}

/** The three assumptions the fading pane prints, from the plan's §2.4. */
export const FADING_ASSUMPTIONS = [
  'Many scattered paths of similar strength reach the receiver.',
  'No path has a direct line of sight.',
  'The channel holds still for longer than one symbol.',
]

/**
 * Flat fading gains, one complex Gaussian a symbol.
 *
 * A labelled statistical model, and the only object in this lab that is neither
 * exact nor guarded by a threshold. What the model predicts is checked against
 * its own closed form, and the label travels with the numbers.
 */
export function rayleighGains(n, { seed = 1, kFactor = 0 } = {}) {
  const r = rng(seed)
  const gains = new Float64Array(2 * n)
  // Unit mean square overall. A Rician channel puts `k / (1 + k)` of the power
  // in the fixed path and the rest in the scatter.
  const fixed = Math.sqrt(kFactor / (1 + kFactor))
  const spread = Math.sqrt(1 / (1 + kFactor) / 2)
  let ms = 0
  for (let i = 0; i < n; i++) {
    const re = fixed + r.normal(0, spread)
    const im = r.normal(0, spread)
    gains[2 * i] = re
    gains[2 * i + 1] = im
    ms += re * re + im * im
  }
  return {
    gains,
    meanSquare: ms / n,
    kFactor,
    model: kFactor > 0 ? 'Rician' : 'Rayleigh',
    assumptions: FADING_ASSUMPTIONS,
  }
}

/** Apply one gain per symbol to an interleaved symbol stream. */
export function applyFading(syms, gains) {
  const n = syms.length / 2
  const out = new Float64Array(syms.length)
  for (let i = 0; i < n; i++) {
    const p = cmul(at(syms, i), [gains[2 * i], gains[2 * i + 1]])
    put(out, i, p[0], p[1])
  }
  return out
}

/**
 * The average bit error rate of BPSK under flat Rayleigh fading.
 * `0.5 (1 - sqrt(gbar / (1 + gbar)))`, the closed form of the model above.
 */
export function rayleighBer(ebN0Db) {
  const g = 10 ** (ebN0Db / 10)
  return 0.5 * (1 - Math.sqrt(g / (1 + g)))
}

/** The Eb/N0 in dB a faded link needs for a given rate. */
export function rayleighThreshold(target) {
  let lo = -10
  let hi = 80
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2
    if (rayleighBer(m) > target) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}
