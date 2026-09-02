// Small dense matrices and the matrix exponential.
//
// The time-domain engine (transient.js) needs e^{Mt} for matrices of a few
// rows — the circuit's states plus two rows that carry a ramping input. Padé
// approximation with scaling and squaring (Higham 2005) is exact to floating
// point for such sizes, and it needs no inverse of A, so an undamped LC — a
// singular A whose exponential is a rotation — comes out as well as anything
// else. Balancing first keeps a state measured in volts and one measured in
// milliamps from swamping each other in the squarings.

import { solve } from './linalg.js'

export const zeros = (n, m = n) => Array.from({ length: n }, () => new Array(m).fill(0))
export const eye = (n) => zeros(n).map((row, i) => ((row[i] = 1), row))

export function matMul(A, B) {
  const n = A.length
  const m = B[0].length
  const k = B.length
  const C = zeros(n, m)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      let s = 0
      for (let q = 0; q < k; q++) s += A[i][q] * B[q][j]
      C[i][j] = s
    }
  return C
}

export const matAdd = (A, B) => A.map((row, i) => row.map((v, j) => v + B[i][j]))
export const matScale = (A, c) => A.map((row) => row.map((v) => v * c))
export const matVecMul = (A, x) => A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0))

/** The 1-norm: the largest column sum of absolute values. */
export function norm1(A) {
  let best = 0
  for (let j = 0; j < A.length; j++) {
    let s = 0
    for (let i = 0; i < A.length; i++) s += Math.abs(A[i][j])
    best = Math.max(best, s)
  }
  return best
}

/**
 * Diagonal similarity scaling by powers of two, so no row or column
 * dominates: returns B = D⁻¹ A D and the diagonal d of D.
 */
export function balance(A) {
  const n = A.length
  const B = A.map((row) => row.slice())
  const d = new Array(n).fill(1)
  for (let sweep = 0; sweep < 100; sweep++) {
    let converged = true
    for (let i = 0; i < n; i++) {
      let c = 0
      let r = 0
      for (let j = 0; j < n; j++) {
        if (j === i) continue
        c += Math.abs(B[j][i])
        r += Math.abs(B[i][j])
      }
      if (c === 0 || r === 0) continue
      const s = c + r
      let f = 1
      while (c < r / 2) {
        c *= 2
        r /= 2
        f *= 2
      }
      while (c >= r * 2) {
        c /= 2
        r *= 2
        f /= 2
      }
      if (c + r < 0.95 * s) {
        converged = false
        d[i] *= f
        for (let j = 0; j < n; j++) {
          B[i][j] /= f
          B[j][i] *= f
        }
      }
    }
    if (converged) break
  }
  return { B, d }
}

// Padé [13/13] coefficients and the norm below which the approximant is
// accurate to double precision.
const PADE13 = [
  64764752532480000, 32382376266240000, 7771770303897600, 1187353796428800, 129060195264000, 10559470521600,
  670442572800, 33522128640, 1323241920, 40840800, 960960, 16380, 182, 1,
]
const THETA13 = 5.371920351148152

function expmPade(A) {
  const n = A.length
  const nrm = norm1(A)
  const s = nrm > THETA13 ? Math.ceil(Math.log2(nrm / THETA13)) : 0
  const X = s ? matScale(A, 1 / 2 ** s) : A
  const b = PADE13
  const I = eye(n)
  const X2 = matMul(X, X)
  const X4 = matMul(X2, X2)
  const X6 = matMul(X4, X2)
  const lin = (...terms) => {
    let out = zeros(n)
    for (const [c, M] of terms) out = matAdd(out, matScale(M, c))
    return out
  }
  const U = matMul(X, matAdd(matMul(X6, lin([b[13], X6], [b[11], X4], [b[9], X2])), lin([b[7], X6], [b[5], X4], [b[3], X2], [b[1], I])))
  const V = matAdd(matMul(X6, lin([b[12], X6], [b[10], X4], [b[8], X2])), lin([b[6], X6], [b[4], X4], [b[2], X2], [b[0], I]))
  const P = matAdd(V, U)
  const Q = matAdd(V, matScale(U, -1))
  // R = Q⁻¹ P, column by column.
  let R = zeros(n)
  for (let j = 0; j < n; j++) {
    const col = solve(
      Q,
      P.map((row) => row[j]),
    )
    for (let i = 0; i < n; i++) R[i][j] = col[i]
  }
  for (let k = 0; k < s; k++) R = matMul(R, R)
  return R
}

/** e^{M} for a square matrix M. */
export function expm(M) {
  const n = M.length
  if (n === 0) return []
  if (n === 1) return [[Math.exp(M[0][0])]]
  const { B, d } = balance(M)
  const E = expmPade(B)
  return E.map((row, i) => row.map((v, j) => (v * d[i]) / d[j]))
}

/**
 * The 2×2 exponential in closed form, by the three cases the second-order
 * lesson teaches: with α = tr/2 and Δ = α² − det,
 *   Δ > 0  →  e^{αt}[cosh βt − (α/β) sinh βt] I + e^{αt} (sinh βt / β) A,
 *   Δ < 0  →  the same with cos, sin and β = √(−Δ),
 *   Δ = 0  →  e^{αt}(1 − αt) I + e^{αt} t A.
 * Kept as an independent path for the tests; the engine uses expm.
 */
export function expm2(A, t) {
  const alpha = (A[0][0] + A[1][1]) / 2
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
  const delta = alpha * alpha - det
  const ea = Math.exp(alpha * t)
  let c0
  let c1
  if (Math.abs(delta) < 1e-12 * Math.max(alpha * alpha, Math.abs(det), 1e-300)) {
    c0 = ea * (1 - alpha * t)
    c1 = ea * t
  } else if (delta > 0) {
    const beta = Math.sqrt(delta)
    c0 = ea * (Math.cosh(beta * t) - (alpha / beta) * Math.sinh(beta * t))
    c1 = (ea * Math.sinh(beta * t)) / beta
  } else {
    const beta = Math.sqrt(-delta)
    c0 = ea * (Math.cos(beta * t) - (alpha / beta) * Math.sin(beta * t))
    c1 = (ea * Math.sin(beta * t)) / beta
  }
  return [
    [c0 + c1 * A[0][0], c1 * A[0][1]],
    [c1 * A[1][0], c0 + c1 * A[1][1]],
  ]
}

/**
 * Coefficients of det(sI − A), highest power first, by Faddeev–LeVerrier —
 * exact arithmetic on the matrix, no eigenvalues involved. For n = 2 this is
 * [1, −tr A, det A]: the characteristic equation the RLC lesson writes down.
 */
export function charPoly(A) {
  const n = A.length
  const c = new Array(n + 1).fill(0)
  c[0] = 1
  let M = zeros(n)
  for (let k = 1; k <= n; k++) {
    // M_k = A M_{k−1} + c_{k−1} I ; c_k = −tr(A M_k) / k
    M = matAdd(matMul(A, M), matScale(eye(n), c[k - 1]))
    const AM = matMul(A, M)
    let tr = 0
    for (let i = 0; i < n; i++) tr += AM[i][i]
    c[k] = -tr / k
  }
  return c
}
