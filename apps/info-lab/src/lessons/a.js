// Group A: entropy and source coding. Every number below is a reading.

export const A_LESSONS = {
  a1: {
    see:
      'The source has five symbols, at probabilities 0.4, 0.2, 0.2, 0.1 and 0.1. ' +
      'Its entropy is 2.121928 bit per symbol, the average of −log₂ p over the five. ' +
      'A uniform source of five symbols has 2.321928 bit, and no source of five has more.',
    seeReads: [
      ['H', 2.121928],
      ['symbols', 5],
      ['prob.1', 0.4],
      ['prob.2', 0.2],
      ['prob.4', 0.1],
      ['Hmax', 2.321928],
    ],
    try: [
      {
        say: 'Set the source to five symbols, uniform. The entropy rises to 2.321928 bit, which is log₂ 5.',
        set: { source: 'S5u' },
        reads: [['H', 2.321928]],
      },
      {
        say: 'Set the source to one certain symbol. The entropy falls to 0 bit, because the next symbol is already known.',
        set: { source: 'S5c' },
        reads: [['H', 0]],
      },
      {
        say: 'Move 0.4 of the probability to the last symbol. The entropy reads 1.760964 bit, and the first symbol now has probability 0.',
        set: { tilt: 0.4 },
        reads: [
          ['H', 1.760964],
          ['prob.1', 0],
          ['prob.5', 0.5],
        ],
      },
    ],
    why:
      'A symbol of probability p costs −log₂ p bits to name, and the entropy is the average of that cost over the source. ' +
      'The number has units of bits per symbol, and it is a property of the distribution rather than of any one message. ' +
      'Two ends fix the scale. A uniform source over five symbols is the hardest of them to code, at 2.321928 bit. ' +
      'A source that always sends the same symbol costs nothing, at 0 bit. ' +
      'Everything later in this lab is measured against this number. ' +
      'A source coder tries to reach it from above, and a channel carries at most its capacity of it.',
    whyReads: [
      ['Hmax', 2.321928],
      ['symbols', 5],
    ],
    whyAlso: [{ set: { source: 'S5c' }, reads: [['H', 0]] }],
  },

  a2: {
    see:
      'Huffman joins the two least likely symbols, over and over, and reads the codewords off the tree. ' +
      'The five symbols get 2, 2, 2, 3 and 3 bits, so the average length is 2.200000 bit. ' +
      'The entropy is 2.121928 bit, so the redundancy is 0.078072 bit and the efficiency is 96.451 %.',
    seeReads: [
      ['length.1', 2],
      ['length.4', 3],
      ['length.5', 3],
      ['L', 2.2],
      ['H', 2.121928],
      ['redundancy', 0.078072],
      ['efficiency', 96.451277],
    ],
    try: [
      {
        say: 'Read the Kraft sum under the tree. It is 1.000000, so the code uses every leaf of the tree it grew.',
        reads: [['kraft', 1]],
      },
      {
        say: 'Compare the fixed-length code. Five symbols need 3 bits each, so this code saves 26.667 % of the bits.',
        reads: [
          ['fixed', 3],
          ['saving', 26.666667],
        ],
      },
      {
        say: 'Set the source to four symbols, dyadic. The average length falls to 1.750000 bit and the redundancy to 0.',
        set: { source: 'S4d' },
        reads: [
          ['L', 1.75],
          ['redundancy', 0],
        ],
      },
    ],
    why:
      'Huffman gives the shortest average length of any code that assigns whole bits to symbols. ' +
      'The bound it sits inside is H ≤ L < H + 1, and both halves matter. ' +
      'It cannot beat the entropy, because no lossless code can. ' +
      'It cannot lose by a whole bit, because a codeword of ⌈−log₂ p⌉ bits always exists for every symbol. ' +
      'The Kraft sum measures whether a prefix code fits the tree it was cut from. ' +
      'A sum of 1.000000 says every leaf carries a codeword, and a sum below one says a shorter code exists.',
    whyReads: [
      ['kraft', 1],
      ['L', 2.2],
      ['H', 2.121928],
    ],
  },

  a3: {
    see:
      'Every probability of this source is a power of one half. ' +
      'Huffman gives lengths of 1, 2, 3 and 3 bits, and each one is −log₂ p exactly. ' +
      'The average length is 1.750000 bit against an entropy of 1.750000 bit, so the redundancy is 0 and the efficiency is 100 %.',
    seeReads: [
      ['length.1', 1],
      ['length.2', 2],
      ['length.3', 3],
      ['L', 1.75],
      ['H', 1.75],
      ['redundancy', 0],
      ['efficiency', 100],
    ],
    try: [
      {
        say: 'Set the source to two symbols at 0.9. The entropy is 0.468996 bit and the codeword is 1 bit, so 0.531004 bit is wasted per symbol.',
        set: { source: 'S2' },
        reads: [
          ['H', 0.468996],
          ['L', 1],
          ['redundancy', 0.531004],
        ],
      },
      {
        say: 'Read the efficiency there. It is 46.900 %, which is the worst case for a code of whole bits.',
        set: { source: 'S2' },
        reads: [['efficiency', 46.899559]],
      },
      {
        say: 'Set the source back to five symbols, uneven. The length is 2.200000 bit against an entropy of 2.121928 bit.',
        set: { source: 'S5' },
        reads: [
          ['L', 2.2],
          ['H', 2.121928],
        ],
      },
    ],
    why:
      'A codeword is a whole number of bits, and the ideal length −log₂ p usually is not. ' +
      'Huffman is exact when every probability is a power of one half, because then every ideal length is already whole. ' +
      'The worst case runs the other way. ' +
      'A source of two symbols needs at least 1 bit per symbol, whatever its entropy, so a nearly certain source wastes almost all of it. ' +
      'At 0.9 the entropy is 0.468996 bit and the code spends 1 bit, which is an efficiency of 46.900 %. ' +
      'The next two experiments close that gap in two different ways.',
    whyReads: [['L', 1.75]],
    whyAlso: [
      {
        set: { source: 'S2' },
        reads: [
          ['H', 0.468996],
          ['L', 1],
          ['efficiency', 46.899559],
        ],
      },
    ],
  },

  a4: {
    see:
      'The source has two symbols at 0.9 and 0.1, and an entropy of 0.468996 bit per symbol. ' +
      'One symbol at a time costs a whole 1 bit. ' +
      'Coding pairs costs 0.645000 bit per symbol, because the whole-bit penalty is now paid once per pair.',
    seeReads: [
      ['H', 0.468996],
      ['blocked.1', 1],
      ['blocked.2', 0.645],
    ],
    try: [
      {
        say: 'Set the block to 3 symbols. The length falls to 0.532667 bit per symbol.',
        set: { block: 3 },
        reads: [['blocked.3', 0.532667]],
      },
      {
        say: 'Set the block to 4. The length is 0.492550 bit per symbol, against the entropy of 0.468996 bit below it.',
        set: { block: 4 },
        reads: [
          ['blocked.4', 0.49255],
          ['H', 0.468996],
        ],
      },
      {
        say: 'Set the first probability to 0.5. The entropy is 1 bit and blocking buys nothing, because 1 bit was already exact.',
        set: { p: 0.5 },
        reads: [
          ['H', 1],
          ['blocked.1', 1],
          ['blocked.2', 1],
        ],
      },
    ],
    why:
      'Coding n symbols at once treats the block as one symbol of a larger source. ' +
      'That source has n times the entropy, and Huffman still lands inside one bit of it. ' +
      'Dividing by n gives a length per symbol within 1/n of the entropy, so the gap closes as 1/n and never quite reaches zero. ' +
      'The cost is the alphabet. ' +
      'Blocks of 4 from two symbols make 16 blocks to code, and blocks of 8 make 256 of them. ' +
      'A coder that reaches the entropy without that growth is the subject of the next experiment.',
    whyReads: [
      ['blocked.4', 0.49255],
      ['H', 0.468996],
      ['alphabet.4', 16],
    ],
  },

  a5: {
    see:
      'The coder narrows one interval per symbol and sends the shortest binary fraction inside it. ' +
      'A hundred symbols of this source cost at most 48.900 bit, which is 0.488996 bit per symbol. ' +
      'The entropy is 0.468996 bit per symbol, and Huffman on one symbol at a time spends a whole 1 bit.',
    seeReads: [
      ['arith.symbols', 100],
      ['arith.bound', 48.899559],
      ['arith.per', 0.488996],
      ['H', 0.468996],
      ['L', 1],
    ],
    try: [
      {
        say: 'Set the count to 1000 symbols. The bound is 470.996 bit, which is 0.470996 bit per symbol.',
        set: { n: 1000 },
        reads: [
          ['arith.symbols', 1000],
          ['arith.bound', 470.995594],
          ['arith.per', 0.470996],
        ],
      },
      {
        say: 'Set the count to 10 symbols. The bound is 6.690 bit, or 0.668996 per symbol, because 2 bits of overhead are spread over ten.',
        set: { n: 10 },
        reads: [
          ['arith.symbols', 10],
          ['arith.bound', 6.689956],
          ['arith.per', 0.668996],
          ['arith.overhead', 2],
        ],
      },
      {
        say: 'Read the code word the interval produced. It is 48 bit long, which is inside the bound above it.',
        reads: [
          ['arith.bits', 48],
          ['arith.bound', 48.899559],
        ],
      },
    ],
    why:
      'The coder holds one interval of the unit line and narrows it by each symbol in turn. ' +
      'After a sequence the interval has width P(x), the probability of that whole sequence. ' +
      'A binary fraction of −log₂ P(x) + 2 bits always lands inside an interval of that width, so the whole sequence costs that many bits. ' +
      'The overhead is 2 bits for the message rather than for each symbol, so it vanishes as the message grows. ' +
      'The arithmetic is exact integer arithmetic here. ' +
      'A hundred symbols of this source narrow the interval below what a floating-point number can hold.',
    whyReads: [
      ['arith.bound', 48.899559],
      ['arith.ideal', 46.899559],
      ['arith.overhead', 2],
    ],
  },
}
