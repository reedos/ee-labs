// Group I: the machine on the grid, and stability.
// GRID_LAB_PLAN.md §5, group I.
//
// The machine is the Machines Lab's synchronous machine, imported through
// `@ee-labs/grid`'s `stability`, which reads `swing()` there for the inertia,
// the equilibrium angle, the synchronising coefficient and the energy
// integral. This lab writes no second machine model.

import { H, Pm, Pre, During, Post, Tc, Step } from './shared.js'

const swing = (over) => ({
  kind: 'swing',
  group: 'The machine on the grid',
  views: ['pdelta', 'rotor', 'table', 'reading', 'math'],
  view: 'pdelta',
  ...over,
})

export const GROUP_I = [
  swing({
    id: 'i1',
    name: 'The machine as a source behind a reactance',
    terms: ['powerangle', 'transientreactance', 'synchronous'],
    params: [Pre(), Pm(), Post(), During()],
    claim: { transfer: true },
  }),
  swing({
    id: 'i2',
    name: 'The swing equation',
    terms: ['swingequation', 'inertiaconstant', 'synchronising'],
    params: [H(), Post(), Pm(), Pre()],
    view: 'rotor',
    claim: { swing: true },
  }),
  swing({
    id: 'i3',
    name: 'Equal areas',
    terms: ['equalarea', 'criticalangle'],
    params: [During(), Post(), Pre(), Pm()],
    claim: { areas: true },
  }),
  swing({
    id: 'i4',
    name: 'From an angle to a time',
    terms: ['criticalangle', 'integrator', 'guard'],
    params: [During(), H(), Post(), Pre()],
    view: 'rotor',
    claim: { time: true },
  }),
  swing({
    id: 'i5',
    name: 'The first swing',
    terms: ['firstswing', 'equalarea', 'integrator'],
    params: [Tc(), Step(), During(), Post()],
    view: 'rotor',
    claim: { peak: true },
  }),
]
