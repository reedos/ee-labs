import { describe, it, expect } from 'vitest'
import { CANCEL_REL_TOL, isCancelling, findCancellations, findNearMerges } from './locusCancel.js'

// The bug this pins: cancelEps used to be `extent * 0.02` — a tolerance
// borrowed from the FRAME, which is routinely sized by a point that has
// nothing to do with the pair being judged (First order lag x Lead: the
// lead's own far pole, 10-20 rad/s, pushed the frame's half-extent to
// 15-30, so a zero dragged to 1.3 or 1.5 against a plant pole at -1 — a 30
// to 50 percent mismatch, on purpose — still read as an exact cancellation.
// It stopped only at 2.0.

describe('isCancelling: table-driven over the pair\'s own separation', () => {
  // A pole fixed at -1, a zero moved progressively away from it. Each
  // fraction is the zero's distance from -1 as a fraction of -1's own size,
  // matching the walk's own language ("a 30 to 50 percent mismatch").
  const pole = [-1, 0]
  const cases = [
    ['exact (0%)', 0, true],
    ['1% apart', 0.01, true],
    ['5% apart', 0.05, true],
    ['30% apart', 0.3, false],
    ['50% apart', 0.5, false],
    ['100% apart', 1.0, false],
  ]

  it.each(cases)('%s -> cancelling = %s', (label, frac, expected) => {
    const zero = [-1 - frac, 0]
    expect(isCancelling(pole, zero), `${label}: pole ${pole}, zero ${zero}`).toBe(expected)
  })

  it('the chosen line sits strictly between the "close" and "not close" examples the fix names', () => {
    // "-1.05 is close, -1.3 is not" (5% vs 30%) — the tolerance itself must
    // fall in that gap, not merely happen to classify the two examples right.
    expect(CANCEL_REL_TOL).toBeGreaterThan(0.05)
    expect(CANCEL_REL_TOL).toBeLessThan(0.3)
  })

  it('is symmetric in pole and zero — the pairing has no privileged side', () => {
    for (const [, frac] of cases) {
      const zero = [-1 - frac, 0]
      expect(isCancelling(zero, pole)).toBe(isCancelling(pole, zero))
    }
  })

  it('a pole and zero exactly at the origin still cancel (the 0/0 guard, not a frame measurement)', () => {
    expect(isCancelling([0, 0], [0, 0])).toBe(true)
  })
})

describe('isCancelling: independent of the frame', () => {
  it('the same pair is judged the same way whether the surrounding frame is tiny or huge', () => {
    // isCancelling takes no extent at all — passed here only as a fact about
    // the caller's frame, to make the point concrete: nothing about this
    // function's signature lets a frame's size move its answer, which is
    // exactly the leak `cancelEps = extent * 0.02` used to have.
    const pole = [-1, 0]
    const closeZero = [-1.05, 0] // 5%, the fix's own "close" example
    const farZero = [-1.3, 0] // 30%, the fix's own "not close" example
    for (const extent of [2, 300]) {
      expect(isCancelling(pole, closeZero), `extent ${extent}`).toBe(true)
      expect(isCancelling(pole, farZero), `extent ${extent}`).toBe(false)
    }
  })
})

describe('findCancellations: greedy pairing, no frame in the signature', () => {
  it('pairs a pole with the first close zero and reports both', () => {
    const { cancelling, usedZero } = findCancellations([[-1, 0], [-4, 0]], [[-1.01, 0], [-9, 0]])
    expect(cancelling).toEqual([[-1, 0]])
    expect(usedZero.has(0)).toBe(true)
    expect(usedZero.has(1)).toBe(false)
  })

  it('the Three lags x PID case: an integrator pole at the origin never falsely cancels with a nonzero zero', () => {
    // The regression this app's own verify.mjs pins: a stale, wide extent
    // once inflated cancelEps enough to call the PID's origin pole and its
    // own zero an exact cancellation, though they were merely close in a
    // frame that did not belong to them. A pole AT the origin and any zero
    // NOT at the origin are, by definition, not the same point — and the
    // relative test agrees for any such zero, however small: the ratio of
    // their separation to their shared scale is always exactly 2 the
    // moment one of the two sits at the origin and the other does not.
    const { cancelling } = findCancellations([[0, 0]], [[-1.9, 0]])
    expect(cancelling).toEqual([])
  })

  it('does not double-claim a zero for two poles', () => {
    const { cancelling, usedZero } = findCancellations([[-1, 0], [-1.001, 0]], [[-1, 0]])
    expect(cancelling.length).toBe(1)
    expect(usedZero.size).toBe(1)
  })
})

describe('findNearMerges: pixel-space, and here the frame IS allowed to matter', () => {
  const poles = [[-1, 0]]
  const zeros = [[-1.3, 0]] // 30% away: not a cancellation, per isCancelling
  const isOffFrame = () => false

  it('merges a pair the frame draws close together, even though they are not a cancellation', () => {
    const { cancelling, usedZero } = findCancellations(poles, zeros)
    expect(cancelling).toEqual([]) // confirmed: not a cancellation

    // A tight, zoomed-in-on-everything-else frame: 1 data unit = 5 px, so
    // the two points land 1.5 px apart — inside a typical mark's own radius.
    const tinyFrame = (re, im) => ({ x: re * 5, y: im * 5 })
    const { near } = findNearMerges(poles, zeros, cancelling, usedZero, tinyFrame, 10, isOffFrame)
    expect(near.length).toBe(1)
  })

  it('the same data pair does NOT merge in a frame that spaces them out — this check may depend on the frame', () => {
    const { cancelling, usedZero } = findCancellations(poles, zeros)
    // A wide frame: 1 data unit = 400 px, so the pair sits 120 px apart —
    // nowhere near indistinguishable.
    const wideFrame = (re, im) => ({ x: re * 400, y: im * 400 })
    const { near } = findNearMerges(poles, zeros, cancelling, usedZero, wideFrame, 10, isOffFrame)
    expect(near.length).toBe(0)
  })

  it('never offers a zero the frame already excludes — that zero gets its own edge-arrow treatment', () => {
    const { cancelling, usedZero } = findCancellations(poles, zeros)
    const tinyFrame = (re, im) => ({ x: re * 5, y: im * 5 })
    const { near } = findNearMerges(poles, zeros, cancelling, usedZero, tinyFrame, 10, () => true)
    expect(near.length).toBe(0)
  })

  it('never re-offers a zero a cancellation already claimed', () => {
    const p = [[-1, 0]]
    const z = [[-1, 0]] // exact — findCancellations claims it
    const { cancelling, usedZero } = findCancellations(p, z)
    expect(cancelling.length).toBe(1)
    const { near } = findNearMerges(p, z, cancelling, usedZero, (re, im) => ({ x: re, y: im }), 1000, isOffFrame)
    expect(near.length).toBe(0)
  })
})
