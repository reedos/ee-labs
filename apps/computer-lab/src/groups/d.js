// Group D: control.
//
// The single-cycle machine's control is one truth table of twelve rows. The
// multicycle machine's is a state machine, which is the Logic Lab's own
// subject doing a job here.

import { gates } from '../engine/card.js'
import { SEQUENCE, cyclesOf } from '../engine/control.js'
import { OP_NAMES } from '../engine/isa.js'
import { Choice, Count, GROUPS, q } from './shared.js'

export const D = [
  {
    id: 'd1',
    group: GROUPS[3],
    name: 'Control is a truth table',
    terms: ['controlsignal', 'opcode', 'truthtable', 'decoder'],
    params: [Choice('op', 'Instruction', 'lw', OP_NAMES.map((op) => ({ value: op, label: op })))],
    wants: ['control'],
    quantities: (x) => {
      const row = x.control.rows.find((r) => r.op === x.p.op)
      const ones = x.control.signals.filter((s) => row.out[s] === 1).length
      return {
        'n.signals': q('control signals', x.control.signals.length),
        'n.rows': q('rows in the table', x.control.rows.length),
        'ps.control': q('the decode this table costs', gates(x.card.blocks.control, x.card)),
        'g.control': q('the same, in gate delays', x.card.blocks.control),
        'n.ones': q('signals this instruction asserts', ones),
        'n.regwrite': q('RegWrite for this instruction', row.out.regWrite),
        'n.memread': q('MemRead for this instruction', row.out.memRead),
        'n.alusrc': q('ALUSrc for this instruction', row.out.aluSrc),
        'text.class': q('the class it belongs to', row.cls),
      }
    },
    main: 'control',
    view: 'control',
    views: ['control', 'datapath', 'counts'],
  },
  {
    id: 'd2',
    group: GROUPS[3],
    name: 'The multicycle machine is a state machine',
    terms: ['statemachine', 'multicycle', 'state', 'controlsignal'],
    params: [Count('cycle', 'Cycle', 4, 0, 30)],
    program: () => 'mixed',
    wants: ['multi', 'machine', 'run'],
    quantities: (x) => {
      const row = x.walk.rows[Math.min(x.p.cycle, x.walk.rows.length - 1)]
      return {
        'n.states': q('states the machine has', x.machine.states.length),
        'cycles.arith': q('cycles an arithmetic instruction takes', cyclesOf('arith')),
        'cycles.load': q('cycles a load takes', cyclesOf('load')),
        'cycles.store': q('cycles a store takes', cyclesOf('store')),
        'cycles.branch': q('cycles a branch takes', cyclesOf('branch')),
        'cycles.walk': q('cycles this program takes', x.walk.cycles),
        'n.retired': q('instructions in it', x.walk.retired),
        'n.cpiwalk': q('cycles an instruction, on this program', x.walk.cpi),
        'text.state': q('the state at this cycle', row.state),
        'text.op': q('the instruction in it', row.instr.op),
      }
    },
    main: 'state',
    view: 'state',
    views: ['state', 'program', 'counts'],
  },
  {
    id: 'd3',
    group: GROUPS[3],
    name: 'Fewer cycles, or a shorter one',
    terms: ['multicycle', 'clockperiod', 'cpi', 'mix'],
    params: [Count('access', 'Memory access', 12, 4, 24)],
    card: (p, base) => ({ ...base, blocks: { ...base.blocks, imem: p.access, dmem: p.access } }),
    wants: ['machine'],
    quantities: (x) => ({
      'n.cpi': q('cycles an instruction, over the stated mix', x.multi.cpi),
      'ps.multiperiod': q('the multicycle period', x.multi.period),
      'ps.multitime': q('what an instruction costs on it', x.multi.time),
      'ps.singleperiod': q('the one-cycle period', x.timing.singlePeriod),
      'n.ratio': q('one machine’s time against the other’s', x.multi.time / x.timing.singlePeriod),
      'cycles.load': q('cycles a load takes', cyclesOf('load')),
      'cycles.arith': q('cycles an arithmetic instruction takes', cyclesOf('arith')),
      'share.load': q('of the mix that is loads', x.card.mix.load),
      'share.arith': q('of the mix that is arithmetic', x.card.mix.arith),
      'n.shorter': q('how much shorter the multicycle cycle is', x.timing.singlePeriod / x.multi.period),
    }),
    main: 'budget',
    view: 'budget',
    views: ['budget', 'state', 'counts'],
  },
]

export { SEQUENCE }
