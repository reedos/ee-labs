// Estimators, each carrying its own interval.
//
// The house rule for this package: a function that returns a number computed
// from data returns an `Estimate`, never a bare number. An estimate without its
// interval is the one thing a probability lab must not ship, because the reader
// cannot tell a converged answer from a lucky draw. This is CORE_SCOPE Rule 3
// applied to statistics: the interval is the guard, and the pane prints it.
//
// The shape every estimator returns:
//
//   { value, variance, se, ci: [lo, hi], level, n }
//
//   value     the estimate
//   variance  the variance OF THE ESTIMATOR, not of the data
//   se        sqrt(variance), the standard error
//   ci        the two-sided interval at `level`
//   level     the coverage, 0.95 unless asked otherwise
//   n         the sample count the estimate rests on
//
// `variance` being the estimator's variance and not the data's is the
// distinction the lab is about, and naming it anything vaguer would lose it.

import { zFor } from './dist.js'

/**
 * Assemble an estimate from a value and the variance of the estimator.
 * The interval is `value +/- z*se`, which is the normal interval. It is the
 * right interval when the estimator is a sum of many terms, and `sampleMean`
 * and `welch` both are. Where it is not, the estimator below says so.
 */
export function estimate(value, variance, { level = 0.95, n = 0, ...rest } = {}) {
  const se = Math.sqrt(Math.max(0, variance))
  const z = zFor(level)
  return { value, variance, se, ci: [value - z * se, value + z * se], level, n, ...rest }
}

/** Arithmetic mean of a buffer. A number, not an estimate: no model, no interval. */
export function mean(x) {
  let s = 0
  for (let i = 0; i < x.length; i++) s += x[i]
  return s / x.length
}

/**
 * The sample mean and the variance of the sample mean.
 *
 * The headline result of the estimation half of the lab: for independent
 * samples, `var(xbar) = sigma^2 / N`. The estimator does not know sigma, so it
 * uses the unbiased sample variance in its place, and the interval it returns
 * is therefore itself a random quantity. That is not a defect, and the lab
 * measures it: over many ensembles the interval covers the true mean `level` of
 * the time, which is exactly what `level` claims.
 */
export function sampleMean(x, { level = 0.95 } = {}) {
  const n = x.length
  if (n < 2) throw new Error('sampleMean: need at least two samples')
  const m = mean(x)
  let ss = 0
  for (let i = 0; i < n; i++) {
    const d = x[i] - m
    ss += d * d
  }
  const s2 = ss / (n - 1)
  return estimate(m, s2 / n, { level, n, sampleVariance: s2 })
}

/**
 * The unbiased sample variance, and the variance of that estimator.
 *
 * `var(s^2) = 2 sigma^4 / (N-1)` holds for Gaussian data. For anything else the
 * fourth moment enters, so the estimator computes the general form
 * `(mu4 - (N-3)/(N-1) sigma^4) / N` from the sample's own fourth moment and
 * reports `gaussian: false` in that case. The returned `variance` is always the
 * general form. `gaussianVariance` is the Gaussian formula beside it, so a pane
 * can show both and the reader can see when they part.
 */
export function sampleVariance(x, { level = 0.95 } = {}) {
  const n = x.length
  if (n < 4) throw new Error('sampleVariance: need at least four samples')
  const m = mean(x)
  let m2 = 0
  let m4 = 0
  for (let i = 0; i < n; i++) {
    const d = x[i] - m
    m2 += d * d
    m4 += d * d * d * d
  }
  const s2 = m2 / (n - 1)
  const mu4 = m4 / n
  const v = (mu4 - ((n - 3) / (n - 1)) * s2 * s2) / n
  return estimate(s2, v, {
    level,
    n,
    gaussianVariance: (2 * s2 * s2) / (n - 1),
    kurtosis: mu4 / (s2 * s2),
  })
}

/**
 * A proportion `k` of `n`, with the Wilson score interval.
 *
 * The obvious interval, `phat +/- z sqrt(phat(1-phat)/n)`, collapses to zero
 * width at `k = 0`, which is precisely the case a detection experiment runs
 * into: zero errors in ten thousand symbols does not mean the error rate is
 * zero. Wilson's interval keeps a width there, and the lab's error-rate pane
 * needs that or it prints a false certainty at high SNR.
 */
export function proportion(k, n, { level = 0.95 } = {}) {
  if (n <= 0) throw new Error('proportion: n must be positive')
  const z = zFor(level)
  const p = k / n
  const d = 1 + (z * z) / n
  const centre = (p + (z * z) / (2 * n)) / d
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return {
    value: p,
    variance: (p * (1 - p)) / n,
    se: Math.sqrt((p * (1 - p)) / n),
    ci: [Math.max(0, centre - half), Math.min(1, centre + half)],
    level,
    n,
    k,
    interval: 'wilson',
  }
}

/**
 * A histogram normalised to a density, with a per-bin interval.
 *
 * Each bin count is binomial in N with probability `p_k`, the mass the true
 * density puts in that bin. So the density estimate in bin k has standard error
 * `sqrt(p_k (1 - p_k) / N) / w`, and it shrinks as `1/sqrt(N)`. That rate is the
 * first experiment of the lab, and this is where the number comes from.
 *
 * Returns `{ edges, centres, counts, density, se, ci, width, n, outside }`.
 * `outside` counts the samples that fell beyond `[lo, hi]`. They are excluded
 * from the density rather than piled into the end bins, and the pane states the
 * count, because piling them in would put a false spike at each edge.
 */
export function histogram(x, { bins = 40, lo, hi, level = 0.95 } = {}) {
  const n = x.length
  let a = lo
  let b = hi
  if (a === undefined || b === undefined) {
    a = Infinity
    b = -Infinity
    for (let i = 0; i < n; i++) {
      if (x[i] < a) a = x[i]
      if (x[i] > b) b = x[i]
    }
    if (a === b) {
      a -= 0.5
      b += 0.5
    }
  }
  const w = (b - a) / bins
  const counts = new Float64Array(bins)
  let outside = 0
  for (let i = 0; i < n; i++) {
    const j = Math.floor((x[i] - a) / w)
    if (j < 0 || j >= bins) outside++
    else counts[j] += 1
  }
  const edges = new Float64Array(bins + 1)
  const centres = new Float64Array(bins)
  const density = new Float64Array(bins)
  const se = new Float64Array(bins)
  const ci = []
  const z = zFor(level)
  for (let k = 0; k <= bins; k++) edges[k] = a + k * w
  for (let k = 0; k < bins; k++) {
    centres[k] = a + (k + 0.5) * w
    const p = counts[k] / n
    density[k] = p / w
    se[k] = Math.sqrt((p * (1 - p)) / n) / w
    ci.push([Math.max(0, density[k] - z * se[k]), density[k] + z * se[k]])
  }
  return { edges, centres, counts, density, se, ci, width: w, n, outside, level, lo: a, hi: b }
}

/**
 * The root-mean-square gap between a histogram and a density, in density units.
 *
 * The lab's `1/sqrt(N)` claim is about this number: quadruple N and it halves.
 * `predicted` is what the binomial says the gap should be, averaged over the
 * bins, so the pane compares a measurement against a formula rather than
 * against a previous measurement.
 */
export function histogramError(h, pdf) {
  let acc = 0
  let pred = 0
  for (let k = 0; k < h.centres.length; k++) {
    const truth = pdf(h.centres[k])
    const d = h.density[k] - truth
    acc += d * d
    const p = truth * h.width
    pred += (p * (1 - p)) / h.n / (h.width * h.width)
  }
  const bins = h.centres.length
  return { rms: Math.sqrt(acc / bins), predicted: Math.sqrt(pred / bins), bins }
}
