import { describe, it, expect } from 'vitest'
import { dynamics, solveDC, transient } from '@ee-labs/network'
import { GROUND } from '@ee-labs/network'
import { MECH, radToRpm, rpmToRad, senseBranch, shaft } from './port.js'

// The two constructions everything else rests on: a branch whose current can
// be read as a voltage without disturbing the circuit, and a shaft that is a
// node. Both are exact, and both are checked here rather than assumed.

const rand = (lo, hi) => lo + Math.random() * (hi - lo)

describe('the sense branch is invisible', () => {
  // A divider with the sense pair spliced into it. The node voltage above the
  // splice must be what it would be with a plain wire there.
  const build = (rs) => ({
    elements: [
      { type: 'V', id: 'V1', nodes: ['a', GROUND], value: 10 },
      { type: 'R', id: 'R1', nodes: ['a', 'b'], value: 3300 },
      ...senseBranch('s', 'b', 'c', rs).elements,
      { type: 'R', id: 'R2', nodes: ['c', GROUND], value: 4700 },
    ],
  })

  const plain = {
    elements: [
      { type: 'V', id: 'V1', nodes: ['a', GROUND], value: 10 },
      { type: 'R', id: 'R1', nodes: ['a', 'b'], value: 3300 },
      { type: 'R', id: 'R2', nodes: ['b', GROUND], value: 4700 },
    ],
  }

  it('changes no node voltage and no current over eight decades of sense resistance', () => {
    const ref = solveDC(plain)
    for (const rs of [1e-2, 1, 1e2, 1e4, 1e6]) {
      const sol = solveDC(build(rs))
      expect(Math.abs(sol.v.b - ref.v.b) / ref.v.b).toBeLessThan(1e-10)
      expect(Math.abs(sol.v.c - ref.v.b) / ref.v.b).toBeLessThan(1e-10)
      expect(Math.abs(sol.i.R1 - ref.i.R1) / ref.i.R1).toBeLessThan(1e-10)
    }
  })

  it('drifts only by the solve conditioning when the sense resistance is far below the circuit', () => {
    // The cancellation is algebraic and exact. What is not exact is the LU
    // solve. A sense resistance a millionth of the circuit's puts a huge
    // conductance in the matrix beside small ones, and digits go. A large one
    // costs nothing, because the cancelling source removes its drop. The two
    // ends are measured here so the rule for choosing R_s is a fact.
    const ref = solveDC(plain)
    const drift = (rs) => Math.abs(solveDC(build(rs)).v.b - ref.v.b) / ref.v.b
    expect(drift(1e3)).toBeLessThan(1e-14)
    expect(drift(1e-6)).toBeGreaterThan(drift(1))
    expect(drift(1e-6)).toBeLessThan(1e-6)
  })

  it('reports the branch current as i·R_s on the sense pair', () => {
    for (let k = 0; k < 40; k++) {
      const rs = Math.pow(10, rand(-6, 6))
      const sol = solveDC(build(rs))
      const i = sol.i.R1
      expect(sol.v.b - sol.v['s.m']).toBeCloseTo(i * rs, 12)
    }
  })

  it('refuses a sense resistance that is not positive', () => {
    expect(() => senseBranch('s', 'a', 'b', 0)).toThrow(/positive/)
    expect(() => senseBranch('s', 'a', 'b', -1)).toThrow(/positive/)
  })
})

describe('the shaft is a node', () => {
  it('carries the inertia as a capacitance and the friction as a conductance', () => {
    const sh = shaft('wm', { J: 0.05, B: 0.002, load: 3 })
    const J = sh.elements.find((e) => e.id === 'shaft.J')
    const B = sh.elements.find((e) => e.id === 'shaft.B')
    const T = sh.elements.find((e) => e.id === 'shaft.TL')
    expect(J.type).toBe('C')
    expect(J.value).toBe(0.05)
    expect(B.type).toBe('R')
    expect(B.value).toBeCloseTo(1 / 0.002, 12)
    expect(T.type).toBe('I')
    expect(T.value).toBe(3)
    expect(MECH.inertia.as).toBe('F')
  })

  it('spins down from a starting speed with the time constant J/B', () => {
    // A shaft alone, with an initial speed and nothing driving it, is an RC.
    const J = 0.05
    const B = 0.002
    const net = { elements: shaft('wm', { J, B }).elements.map((e) => (e.id === 'shaft.J' ? { ...e, x0: 100 } : e)) }
    const tau = J / B
    const tr = transient(net, { tEnd: 3 * tau, points: 301 })
    expect(tr.at(tau).sol.v.wm).toBeCloseTo(100 * Math.exp(-1), 9)
    expect(tr.at(2 * tau).sol.v.wm).toBeCloseTo(100 * Math.exp(-2), 9)
  })

  it('stores ½Jω², which is the rotor kinetic energy', () => {
    const net = { elements: shaft('wm', { J: 0.05, B: 0.002 }).elements.map((e) => (e.id === 'shaft.J' ? { ...e, x0: 40 } : e)) }
    const dyn = dynamics(net)
    expect(dyn.stored([40])[0]).toBeCloseTo(0.5 * 0.05 * 40 * 40, 12)
  })

  it('refuses an inertia that is not positive and a negative friction', () => {
    expect(() => shaft('wm', { J: 0 })).toThrow(/positive/)
    expect(() => shaft('wm', { J: 1, B: -1 })).toThrow(/negative/)
  })
})

describe('rev/min and rad/s', () => {
  it('round-trip to floating point, and 1500 rpm is 157.08 rad/s', () => {
    expect(radToRpm(rpmToRad(1234.5))).toBeCloseTo(1234.5, 10)
    expect(rpmToRad(1500)).toBeCloseTo(50 * Math.PI, 12)
  })
})
