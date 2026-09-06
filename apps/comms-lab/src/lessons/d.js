// Group D lessons. see / try / why, in the budgets STYLE.md sets.

export default {
  D1: {
    see: [
      'The channel adds one Gaussian to each of the two coordinates of every symbol.',
      'Both come from a seeded generator, so the same seed gives the same waveform every time.',
      'At an Eb over N0 of 10 dB each arm carries a standard deviation of 0.1581.',
      'The spread of the cloud on screen reads that number back.',
    ].join(' '),
    try: [
      { say: 'Set the seed to 2. Every point moves and the spread does not.', set: { seed: 2 } },
      { say: 'Set the seed to 1. The old points return exactly.', set: { seed: 1 } },
      { say: 'Set Eb over N0 to 6 dB. The standard deviation rises to 0.2506.', set: { ebN0Db: 6 } },
    ],
    why: [
      'The noise density is written N0, and each of the two coordinates carries half of it.',
      'Here the symbols have unit mean square, so N0 follows from the energy per bit and the bits a symbol carries.',
      'That makes the standard deviation a function of the knob rather than a separate setting.',
      'The generator is the one the Random Signals Lab built, and this lab uses it rather than writing a second one.',
      'A seeded source is what makes a claim in this lab reproducible.',
      'The same seed gives the same cloud, the same count and the same picture in a report.',
      'Nothing this lab states depends on which seed was drawn, and D3 is where that is measured.',
    ].join(' '),
  },

  D2: {
    see: [
      'The receive filter is a copy of the transmitted pulse, which is the matched filter.',
      'Its output signal-to-noise ratio reads 40.000 for a unit-energy pulse at a density of 0.05.',
      'That is twice the pulse energy over the noise density, whatever shape the pulse has.',
      'The measured mean and variance each sit inside their own intervals of the prediction.',
    ].join(' '),
    try: [
      { say: 'Set the noise density to 0.1. The ratio halves to 20.000.', set: { n0: 0.1 } },
      { say: 'Set the noise density to 0.025. It doubles to 80.000.', set: { n0: 0.025 } },
      { say: 'Set the trials to 40000. The intervals narrow and the ratio does not move.', set: { trials: 40000 } },
    ],
    why: [
      'A correlator multiplies the received samples by a kernel and adds them up.',
      'The wanted part of that sum is the inner product of the kernel with the pulse.',
      'The noise part has a variance proportional to the energy in the kernel.',
      'Cauchy and Schwarz say the ratio of the first squared to the second is largest when the kernel is the pulse.',
      'That is the matched filter, and its ratio is twice the pulse energy over the noise density.',
      'The shape of the pulse does not appear in the answer, only its energy.',
      'Its output is also what a soft metric reads, rather than the hard decision a threshold makes.',
    ].join(' '),
  },

  D3: {
    see: [
      'The line is the closed form and the markers are counted points, and they are never one series.',
      'The form reads 7.8650 in a hundred at an Eb over N0 of nothing.',
      'It reads 1.2501 in a hundred at 4 dB and 1.9091 in ten thousand at 8 dB.',
      'Every counted marker carries an interval, and the line passes through all of them.',
    ].join(' '),
    try: [
      { say: 'Set Eb over N0 to 8 dB. The rate falls to about two in ten thousand.', set: { ebN0Db: 8 } },
      { say: 'Set the counted symbols to 20000. The intervals widen and the markers stay on the line.', set: { countSymbols: 20000 } },
      { say: 'Set the counted symbols to 200000. The intervals narrow again.', set: { countSymbols: 200000 } },
    ],
    why: [
      'The closed form for antipodal signalling is the Q function of the root of twice the energy ratio.',
      'It is exact, so it is drawn as a line and printed without a hedge.',
      'The count runs the chain, compares bits and reports a fraction, so it is an estimate.',
      'An estimate ships with its interval, which is the guard the house rules require on anything measured.',
      'The distance between the marker and the line is the content of this experiment rather than an error.',
      'Every point drawn here came from a fixed seed and a fixed trial count, so the picture is reproducible.',
      'The Information Lab reads this curve as a function and measures its coding gains against it.',
    ].join(' '),
  },

  D4: {
    see: [
      'The frame is short, so the point at 8 dB rests on fewer than 30 errors.',
      'It is drawn hollow, and the readout gives the interval rather than a value.',
      'At that count the interval spans a factor of two, so the point estimate is not a reading.',
      'A hundred errors give a half width of 19.6 per cent, and a thousand give 6.2 per cent.',
    ].join(' '),
    try: [
      { say: 'Set the counted symbols to 200000. The point fills in and the interval closes.', set: { countSymbols: 200000 } },
      { say: 'Set the counted symbols to 20000. It opens again.', set: { countSymbols: 20000 } },
      { say: 'Read the errors needed for a tenth. It is 385, whatever the rate is.', set: { countSymbols: 4000 } },
    ],
    why: [
      'The precision of a counted rate depends on the number of errors and on nothing else.',
      'The relative half width is 1.96 over the root of the error count, at a level of 95 per cent.',
      'A hundred errors give 19.6 per cent, a thousand give 6.2 per cent, and 385 give a tenth.',
      'A frame of a fixed length collects fewer errors as the rate falls, so a point at high power rests on very few.',
      'The interval printed here is the Wilson one, which keeps a width at zero errors where the obvious one collapses.',
      'A rate of zero counted in ten thousand symbols does not mean the rate is zero.',
      'That is why the plot draws the closed form everywhere and the count only where a count can be read.',
    ].join(' '),
  },

  D5: {
    see: [
      'QPSK carries two bits a symbol and reads the same bit error rate as BPSK.',
      'At an Eb over N0 of 10 dB both read 3.8721 in a million.',
      'Both need 9.588 dB for one error in a hundred thousand.',
      'The symbol error rate is exactly twice the bit error rate.',
    ].join(' '),
    try: [
      { say: 'Set Eb over N0 to 9.588 dB. The rate reaches one in a hundred thousand.', set: { ebN0Db: 9.588 } },
      { say: 'Set Eb over N0 to 6 dB. The rate rises to about two in a hundred.', set: { ebN0Db: 6 } },
      { say: 'Read the two thresholds. QPSK and BPSK agree to the digit.', set: { ebN0Db: 10 } },
    ],
    why: [
      'The two coordinates of a QPSK symbol are two independent BPSK decisions.',
      'Each arm carries half the symbol energy and sees half the noise, so each arm is a BPSK link.',
      'The bit error rate is therefore the BPSK rate at the same energy per bit.',
      'The symbol is wrong when either arm is wrong, which is twice as likely as one arm being wrong.',
      'Gray labelling makes each of those a one-bit error, so the ratio to the bit rate is exactly two.',
      'The rate doubled for nothing, which is why QPSK rather than BPSK is the usual starting point.',
      'Every scheme after this one pays for its rate, and D6 says how much.',
    ].join(' '),
  },

  D6: {
    see: [
      '16-QAM carries four bits a symbol rather than two.',
      'It needs 13.435 dB for one error in a hundred thousand, against 9.588 dB for QPSK.',
      'That is 3.847 dB for twice the rate in the same bandwidth.',
      '64-QAM carries six bits and needs 17.787 dB.',
    ].join(' '),
    try: [
      { say: 'Set Eb over N0 to 17.787 dB. 64-QAM reaches one error in a hundred thousand.', set: { ebN0Db: 17.787 } },
      { say: 'Set Eb over N0 to 10 dB. The rate rises to 1.7542 in a thousand.', set: { ebN0Db: 10 } },
      { say: 'Set Eb over N0 back to 13.435 dB.', set: { ebN0Db: 13.435 } },
    ],
    why: [
      'Adding bits to a symbol packs the points closer at the same average power.',
      'The minimum distance falls from 1.4142 for QPSK to 0.6325 for 16-QAM and 0.3086 for 64-QAM.',
      'Noise crosses a smaller gap more often, so the same rate needs more energy per bit.',
      'The step from four points to sixteen costs 3.847 dB and doubles the rate.',
      'The step from sixteen to sixty four costs a further 4.352 dB and adds half as much again.',
      'Each doubling of the rate costs more than the last, which is the shape of the whole trade.',
      'The Information Lab spends some of that back with a code, and it measures the gain against this curve.',
    ].join(' '),
  },

  D7: {
    see: [
      'Two orthogonal tones need 12.598 dB for one error in a hundred thousand.',
      'BPSK needs 9.588 dB for the same rate.',
      'The gap is 3.010 dB, and it is exactly a factor of two inside the Q function.',
      'Without a phase reference the same link needs 13.352 dB.',
    ].join(' '),
    try: [
      { say: 'Set Eb over N0 to 13.352 dB, which is what the noncoherent detector needs.', set: { ebN0Db: 13.352 } },
      { say: 'Set Eb over N0 to 8 dB. The rate rises to about two in a thousand.', set: { ebN0Db: 8 } },
      { say: 'Read the gap to BPSK. It is 3.010 dB at every rate, not just at this one.', set: { ebN0Db: 12.598 } },
    ],
    why: [
      'Two antipodal signals are as far apart as two signals of a given energy can be.',
      'Two orthogonal signals are the root of two closer, and that is a factor of two in energy.',
      'The factor sits inside the argument of the Q function, so the penalty is 3.010 dB at every rate.',
      'The lab checks that at three different rates rather than at one.',
      'A noncoherent detector compares the magnitude of two arms rather than their signed values.',
      'It throws away the phase, so it needs a further 0.754 dB.',
      'What it buys is a receiver that needs no carrier recovery loop, which Group E is about.',
    ].join(' '),
  },

  D8: {
    see: [
      'At an Eb over N0 of 10 dB, 16-QAM makes 7.004 symbol errors in a thousand.',
      'It makes 1.7542 bit errors in a thousand at the same setting.',
      'Four bits a symbol times the bit rate gives 7.017 in a thousand.',
      'The ratio of the symbol rate to that is 0.9982.',
    ].join(' '),
    try: [
      { say: 'Set Eb over N0 to 14 dB. Both rates fall and the ratio stays near one.', set: { ebN0Db: 14 } },
      { say: 'Set Eb over N0 to 6 dB. The ratio falls, because errors reach past the neighbours.', set: { ebN0Db: 6 } },
      { say: 'Set Eb over N0 back to 10 dB.', set: { ebN0Db: 10 } },
    ],
    why: [
      'A symbol error costs at least one bit and at most all of them.',
      'With Gray labelling the likely error lands on a neighbour, and a neighbour differs in one bit.',
      'So one symbol error costs one bit, and the two rates differ by the bits a symbol carries.',
      'The ratio is 0.9982 rather than 1 because a few errors reach past the nearest neighbour.',
      'At lower power more of them do, and the ratio falls further from one.',
      'That is the measurement B3 promised when it counted the label distances rather than the errors.',
      'A labelling that left neighbours two bits apart would nearly double the bit error rate here.',
    ].join(' '),
  },
}
