import { describe, it, expect } from 'vitest'
import { locusExtent, stickyExtent } from './locusFrame.js'

describe('locusExtent', () => {
  it('fits 1.35x the farthest relevant point', () => {
    const e = locusExtent([[-1, 0], [-4, 3]], [], [[-2, 2]])
    expect(e).toBeCloseTo(1.35 * 5, 6) // hypot(-4,3) = 5
  })

  it('is the unstable-plant fix: poles inside +/-4 no longer frame at +/-300', () => {
    // The far branches of a locus swept to 100x gain run to hundreds of
    // rad/s; only the poles/zeros AT THIS GAIN and the open-loop starts
    // should set the frame, not every point the sweep ever visits.
    const e = locusExtent([[1, 0]], [], [[-3, 0]])
    expect(e).toBeLessThan(10)
  })

  it('never collapses to zero for a pole at the origin', () => {
    expect(locusExtent([[0, 0]], [], [[0, 0]])).toBeGreaterThan(0)
  })
})

describe('stickyExtent', () => {
  it('holds the same frame while the content still fits inside it', () => {
    const first = stickyExtent(NaN, 5)
    expect(stickyExtent(first, 4.9)).toBe(first)
  })

  it('grows once the content needs more than the held frame usefully allows', () => {
    const first = stickyExtent(NaN, 5)
    const grown = stickyExtent(first, 40)
    expect(grown).toBeGreaterThan(first)
  })
})
