import { describe, it, expect } from 'vitest'
import { DETECTOR_101, FLOP, fsmTable, libDelay, simulate } from '@ee-labs/events'
import { byId, defaultsOf } from '../experiments.js'
import { readQuantity } from '../lessons.js'
import { analyse } from '../analysis.js'

// Group F's numbers, computed from the library and from the specification the
// machine came from, never typed in.

const D = { and2: libDelay('and', 2), xor2: libDelay('xor', 2), not: libDelay('not', 1), buf: libDelay('buf', 1) }

const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p) }
}

describe('group F pins the register, the counter and the machine', () => {
  it('F1: with no logic between the stages the period is a clock-to-Q and a setup time', () => {
    for (const n of [2, 4, 8]) {
      const { x, p } = at('f1', { n })
      expect(readQuantity(x, p, 'flops'), `${n}`).toBe(n)
      expect(readQuantity(x, p, 'tmin'), `${n}`).toBe(FLOP.tcq + FLOP.tsu)
      expect(readQuantity(x, p, 'holdslack'), `${n}`).toBe(FLOP.tcq - FLOP.th)
      // Each stage moves one clock-to-Q after its own edge, one clock apart.
      for (let i = 0; i < n; i++) expect(readQuantity(x, p, `edge.q${i}.1`), `${n}/${i}`).toBe(readQuantity(x, p, 'edge.clk.1') + i * p.period + FLOP.tcq)
    }
    // The closing period is a property of the design, and the clock period a
    // separate choice. The slack between them is the difference.
    for (const period of [200, 1000, 4000]) {
      const { x, p } = at('f1', { period })
      expect(readQuantity(x, p, 'setupslack'), `${period}`).toBe(period - (FLOP.tcq + FLOP.tsu))
      expect(readQuantity(x, p, 'violations'), `${period}`).toBe(0)
      expect(readQuantity(x, p, 'holdslack'), `${period}`).toBe(FLOP.tcq - FLOP.th)
    }
  })

  it('F2: the counter reaches every value in order and then wraps, at every width', () => {
    for (const n of [2, 4, 6]) {
      const { x, p } = at('f2', { n })
      expect(readQuantity(x, p, 'flops'), `${n}`).toBe(n)
      // Bit 0 needs one inverter, each bit above the first needs one
      // exclusive-or, and the enable chain needs one AND from bit 2 up.
      expect(readQuantity(x, p, 'gates'), `${n}`).toBe(1 + (n - 1) + Math.max(0, n - 2))
      const seen = []
      for (let k = 0; k < 2 ** n + 2; k++) seen.push(readQuantity(x, p, `word.q.${n}.${k * p.period + p.period - 1}`))
      // The clock rises at 0, so the first reading is already 1.
      for (let k = 0; k < seen.length; k++) expect(seen[k], `${n} bits, clock ${k}`).toBe((k + 1) % 2 ** n)
      expect(readQuantity(x, p, 'violations'), `${n}`).toBe(0)
    }
  })

  it('F3: the closing period grows by one AND a bit, whatever the AND costs', () => {
    for (const tand of [35, D.and2, 140]) {
      let last = null
      for (const n of [2, 3, 4, 5, 8]) {
        const { x, p } = at('f3', { n, tand })
        // Nothing at 2 bits but the exclusive-or, then one AND per bit above it.
        const logic = D.xor2 + Math.max(0, n - 2) * tand
        expect(readQuantity(x, p, 'tmin'), `${n}/${tand}`).toBe(FLOP.tcq + logic + FLOP.tsu)
        if (last && last.n >= 2) expect(readQuantity(x, p, 'tmin') - last.tMin, `${n}/${tand}`).toBe((n - last.n) * tand)
        last = { n, tMin: readQuantity(x, p, 'tmin') }
      }
    }
    // The path the period is spent on is the enable chain, named in the list.
    const { x } = at('f3', { n: 4 })
    expect(x.paths.long.path).toContain('e3')
    expect(x.paths.long.path[0]).toBe('q0')
  })

  it('F4 and F5: the table is the specification enumerated, and its unused code is free', () => {
    const table = fsmTable(DETECTOR_101)
    const { x, p } = at('f4')
    expect(readQuantity(x, p, 'states')).toBe(table.states.length)
    expect(readQuantity(x, p, 'srows')).toBe(table.states.length * 2 ** table.inputs.length)
    expect(readQuantity(x, p, 'machine')).toBe('Mealy')
    // Mealy because some state's output differs between its two rows.
    const varies = table.states.some((s) => {
      const rows = table.rows.filter((r) => r.state === s)
      return rows.some((r) => r.out.y !== rows[0].out.y)
    })
    expect(varies).toBe(true)
    const five = at('f5')
    expect(readQuantity(five.x, five.p, 'sbits')).toBe(Math.ceil(Math.log2(table.states.length)))
    expect(readQuantity(five.x, five.p, 'unused')).toBe(2 ** table.bits - table.states.length)
    // The code nothing reaches is never held at a clock edge.
    const period = five.p.period
    for (let k = 0; k < 8; k++) expect(readQuantity(five.x, five.p, `word.q.2.${k * period + period - 1}`), `clock ${k}`).toBeLessThan(table.states.length)
  })

  it('F6: each equation is one cube, and the gate count is what they need between them', () => {
    const { x, p } = at('f6')
    expect(readQuantity(x, p, 'expr.d1')).toBe("q0x'")
    expect(readQuantity(x, p, 'expr.d0')).toBe('x')
    expect(readQuantity(x, p, 'expr.y')).toBe('q1x')
    for (const [name, literals] of [['d1', 2], ['d0', 1], ['y', 2]]) {
      expect(readQuantity(x, p, `eqcubes.${name}`), name).toBe(1)
      expect(readQuantity(x, p, `eqliterals.${name}`), name).toBe(literals)
    }
    // The unused code is what makes each of them one cube. Take the freedom
    // away and the cover of at least one equation grows.
    expect(x.fsm.dontCare.length).toBe(2)
    expect(readQuantity(x, p, 'gates')).toBe(6)
  })

  it('F7: the built machine detects the sequence its specification describes', () => {
    // The test no intermediate step passes by accident. The netlist is run and
    // its output compared against the specification walked by hand.
    const table = fsmTable(DETECTOR_101)
    for (const word of [90, 181, 0, 255, 7, 171]) {
      const { x, p } = at('f7', { word })
      const bits = Array.from({ length: 8 }, (_, i) => (word >> (7 - i)) & 1)
      let state = DETECTOR_101.reset
      bits.forEach((b, k) => {
        const want = DETECTOR_101.out(state, { x: b }).y
        const got = readQuantity(x, p, `at.y.${k * p.period + p.period - 1}`)
        expect(got, `word ${word}, bit ${k + 1}`).toBe(want)
        state = DETECTOR_101.next(state, { x: b })
      })
      expect(readQuantity(x, p, 'violations'), `word ${word}`).toBe(0)
    }
    // Six gates, two flip-flops, and a period of a clock-to-Q, the one AND on
    // the longest path, the buffer that drives the state bit, and a setup time.
    const { x, p } = at('f7')
    expect(readQuantity(x, p, 'gates')).toBe(6)
    expect(readQuantity(x, p, 'flops')).toBe(table.bits)
    expect(x.closing.path.path).toEqual(['q0', 'd1_p1', 'd1'])
    expect(readQuantity(x, p, 'tmin')).toBe(FLOP.tcq + D.and2 + D.buf + FLOP.tsu)
    // And it closes at that period, not only on paper.
    for (const period of [500, 1000, 4000]) {
      const y = at('f7', { period })
      expect(readQuantity(y.x, y.p, 'tmin'), `${period}`).toBe(readQuantity(x, p, 'tmin'))
      expect(y.x.res.violations, `${period}`).toEqual([])
    }
  })

  it('every netlist in the group runs clean, with no conflict and nothing unsettled', () => {
    for (const id of ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7']) {
      const { x } = at(id)
      expect(x.res.settled, id).toBe(true)
      expect(x.res.conflicts, id).toEqual([])
      expect(x.res.violations, id).toEqual([])
      expect(simulate(x.norm, { tEnd: x.res.tEnd }).events, id).toEqual(x.res.events)
    }
  })
})
