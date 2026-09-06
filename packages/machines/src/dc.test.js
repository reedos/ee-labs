import { describe, it, expect } from 'vitest'
import { dynamics, energies, transient } from '@ee-labs/network'
import { dcNetlist, dcOf, control, line, operating, powerAudit, timeConstants } from './dc.js'

// The DC machine, checked against the two equations it is. Nothing below quotes
// a number that is not computed from the machine's own constants.

const rand = (lo, hi) => lo + Math.random() * (hi - lo)
const spec = (over = {}) => ({ Va: 24, Ra: 1.2, La: 3e-3, k: 0.06, J: 2e-4, B: 1e-5, TL: 0.05, ...over })
const idOf = (dyn, id) => dyn.states.findIndex((s) => s.id === id)

describe('the netlist carries the state equation', () => {
  it('has exactly two states, the armature current and the shaft speed', () => {
    const dyn = dynamics(dcNetlist(spec()))
    expect(dyn.states.map((s) => s.id)).toEqual(['La', 'shaft.J'])
    expect(dyn.states[1].value).toBe(spec().J)
  })

  it('gives A and B the entries the two equations demand, with no matrix written by hand', () => {
    for (let t = 0; t < 25; t++) {
      const p = spec({ Ra: rand(0.2, 5), La: rand(1e-4, 2e-2), k: rand(0.01, 0.3), J: rand(1e-5, 1e-2), B: rand(0, 1e-3) })
      const m = dcOf(p)
      const dyn = dynamics(dcNetlist(p))
      const i = idOf(dyn, 'La')
      const w = idOf(dyn, 'shaft.J')
      expect(dyn.A[i][i]).toBeCloseTo(-m.Ra / m.La, 6)
      expect(dyn.A[i][w] / (-m.ke / m.La)).toBeCloseTo(1, 9)
      expect(dyn.A[w][i] / (m.km / m.J)).toBeCloseTo(1, 9)
      expect(dyn.A[w][w]).toBeCloseTo(-(m.B + m.loadB) / m.J, 6)
      const va = dyn.inputs.indexOf('Va')
      expect(dyn.B[i][va] / (1 / m.La)).toBeCloseTo(1, 9)
      expect(dyn.B[w][va]).toBeCloseTo(0, 9)
    }
  })

  it('reads the same roots from the netlist as the characteristic polynomial gives', () => {
    for (let t = 0; t < 20; t++) {
      const p = spec({ Ra: rand(0.2, 5), La: rand(1e-4, 1e-2), k: rand(0.02, 0.2), J: rand(1e-5, 1e-3), B: rand(0, 1e-3) })
      const dyn = dynamics(dcNetlist(p))
      const tc = timeConstants(p)
      const trace = dyn.A[0][0] + dyn.A[1][1]
      const det = dyn.A[0][0] * dyn.A[1][1] - dyn.A[0][1] * dyn.A[1][0]
      expect(-trace / tc.a1).toBeCloseTo(1, 9)
      expect(det / tc.a0).toBeCloseTo(1, 9)
    }
  })
})

describe('the torque–speed line', () => {
  it('runs from the stall torque to the no-load speed', () => {
    const p = spec()
    const m = dcOf(p)
    const l = line(p)
    expect(l.stall).toBeCloseTo((m.k * m.Va) / m.Ra, 12)
    expect(l.noLoad).toBeCloseTo(m.Va / m.k, 12)
    expect(l.torqueAt(0)).toBeCloseTo(l.stall, 12)
    expect(l.torqueAt(l.noLoad)).toBeCloseTo(0, 12)
  })

  it('is straight: the slope is the same between any two speeds', () => {
    const l = line(spec())
    for (let t = 0; t < 20; t++) {
      const a = rand(0, l.noLoad)
      const b = rand(0, l.noLoad)
      if (Math.abs(a - b) < 1) continue
      expect((l.torqueAt(b) - l.torqueAt(a)) / (b - a)).toBeCloseTo(l.slope, 10)
    }
  })

  it('inverts: the speed at a torque puts the torque back', () => {
    const l = line(spec())
    for (let t = 0; t < 20; t++) {
      const T = rand(0, l.stall)
      expect(l.torqueAt(l.speedAt(T))).toBeCloseTo(T, 10)
    }
  })
})

describe('the settled point of the time solution is where the line crosses the load', () => {
  it('agrees on speed, current and torque', () => {
    for (let t = 0; t < 12; t++) {
      const p = spec({ Va: rand(6, 48), Ra: rand(0.5, 4), k: rand(0.06, 0.15), TL: rand(0.005, 0.06), B: rand(0, 5e-5) })
      const op = operating(p)
      if (!(op.omega > 1)) continue
      const tc = timeConstants(p)
      // Long enough that the slower root has decayed below a part in 10¹².
      const tEnd = 28 / Math.min(...tc.roots.map((r) => Math.abs(r.re)))
      const tr = transient(dcNetlist({ ...p, drive: { kind: 'step', from: 0, to: p.Va } }), { tEnd, points: 401 })
      const end = tr.at(tEnd)
      const l = line(p)
      expect(Math.abs(end.sol.v.wm - op.omega) / l.noLoad).toBeLessThan(1e-8)
      expect(Math.abs(end.sol.i.Ra - op.ia) / (p.Va / p.Ra)).toBeLessThan(1e-8)
      expect(Math.abs(dcOf(p).km * end.sol.i.Ra - op.torque) / l.stall).toBeLessThan(1e-8)
    }
  })

  it('sits on the line: the settled torque equals the line at the settled speed', () => {
    const p = spec({ TL: 0.04 })
    const l = line(p)
    const op = operating(p)
    expect(l.torqueAt(op.omega)).toBeCloseTo(op.torque, 10)
  })
})

describe('starting current', () => {
  it('rises towards V/R because the back-EMF has not built yet', () => {
    // With the mechanical time constant far above the electrical one, the
    // speed has barely moved while the current reaches its peak.
    const p = spec({ J: 4e-3, TL: 0 })
    const tc = timeConstants(p)
    expect(tc.separated).toBeGreaterThan(10)
    const tr = transient(dcNetlist({ ...p, drive: { kind: 'step', from: 0, to: p.Va } }), { tEnd: 30 * tc.tauE, points: 3001 })
    let peak = 0
    for (const s of tr.samples) peak = Math.max(peak, s.sol.i.Ra)
    const free = p.Va / p.Ra
    expect(peak / free).toBeGreaterThan(0.97)
    expect(peak).toBeLessThan(free)
    // …and the running current is smaller by the ratio of the two torques.
    expect(operating(p).ia).toBeLessThan(peak / 100)
  })

  it('is limited by a series resistance in exactly the ratio of the resistances', () => {
    const p = spec({ J: 4e-3, TL: 0 })
    const withStarter = { ...p, Ra: p.Ra * 4 }
    expect((withStarter.Va / withStarter.Ra) / (p.Va / p.Ra)).toBeCloseTo(0.25, 12)
    expect(line(withStarter).stall / line(p).stall).toBeCloseTo(0.25, 12)
  })
})

describe('speed control', () => {
  it('by armature voltage slides the line and keeps its slope', () => {
    const c = control(spec(), { volts: [8, 16, 24] })
    for (const row of c.armature) expect(row.slope).toBeCloseTo(c.armature[0].slope, 12)
    expect(c.armature[2].noLoad / c.armature[0].noLoad).toBeCloseTo(3, 12)
  })

  it('by field rotates it: the no-load speed goes as 1/k and the stall torque as k', () => {
    const c = control(spec(), { fields: [1, 0.5] })
    expect(c.field[1].noLoad / c.field[0].noLoad).toBeCloseTo(2, 12)
    expect(c.field[1].stall / c.field[0].stall).toBeCloseTo(0.5, 12)
    expect(c.field[1].slope / c.field[0].slope).toBeCloseTo(0.25, 12)
  })
})

describe('the power audit closes', () => {
  it('balances at the operating point to floating point', () => {
    const p = spec()
    const op = operating(p)
    const tc = timeConstants(p)
    const tEnd = 30 / Math.abs(Math.max(...tc.roots.map((r) => r.re)))
    const tr = transient(dcNetlist({ ...p, drive: { kind: 'step', from: 0, to: p.Va } }), { tEnd, points: 201 })
    const a = powerAudit(tr.at(tEnd).sol, p)
    expect(Math.abs(a.gap) / a.supplied).toBeLessThan(1e-12)
    expect(Math.abs(a.coupled) / a.supplied).toBeLessThan(1e-12)
    expect(Math.abs(a.sense) / a.supplied).toBeLessThan(1e-12)
    expect(a.supplied / op.pIn).toBeCloseTo(1, 8)
    expect(a.copper / op.pCu).toBeCloseTo(1, 8)
  })

  it('shows the coupling losing power when k_e and k_t are made unequal', () => {
    const p = spec({ kt: 0.09 })
    const tc = timeConstants(p)
    const tEnd = 30 / Math.abs(Math.max(...tc.roots.map((r) => r.re)))
    const tr = transient(dcNetlist({ ...p, drive: { kind: 'step', from: 0, to: p.Va } }), { tEnd, points: 201 })
    const a = powerAudit(tr.at(tEnd).sol, p)
    // Tellegen still holds over the netlist, so the gap is still zero. What
    // changes is that the coupling pair no longer sums to nothing.
    expect(Math.abs(a.gap) / a.supplied).toBeLessThan(1e-12)
    expect(Math.abs(a.coupled) / a.supplied).toBeGreaterThan(0.1)
  })

  it('closes the energy ledger over the whole run', () => {
    const p = spec()
    const tr = transient(dcNetlist({ ...p, drive: { kind: 'step', from: 0, to: p.Va } }), { tEnd: 0.4, points: 401 })
    const e = energies(tr)
    const scale = Math.max(...e.points.map((q) => Math.abs(q.supplied)))
    for (const q of e.points) expect(Math.abs(q.gap) / scale).toBeLessThan(1e-9)
  })
})

describe('the machine refuses what it cannot be', () => {
  it('names the value that is wrong', () => {
    expect(() => dcOf({ Ra: 0 })).toThrow(/armature resistance/)
    expect(() => dcOf({ La: -1 })).toThrow(/armature inductance/)
    expect(() => dcOf({ J: 0 })).toThrow(/rotor inertia/)
    expect(() => dcOf({ field: 0 })).toThrow(/flux/)
  })
})
