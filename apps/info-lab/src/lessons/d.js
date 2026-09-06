// Group D: convolutional codes and Viterbi. Every number below is a reading.

export const D_LESSONS = {
  d1: {
    see:
      'The encoder holds 3 bits, the one arriving and the 2 before it. ' +
      'Those 2 earlier bits are the state, so there are 4 states and 8 branches out of them. ' +
      'Each branch puts out 2 bits, one per generator. ' +
      'Eight message bits and two flush bits make 20 bits on the wire.',
    seeReads: [
      ['constraint', 3],
      ['memory', 2],
      ['outputs', 2],
      ['states', 4],
      ['branches', 8],
      ['encoded', 20],
      ['steps', 10],
    ],
    try: [
      {
        say: 'Set the constraint length to 5. The state is now 4 bits wide, so there are 16 states and 32 branches.',
        set: { K: 'K5' },
        reads: [
          ['memory', 4],
          ['states', 16],
          ['branches', 32],
        ],
      },
      {
        say: 'Set the message to 128, which is a single one followed by zeros. The first output pairs are 11, 01 and 11.',
        set: { message: 128 },
        reads: [['encoded', 20]],
      },
      {
        say: 'Read those pairs down each output. The first gives 101, which is generator 5, and the second gives 111, which is generator 7.',
        set: { message: 128 },
        reads: [['branches', 8]],
      },
    ],
    why:
      'A block code cuts the message into pieces and codes each piece alone. ' +
      'A convolutional encoder never cuts the message at all. ' +
      'It runs the message through a shift register, and each output bit is a modulo-two sum of the bits under a fixed set of taps. ' +
      'The taps are written in octal, so generator 5 is 101 and takes the incoming bit and the oldest of the two stored bits. ' +
      'The register is the whole of the encoder memory, and the 2 stored bits are what the decoder has to track. ' +
      'That is why the state count is 2 raised to the constraint length less one.',
    whyReads: [
      ['states', 4],
      ['branches', 8],
    ],
  },

  d2: {
    see:
      'Four states down the page, time across it. ' +
      'The message is 6 bits and the flush is 2 bits, so the trellis has 8 steps and 16 bits come out. ' +
      'Every path from state 00 back to state 00 is a codeword, and 6 message bits make 64 of them.',
    seeReads: [
      ['states', 4],
      ['msgbits', 6],
      ['memory', 2],
      ['steps', 8],
      ['encoded', 16],
      ['paths', 64],
    ],
    try: [
      {
        say: 'Set the constraint length to 5. There are 16 states, and 10 steps because the flush is now 4 bits long.',
        set: { K: 'K5' },
        reads: [
          ['states', 16],
          ['memory', 4],
          ['steps', 10],
        ],
      },
      {
        say: 'Read the metric of the path the decoder returned. It is 0, because nothing was flipped on this run.',
        reads: [['metric', 0]],
      },
      {
        say: 'Change the message. The path through the trellis moves, and the trellis itself does not.',
        set: { message: 37 },
        reads: [
          ['steps', 8],
          ['metric', 0],
        ],
      },
    ],
    why:
      'The trellis is the state diagram drawn once per step, with the branches joining one column to the next. ' +
      'Two branches leave each state and two arrive at each state, because one bit goes in per step. ' +
      'A path through it is a message, and the bits along that path are the codeword. ' +
      'The two flush bits at the end return the encoder to state 00, which is why a terminated path both starts and ends there. ' +
      'Termination costs 2 bits of rate and buys a decoder that knows where the path ends. ' +
      'Every path is a codeword and every codeword is a path, which is what makes the decoding a search over this picture.',
    whyReads: [
      ['states', 4],
      ['paths', 64],
    ],
  },

  d3: {
    see:
      'Two of the 20 bits on the wire were flipped. ' +
      'At each step the decoder keeps one path into each state and discards the other, which is 8 add-compare-select operations a step. ' +
      'The surviving path has a metric of 2, the two flipped bits, and every message bit comes back right.',
    seeReads: [
      ['flips', 2],
      ['encoded', 20],
      ['acsstep', 8],
      ['metric', 2],
      ['errors', 0],
    ],
    try: [
      {
        say: 'Set both flips to 0. The metric falls to 0, and the survivor into every state on the path costs nothing.',
        set: { flip1: 0, flip2: 0 },
        reads: [
          ['metric', 0],
          ['errors', 0],
        ],
      },
      {
        say: 'Flip bits 4 and 5, which sit in one branch and the next. The metric is 2 again and the decode is still right.',
        set: { flip1: 4, flip2: 5 },
        reads: [
          ['metric', 2],
          ['errors', 0],
        ],
      },
      {
        say: 'Compare the two ways of searching. The decoder does 80 operations over this block, and an exhaustive search would weigh 256 paths.',
        reads: [
          ['acs', 80],
          ['paths', 256],
        ],
      },
    ],
    why:
      'Two paths that arrive at the same state at the same step have the same future. ' +
      'Whichever of them has the larger metric now will have the larger metric for ever, so it can be discarded at once. ' +
      'That is the whole of Viterbi, and it turns a search over 256 paths into 80 add-compare-select operations. ' +
      'The saving grows with the block. ' +
      'Exhaustive search doubles its work for each further message bit, and the trellis adds one more column of 8 operations. ' +
      'The path it keeps is the one an exhaustive search would return, which the engine checks against that search on short blocks.',
    whyReads: [
      ['acs', 80],
      ['paths', 256],
      ['acsstep', 8],
    ],
  },

  d4: {
    see:
      'The lowest-weight path that leaves state 00 and returns to it has weight 5, found by searching the states rather than quoted. ' +
      'One error event has that weight, and it carries 1 message bit. ' +
      'The asymptotic soft gain is 10 log₁₀(R d_free), which is 3.979 dB at rate one half.',
    seeReads: [
      ['dfree', 5],
      ['spectrum.5', 1],
      ['bits.5', 1],
      ['gain.soft', 3.9794],
    ],
    try: [
      {
        say: 'Set the constraint length to 7. The free distance is 10 and the gain rises to 6.990 dB.',
        set: { K: 'K7' },
        reads: [
          ['dfree', 10],
          ['gain.soft', 6.9897],
        ],
      },
      {
        say: 'Set it to 9. The free distance is 12, and the decoder now needs 512 operations at every step.',
        set: { K: 'K9' },
        reads: [
          ['dfree', 12],
          ['acsstep', 512],
        ],
      },
      {
        say: 'Read the error events at weights 6, 7 and 8. They carry 4, 12 and 32 message bits, which is (i + 1)2^i.',
        reads: [
          ['bits.6', 4],
          ['bits.7', 12],
          ['bits.8', 32],
        ],
      },
    ],
    why:
      'The free distance plays the part the minimum distance plays for a block code. ' +
      'Two paths that separate and rejoin differ in at least that many output bits, and the closest pair sets the error rate at high signal-to-noise ratios. ' +
      'The gain 10 log₁₀(R d_free) is asymptotic, which means it is the distance the two curves approach and not the distance between them at any stated error rate. ' +
      'The union bound behind it adds one term per error event, so it is an upper bound on the error rate. ' +
      'A gain read from an upper bound is a lower bound on the gain. ' +
      'Constraint length buys distance and costs work, at 2 raised to K − 1 states.',
    whyReads: [
      ['dfree', 5],
      ['gain.soft', 3.9794],
    ],
  },

  d5: {
    see:
      'A thousand message bits go over a Gaussian channel at 3 dB, and 157 of the 2004 channel bits arrive wrong. ' +
      'A traceback of 15 steps returns every message bit rightly, so 0 are wrong. ' +
      'A traceback of 2 steps decides too early and leaves 19 wrong.',
    seeReads: [
      ['flips', 157],
      ['encoded', 2004],
      ['errors', 0],
      ['curve.2', 19],
    ],
    try: [
      {
        say: 'Set the depth to 5. Four message bits come back wrong, because the survivors have not merged that soon.',
        set: { depth: 5 },
        reads: [['errors', 4]],
      },
      {
        say: 'Set the depth to 40. The count is 0, the same as a traceback that runs to the start of the block.',
        set: { depth: 40 },
        reads: [
          ['errors', 0],
          ['curve.floor', 0],
        ],
      },
      {
        say: 'Set the ratio to 2 dB. The count at depth 2 is 42, and depth 15 leaves 12 of the thousand wrong.',
        set: { ebN0Db: 2 },
        reads: [
          ['curve.2', 42],
          ['curve.15', 12],
        ],
      },
    ],
    why:
      'A decoder with unbounded memory traces back from the end of the block. ' +
      'A decoder on a wire cannot wait, so it reads its decision a fixed number of steps behind the front, from the best state there. ' +
      'The survivors into all 4 states have usually merged by then, and when they have, the decision is the one the full traceback would have made. ' +
      'The rule of thumb is five constraint lengths, which is 15 steps for this code. ' +
      'The measured count reaches its floor at that depth here. ' +
      'Deeper costs memory and buys nothing, and shallower decides before the paths have merged.',
    whyReads: [
      ['traceback', 15],
      ['states', 4],
      ['errors', 0],
    ],
  },
}
