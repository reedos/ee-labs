// Group A: per unit, which is the change of variables the rest of the subject
// is written in. GRID_LAB_PLAN.md §5, group A.

import { Sbase, Vbase, VbaseLow, Zgen, Sgen, Ztx, Stx, Pmw, Pf, Vpu } from './shared.js'

const base = (over) => ({
  kind: 'base',
  group: 'Per unit',
  views: ['oneline', 'table', 'reading', 'math'],
  view: 'table',
  ...over,
})

export const GROUP_A = [
  base({
    id: 'a1',
    name: 'One base, every quantity',
    terms: ['perunit', 'base', 'apparentpower'],
    params: [Sbase(), Vbase(), VbaseLow(), Pmw(), Pf()],
    claim: { bases: true },
  }),
  base({
    id: 'a2',
    name: 'The transformer disappears',
    terms: ['perunit', 'base', 'transformer'],
    params: [VbaseLow(), Vbase(), Sbase(), Ztx()],
    view: 'oneline',
    claim: { zones: true },
  }),
  base({
    id: 'a3',
    name: 'Changing base',
    terms: ['perunit', 'base', 'ratedimpedance'],
    params: [Zgen(), Sgen(), Ztx(), Stx(), Sbase()],
    claim: { rebase: true },
  }),
  base({
    id: 'a4',
    name: 'A load in per unit',
    terms: ['perunit', 'powerfactor', 'zipload'],
    params: [Pmw(), Pf(), Vpu(), Sbase()],
    claim: { load: true },
  }),
]
