// Group B: the register file and the memory block.
//
// Two arrays of cells, each with a delay the model card states rather than
// simulates. B1's decoder is the one part of a register file small enough to
// build out of gates, and the engine times it. The card's eight gate delays
// for a read cover that decode, the cell, and the read multiplexer.

import { decoder5to32 } from '../engine/blocks.js'
import { gates } from '../engine/card.js'
import { Count, GROUPS, Switch, q } from './shared.js'

export const B = [
  {
    id: 'b1',
    group: GROUPS[1],
    name: 'A decoder turns five bits into one line',
    terms: ['decoder', 'wordline', 'registerfile', 'gatedelay'],
    params: [Count('addr', 'Register number', 13, 0, 31)],
    net: (p, card) => decoder5to32({ addr: p.addr, card }),
    tEnd: (p, card) => 40 * card.gate,
    quantities: (x) => {
      const high = Object.keys(x.res.final).filter((k) => /^w\d+$/.test(k) && x.res.final[k] === 1)
      return {
        'ps.decode': q('the word line rises', x.paths.long.delay),
        'g.decode': q('the same, in gate delays', x.paths.long.delay / x.card.gate),
        'n.high': q('word lines high', high.length),
        'text.line': q('the line this address raises', high[0] || 'none'),
        'n.gates': q('gates in the decoder', x.norm.gates.length),
        'n.lines': q('word lines', 32),
        'ps.read': q('a whole register file read, from the card', gates(x.card.blocks.rfRead, x.card)),
        'g.read': q('the read, in gate delays', x.card.blocks.rfRead),
      }
    },
    main: 'paths',
    view: 'paths',
    views: ['paths', 'counts'],
  },
  {
    id: 'b2',
    group: GROUPS[1],
    name: 'Two reads and one write, at once',
    terms: ['registerfile', 'readport', 'writeport', 'forwarding'],
    params: [Switch('forwarding', 'Forwarding', 1, 'on', 'off')],
    program: () => 'chain',
    wants: ['run', 'pipe'],
    quantities: (x) => ({
      'ps.read': q('a read, from the card', gates(x.card.blocks.rfRead, x.card)),
      'g.read': q('the read, in gate delays', x.card.blocks.rfRead),
      'ps.write': q('a write, from the card', gates(x.card.blocks.rfWrite, x.card)),
      'g.write': q('the write, in gate delays', x.card.blocks.rfWrite),
      'n.ports': q('ports the file needs at once', 3),
      'n.cells': q('cells in the file', 32 * 32),
      'n.result': q('what the third instruction wrote', x.pipe.regs[5]),
      'cycles.run': q('cycles the three take', x.pipe.cycles),
      'n.stalls': q('cycles the hazard unit inserted', x.pipe.stallCycles),
    }),
    main: 'schedule',
    view: 'schedule',
    views: ['schedule', 'program', 'counts'],
  },
  {
    id: 'b3',
    group: GROUPS[1],
    name: 'Memory is a block with a delay',
    terms: ['memory', 'accesstime', 'criticalpath', 'gatedelay'],
    params: [Count('access', 'Memory access', 12, 4, 24)],
    card: (p, base) => ({ ...base, blocks: { ...base.blocks, imem: p.access, dmem: p.access } }),
    program: () => 'loadOne',
    wants: ['run'],
    quantities: (x) => ({
      'ps.access': q('one memory access', gates(x.card.blocks.dmem, x.card)),
      'g.access': q('the same, in gate delays', x.card.blocks.dmem),
      'n.appearances': q('times it appears in the datapath', 2),
      'share.period': q('share of the one-cycle period it takes', x.timing.memoryShare),
      'ps.single': q('the one-cycle period', x.timing.singlePeriod),
      'ps.stage': q('the pipelined period it also sets', x.timing.pipePeriod),
      'n.words': q('words in the memory', 256),
    }),
    main: 'budget',
    view: 'budget',
    views: ['budget', 'datapath', 'counts'],
  },
]
