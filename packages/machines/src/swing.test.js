import { describe, it, expect } from 'vitest'
import { REACTANCES, SYNC_DEFAULTS, internalEmf, reactance, swing, syncOf } from './sync.js'

// The machine on a network, which is the Grid Lab's half of this package.
//
// GRID_LAB_PLAN.md §2.8 and §4.3 name the contract and the numbers it expects.
// Every figure below is that plan's, and it is checked here so the two labs
// cannot drift apart without a test going red.

describe('the four reactances', () => {
  it('each carry the question they answer', () => {
    for (const kind of Object.keys(REACTANCES)) {
      const r = reactance({}, kind)
      expect(r.value).toBeGreaterThan(0)
      expect(r.when.length).toBeGreaterThan(0)
    }
    expect(reactance({}, 'transient').value).toBe(SYNC_DEFAULTS.Xdp)
    expect(reactance({}, 'subtransient').value).toBeLessThan(reactance({}, 'transient').value)
  })

  it('refuse a name and a value the machine cannot have', () => {
    expect(() => reactance({}, 'nonesuch')).toThrow(/unknown reactance/)
    expect(() => syncOf({ Xdp: 0 })).toThrow(/reactance must be positive/)
    expect(() => syncOf({ H: 0 })).toThrow(/inertia constant/)
  })
})

describe('the internal voltage behind a reactance', () => {
  it('is the terminal voltage plus jX times the current the machine delivers', () => {
    const e = internalEmf({}, { V: 1, P: 1, Q: 0.3, kind: 'transient' })
    expect(e.E[0]).toBeCloseTo(1 + 0.3 * SYNC_DEFAULTS.Xdp, 12)
    expect(e.E[1]).toBeCloseTo(SYNC_DEFAULTS.Xdp, 12)
    expect(e.mag).toBeCloseTo(Math.hypot(e.E[0], e.E[1]), 12)
    expect(e.delta).toBeGreaterThan(0)
    expect(e.X).toBe(SYNC_DEFAULTS.Xdp)
  })

  it('leaves the angle at zero when the machine delivers no power', () => {
    expect(internalEmf({}, { V: 1, P: 0, Q: 0 }).delta).toBeCloseTo(0, 12)
  })

  it('refuses a terminal voltage of zero', () => {
    expect(() => internalEmf({}, { V: 0 })).toThrow(/terminal voltage/)
  })
})

describe('the swing model', () => {
  const grid = { f: 60, H: 4, Pm: 1 }

  it('takes its inertia on the electrical speed, not the mechanical one', () => {
    const sw = swing(grid, { Pmax: 2 })
    expect(sw.M).toBeCloseTo((2 * 4) / (2 * Math.PI * 60), 12)
    expect(sw.M).toBeCloseTo(0.0212207, 7)
    expect(Math.abs(sw.machine.omegaSync - sw.machine.omegaElec)).toBeGreaterThan(1)
  })

  it('puts the equilibrium where the mechanical power crosses the transfer', () => {
    const sw = swing(grid, { Pmax: 2 })
    expect((sw.delta0 * 180) / Math.PI).toBeCloseTo(30, 9)
    expect((sw.deltaMax * 180) / Math.PI).toBeCloseTo(150, 9)
    expect(sw.accel(sw.delta0, 0)[1]).toBeCloseTo(0, 12)
    expect(sw.stable).toBe(true)
  })

  it('says there is no equilibrium when the transfer is below the mechanical power', () => {
    const sw = swing(grid, { Pmax: 0.5 })
    expect(sw.stable).toBe(false)
    expect(Number.isNaN(sw.delta0)).toBe(true)
  })

  it('gives the synchronising coefficient and the swing frequency after a trip', () => {
    const sw = swing(grid, { Pmax: 1.5 })
    expect(sw.K).toBeCloseTo(1.118034, 6)
    expect(sw.fn).toBeCloseTo(1.15523, 5)
    expect(sw.period).toBeCloseTo(0.865629, 5)
    expect(sw.K).toBeCloseTo(sw.Pmax * Math.cos(sw.delta0), 12)
    expect(sw.wn).toBeCloseTo(Math.sqrt(sw.K / sw.M), 12)
  })

  it('linearises exactly, and hands the result over as a second-order plant', () => {
    const sw = swing(grid, { Pmax: 1.5, damping: 0.05 })
    expect(sw.plant.a[2]).toBeCloseTo(sw.K / sw.M, 12)
    expect(sw.plant.a[1]).toBeCloseTo(0.05 / sw.M, 12)
    expect(sw.plant.b[0]).toBeCloseTo(1 / sw.M, 12)
    expect(sw.zeta).toBeCloseTo(0.05 / (2 * Math.sqrt(sw.K * sw.M)), 12)
    const h = 1e-7
    const slope = (sw.accel(sw.delta0 + h, 0)[1] - sw.accel(sw.delta0 - h, 0)[1]) / (2 * h)
    expect(slope).toBeCloseTo(-sw.K / sw.M, 5)
  })

  it('integrates the energy relation the equal-area criterion uses', () => {
    const sw = swing(grid, { Pmax: 2 })
    const a = 0.3
    const b = 1.1
    const n = 200000
    let num = 0
    for (let k = 0; k < n; k++) {
      const d = a + ((b - a) * (k + 0.5)) / n
      num += (sw.Pm - sw.Pmax * Math.sin(d)) * ((b - a) / n)
    }
    expect(sw.area(a, b)).toBeCloseTo(num, 8)
  })

  it('balances the two areas at the critical clearing angle the Grid Lab quotes', () => {
    const pre = swing(grid, { Pmax: 2 })
    const during = swing(grid, { Pmax: 0.5 })
    const after = swing(grid, { Pmax: 1.5 })
    const d0 = pre.delta0
    const dMax = after.deltaMax
    const top = pre.Pm * (dMax - d0) + 1.5 * Math.cos(dMax) - 0.5 * Math.cos(d0)
    const dCr = Math.acos(top / (1.5 - 0.5))
    expect((dCr * 180) / Math.PI).toBeCloseTo(70.2924, 3)
    expect(Math.abs(during.area(d0, dCr) + after.area(dCr, dMax))).toBeLessThan(1e-12)
  })

  it('refuses a transfer and a damping it cannot use', () => {
    expect(() => swing({}, { Pmax: 0 })).toThrow(/transfer through the network/)
    expect(() => swing({}, { damping: -1 })).toThrow(/cannot be negative/)
  })
})
