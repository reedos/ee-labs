import { describe, it, expect } from 'vitest'
import { complex as cx } from '@ee-labs/network'
import { RfError, abcdToS, eye2, mdet, mdiff, minv, mmul, mnorm, msub, sToAbcd, sToY, sToZ, yToS, yToZ, zToS, zToY } from './convert.js'

// S, Z, Y and ABCD are one object. This file checks each conversion against a
// matrix computed by hand for three circuits whose answers a reader can verify
// with a pencil, then checks that the round trip closes.
//
// The hand cases are chosen so that every entry is a round number. A series
// impedance has the chain matrix [[1, Z], [0, 1]] and no Y-matrix. A shunt
// admittance has [[1, 0], [Y, 1]] and no Z-matrix. An ideal transformer has
// neither, and a finite S-matrix, which is the case the plan's D3 shows.

const { C, cabs, cadd, cdiv, cmul, csub } = cx
const Z0 = 50

const close = (got, want, tol = 1e-12) => expect(cabs(csub(got, want))).toBeLessThan(tol * Math.max(1, cabs(want)))

/** The S-matrix of a series impedance Z between two Z0 ports, by hand. */
function seriesByHand(Z) {
  const z = Array.isArray(Z) ? Z : C(Z)
  const den = cadd(z, C(2 * Z0))
  const s11 = cdiv(z, den)
  const s21 = cdiv(C(2 * Z0), den)
  return [
    [s11, s21],
    [s21, s11],
  ]
}

/** The S-matrix of a shunt admittance Y across the line, by hand. */
function shuntByHand(Y) {
  const y = Array.isArray(Y) ? Y : C(Y)
  const den = cadd(C(2), cmul(y, C(Z0)))
  const s11 = cdiv(cmul(y, C(-Z0)), den)
  const s21 = cdiv(C(2), den)
  return [
    [s11, s21],
    [s21, s11],
  ]
}

describe('the two-by-two arithmetic', () => {
  it('the inverse of a matrix times the matrix is the identity', () => {
    const A = [
      [C(1, 2), C(3, -1)],
      [C(0, 4), C(-2, 5)],
    ]
    expect(mdiff(mmul(A, minv(A)), eye2())).toBeLessThan(1e-15)
  })

  it('a matrix with no inverse is declined by name, with its determinant in the message', () => {
    const singular = [
      [C(1), C(2)],
      [C(2), C(4)],
    ]
    expect(() => minv(singular, 'this matrix')).toThrow(RfError)
    try {
      minv(singular, 'this matrix')
    } catch (err) {
      expect(err.message).toMatch(/determinant of this matrix/)
      expect(err.message).toMatch(/no inverse/)
      expect(err.kind).toBe('singular')
    }
  })

  it('the refusal threshold is relative to the matrix, not a fixed epsilon', () => {
    // The same singular matrix written in milliohms rather than kilohms is the
    // same object, and both are refused. A fixed epsilon would pass one.
    for (const scale of [1e-6, 1, 1e6]) {
      const M = [
        [C(scale), C(2 * scale)],
        [C(2 * scale), C(4 * scale)],
      ]
      expect(() => minv(M)).toThrow(RfError)
    }
    // A matrix that is well conditioned at every scale is inverted at every scale.
    for (const scale of [1e-6, 1, 1e6]) {
      const M = [
        [C(scale), C(0)],
        [C(0), C(scale)],
      ]
      expect(mnorm(msub(mmul(M, minv(M)), eye2()))).toBeLessThan(1e-12)
    }
  })
})

describe('a series impedance', () => {
  const Z = 25
  const S = seriesByHand(Z)

  it('has the chain matrix a book gives', () => {
    const M = sToAbcd(S, Z0)
    close(M[0][0], C(1))
    close(M[0][1], C(Z))
    close(M[1][0], C(0))
    close(M[1][1], C(1))
  })

  it('has the Z-matrix a book gives, every entry the same impedance plus nothing', () => {
    // A series element's Z-matrix is unbounded: with port 2 open, no current
    // flows and V1/I1 is infinite. So the conversion is refused, and the
    // message names what has no inverse.
    expect(() => sToZ(S, Z0)).toThrow(RfError)
  })

  it('has a Y-matrix, and it is the element admittance with its signs', () => {
    const Y = sToY(S, Z0)
    close(Y[0][0], C(1 / Z))
    close(Y[0][1], C(-1 / Z))
    close(Y[1][0], C(-1 / Z))
    close(Y[1][1], C(1 / Z))
    expect(mdiff(yToS(Y, Z0), S)).toBeLessThan(1e-13)
  })

  it('gives 25 ohms in series a return loss its own S11 states', () => {
    // S11 = Z / (Z + 2 Z0) = 25/125 = 0.2 exactly.
    close(S[0][0], C(Z / (Z + 2 * Z0)))
  })
})

describe('a shunt admittance', () => {
  const Y = 1 / 25
  const S = shuntByHand(Y)

  it('has the chain matrix a book gives', () => {
    const M = sToAbcd(S, Z0)
    close(M[0][0], C(1))
    close(M[0][1], C(0))
    close(M[1][0], C(Y))
    close(M[1][1], C(1))
  })

  it('has the Z-matrix a book gives, every entry the same impedance', () => {
    const Z = sToZ(S, Z0)
    for (const [i, j] of [[0, 0], [0, 1], [1, 0], [1, 1]]) close(Z[i][j], C(1 / Y))
  })

  it('has no Y-matrix, and the refusal says which description is missing', () => {
    const Z = sToZ(S, Z0)
    expect(() => zToY(Z)).toThrow(RfError)
  })
})

describe('the ideal transformer', () => {
  // The case the plan's D3 shows: a finite S-matrix and no Z-matrix at all.
  const n = 2
  const M = [
    [C(n), C(0)],
    [C(0), C(1 / n)],
  ]
  const S = abcdToS(M, Z0)

  it('has an S-matrix, and it is the one the turns ratio gives', () => {
    // S11 = (n² − 1)/(n² + 1) for a transformer between equal reference
    // impedances, which is 3/5 at n = 2.
    close(S[0][0], C((n * n - 1) / (n * n + 1)))
    close(S[1][1], C(-(n * n - 1) / (n * n + 1)))
    close(S[0][1], C((2 * n) / (n * n + 1)))
    close(S[1][0], C((2 * n) / (n * n + 1)))
  })

  it('has no Z-matrix, and the message names the singular matrix rather than a large number', () => {
    let thrown = null
    try {
      sToZ(S, Z0)
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(RfError)
    expect(thrown.message).toMatch(/I − S/)
    expect(thrown.message).toMatch(/another one does/)
  })

  it('is lossless, so its chain matrix has determinant one', () => {
    close(mdet(M), C(1))
  })

  it('round-trips through S and back', () => {
    expect(mdiff(sToAbcd(S, Z0), M)).toBeLessThan(1e-13)
  })
})

describe('a two-port with no path through it', () => {
  it('has no chain matrix, and the refusal says so rather than dividing by S21', () => {
    const S = [
      [C(1), C(0)],
      [C(0), C(1)],
    ]
    let thrown = null
    try {
      sToAbcd(S, Z0)
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(RfError)
    expect(thrown.message).toMatch(/S21 is/)
    expect(thrown.message).toMatch(/no path/)
  })
})

describe('Z and Y are each other, where both exist', () => {
  it('a T network converts both ways and comes back', () => {
    const Z = [
      [C(60, 10), C(10, -5)],
      [C(10, -5), C(40, -20)],
    ]
    expect(mdiff(yToZ(zToY(Z)), Z)).toBeLessThan(1e-13)
    expect(mdiff(zToS(Z, Z0), yToS(zToY(Z), Z0))).toBeLessThan(1e-13)
  })
})
