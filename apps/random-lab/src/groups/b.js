// Group B: expectation and variance.

export const GROUP_B = 'Expectation and variance'

export default [
  {
    id: 'B1',
    group: GROUP_B,
    name: 'Expectation is the balance point',
    terms: ['expectation', 'density', 'estimator', 'interval', 'histogram', 'samplemean', 'gaussian'],
    params: { seed: 11, n: 1000, dist: 'uniform', a: 0, b: 1, bins: 40, lo: 0, hi: 1 },
    view: 'histogram',
    views: ['histogram', 'scope'],
    featured: { field: 'dist' },
    claims: [
      {
        label: 'a uniform on (a, b) has mean (a + b) / 2',
        path: 'dist.mean',
        formula: (p) => (p.a + p.b) / 2,
        tol: 1e-12,
      },
      {
        label: 'the sample mean of a thousand draws lands within its interval',
        path: 'est.mean.value',
        formula: (p) => (p.a + p.b) / 2,
        tol: 0.05,
      },
      {
        label: 'and its interval half width is z sigma over root N',
        path: 'est.mean.se',
        formula: (p) => Math.sqrt((p.b - p.a) ** 2 / 12 / p.n),
        tol: 0.1,
      },
    ],
  },
  {
    id: 'B2',
    group: GROUP_B,
    name: 'Variance is a squared distance',
    terms: ['variance', 'expectation', 'density', 'bin', 'gaussian', 'psd'],
    params: { seed: 11, n: 4000, dist: 'rayleigh', sigma: 1, bins: 40, lo: 0, hi: 4 },
    view: 'histogram',
    views: ['histogram'],
    featured: { field: 'dist' },
    claims: [
      {
        label: 'a Rayleigh has mean sigma root pi over two',
        path: 'dist.mean',
        formula: (p) => p.sigma * Math.sqrt(Math.PI / 2),
        tol: 1e-12,
      },
      {
        label: 'and variance (4 minus pi) over two, times sigma squared',
        path: 'dist.variance',
        formula: (p) => ((4 - Math.PI) / 2) * p.sigma * p.sigma,
        tol: 1e-12,
      },
      {
        label: 'the measured variance agrees within its own interval',
        path: 'est.variance.value',
        formula: (p) => ((4 - Math.PI) / 2) * p.sigma * p.sigma,
        tol: 0.1,
      },
    ],
  },
  {
    id: 'B3',
    group: GROUP_B,
    name: 'The sample variance is not the variance',
    terms: ['variance', 'estimator', 'kurtosis', 'interval', 'samplemean', 'gaussian'],
    params: { seed: 45, n: 20000, dist: 'exponential', lambda: 1, bins: 40, lo: 0, hi: 8 },
    view: 'histogram',
    views: ['histogram'],
    featured: { field: 'dist' },
    claims: [
      {
        label: 'an exponential has kurtosis nine, not three',
        path: 'est.variance.kurtosis',
        formula: () => 9,
        tol: 0.25,
      },
      {
        label: 'so the true estimator variance is far above the Gaussian formula',
        path: 'est.variance.variance',
        atLeastScaled: { path: 'est.variance.gaussianVariance', by: 2.5 },
      },
      {
        label: 'the variance estimate still finds the true variance',
        path: 'est.variance.value',
        formula: (p) => 1 / (p.lambda * p.lambda),
        tol: 0.1,
      },
    ],
  },
]
