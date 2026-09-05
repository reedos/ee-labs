import { describe, it, expect } from 'vitest'
import {
  arrayFactor,
  cosineIntegral,
  dipole,
  dipolePattern,
  directivityOf,
  effectiveAperture,
  efficiencyOf,
  friis,
  gainOf,
  hertzianDipole,
  sineIntegral,
} from './antenna.js'
import { C0, ETA0 } from './const.js'
import { logUniform, relative, rng, uniform } from './fuzz.js'

// The antenna group. Two numbers here are the whole check on the quadrature.
//
// The Hertzian element's directivity is exactly three halves, a plain fraction,
// and the quadrature has to give it to eleven figures before it is turned on
// anything else. The half-wave dipole's radiation resistance then comes out two
// ways, from the pattern's integral and from a closed form in Ci(2 pi), and the
// two agree.
//
// The 73.13 ohms the tables give is 73.08 here, and the difference is that the
// tables round eta over four pi to thirty. Both are reported, because a reader
// who checks against a book should find the discrepancy explained rather than
// find neither number.

describe('the quadrature, checked on a fraction', () => {
  it("the Hertzian element's directivity is exactly three halves", () => {
    const d = directivityOf((t) => Math.sin(t))
    expect(relative(d.directivity, 1.5)).toBeLessThan(1e-11)
    expect(d.thetaMaxDeg).toBeCloseTo(90, 5)
    expect(d.beamwidthDeg).toBeCloseTo(90, 6)
  })

  it('an isotropic pattern has a directivity of one', () => {
    expect(relative(directivityOf(() => 1).directivity, 1)).toBeLessThan(1e-12)
  })

  it('the element also reports 3/2 and its radiation resistance', () => {
    const h = hertzianDipole(0.01)
    expect(h.directivity).toBe(1.5)
    expect(h.directivityDbi).toBeCloseTo(1.7609, 4)
    expect(h.radiationResistance).toBeCloseTo(80 * Math.PI ** 2 * 1e-4, 12)
    expect(h.radiationResistance).toBeCloseTo(0.07896, 5)
  })

  it('its guard trips once the element is no longer short', () => {
    expect(hertzianDipole(0.01).guard.ok).toBe(true)
    const long = hertzianDipole(0.2)
    expect(long.guard.ok).toBe(false)
    expect(long.guard.says).toMatch(/current is no longer uniform/)
  })

  it('the cosine and sine integrals agree with their published values', () => {
    expect(cosineIntegral(2 * Math.PI)).toBeCloseTo(-0.0225607, 7)
    expect(cosineIntegral(Math.PI)).toBeCloseTo(0.0736679, 7)
    expect(cosineIntegral(1)).toBeCloseTo(0.3374039, 7)
    expect(sineIntegral(Math.PI)).toBeCloseTo(1.8519371, 7)
    expect(sineIntegral(2 * Math.PI)).toBeCloseTo(1.4181516, 7)
    expect(sineIntegral(0)).toBe(0)
  })
})

describe('the dipole pattern', () => {
  it('radiates nothing along its own wire, at any length', () => {
    const r = rng(0xa9)
    for (let k = 0; k < 30; k++) {
      const u = logUniform(r, 0.05, 2)
      expect(dipolePattern(u, 0)).toBe(0)
      expect(dipolePattern(u, Math.PI)).toBe(0)
    }
  })

  it('is symmetric about the broadside direction', () => {
    const r = rng(0xaa)
    for (let k = 0; k < 30; k++) {
      const u = logUniform(r, 0.05, 2)
      const t = uniform(r, 0.05, Math.PI / 2 - 0.05)
      expect(relative(Math.abs(dipolePattern(u, t)), Math.abs(dipolePattern(u, Math.PI - t)))).toBeLessThan(1e-12)
    }
  })

  it('a short dipole reduces to the Hertzian sine pattern', () => {
    const u = 0.001
    let worst = 0
    for (let k = 1; k < 40; k++) {
      const t = (Math.PI * k) / 40
      const shape = dipolePattern(u, t) / dipolePattern(u, Math.PI / 2)
      worst = Math.max(worst, Math.abs(shape - Math.sin(t)))
    }
    expect(worst).toBeLessThan(1e-4)
  })
})

describe('the half-wave dipole', () => {
  const hw = dipole(0.5)

  it('has a directivity of 1.64092 and a beamwidth of 78.078 degrees', () => {
    expect(hw.directivity).toBeCloseTo(1.64092, 5)
    expect(hw.directivityDbi).toBeCloseTo(2.1509, 4)
    expect(hw.beamwidthDeg).toBeCloseTo(78.078, 3)
    expect(hw.thetaMaxDeg).toBeCloseTo(90, 4)
  })

  it('has a radiation resistance of 73.0790 ohms, two ways', () => {
    expect(hw.radiationResistance).toBeCloseTo(73.079, 3)
    expect(relative(hw.radiationResistance, hw.radiationResistanceClosed)).toBeLessThan(1e-9)
  })

  it('the 73.13 the tables give is the same number with eta over four pi rounded to 30', () => {
    expect(hw.roundedCoefficient).toBeCloseTo(73.13, 2)
    expect(relative(hw.roundedCoefficient, hw.radiationResistance * (30 / (ETA0 / (4 * Math.PI))))).toBeLessThan(1e-12)
  })

  it('its feed current and its current maximum are the same, so the two resistances agree', () => {
    expect(relative(hw.radiationResistance, hw.radiationResistanceAtMax)).toBeLessThan(1e-14)
  })

  it('its assumed current is a half sine, zero at both tips', () => {
    expect(hw.current(0.25)).toBeCloseTo(0, 12)
    expect(hw.current(-0.25)).toBeCloseTo(0, 12)
    expect(hw.current(0)).toBeCloseTo(1, 12)
  })

  it('the thin-wire guard trips on a fat one', () => {
    expect(dipole(0.5, { wireRadius: 0.001 }).guard.ok).toBe(true)
    const fat = dipole(0.5, { wireRadius: 0.02 })
    expect(fat.guard.ok).toBe(false)
    expect(fat.guard.says).toMatch(/its resonance shifts down and its bandwidth widens/)
  })
})

describe('longer dipoles', () => {
  it('the full-wave dipole has no feed current, so its feed resistance is infinite', () => {
    const fw = dipole(1)
    expect(fw.radiationResistance).toBe(Infinity)
    expect(fw.radiationResistanceAtMax).toBeCloseTo(198.95, 1)
    expect(fw.directivity).toBeCloseTo(2.411, 3)
  })

  it('1.25 wavelengths is the most directive straight wire', () => {
    const best = dipole(1.25).directivity
    for (const u of [1.0, 1.1, 1.2, 1.3, 1.4, 1.5]) {
      expect(dipole(u).directivity).toBeLessThanOrEqual(best + 1e-9)
    }
    expect(best).toBeCloseTo(3.2825, 3)
  })

  it('past that the pattern splits and the broadside directivity falls', () => {
    expect(dipole(1.6).directivity).toBeLessThan(dipole(1.25).directivity)
  })

  it('the directivity grows from the short dipole up to the half wave', () => {
    let last = 0
    for (const u of [0.01, 0.1, 0.25, 0.4, 0.5]) {
      const d = dipole(u).directivity
      expect(d).toBeGreaterThanOrEqual(last - 1e-9)
      last = d
    }
  })
})

describe('gain and efficiency', () => {
  it('gain is efficiency times directivity, and the loss is its decibels', () => {
    const g = gainOf(1.64092, 0.9)
    expect(relative(g.gain, 0.9 * 1.64092)).toBeLessThan(1e-14)
    expect(g.gainDbi).toBeCloseTo(1.6933, 4)
    expect(g.lossDb).toBeCloseTo(0.4576, 4)
  })

  it('a lossless antenna has gain equal to directivity', () => {
    expect(gainOf(2.5).gain).toBe(2.5)
    expect(gainOf(2.5).lossDb).toBe(-0)
  })

  it('efficiency above one is declined', () => {
    expect(() => gainOf(1.5, 1.2)).toThrow(/fraction at or below 1/)
  })

  it('efficiency follows the two resistances at the feed', () => {
    expect(efficiencyOf(73.08, 0)).toBe(1)
    expect(efficiencyOf(73.08, 73.08)).toBeCloseTo(0.5, 12)
    expect(efficiencyOf(0.079, 5)).toBeLessThan(0.02)
  })
})

describe('the array factor', () => {
  it('N elements at half a wavelength broadside give a directivity of N', () => {
    for (const n of [2, 4, 8]) {
      expect(relative(arrayFactor({ n, spacingOverLambda: 0.5 }).directivity, n)).toBeLessThan(1e-9)
    }
  })

  it('the beamwidth halves as the array doubles', () => {
    const four = arrayFactor({ n: 4, spacingOverLambda: 0.5 }).beamwidthDeg
    const eight = arrayFactor({ n: 8, spacingOverLambda: 0.5 }).beamwidthDeg
    expect(four).toBeCloseTo(26.323, 2)
    expect(eight).toBeCloseTo(12.803, 2)
    expect(four / eight).toBeGreaterThan(1.9)
  })

  it('a progressive phase steers the beam off broadside', () => {
    expect(arrayFactor({ n: 4, spacingOverLambda: 0.5, betaDeg: 0 }).mainBeamDeg).toBeCloseTo(90, 8)
    expect(arrayFactor({ n: 4, spacingOverLambda: 0.5, betaDeg: -90 }).mainBeamDeg).toBeCloseTo(60, 8)
    expect(arrayFactor({ n: 4, spacingOverLambda: 0.5, betaDeg: -180 }).mainBeamDeg).toBeCloseTo(0, 6)
  })

  it('the factor is one in the beam and small between the lobes', () => {
    const af = arrayFactor({ n: 4, spacingOverLambda: 0.5 })
    expect(af.mag(Math.PI / 2)).toBeCloseTo(1, 12)
    // The first null of a four-element half-wave array sits where psi is a
    // quarter turn, and the factor there is nothing.
    const psiNull = Math.acos(Math.PI / 2 / (2 * Math.PI * 0.5))
    expect(af.mag(psiNull)).toBeLessThan(1e-10)
  })

  it('a spacing past a wavelength grows grating lobes, and half a wavelength does not', () => {
    expect(arrayFactor({ n: 4, spacingOverLambda: 0.5 }).grating.length).toBe(0)
    expect(arrayFactor({ n: 4, spacingOverLambda: 1.5 }).grating.length).toBe(2)
    expect(arrayFactor({ n: 4, spacingOverLambda: 1 }).grating.length).toBeGreaterThan(0)
  })

  it('a taper trades beamwidth for sidelobes', () => {
    const uniform4 = arrayFactor({ n: 4, spacingOverLambda: 0.5 })
    const binomial = arrayFactor({ n: 4, spacingOverLambda: 0.5, amplitudes: [1, 3, 3, 1] })
    // The tapered array has a wider beam and a lower directivity.
    expect(binomial.beamwidthDeg).toBeGreaterThan(uniform4.beamwidthDeg)
    expect(binomial.directivity).toBeLessThan(uniform4.directivity)
    // And no sidelobes at all, which is what the binomial taper is for. The
    // check is that the factor falls without ever rising again as the angle
    // leaves broadside, so there is no second lobe anywhere.
    let last = binomial.mag(Math.PI / 2)
    for (let k = 200; k >= 0; k--) {
      const t = (Math.PI * k) / 400
      const m = binomial.mag(t)
      expect(m).toBeLessThanOrEqual(last + 1e-9)
      last = m
    }
    // The uniform array does have one, and it rises again below broadside.
    let rose = false
    let prev = uniform4.mag(Math.PI / 2)
    for (let k = 200; k >= 0; k--) {
      const m = uniform4.mag((Math.PI * k) / 400)
      if (m > prev + 1e-6) rose = true
      prev = m
    }
    expect(rose).toBe(true)
  })

  it('an amplitude list of the wrong length is declined', () => {
    expect(() => arrayFactor({ n: 4, spacingOverLambda: 0.5, amplitudes: [1, 1] })).toThrow(/entries for 4 elements/)
  })
})

describe('Friis, and the link budget', () => {
  const link = { f: 2.4e9, distance: 1000, gainT: 10 ** 1.2, gainR: 10 ** 0.2, powerT: 0.1 }

  it('gives the received power the plan quotes', () => {
    const q = friis(link)
    expect(q.receivedDbm).toBeCloseTo(-66.052, 3)
    expect(q.freeSpaceLossDb).toBeCloseTo(100.05, 2)
    expect(q.lambda * 100).toBeCloseTo(12.49, 2)
  })

  it('the received power falls as the square of the distance', () => {
    const r = rng(0xab)
    for (let k = 0; k < 30; k++) {
      const d = logUniform(r, 1, 1e6)
      const near = friis({ ...link, distance: d }).received
      const far = friis({ ...link, distance: 2 * d }).received
      expect(relative(near, 4 * far)).toBeLessThan(1e-12)
    }
  })

  it('the free-space loss rises 6 dB per doubling of distance and of frequency', () => {
    const a = friis({ ...link, distance: 1000 }).freeSpaceLossDb
    const b = friis({ ...link, distance: 2000 }).freeSpaceLossDb
    const c = friis({ ...link, f: 4.8e9 }).freeSpaceLossDb
    expect(b - a).toBeCloseTo(6.0206, 4)
    expect(c - a).toBeCloseTo(6.0206, 4)
  })

  it('the effective aperture is the gain times lambda squared over four pi', () => {
    const q = friis(link)
    const A = effectiveAperture(link.gainT, q.lambda)
    expect(A * 1e4).toBeCloseTo(196.8, 1)
    expect(relative(A, (link.gainT * q.lambda ** 2) / (4 * Math.PI))).toBeLessThan(1e-14)
  })

  it('the far-field guard holds at a long link and trips at a short one', () => {
    const far = friis({ ...link, apertureT: 0.5 })
    expect(far.guard.ok).toBe(true)
    expect(far.guard.says).toMatch(/Friis holds/)
    const near = friis({ ...link, distance: 1, apertureT: 0.5 })
    expect(near.guard.ok).toBe(false)
    expect(near.guard.says).toMatch(/near field/)
    expect(near.guard.fraunhofer).toBeCloseTo((2 * 0.25) / (C0 / 2.4e9), 6)
  })

  it('without an aperture there is no far-field guard to report', () => {
    expect(friis(link).guard).toBeUndefined()
  })

  it('a link of no length is declined', () => {
    expect(() => friis({ ...link, distance: 0 })).toThrow(/distance must be a positive number/)
  })
})
