// The experiments, merged from the group files in plan order.
//
// A group file holds the geometry, the knobs and how to analyse it. It holds no
// prose. The prose lives in lessons/, and it is merged onto each experiment
// here, so that a group's physics and a group's writing can be worked on
// separately and neither file grows past reading.
//
// The merge happens at module load. Importing lessons.js first would leave it
// half done, which is why prose.test.js reads the lessons off EXPERIMENTS.

import { A } from './groups/a.js'
import { B } from './groups/b.js'
import { C } from './groups/c.js'
import { D } from './groups/d.js'
import { E } from './groups/e.js'
import { F_GROUP } from './groups/f.js'
import { LESSONS } from './lessons.js'

/** Every view a lower pane can show, in the order the view switch lists them. */
export const VIEW_ORDER = ['2d', 'profile', 'numbers', 'mesh', 'flux', 'circuit', 'wave', 'interface', 'bounce', 'line', 'smith', 'sweep', 'guide', 'pattern']

/** What the view switch calls each view, and the hover text that says what it shows. */
export const VIEW_LABELS = {
  '2d': { label: 'Map', title: 'The field over the geometry, with its equipotentials and its field lines' },
  profile: { label: 'Profile', title: 'One cut through the map, drawn as a curve against position' },
  numbers: { label: 'Numbers', title: 'Every closed form for this geometry, with the formula it came from' },
  mesh: { label: 'Mesh', title: 'The three refinements, the change between the last two, and the guard’s verdict' },
  flux: { label: 'Flux', title: 'The contour, the flux through it, and the charge it encloses' },
  circuit: { label: 'Circuit', title: 'The magnetic circuit as a circuit, with its reluctances in series' },
  wave: { label: 'Wave', title: 'The plane wave in space, with its polarisation ellipse' },
  interface: { label: 'Interface', title: 'The incident, reflected and transmitted waves at a boundary' },
  bounce: { label: 'Bounce', title: 'The ladder diagram, with the load’s trace beside it' },
  line: { label: 'Line', title: 'Voltage and current along the line at one instant' },
  smith: { label: 'Smith', title: 'The chart, with the load marked and the rotation towards the generator' },
  sweep: { label: 'Sweep', title: 'One quantity against frequency, or against length' },
  guide: { label: 'Guide', title: 'The mode chart, and the field across the guide' },
  pattern: { label: 'Pattern', title: 'The radiation pattern in polar form, with the beamwidth marked' },
}

/** The groups, in the order the sidebar lists them. */
export const GROUPS = [
  'A · Charge and the field',
  'B · Capacitance',
  'C · Laplace on a grid',
  'D · Current and resistance',
  'E · Magnetostatics',
  'F · Induction',
]

const RAW = [...A, ...B, ...C, ...D, ...E, ...F_GROUP]

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

/** Whether this experiment's headline came from a grid, and so is quoted to the guard's figures. */
export const isGrid = (exp) => exp.kind === 'grid'
