// Group G: estimation, and the interval.
//
// G3's ensemble is the Monte Carlo shape the Applied Analog Lab will reuse.

export const GROUP_G = 'Estimation, and the interval'

export default [
  {
    id: 'G1',
    group: GROUP_G,
    name: 'The sample mean has variance sigma squared over N',
    terms: ['samplemean', 'estimator', 'variance', 'interval', 'histogram'],
    params: {
      seed: 41,
      n: 1000,
      dist: 'gaussian',
      mu: 2,
      sigma: 1,
      sweepMeanN: [10, 100, 1000, 10000],
      level: 0.95,
    },
    // The one-run view, not the ensemble: N is this lesson's knob, and it moves
    // the samples on screen and the standard error under them. The ensemble of
    // outcomes does not read N at all, so opening on it left the featured knob
    // moving nothing.
    view: 'scope',
    views: ['scope', 'outcome'],
    featured: { field: 'n' },
    claims: [
      {
        label: 'the standard error at N = 10',
        path: 'meanN.0.se',
        formula: (p) => p.sigma / Math.sqrt(10),
        tol: 1e-12,
      },
      {
        label: 'at N = 1000',
        path: 'meanN.2.se',
        formula: (p) => p.sigma / Math.sqrt(1000),
        tol: 1e-12,
      },
      {
        label: 'a hundredfold N narrows the interval tenfold',
        path: 'meanN.0.half',
        againstScaled: { path: 'meanN.2.half', by: 10 },
        tol: 1e-9,
      },
      {
        label: 'and the live estimate reports the same standard error',
        path: 'est.mean.se',
        formula: (p) => p.sigma / Math.sqrt(p.n),
        tol: 0.1,
      },
    ],
  },
  {
    id: 'G2',
    group: GROUP_G,
    name: 'The interval covers at the rate it claims',
    terms: ['interval', 'level', 'coverage', 'estimator', 'variance'],
    params: {
      seed: 41,
      level: 0.95,
      covTrials: 4000,
      covN: 300,
      covMu: 2,
      covSigma: 1.5,
      n: 300,
      dist: 'gaussian',
      mu: 2,
      sigma: 1.5,
    },
    view: 'outcome',
    views: ['outcome'],
    featured: { field: 'level' },
    claims: [
      {
        label: 'the counted coverage matches the level it claims',
        path: 'cov.rate',
        against: 'cov.claimed',
        tol: 0.01,
      },
      {
        label: 'and it is inside three standard errors of that level',
        path: 'cov.rate',
        withinOf: { path: 'cov.claimed', se: 'cov.se', k: 3 },
      },
      {
        label: 'the interval width is two z sigma over root N',
        path: 'cov.meanWidth',
        against: 'cov.predictedWidth',
        tol: 0.02,
      },
      {
        // The counted rate is printed as an estimate, so its own interval has
        // to hold the level it is measuring.
        label: 'and the counted rate carries an interval that holds the claimed level',
        path: 'cov.countedLo',
        atMost: 'cov.claimed',
      },
      {
        label: 'from above as well',
        path: 'cov.countedHi',
        atLeast: 'cov.claimed',
      },
    ],
  },
  {
    id: 'G3',
    group: GROUP_G,
    name: 'Monte Carlo is an ensemble with a specification',
    terms: ['montecarlo', 'yield', 'ensemble', 'interval', 'gaussian'],
    params: {
      seed: 81,
      runs: 2000,
      length: 1,
      ensembleKind: 'outcome',
      dist: 'gaussian',
      mu: 10,
      sigma: 0.5,
      spec: [9, 11],
      spec2: [9.5, 10.5],
      level: 0.95,
    },
    view: 'outcome',
    views: ['outcome', 'ensemble'],
    featured: { field: 'sigma' },
    claims: [
      {
        label: 'a two-sigma band holds 95.45 % of the runs',
        path: 'ens.yield.value',
        against: 'closed.insideTwoSigma',
        tol: 0.02,
      },
      {
        label: 'and the count interval covers the closed form',
        path: 'ens.yield.lo',
        atMost: 'closed.insideTwoSigma',
      },
      {
        label: 'a one-sigma band holds 68.27 %',
        path: 'ens.yield2.value',
        against: 'closed.insideOneSigma',
        tol: 0.03,
      },
      {
        label: 'the interval is narrower than the yield it reports is from one',
        path: 'ens.yield.hi',
        atMostValue: 1,
      },
    ],
  },
]
