// Group E: the latch and the flip-flop.

export const E_LESSONS = {
  e1: {
    see:
      'Two NOR gates, each reading the other. The engine declines to table the netlist and names the ring it found, ' +
      'q and qn feeding each other. That refusal is where memory starts. A circuit whose output is a function of its ' +
      'input has a truth table. This one holds whichever of its two states it was left in, so it has none.',
    seeReads: [
      ['refusal', 'combinational-loop'],
      ['gates', 2],
      ['final.q', 0],
      ['final.qn', 1],
    ],
    try: [
      {
        say: 'Start it in the other state. Both inputs are still 0 and q now holds 1, which the first setting held 0.',
        set: { q: 1 },
        reads: [['final.q', 1]],
      },
      {
        say: 'Raise s. q goes to 1 whichever state it started in, and E2 watches it get there.',
        set: { s: 1 },
        reads: [
          ['final.q', 1],
          ['final.qn', 0],
        ],
      },
      {
        say: 'Raise r from the set state instead. q goes back to 0.',
        set: { r: 1, q: 1 },
        reads: [['final.q', 0]],
      },
    ],
    why:
      'A truth table is what the output is for each input, and it exists only when the output is a function of the ' +
      'input. The engine tests that by ordering the gates so each one comes after the gates it reads. A ring has no ' +
      'such order. The check finds q and qn feeding each other and declines, with the ring named. ' +
      'What the pair does instead is depend on what it was doing before. That is what remembering is, and two gates ' +
      'are enough for it. Both of the states this pair can sit in are stable. Nothing in the netlist prefers one, ' +
      'so the state it is in is a fact about its past rather than about its inputs.',
    whyReads: [['gates', 2]],
  },

  e2: {
    see:
      'A pulse on s at 300 ps. qn falls one NOR later at 350 ps, and q rises one NOR after that at 400 ps. ' +
      'The pulse ends at 600 ps and neither output moves again. The latch was set by the pulse and it stays set ' +
      'with nothing at all holding it there.',
    seeReads: [
      ['edge.s.1', 300],
      ['edge.qn.1', 350],
      ['edge.q.1', 400],
      ['edge.s.2', 600],
      ['final.q', 1],
      ['final.qn', 0],
    ],
    try: [
      {
        say: 'Move the pulse to 500 ps. Everything moves with it, qn at 550 ps and q at 600 ps.',
        set: { at: 500 },
        reads: [
          ['edge.qn.1', 550],
          ['edge.q.1', 600],
        ],
      },
      {
        say: 'Slow both NOR gates to 100 ps. The two edges land at 400 ps and 500 ps, still one gate apart.',
        set: { tnor: 100 },
        reads: [
          ['edge.qn.1', 400],
          ['edge.q.1', 500],
        ],
      },
      {
        say: 'Start it already set and pulse s again. Nothing moves at all.',
        set: { q: 1 },
        reads: [
          ['edges.q', 0],
          ['edges.qn', 0],
          ['final.q', 1],
        ],
      },
    ],
    why:
      'The latch is E1 with a way in. A NOR forces its output to 0 when either input is 1, so s at 1 drives qn to 0. ' +
      'The cross-coupling then sees both of the other gate’s inputs at 0 and lets q rise. When s falls the pair is ' +
      'back to the ring of E1, and a ring holds what it was left holding. ' +
      'The two edges are one NOR delay apart because they are one gate apart, and the second cannot start until the ' +
      'first has arrived. Raising both inputs at once is the case the latch has no answer for. Both outputs go to 0 ' +
      'and they are no longer complements of each other, which is why a latch is drawn with that combination ruled out.',
    whyReads: [['edge.q.1', 400]],
    whyAlso: [
      {
        set: { r: 1 },
        reads: [
          ['at.q.450', 0],
          ['at.qn.450', 0],
        ],
      },
    ],
  },

  e3: {
    see:
      'The gate signal is high for the first 500 ps. d rises at 200 ps and q follows at 300 ps, two NAND delays later. ' +
      'The gate then falls. d falls at 800 ps and q does not move, because the latch is closed. ' +
      'The gate rises again at 1000 ps and q catches up at 1150 ps.',
    seeReads: [
      ['edge.d.1', 200],
      ['edge.q.1', 300],
      ['edge.g.2', 500],
      ['edge.d.2', 800],
      ['at.q.900', 1],
      ['edge.g.3', 1000],
      ['edge.q.2', 1150],
      ['gates', 5],
    ],
    try: [
      {
        say: 'Slow the NAND gates to 100 ps. q now follows 200 ps after d, at 400 ps, and the catch-up moves to 1300 ps.',
        set: { tnand: 100 },
        reads: [
          ['edge.q.1', 400],
          ['edge.q.2', 1300],
        ],
      },
      {
        say: 'Set the D step to 100 ps. Now d moves several times while the gate is open, and q follows every one of them.',
        set: { dstep: 100 },
        reads: [
          ['edge.q.1', 200],
          ['edges.q', 12],
        ],
      },
      {
        say: 'Widen the gate period to 2000 ps. Both of d’s changes now fall inside one open half, and q takes both.',
        set: { period: 2000 },
        reads: [
          ['edge.q.1', 300],
          ['edge.q.2', 980],
          ['edges.q', 2],
        ],
      },
    ],
    why:
      'The D latch is the set-reset pair with its two inputs made from one. An inverter gives d and its complement, ' +
      'and two NAND gates pass that pair through only while the gate signal is high. ' +
      'So while the gate is high the latch is a wire with a delay in it, and while the gate is low it is E1’s ring. ' +
      'That is the whole of the word transparent. ' +
      'It is also the problem the flip-flop solves. A latch that is open for half a clock period lets a change ride ' +
      'through the whole of that half, so a signal can travel through several stages in one clock. E4 closes the ' +
      'second half of the circuit before the first one opens, and nothing gets through in one step.',
    whyReads: [['gates', 5]],
  },

  e4: {
    see:
      'Eleven gates, as two latches on opposite clock phases. d changes nine times here and q changes twice. ' +
      'The clock rises at 2000 ps and q rises at 2100 ps. The master follows d while the clock is low. ' +
      'It holds while the clock is high, so only what d held at the edge gets through.',
    seeReads: [
      ['gates', 11],
      ['edges.d', 9],
      ['edges.q', 2],
      ['edge.clk.3', 2000],
      ['edge.q.1', 2100],
      ['gap.q.1.clk.3', 100],
    ],
    try: [
      {
        say: 'Set the D step to 250 ps. d now changes 18 times and q still moves only on a clock edge.',
        set: { dstep: 250 },
        reads: [
          ['edges.d', 18],
          ['edges.q', 8],
        ],
      },
      {
        say: 'Halve the clock period to 1000 ps. The first output edge moves to 1100 ps, still 100 ps after its own edge.',
        set: { period: 1000 },
        reads: [
          ['edge.q.1', 1100],
          ['edges.q', 1],
          ['gap.q.1.clk.3', 100],
        ],
      },
      {
        say: 'Set the D step to 250 ps. Now d moves close to the edge, the master is still settling when the clock closes it, and the output chatters.',
        set: { dstep: 250 },
        reads: [
          ['edges.d', 18],
          ['edges.q', 8],
        ],
      },
      {
        say: 'Read the second output edge at 4150 ps. A falling output takes 150 ps, one NAND more than a rising one.',
        reads: [
          ['edge.q.2', 4150],
          ['edge.clk.5', 4000],
          ['gap.q.2.clk.5', 150],
        ],
      },
    ],
    why:
      'The master is transparent while the clock is low and the slave while it is high, so the two are never open ' +
      'together. Whatever d held when the clock rose is the one value the slave takes. Everything else d did is ' +
      'thrown away, which is the point. ' +
      'The two directions cost different amounts here. Setting the slave needs the clock through two NAND gates, ' +
      'and clearing it needs three, because the clearing side reaches q through qn. So a rising output is 100 ps ' +
      'after the edge and a falling one is 150 ps. A datasheet quotes the larger of the two as the clock-to-Q time. ' +
      'The third setting shows the other thing this construction has that a primitive does not. Move d close enough ' +
      'to the edge and the clock closes the master mid-change, and the output chatters. E5 gives that interval as ' +
      'one number of the cell.',
    whyReads: [
      ['edge.q.1', 2100],
      ['edge.q.2', 4150],
      ['gap.q.1.clk.3', 100],
      ['gap.q.2.clk.5', 150],
    ],
  },

  e5: {
    see:
      'One flip-flop, its clock edge at 500 ps, and a D step swept past that edge. At 400 ps the step is early enough ' +
      'and the run reports nothing. Sweeping the step across the edge, every setting from 461 ps to 519 ps is ' +
      'reported as a violation. That is 59 settings, one short of the 60 ps that the setup and hold times add to.',
    seeReads: [
      ['violations', 0],
      ['edge.clk.1', 500],
      ['edge.d.1', 400],
      ['window.first', 461],
      ['window.last', 519],
      ['window.width', 59],
      ['flop.window', 60],
    ],
    try: [
      {
        say: 'Step D at 461 ps, the first setting inside the window. The report is a setup violation with 1 ps of slack missing.',
        set: { at: 461 },
        reads: [
          ['violations', 1],
          ['violation.1.kind', 'setup'],
          ['violation.1.slack', -1],
        ],
      },
      {
        say: 'Step D at 519 ps, the last one inside it. Now it is a hold violation, again by 1 ps.',
        set: { at: 519 },
        reads: [
          ['violations', 1],
          ['violation.1.kind', 'hold'],
          ['violation.1.slack', -1],
        ],
      },
      {
        say: 'Double the setup time to 80 ps. The window opens 40 ps earlier, at 421 ps, and is 99 settings wide.',
        set: { tsu: 80 },
        reads: [
          ['window.first', 421],
          ['window.last', 519],
          ['window.width', 99],
        ],
      },
      {
        say: 'Put the setup time back and treble the hold time to 60 ps. The window now closes at 559 ps.',
        set: { th: 60 },
        reads: [
          ['window.first', 461],
          ['window.last', 559],
          ['window.width', 99],
        ],
      },
    ],
    why:
      'The two times are one requirement written from both sides. D has to be still for the setup time before the ' +
      'edge. It has to stay still for the hold time after it. So the interval it may not move in runs from one to ' +
      'the other. This engine measures both at the flip-flop’s terminals, off the event list. ' +
      'The window is one setting narrower than the two times added up. The instant of the edge belongs to both of ' +
      'them, and it is counted once. Widening either time widens the window on that side alone, which is what the ' +
      'last two settings show. A cell with tighter times is harder to feed. The VLSI Lab is where those two numbers ' +
      'come from a circuit rather than from a table.',
    whyReads: [
      ['window.width', 59],
      ['flop.window', 60],
    ],
    whyAlso: [
      { set: { tsu: 80 }, reads: [['window.width', 99]] },
      { set: { th: 60 }, reads: [['window.width', 99]] },
    ],
  },

  e6: {
    see:
      'One run inside the window. D steps at 480 ps and the edge is at 500 ps, so D had been still for 20 ps where ' +
      '40 ps was required. The report gives the kind, the flip-flop, and the 20 ps of slack that is missing. ' +
      'Q still moves at 580 ps, and that value is the model’s assumption rather than a measurement.',
    seeReads: [
      ['violations', 1],
      ['violation.1.kind', 'setup'],
      ['violation.1.actual', 20],
      ['violation.1.required', 40],
      ['violation.1.slack', -20],
      ['violation.1.t', 500],
      ['edge.q.1', 580],
    ],
    try: [
      {
        say: 'Step D at 400 ps, clear of the window. The run reports nothing and Q moves at the same 580 ps.',
        set: { at: 400 },
        reads: [
          ['violations', 0],
          ['edge.q.1', 580],
        ],
      },
      {
        say: 'Step D at 530 ps, past the far side of the window. Again nothing is reported.',
        set: { at: 530 },
        reads: [['violations', 0]],
      },
      {
        say: 'Ask for a setup time of 100 ps at the same step. The same run is now short by 80 ps.',
        set: { tsu: 100 },
        reads: [
          ['violations', 1],
          ['violation.1.slack', -80],
        ],
      },
    ],
    why:
      'The run takes the value D held in the instant before the edge and carries on. That is a choice this model ' +
      'makes, and the violation is how it says so. What a real flip-flop does here is not a value at all. ' +
      'It can sit between the two levels for a while, and how long it sits there is a random variable rather than a ' +
      'number this engine can state. ' +
      'So the honest output is the violation record. It carries the measured 20 ps, the required 40 ps, and the ' +
      '20 ps of slack that is missing, and it names the flip-flop and the instant. Group H is where the rest of the ' +
      'sentence goes, as a rate and a mean time between failures rather than as a waveform.',
    whyReads: [
      ['violation.1.actual', 20],
      ['violation.1.required', 40],
      ['violation.1.slack', -20],
    ],
  },
}
