// Group A: arithmetic, where the delay is.
//
// The only group whose numbers come from a netlist rather than from the model
// card's table of blocks. Each experiment builds a real adder for
// `@ee-labs/events`, and the engine times it. A ripple carry is 64 gate delays
// because the engine added 32 carries of two gates each.

import { alu32, lookaheadAdder, multiplyCost, rippleAdder } from '../engine/blocks.js'
import { gates } from '../engine/card.js'
import { Choice, Count, GROUPS, q } from './shared.js'

/** The instant the carry-in steps, in grid units, well after everything settles. */
const STEP_AT = (card) => 100 * card.gate

export const A = [
  {
    id: 'a1',
    group: GROUPS[0],
    name: 'The carry is the critical path',
    terms: ['ripplecarry', 'gatedelay', 'carry', 'criticalpath'],
    // Every propagate is on, so the carry crosses the whole word and the
    // reader can watch it. Operands that generate their own carries would
    // settle the answer without the chain, which is A2's lesson rather than
    // this one's.
    params: [Count('width', 'Adder width', 32, 2, 32)],
    net: (p, card) => rippleAdder(p.width, { a: -1, b: 0, cin: 0, step: 'cin', at: STEP_AT(card), card }),
    tEnd: (p, card) => STEP_AT(card) + (4 * p.width + 20) * card.gate,
    signals: (p) => ['cin', 'c1', 'c2', `c${Math.min(p.width - 1, 3)}`, 'cout', 's0', `s${p.width - 1}`],
    quantities: (x) => {
      const at = STEP_AT(x.card)
      const edge = (net) => (x.res.events.find((e) => e.signal === net) || {}).t - at
      const carry = edge('cout')
      return {
        'ps.carry': q('carry in to carry out', carry),
        'g.carry': q('the same, in gate delays', carry / x.card.gate),
        'ps.perbit': q('one bit of the chain', edge('c2') - edge('c1')),
        'g.perbit': q('one bit, in gate delays', (edge('c2') - edge('c1')) / x.card.gate),
        'ps.first': q('the first carry out', edge('c1')),
        'ps.bit0': q('sum bit 0 settles', x.paths.arrival.s0.long),
        'ps.top': q('the top of the word settles', x.paths.arrival[`s${x.p.width - 1}`].long),
        'n.gates': q('gates in the adder', x.norm.gates.length),
        'n.width': q('bits', x.p.width),
      }
    },
    main: 'timing',
    view: 'timing',
    views: ['timing', 'paths', 'counts'],
  },
  {
    id: 'a2',
    group: GROUPS[0],
    name: 'Look ahead, and pay in gates',
    terms: ['lookahead', 'generate', 'propagate', 'ripplecarry'],
    // The lookahead adder is 32 bits, and the knob widens the ripple-carry
    // adder it is measured against. At four bits the two carries cost the
    // same, which is where the lookahead stops being worth its gates.
    params: [Count('width', 'Ripple adder width', 32, 2, 32)],
    net: (p, card) => lookaheadAdder(32, { a: -1, b: 0, cin: 0, card }),
    alt: (p, card) => rippleAdder(p.width, { a: -1, b: 0, cin: 0, card }),
    tEnd: (p, card) => 200 * card.gate,
    quantities: (x) => {
      const cla = x.paths.arrival.cout.long
      // The ripple's carry chain is its carry out less the partial sum that
      // starts it, which is where the chain begins.
      const chain = x.alt.paths.arrival.cout.long - x.alt.paths.arrival.s0.long + 2 * x.card.gate
      return {
        'ps.lookahead': q('lookahead carry out', cla),
        'g.lookahead': q('the same, in gate delays', cla / x.card.gate),
        'ps.ripple': q('ripple carry chain', chain),
        'g.ripple': q('the same, in gate delays', chain / x.card.gate),
        'n.factor': q('how much faster the carry is', chain / cla),
        'ps.block': q('one four-bit block generates', x.paths.arrival.b0_G.long),
        'g.block': q('the same, in gate delays', x.paths.arrival.b0_G.long / x.card.gate),
        'n.gates': q('gates in the lookahead adder', x.norm.gates.length),
        'n.gatesripple': q('gates in the ripple adder', x.alt.norm.gates.length),
        'n.gateratio': q('gates, one against the other', x.norm.gates.length / x.alt.norm.gates.length),
        'n.width': q('bits in the ripple adder', x.p.width),
        'ps.sum': q('the whole sum settles', x.paths.long.delay),
      }
    },
    main: 'paths',
    view: 'paths',
    views: ['paths', 'counts'],
  },
  {
    id: 'a3',
    group: GROUPS[0],
    name: 'The ALU is a multiplexer over functions',
    terms: ['alu', 'multiplexer', 'twoscomplement', 'gatedelay'],
    params: [
      Choice('fn', 'Operation', 'add', [
        { value: 'add', label: 'add' },
        { value: 'sub', label: 'subtract' },
        { value: 'and', label: 'and' },
        { value: 'or', label: 'or' },
      ]),
      Count('a', 'Operand a', 12, 0, 64),
      Count('b', 'Operand b', 5, 0, 64),
    ],
    net: (p, card) => alu32(32, { a: p.a, b: p.b, fn: p.fn, card }),
    tEnd: (p, card) => 400 * card.gate,
    quantities: (x) => {
      const out = (() => {
        let acc = 0
        for (let i = 31; i >= 0; i--) acc = acc * 2 + x.res.final[`y${i}`]
        return acc | 0
      })()
      return {
        'ps.alu': q('the ALU output settles', x.paths.long.delay),
        'g.alu': q('the same, in gate delays', x.paths.long.delay / x.card.gate),
        'ps.mux': q('the output multiplexer', gates(x.card.blocks.mux2, x.card)),
        'g.mux': q('the multiplexer, in gate delays', x.card.blocks.mux2),
        'ps.carry': q('the adder’s lookahead carry', gates(x.card.blocks.aluCarry, x.card)),
        'g.carry': q('the carry, in gate delays', x.card.blocks.aluCarry),
        'n.result': q('what it computed', out),
        'n.gates': q('gates in the unit', x.norm.gates.length),
        'n.sign': q('the sign bit of the result', x.res.final.y31),
      }
    },
    main: 'paths',
    view: 'paths',
    views: ['paths', 'counts'],
  },
  {
    id: 'a4',
    group: GROUPS[0],
    name: 'Multiplication is a loop',
    terms: ['shiftandadd', 'throughput', 'gatedelay', 'alu'],
    params: [Count('width', 'Product width', 32, 4, 32)],
    quantities: (x) => {
      const cost = multiplyCost(x.p.width, x.timing.pipePeriod)
      return {
        'cycles.multiply': q('cycles a multiply takes', cost.cycles),
        'ps.period': q('one cycle', x.timing.pipePeriod),
        'ns.multiply': q('the whole multiply', cost.time / 1e5),
        'n.loop': q('adders in the loop', cost.adders.loop),
        'n.array': q('adders in a one-cycle array', cost.adders.array),
        'ps.add': q('one addition, as a lookahead carry', gates(x.card.blocks.aluCarry, x.card)),
      }
    },
    main: 'counts',
    view: 'counts',
    views: ['counts', 'budget'],
  },
]
