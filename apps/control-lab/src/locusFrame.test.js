import { describe, it, expect } from 'vitest'
import { locusExtent, stickyExtent, LOCUS_UNIT, LOCUS_X_TITLE, LOCUS_Y_TITLE } from './locusFrame.js'
import { polesZeros } from '@ee-labs/systems'
import { PLANTS, CONTROLLERS, buildLoop, defaultsOf, ctrlDefaultsFor } from './systems.js'

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

  it('a far zero does not set the scale — it is where a branch would end, not where it stands at this gain', () => {
    // Three lags x PI/PID's own shape: a tight pole cluster near the
    // origin, and an integral zero sitting far past all of them.
    const withoutZero = locusExtent([[-1, 0], [-2, 0], [-4, 0]], [], [[-1, 1], [-1, -1], [-4.5, 0]])
    const withFarZero = locusExtent([[-1, 0], [-2, 0], [-4, 0]], [[-50, 0]], [[-1, 1], [-1, -1], [-4.5, 0]])
    expect(withFarZero).toBe(withoutZero)
    expect(withFarZero).toBeLessThan(10)
  })

  it('a far OPEN POLE still sets the scale — a pole is a real branch anchor, not an endpoint the sweep may not reach', () => {
    const e = locusExtent([[-1, 0], [-20, 0]], [[-1, 0]], [[-1, 0], [-18, 0]])
    expect(e).toBeCloseTo(1.35 * 20, 6)
  })
})

describe('locusExtent across the picker', () => {
  // Pinned per the review: every one of the 7 plants x 4 controllers, at the
  // gains the picker itself opens with, keeps the closed-loop pole cluster —
  // the plot's own subject — spanning a real fraction of the frame. Before
  // this fix, every PID combination scored between 0.046 and 0.19 (the
  // integral zero alone set an axis up to 84 rad/s wide around a cluster
  // inside 9); the worst combination afterward is 0.42 (Motor position x
  // Lead, where the lead's own far pole, not a zero, legitimately sets the
  // scale).
  const plantIds = Object.keys(PLANTS)
  const ctrlIds = Object.keys(CONTROLLERS)
  const maxAbs = (pts) => Math.max(0, ...pts.map(([re, im]) => Math.hypot(re, im)))

  it('the closed-loop pole cluster spans at least 0.35 of the frame, in every combination', () => {
    for (const pid of plantIds) {
      for (const cid of ctrlIds) {
        const plantP = defaultsOf(PLANTS[pid])
        const ctrlP = ctrlDefaultsFor(pid, plantP, cid)
        const loop = buildLoop(pid, plantP, cid, ctrlP)
        const openPz = polesZeros(loop.open)
        const pz = polesZeros(loop.closed)
        const extent = locusExtent(openPz.poles, openPz.zeros, pz.poles)
        const span = maxAbs(pz.poles)
        const frac = span / extent
        expect(frac, `${pid} x ${cid}: closed-loop span ${span} of frame ${extent}`).toBeGreaterThanOrEqual(0.35)
      }
    }
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

  it('a NaN held value always reframes fresh — the mechanism App.jsx uses to force a reframe on a plant/controller change', () => {
    // Three lags x PID needs an extent around 6.2; held onto a prior plant's
    // 27 (First order x Lead), stickyExtent's own hold band (up to 1/6 of
    // the held frame) would keep 27 rather than shrinking — the defect a
    // picker click into a much smaller plant hit while still on the locus
    // view. App.jsx resets to NaN whenever the plant/controller key changes
    // specifically to avoid this.
    const heldFromAnotherPlant = stickyExtent(NaN, 27)
    const wronglyHeld = stickyExtent(heldFromAnotherPlant, 6.2)
    expect(wronglyHeld).toBe(heldFromAnotherPlant) // the hold band, demonstrated
    const reframed = stickyExtent(NaN, 6.2)
    expect(reframed).toBeLessThan(heldFromAnotherPlant)
    expect(reframed).toBeGreaterThanOrEqual(6.2)
  })
})

describe('the two axes of the s-plane carry one unit', () => {
  // Read off a screenshot: the real axis said (1/s) and the imaginary axis
  // said (rad/s), on one plane drawn at 1:1 where the distance from the
  // origin is the natural frequency. Two units for one quantity.
  it('both titles end in the same unit', () => {
    const unit = (t) => (t.match(/\(([^)]+)\)$/) || [])[1]
    expect(unit(LOCUS_X_TITLE)).toBe(LOCUS_UNIT)
    expect(unit(LOCUS_Y_TITLE)).toBe(LOCUS_UNIT)
    expect(unit(LOCUS_X_TITLE)).toBe(unit(LOCUS_Y_TITLE))
  })

  it('each still names its own half of s', () => {
    expect(LOCUS_X_TITLE).toContain('Real')
    expect(LOCUS_X_TITLE).toContain('σ')
    expect(LOCUS_Y_TITLE).toContain('Imaginary')
    expect(LOCUS_Y_TITLE).toContain('jω')
  })
})
