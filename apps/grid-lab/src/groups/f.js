// Group F: symmetrical components. GRID_LAB_PLAN.md §5, group F.

import { Ia, Ib, Ic, AngB, AngC, Xg, Xg0, Xt, Xl, Xl0, Zn, WINDING } from './shared.js'

const seq = (over) => ({
  kind: 'seq',
  group: 'Symmetrical components',
  views: ['phasors', 'sequence', 'reading', 'math'],
  view: 'phasors',
  ...over,
})

export const GROUP_F = [
  seq({
    id: 'f1',
    name: 'Three sets, one basis',
    terms: ['symmetricalcomponents', 'positivesequence', 'negativesequence'],
    params: [Ia(), Ib(), Ic(), AngB(), AngC()],
    claim: { basis: true },
  }),
  seq({
    id: 'f2',
    name: 'The neutral carries three times the zero sequence',
    terms: ['zerosequence', 'neutral', 'delta'],
    params: [Ia(), Ib(), Ic(), AngB(), AngC()],
    claim: { neutral: true },
  }),
  seq({
    id: 'f3',
    name: 'Three networks, three impedances',
    terms: ['sequencenetwork', 'zerosequence', 'grounding'],
    params: [WINDING, Zn(), Xg0(), Xl0(), Xg(), Xt(), Xl()],
    view: 'sequence',
    claim: { networks: true },
  }),
  seq({
    id: 'f4',
    name: 'The transform is not a fault',
    terms: ['unbalancefactor', 'negativesequence'],
    params: [Ic(), Ia(), Ib(), AngB(), AngC()],
    claim: { unbalance: true },
  }),
]
