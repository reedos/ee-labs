// The programs, curated, one per lesson.
//
// Decision 3 of the plan. There is no assembler and no text editor. A program
// here is a short list of instructions written for one experiment, shown with
// its fields decoded, and the reader turns its immediates and its registers
// rather than its text. That is what every other lab in the suite does with a
// circuit, and `EE_LABS_MAP.md` §5 declines toolchains for the whole of track D.
//
// A branch offset is in instructions, counted from the instruction after the
// branch, which is what the instruction set says. The comment beside each one
// names the line it goes back to, so the arithmetic is on the page.

const r = (op, rd, rs, rt) => ({ op, rd, rs, rt })
const i = (op, rt, rs, imm) => ({ op, rt, rs, imm })
const j = (op, target) => ({ op, target })

/** Eight words at address 0, and a scalar at 256, which Group F reads. */
const ARRAY = [3, 1, 4, 1, 5, 9, 2, 6]
const memWithScalar = () => {
  const m = new Array(80).fill(0)
  ARRAY.forEach((v, k) => (m[k] = v))
  m[64] = 11
  m[16] = 7
  m[20] = 8
  return m
}

export const PROGRAMS = {
  one: {
    name: 'One addition',
    for: ['c1', 'c3', 'd1'],
    regs: [0, 6, 7],
    code: [r('add', 3, 1, 2)],
    note: 'One arithmetic instruction, so every wire it lights is the wire that instruction needs.',
  },
  fetchThree: {
    name: 'Three in a row',
    for: ['c2'],
    regs: [0, 6, 7],
    code: [r('add', 3, 1, 2), r('sub', 4, 1, 2), r('or', 5, 3, 4)],
    note: 'Three instructions with no branch between them, so the counter advances by four each cycle.',
  },
  loadOne: {
    name: 'One load',
    for: ['c4', 'b3'],
    regs: [0, 0, 0],
    mem: memWithScalar(),
    code: [i('lw', 2, 0, 8), r('add', 3, 2, 1)],
    note: 'A load, and the instruction that uses what it loaded.',
  },
  branchOne: {
    name: 'One branch',
    for: ['c5'],
    regs: [0, 4, 4],
    code: [i('beq', 2, 1, 1), r('add', 3, 1, 2), r('sub', 4, 1, 2)],
    note: 'A branch that is taken, and the instruction it skips.',
  },
  mixed: {
    name: 'One of each class',
    for: ['d2', 'd3', 'e1'],
    regs: [0, 8, 3],
    mem: memWithScalar(),
    code: [i('addi', 1, 1, 4), i('lw', 2, 0, 4), r('add', 3, 1, 2), i('sw', 3, 0, 12), i('beq', 2, 1, 1), r('sub', 4, 1, 2), j('j', 7), r('or', 5, 1, 2)],
    note: 'One instruction of every class, so the control unit walks every path it has.',
  },
  chain: {
    name: 'Three that depend',
    for: ['e3'],
    regs: [0, 5, 6],
    code: [r('add', 3, 1, 2), r('add', 4, 3, 1), r('add', 5, 4, 3)],
    note: 'Each instruction reads what the one before it wrote, which is the dependence forwarding exists for.',
  },
  loadUse: {
    name: 'A load and its use',
    for: ['e4'],
    regs: [0, 0, 2],
    mem: memWithScalar(),
    code: [i('lw', 3, 0, 16), r('add', 4, 3, 2), r('add', 5, 4, 2)],
    note: 'The load is followed by the instruction that uses it, which is the one stall forwarding cannot remove.',
  },
  loop: {
    name: 'A loop of four',
    for: ['e5', 'e6'],
    regs: [0, 4, 0],
    code: [
      i('addi', 2, 0, 0), //        0  sum = 0
      r('add', 2, 2, 1), //         1  sum = sum + counter
      i('addi', 1, 1, -1), //       2  counter = counter - 1
      i('bne', 0, 1, -3), //        3  back to line 1 while the counter is not zero
      i('sw', 2, 0, 40), //         4  store the sum
    ],
    note: 'Four iterations, so the branch at the end is taken three times and falls through once.',
  },
  arrayScalar: {
    name: 'An array and a scalar',
    for: ['f1', 'f2', 'f3'],
    regs: [0, 0, 0, 0, 32, 4],
    mem: memWithScalar(),
    code: [
      i('addi', 1, 0, 0), //        0  index = 0
      i('lw', 3, 1, 0), //          1  read the array word
      r('add', 2, 2, 3), //         2  add it in
      i('addi', 1, 1, 4), //        3  index = index + 4
      i('bne', 4, 1, -4), //        4  back to line 1 until the index reaches 32
      i('lw', 6, 0, 256), //        5  read the scalar
      i('addi', 5, 5, -1), //       6  passes = passes - 1
      i('bne', 0, 5, -8), //        7  back to line 0 for the next pass
    ],
    note: 'Eight words of an array, then one scalar, four times over. Its data addresses are the trace Group F counts.',
  },
  thrash: {
    name: 'Two arrays at once',
    for: ['f3'],
    regs: [0, 0, 0, 0, 16, 2],
    mem: memWithScalar(),
    code: [
      i('addi', 1, 0, 0), //        0  index = 0
      i('lw', 2, 1, 0), //          1  the first array
      i('lw', 3, 1, 64), //         2  the second array
      i('addi', 1, 1, 4), //        3  index = index + 4
      i('bne', 4, 1, -4), //        4  back to line 1 until the index reaches 16
      i('addi', 5, 5, -1), //       5  passes = passes - 1
      i('bne', 0, 5, -7), //        6  back to line 0 for the next pass
    ],
    note: 'Two arrays whose blocks share an index, read alternately.',
  },
  walk: {
    name: 'A walk of sixty-four words',
    for: ['f4'],
    regs: [0, 0, 0, 0, 256],
    mem: memWithScalar(),
    code: [
      i('addi', 1, 0, 0), //        0  index = 0
      i('lw', 2, 1, 0), //          1  read the next word
      i('addi', 1, 1, 4), //        2  index = index + 4
      i('bne', 4, 1, -3), //        3  back to line 1 until the index reaches 256
    ],
    note: 'Sixty-four words in address order, which is the trace a block size is worth the most on.',
  },
  each: {
    name: 'One of every opcode',
    for: ['c1', 'd1'],
    regs: [0, 6, 7],
    mem: memWithScalar(),
    code: [
      r('add', 3, 1, 2), //         0
      r('sub', 4, 1, 2), //         1
      r('and', 5, 1, 2), //         2
      r('or', 6, 1, 2), //          3
      r('slt', 7, 1, 2), //         4
      i('addi', 8, 1, 5), //        5
      i('andi', 9, 1, 12), //       6
      i('lw', 10, 0, 8), //         7
      i('sw', 10, 0, 40), //        8
      i('beq', 0, 1, 0), //         9  not taken, because r1 is not zero
      i('bne', 1, 1, 0), //        10  not taken, because a register equals itself
      j('j', 12), //               11  past the end, which is where the run stops
    ],
    note: 'One instruction of each of the twelve opcodes, so every field and every control signal appears once.',
  },
  save: {
    name: 'Sixteen registers saved',
    for: ['g2'],
    regs: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    code: Array.from({ length: 16 }, (_, k) => i('sw', (k % 8) + 1, 0, 128 + 4 * k)),
    note: 'What an interrupt does before it runs a handler, as sixteen stores.',
  },
}

export const PROGRAM_IDS = Object.keys(PROGRAMS)

/** One program, with its immediates set to what the knobs say. */
export function programOf(id, over = {}) {
  const p = PROGRAMS[id]
  if (!p) throw new Error(`this lab has no program called "${id}"`)
  const code = p.code.map((instr, k) => (over.imm && over.imm[k] != null ? { ...instr, imm: over.imm[k] } : instr))
  return { ...p, id, code, regs: over.regs || p.regs || [], mem: over.mem || p.mem || [] }
}

/** The programs an experiment offers, in the order the picker lists them. */
export const programsFor = (id) => PROGRAM_IDS.filter((k) => (PROGRAMS[k].for || []).includes(id))
