// Group G: the clock.
//
// Everything before this measured a delay. This group measures what a delay
// costs, which is the period the design has to be clocked at and the frequency
// that follows from it. The netlist throughout is the adder of group C put
// between two registers, so the carry chain group C timed is the thing that
// sets the clock here.

import { pipelinedAdder } from '@ee-labs/events'
import { Count, Delay, GROUPS, Period } from './shared.js'

const adder = (p) => pipelinedAdder(p.n, { period: p.period, a: 11, b: 7, skew: p.skew || 0 })

export const G = [
  {
    id: 'g1',
    group: GROUPS[6],
    name: 'The critical path sets the period',
    terms: ['tmin', 'fmax', 'criticalpath', 'register'],
    params: [Count('n', 'Adder width', 4, 2, 32), Period('period', 'Clock period', 1000, 500, 5000)],
    net: adder,
    tEnd: (p) => 4 * p.period,
    wants: ['closing', 'paths'],
    period: (p) => p.period,
    signals: (p) => ['clk', ...Array.from({ length: p.n }, (_, i) => `s${i}`).slice(0, 4), 'cout', 'rc'],
    busses: (p) => [{ label: 'sum', signals: [...Array.from({ length: p.n }, (_, i) => `r${p.n - 1 - i}`)] }],
    view: 'paths',
    views: ['paths', 'timing', 'gates', 'events'],
  },
  {
    id: 'g2',
    group: GROUPS[6],
    name: 'Width costs frequency',
    terms: ['tmin', 'fmax', 'ripple', 'carry'],
    params: [Count('n', 'Adder width', 4, 2, 32), Period('period', 'Clock period', 5000, 500, 5000)],
    net: adder,
    tEnd: (p) => 3 * p.period,
    wants: ['closing', 'paths'],
    period: (p) => p.period,
    signals: () => ['clk', 'cout', 'rc'],
    view: 'paths',
    views: ['paths', 'gates', 'timing', 'events'],
  },
  {
    id: 'g3',
    group: GROUPS[6],
    name: 'Less logic between registers is faster',
    terms: ['pipeline', 'latency', 'tmin', 'fmax'],
    params: [Count('n', 'Bits between registers', 2, 2, 32), Period('period', 'Clock period', 5000, 500, 5000)],
    net: adder,
    tEnd: (p) => 3 * p.period,
    wants: ['closing', 'paths'],
    period: (p) => p.period,
    signals: () => ['clk', 'cout', 'rc'],
    view: 'paths',
    views: ['paths', 'gates', 'timing', 'events'],
  },
  {
    id: 'g4',
    group: GROUPS[6],
    name: 'Skew moves both checks at once',
    terms: ['skew', 'holdslack', 'tmin', 'slack'],
    params: [Delay('skew', 'Clock skew', 50, 0, 300), Count('n', 'Adder width', 4, 2, 32), Period('period', 'Clock period', 1000, 500, 5000)],
    net: adder,
    tEnd: (p) => 4 * p.period,
    wants: ['closing', 'paths'],
    period: (p) => p.period,
    signals: (p) => ['clk', ...(p.skew > 0 ? ['clk2'] : []), 'cout', 'rc'],
    view: 'paths',
    views: ['paths', 'timing', 'gates', 'events'],
  },
  {
    id: 'g5',
    group: GROUPS[6],
    name: 'A hold failure is not fixed by slowing down',
    terms: ['holdslack', 'setupslack', 'skew', 'hold'],
    params: [Period('period', 'Clock period', 1000, 500, 5000), Delay('skew', 'Clock skew', 0, 0, 300), Count('n', 'Adder width', 4, 2, 32)],
    net: adder,
    tEnd: (p) => 4 * p.period,
    wants: ['closing', 'paths'],
    period: (p) => p.period,
    signals: (p) => ['clk', ...(p.skew > 0 ? ['clk2'] : []), 'cout', 'rc'],
    view: 'paths',
    views: ['paths', 'timing', 'gates', 'events'],
  },
]
