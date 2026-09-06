// Group D: control.

export const D_LESSONS = {
  d1: {
    see:
      'The control unit turns a six-bit opcode into 9 signals, and the table has 12 rows. ' +
      'At the default the instruction is a load, which asserts 4 of the nine. ' +
      'RegWrite is 1 because it writes a register, MemRead is 1 because it reads memory, ' +
      'and ALUSrc is 1 because its second operand is an immediate. The logic costs 112.95 ps.',
    seeReads: [
      ['n.signals', 9],
      ['n.rows', 12],
      ['n.ones', 4],
      ['n.regwrite', 1],
      ['n.memread', 1],
      ['n.alusrc', 1],
      ['ps.control', 112.95],
      ['text.class', 'load'],
    ],
    try: [
      {
        say: 'Switch the instruction to add. It asserts 2 signals, and MemRead falls to 0.',
        set: { op: 'add' },
        reads: [
          ['n.ones', 2],
          ['n.memread', 0],
        ],
      },
      {
        say: 'Switch to sw. RegWrite falls to 0, because a store writes memory and no register.',
        set: { op: 'sw' },
        reads: [
          ['n.regwrite', 0],
          ['n.alusrc', 1],
        ],
      },
      {
        say: 'Switch to j. It asserts 1 signal, which is the one that steers the counter.',
        set: { op: 'j' },
        reads: [['n.ones', 1]],
      },
    ],
    why:
      'Control in a single-cycle machine has no state at all. ' +
      'The opcode arrives, the nine signals follow, and nothing depends on what happened in the last cycle. ' +
      'That makes the whole unit one truth table of 12 rows, and two levels of gates implement it in 3 gate delays. ' +
      'The decode runs beside the register file read rather than after it, ' +
      'so those 112.95 ps are not on the critical path and cost the clock nothing. ' +
      'The multicycle machine in D2 cannot do this. ' +
      'Its control has to remember which part of the instruction it is in, which is what makes it a state machine.',
    whyReads: [
      ['n.rows', 12],
      ['g.control', 3],
      ['ps.control', 112.95],
    ],
  },

  d2: {
    see:
      'The multicycle machine has 5 states, and each instruction walks the ones it needs. ' +
      'An arithmetic instruction takes 4 cycles, a load takes 5, a store takes 4 and a branch takes 3. ' +
      'The program of eight instructions takes 31 cycles, which is 3.875 cycles an instruction. ' +
      'At cycle 4 the machine is in the fetch state.',
    seeReads: [
      ['n.states', 5],
      ['cycles.arith', 4],
      ['cycles.load', 5],
      ['cycles.store', 4],
      ['cycles.branch', 3],
      ['cycles.walk', 31],
      ['n.retired', 8],
      ['n.cpiwalk', 3.875],
      ['text.state', 'fetch'],
    ],
    try: [
      {
        say: 'Set the cycle to 0. The machine is fetching, and the instruction is addi.',
        set: { cycle: 0 },
        reads: [
          ['text.state', 'fetch'],
          ['text.op', 'addi'],
        ],
      },
      {
        say: 'Set the cycle to 8. The load is in write-back, which is the fifth state it needed.',
        set: { cycle: 8 },
        reads: [
          ['text.state', 'writeback'],
          ['text.op', 'lw'],
        ],
      },
      {
        say: 'Read the cycles a branch takes. It is 3, because a branch has nothing to write back.',
        reads: [['cycles.branch', 3]],
      },
    ],
    why:
      'The single-cycle machine gives every instruction the whole longest path. ' +
      'The multicycle machine breaks that path into steps and gives each instruction only the steps it needs. ' +
      'Fetch and decode are the same for all of them. ' +
      'After that an arithmetic instruction executes and writes back, a load also visits memory, ' +
      'and a branch stops as soon as the comparison is done. ' +
      'The control unit is now a state machine, because the signals it asserts depend on which step it is in as well as on the opcode. ' +
      'This is the Logic Lab’s state machine group doing a job, and it is the same five circles drawn on the same canvas.',
    whyReads: [
      ['cycles.arith', 4],
      ['cycles.load', 5],
      ['n.states', 5],
    ],
  },

  d3: {
    see:
      'The multicycle clock is set by the slowest block rather than by the longest path, so it is 534.66 ps. ' +
      'Over the stated mix an instruction takes 4.05 cycles, which is 2165.373 ps. ' +
      'The single-cycle machine does the same instruction in 1739.46 ps. ' +
      'Shorter cycles did not pay here, because there are too many of them.',
    seeReads: [
      ['ps.multiperiod', 534.66],
      ['n.cpi', 4.05],
      ['ps.multitime', 2165.373],
      ['ps.singleperiod', 1739.46],
      ['n.ratio', 1.244851],
    ],
    try: [
      {
        say: 'Set the memory access to 6 gate delays. The multicycle period falls to 384.06 ps and an instruction costs 1555.443 ps.',
        set: { access: 6 },
        reads: [
          ['ps.multiperiod', 384.06],
          ['ps.multitime', 1555.443],
        ],
      },
      {
        say: 'Read the one-cycle period at that setting. It is 1287.66 ps, so the multicycle machine is still behind.',
        set: { access: 6 },
        reads: [
          ['ps.singleperiod', 1287.66],
          ['n.ratio', 1.207961],
        ],
      },
      {
        say: 'Read the mix. Loads are 25.00 % of it and arithmetic is 45.00 %, which is what the 4.05 is an average over.',
        reads: [
          ['share.load', 0.25],
          ['share.arith', 0.45],
          ['n.cpi', 4.05],
        ],
      },
    ],
    why:
      'Two numbers decide a machine’s speed, and this experiment moves one against the other. ' +
      'Cutting the cycle to the slowest block makes each cycle 3.25 times shorter than the single-cycle period. ' +
      'Needing 4.05 of them an instruction gives most of that back. ' +
      'The multicycle machine wins when instructions differ a lot in what they need, and this mix does not differ enough. ' +
      'What it does buy is one memory instead of two and one adder instead of three, which is why the design was worth building. ' +
      'The pipeline in Group E keeps the short cycle and drops the count back towards one.',
    whyReads: [
      ['n.cpi', 4.05],
      ['n.ratio', 1.244851],
      ['n.shorter', 3.253385],
    ],
    whyAlso: [{ set: {}, reads: [['ps.singleperiod', 1739.46]] }],
  },
}
