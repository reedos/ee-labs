// Group D: current, resistance, and the four-point probe.
//
// The group where the same Laplace solution answers two questions. Replace eps
// with sigma and invert, and a capacitance becomes a resistance. D3 puts a
// number on that, and D4 is the measurement that cannot be read at all without
// knowing which object is under the probe.

import { Amp, Area, Dist, Eps, Len, Rho, Sigma, Volt } from '../knobs.js'
import { SIGMA_CU } from '@ee-labs/fields'

export const GROUP = 'D · Current and resistance'

export const D = [
  {
    id: 'd1',
    group: GROUP,
    kind: 'conduction',
    name: 'Ohm at a point, and Ohm at a bar',
    terms: ['currentdensity', 'conductivity', 'ohmpoint', 'resistivity'],
    params: [
      Rho('rho', 'Resistivity', 1 / SIGMA_CU, 'Annealed copper at 20 degrees'),
      Dist('len', 'Bar length', 1),
      Area('area', 'Cross-section', 1e-6),
      Volt('V', 'Voltage across it', 0.05),
    ],
    bar: (p) => ({ rho: p.rho, length: p.len, area: p.area, voltage: p.V }),
    view: 'numbers',
    views: ['numbers', 'profile'],
    headline: (x) => ({ value: x.bar.R, unit: 'Ω', label: 'Resistance of the bar' }),
    domain: (p) => ({ width: p.len, height: Math.sqrt(p.area) * 20 }),
  },
  {
    id: 'd2',
    group: GROUP,
    kind: 'conduction',
    name: 'The resistance of a geometry',
    terms: ['leakage', 'conductivity', 'laplace'],
    params: [
      Len('a', 'Inner radius', 0.45e-3),
      Len('b', 'Shield radius', 1.475e-3),
      Eps('epsr', 'Dielectric', 2.25),
      Sigma('sigma', 'Dielectric conductivity', 1e-12, 'A good insulator leaks a little'),
    ],
    geometry: (p) => ({ kind: 'coax', a: p.a, b: p.b, epsr: p.epsr, length: 1 }),
    view: 'numbers',
    views: ['numbers', '2d', 'profile'],
    headline: (x) => ({ value: x.R.value, unit: 'Ω', label: 'Leakage resistance of one metre' }),
    domain: (p) => ({ width: 2.4 * p.b, height: 2.4 * p.b, centre: true }),
  },
  {
    id: 'd3',
    group: GROUP,
    kind: 'conduction',
    name: 'R times C does not depend on the shape',
    terms: ['relaxationtime', 'laplace', 'leakage'],
    params: [
      Len('a', 'Inner radius', 0.45e-3),
      Len('b', 'Shield radius', 1.475e-3),
      Eps('epsr', 'Dielectric', 2.25),
      Sigma('sigma', 'Dielectric conductivity', 1e-12),
    ],
    geometry: (p) => ({ kind: 'coax', a: p.a, b: p.b, epsr: p.epsr, length: 1 }),
    view: 'numbers',
    views: ['numbers', '2d'],
    headline: (x) => ({ value: x.rc, unit: 's', label: 'The R C product' }),
    domain: (p) => ({ width: 2.4 * p.b, height: 2.4 * p.b, centre: true }),
  },
  {
    id: 'd4',
    group: GROUP,
    kind: 'conduction',
    name: 'The four-point probe reads two different numbers',
    terms: ['fourpoint', 'sheetresistance', 'spreading', 'resistivity'],
    params: [
      Len('s', 'Probe spacing', 1e-3),
      Volt('V', 'Inner-pair voltage', 5e-3, 'What the sense probes read'),
      Amp('I', 'Outer-pair current', 1e-3, 'What the force probes drive'),
      Len('t', 'Sample thickness', 5e-3, 'Thick is a block, thin is a sheet'),
    ],
    fourPoint: (p) => ({ spacing: p.s, voltage: p.V, current: p.I, thickness: p.t }),
    view: 'numbers',
    views: ['numbers', 'profile'],
    headline: (x) => ({
      value: x.fourPoint.regime === 'sheet' ? x.fourPoint.sheetResistance : x.fourPoint.resistivity,
      unit: x.fourPoint.regime === 'sheet' ? 'Ω/□' : 'Ω·m',
      label: x.fourPoint.regime === 'sheet' ? 'Sheet resistance' : 'Resistivity',
    }),
    domain: (p) => ({ width: 6 * p.s, height: 3 * p.s, centre: true }),
  },
]
