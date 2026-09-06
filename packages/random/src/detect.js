// Detection: the matched filter, its signal-to-noise ratio, and the error rate.
//
// The claim the group is built on: among all linear filters, the one matched to
// the pulse maximises the signal-to-noise ratio at the sampling instant, and the
// ratio it reaches is `2E/N0`, which depends on the pulse's energy and not on
// its shape. A square pulse and a raised-cosine pulse of the same energy detect
// equally well. That is a strong claim and an exact one, so it is pinned to
// floating point and printed with no hedge.
//
// Two currencies, one number. In discrete time the received sample is
// `s[n] + w[n]` with `var(w) = sigma^2`, and the output ratio is `Ed/sigma^2`
// with `Ed = sum s[n]^2`. In continuous time the same ratio is `2E/N0` with
// `E = Ed/f_s` and `N0 = 2 sigma^2/f_s`. Every function here takes and returns
// the discrete pair, and `snrIdentity` states the conversion so a test can pin
// that the two agree.

import { qFunction } from './dist.js'
import { proportion } from './estimate.js'
import { rng, runSeed } from './prng.js'

/** The energy of a discrete pulse, `sum s[n]^2`. */
export function energy(s) {
  let e = 0
  for (let i = 0; i < s.length; i++) e += s[i] * s[i]
  return e
}

/**
 * The matched filter's output: the correlation of `x` with the template `s`.
 *
 * Output sample `m` is `sum_n s[n] x[n+m]`, so the peak sits at the lag where
 * the pulse starts. This is the correlator form of the filter, which is the same
 * object as convolving with the time-reversed template and is easier to read
 * off a plot.
 */
export function matchedFilter(s, x) {
  const m = x.length - s.length + 1
  if (m < 1) throw new Error('matchedFilter: the record is shorter than the template')
  const y = new Float64Array(m)
  for (let k = 0; k < m; k++) {
    let acc = 0
    for (let n = 0; n < s.length; n++) acc += s[n] * x[k + n]
    y[k] = acc
  }
  return y
}

/**
 * The output signal-to-noise ratio of a filter `h` applied to pulse `s` in white
 * noise of variance `sigma2`, at the best sampling instant.
 *
 * `(sum h s)^2 / (sigma^2 sum h^2)`. The Cauchy-Schwarz inequality caps this at
 * `Ed/sigma^2` with equality only when `h` is proportional to `s`, which is the
 * optimality claim. `filterSnr` lets a lesson try a mismatched filter and watch
 * the ratio fall short.
 */
export function filterSnr(h, s, sigma2) {
  let hs = 0
  let hh = 0
  const n = Math.min(h.length, s.length)
  for (let i = 0; i < n; i++) hs += h[i] * s[i]
  for (let i = 0; i < h.length; i++) hh += h[i] * h[i]
  return (hs * hs) / (sigma2 * hh)
}

/**
 * The matched filter's own ratio, and the same number in continuous-time terms.
 *
 * @returns {{ snr, snrDb, energyDiscrete, energy, n0, sigma2, twoEOverN0 }}
 *   `twoEOverN0` is computed from `energy` and `n0` independently of `snr`, so a
 *   test compares two routes to the number rather than restating one of them.
 */
export function matchedSnr({ s, sigma2, sampleRate }) {
  const ed = energy(s)
  const snr = ed / sigma2
  const e = ed / sampleRate
  const n0 = (2 * sigma2) / sampleRate
  return {
    snr,
    snrDb: 10 * Math.log10(snr),
    energyDiscrete: ed,
    energy: e,
    n0,
    sigma2,
    sampleRate,
    twoEOverN0: (2 * e) / n0,
  }
}

/**
 * The error probability of an antipodal binary decision after the matched
 * filter: `Q(sqrt(2 Eb/N0))`.
 *
 * `ebN0` is the ratio itself, not decibels. `errorRateDb` takes decibels.
 */
export function errorRateAntipodal(ebN0) {
  return qFunction(Math.sqrt(2 * ebN0))
}

/**
 * The error probability of an on-off (orthogonal) decision: `Q(sqrt(Eb/N0))`.
 * Three decibels worse than antipodal at every point, because the two symbols
 * are half as far apart for the same average energy.
 */
export function errorRateOrthogonal(ebN0) {
  return qFunction(Math.sqrt(ebN0))
}

/** The same two, taking decibels. */
export const errorRateAntipodalDb = (db) => errorRateAntipodal(10 ** (db / 10))
export const errorRateOrthogonalDb = (db) => errorRateOrthogonal(10 ** (db / 10))

/**
 * A Monte Carlo detection run: send `symbols` antipodal symbols through the
 * pulse and the noise, detect each with the matched filter, and count the
 * errors.
 *
 * Returns the counted rate as a `proportion` with its Wilson interval, beside
 * the closed form. The lesson is the pair: the count wanders and the interval
 * holds it, and at high signal-to-noise the count reaches zero while the closed
 * form is still a positive number the interval must not exclude.
 *
 * @returns {{ measured, predicted, errors, symbols, snr, ebN0, ebN0Db }}
 */
export function detectionRun({ s, ebN0, symbols = 1000, seed = 1, level = 0.95 }) {
  const ed = energy(s)
  // Eb/N0 = Ed/(2 sigma^2) for a real antipodal symbol, so sigma^2 = Ed/(2 Eb/N0).
  const sigma2 = ed / (2 * ebN0)
  const sigma = Math.sqrt(sigma2)
  let errors = 0
  for (let k = 0; k < symbols; k++) {
    const r = rng(runSeed(seed, k))
    const bit = r.sign()
    let y = 0
    for (let n = 0; n < s.length; n++) y += s[n] * (bit * s[n] + r.normal(0, sigma))
    if (Math.sign(y) !== bit) errors++
  }
  return {
    measured: proportion(errors, symbols, { level }),
    predicted: errorRateAntipodal(ebN0),
    errors,
    symbols,
    snr: ed / sigma2,
    ebN0,
    ebN0Db: 10 * Math.log10(ebN0),
    sigma2,
  }
}

/** The pulses the detection group offers, each returned with unit energy. */
export const PULSES = {
  rect: (n) => {
    const s = new Float64Array(n).fill(1 / Math.sqrt(n))
    return s
  },
  halfSine: (n) => {
    const s = new Float64Array(n)
    let e = 0
    for (let i = 0; i < n; i++) {
      s[i] = Math.sin((Math.PI * (i + 0.5)) / n)
      e += s[i] * s[i]
    }
    const g = 1 / Math.sqrt(e)
    for (let i = 0; i < n; i++) s[i] *= g
    return s
  },
  ramp: (n) => {
    const s = new Float64Array(n)
    let e = 0
    for (let i = 0; i < n; i++) {
      s[i] = (i + 1) / n
      e += s[i] * s[i]
    }
    const g = 1 / Math.sqrt(e)
    for (let i = 0; i < n; i++) s[i] *= g
    return s
  },
}
