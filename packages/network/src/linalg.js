// Dense linear algebra for systems of a few dozen unknowns.
//
// LU with partial pivoting. Nothing here needs to be fast; it needs to say
// clearly when a matrix is singular, because in this package a singular
// matrix is a circuit that has no unique answer, and that is a lesson rather
// than a crash.

export class SingularError extends Error {
  constructor(pivot, column) {
    super(`singular matrix (pivot ${pivot} at column ${column})`)
    this.name = 'SingularError'
    this.pivot = pivot
    this.column = column
  }
}

/**
 * Solve M x = r. `M` is an array of rows, copied before use. Relative pivot
 * threshold: a pivot below `eps` × the largest entry of the matrix is treated
 * as zero, which is what turns "1e-17 by rounding" into "singular" instead of
 * into a 1e17-volt answer.
 */
export function solve(M, r, eps = 1e-12) {
  const n = r.length
  const A = M.map((row) => row.slice())
  const b = r.slice()
  let scale = 0
  for (const row of A) for (const v of row) scale = Math.max(scale, Math.abs(v))
  if (scale === 0) scale = 1

  for (let c = 0; c < n; c++) {
    let p = c
    for (let k = c + 1; k < n; k++) if (Math.abs(A[k][c]) > Math.abs(A[p][c])) p = k
    if (Math.abs(A[p][c]) <= eps * scale) throw new SingularError(A[p][c], c)
    if (p !== c) {
      ;[A[p], A[c]] = [A[c], A[p]]
      ;[b[p], b[c]] = [b[c], b[p]]
    }
    for (let k = c + 1; k < n; k++) {
      const f = A[k][c] / A[c][c]
      if (f === 0) continue
      for (let j = c; j < n; j++) A[k][j] -= f * A[c][j]
      b[k] -= f * b[c]
    }
  }
  const x = new Array(n).fill(0)
  for (let k = n - 1; k >= 0; k--) {
    let s = b[k]
    for (let j = k + 1; j < n; j++) s -= A[k][j] * x[j]
    x[k] = s / A[k][k]
  }
  return x
}

/** The complex counterpart, for the phasor solve: entries are [re, im]. */
export function solveComplex(M, r, eps = 1e-12) {
  const n = r.length
  const A = M.map((row) => row.map((z) => [z[0], z[1]]))
  const b = r.map((z) => [z[0], z[1]])
  const abs = (z) => Math.hypot(z[0], z[1])
  const mul = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]]
  const div = (x, y) => {
    const d = y[0] * y[0] + y[1] * y[1]
    return [(x[0] * y[0] + x[1] * y[1]) / d, (x[1] * y[0] - x[0] * y[1]) / d]
  }
  const sub = (x, y) => [x[0] - y[0], x[1] - y[1]]
  let scale = 0
  for (const row of A) for (const z of row) scale = Math.max(scale, abs(z))
  if (scale === 0) scale = 1

  for (let c = 0; c < n; c++) {
    let p = c
    for (let k = c + 1; k < n; k++) if (abs(A[k][c]) > abs(A[p][c])) p = k
    if (abs(A[p][c]) <= eps * scale) throw new SingularError(abs(A[p][c]), c)
    if (p !== c) {
      ;[A[p], A[c]] = [A[c], A[p]]
      ;[b[p], b[c]] = [b[c], b[p]]
    }
    for (let k = c + 1; k < n; k++) {
      const f = div(A[k][c], A[c][c])
      if (f[0] === 0 && f[1] === 0) continue
      for (let j = c; j < n; j++) A[k][j] = sub(A[k][j], mul(f, A[c][j]))
      b[k] = sub(b[k], mul(f, b[c]))
    }
  }
  const x = new Array(n).fill([0, 0])
  for (let k = n - 1; k >= 0; k--) {
    let s = b[k]
    for (let j = k + 1; j < n; j++) s = sub(s, mul(A[k][j], x[j]))
    x[k] = div(s, A[k][k])
  }
  return x
}

/** Matrix–vector product. */
export function matVec(M, x) {
  return M.map((row) => row.reduce((s, v, j) => s + v * x[j], 0))
}
