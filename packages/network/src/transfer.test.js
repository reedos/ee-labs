import { describe, it, expect } from 'vitest'
import { CHECK_TOL, compare, corners, evalTF, polesOf, rootsOf, transferOf, zerosOf } from './transfer.js'
import { smallSignal } from './smallSignal.js'
import { newtonDC } from './pwl.js'
import { NetworkError } from './netlist.js'
import { bisect } from './transient.js'
import { VT } from './physics.js'

// H(s) as polynomials. Every pole here is a number the recurrence produced,
// checked against the phasor solve at 241 points before it was returned. The
// loop gain read off the same polynomials is in loop.test.js.

describe('transferOf, against the polynomials written by hand', () => {
  it('gives the RC low-pass exactly, coefficient for coefficient', () => {
    for (const [R, C] of [
      [1000, 1e-6],
      [4700, 22e-9],
      [1e6, 1e-12],
    ]) {
      const tf = transferOf(
        {
          elements: [
            { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 1 },
            { type: 'R', id: 'R1', nodes: ['in', 'out'], value: R },
            { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: C },
          ],
        },
        { input: 'V1', output: 'out' },
      )
      expect(tf.a.length).toBe(2)
      expect(tf.a[0]).toBe(1)
      expect(tf.a[1]).toBeCloseTo(1 / (R * C), 6)
      expect(tf.b[0] / tf.a[1]).toBeCloseTo(1, 12)
      expect(tf.check).toBeLessThan(CHECK_TOL)
      expect(polesOf(tf)[0].hz).toBeCloseTo(1 / (2 * Math.PI * R * C), 6)
    }
  })

  it('gives the series RLC across its capacitor the hand polynomial', () => {
    const [R, L, C] = [50, 1e-3, 1e-6]
    const net = {
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 1 },
        { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: R },
        { type: 'L', id: 'L1', nodes: ['n1', 'out'], value: L },
        { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: C },
      ],
    }
    const tf = transferOf(net, { input: 'V1', output: 'out' })
    // s² + (R/L)s + 1/LC, and the numerator 1/LC.
    expect(tf.a[1]).toBeCloseTo(R / L, 6)
    expect(tf.a[2]).toBeCloseTo(1 / (L * C), 3)
    expect(tf.b[0]).toBeCloseTo(1 / (L * C), 3)
    // Across the resistor instead, the numerator gains a zero at the origin.
    // (R/L)s over the same denominator: one zero, at the origin, and the
    // leading zero coefficient is trimmed so the degree says so.
    const across = transferOf(net, { input: 'V1', output: { across: ['in', 'n1'] } })
    expect(across.b.length).toBe(2)
    expect(across.b[0]).toBeCloseTo(R / L, 6)
    expect(across.b[1]).toBeCloseTo(0, 6)
    expect(across.a).toEqual(tf.a)
  })

  it('reads a current as an output as readily as a voltage', () => {
    const tf = transferOf(
      {
        elements: [
          { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 1 },
          { type: 'R', id: 'R1', nodes: ['in', 'out'], value: 1000 },
          { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: 1e-6 },
        ],
      },
      { input: 'V1', output: { through: 'R1' } },
    )
    // i = v_in/(R + 1/sC) = (s/R)/(s + 1/RC).
    expect(tf.b[0]).toBeCloseTo(1 / 1000, 9)
    expect(tf.b[1]).toBeCloseTo(0, 9)
    expect(tf.a[1]).toBeCloseTo(1000, 6)
  })

  it('is a bare number when the circuit has no state at all', () => {
    const tf = transferOf(
      {
        elements: [
          { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 1 },
          { type: 'R', id: 'R1', nodes: ['in', 'out'], value: 1000 },
          { type: 'R', id: 'R2', nodes: ['out', 'gnd'], value: 3000 },
        ],
      },
      { input: 'V1', output: 'out' },
    )
    expect(tf.a).toEqual([1])
    expect(tf.b[0]).toBeCloseTo(0.75, 12)
  })

  it('names what is wrong when the input is not a source of this circuit', () => {
    expect(() =>
      transferOf({ elements: [{ type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 1 }, { type: 'R', id: 'R1', nodes: ['in', 'gnd'], value: 1 }] }, { input: 'V9', output: 'in' }),
    ).toThrow(/not an independent source/)
  })
})

describe('invariant 3: the polynomials agree with the points', () => {
  const nets = [
    {
      name: 'RC',
      net: {
        elements: [
          { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 1 },
          { type: 'R', id: 'R1', nodes: ['in', 'out'], value: 2200 },
          { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: 47e-9 },
        ],
      },
      output: 'out',
    },
    {
      name: 'RLC',
      net: {
        elements: [
          { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 1 },
          { type: 'R', id: 'R1', nodes: ['in', 'n1'], value: 22 },
          { type: 'L', id: 'L1', nodes: ['n1', 'out'], value: 4.7e-3 },
          { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: 10e-9 },
        ],
      },
      output: 'out',
    },
    {
      name: 'two cascaded sections',
      net: {
        elements: [
          { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 1 },
          { type: 'R', id: 'R1', nodes: ['in', 'a'], value: 1000 },
          { type: 'C', id: 'C1', nodes: ['a', 'gnd'], value: 100e-9 },
          { type: 'R', id: 'R2', nodes: ['a', 'out'], value: 10000 },
          { type: 'C', id: 'C2', nodes: ['out', 'gnd'], value: 1e-9 },
        ],
      },
      output: 'out',
    },
  ]

  it('holds at 241 points from 1 to 10⁹ rad/s on every library shape', () => {
    for (const { name, net, output } of nets) {
      const tf = transferOf(net, { input: 'V1', output })
      expect(tf.check, name).toBeLessThan(CHECK_TOL)
      expect(compare(net, tf, { input: 'V1', output }), name).toBe(tf.check)
    }
  })

  it('holds for the CE stage with both device capacitances in', () => {
    const { net, ss } = ceStage()
    const tf = transferOf({ elements: ss.elements }, { input: 'Vs', output: 'c' })
    expect(tf.check).toBeLessThan(CHECK_TOL)
    expect(tf.states).toEqual(['Q1.cpi', 'Q1.cmu'])
  })

  it('refuses a set of polynomials that does not survive its own check', () => {
    const { ss } = ceStage()
    const tf = transferOf({ elements: ss.elements }, { input: 'Vs', output: 'c' })
    // The refusal is real: hand it a set that has drifted and it declines.
    const drifted = { ...tf, a: tf.a.map((v, i) => (i === 1 ? v * 1.0001 : v)) }
    expect(compare({ elements: ss.elements }, drifted, { input: 'Vs', output: 'c' })).toBeGreaterThan(CHECK_TOL)
    expect(() => transferOf({ elements: ss.elements }, { input: 'Vs', output: 'c', tol: 1e-18 })).toThrow(NetworkError)
    expect(() => transferOf({ elements: ss.elements }, { input: 'Vs', output: 'c', tol: 1e-18 })).toThrow(/transfer|recurrence|digits/)
  })
})

/** The plan's CE stage at 1 mA, and its small-signal netlist with the capacitances in. */
function ceStage(over = {}) {
  const make = (vs) => ({
    elements: [
      { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
      { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: 5000 },
      { type: 'V', id: 'Vs', nodes: ['s', 'gnd'], value: vs, small: true },
      { type: 'R', id: 'Rs', nodes: ['s', 'b'], value: 1000 },
      { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'gnd'], model: 'exp', beta: 100, va: 100, cpi: 20e-12, cmu: 2e-12, ...over },
    ],
  })
  const vs = bisect((v) => newtonDC(make(v)).sol.i.RC - 1e-3, 0.4, 1.5, 0)
  const net = make(vs)
  return { net, vs, op: newtonDC(net), ss: smallSignal(net, newtonDC(net), { caps: true }) }
}

/**
 * The hybrid-π a textbook writes for the plan's stage, drawn as a netlist by
 * hand: g_m = I_C/V_T at exactly 1 mA, r_π = β/g_m, and r_o = V_A/I_C with the
 * collector voltage dropped, which is the rounding every course makes. It is
 * the circuit the brief's §3.4 contract quotes its poles for, and it is not
 * quite the tangent the engine takes of the exponential device (that one
 * carries r_o = (V_A + V_CE)/I_C, and its poles are a per cent away).
 */
function handHybridPi({ ic = 1e-3, beta = 100, va = 100, rc = 5000, rs = 1000, cpi = 20e-12, cmu = 2e-12 } = {}) {
  const gm = ic / VT
  return {
    gm,
    rpi: beta / gm,
    ro: va / ic,
    elements: [
      { type: 'V', id: 'Vs', nodes: ['s', 'gnd'], value: 1, small: true },
      { type: 'R', id: 'Rs', nodes: ['s', 'b'], value: rs },
      { type: 'R', id: 'rpi', nodes: ['b', 'gnd'], value: beta / gm },
      { type: 'C', id: 'cpi', nodes: ['b', 'gnd'], value: cpi },
      { type: 'C', id: 'cmu', nodes: ['b', 'c'], value: cmu },
      { type: 'VCCS', id: 'gm', nodes: ['c', 'gnd'], ctrl: ['b', 'gnd'], gain: gm },
      { type: 'R', id: 'ro', nodes: ['c', 'gnd'], value: va / ic },
      { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: rc },
      { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 0 },
    ],
  }
}

// The brief's §3.4 contract, in the numbers it states: the CE stage with
// C_π = 20 pF, C_μ = 2 pF and R_s = 1 kΩ has poles at 547.76 kHz and
// 336.69 MHz and a zero at 3.0782 GHz. Each is checked against the hand
// expression it comes from as well as against the figure, so the contract is
// a claim about the circuit rather than three constants.
describe('the contract: the CE stage’s poles, to five figures', () => {
  it('gives 547.76 kHz, 336.69 MHz and a zero at 3.0782 GHz', () => {
    const hand = handHybridPi()
    const tf = transferOf({ elements: hand.elements }, { input: 'Vs', output: 'c' })
    expect(tf.check).toBeLessThan(CHECK_TOL)
    const poles = polesOf(tf)
      .map((p) => p.hz)
      .sort((a, b) => a - b)
    const zeros = zerosOf(tf)
    expect(poles.length).toBe(2)
    expect(poles[0] / 1e3).toBeCloseTo(547.76, 2)
    expect(poles[1] / 1e6).toBeCloseTo(336.69, 2)
    expect(zeros.length).toBe(1)
    expect(zeros[0].hz / 1e9).toBeCloseTo(3.0782, 4)
    expect(zeros[0].hz).toBeCloseTo(hand.gm / (2 * Math.PI * 2e-12), 6)

    // The same two poles from the quadratic a hand analysis writes: the two
    // resistances the capacitances see, and the Miller term between them.
    const R1 = (1000 * hand.rpi) / (1000 + hand.rpi)
    const RL = (5000 * hand.ro) / (5000 + hand.ro)
    const b1 = 20e-12 * R1 + 2e-12 * (R1 + RL + hand.gm * R1 * RL)
    const b2 = 20e-12 * 2e-12 * R1 * RL
    const disc = Math.sqrt(b1 * b1 - 4 * b2)
    expect(poles[0]).toBeCloseTo((b1 - disc) / (2 * b2) / (2 * Math.PI), 3)
    expect(poles[1]).toBeCloseTo((b1 + disc) / (2 * b2) / (2 * Math.PI), 0)
    // The midband gain the plan quotes as −184 is the same three numbers.
    // The midband gain the plan quotes as −184 is the same three numbers:
    // the divider into r_π, then g_m into R_C ∥ r_o.
    const av = evalTF(tf, [0, 1e-9])[0]
    expect(av).toBeCloseTo(-hand.gm * RL * (hand.rpi / (1000 + hand.rpi)), 6)
    expect(av).toBeCloseTo(-132.82, 2)
    // From the base rather than from the source it is the plan's −184.2, which
    // is g_m times the collector's load and nothing else.
    expect(-hand.gm * RL).toBeCloseTo(-184.2, 1)
  })

  it('makes the Miller estimate 3.2 % high and the time-constant sum 0.16 % low', () => {
    const hand = handHybridPi()
    const tf = transferOf({ elements: hand.elements }, { input: 'Vs', output: 'c' })
    const exact = Math.min(...polesOf(tf).map((p) => p.hz))
    const R1 = (1000 * hand.rpi) / (1000 + hand.rpi)
    const RL = (5000 * hand.ro) / (5000 + hand.ro)
    const cin = 20e-12 + 2e-12 * (1 + hand.gm * RL)
    const miller = 1 / (2 * Math.PI * R1 * cin)
    const octc = 1 / (2 * Math.PI * (20e-12 * R1 + 2e-12 * (R1 + RL + hand.gm * R1 * RL)))
    expect(cin * 1e12).toBeCloseTo(390.4, 1)
    expect(miller / 1e3).toBeCloseTo(565.37, 1)
    expect(miller / exact - 1).toBeCloseTo(0.0321, 3)
    expect(octc / 1e3).toBeCloseTo(546.87, 1)
    expect(octc / exact - 1).toBeCloseTo(-0.00162, 4)
  })
})

describe('K3: the Miller effect, and the estimate’s error', () => {
  it('puts the exact poles where the state space says, and the zero at g_m/C_μ', () => {
    const { ss } = ceStage()
    const tf = transferOf({ elements: ss.elements }, { input: 'Vs', output: 'c' })
    const poles = polesOf(tf).map((p) => p.hz).sort((a, b) => a - b)
    const zeros = zerosOf(tf)
    const p = ss.point.Q1
    expect(poles[0] / 1e3).toBeCloseTo(539.55, 1)
    expect(poles[1] / 1e6).toBeCloseTo(336.51, 1)
    // The zero is where the feed-forward through C_μ cancels the collector
    // current: at g_m/C_μ, and nowhere else.
    expect(zeros.length).toBe(1)
    expect(zeros[0].hz).toBeCloseTo(p.gm / (2 * Math.PI * 2e-12), 0)
    expect(zeros[0].hz / 1e9).toBeCloseTo(3.0782, 3)
    expect(zeros[0].re).toBeGreaterThan(0) // in the right half plane
  })

  it('makes the Miller estimate 3.2 % high, and says so', () => {
    const { ss } = ceStage()
    const tf = transferOf({ elements: ss.elements }, { input: 'Vs', output: 'c' })
    const p = ss.point.Q1
    const RL = (5000 * p.ro) / (5000 + p.ro)
    const cin = 20e-12 + 2e-12 * (1 + p.gm * RL)
    const rin = (1000 * p.rpi) / (1000 + p.rpi)
    const estimate = 1 / (2 * Math.PI * rin * cin)
    const exact = Math.min(...polesOf(tf).map((q) => q.hz))
    expect(cin * 1e12).toBeCloseTo(391.2, 1)
    expect(estimate / 1e3).toBeCloseTo(556.67, 1)
    expect(estimate / exact - 1).toBeCloseTo(0.0317, 3)
  })

  it('reads the −3 dB corner off the polynomials, and it is the dominant pole', () => {
    const { ss } = ceStage()
    const tf = transferOf({ elements: ss.elements }, { input: 'Vs', output: 'c' })
    const c = corners(tf, { at: 2 * Math.PI * 1000 })
    expect(c.low).toBe(null) // no coupling capacitor: it goes down to DC
    expect(c.high / 1e3).toBeCloseTo(539.55, 1)
    expect(c.band).toBeCloseTo(134.915, 2)
  })
})

describe('the roots the polynomials are read with', () => {
  it('finds roots spread over nine decades', () => {
    // (s + 10)(s + 10⁴)(s + 10⁹), expanded.
    const a = [1, 10 + 1e4 + 1e9, 10 * 1e4 + 10 * 1e9 + 1e4 * 1e9, 10 * 1e4 * 1e9]
    const got = rootsOf(a)
      .map((r) => -r[0])
      .sort((x, y) => x - y)
    expect(got[0]).toBeCloseTo(10, 4)
    expect(got[1] / 1e4).toBeCloseTo(1, 6)
    expect(got[2] / 1e9).toBeCloseTo(1, 9)
  })

  it('finds a complex pair, and roots at the origin', () => {
    const pair = rootsOf([1, 2, 5]) // s² + 2s + 5: −1 ± 2j
    expect(pair.length).toBe(2)
    expect(pair.map((r) => r[0])).toEqual([expect.closeTo(-1, 9), expect.closeTo(-1, 9)])
    expect(pair.map((r) => Math.abs(r[1])).sort()).toEqual([expect.closeTo(2, 9), expect.closeTo(2, 9)])
    const withOrigin = rootsOf([1, 3, 0])
    expect(withOrigin.length).toBe(2)
    expect(withOrigin.some((r) => Math.abs(r[0]) < 1e-12 && Math.abs(r[1]) < 1e-12)).toBe(true)
  })
})
