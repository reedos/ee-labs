// The two channels a decoder in this lab reads from.
//
// The binary symmetric channel flips each bit with probability `p`, and the
// Gaussian channel adds noise of a stated variance to ±1. Both draw from the
// seeded generator in `@ee-labs/random`, so a lesson's error pattern is a
// function of its seed and is reproducible in the way a solved circuit is.
//
// One convention holds everywhere here. Bit 0 is sent as +1 and bit 1 as −1,
// and a log-likelihood ratio is `log P(bit = 0 | y) / P(bit = 1 | y)`, so a
// positive belief argues for a 0. The Communications Lab's detector uses the
// same pair of conventions, and `apps/info-lab/NEEDS.md` records the contract.

import { rng, qFunction } from '@ee-labs/random'
import { CodesError } from './gf2.js'

/** Bits as levels: 0 is +1 and 1 is −1. */
export const modulate = (bits) => bits.map((b) => (b ? -1 : 1))

/** Levels back as bits, by their sign. */
export const demodulate = (y) => y.map((v) => (v < 0 ? 1 : 0))

/** `E_s/N_0` in decibels, from `E_b/N_0` and the code rate: the code spends R of each bit's energy on the message. */
export const esN0Db = (ebN0Db, rate) => ebN0Db + 10 * Math.log10(rate)

/** The noise standard deviation per channel use at a given `E_s/N_0`, with unit symbol energy. */
export const sigmaFor = (es) => Math.sqrt(1 / (2 * es))

/** The crossover of the hard-decision channel a Gaussian channel becomes: `Q(√(2 E_s/N_0))`. */
export const crossoverFor = (es) => qFunction(Math.sqrt(2 * es))

/**
 * Send bits over the Gaussian channel.
 *
 * @param {number[]} bits
 * @param {object} opts   `ebN0Db` and `rate`, or `esN0Db` directly, and `seed`
 * @returns {{ y, llr, hard, sigma, es, esN0Db, flips }}
 */
export function gaussian(bits, { ebN0Db = null, esN0Db: esDb = null, rate = 1, seed = 1 } = {}) {
  if (ebN0Db === null && esDb === null) throw new CodesError('channel-level', 'a Gaussian channel needs an E_b/N_0 or an E_s/N_0')
  const db = esDb === null ? esN0Db(ebN0Db, rate) : esDb
  const es = 10 ** (db / 10)
  const sigma = sigmaFor(es)
  const r = rng(seed)
  const sent = modulate(bits)
  const y = sent.map((s) => s + r.normal(0, sigma))
  const hard = demodulate(y)
  return {
    y,
    // The exact per-bit belief for this channel: 2y/σ².
    llr: y.map((v) => (2 * v) / (sigma * sigma)),
    hard,
    sigma,
    es,
    esN0Db: db,
    flips: hard.reduce((acc, b, i) => acc + (b === bits[i] ? 0 : 1), 0),
  }
}

/**
 * Send bits over the binary symmetric channel.
 *
 * @returns {{ bits, flips, p, llr }} the belief a hard channel gives is the
 *   same size on every bit, `log((1−p)/p)`, with the sign of the bit received.
 */
export function symmetric(bits, { p, seed = 1 } = {}) {
  if (!(p >= 0 && p <= 0.5)) throw new CodesError('channel-crossover', `a crossover of 0 to 0.5 is modelled here, not ${p}`)
  const r = rng(seed)
  const out = bits.map((b) => (r.uniform() < p ? b ^ 1 : b))
  const belief = p === 0 ? 30 : Math.log((1 - p) / p)
  return {
    bits: out,
    flips: out.reduce((acc, b, i) => acc + (b === bits[i] ? 0 : 1), 0),
    p,
    llr: out.map((b) => (b ? -belief : belief)),
  }
}

/** How many places two bit strings differ in. */
export function errorCount(a, b) {
  if (a.length !== b.length) throw new CodesError('channel-length', `${a.length} bits cannot be compared with ${b.length}`)
  return a.reduce((acc, v, i) => acc + (v === b[i] ? 0 : 1), 0)
}

/** A seeded stream of bits. */
export function bitStream(n, seed = 1) {
  const r = rng(seed)
  return Array.from({ length: n }, () => (r.uniform() < 0.5 ? 0 : 1))
}

/** A seeded stream of symbols from a source's distribution. */
export function symbolStream(n, probs, seed = 1) {
  const r = rng(seed)
  return Array.from({ length: n }, () => {
    let u = r.uniform()
    for (let s = 0; s < probs.length; s++) {
      u -= probs[s]
      if (u < 0) return s
    }
    return probs.length - 1
  })
}
