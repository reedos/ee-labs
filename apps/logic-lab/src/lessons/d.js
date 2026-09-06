// Group D: delay, glitches and hazards.

export const D_LESSONS = {
  d1: {
    see:
      'Four buffers in a row, each 40 ps. The input rises at 200 ps and the far end at 360 ps, ' +
      'which is 160 ps later. Every stage in between is drawn, and each one is 40 ps after the one before it. ' +
      'The path list gives the same 160 ps as the sum of the four.',
    seeReads: [
      ['edge.a.1', 200],
      ['edge.g1.1', 240],
      ['edge.g4.1', 360],
      ['path.long', 160],
    ],
    try: [
      {
        say: 'Set the chain to 8 gates. The far end arrives 320 ps after the input.',
        set: { n: 8 },
        reads: [
          ['path.long', 320],
          ['edge.g8.1', 520],
        ],
      },
      {
        say: 'Set the buffer delay to 100 ps with 4 gates. The path is 400 ps.',
        set: { tbuf: 100 },
        reads: [
          ['path.long', 400],
          ['edge.g4.1', 600],
        ],
      },
      {
        say: 'Set the chain to 1 gate. One buffer, one delay, 40 ps.',
        set: { n: 1 },
        reads: [
          ['path.long', 40],
          ['edge.g1.1', 240],
        ],
      },
    ],
    why:
      'Delay along a path is the sum of the delays of the gates on it, and nothing else. ' +
      'There is no interaction between stages in this engine, no loading, and no rise time. ' +
      'That is what makes the arithmetic in the rest of this group exact. ' +
      'A real chain is not quite this simple, because a gate driving a long wire is slower than one driving a short one, ' +
      'and the VLSI Lab is where that becomes a number. Here every path is an integer sum, and the path list shows the terms.',
    whyReads: [['path.long', 160]],
  },

  d2: {
    see:
      'Input a reaches the output OR by two routes. One goes straight into an AND and reaches it at 70 ps. ' +
      'The other passes the inverter first and reaches its AND at 100 ps. So when a falls at 200 ps, ' +
      'p falls at 270 ps and q rises at 300 ps, and the two changes reach the OR 30 ps apart.',
    seeReads: [
      ['edge.a.1', 200],
      ['edge.na.1', 230],
      ['edge.p.1', 270],
      ['edge.q.1', 300],
      ['arrive.p', 70],
      ['arrive.q', 100],
    ],
    try: [
      {
        say: 'Set the inverter to 100 ps. The second route now arrives at 240 ps, 100 ps behind the first.',
        set: { tnot: 100 },
        reads: [
          ['edge.q.1', 370],
          ['edge.p.1', 270],
          ['path.long', 240],
        ],
      },
      {
        say: 'Set the inverter to 1 ps. The two routes are then 1 ps apart.',
        set: { tnot: 1 },
        reads: [
          ['edge.q.1', 271],
          ['edge.p.1', 270],
        ],
      },
      {
        say: 'Set c to 0. The lower branch is held at 0, and only p moves.',
        set: { c: 0 },
        reads: [
          ['edges.q', 0],
          ['edge.p.1', 270],
        ],
      },
    ],
    why:
      'Two paths that start at one input and end at one gate are called reconvergent, and the difference between their lengths ' +
      'is what this experiment measures. Here it is the inverter, at 30 ps, ' +
      'because the two routes are otherwise the same gates in the same order. ' +
      'For that 30 ps the OR is looking at a pair of inputs that no single row of the truth table ever produces. ' +
      'What it does about that is D3.',
    whyReads: [
      ['edge.p.1', 270],
      ['edge.q.1', 300],
    ],
  },

  d3: {
    see:
      'With b and c both 1, the truth table gives y as 1 for either value of a. ' +
      'The output does not stay at 1. It falls at 340 ps and rises again at 370 ps, a pulse 30 ps wide, ' +
      'and then settles at 1 where the table said it would be. The span is marked on the waveform.',
    seeReads: [
      ['edge.y.1', 340],
      ['edge.y.2', 370],
      ['pulse.y.width', 30],
      ['final.y', 1],
      ['table.7.y', 1],
      ['table.3.y', 1],
    ],
    try: [
      {
        say: 'Set the inverter to 100 ps. The pulse is now 100 ps wide, and the output still settles at 1.',
        set: { tnot: 100 },
        reads: [
          ['pulse.y.width', 100],
          ['final.y', 1],
        ],
      },
      {
        say: 'Set the inverter to 1 ps. The pulse is 1 ps wide, and it is still there.',
        set: { tnot: 1 },
        reads: [
          ['pulse.y.width', 1],
          ['edges.y', 2],
        ],
      },
      {
        say: 'Set c to 0. The output is meant to fall now, so it falls once at 340 ps and there is no pulse.',
        set: { c: 0 },
        reads: [
          ['edges.y', 1],
          ['edge.y.1', 340],
          ['final.y', 0],
        ],
      },
    ],
    why:
      'This is a static hazard. The truth table says the output holds at 1 across this input change, and the circuit ' +
      'takes it to 0 and back on the way. The width of the pulse is the difference between the two paths, ' +
      'which D2 measured as the inverter delay. Change the inverter and the pulse changes with it. ' +
      'The settled value is never wrong, which is why the truth table and the simulation always agree in the end. ' +
      'What is wrong is anything that read the output during those 30 ps.',
    whyReads: [
      ['pulse.y.width', 30],
      ['final.y', 1],
    ],
  },

  d4: {
    see:
      'The same circuit with one term added: b AND c, which is 1 throughout this input change. ' +
      'The OR now has three inputs and one of them holds it up, so the output does not move at all. ' +
      'The wider OR is the price. The longest path is 180 ps here, where without the term it is 170 ps.',
    seeReads: [
      ['edges.y', 0],
      ['final.y', 1],
      ['path.long', 180],
      ['gates', 5],
    ],
    seeAlso: [{ set: { cover: 0 }, reads: [['path.long', 170]] }],
    try: [
      {
        say: 'Turn the consensus term off. The pulse comes back, 30 ps wide, starting at 340 ps.',
        set: { cover: 0 },
        reads: [
          ['pulse.y.width', 30],
          ['pulse.y.from', 340],
          ['edges.y', 2],
        ],
      },
      {
        say: 'Turn it off and read the path. Four gates now, and 170 ps.',
        set: { cover: 0 },
        reads: [
          ['gates', 4],
          ['path.long', 170],
        ],
      },
      {
        say: 'Set c to 0 with the term on. The output falls once, because this change is a real one.',
        set: { c: 0 },
        reads: [
          ['edges.y', 1],
          ['final.y', 0],
        ],
      },
    ],
    why:
      "The added term is the consensus of the two that were there, and on the Karnaugh map it is the loop that bridges " +
      'the two existing loops. Group B called it a prime implicant the minimum cover did not need, ' +
      'and here is what it is for. While a is changing, neither original term is holding the output up, ' +
      'and the bridge term is. Covering the hazard costs a gate and takes the path from 170 ps to 180 ps, ' +
      'so a synchronous design usually does not pay it. Why that design can afford not to is the rest of this group.',
    whyReads: [
      ['path.long', 180],
      ['gates', 5],
    ],
    whyAlso: [{ set: { cover: 0 }, reads: [['path.long', 170]] }],
  },

  d5: {
    see:
      'The same glitch, under the two delay models. Transport delay is what is drawn. The pulse passes through the OR ' +
      'and appears at the output for 30 ps. Switch the model to inertial and the OR rejects it, ' +
      'because the pulse is narrower than the gate itself. The output then never moves, and the run says what it swallowed.',
    seeReads: [
      ['pulse.y.width', 30],
      ['edges.y', 2],
      ['swallowed', 0],
    ],
    seeAlso: [
      {
        set: { mode: 'inertial' },
        reads: [
          ['edges.y', 0],
          ['swallowed', 1],
          ['swallow.1.width', 30],
        ],
      },
    ],
    try: [
      {
        say: 'Switch the model to inertial. The output does not move, and one pulse of 30 ps is reported swallowed.',
        set: { mode: 'inertial' },
        reads: [
          ['edges.y', 0],
          ['swallowed', 1],
          ['swallow.1.width', 30],
        ],
      },
      {
        say: 'Set the inverter to 100 ps and keep the inertial model. The pulse is now wider than the gate, so it passes.',
        set: { mode: 'inertial', tnot: 100 },
        reads: [
          ['pulse.y.width', 100],
          ['edges.y', 2],
        ],
      },
      {
        say: 'Back to transport at 100 ps. The same 100 ps pulse, and nothing swallowed.',
        set: { tnot: 100 },
        reads: [
          ['pulse.y.width', 100],
          ['swallowed', 0],
        ],
      },
    ],
    why:
      'A gate under transport delay passes a pulse of any width. A gate under inertial delay rejects one shorter than ' +
      'its own delay, because a real output needs time to move and a brief disturbance never gets there. ' +
      'Here the pulse is 30 ps and the OR is wider than that, so the inertial model drops it. ' +
      'Both models are exact statements of what they describe, and neither approximates the other. ' +
      'The pane says which one produced the picture, and the run reports every pulse the inertial model rejected with its width. ' +
      'A design that relies on inertial rejection has relied on a gate being slow, which is not a margin anyone can hold.',
    whyReads: [['pulse.y.width', 30]],
  },

  d6: {
    see:
      'The four-bit adder computing 7 plus 0, and then 7 plus 1 from 1000 ps. ' +
      'Every sum bit moves in turn as the carry travels up. ' +
      's0 moves at 1180 ps, s1 at 1230 ps, s2 at 1370 ps and s3 at 1510 ps. ' +
      'In between, the sum row reads a number that is neither 7 nor 8.',
    seeReads: [
      ['edge.b0.1', 1000],
      ['edge.s0.1', 1180],
      ['edge.s1.1', 1230],
      ['edge.s2.1', 1370],
      ['edge.s3.1', 1510],
    ],
    try: [
      {
        say: 'Read the sum bits partway through, at 1300 ps. s0 and s1 have moved and s2 has not.',
        reads: [
          ['at.s0.1300', 0],
          ['at.s1.1300', 0],
          ['at.s2.1300', 1],
          ['edge.s1.1', 1230],
          ['edge.s2.1', 1370],
        ],
      },
      {
        say: 'Read them again after everything settles, at 1600 ps. The answer is 8, as 0, 0, 0, 1.',
        reads: [
          ['at.s0.1600', 0],
          ['at.s1.1600', 0],
          ['at.s2.1600', 0],
          ['at.s3.1600', 1],
          ['edge.s3.1', 1510],
        ],
      },
      {
        say: 'Set the operand to 3 and read after it settles. The answer is 4, and s3 never moves.',
        set: { a: 3 },
        reads: [
          ['at.s2.1600', 1],
          ['edges.s3', 0],
        ],
      },
    ],
    why:
      'Nothing here is a hazard. Every sum bit changes to the value the truth table asks for, once, ' +
      'and the reason the row reads nonsense in between is that the bits do not arrive together. ' +
      'The last of them is s3 at 1510 ps, where the input moved at 1000 ps, ' +
      'and the path list gives 600 ps as the longest a sum bit can take at this width. ' +
      'A synchronous design tolerates all of this by not looking. The clock is set slower than the longest path, ' +
      'and every register reads once a period, after everything has settled. That is Group G, and it is why ' +
      'Group D is a group about timing rather than a group about defects.',
    whyReads: [
      ['edge.s3.1', 1510],
      ['arrive.s3', 600],
    ],
  },
}
