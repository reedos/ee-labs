import { describe, it, expect } from 'vitest'
import { LONG_LINE_KM, lineConstants, surgeLoading, nominalPi, exactPi, lineModel, openEndRise, reactiveBalance } from './line.js'
import { bases } from './perUnit.js'
import { cabs, csub } from './cx.js'

// The reference line of GRID_LAB_PLAN.md §4.3: 230 kV, 0.05 + j0.40 Ω/km,
// 3.0 µS/km at 60 Hz. Every number below is that line's, computed from those
// three constants rather than typed in.

const SPEC = { r: 0.05, x: 0.4, b: 3.0e-6, f: 60 }
const B = bases({ Sbase: 100e6, Vbase: 230e3 })

describe('the line constants', () => {
  it('gives a surge impedance of 365.148 Ω from √(L/C)', () => {
    const c = lineConstants(SPEC)
    expect(c.Zc).toBeCloseTo(Math.sqrt(SPEC.x / SPEC.b), 9)
    expect(c.Zc).toBeCloseTo(365.148, 3)
    // The phase constant is ω√(LC), which for this line is √(x·b) per km.
    expect(c.beta).toBeCloseTo(Math.sqrt(SPEC.x * SPEC.b), 12)
  })

  it('gives a surge impedance loading of 144.873 MW at 230 kV', () => {
    const s = surgeLoading(SPEC, 230e3)
    expect(s.sil).toBeCloseTo((230e3 * 230e3) / s.Zc, 6)
    expect(s.sil / 1e6).toBeCloseTo(144.873, 3)
  })

  it('refuses a line with no reactance or no charging', () => {
    expect(() => lineConstants({ x: 0 })).toThrow(/series reactance/)
    expect(() => lineConstants({ b: 0 })).toThrow(/shunt susceptance/)
    expect(() => nominalPi(SPEC, 0)).toThrow(/positive length/)
  })
})

describe('the π model of 100 km', () => {
  const pi = nominalPi(SPEC, 100)

  it('is 5 + j40 Ω, or 0.0094518 + j0.0756144 pu', () => {
    expect(pi.Z[0]).toBeCloseTo(5, 12)
    expect(pi.Z[1]).toBeCloseTo(40, 12)
    expect(pi.Z[0] / B.Zbase).toBeCloseTo(0.0094518, 7)
    expect(pi.Z[1] / B.Zbase).toBeCloseTo(0.0756144, 7)
  })

  it('carries 0.1587 pu of charging, half at each end', () => {
    expect(pi.Y[1] * B.Zbase).toBeCloseTo(0.1587, 4)
    expect(pi.Y[1]).toBeCloseTo(SPEC.b * 100, 12)
  })
})

describe('where the π model stops', () => {
  it('agrees with the exact form to better than a tenth of a percent below 250 km', () => {
    for (const km of [50, 100, 200, 250]) {
      const rise = openEndRise({ ...SPEC, r: 0 }, km)
      expect(Math.abs(rise.error), `${km} km`).toBeLessThan(1e-3)
    }
  })

  it('errs by 0.0098 % at 200 km and 3.889 % at 800 km', () => {
    const at200 = openEndRise({ ...SPEC, r: 0 }, 200)
    expect(at200.exact).toBeCloseTo(1 / Math.cos(at200.betaL), 9)
    expect(at200.exact).toBeCloseTo(1.02449, 5)
    expect(at200.nominal).toBeCloseTo(1.02459, 5)
    expect(100 * at200.error).toBeCloseTo(0.0098, 3)
    const at800 = openEndRise({ ...SPEC, r: 0 }, 800)
    expect(at800.exact).toBeCloseTo(1.56261, 5)
    expect(at800.nominal).toBeCloseTo(1.62338, 5)
    expect(100 * at800.error).toBeCloseTo(3.889, 3)
  })

  it('switches model at the guard, and says which is in force at both sides', () => {
    const inside = lineModel(SPEC, LONG_LINE_KM - 1)
    const outside = lineModel(SPEC, LONG_LINE_KM + 1)
    expect(inside.long).toBe(false)
    expect(inside.model).toBe('nominal')
    expect(inside.guard).toMatch(/lumped model/)
    expect(outside.long).toBe(true)
    expect(outside.model).toBe('exact')
    expect(outside.guard).toMatch(/exact hyperbolic form/)
  })

  it('the exact π tends to the nominal π with the square of the length', () => {
    const gap = (km) => cabs(csub(exactPi(SPEC, km).Z, nominalPi(SPEC, km).Z)) / cabs(nominalPi(SPEC, km).Z)
    // The correction factor is sinh(γl)/(γl), whose leading term is (γl)²/6,
    // so halving the line quarters the gap.
    for (const km of [400, 200, 100]) expect(gap(km) / gap(km / 2), `${km} km`).toBeCloseTo(4, 1)
    expect(gap(25)).toBeLessThan(1e-3)
  })
})

describe('the reactive balance', () => {
  it('cancels at the surge impedance loading, and only there', () => {
    const sil = surgeLoading(SPEC, 230e3).sil
    const at = (frac) => reactiveBalance(SPEC, 200, 230e3, frac * sil)
    expect(Math.abs(at(1).net)).toBeLessThan(1e-6 * at(1).produced)
    expect(at(0.5).net).toBeLessThan(0)
    expect(at(2).net).toBeGreaterThan(0)
    // Below it the line produces reactive power, above it the line absorbs it.
    expect(at(0.5).produced).toBeGreaterThan(at(0.5).absorbed)
    expect(at(2).absorbed).toBeGreaterThan(at(2).produced)
  })
})
