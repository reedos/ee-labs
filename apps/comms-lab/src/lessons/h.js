// Group H lessons. see / try / why, in the budgets STYLE.md sets.

export default {
  H1: {
    see: [
      'Every receiver starts from the same floor, which is kT.',
      'At 290 K that is minus 173.9752 dBm in every hertz.',
      'A megahertz of band and a noise figure of 6 dB puts the floor at minus 107.975 dBm.',
      'An amplifier of 12 dB gain and 1.5 dB figure in front of a mixer gives a total of 1.784 dB.',
    ].join(' '),
    try: [
      { say: 'Set the noise figure to 3 dB. The floor falls to minus 110.975 dBm.', set: { noiseFigureDb: 3 } },
      { say: 'Set the bandwidth to 2 MHz. The floor rises 3.010 dB.', set: { bandwidth: 2e6 } },
      { say: 'Set the noise figure back to 6 dB and the bandwidth to 1 MHz.', set: { noiseFigureDb: 6, bandwidth: 1e6 } },
    ],
    why: [
      'The floor is thermal, and its density is Boltzmann times the temperature.',
      'The Electronics Lab derives that from four k T R across a resistor, and this lab assumes it.',
      'A noise figure says how much a stage adds above the floor, in decibels.',
      'Friis says how figures cascade, and the first stage sets almost all of the total.',
      'That is why a low-noise amplifier goes at the front, and swapping the two here costs 2.287 dB.',
      'The plan quotes 1.944 dB and 4.166 dB for this pair, and the arithmetic here gives 1.784 and 4.071.',
      'The RF Lab derives a noise figure from a real front end, and this lab takes it as a number.',
    ].join(' '),
  },

  H2: {
    see: [
      'The wavelength at 2.4 GHz is 124.91 mm.',
      'Free-space path loss is twenty times the log of four pi times the distance over that.',
      'At 100 m it is 80.052 dB, at a kilometre 100.052 dB and at ten kilometres 120.052 dB.',
      'Every decade of distance adds exactly 20 dB.',
    ].join(' '),
    try: [
      { say: 'Set the distance to 100 m. The loss falls to 80.052 dB.', set: { distance: 100 } },
      { say: 'Set the distance to 10 km. It rises to 120.052 dB.', set: { distance: 10000 } },
      { say: 'Set the distance back to 1 km.', set: { distance: 1000 } },
    ],
    why: [
      'A transmitter spreads its power over a sphere, and the area of that sphere grows as the square of the distance.',
      'A receive antenna of a fixed size therefore collects a share that falls as the square, which is 20 dB a decade.',
      'The wavelength enters because an antenna of a given gain has an area proportional to the wavelength squared.',
      'That is why the same link at twice the frequency loses 6.021 dB more.',
      'This is the loss with nothing in the way, so it is a best case rather than a prediction.',
      'A real path has walls, ground reflections and foliage, and the System Lab is where those are added.',
      'Group G already showed what one reflection does to the response.',
    ].join(' '),
  },

  H3: {
    see: [
      'Twenty dBm goes in, two antennas add 2 dBi each, and 100.052 dB of path loss comes off.',
      'The receiver sees minus 76.052 dBm, which is 31.923 dB above the noise floor.',
      'At 2 Mbit a second in a megahertz that is 28.913 dB of Eb over N0.',
      'QPSK needs 9.588 dB, so the margin is 19.325 dB.',
    ].join(' '),
    try: [
      { say: 'Set the distance to 2 km. The margin falls by 6.021 dB.', set: { distance: 2000 } },
      { say: 'Set the distance to 9252 m. The margin reaches nothing.', set: { distance: 9252 } },
      { say: 'Set the distance back to 1 km.', set: { distance: 1000 } },
    ],
    why: [
      'A link budget is a column of decibels, and every row is arithmetic on the row above it.',
      'The transmit power and the two antenna gains add, and the path loss subtracts.',
      'The noise floor is a separate column, from kT, the bandwidth and the noise figure.',
      'The difference between the two is the signal-to-noise ratio in that bandwidth.',
      'Converting it to energy per bit needs the bit rate, and here 2 Mbit a second in 1 MHz costs 3.010 dB.',
      'What is left over the requirement is the margin, and it is what pays for everything the budget left out.',
      'H4 spends some of it on losses this lab has already measured, and the System Lab spends the rest.',
    ].join(' '),
  },

  H4: {
    see: [
      'Four losses this lab already measured, added into one column.',
      'The cyclic prefix costs 0.969 dB and the pilots 0.348 dB.',
      'A hard decision instead of a soft one costs 1.585 dB.',
      'A timing error of a twentieth of a symbol costs 1.291 dB, for a total of 4.193 dB.',
    ].join(' '),
    try: [
      { say: 'Set the prefix to 8 samples. The first row falls to 0.512 dB.', set: { ofdmCp: 8 } },
      { say: 'Set the roll-off to 1. The timing row falls to 0.402 dB.', set: { beta: 1 } },
      { say: 'Set the prefix back to 16 and the roll-off to 0.35.', set: { ofdmCp: 16, beta: 0.35 } },
    ],
    why: [
      'A budget built from ideal blocks is optimistic, and the gap has to be accounted for somewhere.',
      'Three of these four rows come from experiments in this lab, and each moves when its own knob moves.',
      'The prefix and the pilot rows come from F6, and the timing row from C5.',
      'The hard decision row is a parameter rather than a measurement here.',
      'Measuring it needs a decoder that reads soft metrics, and the Information Lab owns that.',
      'The total comes off the margin, which leaves 15.13 dB on this link.',
      'The System Lab is where the rest of the budget lives, including antenna patterns and interference.',
    ].join(' '),
  },
}
