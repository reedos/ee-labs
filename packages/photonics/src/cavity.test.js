import { describe, it, expect } from 'vitest'
import {
  airy,
  contrast,
  describeCavity,
  facetReflectance,
  finesse,
  freeSpectralRange,
  mirrorLoss,
  photonLifetime,
  rationalAvailable,
  refuseRational,
  roundTripPhase,
  sweep,
  transmissionAt,
} from './cavity.js'
import { C0, PhotonicsError } from './const.js'
import { logUniform, randomCavity, relative, rng, uniform } from './fuzz.js'

// The Fabry-Perot cavity. The Airy form is exact at every frequency, so the
// tolerances are floating point.
//
// Two invariants of `PHOTONICS_LAB_PLAN.md` §2.11 live here. Number 11, the
// cavity is periodic: the transmission at a round-trip phase and at that phase
// plus 2 pi are equal, and the peaks are one free spectral range apart. Number
// 12, the cavity is not rational: the hand-over to `@ee-labs/systems` is
// declined and the message names the transcendental factor.
//
// The hostile corner the plan names is a reflectance of one. A perfect mirror
// makes a cavity with infinite finesse and zero linewidth, and nothing here is
// clamped to hide that.

const UM = 1e-6
const CHIP = { n: 3.5, L: 300 * UM, r: facetReflectance({ n1: 3.5 }) }

describe('the cavity a cleaved chip is', () => {
  it('a facet between an index of 3.5 and air reflects 0.3086 with no coating', () => {
    expect(CHIP.r).toBeCloseTo(0.308642, 6)
    expect(relative(CHIP.r, (2.5 / 4.5) ** 2)).toBeLessThan(1e-15)
    // Matched indices reflect nothing.
    expect(facetReflectance({ n1: 1.5, n2: 1.5 })).toBe(0)
  })

  it('one reflectance fills both mirrors, and two may differ', () => {
    const c = describeCavity(CHIP)
    expect(c.r1).toBe(CHIP.r)
    expect(c.r2).toBe(CHIP.r)
    expect(relative(c.roundTrip, CHIP.r)).toBeLessThan(1e-15)
    const uneven = describeCavity({ n: 3.5, L: 300 * UM, r1: 0.3, r2: 0.9 })
    expect(relative(uneven.roundTrip, Math.sqrt(0.27))).toBeLessThan(1e-15)
  })

  it('declines a cavity with no round trip, by name', () => {
    expect(() => describeCavity({ n: 3.5, L: 300 * UM, r: 0 })).toThrow(PhotonicsError)
    expect(() => describeCavity({ n: 3.5, L: 300 * UM, r: 0 })).toThrow(/needs two mirrors that reflect something/)
  })
})

describe('the free spectral range, the finesse and the linewidth', () => {
  it('the chip cavity carries the three numbers the plan pins', () => {
    const fsr = freeSpectralRange(CHIP, 1550e-9)
    expect(fsr.fsr / 1e9).toBeCloseTo(142.758, 3)
    expect(fsr.wavelength * 1e9).toBeCloseTo(1.14405, 5)
    const f = finesse(CHIP)
    expect(f.finesse).toBeCloseTo(2.5245, 4)
    expect(f.linewidth / 1e9).toBeCloseTo(56.549, 3)
  })

  it('the free spectral range is one over the round-trip time, at any length', () => {
    const r = rng(0xf5f5)
    for (let k = 0; k < 80; k++) {
      const c = randomCavity(r)
      const f = freeSpectralRange(c)
      expect(relative(f.fsr, C0 / (2 * c.n * c.L))).toBeLessThan(1e-15)
      expect(relative(f.roundTripTime, (2 * c.n * c.L) / C0)).toBeLessThan(1e-14)
      // The width in wavelength is the width in frequency scaled by lambda^2/c.
      const lambda = 1550e-9
      expect(relative(freeSpectralRange(c, lambda).wavelength, (lambda * lambda * f.fsr) / C0)).toBeLessThan(1e-14)
    }
  })

  it('the linewidth is the free spectral range divided by the finesse, by construction', () => {
    const r = rng(0x1e1e)
    for (let k = 0; k < 80; k++) {
      const c = randomCavity(r)
      const f = finesse(c)
      expect(relative(f.linewidth * f.finesse, f.fsr)).toBeLessThan(1e-14)
      expect(relative(f.finesse, (Math.PI * Math.sqrt(f.roundTrip)) / (1 - f.roundTrip))).toBeLessThan(1e-14)
    }
  })

  it('finesse and contrast at three reflectances are the numbers the plan pins', () => {
    const at = (r) => ({ n: 3.5, L: 300 * UM, r })
    expect(finesse(at(0.3)).finesse).toBeCloseTo(2.4582, 4)
    expect(finesse(at(0.9)).finesse).toBeCloseTo(29.804, 3)
    expect(finesse(at(0.99)).finesse).toBeCloseTo(312.58, 2)
    expect(contrast(at(0.3)).db).toBeCloseTo(5.3769, 4)
    expect(contrast(at(0.9)).db).toBeCloseTo(25.575, 3)
    expect(contrast(at(0.99)).db).toBeCloseTo(45.977, 3)
  })

  it('a perfect mirror gives infinite finesse and zero linewidth, and nothing clamps it', () => {
    const f = finesse({ n: 3.5, L: 300 * UM, r: 1 })
    expect(f.finesse).toBe(Infinity)
    expect(f.linewidth).toBe(0)
    expect(contrast({ n: 3.5, L: 300 * UM, r: 1 }).db).toBe(Infinity)
    // And the free spectral range does not care about the mirrors at all.
    expect(relative(f.fsr, freeSpectralRange(CHIP).fsr)).toBeLessThan(1e-15)
  })

  it('the internal loss lowers the finesse and leaves the free spectral range alone', () => {
    const lossy = { ...CHIP, loss: 2000 }
    expect(finesse(lossy).finesse).toBeLessThan(finesse(CHIP).finesse)
    expect(relative(freeSpectralRange(lossy).fsr, freeSpectralRange(CHIP).fsr)).toBeLessThan(1e-15)
  })
})

describe('the Airy transmission', () => {
  // Invariant 11, first half.
  it('is periodic in the round-trip phase, with period 2 pi exactly', () => {
    const r = rng(0x2222)
    for (let k = 0; k < 120; k++) {
      const c = randomCavity(r)
      const phi = uniform(r, -20, 20)
      for (const m of [1, 2, -3]) {
        expect(relative(airy(c, phi + 2 * Math.PI * m), airy(c, phi))).toBeLessThan(1e-9)
      }
    }
  })

  it('is one at every resonance and never above it', () => {
    const r = rng(0x3333)
    for (let k = 0; k < 80; k++) {
      const c = randomCavity(r)
      expect(airy(c, 0)).toBeCloseTo(1, 12)
      expect(airy(c, 2 * Math.PI)).toBeCloseTo(1, 9)
      for (let j = 0; j < 20; j++) expect(airy(c, uniform(r, 0, 2 * Math.PI))).toBeLessThanOrEqual(1 + 1e-12)
    }
  })

  it('the valley is the contrast below the peak', () => {
    const r = rng(0x4444)
    for (let k = 0; k < 60; k++) {
      const c = randomCavity(r)
      const valley = airy(c, Math.PI)
      expect(relative(1 / valley, contrast(c).ratio)).toBeLessThan(1e-12)
    }
  })

  // Invariant 11, second half.
  it('the peaks stand one free spectral range apart', () => {
    const r = rng(0x5555)
    for (let k = 0; k < 60; k++) {
      const c = randomCavity(r)
      const fsr = freeSpectralRange(c).fsr
      const s = sweep(c, { from: 10 * fsr, to: 14 * fsr, points: 51 })
      expect(s.peaks.length).toBe(5)
      for (let j = 1; j < s.peaks.length; j++) expect(relative(s.peaks[j] - s.peaks[j - 1], fsr)).toBeLessThan(1e-12)
      for (const f of s.peaks) expect(transmissionAt(c, f)).toBeCloseTo(1, 6)
    }
  })

  it('the round-trip phase is 2 beta L, and it is a multiple of 2 pi at every peak', () => {
    const fsr = freeSpectralRange(CHIP).fsr
    for (const m of [1, 7, 100]) {
      const phi = roundTripPhase(CHIP, m * fsr)
      expect(relative(phi, 2 * Math.PI * m)).toBeLessThan(1e-12)
    }
  })

  it('the sweep returns as many points as it was asked for, over the span it was given', () => {
    const fsr = freeSpectralRange(CHIP).fsr
    const s = sweep(CHIP, { from: fsr, to: 3 * fsr, points: 101 })
    expect(s.f.length).toBe(101)
    expect(s.t.length).toBe(101)
    expect(s.f[0]).toBe(fsr)
    expect(relative(s.f[100], 3 * fsr)).toBeLessThan(1e-15)
    expect(() => sweep(CHIP, { from: 3 * fsr, to: fsr })).toThrow(/must be above its bottom/)
  })
})

describe('the mirror loss the photon lifetime is built from', () => {
  it('is the plan’s convention, and it is 19.593 per centimetre for the chip', () => {
    expect(mirrorLoss(CHIP) / 100).toBeCloseTo(19.593, 3)
    expect(relative(mirrorLoss(CHIP), (1 / (2 * CHIP.L)) * Math.log(1 / CHIP.r))).toBeLessThan(1e-14)
  })

  it('rises as the mirrors are made worse, which is why the threshold rises with them', () => {
    const at = (r) => mirrorLoss({ n: 3.5, L: 300 * UM, r })
    expect(at(0.1)).toBeGreaterThan(at(0.3))
    expect(at(0.3)).toBeGreaterThan(at(0.9))
    expect(at(1)).toBe(0)
  })

  it('the photon lifetime falls as the loss rises', () => {
    const short = photonLifetime({ n: 3.5, L: 300 * UM, r: 0.1 })
    const long = photonLifetime({ n: 3.5, L: 300 * UM, r: 0.9 })
    expect(short.tauP).toBeLessThan(long.tauP)
    expect(relative(long.tauP, 3.5 / (C0 * long.alpha))).toBeLessThan(1e-14)
    expect(long.internal).toBe(0)
  })
})

describe('what the cavity declines', () => {
  // Invariant 12.
  it('has no rational transfer function, and the message names the factor', () => {
    expect(() => refuseRational()).toThrow(PhotonicsError)
    expect(() => refuseRational()).toThrow(/transcendental/)
    const says = rationalAvailable()
    // The wording the transmission line's refusal uses, so the two labs make
    // one point rather than two. RF_LAB_PLAN.md §A5 carries the same sentence.
    expect(says).toMatch(/no ratio of polynomials equals it/)
    expect(says).toMatch(/no finite set of poles describes it/)
    expect(says).toMatch(/exact at every frequency/)
  })

  it('the response it declines to make rational is still exact at every frequency', () => {
    const fsr = freeSpectralRange(CHIP).fsr
    const r = rng(0x6666)
    for (let k = 0; k < 200; k++) {
      const f = uniform(r, 0.1 * fsr, 40 * fsr)
      const t = transmissionAt(CHIP, f)
      expect(Number.isFinite(t)).toBe(true)
      expect(t).toBeGreaterThan(0)
      expect(t).toBeLessThanOrEqual(1 + 1e-12)
    }
  })
})
