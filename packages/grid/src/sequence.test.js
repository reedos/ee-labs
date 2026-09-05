import { describe, it, expect } from 'vitest'
import { A_INV, A_MAT, A_OP, balancedSet, matrixProduct, neutral, roundTripError, sets, toPhase, toSequence, unbalanceFactor } from './sequence.js'
import { C, cabs, carg, csub, deg, polar, rad } from './cx.js'

// The transform is a change of basis, so every test here is an identity.
// GRID_LAB_PLAN.md §4.3 gives the unbalanced set: 10∠0°, 6∠−150°, 8∠100° A.

const SET = [polar(10, 0), polar(6, rad(-150)), polar(8, rad(100))]

describe('the two matrices', () => {
  it('multiply to the identity, to floating point', () => {
    const I = matrixProduct()
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        expect(I[i][j][0], `${i},${j}`).toBeCloseTo(i === j ? 1 : 0, 14)
        expect(I[i][j][1], `${i},${j}`).toBeCloseTo(0, 14)
      }
  })

  it('are built on a = 1∠120°, whose cube is one', () => {
    expect(cabs(A_OP)).toBeCloseTo(1, 15)
    expect(deg(carg(A_OP))).toBeCloseTo(120, 12)
    // 1 + a + a² = 0, which is why the three phasors of a balanced set add to
    // nothing.
    const sum = [1 + A_MAT[1][1][0] + A_MAT[1][2][0], A_MAT[1][1][1] + A_MAT[1][2][1]]
    expect(cabs(sum)).toBeLessThan(1e-15)
  })
})

describe('the unbalanced set of three currents', () => {
  const s = toSequence(SET)

  it('resolves into 1.98492∠55.010°, 7.80894∠−14.1732° and 1.32184∠12.4912° A', () => {
    expect(s.mag[0]).toBeCloseTo(1.98492, 5)
    expect(deg(s.ang[0])).toBeCloseTo(55.01, 2)
    expect(s.mag[1]).toBeCloseTo(7.80894, 5)
    expect(deg(s.ang[1])).toBeCloseTo(-14.1732, 4)
    expect(s.mag[2]).toBeCloseTo(1.32184, 5)
    expect(deg(s.ang[2])).toBeCloseTo(12.4912, 4)
  })

  it('rebuilds the three phase currents to floating point', () => {
    expect(roundTripError(SET)).toBeLessThan(1e-14)
    const back = toPhase(s)
    SET.forEach((z, k) => expect(cabs(csub(z, back.abc[k])), `phase ${k}`).toBeLessThan(1e-14))
  })

  it('carries 5.95477 A in the neutral, which is three times the zero sequence', () => {
    const n = neutral(SET)
    expect(n.mag).toBeCloseTo(5.95477, 5)
    expect(n.mag).toBeCloseTo(3 * s.mag[0], 12)
    expect(cabs(csub(n.sum, n.threeZero))).toBeLessThan(1e-14)
  })

  it('has an unbalance factor of 16.927 %', () => {
    expect(100 * unbalanceFactor(SET)).toBeCloseTo(16.927, 3)
    expect(unbalanceFactor(SET)).toBeCloseTo(s.mag[2] / s.mag[1], 12)
  })
})

describe('a balanced set', () => {
  it('has no zero and no negative sequence, and its neutral carries nothing', () => {
    const b = balancedSet(10, rad(30))
    const s = toSequence(b)
    expect(s.mag[0]).toBeLessThan(1e-14)
    expect(s.mag[2]).toBeLessThan(1e-14)
    expect(s.mag[1]).toBeCloseTo(10, 12)
    expect(deg(s.ang[1])).toBeCloseTo(30, 12)
    expect(neutral(b).mag).toBeLessThan(1e-14)
    expect(unbalanceFactor(b)).toBeLessThan(1e-14)
  })

  it('in the negative order has no positive sequence at all', () => {
    const s = toSequence(balancedSet(10, 0, 'negative'))
    expect(s.mag[1]).toBeLessThan(1e-14)
    expect(s.mag[2]).toBeCloseTo(10, 12)
  })

  it('with an equal current in every phase and no rotation is all zero sequence', () => {
    const s = toSequence([C(4), C(4), C(4)])
    expect(s.mag[0]).toBeCloseTo(4, 12)
    expect(s.mag[1]).toBeLessThan(1e-14)
    expect(s.mag[2]).toBeLessThan(1e-14)
    expect(neutral([C(4), C(4), C(4)]).mag).toBeCloseTo(12, 12)
  })
})

describe('the three sets drawn beside the one they add to', () => {
  it('adds back to the original triple, phase by phase', () => {
    const three = sets(SET)
    for (let k = 0; k < 3; k++) {
      const sum = [three.zero[k][0] + three.positive[k][0] + three.negative[k][0], three.zero[k][1] + three.positive[k][1] + three.negative[k][1]]
      expect(cabs(csub(sum, SET[k])), `phase ${k}`).toBeLessThan(1e-14)
    }
    // Each drawn set is itself balanced or equal, which is what makes the
    // picture readable.
    expect(cabs(three.positive[0])).toBeCloseTo(cabs(three.positive[1]), 12)
    expect(cabs(three.negative[0])).toBeCloseTo(cabs(three.negative[2]), 12)
    expect(cabs(csub(three.zero[0], three.zero[2]))).toBeLessThan(1e-15)
  })
})

describe('the identity that holds at every unbalance', () => {
  it('keeps the neutral at three times the zero sequence, at four settings', () => {
    const cases = [
      SET,
      balancedSet(7, rad(15)),
      [polar(3, 0), polar(3, rad(-120)), polar(9, rad(120))],
      [polar(1, rad(10)), C(0), polar(5, rad(-40))],
    ]
    for (const abc of cases) {
      const n = neutral(abc)
      const s = toSequence(abc)
      expect(Math.abs(n.mag - 3 * s.mag[0])).toBeLessThan(1e-14)
    }
  })
})
