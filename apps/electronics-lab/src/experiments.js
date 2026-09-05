// The experiments: each is a circuit, the knobs on it, how to draw it, a note
// that makes a claim, and which pane best shows the claim.
//
// The shape is Circuit Elements Lab's, with two fields added. `model` is the
// device model the experiment opens with, so that a lesson comparing two
// models names which one it is describing. `small` is the id of the source the
// amplitude guard watches, so the small-signal ghost knows when to turn amber.
//
// One file per group under `groups/`, merged here in plan order, and the prose
// for each in `lessons/`. Nothing in this file knows what a transistor is: the
// netlist is data for @ee-labs/network, which solves it exactly, and
// experiments.test.js loads every experiment at its defaults and measures the
// claim its note makes.

import { LESSONS } from './lessons.js'
export * from './knobs.js'
import { GROUP_A } from './groups/a.js'
import { GROUP_C } from './groups/c.js'
import { GROUP_D } from './groups/d.js'
import { GROUP_E } from './groups/e.js'
import { GROUP_F, GROUP_F_NAME } from './groups/f.js'
import { GROUP_G, GROUP_G_NAME } from './groups/g.js'
import { GROUP_H } from './groups/h.js'
import { GROUP_I } from './groups/i.js'
import { GROUP_J } from './groups/j.js'
import { GROUP_K } from './groups/k.js'
import { GROUP_L } from './groups/l.js'
import { GROUP_M } from './groups/m.js'

// Every view a lower pane can show, in the order the view switch lists them —
// the same order in every experiment, so a tab sits in the same place from one
// to the next.
export const VIEW_ORDER = ['reading', 'scope', 'curves', 'transfer', 'bode', 'pz', 'spectrum', 'junction', 'equations']

export const VIEW_LABELS = {
  reading: { label: 'Reading', title: 'The operating point, every meter on the circuit at once, and the headline number' },
  scope: { label: 'Scope', title: 'Voltages against time, exact inside every region, with the small-signal prediction as a ghost' },
  curves: { label: 'Device curves', title: 'The collector or drain current against its own voltage, the load line, and the point where they meet' },
  transfer: { label: 'Transfer', title: 'Output against input from the quasi-static sweep, with the tangent at the operating point' },
  bode: { label: 'Bode', title: '|H| in dB and ∠H against log frequency, from the exact polynomials' },
  pz: { label: 'Poles and zeros', title: 'The poles and zeros of the small-signal transfer function, as numbers on the plane' },
  spectrum: { label: 'Spectrum', title: 'The output’s harmonics, with the second-harmonic distortion beside them' },
  junction: { label: 'Junction', title: 'The depletion region drawn to scale against the bias, with its capacitance beside it' },
  equations: { label: 'Equations', title: 'The small-signal netlist printed as elements, then the rows the solver built' },
}

/** The label and hover text for a view. */
export const viewLabel = (view) => VIEW_LABELS[view]

export const GROUPS = [
  'A · The op-amp as a user meets it',
  'C · Inside the junction',
  'D · The transistor as a controlled source',
  'E · Signal and bias take different paths',
  GROUP_F_NAME,
  GROUP_G_NAME,
  'H · Single-stage amplifiers',
  'I · Mirrors, active loads, and stacking',
  'J · The differential pair',
  'K · Frequency response',
  'L · Feedback',
  'M · Inside the op-amp',
]

// ------------------------------------------------------------ the list

/** Every group's experiments, in the plan's order. */
const RAW = [...GROUP_A, ...GROUP_C, ...GROUP_D, ...GROUP_E, ...GROUP_F, ...GROUP_G, ...GROUP_H, ...GROUP_I, ...GROUP_J, ...GROUP_K, ...GROUP_L, ...GROUP_M]

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

/** The elements a schematic draws, with the labels the layout gives them. */
export function drawables(exp, p) {
  const net = exp.net(p)
  const labels = exp.labels || {}
  return net.elements.map((e) => (labels[e.id] ? { ...e, label: labels[e.id] } : e))
}

/** Does this experiment have a time axis? */
export const isDynamic = (exp) => typeof exp.window === 'function'

/** The group letter of an experiment, from its group heading. */
export const letterOf = (group) => group.slice(0, 1)
