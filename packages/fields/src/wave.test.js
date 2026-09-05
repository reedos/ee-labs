import { describe, it, expect } from 'vitest'
import {
  csqrt,
  describeMedium,
  planeWave,
  polarisation,
  reflectNormal,
  reflectOblique,
  standingWave,
  standingWaveRatio,
} from './wave.js'
import { C0, ETA0, FieldsError } from './const.js'
import { logUniform, relative, rng, uniform } from './fuzz.js'

// Maxwell as a wave. Everything here is exact, so the tolerances are floating
// point and not physics.
//
// The two claims worth naming. In a LOSSLESS medium alpha is exactly zero and
// eta is exactly real, because the lossless branch computes them from a real
// square root rather than from a complex one that would leave a rounding error
// in the real part. And for two lossless media the reflected and transmitted
// power fractions sum to exactly one, which is the conservation law that says
// the Fresnel coefficients are right.

describe('the plane wave in a medium', () => {
  it('free space has the impedance and the speed it is defined to have', () => {
    const w = planeWave(1e9)
    expect(w.alpha).toBe(0)
    expect(w.eta[1]).toBe(0)
    expect(w.etaMag).toBeCloseTo(376.7303, 4)
    expect(relative(w.etaMag, ETA0)).toBeLessThan(1e-15)
    expect(relative(w.vp, C0)).toBeLessThan(1e-15)
    expect(w.lambda * 1000).toBeCloseTo(299.8, 1)
  })

  it('a lossless medium slows the wave and lowers its impedance together', () => {
    const r = rng(0x1055)
    for (let k = 0; k < 60; k++) {
      const epsr = logUniform(r, 1, 100)
      const mur = logUniform(r, 1, 50)
      const w = planeWave(logUniform(r, 1e3, 1e11), { epsr, mur })
      expect(w.alpha).toBe(0)
      expect(w.eta[1]).toBe(0)
      expect(relative(w.vp, C0 / Math.sqrt(epsr * mur))).toBeLessThan(1e-13)
      expect(relative(w.etaMag, ETA0 * Math.sqrt(mur / epsr))).toBeLessThan(1e-13)
      expect(relative(w.n, Math.sqrt(epsr * mur))).toBeLessThan(1e-13)
      expect(w.penetration).toBe(Infinity)
      expect(w.lossless).toBe(true)
    }
  })

  it('a lossy medium attenuates, and its impedance turns', () => {
    const r = rng(0x1056)
    for (let k = 0; k < 40; k++) {
      const w = planeWave(logUniform(r, 1e3, 1e10), { epsr: logUniform(r, 1, 90), sigma: logUniform(r, 1e-4, 1e2) })
      expect(w.alpha).toBeGreaterThan(0)
      expect(w.beta).toBeGreaterThan(0)
      expect(w.etaDeg).toBeGreaterThan(0)
      expect(w.etaDeg).toBeLessThan(45.0000001)
      expect(relative(w.penetration, 1 / w.alpha)).toBeLessThan(1e-15)
    }
  })

  it('a good conductor has alpha equal to beta, and a 45 degree impedance', () => {
    // A loss tangent of ten thousand is far into the conductor regime.
    const w = planeWave(1e3, { epsr: 1, sigma: 5.8e7 })
    expect(w.lossTangent).toBeGreaterThan(1e10)
    expect(relative(w.alpha, w.beta)).toBeLessThan(1e-8)
    expect(w.etaDeg).toBeCloseTo(45, 6)
    // And its penetration depth is the skin depth.
    expect(relative(w.penetration, 1 / Math.sqrt(Math.PI * 1e3 * 1.25663706212e-6 * 5.8e7))).toBeLessThan(1e-8)
  })

  it('seawater at 1 MHz penetrates 25.18 cm, at a 44.97 degree impedance', () => {
    const w = planeWave(1e6, { epsr: 81, sigma: 4 })
    expect(w.lossTangent).toBeCloseTo(887.7, 1)
    expect(w.alpha).toBeCloseTo(3.972, 3)
    expect(w.penetration * 100).toBeCloseTo(25.18, 2)
    expect(w.etaDeg).toBeCloseTo(44.97, 2)
  })

  it('the complex square root takes the principal branch', () => {
    expect(csqrt([4, 0])[0]).toBeCloseTo(2, 14)
    expect(csqrt([4, 0])[1]).toBeCloseTo(0, 14)
    const j = csqrt([-1, 0])
    expect(j[0]).toBeCloseTo(0, 14)
    expect(j[1]).toBeCloseTo(1, 14)
  })

  it('a medium needs positive permittivity and permeability', () => {
    expect(() => describeMedium({ epsr: 0 })).toThrow(/epsr must be a positive number/)
    expect(() => describeMedium({ sigma: -1 })).toThrow(/sigma must be zero or a positive number/)
  })
})

describe('polarisation', () => {
  it('in phase is linear, and a quarter cycle with equal amplitudes is circular', () => {
    expect(polarisation({ ax: 1, ay: 1, phaseDeg: 0 }).kind).toBe('linear')
    expect(polarisation({ ax: 1, ay: 0.3, phaseDeg: 180 }).kind).toBe('linear')
    const c = polarisation({ ax: 1, ay: 1, phaseDeg: 90 })
    expect(c.kind).toBe('circular')
    expect(c.axialRatio).toBeCloseTo(1, 10)
    expect(c.sense).toBe('left hand')
    expect(polarisation({ ax: 1, ay: 1, phaseDeg: -90 }).sense).toBe('right hand')
  })

  it('anything else is elliptical, and the axial ratio says how far', () => {
    const e = polarisation({ ax: 1, ay: 0.5, phaseDeg: 90 })
    expect(e.kind).toBe('elliptical')
    expect(e.axialRatio).toBeCloseTo(2, 10)
    expect(e.axialRatioDb).toBeCloseTo(6.0206, 4)
  })

  it('the tip traces the ellipse the axial ratio describes', () => {
    const e = polarisation({ ax: 1, ay: 0.5, phaseDeg: 90 })
    let hi = 0
    let lo = Infinity
    for (let k = 0; k < 2000; k++) {
      const m = Math.hypot(...e.at((2 * Math.PI * k) / 2000))
      hi = Math.max(hi, m)
      lo = Math.min(lo, m)
    }
    expect(relative(hi, e.major)).toBeLessThan(1e-5)
    expect(relative(lo, e.minor)).toBeLessThan(1e-5)
  })

  it('a linear wave traces a line through the origin', () => {
    const l = polarisation({ ax: 1, ay: 0.4, phaseDeg: 0 })
    expect(l.minor).toBeCloseTo(0, 12)
    expect(l.tiltDeg).toBeCloseTo((Math.atan2(0.4, 1) * 180) / Math.PI, 6)
  })

  it('a wave with no amplitude at all is declined', () => {
    expect(() => polarisation({ ax: 0, ay: 0 })).toThrow(/no amplitude in either transverse direction/)
  })
})

describe('reflection at normal incidence', () => {
  it('the two power fractions sum to one, over 80 lossless pairs', () => {
    const r = rng(0xf0e5)
    let worst = 0
    for (let k = 0; k < 80; k++) {
      const m1 = { epsr: logUniform(r, 1, 20), mur: logUniform(r, 1, 5) }
      const m2 = { epsr: logUniform(r, 1, 20), mur: logUniform(r, 1, 5) }
      const q = reflectNormal(logUniform(r, 1e6, 1e11), m1, m2)
      worst = Math.max(worst, Math.abs(q.powerReflected + q.powerTransmitted - 1))
    }
    expect(worst).toBeLessThan(1e-12)
  })

  it('a matched pair reflects nothing, whatever the pair is made of', () => {
    // Two media of the same impedance but different speeds still match.
    const q = reflectNormal(1e9, { epsr: 2, mur: 2 }, { epsr: 8, mur: 8 })
    expect(q.mag).toBeLessThan(1e-15)
    expect(q.swr).toBeCloseTo(1, 12)
  })

  it('tau is one plus gamma, always', () => {
    const r = rng(0xf0e6)
    for (let k = 0; k < 40; k++) {
      const q = reflectNormal(1e9, { epsr: logUniform(r, 1, 20) }, { epsr: logUniform(r, 1, 20) })
      expect(relative(q.tau[0], 1 + q.gamma[0])).toBeLessThan(1e-14)
    }
  })

  it('air into a denser dielectric reflects with a sign change', () => {
    const q = reflectNormal(1e9, { epsr: 1 }, { epsr: 4 })
    expect(q.mag).toBeCloseTo(1 / 3, 12)
    expect(Math.abs(q.deg)).toBeCloseTo(180, 10)
    expect(100 * q.powerReflected).toBeCloseTo(11.11, 2)
    expect(q.swr).toBeCloseTo(2, 10)
  })

  it('the standing-wave ratio runs from one to infinity', () => {
    expect(standingWaveRatio(0)).toBe(1)
    expect(standingWaveRatio(0.5)).toBeCloseTo(3, 12)
    expect(standingWaveRatio(1)).toBe(Infinity)
  })
})

describe('the standing wave in front of the interface', () => {
  const beta = (2 * Math.PI) / 0.3

  it('runs between one plus and one minus the reflection magnitude', () => {
    const sw = standingWave([0.5, 0], beta)
    let hi = 0
    let lo = Infinity
    for (let k = 0; k <= 2000; k++) {
      const m = sw.at((0.3 * k) / 2000).mag
      hi = Math.max(hi, m)
      lo = Math.min(lo, m)
    }
    expect(relative(hi, sw.max)).toBeLessThan(1e-5)
    expect(relative(lo, sw.min)).toBeLessThan(1e-4)
    expect(relative(hi / lo, sw.swr)).toBeLessThan(1e-4)
  })

  it('the first minimum sits where the report says it does', () => {
    for (const g of [[0.5, 0], [-0.4, 0], [0.3, 0.3]]) {
      const sw = standingWave(g, beta)
      const here = sw.at(sw.firstMinAt).mag
      const before = sw.at(sw.firstMinAt - 0.002).mag
      const after = sw.at(sw.firstMinAt + 0.002).mag
      expect(here).toBeLessThan(before)
      expect(here).toBeLessThan(after)
    }
  })

  it('the pattern repeats every half wavelength', () => {
    const sw = standingWave([0.5, 0.2], beta)
    expect(relative(sw.at(0.04).mag, sw.at(0.04 + sw.period).mag)).toBeLessThan(1e-12)
    expect(sw.period).toBeCloseTo(0.15, 12)
  })
})

describe('oblique incidence', () => {
  it('Snell bends the transmitted ray, and the angle follows the indices', () => {
    const o = reflectOblique(30, { epsr: 1 }, { epsr: 4 })
    expect(o.n1).toBeCloseTo(1, 12)
    expect(o.n2).toBeCloseTo(2, 12)
    expect(Math.sin((o.transmittedDeg * Math.PI) / 180)).toBeCloseTo(Math.sin(Math.PI / 6) / 2, 12)
  })

  it('the parallel polarisation reflects nothing at the Brewster angle', () => {
    const brewster = (Math.atan(2) * 180) / Math.PI
    const o = reflectOblique(brewster, { epsr: 1 }, { epsr: 4 }, 'parallel')
    expect(o.brewsterDeg).toBeCloseTo(brewster, 10)
    expect(o.mag).toBeLessThan(1e-14)
    // The perpendicular polarisation still reflects plenty there.
    expect(o.perpendicular.mag).toBeCloseTo(0.6, 10)
  })

  it('past the critical angle everything reflects, with a phase', () => {
    const o = reflectOblique(45, { epsr: 4 }, { epsr: 1 }, 'perpendicular')
    expect(o.criticalDeg).toBeCloseTo(30, 10)
    expect(o.total).toBe(true)
    expect(o.transmittedDeg).toBe(null)
    expect(o.mag).toBeCloseTo(1, 12)
    expect(Math.abs(o.deg)).toBeGreaterThan(1)
  })

  it('below the critical angle it does not, and there is a transmitted ray', () => {
    const o = reflectOblique(25, { epsr: 4 }, { epsr: 1 }, 'perpendicular')
    expect(o.total).toBe(false)
    expect(o.mag).toBeLessThan(1)
    expect(o.transmittedDeg).toBeGreaterThan(25)
  })

  it('at zero degrees it agrees with the normal-incidence formula', () => {
    const normal = reflectNormal(1e9, { epsr: 1 }, { epsr: 4 })
    const o = reflectOblique(0, { epsr: 1 }, { epsr: 4 }, 'perpendicular')
    expect(o.mag).toBeCloseTo(normal.mag, 12)
  })

  it('a conducting medium is declined, with the reason', () => {
    expect(() => reflectOblique(30, { epsr: 1 }, { epsr: 4, sigma: 1 })).toThrow(FieldsError)
    expect(() => reflectOblique(30, { epsr: 1 }, { epsr: 4, sigma: 1 })).toThrow(/bends the transmitted angle into the complex plane/)
    expect(() => reflectOblique(30, { epsr: 1 }, { epsr: 4, sigma: 1 })).toThrow(/declines that case/)
  })

  it('an angle at or past ninety degrees is declined', () => {
    expect(() => reflectOblique(90, { epsr: 1 }, { epsr: 4 })).toThrow(/measured from the normal/)
    expect(() => reflectOblique(-5, { epsr: 1 }, { epsr: 4 })).toThrow(/measured from the normal/)
  })

  it('an unknown polarisation is declined', () => {
    expect(() => reflectOblique(30, { epsr: 1 }, { epsr: 4, mur: 1 }, 'sideways')).toThrow(/pol must be/)
  })
})
