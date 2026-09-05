import { describe, it, expect } from 'vitest'
import { normalize, NetworkError } from './netlist.js'
import { expandMacros, expandOpAmp, isMacro } from './macro.js'
import { solveDC } from './mna.js'
import { solvePWL, pwlTransient } from './pwl.js'
import { solveAC } from './phasor.js'
import { bisect } from './transient.js'
import { cabs } from './complex.js'

// The op-amp a user meets, as a circuit of elements this package already
// stamps. Every number here is computed from the element's own fields, never
// typed: the point of the macro is that A₀, f_p, SR and the CMRR error are
// consequences of g, R, C and the current limit, and a test that typed them in
// would not notice the day one of those consequences stopped following.

const DEFAULTS = { gain: 1e5, vsat: 12, rout: 75, gbw: 1e6, slew: 0.5e6, vos: 1e-3, ib: 100e-9, cmrr: 90, imax: 25e-3 }
/** The macro with only the named non-idealities switched on. */
const only = (keys, over = {}) => ({ ...Object.fromEntries(keys.map((k) => [k, DEFAULTS[k]])), ...over })

/** The non-inverting amplifier of the plan's §5, gain 1 + R_f/R_g. */
const amp = (over = {}, p = {}) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], ...(p.wave ? { wave: p.wave } : { value: p.E ?? 0 }) },
    { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'n'], ...over },
    { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: p.Rf ?? 10000 },
    { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: p.Rg ?? 1000 },
    { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL ?? 10000 },
  ],
})
const dc = (net) => solvePWL(net).sol

describe('the macro is only a macro when it has to be', () => {
  it('leaves a netlist with no macro in it exactly as it was', () => {
    const els = [
      { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 1 },
      { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'n'], gain: 1e5, vsat: 12 },
      { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: 1000 },
    ]
    expect(expandMacros(els)).toBe(els)
    expect(els.map(isMacro)).toEqual([false, false, false])
  })

  it('counts a zero as absent, so a knob turned to nothing costs no nodes', () => {
    expect(isMacro({ type: 'OPAMP', id: 'U1', nodes: ['o'], ctrl: ['p', 'n'], vos: 0, ib: 0, rout: 0 })).toBe(false)
  })

  it('keeps the op-amp’s own id on the element that carries the rails', () => {
    const parts = expandOpAmp({ type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['p', 'n'], ...DEFAULTS })
    const amp1 = parts.find((e) => e.type === 'OPAMP')
    expect(amp1.id).toBe('U1')
    expect(amp1.vsat).toBe(12)
    expect(amp1.imax).toBe(25e-3)
    // Every other part is named for the op-amp it belongs to, so a reading can
    // be traced back to the device it came from.
    for (const e of parts) expect(e.of).toBe('U1')
    for (const e of parts) if (e.id !== 'U1') expect(e.id.startsWith('U1.')).toBe(true)
  })

  it('gives a node count refusal its own message for the transistors', () => {
    expect(() => normalize({ elements: [{ type: 'Q', id: 'Q1', nodes: ['c', 'gnd'] }] })).toThrow(/needs 3 nodes/)
    expect(() => normalize({ elements: [{ type: 'M', id: 'M1', nodes: ['d'] }] })).toThrow(/needs 3 nodes/)
  })
})

describe('invariant 7: the macro is the black box', () => {
  // Circuit Elements Lab E2 draws the op-amp as R_in, A and R_out, built from
  // discrete elements. The macro with its pole at infinity and every limit off
  // has to be that circuit, to floating point, or Group A is describing a
  // different device from the one Group M opens.
  const discrete = (p) => ({
    elements: [
      { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
      { type: 'R', id: 'Rs', nodes: ['in', 'p'], value: p.Rs },
      { type: 'R', id: 'Rin', nodes: ['p', 'gnd'], value: p.Rin },
      { type: 'VCVS', id: 'E1', nodes: ['o', 'gnd'], ctrl: ['p', 'gnd'], gain: p.A },
      { type: 'R', id: 'Rout', nodes: ['o', 'out'], value: p.Rout },
      { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
    ],
  })
  const asMacro = (p) => ({
    elements: [
      { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
      { type: 'R', id: 'Rs', nodes: ['in', 'p'], value: p.Rs },
      { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['p', 'gnd'], gain: p.A, rin: p.Rin, rout: p.Rout },
      { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL },
    ],
  })

  it('gives E2’s output, and its input divider, at the Elements defaults', () => {
    const p = { E: 0.01, Rs: 10000, Rin: 1e6, A: 1000, Rout: 50, RL: 1000 }
    const a = solveDC(discrete(p))
    const b = solveDC(asMacro(p))
    expect(b.v.out).toBeCloseTo(a.v.out, 12)
    expect(b.v.p).toBeCloseTo(a.v.p, 12)
    // The reading E2's note quotes, from the divider it names.
    const vp = (p.E * p.Rin) / (p.Rs + p.Rin)
    expect(b.v.out).toBeCloseTo((p.A * vp * p.RL) / (p.Rout + p.RL), 9)
  })

  it('agrees at 40 random settings of every knob', () => {
    let s = 12345
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32)
    for (let k = 0; k < 40; k++) {
      const p = {
        E: -1 + 2 * rnd(),
        Rs: 10 * 10 ** (4 * rnd()),
        Rin: 1e4 * 10 ** (3 * rnd()),
        A: 10 * 10 ** (4 * rnd()),
        Rout: 1 * 10 ** (3 * rnd()),
        RL: 10 * 10 ** (4 * rnd()),
      }
      const a = solveDC(discrete(p))
      const b = solveDC(asMacro(p))
      expect(Math.abs(b.v.out - a.v.out)).toBeLessThanOrEqual(1e-9 * Math.abs(a.v.out) + 1e-15)
      expect(b.maxResidual).toBeLessThan(1e-9 * (1 + Math.abs(a.v.out)))
    }
  })
})

describe('the pole, and the gain-bandwidth product', () => {
  /** The −3 dB frequency of the closed loop, by bisection on |v_out(f)|. */
  const corner = (net) => {
    const H = (f) => cabs(solveAC(net, 2 * Math.PI * f, { anyFreq: true }).v.out)
    const low = H(1e-3)
    return 10 ** bisect((x) => H(10 ** x) - low / Math.SQRT2, -3, 9, 0)
  }
  const acAmp = (over, p = {}) => amp(over, { ...p, wave: { kind: 'sine', amp: 1e-3, freq: 1000 } })

  it('puts the closed-loop pole at f_p(1 + A₀β) at three gains', () => {
    const A0 = DEFAULTS.gain
    const fp = DEFAULTS.gbw / A0
    for (const [Rf, Rg] of [
      [10000, 1000],
      [100000, 1000],
      [1000, 1000],
    ]) {
      const G = 1 + Rf / Rg
      const want = fp * (1 + A0 / G)
      expect(corner(acAmp(only(['gain', 'gbw']), { Rf, Rg }))).toBeCloseTo(want, 3)
    }
  })

  it('holds the product G·f_3dB at f_t + G·f_p, which is not quite f_t', () => {
    const fp = DEFAULTS.gbw / DEFAULTS.gain
    for (const [Rf, G] of [
      [10000, 11],
      [100000, 101],
      [1000, 2],
    ]) {
      const product = G * corner(acAmp(only(['gain', 'gbw']), { Rf }))
      expect(product).toBeCloseTo(DEFAULTS.gbw + G * fp, 2)
      // The textbook's "constant gain-bandwidth product" is the same number
      // with the open-loop pole dropped, and it is low by G·f_p.
      expect(product - DEFAULTS.gbw).toBeCloseTo(G * fp, 6)
    }
  })

  it('is a plain amplifier with no pole at all when the speed is left off', () => {
    const net = acAmp(only(['gain']))
    const lo = cabs(solveAC(net, 2 * Math.PI * 1e-3, { anyFreq: true }).v.out)
    const hi = cabs(solveAC(net, 2 * Math.PI * 1e9, { anyFreq: true }).v.out)
    expect(hi).toBeCloseTo(lo, 12)
  })
})

describe('the slew rate is a current limit, solved exactly', () => {
  const step = (to) => {
    const net = amp(only(['gain', 'vsat', 'gbw', 'slew']), { RL: 1000 })
    net.elements[0] = { type: 'V', id: 'V1', nodes: ['in', 'gnd'], wave: { kind: 'step', from: 0, to } }
    return net
  }

  it('ramps at I_max/C, which is the slew rate, and droops by the compensation resistor', () => {
    const w = pwlTransient(step(10 / 11), { tEnd: 40e-6, points: 2001 })
    const v = (t) => w.at(t).sol.v.out
    // The limited stage charges C through the pole resistor as well, so the
    // exact slope at output v is SR(1 − v/V∞) with V∞ = I_max·R = SR/(2π f_p).
    const fp = DEFAULTS.gbw / DEFAULTS.gain
    const vInf = DEFAULTS.slew / (2 * Math.PI * fp)
    const slope = (v(11e-6) - v(1e-6)) / 10e-6
    const mid = (v(11e-6) + v(1e-6)) / 2
    expect(slope).toBeCloseTo(DEFAULTS.slew * (1 - mid / vInf), -1)
    // Within a part in a thousand of the datasheet figure, and the shortfall
    // is the droop, not an error of the solve.
    expect(Math.abs(slope / DEFAULTS.slew - 1)).toBeLessThan(1e-3)
  })

  it('leaves the limit once the loop catches up, and the event says when', () => {
    const w = pwlTransient(step(10 / 11), { tEnd: 40e-6, points: 2001 })
    expect(w.events.length).toBe(1)
    expect(w.events[0].id).toBe('U1.G')
    expect(w.events[0].from).toBe('ipos')
    expect(w.events[0].to).toBe('linear')
    // Ten volts at half a volt per microsecond, give or take the droop.
    expect(w.events[0].t).toBeGreaterThan(18e-6)
    expect(w.events[0].t).toBeLessThan(21e-6)
    // It settles where the same circuit settles at DC, which is 10 V less
    // what the finite gain costs.
    expect(w.at(40e-6).sol.v.out).toBeCloseTo(dc(amp(only(['gain', 'vsat']), { E: 10 / 11, RL: 1000 })).v.out, 5)
  })

  it('takes no limited region at all when the step is small enough', () => {
    const w = pwlTransient(step(0.001), { tEnd: 40e-6, points: 601 })
    expect(w.events.length).toBe(0)
  })
})

describe('offset, bias current, rejection and the output’s limits', () => {
  it('puts A₀V_OS/(1 + A₀β) at the output with nothing applied', () => {
    const A0 = DEFAULTS.gain
    for (const [Rf, Rg] of [
      [10000, 1000],
      [100000, 1000],
      [1000, 1000],
    ]) {
      const beta = Rg / (Rf + Rg)
      const got = dc(amp(only(['gain', 'vsat', 'rout', 'vos']), { Rf, Rg })).v.out
      expect(got).toBeCloseTo((A0 * DEFAULTS.vos) / (1 + A0 * beta), 5)
    }
  })

  it('makes I_B·R_f of output, and a balancing resistor cancels it exactly', () => {
    const bias = (rp) => ({
      elements: [
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['p', 'n'], gain: DEFAULTS.gain, vsat: DEFAULTS.vsat, ib: DEFAULTS.ib },
        { type: 'R', id: 'Rp', nodes: ['p', 'gnd'], value: rp },
        { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: 10000 },
        { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: 100000 },
      ],
    })
    // I_B·R_f, within the two parts in ten thousand the finite loop gain costs.
    expect(dc(bias(1)).v.out / (DEFAULTS.ib * 100000)).toBeCloseTo(1, 3)
    // R_f ∥ R_g in the other input puts the same drop on both, and the
    // difference the amplifier reads is zero.
    expect(Math.abs(dc(bias((100000 * 10000) / 110000)).v.out)).toBeLessThan(1e-12)
  })

  it('turns a common-mode input into an input error of v_cm/CMRR', () => {
    const follower = (over) => ({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 5 },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'out'], gain: DEFAULTS.gain, vsat: DEFAULTS.vsat, ...over },
        { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: 10000 },
      ],
    })
    const error = dc(follower({ cmrr: DEFAULTS.cmrr })).v.out - dc(follower({})).v.out
    expect(error).toBeCloseTo(5 / 10 ** (DEFAULTS.cmrr / 20), 9)
  })

  it('clips at I_max times what the output sees, well short of the rail', () => {
    const RL = 100
    const p = solvePWL(amp(only(['gain', 'vsat', 'imax']), { E: 1, RL }))
    expect(p.regions.U1).toBe('ipos')
    // The load and the feedback network share the limited current.
    const seen = (RL * 11000) / (RL + 11000)
    expect(p.sol.v.out).toBeCloseTo(DEFAULTS.imax * seen, 9)
    expect(p.sol.i.U1).toBeCloseTo(-DEFAULTS.imax, 12)
    // Without the limit the same drive reaches the gain the resistors set.
    expect(solvePWL(amp(only(['gain', 'vsat']), { E: 1, RL })).sol.v.out).toBeCloseTo(11, 2)
    // And it clips symmetrically the other way.
    expect(solvePWL(amp(only(['gain', 'vsat', 'imax']), { E: -1, RL })).sol.v.out).toBeCloseTo(-DEFAULTS.imax * seen, 9)
  })

  it('still cannot pass a rail when the current limit is the looser of the two', () => {
    const p = solvePWL(amp({ gain: 1e5, vsat: 12, imax: 1 }, { E: 5, RL: 100000 }))
    expect(p.regions.U1).toBe('high')
    expect(p.sol.v.out).toBeCloseTo(12, 12)
  })

  it('refuses a macro whose current limit reads a branch that has none', () => {
    expect(
      () =>
        normalize({
          elements: [{ type: 'CCCS', id: 'F1', nodes: ['a', 'gnd'], gain: 100 }],
        }),
    ).toThrow(NetworkError)
  })
})
