// Entropy, mutual information and capacity.
//
// Every function here is a finite sum over a finite alphabet, except the
// binary-input Gaussian channel's capacity, which is an integral and carries a
// convergence guard (CORE_SCOPE.md Rule 3). Nothing else in this file
// approximates anything, so nothing else is hedged.
//
// Logarithms are base two throughout, so every quantity is in bits.

import { qFunction, qInv } from '@ee-labs/random'
import { CodesError } from './gf2.js'

/** log₂, with `0 log 0 = 0` as the limit says it is. */
const log2 = (x) => Math.log(x) / Math.LN2

const term = (p) => (p > 0 ? -p * log2(p) : 0)

/** A distribution, checked. Probabilities are non-negative and sum to one. */
export function checkDistribution(p, label = 'a distribution') {
  if (!p.length) throw new CodesError('entropy-empty', `${label} needs at least one symbol`)
  for (const v of p) if (!(v >= 0)) throw new CodesError('entropy-negative', `${label} has a probability of ${v}`)
  const sum = p.reduce((a, b) => a + b, 0)
  if (Math.abs(sum - 1) > 1e-9) throw new CodesError('entropy-sum', `${label} sums to ${sum.toFixed(6)}, not to 1`)
  return p
}

/** The entropy of a source, `H = −Σ p log₂ p`, in bits per symbol. */
export function entropy(p) {
  checkDistribution(p, 'a source')
  return p.reduce((acc, v) => acc + term(v), 0)
}

/** The binary entropy function, `h₂(p) = −p log₂ p − (1−p) log₂(1−p)`. */
export function binaryEntropy(p) {
  if (p < 0 || p > 1) throw new CodesError('entropy-range', `a probability is between 0 and 1, not ${p}`)
  return term(p) + term(1 - p)
}

/** The largest entropy an alphabet of `m` symbols can have, `log₂ m`, at the uniform distribution. */
export const maxEntropy = (m) => log2(m)

/**
 * The mutual information of a discrete channel.
 *
 * @param {number[]} px      the input distribution
 * @param {number[][]} P     P[x][y], the probability of output y given input x
 * @returns {{ I, hy, hyx, py }} in bits per channel use
 */
export function mutualInformation(px, P) {
  checkDistribution(px, 'an input distribution')
  P.forEach((row, x) => checkDistribution(row, `the transitions from input ${x}`))
  const outputs = P[0].length
  const py = new Array(outputs).fill(0)
  for (let x = 0; x < px.length; x++) for (let y = 0; y < outputs; y++) py[y] += px[x] * P[x][y]
  const hy = py.reduce((acc, v) => acc + term(v), 0)
  const hyx = px.reduce((acc, p, x) => acc + p * P[x].reduce((a, v) => a + term(v), 0), 0)
  return { I: hy - hyx, hy, hyx, py }
}

/** The capacity of the binary symmetric channel with crossover `p`: `1 − h₂(p)`. */
export const capacityBSC = (p) => 1 - binaryEntropy(p)

/** The capacity of the binary erasure channel with erasure probability `e`: `1 − e`, exactly. */
export function capacityBEC(e) {
  if (e < 0 || e > 1) throw new CodesError('entropy-range', `an erasure probability is between 0 and 1, not ${e}`)
  return 1 - e
}

/** The transition matrix of the binary symmetric channel, for `mutualInformation`. */
export const bscMatrix = (p) => [
  [1 - p, p],
  [p, 1 - p],
]

/** The transition matrix of the binary erasure channel, with the erasure last. */
export const becMatrix = (e) => [
  [1 - e, 0, e],
  [0, 1 - e, e],
]

/** The Gaussian channel's capacity in bits per second per hertz: `log₂(1 + S/N)`. */
export function capacityAWGN(snr) {
  if (snr < 0) throw new CodesError('entropy-range', `a signal-to-noise ratio is not negative, and this one is ${snr}`)
  return log2(1 + snr)
}

/** The same, taking decibels. */
export const capacityAWGNDb = (db) => capacityAWGN(10 ** (db / 10))

/**
 * The crossover probability at which the binary symmetric channel has capacity
 * `c`, found by bisection on `1 − h₂(p)`, which is monotone on [0, ½].
 */
export function crossoverForCapacity(c) {
  if (c < 0 || c > 1) throw new CodesError('entropy-range', `a capacity of a binary channel is between 0 and 1, not ${c}`)
  return bisect((p) => capacityBSC(p) - c, 0.5, 0, 1e-15)
}

/**
 * The Shannon limit on `E_b/N_0` at spectral efficiency `r`, as a ratio.
 *
 * `E_b/N_0 ≥ (2^r − 1)/r` follows from `r ≤ log₂(1 + r E_b/N_0)`. As `r` goes
 * to zero the bound goes to `ln 2`, which is −1.5917 dB and is the lowest
 * signal-to-noise ratio at which any code communicates at all.
 */
export function shannonLimit(r) {
  if (!(r > 0)) throw new CodesError('entropy-range', `a spectral efficiency is above zero, not ${r}`)
  return (2 ** r - 1) / r
}

/** The same limit, in decibels. */
export const shannonLimitDb = (r) => 10 * Math.log10(shannonLimit(r))

/** The limit as the spectral efficiency goes to zero: `ln 2`, which is −1.5917 dB. */
export const SHANNON_FLOOR = Math.LN2
export const SHANNON_FLOOR_DB = 10 * Math.log10(Math.LN2)

/**
 * The capacity of the binary-input Gaussian channel, in bits per channel use.
 *
 * The channel sends ±1 and adds Gaussian noise of variance `σ² = 1/(2 E_s/N_0)`.
 * Its capacity is `1 − E[log₂(1 + e^{−2y/σ²})]` with `y` drawn about +1, an
 * expectation with no elementary closed form. This is the one approximation in
 * this package, so it carries the guard Rule 3 asks for: the integral is taken
 * on a grid and again on a grid twice as fine, and `delta` is the difference
 * between the two. A pane prints both.
 *
 * @param {number} esN0Db   the signal-to-noise ratio per channel use, decibels
 * @param {object} [opts]   `points`, the coarse grid, and `tolerance`
 * @returns {{ capacity, coarse, delta, points, converged, tolerance }}
 */
export function biAwgnCapacity(esN0Db, { points = 2000, tolerance = 1e-6 } = {}) {
  const coarse = biAwgnOnGrid(esN0Db, points)
  const fine = biAwgnOnGrid(esN0Db, 2 * points)
  const delta = Math.abs(fine - coarse)
  return { capacity: fine, coarse, delta, points: 2 * points, converged: delta <= tolerance, tolerance }
}

function biAwgnOnGrid(esN0Db, points) {
  const es = 10 ** (esN0Db / 10)
  const sigma = Math.sqrt(1 / (2 * es))
  // Ten standard deviations either side of the transmitted +1 covers the
  // density to below 1e-23, which is under the grid's own error.
  const lo = 1 - 10 * sigma
  const hi = 1 + 10 * sigma
  const h = (hi - lo) / points
  let acc = 0
  for (let i = 0; i <= points; i++) {
    const y = lo + i * h
    const w = i === 0 || i === points ? 0.5 : 1
    const density = Math.exp(-((y - 1) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI))
    acc += w * density * log2(1 + Math.exp((-2 * y) / (sigma * sigma)))
  }
  return 1 - acc * h
}

/**
 * The signal-to-noise ratio per channel use at which the binary-input Gaussian
 * channel reaches capacity `c`, in decibels. Bisection on the capacity, which
 * rises with the ratio.
 */
export function esN0ForBiAwgnCapacity(c, opts = {}) {
  return bisect((db) => biAwgnCapacity(db, opts).capacity - c, -20, 20, 1e-9)
}

/**
 * The same for the hard-decision channel: the ratio at which the binary
 * symmetric channel made by threshold detection reaches capacity `c`.
 *
 * The crossover of that channel is `Q(√(2 E_s/N_0))`, so the ratio follows
 * from the crossover in closed form and no search is needed.
 */
export function esN0ForBscCapacity(c) {
  const p = crossoverForCapacity(c)
  const arg = qInv(p)
  return 10 * Math.log10((arg * arg) / 2)
}

/** The crossover of the hard-decision channel at a signal-to-noise ratio per channel use. */
export const bscCrossoverAt = (esN0Db) => qFunction(Math.sqrt(2 * 10 ** (esN0Db / 10)))

/** Bisection on a monotone function, to an absolute tolerance on the argument. */
function bisect(f, a, b, tol) {
  let lo = a
  let hi = b
  let flo = f(lo)
  if (flo === 0) return lo
  for (let i = 0; i < 200 && Math.abs(hi - lo) > tol; i++) {
    const mid = 0.5 * (lo + hi)
    const fm = f(mid)
    if (fm === 0) return mid
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid
      flo = fm
    } else hi = mid
  }
  return 0.5 * (lo + hi)
}
