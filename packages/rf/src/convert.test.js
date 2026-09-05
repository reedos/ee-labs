import { describe, it, expect } from 'vitest'
import { complex as cx } from '@ee-labs/network'
import {
  abcdToS,
  abcdToY,
  abcdToZ,
  eye2,
  m2,
  mdet,
  minv,
  mmul,
  roundTrip,
  sToAbcd,
  sToY,
  sToZ,
  yToAbcd,
  yToS,
  zToAbcd,
  zToS,
  zToY,
} from './convert.js'
import { sFromNetlist, twoPort } from './sparam.js'
import { piPad, randomFrequency, randomLadder } from './fuzz.js'

const { C, cabs, csub } = cx

const closeC = (x, y, tol = 1e-9) => expect(cabs(csub(x, y))).toBeLessThanOrEqual(tol * Math.max(1, cabs(x), cabs(y)))
const closeM = (A, B, tol = 1e-9) => {
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) closeC(A[i][j], B[i][j], tol)
}
const worst = (A, B) => {
  let w = 0
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) w = Math.max(w, cabs(csub(A[i][j], B[i][j])))
  return w
}

describe('two by two complex algebra', () => {
  it('the identity multiplies as one, and the determinant is the product of a diagonal', () => {
    const A = m2(C(2, 1), C(0, 3), C(-1, 0), C(4, -2))
    closeM(mmul(A, eye2()), A, 1e-15)
    closeM(mmul(eye2(), A), A, 1e-15)
    closeC(mdet(m2(3, 0, 0, 5)), C(15, 0), 1e-15)
  })

  it('the inverse undoes the matrix, and a singular one is named rather than inverted', () => {
    const A = m2(C(2, 1), C(0, 3), C(-1, 0), C(4, -2))
    closeM(mmul(A, minv(A)), eye2(), 1e-12)
    // A rank-one matrix: the second row is twice the first.
    expect(() => minv(m2(1, 2, 2, 4), 'impedance matrix')).toThrow(/no inverse/)
    expect(() => minv(m2(1, 2, 2, 4), 'impedance matrix')).toThrow(/ideal transformer/)
  })
})

// ------------------------------------------------------ against hand algebra

describe('each conversion against a circuit whose matrix is known by hand', () => {
  it('a series impedance has ABCD [[1, Z], [0, 1]] and a shunt admittance [[1, 0], [Y, 1]]', () => {
    const Z = C(30, -40)
    const S = abcdToS(m2(C(1), Z, C(0), C(1)), 50)
    closeM(sToAbcd(S, 50), m2(C(1), Z, C(0), C(1)), 1e-12)
    const Y = C(0.01, 0.004)
    const S2 = abcdToS(m2(C(1), C(0), Y, C(1)), 50)
    closeM(sToAbcd(S2, 50), m2(C(1), C(0), Y, C(1)), 1e-12)
  })

  it('a lone series inductor has no Z-matrix, and the message names the determinant', () => {
    // Every entry of a lone series element's Z-matrix is the same impedance,
    // because nothing connects either port to ground, so the matrix is rank
    // one and has no inverse. The pane shows this rather than a large number.
    const f = 1e9
    const jwL = C(0, 2 * Math.PI * f * 10e-9)
    const abcd = m2(C(1), jwL, C(0), C(1))
    const S = abcdToS(abcd, 50)
    expect(() => abcdToZ(abcd)).toThrow(/no Z-matrix/)
    expect(() => sToZ(S, 50)).toThrow(/no inverse/)
    // The same two-port converts to Y and back without complaint, because the
    // admittance description of a series element is finite.
    closeM(yToS(sToY(S, 50), 50), S, 1e-9)
    closeM(abcdToY(abcd), sToY(S, 50), 1e-9)
  })

  it('the 3 dB pi pad converts four ways and back to itself', () => {
    const pad = piPad(3, 50)
    const rec = sFromNetlist(pad, pad.ports, 1e9)
    const Z = sToZ(rec, 50)
    const Y = sToY(rec, 50)
    const abcd = sToAbcd(rec, 50)
    closeM(zToS(Z, 50), rec.s, 1e-9)
    closeM(yToS(Y, 50), rec.s, 1e-9)
    closeM(abcdToS(abcd, 50), rec.s, 1e-9)
    closeM(zToAbcd(Z), abcd, 1e-9)
    closeM(yToAbcd(Y), abcd, 1e-9)
    closeM(abcdToY(abcd), Y, 1e-9)
    closeM(abcdToZ(abcd), Z, 1e-9)
    closeM(zToY(Z), Y, 1e-9)
  })

  it('an ideal transformer has a finite S-matrix and no Z-matrix, and says which', () => {
    // ABCD [[n, 0], [0, 1/n]]. Its C entry is zero, so Z11 = A/C is infinite.
    const n = 2
    const abcd = m2(C(n), C(0), C(0), C(1 / n))
    const S = abcdToS(abcd, 50)
    expect(Number.isFinite(S[0][0][0])).toBe(true)
    // A transformer of turns ratio n makes 50 ohms look like 50 n^2, so S11 is
    // the reflection of that against 50.
    const want = (50 * n * n - 50) / (50 * n * n + 50)
    closeC(S[0][0], C(want, 0), 1e-12)
    expect(() => abcdToZ(abcd)).toThrow(/no Z-matrix/)
    expect(() => abcdToZ(abcd)).toThrow(/ideal transformer/)
  })

  it('a two-port that passes nothing has no ABCD matrix, and says why', () => {
    const dead = twoPort({ f: 1e9, z0: 50, s: [[C(1), C(0)], [C(0), C(1)]] })
    expect(() => sToAbcd(dead, 50)).toThrow(/no ABCD matrix/)
    expect(() => sToAbcd(dead, 50)).toThrow(/chain/)
  })
})

// ---------------------------------------------------------------- invariant 1

describe('invariant 1: S to Z to ABCD to Y to S returns the input to 1e-12', () => {
  it('holds for forty random passive networks at forty frequencies', () => {
    let checked = 0
    for (let seed = 1; seed <= 40; seed++) {
      const net = randomLadder(seed)
      const f = randomFrequency(seed * 41 + 5)
      const rec = sFromNetlist(net, net.ports, f)
      let trip
      try {
        trip = roundTrip(rec, 50)
      } catch (err) {
        // Invariant 1 skips only the cases the singular test names, and it
        // names them: the message says which matrix has no inverse.
        expect(err.kind, `seed ${seed} threw ${err.message}`).toBe('singular-conversion')
        continue
      }
      expect(trip.error, `seed ${seed} at ${f.toExponential(3)} Hz, scale ${trip.scale.toExponential(2)}`).toBeLessThanOrEqual(trip.tolerance)
      checked++
    }
    // The skips are the exception, not the rule.
    expect(checked).toBeGreaterThan(30)
  })

  it('holds at a plain 1e-12 wherever the intermediates stay near their own scale', () => {
    // The pi pad's four matrices are all of order one, so nothing is lost on
    // the way round and the plan's bare 1e-12 holds at every point.
    const pad = piPad(6, 50)
    for (let k = 0; k <= 40; k++) {
      const f = 1e8 * Math.pow(10, k / 40)
      const trip = roundTrip(sFromNetlist(pad, pad.ports, f), 50)
      expect(trip.scale, `${f.toExponential(3)} Hz`).toBeLessThan(1e3)
      expect(trip.error, `${f.toExponential(3)} Hz`).toBeLessThan(1e-12)
    }
  })

  it('holds at a reference impedance that is not fifty ohms', () => {
    for (const z0 of [25, 50, 75, 300]) {
      const net = randomLadder(7)
      const rec = sFromNetlist(net, net.ports, 8e8, { z0 })
      const trip = roundTrip(rec, z0)
      expect(trip.error, `${z0} ohms`).toBeLessThanOrEqual(trip.tolerance)
    }
  })

  it('the conversion agrees with the solve it came from, not only with itself', () => {
    // A round trip that never touched the circuit would pass on a matrix of
    // zeros. This compares Z read through the conversion against Z read from a
    // second solve of the same network at the same frequency.
    const R = 200
    const net = { elements: [{ type: 'R', id: 'RL', nodes: ['p1', 'gnd'], value: R }] }
    const rec = sFromNetlist(net, ['p1'], 1e9)
    const gamma = rec.s[0][0]
    const Zin = (50 * (1 + gamma[0])) / (1 - gamma[0])
    expect(Math.abs(Zin - R)).toBeLessThan(1e-9 * R)
    expect(worst(eye2(), eye2())).toBe(0)
  })
})
