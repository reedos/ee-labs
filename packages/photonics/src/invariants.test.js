import { describe, it, expect } from 'vitest'
import * as P from '../index.js'
import { newtonDC, solutionScale } from '@ee-labs/network'
import { BANDS, logUniform, pick, randomCavity, randomFibre, randomWavelength, relative, rng, uniform } from './fuzz.js'

// The invariants of `PHOTONICS_LAB_PLAN.md` §2.11, fuzzed.
//
// This sitting builds Phases 1 and 2, so the invariants it can hold are 1, 2,
// 9, 10, 11 and 12. Invariants 3 to 8 belong to `receiver.js` and `rate.js`,
// which are the next sitting's, and 13's cross-lab pins wait on the labs they
// name. The numbering below is the plan's, so a later sitting adds its rows
// without renumbering these.
//
// The hostile corners the plan names for these six are here: a photodiode with
// no light on it, a cavity with a reflectance approaching one, a fibre with no
// dispersion, and a wavelength at the edge of each of the three windows.

const SEEDS = [1, 2, 3, 5, 8, 13]

describe('invariant 1: responsivity is bounded by one carrier per photon', () => {
  it('never rises above the ideal, and meets it exactly at unity efficiency', () => {
    for (const seed of SEEDS) {
      const r = rng(seed * 7919)
      for (let k = 0; k < 200; k++) {
        const lambda = randomWavelength(r)
        const eta = uniform(r, 0, 1)
        const ideal = P.idealResponsivity(lambda)
        expect(P.responsivity({ eta, lambda })).toBeLessThanOrEqual(ideal)
        expect(relative(P.responsivity({ eta: 1, lambda }), ideal)).toBe(0)
      }
    }
  })

  it('the ideal is the elementary charge over one photon energy', () => {
    const r = rng(97)
    for (let k = 0; k < 200; k++) {
      const lambda = randomWavelength(r)
      expect(relative(P.idealResponsivity(lambda), P.Q_E / P.photonEnergy(lambda))).toBeLessThan(1e-14)
    }
  })
})

describe('invariant 2: the photodiode is a circuit', () => {
  it('the solver reproduces the closed form at every bias, load and illumination', () => {
    const r = rng(1009)
    for (let k = 0; k < 60; k++) {
      const at = {
        eta: uniform(r, 0.2, 1),
        lambda: randomWavelength(r),
        power: logUniform(r, 1e-9, 1e-3),
        dark: logUniform(r, 1e-12, 1e-8),
        bias: uniform(r, 1, 20),
        load: logUniform(r, 50, 1e5),
      }
      const net = P.photodiodeNet(at)
      const { sol } = newtonDC(net)
      // A node equation is conductances times volts, so the scale its residual
      // is judged against is the bias over the load, not the nanoamp the light
      // happens to make. Asking "is this zero?" against a fixed epsilon, or
      // against the smallest branch current, is what this suite has learned not
      // to do.
      const scale = solutionScale(sol).v / at.load
      expect(sol.maxResidual / scale, `KCL at seed ${k}`).toBeLessThan(1e-12)
      // The junction under a reverse bias takes back its saturation current and
      // no more, so the load carries the closed form to within that.
      const closed = P.photocurrent(at)
      expect(Math.abs(Math.abs(sol.i.RL) - (closed - sol.i.D1)) / scale, `closed form at seed ${k}`).toBeLessThan(1e-12)
    }
  })

  it('with no light the detector reads the dark current, and the node still balances', () => {
    const { sol } = newtonDC(P.photodiodeNet({ eta: 0.8, lambda: 1550e-9, power: 0, dark: 1e-9, bias: 5, load: 10000 }))
    expect(relative(Math.abs(sol.i.RL), 1e-9)).toBeLessThan(1e-4)
    expect(sol.maxResidual).toBeLessThan(1e-15)
  })
})

describe('invariant 9: attenuation composes', () => {
  it('two lengths in series lose the sum in decibels and the product in ratio', () => {
    for (const seed of SEEDS) {
      const r = rng(seed * 104729)
      for (let k = 0; k < 100; k++) {
        const f = randomFibre(r)
        const l1 = logUniform(r, 0.01, 400)
        const l2 = logUniform(r, 0.01, 400)
        const sum = P.lossDb({ alpha: f.alpha, length: l1 }) + P.lossDb({ alpha: f.alpha, length: l2 })
        expect(relative(P.lossDb({ alpha: f.alpha, length: l1 + l2 }), sum)).toBeLessThan(1e-12)
        const product = P.powerRatio(P.lossDb({ alpha: f.alpha, length: l1 })) * P.powerRatio(P.lossDb({ alpha: f.alpha, length: l2 }))
        expect(relative(P.powerRatio(sum), product)).toBeLessThan(1e-12)
      }
    }
  })

  it('a fibre of no length loses nothing, and passes every photon', () => {
    const r = rng(31337)
    for (let k = 0; k < 50; k++) {
      const f = randomFibre(r)
      expect(P.lossDb({ alpha: f.alpha, length: 0 })).toBe(0)
      expect(P.powerRatio(0)).toBe(1)
    }
  })
})

describe('invariant 10: dispersion composes, and D comes back off beta two', () => {
  it('the spread over two lengths is the sum of the two spreads', () => {
    for (const seed of SEEDS) {
      const r = rng(seed * 15485863)
      for (let k = 0; k < 100; k++) {
        const f = randomFibre(r)
        const dl = logUniform(r, 1e-12, 1e-8)
        const l1 = logUniform(r, 0.01, 400)
        const l2 = logUniform(r, 0.01, 400)
        const sum =
          P.pulseSpread({ D: f.D, length: l1, dLambda: dl }) + P.pulseSpread({ D: f.D, length: l2, dLambda: dl })
        expect(relative(P.pulseSpread({ D: f.D, length: l1 + l2, dLambda: dl }), sum)).toBeLessThan(1e-12)
      }
    }
  })

  it('beta two returns the dispersion parameter it was made from', () => {
    for (const seed of SEEDS) {
      const r = rng(seed * 32452843)
      for (let k = 0; k < 100; k++) {
        const lambda = randomWavelength(r)
        const D = pick(r, [uniform(r, -20, -1), uniform(r, 1, 25)])
        const beta2 = P.beta2FromD({ D, lambda })
        expect(relative(P.dFromBeta2({ beta2, lambda }), D)).toBeLessThan(1e-12)
      }
    }
  })

  it('a fibre with no dispersion spreads nothing, and has no bandwidth limit to state', () => {
    expect(P.pulseSpread({ D: 0, length: 80, dLambda: 1e-9 })).toBe(0)
    expect(() => P.bandwidthLimit({ spread: 0 })).toThrow(/pulse spread must be a positive number/)
    expect(() => P.bandwidthDistance({ D: 0, dLambda: 1e-9 })).toThrow(/pulse spread over one kilometre/)
  })

  it('a source of no width spreads nothing either, at every wavelength in the three windows', () => {
    for (const lambda of BANDS) {
      expect(P.pulseSpread({ D: 17, length: 80, dLambda: 0 })).toBe(0)
      expect(P.beta2FromD({ D: 0, lambda })).toBe(-0)
    }
  })
})

describe('invariant 11: the cavity is periodic', () => {
  it('the transmission at a phase and at that phase plus a turn are equal', () => {
    for (const seed of SEEDS) {
      const r = rng(seed * 49979687)
      for (let k = 0; k < 100; k++) {
        const c = randomCavity(r)
        const phase = uniform(r, -100, 100)
        expect(Math.abs(P.airy({ ...c, phase }) - P.airy({ ...c, phase: phase + 2 * Math.PI }))).toBeLessThan(1e-12)
      }
    }
  })

  it('the peaks are one free spectral range apart, and each transmits everything', () => {
    for (const seed of SEEDS) {
      const r = rng(seed * 86028121)
      for (let k = 0; k < 40; k++) {
        const c = randomCavity(r)
        const fsr = P.freeSpectralRange(c)
        const centre = P.opticalFrequency(randomWavelength(r))
        const s = P.spectrum({ ...c, centre, span: 4 * fsr, points: 51 })
        expect(s.peaks.length).toBeGreaterThanOrEqual(3)
        for (let m = 1; m < s.peaks.length; m++) {
          // A peak sits at a whole multiple of the spacing, and at an optical
          // frequency that multiple runs to hundreds of thousands, so the
          // difference of two of them carries the rounding of the larger.
          expect(relative(s.peaks[m].freq - s.peaks[m - 1].freq, fsr)).toBeLessThan(1e-9)
        }
        for (const peak of s.peaks) expect(P.transmissionAt({ ...c, freq: peak.freq })).toBeCloseTo(1, 6)
      }
    }
  })

  it('a cavity whose mirrors keep everything has no width, and says so rather than dividing by zero', () => {
    expect(() => P.finesse({ n: 3.5, length: 300e-6, R1: 1 })).toThrow(/infinite finesse/)
    expect(() => P.linewidth({ n: 3.5, length: 300e-6, R1: 1, R2: 1 })).toThrow(P.PhotonicsError)
    // Just below one it is finite, and very large.
    expect(P.finesse({ n: 3.5, length: 300e-6, R1: 0.999999 })).toBeGreaterThan(1e6)
  })
})

describe('invariant 12: the cavity is not rational', () => {
  it('the hand-over to systems is refused, and the message names the factor and the reason', () => {
    expect(() => P.refuseRational()).toThrow(P.PhotonicsError)
    let caught = null
    try {
      P.refuseRational()
    } catch (err) {
      caught = err
    }
    expect(caught.object).toBe('Fabry-Perot cavity')
    expect(caught.message).toMatch(/transcendental/)
    expect(caught.message).toMatch(/no finite poles or zeros/)
  })

  it('the refusal names the transmission line as the other place the suite says this', () => {
    expect(P.rationalAvailable().says).toMatch(/transmission line/)
  })

  it('nothing in this package hands a cavity to systems by another door', () => {
    for (const [name, value] of Object.entries(P)) {
      if (typeof value !== 'function') continue
      expect(name, `${name} looks like a systems hand-over`).not.toMatch(/^(toSystems|asTF|transferOf)$/)
    }
  })
})
