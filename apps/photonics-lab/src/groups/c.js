// Group C: the LED and the laser as junctions.
//
// Five experiments and one argument. Both devices are the same forward-biased
// junction, the same exponential law drives both, and what separates them is
// where the recombined carriers go. The LED sends every one of them out as
// spontaneous light, linearly, and pays for it in speed. The laser clamps its
// carrier density at threshold and sends the excess into one mode, which is
// what buys the slope and the bandwidth Group D measures.
//
// The threshold current is not this group's to compute. `rate.js` returns it,
// `math.js` calls that, and C5 turns the cavity that sets it. That is the gate
// in the brief's §1, kept.

import { LASER_CHIP, LASER_DEFAULTS } from '@ee-labs/photonics'

import {
  ActiveVolume,
  Amp,
  CavityLength,
  Coupling,
  DiffGain,
  Density,
  Drive,
  Fraction,
  Index,
  Lambda,
  Lifetime,
  Ohms,
  Reflectance,
  Volt,
} from '../knobs.js'

export const GROUP = 'C · The LED and the laser'

const LAMBDA = (def = 1550e-9) => Lambda('lambda', 'Wavelength', def, 'The three windows are 850, 1310 and 1550 nm')
const IS = Amp('is', 'Saturation current', 1e-12, 'The junction’s own I_S in the exponential law')
const IDEALITY = Index('n', 'Ideality factor', 2, 'A wide-gap junction runs near 2', 1, 3)
const ETA_INT = Fraction('etaInt', 'Internal efficiency', 0.2, 'Photons out for each electron in')
const ETA_D = Fraction('etaD', 'Differential efficiency', 0.4, 'The fraction of each extra electron that leaves as light')
const ETA_SP = Fraction('etaSp', 'Spontaneous efficiency', 0.002, 'What leaves the facet below threshold')
// The LED's own carrier lifetime. It is a different device from the laser
// Groups C and D bias, so it carries its own default rather than the laser's.
const TAU_LED = Lifetime('tauC', 'Carrier lifetime', 5e-9, 'How long a carrier lasts before it recombines', 1e-10, 1e-7)
// The photon lifetime is not typed. It is what the chip `rate.js` holds gives
// under the plan's §2.8 mirror-loss convention, so C4's laser and D2's are one
// device to the last bit rather than two that round to the same five figures.
const TAU_P = Lifetime('tauP', 'Photon lifetime', LASER_DEFAULTS.tauP, 'How long a photon stays in the cavity', 1e-13, 1e-10)
const TAU_C = Lifetime('tauC', 'Carrier lifetime', 2e-9, 'How long a carrier lasts before it recombines', 1e-10, 1e-7)
const GAIN = DiffGain('g0', 'Differential gain', 2.5e-12, 'How fast the gain grows with carrier density')
const NTR = Density('ntr', 'Transparency density', 1e24, 'Below it the material absorbs rather than amplifies')
const CONFINE = Fraction('gamma', 'Confinement factor', 0.3, 'The share of the mode that sits in the active region')
const VOLUME = ActiveVolume('V', 'Active volume', 1e-16, 'The stripe the carriers are held in')
const BETA = Coupling('beta', 'Spontaneous coupling', 0, 'The share of spontaneous light landing in the mode')

/** The six rate parameters, in the order a reader meets them. C4 and C5 both carry them. */
const RATE_KNOBS = [TAU_P, TAU_C, GAIN, NTR, CONFINE, VOLUME, BETA]

export const C = [
  {
    id: 'c1',
    group: GROUP,
    kind: 'junction',
    name: 'Both are forward-biased junctions',
    terms: ['forwardbias', 'shockley', 'led', 'laserdiode', 'recombination'],
    params: [
      Volt('drive', 'Supply', 2.5, 'Behind the series resistor', 0.5, 6),
      Ohms('series', 'Series resistor', 68, 'What sets the current'),
      ETA_INT,
      ETA_D,
      LAMBDA(),
      IS,
      IDEALITY,
      ETA_SP,
      TAU_P,
      TAU_C,
      GAIN,
      NTR,
      CONFINE,
      VOLUME,
    ],
    view: 'schematic',
    views: ['schematic', 'curve', 'numbers'],
    headline: (x) => ({ value: x.j.current, unit: 'A', label: 'Current through the junction' }),
    curve: (x, p) => ({
      x: { from: 0.5, to: 6, label: 'Supply', unit: 'V' },
      series: [{ read: (v) => x.at({ drive: v }).j.current, label: 'Junction current', unit: 'A' }],
      marks: [{ at: p.drive, label: 'here' }],
      yLabel: 'Junction current',
      yUnit: 'A',
      yFromZero: true,
    }),
  },
  {
    id: 'c2',
    group: GROUP,
    kind: 'led',
    name: 'The LED’s power is linear in current',
    terms: ['internalefficiency', 'voltsperphoton'],
    params: [Drive('current', 'Drive current', 20e-3, 'Straight through the junction'), ETA_INT, LAMBDA(), IS, IDEALITY],
    view: 'curve',
    views: ['curve', 'numbers'],
    headline: (x) => ({ value: x.led.power, unit: 'W', label: 'Optical power out' }),
    curve: (x, p) => ({
      x: { from: 1e-4, to: 0.1, label: 'Drive current', unit: 'A', log: true },
      series: [{ read: (i) => x.at({ current: i }).led.power, label: 'Optical power', unit: 'W' }],
      marks: [{ at: p.current, label: 'here' }],
      yLabel: 'Optical power',
      yUnit: 'W',
      yLog: true,
    }),
  },
  {
    id: 'c3',
    group: GROUP,
    kind: 'led',
    name: 'The LED is slow',
    terms: ['carrierlifetime', 'modulationbandwidth', 'decibel'],
    params: [
      TAU_LED,
      Drive('current', 'Drive current', 20e-3, 'Straight through the junction'),
      ETA_INT,
      LAMBDA(),
      IS,
      IDEALITY,
    ],
    view: 'curve',
    views: ['curve', 'numbers'],
    headline: (x) => ({ value: x.band.f3db, unit: 'Hz', label: 'Modulation bandwidth' }),
    curve: (x, p) => ({
      x: { from: 1e5, to: 1e10, label: 'Modulation frequency', unit: 'Hz', log: true },
      series: [{ read: (f) => 20 * Math.log10(x.band.at(f)), label: 'Response', unit: 'dB' }],
      marks: [{ at: x.band.f3db, label: '3 dB down' }],
      yLabel: 'Response',
      yUnit: 'dB',
      yPlain: false,
    }),
  },
  {
    id: 'c4',
    group: GROUP,
    kind: 'laser',
    name: 'The laser has a threshold',
    terms: ['threshold', 'slopeefficiency', 'stimulated', 'gainclamp', 'cavity'],
    params: [Drive('current', 'Drive current', 26.777e-3, 'Straight through the junction'), ETA_D, ETA_SP, LAMBDA(), ...RATE_KNOBS],
    view: 'curve',
    views: ['curve', 'numbers'],
    headline: (x) => ({ value: x.ith, unit: 'A', label: 'Threshold current' }),
    curve: (x, p) => ({
      x: { from: 0, to: 4 * x.ith, label: 'Drive current', unit: 'A' },
      series: [
        { read: (i) => x.at({ current: i }).laser.power, label: 'Optical power', unit: 'W' },
        { read: (i) => x.at({ current: i }).laser.spontaneous, label: 'Spontaneous alone', unit: 'W' },
      ],
      marks: [
        { at: x.ith, label: 'threshold' },
        { at: p.current, label: 'here' },
      ],
      yLabel: 'Optical power',
      yUnit: 'W',
      yFromZero: true,
    }),
  },
  {
    id: 'c5',
    group: GROUP,
    kind: 'laser',
    name: 'Threshold moves with the mirrors',
    terms: ['photonlifetime', 'mirrorloss', 'facet'],
    params: [
      // The same facet the chip behind TAU_P was cleaved with, computed from
      // the index rather than typed, so C5 at its defaults reads the threshold
      // C4 and D2 read.
      Reflectance('r', 'Facet reflectance', LASER_CHIP.r, 'A cleaved facet of index 3.5 gives 0.30864'),
      CavityLength('cavityLength', 'Chip length', 100e-6, 'Between the two cleaved ends'),
      Index('n', 'Index inside', 3.5, 'The semiconductor the light travels in'),
      Drive('current', 'Drive current', 26.777e-3, 'Straight through the junction'),
      ETA_D,
      ETA_SP,
      LAMBDA(),
      TAU_C,
      GAIN,
      NTR,
      CONFINE,
      VOLUME,
    ],
    view: 'curve',
    views: ['curve', 'numbers'],
    headline: (x) => ({ value: x.ith, unit: 'A', label: 'Threshold current' }),
    curve: (x, p) => ({
      x: { from: 0.02, to: 0.99, label: 'Facet reflectance', unit: '' },
      series: [
        { read: (r) => x.at({ r }).ith, label: 'Threshold current', unit: 'A' },
        { read: (r) => x.at({ r }).cavity.tauP, label: 'Photon lifetime', unit: 's', axis: 'right' },
      ],
      marks: [{ at: p.r, label: 'here' }],
      yLabel: 'Threshold current',
      yUnit: 'A',
      yFromZero: true,
      rightLabel: 'Photon lifetime',
      rightUnit: 's',
    }),
  },
]
