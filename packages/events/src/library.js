// The gate library: what each kind computes, and how long it takes.
//
// Time is an integer number of picoseconds everywhere in this package. That is
// the whole reason a discrete-event simulator can call itself exact: an event
// at 70 ps plus a delay of 70 ps lands at 140 ps, and no addition of times ever
// rounds. Seconds appear only where a number is shown to a reader, through
// `ns()` and `ps()` below.
//
// The delays are this lab's library, not a datasheet. They are chosen so that
// the arithmetic a student does on paper is the arithmetic the engine does: an
// inverter is 30 ps, a NAND is 50, an AND is a NAND and an inverter at 70, and
// an XOR is 90. Every one of them is a knob, and every number a lesson quotes
// is computed from the knob rather than typed in.

/** One picosecond, in seconds. Times in this package are integers of this unit. */
export const PS = 1e-12
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

/** The library's delay for a cell of this kind and fan-in, in picoseconds. */
export function libDelay(kind, fanIn, lib = {}) {
  const over = lib[kind]
  if (typeof over === 'number') return over
  if (over && over[fanIn] != null) return over[fanIn]
  const spec = KINDS[kind]
  return spec && spec.delay[fanIn]
}

/** What `kind` computes for the input vector `v` (an array of 0 and 1). */
export function evalKind(kind, v) {
  return KINDS[kind].fn(v)
}
