// The single-cycle datapath: one instruction, one clock, every wire named.
//
// The machine is a finite state machine over integers, so every number it
// produces is exact (plan §2.7). A cycle here is not a sample of anything. It
// is one instruction, and the trace carries the value on every named wire in
// it, which is what the datapath view draws.
//
// The wire names are the contract between this file, the canvas and every
// lesson (AGENT_BRIEF §3.3). A wire that carries no meaningful value in a
// cycle is marked inactive rather than left out, so the picture can draw it
// grey and a reader can see that it is there and idle.

import { alu, classOf, controlOf, decode, encode, initialState, signed16, writesTo } from './isa.js'

/** Every wire of the single-cycle machine, in the order the canvas lists them. */
export const WIRES = [
  { name: 'pc', label: 'PC', kind: 'address', from: 'pc', to: 'imem' },
  { name: 'pc4', label: 'PC + 4', kind: 'address', from: 'pcAdd', to: 'pcMux' },
  { name: 'instr', label: 'instruction', kind: 'word', from: 'imem', to: 'decode' },
  { name: 'op', label: 'opcode', kind: 'field', from: 'decode', to: 'control' },
  { name: 'rs', label: 'rs', kind: 'field', from: 'decode', to: 'regs' },
  { name: 'rt', label: 'rt', kind: 'field', from: 'decode', to: 'regs' },
  { name: 'rd', label: 'rd', kind: 'field', from: 'decode', to: 'regMux' },
  { name: 'imm', label: 'immediate', kind: 'field', from: 'decode', to: 'signExtend' },
  { name: 'target', label: 'target', kind: 'field', from: 'decode', to: 'pcMux' },
  { name: 'regDst', label: 'RegDst', kind: 'control', from: 'control', to: 'regMux' },
  { name: 'regWrite', label: 'RegWrite', kind: 'control', from: 'control', to: 'regs' },
  { name: 'aluSrc', label: 'ALUSrc', kind: 'control', from: 'control', to: 'aluMux' },
  { name: 'aluOp', label: 'ALUOp', kind: 'control', from: 'control', to: 'alu' },
  { name: 'memRead', label: 'MemRead', kind: 'control', from: 'control', to: 'dmem' },
  { name: 'memWrite', label: 'MemWrite', kind: 'control', from: 'control', to: 'dmem' },
  { name: 'memToReg', label: 'MemToReg', kind: 'control', from: 'control', to: 'wbMux' },
  { name: 'branch', label: 'Branch', kind: 'control', from: 'control', to: 'pcMux' },
  { name: 'jump', label: 'Jump', kind: 'control', from: 'control', to: 'pcMux' },
  { name: 'readData1', label: 'read data 1', kind: 'data', from: 'regs', to: 'alu' },
  { name: 'readData2', label: 'read data 2', kind: 'data', from: 'regs', to: 'aluMux' },
  { name: 'signImm', label: 'sign extended', kind: 'data', from: 'signExtend', to: 'aluMux' },
  { name: 'aluB', label: 'ALU b', kind: 'data', from: 'aluMux', to: 'alu' },
  { name: 'aluResult', label: 'ALU result', kind: 'data', from: 'alu', to: 'dmem' },
  { name: 'zero', label: 'Zero', kind: 'status', from: 'alu', to: 'pcMux' },
  { name: 'memAddr', label: 'address', kind: 'address', from: 'alu', to: 'dmem' },
  { name: 'memReadData', label: 'memory data', kind: 'data', from: 'dmem', to: 'wbMux' },
  { name: 'writeData', label: 'write data', kind: 'data', from: 'wbMux', to: 'regs' },
  { name: 'writeReg', label: 'write register', kind: 'field', from: 'regMux', to: 'regs' },
  { name: 'branchTarget', label: 'branch target', kind: 'address', from: 'branchAdd', to: 'pcMux' },
  { name: 'jumpTarget', label: 'jump target', kind: 'address', from: 'decode', to: 'pcMux' },
  { name: 'pcSrc', label: 'PCSrc', kind: 'control', from: 'pcMux', to: 'pc' },
  { name: 'pcNext', label: 'next PC', kind: 'address', from: 'pcMux', to: 'pc' },
]

export const WIRE_NAMES = WIRES.map((w) => w.name)

/** The blocks the canvas draws, and where each sits on its grid. */
export const BLOCKS = [
  { id: 'pc', label: 'PC', col: 0, row: 1 },
  { id: 'imem', label: 'instruction memory', col: 1, row: 1 },
  { id: 'pcAdd', label: '+4', col: 1, row: 0 },
  { id: 'decode', label: 'fields', col: 2, row: 1 },
  { id: 'control', label: 'control', col: 2, row: 0 },
  { id: 'regs', label: 'register file', col: 3, row: 1 },
  { id: 'regMux', label: 'reg mux', col: 3, row: 2 },
  { id: 'signExtend', label: 'sign extend', col: 3, row: 3 },
  { id: 'aluMux', label: 'ALU mux', col: 4, row: 2 },
  { id: 'alu', label: 'ALU', col: 5, row: 1 },
  { id: 'branchAdd', label: 'branch add', col: 5, row: 3 },
  { id: 'dmem', label: 'data memory', col: 6, row: 1 },
  { id: 'wbMux', label: 'write-back mux', col: 7, row: 1 },
  { id: 'pcMux', label: 'PC mux', col: 7, row: 0 },
]

/** Which wires carry a meaningful value for one instruction class. */
export function activeWires(instr) {
  const c = controlOf(instr.op)
  const cls = classOf(instr.op)
  const on = new Set(['pc', 'pc4', 'instr', 'op', 'rs', 'regDst', 'regWrite', 'aluSrc', 'aluOp', 'memRead', 'memWrite', 'memToReg', 'branch', 'jump', 'pcSrc', 'pcNext', 'readData1'])
  if (cls !== 'jump') on.add('rt').add('readData2').add('aluResult').add('zero').add('aluB')
  if (c.regDst) on.add('rd')
  if (c.regWrite) on.add('writeReg').add('writeData')
  if (c.aluSrc) on.add('imm').add('signImm')
  if (cls === 'load' || cls === 'store') on.add('imm').add('signImm').add('memAddr')
  if (cls === 'load') on.add('memReadData')
  if (cls === 'branch') on.add('imm').add('signImm').add('branchTarget')
  if (cls === 'jump') on.add('target').add('jumpTarget')
  return on
}

/** A program written as objects, as the words the machine fetches. */
export const assemble = (program) => program.map((i) => ({ ...decode(encode(i)), asm: i }))

/**
 * One cycle of the single-cycle machine: every wire, computed from the state
 * the cycle opened with.
 */
export function cycleOf(state, instr) {
  const read = (i) => (i === 0 ? 0 : state.regs[i])
  const c = controlOf(instr.op)
  const cls = classOf(instr.op)
  const w = {}
  w.pc = state.pc
  w.pc4 = state.pc + 4
  w.instr = instr.word
  w.op = instr.op
  w.rs = instr.rs
  w.rt = instr.rt
  w.rd = instr.rd
  w.imm = instr.imm
  w.target = instr.target
  for (const k of ['regDst', 'regWrite', 'aluSrc', 'aluOp', 'memRead', 'memWrite', 'memToReg', 'branch', 'jump']) w[k] = c[k]
  w.readData1 = read(instr.rs)
  w.readData2 = read(instr.rt)
  w.signImm = instr.op === 'andi' ? instr.uimm : instr.imm
  w.aluB = c.aluSrc ? w.signImm : w.readData2
  w.aluResult = cls === 'jump' ? 0 : alu(c.aluOp, w.readData1, w.aluB)
  w.zero = w.aluResult === 0 ? 1 : 0
  w.memAddr = w.aluResult
  w.memReadData = c.memRead ? state.mem[w.memAddr >> 2] ?? 0 : 0
  w.writeData = c.memToReg ? w.memReadData : w.aluResult
  w.writeReg = c.regDst ? instr.rd : instr.rt
  w.branchTarget = w.pc4 + instr.imm * 4
  w.jumpTarget = (w.pc4 & 0xf0000000) | (instr.target << 2)
  const taken = c.branch && (instr.op === 'beq' ? w.zero === 1 : w.zero === 0)
  w.pcSrc = taken ? 'branch' : c.jump ? 'jump' : 'pc4'
  w.pcNext = taken ? w.branchTarget : c.jump ? w.jumpTarget : w.pc4
  return { wires: w, taken, control: c, cls }
}

/**
 * Run a program on the single-cycle machine.
 *
 * @param program  [{ op, rd, rs, rt, imm }]
 * @param opts     { regs, mem, words, cycles, stages }
 * @returns {{ trace, regs, mem, cycles, retired, cpi, addresses, stalls, flushes }}
 */
export function runDatapath(program, opts = {}) {
  if (opts.stages === 5) throw new Error('the five-stage machine is runPipeline, and this is the one-cycle machine')
  const code = assemble(program)
  const state = initialState({ regs: opts.regs || [], mem: opts.mem || [], words: opts.words || 256 })
  const limit = opts.cycles ?? 400
  const trace = []
  const addresses = []
  let cycle = 0
  while (cycle < limit && state.pc >= 0 && state.pc >> 2 < code.length) {
    const instr = code[state.pc >> 2]
    const step = cycleOf(state, instr)
    addresses.push({ cycle, kind: 'i', addr: state.pc })
    if (step.cls === 'load' || step.cls === 'store') addresses.push({ cycle, kind: 'd', addr: step.wires.memAddr })
    trace.push({ cycle, pc: state.pc, index: state.pc >> 2, instr, wires: step.wires, active: activeWires(instr), taken: step.taken, stage: 'all' })
    // The state changes on the clock edge at the end of the cycle.
    if (step.control.regWrite && step.wires.writeReg !== 0) state.regs[step.wires.writeReg] = step.wires.writeData | 0
    if (step.control.memWrite) state.mem[step.wires.memAddr >> 2] = step.wires.readData2 | 0
    state.pc = step.wires.pcNext
    cycle++
  }
  return {
    stages: 1,
    program: code,
    trace,
    regs: state.regs,
    mem: state.mem,
    pc: state.pc,
    cycles: cycle,
    retired: cycle,
    cpi: cycle ? 1 : 0,
    stalls: 0,
    flushes: 0,
    stallsBy: { loadUse: 0, branch: 0 },
    addresses,
  }
}

/** The instruction as a reader reads it, with its fields decoded. */
export function textOf(instr) {
  const i = instr.asm || instr
  const r = (n) => `r${n}`
  switch (classOf(i.op)) {
    case 'load':
    case 'store':
      return `${i.op} ${r(i.rt)}, ${i.imm}(${r(i.rs)})`
    case 'branch':
      return `${i.op} ${r(i.rs)}, ${r(i.rt)}, ${i.imm}`
    case 'jump':
      return `${i.op} ${i.target}`
    default:
      return i.op === 'addi' || i.op === 'andi' ? `${i.op} ${r(i.rt)}, ${r(i.rs)}, ${i.imm}` : `${i.op} ${r(i.rd)}, ${r(i.rs)}, ${r(i.rt)}`
  }
}

export { classOf, controlOf, decode, encode, signed16, writesTo }
