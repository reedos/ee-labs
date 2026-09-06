// Group F: registers, counters and the machine built from a specification.
//
// Group E ends with one flip-flop and the two times it asks of its input. This
// group puts several of them on one clock and builds the three things every
// synchronous design is made of: a register that holds a word, a counter that
// walks one, and a machine whose next state is a function of the state it is
// in and what it just read.

import { counter, DETECTOR_101, fsmNet, shiftRegister } from '@ee-labs/events'
import { Count, Delay, GROUPS, Period, Word } from './shared.js'

/** The eight bits of a word, most significant first, as the pattern drives them. */
const bitsOf = (word, n = 8) => Array.from({ length: n }, (_, i) => (word >> (n - 1 - i)) & 1)

/** The 101 detector, with its input driven by a word rather than held. */
const detectorRun = (p) => {
  const base = fsmNet(DETECTOR_101, { period: p.period })
  return {
    ...base,
    sources: base.sources.map((s) => (s.id === 'x' ? { id: 'x', kind: 'pattern', period: p.period, at: Math.round(p.period / 2), bits: bitsOf(p.word), repeat: false } : s)),
  }
}

export const F = [
  {
    id: 'f1',
    group: GROUPS[5],
    name: 'The register moves together',
    terms: ['register', 'shift', 'flipflop', 'edge'],
    params: [Count('n', 'Flip-flops', 4, 2, 8), Period('period', 'Clock period', 1000, 200, 4000)],
    net: (p) => shiftRegister(p.n, { period: p.period }),
    tEnd: (p) => (p.n + 3) * p.period,
    wants: ['closing'],
    period: (p) => p.period,
    signals: (p) => ['clk', 'din', ...Array.from({ length: p.n }, (_, i) => `q${i}`)],
    view: 'timing',
    views: ['timing', 'paths', 'gates', 'events'],
  },
  {
    id: 'f2',
    group: GROUPS[5],
    name: 'The counter counts',
    terms: ['counter', 'toggle', 'wrap', 'register'],
    // The period is 800 ps because a 6-bit counter's enable chain closes at
    // 490 ps, and a counter clocked faster than it closes does not count. That
    // failure is group G's subject, and this experiment is about the sequence.
    params: [Count('n', 'Bits', 4, 2, 6), Period('period', 'Clock period', 800, 500, 2000)],
    net: (p) => counter(p.n, { period: p.period }),
    tEnd: (p) => (2 ** p.n + 2) * p.period,
    wants: ['closing'],
    period: (p) => p.period,
    signals: (p) => ['clk', ...Array.from({ length: p.n }, (_, i) => `q${i}`)],
    busses: (p) => [{ label: 'count', signals: Array.from({ length: p.n }, (_, i) => `q${p.n - 1 - i}`) }],
    view: 'timing',
    views: ['timing', 'gates', 'paths', 'events'],
  },
  {
    id: 'f3',
    group: GROUPS[5],
    name: 'The enable chain is a carry chain',
    terms: ['enable', 'counter', 'criticalpath', 'tmin'],
    params: [Count('n', 'Bits', 4, 2, 8), Delay('tand', 'AND delay', 70, 10, 200), Period('period', 'Clock period', 1000, 200, 4000)],
    // The enable chain is ANDs, so the AND is the knob the whole slope is a
    // function of. Every number this experiment quotes moves when it moves.
    net: (p) => ({ ...counter(p.n, { period: p.period }), lib: { and: { 2: p.tand } } }),
    tEnd: (p) => 6 * p.period,
    wants: ['closing', 'paths'],
    period: (p) => p.period,
    signals: (p) => ['clk', ...Array.from({ length: p.n }, (_, i) => `q${i}`)],
    view: 'paths',
    views: ['paths', 'gates', 'timing', 'events'],
  },
  {
    id: 'f4',
    group: GROUPS[5],
    name: 'A specification is a state table',
    terms: ['statemachine', 'state', 'mealy', 'nextstate'],
    params: [Word('word', 'Input word', 90, 8), Period('period', 'Clock period', 1000, 200, 4000)],
    net: detectorRun,
    spec: () => DETECTOR_101,
    tEnd: (p) => 9 * p.period,
    wants: ['fsm'],
    signals: () => ['clk', 'x', 'q1', 'q0', 'y'],
    view: 'state',
    views: ['state', 'timing', 'gates', 'events'],
  },
  {
    id: 'f5',
    group: GROUPS[5],
    name: 'Encoding, and the codes left over',
    terms: ['encoding', 'statebit', 'dontcare', 'state'],
    params: [Word('word', 'Input word', 90, 8), Period('period', 'Clock period', 1000, 200, 4000)],
    net: detectorRun,
    spec: () => DETECTOR_101,
    tEnd: (p) => 9 * p.period,
    wants: ['fsm'],
    signals: () => ['clk', 'x', 'q1', 'q0'],
    view: 'state',
    views: ['state', 'timing', 'gates', 'events'],
  },
  {
    id: 'f6',
    group: GROUPS[5],
    name: 'The equations, minimised',
    terms: ['nextstate', 'cover', 'literal', 'dontcare'],
    params: [Word('word', 'Input word', 90, 8), Period('period', 'Clock period', 1000, 200, 4000)],
    net: detectorRun,
    spec: () => DETECTOR_101,
    tEnd: (p) => 9 * p.period,
    wants: ['fsm'],
    signals: () => ['clk', 'x', 'q1', 'q0', 'd1', 'y'],
    view: 'gates',
    views: ['gates', 'state', 'timing', 'events'],
  },
  {
    id: 'f7',
    group: GROUPS[5],
    name: 'The machine, built and run',
    terms: ['statemachine', 'detector', 'tmin', 'encoding'],
    params: [Word('word', 'Input word', 90, 8), Period('period', 'Clock period', 1000, 200, 4000)],
    net: detectorRun,
    spec: () => DETECTOR_101,
    tEnd: (p) => 9 * p.period,
    wants: ['fsm', 'closing'],
    period: (p) => p.period,
    signals: () => ['clk', 'x', 'q1', 'q0', 'y'],
    view: 'timing',
    views: ['timing', 'state', 'gates', 'paths', 'events'],
  },
]
