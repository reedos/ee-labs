// GF(2^m), the field of m-bit symbols, as log and antilog tables.
//
// An element is an integer whose bits are the coefficients of a polynomial over
// GF(2). Addition is the exclusive-or of two such integers. Multiplication is
// polynomial multiplication reduced by a primitive polynomial, and building the
// powers of the primitive element once turns every later multiplication into an
// addition of logarithms.
//
// The two fields this lab uses are GF(2⁴) from x⁴ + x + 1 and GF(2⁸) from
// x⁸ + x⁴ + x³ + x² + 1 (INFORMATION_LAB_PLAN.md §2.4). The second is the byte
// field Reed-Solomon codes are built over.

import { CodesError } from './gf2.js'

/** The primitive polynomial each field is built from, as the integer of its coefficients. */
export const PRIMITIVE = { 2: 0x7, 3: 0xb, 4: 0x13, 5: 0x25, 6: 0x43, 7: 0x89, 8: 0x11d }

/**
 * The field GF(2^m).
 *
 * @param {number} m       bits per symbol, 2 to 8
 * @param {number} [poly]  the primitive polynomial, defaulting to PRIMITIVE[m]
 * @returns {{
 *   m, size, order, poly,
 *   exp: number[], log: number[],       // α^i and its inverse, over the nonzero elements
 *   add, sub, mul, div, inv, pow,
 *   elements: number[]                  // every element, 0 first
 * }}
 */
export function field(m, poly = PRIMITIVE[m]) {
  if (!Number.isInteger(m) || m < 2 || m > 8) throw new CodesError('gfm-degree', `GF(2^m) is built here for m from 2 to 8, not ${m}`)
  const size = 1 << m
  const order = size - 1
  const exp = new Array(order * 2).fill(0)
  const log = new Array(size).fill(-1)
  let x = 1
  for (let i = 0; i < order; i++) {
    exp[i] = x
    if (log[x] !== -1) throw new CodesError('gfm-primitive', `0x${poly.toString(16)} is not primitive over GF(2^${m}): α has order ${i}`)
    log[x] = i
    x <<= 1
    if (x & size) x ^= poly
  }
  // A second copy of the table, so a product of two logarithms indexes it
  // without a modulo. The powers repeat with period `order`, which is the
  // statement that α generates the whole nonzero group.
  for (let i = 0; i < order; i++) exp[order + i] = exp[i]

  const need = (a) => {
    if (!Number.isInteger(a) || a < 0 || a >= size) throw new CodesError('gfm-element', `${a} is not an element of GF(2^${m})`)
    return a
  }
  const mul = (a, b) => (need(a) === 0 || need(b) === 0 ? 0 : exp[log[a] + log[b]])
  const inv = (a) => {
    if (need(a) === 0) throw new CodesError('gfm-inverse', 'zero has no inverse in any field')
    return exp[(order - log[a]) % order]
  }
  return {
    m,
    size,
    order,
    poly,
    exp,
    log,
    elements: Array.from({ length: size }, (_, i) => i),
    add: (a, b) => need(a) ^ need(b),
    sub: (a, b) => need(a) ^ need(b),
    mul,
    div: (a, b) => (need(a) === 0 ? 0 : mul(a, inv(b))),
    inv,
    pow: (a, k) => {
      if (need(a) === 0) return k === 0 ? 1 : 0
      const e = ((log[a] * k) % order + order) % order
      return exp[e]
    },
  }
}

/** GF(2⁴), from x⁴ + x + 1. Fifteen nonzero elements, each a power of α. */
export const GF16 = field(4)

/** GF(2⁸), from x⁸ + x⁴ + x³ + x² + 1. The byte field. */
export const GF256 = field(8)

/**
 * The order of an element: the smallest `k > 0` with `a^k = 1`.
 * The primitive element's order is the size of the field less one, which is
 * what makes the log table a bijection.
 */
export function orderOf(f, a) {
  if (a === 0) throw new CodesError('gfm-order', 'zero has no multiplicative order')
  let acc = a
  for (let k = 1; k <= f.order; k++) {
    if (acc === 1) return k
    acc = f.mul(acc, a)
  }
  throw new CodesError('gfm-order', `${a} has no finite order, which cannot happen in a field`)
}

/** An element as a polynomial in α, for a pane that prints the field. */
export function polyText(f, a) {
  if (a === 0) return '0'
  const terms = []
  for (let i = f.m - 1; i >= 0; i--) if ((a >> i) & 1) terms.push(i === 0 ? '1' : i === 1 ? 'α' : `α^${i}`)
  return terms.join(' + ')
}

/** Multiply two polynomials whose coefficients are field elements. */
export function polyMul(f, a, b) {
  const out = new Array(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] = f.add(out[i + j], f.mul(a[i], b[j]))
  return out
}

/** Evaluate a polynomial at `x` by Horner's rule. Coefficients are highest power first. */
export function polyEval(f, a, x) {
  return a.reduce((acc, c) => f.add(f.mul(acc, x), c), 0)
}

/** The remainder of `a` divided by `b`, both highest power first. */
export function polyMod(f, a, b) {
  const r = [...a]
  const lead = b[0]
  for (let i = 0; i + b.length <= r.length; i++) {
    if (r[i] === 0) continue
    const s = f.div(r[i], lead)
    for (let j = 0; j < b.length; j++) r[i + j] = f.sub(r[i + j], f.mul(s, b[j]))
  }
  return r.slice(r.length - (b.length - 1))
}

/**
 * Solve `A x = y` over the field, by Gaussian elimination.
 * Returns null when `A` is singular, which is how an erasure pattern that
 * cannot be filled reports itself.
 */
export function solve(f, A, y) {
  const n = A.length
  const M = A.map((row, i) => [...row, y[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    while (p < n && M[p][c] === 0) p++
    if (p === n) return null
    const t = M[c]
    M[c] = M[p]
    M[p] = t
    const iv = f.inv(M[c][c])
    for (let j = c; j <= n; j++) M[c][j] = f.mul(M[c][j], iv)
    for (let i = 0; i < n; i++) {
      if (i === c || M[i][c] === 0) continue
      const s = M[i][c]
      for (let j = c; j <= n; j++) M[i][j] = f.sub(M[i][j], f.mul(s, M[c][j]))
    }
  }
  return M.map((row) => row[n])
}
