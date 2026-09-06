// Group H: metastability.

export const H_LESSONS = {
  h1: {
    see:
      'The rate law, with the four numbers it is a function of printed beside its answer. ' +
      'At 200 ps of settling time the mean time between failures is 1.10 s. At 400 ps it is 24 260 s. ' +
      'At 600 ps it is 16.93 years. Every extra 20 ps multiplies the mean time by e, because the law is an ' +
      'exponential in the settling time over τ.',
    seeReads: [['mtbf', 1.1013e12]],
    seeAlso: [
      { set: { tr: 400 }, reads: [['mtbf', 2.42583e16]] },
      { set: { tr: 600 }, reads: [['mtbfyears', 16.9317]] },
    ],
    try: [
      {
        say: 'Add 20 ps of settling time, to 220 ps. The mean time is now 2.99 s, which is a factor of e more.',
        set: { tr: 220 },
        reads: [['mtbf', 2.99371e12]],
      },
      {
        say: 'Double τ to 40 ps at 200 ps of settling. The mean time collapses to 7.42 ms, because the exponent halved.',
        set: { tau: 40 },
        reads: [['mtbf', 7.42066e9]],
      },
      {
        say: 'Set the settling time to 600 ps. The mean time is 16.93 years, which is fifteen more factors of e.',
        set: { tr: 600 },
        reads: [
          ['mtbfyears', 16.9317],
          ['mtbf', 5.34324e20],
        ],
      },
    ],
    why:
      'A flip-flop caught inside the window can sit between the two levels. The chance it is still there after a ' +
      'time t falls off as an exponential in t over τ. The rate of failures is that chance times how often the ' +
      'question is asked. That is the clock rate, times the rate of asynchronous edges, times the width of the ' +
      'window an edge can land in. ' +
      'All four of those numbers are on the page with the answer, and so are the three things the law assumes. ' +
      'That is not decoration. This is the only model in the lab that is not exact. A mean time quoted without its ' +
      'parameters is a number nobody can check. τ and T0 belong to a measured cell, and this lab has none.',
    whyReads: [['mtbf', 1.1013e12]],
  },

  h2: {
    see:
      'Two flip-flops in a row on the same clock. The first one may come out metastable, and the second does not ' +
      'read it until a whole clock period later, less the setup and clock-to-Q times. At a 1000 ps period that is ' +
      '880 ps of settling time, and a mean time of 20.4 million years. One flip-flop alone gives no settling time ' +
      'at all, and 124 ns.',
    seeReads: [
      ['flops', 2],
      ['settling', 880],
      ['mtbfyears', 20362131],
    ],
    seeAlso: [{ set: { n: 1 }, reads: [['settling', -120], ['mtbf', 123938]] }],
    try: [
      {
        say: 'Take the second flip-flop away. The settling time goes to nothing and the mean time falls to 124 ns.',
        set: { n: 1 },
        reads: [['mtbf', 123938]],
      },
      {
        say: 'Add a third. The settling time is 1880 ps, and the mean time is past anything worth writing down.',
        set: { n: 3 },
        reads: [
          ['settling', 1880],
          ['flops', 3],
        ],
      },
      {
        say: 'Go back to two and double the clock period to 2000 ps. The settling time is 1880 ps again, for the same reason.',
        set: { n: 2, period: 2000 },
        reads: [['settling', 1880]],
      },
    ],
    why:
      'A synchroniser does not stop a flip-flop going metastable. Nothing does, because the incoming edge is not ' +
      'controlled by the clock that samples it. What the second stage buys is time. ' +
      'The first flip-flop is allowed to be undecided for almost a whole clock period, because nothing reads it ' +
      'until the second stage samples it at the next edge. The settling time is that period less the setup time ' +
      'the second stage asks for and the clock-to-Q the first one takes. ' +
      'The law is an exponential in that time. So one stage of latency moves the mean time by a factor of e to the ' +
      'power of a clock period over τ. Here that is one flip-flop turning 124 ns into 20.4 million years, at the ' +
      'price of one clock.',
    whyReads: [
      ['settling', 880],
      ['mtbfyears', 20362131],
    ],
    whyAlso: [{ set: { n: 1 }, reads: [['mtbf', 123938]] }],
  },

  h3: {
    see:
      'The law read backwards. A target mean time of 1000 years at these four parameters asks for 681.6 ps of ' +
      'settling time. Rounded up to a whole picosecond, that setting gives 1022 years, a little more than was ' +
      'asked for. The panel prints what the answer rests on, next to the answer.',
    seeReads: [
      ['settling', 681.5713],
      ['mtbfyears', 1021.66],
    ],
    try: [
      {
        say: 'Ask for 1 year instead. The settling time needed falls to 543.4 ps.',
        set: { years: 1 },
        reads: [['settling', 543.416]],
      },
      {
        say: 'Ask for a million years. It only rises to 819.7 ps, because the law is exponential and the target is not.',
        set: { years: 1000000 },
        reads: [['settling', 819.726]],
      },
      {
        say: 'Double τ to 40 ps at the 1000 year target. Now 1363.1 ps of settling time is needed, twice as much.',
        set: { tau: 40 },
        reads: [['settling', 1363.14]],
      },
    ],
    why:
      'Designing a synchroniser is choosing a settling time, and the settling time is a clock period. So the real ' +
      'question is how many stages a design can afford, and the law turns a target into that number. ' +
      'Three properties of the law are worth reading off it. Multiplying the target by a thousand costs only a few ' +
      'τ of settling time, because the target is inside a logarithm. Doubling τ doubles the settling time needed, ' +
      'because τ is the scale the exponent is measured in. And the grid here is whole picoseconds, so the answer is ' +
      'rounded up and the mean time comes out a little above the target rather than below it. ' +
      'The τ this rests on is a parameter of this lab and not a measurement. The Analog IC Lab is where it would ' +
      'come from, and the panel says so.',
    whyReads: [
      ['settling', 681.5713],
      ['mtbfyears', 1021.66],
    ],
  },
}
