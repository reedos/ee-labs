import { describe, it, expect } from 'vitest'
import { criticalPath, FLOP, libDelay, rippleAdder } from '@ee-labs/events'
import { byId, defaultsOf } from '../experiments.js'
import { readQuantity } from '../lessons.js'
import { analyse } from '../analysis.js'

// Group G's numbers. The period is three terms, and each of them is computed
// here from the library or from the adder group C already timed, never typed.

const D = { and2: libDelay('and', 2), or2: libDelay('or', 2), xor2: libDelay('xor', 2) }
/** One bit of carry chain, which is what C6 measured as the adder's slope. */
const CARRY = D.and2 + D.or2
/** The longest path through an n-bit ripple adder, from the adder's own analysis. */
const logicOf = (n) => criticalPath(rippleAdder(n)).delay

const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p) }
}

describe('group G pins the clock', () => {
  it('G1: the period is a clock-to-Q, the longest path and a setup time, and nothing else', () => {
    const { x, p } = at('g1')
    expect(readQuantity(x, p, 'tpd')).toBe(logicOf(p.n))
    expect(readQuantity(x, p, 'tpd')).toBe(D.xor2 + p.n * CARRY)
    expect(readQuantity(x, p, 'tmin')).toBe(FLOP.tcq + readQuantity(x, p, 'tpd') + FLOP.tsu)
    // The frequency is one over the period, in hertz, and no other statement.
    expect(readQuantity(x, p, 'fmax')).toBeCloseTo(1 / (readQuantity(x, p, 'tmin') * 1e-12), 0)
    // The path that spends it is the carry chain, named end to end.
    expect(x.closing.path.path).toContain('cout')
    expect(x.closing.path.path[0]).toMatch(/^r[ab]0$/)
    // Slack is what the clock has left over the period the design closes at.
    for (const period of [1000, 2000, 5000]) {
      const y = at('g1', { period })
      expect(readQuantity(y.x, y.p, 'setupslack'), `${period}`).toBe(period - readQuantity(x, p, 'tmin'))
      expect(readQuantity(y.x, y.p, 'violations'), `${period}`).toBe(0)
    }
  })

  it('G2: the period grows by one AND and one OR a bit, and the hold margin does not grow at all', () => {
    let last = null
    for (const n of [2, 4, 5, 6, 8, 16, 32]) {
      const { x, p } = at('g2', { n })
      expect(readQuantity(x, p, 'tpd'), `${n}`).toBe(logicOf(n))
      expect(readQuantity(x, p, 'tmin'), `${n}`).toBe(FLOP.tcq + D.xor2 + n * CARRY + FLOP.tsu)
      if (last) expect(readQuantity(x, p, 'tmin') - last.tMin, `${n}`).toBe((n - last.n) * CARRY)
      // The fastest way from one flip-flop to the next is an operand into its
      // own bit's generate AND and straight out of that bit's carry OR. It is
      // one bit of carry chain, wherever the width goes.
      expect(readQuantity(x, p, 'holdslack'), `${n}`).toBe(FLOP.tcq + CARRY - FLOP.th)
      last = { n, tMin: readQuantity(x, p, 'tmin') }
    }
    // Doubling the width nearly doubles the period, because only the logic
    // term doubles and the two flip-flop terms do not.
    const four = at('g2', { n: 4 })
    const eight = at('g2', { n: 8 })
    const ratio = readQuantity(eight.x, eight.p, 'tmin') / readQuantity(four.x, four.p, 'tmin')
    expect(ratio).toBeLessThan(2)
    expect(ratio).toBeGreaterThan(1.7)
  })

  it('G3: halving the logic does not halve the period, because two of its terms belong to the flip-flops', () => {
    const two = at('g3', { n: 2 })
    const four = at('g3', { n: 4 })
    expect(readQuantity(two.x, two.p, 'tpd') * 2).toBeGreaterThan(readQuantity(four.x, four.p, 'tpd'))
    const gain = readQuantity(four.x, four.p, 'tmin') / readQuantity(two.x, two.p, 'tmin')
    expect(gain).toBeLessThan(2)
    expect(gain).toBeCloseTo(readQuantity(four.x, four.p, 'fmax') === 0 ? 0 : readQuantity(two.x, two.p, 'fmax') / readQuantity(four.x, four.p, 'fmax'), 6)
    // Two clocks of the shorter period take longer than one of the longer one,
    // which is the whole trade pipelining makes.
    expect(2 * readQuantity(two.x, two.p, 'tmin')).toBeGreaterThan(readQuantity(four.x, four.p, 'tmin'))
    // And the floor it runs into is the register with no logic in it at all.
    expect(readQuantity(two.x, two.p, 'tmin')).toBeGreaterThan(FLOP.tcq + FLOP.tsu)
  })

  it('G4: one picosecond of skew buys one of period and spends one of hold margin', () => {
    const base = at('g4', { skew: 0 })
    const tMin = readQuantity(base.x, base.p, 'tmin')
    const hold = readQuantity(base.x, base.p, 'holdslack')
    for (const skew of [0, 25, 50, 150, 200, 201, 300]) {
      const { x, p } = at('g4', { skew })
      expect(readQuantity(x, p, 'skew'), `${skew}`).toBe(skew)
      expect(readQuantity(x, p, 'tmin'), `${skew}`).toBe(tMin - skew)
      expect(readQuantity(x, p, 'holdslack'), `${skew}`).toBe(hold - skew)
    }
    // The trade runs out where the hold margin reaches zero, which is the
    // shortest path less the hold time.
    expect(hold).toBe(FLOP.tcq + CARRY - FLOP.th)
    expect(readQuantity(at('g4', { skew: hold }).x, at('g4', { skew: hold }).p, 'holdslack')).toBe(0)
    expect(readQuantity(at('g4', { skew: hold + 1 }).x, at('g4', { skew: hold + 1 }).p, 'holdslack')).toBe(-1)
  })

  it('G5: the hold check has no period in it, and the setup check is nothing but the period', () => {
    for (const skew of [0, 150]) {
      let hold = null
      for (const period of [500, 1000, 2000, 5000]) {
        const { x, p } = at('g5', { period, skew })
        // The hold margin is the same number at every period.
        if (hold === null) hold = readQuantity(x, p, 'holdslack')
        expect(readQuantity(x, p, 'holdslack'), `${period}/${skew}`).toBe(hold)
        // The setup slack is the period less what the design closes at, so it
        // moves one for one with the clock.
        expect(readQuantity(x, p, 'setupslack'), `${period}/${skew}`).toBe(period - readQuantity(x, p, 'tmin'))
      }
      // And what does move it is the skew, one picosecond for one.
      expect(hold, `${skew}`).toBe(FLOP.tcq + CARRY - FLOP.th - skew)
    }
  })

  it('every experiment in the group runs clean at its defaults, on one netlist', () => {
    for (const id of ['g1', 'g2', 'g3', 'g4', 'g5']) {
      const { x, p } = at(id)
      expect(x.res.settled, id).toBe(true)
      expect(x.res.conflicts, id).toEqual([])
      expect(readQuantity(x, p, 'setupslack'), `${id} is clocked slower than it closes`).toBeGreaterThanOrEqual(0)
      expect(readQuantity(x, p, 'holdslack'), `${id} holds`).toBeGreaterThanOrEqual(0)
      expect(x.res.violations, id).toEqual([])
    }
  })
})
