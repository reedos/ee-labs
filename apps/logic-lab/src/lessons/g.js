// Group G: the clock.

export const G_LESSONS = {
  g1: {
    see:
      'Four bits of adder between two registers. The longest path is the carry chain, 650 ps of logic. ' +
      'Around it sit the launching flip-flop’s 80 ps to Q and the capturing flip-flop’s 40 ps of setup. ' +
      'So the period cannot be shorter than 770 ps, and the frequency cannot be higher than 1.2987 GHz.',
    seeReads: [
      ['tpd', 650],
      ['flop.tcq', 80],
      ['flop.tsu', 40],
      ['tmin', 770],
      ['fmax', 1.2987e9],
    ],
    try: [
      {
        say: 'Clock it at 5000 ps. There is 4230 ps of slack and the run reports nothing.',
        set: { period: 5000 },
        reads: [
          ['setupslack', 4230],
          ['violations', 0],
        ],
      },
      {
        say: 'Set the width to 8. The logic nearly doubles to 1210 ps and the period goes to 1330 ps.',
        set: { n: 8 },
        reads: [
          ['tpd', 1210],
          ['tmin', 1330],
        ],
      },
      {
        say: 'Read the path list. The longest row is the carry chain, and it names every gate along it.',
        reads: [['tpd', 650]],
      },
    ],
    why:
      'A clock period has to be long enough for the slowest thing that has to happen inside one. That is three ' +
      'terms and no more. The launching flip-flop takes its clock-to-Q to put a value on its output. The logic ' +
      'takes its longest path to carry that value to the next flip-flop’s input. The capturing flip-flop needs its ' +
      'setup time before its own edge. ' +
      'Nothing else is in it. There is no margin, no derating and no statistics here, because every delay in this ' +
      'engine is exact. A real design adds all three, and the VLSI Lab is where the delays stop being a table. ' +
      'The frequency is one over the period, so a design is quoted either way and the two are the same statement.',
    whyReads: [
      ['tmin', 770],
      ['fmax', 1.2987e9],
    ],
  },

  g2: {
    see:
      'The same design is timed at five widths. At 2 bits the period is 490 ps and at 4 bits it is 770 ps, or ' +
      '1.2987 GHz. At 8 bits it reaches 1330 ps and at 16 bits 2450 ps. At 32 bits it is 4690 ps, which is ' +
      '213.22 MHz. Every bit adds one AND and one OR to the carry chain.',
    seeReads: [
      ['tmin', 770],
      ['fmax', 1.2987e9],
    ],
    seeAlso: [
      { set: { n: 2 }, reads: [['tmin', 490]] },
      { set: { n: 8 }, reads: [['tmin', 1330]] },
      { set: { n: 16 }, reads: [['tmin', 2450]] },
      { set: { n: 32 }, reads: [['tmin', 4690], ['fmax', 2.1322e8]] },
    ],
    try: [
      {
        say: 'Set the width to 32. The logic alone is 4570 ps and the frequency falls to 213.22 MHz.',
        set: { n: 32 },
        reads: [
          ['tpd', 4570],
          ['fmax', 2.1322e8],
        ],
      },
      {
        say: 'Set the width to 5, then to 6. Each bit adds one AND and one OR to the chain, and the period reaches 1050 ps.',
        set: { n: 6 },
        reads: [['tmin', 1050]],
      },
      {
        say: 'Read the hold margin at any width. It is 200 ps and it does not move, because the shortest path does not grow.',
        reads: [['holdslack', 200]],
      },
    ],
    why:
      'The ripple adder’s carry chain is one AND and one OR per bit, which C6 measured. ' +
      'Between registers, that same slope becomes the clock period, and the frequency is one over it. ' +
      'So a wider adder is not a little slower. It is slower in proportion to its width, and doubling the width ' +
      'nearly doubles the period. ' +
      'The shortest path does not grow at all, because the fastest way from a flip-flop to a flip-flop is still one ' +
      'exclusive-or and one AND at the bottom bit. That is why the hold margin is the same 200 ps at every width. ' +
      'The two checks are about different paths, and only one of them cares how wide the adder is.',
    whyReads: [
      ['tmin', 770],
      ['holdslack', 200],
    ],
    whyAlso: [{ set: { n: 6 }, reads: [['holdslack', 200]] }],
  },

  g3: {
    see:
      'Two bits of logic between the registers instead of four. The path is 370 ps rather than 650 ps, so the ' +
      'period falls to 490 ps and the frequency rises to 2.0408 GHz. Nothing about the gates changed. ' +
      'The registers were moved closer together, and the clock followed.',
    seeReads: [
      ['tpd', 370],
      ['tmin', 490],
      ['fmax', 2.0408e9],
    ],
    seeAlso: [{ set: { n: 4 }, reads: [['tpd', 650], ['tmin', 770], ['fmax', 1.2987e9]] }],
    try: [
      {
        say: 'Set it back to 4 bits. The period goes to 770 ps and the frequency down to 1.2987 GHz.',
        set: { n: 4 },
        reads: [
          ['tmin', 770],
          ['fmax', 1.2987e9],
        ],
      },
      {
        say: 'Set it to 8 bits. Now the period is 1330 ps, which is more than twice the two-bit one.',
        set: { n: 8 },
        reads: [['tmin', 1330]],
      },
      {
        say: 'Read the clock-to-Q and setup terms at either width. They are 80 ps and 40 ps, and only the logic between them moved.',
        reads: [
          ['flop.tcq', 80],
          ['flop.tsu', 40],
        ],
      },
    ],
    why:
      'Cutting the logic between two registers in half does not halve the period, because two of its three terms ' +
      'belong to the flip-flops and do not move. Here it goes from 770 ps to 490 ps, which is a factor of about ' +
      'one and a half rather than two. ' +
      'The clock is faster and the answer is not sooner. A four-bit sum computed by two two-bit stages takes two ' +
      'clocks of 490 ps, and that is longer than one clock of 770 ps. Pipelining buys throughput and it costs ' +
      'latency, and the flip-flop’s own two times are what it costs. Cutting a design into more and more stages ' +
      'runs into that floor, which F1 measured with no logic between the registers at all.',
    whyReads: [
      ['tmin', 490],
      ['flop.tcq', 80],
      ['flop.tsu', 40],
    ],
    whyAlso: [{ set: { n: 4 }, reads: [['tmin', 770]] }],
  },

  g4: {
    see:
      'A wire between the launching clock and the capturing one, 50 ps long. The capturing edge arrives 50 ps ' +
      'late, so the setup check has 50 ps longer and the period falls from 770 ps to 720 ps. ' +
      'The hold check loses exactly the same 50 ps, from 200 ps of margin down to 150 ps.',
    seeReads: [
      ['skew', 50],
      ['tmin', 720],
      ['holdslack', 150],
    ],
    seeAlso: [{ set: { skew: 0 }, reads: [['tmin', 770], ['holdslack', 200]] }],
    try: [
      {
        say: 'Set the skew to 200 ps. The period is down to 570 ps and the hold margin is exactly 0 ps.',
        set: { skew: 200 },
        reads: [
          ['tmin', 570],
          ['holdslack', 0],
        ],
      },
      {
        say: 'Add one more picosecond, 201 ps. The hold check now fails, by that one picosecond.',
        set: { skew: 201 },
        reads: [['holdslack', -1]],
      },
      {
        say: 'Set the skew to 300 ps and read the events. The run itself now reports violations, not only the check.',
        set: { skew: 300 },
        reads: [
          ['holdslack', -100],
          ['violations', 2],
        ],
      },
    ],
    why:
      'Skew is the capturing clock arriving later than the launching one. That extra time is on the setup check’s ' +
      'side, because the data has longer to arrive before the edge that takes it. It is against the hold check, ' +
      'because the same edge is later than the data change that follows it. ' +
      'So one picosecond of skew buys one picosecond of period and spends one picosecond of hold margin, which is ' +
      'what the two readings show. The trade runs out at 200 ps here, where the hold margin reaches 0 ps. ' +
      'Past that the design is broken in a way no clock frequency fixes, which is G5. Deliberate skew is a real ' +
      'technique, and this is the price it is paid in.',
    whyReads: [
      ['skew', 50],
      ['tmin', 720],
      ['holdslack', 150],
    ],
    whyAlso: [{ set: { skew: 200 }, reads: [['holdslack', 0]] }],
  },

  g5: {
    see:
      'The same design at two clock periods. At 1000 ps there is 230 ps of setup slack and 200 ps of hold margin. ' +
      'At 5000 ps the setup slack is 4230 ps and the hold margin is still 200 ps. ' +
      'Slowing the clock down by a factor of five bought a great deal of one and none at all of the other.',
    seeReads: [
      ['setupslack', 230],
      ['holdslack', 200],
      ['period', 1000],
    ],
    seeAlso: [{ set: { period: 5000 }, reads: [['setupslack', 4230], ['holdslack', 200]] }],
    try: [
      {
        say: 'Set the period to 2000 ps. The setup slack is 1230 ps and the hold margin has not moved.',
        set: { period: 2000 },
        reads: [
          ['setupslack', 1230],
          ['holdslack', 200],
        ],
      },
      {
        say: 'Add 150 ps of skew at 1000 ps. Now the hold margin is 50 ps, and it is the skew that moved it.',
        set: { skew: 150 },
        reads: [
          ['holdslack', 50],
          ['setupslack', 380],
        ],
      },
      {
        say: 'Keep that skew and go to 5000 ps. The hold margin is the same 50 ps at four times the period.',
        set: { skew: 150, period: 5000 },
        reads: [
          ['holdslack', 50],
          ['setupslack', 4380],
        ],
      },
    ],
    why:
      'The setup check is that the period is long enough for the clock-to-Q, the logic and the setup time. ' +
      'The period is in it, so making the period longer always helps. ' +
      'The hold check is that the shortest path from one flip-flop to the next is long enough to cover the hold ' +
      'time and the skew. The period is not in it anywhere. ' +
      'That is why a hold failure is the serious one. A setup failure is a design that is being clocked too fast, ' +
      'and there is always a frequency it works at. A hold failure is a design that does not work at any frequency, ' +
      'and the only fixes are more delay on the short path or less skew. The readings above are that argument as ' +
      'two numbers, one of which moves and one of which does not.',
    whyReads: [
      ['setupslack', 230],
      ['holdslack', 200],
    ],
    whyAlso: [{ set: { period: 5000 }, reads: [['setupslack', 4230], ['holdslack', 200]] }],
  },
}
