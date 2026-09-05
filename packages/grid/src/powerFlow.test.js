import { describe, it, expect } from 'vitest'
import { PowerFlowError, busCompanion, injectionsAt, jacobianCheck, powerFlow, pvCurve } from './powerFlow.js'
import { gbOf, networkOf, ybus } from './network.js'
import { fourBus, radial, threeBus, twoBus } from './library.js'

// The three-bus system of GRID_LAB_PLAN.md §4.3, solved. Every number here is
// the plan's, and every one of them is read off the same solve the app draws.

const sol = powerFlow(threeBus())

describe('the three-bus system', () => {
  it('puts bus 2 at 1.000∠−1.49154° and bus 3 at 0.961727∠−4.75867°', () => {
    expect(sol.byId.bus2.V).toBeCloseTo(1, 12)
    expect(sol.byId.bus2.thetaDeg).toBeCloseTo(-1.49154, 5)
    expect(sol.byId.bus3.V).toBeCloseTo(0.961727, 6)
    expect(sol.byId.bus3.thetaDeg).toBeCloseTo(-4.75867, 5)
  })

  it('has the slack supply 1.01817 + j0.0235318 pu, and bus 2 supply 0.407676 pu of reactive power', () => {
    expect(sol.slack.P).toBeCloseTo(1.01817, 5)
    expect(sol.slack.Q).toBeCloseTo(0.0235318, 7)
    expect(sol.byId.bus2.Q).toBeCloseTo(0.407676, 6)
    // The PV bus makes exactly the real power it was scheduled for.
    expect(sol.byId.bus2.P).toBeCloseTo(0.6, 10)
  })

  it('loses 0.0181741 pu, which is 1.81741 MW at a 100 MVA base', () => {
    expect(sol.Ploss).toBeCloseTo(0.0181741, 7)
    expect(sol.Ploss * 100).toBeCloseTo(1.81741, 5)
  })

  it('carries the flows the plan names, leaving each branch first bus', () => {
    const want = [
      [0.32088, -0.11588],
      [0.69729, 0.13941],
      [0.91984, 0.44346],
    ]
    sol.flows.forEach((f, k) => {
      expect(f.Pf, f.id).toBeCloseTo(want[k][0], 5)
      expect(f.Qf, f.id).toBeCloseTo(want[k][1], 5)
    })
  })
})

describe('Newton, iteration by iteration', () => {
  it('falls 1.600, 6.892e-2, 3.480e-4, 8.367e-9 and then below 10⁻¹², in four updates', () => {
    const m = sol.mismatches
    expect(m[0]).toBeCloseTo(1.6, 9)
    expect(m[1]).toBeCloseTo(0.06892, 5)
    expect(m[2]).toBeCloseTo(3.48e-4, 6)
    expect(m[3]).toBeCloseTo(8.367e-9, 11)
    expect(m[4]).toBeLessThan(1e-12)
    expect(sol.iterations).toBe(4)
  })

  it('squares the error each pass, which is what quadratic convergence means', () => {
    const m = sol.mismatches
    for (let k = 1; k < 4; k++) {
      // Each mismatch is below the square of the one before, scaled by the
      // Jacobian's conditioning. Two orders of margin is a loose test of a
      // strong claim, and it fails at once on linear convergence.
      expect(m[k + 1], `pass ${k}`).toBeLessThan(100 * m[k] * m[k])
    }
  })

  it('starts from a flat 1.00∠0 and prints the plan first Jacobian', () => {
    const first = sol.iters[0]
    expect(first.V).toEqual([1, 1, 1])
    expect(first.theta).toEqual([0, 0, 0])
    const want = [
      [27.6923, -15.3846, -1.92308],
      [-15.3846, 23.5897, 2.94872],
      [1.92308, -2.94872, 23.2217],
    ]
    want.forEach((row, i) => row.forEach((v, j) => expect(first.J[i][j], `${i},${j}`).toBeCloseTo(v, 4)))
    expect(first.rows.map((r) => `${r.bus}.${r.row}`)).toEqual(['bus2.P', 'bus3.P', 'bus3.Q'])
  })

  it('has every Jacobian entry equal to a central finite difference of its injection', () => {
    for (const net of [threeBus(), fourBus(), radial(), twoBus()]) expect(jacobianCheck(net), net.name).toBeLessThan(1e-6)
  })
})

describe('the three bus types', () => {
  it('give the equation and unknown counts the plan states', () => {
    const net = threeBus()
    const Y = ybus(net)
    const { G, B } = gbOf(Y)
    const V = [1, 1, 1]
    const theta = [0, 0, 0]
    const { P, Q } = injectionsAt(G, B, V, theta)
    const region = { bus1: 'slack', bus2: 'pv', bus3: 'pq' }
    const state = { G, B, V, theta, P, Q, region, Qpin: {} }
    expect(busCompanion(net, 0, state).rows).toEqual([])
    expect(busCompanion(net, 1, state).rows).toEqual(['P'])
    expect(busCompanion(net, 2, state).rows).toEqual(['P', 'Q'])
    // Unknowns: two angles and one magnitude, which is three, and the
    // equations are three as well.
    const unknowns = 2 + 1
    const equations = [0, 1, 2].reduce((s, k) => s + busCompanion(net, k, state).rows.length, 0)
    expect(equations).toBe(unknowns)
  })

  it('converts a PV bus to PQ when it runs out of reactive power', () => {
    const limited = powerFlow(threeBus({ Qmax: 0.3 }))
    expect(limited.byId.bus2.region).toBe('pqLimited')
    expect(limited.byId.bus2.Q).toBeCloseTo(0.3, 9)
    expect(limited.byId.bus2.V).toBeLessThan(1)
    expect(limited.conversions.length).toBeGreaterThan(0)
    expect(limited.conversions[0].bus).toBe('bus2')
    expect(limited.conversions[0].pinnedAt).toBeCloseTo(0.3, 12)
    // And a limit above what the bus needs leaves it a PV bus at its setpoint.
    const free = powerFlow(threeBus({ Qmax: 0.5 }))
    expect(free.byId.bus2.region).toBe('pv')
    expect(free.byId.bus2.V).toBeCloseTo(1, 12)
  })

  it('finds the limit at which bus 2 gives up its voltage', () => {
    const need = sol.byId.bus2.Q
    expect(powerFlow(threeBus({ Qmax: need * 1.01 })).byId.bus2.region).toBe('pv')
    expect(powerFlow(threeBus({ Qmax: need * 0.99 })).byId.bus2.region).toBe('pqLimited')
  })
})

describe('the final solve reproduces the schedule', () => {
  it('gives every PQ bus the injection it was scheduled, to the tolerance', () => {
    for (const net of [threeBus(), fourBus(), radial()]) {
      const s = powerFlow(net)
      for (const b of s.buses) {
        if (b.type !== 'pq') continue
        expect(b.P, `${net.name} ${b.id}`).toBeCloseTo(b.scheduled.P, 10)
        expect(b.Q, `${net.name} ${b.id}`).toBeCloseTo(b.scheduled.Q, 10)
      }
    }
  })
})

describe('a loading with no answer', () => {
  it('gives the reason rather than a number', () => {
    let thrown = null
    try {
      powerFlow(threeBus({ load: 6 }))
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(PowerFlowError)
    expect(thrown.message).toMatch(/nose of the P–V curve/)
    expect(thrown.kind).toBe('no-solution')
    expect(Number.isFinite(thrown.lastMismatch)).toBe(true)
  })

  it('walks the P–V curve to the last loading that has one', () => {
    const curve = pvCurve(threeBus(), 'bus3', { from: 1, to: 8, steps: 70 })
    expect(curve.points.length).toBeGreaterThan(5)
    expect(curve.lastSolved).toBeGreaterThan(1)
    expect(curve.lastSolved).toBeLessThan(8)
    expect(curve.reason).toMatch(/no solution/)
    // The nose is the knee: the voltage falls slowly, then quickly.
    const first = curve.points[0]
    const last = curve.points[curve.points.length - 1]
    expect(last.V).toBeLessThan(first.V)
  })
})
