// Group J: dispatch, and the grid as one system.
// GRID_LAB_PLAN.md §5, group J.

import { Demand, Cap1 } from './shared.js'

const dispatch = (over) => ({
  kind: 'dispatch',
  group: 'Dispatch',
  views: ['cost', 'table', 'reading', 'math'],
  view: 'cost',
  ...over,
})

export const GROUP_J = [
  dispatch({
    id: 'j1',
    name: 'Equal incremental cost',
    terms: ['incrementalcost', 'lambda', 'dispatch'],
    params: [Demand(), Cap1()],
    claim: { lambda: true },
  }),
  dispatch({
    id: 'j2',
    name: 'What the next megawatt costs',
    terms: ['incrementalcost', 'lambda', 'marginalcost'],
    params: [Demand(), Cap1(300)],
    view: 'table',
    claim: { marginal: true },
  }),
]
