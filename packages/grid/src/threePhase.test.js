import { describe, it, expect } from 'vitest'
import { deltaLoad, deltaToWye, instantaneousPower, lineToNeutral, phaseVoltages, wyeLoad, wyeToDelta } from './threePhase.js'
import { toSequence } from './sequence.js'

// GRID_LAB_PLAN.md §4.3: a wye load of 100 + j50 Ω per phase at 230 kV.

const LOAD = wyeLoad({ R: 100, X: 50, Vll: 230e3 })

describe('line to line and line to neutral', () => {
  it('is a ratio of √3: 230 kV between lines is 132.791 kV to neutral', () => {
    const r = lineToNeutral(230e3)
    expect(r.Vln).toBeCloseTo(230e3 / Math.sqrt(3), 9)
    expect(r.Vln / 1e3).toBeCloseTo(132.791, 3)
    expect(r.ratio).toBeCloseTo(Math.sqrt(3), 12)
  })

  it('adds the three phasors to zero, so the neutral carries nothing', () => {
    const v = phaseVoltages(132790.6)
    expect(v.sumMag).toBeLessThan(1e-9)
    expect(toSequence(v.set).mag[0]).toBeLessThan(1e-9)
  })
})

describe('one phase carries the whole answer', () => {
  it('draws 1187.71 A and 423.2 MW at a power factor of 0.894427', () => {
    expect(LOAD.I).toBeCloseTo(LOAD.Vln / Math.hypot(100, 50), 9)
    expect(LOAD.I).toBeCloseTo(1187.71, 2)
    expect(LOAD.P / 1e6).toBeCloseTo(423.2, 1)
    expect(LOAD.Q / 1e6).toBeCloseTo(211.6, 1)
    expect(LOAD.pf).toBeCloseTo(100 / Math.hypot(100, 50), 12)
    expect(LOAD.pf).toBeCloseTo(0.894427, 6)
  })

  it('gives the same three-phase power both ways it is written', () => {
    // Both are megawatts, so the agreement is measured relative to the number
    // and not against a fixed epsilon.
    expect(Math.abs(LOAD.Pline - LOAD.P) / LOAD.P).toBeLessThan(1e-12)
    expect(Math.abs(LOAD.P - 3 * LOAD.Pphase) / LOAD.P).toBeLessThan(1e-15)
    expect(Math.abs(LOAD.S - Math.hypot(LOAD.P, LOAD.Q)) / LOAD.S).toBeLessThan(1e-12)
  })
})

describe('constant power', () => {
  const p = instantaneousPower(LOAD)

  it('is flat to about 10⁻¹⁵ of its mean for the three together', () => {
    expect(Math.abs(p.rippleThree)).toBeLessThan(1e-13)
    expect(p.threeMean).toBeCloseTo(LOAD.P, 3)
  })

  it('swings one phase from −16.6507 MW to 298.784 MW about a mean of 141.07 MW', () => {
    expect(p.min / 1e6).toBeCloseTo(-16.6507, 3)
    expect(p.max / 1e6).toBeCloseTo(298.784, 2)
    expect(p.mean / 1e6).toBeCloseTo(LOAD.P / 3e6, 6)
    // One phase's swing is exactly V I about its mean, so it goes negative
    // whenever the power factor is below one.
    expect(p.max - p.mean).toBeCloseTo(LOAD.Vln * LOAD.I, 3)
    expect(p.mean - p.min).toBeCloseTo(LOAD.Vln * LOAD.I, 3)
    expect(p.min).toBeLessThan(0)
  })

  it('stops going negative at unity power factor', () => {
    const resistive = instantaneousPower(wyeLoad({ R: 100, X: 0, Vll: 230e3 }))
    expect(resistive.min).toBeCloseTo(0, 6)
  })
})

describe('delta and wye', () => {
  it('makes a delta of 300 Ω a wye of 100 Ω', () => {
    expect(deltaToWye(300)).toBe(100)
    expect(wyeToDelta(100)).toBe(300)
  })

  it('draws the same line current from the same source', () => {
    const d = deltaLoad({ R: 300, X: 0, Vll: 230e3 })
    expect(d.sameLineCurrent).toBeLessThan(1e-9)
    expect(d.Iline).toBeCloseTo(Math.sqrt(3) * d.Iphase, 9)
    expect(d.P).toBeCloseTo(d.wye.P, 3)
  })

  it('carries the line current over √3 inside a leg of the delta', () => {
    const d = deltaLoad({ R: 300, X: 150, Vll: 230e3 })
    expect(d.Iphase).toBeCloseTo(d.Iline / Math.sqrt(3), 9)
    expect(d.ratio).toBeCloseTo(Math.sqrt(3), 12)
  })
})
