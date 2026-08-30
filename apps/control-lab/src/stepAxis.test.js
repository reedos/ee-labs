import { describe, expect, it } from 'vitest'
import { ladderUp, stickyDuration, stickyRange } from './stepAxis.js'

// The behaviour Reed asked for by name, for the step plot: tuning gain or
// tau moves the CURVE across a held frame. The first implementation failed
// its own browser probe - containment-growth tracked the peak pixel-for-
// pixel - so the frames are band-quantized: bit-identical inside a band,
// one discrete jump at its edge.

describe('ladderUp', () => {
  it('snaps up within the decade and scales across decades', () => {
    expect(ladderUp(0.63)).toBe(0.8)
    expect(ladderUp(1.01)).toBe(1.5)
    expect(ladderUp(7)).toBe(8)
    expect(ladderUp(1234)).toBe(1500)
    expect(ladderUp(0.0007)).toBeCloseTo(0.0008, 12)
  })
})

describe('stickyDuration', () => {
  it('is bit-identical across a wide tuning inside one band', () => {
    const d1 = stickyDuration(NaN, 12) // adopt: ladder(12) = 15
    expect(d1).toBe(15)
    // Anything needing between prev/6 and prev holds the frame exactly.
    expect(stickyDuration(d1, 3)).toBe(15)
    expect(stickyDuration(d1, 14)).toBe(15)
    // Just past the left-sixth threshold it reframes, quantized.
    expect(stickyDuration(d1, 2.3)).toBe(3)
  })

  it('grows when the settle would leave the frame, to the next band', () => {
    expect(stickyDuration(15, 30)).toBe(30)
    expect(stickyDuration(15, 22)).toBe(30)
  })

  it('reframes down only past the left-sixth threshold', () => {
    expect(stickyDuration(15, 3)).toBe(15)
    expect(stickyDuration(15, 2)).toBe(2)
  })

  it('snaps on system change; nonsense natural keeps the frame', () => {
    expect(stickyDuration(15, 5, true)).toBe(6)
    expect(stickyDuration(15, NaN)).toBe(15)
  })
})

describe('stickyRange', () => {
  const nat = (lo, hi) => ({ lo, hi })

  it('the Kp sweep that broke v1: 0.5 and 0.9 settle in DIFFERENT places of one frame', () => {
    const f1 = stickyRange(null, nat(-0.067, 0.63)) // Kp = 1
    expect(f1.hi).toBe(0.8)
    expect(f1.lo).toBeCloseTo(-0.08, 12)
    const f2 = stickyRange(f1, nat(-0.02, 1.01)) // Kp = 9: crosses the band once
    expect(f2).toEqual({ lo: 0, hi: 1.5 })
    // ...and further tuning inside that band holds it bit-identical.
    expect(stickyRange(f2, nat(-0.01, 1.1))).toBe(f2)
    expect(stickyRange(f2, nat(0.01, 0.7))).toBe(f2)
    // A dip genuinely below the frame's floor is a clip: reframe, don't hide.
    expect(stickyRange(f2, nat(-0.05, 0.7)).lo).toBeLessThan(0)
  })

  it('zero stays zero: a one-sided trace gets a one-sided frame', () => {
    expect(stickyRange(null, nat(-0.01, 0.9))).toEqual({ lo: 0, hi: 1 })
  })

  it('snaps in when the trace shrinks to a sliver of the band', () => {
    const big = stickyRange(null, nat(-3.5, 3.5))
    expect(stickyRange(big, nat(-0.1, 0.4)).hi).toBeLessThan(1)
  })

  it('snaps on a system change', () => {
    expect(stickyRange({ lo: -4, hi: 4 }, nat(0, 1.1), true)).toEqual({ lo: 0, hi: 1.5 })
  })
})
