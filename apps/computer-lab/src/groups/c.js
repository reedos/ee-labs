// Group C: one instruction, one clock.
//
// The single-cycle machine, with every wire named and drawn. Each experiment
// runs a curated program and reads the wires of one cycle off the run, so what
// the picture shows and what the lesson quotes are the same object.

import { gates } from '../engine/card.js'
import { WIRES } from '../engine/datapath.js'
import { Count, GROUPS, q } from './shared.js'

/** The cycle a knob is asking for, kept inside the run. */
const cycleOf = (x) => Math.min(x.p.cycle ?? 0, x.run.trace.length - 1)

/** The wires of that cycle, and how many of them carry a value. */
const wiresAt = (x) => {
  const t = x.run.trace[cycleOf(x)]
  return { wires: t.wires, active: t.active, instr: t.instr, lit: [...t.active].length }
}

export const C = [
  {
    id: 'c1',
    group: GROUPS[2],
    name: 'An instruction is a set of fields',
    terms: ['opcode', 'field', 'immediate', 'registerfile'],
    params: [Count('cycle', 'Instruction', 7, 0, 11)],
    program: () => 'each',
    wants: ['run', 'control'],
    quantities: (x) => {
      const { instr, wires } = wiresAt(x)
      return {
        'n.fields': q('fields the word is cut into', 6),
        'n.opcodes': q('opcodes the machine has', x.control.rows.length),
        'word.instr': q('the word being decoded', instr.word),
        'n.opcode': q('its opcode field', x.control.rows.find((r) => r.op === instr.op).opcode),
        'n.rs': q('the first source register', wires.rs),
        'n.rt': q('the second source register', wires.rt),
        'n.rd': q('the destination register field', wires.rd),
        'n.imm': q('the immediate field', wires.imm),
        'n.writereg': q('the register this instruction writes', wires.writeReg),
        'text.op': q('the instruction', instr.op),
      }
    },
    main: 'program',
    view: 'program',
    views: ['program', 'control', 'datapath', 'counts'],
  },
  {
    id: 'c2',
    group: GROUPS[2],
    name: 'Fetch, and the program counter',
    terms: ['programcounter', 'fetch', 'memory', 'word'],
    params: [Count('cycle', 'Cycle', 1, 0, 2)],
    program: () => 'fetchThree',
    wants: ['run'],
    quantities: (x) => {
      const { wires } = wiresAt(x)
      return {
        'ps.fetch': q('the instruction memory’s access', gates(x.card.blocks.imem, x.card)),
        'g.fetch': q('the same, in gate delays', x.card.blocks.imem),
        'word.pc': q('the counter this cycle', wires.pc),
        'word.pc4': q('what the adder beside it makes', wires.pc4),
        'n.step': q('bytes the counter advances', wires.pc4 - wires.pc),
        'cycles.run': q('cycles the program takes', x.run.cycles),
        'n.instructions': q('instructions in it', x.code.length),
      }
    },
    main: 'datapath',
    view: 'datapath',
    views: ['datapath', 'program', 'counts'],
  },
  {
    id: 'c3',
    group: GROUPS[2],
    name: 'An arithmetic instruction, wire by wire',
    terms: ['datapath', 'controlsignal', 'alu', 'writeback'],
    params: [Count('a', 'Register 1', 6, 0, 32), Count('b', 'Register 2', 7, 0, 32)],
    program: () => 'one',
    over: (p) => ({ regs: [0, p.a, p.b] }),
    wants: ['run'],
    quantities: (x) => {
      const { wires, lit } = wiresAt(x)
      return {
        'n.wires': q('wires the datapath has', WIRES.length),
        'n.lit': q('wires carrying a value this cycle', lit),
        'n.dark': q('wires this instruction leaves idle', WIRES.length - lit),
        'word.aluresult': q('what the ALU produced', wires.aluResult),
        'word.writedata': q('what went back to the register file', wires.writeData),
        'n.writereg': q('the register it went to', wires.writeReg),
        'ps.path': q('the path this instruction needs', x.timing.single.arith.delay),
        'g.path': q('the same, in gate delays', x.timing.single.arith.gates),
        'ps.period': q('the period every instruction gets', x.timing.singlePeriod),
        'ps.slack': q('how long it waits once it has finished', x.timing.singlePeriod - x.timing.single.arith.delay),
      }
    },
    main: 'datapath',
    view: 'datapath',
    views: ['datapath', 'budget', 'counts'],
  },
  {
    id: 'c4',
    group: GROUPS[2],
    name: 'The load sets the clock',
    terms: ['criticalpath', 'clockperiod', 'memory', 'load'],
    params: [Count('access', 'Memory access', 12, 4, 24)],
    card: (p, base) => ({ ...base, blocks: { ...base.blocks, imem: p.access, dmem: p.access } }),
    program: () => 'loadOne',
    wants: ['run'],
    quantities: (x) => ({
      'ps.load': q('a load’s path', x.timing.single.load.delay),
      'g.load': q('the same, in gate delays', x.timing.single.load.gates),
      'ps.arith': q('an arithmetic instruction’s path', x.timing.single.arith.delay),
      'ps.branch': q('a branch’s path', x.timing.single.branch.delay),
      'ps.period': q('the period, which is the longest of them', x.timing.singlePeriod),
      'freq.clock': q('the machine’s clock rate', x.timing.singleFreq),
      'share.waste': q('of a cycle an arithmetic instruction wastes', x.timing.waste),
      'text.critical': q('the instruction that sets the clock', x.timing.critical),
    }),
    main: 'budget',
    view: 'budget',
    views: ['budget', 'datapath', 'counts'],
  },
  {
    id: 'c5',
    group: GROUPS[2],
    name: 'A branch is a comparison and a multiplexer',
    terms: ['branch', 'zero', 'multiplexer', 'programcounter'],
    params: [Count('offset', 'Branch offset', 1, -2, 4), Count('a', 'Register 1', 4, 0, 8), Count('b', 'Register 2', 4, 0, 8)],
    program: () => 'branchOne',
    over: (p) => ({ imm: { 0: p.offset }, regs: [0, p.a, p.b] }),
    wants: ['run'],
    quantities: (x) => {
      const w = x.run.trace[0].wires
      return {
        'ps.branch': q('the branch path', x.timing.single.branch.delay),
        'g.branch': q('the same, in gate delays', x.timing.single.branch.gates),
        'n.zero': q('the comparator’s output', w.zero),
        'word.target': q('the address the offset names', w.branchTarget),
        'word.next': q('where the counter goes', w.pcNext),
        'word.pc4': q('where it would have gone', w.pc4),
        'n.taken': q('whether the branch was taken', w.pcSrc === 'branch' ? 1 : 0),
        'ps.period': q('the machine’s period', x.timing.singlePeriod),
        'cycles.run': q('cycles the program takes', x.run.cycles),
      }
    },
    main: 'datapath',
    view: 'datapath',
    views: ['datapath', 'program', 'counts'],
  },
]
