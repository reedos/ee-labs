// The experiments: each is a machine, the knobs on it, which view opens, and a
// claim its note makes.
//
// The machine is a spec for @ee-labs/machines, which solves it exactly.
// The note is prose, and prose drifts, so experiments.test.js loads every
// experiment at its defaults and measures the claim its note makes. A claim
// the test cannot measure does not ship.
//
// Groups follow the plan. A the DC machine, B the transformer, C the rotating
// field and the induction machine, D the synchronous and permanent-magnet
// machines with the dq frame, E losses and the thermal limit.

import { EXPERIMENTS as A, GROUP as GA } from './groups/a.js'
import { EXPERIMENTS as B, GROUP as GB } from './groups/b.js'
import { EXPERIMENTS as C, GROUP as GC } from './groups/c.js'
import { EXPERIMENTS as D, GROUP as GD } from './groups/d.js'
import { EXPERIMENTS as E, GROUP as GE } from './groups/e.js'
import { LESSONS } from './lessons.js'

export const GROUPS = [GA, GB, GC, GD, GE]

/** Every view a lower pane can show, in the order the view switch lists them. */
export const VIEW_ORDER = [
  'reading',
  'torquespeed',
  'curve',
  'angle',
  'phasors',
  'field',
  'dq',
  'scope',
  'phaseplane',
  'state',
  'power',
  'efficiency',
  'heat',
  'bh',
]

/** What the view switch calls each view, and what it shows. */
export const VIEW_LABELS = {
  reading: { label: 'Reading', title: 'Every meter on the machine at once, in the units the quantity is measured in' },
  torquespeed: { label: 'Torque–speed', title: 'Torque against speed: the machine line, the load line, and where they cross' },
  curve: { label: 'Torque curve', title: 'Torque against slip and against speed, with breakdown marked' },
  angle: { label: 'Power angle', title: 'Power against the angle between the rotor flux and the stator flux' },
  phasors: { label: 'Phasors', title: 'Each steady-state voltage and current as an arrow, drawn to scale' },
  field: { label: 'Rotating field', title: 'The three phase currents and the one travelling wave they add up to' },
  dq: { label: 'dq frame', title: 'The three-phase set and the two-axis pair, at the same instant' },
  scope: { label: 'Scope', title: 'Current, speed and torque against time, drag to move the cursor' },
  phaseplane: { label: 'Phase plane', title: 'Armature current against speed, the path from standstill to the operating point' },
  state: { label: 'State equation', title: 'ẋ = Ax + Bu as built, with the rotor row named in mechanical units' },
  power: { label: 'Power', title: 'Where every watt goes, with the two totals matching' },
  efficiency: { label: 'Efficiency', title: 'Efficiency against load, and the load at which it peaks' },
  heat: { label: 'Temperature', title: 'The rise against time, and the insulation class the machine must stay under' },
  bh: { label: 'Flux curve', title: 'Flux linkage against current, with the saturation model named' },
}

const ALL = [...A, ...B, ...C, ...D, ...E]

/** Every experiment, with its lesson merged on. */
export const EXPERIMENTS = ALL.map((e) => ({ ...e, ...(LESSONS[e.id] || {}) }))

export const byId = (id) => EXPERIMENTS.find((e) => e.id === id)

/** The experiments of one group, in order. */
export const inGroup = (group) => EXPERIMENTS.filter((e) => e.group === group)
