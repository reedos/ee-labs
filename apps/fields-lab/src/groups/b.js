// Group B: capacitance in closed form.
//
// Four geometries a pencil can solve, and the energy in the field of the last
// one. Every number here is exact, so no experiment in this group carries a
// guard and none of the notes hedge.

import { Area, Dist, Eps, Len, Volt } from '../knobs.js'

export const GROUP = 'B · Capacitance'

export const B = [
  {
    id: 'b1',
    group: GROUP,
    kind: 'capacitance',
    name: 'A parallel plate holds eps A over d',
    terms: ['capacitance', 'permittivity', 'field', 'uniformfield', 'breakdown', 'fringing'],
    params: [
      Area('area', 'Plate area', 1e-4),
      Len('gap', 'Gap', 1e-3),
      Eps('epsr', 'Dielectric', 1, 'Air is 1, glass epoxy 3.9'),
      Volt('V', 'Voltage', 10),
    ],
    geometry: (p) => ({ kind: 'parallelPlate', area: p.area, gap: p.gap, epsr: p.epsr }),
    view: 'numbers',
    views: ['numbers', 'profile', '2d'],
    headline: (x) => ({ value: x.C.value, unit: 'F', label: 'Capacitance' }),
    // The plates are drawn about the origin, as every geometry in this lab is,
    // so the domain has to be centred on it too. Without `centre` the map put
    // both plates in the bottom-left corner with half of each off the edge.
    domain: (p) => ({ width: Math.sqrt(p.area) * 1.4, height: p.gap * 3, centre: true }),
  },
  {
    id: 'b2',
    group: GROUP,
    kind: 'capacitance',
    name: 'A coaxial cable holds 2 pi eps over ln(b/a)',
    terms: ['capacitance', 'coaxial', 'permittivity', 'breakdown'],
    params: [
      Len('a', 'Inner radius', 0.45e-3),
      Len('b', 'Shield radius', 1.475e-3),
      Eps('epsr', 'Dielectric', 2.25, 'Solid polyethylene'),
      Volt('V', 'Voltage', 100),
    ],
    geometry: (p) => ({ kind: 'coax', a: p.a, b: p.b, epsr: p.epsr }),
    radial: (x, p) => ({
      from: p.a,
      to: p.b,
      // Gauss in a cylinder: E falls as one over r between the conductors.
      field: (r) => p.V / (r * Math.log(p.b / p.a)),
    }),
    view: '2d',
    views: ['2d', 'profile', 'numbers'],
    headline: (x) => ({ value: x.C.perMetre, unit: 'F/m', label: 'Capacitance per metre' }),
    domain: (p) => ({ width: 2.4 * p.b, height: 2.4 * p.b, centre: true }),
  },
  {
    id: 'b3',
    group: GROUP,
    kind: 'capacitance',
    name: 'A sphere inside a shell, and a sphere alone',
    terms: ['capacitance', 'gauss', 'isolatedsphere'],
    params: [
      Len('a', 'Sphere radius', 0.05),
      Dist('b', 'Shell radius', 0.06, 'Push it far away and the sphere stands alone'),
      Eps('epsr', 'Dielectric', 1),
      Volt('V', 'Voltage', 100),
    ],
    geometry: (p) => ({ kind: 'spherical', a: p.a, b: p.b, epsr: p.epsr }),
    radial: (x, p) => ({
      from: p.a,
      to: p.b,
      // Gauss in a sphere: E falls as one over r squared.
      field: (r) => (p.V * p.a * p.b) / (r * r * (p.b - p.a)),
    }),
    view: '2d',
    views: ['2d', 'profile', 'numbers'],
    headline: (x) => ({ value: x.C.value, unit: 'F', label: 'Capacitance' }),
    domain: (p) => ({ width: 2.4 * p.b, height: 2.4 * p.b, centre: true }),
  },
  {
    id: 'b4',
    group: GROUP,
    kind: 'capacitance',
    name: 'Two wires, and the images inside them',
    terms: ['capacitance', 'images', 'twowire'],
    params: [
      Len('a', 'Wire radius', 0.4e-3),
      Len('d', 'Centre spacing', 6e-3),
      Eps('epsr', 'Dielectric', 1),
      Volt('V', 'Voltage', 100),
    ],
    geometry: (p) => ({ kind: 'twoWire', a: p.a, d: p.d, epsr: p.epsr }),
    view: '2d',
    views: ['2d', 'profile', 'numbers'],
    headline: (x) => ({ value: x.C.perMetre, unit: 'F/m', label: 'Capacitance per metre' }),
    domain: (p) => ({ width: 2 * p.d, height: 1.4 * p.d, centre: true }),
  },
  {
    id: 'b5',
    group: GROUP,
    kind: 'capacitance',
    name: 'The energy is in the field',
    terms: ['energy', 'energydensity', 'capacitance', 'breakdown'],
    params: [
      Len('a', 'Inner radius', 0.45e-3),
      Len('b', 'Shield radius', 1.475e-3),
      Eps('epsr', 'Dielectric', 2.25),
      Volt('V', 'Voltage', 100),
    ],
    geometry: (p) => ({ kind: 'coax', a: p.a, b: p.b, epsr: p.epsr }),
    radial: (x, p) => ({
      from: p.a,
      to: p.b,
      field: (r) => p.V / (r * Math.log(p.b / p.a)),
    }),
    view: 'profile',
    views: ['profile', '2d', 'numbers'],
    headline: (x) => ({ value: x.energy.W, unit: 'J', label: 'Energy stored in one metre' }),
    domain: (p) => ({ width: 2.4 * p.b, height: 2.4 * p.b, centre: true }),
  },
]
