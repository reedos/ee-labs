import { describe, it, expect } from 'vitest'
import { blackman, marginsOf, returnRatio, returnRatioAt } from './loop.js'
import { CHECK_TOL, evalTF, polesOf, transferOf } from './transfer.js'
import { solveDC } from './mna.js'
import { cabs, csub } from './complex.js'

// The loop gain, by breaking the loop.
//
// Two things are measured here. That the return ratio is the number a
// designer measures, A₀β for a resistive loop, read by driving one side of
// one controlled source and reading what comes back. And that Blackman's
// form, A_∞·T/(1 + T) + d, is the direct solve of the same circuit, so the
// decomposition is a way of reading the answer rather than a second answer.

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

  // The brief's §3.5 contract, stated in the numbers it states them in: the
  // plan's op-amp at A₀ = 10⁵ in a divider of β = 0.1 has a return ratio of
  // exactly 10⁴, and the gain a reader would call ten is 9.9990. Both are
  // computed from A₀ and the two resistors rather than typed in, and the
  // second is checked against the direct solve of the same circuit.
  it('is T = 10⁴ and a closed-loop gain of 9.9990 at the plan’s numbers', () => {
    const A0 = 1e5
    const Rf = 9000
    const Rg = 1000
    const beta = Rg / (Rf + Rg)
    const net = amp(A0, Rf, Rg)
    const T = returnRatioAt(net, 'E1')[0]
    expect(T).toBeCloseTo(A0 * beta, 6)
    expect(T / 1e4).toBeCloseTo(1, 9)

    const b = blackman(net, 'E1', { input: 'V1', output: 'out' })
    const closed = A0 / (1 + A0 * beta)
    expect(b.closed[0]).toBeCloseTo(closed, 9)
    expect(+b.closed[0].toFixed(4)).toBe(9.999)
    // The direct solve is the same circuit with nothing broken, driven by one
    // volt: the same number to floating point.
    expect(b.closed[0] / solveDC(net).v.out - 1).toBeLessThan(1e-12)
    expect(b.direct[0]).toBeCloseTo(solveDC(net).v.out, 12)
    // A_∞ is the gain the loop would give with T infinite, which is the
    // divider inverted, and the shortfall from it is exactly 1/(1 + T).
    expect(1 - b.closed[0] / b.Ainf[0]).toBeCloseTo(1 / (1 + T), 9)
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
