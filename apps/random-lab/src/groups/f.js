// Group F: white noise through a filter, and the kT/C pin.
//
// F3 is the second seam with the Electronics Lab. Its O2 solves a netlist to
// reach the same number, and both labs call `capacitorNoise`.

import { BOLTZMANN } from '@ee-labs/random'

export const GROUP_F = 'White noise through a filter'

export default [
  {
    id: 'F1',
    group: GROUP_F,
    name: 'The output density is the magnitude squared times the input',
    terms: ['psd', 'whitenoise', 'noisebandwidth', 'density', 'stationary'],
    params: {
      seed: 500,
      filtered: true,
      fc: 500,
      sampleRate: 48000,
      noiseRms: 1,
      segment: 1024,
      averages: 400,
    },
    view: 'density',
    views: ['density', 'scope'],
    featured: { field: 'fc' },
    claims: [
      {
        label: 'the measured output variance is what the closed form predicts',
        path: 'psd.integral',
        against: 'psd.predictedIntegral',
        tol: 0.02,
      },
      {
        label: 'and the predicted integral is the noise gain the filter states',
        path: 'psd.predictedIntegral',
        formula: (p) => {
          const K = Math.tan((Math.PI * p.fc) / p.sampleRate)
          return (K / (K + 1)) * p.noiseRms * p.noiseRms
        },
        tol: 1e-6,
      },
      {
        label: 'the filter is unity at DC',
        path: 'filt.noiseGain',
        formula: (p) => {
          const K = Math.tan((Math.PI * p.fc) / p.sampleRate)
          return K / (K + 1)
        },
        tol: 1e-12,
      },
    ],
  },
  {
    id: 'F2',
    group: GROUP_F,
    name: 'Noise bandwidth is wider than the corner',
    terms: ['noisebandwidth', 'psd', 'whitenoise'],
    params: { seed: 2000, filtered: true, fc: 2000, sampleRate: 48000, segment: 1024, averages: 100 },
    view: 'density',
    views: ['density'],
    featured: { field: 'fc' },
    claims: [
      {
        label: 'the analogue single pole passes (pi/2) f_c of noise',
        path: 'filt.analogueEnb',
        formula: (p) => (Math.PI / 2) * p.fc,
        tol: 1e-12,
      },
      {
        label: 'this filter passes (f_s/2) K/(K+1), which is less',
        path: 'filt.enb',
        formula: (p) => {
          const K = Math.tan((Math.PI * p.fc) / p.sampleRate)
          return (p.sampleRate / 2) * (K / (K + 1))
        },
        tol: 1e-12,
      },
      {
        label: 'the ratio between them is the guard on quoting the analogue value',
        path: 'filt.enbRatio',
        formula: (p) => {
          const K = Math.tan((Math.PI * p.fc) / p.sampleRate)
          return ((p.sampleRate / 2) * (K / (K + 1))) / ((Math.PI / 2) * p.fc)
        },
        tol: 1e-12,
      },
      { label: 'and it is below one at this corner', path: 'filt.enbRatio', atMostValue: 0.99 },
    ],
  },
  {
    id: 'F3',
    group: GROUP_F,
    name: 'kT over C does not depend on the resistance',
    terms: ['ktc', 'noisebandwidth', 'whitenoise', 'asd', 'density'],
    params: { R: 1e3, C: 1e-9, T: 300, sampleRate: 48000 },
    view: 'ktc',
    views: ['ktc'],
    featured: { field: 'R' },
    claims: [
      {
        label: 'the rms is the root of kT over C',
        path: 'ktc.rms',
        formula: (p) => Math.sqrt((BOLTZMANN * p.T) / p.C),
        tol: 1e-12,
      },
      {
        label: 'the density is the root of 4kTR',
        path: 'ktc.density',
        formula: (p) => Math.sqrt(4 * BOLTZMANN * p.T * p.R),
        tol: 1e-12,
      },
      {
        label: 'the corner is one over two pi RC',
        path: 'ktc.fc',
        formula: (p) => 1 / (2 * Math.PI * p.R * p.C),
        tol: 1e-12,
      },
      {
        label: 'the noise bandwidth is (pi/2) f_c',
        path: 'ktc.enb',
        formula: (p) => (Math.PI / 2) / (2 * Math.PI * p.R * p.C),
        tol: 1e-12,
      },
      {
        label: 'the density times the root of the bandwidth is the same rms',
        path: 'ktc.viaBandwidth',
        against: 'ktc.rms',
        tol: 1e-12,
      },
      {
        label: 'a thousand times the resistance gives the same rms',
        path: 'ktc.sweep.3.rms',
        against: 'ktc.sweep.0.rms',
        tol: 1e-12,
      },
      {
        label: 'because the density rose by the root of a thousand',
        path: 'ktc.sweep.3.density',
        againstScaled: { path: 'ktc.sweep.0.density', by: Math.sqrt(1000) },
        tol: 1e-9,
      },
      {
        label: 'and the bandwidth fell by a thousand',
        path: 'ktc.sweep.3.enb',
        againstScaled: { path: 'ktc.sweep.0.enb', by: 1 / 1000 },
        tol: 1e-9,
      },
    ],
  },
  {
    id: 'F4',
    group: GROUP_F,
    name: 'A filter puts memory into noise',
    terms: ['autocorrelation', 'whitenoise', 'ensemble', 'stationary', 'density'],
    params: {
      seed: 18,
      filtered: true,
      fc: 500,
      sampleRate: 48000,
      segment: 512,
      averages: 512,
      maxLag: 400,
      ensembleKind: 'filtered',
      runs: 200,
      length: 256,
    },
    view: 'correlation',
    views: ['correlation', 'ensemble'],
    featured: { field: 'fc' },
    claims: [
      {
        label: 'the correlation now reaches over the time constant',
        path: 'acf.lagAt1e',
        against: 'acf.tauSamples',
        tol: 0.6,
      },
      {
        label: 'and the runs of the ensemble carry that same memory',
        path: 'ens.sdAt0',
        atLeastValue: 0,
      },
    ],
  },
]
