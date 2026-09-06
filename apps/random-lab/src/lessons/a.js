// Group A lessons. see / try / why, in the budgets STYLE.md sets.

export default {
  A1: {
    see: [
      'One frame of white noise gives a spectrum that is spray.',
      'Reload it and the spray is different, though nothing about the signal changed.',
      'Average 100 frames and a flat floor appears at 6.4550 µV/√Hz.',
      'That floor is a power spectral density, and it is what describes a random signal.',
    ].join(' '),
    try: [
      { say: 'Set averages to 1. Each bin scatters as widely as its own mean.', set: { averages: 1 } },
      { say: 'Set averages to 100. The spread falls to 10 %, and the floor is flat.', set: { averages: 100 } },
      { say: 'Read the integral in the corner. It returns the 1 mV that went in.', set: {} },
    ],
    why: [
      'A sine has a spectrum, meaning a line at one frequency with one height.',
      'A random signal does not.',
      'Its Fourier transform is itself random, so a single frame measures a different thing each time.',
      'What is fixed is how its mean square is spread over frequency, and that is the power spectral density.',
      'The density is measured in signal units per root hertz, so it does not depend on the measurement bandwidth.',
      'Integrating it over a band returns the power in that band.',
      'Over the whole band it returns the variance, and here that is the 1 mV rms the generator was given.',
      'Group E returns to this with the machinery to say how good the estimate is.',
    ].join(' '),
  },

  A2: {
    see: [
      'The source is a seeded generator, not an unseeded one.',
      'The same seed gives the same 1000 numbers every time the view is drawn.',
      'A different seed gives an unrelated set, from the first number.',
      'Every value this lab quotes is a value of a seed.',
    ].join(' '),
    try: [
      { say: 'Set the seed to 2. Every sample moves, and the sample mean moves with it.', set: { seed: 2 } },
      { say: 'Set the seed back to 1. The old numbers return exactly.', set: { seed: 1 } },
      { say: 'Read the interval on the mean. It holds zero at both seeds.', set: {} },
    ],
    why: [
      'A tool that used an unseeded generator could not pin a number in a test.',
      'It also could not show the same picture twice, so a reader could not check a claim.',
      'The generator here is xoshiro128, with four 32-bit words of state.',
      'Its seed is passed through a mixing step first.',
      'Without that step, seeds 1 and 2 would open with almost the same number, and two runs a reader compares would look related when they are not.',
      'What changes with the seed is every sample.',
      'What does not change is any claim the lab makes, because each claim is about the procedure and not about one draw.',
    ].join(' '),
  },

  A3: {
    see: [
      'The bars are counts of 1000 draws, normalised so their total area is one.',
      'The curve is the density those draws came from.',
      'The bars do not sit on the curve, and the gap between them is 0.0246.',
      'Raise the count and the gap shrinks as one over the root of it.',
    ].join(' '),
    try: [
      { say: 'Set N to 100. The gap grows to 0.0751, and the shape is rough.', set: { n: 100 } },
      { say: 'Set N to 10000. The gap falls to 0.00798, about a third of it.', set: { n: 10000 } },
      { say: 'Set N to 100000. The gap is 0.00250, and the bars follow the curve.', set: { n: 100000 } },
    ],
    why: [
      'Each bar counts how many of N draws landed in one bin.',
      'That count is binomial, so its standard error is the root of Np(1 − p).',
      'Divided by N to make a density, the error falls as one over the root of N.',
      'A hundredfold increase in draws therefore buys a tenfold reduction in the gap, and no more.',
      'The panel prints the measured gap beside what the binomial predicts, so the law is compared against a formula rather than against a previous picture.',
      'This rate governs every measurement in the lab.',
      'It is why a spectrum needs many frames and why a counted error rate needs many symbols.',
    ].join(' '),
  },

  A4: {
    see: [
      'Each bar now carries a whisker, the interval on that bar alone.',
      'The centre bar reads 0.398 where the curve reads 0.3970.',
      'Its interval reaches 0.0265 each side at a 95 % level.',
      'The curve passes inside almost every whisker.',
    ].join(' '),
    try: [
      { say: 'Set N to 1000. The whiskers grow, and the bars still straddle the curve.', set: { n: 1000 } },
      { say: 'Set N to 100000. The whiskers shrink and the bars settle onto the curve.', set: { n: 100000 } },
      { say: 'Read the count outside the range. It is printed rather than added to the end bars.', set: {} },
    ],
    why: [
      'A bar without an interval invites the reader to treat it as a measurement of the density.',
      'It is an estimate, and the interval says how much of the gap to the curve is expected.',
      'At a 95 % level the curve should fall outside about one whisker in twenty, and here it falls outside two of forty.',
      'Samples beyond the plotted range are counted separately.',
      'Adding them to the end bars would put a false spike at each edge, on a plot whose whole purpose is the shape.',
      'The count is printed instead, and at four standard deviations it is small.',
    ].join(' '),
  },
}
