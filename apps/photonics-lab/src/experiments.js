// The experiments, merged from the group files in plan order.
//
// A group file holds the physics, the knobs and the views. It holds no prose.
// The prose lives in lessons/, and it is merged onto each experiment here, so
// that a group's physics and a group's writing can be worked on separately and
// neither file grows past reading.
//
// The merge happens at module load. Importing lessons.js first would leave it
// half done, which is why prose.test.js reads the lessons off EXPERIMENTS.

import { A } from './groups/a.js'
import { E } from './groups/e.js'
import { F_GROUP } from './groups/f.js'
import { LESSONS } from './lessons.js'

/** Every view a lower pane can show, in the order the view switch lists them. */
export const VIEW_ORDER = ['schematic', 'curve', 'pulse', 'link', 'cavity', 'spectrum', 'numbers']

/** What the view switch calls each view, and the hover text that says what it shows. */
export const VIEW_LABELS = {
  schematic: { label: 'Circuit', title: 'The photodiode, its bias and its load, with the solved voltages and currents on it' },
  curve: { label: 'Curve', title: 'The experiment’s quantity against the knob it depends on, with the setting marked' },
  pulse: { label: 'Pulse', title: 'One pulse entering the fibre and the same pulse leaving it, with both widths printed' },
  link: { label: 'Link', title: 'The transmitter, the fibre and the receiver, with the budget drawn under them' },
  cavity: { label: 'Cavity', title: 'The transmission against frequency, with the range, the finesse and the linewidth marked' },
  spectrum: { label: 'Spectrum', title: 'The channel grid across the band, with the source’s own width beside one channel' },
  numbers: { label: 'Numbers', title: 'Every closed form this experiment uses, with the formula it came from' },
}

// The groups, in the order the sidebar lists them. A group whose sitting has
// not landed yet contributes nothing, and the sidebar does not offer an empty
// tab: a reader never meets a heading with no experiments under it.
const ALL_GROUPS = [
  'A · Light, and the photodiode',
  'B · The receiver',
  'C · The LED and the laser',
  'D · The rate equations',
  'E · The fibre',
  'F · The cavity, and many colours',
]

const RAW = [...A, ...E, ...F_GROUP]

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
