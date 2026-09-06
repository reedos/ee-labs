import { describe, it, expect } from 'vitest'
import {
  cavityQ,
  cavityResonance,
  cutoff,
  describeGuide,
  modeAt,
  modes,
  resonances,
  singleModeBand,
  te10Field,
} from './waveguide.js'
import { C0, SIGMA_CU } from './const.js'
import { logUniform, relative, rng } from './fuzz.js'

// The guide and the cavity. Every cutoff and every resonance is a closed form
// of two or three dimensions, so the checks are of the relations between them
// rather than of an integral.
//
// The one relation worth naming is that the phase and group velocities multiply
// to the speed of light squared, exactly, at every frequency above cutoff. That
// is what says the phase velocity above c is not a signal travelling that fast,
// and K2 puts the product on screen for the reader to check.

const WR90 = { a: 0.02286, b: 0.01016 }

describe('the guide, and which dimension is which', () => {
  it('a guide taller than it is wide is declined, and the message says why', () => {
    expect(() => describeGuide({ a: 0.01, b: 0.02 })).toThrow(/the wrong way round/)
    expect(() => describeGuide({ a: 0.01, b: 0.02 })).toThrow(/every mode name below would be misleading/)
  })

  it('a square guide is allowed, since a equals b breaks no convention', () => {
    expect(() => describeGuide({ a: 0.02, b: 0.02 })).not.toThrow()
  })

  it('the filling slows the wave and lowers the impedance', () => {
    const air = describeGuide(WR90)
    const filled = describeGuide({ ...WR90, epsr: 4 })
    expect(relative(filled.v, air.v / 2)).toBeLessThan(1e-12)
    expect(relative(filled.eta, air.eta / 2)).toBeLessThan(1e-9)
  })
})

describe('the cutoff frequencies', () => {
  it('WR-90 cuts off at 6.5571 GHz in TE10 and 13.114 in TE20', () => {
    expect(cutoff(WR90, 1, 0) / 1e9).toBeCloseTo(6.5571, 4)
    expect(cutoff(WR90, 2, 0) / 1e9).toBeCloseTo(13.114, 3)
    expect(cutoff(WR90, 0, 1) / 1e9).toBeCloseTo(14.754, 3)
  })

  it('TE10 is c over twice the width, whatever the height', () => {
    const r = rng(0x6d)
    for (let k = 0; k < 30; k++) {
      const a = logUniform(r, 1e-3, 0.5)
      const b = a * logUniform(r, 0.05, 1)
      expect(relative(cutoff({ a, b }, 1, 0), C0 / (2 * a))).toBeLessThan(1e-13)
    }
  })

  it('a filling lowers every cutoff by the square root of epsr mur', () => {
    const r = rng(0x6e)
    for (let k = 0; k < 20; k++) {
      const epsr = logUniform(r, 1, 20)
      expect(relative(cutoff({ ...WR90, epsr }, 1, 0), cutoff(WR90, 1, 0) / Math.sqrt(epsr))).toBeLessThan(1e-13)
    }
  })

  it('the (0, 0) mode does not exist, and the message says why', () => {
    expect(() => cutoff(WR90, 0, 0)).toThrow(/does not exist/)
    expect(() => cutoff(WR90, 0, 0)).toThrow(/a TEM wave needs two conductors/)
  })

  it('a fractional or negative index is declined', () => {
    expect(() => cutoff(WR90, 1.5, 0)).toThrow(/whole numbers at or above zero/)
    expect(() => cutoff(WR90, -1, 0)).toThrow(/whole numbers at or above zero/)
  })
})

describe('the mode chart and the single-mode band', () => {
  it('lists modes in order of cutoff, with TE10 first', () => {
    const list = modes(WR90, 30e9)
    expect(list[0].name).toBe('TE10')
    for (let k = 1; k < list.length; k++) expect(list[k].fc).toBeGreaterThanOrEqual(list[k - 1].fc)
  })

  it('a TM mode needs both indices, so TM10 is not on the list', () => {
    const list = modes(WR90, 40e9)
    expect(list.some((m) => m.name === 'TM10')).toBe(false)
    expect(list.some((m) => m.name === 'TM11')).toBe(true)
    expect(list.some((m) => m.name === 'TE11')).toBe(true)
  })

  it('a guide twice as wide as it is tall has an octave of single mode', () => {
    const band = singleModeBand(WR90)
    expect(band.dominant).toBe('TE10')
    expect(band.next).toBe('TE20')
    expect(band.ratio).toBeCloseTo(2, 4)
    expect(band.from / 1e9).toBeCloseTo(6.5571, 4)
    expect(band.to / 1e9).toBeCloseTo(13.114, 3)
  })

  it('a squarer guide has a narrower band', () => {
    const squarish = singleModeBand({ a: 0.02286, b: 0.018 })
    expect(squarish.ratio).toBeLessThan(2)
    expect(squarish.next).toBe('TE01')
  })
})

describe('a mode above and below its cutoff', () => {
  it('the phase and group velocities multiply to c squared, at every frequency', () => {
    const r = rng(0x6f)
    for (let k = 0; k < 40; k++) {
      const f = cutoff(WR90, 1, 0) * logUniform(r, 1.01, 20)
      const m = modeAt(WR90, f)
      expect(m.propagating).toBe(true)
      expect(relative(m.check.vpvg, m.check.v2)).toBeLessThan(1e-12)
      expect(m.vp).toBeGreaterThan(C0)
      expect(m.vg).toBeLessThan(C0)
    }
  })

  it('the guide wavelength is always longer than the free-space one', () => {
    const r = rng(0x70)
    for (let k = 0; k < 30; k++) {
      const m = modeAt(WR90, cutoff(WR90, 1, 0) * logUniform(r, 1.01, 20))
      expect(m.lambdaGuide).toBeGreaterThan(m.lambdaFree)
      expect(relative(m.lambdaGuide, m.lambdaFree / m.factor)).toBeLessThan(1e-12)
    }
  })

  it('the TE impedance is above the intrinsic one and the TM impedance below it', () => {
    const eta = describeGuide(WR90).eta
    // TM11 cuts off at 16.2 GHz in WR-90, so 20 GHz is the lowest round number
    // at which both modes propagate and both impedances exist.
    const f = 20e9
    expect(cutoff(WR90, 1, 1) / 1e9).toBeCloseTo(16.145, 3)
    const te = modeAt(WR90, f, { family: 'TE' })
    const tm = modeAt(WR90, f, { m: 1, n: 1, family: 'TM' })
    expect(te.propagating).toBe(true)
    expect(tm.propagating).toBe(true)
    expect(te.eta).toBeGreaterThan(eta)
    expect(tm.eta).toBeLessThan(eta)
  })

  it('WR-90 at 10 GHz has a 39.707 mm guide wavelength', () => {
    const m = modeAt(WR90, 10e9)
    expect(m.lambdaGuide * 1000).toBeCloseTo(39.707, 3)
    expect(m.lambdaFree * 1000).toBeCloseTo(29.979, 3)
    expect(m.vp / C0).toBeCloseTo(1.3245, 4)
    expect(m.vg / C0).toBeCloseTo(0.75501, 5)
    expect(m.eta).toBeCloseTo(498.97, 2)
    expect(m.says).toMatch(/propagates/)
  })

  it('below cutoff nothing propagates, and the decay is reported instead', () => {
    const m = modeAt(WR90, 5e9)
    expect(m.propagating).toBe(false)
    expect(m.beta).toBeUndefined()
    expect(m.lambdaGuide).toBeUndefined()
    expect(m.dbPerMetre).toBeCloseTo(772.3, 1)
    expect(m.says).toMatch(/below its 6.557 GHz cutoff/)
    expect(m.says).toMatch(/carries no power along the guide/)
  })

  it('the decay grows as the frequency falls further below cutoff', () => {
    const near = modeAt(WR90, 6.5e9).dbPerMetre
    const far = modeAt(WR90, 2e9).dbPerMetre
    expect(far).toBeGreaterThan(near)
  })

  it('the field across the guide is a half sine, zero at both walls', () => {
    const g = describeGuide(WR90)
    expect(te10Field(WR90, 0).mag).toBeCloseTo(0, 12)
    expect(te10Field(WR90, g.a).mag).toBeCloseTo(0, 12)
    expect(te10Field(WR90, g.a / 2).mag).toBeCloseTo(1, 12)
    expect(te10Field(WR90, g.a / 4).mag).toBeCloseTo(Math.SQRT1_2, 12)
  })
})

describe('the cavity', () => {
  const cav = { ...WR90, d: 0.02 }

  it('TE101 resonates at 9.958328 GHz', () => {
    expect(cavityResonance(cav) / 1e9).toBeCloseTo(9.958328, 5)
  })

  it('the resonance is above the guide cutoff, because the ends add a term', () => {
    expect(cavityResonance(cav)).toBeGreaterThan(cutoff(WR90, 1, 0))
  })

  it('a longer cavity resonates lower', () => {
    expect(cavityResonance({ ...cav, d: 0.04 })).toBeLessThan(cavityResonance(cav))
  })

  it('a mode with fewer than two indices does not exist', () => {
    expect(() => cavityResonance(cav, { m: 1, n: 0, p: 0 })).toThrow(/at least two non-zero indices/)
  })

  it('the resonances are listed in order, with TE101 first', () => {
    const list = resonances(cav, 40e9)
    expect(list[0].name).toBe('TE101')
    for (let k = 1; k < list.length; k++) expect(list[k].f).toBeGreaterThanOrEqual(list[k - 1].f)
  })

  it('its Q with copper walls is 7824, and the bandwidth follows', () => {
    const q = cavityQ(cav, { sigma: SIGMA_CU })
    expect(q.Q).toBeCloseTo(7824, -1)
    expect(relative(q.bandwidth, q.f / q.Q)).toBeLessThan(1e-14)
    expect(q.delta * 1e9).toBeCloseTo(662.2, 0)
  })

  it('Q rises as the square root of the conductivity', () => {
    const cu = cavityQ(cav, { sigma: SIGMA_CU })
    const four = cavityQ(cav, { sigma: 4 * SIGMA_CU })
    expect(relative(four.Q / cu.Q, 2)).toBeLessThan(1e-12)
  })

  it('the guard holds for copper and trips for a poor conductor', () => {
    expect(cavityQ(cav, { sigma: SIGMA_CU }).guard.ok).toBe(true)
    const poor = cavityQ(cav, { sigma: 100 })
    expect(poor.guard.ok).toBe(false)
    expect(poor.guard.says).toMatch(/no longer the perfect-wall field/)
    expect(poor.guard.says).toMatch(/this Q is optimistic/)
  })

  it('only TE101 is offered, and the message names what was asked for', () => {
    expect(() => cavityQ(cav, { sigma: SIGMA_CU, mode: 'TE102' })).toThrow(/computes the TE101 mode/)
  })

  it('the stored energy and the wall loss are what Q is built from', () => {
    const q = cavityQ(cav, { sigma: SIGMA_CU })
    expect(relative(q.Q, (2 * Math.PI * q.f * q.storedEnergy) / q.wallLoss)).toBeLessThan(1e-12)
  })
})
