// Group C: the pulse, and the interference a bad one leaves.
//
// The eye canvas arrives here. Everything in this group is a property of one
// kernel, so every number is a function of the roll-off and the span, and the
// two guards the plan names sit at the end of it.

export const GROUP_C = 'The pulse and intersymbol interference'

export default [
  {
    id: 'C1',
    group: GROUP_C,
    name: 'A rectangular pulse has infinite bandwidth',
    terms: ['isi', 'rolloff', 'symbol'],
    params: { shape: 'rect', beta: 0, span: 12, symbols: 256, seed: 1 },
    view: 'pulse',
    views: ['pulse', 'iq'],
    featured: { field: 'beta' },
    claims: [
      {
        label: 'a rectangle is one symbol wide, which is eight samples here',
        path: 'pulse.taps.length',
        formula: (p) => p.sps,
        tol: 0,
      },
      {
        label: 'its kernel carries unit energy, like every other shaper here',
        path: 'pulse.isi.lags',
        atLeastValue: 0,
      },
      {
        label: 'the raised cosine at this roll-off is 1 at its own instant',
        path: 'pulse.samples.0',
        formula: () => 1,
        tol: 1e-15,
      },
      {
        label: 'and nothing at the next one, which is what makes it usable',
        path: 'pulse.samples.1',
        formula: () => 0,
        tol: 1e-15,
        absolute: true,
      },
    ],
  },
  {
    id: 'C2',
    group: GROUP_C,
    name: "Nyquist's criterion",
    terms: ['nyquistpulse', 'isi', 'rolloff'],
    params: { shape: 'rc', beta: 0.35, span: 24, symbols: 256, seed: 1 },
    view: 'pulse',
    views: ['pulse', 'eye'],
    featured: { field: 'beta' },
    claims: [
      {
        label: 'the pulse is 1 at its own symbol instant',
        path: 'pulse.samples.0',
        formula: () => 1,
        tol: 1e-15,
      },
      {
        label: 'and below a millionth of a millionth at the next',
        path: 'pulse.samples.1',
        formula: () => 0,
        tol: 1e-15,
        absolute: true,
      },
      {
        label: 'and at the second',
        path: 'pulse.samples.2',
        formula: () => 0,
        tol: 1e-15,
        absolute: true,
      },
      {
        label: 'and at the third',
        path: 'pulse.samples.3',
        formula: () => 0,
        tol: 1e-15,
        absolute: true,
      },
      {
        label: 'and at the fourth',
        path: 'pulse.samples.4',
        formula: () => 0,
        tol: 1e-15,
        absolute: true,
      },
    ],
  },
  {
    id: 'C3',
    group: GROUP_C,
    name: 'The roll-off buys bandwidth with time',
    terms: ['rolloff', 'nyquistpulse', 'papr'],
    params: { shape: 'rc', beta: 0.35, span: 24, symbolRate: 1000, symbols: 256 },
    view: 'pulse',
    views: ['pulse', 'eye'],
    featured: { field: 'beta' },
    claims: [
      {
        label: 'the bandwidth is one plus the roll-off, times half the symbol rate',
        path: 'pulse.bandwidth',
        formula: (p) => ((1 + p.beta) * p.symbolRate) / 2,
        tol: 1e-12,
      },
      {
        label: 'which is 675 Hz at a roll-off of 0.35',
        path: 'pulse.bandwidth',
        formula: () => 675,
        tol: 1e-12,
      },
      {
        label: 'the passband takes twice that',
        path: 'pulse.passband',
        againstScaled: { path: 'pulse.bandwidth', by: 2 },
        tol: 1e-12,
      },
      {
        label: 'a random stream peaks at 1.7270 of one symbol, which is 4.746 dB',
        path: 'pulse.peak',
        formula: () => 1.727,
        tol: 1e-3,
      },
      {
        label: 'and that peak in decibels',
        path: 'pulse.peakDb',
        formula: () => 4.746,
        tol: 1e-3,
      },
    ],
  },
  {
    id: 'C4',
    group: GROUP_C,
    name: 'The eye diagram',
    terms: ['eye', 'isi', 'nyquistpulse', 'rolloff', 'margin'],
    params: { shape: 'rrc', beta: 0.35, span: 12, timingError: 0, symbols: 256, seed: 1 },
    view: 'eye',
    views: ['eye', 'pulse'],
    featured: { field: 'beta' },
    claims: [
      {
        label: 'the eye is fully open at the decision instant',
        path: 'eye.openingClean',
        formula: () => 1,
        tol: 1e-6,
      },
      {
        label: 'and it is open at every roll-off, because the pulse is a Nyquist pulse',
        path: 'eye.opening',
        against: 'eye.openingClean',
        tol: 1e-9,
      },
      {
        label: 'the shaping leaves under a ten thousandth of interference at this span',
        path: 'pulse.isi.near',
        atMostValue: 1e-4,
      },
    ],
  },
  {
    id: 'C5',
    group: GROUP_C,
    name: 'A timing error closes the eye',
    terms: ['eye', 'isi', 'rolloff', 'margin'],
    params: { shape: 'rrc', beta: 0.35, span: 12, timingError: 0.05, symbols: 256, seed: 1 },
    view: 'eye',
    views: ['eye', 'pulse'],
    featured: { field: 'timingError' },
    claims: [
      {
        label: 'a twentieth of a symbol leaves 0.8619 of the opening',
        path: 'eye.openingAt.0',
        formula: () => 0.86193,
        tol: 1e-4,
      },
      {
        label: 'a tenth leaves 0.7166',
        path: 'eye.openingAt.1',
        formula: () => 0.7166,
        tol: 1e-4,
      },
      {
        label: 'a fifth leaves 0.4108',
        path: 'eye.openingAt.2',
        formula: () => 0.41079,
        tol: 1e-4,
      },
      {
        label: 'so a twentieth of a symbol costs 1.291 dB',
        path: 'eye.timingLossDb',
        formula: () => 1.291,
        tol: 1e-3,
      },
    ],
  },
  {
    id: 'C6',
    group: GROUP_C,
    name: 'The root raised cosine, split between the ends',
    terms: ['rrc', 'matchedfilter', 'isi', 'nyquistpulse'],
    params: { shape: 'rrc', beta: 0.35, span: 12, symbols: 256, seed: 1 },
    view: 'eye',
    views: ['eye', 'pulse'],
    featured: { field: 'span' },
    claims: [
      {
        label: 'at a span of 12 the nearest neighbours leave 7.44 in a hundred thousand',
        path: 'pulse.isi.near',
        formula: () => 7.442e-5,
        tol: 1e-2,
      },
      {
        label: 'the truncation edge leaves more than that, and the pane names which is which',
        path: 'pulse.isi.peak',
        atLeastScaled: { path: 'pulse.isi.near', by: 10 },
      },
      {
        label: 'and the total over every lag is larger again',
        path: 'pulse.isi.sum',
        atLeast: 'pulse.isi.peak',
      },
      {
        label: 'the guard is off at this span',
        path: 'pulse.isi.lags',
        atLeastValue: 6,
      },
    ],
  },
]
