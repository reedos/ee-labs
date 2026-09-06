// Group D: delay, glitches and hazards.
//
// The first three groups treat a circuit as a truth table with a number beside
// it. This one is about the interval where the truth table is not yet true.
// Every experiment steps one input and watches what the output does before it
// settles on the row the table promises.

import { chain, hazardNet, rippleAdder } from '@ee-labs/events'
import { Bit, Count, Delay, GROUPS, MODE, Word } from './shared.js'

const STEP_AT = 200

/** The hazard netlist with `a` stepping from 1 to 0, which is the case that glitches. */
const fallingA = (p, consensus) => {
  const base = hazardNet({ a: 1, b: p.b, c: p.c, consensus })
  return {
    ...base,
    delayMode: p.mode || 'transport',
    sources: base.sources.map((s) => (s.id === 'a' ? { id: 'a', kind: 'step', at: STEP_AT, from: 1, to: 0 } : s)),
    gates: base.gates.map((g) => (g.id === 'na' ? { ...g, delay: p.tnot } : g)),
  }
}

export const D = [
  {
    id: 'd1',
    group: GROUPS[3],
    name: 'Delay along a path is a sum',
    terms: ['delay', 'criticalpath', 'level', 'arrival'],
    params: [Count('n', 'Gates in the chain', 4, 1, 8), Delay('tbuf', 'Buffer delay', 40)],
    net: (p) => chain(p.n, { kind: 'buf', at: STEP_AT, delay: p.tbuf }),
    tEnd: () => 1200,
    wants: ['paths'],
    signals: (p) => ['a', ...Array.from({ length: p.n }, (_, i) => `g${i + 1}`)],
    view: 'timing',
    views: ['timing', 'paths', 'gates', 'events'],
  },
  {
    id: 'd2',
    group: GROUPS[3],
    name: 'Two paths from one input',
    terms: ['reconvergent', 'arrival', 'inverter', 'criticalpath'],
    params: [Bit('b', 'Input b', 1), Bit('c', 'Input c', 1), Delay('tnot', 'Inverter delay', 30)],
    net: (p) => fallingA(p, false),
    tEnd: () => 700,
    wants: ['paths'],
    signals: () => ['a', 'na', 'p', 'q', 'y'],
    view: 'paths',
    views: ['paths', 'timing', 'gates', 'events'],
  },
  {
    id: 'd3',
    group: GROUPS[3],
    name: 'The glitch, and how wide it is',
    terms: ['glitch', 'hazard', 'static1', 'pulse'],
    params: [Bit('b', 'Input b', 1), Bit('c', 'Input c', 1), Delay('tnot', 'Inverter delay', 30)],
    net: (p) => fallingA(p, false),
    tEnd: () => 700,
    wants: ['paths', 'table'],
    signals: () => ['a', 'na', 'p', 'q', 'y'],
    spans: (x) => {
      const es = x.res.events.filter((e) => e.signal === 'y')
      return es.length >= 2 ? [{ from: es[0].t, to: es[1].t, signal: 'y', label: 'the glitch' }] : []
    },
    view: 'timing',
    views: ['timing', 'paths', 'gates', 'events'],
  },
  {
    id: 'd4',
    group: GROUPS[3],
    name: 'The consensus term covers the hazard',
    terms: ['consensus', 'hazard', 'cover', 'kmap'],
    params: [Bit('b', 'Input b', 1), Bit('c', 'Input c', 1), Bit('cover', 'Consensus term', 1)],
    net: (p) => fallingA({ ...p, tnot: 30 }, !!p.cover),
    tEnd: () => 700,
    wants: ['paths', 'table'],
    signals: (p) => (p.cover ? ['a', 'na', 'p', 'q', 'r', 'y'] : ['a', 'na', 'p', 'q', 'y']),
    view: 'timing',
    views: ['timing', 'gates', 'paths', 'events'],
  },
  {
    id: 'd5',
    group: GROUPS[3],
    name: 'An inertial gate swallows a narrow pulse',
    terms: ['transport', 'inertial', 'pulse', 'swallowed'],
    params: [MODE('transport'), Bit('b', 'Input b', 1), Bit('c', 'Input c', 1), Delay('tnot', 'Inverter delay', 30)],
    net: (p) => fallingA(p, false),
    tEnd: () => 700,
    wants: ['paths'],
    signals: () => ['a', 'na', 'p', 'q', 'y'],
    view: 'timing',
    views: ['timing', 'events', 'gates', 'paths'],
  },
  {
    id: 'd6',
    group: GROUPS[3],
    name: 'The adder is wrong until it settles',
    terms: ['ripple', 'carry', 'settle', 'glitch'],
    params: [Word('a', 'Operand a', 7), Delay('at', 'Step at', 1000, 200, 2000)],
    net: (p) => {
      const base = rippleAdder(4, { a: p.a, b: 0, cin: 0 })
      return { ...base, sources: base.sources.map((s) => (s.id === 'b0' ? { id: 'b0', kind: 'step', at: p.at, from: 0, to: 1 } : s)) }
    },
    tEnd: (p) => p.at + 2000,
    wants: ['paths'],
    signals: () => ['b0', 's0', 'c1', 's1', 'c2', 's2', 'c3', 's3', 'cout'],
    busses: () => [{ label: 'sum', signals: ['cout', 's3', 's2', 's1', 's0'] }],
    view: 'timing',
    views: ['timing', 'events', 'paths', 'gates'],
  },
]
