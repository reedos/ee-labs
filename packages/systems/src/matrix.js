// Dense linear algebra, at the sizes a control lesson works at.
//
// A state space of order two to six is what this package trades in, so the
// routines here are the direct ones: LU with partial pivoting, one-sided
// Jacobi for the singular values, and the matrix exponential by scaling and
// squaring. None of them is a general-purpose library. Each is written so its
// error is bounded by the arithmetic rather than by an iteration count, and
// each reports what it could not do rather than returning a plausible number.
//
// Matrices are arrays of row arrays. Vectors are plain arrays. Every routine
// leaves its arguments untouched.

/** An n by m matrix of zeros. */
export const zeros = (n, m = n) => Array.from({ length: n }, () => new Array(m).fill(0))

/** The n by n identity. */
export const eye = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))

/** A copy, so a caller's matrix is never written through. */
export const copy = (A) => A.map((r) => [...r])

/** Matrix product. */
export function mul(A, B) {
  const n = A.length
  const k = B.length
  const m = k ? B[0].length : 0
  const out = zeros(n, m)
  for (let i = 0; i < n; i++) {
    for (let p = 0; p < k; p++) {
      const a = A[i][p]
      if (a === 0) continue
      for (let j = 0; j < m; j++) out[i][j] += a * B[p][j]
    }
  }
  return out
}

/** Matrix times column vector. */
export function mulVec(A, x) {
  return A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0))
}

/** Row vector times matrix. */
export function vecMul(x, A) {
  const m = A.length ? A[0].length : 0
  const out = new Array(m).fill(0)
  for (let i = 0; i < A.length; i++) {
    const xi = x[i]
    if (xi === 0) continue
    for (let j = 0; j < m; j++) out[j] += xi * A[i][j]
  }
  return out
}

/** Sum of two matrices. */
export const add = (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j]))

/** Every entry times a scalar. */
export const scale = (A, k) => A.map((r) => r.map((v) => v * k))

/** Transpose. */
export function transpose(A) {
  const n = A.length
  const m = n ? A[0].length : 0
  return Array.from({ length: m }, (_, j) => Array.from({ length: n }, (_, i) => A[i][j]))
}

/** Sum of the diagonal. */
export const trace = (A) => A.reduce((s, r, i) => s + r[i], 0)

/** The largest absolute row sum. */
export function normInf(A) {
  let best = 0
  for (const row of A) best = Math.max(best, row.reduce((s, v) => s + Math.abs(v), 0))
  return best
}

/** The largest absolute entry. */
export function maxAbs(A) {
  let best = 0
  for (const row of A) for (const v of row) best = Math.max(best, Math.abs(v))
  return best
}

/**
 * Solve A x = b by LU with partial pivoting.
 *
 * Returns null when the matrix is singular to working precision, rather than a
 * vector of infinities. A caller that cannot proceed without the solution says
 * so with its own message, which is the reason the reader gets.
 */
export function solve(A, b) {
  const n = A.length
  const M = A.map((r, i) => [...r, b[i]])
  const scaleOf = Math.max(maxAbs(A), Number.MIN_VALUE)
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    if (Math.abs(M[piv][c]) < 1e-14 * scaleOf) return null
    if (piv !== c) {
      const t = M[piv]
      M[piv] = M[c]
      M[c] = t
    }
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c]
      if (f === 0) continue
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = new Array(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n]
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]
    x[r] = s / M[r][r]
  }
  return x
}

/** The inverse, column by column through solve(). Null when singular. */
export function inverse(A) {
  const n = A.length
  const cols = []
  for (let j = 0; j < n; j++) {
    const e = new Array(n).fill(0)
    e[j] = 1
    const c = solve(A, e)
    if (!c) return null
    cols.push(c)
  }
  return transpose(cols)
}

/**
 * Singular values, largest first, by one-sided Jacobi.
 *
 * Rank is the question every controllability pane asks, and counting pivots in
 * an elimination answers it only for a matrix that is far from singular. The
 * singular values answer it with a number a reader can see shrink: a plant
 * approaching uncontrollability does not lose a pivot, it loses a decade of
 * sigma_min, and the pane can show that happening.
 */
export function singularValues(M) {
  const m = M.length
  const n = m ? M[0].length : 0
  if (!m || !n) return []
  // Work on the taller orientation so the columns being rotated are the
  // shorter set, which is what one-sided Jacobi orthogonalises.
  const W = m >= n ? copy(M) : transpose(M)
  const rows = W.length
  const cols = W[0].length
  const colDot = (a, b) => {
    let s = 0
    for (let i = 0; i < rows; i++) s += W[i][a] * W[i][b]
    return s
  }
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0
    for (let p = 0; p < cols - 1; p++) {
      for (let q = p + 1; q < cols; q++) {
        const app = colDot(p, p)
        const aqq = colDot(q, q)
        const apq = colDot(p, q)
        const scaleOf = Math.sqrt(app * aqq)
        if (scaleOf === 0 || Math.abs(apq) <= 1e-17 * scaleOf) continue
        off = Math.max(off, Math.abs(apq) / scaleOf)
        const tau = (aqq - app) / (2 * apq)
        const t = Math.sign(tau || 1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau))
        const c = 1 / Math.sqrt(1 + t * t)
        const s = c * t
        for (let i = 0; i < rows; i++) {
          const wp = W[i][p]
          const wq = W[i][q]
          W[i][p] = c * wp - s * wq
          W[i][q] = s * wp + c * wq
        }
      }
    }
    if (off < 1e-15) break
  }
  const out = []
  for (let j = 0; j < cols; j++) out.push(Math.sqrt(Math.max(0, colDot(j, j))))
  return out.sort((a, b) => b - a)
}

/**
 * Rank, with the tolerance it used and the singular values behind it.
 *
 * The tolerance is relative to the largest singular value, so it carries no
 * assumption about the units the matrix is written in. A controllability
 * matrix built from a plant in radians per second and one built from the same
 * plant in kilohertz get the same answer.
 */
export function rank(M, relTol = 1e-9) {
  const sv = singularValues(M)
  const top = sv[0] || 0
  const tol = relTol * top
  return {
    rank: sv.filter((s) => s > tol).length,
    singularValues: sv,
    tol,
    // How far from losing a rank the matrix is, as one number. Infinity when
    // it already has.
    condition: sv.length && sv[sv.length - 1] > 0 ? top / sv[sv.length - 1] : Infinity,
  }
}

/**
 * The matrix exponential, by scaling and squaring with a Taylor series.
 *
 * Divide by a power of two until the norm is under 1/32, sum the series to
 * twenty-four terms, then square back up. At that norm the first omitted term
 * is below 1e-40 of the first kept one, so the truncation is far under the
 * arithmetic. Pade would take fewer terms and no fewer operations at this
 * size, and the series is the one whose error a reader can bound by hand.
 *
 * What the squaring costs is measured in matrix.test.js. One squaring happens
 * per octave of the norm, and each roughly doubles the relative error, so the
 * accuracy falls with the SPREAD of the eigenvalues rather than with the
 * order: three decades of spread costs a part in 1e12, and eight decades a
 * part in 1e8.
 */
export function expm(A) {
  const n = A.length
  if (!n) return []
  const nrm = normInf(A)
  const s = nrm > 0 ? Math.max(0, Math.ceil(Math.log2(nrm)) + 5) : 0
  const N = scale(A, Math.pow(2, -s))
  let term = eye(n)
  let sum = eye(n)
  for (let k = 1; k <= 24; k++) {
    term = scale(mul(term, N), 1 / k)
    sum = add(sum, term)
  }
  for (let k = 0; k < s; k++) sum = mul(sum, sum)
  return sum
}

/**
 * The characteristic polynomial, by Faddeev-LeVerrier, and the adjugate's
 * coefficient matrices alongside it.
 *
 * The recurrence gives both in one pass, which is what a state space to
 * transfer function conversion needs: the denominator is the polynomial and
 * the numerator is C times each coefficient matrix times B.
 *
 * @returns {{ poly: number[], adj: number[][][] }} poly is monic, highest
 *   power first, length n + 1. adj[k] multiplies s^(n - 1 - k).
 */
export function faddeev(A) {
  const n = A.length
  const poly = new Array(n + 1).fill(0)
  poly[0] = 1
  const adj = []
  let M = eye(n)
  for (let k = 1; k <= n; k++) {
    adj.push(M)
    const AM = mul(A, M)
    const c = -trace(AM) / k
    poly[k] = c
    M = add(AM, scale(eye(n), c))
  }
  return { poly, adj }
}

/** A polynomial in A: sum of coeffs[k] * A^(n - k), coeffs highest power first. */
export function polyOfMatrix(A, coeffs) {
  const n = A.length
  let out = zeros(n)
  let power = eye(n)
  for (let k = coeffs.length - 1; k >= 0; k--) {
    out = add(out, scale(power, coeffs[k]))
    if (k > 0) power = mul(power, A)
  }
  return out
}
