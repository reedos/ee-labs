// Group B: three phase, from the circuits side. GRID_LAB_PLAN.md §5, group B.

import { Vll, Rphase, Xphase, Rdelta, Ia, Ib, Ic, AngB, AngC } from './shared.js'

const phase = (over) => ({
  kind: 'phase',
  group: 'Three phase',
  views: ['phasors', 'wave', 'reading', 'math'],
  view: 'phasors',
  ...over,
})

export const GROUP_B = [
  phase({
    id: 'b1',
    name: 'Line to line and line to neutral',
    terms: ['linetoline', 'linetoneutral', 'balanced'],
    params: [Vll(), Rphase(), Xphase()],
    claim: { ratio: true },
  }),
  phase({
    id: 'b2',
    name: 'One phase carries the whole answer',
    terms: ['perphase', 'powerfactor', 'apparentpower'],
    params: [Rphase(), Xphase(), Vll()],
    view: 'wave',
    claim: { perphase: true },
  }),
  phase({
    id: 'b3',
    name: 'Constant power',
    terms: ['instantaneouspower', 'balanced'],
    params: [Rphase(), Xphase(), Vll()],
    view: 'wave',
    claim: { flat: true },
  }),
  phase({
    id: 'b4',
    name: 'Delta and wye',
    terms: ['delta', 'wye'],
    params: [Rdelta(), Vll(), Rphase(), Xphase()],
    claim: { delta: true },
  }),
  phase({
    id: 'b5',
    name: 'An unbalanced set is three balanced sets',
    terms: ['symmetricalcomponents', 'zerosequence', 'unbalancefactor'],
    params: [Ia(), Ib(), Ic(), AngB(), AngC()],
    claim: { sequence: true },
    // The inverter that produces a balanced set is Power Lab's Group I, which
    // is planned and not built, so the cross-reference is named and deferred.
    crossRef: { lab: 'power-lab', id: 'i3', why: 'the inverter that produces a balanced three-phase set' },
  }),
]
