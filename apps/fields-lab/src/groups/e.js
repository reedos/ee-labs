// Group E: magnetostatics.
//
// Biot-Savart on a wire path, Ampere as the check on it, the inductance of the
// canonical geometries, and then the magnetic circuit that the Power Lab's
// transformer group assumes. E5 and E6 are the seam to that lab.

import { circlePath, loopOnAxis, MU0 } from '@ee-labs/fields'
import { Amp, Area, Deg, Len, Mu, Ratio, Turns } from '../knobs.js'

export const GROUP = 'E · Magnetostatics'

const TESLA = 'T'

export const E = [
  {
    id: 'e1',
    group: GROUP,
    kind: 'magnetics',
    name: 'Biot-Savart, summed over a wire',
    terms: ['biotsavart', 'fluxdensity', 'permeability', 'superposition'],
    params: [
      Len('a', 'Loop radius', 0.05),
      Amp('I', 'Current', 3),
      Len('z', 'Height on the axis', 0),
      Ratio('sides', 'Sides of the polygon', 720, 'How finely the loop is cut', 6, 2880),
    ],
    path: (p) => circlePath(p.a, { sides: Math.round(p.sides) }),
    probe: (p) => [0, 0, p.z],
    closedForm: (p) => loopOnAxis(p.a, p.I, p.z),
    view: '2d',
    views: ['2d', 'profile', 'numbers'],
    headline: (x) => ({ value: x.magProbe, unit: TESLA, label: 'Flux density at the probe' }),
    domain: (p) => ({ width: 3 * p.a, height: 3 * p.a, centre: true }),
  },
  {
    id: 'e2',
    group: GROUP,
    kind: 'magnetics',
    name: 'Ampere counts the current a contour encloses',
    terms: ['ampere', 'lineintegral', 'enclosedcurrent', 'longwire'],
    params: [
      Amp('I', 'Current', 10),
      Len('r', 'Contour radius', 0.02),
      Len('off', 'Contour offset', 0, 'Move the contour off the wire'),
    ],
    path: () => [
      [0, 0, -1e5],
      [0, 0, 1e5],
    ],
    probe: (p) => [p.r, 0, 0],
    ampere: (p) => ({ r: p.r, centre: [p.off, 0, 0], points: 512, expected: Math.abs(p.off) < p.r ? p.I : 0 }),
    view: '2d',
    views: ['2d', 'profile', 'numbers'],
    headline: (x) => ({ value: x.ampere.enclosed, unit: 'A', label: 'Current the contour encloses' }),
    domain: (p) => ({ width: 6 * p.r, height: 6 * p.r, centre: true }),
  },
  {
    id: 'e3',
    group: GROUP,
    kind: 'magnetics',
    name: 'A solenoid is nearly uniform inside',
    terms: ['solenoid', 'turnsdensity', 'endeffect'],
    params: [
      Len('a', 'Bore radius', 0.01),
      Len('len', 'Length', 0.2),
      Turns('N', 'Turns', 400),
      Amp('I', 'Current', 2),
      Len('z', 'Position from the centre', 0, 'Move to the end to see it halve'),
    ],
    solenoid: (p) => [p.a, p.len, p.N, p.I, p.z],
    view: 'profile',
    views: ['profile', 'numbers'],
    headline: (x) => ({ value: x.solenoid.B, unit: TESLA, label: 'Flux density on the axis' }),
    domain: (p) => ({ width: 1.6 * p.len, height: 4 * p.a, centre: true }),
  },
  {
    id: 'e4',
    group: GROUP,
    kind: 'magnetics',
    name: 'Inductance of the canonical geometries',
    terms: ['inductance', 'flux', 'internalinductance', 'permeability'],
    params: [
      Len('a', 'Inner radius', 0.45e-3),
      Len('b', 'Shield radius', 1.475e-3),
      Mu('mur', 'Relative permeability', 1),
      Ratio('internal', 'Count the conductor field', 0, 'Set to 1 to add mu over eight pi', 0, 1),
    ],
    geometry: (p) => ({ kind: 'coax', a: p.a, b: p.b, mur: p.mur, length: 1 }),
    view: 'numbers',
    views: ['numbers', '2d', 'profile'],
    headline: (x) => ({ value: x.L.perMetre, unit: 'H/m', label: 'Inductance per metre' }),
    domain: (p) => ({ width: 2.4 * p.b, height: 2.4 * p.b, centre: true }),
  },
  {
    id: 'e5',
    group: GROUP,
    kind: 'magnetics',
    name: 'The magnetic circuit, and what a gap does',
    terms: ['reluctance', 'mmf', 'airgap', 'fringing'],
    params: [
      Len('mean', 'Mean path length', 0.2),
      Area('area', 'Core cross-section', 4e-4),
      Mu('mur', 'Core permeability', 2000),
      Len('gap', 'Air gap', 1e-3),
      Turns('N', 'Turns', 200),
      Amp('I', 'Current', 1),
    ],
    circuit: (p) => ({ meanLength: p.mean, area: p.area, mur: p.mur, gap: p.gap, turns: p.N, current: p.I }),
    view: 'circuit',
    views: ['circuit', 'numbers'],
    headline: (x) => ({ value: x.circuit.inductance, unit: 'H', label: 'Inductance' }),
    domain: (p) => ({ width: p.mean / 3, height: p.mean / 4, centre: true }),
  },
  {
    id: 'e6',
    group: GROUP,
    kind: 'magnetics',
    name: 'The transformer, from the reluctance up',
    terms: ['mutualinductance', 'coupling', 'leakage', 'turnsratio'],
    params: [
      Len('mean', 'Mean path length', 0.2),
      Area('area', 'Core cross-section', 4e-4),
      Mu('mur', 'Core permeability', 2000),
      Turns('n1', 'Primary turns', 200),
      Turns('n2', 'Secondary turns', 50),
      Ratio('leakage', 'Leakage fraction', 0.02, 'The flux that misses the other winding', 0, 0.5),
    ],
    transformer: (p) => ({
      meanLength: p.mean,
      area: p.area,
      mur: p.mur,
      gap: 0,
      n1: p.n1,
      n2: p.n2,
      leakage: p.leakage,
      current: 1,
    }),
    view: 'circuit',
    views: ['circuit', 'numbers'],
    headline: (x) => ({ value: x.xfmr.k, unit: '', label: 'Coupling coefficient' }),
    domain: (p) => ({ width: p.mean / 3, height: p.mean / 4, centre: true }),
  },
]

export { MU0 }
