// The bit error rate, in two halves, and keeping them apart is the point of the
// whole lab.
//
// The closed forms are exact functions and are returned as bare numbers. The
// count runs the chain and compares bits, so it is an estimate and comes back
// with its interval, which is the guard CORE_SCOPE Rule 3 requires. A pane
// draws the form as a line and the count as a marker. It never draws them as
// one series, because that would teach a reader that a measurement and a
// formula are the same kind of thing.

import { rng, qFunction, proportion } from '@ee-labs/random'
import { constellation, gray, hamming, mapBits, demapSymbols, randomBits } from './mappers.js'
import { fskCoherentBer, fskNoncoherentBer } from './detect.js'

export const SCHEMES = [
  'bpsk',
  'qpsk',
  'psk8',
  'pam4',
  'qam16',
  'qam64',
  'fskCoherent',
  'fskNoncoherent',
  'dbpsk',
]

/** Below this many errors the point is drawn hollow (plan §2.8). */
export const HOLLOW_BELOW = 30

/** The bits a symbol carries, for the schemes that are not table mappers. */
export function bitsPerSymbol(scheme) {
  if (scheme === 'fskCoherent' || scheme === 'fskNoncoherent' || scheme === 'dbpsk') return 1
  return constellation(scheme).bits
}

/**
 * The bit error rate of a square QAM or an M-PAM, computed exactly.
 *
 * Not by the union bound. The per-dimension PAM decision regions are
 * enumerated, and each transition is weighted by the Hamming distance between
 * the two Gray labels. That reaches the same answer as the published closed
 * form for 16-QAM and needs no separate expression per constellation.
 */
function pamDimensionBer(L, esOverN0, dims) {
  const M = dims === 2 ? L * L : L
  const a = dims === 2 ? Math.sqrt(3 / (2 * (M - 1))) : Math.sqrt(3 / (M * M - 1))
  const sigma = Math.sqrt(1 / (2 * esOverN0))
  let bits = 0
  for (let i = 0; i < L; i++) {
    const xi = (2 * i - L + 1) * a
    for (let j = 0; j < L; j++) {
      if (j === i) continue
      const ham = hamming(gray(i), gray(j))
      const lo = j === 0 ? -Infinity : (2 * j - L) * a
      const hi = j === L - 1 ? Infinity : (2 * j - L + 2) * a
      const pLo = lo === -Infinity ? 0 : qFunction((xi - lo) / sigma)
      const pHi = hi === Infinity ? 0 : qFunction((hi - xi) / sigma)
      bits += ham * (1 - pLo - pHi)
    }
  }
  return bits / L
}

/** The symbol error rate of a square QAM, from its per-dimension rate. */
function qamSer(L, esOverN0) {
  const M = L * L
  const a = Math.sqrt(3 / (2 * (M - 1)))
  const sigma = Math.sqrt(1 / (2 * esOverN0))
  const pe1 = 2 * (1 - 1 / L) * qFunction(a / sigma)
  return 1 - (1 - pe1) ** 2
}

/** The symbol error rate of M-PSK, by the two nearest-neighbour terms. */
function pskSer(M, esOverN0) {
  return 2 * qFunction(Math.sqrt(2 * esOverN0) * Math.sin(Math.PI / M))
}

/**
 * Every closed form, as a function of Eb/N0 in linear units.
 *
 * All are exact except `psk8`, whose bit rate is the two-nearest-neighbour
 * approximation. That is the one form in this file a pane labels as an
 * approximation, and B4 states it where the number appears.
 */
export function berClosed(scheme, gammaB) {
  switch (scheme) {
    case 'bpsk':
    case 'qpsk':
      return qFunction(Math.sqrt(2 * gammaB))
    case 'fskCoherent':
      return fskCoherentBer(gammaB)
    case 'fskNoncoherent':
      return fskNoncoherentBer(gammaB)
    case 'dbpsk':
      return 0.5 * Math.exp(-gammaB)
    case 'qam16':
      return (2 * pamDimensionBer(4, 4 * gammaB, 2)) / 4
    case 'qam64':
      return (2 * pamDimensionBer(8, 6 * gammaB, 2)) / 6
    case 'pam4':
      return pamDimensionBer(4, 2 * gammaB, 1) / 2
    case 'psk8':
      return pskSer(8, 3 * gammaB) / 3
    default:
      throw new Error(`berClosed: no form for "${scheme}"`)
  }
}

/** The symbol error rate beside the bit error rate. */
export function serClosed(scheme, gammaB) {
  switch (scheme) {
    case 'bpsk':
    case 'fskCoherent':
    case 'fskNoncoherent':
    case 'dbpsk':
      return berClosed(scheme, gammaB)
    case 'qpsk':
      return pskSer(4, 2 * gammaB)
    case 'psk8':
      return pskSer(8, 3 * gammaB)
    case 'qam16':
      return qamSer(4, 4 * gammaB)
    case 'qam64':
      return qamSer(8, 6 * gammaB)
    case 'pam4': {
      const sigma = Math.sqrt(1 / (2 * 2 * gammaB))
      return 2 * (1 - 1 / 4) * qFunction(Math.sqrt(3 / 15) / sigma)
    }
    default:
      throw new Error(`serClosed: no form for "${scheme}"`)
  }
}

/** The Eb/N0 in dB that reaches a given rate, by bisection on the form. */
export function ebN0For(scheme, target = 1e-5) {
  let lo = -10
  let hi = 60
  for (let i = 0; i < 300; i++) {
    const m = (lo + hi) / 2
    if (berClosed(scheme, 10 ** (m / 10)) > target) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

/**
 * The normal relative half width of an error rate measured from `k` errors.
 *
 * `1.96 sqrt(p(1 - p)/N) / p` is `1.96 / sqrt(k)` when p is small, so the
 * precision of a counted rate depends on the error count and on nothing else.
 * That is D4's whole point, and it is why the pane prints the count.
 */
export function relativeHalfWidth(errors, z = 1.959963984540054) {
  return errors > 0 ? z / Math.sqrt(errors) : Infinity
}

/** How many errors a given relative half width needs. */
export function errorsFor(halfWidth, z = 1.959963984540054) {
  return Math.ceil((z / halfWidth) ** 2)
}

/**
 * How many symbols it takes to collect `errors` at this rate.
 *
 * Returned as it comes out of the arithmetic rather than rounded, because the
 * pane that prints it and the test that pins it should round the same way and
 * only one of them can decide.
 */
export function symbolsFor(scheme, ebN0Db, errors = 100) {
  const p = berClosed(scheme, 10 ** (ebN0Db / 10))
  return errors / (p * bitsPerSymbol(scheme))
}

/** One counted run of a table-mapped scheme. */
function countMapped(scheme, ebN0Db, symbols, seed) {
  const c = constellation(scheme)
  const gammaB = 10 ** (ebN0Db / 10)
  const sigma = Math.sqrt(1 / (2 * c.bits * gammaB))
  const r = rng(seed)
  const bits = randomBits(symbols * c.bits, r)
  const tx = mapBits(scheme, bits)
  const rx = new Float64Array(tx.length)
  for (let i = 0; i < tx.length; i++) rx[i] = tx[i] + r.normal(0, sigma)
  const got = demapSymbols(scheme, rx)
  let errors = 0
  let symErrors = 0
  for (let s = 0; s < symbols; s++) {
    let bad = false
    for (let b = 0; b < c.bits; b++) {
      if (got[s * c.bits + b] !== bits[s * c.bits + b]) {
        errors++
        bad = true
      }
    }
    if (bad) symErrors++
  }
  return { errors, symErrors, bits: bits.length, symbols }
}

/** One counted run of binary FSK or of differential BPSK. */
function countBinary(scheme, ebN0Db, symbols, seed) {
  const gammaB = 10 ** (ebN0Db / 10)
  const sigma = Math.sqrt(1 / (2 * gammaB))
  const r = rng(seed)
  let errors = 0
  if (scheme === 'fskCoherent') {
    // Two orthogonal arms. The sent tone carries the whole symbol energy and
    // the other carries none, and each arm holds noise of variance N0/2.
    for (let i = 0; i < symbols; i++) {
      const y1 = 1 + r.normal(0, sigma)
      const y2 = r.normal(0, sigma)
      if (y2 > y1) errors++
    }
  } else if (scheme === 'fskNoncoherent') {
    // The same two arms with an unknown phase, so the decision compares
    // magnitudes of two complex readings rather than two real ones.
    for (let i = 0; i < symbols; i++) {
      const a = Math.hypot(1 + r.normal(0, sigma), r.normal(0, sigma))
      const b = Math.hypot(r.normal(0, sigma), r.normal(0, sigma))
      if (b > a) errors++
    }
  } else {
    // Differentially coherent BPSK. The receiver has no phase reference, so the
    // whole burst arrives with one unknown rotation and the decision reads the
    // phase BETWEEN two successive symbols. The statistic is the real part of
    // the product of one sample with the conjugate of the last, which is why
    // the samples here are complex where the FSK arms above are not.
    const theta = 2 * Math.PI * r.uniform()
    const cr = Math.cos(theta)
    const ci = Math.sin(theta)
    let prev = 1
    let prevRe = cr + r.normal(0, sigma)
    let prevIm = ci + r.normal(0, sigma)
    for (let i = 0; i < symbols; i++) {
      const bit = r.uniform() < 0.5 ? 0 : 1
      const cur = bit === 0 ? prev : -prev
      const curRe = cur * cr + r.normal(0, sigma)
      const curIm = cur * ci + r.normal(0, sigma)
      const stat = curRe * prevRe + curIm * prevIm
      const got = stat > 0 ? 0 : 1
      if (got !== bit) errors++
      prev = cur
      prevRe = curRe
      prevIm = curIm
    }
  }
  return { errors, symErrors: errors, bits: symbols, symbols }
}

/**
 * The counted rate, from a fixed seed and a fixed trial count.
 *
 * Returns the estimate `@ee-labs/random` builds, which is the Wilson interval,
 * plus the error count behind the point and the normal relative half width D4
 * quotes. Below `HOLLOW_BELOW` errors `hollow` is true, and the pane then
 * prints the interval rather than the value, because at that count the interval
 * spans a factor of two.
 */
export function berCount({ scheme = 'bpsk', ebN0Db = 8, symbols = 200000, seed = 1, level = 0.95 }) {
  const run =
    scheme === 'fskCoherent' || scheme === 'fskNoncoherent' || scheme === 'dbpsk'
      ? countBinary(scheme, ebN0Db, symbols, seed)
      : countMapped(scheme, ebN0Db, symbols, seed)
  const est = proportion(run.errors, run.bits, { level })
  const ser = proportion(run.symErrors, run.symbols, { level })
  return {
    ...est,
    errors: run.errors,
    bits: run.bits,
    symbols: run.symbols,
    ser,
    relativeHalfWidth: relativeHalfWidth(run.errors),
    hollow: run.errors < HOLLOW_BELOW,
    closed: berClosed(scheme, 10 ** (ebN0Db / 10)),
  }
}

/**
 * The curve the plot draws. The closed form at every point, and the count only
 * where a count can be read in the time the app has.
 */
export function berCurve({ scheme = 'bpsk', from = 0, to = 12, step = 1, countTo = 8, symbols = 200000, seed = 1 }) {
  const points = []
  for (let d = from; d <= to + 1e-9; d += step) {
    const closed = berClosed(scheme, 10 ** (d / 10))
    const counted = d <= countTo ? berCount({ scheme, ebN0Db: d, symbols, seed }) : null
    points.push({ ebN0Db: d, closed, counted })
  }
  return { scheme, points, countTo }
}
