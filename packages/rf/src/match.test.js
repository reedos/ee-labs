import { describe, it, expect } from 'vitest'
import { complex as cx } from '@ee-labs/network'
import { RfError } from './const.js'
import { reflection, s11FromNetlist } from './sparam.js'
import { inputImpedance } from './line.js'
import {
  bandwidthOf,
  elementFor,
  inputZ,
  lMatch,
  lSolutions,
  loadedQBandwidth,
  matchAt,
  matchBandwidth,
  matchMag,
  matchNetlist,
  matchQ,
  networkAbcd,
  quarterWaveMatch,
  quarterWaveRepeats,
  reactanceOf,
  sweepMatch,
} from './match.js'

// The synthesis, against the closed form written out again.
//
// Every expected value below is recomputed from the knobs in the test rather
// than typed as a constant, which is `PROGRAM.md` §6's rule. Where a number is
// written down it is a ratio the algebra fixes exactly: the geometric mean of
// 50 and 100 is 70.7107, and the square root of two is where the 50 to 100 L
// network's standing-wave ratio reaches 2.

const { cabs } = cx

const F0 = 1e9
const W0 = 2 * Math.PI * F0
const near = (got, want, tol = 1e-12) => Math.abs(got - want) <= tol * Math.max(1, Math.abs(want))

describe('the reactance a component has, and the component a reactance asks for', () => {
  it('a positive reactance is an inductor and a negative one is a capacitor', () => {
    for (const X of [1, 12.5, 50, 1000]) {
      const up = elementFor(X, F0)
      expect(up.kind).toBe('L')
      expect(near(up.value, X / W0)).toBe(true)
      expect(near(reactanceOf('L', up.value, F0), X)).toBe(true)
      const down = elementFor(-X, F0)
      expect(down.kind).toBe('C')
      expect(near(down.value, 1 / (W0 * X))).toBe(true)
      expect(near(reactanceOf('C', down.value, F0), -X)).toBe(true)
    }
  })

  it('a reactance of zero is a wire, and an element kind this module does not build is refused', () => {
    expect(elementFor(0, F0).kind).toBe('wire')
    expect(() => reactanceOf('varactor', 1e-12, F0)).toThrow(/inductors and capacitors/)
  })
})

describe('the L network, in closed form', () => {
  const RS = 50
  const RL = 100
  const m = lMatch({ RS, ZL: RL, f: F0 })

  it('the Q is the square root of the transformation ratio less one', () => {
    expect(near(m.Q, Math.sqrt(RL / RS - 1))).toBe(true)
    expect(near(m.Q, matchQ(RS, RL))).toBe(true)
    // 100 over 50 is 2, so this Q is exactly one.
    expect(near(m.Q, 1)).toBe(true)
  })

  it('the two element values are the closed form, recomputed here from the knobs', () => {
    const Q = Math.sqrt(RL / RS - 1)
    const series = m.chosen.elements.find((e) => e.place === 'series')
    const shunt = m.chosen.elements.find((e) => e.place === 'shunt')
    expect(series.kind).toBe('L')
    expect(shunt.kind).toBe('C')
    // X_series = Q R_low, so L = Q R_low / omega.
    expect(near(series.value, (Q * RS) / W0)).toBe(true)
    // X_parallel = R_high / Q, so C = Q / (omega R_high).
    expect(near(shunt.value, Q / (W0 * RL))).toBe(true)
  })

  it('the synthesised network is matched at the design frequency, to floating point', () => {
    expect(m.at.mag).toBeLessThan(1e-12)
    expect(near(m.at.Z[0], RS, 1e-12)).toBe(true)
    expect(Math.abs(m.at.Z[1])).toBeLessThan(1e-12 * RS)
    expect(near(m.at.vswr, 1, 1e-12)).toBe(true)
  })

  it('a solve that shares nothing with the synthesis agrees that it is matched', () => {
    // `matchNetlist` builds the circuit and `s11FromNetlist` solves it with the
    // MNA solver. Nothing in that path uses the chain matrix the design was
    // written in, so the two routes are independent.
    for (const sol of m.ok) {
      const s11 = s11FromNetlist(matchNetlist(sol, RL, F0), 'p1', F0, { z0: RS })
      expect(cabs(s11), `${sol.id} solved`).toBeLessThan(1e-12)
    }
  })

  it('the enumeration holds four entries, two of which match this pair', () => {
    const all = lSolutions({ RS, ZL: RL, f: F0 })
    expect(all.solutions.length).toBe(4)
    expect(all.solutions.filter((s) => s.ok).length).toBe(2)
    for (const sol of all.solutions.filter((s) => !s.ok)) {
      expect(sol.orientation, 'the refused orientation').toBe('shunt-at-source')
      expect(sol.says).toMatch(/shunt element across the source/)
      expect(sol.says).toMatch(/50 ohms/)
      expect(sol.says).toMatch(/100 ohms/)
    }
  })

  it('both of the two that match really do match, and they differ away from the design frequency', () => {
    for (const sol of m.ok) expect(matchMag(sol, RL, RS, F0), sol.id).toBeLessThan(1e-12)
    const lowpass = m.ok.find((s) => s.id.endsWith('lowpass'))
    const highpass = m.ok.find((s) => s.id.endsWith('highpass'))
    // The low-pass network rejects the second harmonic and the high-pass one
    // passes it, and the two reflections at twice the design frequency are the
    // other one's at half of it.
    expect(matchMag(lowpass, RL, RS, 2 * F0)).toBeGreaterThan(matchMag(highpass, RL, RS, 2 * F0))
    expect(near(matchMag(lowpass, RL, RS, 2 * F0), matchMag(highpass, RL, RS, F0 / 2), 1e-9)).toBe(true)
  })

  it('a load below the source is matched by the other orientation, with the shunt across the source', () => {
    const down = lMatch({ RS: 50, ZL: 5, f: F0 })
    expect(down.chosen.orientation).toBe('shunt-at-source')
    expect(down.chosen.elements[0].place).toBe('shunt')
    expect(near(down.Q, Math.sqrt(50 / 5 - 1))).toBe(true)
    expect(down.at.mag).toBeLessThan(1e-12)
    for (const sol of down.solutions.filter((s) => !s.ok)) expect(sol.says).toMatch(/shunt element across the load/)
  })

  it('a source and a load that are already equal need one wire, and the module says so', () => {
    const same = lSolutions({ RS: 50, ZL: 50, f: F0 })
    expect(same.direct).toBe(true)
    expect(same.solutions[0].elements.length).toBe(0)
    expect(same.solutions[0].says).toMatch(/no transformation is needed/)
  })
})

describe('a complex load is absorbed, not approximated', () => {
  const RS = 50
  const ZL = [30, -40]
  const m = lMatch({ RS, ZL, f: F0 })

  it('the load reactance is cancelled by a series element of the opposite sign', () => {
    expect(near(m.cancel.X, 40)).toBe(true)
    expect(m.cancel.kind).toBe('L')
    expect(near(m.cancel.value, 40 / W0)).toBe(true)
  })

  it('the residue is the resistive case, so the Q comes from 30 and 50 ohms', () => {
    expect(near(m.Q, Math.sqrt(50 / 30 - 1))).toBe(true)
    expect(m.up).toBe(false)
  })

  it('the cancelling element and the network series element are one element', () => {
    // Both are in series and both sit beside the load, so the network has two
    // elements rather than three and the chart draws two arcs.
    const sol = m.chosen
    expect(sol.elements.length).toBe(2)
    const series = sol.elements.find((e) => e.place === 'series')
    expect(series.absorbed).toBe(true)
    const Q = Math.sqrt(50 / 30 - 1)
    expect(near(series.X, 40 + Q * 30)).toBe(true)
  })

  it('the first move lands on the residue and the second lands on the source', () => {
    const sol = m.chosen
    const series = sol.elements.find((e) => e.place === 'series')
    const Q = Math.sqrt(50 / 30 - 1)
    // The series element alone, applied to the load, leaves the resistance
    // where it was and the reactance at Q times it.
    const after = inputZ(networkAbcd([series], F0), ZL)
    expect(near(after[0], 30, 1e-9)).toBe(true)
    expect(near(after[1], Q * 30, 1e-9)).toBe(true)
    expect(m.at.mag).toBeLessThan(1e-12)
  })

  it('a purely reactive load is declined by name rather than matched', () => {
    expect(() => lSolutions({ RS: 50, ZL: [0, -40], f: F0 })).toThrow(RfError)
    try {
      lSolutions({ RS: 50, ZL: [0, -40], f: F0 })
    } catch (err) {
      expect(err.kind).toBe('reactive')
      expect(err.message).toMatch(/accepts none/)
    }
  })
})

describe('bandwidth is the price of the transformation', () => {
  const wide = lMatch({ RS: 50, ZL: 100, f: F0 }).chosen
  const narrow = lMatch({ RS: 5, ZL: 50, f: F0 }).chosen

  it('the loaded Q is the synthesis Q, and its own fractional bandwidth is one over it', () => {
    expect(near(loadedQBandwidth(1), 1)).toBe(true)
    expect(near(loadedQBandwidth(3), 1 / 3)).toBe(true)
  })

  it('the higher-Q match is the narrower one, measured on the exact response', () => {
    const a = matchBandwidth(wide, 100, 50, F0, { vswr: 1.5 })
    const b = matchBandwidth(narrow, 50, 5, F0, { vswr: 1.5 })
    expect(a.bounded && b.bounded).toBe(true)
    expect(a.fractional).toBeGreaterThan(b.fractional)
    // Both edges are crossings of the exact response, so re-reading them there
    // gives the target ratio back.
    for (const bw of [a, b]) {
      for (const f of [bw.lower, bw.upper]) {
        const sol = bw === a ? wide : narrow
        const mag = matchMag(sol, bw === a ? 100 : 50, bw === a ? 50 : 5, f)
        expect(near((1 + mag) / (1 - mag), 1.5, 1e-6), `${f}`).toBe(true)
      }
    }
  })

  it('the 50 to 100 network reaches a ratio of two at the square root of two times the design frequency', () => {
    const edge = matchBandwidth(wide, 100, 50, F0, { vswr: 2 })
    expect(edge.bounded).toBe(false)
    expect(near(edge.upper, Math.SQRT2 * F0, 1e-9)).toBe(true)
    // And there is no lower edge, because far below the design frequency the
    // series inductor is a wire and the shunt capacitor is an open circuit, so
    // the network hands the 100 ohm load through at a ratio of exactly two.
    expect(edge.lower).toBe(null)
    const low = matchAt(wide, 100, 50, F0 / 1e4)
    expect(near(low.vswr, 2, 1e-6)).toBe(true)
  })

  it('a bandwidth to a ratio the network already fails is declined with the reason', () => {
    expect(() => bandwidthOf(() => 0.9, F0, { vswr: 1.5 })).toThrow(/does not reach a standing-wave ratio/)
    expect(() => bandwidthOf(() => 0, F0, { vswr: 1 })).toThrow(/above one/)
  })

  it('the sweep is exact at every point it draws', () => {
    const pts = sweepMatch(wide, 100, 50, { from: 0.5e9, to: 1.5e9, points: 51 })
    expect(pts.length).toBe(51)
    for (const q of pts) {
      expect(near(q.mag, matchMag(wide, 100, 50, q.f), 1e-12), `${q.f}`).toBe(true)
      expect(near(q.vswr, (1 + q.mag) / (1 - q.mag), 1e-12)).toBe(true)
    }
  })
})

describe('the quarter-wave transformer', () => {
  const qw = quarterWaveMatch({ RS: 50, RL: 100, f0: F0, epsr: 2.1 })

  it('its impedance is the geometric mean of the two it joins', () => {
    expect(near(qw.Z0, Math.sqrt(50 * 100))).toBe(true)
    // Which is 70.7107 ohms, the same number as 100 over the square root of two.
    expect(near(qw.Z0, 100 / Math.SQRT2)).toBe(true)
  })

  it('it is a quarter wave long at the design frequency and matched there', () => {
    expect(near(qw.len, qw.vp / (4 * F0))).toBe(true)
    expect(qw.at(F0).mag).toBeLessThan(1e-12)
  })

  it('it matches at every odd multiple and hands the load through at every even one', () => {
    for (const n of [1, 3, 5, 7]) expect(qw.at(n * F0).mag, `${n} f0`).toBeLessThan(1e-12)
    for (const n of [2, 4, 6]) {
      expect(near(qw.at(n * F0).mag, cabs(reflection(100, 50)), 1e-9), `${n} f0`).toBe(true)
      expect(near(qw.at(n * F0).vswr, 2, 1e-9)).toBe(true)
    }
    expect(quarterWaveRepeats(F0, 5.5e9)).toEqual([1e9, 3e9, 5e9])
  })

  it('it is wider than the L network that makes the same transformation', () => {
    // Measured to the same standing-wave ratio, on both exact responses.
    const target = { vswr: 1.2222, span: 1.999 }
    const line = bandwidthOf(qw.read, F0, target)
    const lumped = matchBandwidth(lMatch({ RS: 50, ZL: 100, f: F0 }).chosen, 100, 50, F0, { vswr: 1.2222 })
    expect(line.bounded && lumped.bounded).toBe(true)
    expect(line.fractional).toBeGreaterThan(lumped.fractional)
    // The two edges sit either side of the design frequency, and their
    // electrical lengths add to 180 degrees, which is what makes the response
    // symmetric about the quarter wave.
    const deg = (f) => (90 * f) / F0
    expect(near(deg(line.lower) + deg(line.upper), 180, 1e-6)).toBe(true)
  })

  it('the transformer really is the line the engine says it is', () => {
    // Read through `inputImpedance` rather than through the record, so the
    // claim is made by the line module and not by this one.
    const Z = inputImpedance(qw.line, 100, F0).Z
    expect(near(Z[0], 50, 1e-9)).toBe(true)
    expect(Math.abs(Z[1])).toBeLessThan(1e-9)
  })

  it('a reactive load has no quarter-wave transformer, and the refusal says to cancel first', () => {
    expect(() => quarterWaveMatch({ RS: 50, RL: 0, f0: F0 })).toThrow(/Cancel the load reactance first/)
  })
})
