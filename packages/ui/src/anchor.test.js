import { describe, it, expect } from 'vitest'
import { niceBounds, traceExtent, scopeRange, anchoredRange } from './anchor.js'

const wave = (level, ripple, n = 200) => ({
  sig: { v: Array.from({ length: n }, (_, i) => level + (ripple / 2) * Math.sin((2 * Math.PI * i) / n)) },
})

describe('niceBounds', () => {
  it('snaps outward to a round step', () => {
    expect(niceBounds(4.9925, 5.0075)).toEqual([4.99, 5.01])
    expect(niceBounds(-0.19, 0.19)).toEqual([-0.2, 0.2])
  })
  it('leaves a degenerate range alone', () => {
    expect(niceBounds(1, 1)).toEqual([1, 1])
    expect(niceBounds(NaN, 1)).toEqual([NaN, 1])
  })
})

describe('traceExtent', () => {
  it('gives a small ripple on a large level a third of the strip', () => {
    const [lo, hi] = traceExtent(wave(5, 0.004), ['v'])
    expect(0.004 / (hi - lo)).toBeCloseTo(1 / 3, 2)
  })
  it('lets a large swing use the frame', () => {
    const [lo, hi] = traceExtent(wave(0, 2), ['v'])
    expect(2 / (hi - lo)).toBeGreaterThan(0.8)
  })
  it('draws a flat trace as a line across the middle, not a filled frame', () => {
    const [lo, hi] = traceExtent({ sig: { v: [12, 12, 12] } }, ['v'])
    expect(lo).toBeLessThan(12)
    expect(hi).toBeGreaterThan(12)
    expect(lo + hi).toBeCloseTo(24, 9)
  })
})

describe('scopeRange', () => {
  it('holds still while the ripple shrinks, so the curve is what changes', () => {
    const base = wave(5, 0.004)
    const frame = scopeRange(base, base, ['v'])
    for (const r of [0.003, 0.002, 0.001, 0.0001]) expect(scopeRange(wave(5, r), base, ['v'])).toEqual(frame)
  })
  it('gives way, once, when the signal outgrows the reference', () => {
    const base = wave(5, 0.004)
    const frame = scopeRange(base, base, ['v'])
    const grown = scopeRange(wave(5, 0.04), base, ['v'])
    expect(grown[0]).toBeLessThanOrEqual(frame[0])
    expect(grown[1]).toBeGreaterThanOrEqual(frame[1])
    expect(grown[0]).toBeLessThanOrEqual(5 - 0.02)
    expect(grown[1]).toBeGreaterThanOrEqual(5 + 0.02)
  })
})

describe('anchoredRange (curves)', () => {
  const M = (D) => D
  const cur = [0.1, 0.3, 0.5, 0.7, 0.9].map(M)
  it('frames on the reference and does not move for a curve inside it', () => {
    const frame = anchoredRange(cur, cur, { lo: 0, hi: 1 })
    expect(anchoredRange([0.05, 0.2, 0.4], cur, { lo: 0, hi: 1 })).toEqual(frame)
  })
  it('gives way when the present curve leaves the declared bounds', () => {
    const [, hi] = anchoredRange([0.5, 1.5, 3], cur, { lo: 0, hi: 1 })
    expect(hi).toBeGreaterThanOrEqual(3)
  })
  it('keeps a reference level on the chart', () => {
    const [, hi] = anchoredRange([0.1, 0.2], [], { floor: 1 })
    expect(hi).toBeGreaterThanOrEqual(1)
  })
  it('works in decades for a log axis', () => {
    const [lo, hi] = anchoredRange([1, 10, 100], [], { log: true })
    expect(lo).toBeCloseTo(-0.15, 9)
    expect(hi).toBeCloseTo(2.15, 9)
  })
  it('grows a negative axis outward the way a positive one does', () => {
    const [lo, hi] = anchoredRange([-1, -0.5], [], {})
    expect(lo).toBeLessThan(-1)
    expect(hi).toBeGreaterThan(-0.5)
  })
})
