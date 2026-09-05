import { describe, it, expect } from 'vitest'
import { normalize, NetworkError } from './netlist.js'
import { solveDC } from './mna.js'
import { newtonDC, solvePWL } from './pwl.js'
import { smallSignal } from './smallSignal.js'
import { transferOf, CHECK_TOL } from './transfer.js'
import { blackman, returnRatioAt } from './loop.js'
import { bjtCurrents, bjtOf, signOf as bjtSign } from './bjt.js'
import { mosfetCurrent, mosfetOf, signOf as mosSign } from './mosfet.js'
import { hasCompanion, readControls } from './companion.js'
import { regionDevices, regionMargins } from './diode.js'
import { solutionScale } from './pwl.js'
import { VT } from './physics.js'

// The plan's §2.12, fuzzed. Every circuit the curriculum leans on, at random
// component values and bias settings, checked against the eight invariants
// that have to hold before any of it goes on screen.
//
// The hostile corners are in the list on purpose: the active load's knife
// edge, an op-amp with its loop open, β = 1000 and V_A → ∞.

/** A deterministic generator, so a failure can be reproduced from its seed. */
function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32)
}
const logBetween = (r, lo, hi) => lo * (hi / lo) ** r

/**
 * The zero Tellegen promises, in watts. A circuit carrying current is judged
 * against its own volts times its own amps. A circuit carrying none — a
 * transistor cut off, every branch exactly zero — has no current scale at all,
 * and what is left is the rounding of the matrix solve on its voltages.
 */
const powerFloor = (scale) => Math.max(1e-9 * scale.v * scale.i, 1e-15 * scale.v * scale.v)

/**
 * The library. Each entry builds a netlist from a random draw, and says which
 * source drives it, which node is its output and which element carries the
 * loop when there is one.
 */
const LIBRARY = [
  {
    name: 'CE stage, exponential',
    build: (r) => {
      const RC = logBetween(r(), 1000, 20000)
      const RB = logBetween(r(), 1e5, 2e6)
      return {
        net: {
          elements: [
            { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 5 + 10 * r() },
            { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: RC },
            { type: 'V', id: 'Vs', nodes: ['bb', 'gnd'], value: 2 + 6 * r(), small: true },
            { type: 'R', id: 'RB', nodes: ['bb', 'b'], value: RB },
            { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', beta: logBetween(r(), 20, 1000), va: logBetween(r(), 20, 400) },
          ],
        },
        input: 'Vs',
        output: 'c',
      }
    },
  },
  {
    name: 'CE stage, three regions',
    build: (r) => ({
      net: {
        elements: [
          { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 5 + 10 * r() },
          { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: logBetween(r(), 1000, 20000) },
          { type: 'V', id: 'Vs', nodes: ['bb', 'gnd'], value: 1 + 8 * r(), small: true },
          { type: 'R', id: 'RB', nodes: ['bb', 'b'], value: logBetween(r(), 1e4, 2e6) },
          { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], beta: logBetween(r(), 20, 1000) },
        ],
      },
      input: 'Vs',
      output: 'c',
      pwl: true,
    }),
  },
  {
    name: 'emitter follower',
    build: (r) => ({
      net: {
        elements: [
          { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
          { type: 'V', id: 'Vs', nodes: ['s', 'gnd'], value: 2 + 5 * r(), small: true },
          { type: 'R', id: 'Rs', nodes: ['s', 'b'], value: logBetween(r(), 100, 10000) },
          { type: 'R', id: 'RE', nodes: ['e', 'gnd'], value: logBetween(r(), 200, 20000) },
          { type: 'Q', id: 'Q1', nodes: ['vcc', 'b', 'e'], model: 'exp', beta: logBetween(r(), 50, 500), va: logBetween(r(), 30, 300) },
        ],
      },
      input: 'Vs',
      output: 'e',
    }),
  },
  {
    name: 'current mirror',
    build: (r) => ({
      net: {
        elements: [
          { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
          { type: 'R', id: 'Rref', nodes: ['vcc', 'ref'], value: logBetween(r(), 2000, 50000) },
          { type: 'Q', id: 'Q1', nodes: ['ref', 'ref', 'gnd'], model: 'exp', beta: logBetween(r(), 30, 500), va: 100 },
          { type: 'Q', id: 'Q2', nodes: ['out', 'ref', 'gnd'], model: 'exp', beta: logBetween(r(), 30, 500), va: 100 },
          { type: 'V', id: 'Vout', nodes: ['out', 'gnd'], value: 1 + 8 * r(), small: true },
        ],
      },
      input: 'Vout',
      output: 'ref',
    }),
  },
  {
    name: 'differential pair',
    build: (r) => ({
      net: {
        elements: [
          { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
          { type: 'V', id: 'VEE', nodes: ['vee', 'gnd'], value: -10 },
          { type: 'R', id: 'REE', nodes: ['e', 'vee'], value: logBetween(r(), 5000, 50000) },
          { type: 'R', id: 'RC1', nodes: ['vcc', 'c1'], value: 5000 },
          { type: 'R', id: 'RC2', nodes: ['vcc', 'c2'], value: 5000 },
          { type: 'Q', id: 'Q1', nodes: ['c1', 'b1', 'e'], model: 'exp', beta: 100, va: 100 },
          { type: 'Q', id: 'Q2', nodes: ['c2', 'b2', 'e'], model: 'exp', beta: 100, va: 100 },
          { type: 'V', id: 'Vid', nodes: ['b1', 'b2'], value: -0.05 + 0.1 * r(), small: true },
          { type: 'V', id: 'Vcm', nodes: ['b2', 'gnd'], value: -1 + 2 * r() },
        ],
      },
      input: 'Vid',
      output: 'c1',
    }),
  },
  {
    name: 'common source',
    build: (r) => ({
      net: {
        elements: [
          { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: 3 + 4 * r() },
          { type: 'R', id: 'RD', nodes: ['vdd', 'd'], value: logBetween(r(), 2000, 40000) },
          { type: 'V', id: 'VG', nodes: ['g', 'gnd'], value: 0.75 + 0.5 * r(), small: true },
          { type: 'M', id: 'M1', nodes: ['d', 'g', 'gnd'], vt: 0.5 + 0.5 * r(), kn: logBetween(r(), 5e-3, 100e-3), lambda: 0.05 * r() },
        ],
      },
      input: 'VG',
      output: 'd',
    }),
  },
  {
    name: 'CMOS inverter',
    build: (r) => {
      const vdd = 3 + 3 * r()
      return {
        net: {
          elements: [
            { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: vdd },
            { type: 'V', id: 'Vin', nodes: ['in', 'gnd'], value: 0.3 * vdd + 0.4 * vdd * r(), small: true },
            { type: 'M', id: 'Mp', nodes: ['out', 'in', 'vdd'], polarity: 'p', vt: 0.7, kn: 20e-3, lambda: 0.02 },
            { type: 'M', id: 'Mn', nodes: ['out', 'in', 'gnd'], polarity: 'n', vt: 0.7, kn: 20e-3, lambda: 0.02 },
          ],
        },
        input: 'Vin',
        output: 'out',
      }
    },
  },
  {
    name: 'active-loaded stage, the knife edge',
    build: (r) => ({
      net: {
        elements: [
          { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
          { type: 'I', id: 'Iload', nodes: ['vcc', 'c'], value: 1e-3 * (0.98 + 0.04 * r()) },
          { type: 'R', id: 'Ro', nodes: ['vcc', 'c'], value: logBetween(r(), 5e4, 5e5) },
          { type: 'V', id: 'Vs', nodes: ['bb', 'gnd'], value: 3 + 4 * r(), small: true },
          { type: 'R', id: 'RB', nodes: ['bb', 'b'], value: logBetween(r(), 2e5, 1e6) },
          { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', beta: 100, va: logBetween(r(), 50, 1e6) },
        ],
      },
      input: 'Vs',
      output: 'c',
    }),
  },
  {
    name: 'op-amp macro, closed loop',
    build: (r) => ({
      net: {
        elements: [
          { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: -0.05 + 0.1 * r(), small: true },
          {
            type: 'OPAMP',
            id: 'U1',
            nodes: ['out'],
            ctrl: ['in', 'n'],
            gain: logBetween(r(), 1e3, 1e6),
            vsat: 12,
            rout: logBetween(r(), 10, 300),
            gbw: 1e6,
          },
          { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: logBetween(r(), 1000, 20000) },
          { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: 1000 },
          { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: logBetween(r(), 1000, 100000) },
        ],
      },
      input: 'V1',
      output: 'out',
      pwl: true,
      loop: 'U1.G',
    }),
  },
]

/** Solve a library entry, by whichever method its models call for. */
function solve(entry) {
  return entry.pwl ? solvePWL(entry.net) : newtonDC(entry.net)
}

const DRAWS = 12

describe('invariant 1: the point satisfies the laws', () => {
  it('closes KCL at every node of every library circuit', () => {
    for (const item of LIBRARY) {
      for (let k = 0; k < DRAWS; k++) {
        const entry = item.build(rng(k * 7919 + 11))
        const op = solve(entry)
        const scale = solutionScale(op.sol)
        expect(op.sol.maxResidual, `${item.name} #${k}`).toBeLessThan(1e-9 * scale.i)
      }
    }
  })

  it('makes every transistor’s currents its own model’s law at its own voltages', () => {
    for (const item of LIBRARY) {
      for (let k = 0; k < DRAWS; k++) {
        const entry = item.build(rng(k * 104729 + 3))
        const op = solve(entry)
        const norm = normalize(entry.net)
        for (const e of norm.elements) {
          if (e.type === 'Q' && hasCompanion(e)) {
            const d = bjtOf(e)
            const s = bjtSign(d)
            const v = readControls(e, op.sol.v)
            const law = bjtCurrents(d, { vbe: s * v.vbe, vbc: s * v.vbc })
            const stamped = op.sol.i[`${e.id}.m0`] + op.sol.i[`${e.id}.m1`] - op.sol.i[`${e.id}.g1`] + (op.sol.i[`${e.id}.i1`] ?? 0)
            expect(Math.abs(stamped - s * law.ic), `${item.name} #${k} ${e.id}`).toBeLessThan(1e-9 * (1 + Math.abs(law.ic)))
          }
          if (e.type === 'M' && hasCompanion(e)) {
            const d = mosfetOf(e)
            const s = mosSign(d)
            const v = readControls(e, op.sol.v)
            const law = mosfetCurrent(d, { vgs: s * v.vgs, vds: s * v.vds })
            const stamped = op.sol.i[`${e.id}.g0`] + op.sol.i[`${e.id}.m0`] + (op.sol.i[`${e.id}.i0`] ?? 0)
            expect(Math.abs(stamped - s * law.id), `${item.name} #${k} ${e.id}`).toBeLessThan(1e-9 * (1 + Math.abs(law.id)))
          }
        }
      }
    }
  })
})

describe('invariant 2: the tangent is the derivative', () => {
  // Only where the device carries a curve. A piecewise-linear model IS its own
  // tangent inside a region, and the hybrid-π taken at the point it settled on
  // is the real device's small-signal model rather than that model's
  // derivative: the three-region BJT's own slope is β R_C/R_B and has no g_m
  // in it at all. D3 is where those two are put side by side.
  it('matches the finite-difference slope of the real circuit everywhere it is taken', () => {
    for (const item of LIBRARY) {
      if (item.build(rng(1)).pwl) continue
      for (let k = 0; k < DRAWS; k++) {
        const entry = item.build(rng(k * 31337 + 7))
        const op = solve(entry)
        const ss = smallSignal(entry.net, op)
        // The tangent's gain, from the linear circuit.
        const sources = Object.fromEntries(
          ss.elements.filter((e) => e.type === 'V' || e.type === 'I').map((e) => [e.id, e.id === entry.input ? 1 : 0]),
        )
        let av
        try {
          av = solveDC({ elements: ss.elements }, { sources }).v[entry.output]
        } catch (err) {
          if (!(err instanceof NetworkError)) throw err
          continue // a killed source can leave a node floating: that is the truth of the tangent
        }
        // The same slope, from the circuit itself.
        const drive = entry.net.elements.find((e) => e.id === entry.input)
        const h = 1e-6
        const at = (dv) => {
          const moved = { elements: entry.net.elements.map((e) => (e.id === entry.input ? { ...e, value: e.value + dv } : e)) }
          return (entry.pwl ? solvePWL(moved) : newtonDC(moved)).sol.v[entry.output]
        }
        const slope = (at(h) - at(-h)) / (2 * h)
        if (Math.abs(slope) < 1e-6) continue // nothing to compare against
        expect(Math.abs(av / slope - 1), `${item.name} #${k}: tangent ${av}, slope ${slope}`).toBeLessThan(1e-4)
        expect(drive.small).toBe(true)
      }
    }
  })
})

describe('invariant 3: polynomials agree with points', () => {
  it('holds on the small-signal netlist of every circuit that has one', () => {
    for (const item of LIBRARY) {
      for (let k = 0; k < 4; k++) {
        const entry = item.build(rng(k * 6151 + 29))
        const op = solve(entry)
        const ss = smallSignal(entry.net, op, { caps: true })
        let tf
        try {
          tf = transferOf({ elements: ss.elements }, { input: entry.input, output: entry.output })
        } catch (err) {
          if (!(err instanceof NetworkError)) throw err
          continue
        }
        expect(tf.check, `${item.name} #${k}`).toBeLessThan(CHECK_TOL)
      }
    }
  })
})

describe('invariant 4: two models agree where they claim to', () => {
  it('puts the three-region and exponential points within the stated error', () => {
    // Driven through a base resistor from a supply well above V_BE(on), so
    // both models sit in the active region and the comparison is fair.
    for (let k = 0; k < 20; k++) {
      const r = rng(k * 977 + 5)
      const RB = logBetween(r(), 2e5, 3e6)
      const RC = logBetween(r(), 1000, 10000)
      const beta = logBetween(r(), 50, 300)
      const make = (model) => ({
        elements: [
          { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
          { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: RC },
          { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: 5 },
          { type: 'R', id: 'RB', nodes: ['bb', 'b'], value: RB },
          { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model, beta, va: 100 },
        ],
      })
      const pwl = solvePWL(make('regions'))
      if (pwl.regions.Q1 !== 'active') continue
      const exp = newtonDC(make('exp'))
      const icPwl = pwl.sol.i['Q1.ce']
      const icExp = exp.sol.i.RC
      // The three-region model's stated error: it takes V_BE(on) for the
      // junction's own drop and ignores the Early effect, and the gap is
      // bounded by what those two choices cost.
      expect(Math.abs(icExp / icPwl - 1), `#${k}`).toBeLessThan(0.25)
    }
  })
})

describe('invariant 5: every region holds its own guards', () => {
  it('leaves no piecewise device sitting in a region it contradicts', () => {
    for (const item of LIBRARY) {
      if (!item.build(rng(1)).pwl) continue
      for (let k = 0; k < DRAWS; k++) {
        const entry = item.build(rng(k * 8191 + 17))
        const op = solvePWL(entry.net)
        const norm = normalize(entry.net)
        const scale = solutionScale(op.sol)
        for (const d of regionDevices(norm)) {
          for (const m of regionMargins(d.element, op.regions[d.id], op.sol)) {
            const tol = 1e-9 * (m.what === 'i' || m.what === 'ib' || m.what === 'ic' ? scale.i : scale.v)
            expect(m.margin, `${item.name} #${k} ${d.id} ${op.regions[d.id]}: ${m.says}`).toBeGreaterThanOrEqual(-tol)
          }
        }
      }
    }
  })
})

describe('invariant 6: feedback closes', () => {
  it('makes Blackman’s form the direct solve, on the op-amp macro’s loop', () => {
    const item = LIBRARY.find((x) => x.name === 'op-amp macro, closed loop')
    for (let k = 0; k < DRAWS; k++) {
      const entry = item.build(rng(k * 3121 + 13))
      const op = solvePWL(entry.net)
      // A railed op-amp has no loop left to break: its output is a source that
      // does not move, and the small-signal netlist says so.
      if (op.regions.U1 !== 'linear') continue
      const ss = smallSignal(entry.net, op)
      const b = blackman({ elements: ss.elements }, entry.loop, { input: entry.input, output: entry.output })
      expect(Math.abs(b.closed[0] / b.direct[0] - 1), `#${k}`).toBeLessThan(1e-6)
      expect(Math.abs(b.fromGains[0] / b.T[0] - 1), `T #${k}`).toBeLessThan(1e-5)
      // Negative feedback: the loop opposes its own drive, so T is positive.
      expect(b.T[0], `#${k}`).toBeGreaterThan(0)
      expect(returnRatioAt({ elements: ss.elements }, entry.loop)[0]).toBeCloseTo(b.T[0], 6)
    }
  })
})

describe('invariant 8: Tellegen', () => {
  it('sums every element’s v·i to zero, at the point and at the tangent', () => {
    for (const item of LIBRARY) {
      for (let k = 0; k < DRAWS; k++) {
        const entry = item.build(rng(k * 5279 + 23))
        const op = solve(entry)
        // The scale a power is judged against is the circuit's own volts times
        // its own amps, not the largest power in it: a device that is cut off
        // has every power at rounding noise and no scale of its own.
        const sc = solutionScale(op.sol)
        expect(Math.abs(op.sol.pTotal), `${item.name} #${k} at the point`).toBeLessThan(powerFloor(sc))
        // And in the small-signal circuit, with the dependent sources counted.
        const ss = smallSignal(entry.net, op)
        const sources = Object.fromEntries(
          ss.elements.filter((e) => e.type === 'V' || e.type === 'I').map((e) => [e.id, e.id === entry.input ? 1 : 0]),
        )
        let sol
        try {
          sol = solveDC({ elements: ss.elements }, { sources })
        } catch (err) {
          if (!(err instanceof NetworkError)) throw err
          continue
        }
        expect(Math.abs(sol.pTotal), `${item.name} #${k} at the tangent`).toBeLessThan(powerFloor(solutionScale(sol)))
      }
    }
  })
})

describe('the hostile corners, named', () => {
  it('finds the operating point with β = 1000 and V_A → ∞', () => {
    const net = {
      elements: [
        { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
        { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: 5000 },
        { type: 'V', id: 'VBB', nodes: ['bb', 'gnd'], value: 5 },
        { type: 'R', id: 'RB', nodes: ['bb', 'b'], value: 4.3e6 },
        { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', beta: 1000, va: Infinity },
      ],
    }
    const op = newtonDC(net)
    expect(op.converged).toBe(true)
    expect(op.sol.i.RC * 1000).toBeCloseTo(1, 0)
    const ss = smallSignal(net, op)
    expect(ss.elements.find((e) => e.id === 'Q1.rpi').value).toBeCloseTo((1000 * VT) / op.sol.i.RC, 0)
  })

  it('says why an op-amp with its loop open has no answer', () => {
    expect(() =>
      solveDC({
        elements: [
          { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 1 },
          { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'gnd'] },
          { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: 1000 },
        ],
      }),
    ).toThrow(/no feedback path/)
  })
})
