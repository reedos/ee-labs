// Group F, and B4 with it: the coding gain measured. Every number below is a
// reading, and the uncoded curve under all of them is the Communications Lab's.

export const F_LESSONS = {
  b4: {
    see:
      'The uncoded curve reaches an error rate of 10⁻⁵ at 9.588 dB. ' +
      'BPSK carries 1 bit/s/Hz, and the Shannon limit at that efficiency is 0.0000 dB. ' +
      'The distance between the two is 9.588 dB, and every code in the rest of this lab closes part of it.',
    seeReads: [
      ['gain.uncoded', 9.587858],
      ['gain.efficiency', 1],
      ['gain.limit', 0],
      ['gain.gap', 9.587858],
    ],
    try: [
      {
        say: 'Set the scheme to QPSK. The curve does not move, and the limit rises to 1.7609 dB, so the gap falls to 7.827 dB.',
        set: { scheme: 'qpsk' },
        reads: [
          ['gain.uncoded', 9.587858],
          ['gain.limit', 1.760913],
          ['gain.gap', 7.826946],
        ],
      },
      {
        say: 'Set the scheme to 16-QAM. It reaches the same error rate at 13.435 dB, against a limit of 5.7403 dB.',
        set: { scheme: 'qam16' },
        reads: [
          ['gain.uncoded', 13.434522],
          ['gain.limit', 5.740313],
          ['gain.gap', 7.694209],
        ],
      },
      {
        say: 'Set the error rate to 10⁻³. BPSK needs 6.790 dB there, so the gap is 6.790 dB and it grows as the target falls.',
        set: { target: 1e-3 },
        reads: [
          ['gain.uncoded', 6.789523],
          ['gain.gap', 6.789523],
        ],
      },
    ],
    why:
      'The limit is a property of the spectral efficiency, and the curve is a property of the modulation. ' +
      'QPSK carries twice the bits per hertz that BPSK does, on the same curve, so it is measured against a limit 1.7609 dB higher. ' +
      'That is why its gap is the smaller of the two. ' +
      'The gap is what coding is for. ' +
      'A code buys back part of it by spending bandwidth or rate, and the rest of this group measures how much each one buys.',
    whyReads: [
      ['gain.gap', 9.587858],
      ['gain.efficiency', 1],
    ],
    whyAlso: [
      {
        set: { scheme: 'qpsk' },
        reads: [
          ['gain.limit', 1.760913],
          ['gain.gap', 7.826946],
        ],
      },
    ],
  },

  f1: {
    see:
      'The (7,4) Hamming code with hard decisions reaches an error rate of 10⁻⁵ at 9.174 dB, where the uncoded link needs 9.588 dB. ' +
      'The real coding gain is the distance between the two curves, 0.413 dB. ' +
      'The asymptotic figure is 0.580 dB, and the two differ by 0.167 dB.',
    seeReads: [
      ['gain.coded', 9.174484],
      ['gain.uncoded', 9.587858],
      ['gain.real', 0.413375],
      ['gain.hard', 0.579919],
      ['gain.difference', 0.166545],
    ],
    try: [
      {
        say: 'Set the code to Golay. It reaches the rate at 7.445 dB, a real gain of 2.143 dB against an asymptotic 3.195 dB.',
        set: { code: 'G23' },
        reads: [
          ['gain.coded', 7.445349],
          ['gain.real', 2.142509],
          ['gain.hard', 3.195134],
        ],
      },
      {
        say: 'Set the code to (15,11) Hamming. The real gain is 1.153 dB, which is 0.510 dB under its asymptotic figure.',
        set: { code: 'H15' },
        reads: [
          ['gain.real', 1.153456],
          ['gain.difference', 0.509859],
        ],
      },
      {
        say: 'Set the error rate to 10⁻³. The gain falls to 0.131 dB, because the asymptotic figure is only approached far down the curve.',
        set: { target: 1e-3 },
        reads: [['gain.real', 0.131495]],
      },
    ],
    why:
      'A code spends part of each bit of energy on its parity, so the channel under it runs at R times the ratio. ' +
      'The (7,4) code sends 7 bits for every 4, so its channel sees 0.5714 of the energy per bit that no code would give it. ' +
      'The correction has to pay that back before it gains anything. ' +
      'The asymptotic gain 10 log₁₀(R(t + 1)) is what the two curves approach as the error rate goes to zero. ' +
      'The real gain is the distance between them at an error rate someone asked for. ' +
      'They are different numbers, and quoting the first where the second was meant overstates a link by a fraction of a decibel.',
    whyReads: [
      ['gain.rate', 0.571429],
      ['gain.hard', 0.579919],
      ['gain.real', 0.413375],
      ['n', 7],
      ['k', 4],
    ],
  },

  f2: {
    see:
      'The two curves cross at 5.862 dB, and both read 2.741 × 10⁻³ there. ' +
      'The reading sits at 4 dB, below the crossing, where the coded rate is 1.615 × 10⁻² against an uncoded 1.250 × 10⁻². ' +
      'Below the crossing the code is the worse of the two.',
    seeReads: [
      ['gain.crossover', 5.862022],
      ['gain.crossber', 0.002741],
      ['gain.codedat', 0.016154],
      ['gain.uncodedat', 0.012501],
    ],
    try: [
      {
        say: 'Set the reading to 8 dB, above the crossing. The coded rate is 1.170 × 10⁻⁴ against an uncoded 1.909 × 10⁻⁴.',
        set: { ebN0Db: 8 },
        reads: [
          ['gain.codedat', 0.00011695],
          ['gain.uncodedat', 0.00019091],
        ],
      },
      {
        say: 'Set it to 5.5 dB, just below the crossing. The coded rate is the larger of the two again.',
        set: { ebN0Db: 5.5 },
        reads: [
          ['gain.codedat', 0.0041052],
          ['gain.uncodedat', 0.0038622],
        ],
      },
      {
        say: 'Set the code to Golay. It crosses at 3.490 dB, sooner, because it corrects 3 errors rather than one.',
        set: { code: 'G23' },
        reads: [
          ['gain.crossover', 3.489671],
          ['gain.t', 3],
        ],
      },
    ],
    why:
      'The code pays its rate at every ratio and collects its correction only where errors are rare enough to correct. ' +
      'At a low ratio the channel puts more than t errors in most blocks, the decoder adds its own pattern on top, and the result is worse than leaving the bits alone. ' +
      'The crossing is where the two effects balance. ' +
      'A longer code with a larger correction radius crosses sooner, which is why Golay crosses at 3.490 dB and this one at 5.862 dB. ' +
      'A link designed below its code’s crossing point would do better with no code at all.',
    whyReads: [
      ['gain.crossover', 5.862022],
      ['gain.t', 1],
    ],
    whyAlso: [{ set: { code: 'G23' }, reads: [['gain.crossover', 3.489671]] }],
  },

  f3: {
    see:
      'The soft-decision bound on this code reaches an error rate of 10⁻⁵ at 5.882 dB, where the uncoded link needs 9.588 dB. ' +
      'The real gain is 3.706 dB and the asymptotic figure is 3.979 dB. ' +
      'The bound lies above the true error rate, so a gain read from it is a lower bound on the gain.',
    seeReads: [
      ['gain.coded', 5.881918],
      ['gain.uncoded', 9.587858],
      ['gain.real', 3.70594],
      ['gain.soft', 3.9794],
    ],
    try: [
      {
        say: 'Set the decisions to hard. The same code now needs 8.099 dB, so soft decisions are worth 2.217 dB on this curve.',
        set: { decision: 'hard' },
        reads: [
          ['gain.coded', 8.099393],
          ['gain.softover', 2.217474],
        ],
      },
      {
        say: 'Read the two capacities. Rate one half needs −2.823 dB per channel use with soft decisions and −1.238 dB with hard ones, a difference of 1.585 dB.',
        reads: [
          ['softdb', -2.823240],
          ['harddb', -1.237799],
          ['softover', 1.58544],
        ],
      },
      {
        say: 'Set the constraint length to 7. The free distance is 10, and the bound reaches the rate at 4.160 dB for a gain of 5.427 dB.',
        set: { K: 'K7' },
        reads: [
          ['gain.dfree', 10],
          ['gain.coded', 4.160445],
          ['gain.real', 5.427414],
        ],
      },
    ],
    why:
      'A hard decision throws away how sure the channel was, and that is what it costs. ' +
      'The two capacities put a floor under the loss. ' +
      'At rate one half a soft-decision channel reaches capacity 1.585 dB lower than the same channel after a threshold. ' +
      'The decoder on this screen reads the Communications Lab’s own beliefs rather than a copy of them. ' +
      'That lab maps the bits, adds the noise and returns one log-likelihood ratio per bit, and this lab turns each one into the level it stands for. ' +
      'At 1 dB the channel puts 85 bits wrong, the soft decoder gets 0 message bits wrong, and the hard one gets 19 wrong.',
    whyReads: [
      ['softover', 1.58544],
      ['chain.ebn0', 1],
      ['chain.flips', 85],
      ['chain.soft', 0],
      ['chain.hard', 19],
    ],
  },
}
