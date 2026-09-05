// The experiments: each is a doped structure, the knobs on it, a note that
// makes a claim, and which pane best shows the claim.
//
// The shape is Circuit Elements Lab's, with the netlist replaced by a
// structure. There are no circuits in this lab. A structure is a stack of doped
// layers, `structure` names which kind it is, and `math.js` evaluates the
// closed forms over it. One file per group under `groups/`, merged here in plan
// order, and the prose for each in `lessons/`.

import { LESSONS } from './lessons.js'
export * from './knobs.js'
import { GROUP_A } from './groups/a.js'
import { GROUP_B } from './groups/b.js'
import { GROUP_C } from './groups/c.js'
import { GROUP_D } from './groups/d.js'
import { GROUP_E } from './groups/e.js'
import { GROUP_F } from './groups/f.js'
import { GROUP_G } from './groups/g.js'

// Every view a lower pane can show, in the order the view switch lists them.
// The same order in every experiment, so a tab sits in the same place from one
// experiment to the next.
export const VIEW_ORDER = ['reading', 'profile', 'band', 'cv', 'curves', 'sequence', 'equations']

export const VIEW_LABELS = {
  reading: { label: 'Reading', title: 'Every quantity the structure produces at this setting, with the headline number first' },
  profile: { label: 'Profile', title: 'Charge density, field and potential against position, on one axis, redrawn by the bias knob' },
  band: { label: 'Band diagram', title: 'The conduction and valence edges, the intrinsic level and the Fermi level against position' },
  cv: { label: 'C–V curve', title: 'Capacitance against gate voltage at both frequencies, with the three regimes marked' },
  curves: { label: 'Device curves', title: 'The current against the voltage that controls it, with the operating point marked' },
  sequence: { label: 'Sequence', title: 'The fabrication steps in order, and the one number each of them sets' },
  equations: { label: 'Equations', title: 'The closed forms behind the numbers, printed with the constants they were evaluated at' },
}

/** The label and hover text for a view. */
export const viewLabel = (view) => VIEW_LABELS[view]

export const GROUPS = [
  'A · Carriers and doping',
  'B · The junction in depth',
  'C · The MOS capacitor',
  'D · The MOSFET',
  'E · The BJT from two junctions',
  'F · The solar cell and the LED',
  'G · Fabrication',
]

// ------------------------------------------------------------ the list

/** Every group's experiments, in the plan's order. */
const RAW = [...GROUP_A, ...GROUP_B, ...GROUP_C, ...GROUP_D, ...GROUP_E, ...GROUP_F, ...GROUP_G]

/**
 * The experiments, with each one's lesson merged onto it. `note` is see + why,
 * which is what a report quotes and what the prose lint measures.
 */
export const EXPERIMENTS = RAW.map((e) => {
  const lesson = LESSONS[e.id]
  if (!lesson) throw new Error(`${e.id} has no lesson`)
  return { ...e, ...lesson, note: `${lesson.see} ${lesson.why}` }
})

export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))

/** The default value of every knob of an experiment. */
export function defaultsOf(id) {
  const exp = typeof id === 'string' ? byId[id] : id
  return Object.fromEntries(exp.params.map((k) => [k.key, k.default]))
}

/** The group letter of an experiment, from its group heading. */
export const letterOf = (group) => group.slice(0, 1)
