import { describe, it, expect } from 'vitest'
import { alignZero, spanOf } from './timePlot.js'

// The scope draws two scales on one frame. These are the two claims its axes
// make: every trace fits, and the two zeros are the same pixel row.

describe('spanOf', () => {
  it('contains zero and every finite sample, with 12 % of air each side', () => {
    const [lo, hi] = spanOf([Float64Array.from([1, 2, 3]), Float64Array.from([NaN, 2.5, Infinity])])
    expect(lo).toBeCloseTo(-0.36, 12)
    expect(hi).toBeCloseTo(3.36, 12)
    // All-negative data still spans up to zero.
    const [nlo, nhi] = spanOf([[-4, -1]])
    expect(nlo).toBeLessThan(-4)
    expect(nhi).toBeGreaterThan(0)
    // A flat trace at zero gets a unit span rather than a zero-height one.
    const [flo, fhi] = spanOf([[0, 0, 0]])
    expect(fhi - flo).toBeGreaterThan(0)
  })
})

describe('alignZero', () => {
  const frac0 = ([lo, hi]) => -lo / (hi - lo)
  const cases = [
    [[-1, 4], [-0.02, 0.01]], // zero low on the left, data mostly below on the right
    [[-3, 1], [-0.001, 0.05]], // zero high on the left
    [[-2, 2], [-0.5, 7]], // right data mostly positive
    [spanOf([[0, 5]]), spanOf([[-1e-6, 0]])], // one-sided data, as spanOf pads it
    [spanOf([[-5, 0]]), spanOf([[0, 1e-6]])],
  ]
  it('always has room on both sides of zero, because spanOf leaves it', () => {
    for (const ys of [[0, 5], [-5, 0], [0, 0], [3, 3]]) {
      const f = frac0(spanOf([ys]))
      expect(f, JSON.stringify(ys)).toBeGreaterThan(0)
      expect(f, JSON.stringify(ys)).toBeLessThan(1)
    }
  })
  it('puts the right-hand zero on the same fraction of the frame as the left-hand zero', () => {
    for (const [L, R] of cases) {
      const out = alignZero(L, R)
      expect(frac0(out), JSON.stringify([L, R])).toBeCloseTo(frac0(L), 12)
    }
  })
  it('never shrinks the right-hand span: the original still fits inside', () => {
    for (const [L, R] of cases) {
      const [lo, hi] = alignZero(L, R)
      expect(lo, JSON.stringify([L, R])).toBeLessThanOrEqual(R[0] + 1e-15)
      expect(hi, JSON.stringify([L, R])).toBeGreaterThanOrEqual(R[1] - 1e-15)
      expect(hi - lo).toBeGreaterThan(0)
    }
  })
  it('is the identity when the two spans already share their zero fraction', () => {
    const out = alignZero([-1, 3], [-0.5, 1.5])
    expect(out[0]).toBeCloseTo(-0.5, 12)
    expect(out[1]).toBeCloseTo(1.5, 12)
  })
})
