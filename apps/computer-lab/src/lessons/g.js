// Group G: the machine and the world.

export const G_LESSONS = {
  g1: {
    see:
      'A transfer is an address phase and then a data phase. ' +
      'Fetching a 16-byte line as four separate transfers pays for four addresses and takes 8 cycles, which is 4.27728 ns. ' +
      'One burst sends the address once and the 4 words after it, so it takes 5 cycles and 2.6733 ns. ' +
      'The burst saves 37.50 % of the transfer.',
    seeReads: [
      ['cycles.single', 8],
      ['ns.single', 4.27728],
      ['cycles.burst', 5],
      ['n.words', 4],
      ['ns.burst', 2.6733],
      ['share.saved', 0.375],
    ],
    try: [
      {
        say: 'Set the line to 32 bytes. The separate transfers take 16 cycles and the burst takes 9, a saving of 43.75 %.',
        set: { lineBytes: 32 },
        reads: [
          ['cycles.single', 16],
          ['cycles.burst', 9],
          ['share.saved', 0.4375],
        ],
      },
      {
        say: 'Set the line to 4 bytes. Both take 2 cycles, and the burst saves 0.00 %.',
        set: { lineBytes: 4 },
        reads: [
          ['cycles.single', 2],
          ['cycles.burst', 2],
          ['share.saved', 0],
        ],
      },
      {
        say: 'Read the burst’s address phase. It is 1 cycle whatever the line size is.',
        reads: [['cycles.address', 1]],
      },
    ],
    why:
      'The address phase is what a burst removes, and it is a fixed cost a transfer. ' +
      'One word a transfer pays it every time, so half the bus cycles carry no data at all. ' +
      'A burst pays it once and then sends 4 words, and the saving grows with the line. ' +
      'This is the same argument as F4’s block size, seen from the other end of the wire. ' +
      'A bigger block is cheaper to fetch per word, and F4 is where the cost of fetching words that go unused is counted. ' +
      'The two lessons together are why a block size is chosen rather than maximised.',
    whyReads: [
      ['n.words', 4],
      ['cycles.address', 1],
    ],
    whyAlso: [{ set: { lineBytes: 32 }, reads: [['share.saved', 0.4375]] }],
  },

  g2: {
    see:
      'An interrupt empties the pipeline, saves the registers and fetches a vector. ' +
      'That is 5 cycles of flush, 16 cycles of saves and 2 cycles of vector fetch, so 23 cycles in all. ' +
      'At 534.66 ps a cycle the latency is 12.29718 ns. ' +
      'Ten thousand interrupts a second take 0.0123 % of the machine’s time.',
    seeReads: [
      ['cycles.flush', 5],
      ['cycles.saves', 16],
      ['cycles.vector', 2],
      ['cycles.latency', 23],
      ['ps.period', 534.66],
      ['ns.latency', 12.29718],
      ['share.time', 0.000122972],
    ],
    try: [
      {
        say: 'Set the registers saved to 8. The latency falls to 15 cycles, which is 8.0199 ns.',
        set: { saves: 8 },
        reads: [
          ['cycles.latency', 15],
          ['ns.latency', 8.0199],
        ],
      },
      {
        say: 'Set the rate to a hundred thousand interrupts a second. They now take 0.123 % of the machine’s time.',
        set: { rate: 100000 },
        reads: [['share.time', 0.001229718]],
      },
      {
        say: 'Read the sixteen stores as a program. The pipelined machine runs them in 20 cycles.',
        reads: [['cycles.saveprogram', 20]],
      },
    ],
    why:
      'An interrupt is a branch nobody predicted, and it costs what an unpredicted branch costs plus the state it has to keep. ' +
      'The flush is the five stages of work already in flight. ' +
      'The saves are one store a register, and they are why the number of registers a machine has is a latency as well as an area. ' +
      'The whole cost is 23 cycles, and at ten thousand a second that is a small share of the time. ' +
      'It is the latency rather than the share that matters to a device waiting for a reply. ' +
      'The jitter this causes at a sampling instant belongs to the Interfaces Lab, which is not built.',
    whyReads: [
      ['cycles.flush', 5],
      ['cycles.latency', 23],
    ],
  },

  g3: {
    see:
      'Amdahl’s law bounds what any improvement buys. ' +
      'The adder is 20.00 % of the time, so making it 3 times faster gives 1.153846 and no more than 1.25 ever. ' +
      'Memory is 35.00 % of the time, so halving it gives 1.212121. ' +
      'The branch penalty is 13.53 % of the time, and removing all of it gives 1.156522.',
    seeReads: [
      ['share.adder', 0.2],
      ['n.factor', 3],
      ['n.bound', 1.25],
      ['n.adder', 1.153846],
      ['share.memory', 0.35],
      ['n.memory', 1.212121],
      ['share.branch', 0.1353383],
      ['n.branch', 1.156522],
    ],
    try: [
      {
        say: 'Make the adder 20 times faster. The speed-up is 1.234568, which is close to its bound of 1.25.',
        set: { speedup: 20 },
        reads: [
          ['n.adder', 1.234568],
          ['n.bound', 1.25],
        ],
      },
      {
        say: 'Set the adder’s speed-up to 1. The machine gains 1, because nothing changed.',
        set: { speedup: 1 },
        reads: [['n.adder', 1]],
      },
      {
        say: 'Read the branch penalty’s share. It is 13.53 % of the time, taken from the 1.33 cycles an instruction.',
        reads: [
          ['share.branch', 0.1353383],
          ['n.cpi', 1.33],
        ],
      },
    ],
    why:
      'The speed-up of the whole is one over the part that did not change plus the part that did, divided by how much faster it became. ' +
      'Nothing else in the machine speeds up while the adder does. ' +
      'An infinitely fast adder leaves the other 80.00 % of the time exactly where it was, which is the bound of 1.25. ' +
      'This is why the branch penalty is worth attacking. ' +
      'It is a smaller share than memory, and it is the one this lab can remove outright rather than shorten. ' +
      'Every improvement in the lab lands on this law, and the profile the shares come from is stated rather than measured on a program.',
    whyReads: [
      ['n.bound', 1.25],
      ['share.adder', 0.2],
      ['share.rest', 0.8],
    ],
  },
}
