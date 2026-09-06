import { describe, it, expect } from 'vitest'
import { networkOf, ybus, branchY, branchFlows, injections, phasors } from './network.js'
import { threeBus, twoBus, lineBranch } from './library.js'
import { C, cabs, cadd, cdiv, cmul, csub } from './cx.js'

// The bus admittance matrix against a hand-built one, and the branch flows
// against the matrix they were stamped from. GRID_LAB_PLAN.md §2.3 gives the
// three-bus system's matrix.

const net = threeBus()

describe('the bus admittance matrix', () => {
  const Y = ybus(net)

  it('matches the plan entry for entry', () => {
    const want = {
      '0,0': [2.5641, -20.313],
      '0,1': [-1.5385, 12.308],
      '0,2': [-1.0256, 8.2051],
      '1,1': [3.4615, -27.548],
      '1,2': [-1.9231, 15.385],
      '2,2': [2.9487, -23.406],
    }
    for (const [key, [re, im]] of Object.entries(want)) {
      const [i, j] = key.split(',').map(Number)
      expect(Y[i][j][0], key).toBeCloseTo(re, 4)
      expect(Y[i][j][1], key).toBeCloseTo(im, 3)
    }
  })

  it('is the hand construction: off diagonal is minus the branch admittance', () => {
    for (const br of net.branches) {
      const f = net.index.get(br.from)
      const t = net.index.get(br.to)
      const y = branchY(br)
      expect(Y[f][t][0]).toBeCloseTo(-y[0], 12)
      expect(Y[f][t][1]).toBeCloseTo(-y[1], 12)
      expect(Y[t][f][0]).toBeCloseTo(-y[0], 12)
    }
    // And a diagonal is the sum of what leaves that bus, plus its charging.
    for (let i = 0; i < net.n; i++) {
      let sum = C(0)
      let charging = 0
      for (const br of net.branches) {
        const f = net.index.get(br.from)
        const t = net.index.get(br.to)
        if (f !== i && t !== i) continue
        sum = cadd(sum, branchY(br))
        charging += br.b / 2
      }
      expect(Y[i][i][0]).toBeCloseTo(sum[0], 12)
      expect(Y[i][i][1]).toBeCloseTo(sum[1] + charging, 12)
    }
  })

  it('is symmetric when no branch carries a phase shift', () => {
    for (let i = 0; i < net.n; i++)
      for (let j = 0; j < net.n; j++) {
        expect(Y[i][j][0]).toBeCloseTo(Y[j][i][0], 12)
        expect(Y[i][j][1]).toBeCloseTo(Y[j][i][1], 12)
      }
  })

  it('takes an off-nominal tap into the four entries it belongs in', () => {
    const tapped = twoBus({ tap: 1.05 })
    const Yt = ybus(tapped)
    const y = branchY(tapped.branches[0])
    expect(Yt[0][0][1]).toBeCloseTo(y[1] / 1.05 ** 2, 12)
    expect(Yt[1][1][1]).toBeCloseTo(y[1], 12)
    expect(Yt[0][1][1]).toBeCloseTo(-y[1] / 1.05, 12)
    // At a ratio of one the tapped stamp is the line's, exactly.
    const flat = ybus(twoBus({ tap: 1 }))
    expect(ybus(twoBus())[0][0][1]).toBeCloseTo(flat[0][0][1], 12)
  })
})

describe('the flows and the injections agree', () => {
  it('sums every branch leaving a bus to that bus injection, to floating point', () => {
    const V = [1, 0.99, 0.97]
    const th = [0, -0.02, -0.05]
    const Vc = phasors(V, th)
    const S = injections(net, Vc)
    const flows = branchFlows(net, Vc)
    for (let i = 0; i < net.n; i++) {
      const id = net.buses[i].id
      let sum = C(0)
      for (const f of flows) {
        if (f.from === id) sum = cadd(sum, f.Sf)
        if (f.to === id) sum = cadd(sum, f.St)
      }
      expect(cabs(csub(sum, S[i])), id).toBeLessThan(1e-12)
    }
  })

  it('gives a lossless branch no real loss, and a resistive one a positive loss', () => {
    const Vc = phasors([1, 0.98, 0.95], [0, -0.03, -0.07])
    for (const f of branchFlows(net, Vc)) expect(f.Ploss, f.id).toBeGreaterThan(0)
    const lossless = networkOf({ ...net, branches: net.branches.map((br) => ({ ...br, r: 0 })) })
    for (const f of branchFlows(lossless, Vc)) expect(Math.abs(f.Ploss), f.id).toBeLessThan(1e-15)
  })
})

describe('what a network refuses', () => {
  it('names the bus or branch that is wrong', () => {
    expect(() => networkOf({ buses: [] })).toThrow(/at least one bus/)
    expect(() => networkOf({ buses: [{ id: 'a', type: 'pq' }] })).toThrow(/exactly one slack/)
    expect(() => networkOf({ buses: [{ id: 'a', type: 'slack' }, { id: 'b', type: 'slack' }] })).toThrow(/exactly one slack/)
    expect(() => networkOf({ buses: [{ id: 'a', type: 'nonesuch' }] })).toThrow(/slack, pv or pq/)
    expect(() => networkOf({ buses: [{ id: 'a', type: 'slack', V: 0 }] })).toThrow(/magnitude must be positive/)
    expect(() =>
      networkOf({ buses: [{ id: 'a', type: 'slack' }], branches: [{ from: 'a', to: 'zz', x: 0.1 }] }),
    ).toThrow(/not in the list/)
    expect(() =>
      networkOf({ buses: [{ id: 'a', type: 'slack' }], branches: [{ from: 'a', to: 'a', x: 0.1 }] }),
    ).toThrow(/two different buses/)
    expect(() =>
      networkOf({ buses: [{ id: 'a', type: 'slack' }, { id: 'b' }], branches: [{ from: 'a', to: 'b', r: 0, x: 0 }] }),
    ).toThrow(/nonzero impedance/)
    expect(() =>
      networkOf({ buses: [{ id: 'a', type: 'slack' }, { id: 'b' }], branches: [{ from: 'a', to: 'b', x: 0.1, tap: 0 }] }),
    ).toThrow(/tap ratio/)
    expect(() => networkOf({ buses: [{ id: 'a', type: 'slack' }, { id: 'b', type: 'pv', Qmin: 1, Qmax: 0 }] })).toThrow(/Qmin above Qmax/)
  })

  it('keeps a bus with no reactive limit unlimited', () => {
    const b = threeBus().buses[1]
    expect(b.Qmax).toBe(Infinity)
    expect(b.Qmin).toBe(-Infinity)
  })
})

describe('the branch library', () => {
  it('scales the reference line with its length', () => {
    const br = lineBranch('x', 'a', 'b', 150)
    expect(br.r).toBeCloseTo(0.015, 12)
    expect(br.x).toBeCloseTo(0.12, 12)
    expect(br.b).toBeCloseTo(0.24, 12)
  })
})
