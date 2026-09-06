// Group A: arithmetic, where the delay is.

export const A_LESSONS = {
  a1: {
    see:
      'The carry in steps at the left of the diagram, and the carry out changes 2409.6 ps later. ' +
      'That is 64 gate delays, two for each of the 32 bits. The sum bits do not all wait for it. ' +
      'Bit 0 settles after 150.6 ps, while the top of the word settles at 2484.9 ps.',
    seeReads: [
      ['ps.carry', 2409.6],
      ['g.carry', 64],
      ['n.width', 32],
      ['ps.bit0', 150.6],
      ['ps.top', 2484.9],
    ],
    try: [
      {
        say: 'Set the width to 8. The carry now crosses in 602.4 ps, which is 16 gate delays.',
        set: { width: 8 },
        reads: [
          ['ps.carry', 602.4],
          ['g.carry', 16],
        ],
      },
      {
        say: 'Set the width to 4. The chain is 8 gate delays, and the adder has 20 gates.',
        set: { width: 4 },
        reads: [
          ['g.carry', 8],
          ['n.gates', 20],
        ],
      },
      {
        say: 'Read the first carry. It leaves bit 0 after 75.3 ps, and every bit after it costs the same 75.3 ps.',
        reads: [
          ['ps.first', 75.3],
          ['ps.perbit', 75.3],
        ],
      },
    ],
    why:
      'Each full adder makes its carry out of its carry in through an AND and an OR, which is two gate delays. ' +
      'Nothing in the design lets bit 31 start before bit 30 has finished, so the delays add rather than overlap. ' +
      'Thirty-two of them is 64 gate delays, and the adder is the slowest block in an arithmetic instruction because of it. ' +
      'The sum bits are cheap by comparison. Bit 0 needs two exclusive-ors and settles at 150.6 ps, ' +
      'and every other sum bit waits only for the carry that reaches it. ' +
      'A wider word costs proportionally more, which is the shape A2 sets out to break.',
    whyReads: [
      ['g.perbit', 2],
      ['g.carry', 64],
      ['ps.bit0', 150.6],
    ],
  },

  a2: {
    see:
      'Two levels of block lookahead bring the top carry down to 301.2 ps, which is 8 gate delays. ' +
      'The ripple carry beside it takes 2409.6 ps for the same 32 bits, so the carry is faster by a factor of 8.00. ' +
      'One four-bit block generates in 150.6 ps. The lookahead adder holds 241 gates, and the ripple adder holds 160 gates.',
    seeReads: [
      ['ps.lookahead', 301.2],
      ['g.lookahead', 8],
      ['ps.ripple', 2409.6],
      ['n.factor', 8],
      ['ps.block', 150.6],
      ['n.gates', 241],
      ['n.gatesripple', 160],
    ],
    try: [
      {
        say: 'Set the ripple adder to 4 bits. Its carry now costs 8 gate delays, the same as the 32-bit lookahead.',
        set: { width: 4 },
        reads: [
          ['g.ripple', 8],
          ['g.lookahead', 8],
          ['n.factor', 1],
        ],
      },
      {
        say: 'Set the ripple adder to 16 bits. Its chain is 32 gate delays, so the lookahead wins by 4.00.',
        set: { width: 16 },
        reads: [
          ['g.ripple', 32],
          ['n.factor', 4],
        ],
      },
      {
        say: 'Read the whole sum. The top bit settles at 489.45 ps, because it waits for the carry into it.',
        reads: [['ps.sum', 489.45]],
      },
    ],
    why:
      'Each bit says whether it generates a carry of its own. It also says whether it would propagate one that arrives. ' +
      'A block of four combines those answers into one pair, and a block of blocks combines four of those. ' +
      'The top carry is then four levels of AND-OR above the operands rather than thirty-two. ' +
      'The gates pay for it. This adder holds 241 of them where the ripple holds 160, a ratio of 1.51. ' +
      'Every level of the tree also adds fan-in that a real cell would have to drive. ' +
      'The sum still waits for the carry into its own bit, so the whole answer takes 489.45 ps.',
    whyReads: [
      ['n.gates', 241],
      ['n.gatesripple', 160],
      ['n.gateratio', 1.50625],
      ['ps.sum', 489.45],
      ['ps.lookahead', 301.2],
    ],
  },

  a3: {
    see:
      'The unit adds, subtracts, ands and ors with one adder and one output multiplexer. ' +
      'Its output settles 640.05 ps after the operands, which is 17 gate delays. ' +
      'The adder’s lookahead carry is 8 of those and the output multiplexer is 2 more. ' +
      'At the defaults it computes 17, and 503 gates are behind that number.',
    seeReads: [
      ['ps.alu', 640.05],
      ['g.alu', 17],
      ['g.carry', 8],
      ['g.mux', 2],
      ['n.result', 17],
      ['n.gates', 503],
    ],
    try: [
      {
        say: 'Switch the operation to subtract. The result is 7, from the same adder with the second operand inverted.',
        set: { fn: 'sub' },
        reads: [['n.result', 7]],
      },
      {
        say: 'Set operand a to 5 and operand b to 12, with subtract selected. The result is −7, and its sign bit reads 1.',
        set: { fn: 'sub', a: 5, b: 12 },
        reads: [
          ['n.result', -7],
          ['n.sign', 1],
        ],
      },
      {
        say: 'Switch the operation to and. The result is 4, and the output still takes 640.05 ps.',
        set: { fn: 'and' },
        reads: [
          ['n.result', 4],
          ['ps.alu', 640.05],
        ],
      },
    ],
    why:
      'Subtraction is addition with the second operand inverted and a carry in of one. ' +
      'One adder serves both, and the operation select is the wire that inverts. ' +
      'Set on less than needs no adder either. It is the sign bit of that same subtraction, ' +
      'which reads 1 exactly when the first operand is the smaller. ' +
      'What generality costs is the output multiplexer, 2 gate delays on every operation. ' +
      'The datapath’s model card charges the ALU its lookahead carry of 8 gate delays and the multiplexer separately. ' +
      'This netlist’s 17 also carries the two exclusive-ors that the card leaves inside the adder.',
    whyReads: [
      ['g.mux', 2],
      ['g.carry', 8],
      ['g.alu', 17],
    ],
    whyAlso: [{ set: { fn: 'sub', a: 5, b: 12 }, reads: [['n.sign', 1]] }],
  },

  a4: {
    see:
      'Shift and add takes one cycle a bit, so a 32-bit product is 32 cycles. ' +
      'At 534.66 ps a cycle that is 17.1091 ns for one multiply. ' +
      'The loop holds 1 adder. The array that does the same work in one cycle holds 32 of them.',
    seeReads: [
      ['cycles.multiply', 32],
      ['ps.period', 534.66],
      ['ns.multiply', 17.1091],
      ['n.loop', 1],
      ['n.array', 32],
    ],
    try: [
      {
        say: 'Set the product width to 8. The multiply now takes 8 cycles, which is 4.27728 ns.',
        set: { width: 8 },
        reads: [
          ['cycles.multiply', 8],
          ['ns.multiply', 4.27728],
        ],
      },
      {
        say: 'Set the product width to 16. The array would need 16 adders to keep it to one cycle.',
        set: { width: 16 },
        reads: [['n.array', 16]],
      },
    ],
    why:
      'A multiply is a sum of shifted copies of one operand, one copy for each bit of the other. ' +
      'Doing them one at a time needs one adder and one cycle a bit, which is the cheapest hardware and the slowest answer. ' +
      'Doing them at once needs an adder a bit. ' +
      'The 32-cycle loop and the 32-adder array compute the same product, and the choice between them is area against time. ' +
      'This is the first place in the lab where that trade is a number rather than a remark. ' +
      'The same trade is what pipelining answers differently in Group E, by keeping one adder and starting the next multiply before this one finishes.',
    whyReads: [
      ['cycles.multiply', 32],
      ['n.array', 32],
      ['n.loop', 1],
    ],
  },
}
