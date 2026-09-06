// Group F: OFDM.
//
// The claim this group rests on is exactness. A cyclic prefix turns the
// channel's linear convolution into a circular one, so the transform
// diagonalises the channel and one complex division a subcarrier recovers the
// symbol. F3 measures both sides of that boundary.

export const GROUP_F = 'OFDM'

export default [
  {
    id: 'F1',
    group: GROUP_F,
    name: 'Subcarriers overlap and stay orthogonal',
    terms: ['ofdm', 'subcarrier', 'carrier'],
    params: { ofdmN: 64, ofdmCp: 16, sampleRate: 8000 },
    view: 'subcarriers',
    views: ['subcarriers'],
    featured: { field: 'ofdmN' },
    claims: [
      {
        label: 'the spacing is the sample rate over the transform length',
        path: 'ofdm.spacing',
        formula: (p) => p.sampleRate / p.ofdmN,
        tol: 1e-12,
      },
      {
        label: 'which is 125 Hz at 64 subcarriers on an 8 kHz grid',
        path: 'ofdm.spacing',
        formula: () => 125,
        tol: 1e-12,
      },
      {
        label: 'two subcarriers on that grid correlate to nothing over one symbol',
        path: 'ofdm.correlationOnGrid',
        atMostValue: 1e-12,
      },
      {
        label: 'and two spaced 5 Hz off the grid do not',
        path: 'ofdm.correlationOffGrid',
        atLeastValue: 0.01,
      },
    ],
  },
  {
    id: 'F2',
    group: GROUP_F,
    name: 'The inverse transform is the modulator',
    terms: ['ofdm', 'subcarrier', 'papr'],
    params: { ofdmN: 64, ofdmCp: 16, channelTaps: 1, seed: 1 },
    view: 'subcarriers',
    views: ['subcarriers'],
    featured: { field: 'ofdmN' },
    claims: [
      {
        label: 'through a one-tap channel every symbol comes back to floating point',
        path: 'ofdm.exact.1',
        atMostValue: 1e-12,
      },
      {
        label: 'the useful symbol is the transform length over the sample rate',
        path: 'ofdm.usefulMs',
        formula: (p) => (p.ofdmN / p.sampleRate) * 1000,
        tol: 1e-12,
      },
      {
        label: 'which is 8.00 ms here',
        path: 'ofdm.usefulMs',
        formula: () => 8,
        tol: 1e-12,
      },
      {
        label: 'and one symbol of 64 subcarriers can peak 18.062 dB above its mean',
        path: 'ofdm.worstPaprDb',
        formula: (p) => 10 * Math.log10(p.ofdmN),
        tol: 1e-12,
      },
    ],
  },
  {
    id: 'F3',
    group: GROUP_F,
    name: 'The cyclic prefix makes convolution circular',
    terms: ['prefix', 'ofdm', 'multipath', 'isi'],
    params: { ofdmN: 64, ofdmCp: 16, channelTaps: 5, seed: 1 },
    view: 'subcarriers',
    views: ['subcarriers', 'channel'],
    featured: { field: 'ofdmCp' },
    claims: [
      {
        label: 'a four-tap channel leaves nothing but floating point behind',
        path: 'ofdm.exact.4',
        atMostValue: 1e-12,
      },
      {
        label: 'and a five-tap one is the same',
        path: 'ofdm.exact.5',
        atMostValue: 1e-12,
      },
      {
        label: 'a channel of the prefix plus one tap is still exact',
        path: 'ofdm.exact.17',
        atMostValue: 1e-12,
      },
      {
        label: 'one tap further and the error is not floating point',
        path: 'ofdm.exact.18',
        atLeastValue: 1e-4,
      },
    ],
  },
  {
    id: 'F4',
    group: GROUP_F,
    name: 'One divide a subcarrier',
    terms: ['subcarrier', 'pilot', 'equaliser', 'ofdm', 'carrier'],
    params: { ofdmN: 64, ofdmCp: 16, ofdmUsed: 52, ofdmPilots: 4, channelTaps: 5, seed: 1 },
    view: 'subcarriers',
    views: ['subcarriers', 'channel'],
    featured: { field: 'ofdmPilots' },
    claims: [
      {
        label: 'the channel is read at each subcarrier and divided out',
        path: 'ofdm.run.worst',
        atMostValue: 1e-12,
      },
      {
        label: 'the pilots cost the rate of the subcarriers they use',
        path: 'ofdm.pilotCostDb',
        formula: (p) => 10 * Math.log10(p.ofdmUsed / (p.ofdmUsed - p.ofdmPilots)),
        tol: 1e-12,
      },
      {
        label: 'which is 0.348 dB for four pilots in 52',
        path: 'ofdm.pilotCostDb',
        formula: () => 0.34762,
        tol: 1e-4,
      },
      {
        label: 'and 48 subcarriers are left to carry data',
        path: 'ofdm.dataCarriers',
        formula: (p) => p.ofdmUsed - p.ofdmPilots,
        tol: 0,
      },
    ],
  },
  {
    id: 'F5',
    group: GROUP_F,
    name: 'The peak-to-average ratio',
    terms: ['papr', 'ofdm', 'subcarrier', 'nyquistpulse'],
    params: { ofdmN: 64, ofdmCp: 16, seed: 1 },
    view: 'subcarriers',
    views: ['subcarriers'],
    featured: { field: 'ofdmN' },
    claims: [
      {
        label: 'the worst case is the number of subcarriers, which is 18.062 dB',
        path: 'ofdm.worstPaprDb',
        formula: () => 18.0618,
        tol: 1e-4,
      },
      {
        label: 'one symbol in 345 exceeds 10 dB',
        path: 'ofdm.paprCcdf.0',
        formula: () => 2.90141e-3,
        tol: 1e-4,
      },
      {
        label: 'and one in 119 000 exceeds 12 dB',
        path: 'ofdm.paprCcdf.1',
        formula: () => 8.37671e-6,
        tol: 1e-4,
      },
      {
        label: 'so the level exceeded once in ten thousand symbols is 11.261 dB',
        path: 'ofdm.paprLevel',
        formula: () => 11.2612,
        tol: 1e-4,
      },
      {
        label: 'and a drawn symbol stays under the worst case',
        path: 'ofdm.papr',
        atMost: 'ofdm.worstPaprDb',
      },
    ],
  },
  {
    id: 'F6',
    group: GROUP_F,
    name: 'What the prefix costs',
    terms: ['prefix', 'pilot', 'ofdm', 'subcarrier'],
    params: { ofdmN: 64, ofdmCp: 16, ofdmUsed: 52, ofdmPilots: 4, ofdmBits: 4 },
    view: 'subcarriers',
    views: ['subcarriers'],
    featured: { field: 'ofdmCp' },
    claims: [
      {
        label: 'the prefix is a fifth of every symbol',
        path: 'ofdm.prefixFraction',
        formula: (p) => p.ofdmCp / (p.ofdmN + p.ofdmCp),
        tol: 1e-12,
      },
      {
        label: 'which is 0.969 dB of rate',
        path: 'ofdm.prefixCostDb',
        formula: (p) => 10 * Math.log10((p.ofdmN + p.ofdmCp) / p.ofdmN),
        tol: 1e-12,
      },
      {
        label: 'the symbol rate is a hundred a second',
        path: 'ofdm.symbolRate',
        formula: (p) => 1000 / (((p.ofdmN + p.ofdmCp) / p.sampleRate) * 1000),
        tol: 1e-12,
      },
      {
        label: 'the occupied bandwidth is the used subcarriers times the spacing',
        path: 'ofdm.occupied',
        formula: (p) => (p.ofdmUsed * p.sampleRate) / p.ofdmN,
        tol: 1e-12,
      },
      {
        label: 'and the uncoded rate is 19 200 bit a second',
        path: 'ofdm.bitRate',
        formula: () => 19200,
        tol: 1e-9,
      },
    ],
  },
]
