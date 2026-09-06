// Group E: the DC power flow, and the guard that governs it.
// GRID_LAB_PLAN.md §5, group E.

import { Load, Qmax, V2 } from './shared.js'

const dc = (over) => ({
  kind: 'flow',
  group: 'The DC power flow',
  network: 'threeBus',
  views: ['oneline', 'table', 'reading', 'math'],
  view: 'table',
  ...over,
})

export const GROUP_E = [
  dc({
    id: 'e1',
    name: 'Three assumptions, one linear solve',
    terms: ['dcpowerflow', 'susceptance'],
    params: [Load(), V2(), Qmax()],
    claim: { linear: true },
  }),
  dc({
    id: 'e2',
    name: 'Which assumption costs the most',
    terms: ['dcpowerflow', 'smallangle'],
    params: [Load(), V2(), Qmax()],
    claim: { cost: true },
  }),
  dc({
    id: 'e3',
    name: 'The guard, at both sides',
    terms: ['dcpowerflow', 'guard'],
    params: [Load(2.5), Qmax(8), V2()],
    view: 'oneline',
    claim: { guard: true },
  }),
]
