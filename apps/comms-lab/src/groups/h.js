// Group H: the link budget.
//
// Four experiments that compute a budget and hand the subject on. The System Lab
// owns antenna patterns, interference and the full margin table, and each `why`
// here names it. Every row of the budget is arithmetic on the row above it, so a
// reader who moves the distance watches the margin and the range move with it.

export const GROUP_H = 'The link budget'

export default [
  {
    id: 'H1',
    group: GROUP_H,
    name: 'The noise floor',
    terms: ['noisefigure', 'awgn'],
    params: {
      tempK: 290,
      bandwidth: 1e6,
      noiseFigureDb: 6,
      lnaGainDb: 12,
      lnaNfDb: 1.5,
      mixerGainDb: 10,
      mixerNfDb: 4,
    },
    view: 'budget',
    views: ['budget'],
    featured: { field: 'noiseFigureDb' },
    claims: [
      {
        label: 'kT at 290 K is -173.9752 dBm in every hertz',
        path: 'budget.kT',
        formula: () => -173.9752,
        tol: 1e-6,
      },
      {
        label: 'a megahertz at a noise figure of 6 dB gives -107.975 dBm',
        path: 'budget.noiseFloor',
        formula: (p) => -173.9752 + 10 * Math.log10(p.bandwidth) + p.noiseFigureDb,
        tol: 1e-6,
      },
      {
        label: 'an amplifier in front of a mixer gives a total of 1.784 dB',
        path: 'budget.noiseFigure',
        formula: () => 1.7838,
        tol: 1e-3,
      },
      {
        label: 'and the other order gives 4.071 dB, so the first stage decides',
        path: 'budget.noiseFigureSwapped',
        formula: () => 4.0707,
        tol: 1e-3,
      },
    ],
  },
  {
    id: 'H2',
    group: GROUP_H,
    name: 'Free-space path loss',
    terms: ['pathloss', 'carrier'],
    params: { frequency: 2.4e9, distance: 1000 },
    view: 'budget',
    views: ['budget'],
    featured: { field: 'distance' },
    claims: [
      {
        label: 'the wavelength at 2.4 GHz is 124.91 mm',
        path: 'budget.wavelength',
        formula: (p) => 299792458 / p.frequency,
        tol: 1e-12,
      },
      {
        label: 'the loss at 100 m is 80.052 dB',
        path: 'budget.lossAt.0',
        formula: () => 80.052,
        tol: 1e-4,
      },
      {
        label: 'at a kilometre it is 100.052 dB',
        path: 'budget.lossAt.1',
        formula: () => 100.052,
        tol: 1e-4,
      },
      {
        label: 'and at ten kilometres 120.052 dB',
        path: 'budget.lossAt.2',
        formula: () => 120.052,
        tol: 1e-4,
      },
      {
        label: 'so the curve rises 20 dB for every decade of distance',
        path: 'budget.pathLoss',
        formula: (p) => 20 * Math.log10((4 * Math.PI * p.distance) / (299792458 / p.frequency)),
        tol: 1e-12,
      },
    ],
  },
  {
    id: 'H3',
    group: GROUP_H,
    name: 'The budget to a margin',
    terms: ['margin', 'pathloss', 'ebn0', 'noisefigure'],
    params: {
      txDbm: 20,
      antennaDbi: 2,
      distance: 1000,
      frequency: 2.4e9,
      bandwidth: 1e6,
      bitRate: 2e6,
      noiseFigureDb: 6,
      target: 1e-5,
    },
    view: 'budget',
    views: ['budget'],
    featured: { field: 'distance' },
    claims: [
      {
        label: 'the receiver sees -76.052 dBm at a kilometre',
        path: 'budget.received',
        formula: (p) =>
          p.txDbm + 2 * p.antennaDbi - 20 * Math.log10((4 * Math.PI * p.distance) / (299792458 / p.frequency)),
        tol: 1e-12,
      },
      {
        label: 'which is 31.923 dB above the noise in a megahertz',
        path: 'budget.snr',
        formula: () => 31.9232,
        tol: 1e-3,
      },
      {
        label: 'at 2 Mbit a second that is 28.913 dB of Eb over N0',
        path: 'budget.ebN0',
        formula: () => 28.9129,
        tol: 1e-3,
      },
      {
        label: 'against the 9.588 dB QPSK needs, a margin of 19.325 dB',
        path: 'budget.margin',
        formula: () => 19.325,
        tol: 1e-3,
      },
      {
        label: 'and the range at zero margin is 9252 m',
        path: 'budget.range',
        formula: () => 9252.3,
        tol: 1e-3,
      },
    ],
  },
  {
    id: 'H4',
    group: GROUP_H,
    name: 'What the implementation costs',
    terms: ['margin', 'prefix', 'pilot', 'eye', 'rolloff'],
    params: {
      ofdmN: 64,
      ofdmCp: 16,
      ofdmUsed: 52,
      ofdmPilots: 4,
      beta: 0.35,
      distance: 1000,
      target: 1e-5,
    },
    view: 'budget',
    views: ['budget'],
    featured: { field: 'ofdmCp' },
    claims: [
      {
        label: 'the cyclic prefix costs 0.969 dB',
        path: 'budget.loss.rows.0.db',
        formula: (p) => 10 * Math.log10((p.ofdmN + p.ofdmCp) / p.ofdmN),
        tol: 1e-9,
      },
      {
        label: 'the pilots cost 0.348 dB',
        path: 'budget.loss.rows.1.db',
        formula: (p) => 10 * Math.log10(p.ofdmUsed / (p.ofdmUsed - p.ofdmPilots)),
        tol: 1e-9,
      },
      {
        label: 'a timing error of a twentieth of a symbol costs 1.291 dB',
        path: 'budget.loss.rows.3.db',
        formula: () => 1.291,
        tol: 1e-3,
      },
      {
        label: 'and the four together take 4.193 dB off the margin',
        path: 'budget.implementationTotal',
        formula: () => 4.1926,
        tol: 1e-3,
      },
      {
        label: 'which still leaves margin on this link',
        path: 'budget.margin',
        atLeast: 'budget.implementationTotal',
      },
    ],
  },
]
