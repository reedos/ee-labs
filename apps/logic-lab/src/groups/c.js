// Group C: the blocks a datapath is made of.
//
// Four circuits every digital course builds, each with its own truth table and
// its own arrival times. The group ends on the carry chain, which is the first
// time in the lab that a design choice costs measurable time.

import { decoder24, fullAdder, halfAdder, mux2, rippleAdder } from '@ee-labs/events'
import { Bit, Count, GROUPS, Word } from './shared.js'

export const C = [
  {
    id: 'c1',
    group: GROUPS[2],
    name: 'The multiplexer picks one of two',
    terms: ['mux', 'select', 'delay', 'level'],
    params: [Bit('a', 'Input a', 0), Bit('b', 'Input b', 1), Bit('s', 'Select s', 0)],
    net: (p) => mux2({ a: p.a, b: p.b, s: p.s }),
    tEnd: () => 700,
    wants: ['paths', 'table'],
    signals: () => ['a', 'b', 's', 'ns', 'm0', 'm1', 'y'],
    view: 'gates',
    views: ['gates', 'table', 'paths', 'timing'],
  },
  {
    id: 'c2',
    group: GROUPS[2],
    name: 'The decoder raises exactly one line',
    terms: ['decoder', 'onehot', 'complement', 'delay'],
    params: [Bit('a1', 'Address bit a1', 0), Bit('a0', 'Address bit a0', 0)],
    net: (p) => decoder24({ a1: p.a1, a0: p.a0 }),
    tEnd: () => 700,
    wants: ['paths', 'table'],
    signals: () => ['a1', 'a0', 'n1', 'n0', 'd0', 'd1', 'd2', 'd3'],
    view: 'table',
    views: ['table', 'gates', 'paths', 'timing'],
  },
  {
    id: 'c3',
    group: GROUPS[2],
    name: 'The half adder is a sum and a carry',
    terms: ['halfadder', 'xor', 'carry', 'sum'],
    params: [Bit('a', 'Input a', 1), Bit('b', 'Input b', 1)],
    net: (p) => halfAdder({ a: p.a, b: p.b }),
    tEnd: () => 700,
    wants: ['paths', 'table'],
    signals: () => ['a', 'b', 's', 'c'],
    view: 'table',
    views: ['table', 'gates', 'paths', 'timing'],
  },
  {
    id: 'c4',
    group: GROUPS[2],
    name: 'The full adder takes a carry in',
    terms: ['fulladder', 'carry', 'generate', 'propagate'],
    params: [Bit('a', 'Input a', 1), Bit('b', 'Input b', 1), Bit('cin', 'Carry in', 0)],
    net: (p) => fullAdder({ a: p.a, b: p.b, cin: p.cin }),
    tEnd: () => 900,
    wants: ['paths', 'table'],
    signals: () => ['a', 'b', 'cin', 'x', 'g', 'p', 's', 'cout'],
    view: 'paths',
    views: ['paths', 'table', 'gates', 'timing'],
  },
  {
    id: 'c5',
    group: GROUPS[2],
    name: 'Four full adders make an adder',
    terms: ['ripple', 'carry', 'word', 'criticalpath'],
    params: [Word('a', 'Operand a', 7), Word('b', 'Operand b', 5), Bit('cin', 'Carry in', 0)],
    net: (p) => rippleAdder(4, { a: p.a, b: p.b, cin: p.cin }),
    tEnd: () => 1500,
    wants: ['paths'],
    signals: () => ['a0', 'b0', 'cin', 's0', 'c1', 's1', 'c2', 's2', 'c3', 's3', 'cout'],
    busses: () => [
      { label: 'a', signals: ['a3', 'a2', 'a1', 'a0'] },
      { label: 'b', signals: ['b3', 'b2', 'b1', 'b0'] },
      { label: 'sum', signals: ['cout', 's3', 's2', 's1', 's0'] },
    ],
    view: 'paths',
    views: ['paths', 'timing', 'gates', 'events'],
  },
  {
    id: 'c6',
    group: GROUPS[2],
    name: 'The carry chain is what the adder costs',
    terms: ['ripple', 'carry', 'criticalpath', 'width'],
    params: [Count('n', 'Adder width', 4, 1, 8), Word('a', 'Operand a', 7, 8), Word('b', 'Operand b', 5, 8)],
    net: (p) => rippleAdder(p.n, { a: p.a, b: p.b, cin: 0 }),
    tEnd: () => 3000,
    wants: ['paths'],
    signals: (p) => ['a0', 'b0', ...Array.from({ length: p.n }, (_, i) => `s${i}`), 'cout'],
    view: 'paths',
    views: ['paths', 'gates', 'timing', 'events'],
  },
]
