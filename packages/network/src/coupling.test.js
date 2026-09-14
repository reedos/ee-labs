import {describe, it, expect} from 'vitest'
import {normalize, dynamics, solveAC, transient, energies} from '../index.js'

const net = (M, sine = false) => ({elements: [
  {type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 3, ...(sine ? {wave: {kind: 'sine', amp: 3, freq: 100}} : {})},
  {type: 'R', id: 'R1', nodes: ['in', 'a'], value: 10},
  {type: 'L', id: 'L1', nodes: ['a', 'gnd'], value: .02, coupledTo: 'L2', mutual: M, x0: .01},
  {type: 'L', id: 'L2', nodes: ['b', 'gnd'], value: .03, x0: -.02},
  {type: 'R', id: 'R2', nodes: ['b', 'gnd'], value: 20},
]})

describe('reciprocal mutual inductance', () => {
  for (const M of [-.015, 0, .015]) {
    it(`M=${M}: state derivatives satisfy both winding laws and conserve energy`, () => {
      const model = net(M), dyn = dynamics(model), state = [.01, -.02], sol = dyn.solveAt(state, [3]), slope = dyn.derivOf(sol)
      expect(.02 * slope[0] + M * slope[1]).toBeCloseTo(sol.volt.L1, 10)
      expect(M * slope[0] + .03 * slope[1]).toBeCloseTo(sol.volt.L2, 10)
      expect(dyn.stored(state).reduce((a, b) => a + b, 0)).toBeCloseTo(.5 * .02 * state[0] ** 2 + .5 * .03 * state[1] ** 2 + M * state[0] * state[1], 12)
      const tr = transient(model, {tEnd: .03, points: 401})
      for (const e of energies(tr).points) expect(Math.abs(e.gap)).toBeLessThan(1e-8)
    })
    it(`M=${M}: phasors satisfy the coupled impedance equations and agree with late transients`, () => {
      const model = net(M, true), w = 2 * Math.PI * 100, ac = solveAC(model, w), tr = transient(model, {tEnd: .1, points: 201})
      const i1 = ac.i.L1, i2 = ac.i.L2
      expect(ac.volt.L1[0]).toBeCloseTo(-w * (.02 * i1[1] + M * i2[1]), 10)
      expect(ac.volt.L1[1]).toBeCloseTo(w * (.02 * i1[0] + M * i2[0]), 10)
      expect(ac.volt.L2[0]).toBeCloseTo(-w * (M * i1[1] + .03 * i2[1]), 10)
      for (const t of [.081, .084, .097]) {
        expect(tr.at(t).sol.i.L1).toBeCloseTo(ac.at(t).i.L1, 7)
        expect(tr.at(t).sol.i.L2).toBeCloseTo(ac.at(t).i.L2, 7)
      }
    })
  }
  it('rejects impossible, singular, duplicate and dangling coupling declarations', () => {
    for (const M of [.03, Math.sqrt(.02 * .03), NaN]) expect(() => normalize(net(M))).toThrow()
    const duplicate = net(.01); duplicate.elements[3].coupledTo = 'L1'; duplicate.elements[3].mutual = .01
    expect(() => normalize(duplicate)).toThrow(/once/)
    const missing = net(.01); missing.elements[2].coupledTo = 'missing'
    expect(() => normalize(missing)).toThrow(/distinct inductors/)
  })
})
