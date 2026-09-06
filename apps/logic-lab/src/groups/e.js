// Group E: the latch and the flip-flop.
//
// The first four groups are about circuits whose output is a function of their
// input. This one opens on the netlist where that stops being true. Two gates
// in a ring have no truth table, and the refusal the engine gives for them is
// what memory is. Everything after it is that ring made usable: gated, then
// gated twice on opposite clock phases, then given the two times that say when
// its input has to be still.

import { dLatch, masterSlave, oneFlop, srLatch, FLOP } from '@ee-labs/events'
import { Bit, Count, Delay, GROUPS, Period } from './shared.js'

const EDGE = 500

/** The two NOR gates of the latch, both at the delay the knob says. */
const latchAt = (net, delay) => ({ ...net, gates: net.gates.map((g) => ({ ...g, delay })) })

export const E = [
  {
    id: 'e1',
    group: GROUPS[4],
    name: 'A ring has no truth table',
    terms: ['ring', 'memory', 'latch', 'truthtable'],
    params: [Bit('q', 'Starting state', 0), Bit('s', 'Input s', 0), Bit('r', 'Input r', 0)],
    net: (p) => srLatch({ s: p.s, r: p.r, q: p.q }),
    tEnd: () => 1000,
    wants: ['table'],
    expects: 'combinational-loop',
    signals: () => ['s', 'r', 'q', 'qn'],
    view: 'gates',
    views: ['gates', 'timing', 'events'],
  },
  {
    id: 'e2',
    group: GROUPS[4],
    name: 'The set-reset latch holds',
    terms: ['setreset', 'memory', 'latch', 'ring'],
    params: [Delay('at', 'Set pulse at', 300, 50, 800), Delay('tnor', 'NOR delay', 50, 10, 200), Bit('q', 'Starting state', 0), Bit('r', 'Input r', 0)],
    // The pulse rises at `at` and falls at twice it, so the run shows the latch
    // both while the pulse is there and after it has gone.
    net: (p) => ({
      ...latchAt(srLatch({ q: p.q }), p.tnor),
      sources: [{ id: 's', kind: 'pattern', period: p.at, at: 0, bits: [0, 1, 0], repeat: false }, { id: 'r', kind: 'input', value: p.r }],
    }),
    tEnd: (p) => 3 * p.at + 600,
    signals: () => ['s', 'r', 'q', 'qn'],
    view: 'timing',
    views: ['timing', 'gates', 'events'],
  },
  {
    id: 'e3',
    group: GROUPS[4],
    name: 'The D latch is transparent',
    terms: ['transparent', 'gatesignal', 'dlatch', 'latch'],
    params: [Period('period', 'Gate period', 1000, 400, 4000), Delay('dstep', 'D step', 200, 50, 600), Delay('tnand', 'NAND delay', 50, 10, 200)],
    net: (p) => ({
      ...dLatch({ q: 0 }),
      gates: dLatch({ q: 0 }).gates.map((g) => (g.kind === 'nand' ? { ...g, delay: p.tnand } : g)),
      sources: [
        { id: 'd', kind: 'pattern', period: p.dstep, at: 0, bits: [0, 1, 1, 1, 0, 0, 0, 0], repeat: false },
        { id: 'g', kind: 'clock', period: p.period, high: Math.round(p.period / 2), phase: 0, init: 0 },
      ],
    }),
    tEnd: (p) => 2 * p.period,
    signals: () => ['g', 'd', 'q', 'qn'],
    view: 'timing',
    views: ['timing', 'gates', 'events'],
  },
  {
    id: 'e4',
    group: GROUPS[4],
    name: 'The flip-flop is two latches',
    terms: ['flipflop', 'edge', 'masterslave', 'dlatch'],
    params: [Period('period', 'Clock period', 2000, 800, 5000), Delay('dstep', 'D step', 500, 50, 900)],
    net: (p) => ({
      ...masterSlave({ d: 0, period: p.period, q: 0 }),
      sources: [
        { id: 'clk', kind: 'clock', period: p.period, high: Math.round(p.period / 2) },
        { id: 'd', kind: 'pattern', period: p.dstep, at: 100, bits: [0, 1, 0, 1, 1, 0, 1, 0], repeat: true },
      ],
    }),
    tEnd: (p) => 3 * p.period,
    signals: () => ['clk', 'd', 'm', 'q'],
    view: 'timing',
    views: ['timing', 'gates', 'events'],
  },
  {
    id: 'e5',
    group: GROUPS[4],
    name: 'Setup and hold are one window',
    terms: ['setup', 'hold', 'window', 'violation'],
    params: [
      Delay('at', 'D step at', EDGE - FLOP.tsu - 60, EDGE - 200, EDGE + 200),
      Delay('tsu', 'Setup time', FLOP.tsu, 1, 150),
      Delay('th', 'Hold time', FLOP.th, 1, 150),
    ],
    net: (p) => oneFlop({ period: 1000, phase: EDGE, at: p.at, tsu: p.tsu, th: p.th }),
    tEnd: () => 2500,
    wants: ['paths'],
    // The one experiment that is a sweep. `window` walks this knob over this
    // range and collects every setting the engine reports a violation at.
    sweep: 'at',
    sweepRange: (p) => [EDGE - 2 * p.tsu - 20, EDGE + 2 * p.th + 20],
    signals: () => ['clk', 'd', 'q'],
    marks: () => [{ t: EDGE, label: 'the edge' }],
    view: 'timing',
    views: ['timing', 'events', 'paths'],
  },
  {
    id: 'e6',
    group: GROUPS[4],
    name: 'A violated setup time is not a value',
    terms: ['violation', 'slack', 'setup', 'assumption'],
    params: [Delay('at', 'D step at', EDGE - FLOP.tsu + 20, EDGE - 200, EDGE + 200), Delay('tsu', 'Setup time', FLOP.tsu, 1, 150), Count('cycles', 'Clock periods shown', 2, 1, 4)],
    net: (p) => oneFlop({ period: 1000, phase: EDGE, at: p.at, tsu: p.tsu }),
    tEnd: (p) => 500 + p.cycles * 1000,
    wants: ['paths'],
    signals: () => ['clk', 'd', 'q'],
    marks: () => [{ t: EDGE, label: 'the edge' }],
    view: 'events',
    views: ['events', 'timing', 'paths'],
  },
]
