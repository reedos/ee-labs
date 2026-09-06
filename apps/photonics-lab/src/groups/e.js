// Group E: the fibre.
//
// Five experiments and two limits. A fibre loses power in proportion to its
// length and it spreads a pulse in proportion to its length, and every link
// ever built is stopped by one of the two. The last experiment puts both on one
// pane and says which one binds.
//
// Attenuation is stated in decibels a kilometre and dispersion in picoseconds
// per nanometre per kilometre, because those are the units a fibre is sold in.
// `math.js` converts each in one place.

import { Alpha, Dbm, Dispersion, Index, Lambda, Loss, OptPower, Radius, Rate, Span, Width } from '../knobs.js'

export const GROUP = 'E · The fibre'

const ALPHA = Alpha('alphaDb', 'Attenuation', 0.2, 'Standard fibre is 0.20 dB/km at 1550 nm')
const LENGTH = Span('length', 'Fibre length', 80e3, 'End to end')
const D = Dispersion('D', 'Dispersion parameter', 17, 'Standard fibre is 17 at 1550 nm')
const WIDTH = Width('dLambda', 'Source spectral width', 1e-9, 'How many colours the transmitter sends')

export const E = [
  {
    id: 'e1',
    group: GROUP,
    kind: 'fibre',
    name: 'Attenuation, and the three windows',
    terms: ['attenuation', 'decibel', 'dbm', 'window'],
    params: [ALPHA, LENGTH, OptPower('power', 'Power in', 1e-3, 'What the transmitter launches'), Lambda('lambda', 'Wavelength', 1550e-9, 'The window the attenuation belongs to')],
    view: 'curve',
    views: ['curve', 'numbers'],
    headline: (x) => ({ value: x.att.db, unit: 'dB', label: 'Loss over the span' }),
    curve: (x, p) => ({
      x: { from: 0, to: Math.max(1e3, 2 * p.length), label: 'Distance along the fibre', unit: 'm' },
      series: [{ read: (l) => x.at({ length: l }).att.outDbm, label: 'Power', unit: 'dBm', plain: true }],
      marks: [{ at: p.length, label: 'far end' }],
      yLabel: 'Optical power',
      yUnit: 'dBm',
      yPlain: true,
    }),
  },
  {
    id: 'e2',
    group: GROUP,
    kind: 'fibre',
    name: 'Dispersion spreads a pulse',
    terms: ['dispersion', 'spectralwidth', 'beta2'],
    params: [WIDTH, LENGTH, D, Lambda('lambda', 'Wavelength', 1550e-9, 'Where the dispersion parameter was measured')],
    view: 'pulse',
    views: ['pulse', 'curve', 'numbers'],
    headline: (x) => ({ value: x.disp.spread, unit: 's', label: 'Pulse spread at the far end' }),
    curve: (x, p) => ({
      x: { from: 0, to: Math.max(1e3, 2 * p.length), label: 'Distance along the fibre', unit: 'm' },
      series: [{ read: (l) => x.at({ length: l }).disp.spread, label: 'Pulse spread', unit: 's' }],
      marks: [{ at: p.length, label: 'far end' }],
      yLabel: 'Pulse spread',
      yUnit: 's',
      yFromZero: true,
    }),
  },
  {
    id: 'e3',
    group: GROUP,
    kind: 'fibre',
    name: 'The bandwidth-distance product, under a stated criterion',
    terms: ['bandwidthlimit', 'criterion', 'bandwidthdistance'],
    params: [
      LENGTH,
      WIDTH,
      D,
      { key: 'criterion', label: 'Criterion', unit: '', min: 0.1, max: 1, scale: 'linear', default: 0.25, hint: 'The spread allowed, as a fraction of a bit period', eng: false },
    ],
    view: 'curve',
    views: ['curve', 'numbers'],
    headline: (x) => ({ value: x.limit.rate, unit: 'bit/s', label: 'Rate the spread allows' }),
    curve: (x, p) => ({
      x: { from: 1e3, to: 200e3, label: 'Fibre length', unit: 'm', log: true },
      series: [{ read: (l) => x.at({ length: l }).limit.rate, label: 'Rate limit', unit: 'bit/s' }],
      marks: [{ at: p.length, label: 'here' }],
      yLabel: 'Rate the spread allows',
      yUnit: 'bit/s',
      yLog: true,
    }),
  },
  {
    id: 'e4',
    group: GROUP,
    kind: 'fibre',
    name: 'The core, the cladding, and one mode',
    terms: ['numericalaperture', 'normalisedfrequency', 'singlemode'],
    params: [
      Index('n1', 'Core index', 1.4675, 'Silica doped to raise it'),
      Index('n2', 'Cladding index', 1.4622, 'Below the core, or nothing is guided'),
      Radius('a', 'Core radius', 4.5e-6, 'Half the core diameter'),
      Lambda('lambda', 'Wavelength', 1550e-9, 'The mode count is a function of it'),
    ],
    view: 'curve',
    views: ['curve', 'numbers'],
    headline: (x) => ({ value: x.geo.na, unit: '', label: 'Numerical aperture' }),
    curve: (x, p) => ({
      x: { from: 1e-6, to: 4e-5, label: 'Core radius', unit: 'm', log: true },
      series: [{ read: (a) => x.at({ a }).geo.v, label: 'Normalised frequency V', unit: '' }],
      marks: [
        { at: p.a, label: 'here' },
        { at: x.geo.singleRadius, label: 'V = 2.405' },
      ],
      yLabel: 'Normalised frequency V',
      yUnit: '',
      yLog: true,
    }),
  },
  {
    id: 'e5',
    group: GROUP,
    kind: 'link',
    name: 'The link budget, and which limit binds',
    terms: ['linkbudget', 'sensitivity', 'margin', 'reach'],
    params: [
      Dbm('txDbm', 'Transmitter power', -3, 'What the source launches into the fibre'),
      LENGTH,
      ALPHA,
      Dbm('sensitivityDbm', 'Receiver sensitivity', -28, 'The least power the receiver hears'),
      Loss('connectors', 'Connector loss', 1.0, 'Two connectors, 0.5 dB each'),
      Loss('splices', 'Splice loss', 0.4, 'Eight splices, 0.05 dB each'),
      Loss('penalty', 'Dispersion penalty', 1.0, 'What the spread costs at this rate'),
      Loss('reserve', 'Margin reserved for reach', 3.0, 'Held back when the reach is computed'),
      D,
      WIDTH,
      Rate('rate', 'Bit rate', 10e9, 'What the link is asked to carry'),
    ],
    view: 'link',
    views: ['link', 'numbers'],
    headline: (x) => ({ value: x.budget.margin, unit: 'dB', label: 'Margin over sensitivity' }),
  },
]
