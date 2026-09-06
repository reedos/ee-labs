// Group E: pipelining.

export const E_LESSONS = {
  e1: {
    see:
      'The same blocks, with four sets of registers between them, hold 5 instructions at once. ' +
      'The period falls from 1739.46 ps to 534.66 ps, so throughput rises by 3.25. ' +
      'One instruction now takes 2673.3 ps end to end, which is 1.54 times as long as before. ' +
      'The program takes 14 cycles here and 8 there, and 0 registers differ.',
    seeReads: [
      ['n.stages', 5],
      ['ps.single', 1739.46],
      ['ps.period', 534.66],
      ['n.throughput', 3.253395],
      ['ps.latency', 2673.3],
      ['n.latencyratio', 1.536856],
      ['cycles.pipe', 14],
      ['cycles.single', 8],
      ['n.agree', 0],
    ],
    try: [
      {
        say: 'Set the cycle to 7. All 5 stages hold an instruction, which is what the pipeline was built for.',
        set: { cycle: 7 },
        reads: [
          ['n.busy', 5],
          ['n.stages', 5],
        ],
      },
      {
        say: 'Set the cycle to 4. Only 4 stages are busy, because the pipeline is still filling.',
        set: { cycle: 4 },
        reads: [['n.busy', 4]],
      },
      {
        say: 'Read the two machines’ registers. 0 of them differ, on this program and on every program the fuzzer generates.',
        reads: [['n.agree', 0]],
      },
    ],
    why:
      'Nothing in the datapath got faster. ' +
      'The registers between the stages let five instructions use five different blocks in the same cycle. ' +
      'The machine then finishes one instruction a cycle, at a cycle that only fits the slowest stage. ' +
      'Latency goes the other way. ' +
      'An instruction now waits through five periods rather than one long one, 2673.3 ps against 1739.46 ps. ' +
      'The trade is throughput bought with latency, and it only pays because the instructions are independent enough to overlap. ' +
      'Where they are not, the next four experiments count what it costs.',
    whyReads: [
      ['ps.latency', 2673.3],
      ['ps.single', 1739.46],
      ['n.stages', 5],
    ],
  },

  e2: {
    see:
      'Every stage pays the same 82.86 ps for its registers, which is 15.50 % of the period. ' +
      'The five stages need 451.8, 301.2, 376.5, 451.8 and 225.9 ps of logic. ' +
      'The slowest of them sets the clock at 534.66 ps, and the fastest then wastes 225.9 ps in every cycle. ' +
      'Split the same logic evenly and the period would be 444.3 ps.',
    seeReads: [
      ['ps.overhead', 82.86],
      ['share.overhead', 0.154977],
      ['ps.fetch', 451.8],
      ['ps.decode', 301.2],
      ['ps.execute', 376.5],
      ['ps.memory', 451.8],
      ['ps.writeback', 225.9],
      ['ps.period', 534.66],
      ['ps.slack', 225.9],
      ['ps.even', 444.3],
    ],
    try: [
      {
        say: 'Set the memory access to 6 gate delays. The execute stage is now the slowest, and the period is 459.36 ps.',
        set: { access: 6 },
        reads: [
          ['text.slowest', 'execute'],
          ['ps.period', 459.36],
        ],
      },
      {
        say: 'Read the overhead at that setting. The same 82.86 ps is now 18.04 % of the period.',
        set: { access: 6 },
        reads: [
          ['ps.overhead', 82.86],
          ['share.overhead', 0.1803814],
        ],
      },
      {
        say: 'Read the even split at that setting. It would give 353.94 ps, which no stage boundary reaches.',
        set: { access: 6 },
        reads: [['ps.even', 353.94]],
      },
    ],
    why:
      'A pipeline register costs a clock-to-Q on the way out and a setup time on the way in, ' +
      'and those two are 82.86 ps whatever the stage does with the rest of its cycle. ' +
      'Cutting the machine into more stages divides the logic and repeats that overhead, ' +
      'so it stops paying once a stage’s logic is comparable with it. ' +
      'Imbalance costs more than the overhead does here. ' +
      'The write-back stage needs 225.9 ps of logic and is given 534.66 ps, and no other instruction can use the difference. ' +
      'Moving work across a stage boundary is the only fix, and the even split shows the best that could buy.',
    whyReads: [
      ['ps.overhead', 82.86],
      ['ps.writeback', 225.9],
      ['ps.period', 534.66],
    ],
  },

  e3: {
    see:
      'Three instructions in a row, each reading what the one before it wrote. ' +
      'With forwarding the three take 7 cycles and the hazard unit inserts no stall. ' +
      '3 operands come from a pipeline register rather than from the register file. ' +
      'Over the stated mix, forwarding takes cycles an instruction from 2.08 down to 1.33, which is 36.06 % of the count.',
    seeReads: [
      ['cycles.here', 7],
      ['n.stalls', 0],
      ['n.forwards', 3],
      ['n.cpimixoff', 2.08],
      ['n.cpimix', 1.33],
      ['share.worth', 0.3605769],
    ],
    try: [
      {
        say: 'Switch forwarding off. The same three instructions now take 11 cycles, and 4 of them are stalls.',
        set: { forwarding: 0 },
        reads: [
          ['cycles.here', 11],
          ['n.stalls', 4],
        ],
      },
      {
        say: 'Read the result with forwarding off. It is 27, the same answer the forwarded run gives.',
        set: { forwarding: 0 },
        reads: [
          ['n.result', 27],
          ['n.resultother', 27],
        ],
      },
      {
        say: 'Read the forwarded operands. There are 3 of them, one for each dependence in the chain.',
        reads: [['n.forwards', 3]],
      },
    ],
    why:
      'The value an instruction needs exists two stages before it reaches the register file. ' +
      'Forwarding is a multiplexer in front of the ALU that takes the operand from the pipeline register that already holds it. ' +
      'Without it the machine has to wait until the write-back has happened, which is 2 cycles for the instruction right behind. ' +
      'Both runs end with the same registers, and that is invariant 2 of the plan. ' +
      'Forwarding changes when a value arrives and never what it is. ' +
      'What it cannot fix is a load, because a load’s value is not in any register until the memory stage has finished.',
    whyReads: [
      ['n.cpimix', 1.33],
      ['n.result', 27],
    ],
    whyAlso: [
      {
        set: { forwarding: 0 },
        reads: [
          ['n.stalls', 4],
          ['n.result', 27],
        ],
      },
    ],
  },

  e4: {
    see:
      'A load followed by the instruction that uses it. Forwarding cannot remove this one, ' +
      'because the value leaves memory one stage after the ALU wanted it. ' +
      'The hazard unit inserts 1 bubble, and the three instructions take 8 cycles. ' +
      'Over the mix, 25.00 % loads with 40.00 % of them used at once adds 0.1 cycles an instruction to the 1.33.',
    seeReads: [
      ['n.loaduse', 1],
      ['cycles.here', 8],
      ['share.loads', 0.25],
      ['share.loaduse', 0.4],
      ['n.term', 0.1],
      ['n.cpimix', 1.33],
    ],
    try: [
      {
        say: 'Switch forwarding off. The three now take 11 cycles, and 4 of them are stalls rather than 1.',
        set: { forwarding: 0 },
        reads: [
          ['cycles.here', 11],
          ['n.stalls', 4],
        ],
      },
      {
        say: 'Read the two counts together. This program costs 2.666667 cycles an instruction, and the mix says 1.33.',
        reads: [
          ['n.cpirun', 2.666667],
          ['n.cpimix', 1.33],
        ],
      },
    ],
    why:
      'This is the one stall a five-stage machine cannot design away. ' +
      'The load reads memory in the fourth stage, and the instruction behind it wants that value in the third. ' +
      'No forwarding path runs backwards in time, so the hazard unit holds the younger instruction for one cycle and the value arrives. ' +
      'The two counts on screen are different numbers with one name. ' +
      '2.666667 cycles an instruction is what this three-instruction program cost, ' +
      'and 1.33 is what the stated mix costs a program made of the mix. ' +
      'A short program with one load in it is nothing like the mix, and the schedule is the arbiter.',
    whyReads: [
      ['n.cpirun', 2.666667],
      ['n.cpimix', 1.33],
      ['n.loaduse', 1],
    ],
  },

  e5: {
    see:
      'A loop of four iterations, so its branch is taken three times. ' +
      'Resolved in the execute stage, each taken branch throws away the work behind it, and the run loses 6 cycles that way. ' +
      'The loop takes 24 cycles. Over the mix, 15.00 % branches at 60.00 % taken and two cycles each is 0.18 cycles an instruction.',
    seeReads: [
      ['n.flushcycles', 6],
      ['cycles.here', 24],
      ['share.branches', 0.15],
      ['share.taken', 0.6],
      ['n.late', 0.18],
    ],
    try: [
      {
        say: 'Move the decision into the decode stage. The penalty over the mix halves to 0.09 cycles an instruction.',
        set: { resolve: 'decode' },
        reads: [
          ['n.penalty', 0.09],
          ['n.early', 0.09],
        ],
      },
      {
        say: 'Read the run at that setting. It takes 29 cycles, more than before, and 8 of them are stalls.',
        set: { resolve: 'decode' },
        reads: [
          ['cycles.here', 29],
          ['n.stalls', 8],
        ],
      },
      {
        say: 'Read the instructions thrown away. There are 3 of them, one for each taken branch.',
        reads: [['n.flushes', 3]],
      },
    ],
    why:
      'A branch is not decided until its operands have been compared, ' +
      'and by then the two instructions behind it have already been fetched. ' +
      'Deciding in decode instead of execute halves the arithmetic penalty, from 0.18 to 0.09 cycles an instruction. ' +
      'This program says otherwise, and both numbers are on screen because both are true. ' +
      'The comparison in decode reads the register file directly, and this loop’s branch depends on the instruction right before it, ' +
      'so every branch now waits for its operand instead of throwing work away. ' +
      'The run goes from 24 cycles to 29. A machine that forwards into the comparator would not pay that, and this one does not have one.',
    whyReads: [
      ['n.late', 0.18],
      ['n.early', 0.09],
      ['cycles.here', 24],
    ],
    whyAlso: [{ set: { resolve: 'decode' }, reads: [['cycles.here', 29]] }],
  },

  e6: {
    see:
      'A loop of four iterations, ten times over, is 40 branches with a pattern in them. ' +
      'Always taken mispredicts 10 of those 40 branches. ' +
      'A one-bit predictor mispredicts 19, because it changes its mind at both ends of the loop. ' +
      'A two-bit saturating counter mispredicts 10, and a three-bit correlating predictor mispredicts 1.',
    seeReads: [
      ['n.branches', 40],
      ['n.always', 10],
      ['n.one', 19],
      ['n.two', 10],
      ['n.correlate', 1],
    ],
    try: [
      {
        say: 'Set the loop to 8 iterations. The correlating predictor now mispredicts 19, and the two-bit counter still mispredicts 10.',
        set: { iterations: 8 },
        reads: [
          ['n.correlate', 19],
          ['n.two', 10],
        ],
      },
      {
        say: 'Set the loop to 2 iterations. The correlating predictor mispredicts 2 of the 20 branches.',
        set: { iterations: 2 },
        reads: [
          ['n.correlate', 2],
          ['n.branches', 20],
        ],
      },
      {
        say: 'Read what a good predictor is worth. At nine tenths correct the mix costs 1.18 cycles an instruction rather than 1.33.',
        reads: [
          ['n.cpipredicted', 1.18],
          ['n.cpitaken', 1.33],
        ],
      },
    ],
    why:
      'Every predictor here is a small memory of what branches did last time. ' +
      'One bit remembers the last outcome, so a loop costs it two mispredictions a pass, one at the exit and one on the way back in. ' +
      'Two bits have to be wrong twice before they change their mind, which removes the second of those. ' +
      'The correlating predictor indexes its bit by the last three outcomes, ' +
      'so a loop of four has a pattern it can learn exactly and a loop of eight does not. ' +
      'That is the whole trade. A predictor is right about the patterns its history is long enough to hold, ' +
      'and it is a hardware cost that buys back the branch penalty E5 measured.',
    whyReads: [
      ['n.one', 19],
      ['n.two', 10],
      ['n.correlate', 1],
    ],
    whyAlso: [{ set: { iterations: 8 }, reads: [['n.correlate', 19]] }],
  },
}
