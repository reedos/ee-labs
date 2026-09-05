// Group D: autocorrelation, the density, and ergodicity.

export const GROUP_D = 'Autocorrelation, the density, and ergodicity'

export default [
  {
    id: 'D1',
    group: GROUP_D,
    name: 'Correlation is a signal against itself',
    terms: ['autocorrelation', 'whitenoise', 'stationary', 'density', 'psd'],
    params: {
      seed: 18,
      filtered: true,
      fc: 500,
      sampleRate: 48000,
      segment: 512,
      averages: 512,
      maxLag: 400,
    },
    view: 'correlation',
    views: ['correlation', 'scope'],
    featured: { field: 'fc' },
    claims: [
      {
        label: 'the correlation is one at zero lag, by construction',
        path: 'acf.normalised.0',
        formula: () => 1,
        tol: 1e-12,
      },
      {
        label: 'and it falls to 1/e over the filter time constant',
        path: 'acf.lagAt1e',
        against: 'acf.tauSamples',
        tol: 0.6,
      },
      {
        label: 'the time constant is one over two pi f_c, in samples',
        path: 'acf.tauSamples',
        formula: (p) => p.sampleRate / (2 * Math.PI * p.fc),
        tol: 1e-12,
      },
    ],
  },
  {
    id: 'D2',
    group: GROUP_D,
    name: 'The density and the correlation are one object',
    terms: ['autocorrelation', 'psd', 'wienerkhinchin', 'periodogram', 'density'],
    params: { seed: 17, sampleRate: 8000, noiseRms: 1, wkN: 4096, filtered: false },
    view: 'correlation',
    views: ['correlation', 'density'],
    featured: { field: 'wkN' },
    claims: [
      {
        label: 'the two routes to the density agree to floating point',
        path: 'wk.worst',
        atMostValue: 1e-9,
      },
    ],
  },
  {
    id: 'D3',
    group: GROUP_D,
    name: 'The zero lag is the variance',
    terms: ['autocorrelation', 'variance', 'psd', 'density'],
    params: { seed: 17, sampleRate: 8000, noiseRms: 1, wkN: 4096 },
    view: 'correlation',
    views: ['correlation', 'density'],
    featured: { field: 'noiseRms' },
    claims: [
      {
        label: 'the zero lag is the mean square of the record',
        path: 'wk.r0',
        formula: (p) => p.noiseRms * p.noiseRms,
        tol: 0.05,
      },
      {
        label: 'and it is the integral of the density, once the end panels are counted',
        path: 'wk.integralWithEnds',
        against: 'wk.r0',
        tol: 1e-9,
      },
    ],
  },
  {
    id: 'D4',
    group: GROUP_D,
    name: 'A time average is not an ensemble average',
    terms: ['ergodic', 'stationary', 'ensemble', 'realisation'],
    params: {
      seed: 21,
      runs: 800,
      length: 64,
      dist: 'gaussian',
      mu: 0,
      sigma: 1,
      sweepLengths: [64, 1024],
      ensembleKind: 'gaussian',
    },
    view: 'ensemble',
    views: ['ensemble', 'outcome'],
    featured: { field: 'length' },
    claims: [
      {
        label: 'a stationary process averages towards its mean as one over root length',
        path: 'erg.0.stationary',
        against: 'erg.0.predicted',
        tol: 0.12,
      },
      {
        label: 'and sixteen times the length narrows it fourfold',
        path: 'erg.1.stationary',
        against: 'erg.1.predicted',
        tol: 0.12,
      },
      {
        label: 'a value drawn once per run does not average at all',
        path: 'erg.0.constant',
        formula: (p) => p.sigma,
        tol: 0.06,
      },
      {
        label: 'and a sixteenfold longer run leaves it unchanged',
        path: 'erg.1.constant',
        against: 'erg.0.constant',
        tol: 1e-9,
      },
      {
        label: 'the time average and the ensemble average agree for the ergodic one',
        path: 'ens.spread',
        against: 'erg.0.stationary',
        tol: 1e-9,
      },
    ],
  },
]
