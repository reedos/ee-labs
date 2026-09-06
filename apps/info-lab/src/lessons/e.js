// Group E: LDPC and belief propagation. Every number below is a reading.

export const E_LESSONS = {
  e1: {
    see:
      'Twelve bits, 8 checks, and 24 edges between them. ' +
      'Each bit sits in 2 checks and each check covers 3 bits. ' +
      'Bit 5 was flipped, so the 2 checks that cover it fail and the syndrome weight is 2.',
    seeReads: [
      ['vars', 12],
      ['checks', 8],
      ['edges', 24],
      ['degreev', 2],
      ['degreec', 3],
      ['syndromeweight', 2],
    ],
    try: [
      {
        say: 'Set both flips to 0. Every check passes and the syndrome weight is 0.',
        set: { flip1: 0, flip2: 0 },
        reads: [['syndromeweight', 0]],
      },
      {
        say: 'Flip bits 5 and 8. Four checks fail, because those two bits share no check between them.',
        set: { flip1: 5, flip2: 8 },
        reads: [['syndromeweight', 4]],
      },
      {
        say: 'Read the rank of the 8 checks. It is 7, so the code carries 5 message bits at a rate of 0.4167.',
        reads: [
          ['checks', 8],
          ['rank', 7],
          ['k', 5],
          ['rate', 0.416667],
        ],
      },
    ],
    why:
      'The parity-check matrix is the code, and read as a graph it has one node per bit and one per check. ' +
      'A regular graph with 2 checks per bit and 3 bits per check has as many edges either way, which is 24 here. ' +
      'The degrees promise a design rate of 0.3333, which is one less d_v over d_c. ' +
      'That promise the degrees alone cannot keep. ' +
      'Every bit sits in 2 checks, so every column of the matrix has even weight and the 8 rows sum to zero. ' +
      'The rank is 7 rather than 8, so the true rate is 0.4167. ' +
      'No two bits share two checks here, so the shortest cycle in the graph runs through 6 nodes.',
    whyReads: [
      ['edges', 24],
      ['designrate', 0.333333],
      ['rank', 7],
      ['rate', 0.416667],
      ['girth', 6],
    ],
  },

  e2: {
    see:
      'The channel flipped 2 of the 12 bits. ' +
      'Each edge carries one number, the belief that its own bit is a zero. ' +
      'After the first iteration the word still fails 2 checks. ' +
      'After the second every check passes, and the word the decoder returns is the one that was sent.',
    seeReads: [
      ['flips', 2],
      ['vars', 12],
      ['weight.1', 2],
      ['weight.2', 0],
      ['iteration', 2],
      ['right', 1],
    ],
    try: [
      {
        say: 'Set the seed to 3. The channel flips nothing, every check passes at once, and the syndrome weight is 0.',
        set: { seed: 3 },
        reads: [
          ['flips', 0],
          ['weight.1', 0],
        ],
      },
      {
        say: 'Set the seed to 12. Two bits are wrong again, and this time the weight sits at 2 for all 6 iterations.',
        set: { seed: 12 },
        reads: [
          ['flips', 2],
          ['weight.1', 2],
          ['weight.6', 2],
          ['converged', 0],
        ],
      },
      {
        say: 'Set the crossover to 0.3. The channel flips 5 bits, the beliefs are weaker, and 6 checks fail after every iteration.',
        set: { crossover: 0.3 },
        reads: [
          ['flips', 5],
          ['weight.1', 6],
          ['weight.6', 6],
        ],
      },
    ],
    why:
      'A belief is a log-likelihood ratio, the logarithm of the probability the bit is a zero over the probability it is a one. ' +
      'A positive number argues for a zero, and the size of it is the strength of the argument. ' +
      'A check node tells each bit what the other bits on that check imply about it. ' +
      'A bit node adds up what the channel said and what its other checks said, and passes that on. ' +
      'Nothing is sent back along the edge it came from, so no belief counts itself twice. ' +
      'The syndrome weight after each round says how far the word still is from a codeword, and the decoder stops when it reaches 0.',
    whyReads: [
      ['weight.1', 2],
      ['weight.2', 0],
    ],
  },

  e3: {
    see:
      'Twenty blocks of 102 bits over a Gaussian channel at 4 dB. ' +
      'The channel put 102 of the 2040 bits wrong. ' +
      'One iteration takes that to 43 and three take it to 4. ' +
      'By 6 iterations every block has decoded, and the further iterations change nothing.',
    seeReads: [
      ['curve.bits', 2040],
      ['curve.0', 102],
      ['curve.1', 43],
      ['curve.3', 4],
      ['curve.6', 0],
      ['curve.12', 0],
    ],
    try: [
      {
        say: 'Set the ratio to 2 dB. The count falls from 192 to 37 over 12 iterations and stops there.',
        set: { ebN0Db: 2 },
        reads: [
          ['curve.0', 192],
          ['curve.12', 37],
        ],
      },
      {
        say: 'Set the ratio to 6 dB. The channel puts 41 bits wrong and one iteration leaves 1.',
        set: { ebN0Db: 6 },
        reads: [
          ['curve.0', 41],
          ['curve.1', 1],
        ],
      },
      {
        say: 'Set the case to one decode that sticks. Two bits are wrong, and 2 checks fail after every one of the 12 iterations.',
        set: { case: 'stuck' },
        reads: [
          ['curve.1', 2],
          ['curve.12', 2],
          ['converged', 0],
        ],
      },
    ],
    why:
      'Belief propagation is exact on a graph with no cycles, where each message reaches a node once. ' +
      'Every useful code has cycles, so a belief can travel round one and come back as though it were new evidence. ' +
      'The decoder is then not maximum-likelihood decoding, and two things follow that the curve shows. ' +
      'The first iterations remove most of the errors, and later ones remove fewer, because the graph has run out of independent evidence. ' +
      'Some words never converge to a codeword at all. ' +
      'The stuck case here holds 2 failed checks for ever, and no number of iterations moves it.',
    whyReads: [['curve.1', 43]],
    whyAlso: [
      {
        set: { case: 'stuck' },
        reads: [
          ['curve.12', 2],
          ['converged', 0],
        ],
      },
    ],
  },
}
