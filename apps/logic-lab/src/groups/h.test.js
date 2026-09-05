import { describe, it, expect } from 'vitest'
import { FLOP, META, mtbf, settlingFor } from '@ee-labs/events'
import { byId, defaultsOf } from '../experiments.js'
import { readQuantity } from '../lessons.js'
import { analyse } from '../analysis.js'

// Group H's numbers, computed from the law rather than typed in. This is the
// one group whose model is not exact, so the test does two things the others do
// not. It checks the law against its own inverse, and it requires every answer
// to arrive with its parameters and its three assumptions attached.

const YEAR = 365.25 * 24 * 3600
const PS = 1e12

const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p) }
}

describe('group H pins the rate model', () => {
  it('H1: the mean time is the law, and every 20 ps of settling multiplies it by e', () => {
    for (const tr of [200, 400, 600]) {
      const { x, p } = at('h1', { tr })
      const want = mtbf({ tr, tau: p.tau, t0: p.t0, fClk: p.fclk, fData: p.fdata })
      expect(readQuantity(x, p, 'mtbf'), `${tr}`).toBeCloseTo(want.mtbf * PS, -6)
      expect(readQuantity(x, p, 'mtbfyears'), `${tr}`).toBeCloseTo(want.mtbf / YEAR, 6)
    }
    // One τ of settling time is one factor of e, at every τ the knob offers.
    for (const tau of [10, META.tau, 50]) {
      const one = at('h1', { tau, tr: 200 })
      const two = at('h1', { tau, tr: 200 + tau })
      expect(readQuantity(two.x, two.p, 'mtbf') / readQuantity(one.x, one.p, 'mtbf'), `${tau}`).toBeCloseTo(Math.E, 6)
    }
    // Every parameter is linear in the rate except the settling time.
    const base = at('h1')
    for (const [key, factor] of [['t0', 2], ['fclk', 2], ['fdata', 4]]) {
      const y = at('h1', { [key]: base.p[key] * factor })
      expect(readQuantity(base.x, base.p, 'mtbf') / readQuantity(y.x, y.p, 'mtbf'), key).toBeCloseTo(factor, 6)
    }
  })

  it('H2: the second stage buys a clock period less the setup and clock-to-Q times', () => {
    for (const n of [1, 2, 3]) {
      for (const period of [500, 1000, 2000]) {
        const { x, p } = at('h2', { n, period })
        expect(readQuantity(x, p, 'flops'), `${n}`).toBe(n)
        expect(readQuantity(x, p, 'settling'), `${n}/${period}`).toBe((n - 1) * period - FLOP.tsu - FLOP.tcq)
      }
    }
    // One flip-flop leaves no settling time at all, and the mean time it gives
    // is not a number anyone would ship.
    const one = at('h2', { n: 1 })
    expect(readQuantity(one.x, one.p, 'settling')).toBeLessThan(0)
    expect(readQuantity(one.x, one.p, 'mtbf') / PS).toBeLessThan(1e-6)
    // Two is a whole clock period better, which is e to that many τ.
    const two = at('h2', { n: 2 })
    const gained = readQuantity(two.x, two.p, 'settling') - readQuantity(one.x, one.p, 'settling')
    expect(gained).toBe(two.p.period)
    expect(readQuantity(two.x, two.p, 'mtbf') / readQuantity(one.x, one.p, 'mtbf')).toBeCloseTo(Math.exp(gained / two.p.tau), -20)
  })

  it('H3: the settling time a target asks for is the law read backwards, and it reproduces the target', () => {
    for (const years of [1, 1000, 1000000]) {
      const { x, p } = at('h3', { years })
      const want = settlingFor({ mtbf: years * YEAR, tau: p.tau, t0: p.t0, fClk: p.fclk, fData: p.fdata })
      expect(readQuantity(x, p, 'settling'), `${years}`).toBeCloseTo(want, 6)
      // Put that settling time back into the law and the target comes out. The
      // grid is whole picoseconds, so it rounds up and lands a little over.
      const got = readQuantity(x, p, 'mtbfyears')
      expect(got, `${years}`).toBeGreaterThanOrEqual(years)
      expect(got / years, `${years}`).toBeLessThan(Math.exp(1 / p.tau) * 1.001)
    }
    // A thousandfold target costs a few τ, because the target is inside a log.
    const small = at('h3', { years: 1 })
    const large = at('h3', { years: 1000000 })
    const extra = readQuantity(large.x, large.p, 'settling') - readQuantity(small.x, small.p, 'settling')
    expect(extra).toBeCloseTo(small.p.tau * Math.log(1e6), 6)
    // Doubling τ doubles what the same target asks for.
    const slow = at('h3', { tau: 2 * small.p.tau })
    expect(readQuantity(slow.x, slow.p, 'settling')).toBeCloseTo(2 * readQuantity(at('h3').x, at('h3').p, 'settling'), 6)
  })

  it('every answer in the group arrives with its parameters and its three assumptions', () => {
    // CORE_SCOPE Rule 3. The one model here that is not exact never gives a
    // number without saying what it rests on, and the pane prints all of it.
    for (const id of ['h1', 'h2', 'h3']) {
      const { x, p } = at(id)
      expect(x.rate, id).toBeTruthy()
      expect(x.rate.assumptions.length, id).toBe(3)
      expect(x.rate.model, id).toMatch(/exponential/)
      for (const key of ['tr', 'tau', 't0', 'fClk', 'fData']) expect(Number.isFinite(x.rate.terms[key]), `${id} ${key}`).toBe(true)
      expect(x.rate.terms.tau, id).toBe(p.tau)
      expect(x.rate.terms.t0, id).toBe(p.t0)
      // And the netlist under it is a real synchroniser that runs clean.
      expect(x.res.settled, id).toBe(true)
      expect(x.res.violations, id).toEqual([])
    }
  })
})
