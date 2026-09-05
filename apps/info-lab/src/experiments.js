// The experiments: each names a source, a code, a channel or an encoder as a
// function of its knobs, and says which pane best shows its claim.
//
// The objects are data for `@ee-labs/codes`, which counts them exactly. The
// note is prose, and prose drifts, so experiments.test.js loads every
// experiment at its defaults and measures the claim its note makes. A claim the
// test cannot measure does not ship.
//
// Groups follow the plan: A entropy and source coding, B capacity and the
// Shannon limit, C block codes, D convolutional codes and Viterbi, E LDPC and
// belief propagation. Group F measures the coding gain against the
// Communications Lab's curve, and waits on that lab (BACKLOG.md).

import { LESSONS } from './lessons.js'
import { A } from './groups/a.js'
import { B } from './groups/b.js'
import { C } from './groups/c.js'
import { D } from './groups/d.js'
import { E } from './groups/e.js'
import { GROUPS } from './groups/shared.js'

export { GROUPS }

/** Every pane a view switch can show, in the order it lists them. */
export const VIEW_ORDER = ['source', 'tree', 'curve', 'table', 'weights', 'field', 'trellis', 'tanner', 'decode', 'channel']

export const VIEW_LABELS = {
  source: { label: 'Source', title: 'Each symbol with its probability, its ideal length and its codeword' },
  tree: { label: 'Code tree', title: 'The Huffman tree, and the arithmetic coder’s interval below it' },
  curve: { label: 'Curve', title: 'The quantity this experiment sweeps, with the present setting marked' },
  table: { label: 'Code table', title: 'The generator matrix, the parity checks and the syndrome table' },
  weights: { label: 'Weights', title: 'How many words have each weight, with the two radii marked' },
  field: { label: 'Field', title: 'The powers of the primitive element, and the Reed-Solomon code over them' },
  trellis: { label: 'Trellis', title: 'States down and time across, with the survivor into each state' },
  tanner: { label: 'Tanner graph', title: 'Bits, checks, and the belief on each edge between them' },
  decode: { label: 'Decode', title: 'What was sent, what arrived, and what the decoder made of it' },
  channel: { label: 'Channel', title: 'The channel’s own numbers, and the capacity that follows from them' },
}

const RAW = [...A, ...B, ...C, ...D, ...E]

/** Each experiment with its lesson merged on, so the app reads one object. */
export const EXPERIMENTS = RAW.map((e) => ({ ...e, ...(LESSONS[e.id] || {}) }))

export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))

/** The default setting of every knob of `id`. */
export function defaultsOf(id) {
  const e = byId[id]
  return Object.fromEntries(e.params.map((k) => [k.key, k.default]))
}

/** The experiment's own note, as the two registers joined. */
export const noteOf = (e) => `${e.see} ${e.why}`
