// Group A: a random signal, and the density that describes it.
//
// A1 is the seam with the Electronics Lab. Its Group O opens on the same claim
// and imports `@ee-labs/random` rather than building a second generator
// (RANDOM_LAB_PLAN.md Decision 3).
//
// A claim is one of three kinds, and `experiments.test.js` states which.
//   formula(p)  a closed form of the knobs. The strongest kind.
//   against     another live quantity, so two routes are compared.
//   is          a value from a seeded draw, which catches drift and is not a
//               physics claim on its own. Every `is` here sits beside a
//               formula or an against that carries the physics.

import { BOLTZMANN } from '@ee-labs/random'

export const GROUP_A = 'A random signal, and the density that describes it'

export default [
  {
    id: 'A1',
    group: GROUP_A,
    name: 'A random signal has a density',
    terms: ['whitenoise', 'psd', 'asd', 'periodogram', 'estimator', 'density', 'bin', 'variance'],
    params: { seed: 31, averages: 100, sweepM: [1, 100], noiseRms: 1e-3, sampleRate: 48000 },
    view: 'density',
    views: ['density', 'scope'],
    featured: { field: 'averages' },
    claims: [
      {
        label: 'the density the generator was given',
        path: 'psd.inputDensity',
        formula: (p) => p.noiseRms / Math.sqrt(p.sampleRate / 2),
        tol: 1e-12,
      },
      {
        label: 'the measured floor reads that density',
        path: 'psd.interiorDensity',
        against: 'psd.inputDensity',
        tol: 0.02,
      },
      {
        label: 'one frame spreads as much as its own mean',
        path: 'psd.sweep.0.flatness',
        against: 'psd.sweep.0.relativeSe',
        tol: 0.2,
      },
      {
        label: 'a hundred averages narrow it to a tenth',
        path: 'psd.sweep.1.flatness',
        against: 'psd.sweep.1.relativeSe',
        tol: 0.25,
      },
      {
        label: 'the integral of the density returns the rms',
        path: 'psd.rmsFromIntegral',
        against: 'psd.inputRms',
        tol: 0.01,
      },
    ],
  },
  {
    id: 'A2',
    group: GROUP_A,
    name: 'A random variable is a seeded source',
    terms: ['seed', 'realisation', 'estimator', 'samplemean'],
    params: { seed: 1, n: 1000, dist: 'gaussian', mu: 0, sigma: 1 },
    view: 'scope',
    views: ['scope', 'histogram'],
    featured: { field: 'seed' },
    claims: [
      {
        label: 'the sample mean sits inside its own interval of the truth',
        path: 'est.mean.value',
        formula: (p) => p.mu,
        tol: 0.1,
      },
      {
        label: 'the interval half width is z sigma over root N',
        path: 'est.mean.se',
        formula: (p) => p.sigma / Math.sqrt(p.n),
        tol: 0.1,
      },
      {
        // The run view's pane measures the series the run view draws, which is
        // the point of the pane: A2's try line says to read the interval on
        // the mean, and until now there was no readout on that view at all.
        label: 'the run view measures the samples it draws',
        path: 'scope.mean',
        against: 'est.mean.value',
        tol: 1e-12,
      },
    ],
  },
  {
    id: 'A3',
    group: GROUP_A,
    name: 'The histogram approaches the density',
    terms: ['density', 'histogram', 'bin', 'estimator', 'ber'],
    params: {
      seed: 1,
      n: 1000,
      dist: 'gaussian',
      bins: 40,
      lo: -4,
      hi: 4,
      sweepN: [100, 1000, 10000, 100000],
      histRepeats: 20,
    },
    view: 'histogram',
    views: ['histogram', 'scope'],
    featured: { field: 'n' },
    claims: [
      {
        label: 'the gap at N = 100 is what the binomial predicts',
        path: 'hist.sweep.0.rms',
        against: 'hist.sweep.0.predicted',
        tol: 0.15,
      },
      {
        label: 'and at N = 1000',
        path: 'hist.sweep.1.rms',
        against: 'hist.sweep.1.predicted',
        tol: 0.15,
      },
      {
        label: 'and at N = 10000',
        path: 'hist.sweep.2.rms',
        against: 'hist.sweep.2.predicted',
        tol: 0.15,
      },
      {
        label: 'and at N = 100000',
        path: 'hist.sweep.3.rms',
        against: 'hist.sweep.3.predicted',
        tol: 0.15,
      },
      {
        label: 'a hundredfold N divides the gap by ten',
        path: 'hist.sweep.0.rms',
        againstScaled: { path: 'hist.sweep.2.rms', by: 10 },
        tol: 0.2,
      },
    ],
  },
  {
    id: 'A4',
    group: GROUP_A,
    name: 'Every bar carries an interval',
    terms: ['histogram', 'bin', 'interval', 'level', 'density'],
    params: { seed: 7, n: 10000, dist: 'gaussian', bins: 40, lo: -4, hi: 4, level: 0.95 },
    view: 'histogram',
    views: ['histogram'],
    featured: { field: 'n' },
    claims: [
      {
        label: 'the centre bar reads the density there',
        path: 'hist.bin.20.density',
        against: 'hist.bin.20.truth',
        tol: 0.1,
      },
      {
        label: "the bar's interval brackets its own estimate",
        path: 'hist.bin.20.lo',
        atMost: 'hist.bin.20.density',
      },
      {
        label: 'and the interval reaches above it',
        path: 'hist.bin.20.hi',
        atLeast: 'hist.bin.20.density',
      },
      {
        label: 'the bin width is the range over the count',
        path: 'hist.width',
        formula: (p) => (p.hi - p.lo) / p.bins,
        tol: 1e-12,
      },
      {
        label: 'nothing fell outside four sigma that should not have',
        path: 'hist.outside',
        atMostValue: 10,
      },
    ],
  },
]

// Re-exported so a lesson can name Boltzmann's constant without importing the
// engine itself. Group F is the only user.
export { BOLTZMANN }
