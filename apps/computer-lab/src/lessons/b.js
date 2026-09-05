// Group B: the register file and the memory block.

export const B_LESSONS = {
  b1: {
    see:
      'Five address bits reach 32 word lines through an inverter and two levels of gates. ' +
      'Exactly 1 line is high for any address, and at the default it is w13. ' +
      'The decode settles in 97.89 ps. The model card charges a whole register file read 301.2 ps, ' +
      'which covers this decode, the cell it selects, and the read multiplexer after it.',
    seeReads: [
      ['n.lines', 32],
      ['n.high', 1],
      ['text.line', 'w13'],
      ['ps.decode', 97.89],
      ['ps.read', 301.2],
    ],
    try: [
      {
        say: 'Set the register number to 0. The high line is w0, and there is still exactly 1 line high.',
        set: { addr: 0 },
        reads: [
          ['text.line', 'w0'],
          ['n.high', 1],
        ],
      },
      {
        say: 'Set the register number to 31. Now w31 is the one line high.',
        set: { addr: 31 },
        reads: [
          ['text.line', 'w31'],
          ['n.high', 1],
        ],
      },
      {
        say: 'Read the gate count. The decoder holds 45 gates to drive its 32 lines.',
        reads: [
          ['n.gates', 45],
          ['n.lines', 32],
        ],
      },
    ],
    why:
      'A register file is a memory, and a memory needs one wire a row. ' +
      'The decoder is what turns a five-bit number into that wire. ' +
      'Two address bits at a time are combined into a one-of-four line. ' +
      'The two of those meet a fifth bit in a three-input gate, so no gate needs more than three inputs. ' +
      'The whole decode is 2.6 gate delays. ' +
      'Doing it in one level would need a 32-input gate, which no library holds. ' +
      'The card’s 8 gate delays for a read cover the decode, the cell that drives the bit line, and the multiplexer that picks the port. ' +
      'The decode is under a third of that, and the cell array is the rest.',
    whyReads: [
      ['g.decode', 2.6],
      ['g.read', 8],
      ['n.lines', 32],
    ],
  },

  b2: {
    see:
      'The file holds 1024 cells, two read ports and one write port, so 3 ports are busy in a cycle. ' +
      'A read takes 301.2 ps and a write takes 150.6 ps, because a write has no output multiplexer to cross. ' +
      'The three dependent instructions here take 7 cycles, and the hazard unit inserts no stall at all.',
    seeReads: [
      ['n.cells', 1024],
      ['n.ports', 3],
      ['ps.read', 301.2],
      ['ps.write', 150.6],
      ['cycles.run', 7],
      ['n.stalls', 0],
    ],
    try: [
      {
        say: 'Switch forwarding off. The three now take 11 cycles, and 4 of them are stalls.',
        set: { forwarding: 0 },
        reads: [
          ['cycles.run', 11],
          ['n.stalls', 4],
        ],
      },
      {
        say: 'Read the result with forwarding off. It is 27, the same value the forwarded run wrote.',
        set: { forwarding: 0 },
        reads: [['n.result', 27]],
      },
      {
        say: 'Read the two delays. A write costs 150.6 ps, which is half of the 301.2 ps a read costs.',
        reads: [
          ['ps.write', 150.6],
          ['ps.read', 301.2],
        ],
      },
    ],
    why:
      'An instruction reads two registers and writes one, so the file needs two read ports and a write port at once. ' +
      'The two reads are combinational and the write happens on the clock edge. ' +
      'This machine writes in the first half of the cycle and reads in the second, ' +
      'so an instruction in decode reads the value the instruction in write-back is putting there. ' +
      'That is why the run with forwarding switched off still ends at 27. ' +
      'It waits 4 extra cycles for the value and then reads the right one. ' +
      'Without that half-cycle write the file would need a third forwarding path, which is what E3 adds in front of the ALU.',
    whyReads: [['n.ports', 3]],
    whyAlso: [
      {
        set: { forwarding: 0 },
        reads: [
          ['n.result', 27],
          ['n.stalls', 4],
        ],
      },
    ],
  },

  b3: {
    see:
      'One memory access takes 451.8 ps, which is 12 gate delays and the largest block the machine has. ' +
      'The datapath holds two of them, one for instructions and one for data. ' +
      'Together they are 51.95 % of the one-cycle period of 1739.46 ps. ' +
      'The same block sets the pipelined period at 534.66 ps.',
    seeReads: [
      ['ps.access', 451.8],
      ['g.access', 12],
      ['n.appearances', 2],
      ['share.period', 0.519472],
      ['ps.single', 1739.46],
      ['ps.stage', 534.66],
    ],
    try: [
      {
        say: 'Set the memory access to 8 gate delays. The one-cycle period falls to 1438.26 ps, and the memories take 41.88 % of it.',
        set: { access: 8 },
        reads: [
          ['ps.single', 1438.26],
          ['share.period', 0.4188394],
        ],
      },
      {
        say: 'Set it to 24 gate delays. The period climbs to 2643.06 ps and the memories take 68.38 % of it.',
        set: { access: 24 },
        reads: [
          ['ps.single', 2643.06],
          ['share.period', 0.6837529],
        ],
      },
      {
        say: 'Read the pipelined period at that setting. One stage now needs 986.46 ps.',
        set: { access: 24 },
        reads: [['ps.stage', 986.46]],
      },
    ],
    why:
      'A memory is an array of cells with a decoder in front and a multiplexer behind. ' +
      'The model card states its access as 12 gate delays rather than simulating a thousand cells. ' +
      'What matters is that the number is the largest one in the card. ' +
      'A load meets it twice, once to fetch the instruction and once to read the data. ' +
      'Half of every cycle is spent in memory at the default, and the share moves with the knob. ' +
      'That is why the memory hierarchy is a third of this lab. ' +
      'Group F makes those 12 gate delays into a hit and the miss behind it into a hundred cycles.',
    whyReads: [
      ['g.access', 12],
      ['n.appearances', 2],
    ],
  },
}
