import { describe, it, expect } from 'vitest'
import { libDelay, FLOP } from './library.js'
import { criticalPath, evaluate, fMax, hazardOf, pulsesOf, timingPaths, truthTable } from './analyse.js'
import { simulate } from './simulate.js'
import { counter, decoder24, fullAdder, halfAdder, hazardNet, mux2, nandOnly, pipelinedAdder, rippleAdder, shiftRegister, srLatch } from './build.js'

const D = {
  not: libDelay('not', 1),
  buf: libDelay('buf', 1),
  and2: libDelay('and', 2),
  and3: libDelay('and', 3),
  or2: libDelay('or', 2),
  or3: libDelay('or', 3),
  nand2: libDelay('nand', 2),
  xor2: libDelay('xor', 2),
}

describe('the truth table', () => {
  it('a multiplexer picks, in all four rows of a and b', () => {
    const t = truthTable(mux2())
    expect(t.inputs).toEqual(['a', 'b', 's'])
    for (const r of t.rows) {
      const [a, b, s] = r.in
      expect(r.out[0], `a=${a} b=${b} s=${s}`).toBe(s ? b : a)
    }
    // a is the high bit, so y is 1 at a b' s' , a b s' , a' b s and a b s.
    expect(t.minterms.y).toEqual([3, 4, 6, 7])
  })

  it('a decoder puts exactly one output high in every row', () => {
    const t = truthTable(decoder24())
    for (const r of t.rows) {
      expect(r.out.reduce((a, b) => a + b, 0)).toBe(1)
      expect(r.out[r.index]).toBe(1)
    }
  })

  it('NAND alone reproduces NOT, AND, OR and XOR', () => {
    const want = { not: (a) => a ^ 1, and: (a, b) => a & b, or: (a, b) => a | b, xor: (a, b) => a ^ b }
    for (const which of Object.keys(want)) {
      const t = truthTable(nandOnly(which))
      for (const r of t.rows) expect(r.out[0], `${which} at ${r.in}`).toBe(want[which](...r.in))
    }
  })

  it('a half adder is the two bits of the sum, and a full adder counts the ones', () => {
    for (const r of truthTable(halfAdder()).rows) {
      const [a, b] = r.in
      expect(r.out[1] * 2 + r.out[0]).toBe(a + b)
    }
    for (const r of truthTable(fullAdder()).rows) {
      const [a, b, cin] = r.in
      expect(r.out[1] * 2 + r.out[0]).toBe(a + b + cin)
    }
  })

  it('an n-bit ripple adder adds, for every pair of operands', () => {
    for (let a = 0; a < 16; a++)
      for (let b = 0; b < 16; b++) {
        const v = evaluate(rippleAdder(4, { a, b }), {})
        const sum = v.s0 + 2 * v.s1 + 4 * v.s2 + 8 * v.s3 + 16 * v.cout
        expect(sum, `${a} + ${b}`).toBe(a + b)
      }
  })

  it('declines a netlist with a ring in it, and names the ring', () => {
    expect(() => truthTable(srLatch())).toThrow(/it is a latch/)
    try {
      truthTable(srLatch())
    } catch (e) {
      expect(e.code).toBe('combinational-loop')
      expect(e.detail.loop).toEqual(['q', 'qn'])
    }
  })

  it('declines a netlist with a flip-flop in it, and says why', () => {
    expect(() => truthTable(counter(2))).toThrow(/not only on what/)
  })
})

describe('the hazard', () => {
  it('finds the static-1 pulse, and its width is the difference between the two paths', () => {
    const h = hazardOf(hazardNet(), { input: 'a', from: 1, to: 0, output: 'y' })
    expect(h.static).toBe(true)
    expect(h.before).toBe(1)
    expect(h.after).toBe(1)
    expect(h.hazard.width).toBe(D.not)
    expect(h.hazard.value).toBe(0)
  })

  it('finds none once the consensus term covers it', () => {
    const h = hazardOf(hazardNet({ consensus: true }), { input: 'a', from: 1, to: 0, output: 'y' })
    expect(h.static).toBe(true)
    expect(h.hazard).toBeNull()
    expect(h.pulses).toEqual([])
  })

  it('does not call a real change a hazard', () => {
    const h = hazardOf(mux2({ a: 0, b: 1, s: 0 }), { input: 's', from: 0, to: 1, output: 'y' })
    expect(h.static).toBe(false)
    expect(h.before).toBe(0)
    expect(h.after).toBe(1)
    expect(h.hazard).toBeNull()
  })

  it('counts the pulses on a signal from the run itself', () => {
    const h = hazardOf(hazardNet(), { input: 'a', from: 1, to: 0, output: 'y' })
    expect(pulsesOf(h.result, 'y')).toEqual([{ from: 100 + D.and2 + D.or2, to: 100 + D.not + D.and2 + D.or2, width: D.not, value: 0 }])
  })
})

describe('the critical path', () => {
  it('runs down the carry chain of a ripple adder, and grows by one full adder per bit', () => {
    const one = D.and2 + D.or2
    for (const n of [1, 2, 4, 8]) {
      const cp = criticalPath(rippleAdder(n))
      expect(cp.to).toBe('cout')
      expect(cp.delay, `${n} bits`).toBe(D.xor2 + D.and2 + D.or2 + (n - 1) * one)
    }
  })

  it('names every gate along the path, in order, starting at an input', () => {
    const cp = criticalPath(rippleAdder(4))
    expect(cp.path).toEqual(['a0', 'x0', 'p0', 'c1', 'p1', 'c2', 'p2', 'c3', 'p3', 'cout'])
    expect(cp.from).toBe('a0')
  })

  it('gives every endpoint its own arrival, so a sum bit is not the carry', () => {
    const t = timingPaths(rippleAdder(4))
    const byName = Object.fromEntries(t.endpoints.map((e) => [e.signal, e.long]))
    expect(byName.s0).toBe(2 * D.xor2)
    expect(byName.s3).toBe(D.xor2 + D.and2 + D.or2 + 2 * (D.and2 + D.or2) + D.xor2)
    expect(byName.cout).toBe(t.long.delay)
  })

  it('is the sum of the gate delays along it, and the simulation lands there', () => {
    const cp = criticalPath(rippleAdder(4))
    // Every operand bit at 1 and the carry-in stepping from 0 to 1 makes the
    // carry travel the whole chain, so the last event is the path's own delay
    // less the partial sum at the head of it, which was settled before the step.
    const base = rippleAdder(4, { a: 15, b: 0 })
    const stepped = { ...base, sources: base.sources.map((s) => (s.id === 'cin' ? { id: 'cin', kind: 'step', at: 1000, from: 0, to: 1 } : s)) }
    const res = simulate(stepped, { tEnd: 4000 })
    const last = res.events.filter((e) => e.signal === 'cout')
    expect(last.length).toBe(1)
    expect(last[0].t - 1000).toBe(cp.delay - D.xor2)
  })
})

describe('the clock period', () => {
  it('is clock-to-Q, the longest path and the setup time, added up', () => {
    const f = fMax(pipelinedAdder(4))
    expect(f.terms.tcq).toBe(FLOP.tcq)
    expect(f.terms.tsu).toBe(FLOP.tsu)
    expect(f.terms.tpd).toBe(criticalPath(rippleAdder(4)).delay)
    expect(f.tMin).toBe(f.terms.tcq + f.terms.tpd + f.terms.tsu)
    expect(f.fMax).toBeCloseTo(1 / (f.tMin * 1e-12), 0)
  })

  it('skew buys setup time and spends hold margin, one picosecond for one', () => {
    const base = fMax(pipelinedAdder(4))
    for (const skew of [25, 50, 100]) {
      const f = fMax(pipelinedAdder(4, { skew }), { skew })
      expect(f.tMin).toBe(base.tMin - skew)
      expect(f.holdSlack).toBe(base.holdSlack - skew)
    }
  })

  it('the hold check does not contain the period, so slowing the clock does not fix it', () => {
    const slow = fMax(pipelinedAdder(4, { period: 4000 }))
    const fast = fMax(pipelinedAdder(4, { period: 1000 }))
    expect(slow.holdSlack).toBe(fast.holdSlack)
  })

  it('the counter closes faster than the adder, because its chain is one AND per bit and not two gates', () => {
    const c = fMax(counter(4))
    // q0 through two ANDs of the enable chain, then the exclusive-or at bit 3.
    expect(c.terms.tpd).toBe(2 * D.and2 + D.xor2)
    expect(c.tMin).toBe(FLOP.tcq + 2 * D.and2 + D.xor2 + FLOP.tsu)
    expect(c.tMin).toBeLessThan(fMax(pipelinedAdder(4)).tMin)
    // One more bit is one more AND, where the adder's is an AND and an OR.
    expect(fMax(counter(5)).tMin - c.tMin).toBe(D.and2)
  })

  it('is a clock-to-Q and a setup time when there is no logic at all between the stages', () => {
    // The floor. A shift register puts nothing between one flip-flop and the
    // next, so the period it closes at is the two times the cell itself costs
    // and nothing else, and every design with logic in it is that plus the
    // logic. Its hold margin is the same clock-to-Q less the hold time, which
    // is why a register with no logic in it still holds.
    const f = fMax(shiftRegister(4))
    expect(f.terms.tpd).toBe(0)
    expect(f.tMin).toBe(FLOP.tcq + FLOP.tsu)
    expect(f.holdSlack).toBe(FLOP.tcq - FLOP.th)
    expect(f.tMin).toBeLessThan(fMax(counter(4)).tMin)
  })

  it('declines a netlist with no flip-flop in it, and one whose flip-flops never talk to each other', () => {
    expect(() => fMax(rippleAdder(4))).toThrow(/needs flip-flops/)
    const isolated = {
      sources: [{ id: 'clk', kind: 'clock', period: 1000 }, { id: 'a', kind: 'input', value: 0 }],
      flops: [{ id: 'q', d: 'a', clk: 'clk' }],
      outputs: ['q'],
    }
    expect(() => fMax(isolated)).toThrow(/from one flip-flop to another/)
  })
})

describe('the counter counts', () => {
  it('reaches every value in order, and wraps', () => {
    const res = simulate(counter(3, { period: 1000 }), { tEnd: 9000 })
    const read = (t) => [0, 1, 2].reduce((acc, i) => acc + (valueOf(res, `q${i}`, t) << i), 0)
    const valueOf = (r, sig, t) => {
      const w = r.waves[sig]
      let v = w.v[0]
      for (let k = 0; k < w.t.length; k++) if (w.t[k] <= t) v = w.v[k]
      return v
    }
    // The clock rises at 0, so by the end of the first period the counter is
    // already at 1. Read late in each period, well clear of the edge.
    for (let k = 0; k < 8; k++) expect(read(900 + k * 1000), `after ${k + 1} edges`).toBe((k + 1) % 8)
    expect(res.violations).toEqual([])
  })
})
