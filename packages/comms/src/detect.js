// The matched filter, and the three detectors.
//
// The claim this file makes is the one the Random Signals Lab proves and this
// lab measures. The output signal-to-noise ratio of a filter matched to a pulse
// of energy E in noise of density N0/2 is `2E/N0`, whatever the pulse shape is.
// `matchedFilterSnr` measures it by simulation and returns the interval the
// measurement carries, so the comparison is between an estimate and a form
// rather than between two numbers of unstated standing.

import { rng, energy, sampleMean, sampleVariance, qFunction } from '@ee-labs/random'
import { constellation, decide } from './mappers.js'
import { at } from './chain.js'

/**
 * Correlate an interleaved stream against the transmit pulse and sample once a
 * symbol. The kernel is symmetric, so its group delay is `(N - 1) / 2` and the
 * first symbol instant sits there.
 */
export function matchedSample(rx, h, sps, offset = 0) {
  const n = rx.length / 2
  const nh = h.length
  const delay = (nh - 1) / 2
  const out = []
  for (let s = 0; ; s++) {
    const centre = Math.round(2 * delay + s * sps + offset * sps)
    if (centre >= n) break
    let re = 0
    let im = 0
    for (let k = 0; k < nh; k++) {
      const i = centre - k
      if (i < 0 || i >= n) continue
      const v = at(rx, i)
      re += h[k] * v[0]
      im += h[k] * v[1]
    }
    out.push(re, im)
  }
  return Float64Array.from(out)
}

/** The three pulse shapes the matched-filter measurement is run over. */
export const PULSES = {
  rect: (n) => new Float64Array(n).fill(1 / Math.sqrt(n)),
  halfSine: (n) => {
    const h = new Float64Array(n)
    for (let i = 0; i < n; i++) h[i] = Math.sin((Math.PI * (i + 0.5)) / n)
    let e = 0
    for (const v of h) e += v * v
    const s = 1 / Math.sqrt(e)
    for (let i = 0; i < n; i++) h[i] *= s
    return h
  },
  ramp: (n) => {
    const h = new Float64Array(n)
    for (let i = 0; i < n; i++) h[i] = (i + 1) / n
    let e = 0
    for (const v of h) e += v * v
    const s = 1 / Math.sqrt(e)
    for (let i = 0; i < n; i++) h[i] *= s
    return h
  },
}

/**
 * The matched filter's output ratio, measured against `2E/N0`.
 *
 * The pulse is sent, noise of density `N0/2` a dimension is added, the filter
 * correlates and the output is read once. Over `trials` runs the mean and the
 * variance of that reading are estimates and come back with their intervals.
 * The ratio of the squared mean to the variance is the measured signal-to-noise
 * ratio, and `2E/N0` is what it is compared against.
 */
export function matchedFilterSnr({ pulse = 'rect', length = 64, n0 = 0.05, trials = 20000, seed = 1, mismatch = null }) {
  const s = typeof pulse === 'string' ? PULSES[pulse](length) : pulse
  const e = energy(s)
  const h = mismatch ? (typeof mismatch === 'string' ? PULSES[mismatch](length) : mismatch) : s
  // The correlator's gain on the signal, and on the noise.
  let gain = 0
  let hh = 0
  for (let i = 0; i < s.length; i++) {
    gain += h[i] * s[i]
    hh += h[i] * h[i]
  }
  const sigma = Math.sqrt(n0 / 2)
  const r = rng(seed)
  const out = new Float64Array(trials)
  for (let t = 0; t < trials; t++) {
    let y = 0
    for (let i = 0; i < s.length; i++) y += h[i] * (s[i] + r.normal(0, sigma))
    out[t] = y
  }
  const m = sampleMean(out)
  const v = sampleVariance(out)
  const measured = (m.value * m.value) / v.value
  return {
    mean: m,
    variance: v,
    measured,
    measuredDb: 10 * Math.log10(measured),
    twoEOverN0: (2 * e) / n0,
    twoEOverN0Db: 10 * Math.log10((2 * e) / n0),
    expectedMean: gain,
    expectedVariance: (hh * n0) / 2,
    energy: e,
    // The bound the Cauchy-Schwarz inequality sets: a mismatched filter cannot
    // do better, and its loss is this ratio.
    mismatchLoss: (gain * gain) / hh / e,
  }
}

/**
 * The per-bit log-likelihood ratio, which is what the Information Lab's
 * decoders read. An exact function of the received sample under the stated
 * noise variance, so it carries no hedge.
 *
 * The sign convention is the usual one. A positive value favours a zero, a
 * negative value favours a one, and the magnitude is how strongly. The metric
 * is the max-log form, which uses the nearest point carrying each value rather
 * than summing over all of them.
 */
export function softMetric(name, syms, sigma2) {
  const c = constellation(name)
  const n = syms.length / 2
  const out = new Float64Array(n * c.bits)
  for (let s = 0; s < n; s++) {
    const x = syms[2 * s]
    const y = syms[2 * s + 1]
    for (let b = 0; b < c.bits; b++) {
      let best0 = Infinity
      let best1 = Infinity
      for (let i = 0; i < c.size; i++) {
        const d = (x - c.points[2 * i]) ** 2 + (y - c.points[2 * i + 1]) ** 2
        const bit = (c.labels[i] >> (c.bits - 1 - b)) & 1
        if (bit === 0) best0 = Math.min(best0, d)
        else best1 = Math.min(best1, d)
      }
      // The max-log metric: the difference of the two nearest squared
      // distances, over twice the noise variance.
      out[s * c.bits + b] = (best1 - best0) / (2 * sigma2)
    }
  }
  return out
}

/** Binary orthogonal FSK, coherent. Its closed form is `Q(sqrt(gamma_b))`. */
export function fskCoherentBer(gammaB) {
  return qFunction(Math.sqrt(gammaB))
}

/** Binary orthogonal FSK, noncoherent. Its closed form is `0.5 e^{-gamma_b/2}`. */
export function fskNoncoherentBer(gammaB) {
  return 0.5 * Math.exp(-gammaB / 2)
}

/**
 * The correlation between two FSK tones over one symbol.
 *
 * The two tones sit either side of the carrier, and the correlation is the
 * integral of their product over one symbol, normalised by their energies. The
 * integral has two terms, one at the difference frequency and one at the sum.
 * The sum term vanishes whenever the carrier sits on the grid, so what is left
 * is `sin(2 pi df T) / (2 pi df T)`, which is zero at every multiple of half
 * the symbol rate. B7 reads that at 500 Hz and at 1000 Hz for a rate of 1000
 * symbols a second.
 */
export function toneCorrelation({ spacing, symbolRate = 1000, carrier = 2000 }) {
  const T = 1 / symbolRate
  const f1 = carrier - spacing / 2
  const f2 = carrier + spacing / 2
  const term = (f) => (f === 0 ? T : Math.sin(2 * Math.PI * f * T) / (2 * Math.PI * f))
  const dot = 0.5 * (term(f2 - f1) + term(f1 + f2))
  const en = (f) => T / 2 + (f === 0 ? T / 2 : Math.sin(4 * Math.PI * f * T) / (8 * Math.PI * f))
  return dot / Math.sqrt(en(f1) * en(f2))
}

/** Count how many received points fall outside their own decision region. */
export function outsideRegion(name, syms, sent) {
  const got = decide(name, syms)
  let k = 0
  for (let i = 0; i < got.length; i++) if (got[i] !== sent[i]) k++
  return { errors: k, n: got.length }
}
