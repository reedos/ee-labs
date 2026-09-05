import { describe, it, expect } from 'vitest'
import { DC_REFUSE_DEG, DC_RX_LIMIT, DC_V_BAND, DC_WARN_DEG, assumptionCost, dcCompare, dcFlow, dcGuard } from './dcFlow.js'
import { powerFlow } from './powerFlow.js'
import { networkOf } from './network.js'
import { threeBus } from './library.js'

const deg = (r) => (r * 180) / Math.PI
const net = threeBus()

describe('the linear solve', () => {
  const dc = dcFlow(net)

  it('gives −1.4168° and −4.7503° against the true −1.49154° and −4.75867°', () => {
    expect(deg(dc.theta[0])).toBe(0)
    expect(deg(dc.theta[1])).toBeCloseTo(-1.4168, 4)
    expect(deg(dc.theta[2])).toBeCloseTo(-4.7503, 4)
    const cmp = dcCompare(net)
    expect(deg(cmp.maxAngleError)).toBeCloseTo(0.0748, 4)
  })

  it('is B′θ = P, and B′ is built from the reciprocals of the reactances', () => {
    const b12 = 1 / net.branches[0].x
    const b13 = 1 / net.branches[1].x
    const b23 = 1 / net.branches[2].x
    expect(dc.B[0][0]).toBeCloseTo(b12 + b23, 12)
    expect(dc.B[1][1]).toBeCloseTo(b13 + b23, 12)
    expect(dc.B[0][1]).toBeCloseTo(-b23, 12)
    // The matrix times the angles gives the schedule back, exactly.
    const P = [net.buses[1].P, net.buses[2].P]
    const x = [dc.theta[1], dc.theta[2]]
    for (let i = 0; i < 2; i++) expect(dc.B[i][0] * x[0] + dc.B[i][1] * x[1]).toBeCloseTo(P[i], 12)
  })

  it('loses nothing, so the slack supplies exactly what the schedule leaves', () => {
    expect(dc.slackP).toBeCloseTo(1.6 - 0.6, 12)
    const total = dc.slackP + net.buses.slice(1).reduce((s, b) => s + b.P, 0)
    expect(Math.abs(total)).toBeLessThan(1e-15)
  })
})

describe('which assumption costs the most', () => {
  const sol = powerFlow(net)

  it('errs 3.675 % on a branch flow while sin θ and θ differ by 0.115 %', () => {
    const cmp = dcCompare(net, { ac: sol })
    expect(100 * Math.abs(cmp.branches[0].error)).toBeCloseTo(3.675, 3)
    const cost = assumptionCost(net, sol)
    expect(deg(cost.maxAngle)).toBeCloseTo(4.759, 3)
    expect(cost.sinTheta).toBeCloseTo(Math.sin(cost.maxAngle), 12)
    expect(100 * cost.smallAngleError).toBeCloseTo(0.1151, 3)
    // The small-angle step costs a thirty-second of what the whole DC model
    // costs, so it is not where the error comes from.
    expect(cost.smallAngleError).toBeLessThan(cmp.maxError / 20)
    expect(cmp.maxError / cost.smallAngleError).toBeCloseTo(31.94, 1)
  })

  it('halves the flow error once the resistance is taken out', () => {
    const cost = assumptionCost(net, sol)
    expect(cost.withoutResistance).toBeLessThan(cost.withResistance)
    // What is left with no resistance is the voltage-magnitude assumption.
    expect(cost.losslessMinV).toBeLessThan(1)
  })
})

describe('the guard, at both sides of each threshold', () => {
  it('is quiet at the base case and warns at 1.5× loading', () => {
    expect(dcGuard(powerFlow(threeBus())).warn).toBe(false)
    expect(dcGuard(powerFlow(threeBus({ load: 1.5 }))).warn).toBe(true)
  })

  it('reproduces the five-loading table', () => {
    const want = [
      [0.5, 2.35, 0.98585, 0.025, 1.554],
      [1, 4.759, 0.96173, 0.0748, 3.675],
      [1.5, 7.313, 0.93488, 0.1873, 6.03],
      [2, 10.06, 0.90457, 0.5582, 8.666],
      [2.5, 13.07, 0.86962, 1.195, 11.67],
    ]
    for (const [load, angle, minV, angleErr, flowErr] of want) {
      const n = threeBus({ load })
      const s = powerFlow(n)
      const g = dcGuard(s)
      const cmp = dcCompare(n, { ac: s })
      expect(deg(g.maxAngle), `${load}× angle`).toBeCloseTo(angle, 2)
      expect(g.minV, `${load}× magnitude`).toBeCloseTo(minV, 4)
      expect(deg(cmp.maxAngleError), `${load}× angle error`).toBeCloseTo(angleErr, 3)
      expect(100 * cmp.maxError, `${load}× flow error`).toBeCloseTo(flowErr, 2)
    }
  })

  it('warns on the angle, on the magnitude and on R/X, each on its own', () => {
    const base = { flows: [{ angle: 0, branch: { r: 0.01, x: 0.08 } }], buses: [{ V: 1 }] }
    const angle = dcGuard({ ...base, flows: [{ angle: ((DC_WARN_DEG + 1) * Math.PI) / 180, branch: { r: 0, x: 0.08 } }] })
    expect(angle.warn).toBe(true)
    expect(angle.refuse).toBe(false)
    expect(angle.reasons[0]).toMatch(/branch angle/)
    const below = dcGuard({ ...base, flows: [{ angle: ((DC_WARN_DEG - 1) * Math.PI) / 180, branch: { r: 0, x: 0.08 } }] })
    expect(below.warn).toBe(false)
    const low = dcGuard({ ...base, buses: [{ V: DC_V_BAND[0] - 0.01 }] })
    expect(low.warn).toBe(true)
    expect(low.reasons[0]).toMatch(/bus magnitude/)
    expect(dcGuard({ ...base, buses: [{ V: DC_V_BAND[0] + 0.01 }] }).warn).toBe(false)
    const resistive = dcGuard({ ...base, flows: [{ angle: 0, branch: { r: 0.08 * (DC_RX_LIMIT + 0.05), x: 0.08 } }] })
    expect(resistive.warn).toBe(true)
    expect(resistive.reasons[0]).toMatch(/R\/X/)
  })

  it('declines the flow arrows past 30°, and draws them below it', () => {
    const past = dcGuard({ flows: [{ angle: ((DC_REFUSE_DEG + 1) * Math.PI) / 180, branch: { r: 0, x: 0.08 } }], buses: [{ V: 1 }] })
    expect(past.refuse).toBe(true)
    expect(past.refusal).toMatch(/which way a branch carries power/)
    const under = dcGuard({ flows: [{ angle: ((DC_REFUSE_DEG - 1) * Math.PI) / 180, branch: { r: 0, x: 0.08 } }], buses: [{ V: 1 }] })
    expect(under.refuse).toBe(false)
    expect(under.refusal).toBe(null)
  })
})

describe('the DC flow is the limit of the AC flow', () => {
  it('closes on the AC angles as the loading falls, with no resistance and pinned magnitudes', () => {
    // Invariant 11: strip the two assumptions the DC model makes about the
    // network, and only the small-angle step is left. It vanishes with the
    // loading.
    const lossless = (alpha) =>
      networkOf({
        ...threeBus({ load: alpha }),
        buses: threeBus({ load: alpha }).buses.map((b) => (b.type === 'slack' ? b : { ...b, type: 'pv', V: 1 })),
        branches: threeBus().branches.map((br) => ({ ...br, r: 0, b: 0 })),
      })
    let previous = Infinity
    for (const alpha of [1, 0.5, 0.2, 0.1]) {
      const n = lossless(alpha)
      const cmp = dcCompare(n)
      expect(cmp.maxAngleError, `${alpha}×`).toBeLessThan(previous)
      previous = cmp.maxAngleError
    }
    expect(previous).toBeLessThan(1e-6)
  })
})
