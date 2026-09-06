// Group B: Boolean algebra, the map, and what minimisation buys.

export const B_LESSONS = {
  b1: {
    see:
      'Absorption says that a with a AND b added to it is just a. Both sides are on screen. ' +
      'The left side takes an AND and an OR and arrives at 140 ps. The right side is one buffer at 40 ps. ' +
      'The table below has both outputs, and they agree in all four rows.',
    seeReads: [
      ['arrive.lhs', 140],
      ['arrive.rhs', 40],
      ['gates', 3],
      ['table.0.lhs', 0],
      ['table.0.rhs', 0],
      ['table.3.lhs', 1],
      ['table.3.rhs', 1],
    ],
    try: [
      {
        say: 'Read row 2, where a is 1 and b is 0. Both sides are 1, and the AND term contributed nothing.',
        reads: [
          ['table.2.lhs', 1],
          ['table.2.rhs', 1],
        ],
      },
      {
        say: 'Switch to distribution. Five gates now, and both sides arrive at 140 ps.',
        set: { law: 'distribution' },
        reads: [
          ['gates', 5],
          ['arrive.lhs', 140],
          ['arrive.rhs', 140],
        ],
      },
      {
        say: 'Read row 5 of distribution, where a and c are 1 and b is 0. Both sides give 1.',
        set: { law: 'distribution' },
        reads: [
          ['table.5.lhs', 1],
          ['table.5.rhs', 1],
        ],
      },
    ],
    why:
      'An identity in Boolean algebra is a claim that two circuits have the same truth table. ' +
      'That is a claim a table can settle, and here it is settled row by row rather than argued. ' +
      'Absorption is the one that pays. Its left side is two gates and 140 ps, and its right side is a buffer at 40 ps. ' +
      'Distribution does not pay at this library, because both sides come to 140 ps and one has three gates where the other has two. ' +
      'Which identity helps depends on the cells, and B5 measures that rather than assuming it.',
    whyReads: [
      ['arrive.lhs', 140],
      ['arrive.rhs', 40],
    ],
  },

  b2: {
    see:
      "De Morgan says that the complement of a AND b is a' OR b'. The left side is one NAND cell and arrives at 50 ps. " +
      'The right side is two inverters into an OR and arrives at 100 ps. Both sides are 0 only in row 3, where a and b are both 1.',
    seeReads: [
      ['arrive.lhs', 50],
      ['arrive.rhs', 100],
      ['gates', 4],
      ['table.3.lhs', 0],
      ['table.3.rhs', 0],
      ['table.0.lhs', 1],
      ['table.0.rhs', 1],
    ],
    try: [
      {
        say: 'Set a to 0. Both sides read 1, and the two agree as they do in every row.',
        set: { a: 0 },
        reads: [
          ['final.lhs', 1],
          ['final.rhs', 1],
        ],
      },
      {
        say: 'Read rows 1 and 2. Both sides give 1 in each, so one input held low is enough.',
        reads: [
          ['table.1.lhs', 1],
          ['table.1.rhs', 1],
          ['table.2.lhs', 1],
          ['table.2.rhs', 1],
        ],
      },
    ],
    why:
      'De Morgan turns an AND with inverted inputs into an OR, and an OR with inverted inputs into an AND. ' +
      'It is the identity that makes NAND universal, and A4 built an OR out of NAND gates by exactly this step. ' +
      'The cost is on screen. One NAND cell is 50 ps and the two-level version is 100 ps. ' +
      'Which side of the identity a design sits on is worth a factor of two in time here. ' +
      'The rule for reading it is to complement each variable and swap AND for OR.',
    whyReads: [
      ['arrive.lhs', 50],
      ['arrive.rhs', 100],
    ],
  },

  b3: {
    see:
      'The function is 1 in six of its eight rows, and this circuit writes one AND term for each of them. ' +
      'Six terms, each naming all three inputs, is 18 literals and 12 gates. The result arrives at 260 ps, ' +
      'because six terms do not fit one OR cell and the last level is a tree of them.',
    seeReads: [
      ['minterms.y', 6],
      ['canon.literals', 18],
      ['gates', 12],
      ['arrive.y', 260],
      ['rows', 8],
      ['inputs', 3],
    ],
    try: [
      {
        say: 'Switch the function to majority. Four terms, 8 gates, and 200 ps.',
        set: { fn: 'majority' },
        reads: [
          ['minterms.y', 4],
          ['gates', 8],
          ['arrive.y', 200],
        ],
      },
      {
        say: 'Switch to odd parity. Four terms again, and the same 8 gates and 200 ps.',
        set: { fn: 'parity' },
        reads: [
          ['minterms.y', 4],
          ['gates', 8],
          ['arrive.y', 200],
        ],
      },
      {
        say: 'Read row 3, the one row of the six-term function where y is 0.',
        reads: [
          ['table.3.y', 0],
          ['table.0.y', 1],
        ],
      },
    ],
    why:
      'Every function has a canonical sum of products, and it is read straight off the table. ' +
      'One AND term per row where the output is 1, each term naming every input, and an OR over all of them. ' +
      'It always works and it is never small. Six terms over three inputs is 18 literals, and no cell in this library takes six inputs, ' +
      'so the OR becomes two levels and the delay grows to 260 ps. The next two experiments find the same function ' +
      'written with three terms and six literals.',
    whyReads: [
      ['minterms.y', 6],
      ['canon.literals', 18],
      ['gates', 12],
      ['arrive.y', 260],
      ['cubes', 3],
      ['literals', 6],
    ],
  },

  b4: {
    see:
      "The map draws the same eight rows in Gray-code order, so that neighbouring cells differ in one variable. " +
      "A group of adjacent 1 cells is an implicant, and one that cannot be made larger is a prime implicant. " +
      "This function has 6 of them, and 3 are enough to cover every 1. The cover is a'b' + bc' + ac, at 6 literals.",
    seeReads: [
      ['primes', 6],
      ['cubes', 3],
      ['literals', 6],
      ['minterms.y', 6],
    ],
    claim: { expression: "a'b' + bc' + ac" },
    try: [
      {
        say: 'Switch to majority. Three primes, three cubes, and 6 literals.',
        set: { fn: 'majority' },
        reads: [
          ['primes', 3],
          ['cubes', 3],
          ['literals', 6],
        ],
      },
      {
        say: 'Switch to odd parity. Four primes and four cubes, and no pair of cells is adjacent.',
        set: { fn: 'parity' },
        reads: [
          ['primes', 4],
          ['cubes', 4],
          ['literals', 12],
        ],
      },
      {
        say: 'Back to the six-term function. Its cover uses 3 of the 6 primes.',
        reads: [
          ['primes', 6],
          ['cubes', 3],
        ],
      },
    ],
    why:
      'Two cells of the map that differ in one variable can be merged, and the merged term drops that variable. ' +
      'That is the whole content of the map, and the Gray-code order is what puts the mergeable cells next to each other. ' +
      'The engine finds every prime implicant by Quine and McCluskey, then takes the essential ones and covers the rest ' +
      'by exhaustive search. So the 3 cubes here are the fewest that exist, not the fewest a search happened to find. ' +
      'Odd parity has no adjacent pair at all, so its cover keeps every minterm as a term of its own. ' +
      'That is what minimisation is worth on a function that resists it.',
    whyReads: [
      ['primes', 6],
      ['cubes', 3],
      ['literals', 6],
    ],
  },

  b5: {
    see:
      'The cover of the previous experiment, built as gates. Seven gates, 3 terms, 6 literals, and 180 ps. ' +
      'Switch the form knob to write every minterm out instead, and the table below does not change. ' +
      'What changes is the gate count and the delay.',
    seeReads: [
      ['gates', 7],
      ['arrive.y', 180],
      ['cubes', 3],
      ['literals', 6],
      ['table.0.y', 1],
      ['table.3.y', 0],
    ],
    try: [
      {
        say: 'Switch the form to every minterm. Twelve gates and 260 ps, and the same table.',
        set: { form: 'canonical' },
        reads: [
          ['gates', 12],
          ['arrive.y', 260],
          ['table.0.y', 1],
          ['table.3.y', 0],
        ],
      },
      {
        say: 'Switch to majority at the minimum. Four gates and 150 ps, and no inverter at all.',
        set: { fn: 'majority' },
        reads: [
          ['gates', 4],
          ['arrive.y', 150],
        ],
      },
      {
        say: 'Switch to majority written out in full. Eight gates and 200 ps.',
        set: { fn: 'majority', form: 'canonical' },
        reads: [
          ['gates', 8],
          ['arrive.y', 200],
        ],
      },
    ],
    why:
      'Minimisation is worth two things and this experiment measures both. It is worth gates, ' +
      'which on a chip is area and is power. It is also worth delay, because a term of three literals needs a three-input cell ' +
      'and six terms need two levels of OR. On this function the minimum is 7 gates and 180 ps, ' +
      'where writing every minterm out takes 12 gates and 260 ps. ' +
      'The table is unchanged throughout, so the two circuits compute the same function and one of them is smaller. ' +
      'What the map does not touch is the hazard, and Group D is where that appears.',
    whyReads: [
      ['gates', 7],
      ['arrive.y', 180],
      ['minterms.y', 6],
    ],
    whyAlso: [
      {
        set: { form: 'canonical' },
        reads: [
          ['gates', 12],
          ['arrive.y', 260],
        ],
      },
    ],
  },

  b6: {
    see:
      "The multiplexer's own table has four rows where y is 1, and its minimum cover is two terms of two literals: bs + as'. " +
      'That is the circuit C1 draws, arrived at from the table rather than from a picture. The netlist has 4 gates and arrives at 170 ps.',
    seeReads: [
      ['minterms.y', 4],
      ['cubes', 2],
      ['literals', 4],
      ['primes', 3],
      ['gates', 4],
      ['arrive.y', 170],
    ],
    claim: { expression: "bs + as'" },
    try: [
      {
        say: 'Set the select to 1. The output follows b, which reads 1.',
        set: { s: 1 },
        reads: [
          ['final.y', 1],
          ['final.b', 1],
        ],
      },
      {
        say: 'Set the select to 1 and b to 0. The output follows b down to 0, whatever a is.',
        set: { s: 1, b: 0 },
        reads: [
          ['final.y', 0],
          ['final.a', 0],
        ],
      },
      {
        say: 'Read rows 4 and 6 of the table, where the select is 0 and a is 1. The output is 1 in both.',
        reads: [
          ['table.4.y', 1],
          ['table.6.y', 1],
        ],
      },
    ],
    why:
      'The multiplexer is usually drawn first and explained afterwards. Here it arrives the other way round. ' +
      'Its table is four rows of 1 out of eight, its minimum cover is two terms, and those two terms are the two AND gates in the picture. ' +
      'The third prime implicant is ab, which covers rows 6 and 7 and is not needed, ' +
      'because those rows are already covered by the two terms that are. A prime the cover does not use is not wasted work, ' +
      'and Group D shows one earning its place.',
    whyReads: [
      ['cubes', 2],
      ['primes', 3],
      ['literals', 4],
    ],
  },
}
