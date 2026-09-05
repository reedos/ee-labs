// Group A: gates and truth tables.
//
// The first six screens of the lab. A gate maps one set of input values onto
// one output value, and it takes time to do it. Both halves of that sentence
// are measured from the first experiment on.

import { hazardNet, nandOnly } from '@ee-labs/events'
import { Bit, Choice, Delay, GROUPS } from './shared.js'

export const A = [
  {
    id: 'a1',
    group: GROUPS[0],
    name: 'One gate, and the time it takes',
    terms: ['gate', 'signal', 'inverter', 'delay', 'event'],
    params: [Bit('a', 'Input a starts at', 0), Delay('tnot', 'Inverter delay', 30)],
    net: (p) => ({
      name: 'an inverter',
      sources: [{ id: 'a', kind: 'step', at: 200, from: p.a, to: p.a ^ 1 }],
      gates: [{ id: 'y', kind: 'not', in: ['a'], delay: p.tnot }],
      outputs: ['y'],
    }),
    tEnd: () => 600,
    wants: ['paths', 'table'],
    signals: () => ['a', 'y'],
    view: 'timing',
    views: ['timing', 'gates', 'table', 'events'],
  },
  {
    id: 'a2',
    group: GROUPS[0],
    name: 'AND and OR, and the table that defines them',
    terms: ['gate', 'truthtable', 'and', 'or', 'delay'],
    params: [Bit('a', 'Input a', 1), Bit('b', 'Input b starts at', 0), Delay('tand', 'AND delay', 70), Delay('tor', 'OR delay', 70)],
    net: (p) => ({
      name: 'an AND and an OR on the same two inputs',
      sources: [{ id: 'a', kind: 'input', value: p.a }, { id: 'b', kind: 'step', at: 200, from: p.b, to: p.b ^ 1 }],
      gates: [
        { id: 'yand', kind: 'and', in: ['a', 'b'], delay: p.tand },
        { id: 'yor', kind: 'or', in: ['a', 'b'], delay: p.tor },
      ],
      outputs: ['yand', 'yor'],
    }),
    tEnd: () => 600,
    wants: ['paths', 'table'],
    signals: () => ['a', 'b', 'yand', 'yor'],
    view: 'table',
    views: ['table', 'timing', 'gates', 'events'],
  },
  {
    id: 'a3',
    group: GROUPS[0],
    name: 'NAND is faster than AND, and why',
    terms: ['nand', 'nor', 'inverter', 'delay', 'level'],
    params: [Bit('a', 'Input a', 1), Bit('b', 'Input b starts at', 0), Delay('tnand', 'NAND delay', 50), Delay('tnot', 'Inverter delay', 30)],
    net: (p) => ({
      name: 'a NAND, and the AND it becomes with an inverter',
      sources: [{ id: 'a', kind: 'input', value: p.a }, { id: 'b', kind: 'step', at: 200, from: p.b, to: p.b ^ 1 }],
      gates: [
        { id: 'n', kind: 'nand', in: ['a', 'b'], delay: p.tnand },
        { id: 'ni', kind: 'not', in: ['n'], delay: p.tnot },
        { id: 'aa', kind: 'and', in: ['a', 'b'] },
      ],
      outputs: ['n', 'ni', 'aa'],
    }),
    tEnd: () => 600,
    wants: ['paths', 'table'],
    signals: () => ['a', 'b', 'n', 'ni', 'aa'],
    view: 'timing',
    views: ['timing', 'table', 'gates', 'events'],
  },
  {
    id: 'a4',
    group: GROUPS[0],
    name: 'One kind of gate is enough',
    terms: ['nand', 'universal', 'gate', 'delay'],
    params: [
      Choice('which', 'Function', 'xor', [
        { value: 'not', label: 'inverter' },
        { value: 'and', label: 'AND' },
        { value: 'or', label: 'OR' },
        { value: 'xor', label: 'XOR' },
      ]),
      Bit('a', 'Input a', 0),
      Bit('b', 'Input b', 1),
    ],
    net: (p) => nandOnly(p.which, { a: p.a, b: p.b, reference: true }),
    tEnd: () => 600,
    wants: ['paths', 'table'],
    signals: (p) => (p.which === 'not' ? ['a', 'y', 'ref'] : ['a', 'b', 'y', 'ref']),
    view: 'gates',
    views: ['gates', 'table', 'timing', 'events'],
  },
  {
    id: 'a5',
    group: GROUPS[0],
    name: 'The truth table of a whole netlist',
    terms: ['truthtable', 'minterm', 'netlist', 'signal'],
    params: [Bit('a', 'Input a', 1), Bit('b', 'Input b', 1), Bit('c', 'Input c', 1)],
    net: (p) => hazardNet({ a: p.a, b: p.b, c: p.c }),
    tEnd: () => 600,
    wants: ['paths', 'table'],
    signals: () => ['a', 'b', 'c', 'na', 'p', 'q', 'y'],
    view: 'table',
    views: ['table', 'gates', 'timing', 'events'],
  },
  {
    id: 'a6',
    group: GROUPS[0],
    name: 'A wire takes time and changes nothing',
    terms: ['wire', 'buffer', 'delay', 'fanout'],
    params: [Bit('a', 'Input a starts at', 0), Delay('tbuf', 'Buffer delay', 40), Delay('twire', 'Wire delay', 10, 1, 200)],
    net: (p) => ({
      name: 'a buffer and a wire from one source',
      sources: [{ id: 'a', kind: 'step', at: 200, from: p.a, to: p.a ^ 1 }],
      gates: [{ id: 'buf', kind: 'buf', in: ['a'], delay: p.tbuf }],
      wires: [{ id: 'w', from: 'a', delay: p.twire }],
      outputs: ['buf', 'w'],
    }),
    tEnd: () => 600,
    wants: ['paths'],
    signals: () => ['a', 'w', 'buf'],
    view: 'timing',
    views: ['timing', 'gates', 'events'],
  },
]
