// Group A: light, and the photodiode.
//
// Five experiments and one argument. Light arrives in photons of a fixed
// energy, a detector turns some fraction of them into electrons, and the thing
// that does the turning is an ordinary circuit element. Nothing in this group
// is computed outside the solver except the four closed forms of `photon.js`,
// and every current on screen came out of the same Newton walk the diode
// experiments in the other labs use.

import { Amp, Bandgap, Diameter, Fraction, Irradiance, Lambda, Ohms, OptPower, Volt } from '../knobs.js'

export const GROUP = 'A · Light, and the photodiode'

const LAMBDA = (def = 1550e-9) => Lambda('lambda', 'Wavelength', def, 'The three windows are 850, 1310 and 1550 nm')
const ETA = Fraction('eta', 'Quantum efficiency', 0.8, 'Electrons out for each photon in')
const DARK = Amp('dark', 'Dark current', 1e-9, 'The junction’s own reverse current')
const BIAS = Volt('bias', 'Reverse bias', 5, 'The supply behind the load')
const LOAD = Ohms('load', 'Load resistance', 1000, 'What the current is read across')

export const A = [
  {
    id: 'a1',
    group: GROUP,
    kind: 'detector',
    name: 'A photon carries hc over its wavelength',
    terms: ['photon', 'wavelength', 'electronvolt', 'flux'],
    params: [LAMBDA(), OptPower('power', 'Optical power', 1e-3, 'The beam’s power, not one photon’s')],
    view: 'curve',
    views: ['curve', 'numbers'],
    headline: (x) => ({ value: x.photon.eV, unit: 'eV', label: 'Energy of one photon' }),
    curve: (x, p) => ({
      x: { from: 400e-9, to: 2000e-9, label: 'Wavelength', unit: 'm', log: true },
      series: [{ read: (l) => x.at({ lambda: l }).photon.eV, label: 'Photon energy', unit: 'eV' }],
      marks: [{ at: p.lambda, label: 'here' }],
      yLabel: 'Photon energy',
      yUnit: 'eV',
    }),
  },
  {
    id: 'a2',
    group: GROUP,
    kind: 'detector',
    name: 'The photodiode is a circuit element',
    terms: ['photodiode', 'responsivity', 'reversebias', 'loadline'],
    params: [BIAS, LOAD, OptPower('power', 'Optical power', 1e-6, 'Onto the junction'), LAMBDA(), ETA, DARK],
    view: 'schematic',
    views: ['schematic', 'curve', 'numbers'],
    headline: (x) => ({ value: x.pd.current, unit: 'A', label: 'Current through the load' }),
    curve: (x, p) => ({
      x: { from: 0.2, to: 30, label: 'Reverse bias', unit: 'V' },
      series: [{ read: (v) => x.at({ bias: v }).pd.current, label: 'Load current', unit: 'A' }],
      marks: [{ at: p.bias, label: 'here' }],
      yLabel: 'Load current',
      yUnit: 'A',
      yFromZero: true,
    }),
  },
  {
    id: 'a3',
    group: GROUP,
    kind: 'detector',
    name: 'Responsivity, and where it stops',
    terms: ['responsivity', 'bandgap', 'cutoff'],
    params: [LAMBDA(), ETA, Bandgap('eg', 'Detector bandgap', 0.75, 'Indium gallium arsenide is 0.75 eV, silicon 1.12 eV')],
    view: 'curve',
    views: ['curve', 'numbers'],
    headline: (x) => ({ value: x.R, unit: 'A/W', label: 'Responsivity' }),
    curve: (x, p) => ({
      x: { from: 400e-9, to: 2000e-9, label: 'Wavelength', unit: 'm', log: true },
      series: [{ read: (l) => x.at({ lambda: l }).R, label: 'Responsivity', unit: 'A/W' }],
      marks: [
        { at: p.lambda, label: 'here' },
        { at: x.cutoff, label: 'cut-off' },
      ],
      yLabel: 'Responsivity',
      yUnit: 'A/W',
      yFromZero: true,
    }),
  },
  {
    id: 'a4',
    group: GROUP,
    kind: 'detector',
    name: 'Dark current, and the diode underneath',
    terms: ['darkcurrent'],
    params: [OptPower('power', 'Optical power', 1e-6, 'Turn it right down to see the diode'), DARK, LAMBDA(), ETA, BIAS, LOAD],
    view: 'curve',
    views: ['curve', 'schematic', 'numbers'],
    headline: (x) => ({ value: x.pd.current, unit: 'A', label: 'Current through the load' }),
    curve: (x, p) => ({
      x: { from: 1e-12, to: 1e-4, label: 'Optical power', unit: 'W', log: true },
      series: [
        { read: (w) => x.at({ power: w }).pd.current, label: 'Total current', unit: 'A' },
        { read: () => p.dark, label: 'Dark current', unit: 'A' },
      ],
      marks: [
        { at: p.power, label: 'here' },
        { at: x.level, label: 'equal' },
      ],
      yLabel: 'Current',
      yUnit: 'A',
      yLog: true,
    }),
  },
  {
    id: 'a5',
    group: GROUP,
    kind: 'detector',
    name: 'Speed costs area',
    terms: ['junctioncapacitance', 'corner', 'areabandwidth'],
    params: [
      Diameter('d', 'Detector diameter', 100e-6, 'A round detector, across'),
      LOAD,
      BIAS,
      Irradiance('irradiance', 'Irradiance', 1, 'Power a square metre falling on it'),
    ],
    view: 'curve',
    views: ['curve', 'numbers'],
    headline: (x) => ({ value: x.speed.corner, unit: 'Hz', label: 'Corner frequency' }),
    curve: (x, p) => ({
      x: { from: 5e-6, to: 1e-3, label: 'Detector diameter', unit: 'm', log: true },
      series: [
        { read: (d) => x.at({ d }).speed.corner, label: 'Corner frequency', unit: 'Hz' },
        { read: (d) => x.at({ d }).speed.collected, label: 'Collected power', unit: 'W', axis: 'right' },
      ],
      marks: [{ at: p.d, label: 'here' }],
      yLabel: 'Corner frequency',
      yUnit: 'Hz',
      yLog: true,
      rightLabel: 'Collected power',
      rightUnit: 'W',
    }),
  },
]
