// Group B: capacity and the Shannon limit. Every number below is a reading.

export const B_LESSONS = {
  b1: {
    see:
      'The Gaussian channel carries 3.459432 bit/s/Hz at a signal-to-noise ratio of 10 dB. ' +
      'The rate is log₂(1 + S/N), so it rises with the power and has no ceiling. ' +
      'At 0 dB, where signal and noise have the same power, the capacity is exactly 1.000000 bit/s/Hz.',
    seeReads: [['capacity.awgn', 3.459432]],
    seeAlso: [{ set: { snrDb: 0 }, reads: [['capacity.awgn', 1]] }],
    try: [
      {
        say: 'Set the ratio to 6 dB. The capacity is 2.316456 bit/s/Hz, and four times the power has not doubled it.',
        set: { snrDb: 6 },
        reads: [['capacity.awgn', 2.316456]],
      },
      {
        say: 'Set the ratio to 20 dB. The capacity is 6.658211 bit/s/Hz, so a hundred times the power carries under seven times the rate.',
        set: { snrDb: 20 },
        reads: [['capacity.awgn', 6.658211]],
      },
      {
        say: 'Set the ratio to −10 dB. The capacity is 0.137504 bit/s/Hz, and it stays above zero at every finite ratio.',
        set: { snrDb: -10 },
        reads: [['capacity.awgn', 0.137504]],
      },
    ],
    why:
      'Capacity is a rate, in bits per second per hertz. ' +
      'It is the largest rate at which some code makes the error rate as small as you please. ' +
      'It says nothing about which code, and nothing about how long that code has to be. ' +
      'The logarithm is the reason a link runs out of returns. ' +
      'Doubling the power adds 3 dB, and 3 dB adds under one bit per second per hertz once the ratio is high. ' +
      'Bandwidth buys rate in proportion, and power buys it as a logarithm.',
    whyReads: [['capacity.awgn', 3.459432]],
  },

  b2: {
    see:
      'The binary symmetric channel flips each bit with probability 0.1, and its capacity is 1 − h₂(p). ' +
      'That reads 0.531004 bit per use, so nearly half of each bit is lost to the flips. ' +
      'The erasure channel loses a quarter of its bits and says which ones, so its capacity is exactly 0.750000.',
    seeReads: [
      ['capacity.bsc', 0.531004],
      ['capacity.bec', 0.75],
    ],
    try: [
      {
        say: 'Set the crossover to 0.01. The capacity rises to 0.919207 bit per use, so one flip in a hundred still costs a twelfth of each bit.',
        set: { crossover: 0.01 },
        reads: [['capacity.bsc', 0.919207]],
      },
      {
        say: 'Set the crossover to 0.5. The capacity is 0, because the output is now independent of the input.',
        set: { crossover: 0.5 },
        reads: [['capacity.bsc', 0]],
      },
      {
        say: 'Read the crossover at which the capacity is one half. It is 0.110028, and that number sets the rate a code can hope for.',
        reads: [['half', 0.110028]],
      },
    ],
    why:
      'The two binary channels lose their bits in different ways, and the arithmetic follows the difference. ' +
      'An erasure says where it happened, so a code has only to fill known gaps and the capacity is 1 − e exactly. ' +
      'A flip does not say where it happened, so the receiver pays h₂(p) bits of doubt on every bit it receives. ' +
      'That is why the symmetric channel at 0.1 carries 0.531004 bit while an erasure channel at 0.1 carries 0.900000. ' +
      'Knowing where the damage is worth more than knowing how much of it there is.',
    whyReads: [['capacity.bsc', 0.531004]],
    whyAlso: [{ set: { erasure: 0.1 }, reads: [['capacity.bec', 0.9]] }],
  },

  b3: {
    see:
      'No code sends 1 bit/s/Hz below 0.0000 dB of energy per bit over noise density. ' +
      'The limit is (2^r − 1)/r, and it falls as the rate falls. ' +
      'Its floor is −1.5917 dB, which is ln 2, and that is the lowest ratio at which any code carries anything at all.',
    seeReads: [
      ['limitdb', 0],
      ['floordb', -1.591745],
    ],
    try: [
      {
        say: 'Set the efficiency to 0.5 bit/s/Hz. The limit falls to −0.8175 dB, which is where a rate one half code is measured from.',
        set: { efficiency: 0.5 },
        reads: [['limitdb', -0.817457]],
      },
      {
        say: 'Set the efficiency to 4 bit/s/Hz. The limit rises to 5.7403 dB, because a denser signal needs more energy per bit.',
        set: { efficiency: 4 },
        reads: [['limitdb', 5.740313]],
      },
      {
        say: 'Read the binary-input capacity at 0 dB per channel use. It is 0.721452 bit, below the 1.000000 bit an unrestricted input carries.',
        reads: [
          ['bi.capacity', 0.721452],
          ['capacity.awgn', 1],
        ],
      },
    ],
    why:
      'The limit comes from the capacity by asking what energy a rate needs. ' +
      'Writing the signal-to-noise ratio as r E_b/N_0 and setting r ≤ log₂(1 + r E_b/N_0) gives E_b/N_0 ≥ (2^r − 1)/r. ' +
      'As r goes to zero that bound goes to ln 2, so spending energy slowly does not escape it. ' +
      'The binary-input capacity is the same question for a channel that may send only two levels. ' +
      'It has no closed form, so this pane integrates it and prints the difference between two grid refinements. ' +
      'A number that carries its own convergence is a number with a stated error.',
    whyReads: [
      ['floordb', -1.591745],
      ['bi.capacity', 0.721452],
    ],
  },
}
