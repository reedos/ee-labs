// Group C: the blocks a datapath is made of.

export const C_LESSONS = {
  c1: {
    see:
      'The multiplexer passes a when the select is 0 and b when it is 1. Its four rows of the table say so, ' +
      'and the picture says how. The select passes an inverter before its AND, so that branch is settled at 100 ps ' +
      'where the other is settled at 70 ps. The output waits for the later of the two, at 170 ps.',
    seeReads: [
      ['arrive.m0', 100],
      ['arrive.m1', 70],
      ['arrive.y', 170],
      ['final.y', 0],
      ['gates', 4],
    ],
    try: [
      {
        say: 'Set the select to 1. The output follows b and reads 1.',
        set: { s: 1 },
        reads: [
          ['final.y', 1],
          ['final.b', 1],
        ],
      },
      {
        say: 'Set a to 1 with the select at 0. The output follows a and reads 1.',
        set: { a: 1 },
        reads: [
          ['final.y', 1],
          ['final.a', 1],
        ],
      },
      {
        say: 'Read rows 3 and 5 of the table. Row 3 selects b at 1, and row 5 selects b at 0.',
        reads: [
          ['table.3.y', 1],
          ['table.5.y', 0],
        ],
      },
    ],
    why:
      'The multiplexer is the circuit that makes a choice, and every datapath is full of them. ' +
      'Its two AND gates are enabled one at a time by the select and its complement, and the OR collects whichever one is on. ' +
      'The two branches are not the same length. One reaches its AND at 70 ps and the other at 100 ps, ' +
      'because only one of them has the inverter in front of it. The OR then waits for the later, at 170 ps. ' +
      'Two paths of unequal length reconverging on one gate is exactly the arrangement Group D is about.',
    whyReads: [
      ['arrive.m0', 100],
      ['arrive.m1', 70],
      ['arrive.y', 170],
    ],
  },

  c2: {
    see:
      'Two address bits, four outputs, and exactly one of them high in every row. At the defaults the address is 0 and d0 is the one. ' +
      'Three of the outputs arrive at 100 ps, because they need a complemented address bit. The fourth, d3, arrives at 70 ps, ' +
      'because it needs no complement.',
    seeReads: [
      ['final.d0', 1],
      ['final.d1', 0],
      ['final.d2', 0],
      ['final.d3', 0],
      ['arrive.d0', 100],
      ['arrive.d3', 70],
      ['gates', 6],
    ],
    try: [
      {
        say: 'Set the low address bit to 1. The high line moves from d0 to d1.',
        set: { a0: 1 },
        reads: [
          ['final.d1', 1],
          ['final.d0', 0],
        ],
      },
      {
        say: 'Set both address bits to 1. Now d3 is high, and it is the output that arrives first.',
        set: { a1: 1, a0: 1 },
        reads: [
          ['final.d3', 1],
          ['arrive.d3', 70],
        ],
      },
      {
        say: 'Read the table. Row 2 raises d2, and the other three outputs are 0.',
        reads: [
          ['table.2.d2', 1],
          ['table.2.d0', 0],
          ['table.2.d1', 0],
          ['table.2.d3', 0],
        ],
      },
    ],
    why:
      'A decoder turns a number into a line. With n address bits it has 2 to the n outputs and raises exactly one of them, ' +
      'which is how a memory picks a row and how an instruction picks an operation. ' +
      'Each output is one AND term over the address bits and their complements, so a decoder is 2 to the n minterms built at once. ' +
      'The gap between d3 at 70 ps and the other three at 100 ps is the inverter that three of the four need. ' +
      'That same inverter becomes a glitch in D3.',
    whyReads: [
      ['arrive.d0', 100],
      ['arrive.d3', 70],
      ['arrive.n1', 30],
    ],
  },

  c3: {
    see:
      'Two bits go in and two come out. The sum is the exclusive-or of the inputs and the carry is their AND. ' +
      'Read as a two-bit number, the outputs count the 1 inputs. Both inputs are 1 here, ' +
      'so the sum is 0 and the carry is 1, which is 2 in binary. The sum arrives at 90 ps and the carry at 70 ps.',
    seeReads: [
      ['final.s', 0],
      ['final.c', 1],
      ['arrive.s', 90],
      ['arrive.c', 70],
      ['gates', 2],
    ],
    try: [
      {
        say: 'Set b to 0. One input is 1, so the sum is 1 and the carry is 0.',
        set: { b: 0 },
        reads: [
          ['final.s', 1],
          ['final.c', 0],
        ],
      },
      {
        say: 'Set both inputs to 0. Both outputs are 0, and nothing in the circuit moves.',
        set: { a: 0, b: 0 },
        reads: [
          ['final.s', 0],
          ['final.c', 0],
          ['edges.s', 0],
        ],
      },
      {
        say: 'Read rows 1 and 2 of the table. Each has one input at 1, so each gives a sum of 1 and no carry.',
        reads: [
          ['table.1.s', 1],
          ['table.1.c', 0],
          ['table.2.s', 1],
          ['table.2.c', 0],
        ],
      },
    ],
    why:
      'Adding two bits gives a two-bit answer, and the two bits of that answer are two separate functions of the inputs. ' +
      'The low bit is 1 when exactly one input is 1, which is the exclusive-or. ' +
      'The high bit is 1 when both are, which is the AND. It is called a half adder because it has nowhere to put a carry coming in, ' +
      'and C4 gives it one. The sum takes 90 ps and the carry 70 ps, ' +
      'so the two bits of one answer do not arrive together. Nothing downstream may assume they do.',
    whyReads: [
      ['arrive.s', 90],
      ['arrive.c', 70],
    ],
  },

  c4: {
    see:
      'Three bits in, two out, and the outputs still count the 1 inputs. At the defaults a and b are 1 and the carry in is 0, ' +
      'so the sum is 0 and the carry out is 1. The sum arrives at 180 ps and the carry out at 230 ps. ' +
      'The path list names the longest one: a through the exclusive-or, the AND and the OR.',
    seeReads: [
      ['final.s', 0],
      ['final.cout', 1],
      ['arrive.s', 180],
      ['arrive.cout', 230],
      ['gates', 5],
    ],
    try: [
      {
        say: 'Set the carry in to 1. All three inputs are 1, so the sum is 1 and the carry out stays 1.',
        set: { cin: 1 },
        reads: [
          ['final.s', 1],
          ['final.cout', 1],
        ],
      },
      {
        say: 'Set b to 0 with the carry in at 1. Two inputs are 1, so the sum is 0 and the carry out is 1.',
        set: { b: 0, cin: 1 },
        reads: [
          ['final.s', 0],
          ['final.cout', 1],
        ],
      },
      {
        say: 'Read row 7, where all three inputs are 1. The sum is 1 and the carry out is 1, which is 3.',
        reads: [
          ['table.7.s', 1],
          ['table.7.cout', 1],
        ],
      },
    ],
    why:
      'The full adder is the cell a whole adder is made of, and the number that matters about it is not 230 ps. ' +
      'It is the delay from the carry in to the carry out, because that is the path a wide adder repeats. ' +
      'The carry in reaches the generate AND in one gate and the OR one gate after that. ' +
      'The 230 ps here is from an operand bit, which has to pass the exclusive-or at 90 ps first, ' +
      'and that happens once at the bottom of an adder. C5 puts four of these in a row and the two numbers separate.',
    whyReads: [
      ['arrive.cout', 230],
      ['arrive.s', 180],
      ['arrive.x', 90],
    ],
  },

  c5: {
    see:
      'Four full adders, each carry feeding the next. Here 7 and 5 go in and 12 comes out, ' +
      'as the sum bits 0, 0, 1, 1 with a carry out of 0. The sum bits do not arrive together. ' +
      's0 settles at 180 ps and s3 at 600 ps. The carry out is last, at 650 ps.',
    seeReads: [
      ['arrive.s0', 180],
      ['arrive.s3', 600],
      ['arrive.cout', 650],
      ['gates', 20],
      ['final.s0', 0],
      ['final.s2', 1],
    ],
    try: [
      {
        say: 'Set both operands to 15. The sum is 30, so the carry out is 1 and the low sum bit is 0.',
        set: { a: 15, b: 15 },
        reads: [
          ['final.s0', 0],
          ['final.s3', 1],
          ['final.cout', 1],
        ],
      },
      {
        say: 'Set a to 15 and b to 0, then raise the carry in. The sum is 16, every sum bit 0 and the carry out 1.',
        set: { a: 15, b: 0, cin: 1 },
        reads: [
          ['final.s0', 0],
          ['final.s3', 0],
          ['final.cout', 1],
        ],
      },
      {
        say: 'Read the path list. The longest path is 650 ps and it runs down the carry chain.',
        reads: [
          ['path.long', 650],
          ['arrive.s1', 320],
        ],
      },
    ],
    why:
      'This adds correctly for all 256 pairs of four-bit operands, and the test checks every one. ' +
      'What the picture adds is that the answer is not ready all at once. ' +
      'Bit 0 has one exclusive-or and one carry to wait for, at 180 ps. Bit 3 waits for three carries as well, at 600 ps. ' +
      'And the carry out, which is bit 4 of the answer, is last at 650 ps. ' +
      'Anything reading this adder has to wait for the last of those, and Group G is where a clock is set to do that.',
    whyReads: [
      ['arrive.s0', 180],
      ['arrive.s3', 600],
      ['arrive.cout', 650],
    ],
  },

  c6: {
    see:
      'The same adder with its width on a knob. At four bits the carry chain is 650 ps, in 20 gates. ' +
      'Each extra bit adds one AND and one OR to it, so the delay is a straight line in the width. ' +
      'Doubling the adder to eight bits takes it to 1210 ps and 40 gates.',
    seeReads: [
      ['path.long', 650],
      ['gates', 20],
    ],
    seeAlso: [
      {
        set: { n: 8 },
        reads: [
          ['path.long', 1210],
          ['gates', 40],
        ],
      },
    ],
    try: [
      {
        say: 'Set the width to 8. The carry chain is 1210 ps, and the netlist has 40 gates.',
        set: { n: 8 },
        reads: [
          ['path.long', 1210],
          ['gates', 40],
        ],
      },
      {
        say: 'Set the width to 2. The chain is 370 ps, in 10 gates.',
        set: { n: 2 },
        reads: [
          ['path.long', 370],
          ['gates', 10],
        ],
      },
      {
        say: 'Set the width to 1. One full adder, and 230 ps from an operand bit to the carry out.',
        set: { n: 1 },
        reads: [
          ['path.long', 230],
          ['gates', 5],
        ],
      },
    ],
    why:
      'The carry has to travel from the bottom of the adder to the top, and nothing can start on a bit until the carry below it has arrived. ' +
      'So the delay grows in proportion to the width. Four bits take 650 ps and eight bits take 1210 ps, ' +
      'and each bit added costs the same one AND and one OR. ' +
      'That is the reason carry-lookahead and carry-select adders exist, and they are the Computer Lab’s datapath. ' +
      'This lab states the cost and names what fixes it. What it does with the cost is Group G, ' +
      'where the longest path becomes the clock period.',
    whyReads: [['path.long', 650]],
    whyAlso: [{ set: { n: 8 }, reads: [['path.long', 1210]] }],
  },
}
