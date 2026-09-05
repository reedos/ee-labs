import { describe, it, expect } from 'vitest'
import { costCurves, costOf, dispatch, incrementalOf, marginalCost, outputAt } from './dispatch.js'
import { DISPATCH_UNITS } from './library.js'

// GRID_LAB_PLAN.md §4.3: three units, 800 MW of demand, λ = 8.50 $/MWh.

describe('equal incremental cost', () => {
  const d = dispatch(DISPATCH_UNITS, 800)

  it('sets λ at 8.50 $/MWh and splits the demand 400, 250 and 150 MW', () => {
    expect(d.lambda).toBeCloseTo(8.5, 8)
    expect(d.units.map((u) => +u.P.toFixed(6))).toEqual([400, 250, 150])
    expect(d.served).toBeCloseTo(800, 6)
    // Every free unit sits at the same incremental cost, which is what the
    // Lagrangian's first-order condition says.
    for (const u of d.units) expect(u.incremental, u.id).toBeCloseTo(d.lambda, 8)
  })

  it('costs $6682.50 an hour against $6877.78 for three equal shares', () => {
    expect(d.cost).toBeCloseTo(6682.5, 4)
    expect(d.equalShare).toBeCloseTo(800 / 3, 9)
    expect(d.equalCost).toBeCloseTo(6877.78, 2)
    expect(d.saving).toBeCloseTo(195.28, 2)
    expect(d.saving).toBeCloseTo(d.equalCost - d.cost, 12)
  })

  it('is the cheapest split, which a random redistribution cannot beat', () => {
    let worst = 0
    for (let k = 0; k < 200; k++) {
      const shift = (k % 20) - 10
      const trial = [d.units[0].P + shift, d.units[1].P - shift, d.units[2].P]
      const cost = DISPATCH_UNITS.reduce((s, u, i) => s + costOf(u, trial[i]), 0)
      worst = Math.max(worst, d.cost - cost)
      expect(cost, `shift ${shift}`).toBeGreaterThanOrEqual(d.cost - 1e-9)
    }
    expect(worst).toBeLessThan(1e-9)
  })
})

describe('the next megawatt', () => {
  it('costs $8.50189, and λ predicted $8.50', () => {
    const m = marginalCost(DISPATCH_UNITS, 800)
    expect(m).toBeCloseTo(8.50189, 5)
    expect(Math.abs(m - dispatch(DISPATCH_UNITS, 800).lambda)).toBeLessThan(0.002)
  })

  it('follows the units still free once one is pinned at its maximum', () => {
    const capped = DISPATCH_UNITS.map((u) => (u.id === 'unit1' ? { ...u, max: 300 } : u))
    const d = dispatch(capped, 800)
    expect(d.units[0].P).toBeCloseTo(300, 9)
    expect(d.units[0].limited).toBe(true)
    expect(d.units[0].at).toBe('max')
    expect(d.free).toEqual(['unit2', 'unit3'])
    expect(d.lambda).toBeGreaterThan(8.5)
    // The two free units still share one incremental cost, and the pinned one
    // sits below it.
    expect(d.units[1].incremental).toBeCloseTo(d.lambda, 8)
    expect(d.units[2].incremental).toBeCloseTo(d.lambda, 8)
    expect(incrementalOf(capped[0], 300)).toBeLessThan(d.lambda)
    // And the marginal cost follows λ up with it.
    expect(marginalCost(capped, 800)).toBeGreaterThan(marginalCost(DISPATCH_UNITS, 800))
  })
})

describe('what dispatch refuses', () => {
  it('names the demand it cannot meet, at either end', () => {
    expect(() => dispatch(DISPATCH_UNITS, 2000)).toThrow(/no split that meets it/)
    expect(() => dispatch(DISPATCH_UNITS, 10)).toThrow(/cannot run below/)
    expect(() => dispatch([], 100)).toThrow(/at least one unit/)
    expect(() => dispatch([{ id: 'x', a: 0, b: 1, c: 0, min: 0, max: 10 }], 5)).toThrow(/second coefficient/)
    expect(() => dispatch([{ id: 'x', a: 0, b: 1, c: 1, min: 10, max: 5 }], 5)).toThrow(/maximum output/)
  })

  it('clamps a unit at its own limits, whatever λ is', () => {
    const u = DISPATCH_UNITS[0]
    expect(outputAt(u, 0)).toBe(u.min)
    expect(outputAt(u, 1000)).toBe(u.max)
  })
})

describe('the curves the plot draws', () => {
  it('are straight lines in the incremental cost, one per unit', () => {
    const curves = costCurves(DISPATCH_UNITS)
    expect(curves.length).toBe(3)
    for (const c of curves) {
      const slope = (c.incremental[c.incremental.length - 1] - c.incremental[0]) / (c.P[c.P.length - 1] - c.P[0])
      const unit = DISPATCH_UNITS.find((u) => u.id === c.id)
      expect(slope, c.id).toBeCloseTo(2 * unit.c, 9)
    }
  })
})
