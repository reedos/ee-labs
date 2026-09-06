import { describe, it, expect } from 'vitest'
import { fMax, normalize, simulate, timingPaths } from '@ee-labs/events'
import { CARD, UNIT, gates, psOf } from './card.js'
import { alu32, arrivalsOf, decoder5to32, inGates, lookaheadAdder, mux2Net, multiplyCost, pathOf, registeredAdder, rippleAdder, runNet, wordOf } from './blocks.js'

// The gate-level blocks, measured on the engine rather than stated.
//
// Invariants 4 and 5 of the plan's §2.8 live here, because both are about a
// netlist. The other invariants are in `engine.test.js`.
//
// Every number below is the card's gate delay times a whole number, and the
// engine did the multiplication. Change `CARD.gate` and every expectation
// moves with it.

const G = CARD.gate
const inG = (units) => units / G

describe('the ripple-carry adder', () => {
  it('adds, at 32 bits, for operands the carry has to cross', () => {
    for (const [a, b, cin] of [[5, 7, 0], [-1, 1, 0], [123456, 654321, 1], [-8, 8, 0], [0, 0, 0]]) {
      const run = runNet(rippleAdder(32, { a, b, cin }), 200 * G)
      expect(wordOf(run.res.final, 's', 32) | 0, `${a} + ${b} + ${cin}`).toBe((a + b + cin) | 0)
    }
  })

  it('costs two gate delays a bit, so the top carry is 64 of them', () => {
    // Every propagate is on, so the carry crosses all thirty-two bits. The
    // step is what makes it visible, and the events are what measure it.
    const at = 100 * G
    const run = runNet(rippleAdder(32, { a: -1, b: 0, cin: 0, step: 'cin', at }), at + 80 * G)
    const edge = (net) => run.res.events.filter((e) => e.signal === net).map((e) => e.t - at)
    expect(inG(edge('c1')[0])).toBe(2)
    expect(inG(edge('c2')[0])).toBe(4)
    expect(inG(edge('cout')[0])).toBe(64)
    expect(psOf(edge('cout')[0])).toBeCloseTo(2409.6, 6)
    // Two gate delays a bit, measured as the difference between two of them.
    expect(inG(edge('c2')[0] - edge('c1')[0])).toBe(2)
    expect(run.gates).toBe(5 * 32)
  })

  it('settles bit zero long before the top of the word', () => {
    const arrival = arrivalsOf(rippleAdder(32, { a: -1, b: 0 })).arrival
    expect(inG(arrival.s0.long)).toBe(4)
    expect(inG(arrival.cout.long)).toBe(66)
    expect(arrival.s31.long).toBeGreaterThan(arrival.s0.long)
  })
})

describe('the lookahead adder', () => {
  it('adds the same sums as the ripple carry, bit for bit', () => {
    for (const [a, b, cin] of [[5, 7, 0], [-1, 1, 0], [123456, 654321, 1], [-8, 8, 0], [65535, 65535, 1]]) {
      const fast = runNet(lookaheadAdder(32, { a, b, cin }), 200 * G)
      const slow = runNet(rippleAdder(32, { a, b, cin }), 200 * G)
      expect(wordOf(fast.res.final, 's', 32) | 0, `${a} + ${b}`).toBe((a + b + cin) | 0)
      expect(fast.res.final.cout, `${a} + ${b} carry`).toBe(slow.res.final.cout)
    }
  })

  it('brings the top carry down to eight gate delays, a factor of eight', () => {
    const cla = arrivalsOf(lookaheadAdder(32, { a: -1, b: 0 })).arrival
    const ripple = arrivalsOf(rippleAdder(32, { a: -1, b: 0 })).arrival
    expect(inG(cla.cout.long)).toBe(8)
    expect(psOf(cla.cout.long)).toBeCloseTo(301.2, 6)
    // The ripple's carry chain is 64 gate delays, and the lookahead's is 8.
    const chain = ripple.cout.long - ripple.s0.long + 2 * G
    expect(inG(chain)).toBe(64)
    expect(inG(chain) / inG(cla.cout.long)).toBe(8)
    // One four-bit block's generate is four gate delays of that eight.
    expect(inG(cla.b0_G.long)).toBe(4)
    expect(psOf(cla.b0_G.long)).toBeCloseTo(150.6, 6)
  })

  it('pays for the eight in gates, and the sum still waits for the last carry', () => {
    const fast = runNet(lookaheadAdder(32, { a: -1, b: 0 }), 100 * G)
    const slow = runNet(rippleAdder(32, { a: -1, b: 0 }), 100 * G)
    expect(fast.gates).toBeGreaterThan(slow.gates)
    expect(fast.gates).toBe(241)
    expect(slow.gates).toBe(160)
    // The whole sum is longer than the carry, because the top bit's
    // exclusive-or waits for the carry into it.
    expect(inG(pathOf(lookaheadAdder(32, { a: -1, b: 0 })).delay)).toBe(13)
  })
})

describe('the multiplexer, the ALU and the decoder', () => {
  it('costs two gate delays on the data path, which is what the card charges', () => {
    const arrival = arrivalsOf(mux2Net()).arrival
    expect(inG(arrival.y.long - arrival.ns.long)).toBe(2)
    // The data path is an AND and an OR, which is the card's `mux2`.
    expect(inG(arrival.m0.long - arrival.ns.long + G)).toBe(2)
    expect(CARD.blocks.mux2).toBe(2)
    expect(psOf(gates(CARD.blocks.mux2))).toBeCloseTo(75.3, 6)
  })

  it('computes every function through one adder and one output multiplexer', () => {
    const cases = [
      ['add', 12, 5, 17],
      ['sub', 12, 5, 7],
      ['and', 12, 5, 4],
      ['or', 12, 5, 13],
      ['sub', 5, 12, -7],
    ]
    for (const [fn, a, b, want] of cases) {
      const run = runNet(alu32(32, { a, b, fn }), 400 * G)
      expect(wordOf(run.res.final, 'y', 32) | 0, `${fn} ${a} ${b}`).toBe(want)
    }
    // Set on less than is the sign bit of the same subtraction, so it needs no
    // second adder.
    const less = runNet(alu32(32, { a: 5, b: 12, fn: 'sub' }), 400 * G)
    expect(less.res.final.y31).toBe(1)
    const more = runNet(alu32(32, { a: 12, b: 5, fn: 'sub' }), 400 * G)
    expect(more.res.final.y31).toBe(0)
  })

  it('raises exactly one word line for each of the thirty-two addresses', () => {
    for (let addr = 0; addr < 32; addr++) {
      const run = runNet(decoder5to32({ addr }), 40 * G)
      const high = Object.keys(run.res.final).filter((k) => /^w\d+$/.test(k) && run.res.final[k] === 1)
      expect(high, `address ${addr}`).toEqual([`w${addr}`])
    }
    // An inverter and two levels of gates, which is under three gate delays.
    const path = pathOf(decoder5to32({}))
    expect(path.delay).toBe(CARD.inverter + 2 * G)
    expect(psOf(path.delay)).toBeCloseTo(97.89, 6)
    expect(path.gates).toBeLessThan(CARD.blocks.rfRead)
  })

  it('costs a multiply thirty-two cycles, against thirty-two adders in one', () => {
    const period = gates(12) + CARD.tcq + CARD.tsu
    const cost = multiplyCost(32, period)
    expect(cost.cycles).toBe(32)
    expect(cost.adders.loop).toBe(1)
    expect(cost.adders.array).toBe(32)
    expect(psOf(cost.time) / 1000).toBeCloseTo(17.109, 3)
  })
})

describe('the invariants that belong to a netlist (§2.8)', () => {
  it('invariant 4: the critical path is a path in the design, and nothing is longer', () => {
    for (const net of [rippleAdder(8, { a: -1, b: 0 }), lookaheadAdder(32, { a: 5, b: 9 }), decoder5to32({}), mux2Net()]) {
      const norm = normalize(net)
      const paths = timingPaths(norm)
      const path = paths.long.path
      const driverOf = (id) => [...norm.gates, ...norm.wires].find((c) => c.out === id)
      // Every step of the returned path is an input of the step after it.
      for (let k = 1; k < path.length; k++) {
        const cell = driverOf(path[k])
        expect(cell, `${net.name}: ${path[k]} is driven`).toBeTruthy()
        expect(cell.in, `${net.name}: ${path[k - 1]} feeds ${path[k]}`).toContain(path[k - 1])
      }
      // And no endpoint arrives later than the one it reported.
      for (const e of paths.endpoints) expect(e.long, `${net.name}: ${e.signal}`).toBeLessThanOrEqual(paths.long.delay)
      expect(path.length).toBeGreaterThan(1)
    }
  })

  it('invariant 5: the reported period closes, and one unit less does not', () => {
    const net = registeredAdder(8, {})
    const closing = fMax(net)
    // The period is the launching clock-to-Q, the carry chain and the setup
    // time, which is a sum of the card's own numbers.
    expect(closing.tMin).toBe(CARD.tcq + gates(2 + 2 * 8) + CARD.tsu)
    const at = (period) => simulate({ ...registeredAdder(8, { period }) }, { tEnd: 4 * period })
    expect(at(closing.tMin).violations).toEqual([])
    const tight = at(closing.tMin - 1)
    expect(tight.violations.length).toBeGreaterThan(0)
    expect(tight.violations[0].kind).toBe('setup')
    // The hold slack has no period in it at all, so it is the same at both.
    expect(fMax(registeredAdder(8, { period: closing.tMin })).holdSlack).toBe(closing.holdSlack)
  })
})

describe('the units a lesson quotes', () => {
  it('reads a delay in grid units, gate delays and picoseconds, and they agree', () => {
    expect(UNIT).toEqual({ num: 1, den: 1e14 })
    expect(inGates(gates(12))).toBe(12)
    expect(psOf(gates(12))).toBeCloseTo(451.8, 6)
    const path = pathOf(mux2Net())
    expect(path.ps).toBe(psOf(path.units))
    expect(path.gates).toBe(inGates(path.delay))
  })
})
