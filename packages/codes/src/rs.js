// Reed-Solomon codes: symbols from GF(2^m) rather than bits from GF(2).
//
// A Reed-Solomon code takes its `n − k` parity symbols from a generator
// polynomial whose roots are consecutive powers of the primitive element. Its
// distance is `n − k + 1`, which meets the Singleton bound with equality, so it
// is a maximum-distance-separable code and every set of `k` symbols determines
// the codeword.
//
// This module builds the field arithmetic, the encoder and the erasure
// decoder. The error decoder, Berlekamp-Massey or Euclidean, is out of this
// version (INFORMATION_LAB_PLAN.md Decision 4). Erasure decoding needs only the
// linear algebra that is already here: the positions are known, so the
// syndromes give one linear system per erased symbol.

import { CodesError } from './gf2.js'
import { field, polyMul, polyEval, solve } from './gfm.js'

/**
 * A Reed-Solomon code over GF(2^m).
 *
 * @param {number} m   bits per symbol
 * @param {number} n   symbols per codeword, at most 2^m − 1
 * @param {number} k   message symbols
 * @returns {{ f, m, n, k, d, t, erasures, rate, gen, name }}
 */
export function rsCode(m, n, k) {
  const f = field(m)
  if (n > f.order) throw new CodesError('rs-length', `GF(2^${m}) has ${f.order} nonzero elements, so a code of ${n} symbols does not fit`)
  if (k >= n || k < 1) throw new CodesError('rs-dimension', `a code of ${n} symbols carries 1 to ${n - 1} message symbols, not ${k}`)
  // g(x) = (x − α)(x − α²)…(x − α^{n−k}), highest power first.
  let gen = [1]
  for (let i = 1; i <= n - k; i++) gen = polyMul(f, gen, [1, f.exp[i]])
  return {
    f,
    m,
    n,
    k,
    d: n - k + 1,
    t: Math.floor((n - k) / 2),
    erasures: n - k,
    rate: k / n,
    gen,
    name: `RS(${n},${k})`,
  }
}

/** The reference code of the lab: RS(15,11) over GF(2⁴). */
export const RS15 = () => rsCode(4, 15, 11)

/** The byte code the standards use: RS(255,223) over GF(2⁸). */
export const RS255 = () => rsCode(8, 255, 223)

/** One message as a codeword, systematically: the message, then the remainder. */
export function rsEncode(code, message) {
  const { f, n, k, gen } = code
  if (message.length !== k) throw new CodesError('rs-message', `this code takes ${k} message symbols, not ${message.length}`)
  const r = [...message, ...new Array(n - k).fill(0)]
  for (let i = 0; i < k; i++) {
    const lead = r[i]
    if (lead === 0) continue
    const s = f.div(lead, gen[0])
    for (let j = 0; j < gen.length; j++) r[i + j] = f.sub(r[i + j], f.mul(s, gen[j]))
  }
  return [...message, ...r.slice(k)]
}

/**
 * The syndromes of a received word: the codeword polynomial at each root of the
 * generator. They are zero exactly when the word is a codeword.
 */
export function rsSyndromes(code, received) {
  const { f, n, k } = code
  if (received.length !== n) throw new CodesError('rs-word', `this code has words of ${n} symbols, not ${received.length}`)
  return Array.from({ length: n - k }, (_, i) => polyEval(f, received, f.exp[i + 1]))
}

/** The parity-check matrix over the field: row `i` evaluates the word at `α^{i+1}`. */
export function rsCheckMatrix(code) {
  const { f, n, k } = code
  return Array.from({ length: n - k }, (_, i) => Array.from({ length: n }, (_, p) => f.pow(f.exp[i + 1], n - 1 - p)))
}

/**
 * Fill in erased symbols, given where they are.
 *
 * With the positions known, each syndrome is one linear equation in the erased
 * values, so `n − k` erasures are the most that can be filled and the system is
 * square at that point. The matrix is a Vandermonde on distinct powers, so it
 * is invertible and the answer is unique.
 *
 * @returns {{ word, values, positions, filled: true }}
 */
export function rsErasureDecode(code, received, positions) {
  const { f, n, k } = code
  if (positions.length > n - k)
    throw new CodesError('rs-erasures', `this code fills up to ${n - k} erasures, and ${positions.length} were marked`)
  const seen = new Set(positions)
  if (seen.size !== positions.length) throw new CodesError('rs-erasures', 'an erasure position was given twice')
  const cleared = received.map((s, i) => (seen.has(i) ? 0 : s))
  const S = rsSyndromes(code, cleared)
  const e = positions.length
  if (e === 0) return { word: cleared, values: [], positions, filled: true }
  const A = Array.from({ length: e }, (_, i) => positions.map((p) => f.pow(f.exp[i + 1], n - 1 - p)))
  const y = S.slice(0, e)
  const values = solve(f, A, y)
  if (!values) throw new CodesError('rs-erasures', 'the erased positions give a singular system, which cannot happen for distinct positions')
  const word = [...cleared]
  positions.forEach((p, i) => {
    word[p] = values[i]
  })
  return { word, values, positions, filled: true }
}

/** The message a systematic codeword carries. */
export const rsMessageOf = (code, word) => word.slice(0, code.k)

/** Whether a word is a codeword, by its syndromes. */
export const rsIsCodeword = (code, word) => rsSyndromes(code, word).every((s) => s === 0)

/**
 * What this version does not do, as a value rather than as a comment.
 *
 * C5's pane prints this beside the code's parameters, so a reader is told what
 * is missing rather than left to find out (Decision 4).
 */
export const RS_DECODER_STATUS = {
  built: ['the field arithmetic', 'the generator polynomial', 'the encoder', 'the syndromes', 'the erasure decoder'],
  missing: 'the error decoder, which needs Berlekamp-Massey or the Euclidean algorithm to find the error positions',
}
