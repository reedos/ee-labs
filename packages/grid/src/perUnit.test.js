import { describe, it, expect } from 'vitest'
import { bases, zoneBases, changeBase, toPu, fromPu, loadFromPf, zipModels } from './perUnit.js'

// Per unit is a change of variables, so every test here is an identity rather
// than a tolerance. GRID_LAB_PLAN.md §2.2 and §4.3 name the numbers.

describe('the bases that follow from a base power and a base voltage', () => {
  const b = bases({ Sbase: 100e6, Vbase: 230e3 })

  it('gives 529 Ω, 251.022 A and 132.791 kV at 100 MVA and 230 kV', () => {
    expect(b.Zbase).toBeCloseTo(529, 9)
    expect(b.Ibase).toBeCloseTo(251.022, 3)
    expect(b.VbaseLN).toBeCloseTo(132790.6, 1)
    // Each base is the definition, not a rounded constant.
    expect(b.Zbase).toBeCloseTo((230e3 * 230e3) / 100e6, 12)
    expect(b.Ibase).toBeCloseTo(100e6 / (Math.sqrt(3) * 230e3), 12)
    expect(b.VbaseLN).toBeCloseTo(230e3 / Math.sqrt(3), 12)
    expect(b.Ybase).toBeCloseTo(1 / b.Zbase, 12)
  })

  it('gives 1.9044 Ω and 4183.7 A on the 13.8 kV side of a transformer', () => {
    const low = zoneBases(b, 13.8e3)
    expect(low.Zbase).toBeCloseTo(1.9044, 4)
    expect(low.Ibase).toBeCloseTo(4183.7, 1)
    // The base power does not change across a transformer.
    expect(low.Sbase).toBe(b.Sbase)
    // And the two impedance bases are in the square of the turns ratio, which
    // is why a transformer's ratio leaves the per-unit circuit.
    expect(low.Zbase / b.Zbase).toBeCloseTo((13.8e3 / 230e3) ** 2, 12)
  })

  it('refuses a base that is not a positive number', () => {
    expect(() => bases({ Sbase: 0 })).toThrow(/base power/)
    expect(() => bases({ Vbase: -1 })).toThrow(/base voltage/)
  })
})

describe('changing base', () => {
  it('moves 0.20 pu on 90 MVA to 0.222222 pu on 100 MVA', () => {
    const z = changeBase(0.2, { Sold: 90e6, Vold: 230e3, Snew: 100e6, Vnew: 230e3 })
    expect(z).toBeCloseTo(0.2 * (100 / 90), 12)
    expect(z).toBeCloseTo(0.222222, 6)
  })

  it('moves 0.10 pu on 150 MVA to 0.0666667 pu', () => {
    expect(changeBase(0.1, { Sold: 150e6, Vold: 230e3, Snew: 100e6, Vnew: 230e3 })).toBeCloseTo(0.1 * (100 / 150), 12)
  })

  it('is its own inverse, and refuses a base of zero', () => {
    const there = changeBase(0.2, { Sold: 90e6, Vold: 13.8e3, Snew: 100e6, Vnew: 14.4e3 })
    const back = changeBase(there, { Sold: 100e6, Vold: 14.4e3, Snew: 90e6, Vnew: 13.8e3 })
    expect(back).toBeCloseTo(0.2, 12)
    expect(() => changeBase(0.2, { Sold: 0, Vold: 1, Snew: 1, Vnew: 1 })).toThrow(/base powers/)
    expect(() => changeBase(0.2, { Sold: 1, Vold: 0, Snew: 1, Vnew: 1 })).toThrow(/base voltages/)
  })
})

describe('the conversions in both directions', () => {
  const b = bases()

  it('round-trips every kind to floating point', () => {
    for (const kind of Object.keys(toPu)) {
      const si = 12345.678
      expect(fromPu[kind](toPu[kind](si, b), b)).toBeCloseTo(si, 6)
    }
  })

  it('takes a 5 Ω resistance to 0.0094518 pu and back', () => {
    expect(toPu.Z(5, b)).toBeCloseTo(5 / 529, 12)
    expect(toPu.Z(5, b)).toBeCloseTo(0.0094518, 7)
  })
})

describe('a load in per unit', () => {
  it('gives 37.1847 Mvar for 60 MW at 0.85 lagging', () => {
    const l = loadFromPf(60e6, 0.85)
    expect(l.Q).toBeCloseTo(60e6 * Math.tan(Math.acos(0.85)), 6)
    expect(l.Q / 1e6).toBeCloseTo(37.1847, 4)
    expect(l.S).toBeCloseTo(60e6 / 0.85, 6)
    expect(loadFromPf(60e6, 0.85, { lagging: false }).Q).toBeCloseTo(-l.Q, 6)
    expect(() => loadFromPf(60e6, 1.2)).toThrow(/power factor/)
  })

  it('is 1.4167 pu as a constant impedance, and takes 81 % of its power at 0.90 pu', () => {
    const l = loadFromPf(60e6, 0.85)
    const z = zipModels({ P: 0.6, Q: l.Q / 100e6 })
    expect(z.Zmag).toBeCloseTo(1 / Math.hypot(0.6, l.Q / 100e6), 12)
    expect(z.Zmag).toBeCloseTo(1.41667, 5)
    const at90 = z.power(0.9)
    expect(at90.constantPower.P).toBeCloseTo(0.6, 12)
    expect(at90.constantImpedance.P).toBeCloseTo(0.6 * 0.81, 12)
    expect(at90.constantCurrent.P).toBeCloseTo(0.6 * 0.9, 12)
    expect(() => zipModels({ P: 0, Q: 0 })).toThrow(/no equivalent impedance/)
  })
})
