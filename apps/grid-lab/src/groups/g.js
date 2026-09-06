// Group G: the four faults. GRID_LAB_PLAN.md §5, group G.

import { Xg, Xt, Xl, Xl0, Zf, WINDING, FAULT_KIND } from './shared.js'

const fault = (over) => ({
  kind: 'fault',
  group: 'Faults',
  views: ['sequence', 'phasors', 'table', 'reading', 'math'],
  view: 'sequence',
  ...over,
})

export const GROUP_G = [
  fault({
    id: 'g1',
    name: 'The three-phase fault',
    terms: ['faultlevel', 'positivesequence'],
    fault: '3ph',
    params: [Xg(), Xt(), Xl(), Zf()],
    claim: { threePhase: true },
  }),
  fault({
    id: 'g2',
    name: 'Single line to ground',
    terms: ['groundfault', 'zerosequence', 'sequencenetwork'],
    fault: 'slg',
    params: [Xl0(), Xg(), Xt(), Xl(), Zf()],
    claim: { slg: true },
  }),
  fault({
    id: 'g3',
    name: 'Line to line',
    terms: ['negativesequence', 'sequencenetwork'],
    fault: 'll',
    params: [Xg(), Xt(), Xl(), Zf()],
    claim: { ll: true },
  }),
  fault({
    id: 'g4',
    name: 'Double line to ground',
    terms: ['groundfault', 'zerosequence', 'negativesequence'],
    fault: 'dlg',
    params: [Xl0(), Xg(), Xt(), Xl(), Zf()],
    claim: { dlg: true },
  }),
  fault({
    id: 'g5',
    name: 'Which fault is the worst',
    // The generator's own zero-sequence reactance and its neutral impedance
    // reach the answer only through a winding that passes zero sequence, and
    // F3 is where they are the lesson. Here the knobs are the fault, the
    // winding and the impedances every sequence sees.
    terms: ['faultlevel', 'groundfault'],
    params: [FAULT_KIND, Xl0(), WINDING, Xg(), Xl()],
    view: 'table',
    claim: { worst: true },
  }),
]
