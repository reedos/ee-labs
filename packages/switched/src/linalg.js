// Small dense linear algebra for the switched-circuit engine.
//
// Everything here is sized for converter state vectors (one or two states) and
// the augmented matrices the propagator builds from them (three times that).
// Plain arrays of rows; nothing is optimised beyond not allocating in loops
// that run per sample.

export function zeros(n, m = n) {
  return Array.from({ length: n }, () => new Array(m).fill(0))
}

export function eye(n) {
  const I = zeros(n)
  for (let i = 0; i < n; i++) I[i][i] = 1
  return I
}

export function matMul(A, B) {
  const n = A.length
  const k = B.length
  const m = B[0].length
  const C = zeros(n, m)
  for (let i = 0; i < n; i++) {
    const Ai = A[i]
    const Ci = C[i]
    for (let p = 0; p < k; p++) {
      const a = Ai[p]
      if (a === 0) continue
      const Bp = B[p]
      for (let j = 0; j < m; j++) Ci[j] += a * Bp[j]
    }
  }
  return C
}

export function matVec(A, x) {
  return A.map((row) => row.reduce((s, a, j) => s + a * x[j], 0))
}

export function matAdd(A, B, beta = 1) {
  return A.map((row, i) => row.map((a, j) => a + beta * B[i][j]))
}

export function matScale(A, k) {
  return A.map((row) => row.map((a) => a * k))
}

export function vecAdd(x, y, beta = 1) {
  return x.map((a, i) => a + beta * y[i])
}

export function vecScale(x, k) {
  return x.map((a) => a * k)
}

// Largest absolute column sum — the 1-norm, which is what the exponential's
// scaling step wants.
export function norm1(A) {
  let best = 0
  for (let j = 0; j < A[0].length; j++) {
    let s = 0
    for (let i = 0; i < A.length; i++) s += Math.abs(A[i][j])
    if (s > best) best = s
  }
  return best
}

// Solve A x = b by Gaussian elimination with partial pivoting. Throws on a
// singular matrix rather than returning NaNs, so a converter whose period map
// has a unit eigenvalue (nothing pins the state) fails loudly.
export function solve(A, b) {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (M[p][c] === 0) throw new Error('solve: singular matrix')
    if (p !== c) [M[p], M[c]] = [M[c], M[p]]
    const piv = M[c][c]
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / piv
      if (f === 0) continue
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]
    }
  }
  const x = new Array(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n]
    for (let j = r + 1; j < n; j++) s -= M[r][j] * x[j]
    x[r] = s / M[r][r]
  }
  return x
}
