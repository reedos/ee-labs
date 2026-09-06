// Group H: detection.
//
// The mismatch loss and the error rate are functions of the pulse and of
// Eb/N0, so they are computed here from those knobs rather than quoted from a
// table. `secondRoute.js` reaches both without calling the engine's own
// route to them.
import { PULSES, energy } from '@ee-labs/random'
import { gaussianTail, mismatchFraction } from '../secondRoute.js'

export const GROUP_H = 'Detection'

export default [
  {
    id: 'H1',
    group: GROUP_H,
    name: 'The matched filter is the best linear detector',
    terms: ['matchedfilter', 'snr', 'whitenoise', 'variance', 'gaussian'],
    params: {
      seed: 1,
      pulse: 'halfSine',
      pulseLength: 64,
      noiseVariance: 0.01,
      sampleRate: 1e6,
    },
    view: 'matched',
    views: ['matched', 'scope'],
    featured: { field: 'pulse' },
    claims: [
      {
        label: 'the peak lands where the pulse starts',
        path: 'snr.peakAt',
        against: 'snr.pulseAt',
        tol: 1e-12,
      },
      {
        label: 'and its height is the pulse energy, which these pulses normalise to one',
        path: 'snr.peak',
        formula: (p) => energy(PULSES[p.pulse](p.pulseLength)),
        tol: 1e-9,
      },
      {
        label: 'a rectangular filter on this pulse falls short',
        path: 'snr.mismatch',
        atMost: 'snr.snr',
      },
      {
        label: 'by the decibels the squared correlation between the two shapes costs',
        path: 'snr.mismatchLossDb',
        formula: (p) =>
          -10 *
          Math.log10(mismatchFraction(PULSES[p.pulse](p.pulseLength), PULSES.rect(p.pulseLength))),
        tol: 1e-9,
      },
    ],
  },
  {
    id: 'H2',
    group: GROUP_H,
    name: 'The ratio is two E over N zero',
    terms: ['matchedfilter', 'snr', 'ebn0', 'density', 'variance'],
    params: {
      seed: 1,
      pulse: 'halfSine',
      pulseLength: 64,
      noiseVariance: 0.01,
      sampleRate: 1e6,
    },
    view: 'matched',
    views: ['matched'],
    featured: { field: 'noiseVariance' },
    claims: [
      {
        label: 'the output ratio is the energy over the noise variance',
        path: 'snr.snr',
        formula: (p) => 1 / p.noiseVariance,
        tol: 1e-9,
      },
      {
        label: 'and 2E/N0 reaches the same number by the other route',
        path: 'snr.twoEOverN0',
        against: 'snr.snr',
        tol: 1e-9,
      },
      {
        label: 'a rectangular pulse of the same energy does as well',
        path: 'snr.shape.0',
        against: 'snr.snr',
        tol: 1e-9,
      },
      {
        label: 'and so does a ramp',
        path: 'snr.shape.2',
        against: 'snr.snr',
        tol: 1e-9,
      },
      {
        label: 'in decibels that is 20 dB',
        path: 'snr.snrDb',
        formula: (p) => 10 * Math.log10(1 / p.noiseVariance),
        tol: 1e-9,
      },
    ],
  },
  {
    id: 'H3',
    group: GROUP_H,
    name: 'The error rate is a Q, and the count agrees',
    terms: ['ber', 'qfunction', 'ebn0', 'interval', 'montecarlo', 'gaussian'],
    params: {
      seed: 51,
      pulse: 'rect',
      pulseLength: 32,
      ebN0Db: 7,
      symbols: 200000,
      level: 0.95,
      sampleRate: 1e6,
    },
    view: 'errorrate',
    views: ['errorrate', 'matched'],
    featured: { field: 'ebN0Db' },
    claims: [
      {
        label: 'the closed form is the Gaussian tail at root two Eb over N zero',
        path: 'ber.predicted',
        formula: (p) => gaussianTail(Math.sqrt(2 * 10 ** (p.ebN0Db / 10))),
        tol: 1e-8,
      },
      {
        label: 'the counted rate agrees within its own interval',
        path: 'ber.lo',
        atMost: 'ber.predicted',
      },
      {
        label: 'and the interval reaches above the closed form too',
        path: 'ber.hi',
        atLeast: 'ber.predicted',
      },
      {
        label: 'on-off keying is three decibels worse at every point',
        path: 'ber.gapDb',
        formula: () => 10 * Math.log10(2),
        tol: 1e-12,
      },
      {
        label: 'and its rate here is the antipodal rate at 3 dB less',
        path: 'ber.orthogonal',
        atLeast: 'ber.predicted',
      },
    ],
  },
]
