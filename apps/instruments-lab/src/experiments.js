// The experiments: each is an instrument drawn as the circuit it is, the knobs
// on it, a lesson that makes a claim, and which view best shows the claim.
//
// The netlist is data for @ee-labs/network, which solves it exactly. The lesson
// is prose, and prose drifts, so experiments.test.js loads every experiment at
// its defaults and measures the claim its sentences make. A claim the test
// cannot measure does not ship.
//
// Groups follow the plan. A the oscilloscope's input and its probe, B the
// sampling scope, C the multimeter, D the spectrum analyser as a swept filter,
// E the lock-in amplifier, F uncertainty.
//
// An experiment with a capacitor or an inductor in it is dynamic: `window(p)`
// is the span of time shown, `cursor` the fraction of it the schematic's meters
// read at, and `scope` which waveforms are drawn on which axis. An experiment
// with `sweep(p)` gets a frequency view, drawn from one complex solve per point.

export * from './kit.js'
import { LESSONS } from './lessons.js'
import { GROUP_A } from './groups/a.js'
import { GROUP_B } from './groups/b.js'
import { GROUP_C } from './groups/c.js'
import { GROUP_D } from './groups/d.js'
import { GROUP_E } from './groups/e.js'
import { GROUP_F } from './groups/f.js'

// ------------------------------------------------------------ the list
/**
 * Every experiment, in course order, with its lesson merged on. `see`, `try`
 * and `why` live in lessons/, so a group's circuit and a group's prose are two
 * files and two lanes.
 */
export const EXPERIMENTS = [...GROUP_A, ...GROUP_B, ...GROUP_C, ...GROUP_D, ...GROUP_E, ...GROUP_F].map((e) => {
  const lesson = LESSONS[e.id] || {}
  return { ...e, ...lesson, note: lesson.see && lesson.why ? `${lesson.see} ${lesson.why}` : '' }
})

export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))

/** The default setting of every knob of an experiment. */
export function defaultsOf(id) {
  const exp = typeof id === 'string' ? byId[id] : id
  return Object.fromEntries(exp.params.map((k) => [k.key, k.default]))
}

/** The elements the schematic draws, in the order the netlist lists them. */
export const drawables = (exp, p) => exp.net(p).elements

/** The label and hover text for a view. */
export const viewLabel = (view) => VIEW_LABELS[view]
