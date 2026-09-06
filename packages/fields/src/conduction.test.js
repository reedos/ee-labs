import { describe, it, expect } from 'vitest'
import {
  barResistance,
  currentDensity,
  fourPointProbe,
  pointContactPotential,
  powerDensity,
  sheetResistanceOf,
  spreadingResistance,
  squaresOf,
} from './conduction.js'
import { SIGMA_CU } from './const.js'
import { logUniform, relative, rng, uniform } from './fuzz.js'

// Current in a conductor. The four-point probe is the reason this file exists
// separately from closed.js: its two closed forms describe two different
// objects that look the same on a bench, and the number they give differ by a
// large factor. Choosing between them is the lesson, so the tests below are as
// much about the choice as about the arithmetic.

describe('Ohm at a point, and Ohm at a bar', () => {
  it('the point form and the circuit form give the same current', () => {
    const r = rng(0x0d)
    for (let k = 0; k < 60; k++) {
      const rho = logUniform(r, 1e-8, 1e2)
      const length = logUniform(r, 1e-3, 10)
      const area = logUniform(r, 1e-8, 1e-2)
      const voltage = uniform(r, -100, 100)
      const c = currentDensity({ rho, length, area, voltage })
      expect(relative(c.check.jFromE, c.check.jFromI)).toBeLessThan(1e-12)
      expect(relative(c.I, voltage / barResistance({ rho, length, area }))).toBeLessThan(1e-14)
    }
  })

  it('the power a bar dissipates is its volume times sigma E squared', () => {
    const rho = 1 / SIGMA_CU
    const length = 1
    const area = 1e-6
    const voltage = 0.05
    const c = currentDensity({ rho, length, area, voltage })
    const total = powerDensity(1 / rho, c.E) * length * area
    expect(relative(total, voltage * c.I)).toBeLessThan(1e-12)
  })

  it('a copper bar one metre long and a square millimetre across is 17.24 milliohms', () => {
    expect(barResistance({ rho: 1 / SIGMA_CU, length: 1, area: 1e-6 }) * 1000).toBeCloseTo(17.24, 2)
  })

  it('a resistance needs positive dimensions, and says which one failed', () => {
    expect(() => barResistance({ rho: 0, length: 1, area: 1 })).toThrow(/rho must be a positive number/)
    expect(() => barResistance({ rho: 1, length: -1, area: 1 })).toThrow(/length must be a positive number/)
  })
})

describe('the point contact, and how the current spreads from it', () => {
  it('the potential falls as one over r', () => {
    const r = rng(0x0e)
    for (let k = 0; k < 40; k++) {
      const rho = logUniform(r, 1e-6, 1)
      const I = uniform(r, -1e-2, 1e-2)
      const d = logUniform(r, 1e-5, 1e-1)
      expect(relative(pointContactPotential(rho, I, d), 2 * pointContactPotential(rho, I, 2 * d))).toBeLessThan(1e-13)
    }
  })

  it('a contact of finite size has a finite spreading resistance', () => {
    const rho = 1e-4
    expect(spreadingResistance(rho, 1e-6)).toBeCloseTo(rho / 4e-6, 12)
    expect(Number.isFinite(spreadingResistance(rho, 1e-9))).toBe(true)
    expect(() => spreadingResistance(rho, 0)).toThrow(/a must be a positive number/)
  })
})

describe('the four-point probe, and the two objects it can be reading', () => {
  const reading = { spacing: 1e-3, voltage: 5e-3, current: 1e-3 }

  it('a thick sample is a block, and the resistivity carries the spacing', () => {
    const p = fourPointProbe({ ...reading, thickness: 5e-3 })
    expect(p.regime).toBe('block')
    expect(relative(p.resistivity, 2 * Math.PI * reading.spacing * (reading.voltage / reading.current))).toBeLessThan(1e-14)
    expect(p.resistivity * 100).toBeCloseTo(3.142, 3)
    expect(p.says).toMatch(/spreads into a hemisphere/)
  })

  it('a thin film is a sheet, and its coefficient does not depend on the spacing', () => {
    const p = fourPointProbe({ ...reading, thickness: 1e-6 })
    expect(p.regime).toBe('sheet')
    expect(p.sheetCoefficient).toBeCloseTo(Math.PI / Math.LN2, 12)
    expect(p.sheetCoefficient).toBeCloseTo(4.53236, 5)
    expect(p.sheetResistance).toBeCloseTo(22.66, 2)
    // Change the spacing and the sheet resistance does not move.
    const wider = fourPointProbe({ ...reading, spacing: 1e-2, thickness: 1e-6 })
    expect(relative(wider.sheetResistance, p.sheetResistance)).toBeLessThan(1e-14)
    // The block answer does move, in proportion to the spacing.
    expect(relative(wider.bulkResistivity, 10 * p.bulkResistivity)).toBeLessThan(1e-14)
  })

  it('a sample between the two regimes is quoted as neither', () => {
    const p = fourPointProbe({ ...reading, thickness: 1e-3 })
    expect(p.regime).toBe('between')
    expect(p.resistivity).toBe(null)
    expect(p.guard.ok).toBe(false)
    expect(p.says).toMatch(/Neither closed form holds here/)
  })

  it('without a thickness neither form is chosen', () => {
    const p = fourPointProbe(reading)
    expect(p.regime).toBe('unknown')
    expect(p.says).toMatch(/neither form can be chosen/)
    expect(p.bulkResistivity).toBeGreaterThan(0)
    expect(p.sheetResistance).toBeGreaterThan(0)
  })

  it('the two answers differ by far more than a measurement error', () => {
    const block = fourPointProbe({ ...reading, thickness: 5e-3 })
    const film = fourPointProbe({ ...reading, thickness: 1e-6 })
    expect(block.bulkResistivity / film.resistivity).toBeGreaterThan(100)
  })

  it('the boundaries of the two regimes are where the guard says they are', () => {
    expect(fourPointProbe({ ...reading, thickness: 4e-3 }).regime).toBe('block')
    expect(fourPointProbe({ ...reading, thickness: 3.9e-3 }).regime).toBe('between')
    expect(fourPointProbe({ ...reading, thickness: 0.5e-3 }).regime).toBe('sheet')
    expect(fourPointProbe({ ...reading, thickness: 0.51e-3 }).regime).toBe('between')
  })

  it('a reading with no current is declined', () => {
    expect(() => fourPointProbe({ ...reading, current: 0 })).toThrow(/current must be a positive number/)
  })
})

describe('sheet resistance, and the squares it is counted in', () => {
  it('a sheet resistance is a resistivity over a thickness', () => {
    expect(sheetResistanceOf(1e-6, 1e-7)).toBeCloseTo(10, 12)
  })

  it('the resistance of a strip is its squares times its sheet resistance', () => {
    const rs = 22.66
    const length = 3e-3
    const width = 0.5e-3
    expect(squaresOf(length, width)).toBeCloseTo(6, 12)
    expect(squaresOf(length, width) * rs).toBeCloseTo(135.96, 2)
  })

  it('scaling a strip in both directions changes nothing', () => {
    const r = rng(0x59)
    for (let k = 0; k < 30; k++) {
      const l = logUniform(r, 1e-6, 1)
      const w = logUniform(r, 1e-6, 1)
      const s = logUniform(r, 0.01, 100)
      expect(relative(squaresOf(l, w), squaresOf(l * s, w * s))).toBeLessThan(1e-13)
    }
  })
})
