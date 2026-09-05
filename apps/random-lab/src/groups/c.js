// Group C: the Gaussian, and why it keeps appearing.

export const GROUP_C = 'The Gaussian, and why it keeps appearing'

export default [
  {
    id: 'C1',
    group: GROUP_C,
    name: 'Adding uniforms makes a Gaussian',
    terms: ['gaussian', 'clt', 'kurtosis', 'density', 'histogram', 'variance', 'ber'],
    params: {
      seed: 13,
      n: 200000,
      cltTerms: 4,
      bins: 40,
      lo: -4,
      hi: 4,
      sweepN: [20000],
      histRepeats: 4,
    },
    view: 'histogram',
    views: ['histogram', 'scope'],
    featured: { field: 'cltTerms' },
    claims: [
      {
        label: 'four uniforms already have a kurtosis near three',
        path: 'est.variance.kurtosis',
        formula: (p) => 3 - 6 / (5 * p.cltTerms),
        tol: 0.02,
      },
      {
        label: 'and the sum has unit variance, so only the shape changed',
        path: 'est.variance.value',
        formula: () => 1,
        tol: 0.02,
      },
      // Four terms is close to a Gaussian and is not one. At 200000 draws the
      // sampling noise is small enough that what is left is the real shape
      // difference, and the gap is 3.7 times what sampling alone would give.
      // The lesson says so rather than claiming an agreement that is not there.
      {
        label: 'the gap to the Gaussian is larger than sampling alone explains',
        path: 'hist.rms',
        atLeast: 'hist.predicted',
      },
      {
        label: 'and it is still small enough that the shape reads as Gaussian',
        path: 'hist.rms',
        atMostValue: 0.01,
      },
    ],
  },
  {
    id: 'C2',
    group: GROUP_C,
    name: 'The Gaussian mass, in three numbers',
    terms: ['gaussian', 'interval', 'level', 'qfunction', 'coverage'],
    params: { seed: 3, n: 100000, dist: 'gaussian', mu: 0, sigma: 1, bins: 40, lo: -4, hi: 4 },
    view: 'histogram',
    views: ['histogram'],
    featured: { field: 'level' },
    claims: [
      { label: 'one sigma holds 68.27 %', path: 'closed.insideOneSigma', formula: () => 0.6826894921, tol: 1e-8 },
      { label: 'two sigma holds 95.45 %', path: 'closed.insideTwoSigma', formula: () => 0.9544997361, tol: 1e-8 },
      { label: 'three sigma holds 99.73 %', path: 'closed.insideThreeSigma', formula: () => 0.9973002039, tol: 1e-8 },
      // Counted, not restated. The closed form is 1 - 2Q(k), and these are the
      // draws that fell inside, with the count's own interval as the tolerance.
      { label: 'and the count inside one sigma agrees', path: 'tail.1.counted', against: 'tail.1.closed', tol: 0.01 },
      { label: 'inside two sigma', path: 'tail.2.counted', against: 'tail.2.closed', tol: 0.005 },
      { label: 'inside three sigma', path: 'tail.3.counted', against: 'tail.3.closed', tol: 0.002 },
      {
        label: 'and a 95 % interval is 1.9600 sigma on each side',
        path: 'est.mean.se',
        formula: (p) => p.sigma / Math.sqrt(p.n),
        tol: 0.05,
      },
    ],
  },
  {
    id: 'C3',
    group: GROUP_C,
    name: 'The Q function is the tail',
    terms: ['qfunction', 'gaussian', 'ber'],
    params: { seed: 3, n: 20000, dist: 'gaussian', bins: 40, lo: -4, hi: 4 },
    view: 'histogram',
    views: ['histogram', 'errorrate'],
    featured: { field: 'sigma' },
    claims: [
      // The textbook values of Q, reached through the mass identity so that the
      // number checked is the one the pane prints.
      { label: 'Q(1) is 0.158655', path: 'closed.insideOneSigma', formula: () => 1 - 2 * 0.15865525393145705, tol: 1e-12 },
      { label: 'Q(2) is 0.0227501', path: 'closed.insideTwoSigma', formula: () => 1 - 2 * 0.022750131948179195, tol: 1e-12 },
      { label: 'Q(3) is 0.00134990', path: 'closed.insideThreeSigma', formula: () => 1 - 2 * 0.0013498980316300933, tol: 1e-12 },
      { label: 'and the counted tail beyond two sigma agrees', path: 'tail.2.counted', against: 'tail.2.closed', tol: 0.01 },
    ],
  },
]
