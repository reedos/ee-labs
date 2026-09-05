// The experiments: each is a netlist as a function of its knobs, which of the
// engine's analyses it wants, and which pane best shows the claim.
//
// The netlist is data for @ee-labs/events, which simulates it exactly. The note
// is prose, and prose drifts, so experiments.test.js loads every experiment at
// its defaults and measures the claim its note makes. A claim the test cannot
// measure does not ship.
//
// Groups follow the plan: A the gate and its truth table, B Boolean algebra and
// the Karnaugh map, C the multiplexer, the decoder and the adder, D propagation
// delay and the glitch, E the latch and the flip-flop, F registers and counters
// and the built machine, G the clock, H metastability.

import { LESSONS } from './lessons.js'
import { A } from './groups/a.js'
import { B } from './groups/b.js'
import { C } from './groups/c.js'
import { D } from './groups/d.js'
import { E } from './groups/e.js'
import { F } from './groups/f.js'
import { G } from './groups/g.js'
import { H } from './groups/h.js'
import { GROUPS } from './groups/shared.js'

export { GROUPS }

/** Every pane a view switch can show, in the order it lists them. */
export const VIEW_ORDER = ['timing', 'gates', 'state', 'table', 'kmap', 'paths', 'rate', 'events']

export const VIEW_LABELS = {
  timing: { label: 'Timing', title: 'Every signal against time, drawn as the instants it changed at' },
  gates: { label: 'Gates', title: 'The netlist as gates and wires, with each signal’s present value' },
  state: { label: 'States', title: 'The machine as states and arcs, with the state it is in lit' },
  table: { label: 'Truth table', title: 'Every row of the netlist’s truth table, with the present input vector lit' },
  kmap: { label: 'Karnaugh map', title: 'The map in Gray-code order, with the minimum cover drawn as loops' },
  rate: { label: 'Rate', title: 'The metastability model, its four parameters and the three things it assumes' },
  paths: { label: 'Paths', title: 'Every endpoint’s longest and shortest arrival, and the gates along the path' },
  events: { label: 'Events', title: 'The event list: what changed, when, and which event caused it' },
}

const RAW = [...A, ...B, ...C, ...D, ...E, ...F, ...G, ...H]

/** Each experiment with its lesson merged on, so the app reads one object. */
export const EXPERIMENTS = RAW.map((e) => ({ ...e, ...(LESSONS[e.id] || {}) }))

export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))

/** The default setting of every knob of `id`. */
export function defaultsOf(id) {
  const e = byId[id]
  return Object.fromEntries(e.params.map((k) => [k.key, k.default]))
}

/** The signals a timing diagram draws for this experiment at this setting. */
export const signalsOf = (e, p) => (typeof e.signals === 'function' ? e.signals(p) : e.signals || [])

/** The bus rows the timing diagram groups, or none. */
export const bussesOf = (e, p) => (typeof e.busses === 'function' ? e.busses(p) : e.busses || [])

/** The experiment's own note, as the two registers joined. */
export const noteOf = (e) => `${e.see} ${e.why}`
