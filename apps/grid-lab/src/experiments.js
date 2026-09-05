// The experiments: each is a network or a machine, the knobs on it, a note
// that makes a claim, and which pane best shows the claim.
//
// The models are `@ee-labs/grid`'s, which solves them exactly or names the
// guard where it does not. The note is prose, and prose drifts, so
// `experiments.test.js` loads every experiment at its defaults and measures
// the claim its note makes, from the same analysis the panes draw. A number in
// a note that the engine does not reproduce fails a test rather than
// misleading a reader.
//
// Groups follow GRID_LAB_PLAN.md §5, in plan order. The plan's letters live in
// the ids and nowhere a reader sees them.

import { LESSONS } from './lessons.js'
import { GROUP_A } from './groups/a.js'
import { GROUP_B } from './groups/b.js'
import { GROUP_C } from './groups/c.js'
import { GROUP_D } from './groups/d.js'
import { GROUP_E } from './groups/e.js'
import { GROUP_F } from './groups/f.js'
import { GROUP_G } from './groups/g.js'
import { GROUP_H } from './groups/h.js'
import { GROUP_I } from './groups/i.js'
import { GROUP_J } from './groups/j.js'

export const GROUPS = [
  'Per unit',
  'Three phase',
  'The line and the transformer',
  'Power flow',
  'The DC power flow',
  'Symmetrical components',
  'Faults',
  'Protection',
  'The machine on the grid',
  'Dispatch',
]

/** What each group sets out to establish, read once at its boundary. */
export const GROUP_INTROS = {
  'Per unit': 'Pick one base power and one base voltage, and every other base follows. Every quantity in this lab then has two readings, and the toggle in the topbar converts them all at once.',
  'Three phase': 'Three sources 120° apart feeding three equal loads is one circuit. What balance buys is a neutral that carries nothing, a per-phase circuit that carries the whole answer, and an instantaneous power that does not pulse.',
  'The line and the transformer': 'A line is a series impedance with half its charging at each end. That lumping is an approximation, and this group measures where it stops and switches to the exact form.',
  'Power flow': 'A load takes the same power whatever its voltage, so the current depends on the answer. That makes the network nonlinear, and Newton is how a simulator solves it.',
  'The DC power flow': 'Drop the resistance, pin every magnitude at 1.00 pu, and replace sin θ by θ. What is left is one linear solve, and this group measures what each assumption cost.',
  'Symmetrical components': 'Any three phasors are one balanced positive set, one balanced negative set and one zero set. The transform is a change of basis, so it loses nothing.',
  Faults: 'A fault is a connection between the three sequence networks at one bus. There are four ways to make it, each gives a closed form, and this group works through all four.',
  Protection: 'A relay is a curve and a comparison. Both sides of the comparison come from a solve this lab already does, so nothing here is approximate.',
  'The machine on the grid': 'A generator holds an angle against the network, and a fault moves it. The equal-area criterion says exactly how far it may move, and integrating the swing equation turns that angle into a time.',
  Dispatch: 'Three units supply one demand. The cheapest split puts every free unit at the same incremental cost, which is one equation and a bisection.',
}

export const VIEW_ORDER = [
  'oneline',
  'newton',
  'pvcurve',
  'phasors',
  'wave',
  'sequence',
  'pdelta',
  'rotor',
  'relayplot',
  'rx',
  'cost',
  'lineplot',
  'table',
  'reading',
  'math',
]

// A view is either a picture or a panel of numbers, and the screen shows one
// of each at once: the plot above, the panel below. Every experiment therefore
// offers at least one of each, which `experiments.test.js` checks.
export const PLOT_VIEWS = ['oneline', 'newton', 'pvcurve', 'phasors', 'wave', 'sequence', 'pdelta', 'rotor', 'relayplot', 'rx', 'cost', 'lineplot']
export const PANEL_VIEWS = ['table', 'reading', 'math']
export const isPlot = (v) => PLOT_VIEWS.includes(v)

export const VIEW_LABELS = {
  oneline: { label: 'One line', title: 'The network as one line per circuit, with an arrow at each branch end whose length is the real flow' },
  newton: { label: 'Newton', title: 'The power mismatch against the iteration that produced it, on a logarithmic axis, with the Jacobian rows beside it' },
  pvcurve: { label: 'P–V curve', title: 'The low bus voltage against loading, to the last loading that has a solution' },
  phasors: { label: 'Phasors', title: 'The three phase currents, and the three balanced sets they add up to' },
  wave: { label: 'Instant', title: 'Instantaneous power over one cycle, one phase and all three together' },
  sequence: { label: 'Sequence', title: 'The three sequence networks side by side, with the connection the fault makes between them' },
  pdelta: { label: 'P–δ plane', title: 'The three power curves against rotor angle, with the accelerating and decelerating areas shaded' },
  rotor: { label: 'Rotor swing', title: 'Rotor angle against time, with the clearing instant marked and the integrator named' },
  relayplot: { label: 'Relay curve', title: 'Operating time against current on logarithmic axes, with both relays and the margin between them' },
  rx: { label: 'R–X plane', title: 'The distance relay’s two zones and the impedance it measures at this fault' },
  cost: { label: 'Cost', title: 'Incremental cost against output for each unit, with the common λ across them' },
  lineplot: { label: 'Line', title: 'The line’s own quantities against its length, with the exact form beside the lumped one' },
  table: { label: 'Table', title: 'The numbers this experiment is about, laid out as rows' },
  reading: { label: 'Reading', title: 'Every meter this experiment has at once' },
  math: { label: 'Math', title: 'Every formula the note leans on, evaluated beside what the engine measured' },
}

export const EXPERIMENTS = [...GROUP_A, ...GROUP_B, ...GROUP_C, ...GROUP_D, ...GROUP_E, ...GROUP_F, ...GROUP_G, ...GROUP_H, ...GROUP_I, ...GROUP_J]

// What the student reads lives in lessons.js: `see` at the defaults, `try` as
// knob moves with their readings, and `why` as the reasoning. `note` is the
// two prose registers run together, for the places that quote one paragraph.
for (const e of EXPERIMENTS) {
  const lesson = LESSONS[e.id]
  if (!lesson) throw new Error(`no lesson for ${e.id}`)
  Object.assign(e, lesson)
  e.note = `${lesson.see} ${lesson.why}`
}

export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))

/** The default setting of every knob an experiment has. */
export function defaultsOf(id) {
  const e = typeof id === 'string' ? byId[id] : id
  return Object.fromEntries(e.params.map((k) => [k.key, k.default]))
}

/** The groups in order, each with its experiments. */
export const byGroup = GROUPS.map((g) => ({ group: g, items: EXPERIMENTS.filter((e) => e.group === g) }))

/** Every cross-reference a lesson makes to another lab, for the progression test. */
export const CROSS_REFS = EXPERIMENTS.filter((e) => e.crossRef).map((e) => ({ from: e.id, ...e.crossRef }))
