// Group F: registers, counters and the machine built from a specification.

export const F_LESSONS = {
  f1: {
    see:
      'Four flip-flops on one clock, each fed from the one before. The clock rises at 500 ps and every stage that ' +
      'moves moves 80 ps later. Nothing between them can race. With no logic at all in between, the period this ' +
      'design closes at is 120 ps, which is one clock-to-Q and one setup time and nothing else.',
    seeReads: [
      ['flops', 4],
      ['edge.clk.1', 500],
      ['gap.q0.1.clk.1', 80],
      ['flop.tcq', 80],
      ['flop.tsu', 40],
      ['tmin', 120],
    ],
    try: [
      {
        say: 'Widen it to 8 flip-flops. The far end now takes eight clocks to reach, at 7580 ps, and the closing period does not move.',
        set: { n: 8 },
        reads: [
          ['flops', 8],
          ['edge.q7.1', 7580],
          ['tmin', 120],
        ],
      },
      {
        say: 'Clock it at 200 ps, the shortest this knob offers. There is still 80 ps of slack and nothing is reported.',
        set: { period: 200 },
        reads: [
          ['setupslack', 80],
          ['violations', 0],
        ],
      },
      {
        say: 'Read the hold margin instead. It is 60 ps, the clock-to-Q less the hold time, and no clock period changes it.',
        reads: [
          ['holdslack', 60],
          ['flop.tcq', 80],
          ['flop.th', 20],
        ],
      },
    ],
    why:
      'A stage samples what its neighbour was holding before the edge, not what it takes after it. So all four move ' +
      'at once and none of them sees another one move. That is the whole reason a synchronous design is easier to ' +
      'reason about than a chain of latches. ' +
      'The period is the floor. There is no logic between the stages, so the only two times in it are the launching ' +
      'flip-flop’s clock-to-Q and the capturing flip-flop’s setup time, and 120 ps is their sum. Every other design ' +
      'in this lab is that number plus its own logic. The hold margin is the other side of the same pair. The clock ' +
      'period does not appear in it at all, so slowing a clock down never buys hold margin.',
    whyReads: [
      ['tmin', 120],
      ['flop.tcq', 80],
      ['flop.tsu', 40],
    ],
  },

  f2: {
    see:
      'Four flip-flops and 6 gates. The clock rises at 0 ps, and the count reads 1 by 799 ps, then 2, then 3. ' +
      'Bit 0 changes every clock. Every other bit changes only on the clocks where all the bits below it are 1. ' +
      'After sixteen counts the value wraps to 0 and the walk starts again.',
    seeReads: [
      ['flops', 4],
      ['gates', 6],
      ['edge.clk.1', 0],
      ['word.q.4.799', 1],
      ['word.q.4.1599', 2],
      ['word.q.4.2399', 3],
      ['word.q.4.12799', 0],
    ],
    try: [
      {
        say: 'Set it to 2 bits. Now 2 gates are enough, it counts to 3, and it wraps four times as often.',
        set: { n: 2 },
        reads: [
          ['gates', 2],
          ['word.q.2.2399', 3],
          ['word.q.2.3199', 0],
        ],
      },
      {
        say: 'Slow the clock to 2000 ps. Every count lasts longer and the sequence is the same.',
        set: { period: 2000 },
        reads: [
          ['word.q.4.1999', 1],
          ['word.q.4.3999', 2],
          ['word.q.4.9999', 5],
        ],
      },
      {
        say: 'Read the count at 12799 ps and again at 13599 ps. It is 0 and then 1, which is the wrap.',
        reads: [
          ['word.q.4.12799', 0],
          ['word.q.4.13599', 1],
        ],
      },
    ],
    why:
      'Adding one to a binary number flips the bottom bit always, and flips a higher bit exactly when every bit ' +
      'below it was 1. That condition is a chain of ANDs, one per bit, and each bit’s flip is an exclusive-or ' +
      'against it. So a counter is an adder that only ever adds one, with the operand folded into the gates. ' +
      'Every flip-flop takes its new value at the same instant, so the value each one reads is the old count and ' +
      'never a half-updated one. A ripple counter, where each stage clocks the next, does not have that property, ' +
      'and its bits arrive one gate delay apart. This lab builds the synchronous one, and F3 is what it costs.',
    whyReads: [['gates', 6]],
  },

  f3: {
    see:
      'The longest path runs from q0 through two 70 ps ANDs of the enable chain and one exclusive-or, 310 ps of ' +
      'logic. With the clock-to-Q and the setup time around it, the period is 350 ps. At 2 bits there is no enable ' +
      'chain and the period is 210 ps. At 8 bits the chain is six ANDs and the period is 630 ps.',
    seeReads: [
      ['path.long', 310],
      ['tmin', 350],
      ['flop.tcq', 80],
      ['flop.tsu', 40],
    ],
    seeAlso: [
      { set: { n: 2 }, reads: [['flops', 2], ['tmin', 210]] },
      { set: { n: 8 }, reads: [['flops', 8], ['tmin', 630]] },
    ],
    try: [
      {
        say: 'Add one bit, to 5. The period grows by exactly one AND, to 420 ps.',
        set: { n: 5 },
        reads: [['tmin', 420]],
      },
      {
        say: 'Halve the AND to 35 ps at 8 bits. The chain is six of them, so the period falls to 420 ps.',
        set: { n: 8, tand: 35 },
        reads: [
          ['tmin', 420],
          ['flops', 8],
        ],
      },
      {
        say: 'Go back to 4 bits and read the path list. It names q0, the two ANDs, and d3.',
        reads: [
          ['path.long', 310],
          ['tmin', 350],
        ],
      },
    ],
    why:
      'The enable of bit i is the enable of bit i minus one, ANDed with one more bit of the count. That is a chain, ' +
      'and a chain of ANDs costs one AND per bit. So a counter’s period grows linearly in its width, exactly as the ' +
      'ripple adder’s carry did in C6, and for the same reason. ' +
      'The two are not the same slope. The adder pays an AND and an OR per bit, and the counter pays one AND, ' +
      'because it is adding a constant and half the logic falls away. The way out of both is the same idea, which ' +
      'is to compute the condition for several bits at once instead of passing it along. That is carry lookahead, ' +
      'and it is the Computer Lab’s datapath rather than this lab’s.',
    whyReads: [['tmin', 350]],
  },

  f4: {
    see:
      'The specification is three states, one input, and a rule for what the next state is. Enumerated, it is a ' +
      'table of 6 rows, two per state, one for each value of the input. The engine tests whether the output depends ' +
      'on the input as well as the state. Here it does, so the table is Mealy.',
    seeReads: [
      ['states', 3],
      ['srows', 6],
      ['machine', 'Mealy'],
    ],
    try: [
      {
        say: 'Set the input word to 0. The machine never leaves its first state and the output never rises.',
        set: { word: 0 },
        reads: [['edges.y', 0]],
      },
      {
        say: 'Set the word to 255, so the input is always 1. The machine sits in the state that has just seen a 1, and the output still never rises.',
        set: { word: 255 },
        reads: [['edges.y', 0]],
      },
      {
        say: 'Put the word back to 90 and read the diagram. 6 rows, and every state has an arc leaving it for each value of the input.',
        reads: [
          ['srows', 6],
          ['states', 3],
        ],
      },
    ],
    why:
      'A state is a situation the machine has to behave differently from. This machine needs three of them, because ' +
      'it has either seen nothing useful, or just seen a 1, or seen a 1 followed by a 0. ' +
      'Writing that down as a rule for the next state is the whole design, and everything after it is mechanical. ' +
      'The table is Mealy because the output is asserted on the clock where the third bit of the pattern arrives, ' +
      'and that bit is an input rather than a state. A Moore version needs a fourth state to stand for the match, ' +
      'and its output then comes one clock later. Neither is more correct. Each gives its answer at its own instant.',
    whyReads: [
      ['states', 3],
      ['machine', 'Mealy'],
    ],
  },

  f5: {
    see:
      'Three states need 2 bits, and two bits hold four codes, so one is left over. The table uses 00, 01 and 10, ' +
      'and 11 is never reached. That leaves 1 unused code. The minimiser is free to make the logic say anything at ' +
      'all for that row, and F6 spends the freedom.',
    seeReads: [
      ['states', 3],
      ['sbits', 2],
      ['unused', 1],
    ],
    try: [
      {
        say: 'Read the encoding under each state in the diagram. They are 00, 01 and 10, in the order the specification lists them.',
        reads: [
          ['sbits', 2],
          ['states', 3],
        ],
      },
      {
        say: 'Watch the two state bits in the timing view. They never both read 1 at a clock edge, which is the unused code.',
        reads: [['unused', 1]],
      },
      {
        say: 'Set the input word to 255 and watch again. The machine stays in one state and one bit never moves.',
        set: { word: 255 },
        reads: [['edges.q1', 0]],
      },
    ],
    why:
      'The state register holds a number, and the number is what the flip-flops are for. Three states do not fit in ' +
      'one bit, so two bits it is, and two bits count to four. The pattern nothing reaches is not a wasted gate. ' +
      'It is a row of every next-state map that the minimiser may fill in either way. ' +
      'That is what a don’t-care is, and it is the same freedom the Karnaugh maps of group B had when a function ' +
      'was only partly specified. It makes the cover smaller and never larger, because the minimiser is choosing ' +
      'the value that helps. A machine whose state count is a power of two has no unused codes and no such freedom.',
    whyReads: [
      ['sbits', 2],
      ['unused', 1],
    ],
  },

  f6: {
    see:
      'Three equations, each minimised with the unused code left free. ' +
      "The next state's high bit is q0x', which is 2 literals. Its low bit is x, 1 literal. " +
      'The output is q1x, 2 literals. That is 6 gates in all, and the diagram below is what they build.',
    seeReads: [
      ['expr.d1', "q0x'"],
      ['expr.d0', 'x'],
      ['expr.y', 'q1x'],
      ['eqliterals.d1', 2],
      ['eqliterals.d0', 1],
      ['eqliterals.y', 2],
      ['gates', 6],
    ],
    try: [
      {
        say: 'Read the low bit of the next state. It is the input, with no gate at all between them.',
        reads: [
          ['expr.d0', 'x'],
          ['eqliterals.d0', 1],
        ],
      },
      {
        say: 'Read the output equation. It is 1 cube of 2 literals, which is the one AND in the picture.',
        reads: [
          ['eqcubes.y', 1],
          ['eqliterals.y', 2],
        ],
      },
      {
        say: 'Count the gates. 6 of them carry three equations, because two of the three share their inverter.',
        reads: [['gates', 6]],
      },
    ],
    why:
      'Each next-state bit and each output is an ordinary Boolean function of the state bits and the inputs. So the ' +
      'whole of group B applies here with nothing added. Prime implicants, a minimum cover, and a two-level netlist ' +
      'built from the cover. ' +
      'The one new thing is the unused code. Its row is not in the table at all, so it goes in as a don’t-care ' +
      'rather than as a 0. The minimiser then fills it in whichever way makes the cover smaller. ' +
      'Every one of these three functions comes out as a single cube, which is why the machine is 6 gates and not ' +
      'twenty. Nothing about that is luck. It is what choosing the encoding and then minimising is for.',
    whyReads: [['gates', 6]],
  },

  f7: {
    see:
      '6 gates and two flip-flops, clocked at 1000 ps. The word 01011010 goes in one bit per clock. The output is ' +
      'high on the fourth bit and again on the seventh, which are the two places where 1, 0, 1 has just finished. ' +
      'The period this machine closes at is 230 ps, so 1000 ps is four times more than it needs.',
    seeReads: [
      ['gates', 6],
      ['flops', 2],
      ['tmin', 230],
      ['at.y.999', 0],
      ['at.y.1999', 0],
      ['at.y.2999', 0],
      ['at.y.3999', 1],
      ['at.y.4999', 0],
      ['at.y.5999', 0],
      ['at.y.6999', 1],
      ['at.y.7999', 0],
    ],
    try: [
      {
        say: 'Set the word to 181, which is 10110101. The output now rises three times instead of twice.',
        set: { word: 181 },
        reads: [
          ['at.y.2999', 1],
          ['at.y.5999', 1],
          ['at.y.7999', 1],
          ['at.y.3999', 0],
        ],
      },
      {
        say: 'Set the word to 0. Nothing ever completes and the output stays low the whole run.',
        set: { word: 0 },
        reads: [['edges.y', 0]],
      },
      {
        say: 'Halve the clock period to 500 ps. The same word gives the same answer, and the closing period is still 230 ps.',
        set: { period: 500 },
        reads: [
          ['tmin', 230],
          ['at.y.1999', 1],
          ['at.y.3499', 1],
          ['violations', 0],
        ],
      },
    ],
    why:
      'Nothing between the specification and this netlist was written by hand. The engine enumerated the table, ' +
      'gave each state a code, minimised each next-state bit and the output with the unused code free, and built ' +
      'the two-level logic that came out. ' +
      'Each of those steps can be wrong in a way the next one hides, so the test does not check any of them. It runs ' +
      'the built netlist against the specification it came from and requires the machine to detect the sequence. ' +
      'No intermediate step passes that by accident. ' +
      'The closing period is 230 ps because the longest path is q0 through one AND and one buffer to the high state ' +
      'bit. The machine is tiny, so a design like this is limited by whatever else shares its clock rather than by ' +
      'itself.',
    whyReads: [
      ['tmin', 230],
      ['at.y.3999', 1],
      ['at.y.6999', 1],
    ],
  },
}
