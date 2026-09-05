// Group A: gates and truth tables. Every number below is a reading.

export const A_LESSONS = {
  a1: {
    see:
      'The inverter puts out the opposite of what goes in. Input a steps from 0 to 1 at 200 ps, and y falls at 230 ps. ' +
      'The gap is the inverter delay, 30 ps. Both values are drawn as a step with a vertical edge, because in this engine a signal ' +
      'is at one level or the other and never between them.',
    seeReads: [
      ['edge.a.1', 200],
      ['edge.y.1', 230],
      ['final.y', 0],
      ['path.long', 30],
    ],
    try: [
      {
        say: 'Raise the inverter delay to 100 ps. The output now falls at 300 ps, and the input has not moved.',
        set: { tnot: 100 },
        reads: [
          ['edge.y.1', 300],
          ['edge.a.1', 200],
        ],
      },
      {
        say: 'Set a to start at 1. It falls at 200 ps and y rises at 230 ps, the same 30 ps later.',
        set: { a: 1 },
        reads: [
          ['edge.a.1', 200],
          ['edge.y.1', 230],
          ['final.y', 1],
        ],
      },
      {
        say: 'Open the truth table. Two rows, because the gate has one input.',
        reads: [
          ['rows', 2],
          ['table.0.y', 1],
          ['table.1.y', 0],
        ],
      },
    ],
    why:
      'A logic signal takes one of two values, and this lab treats those two as the whole of what a wire carries. ' +
      'A real wire carries a voltage, and the circuit that turns a range of voltages into one of two values is the CMOS inverter, ' +
      'which the Electronics Lab builds. This lab starts after that step and takes the two values as given. ' +
      'What it does not take as given is the time. A gate reads its input, and its output follows some time later, and that time is the ' +
      'propagation delay. Here it is 30 ps and it is a knob. Every number in the rest of this lab is a sum of numbers like it.',
    whyReads: [
      ['path.long', 30],
      ['edge.y.1', 230],
    ],
  },

  a2: {
    see:
      'Two gates on the same two inputs. The AND is 1 only when both inputs are 1, and the OR is 1 when either is. ' +
      'With a held at 1, b steps to 1 at 200 ps and the AND output rises at 270 ps, 70 ps later. The OR was already 1 and does not move. ' +
      'The truth table below has all four rows.',
    seeReads: [
      ['edge.b.1', 200],
      ['edge.yand.1', 270],
      ['edges.yor', 0],
      ['final.yor', 1],
      ['arrive.yand', 70],
    ],
    try: [
      {
        say: 'Set a to 0. Now the OR follows b and rises at 270 ps, and the AND stays at 0.',
        set: { a: 0 },
        reads: [
          ['edge.yor.1', 270],
          ['final.yand', 0],
        ],
      },
      {
        say: 'Raise the OR delay to 150 ps. The OR now rises at 350 ps, and the AND is unchanged.',
        set: { a: 0, tor: 150 },
        reads: [
          ['edge.yor.1', 350],
          ['arrive.yand', 70],
        ],
      },
      {
        say: 'Read row 3 of the table, where both inputs are 1. The AND is 1 and so is the OR.',
        reads: [
          ['table.3.yand', 1],
          ['table.3.yor', 1],
          ['table.1.yand', 0],
        ],
      },
    ],
    why:
      'A truth table is the whole of what a combinational circuit computes. Two inputs give four rows, three give eight, ' +
      'and n inputs give 2 to the n. The table says nothing about time, and the two gates here take 70 ps each to obey it. ' +
      'Those two facts stay separate for the rest of the lab. Groups A to C treat a circuit as its table, and Group D is about ' +
      'the interval before the table is true.',
    whyReads: [
      ['arrive.yand', 70],
      ['arrive.yor', 70],
      ['rows', 4],
    ],
  },

  a3: {
    see:
      'A NAND is an AND with the answer inverted, and it is the cheaper cell. The NAND output falls at 250 ps, ' +
      '50 ps after b rises. The AND beside it rises at 270 ps, 70 ps after. Put an inverter on the NAND to get the same ' +
      'answer and it arrives at 280 ps. So the pair costs 80 ps where the single AND cell costs 70 ps.',
    seeReads: [
      ['edge.n.1', 250],
      ['edge.aa.1', 270],
      ['edge.ni.1', 280],
      ['arrive.n', 50],
      ['arrive.aa', 70],
      ['arrive.ni', 80],
    ],
    try: [
      {
        say: 'Raise the NAND delay to 70 ps. The pair now costs 100 ps, and the AND cell still costs 70 ps.',
        set: { tnand: 70 },
        reads: [
          ['arrive.ni', 100],
          ['arrive.aa', 70],
        ],
      },
      {
        say: 'Lower the inverter to 10 ps. The pair costs 60 ps, which is less than the AND cell.',
        set: { tnot: 10 },
        reads: [
          ['arrive.ni', 60],
          ['arrive.aa', 70],
        ],
      },
      {
        say: 'Read the table. The inverted NAND agrees with the AND in all four rows.',
        reads: [
          ['table.3.ni', 1],
          ['table.3.aa', 1],
          ['table.0.ni', 0],
          ['table.0.aa', 0],
        ],
      },
    ],
    why:
      'A NAND is one stage of transistors and an AND is that stage with an inverter after it. ' +
      'That is why the library gives the NAND 50 ps and the AND 70 ps. ' +
      'The inverted NAND here takes 80 ps, which is the 50 ps and the 30 ps added. ' +
      'It is slower than the 70 ps cell, because the cell was built as one piece. ' +
      'A design that ends on a NAND rather than an AND saves the difference.',
    whyReads: [
      ['arrive.n', 50],
      ['arrive.aa', 70],
      ['arrive.ni', 80],
    ],
  },

  a4: {
    see:
      'The exclusive-or is built here from four NAND gates. The library cell for the same function sits beside it as ref. ' +
      'The two agree in every row of the table. The built version arrives at 150 ps and the cell at 90 ps. ' +
      'Building the function out of NAND gates costs three extra gates and arrives later.',
    seeReads: [
      ['arrive.y', 150],
      ['arrive.ref', 90],
      ['gates', 5],
      ['table.1.y', 1],
      ['table.1.ref', 1],
      ['table.3.y', 0],
    ],
    try: [
      {
        say: 'Switch the function to AND. Two NAND gates and 100 ps, against the cell at 70 ps.',
        set: { which: 'and' },
        reads: [
          ['arrive.y', 100],
          ['arrive.ref', 70],
          ['gates', 3],
        ],
      },
      {
        say: 'Switch the function to the inverter. One NAND with both inputs tied together takes 50 ps, against the cell at 30 ps.',
        set: { which: 'not' },
        reads: [
          ['arrive.y', 50],
          ['arrive.ref', 30],
          ['gates', 2],
        ],
      },
      {
        say: 'Switch to OR. Three NAND gates, 100 ps, and the same table as the OR cell.',
        set: { which: 'or' },
        reads: [
          ['arrive.y', 100],
          ['gates', 4],
          ['table.1.y', 1],
          ['table.0.y', 0],
        ],
      },
    ],
    why:
      'Any function of any number of inputs can be built from NAND gates alone, which is what makes the NAND universal. ' +
      'The proof is the four constructions here. A NAND with its inputs tied together is an inverter. An inverted NAND is an AND. ' +
      'Inverting both inputs of a NAND gives an OR, which is De Morgan and is B2. Four of them give an exclusive-or. ' +
      'Universality is why a process can offer a small set of cells and still build anything. ' +
      'What it costs is on screen. The built exclusive-or takes 150 ps where the cell takes 90 ps.',
    whyReads: [
      ['arrive.y', 150],
      ['arrive.ref', 90],
    ],
  },

  a5: {
    see:
      'Three inputs into four gates, and one output. The table has eight rows, and y is 1 in four of them. ' +
      'Those four rows are the minterms of y, and they are rows 1, 3, 6 and 7. At the defaults every input is 1, ' +
      'so the circuit sits in row 7 and y reads 1.',
    seeReads: [
      ['rows', 8],
      ['inputs', 3],
      ['minterms.y', 4],
      ['final.y', 1],
      ['table.7.y', 1],
    ],
    try: [
      {
        say: 'Set a to 0. The circuit moves to row 3, and y is still 1.',
        set: { a: 0 },
        reads: [
          ['table.3.y', 1],
          ['final.y', 1],
        ],
      },
      {
        say: 'Set a to 0 and c to 0 as well. Row 2, and y is 0.',
        set: { a: 0, c: 0 },
        reads: [
          ['table.2.y', 0],
          ['final.y', 0],
        ],
      },
      {
        say: 'Set b to 0 with a at 1. Row 4, and y is 0.',
        set: { b: 0 },
        reads: [
          ['table.4.y', 0],
          ['final.y', 0],
        ],
      },
    ],
    why:
      'The table of a netlist is found by holding every input still and reading the output, once for each of the 2 to the n vectors. ' +
      'This lab computes it twice by two routes that share no code. One walks the gates in order with no delays at all. ' +
      'The other runs the simulator and reads where it settles. They agree for every row of every netlist in the lab, ' +
      'which is one of the four things the engine is fuzzed against. A row where they disagreed would mean the delays had changed ' +
      'the answer rather than only its timing.',
    whyReads: [
      ['rows', 8],
      ['inputs', 3],
    ],
  },

  a6: {
    see:
      'One source drives two things. The buffer copies its input after 40 ps, and the wire copies it after 10 ps. ' +
      'Input a rises at 200 ps, the wire follows at 210 ps and the buffer at 240 ps. Neither changed the value, and both cost time.',
    seeReads: [
      ['edge.a.1', 200],
      ['edge.w.1', 210],
      ['edge.buf.1', 240],
      ['final.buf', 1],
      ['final.w', 1],
    ],
    try: [
      {
        say: 'Raise the wire delay to 120 ps. The wire now arrives at 320 ps, after the buffer.',
        set: { twire: 120 },
        reads: [
          ['edge.w.1', 320],
          ['edge.buf.1', 240],
        ],
      },
      {
        say: 'Set the buffer to 10 ps and the wire to 100 ps. The interconnect now costs more than the gate.',
        set: { tbuf: 10, twire: 100 },
        reads: [
          ['arrive.buf', 10],
          ['arrive.w', 100],
        ],
      },
    ],
    why:
      'A buffer is a gate that computes the identity. It exists because a signal driving many inputs needs the current. ' +
      'A wire is not a gate at all, and this engine gives it a delay because a real interconnect has one. ' +
      'Both are drivers with no logic in them, and both matter for the same reason. ' +
      'A path from an input to an output is the sum of everything along it. ' +
      'At this library a wire is 10 ps and a buffer is 40 ps, and either can dominate once the numbers are turned.',
    whyReads: [
      ['arrive.w', 10],
      ['arrive.buf', 40],
    ],
  },
}
