// The experiments, merged from the group files in plan order.
//
// This file holds no prose and no numbers. Each group lane owns its own
// `groups/<letter>.js`, so two lanes never edit one file, and the order here is
// the order of RANDOM_LAB_PLAN.md section 5.

import A, { GROUP_A } from './groups/a.js'
import B, { GROUP_B } from './groups/b.js'
import C, { GROUP_C } from './groups/c.js'
import D, { GROUP_D } from './groups/d.js'
import E, { GROUP_E } from './groups/e.js'
import F, { GROUP_F } from './groups/f.js'
import G, { GROUP_G } from './groups/g.js'
import H, { GROUP_H } from './groups/h.js'
import I, { GROUP_I } from './groups/i.js'

/** The sidebar's group headers, in course order. */
export const GROUPS = [GROUP_A, GROUP_B, GROUP_C, GROUP_D, GROUP_E, GROUP_F, GROUP_G, GROUP_H, GROUP_I]

/** Every experiment, in sidebar order. `n of 30` is the position a reader sees. */
export const EXPERIMENTS = [...A, ...B, ...C, ...D, ...E, ...F, ...G, ...H, ...I]

/** One experiment by id, or undefined. */
export const byId = (id) => EXPERIMENTS.find((e) => e.id === id)

/** The views any experiment can open, and the label each carries in the switch. */
export const VIEWS = {
  scope: 'One run',
  ensemble: 'Ensemble',
  histogram: 'Histogram',
  outcome: 'Outcome',
  correlation: 'Correlation',
  density: 'Density',
  matched: 'Matched filter',
  errorrate: 'Error rate',
  wiener: 'Wiener',
  kalman: 'Kalman',
  ktc: 'kT over C',
}
