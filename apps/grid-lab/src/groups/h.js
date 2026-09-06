// Group H: protection. GRID_LAB_PLAN.md §5, group H.
//
// The plan's §5 gives this group the ids I1 to I4 and gives the machine group
// the ids H1 to H4, which crosses the two groups' letters. The ids here follow
// the group letters, so protection is H and the machine is I, and §9's phase 6
// names the same experiments it always did.

import { Pickup, Tds, Ifault, Margin, CURVE, Zline, FaultKm, TapKm, Infeed } from './shared.js'

const relay = (over) => ({
  kind: 'relay',
  group: 'Protection',
  views: ['relayplot', 'table', 'reading', 'math'],
  view: 'relayplot',
  ...over,
})

export const GROUP_H = [
  relay({
    id: 'h1',
    name: 'The inverse-time overcurrent relay',
    terms: ['overcurrent', 'pickup', 'timedial'],
    params: [Ifault(), Tds(), Pickup(), CURVE],
    claim: { inverse: true },
  }),
  relay({
    id: 'h2',
    name: 'Coordination is a margin in seconds',
    terms: ['coordination', 'timedial'],
    params: [Margin(), Tds(), Ifault(), Pickup()],
    claim: { coordination: true },
  }),
  relay({
    id: 'h3',
    name: 'Distance, and the two zones',
    terms: ['distancerelay', 'zone', 'apparentimpedance'],
    params: [FaultKm(), Zline(), Pickup(), Tds()],
    views: ['rx', 'relayplot', 'table', 'reading', 'math'],
    view: 'rx',
    claim: { zones: true },
  }),
  relay({
    id: 'h4',
    name: 'Infeed lengthens the reach',
    terms: ['infeed', 'distancerelay', 'zone'],
    params: [Infeed(), TapKm(), FaultKm(), Zline()],
    views: ['rx', 'relayplot', 'table', 'reading', 'math'],
    view: 'rx',
    claim: { infeed: true },
  }),
]
