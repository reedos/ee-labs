import { describe, it, expect } from 'vitest'
import {
  add,
  expm,
  eye,
  faddeev,
  inverse,
  maxAbs,
  mul,
  mulVec,
  normInf,
  polyOfMatrix,
  rank,
  scale,
  singularValues,
  solve,
  trace,
  transpose,
  vecMul,
  zeros,
} from './matrix.js'

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

describe('the arithmetic', () => {
  it('multiplies, transposes and traces the way the definitions say', () => {
    const A = [
      [1, 2],
      [3, 4],
    ]
    const B = [
      [5, 6],
      [7, 8],
    ]
    expect(mul(A, B)).toEqual([
      [19, 22],
      [43, 50],
    ])
    expect(transpose(A)).toEqual([
      [1, 3],
      [2, 4],
    ])
    expect(trace(A)).toBe(5)
    expect(mulVec(A, [1, 1])).toEqual([3, 7])
    expect(vecMul([1, 1], A)).toEqual([4, 6])
    expect(normInf(A)).toBe(7)
    expect(maxAbs(A)).toBe(4)
    expect(add(A, scale(A, -1))).toEqual(zeros(2))
  })

  it('leaves its arguments alone', () => {
    const A = [
      [1, 2],
      [3, 4],
    ]
    const before = JSON.stringify(A)
    mul(A, eye(2))
    scale(A, 3)
    expm(A)
    inverse(A)
    solve(A, [1, 1])
    expect(JSON.stringify(A)).toBe(before)
  })

  it('solves and inverts, and says null rather than returning infinities', () => {
    const A = [
      [2, 1],
      [1, 3],
    ]
    const x = solve(A, [5, 10])
    expect(mulVec(A, x)[0]).toBeCloseTo(5, 12)
    expect(mulVec(A, x)[1]).toBeCloseTo(10, 12)
    const Ai = inverse(A)
    const I = mul(A, Ai)
    expect(I[0][0]).toBeCloseTo(1, 12)
    expect(I[0][1]).toBeCloseTo(0, 12)
    const singular = [
      [1, 2],
      [2, 4],
    ]
    expect(solve(singular, [1, 2])).toBeNull()
    expect(inverse(singular)).toBeNull()
  })
})

describe('rank, and how far from losing one', () => {
  it('a full-rank matrix has every singular value above the tolerance', () => {
    const r = rank([
      [1, 0],
      [0, 2],
    ])
    expect(r.rank).toBe(2)
    expect(r.singularValues[0]).toBeCloseTo(2, 12)
    expect(r.singularValues[1]).toBeCloseTo(1, 12)
    expect(r.condition).toBeCloseTo(2, 12)
  })

  it('a rank-deficient one loses exactly the ranks it should', () => {
    expect(
      rank([
        [1, 2],
        [2, 4],
      ]).rank,
    ).toBe(1)
    expect(
      rank([
        [1, 2, 3],
        [2, 4, 6],
        [3, 6, 9],
      ]).rank,
    ).toBe(1)
    expect(rank(zeros(3)).rank).toBe(0)
  })

  it('the answer does not depend on the units the matrix is written in', () => {
    const M = [
      [1, 0.5],
      [0.25, 3],
    ]
    for (const s of [1e-9, 1, 1e9]) {
      expect(rank(scale(M, s)).rank, `scaled by ${s}`).toBe(2)
    }
  })

  it('the singular values are the square roots of the eigenvalues of M M transpose', () => {
    const rand = rng(4711)
    for (let trial = 0; trial < 40; trial++) {
      const M = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => (rand() - 0.5) * 4))
      const sv = singularValues(M)
      // Their product is the absolute determinant, and their squares sum to
      // the sum of the squared entries. Both are independent of the routine.
      const det = Math.abs(
        M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
          M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
          M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]),
      )
      expect(sv[0] * sv[1] * sv[2], `trial ${trial} determinant`).toBeCloseTo(det, 9)
      let frob = 0
      for (const row of M) for (const v of row) frob += v * v
      expect(sv.reduce((s, v) => s + v * v, 0), `trial ${trial} norm`).toBeCloseTo(frob, 9)
    }
  })
})

describe('the matrix exponential', () => {
  it('a diagonal matrix exponentiates entry by entry', () => {
    const E = expm([
      [-1, 0],
      [0, -3],
    ])
    expect(E[0][0]).toBeCloseTo(Math.exp(-1), 14)
    expect(E[1][1]).toBeCloseTo(Math.exp(-3), 14)
    expect(E[0][1]).toBe(0)
  })

  it('a rotation generator exponentiates to a rotation', () => {
    const th = 0.7
    const E = expm([
      [0, -th],
      [th, 0],
    ])
    expect(E[0][0]).toBeCloseTo(Math.cos(th), 13)
    expect(E[0][1]).toBeCloseTo(-Math.sin(th), 13)
    expect(E[1][0]).toBeCloseTo(Math.sin(th), 13)
  })

  it('matches the triangular closed form, and loses digits only where the squaring does', () => {
    // For an upper triangular A the exponential has a closed form, so it is
    // the reference rather than a second numerical route.
    //
    // The error grows with the SPREAD of the eigenvalues, because scaling and
    // squaring squares a matrix once per octave of the norm and each squaring
    // roughly doubles the relative error. Three decades of spread, which is
    // what a loop with a fast and a slow pole sampled near the fast one looks
    // like, costs a part in 1e12. Eight decades costs a part in 1e8. Both are
    // recorded here so the boundary is stated rather than discovered.
    const closedForm = (a, b, d) => ({
      e00: Math.exp(a),
      e11: Math.exp(d),
      e01: (b * (Math.exp(a) - Math.exp(d))) / (a - d),
    })
    for (const [d, tol] of [[-10, 1e-13], [-1e3, 1e-11], [-1e8, 1e-8]]) {
      const a = -1
      const b = 1
      const E = expm([
        [a, b],
        [0, d],
      ])
      const want = closedForm(a, b, d)
      expect(E[1][0], `d = ${d}`).toBe(0)
      expect(Math.abs(E[0][0] / want.e00 - 1), `d = ${d}, e00`).toBeLessThan(tol)
      expect(Math.abs(E[0][1] / want.e01 - 1), `d = ${d}, e01`).toBeLessThan(tol)
      expect(Math.abs(E[1][1] - want.e11), `d = ${d}, e11`).toBeLessThan(1e-15)
    }
  })

  it('e^(A s) e^(A t) is e^(A (s + t)), which is what makes stepping by samples exact', () => {
    const A = [
      [-1, 4],
      [-4, -1e3],
    ]
    const s = 0.3
    const t = 0.7
    const lhs = mul(expm(scale(A, s)), expm(scale(A, t)))
    const rhs = expm(scale(A, s + t))
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        expect(Math.abs(lhs[i][j] - rhs[i][j]) / Math.max(1, maxAbs(rhs))).toBeLessThan(1e-12)
      }
    }
  })

  it('the exponential of a sum of commuting matrices is the product', () => {
    const A = [
      [-2, 0],
      [0, -5],
    ]
    const B = [
      [-0.5, 0],
      [0, 1],
    ]
    const lhs = expm(add(A, B))
    const rhs = mul(expm(A), expm(B))
    expect(lhs[0][0]).toBeCloseTo(rhs[0][0], 12)
    expect(lhs[1][1]).toBeCloseTo(rhs[1][1], 12)
  })
})

describe('Faddeev-LeVerrier', () => {
  it('gives the characteristic polynomial a hand calculation gives', () => {
    // [[0,1],[-6,-5]]: s^2 + 5s + 6.
    const { poly } = faddeev([
      [0, 1],
      [-6, -5],
    ])
    expect(poly[0]).toBe(1)
    expect(poly[1]).toBeCloseTo(5, 12)
    expect(poly[2]).toBeCloseTo(6, 12)
  })

  it('INVARIANT: Cayley-Hamilton, a matrix satisfies its own characteristic polynomial', () => {
    const rand = rng(2718)
    let worst = 0
    for (let trial = 0; trial < 120; trial++) {
      const n = 2 + Math.floor(rand() * 3)
      const A = Array.from({ length: n }, () => Array.from({ length: n }, () => (rand() - 0.5) * 6))
      const { poly } = faddeev(A)
      const should = polyOfMatrix(A, poly)
      worst = Math.max(worst, maxAbs(should) / Math.max(maxAbs(A), 1))
    }
    expect(worst, 'worst Cayley-Hamilton residual').toBeLessThan(1e-9)
  })

  it('the adjugate coefficients reconstruct the inverse away from the poles', () => {
    const A = [
      [0, 1],
      [-6, -5],
    ]
    const { poly, adj } = faddeev(A)
    const s = 2 // not an eigenvalue
    // (sI - A)^-1 = (adj[0] s^(n-1) + adj[1] s^(n-2) + ...) / charpoly(s)
    let num = zeros(2)
    for (let k = 0; k < adj.length; k++) num = add(num, scale(adj[k], Math.pow(s, adj.length - 1 - k)))
    const den = poly.reduce((acc, c, i) => acc + c * Math.pow(s, poly.length - 1 - i), 0)
    const got = scale(num, 1 / den)
    const want = inverse(add(scale(eye(2), s), scale(A, -1)))
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) expect(got[i][j]).toBeCloseTo(want[i][j], 12)
    }
  })
})
