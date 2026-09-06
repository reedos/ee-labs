// Group C: block codes. Every number below is a reading.

export const C_LESSONS = {
  c1: {
    see:
      'The code sends four message bits and one check bit, chosen so that every codeword has an even number of ones. ' +
      'One bit was flipped on the way, so the check fails and the syndrome reads 1. ' +
      'The distance of this code is 2, so it detects 1 error and corrects none.',
    seeReads: [
      ['n', 5],
      ['k', 4],
      ['syndrome', 1],
      ['d', 2],
      ['detect', 1],
      ['t', 0],
    ],
    try: [
      {
        say: 'Flip a second bit as well. The count of ones is even again, the syndrome reads 0, and two errors pass unseen.',
        set: { flip1: 1, flip2: 3 },
        reads: [
          ['syndrome', 0],
          ['flips', 2],
        ],
      },
      {
        say: 'Set both flips to 0. The syndrome is 0, which is what every one of the 16 codewords gives.',
        set: { flip1: 0, flip2: 0 },
        reads: [
          ['syndrome', 0],
          ['words', 16],
        ],
      },
      {
        say: 'Read the weight distribution. Ten codewords have weight 2 and five have weight 4, and none has an odd weight.',
        reads: [
          ['weights.2', 10],
          ['weights.4', 5],
        ],
      },
    ],
    why:
      'Addition here is addition modulo two, which is the exclusive-or. ' +
      'The check bit is the sum of the four message bits, so the sum of all five bits of a codeword is 0. ' +
      'The syndrome is that same sum taken at the receiver, and it is 1 exactly when an odd number of bits changed. ' +
      'That is the whole of what one check buys. ' +
      'The code is a subspace of the 32 words of five bits, and the sum of two codewords is a codeword. ' +
      'Every code in this lab has that property, and the syndrome of every one of them is a linear map of the received word.',
    whyReads: [
      ['syndrome', 1],
      ['words', 16],
      ['total', 32],
    ],
  },

  c2: {
    see:
      'The (7,4) Hamming code has 3 checks, so a received word falls into one of 8 cosets. ' +
      'Bit 3 was flipped here, and the syndrome names it. The pattern the checks report is the column of H at that place. ' +
      'The decoder subtracts that one error and returns the codeword that was sent.',
    seeReads: [
      ['n', 7],
      ['k', 4],
      ['cosets', 8],
      ['corrected', 1],
      ['right', 1],
    ],
    try: [
      {
        say: 'Flip bit 5 instead. The syndrome moves to another of the 8 patterns, and the table names bit 5.',
        set: { flip1: 5 },
        reads: [
          ['syndrome', 4],
          ['right', 1],
        ],
      },
      {
        say: 'Flip bits 3 and 5 together. The syndrome names one bit, the decoder changes it, and the word ends up 3 bits from the one sent.',
        set: { flip1: 3, flip2: 5 },
        reads: [
          ['syndrome', 2],
          ['right', 0],
          ['corrected', 1],
        ],
      },
      {
        say: 'Set the message to another word, keeping the flip. The syndrome does not move at all.',
        set: { message: 6 },
        reads: [
          ['syndrome', 6],
          ['right', 1],
        ],
      },
    ],
    why:
      'The syndrome is H(c + e)ᵀ, and Hcᵀ is zero for every codeword, so the syndrome is Heᵀ. ' +
      'It depends on the error alone, and the last step of the three measures that. ' +
      'With 3 checks there are 8 syndromes. ' +
      'One of them is zero and the other 7 are the columns of H, which are the 7 single-error patterns. ' +
      'That is why this code corrects one error and no more. ' +
      'A double error has the syndrome of some single error, and the decoder trusts it and makes a third.',
    whyReads: [
      ['cosets', 8],
      ['n', 7],
    ],
  },

  c3: {
    see:
      'The code has sixteen codewords of seven bits. ' +
      'One has weight 0, seven have weight 3, seven have weight 4, and one has weight 7. ' +
      'The smallest nonzero weight is 3, so the distance is 3, and that corrects 1 error and detects 2. ' +
      'The 16 spheres of 8 words each cover all 128 words of seven bits.',
    seeReads: [
      ['words', 16],
      ['weights.0', 1],
      ['weights.3', 7],
      ['weights.4', 7],
      ['weights.7', 1],
      ['d', 3],
      ['t', 1],
      ['detect', 2],
      ['sphere', 8],
      ['covered', 128],
    ],
    try: [
      {
        say: 'Set the code to the (23,12) Golay code. Its distance is 7, so it corrects 3 errors and detects 6.',
        set: { code: 'G23' },
        reads: [
          ['d', 7],
          ['t', 3],
          ['detect', 6],
        ],
      },
      {
        say: 'Set the code to the (5,1) repetition code. Its distance is 5 at a rate of 0.2000, which is the price of that distance.',
        set: { code: 'R5' },
        reads: [
          ['d', 5],
          ['rate', 0.2],
          ['t', 2],
        ],
      },
      {
        say: 'Set the code to (15,11) Hamming. The distance is 3 like every Hamming code, and the rate has risen to 0.7333.',
        set: { code: 'H15' },
        reads: [
          ['d', 3],
          ['rate', 0.733333],
        ],
      },
    ],
    why:
      'Distance decides everything a code can do. ' +
      'Two codewords d apart need ⌊(d − 1)/2⌋ errors before the received word is nearer another codeword, so that is the correction radius. ' +
      'Detection reaches further, to d − 1, because a pattern of that weight cannot turn one codeword into another. ' +
      'The spheres are the picture behind the arithmetic. ' +
      'Each codeword covers the words within its radius, and those spheres never overlap. ' +
      'When they also leave nothing over the code is perfect, which the (7,4) and the (23,12) codes both are.',
    whyReads: [
      ['t', 1],
      ['detect', 2],
      ['covered', 128],
      ['total', 128],
    ],
  },

  c4: {
    see:
      'The same 16 codewords come from dividing by the polynomial x³ + x + 1. ' +
      'The encoder shifts the message up 3 places and appends the remainder, so every codeword divides exactly. ' +
      'The received word here has one bit flipped, and its remainder is the syndrome the matrix gave.',
    seeReads: [
      ['words', 16],
      ['n', 7],
      ['remainder', 6],
      ['syndrome', 6],
    ],
    try: [
      {
        say: 'Set the bit flipped to 0. The remainder is 0, because a codeword divides by the generator with nothing left over.',
        set: { flip1: 0 },
        reads: [
          ['remainder', 0],
          ['syndrome', 0],
        ],
      },
      {
        say: 'Set the code to the (23,12) Golay code. It is cyclic too, with a distance of 7 at a rate of 0.5217.',
        set: { code: 'G23' },
        reads: [
          ['d', 7],
          ['rate', 0.521739],
          ['t', 3],
        ],
      },
      {
        say: 'Set the code to (15,11) Hamming. Its generator has degree 4, so it appends 4 check bits and its rate is 0.7333.',
        set: { code: 'H15' },
        reads: [
          ['n', 15],
          ['k', 11],
          ['parity', 4],
          ['rate', 0.733333],
        ],
      },
    ],
    why:
      'A cyclic code is one where a codeword shifted round is again a codeword. ' +
      'Every such code is the set of multiples of one generator polynomial, so encoding is a multiplication and checking is a division. ' +
      'In hardware both are a shift register with a few exclusive-or gates, which is why these codes are the ones on the wire. ' +
      'The two views give the same code and the same answers. ' +
      'The remainder of the received word equals the syndrome of the matrix, and the codeword set is the one the generator matrix produced. ' +
      'This lab builds the Hamming codes this way, from a primitive polynomial of the right degree.',
    whyReads: [
      ['remainder', 6],
      ['syndrome', 6],
    ],
  },

  c5: {
    see:
      'GF(2⁴) has 15 nonzero elements, and the powers of the primitive element run through all 15 of them once each. ' +
      'RS(15,11) takes its symbols from that field. ' +
      'Its distance is 5, which is n − k + 1 exactly, so it meets the Singleton bound. ' +
      'Four erased symbols were filled here from the eleven that arrived.',
    seeReads: [
      ['field.order', 15],
      ['field.powers', 15],
      ['rs.n', 15],
      ['rs.k', 11],
      ['rs.d', 5],
      ['erasures', 4],
      ['filled', 1],
    ],
    try: [
      {
        say: 'Set the erasures to 5. The decoder declines, because n − k is 4 and each erasure costs one check symbol.',
        set: { erasures: 5 },
        reads: [['erasures', 5]],
      },
      {
        say: 'Set the erasures to 0. Every syndrome is zero, so the word arrived as a codeword.',
        set: { erasures: 0 },
        reads: [['filled', 1]],
      },
      {
        say: 'Read the two radii. The code corrects 2 symbol errors, or 4 erasures, which is twice as many.',
        reads: [
          ['rs.t', 2],
          ['rs.erasures', 4],
        ],
      },
    ],
    why:
      'A Reed-Solomon symbol is a whole element of GF(2⁴) rather than one bit, so a burst that ruins four adjacent bits damages one symbol. ' +
      'The distance is n − k + 1, the most any code of that length and dimension can have. ' +
      'An erasure costs one check symbol and an error costs two, because an error hides its position as well as its value. ' +
      'This version fills erasures and does not correct errors. ' +
      'Finding unknown positions needs the Berlekamp-Massey or Euclidean algorithm, and the pane states what is missing rather than leaving it to be discovered.',
    whyReads: [
      ['rs.d', 5],
      ['rs.t', 2],
      ['rs.erasures', 4],
    ],
  },
}
