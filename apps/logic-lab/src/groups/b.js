// Group B: Boolean algebra, the Karnaugh map, and what minimisation is worth.
//
// Every experiment here has the same shape. Two circuits with the same truth
// table and different costs, or one function written two ways. The table is
// what makes them the same, and the gate count and the delay are what make one
// of them better.

import { identityNet, minimalCover, mux2, netFromCover, primeImplicants } from '@ee-labs/events'
import { Bit, Choice, GROUPS } from './shared.js'

/** The three functions group B minimises, as their minterm sets over a, b, c. */
export const FUNCTIONS = {
  six: { label: 'Σ(0,1,2,5,6,7)', minterms: [0, 1, 2, 5, 6, 7] },
  majority: { label: 'majority', minterms: [3, 5, 6, 7] },
  parity: { label: 'odd parity', minterms: [1, 2, 4, 7] },
}

const NAMES = ['a', 'b', 'c']

/** The netlist of `which` function in `form`: every minterm, or the minimum cover. */
export function sopNet(which, form, values) {
  const minterms = FUNCTIONS[which].minterms
  const cover =
    form === 'canonical' ? minterms.map((m) => ({ mask: 0b111, bits: m })) : minimalCover(minterms, primeImplicants(minterms, 3), 3).cover
  return netFromCover(cover, NAMES, { values, name: `${FUNCTIONS[which].label}, ${form}` })
}

const FUNCTION_KNOB = Choice(
  'fn',
  'Function',
  'six',
  Object.entries(FUNCTIONS).map(([value, f]) => ({ value, label: f.label })),
)
const FORM_KNOB = (def) =>
  Choice('form', 'Written as', def, [
    { value: 'canonical', label: 'every minterm' },
    { value: 'minimal', label: 'the minimum' },
  ])

export const B = [
  {
    id: 'b1',
    group: GROUPS[1],
    name: 'An identity is two circuits and one table',
    terms: ['identity', 'truthtable', 'absorption', 'literal'],
    params: [
      Choice('law', 'Identity', 'absorption', [
        { value: 'absorption', label: 'absorption' },
        { value: 'distribution', label: 'distribution' },
      ]),
      Bit('a', 'Input a', 1),
      Bit('b', 'Input b', 0),
      Bit('c', 'Input c', 1),
    ],
    net: (p) => identityNet(p.law, { a: p.a, b: p.b, c: p.c }),
    tEnd: () => 600,
    wants: ['paths', 'table'],
    signals: (p) => (p.law === 'absorption' ? ['a', 'b', 'ab', 'lhs', 'rhs'] : ['a', 'b', 'c', 'bc', 'ab', 'ac', 'lhs', 'rhs']),
    view: 'table',
    views: ['table', 'gates', 'timing', 'events'],
  },
  {
    id: 'b2',
    group: GROUPS[1],
    name: 'De Morgan, and what each side costs',
    terms: ['demorgan', 'nand', 'complement', 'level'],
    params: [Bit('a', 'Input a', 1), Bit('b', 'Input b', 1)],
    net: (p) => identityNet('demorgan', { a: p.a, b: p.b }),
    tEnd: () => 600,
    wants: ['paths', 'table'],
    signals: () => ['a', 'b', 'na', 'nb', 'lhs', 'rhs'],
    view: 'gates',
    views: ['gates', 'table', 'timing', 'events'],
  },
  {
    id: 'b3',
    group: GROUPS[1],
    name: 'Every minterm, written out',
    terms: ['minterm', 'sop', 'literal', 'fanin'],
    params: [FUNCTION_KNOB, Bit('a', 'Input a', 0), Bit('b', 'Input b', 1), Bit('c', 'Input c', 1)],
    net: (p) => sopNet(p.fn, 'canonical', [p.a, p.b, p.c]),
    tEnd: () => 900,
    wants: ['paths', 'table', 'minimise'],
    signals: () => ['a', 'b', 'c', 'y'],
    view: 'table',
    views: ['table', 'gates', 'kmap', 'events'],
  },
  {
    id: 'b4',
    group: GROUPS[1],
    name: 'The map, and the loops on it',
    terms: ['kmap', 'gray', 'implicant', 'prime', 'cover'],
    params: [FUNCTION_KNOB, Bit('a', 'Input a', 0), Bit('b', 'Input b', 1), Bit('c', 'Input c', 1)],
    net: (p) => sopNet(p.fn, 'minimal', [p.a, p.b, p.c]),
    tEnd: () => 900,
    wants: ['paths', 'table', 'minimise'],
    signals: () => ['a', 'b', 'c', 'y'],
    view: 'kmap',
    views: ['kmap', 'table', 'gates', 'events'],
  },
  {
    id: 'b5',
    group: GROUPS[1],
    name: 'The minimum, built and timed',
    terms: ['cover', 'literal', 'level', 'delay'],
    params: [FUNCTION_KNOB, FORM_KNOB('minimal'), Bit('a', 'Input a', 0), Bit('b', 'Input b', 1), Bit('c', 'Input c', 1)],
    net: (p) => sopNet(p.fn, p.form, [p.a, p.b, p.c]),
    tEnd: () => 900,
    wants: ['paths', 'table', 'minimise'],
    signals: () => ['a', 'b', 'c', 'y'],
    view: 'gates',
    views: ['gates', 'kmap', 'table', 'events'],
  },
  {
    id: 'b6',
    group: GROUPS[1],
    name: 'The multiplexer is a minimum cover',
    terms: ['mux', 'cover', 'literal', 'minterm'],
    params: [Bit('a', 'Input a', 0), Bit('b', 'Input b', 1), Bit('s', 'Select s', 0)],
    net: (p) => mux2({ a: p.a, b: p.b, s: p.s }),
    tEnd: () => 600,
    wants: ['paths', 'table', 'minimise'],
    signals: () => ['a', 'b', 's', 'ns', 'm0', 'm1', 'y'],
    view: 'kmap',
    views: ['kmap', 'table', 'gates', 'events'],
  },
]
