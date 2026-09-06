// Group F: induction.
//
// Faraday, and the three things a changing field does that a static one does
// not. Two of the four experiments here carry guards, and F4's guard is
// measured against an exact solve of the same wire rather than against a rule
// of thumb.

import { SIGMA_CU } from '@ee-labs/fields'
import { Amp, Area, Deg, Freq, Len, Rho, Sigma, Speed, Tesla, Turns } from '../knobs.js'

export const GROUP = 'F · Induction'

export const F_GROUP = [
  {
    id: 'f1',
    group: GROUP,
    kind: 'induction',
    name: 'Faraday, and where 4.44 comes from',
    terms: ['faraday', 'flux', 'emf', 'rms'],
    params: [
      Turns('N', 'Turns', 200),
      Area('area', 'Core cross-section', 4e-4),
      Tesla('B', 'Peak flux density', 1.2),
      Freq('f', 'Frequency', 50, 'Mains, or wherever you take it', 1, 1e6),
    ],
    faraday: (p) => ({ turns: p.N, area: p.area, Bpeak: p.B, f: p.f }),
    view: 'numbers',
    views: ['numbers', 'profile'],
    headline: (x) => ({ value: x.emf.rms, unit: 'V', label: 'Induced emf, root mean square' }),
    domain: (p) => ({ width: 4 * Math.sqrt(p.area), height: 3 * Math.sqrt(p.area), centre: true }),
  },
  {
    id: 'f2',
    group: GROUP,
    kind: 'induction',
    name: 'A conductor moving across a field',
    terms: ['motionalemf', 'lorentz', 'flux'],
    params: [
      Tesla('B', 'Flux density', 0.4),
      Len('l', 'Bar length', 0.25),
      Speed('v', 'Speed', 3),
      Deg('angle', 'Angle to the field', 90, 'Ninety degrees is across it, zero is along it'),
      Amp('I', 'Current the bar carries', 2),
    ],
    moving: (p) => ({ B: p.B, length: p.l, speed: p.v, angleDeg: p.angle }),
    view: 'numbers',
    views: ['numbers', 'profile'],
    headline: (x) => ({ value: x.moving.emf, unit: 'V', label: 'Induced emf' }),
    domain: (p) => ({ width: 3 * p.l, height: 2 * p.l, centre: true }),
  },
  {
    id: 'f3',
    group: GROUP,
    kind: 'induction',
    name: 'Eddy currents, and why a core is laminated',
    terms: ['eddycurrent', 'lamination', 'skindepth', 'losses'],
    params: [
      Len('t', 'Lamination thickness', 0.35e-3),
      Tesla('B', 'Peak flux density', 1.2),
      Freq('f', 'Frequency', 50, undefined, 1, 1e7),
      Rho('rho', 'Core resistivity', 4.7e-7, 'Grain-oriented silicon steel'),
    ],
    eddy: (p) => ({ thickness: p.t, Bpeak: p.B, f: p.f, rho: p.rho }),
    view: 'numbers',
    views: ['numbers', 'profile'],
    headline: (x) => ({ value: x.eddy.P, unit: 'W/m³', label: 'Eddy-current loss' }),
    domain: (p) => ({ width: 40 * p.t, height: 12 * p.t, centre: true }),
  },
  {
    id: 'f4',
    group: GROUP,
    kind: 'induction',
    name: 'The skin depth, and the tube it leaves',
    terms: ['skindepth', 'surfaceimpedance', 'acresistance', 'crowding'],
    params: [
      Len('a', 'Wire radius', 1e-3),
      Freq('f', 'Frequency', 1e6, undefined, 1, 1e10),
      Sigma('sigma', 'Conductivity', SIGMA_CU, 'Annealed copper at 20 degrees'),
    ],
    wire: (p) => ({ a: p.a, f: p.f, material: { sigma: p.sigma } }),
    view: 'profile',
    views: ['profile', 'numbers'],
    headline: (x) => ({ value: x.wire.ratio, unit: '', label: 'Resistance over its direct-current value' }),
    domain: (p) => ({ width: 2.4 * p.a, height: 2.4 * p.a, centre: true }),
  },
]
