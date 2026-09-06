// Control: the multicycle machine as a state machine, and the truth table
// behind the single-cycle one.
//
// The Logic Lab builds a finite state machine from a specification and
// minimises it. This is the same idea doing a job. Five states, and each
// instruction walks the ones it needs, so an arithmetic instruction takes four
// cycles and a load takes five.
//
// The single-cycle machine's control is not a state machine at all. It is nine
// signals from a six-bit opcode, which is one truth table of twelve rows, and
// `isa.js` holds it.

import { CARD, gates, overheadOf } from './card.js'
import { CONTROL_SIGNALS, OPS, OP_NAMES, classOf, controlOf } from './isa.js'

/** The five states, in the order an instruction walks them. */
export const STATES = ['fetch', 'decode', 'execute', 'memory', 'writeback']

export const STATE_LABEL = { fetch: 'fetch', decode: 'decode', execute: 'execute', memory: 'memory', writeback: 'write back' }

/** Which states each class of instruction visits. */
export const SEQUENCE = {
  arith: ['fetch', 'decode', 'execute', 'writeback'],
  load: ['fetch', 'decode', 'execute', 'memory', 'writeback'],
  store: ['fetch', 'decode', 'execute', 'memory'],
  branch: ['fetch', 'decode', 'execute'],
  jump: ['fetch', 'decode', 'execute'],
}

/**
 * The machine as states and arcs, for the state diagram.
 *
 * Every arc carries the class of instruction that takes it, and the state's
 * own output is what it asserts, so the picture and the table say the same
 * thing.
 */
export function stateMachine() {
  const edges = []
  for (const [cls, seq] of Object.entries(SEQUENCE)) {
    for (let k = 0; k + 1 < seq.length; k++) edges.push({ from: seq[k], to: seq[k + 1], label: cls, out: { class: cls } })
    edges.push({ from: seq[seq.length - 1], to: 'fetch', label: `${cls} done`, out: { class: cls } })
  }
  // One arc a pair, with the classes that share it named together.
  const merged = []
  for (const e of edges) {
    const had = merged.find((m) => m.from === e.from && m.to === e.to)
    if (had) had.classes.push(e.label)
    else merged.push({ from: e.from, to: e.to, classes: [e.label] })
  }
  return {
    states: STATES,
    encoding: Object.fromEntries(STATES.map((s, i) => [s, i.toString(2).padStart(3, '0')])),
    edges: merged.map((m) => ({ from: m.from, to: m.to, label: m.classes.join(', '), out: { state: m.to } })),
  }
}

/** How many cycles each class takes on the multicycle machine. */
export const cyclesOf = (cls) => SEQUENCE[cls].length

/**
 * The multicycle machine's mean cycle count over the stated mix, and the time
 * that comes to at its own clock period.
 *
 * Its clock is set by the slowest single block rather than by the longest path
 * through all of them, which is the whole of D3.
 */
export function multicycleOf(card = CARD) {
  const period = Math.max(...Object.values(card.blocks).map((n) => gates(n, card))) + overheadOf(card)
  const perClass = Object.fromEntries(Object.keys(SEQUENCE).map((cls) => [cls, cyclesOf(cls)]))
  const cpi = Object.entries(card.mix).reduce((sum, [cls, share]) => sum + share * perClass[cls], 0)
  return { period, perClass, cpi, time: cpi * period, states: STATES.length }
}

/** The state sequence one program walks, cycle by cycle. */
export function walkOf(program) {
  const rows = []
  let cycle = 0
  for (const instr of program) {
    const cls = classOf(instr.op)
    for (const state of SEQUENCE[cls]) rows.push({ cycle: cycle++, state, instr, cls })
  }
  return { rows, cycles: cycle, retired: program.length, cpi: program.length ? cycle / program.length : 0 }
}

/**
 * The control unit's whole truth table: nine signals for each of the twelve
 * opcodes, which is D1.
 */
export function controlTable() {
  return {
    signals: CONTROL_SIGNALS,
    rows: OP_NAMES.map((op) => ({ op, opcode: OPS[op].op, funct: OPS[op].funct ?? null, cls: classOf(op), out: controlOf(op) })),
  }
}
