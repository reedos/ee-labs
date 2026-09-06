// The gate library: what each kind computes, and how long it takes.
//
// Time is an integer everywhere in this package, counted in the unit the
// netlist declares. That is the whole reason a discrete-event simulator can
// call itself exact: an event at 70 plus a delay of 70 lands at 140, and no
// addition of times ever rounds.
//
// The unit is an exact rational number of seconds, and it defaults to one
// picosecond. A lab whose natural time is not a round number of picoseconds
// picks its own: a 9600 baud bit time is 1/9600 of a second, and with a unit of
// 1/(3 × 10¹¹) s that bit time is 31 250 000 units and a 30 ps gate beside it
// is 9 units. Both exact, both integers, in one netlist.
//
// The delays are this lab's library, not a datasheet. They are chosen so that
// the arithmetic a student does on paper is the arithmetic the engine does: an
// inverter is 30 ps, a NAND is 50, an AND is a NAND and an inverter at 70, and
// an XOR is 90. Every one of them is a knob, and every number a lesson quotes
// is computed from the knob rather than typed in.

/** One picosecond, in seconds. The default time unit. */
export const PS = 1e-12
/** The default unit as the exact rational the netlist carries. */
export const PS_UNIT = { num: 1, den: 1e12 }
/** `n` nanoseconds as an integer number of picoseconds. */
export const ns = (n) => Math.round(n * 1000)
/** `t` picoseconds in seconds, for display. */
export const seconds = (t) => t * PS

const and = (v) => v.reduce((a, b) => a & b)
const or = (v) => v.reduce((a, b) => a | b)
const xor = (v) => v.reduce((a, b) => a ^ b)

/**
 * Each gate kind: how many inputs it takes, what it computes, and the delay of
 * a cell with that many inputs. A fan-in the table does not list is refused,
 * because a delay this package cannot state is a number it will not invent.
 */
export const KINDS = {
  not: { name: 'NOT', fanIn: [1, 1], fn: ([a]) => a ^ 1, delay: { 1: 30 } },
  buf: { name: 'BUF', fanIn: [1, 1], fn: ([a]) => a, delay: { 1: 40 } },
  and: { name: 'AND', fanIn: [2, 4], fn: and, delay: { 2: 70, 3: 80, 4: 90 } },
  or: { name: 'OR', fanIn: [2, 4], fn: or, delay: { 2: 70, 3: 80, 4: 90 } },
  nand: { name: 'NAND', fanIn: [2, 4], fn: (v) => and(v) ^ 1, delay: { 2: 50, 3: 60, 4: 70 } },
  nor: { name: 'NOR', fanIn: [2, 4], fn: (v) => or(v) ^ 1, delay: { 2: 50, 3: 60, 4: 70 } },
  xor: { name: 'XOR', fanIn: [2, 3], fn: xor, delay: { 2: 90, 3: 130 } },
  xnor: { name: 'XNOR', fanIn: [2, 3], fn: (v) => xor(v) ^ 1, delay: { 2: 90, 3: 130 } },
}

/** A wire is a cell with no logic in it. Its delay is the interconnect's. */
export const WIRE_DELAY = 10

/** The flip-flop's three times, in picoseconds. */
export const FLOP = { tcq: 80, tsu: 40, th: 20 }

/** The kinds a reader can pick from, in the order the picker lists them. */
export const KIND_ORDER = ['not', 'buf', 'and', 'or', 'nand', 'nor', 'xor', 'xnor']

/**
 * The kinds one netlist may use: this library, plus whatever the netlist
 * registers of its own.
 *
 * `packages/events` stays general. A lab that needs a cell this library does
 * not have registers it on its own netlist rather than adding it here, so the
 * VLSI Lab's extracted cells and the Interfaces Lab's pin models never become
 * this package's business. A registered cell is
 * `{ name, fanIn: [lo, hi], fn: (v) => 0 | 1, delay: { [fanIn]: units } }`.
 */
export function kindsOf(extra) {
  if (!extra) return KINDS
  const out = { ...KINDS }
  for (const [name, spec] of Object.entries(extra)) {
    if (typeof spec.fn !== 'function' || !Array.isArray(spec.fanIn)) throw new Error(`the cell "${name}" needs a fanIn range and a function of its inputs`)
    out[name] = { name: spec.name || name.toUpperCase(), fanIn: spec.fanIn, fn: spec.fn, delay: spec.delay || {} }
  }
  return out
}

/** The library's delay for a cell of this kind and fan-in, in the netlist's units. */
export function libDelay(kind, fanIn, lib = {}, cells = KINDS) {
  const over = lib[kind]
  if (typeof over === 'number') return over
  if (over && over[fanIn] != null) return over[fanIn]
  const spec = cells[kind]
  return spec && spec.delay[fanIn]
}

/** What `kind` computes for the input vector `v` (an array of 0 and 1). */
export function evalKind(kind, v, cells = KINDS) {
  return cells[kind].fn(v)
}
