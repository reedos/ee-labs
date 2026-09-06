// Group D: power flow. GRID_LAB_PLAN.md §5, group D.

import { Load, Qmax, V2 } from './shared.js'

const flow = (over) => ({
  kind: 'flow',
  group: 'Power flow',
  network: 'threeBus',
  views: ['oneline', 'newton', 'table', 'reading', 'math'],
  view: 'oneline',
  ...over,
})

export const GROUP_D = [
  flow({
    id: 'd1',
    name: 'The question a network asks',
    terms: ['constantpower', 'mismatch', 'powerflow'],
    params: [Load(), V2()],
    view: 'table',
    claim: { nonlinear: true },
  }),
  flow({
    id: 'd2',
    name: 'Three kinds of bus',
    terms: ['slackbus', 'pvbus', 'pqbus'],
    params: [V2(), Load(), Qmax()],
    claim: { types: true },
  }),
  flow({
    id: 'd3',
    name: 'Newton, iteration by iteration',
    terms: ['newton', 'jacobian', 'mismatch'],
    params: [Load(), V2(), Qmax()],
    view: 'newton',
    claim: { newton: true },
  }),
  flow({
    id: 'd4',
    name: 'The generator runs out of reactive power',
    terms: ['pvbus', 'reactivelimit', 'region'],
    params: [Qmax(0.3), Load(), V2()],
    view: 'newton',
    claim: { limit: true },
  }),
  flow({
    id: 'd5',
    name: 'Where the losses go',
    terms: ['slackbus', 'loss'],
    params: [Load(), V2(), Qmax()],
    claim: { loss: true },
  }),
  flow({
    id: 'd6',
    name: 'Loading until there is no answer',
    terms: ['nose', 'voltagecollapse', 'powerflow'],
    params: [Load(2), Qmax(8), V2()],
    views: ['pvcurve', 'oneline', 'table', 'reading', 'math'],
    view: 'pvcurve',
    claim: { nose: true },
  }),
]
