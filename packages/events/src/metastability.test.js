import { describe, it, expect } from 'vitest'
import { META, mtbf, settlingFor, synchroniser } from './metastability.js'
import { FLOP } from './library.js'

// The one model in this package that is not exact, tested as a model: the law
// it obeys, the parameters it carries, and the assumptions it prints.

describe('the metastability rate', () => {
  it('falls by e for every τ of settling time, which is the whole content of the model', () => {
    const p = { tau: META.tau, t0: META.t0, fClk: 1e9, fData: 1e6 }
    const a = mtbf({ ...p, tr: 200 })
    const b = mtbf({ ...p, tr: 200 + META.tau })
    expect(b.mtbf / a.mtbf).toBeCloseTo(Math.E, 9)
    const c = mtbf({ ...p, tr: 200 + 10 * META.tau })
    expect(c.mtbf / a.mtbf).toBeCloseTo(Math.exp(10), 6)
  })

  it('is inversely proportional to both rates and to the aperture', () => {
    const p = { tr: 300, tau: 20, t0: 20, fClk: 1e9, fData: 1e6 }
    expect(mtbf({ ...p, fClk: 2e9 }).mtbf).toBeCloseTo(mtbf(p).mtbf / 2, 12)
    expect(mtbf({ ...p, fData: 2e6 }).mtbf).toBeCloseTo(mtbf(p).mtbf / 2, 12)
    expect(mtbf({ ...p, t0: 40 }).mtbf).toBeCloseTo(mtbf(p).mtbf / 2, 12)
  })

  it('carries its parameters and its assumptions, so a lesson cannot quote it bare', () => {
    const m = mtbf({ tr: 300, fClk: 1e9, fData: 1e6 })
    expect(m.terms).toEqual({ tr: 300, tau: META.tau, t0: META.t0, fClk: 1e9, fData: 1e6 })
    expect(m.model).toBe(META.model)
    expect(m.assumptions.length).toBe(3)
    expect(m.assumptions.join(' ')).toMatch(/uniform/)
  })

  it('inverts: the settling time a target mean time asks for', () => {
    const p = { tau: 20, t0: 20, fClk: 1e9, fData: 1e6 }
    for (const years of [1, 100, 1e6]) {
      const target = years * 365.25 * 24 * 3600
      const tr = settlingFor({ mtbf: target, ...p })
      expect(mtbf({ tr, ...p }).mtbf).toBeCloseTo(target, -Math.floor(Math.log10(target)) + 6)
    }
  })

  it('a second flip-flop buys one clock period less the setup and clock-to-Q times', () => {
    const period = 1000
    const one = synchroniser({ n: 1, period, tsu: FLOP.tsu, tcq: FLOP.tcq, fClk: 1e9, fData: 1e6 })
    const two = synchroniser({ n: 2, period, tsu: FLOP.tsu, tcq: FLOP.tcq, fClk: 1e9, fData: 1e6 })
    expect(one.tr).toBe(-FLOP.tsu - FLOP.tcq)
    expect(two.tr).toBe(period - FLOP.tsu - FLOP.tcq)
    expect(two.tr - one.tr).toBe(period)
    expect(two.mtbf / one.mtbf).toBeCloseTo(Math.exp(period / META.tau), -18)
  })

  it('the gain from one more stage is the same factor whatever the stage count', () => {
    const p = { period: 1000, tsu: FLOP.tsu, tcq: FLOP.tcq, fClk: 1e9, fData: 1e6 }
    const r = (n) => synchroniser({ n, ...p }).mtbf
    expect(Math.log(r(3) / r(2))).toBeCloseTo(Math.log(r(4) / r(3)), 6)
    expect(Math.log(r(3) / r(2))).toBeCloseTo(p.period / META.tau, 6)
  })
})
