// The closed forms this curriculum quotes, reached a second way.
//
// `PROGRAM.md` §6 says a number is never typed into a test as a constant when it
// can be computed from the knobs. Several claims here quote a value that lives
// in a statistical table: the mass a two-sigma band holds, the chi-square
// multipliers of a periodogram's interval, an error rate at 7 dB. A table entry
// typed into a claim is a number that stops being true the moment a knob moves,
// and the test then reports the wrong failure.
//
// So this file computes those values from the knobs instead, and by a different
// method from the one `@ee-labs/random` uses. `dist.js` reaches the Gaussian
// tail through a rational approximation to `erf` and the chi-square quantile
// through an inverted incomplete gamma. This file reaches the first by
// quadrature and the second by a finite sum that is exact at an even number of
// degrees of freedom. Two independent routes to one number is the point. If the
// two ever disagree, one of them is wrong, and the claim that compares them says
// so at the experiment that quotes the number.
//
// Nothing here is drawn from data, so nothing here carries an interval.

/** The standard normal density. */
const phi = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)

/**
 * `Q(x)`, the mass of the standard normal above `x`, by Simpson's rule.
 *
 * The integral runs from `x` to `x + 12`, and what is dropped beyond that is
 * below 1e-33 at every `x` this lab asks for. Four thousand panels put the
 * quadrature error near 1e-15, which is the arithmetic's floor rather than the
 * method's.
 */
export function gaussianTail(x) {
  if (x < 0) return 1 - gaussianTail(-x)
  const panels = 4096
  const h = 12 / panels
  let sum = phi(x) + phi(x + 12)
  for (let i = 1; i < panels; i++) sum += phi(x + i * h) * (i % 2 ? 4 : 2)
  return (sum * h) / 3
}

/** The mass a band of `k` standard deviations holds, `1 - 2Q(k)`. */
export const insideSigma = (k) => 1 - 2 * gaussianTail(k)

/** The standard normal quantile, by bisection on the tail above. */
export function normalQuantile(p) {
  let lo = -40
  let hi = 40
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (1 - gaussianTail(mid) < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * `P(X > x)` for a chi-square with an even number of degrees of freedom.
 *
 * At even `dof` the survival function is a finite sum and needs no special
 * function at all, which is what makes this an independent route rather than a
 * second call into the same gamma code. An averaged periodogram over
 * non-overlapping segments always has `dof = 2M`, so the even case is the only
 * one this lab asks for, and an odd `dof` is refused rather than approximated.
 */
export function chi2Upper(x, dof) {
  if (!Number.isInteger(dof) || dof % 2 !== 0 || dof < 2) {
    throw new Error(`chi2Upper is exact only at an even dof, not ${dof}`)
  }
  const half = x / 2
  let term = 1
  let sum = 1
  for (let k = 1; k < dof / 2; k++) {
    term *= half / k
    sum += term
  }
  return Math.exp(-half) * sum
}

/** The chi-square quantile, the `x` below which the mass is `p`. */
export function chi2Quantile(p, dof) {
  let lo = 0
  let hi = dof
  while (chi2Upper(hi, dof) > 1 - p) hi *= 2
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (chi2Upper(mid, dof) > 1 - p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * The two multipliers an averaged periodogram's interval puts on each bin.
 *
 * The estimate times `lo` and times `hi` bracket the true density at `level`.
 * Both are `dof` over a chi-square quantile, so both narrow towards one as the
 * averages rise, and neither is symmetric about the estimate.
 */
export function psdIntervalFactors(dof, level) {
  const tail = (1 - level) / 2
  return {
    lo: dof / chi2Quantile(1 - tail, dof),
    hi: dof / chi2Quantile(tail, dof),
  }
}

/**
 * The fraction of a matched filter's ratio that a mismatched filter `h` keeps,
 * as the squared correlation between the two shapes.
 *
 * Cauchy-Schwarz says this is at most one, with equality only when `h` is the
 * pulse. The engine reaches the same fraction through `filterSnr` and
 * `matchedSnr`, which divide by the noise variance twice and cancel it. This
 * route never forms the ratio at all.
 */
export function mismatchFraction(s, h) {
  let hs = 0
  let hh = 0
  let ss = 0
  const n = Math.min(s.length, h.length)
  for (let i = 0; i < n; i++) hs += s[i] * h[i]
  for (let i = 0; i < h.length; i++) hh += h[i] * h[i]
  for (let i = 0; i < s.length; i++) ss += s[i] * s[i]
  return (hs * hs) / (hh * ss)
}
