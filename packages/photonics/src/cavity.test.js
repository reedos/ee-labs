import { describe, it, expect } from 'vitest'
import {
  airy,
  contrast,
  facetReflectance,
  LINEWIDTH_GUARD,
  finesse,
  freeSpectralRange,
  fsrWavelength,
  halfPowerWidth,
  linewidth,
  linewidthGuard,
  mirrorLoss,
  photonLifetime,
  rationalAvailable,
  refuseRational,
  roundTrip,
  roundTripPhase,
  spectrum,
  transmissionAt,
} from './cavity.js'
import { C0, PhotonicsError } from './const.js'
import { opticalFrequency } from './photon.js'
import { randomCavity, relative, rng, uniform } from './fuzz.js'

// The Fabry-Perot cavity. Every quantity here is a closed form in the
// round-trip phase, so the tolerances are floating point.
//
// The reference cavity is the plan's laser: an index of 3.5 over 300 µm, with
// bare facets. Its reflectance is computed from the index rather than typed,
// which is what makes C5's claim (the mirrors set the threshold) the same
// number as F1's (the mirrors set the finesse).

const REF = { n: 3.5, length: 300e-6 }
const R_FACET = facetReflectance({ n: REF.n })
const SPEC = { ...REF, R1: R_FACET }

describe('the cavity the laser is built in', () => {
  it('a bare facet is a mirror, and its reflectance follows from the index step', () => {
    expect(R_FACET).toBeCloseTo(Math.pow((3.5 - 1) / (3.5 + 1), 2), 15)
    expect(R_FACET).toBeCloseTo(0.30864, 5)
  })

  it('the free spectral range is the round-trip time inverted', () => {
    const fsr = freeSpectralRange(REF)
    expect(fsr / 1e9).toBeCloseTo(142.76, 2)
    expect(relative(fsr, 1 / ((2 * REF.n * REF.length) / C0))).toBeLessThan(1e-14)
  })

  it('the same spacing in wavelength is 1.144 nm at 1550 nm', () => {
    const dl = fsrWavelength({ ...REF, lambda: 1550e-9 })
    expect(dl * 1e9).toBeCloseTo(1.14405, 5)
    // The wavelength spacing and the frequency spacing are the same fact.
    expect(relative((dl * C0) / Math.pow(1550e-9, 2), freeSpectralRange(REF))).toBeLessThan(1e-12)
  })

  it('the finesse rises with the reflectance, and the three the lesson quotes hold', () => {
    expect(finesse(SPEC)).toBeCloseTo(2.5245, 4)
    expect(finesse({ ...REF, R1: 0.3 })).toBeCloseTo(2.4582, 4)
    expect(finesse({ ...REF, R1: 0.9 })).toBeCloseTo(29.804, 3)
    expect(finesse({ ...REF, R1: 0.99 })).toBeCloseTo(312.58, 2)
  })

  it('the linewidth is the free spectral range divided by the finesse', () => {
    expect(linewidth(SPEC) / 1e9).toBeCloseTo(56.549, 3)
    expect(relative(linewidth(SPEC), freeSpectralRange(REF) / finesse(SPEC))).toBe(0)
  })

  it('the peak to valley contrast is the same three reflectances in decibels', () => {
    expect(contrast({ ...REF, R1: 0.3 }).db).toBeCloseTo(5.377, 3)
    expect(contrast({ ...REF, R1: 0.9 }).db).toBeCloseTo(25.575, 3)
    expect(contrast({ ...REF, R1: 0.99 }).db).toBeCloseTo(45.977, 3)
  })

  it('a mirror that loses nothing has no linewidth, and the message says so', () => {
    expect(() => finesse({ ...REF, R1: 1 })).toThrow(PhotonicsError)
    expect(() => finesse({ ...REF, R1: 1 })).toThrow(/infinite finesse and no linewidth/)
  })

  it('the mirror loss and the photon lifetime come off the same reflectance', () => {
    expect(mirrorLoss({ R1: R_FACET, length: REF.length }) / 100).toBeCloseTo(19.593, 3)
    const tau = photonLifetime({ ...REF, R1: R_FACET })
    expect(relative(tau, REF.n / (C0 * mirrorLoss({ R1: R_FACET, length: REF.length })))).toBe(0)
    // A better mirror keeps the light longer, which is what lowers a threshold.
    expect(photonLifetime({ ...REF, R1: 0.9 })).toBeGreaterThan(tau)
  })
})

describe('the transmission is periodic in the round-trip phase', () => {
  it('a peak sits at every whole turn, and a valley halfway between', () => {
    for (const m of [0, 1, 2, 7]) {
      expect(airy({ ...SPEC, phase: 2 * Math.PI * m })).toBeCloseTo(1, 12)
    }
    const valley = airy({ ...SPEC, phase: Math.PI })
    expect(relative(1 / valley, contrast(SPEC).ratio)).toBeLessThan(1e-12)
  })

  it('the phase and the phase plus a turn transmit the same, at random cavities', () => {
    const r = rng(211)
    for (let k = 0; k < 400; k++) {
      const c = randomCavity(r)
      const phase = uniform(r, -40, 40)
      const a = airy({ ...c, phase })
      const b = airy({ ...c, phase: phase + 2 * Math.PI })
      expect(Math.abs(a - b)).toBeLessThan(1e-12)
    }
  })

  it('the round-trip phase is a whole turn once per free spectral range', () => {
    const r = rng(223)
    for (let k = 0; k < 200; k++) {
      const c = randomCavity(r)
      const f = uniform(r, 1e12, 4e14)
      const step = freeSpectralRange(c)
      const d = roundTripPhase({ ...c, freq: f + step }) - roundTripPhase({ ...c, freq: f })
      // The phase itself runs to millions of radians at an optical frequency,
      // so the difference of two of them carries that much rounding with it.
      expect(relative(d, 2 * Math.PI)).toBeLessThan(1e-8)
    }
  })

  it('the peaks a spectrum marks are one free spectral range apart', () => {
    const centre = opticalFrequency(1550e-9)
    const s = spectrum({ ...SPEC, centre, span: 5 * freeSpectralRange(REF), points: 601 })
    expect(s.peaks.length).toBeGreaterThanOrEqual(4)
    for (let k = 1; k < s.peaks.length; k++) {
      expect(relative(s.peaks[k].freq - s.peaks[k - 1].freq, s.fsr)).toBeLessThan(1e-12)
    }
    for (const peak of s.peaks) expect(transmissionAt({ ...SPEC, freq: peak.freq })).toBeCloseTo(1, 10)
  })

  it('the spectrum carries the finesse and the linewidth its own spec gives', () => {
    const s = spectrum({ ...SPEC, centre: opticalFrequency(1550e-9), span: 3 * freeSpectralRange(REF) })
    expect(relative(s.finesse, finesse(SPEC))).toBe(0)
    expect(relative(s.linewidth, linewidth(SPEC))).toBe(0)
    expect(s.points.length).toBe(401)
    for (const p of s.points) expect(p.t).toBeGreaterThan(0)
  })

  it('the half-power width is where the drawn curve falls to half its peak', () => {
    const centre = opticalFrequency(1550e-9)
    for (const R1 of [0.3, 0.9, 0.99]) {
      const spec = { ...REF, R1 }
      const peak = spectrum({ ...spec, centre, span: freeSpectralRange(REF) }).peaks[0]
      const t = transmissionAt({ ...spec, freq: peak.freq + halfPowerWidth(spec) / 2 })
      expect(t).toBeCloseTo(0.5, 9)
    }
  })

  it('the quoted linewidth is the half-power width once the finesse is above ten', () => {
    const r = rng(227)
    let low = 0
    for (let k = 0; k < 400; k++) {
      const c = randomCavity(r)
      const g = linewidthGuard(c)
      expect(g.quantity).toBe('finesse')
      expect(g.threshold).toBe(LINEWIDTH_GUARD)
      if (g.ok) expect(g.error).toBeLessThan(0.01)
      else low++
      expect(relative(g.quoted, linewidth(c))).toBe(0)
      expect(relative(g.exact, halfPowerWidth(c))).toBe(0)
    }
    expect(low).toBeGreaterThan(0)
  })

  it('at a bare facet the guard is loosened, and it says by how much', () => {
    const g = linewidthGuard(SPEC)
    expect(g.ok).toBe(false)
    expect(g.error).toBeGreaterThan(0.05)
    expect(g.says).toMatch(/below 10/)
    expect(g.says).toMatch(/per cent narrower/)
  })

  it('the round trip loses more when the cavity has an internal loss', () => {
    const bare = roundTrip({ R1: 0.9, length: 300e-6 })
    const lossy = roundTrip({ R1: 0.9, length: 300e-6, lossInternal: 2000 })
    expect(lossy).toBeLessThan(bare)
    expect(finesse({ ...REF, R1: 0.9, lossInternal: 2000 })).toBeLessThan(finesse({ ...REF, R1: 0.9 }))
  })
})

describe('the cavity has no rational transfer function', () => {
  it('the hand-over is declined, and the message names the transcendental factor', () => {
    expect(() => refuseRational()).toThrow(PhotonicsError)
    expect(() => refuseRational()).toThrow(/e\^\(−j2βL\)/)
    expect(() => refuseRational()).toThrow(/no finite poles or zeros/)
  })

  it('the refusal is available as a sentence, and it says the response is exact', () => {
    const r = rationalAvailable()
    expect(r.ok).toBe(false)
    expect(r.says).toMatch(/transmission itself is exact at every frequency/)
    expect(r.says).toMatch(/transmission line/)
  })

  it('the refusal is a finished feature, with no promise to complete it later', () => {
    expect(rationalAvailable().says).not.toMatch(/TODO|for now|yet|later/i)
  })
})
