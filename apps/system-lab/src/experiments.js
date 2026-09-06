// The experiments, merged from the group files in plan order.
//
// A group file holds the chain, the knobs and what the headline reads. It holds
// no prose. The prose lives in lessons/, and it is merged onto each experiment
// here, so that a group's physics and a group's writing can be worked on
// separately and neither file grows past reading.
//
// The merge happens at module load. Importing lessons.js first would leave it
// half done, which is why prose.test.js reads the lessons off EXPERIMENTS.

import { A } from './groups/a.js'
import { LESSONS } from './lessons.js'

/** Every view a lower pane can show, in the order the view switch lists them. */
export const VIEW_ORDER = ['table', 'levels', 'numbers']

/** What the view switch calls each view, and the hover text that says what it shows. */
export const VIEW_LABELS = {
  table: { label: 'Table', title: 'One row per block and one column per budget, cumulative or as each block’s share' },
  levels: { label: 'Levels', title: 'The signal and the noise at every node, and the gap between them' },
  numbers: { label: 'Numbers', title: 'Every closed form this experiment used, with the formula it came from' },
}

// The groups, in the order the sidebar lists them. A group whose phase has not
// landed yet contributes nothing, and the sidebar does not offer an empty tab:
// a reader never meets a heading with no experiments under it.
const ALL_GROUPS = [
  'A · The chain as a budget',
  'B · The noise budget',
  'C · The linearity budget',
  'D · Dynamic range',
  'E · The link budget',
  'F · Power and the whole system',
]

const RAW = [...A]

/** The groups that have experiments in them, in plan order. */
export const GROUPS = ALL_GROUPS.filter((g) => RAW.some((e) => e.group === g))

/** Every experiment, with its lesson merged on. */
export const EXPERIMENTS = RAW.map((e) => ({ ...e, ...(LESSONS[e.id] || {}) }))

/** An experiment by id. */
export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))

/** The default settings of an experiment, as the object every analysis takes. */
export function defaultsOf(id) {
  const exp = byId[id]
  if (!exp) throw new Error(`No experiment ${id}`)
  return Object.fromEntries(exp.params.map((k) => [k.key, k.default]))
}

/** The experiments of one group, in order. */
export const groupOf = (name) => EXPERIMENTS.filter((e) => e.group === name)

/** The letter of an experiment's group, for the sidebar and the progression test. */
export const letterOf = (exp) => exp.group.slice(0, 1)

/** The label and hover text for a view. */
export const viewLabel = (view) => VIEW_LABELS[view] || { label: view, title: '' }
