// Group G: the machine and the world.
//
// The bus, the interrupt and Amdahl's law. Every number here is arithmetic
// over the pipelined clock period, so all three move together when the model
// card moves.

import { GROUPS, Count, q } from './shared.js'

export const G = [
  {
    id: 'g1',
    group: GROUPS[6],
    name: 'A bus is an address phase and a data phase',
    terms: ['bus', 'burst', 'addressphase', 'blocksize'],
    params: [Count('lineBytes', 'Line size', 16, 4, 64)],
    wants: ['world'],
    quantities: (x) => ({
      'cycles.single': q('cycles as separate transfers', x.bus.single),
      'cycles.burst': q('cycles as one burst', x.bus.burst),
      'ns.single': q('the same in time', x.bus.singleTime / 1e5),
      'ns.burst': q('the burst in time', x.bus.burstTime / 1e5),
      'share.saved': q('of the transfer a burst saves', x.bus.share),
      'n.words': q('words in the line', x.bus.words),
      'ps.period': q('one bus cycle', x.timing.pipePeriod),
      'cycles.address': q('cycles a burst spends on addresses', 1),
    }),
    main: 'counts',
    view: 'counts',
    views: ['counts', 'budget'],
  },
  {
    id: 'g2',
    group: GROUPS[6],
    name: 'An interrupt costs the pipeline',
    terms: ['interrupt', 'latency', 'flush', 'pipeline'],
    params: [Count('saves', 'Registers saved', 16, 0, 32), Count('rate', 'Interrupts a second', 10000, 100, 100000)],
    program: () => 'save',
    wants: ['world', 'pipe'],
    quantities: (x) => ({
      'cycles.latency': q('cycles one interrupt costs', x.interrupt.cycles),
      'cycles.flush': q('cycles of that which are the flush', x.interrupt.stages),
      'cycles.saves': q('cycles of that which are the saves', x.interrupt.saves),
      'cycles.vector': q('cycles of that which are the vector fetch', x.interrupt.vector),
      'ns.latency': q('the latency in time', x.interrupt.time / 1e5),
      'share.time': q('of the machine’s time at this rate', x.interrupt.share, 'time'),
      'ps.period': q('one cycle', x.timing.pipePeriod),
      'cycles.saveprogram': q('cycles the sixteen stores take pipelined', x.pipe.cycles),
    }),
    main: 'counts',
    view: 'counts',
    views: ['counts', 'schedule', 'program'],
  },
  {
    id: 'g3',
    group: GROUPS[6],
    name: 'Amdahl bounds every improvement',
    terms: ['amdahl', 'speedup', 'bound', 'profile'],
    params: [Count('speedup', 'Adder made faster by', 3, 1, 20)],
    wants: ['world', 'cost'],
    quantities: (x) => ({
      'n.adder': q('speed-up from the faster adder', x.amdahl.adder.speedup),
      'n.memory': q('speed-up from memory twice as fast', x.amdahl.memory.speedup),
      'n.branch': q('speed-up from removing every branch penalty', x.amdahl.branch.speedup),
      'n.bound': q('the bound on the adder’s speed-up', x.amdahl.adder.bound),
      'share.adder': q('of the time the adder takes', x.amdahl.adder.p),
      'share.rest': q('of the time the adder does not touch', 1 - x.amdahl.adder.p),
      'share.memory': q('of the time memory takes', x.amdahl.memory.p),
      'share.branch': q('of the time the branch penalty takes', x.amdahl.branch.p),
      'n.factor': q('how much faster the adder was made', x.amdahl.adder.s),
      'n.cpi': q('cycles an instruction over the mix', x.cost.on.cpi),
    }),
    main: 'counts',
    view: 'counts',
    views: ['counts', 'budget'],
  },
]
