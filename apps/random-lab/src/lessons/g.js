export default {
  G1: {
    see: [
      'The sample mean of N samples has a variance of its own.',
      'That variance is the data variance divided by N.',
      'So its standard error is 0.3162 at N = 10 and 0.01000 at N = 10000.',
      'A hundredfold N narrows the interval tenfold.',
    ].join(' '),
    try: [
      { say: 'Set N to 100. The standard error falls to 0.1000.', set: { n: 100 } },
      { say: 'Set N to 10000. It falls to 0.01000, a hundredth of the data spread.', set: { n: 10000 } },
      { say: 'Read the half width, which is 1.9600 standard errors at a 95 % level.', set: {} },
    ],
    why: [
      'This is the rate at which measurement buys precision, and it is the same rate as the histogram of A3.',
      'It follows from variances adding.',
      'A sum of N independent samples has N times the variance, and dividing the sum by N divides the variance by N squared.',
      'What is left is one over N.',
      'The consequence is worth stating plainly.',
      'Halving an interval costs four times the data, and getting one more digit costs a hundred times.',
      'Averaging is a weak tool, and every stronger tool in this lab works by using structure rather than by averaging harder.',
    ].join(' '),
  },

  G2: {
    see: [
      'An interval is a statement about a procedure, not about one measurement.',
      'Repeat the whole estimate 4000 times and count how often the interval holds the true mean.',
      'It reads 0.951 against a claimed 0.950.',
      'The interval itself moves from repeat to repeat.',
    ].join(' '),
    try: [
      { say: 'Set the level to 0.68. The intervals narrow and the coverage falls to about 0.68.', set: { level: 0.68 } },
      { say: 'Set the level to 0.99. They widen and the coverage rises with them.', set: { level: 0.99 } },
      { say: 'Read the mean width against 2z sigma over root N.', set: {} },
    ],
    why: [
      'A reader meeting an interval for the first time usually reads it as an error bar on this measurement.',
      'It is not, and this experiment is where the difference becomes visible.',
      'The true mean is one fixed number, and the interval is what moves.',
      'A 95 % level means that if the whole procedure were repeated many times, about 95 % of the intervals produced would contain that fixed number.',
      'The count here is 3804 of 4000.',
      'The interval also uses the sample variance in place of the true one, so it is doubly random, and the coverage still lands where it claims.',
    ].join(' '),
  },

  G3: {
    see: [
      'Monte Carlo answers a design question by drawing many cases and counting.',
      'This run draws 2000 cases of a quantity at 10 units with a 0.5 spread.',
      'Between 9 and 11 the yield is 95.85 %, with an interval from 94.88 % to 96.64 %.',
      'The Gaussian gives 95.45 % for the same band.',
    ].join(' '),
    try: [
      { say: 'Tighten the band to 9.5 and 10.5. The yield falls to 66.9 %.', set: {} },
      { say: 'Set the spread to 0.25. The yield at the tight band rises above 95 %.', set: { sigma: 0.25 } },
      { say: 'Set the runs to 200. The count moves little and its interval widens tenfold.', set: { runs: 200 } },
    ],
    why: [
      'The counted yield is an estimate, so the corner prints how many runs passed out of how many, and the standard error of the fraction.',
      'A yield printed as a bare percentage invites a reader to act on a digit that is not there.',
      'At 2000 runs the standard error is about 0.4 points, so 95.9 % and 95.5 % are the same measurement.',
      'This view is the ensemble of Group D with a specification attached.',
      'The Applied Analog Lab reuses it, with a part tolerance as the source of the randomness and a measured circuit specification as the outcome.',
    ].join(' '),
  },
}
