// Group C: one instruction, one clock.

export const C_LESSONS = {
  c1: {
    see:
      'Thirty-two bits are cut into 6 fields. The opcode says what the instruction is, ' +
      'three register numbers say where its operands live, and the immediate carries a constant. ' +
      'At the default the instruction is lw, its opcode field reads 35, and it writes register 10. ' +
      'The machine has 12 opcodes in all.',
    seeReads: [
      ['n.fields', 6],
      ['text.op', 'lw'],
      ['n.opcode', 35],
      ['n.writereg', 10],
      ['n.opcodes', 12],
    ],
    try: [
      {
        say: 'Set the instruction to the first one. It is add, its opcode field reads 0, and the destination is in the rd field.',
        set: { cycle: 0 },
        reads: [
          ['text.op', 'add'],
          ['n.opcode', 0],
          ['n.rd', 3],
        ],
      },
      {
        say: 'Set the instruction to the tenth. It is beq, its opcode field reads 4, and it writes no register.',
        set: { cycle: 9 },
        reads: [
          ['text.op', 'beq'],
          ['n.opcode', 4],
          ['n.writereg', 0],
        ],
      },
      {
        say: 'Read the immediate at the default. It is 8, which is the byte offset the load adds to its base register.',
        reads: [['n.imm', 8]],
      },
    ],
    why:
      'An instruction is a number, and the fields are where the machine looks in it. ' +
      'The opcode is always in the same place, so the control unit can decode it before anything else is known. ' +
      'The two source register numbers are always in the same place too, ' +
      'so the register file can start its read while the opcode is still being decoded. ' +
      'That is the reason for a fixed format rather than a compact one. ' +
      'An arithmetic instruction names three registers and uses the rd field for the destination. ' +
      'A load names two and writes the one in rt, which is why the datapath has a multiplexer in front of the write port.',
    whyReads: [
      ['n.fields', 6],
      ['n.rs', 0],
      ['n.rt', 10],
    ],
  },

  c2: {
    see:
      'The counter feeds the instruction memory and an adder at the same time. ' +
      'The memory takes 451.8 ps, which is 12 gate delays, and the adder beside it makes the next address. ' +
      'At cycle 1 the counter holds 4 and the adder makes 8, so the step is 4 bytes. ' +
      'The three instructions take 3 cycles.',
    seeReads: [
      ['ps.fetch', 451.8],
      ['g.fetch', 12],
      ['word.pc', 4],
      ['word.pc4', 8],
      ['n.step', 4],
      ['cycles.run', 3],
      ['n.instructions', 3],
    ],
    try: [
      {
        say: 'Set the cycle to 0. The counter holds 0 and the adder makes 4.',
        set: { cycle: 0 },
        reads: [
          ['word.pc', 0],
          ['word.pc4', 4],
        ],
      },
      {
        say: 'Set the cycle to 2. The counter holds 8, one step further on.',
        set: { cycle: 2 },
        reads: [
          ['word.pc', 8],
          ['n.step', 4],
        ],
      },
    ],
    why:
      'An instruction is a word, and a word is four bytes, so the next instruction is four bytes on. ' +
      'The machine could add four in the ALU, but then the fetch would wait for the execute stage. ' +
      'Instead there is a second adder whose only job is the counter, and it works while the memory is still reading. ' +
      'The two of them finish inside the same cycle. ' +
      'This is the first place in the datapath where two things happen at once, ' +
      'because they were given their own hardware. That is the pattern the whole pipeline is built on.',
    whyReads: [
      ['n.step', 4],
      ['ps.fetch', 451.8],
    ],
  },

  c3: {
    see:
      'Every wire in the picture carries a value. This instruction lights 25 of the 32 wires, ' +
      'and leaves 7 of them grey because it has no use for them. ' +
      'The ALU produces 13, the write-back multiplexer passes it, and register 3 takes it. ' +
      'The path is 1287.66 ps, while the machine’s period is 1739.46 ps.',
    seeReads: [
      ['n.lit', 25],
      ['n.wires', 32],
      ['n.dark', 7],
      ['word.aluresult', 13],
      ['word.writedata', 13],
      ['n.writereg', 3],
      ['ps.path', 1287.66],
      ['ps.period', 1739.46],
    ],
    try: [
      {
        say: 'Set register 1 to 9 and register 2 to 4. The ALU produces 13 again, from different operands.',
        set: { a: 9, b: 4 },
        reads: [['word.aluresult', 13]],
      },
      {
        say: 'Set register 2 to 0. The ALU produces 6, which is register 1 unchanged.',
        set: { b: 0 },
        reads: [['word.aluresult', 6]],
      },
      {
        say: 'Read the path against the period. The instruction needs 1287.66 ps and gets 1739.46 ps.',
        reads: [
          ['ps.path', 1287.66],
          ['ps.period', 1739.46],
        ],
      },
    ],
    why:
      'The grey wires are the point of the picture. ' +
      'The data memory’s output, the branch target and the jump target are all present and all idle. ' +
      'A single-cycle machine builds every path the instruction set needs, ' +
      'and each instruction then uses the ones it asks for. ' +
      'Nothing is switched off to save time, and nothing can be. ' +
      'The control signals decide which values reach the register file and the counter, and the rest settle and are ignored. ' +
      'That is what makes the machine simple to draw and expensive to clock. ' +
      'This instruction is finished 451.8 ps before its cycle ends, and C4 is where that waste is counted.',
    whyReads: [
      ['ps.slack', 451.8],
      ['n.dark', 7],
      ['ps.path', 1287.66],
      ['ps.period', 1739.46],
    ],
  },

  c4: {
    see:
      'A load reads memory after the ALU has made the address, so its path is the longest in the machine at 1739.46 ps. ' +
      'That is 44 gate delays, and it sets the clock at 574.891 MHz. ' +
      'An arithmetic instruction needs 1287.66 ps and a branch needs 1212.36 ps. ' +
      'Both finish early and wait, and an arithmetic instruction wastes 25.97 % of its cycle.',
    seeReads: [
      ['ps.load', 1739.46],
      ['g.load', 44],
      ['freq.clock', 574891000],
      ['ps.arith', 1287.66],
      ['ps.branch', 1212.36],
      ['share.waste', 0.259736],
      ['text.critical', 'load'],
    ],
    try: [
      {
        say: 'Set the memory access to 6 gate delays. The load path falls to 1287.66 ps and the clock rises to 776.6025 MHz.',
        set: { access: 6 },
        reads: [
          ['ps.load', 1287.66],
          ['freq.clock', 776602500],
        ],
      },
      {
        say: 'Read the waste at that setting. An arithmetic instruction now wastes 17.54 % of its cycle.',
        set: { access: 6 },
        reads: [['share.waste', 0.1754345]],
      },
      {
        say: 'Set the memory access to 24 gate delays. The load path is 2643.06 ps, and the clock falls with it.',
        set: { access: 24 },
        reads: [['ps.load', 2643.06]],
      },
    ],
    why:
      'The clock period of a single-cycle machine is the longest path any instruction takes, ' +
      'because every instruction is given one cycle and the cycle has to fit the worst of them. ' +
      'The load is that worst case. ' +
      'It walks the instruction memory, the register file, the ALU multiplexer, the ALU, the data memory and the write-back multiplexer, ' +
      'and no two of those can overlap. ' +
      'Every other instruction skips at least one block and then waits. ' +
      'Shortening the memory shortens the period, which the knob shows, ' +
      'but the shape of the answer does not change until the machine stops giving every instruction the same cycle.',
    whyReads: [
      ['g.load', 44],
      ['ps.load', 1739.46],
    ],
  },

  c5: {
    see:
      'A branch subtracts its two registers and tests the result for zero. ' +
      'At the defaults the registers are equal, the comparator reads 1, and the counter goes to 8 rather than 4. ' +
      'The path is 1212.36 ps, which is 30 gate delays and shorter than the load’s. ' +
      'The branch still gets the machine’s full period of 1739.46 ps.',
    seeReads: [
      ['n.zero', 1],
      ['word.next', 8],
      ['word.pc4', 4],
      ['ps.branch', 1212.36],
      ['g.branch', 30],
      ['ps.period', 1739.46],
    ],
    try: [
      {
        say: 'Set register 2 to 5. The registers now differ, the comparator reads 0, and the counter goes to 4.',
        set: { b: 5 },
        reads: [
          ['n.zero', 0],
          ['word.next', 4],
        ],
      },
      {
        say: 'Set the branch offset to 2. The target moves to 12, which is two instructions past the one after the branch.',
        set: { offset: 2 },
        reads: [
          ['word.target', 12],
          ['word.next', 12],
        ],
      },
      {
        say: 'Set the offset to −1. The target is 0, which is the branch sending the machine back to the top.',
        set: { offset: -1 },
        reads: [['word.target', 0]],
      },
    ],
    why:
      'The branch target is the address after the branch plus the offset in instructions, shifted by two to make it bytes. ' +
      'The shift is free, because it is which wires go where rather than a gate. ' +
      'The adder that computes the target runs beside the ALU rather than after it, ' +
      'so the branch path is the register read, the comparison and the counter multiplexer. ' +
      'That comes to 30 gate delays, which is less than a load needs, and the machine gives it a load’s cycle anyway. ' +
      'In the pipeline the same comparison happens in the execute stage, ' +
      'and the two instructions already fetched behind it are the cost E5 measures.',
    whyReads: [
      ['g.branch', 30],
      ['word.target', 8],
    ],
  },
}
