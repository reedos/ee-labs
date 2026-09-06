import { describe, expect, it } from 'vitest'
import { EXPERIMENTS, byId, defaultsOf } from './experiments.js'
import { LESSONS, readQuantity } from './lessons.js'
import { analyse, meterOf, sensitivities } from './math.js'

// The lesson machinery itself: the registers are complete, every quantity path
// a lesson names resolves against the analysis, and the two pieces of pure
// arithmetic the uncertainty group leans on — the meter and the sensitivities —
// agree with the closed forms F1 and F3 state.
//
// What each lesson CLAIMS is measured in experiments.test.js, one solve per
// step. This file is about the shapes those claims are written in.

const at = (id, over = {}, cursor) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p, cursor) }
}

describe('the three registers', () => {
  it('every experiment has one lesson, and every lesson an experiment', () => {
    expect(Object.keys(LESSONS).sort()).toEqual(EXPERIMENTS.map((e) => e.id).sort())
    for (const e of EXPERIMENTS) {
      expect(e.see, e.id).toBeTruthy()
      expect(e.why, e.id).toBeTruthy()
      expect(Array.isArray(e.try), e.id).toBe(true)
    }
  })

  it('every reads pair is a path this lab knows or a function of the analysis', () => {
    for (const e of EXPERIMENTS) {
      const pairs = [...(e.seeReads || []), ...(e.whyReads || []), ...(e.try || []).flatMap((t) => t.reads || [])]
      for (const pair of pairs) {
        expect(Array.isArray(pair), `${e.id} reads pair`).toBe(true)
        expect(pair.length, `${e.id} reads pair of ${pair.length}`).toBeGreaterThanOrEqual(2)
        expect(['string', 'function'], `${e.id} reads ${pair[0]}`).toContain(typeof pair[0])
        expect(Number.isFinite(pair[1]), `${e.id} reads ${pair[0]} wants ${pair[1]}`).toBe(true)
      }
      // Two registers of every experiment quote at least one measured number.
      expect((e.seeReads || []).length + (e.try || []).flatMap((t) => t.reads || []).length, `${e.id} reads`).toBeGreaterThan(0)
    }
  })

  it('an unknown path is refused by name', () => {
    const a1 = at('a1')
    expect(() => readQuantity(a1.x, a1.p, 'nope.in', a1.exp)).toThrow(/unknown quantity path/)
  })
})

describe('the meter’s arithmetic', () => {
  it('a meter shows the reading rounded to its count, and half a count is its resolution', () => {
    // F1's three displays, at four readings each. The count is the range over
    // one more than the counts, because the zero is a count too.
    const range = 20
    for (const counts of [1999, 19999, 1999999]) {
      const step = range / (counts + 1)
      for (const read of [4.7619047619, 0.1, 12.3456789, -4.7619047619]) {
        const m = meterOf(read, { counts, fullScale: range })
        expect(m.step, `${counts} counts`).toBeCloseTo(step, 12)
        expect(m.halfCount).toBeCloseTo(step / 2, 12)
        // What is shown is a whole number of counts, and never more than half a
        // count from the reading behind it.
        expect(Math.abs(m.shown / step - Math.round(m.shown / step))).toBeLessThan(1e-9)
        expect(Math.abs(m.shown - read)).toBeLessThanOrEqual(step / 2 + 1e-12)
        expect(m.resPct).toBeCloseTo((100 * (step / 2)) / Math.abs(read), 9)
        expect(m.spec).toBe(0)
      }
    }
  })

  it('a specification is a per cent of the display plus a number of counts', () => {
    const m = meterOf(4.7619047619, { counts: 1999, fullScale: 20, pct: 0.5, terms: 2 })
    expect(m.shown).toBeCloseTo(4.76, 12)
    expect(m.spec).toBeCloseTo(0.005 * 4.76 + 2 * 0.01, 12)
    expect(m.pct).toBeCloseTo((100 * m.spec) / 4.76, 9)
    // Both terms scale as they are stated: twice the counts term adds one count twice.
    const wider = meterOf(4.7619047619, { counts: 1999, fullScale: 20, pct: 0.5, terms: 4 })
    expect(wider.spec - m.spec).toBeCloseTo(2 * 0.01, 12)
  })

  it('F1’s meter reads what F1 says at every display it offers', () => {
    for (const [counts, shown, resPct] of [
      [1999, 4.76, 0.105],
      [19999, 4.762, 0.0105],
      [1999999, 4.7619, 0.000105],
    ]) {
      const { x } = at('f1', { counts })
      expect(x.meter.shown, `${counts} counts`).toBeCloseTo(shown, 9)
      expect(x.meter.resPct, `${counts} counts`).toBeCloseTo(resPct, 6)
      // More digits do not move the error the meter made by being connected.
      expect(x.meter.errorPct).toBeCloseTo(-4.7619048, 6)
    }
  })
})

describe('the sensitivities', () => {
  it('a divider’s two sensitivities are ∓R₁/(R₁+R₂), against a re-solve at ±1 %', () => {
    for (const [R1, R2] of [[1e4, 1e4], [9e4, 1e4], [1e4, 9e4], [1e3, 1e6]]) {
      const p = { E: 10, R1, R2, tol: 1 }
      const read = (q) => (q.E * q.R2) / (q.R1 + q.R2)
      const s = sensitivities(null, p, read, [{ key: 'R1', tol: p.tol }, { key: 'R2', tol: p.tol }])
      const dc = R1 / (R1 + R2)
      expect(s.rows[0].s).toBeCloseTo(-dc, 6)
      expect(s.rows[1].s).toBeCloseTo(dc, 6)
      expect(s.quad).toBeCloseTo(Math.hypot(dc, dc), 6)
      expect(s.worst).toBeCloseTo(2 * dc, 6)
      // The linear prediction against the exact re-solve at one per cent: the
      // second-order term is what is left, and it is under a part in a hundred
      // of the first.
      const exact = 100 * (read({ ...p, R1: R1 * 1.01 }) / s.y0 - 1)
      expect(Math.abs(exact - s.rows[0].part)).toBeLessThan(0.01 * Math.abs(s.rows[0].part) + 1e-12)
    }
  })

  it('a common move of both resistors cancels, to a part in 10¹²', () => {
    const { exp, p, x } = at('f3')
    const shifted = exp.readOut({ ...p, R1: p.R1 * (1 + p.tol / 100), R2: p.R2 * (1 + p.tol / 100) })
    expect(Math.abs(shifted / x.sens.y0 - 1)).toBeLessThan(1e-12)
  })
})
