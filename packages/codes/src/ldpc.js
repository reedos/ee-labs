// Low-density parity-check codes, as a graph and as message passing.
//
// The parity-check matrix is the code. Read as a graph it has one variable node
// per bit, one check node per row, and an edge wherever the matrix has a one.
// Belief propagation passes one number along each edge in each direction, and
// this module keeps every one of them at every iteration so that the Tanner
// graph view draws the decode rather than its result
// (INFORMATION_LAB_PLAN.md §2.7).
//
// The decoder is exact arithmetic on the log-likelihood ratios it is given. It
// is not maximum-likelihood decoding: belief propagation on a graph with cycles
// can converge to a word that is not the most likely one, and can fail to
// converge at all. That is a property of the algorithm, stated where it is
// used, and E3 shows a decode that does not converge.

import { CodesError, matVec, rank, weight } from './gf2.js'

/**
 * The Tanner graph of a parity-check matrix.
 *
 * @returns {{ n, m, edges, vars, checks, dv, dc, regular }}
 */
export function tannerGraph(H) {
  if (!H.length) throw new CodesError('ldpc-empty', 'a parity-check matrix needs at least one row')
  const m = H.length
  const n = H[0].length
  const edges = []
  const vars = Array.from({ length: n }, () => [])
  const checks = Array.from({ length: m }, () => [])
  for (let c = 0; c < m; c++)
    for (let v = 0; v < n; v++)
      if (H[c][v]) {
        const e = { index: edges.length, check: c, variable: v }
        edges.push(e)
        vars[v].push(e.index)
        checks[c].push(e.index)
      }
  const dv = vars.map((e) => e.length)
  const dc = checks.map((e) => e.length)
  const same = (a) => a.every((x) => x === a[0])
  return { n, m, edges, vars, checks, dv, dc, regular: same(dv) && same(dc), degreeV: dv[0], degreeC: dc[0] }
}

/** The syndrome of a word: one bit per check, zero where the check is satisfied. */
export const syndrome = (H, bits) => matVec(H, bits)

/** How many checks a word fails. Zero exactly on the codewords. */
export const syndromeWeight = (H, bits) => weight(syndrome(H, bits))

/**
 * The rate of the code, and the rate its degrees promise.
 *
 * A regular code with `d_v` ones per column and `d_c` per row has `m/n = d_v/d_c`,
 * so its design rate is `1 − d_v/d_c`. That is the true rate only when the rows
 * are independent. Every column of a `d_v = 2` matrix has even weight, so the
 * rows of one always sum to zero and the rank is at most `m − 1`.
 *
 * @returns {{ n, m, rank, rate, designRate, dependent }}
 */
export function rateOf(H) {
  const g = tannerGraph(H)
  const rk = rank(H)
  const design = g.regular ? 1 - g.degreeV / g.degreeC : 1 - g.m / g.n
  return { n: g.n, m: g.m, rank: rk, rate: 1 - rk / g.n, designRate: design, dependent: g.m - rk }
}

/**
 * Belief propagation, the sum-product decoder, with every iteration retained.
 *
 * The messages are log-likelihood ratios, `log P(bit = 0) / P(bit = 1)`, so a
 * positive number argues for 0 and the sign of the total is the decision.
 *
 * @param {number[][]} H
 * @param {number[]} llr        one channel value per bit
 * @param {object} [opts]       `maxIter`, and `stopEarly` to run past convergence
 * @returns {{
 *   bits, converged, iteration, iterations, syndromeWeights, posterior
 * }} `iterations[i]` holds `{ toCheck, toVar, posterior, bits, syndromeWeight }`,
 *   each edge's message in both directions at that iteration.
 */
export function sumProduct(H, llr, { maxIter = 20, stopEarly = true } = {}) {
  const g = tannerGraph(H)
  if (llr.length !== g.n) throw new CodesError('ldpc-input', `this code has ${g.n} bits, and ${llr.length} beliefs were given`)
  const toCheck = g.edges.map((e) => llr[e.variable])
  const toVar = g.edges.map(() => 0)
  const iterations = []
  let bits = hardOf(llr)
  let converged = syndromeWeight(H, bits) === 0
  // The iteration the syndrome first reached zero at, which is what a pane
  // prints. Running past convergence does not move it.
  let firstZero = 0
  if (converged) {
    iterations.push({ iteration: 0, toCheck: [...toCheck], toVar: [...toVar], posterior: [...llr], bits, syndromeWeight: 0 })
    return done(H, llr, bits, iterations, true, 0)
  }
  for (let it = 1; it <= maxIter; it++) {
    // Check to variable: the product of the tanh of the others, back through
    // the inverse tanh. Written as the sign and the magnitude separately, so a
    // message of zero from one edge does not take the product to zero for all.
    for (let c = 0; c < g.m; c++) {
      const es = g.checks[c]
      for (const e of es) {
        let prod = 1
        for (const f of es) if (f !== e) prod *= Math.tanh(clamp(toCheck[f]) / 2)
        toVar[e] = 2 * atanhSafe(prod)
      }
    }
    // Variable to check: the channel value plus what every other check says.
    const posterior = new Array(g.n).fill(0)
    for (let v = 0; v < g.n; v++) {
      let sum = llr[v]
      for (const e of g.vars[v]) sum += toVar[e]
      posterior[v] = sum
      for (const e of g.vars[v]) toCheck[e] = sum - toVar[e]
    }
    bits = hardOf(posterior)
    const w = syndromeWeight(H, bits)
    iterations.push({ iteration: it, toCheck: [...toCheck], toVar: [...toVar], posterior, bits, syndromeWeight: w })
    if (w === 0) {
      if (!converged) firstZero = it
      converged = true
      if (stopEarly) return done(H, llr, bits, iterations, true, firstZero)
    }
  }
  return done(H, llr, bits, iterations, converged, converged ? firstZero : null)
}

const done = (H, llr, bits, iterations, converged, iteration) => ({
  bits,
  converged,
  iteration,
  iterations,
  syndromeWeights: iterations.map((i) => i.syndromeWeight),
  posterior: iterations.length ? iterations[iterations.length - 1].posterior : llr,
})

/** The hard decision from a belief: positive argues for 0. */
export const hardOf = (llr) => llr.map((v) => (v < 0 ? 1 : 0))

const clamp = (x) => Math.max(-30, Math.min(30, x))
// tanh reaches ±1 in double precision at about 19, and the inverse of exactly
// ±1 is infinite. Holding the product just inside keeps a confident message
// large and finite, which is what the arithmetic means.
const atanhSafe = (x) => Math.atanh(Math.max(-1 + 1e-15, Math.min(1 - 1e-15, x)))

/**
 * The lab's own code: 12 bits, 8 checks, two checks per bit and three bits per
 * check. Small enough that every node and edge fits on a phone screen.
 *
 * The eight checks are two partitions of the twelve bits into groups of three.
 * No two bits share two checks, so the graph has no four-cycle and its girth
 * is six.
 */
export const L12_CHECKS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
  [0, 3, 6],
  [1, 4, 9],
  [2, 7, 10],
  [5, 8, 11],
]

/** A parity-check matrix from a list of checks, each naming the bits it covers. */
export function matrixOf(checks, n) {
  return checks.map((row) => {
    const r = new Array(n).fill(0)
    for (const v of row) {
      if (v < 0 || v >= n) throw new CodesError('ldpc-index', `bit ${v} is not one of the ${n} bits`)
      r[v] = 1
    }
    return r
  })
}

/** The drawable code, as a matrix. */
export const L12 = () => matrixOf(L12_CHECKS, 12)

/**
 * A regular code from circulant permutations, the array construction.
 *
 * `H` is a `d_v` by `d_c` grid of blocks, each a `p` by `p` identity matrix
 * cyclically shifted by `i·j`. Its length is `p·d_c` and it has `p·d_v` checks,
 * so its design rate is `1 − d_v/d_c` like any regular code.
 *
 * The shifts make the girth six or more whenever `p` is prime and both degrees
 * are below it. Two bits share two checks only if `(i₁ − i₂)(j₁ − j₂) = 0` in
 * the integers modulo `p`, and a prime modulus has no zero divisors. So the
 * graph has no four-cycle by construction rather than by search, and
 * `fourCycles` measures it to be sure.
 *
 * @returns {{ H, n, m, dv, dc, p, checks, fourCycles }}
 */
export function arrayLdpc({ p = 17, dv = 3, dc = 6 } = {}) {
  if (!isPrime(p)) throw new CodesError('ldpc-shape', `the array construction needs a prime block size, and ${p} is not one`)
  if (dv >= p || dc >= p) throw new CodesError('ldpc-shape', `a block size of ${p} carries degrees below ${p}, not ${dv} and ${dc}`)
  const n = p * dc
  const checks = []
  for (let i = 0; i < dv; i++)
    for (let r = 0; r < p; r++) {
      const row = []
      for (let j = 0; j < dc; j++) row.push(j * p + ((r + i * j) % p))
      checks.push(row)
    }
  const H = matrixOf(checks, n)
  return { H, n, m: checks.length, dv, dc, p, checks, fourCycles: fourCycles(H) }
}

/** How many pairs of bits share two checks. Zero is a girth of six or more. */
export function fourCycles(H) {
  const g = tannerGraph(H)
  let count = 0
  for (let a = 0; a < g.n; a++)
    for (let b = a + 1; b < g.n; b++) {
      let shared = 0
      for (const e of g.vars[a]) for (const f of g.vars[b]) if (g.edges[e].check === g.edges[f].check) shared++
      if (shared > 1) count++
    }
  return count
}

const isPrime = (x) => {
  if (!Number.isInteger(x) || x < 2) return false
  for (let d = 2; d * d <= x; d++) if (x % d === 0) return false
  return true
}

/** The larger code the iteration experiments run on: 102 bits, 51 checks, girth six. */
export const L102 = () => arrayLdpc({ p: 17, dv: 3, dc: 6 })
