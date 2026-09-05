// Group E: the periodogram and its averages.

export const GROUP_E = 'The periodogram and its averages'

const SPECTRAL = {
  seed: 31,
  sampleRate: 48000,
  noiseRms: 1e-3,
  segment: 512,
  averages: 400,
  window: 'hann',
  sweepM: [1, 4, 25, 100, 400],
}

export default [
  {
    id: 'E1',
    group: GROUP_E,
    name: 'One frame is spray, not a defect',
    terms: ['periodogram', 'psd', 'dof', 'chisquare', 'bin', 'gaussian', 'whitenoise'],
    params: { ...SPECTRAL, averages: 1, sweepM: [1] },
    view: 'density',
    views: ['density', 'scope'],
    featured: { field: 'averages' },
    claims: [
      {
        label: 'one frame has two degrees of freedom',
        path: 'psd.dof',
        formula: () => 2,
        tol: 1e-12,
      },
      {
        label: 'so each bin spreads as much as its own mean',
        path: 'psd.flatness',
        against: 'psd.relativeSe',
        tol: 0.2,
      },
      {
        label: 'and the predicted spread is the root of two over the degrees of freedom',
        path: 'psd.relativeSe',
        formula: () => 1,
        tol: 1e-12,
      },
    ],
  },
  {
    id: 'E2',
    group: GROUP_E,
    name: 'Averaging narrows it as one over root M',
    terms: ['periodogram', 'psd', 'estimator', 'dof', 'bin'],
    params: SPECTRAL,
    view: 'density',
    views: ['density'],
    featured: { field: 'averages' },
    claims: [
      { label: 'at 4 averages', path: 'psd.sweep.1.flatness', against: 'psd.sweep.1.relativeSe', tol: 0.25 },
      { label: 'at 25 averages', path: 'psd.sweep.2.flatness', against: 'psd.sweep.2.relativeSe', tol: 0.25 },
      { label: 'at 100 averages', path: 'psd.sweep.3.flatness', against: 'psd.sweep.3.relativeSe', tol: 0.25 },
      { label: 'at 400 averages', path: 'psd.sweep.4.flatness', against: 'psd.sweep.4.relativeSe', tol: 0.25 },
      {
        label: 'and sixteen times the averages narrow it fourfold',
        path: 'psd.sweep.2.flatness',
        againstScaled: { path: 'psd.sweep.4.flatness', by: 4 },
        tol: 0.35,
      },
    ],
  },
  {
    id: 'E3',
    group: GROUP_E,
    name: 'The interval on a density is a chi-square interval',
    terms: ['chisquare', 'dof', 'interval', 'level', 'psd', 'density', 'bin'],
    params: { ...SPECTRAL, averages: 100, sweepM: [100], level: 0.95 },
    view: 'density',
    views: ['density'],
    featured: { field: 'level' },
    claims: [
      {
        label: 'a hundred averages give two hundred degrees of freedom',
        path: 'psd.dof',
        formula: (p) => 2 * p.averages,
        tol: 1e-12,
      },
      {
        label: 'the lower multiplier is 0.8297',
        path: 'psd.ci.lo',
        formula: () => 0.8296757,
        tol: 1e-5,
      },
      {
        label: 'and the upper is 1.2290',
        path: 'psd.ci.hi',
        formula: () => 1.2290385,
        tol: 1e-5,
      },
      {
        label: 'the interval is wider above than below, as a chi-square is skewed',
        path: 'psd.ci.hi',
        atLeastValue: 1,
      },
    ],
  },
  {
    id: 'E4',
    group: GROUP_E,
    name: 'The integral of the density is the variance',
    terms: ['psd', 'variance', 'bin', 'asd', 'density', 'dof'],
    params: { ...SPECTRAL, averages: 100, sweepM: [100] },
    view: 'density',
    views: ['density', 'scope'],
    featured: { field: 'segment' },
    claims: [
      {
        label: 'the area under the curve returns the rms that went in',
        path: 'psd.rmsFromIntegral',
        against: 'psd.inputRms',
        tol: 0.01,
      },
      {
        label: 'the bin width is the rate over the segment length',
        path: 'psd.df',
        formula: (p) => p.sampleRate / p.segment,
        tol: 1e-12,
      },
      {
        label: 'and the two end bins sit at half the flat level',
        path: 'psd.endRatio',
        formula: () => 0.5,
        tol: 0.25,
      },
    ],
  },
]
