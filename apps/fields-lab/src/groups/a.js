// Group A: charge and the field.
//
// Five experiments, and one argument. A charge makes a field, fields add, and
// the flux out of a closed surface counts the charge inside whatever else the
// surface does. Nothing here needs a conductor, so nothing here needs a solver.

import { Charge, Deg, Len, Ratio } from '../knobs.js'
import { coulombForce, EPS0 } from '@ee-labs/fields'

export const GROUP = 'A · Charge and the field'

const V_PER_M = 'V/m'

export const A = [
  {
    id: 'a1',
    group: GROUP,
    kind: 'charges',
    name: 'Two charges push each other apart',
    terms: ['charge', 'coulomb', 'field', 'permittivity'],
    params: [
      Charge('q1', 'First charge', 1e-9),
      Charge('q2', 'Second charge', 1e-9),
      Len('d', 'Separation', 0.01, 'Centre to centre'),
    ],
    charges: (p) => [
      { q: p.q1, at: [-p.d / 2, 0, 0] },
      { q: p.q2, at: [p.d / 2, 0, 0] },
    ],
    probe: (p) => [0, p.d / 2, 0],
    force: (p) => coulombForce(p.q1, p.q2, p.d),
    view: '2d',
    views: ['2d', 'profile', 'numbers'],
    headline: (x, p) => ({ value: x.force, unit: 'N', label: 'Force between the two charges' }),
    domain: (p) => ({ width: 4 * p.d, height: 3 * p.d, centre: true }),
  },
  {
    id: 'a2',
    group: GROUP,
    kind: 'charges',
    name: 'Fields add, one charge at a time',
    terms: ['superposition', 'field', 'dipole'],
    params: [
      Charge('q1', 'Left charge', 1e-9),
      Charge('q2', 'Right charge', -1e-9),
      Len('d', 'Separation', 0.01),
      Len('y', 'Probe height', 0.001, 'Above the midpoint'),
    ],
    charges: (p) => [
      { q: p.q1, at: [-p.d / 2, 0, 0] },
      { q: p.q2, at: [p.d / 2, 0, 0] },
    ],
    probe: (p) => [0, p.y, 0],
    view: '2d',
    views: ['2d', 'profile', 'numbers'],
    headline: (x) => ({ value: Math.hypot(...x.atProbe), unit: V_PER_M, label: 'Field at the probe' }),
    domain: (p) => ({ width: 4 * p.d, height: 3 * p.d, centre: true }),
  },
  {
    id: 'a3',
    group: GROUP,
    kind: 'charges',
    name: 'The flux out of a surface counts the charge inside',
    terms: ['gauss', 'flux', 'field', 'permittivity'],
    params: [
      Charge('q', 'Charge', 2e-9),
      Len('r', 'Sphere radius', 0.05),
      Len('off', 'How far off centre', 0.002),
      Ratio('outside', 'Move it outside', 0, 'Set to 1 to put the charge beyond the sphere', 0, 1),
    ],
    charges: (p) => [{ q: p.q, at: [p.outside > 0.5 ? 10 * p.r : p.off, p.off / 2, 0] }],
    probe: (p) => [p.r, 0, 0],
    gauss: (p) => ({ r: p.r, n: 24 }),
    view: 'flux',
    views: ['flux', '2d', 'numbers'],
    headline: (x) => ({ value: x.gauss.impliedCharge, unit: 'C', label: 'Charge the flux implies' }),
    domain: (p) => ({ width: 3 * p.r, height: 3 * p.r, centre: true }),
  },
  {
    id: 'a4',
    group: GROUP,
    kind: 'charges',
    name: 'A line and a sheet fall off differently',
    terms: ['linecharge', 'sheetcharge', 'field'],
    params: [
      Charge('lambda', 'Line charge density', 1e-9),
      Charge('sigma', 'Sheet charge density', 1e-9),
      Len('r', 'Distance', 0.01),
    ],
    charges: (p) => [{ q: p.lambda * 0.01, at: [0, 0, 0] }],
    probe: (p) => [p.r, 0, 0],
    lineCharge: (p) => ({ lambda: p.lambda, r: p.r }),
    sheetCharge: (p) => ({ sigma: p.sigma }),
    view: 'profile',
    views: ['profile', 'numbers'],
    headline: (x) => ({ value: x.lineField, unit: V_PER_M, label: 'Field of the line at the probe' }),
    domain: (p) => ({ width: 8 * p.r, height: 4 * p.r, centre: true }),
  },
  {
    id: 'a5',
    group: GROUP,
    kind: 'charges',
    name: 'Equipotentials cross the field at right angles',
    terms: ['potential', 'equipotential', 'fieldline'],
    params: [
      Charge('q', 'Charge magnitude', 2e-9),
      Len('d', 'Separation', 0.02),
      Len('start', 'Where the curve starts', 0.006, 'Distance from the left charge'),
      Len('step', 'Step along the curve', 5e-5),
    ],
    charges: (p) => [
      { q: p.q, at: [-p.d / 2, 0, 0] },
      { q: -p.q, at: [p.d / 2, 0, 0] },
    ],
    probe: (p) => [-p.d / 2 + p.start, 0, 0],
    equipotential: (p) => ({ start: [-p.d / 2 + p.start, 0, 0], step: p.step, maxSteps: 8000 }),
    view: '2d',
    views: ['2d', 'profile', 'numbers'],
    headline: (x) => ({ value: x.curve.level, unit: 'V', label: 'The level the traced curve holds' }),
    domain: (p) => ({ width: 3 * p.d, height: 2 * p.d, centre: true }),
  },
]

export { EPS0 }
