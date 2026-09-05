// Group A: analog modulation, on the real chain.
//
// Signal Lab's Nonlinearity group already makes an AM signal and calls its parts
// by name. This group turns those presets into a course, with the index and the
// deviation as knobs, and it needs nothing the suite does not already have.
//
// A claim is one of five kinds, and `experiments.test.js` states which.
//   formula(p)      a closed form of the experiment's own knobs. The strongest.
//   against         another live quantity, so two routes are compared.
//   againstScaled   the same, times a factor, for a claim about a ratio.
//   atMost/atLeast  an ordering rather than a value.
//   atMostValue     a bound, for a residual that should be near zero.

export const GROUP_A = 'Analog modulation'

export default [
  {
    id: 'A1',
    group: GROUP_A,
    name: 'AM and its index',
    terms: ['carrier', 'sideband', 'index'],
    params: { m: 0.5, carrier: 1000, message: 250 },
    view: 'spectrum',
    views: ['spectrum', 'scope'],
    featured: { field: 'm' },
    claims: [
      {
        label: 'each sideband is half the index below the carrier',
        path: 'am.sidebandDb',
        formula: (p) => 20 * Math.log10(p.m / 2),
        tol: 1e-12,
      },
      {
        label: 'and the spectrum on screen reads the same level',
        path: 'am.measuredSidebandDb',
        against: 'am.sidebandDb',
        tol: 0.01,
      },
      {
        label: 'the two sidebands are the same height',
        path: 'am.sidebandSymmetry',
        formula: () => 1,
        tol: 1e-6,
      },
      {
        label: 'they sit at the carrier less the message',
        path: 'am.lowerHz',
        formula: (p) => p.carrier - p.message,
        tol: 1e-12,
      },
      {
        label: 'and at the carrier plus it',
        path: 'am.upperHz',
        formula: (p) => p.carrier + p.message,
        tol: 1e-12,
      },
    ],
  },
  {
    id: 'A2',
    group: GROUP_A,
    name: 'Where the power goes',
    terms: ['carrier', 'sideband', 'index'],
    params: { m: 0.5, carrier: 1000, message: 250 },
    view: 'spectrum',
    views: ['spectrum', 'scope'],
    featured: { field: 'm' },
    claims: [
      {
        label: 'the sidebands carry the index squared over two plus it',
        path: 'am.sidebandPower',
        formula: (p) => (p.m * p.m) / (2 + p.m * p.m),
        tol: 1e-12,
      },
      {
        label: 'which is 11.111 per cent at an index of one half',
        path: 'am.sidebandPower',
        formula: () => 0.11111111111111,
        tol: 1e-9,
      },
      {
        label: 'so most of the power is in a line carrying nothing',
        path: 'am.sidebandPower',
        atMostValue: 0.5,
      },
    ],
  },
  {
    id: 'A3',
    group: GROUP_A,
    name: 'Envelope detection, and where it fails',
    terms: ['envelope', 'index', 'carrier', 'sideband', 'coherent'],
    params: { m: 0.5, carrier: 1000, message: 250 },
    view: 'scope',
    views: ['scope', 'spectrum'],
    featured: { field: 'm' },
    claims: [
      {
        label: 'the recovered message is clean while the index stays under one',
        path: 'am.thdSweep.0',
        atMostValue: 0.05,
      },
      {
        label: 'at an index of one it is still clean',
        path: 'am.thdSweep.1',
        atMostValue: 0.1,
      },
      {
        label: 'above one the envelope folds and the distortion rises',
        path: 'am.thdSweep.2',
        atLeastScaled: { path: 'am.thdSweep.0', by: 3 },
      },
    ],
  },
  {
    id: 'A4',
    group: GROUP_A,
    name: 'Suppressed carrier and the coherent detector',
    terms: ['carrier', 'sideband', 'coherent', 'envelope'],
    params: { m: 0.5, carrier: 1000, message: 250, localPhaseDeg: 30 },
    view: 'spectrum',
    views: ['spectrum', 'scope'],
    featured: { field: 'message' },
    claims: [
      {
        label: 'removing the offset leaves no carrier line',
        path: 'am.dsbCarrierRatio',
        atMostValue: 1e-6,
      },
      {
        label: 'a local phase error of 30 degrees scales the output by its cosine',
        path: 'am.coherentLoss',
        formula: () => Math.cos(Math.PI / 6),
        tol: 0.01,
      },
      {
        label: 'which costs 1.249 dB',
        path: 'am.coherentLossDb',
        formula: () => -20 * Math.log10(Math.cos(Math.PI / 6)),
        tol: 1e-9,
      },
    ],
  },
  {
    id: 'A5',
    group: GROUP_A,
    name: 'One sideband carries the whole message',
    terms: ['sideband', 'carrier'],
    params: { m: 0.5, carrier: 1000, message: 250 },
    view: 'spectrum',
    views: ['spectrum'],
    featured: { field: 'message' },
    claims: [
      {
        label: 'two sidebands occupy twice the message frequency',
        path: 'am.occupiedDsb',
        formula: (p) => 2 * p.message,
        tol: 1e-12,
      },
      {
        label: 'one sideband occupies half of that',
        path: 'am.occupiedSsb',
        againstScaled: { path: 'am.occupiedDsb', by: 0.5 },
        tol: 1e-12,
      },
    ],
  },
  {
    id: 'A6',
    group: GROUP_A,
    name: 'FM and the Bessel lines',
    terms: ['deviation', 'bessel', 'carrier', 'sideband', 'index'],
    params: { deviation: 500, carrier: 1000, message: 250 },
    view: 'spectrum',
    views: ['spectrum', 'scope'],
    featured: { field: 'deviation' },
    claims: [
      {
        label: 'the index is the deviation over the message frequency',
        path: 'fm.beta',
        formula: (p) => p.deviation / p.message,
        tol: 1e-12,
      },
      {
        label: 'the first line reads 0.5767 of the unmodulated carrier',
        path: 'fm.lines.1',
        formula: () => 0.5767248078,
        tol: 1e-6,
      },
      {
        label: 'the second reads 0.3528',
        path: 'fm.lines.2',
        formula: () => 0.3528340286,
        tol: 1e-6,
      },
      {
        label: 'and the spectrum on screen reads the first ratio',
        path: 'fm.measured.0',
        against: 'fm.predicted.0',
        tol: 0.02,
      },
      {
        label: 'and the second',
        path: 'fm.measured.1',
        against: 'fm.predicted.1',
        tol: 0.02,
      },
      {
        label: 'the carrier line vanishes at an index of 2.404826',
        path: 'fm.nullBeta',
        formula: () => 2.4048255577,
        tol: 1e-9,
      },
      {
        label: 'which is a deviation of 601.2 Hz on this message',
        path: 'fm.nullDeviation',
        formula: (p) => 2.4048255577 * p.message,
        tol: 1e-9,
      },
    ],
  },
  {
    id: 'A7',
    group: GROUP_A,
    name: 'What Carson holds, and what FM buys',
    terms: ['carson', 'deviation', 'merit', 'index'],
    params: { deviation: 500, carrier: 1000, message: 250, m: 1 },
    view: 'spectrum',
    views: ['spectrum'],
    featured: { field: 'deviation' },
    claims: [
      {
        label: 'the bandwidth is twice the deviation plus the message',
        path: 'fm.carsonBandwidth',
        formula: (p) => 2 * (p.deviation + p.message),
        tol: 1e-12,
      },
      {
        label: 'and it holds 99.759 per cent of the power rather than all of it',
        path: 'fm.carson',
        formula: () => 0.9975872,
        tol: 1e-5,
      },
      {
        label: 'the merit is one and a half times the index squared',
        path: 'fm.merit',
        formula: (p) => 1.5 * (p.deviation / p.message) ** 2,
        tol: 1e-12,
      },
      {
        label: 'which is 7.782 dB',
        path: 'fm.meritDb',
        formula: () => 10 * Math.log10(6),
        tol: 1e-9,
      },
      {
        label: 'against an amplitude merit of -4.771 dB at an index of one',
        path: 'fm.amMeritDb',
        formula: () => 10 * Math.log10(1 / 3),
        tol: 1e-9,
      },
      {
        label: 'bought with three times the bandwidth',
        path: 'fm.bandwidthRatio',
        formula: () => 3,
        tol: 1e-12,
      },
    ],
  },
]
