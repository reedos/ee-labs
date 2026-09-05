// The instruction set: twelve opcodes, 32-bit words, 32 registers.
//
// Decision 2 of the plan. The encoding and the register conventions are the
// textbook subset's, so every cross-reference a reader has already made holds
// here. Twelve opcodes are the smallest set that needs every wire in the
// five-stage datapath, and a hundred more would add encodings without adding
// an experiment.
//
// An instruction is written as an object and encoded to a word. The word is
// what the machine fetches, and C1's lesson is the field extraction that turns
// it back into the object.

/** Where each field sits in the word, as [high bit, width]. */
export const FIELDS = {
  op: [31, 6],
  rs: [25, 5],
  rt: [20, 5],
  rd: [15, 5],
  shamt: [10, 5],
  funct: [5, 6],
  imm: [15, 16],
  target: [25, 26],
}

/** The twelve opcodes, with their encoding and their class. */
export const OPS = {
  add: { kind: 'r', op: 0, funct: 32, cls: 'arith', text: 'add rd, rs, rt' },
  sub: { kind: 'r', op: 0, funct: 34, cls: 'arith', text: 'sub rd, rs, rt' },
  and: { kind: 'r', op: 0, funct: 36, cls: 'arith', text: 'and rd, rs, rt' },
  or: { kind: 'r', op: 0, funct: 37, cls: 'arith', text: 'or rd, rs, rt' },
  slt: { kind: 'r', op: 0, funct: 42, cls: 'arith', text: 'slt rd, rs, rt' },
  addi: { kind: 'i', op: 8, cls: 'arith', text: 'addi rt, rs, imm' },
  andi: { kind: 'i', op: 12, cls: 'arith', text: 'andi rt, rs, imm' },
  lw: { kind: 'i', op: 35, cls: 'load', text: 'lw rt, imm(rs)' },
  sw: { kind: 'i', op: 43, cls: 'store', text: 'sw rt, imm(rs)' },
  beq: { kind: 'i', op: 4, cls: 'branch', text: 'beq rs, rt, off' },
  bne: { kind: 'i', op: 5, cls: 'branch', text: 'bne rs, rt, off' },
  j: { kind: 'j', op: 2, cls: 'jump', text: 'j target' },
}

export const OP_NAMES = Object.keys(OPS)

/** The class an opcode belongs to, which is what the mix counts. */
export const classOf = (op) => OPS[op].cls

/** The nine control signals, in the order the control pane lists them. */
export const CONTROL_SIGNALS = ['regDst', 'regWrite', 'aluSrc', 'aluOp', 'memRead', 'memWrite', 'memToReg', 'branch', 'jump']

/**
 * What the control unit puts out for one opcode. Nine signals from a six-bit
 * opcode, which is D1's truth table.
 *
 * `aluOp` is the operation the ALU performs, as its name. Every other signal
 * is one bit.
 */
export function controlOf(op) {
  const cls = classOf(op)
  const rType = OPS[op].kind === 'r'
  const alu = { add: 'add', sub: 'sub', and: 'and', or: 'or', slt: 'slt', addi: 'add', andi: 'and', lw: 'add', sw: 'add', beq: 'sub', bne: 'sub', j: 'add' }[op]
  return {
    regDst: rType ? 1 : 0,
    regWrite: cls === 'arith' || cls === 'load' ? 1 : 0,
    aluSrc: OPS[op].kind === 'i' && cls !== 'branch' ? 1 : 0,
    aluOp: alu,
    memRead: cls === 'load' ? 1 : 0,
    memWrite: cls === 'store' ? 1 : 0,
    memToReg: cls === 'load' ? 1 : 0,
    branch: cls === 'branch' ? 1 : 0,
    jump: cls === 'jump' ? 1 : 0,
  }
}

const slice = (word, [hi, width]) => (word >>> (hi - width + 1)) & (width === 32 ? -1 : (1 << width) - 1)

/** The six field slices of a word, which is what C1 draws. */
export function fields(word) {
  return Object.fromEntries(Object.entries(FIELDS).map(([name, spec]) => [name, slice(word, spec)]))
}

/** An instruction object as the 32-bit word the machine fetches. */
export function encode(instr) {
  const spec = OPS[instr.op]
  if (!spec) throw new Error(`this machine has no instruction called "${instr.op}"`)
  const put = (v, [hi, width]) => (v & (width === 32 ? -1 : (1 << width) - 1)) << (hi - width + 1)
  if (spec.kind === 'r') return (put(0, FIELDS.op) | put(instr.rs || 0, FIELDS.rs) | put(instr.rt || 0, FIELDS.rt) | put(instr.rd || 0, FIELDS.rd) | put(0, FIELDS.shamt) | put(spec.funct, FIELDS.funct)) >>> 0
  if (spec.kind === 'i') return (put(spec.op, FIELDS.op) | put(instr.rs || 0, FIELDS.rs) | put(instr.rt || 0, FIELDS.rt) | put(instr.imm || 0, FIELDS.imm)) >>> 0
  return (put(spec.op, FIELDS.op) | put(instr.target || 0, FIELDS.target)) >>> 0
}

/** The word back as an instruction, with every field the datapath reads. */
export function decode(word) {
  const f = fields(word)
  const name = f.op === 0 ? OP_NAMES.find((n) => OPS[n].kind === 'r' && OPS[n].funct === f.funct) : OP_NAMES.find((n) => OPS[n].kind !== 'r' && OPS[n].op === f.op)
  if (!name) throw new Error(`opcode ${f.op} with function ${f.funct} is not one of this machine's twelve instructions`)
  const spec = OPS[name]
  return {
    op: name,
    kind: spec.kind,
    cls: spec.cls,
    word,
    rs: f.rs,
    rt: f.rt,
    rd: f.rd,
    shamt: f.shamt,
    funct: f.funct,
    imm: signed16(f.imm),
    uimm: f.imm,
    target: f.target,
  }
}

/** A 16-bit immediate read as a signed number, which is what the sign extender does. */
export const signed16 = (v) => (v & 0x8000 ? v - 0x10000 : v)

/** The register an instruction writes, or null when it writes none. */
export function writesTo(instr) {
  const c = controlOf(instr.op)
  if (!c.regWrite) return null
  const r = c.regDst ? instr.rd : instr.rt
  return r === 0 ? null : r
}

/** The registers an instruction reads, as a list. */
export function readsFrom(instr) {
  const spec = OPS[instr.op]
  if (spec.kind === 'j') return []
  if (spec.kind === 'r' || instr.cls === 'branch') return [instr.rs, instr.rt]
  if (instr.cls === 'store') return [instr.rs, instr.rt]
  return [instr.rs]
}

/** What the ALU computes, given its operation and two operands. */
export function alu(op, a, b) {
  switch (op) {
    case 'add':
      return (a + b) | 0
    case 'sub':
      return (a - b) | 0
    case 'and':
      return a & b
    case 'or':
      return a | b
    case 'slt':
      return a < b ? 1 : 0
    default:
      throw new Error(`the ALU has no operation called "${op}"`)
  }
}

/** A fresh machine state: 32 registers, a word memory, and a program counter. */
export function initialState({ regs = [], mem = [], words = 256, pc = 0 } = {}) {
  if (!Array.isArray(regs)) throw new Error('the initial register file is a list of values, register 0 first')
  const r = new Int32Array(32)
  regs.forEach((v, i) => {
    if (i > 0) r[i] = v | 0
  })
  const m = new Int32Array(words)
  if (Array.isArray(mem)) mem.forEach((v, i) => (m[i] = v | 0))
  else for (const [k, v] of Object.entries(mem)) m[Number(k) >> 2] = v | 0
  return { regs: r, mem: m, pc }
}

/**
 * One instruction, executed to the instruction set's definition.
 *
 * This is the reference the pipeline is measured against (invariant 1). It has
 * no timing in it at all, and every field it touches is a whole number.
 */
export function execOne(state, instr) {
  const { regs, mem } = state
  const read = (i) => (i === 0 ? 0 : regs[i])
  const write = (i, v) => {
    if (i !== 0) regs[i] = v | 0
  }
  const pc4 = state.pc + 4
  let next = pc4
  const c = controlOf(instr.op)
  const a = read(instr.rs)
  const b = read(instr.rt)
  const second = c.aluSrc ? (instr.op === 'andi' ? instr.uimm : instr.imm) : b
  let result = null
  let loaded = null
  switch (instr.cls) {
    case 'arith':
      result = alu(c.aluOp, a, second)
      write(c.regDst ? instr.rd : instr.rt, result)
      break
    case 'load':
      result = alu('add', a, instr.imm)
      loaded = mem[result >> 2] ?? 0
      write(instr.rt, loaded)
      break
    case 'store':
      result = alu('add', a, instr.imm)
      mem[result >> 2] = b
      break
    case 'branch': {
      result = alu('sub', a, b)
      const takeIt = instr.op === 'beq' ? result === 0 : result !== 0
      if (takeIt) next = pc4 + instr.imm * 4
      break
    }
    case 'jump':
      next = (pc4 & 0xf0000000) | (instr.target << 2)
      break
    default:
      throw new Error(`no class called "${instr.cls}"`)
  }
  return { pc: next, result, loaded, taken: next !== pc4, address: instr.cls === 'load' || instr.cls === 'store' ? result : null }
}

/**
 * The whole program run to the instruction set's definition, one instruction
 * at a time and with no machine underneath it. This is the answer every
 * datapath in the lab has to agree with.
 */
export function reference(program, { regs = [], mem = [], words = 256, limit = 4000 } = {}) {
  // The words the machine would fetch, so the reference reads the same fields
  // the datapath's decoder reads and not the object a program was written as.
  program = program.map((x) => (x.word == null ? decode(encode(x)) : x))
  const state = initialState({ regs, mem, words })
  let retired = 0
  const addresses = []
  while (state.pc >= 0 && state.pc >> 2 < program.length && retired < limit) {
    const instr = program[state.pc >> 2]
    addresses.push({ kind: 'i', addr: state.pc })
    const out = execOne(state, instr)
    if (out.address != null) addresses.push({ kind: 'd', addr: out.address })
    state.pc = out.pc
    retired++
  }
  return { regs: state.regs, mem: state.mem, pc: state.pc, retired, addresses }
}
