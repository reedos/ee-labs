import { describe, it, expect } from 'vitest'
import { CHECK_TOL, compare, corners, evalTF, polesOf, rootsOf, transferOf, zerosOf } from './transfer.js'
import { blackman, marginsOf, returnRatio, returnRatioAt } from './loop.js'
import { smallSignal } from './smallSignal.js'
import { newtonDC } from './pwl.js'
import { solveAC } from './phasor.js'
import { NetworkError } from './netlist.js'
import { bisect } from './transient.js'
import { cabs, csub } from './complex.js'

// H(s) as polynomials, and the loop gain read off it. Every pole here is a
// number the recurrence produced, checked against the phasor solve at 241
// points before it was returned.

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

describe('L1: the loop, broken', () => {
  /** The non-inverting amplifier on a plain controlled source. */
  const amp = (A = 1e5, Rf = 9000, Rg = 1000) => ({
    elements: [
      { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 1 },
      { type: 'VCVS', id: 'E1', nodes: ['out', 'gnd'], ctrl: ['in', 'n'], gain: A },
      { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: Rf },
      { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: Rg },
    ],
  })

  it('gives T = A₀β, and the closed-loop gain A/(1 + T)', () => {
    const T = returnRatioAt(amp(), 'E1')[0]
    expect(T).toBeCloseTo(1e5 * 0.1, 6)
    const b = blackman(amp(), 'E1', { input: 'V1', output: 'out' })
    expect(b.Ainf[0]).toBeCloseTo(10, 9)
    expect(b.d[0]).toBeCloseTo(0, 12)
    expect(b.closed[0]).toBeCloseTo(9.999, 3)
  })

  it('closes to floating point: Blackman’s form is the direct solve', () => {
    for (const [A, Rf, Rg] of [
      [1e5, 9000, 1000],
      [1e3, 10000, 1000],
      [1e6, 1000, 1000],
      [50, 9000, 1000],
    ]) {
      const b = blackman(amp(A, Rf, Rg), 'E1', { input: 'V1', output: 'out' })
      expect(Math.abs(b.closed[0] / b.direct[0] - 1), `A = ${A}`).toBeLessThan(1e-9)
      // A_∞ came from two other gains and T from the broken loop, so the
      // agreement is a check of both rather than an identity.
      expect(Math.abs(b.fromGains[0] / b.T[0] - 1), `T at A = ${A}`).toBeLessThan(1e-6)
      expect(b.Ainf[0]).toBeCloseTo(1 + Rf / Rg, 6)
    }
  })

  it('halves the loop gain and moves the closed loop by a part in ten thousand', () => {
    const full = blackman(amp(1e5), 'E1', { input: 'V1', output: 'out' })
    const half = blackman(amp(5e4), 'E1', { input: 'V1', output: 'out' })
    const change = Math.abs(half.direct[0] / full.direct[0] - 1)
    expect(change).toBeGreaterThan(0.5e-4)
    expect(change).toBeLessThan(1.5e-4)
    // Desensitivity: the closed loop moves by 1/(1 + T) of what A moved by.
    expect(change).toBeCloseTo(0.5 / (1 + full.T[0] / 2), 6)
  })

  it('declines to break the loop at an ideal op-amp, and says why', () => {
    const ideal = {
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 1 },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'n'] },
        { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: 9000 },
        { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: 1000 },
      ],
    }
    expect(() => returnRatioAt(ideal, 'U1')).toThrow(/infinite/)
    expect(() => returnRatioAt(ideal, 'Rf')).toThrow(/controlled source/)
  })
})

describe('L3: gain-bandwidth from the loop’s side', () => {
  /** A single-pole amplifier written out, so its loop can be broken at the transconductance. */
  const paced = (Rf = 10000, Rg = 1000, A0 = 1e5, ft = 1e6) => {
    const rint = 1e6
    const g = A0 / rint
    return {
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: { kind: 'sine', amp: 1, freq: 1000 } },
        { type: 'VCCS', id: 'G1', nodes: ['gnd', 'x'], ctrl: ['in', 'n'], gain: g },
        { type: 'R', id: 'Rp', nodes: ['x', 'gnd'], value: rint },
        { type: 'C', id: 'Cp', nodes: ['x', 'gnd'], value: g / (2 * Math.PI * ft) },
        { type: 'VCVS', id: 'E1', nodes: ['out', 'gnd'], ctrl: ['x', 'gnd'], gain: 1 },
        { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: Rf },
        { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: Rg },
      ],
    }
  }

  it('gives T(s) one pole, at f_p, with T(0) = A₀β', () => {
    const T = returnRatio(paced(), 'G1')
    expect(T.check).toBeLessThan(CHECK_TOL)
    expect(polesOf(T)[0].hz).toBeCloseTo(10, 6)
    expect(evalTF(T, [0, 1e-9])[0]).toBeCloseTo(1e5 / 11, 3)
  })

  it('puts the closed-loop pole at (1 + T)f_p at three gains', () => {
    for (const [Rf, G] of [
      [10000, 11],
      [100000, 101],
      [1000, 2],
    ]) {
      const T = returnRatio(paced(Rf), 'G1')
      const T0 = evalTF(T, [0, 1e-9])[0]
      const closed = transferOf(paced(Rf), { input: 'V1', output: 'out' })
      expect(polesOf(closed)[0].hz).toBeCloseTo((1 + T0) * 10, 2)
      expect(polesOf(closed)[0].hz).toBeCloseTo(10 * (1 + 1e5 / G), 2)
    }
  })

  it('reads a crossover and a phase margin off the loop gain', () => {
    const T = returnRatio(paced(), 'G1')
    const m = marginsOf((f) => evalTF(T, [0, 2 * Math.PI * f]))
    // One pole: the crossover is where |T| = 1, and a single pole can only
    // ever cost 90°, so the margin is nearly the whole 90.
    expect(m.crossover / 1e3).toBeCloseTo(90.909, 2)
    expect(m.pm).toBeGreaterThan(89.9)
    expect(m.pm).toBeLessThan(90.01)
  })

  it('agrees with the phasor solve at the crossover, so T is measurable there', () => {
    const T = returnRatio(paced(), 'G1')
    const f = 90.909e3
    const fromPoly = evalTF(T, [0, 2 * Math.PI * f])
    const fromSolve = returnRatioAt(paced(), 'G1', 2 * Math.PI * f)
    expect(cabs(csub(fromPoly, fromSolve)) / cabs(fromSolve)).toBeLessThan(1e-9)
  })
})
