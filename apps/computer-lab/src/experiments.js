// The experiments: each is a machine as a function of its knobs, which of the
// engine's runs it wants, and which pane best shows the claim.
//
// The machine is data for `src/engine`, which runs it exactly. The note is
// prose, and prose drifts, so `experiments.test.js` loads every experiment at
// its defaults and measures the claim its note makes. A claim the test cannot
// measure does not ship.
//
// Groups follow the plan: A arithmetic, B the register file and the memory, C
// the single-cycle machine, D control, E pipelining, F the memory hierarchy, G
// the machine and the world.

import { LESSONS } from './lessons.js'
import { A } from './groups/a.js'
import { B } from './groups/b.js'
import { C } from './groups/c.js'
import { D } from './groups/d.js'
import { E } from './groups/e.js'
import { F } from './groups/f.js'
import { G } from './groups/g.js'
import { GROUPS } from './groups/shared.js'

export { GROUPS }

/** Every pane a view switch can show, in the order it lists them. */
export const VIEW_ORDER = ['datapath', 'schedule', 'cachemap', 'trace', 'program', 'budget', 'timing', 'state', 'paths', 'control', 'counts']

export const VIEW_LABELS = {
  datapath: { label: 'Datapath', title: 'The whole datapath, with the value on every wire in this cycle' },
  schedule: { label: 'Schedule', title: 'One row an instruction, one column a cycle, each cell its stage' },
  cachemap: { label: 'Cache', title: 'The cache set by set and way by way, with the line this reference used' },
  trace: { label: 'Trace', title: 'The address list, with hit or miss beside each and the running rate' },
  program: { label: 'Program', title: 'The instructions with their fields decoded, and the register file' },
  budget: { label: 'Budget', title: 'The clock period broken into the blocks that make it' },
  timing: { label: 'Timing', title: 'Every signal against time, drawn as the instants it changed at' },
  state: { label: 'States', title: 'The control unit as states and arcs, with the state it is in lit' },
  paths: { label: 'Paths', title: 'Every endpoint of the netlist, and the gates along its longest path' },
  control: { label: 'Control', title: 'The control unit’s truth table, nine signals for twelve opcodes' },
  counts: { label: 'Numbers', title: 'Every reading this experiment produces, with the path a lesson reads it by' },
}

const RAW = [...A, ...B, ...C, ...D, ...E, ...F, ...G]

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
