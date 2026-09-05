// Distributions, and the closed forms that go with them.
//
// Everything in this file is exact in the CORE_SCOPE sense: a density, a
// distribution function, a mean and a variance are formulas, not estimates, and
// they are printed with no interval beside them. The estimates that approach
// them live in `estimate.js` and always carry an interval. Keeping the two in
// separate files is the point. A pane that draws both has to say which is which.
//
// The Q function is the one closed form the lab leans on hardest, because every
// detection result is a Q of something. It is computed from the incomplete
// gamma function rather than from a fitted rational approximation, so its
// relative error holds into the far tail where the error rates live. A 7-sigma
// Q is 1.28e-12, and an approximation good to 1.2e-7 absolute returns that as
// noise.

/** Natural log of the gamma function, Lanczos g = 7, n = 9. */
function lngamma(x) {
  const g = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lngamma(1 - x)
  const z = x - 1
  let a = g[0]
  const t = z + 7.5
  for (let i = 1; i < 9; i++) a += g[i] / (z + i)
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a)
}

/** Lower regularised incomplete gamma P(a, x) by its series. Converges for x < a+1. */
function gammaSeries(a, x) {
  if (x <= 0) return 0
  let ap = a
  let sum = 1 / a
  let del = sum
  for (let i = 0; i < 300; i++) {
    ap += 1
    del *= x / ap
    sum += del
    if (Math.abs(del) < Math.abs(sum) * 1e-17) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - lngamma(a))
}

/** Upper regularised incomplete gamma Q(a, x) by continued fraction (modified Lentz). */
function gammaCf(a, x) {
  const tiny = 1e-300
  let b = x + 1 - a
  let c = 1 / tiny
  let d = 1 / b
  let h = d
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < tiny) d = tiny
    c = b + an / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-17) break
  }
  return Math.exp(-x + a * Math.log(x) - lngamma(a)) * h
}

/**
 * The error function.
 * `erf(x) = (2/sqrt(pi)) * integral from 0 to x of exp(-t^2) dt`.
 */
export function erf(x) {
  if (x === 0) return 0
  const s = x < 0 ? -1 : 1
  const y = x * x
  return s * (y < 1.5 ? gammaSeries(0.5, y) : 1 - gammaCf(0.5, y))
}

/**
 * The complementary error function, `1 - erf(x)`, computed without forming
 * that difference above x = 1.22. Subtracting near-equal numbers there would
 * cost every digit the tail has.
 */
export function erfc(x) {
  if (x < 0) return 2 - erfc(-x)
  const y = x * x
  return y < 1.5 ? 1 - gammaSeries(0.5, y) : gammaCf(0.5, y)
}

/**
 * The Q function: the probability that a standard normal exceeds `x`.
 * `Q(x) = (1/2) erfc(x / sqrt(2))`, and `Q(0) = 1/2` exactly.
 */
export function qFunction(x) {
  return 0.5 * erfc(x / Math.SQRT2)
}

/** The standard normal density, `phi(x)`. */
export function phi(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

/** The standard normal distribution function, `Phi(x) = 1 - Q(x)`. */
export function Phi(x) {
  return 0.5 * erfc(-x / Math.SQRT2)
}

/**
 * The inverse of the Q function: the `x` with `Q(x) = p`, for p in (0, 1).
 *
 * Acklam's rational start, then two Newton steps on Q with derivative
 * `-phi(x)`. Newton on the tail is stable because Q is monotone and smooth,
 * and two steps take the start's 1.15e-9 relative error below 1e-15.
 */
export function qInv(p) {
  if (!(p > 0 && p < 1)) throw new Error(`qInv: p must be in (0, 1), got ${p}`)
  // Acklam's coefficients, on the lower tail of Phi. Q(x) = p means Phi(x) = 1-p.
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416]
  const lo = 0.02425
  const u = 1 - p
  let x
  if (u < lo) {
    const q = Math.sqrt(-2 * Math.log(u))
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (u <= 1 - lo) {
    const q = u - 0.5
    const r = q * q
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - u))
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  for (let i = 0; i < 3; i++) {
    const f = qFunction(x) - p
    const dfdx = -phi(x)
    if (dfdx === 0) break
    x -= f / dfdx
  }
  return x
}

/** The two-sided normal coverage factor: `z` with `P(|Z| < z) = level`. */
export function zFor(level = 0.95) {
  if (!(level > 0 && level < 1)) throw new Error(`zFor: level must be in (0, 1), got ${level}`)
  return qInv((1 - level) / 2)
}

/** The lower regularised incomplete gamma function P(a, x). */
export function gammaP(a, x) {
  if (x < 0 || a <= 0) throw new Error(`gammaP: need a > 0 and x >= 0, got a=${a} x=${x}`)
  if (x === 0) return 0
  return x < a + 1 ? gammaSeries(a, x) : 1 - gammaCf(a, x)
}

/** The upper regularised incomplete gamma function Q(a, x) = 1 - P(a, x). */
export function gammaQ(a, x) {
  if (x < 0 || a <= 0) throw new Error(`gammaQ: need a > 0 and x >= 0, got a=${a} x=${x}`)
  if (x === 0) return 1
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaCf(a, x)
}

/**
 * The chi-square quantile: the `x` with `P(chi^2_dof <= x) = p`.
 *
 * Wilson-Hilferty's cube-root start, then Newton on `gammaP` whose derivative is
 * the chi-square density. The averaged periodogram's confidence interval is a
 * chi-square interval and nothing else, so this is computed rather than
 * approximated by a normal, which would be visibly wrong below about twenty
 * averages. That is the range the lab's first spectral experiment sits in.
 */
export function chi2Inv(p, dof) {
  if (!(p > 0 && p < 1)) throw new Error(`chi2Inv: p must be in (0, 1), got ${p}`)
  if (!(dof > 0)) throw new Error(`chi2Inv: dof must be positive, got ${dof}`)
  const a = dof / 2
  const z = -qInv(p)
  const wh = 1 - 2 / (9 * dof) + z * Math.sqrt(2 / (9 * dof))
  let x = dof * Math.max(wh, 0.05) ** 3
  for (let i = 0; i < 40; i++) {
    const f = gammaP(a, x / 2) - p
    // d/dx P(a, x/2) is the chi-square density at x.
    const d = Math.exp((a - 1) * Math.log(x / 2) - x / 2 - lngamma(a)) / 2
    if (d === 0) break
    let step = f / d
    // Halve a step that would leave the support. Newton on a strongly skewed
    // low-dof chi-square overshoots into x < 0 from a poor start.
    while (x - step <= 0) step /= 2
    x -= step
    if (Math.abs(step) < 1e-14 * x) break
  }
  return x
}

/**
 * The distribution registry.
 *
 * Each entry is a closed-form object: how to draw one sample from a seeded
 * generator, the density at a point, and the mean and variance as formulas. The
 * app's density curve is `pdf`, its histogram is `draw` repeated, and the pane
 * prints the gap between them with the histogram's own interval.
 *
 * `support` is `[lo, hi]` of the finite part a plot should frame. For a
 * distribution with infinite support it is the interval holding the stated
 * `coverage` of the mass, computed from the quantile, not guessed.
 */
export const DISTRIBUTIONS = {
  uniform: {
    label: 'Uniform',
    params: { a: 0, b: 1 },
    draw: (r, { a, b }) => r.uniformIn(a, b),
    pdf: (x, { a, b }) => (x >= a && x < b ? 1 / (b - a) : 0),
    cdf: (x, { a, b }) => (x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a)),
    mean: ({ a, b }) => (a + b) / 2,
    variance: ({ a, b }) => ((b - a) * (b - a)) / 12,
    support: ({ a, b }) => [a, b],
  },
  gaussian: {
    label: 'Gaussian',
    params: { mu: 0, sigma: 1 },
    draw: (r, { mu, sigma }) => r.normal(mu, sigma),
    pdf: (x, { mu, sigma }) => phi((x - mu) / sigma) / sigma,
    cdf: (x, { mu, sigma }) => Phi((x - mu) / sigma),
    mean: ({ mu }) => mu,
    variance: ({ sigma }) => sigma * sigma,
    support: ({ mu, sigma }, coverage = 0.9999) => {
      const z = zFor(coverage)
      return [mu - z * sigma, mu + z * sigma]
    },
  },
  exponential: {
    label: 'Exponential',
    params: { lambda: 1 },
    draw: (r, { lambda }) => r.exponential(lambda),
    pdf: (x, { lambda }) => (x < 0 ? 0 : lambda * Math.exp(-lambda * x)),
    cdf: (x, { lambda }) => (x < 0 ? 0 : 1 - Math.exp(-lambda * x)),
    mean: ({ lambda }) => 1 / lambda,
    variance: ({ lambda }) => 1 / (lambda * lambda),
    support: ({ lambda }, coverage = 0.9999) => [0, -Math.log(1 - coverage) / lambda],
  },
  bernoulli: {
    label: 'Bernoulli',
    params: { p: 0.5 },
    draw: (r, { p }) => r.bernoulli(p),
    pdf: (x, { p }) => (x === 1 ? p : x === 0 ? 1 - p : 0),
    cdf: (x, { p }) => (x < 0 ? 0 : x < 1 ? 1 - p : 1),
    mean: ({ p }) => p,
    variance: ({ p }) => p * (1 - p),
    support: () => [0, 1],
  },
  rayleigh: {
    label: 'Rayleigh',
    params: { sigma: 1 },
    // The magnitude of two independent zero-mean Gaussians, which is what the
    // envelope of narrowband noise is.
    draw: (r, { sigma }) => Math.hypot(r.normal(0, sigma), r.normal(0, sigma)),
    pdf: (x, { sigma }) => (x < 0 ? 0 : (x / (sigma * sigma)) * Math.exp((-x * x) / (2 * sigma * sigma))),
    cdf: (x, { sigma }) => (x < 0 ? 0 : 1 - Math.exp((-x * x) / (2 * sigma * sigma))),
    mean: ({ sigma }) => sigma * Math.sqrt(Math.PI / 2),
    variance: ({ sigma }) => ((4 - Math.PI) / 2) * sigma * sigma,
    support: ({ sigma }, coverage = 0.9999) => [0, sigma * Math.sqrt(-2 * Math.log(1 - coverage))],
  },
}

/** The names the app offers, in teaching order. */
export const DISTRIBUTION_NAMES = ['uniform', 'gaussian', 'exponential', 'bernoulli', 'rayleigh']

/** One distribution by name, with its defaults filled in. */
export function distribution(name, params = {}) {
  const d = DISTRIBUTIONS[name]
  if (!d) throw new Error(`unknown distribution: ${name}`)
  const p = { ...d.params, ...params }
  return {
    name,
    label: d.label,
    params: p,
    draw: (r) => d.draw(r, p),
    pdf: (x) => d.pdf(x, p),
    cdf: (x) => d.cdf(x, p),
    mean: d.mean(p),
    variance: d.variance(p),
    sd: Math.sqrt(d.variance(p)),
    support: (coverage) => d.support(p, coverage),
  }
}
