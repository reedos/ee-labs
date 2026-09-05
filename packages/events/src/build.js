// The netlists the lab is built from, with fixed names.
//
// Every one of these is a function of its knobs, so an experiment that widens
// an adder or slows a gate rebuilds the netlist rather than editing a copy of
// it. The signal names are the contract: a lesson that reads `cout` reads the
// same wire in every experiment that uses the adder, and the brief lists them.

import { FLOP } from './library.js'
import { evaluate, truthTable } from './analyse.js'
import { expressionOf, minimalCover, netFromCover, primeImplicants } from './boolean.js'

const input = (id, value = 0) => ({ id, kind: 'input', value })

/** One gate with its inputs as primary inputs: the first thing a reader meets. */
export function oneGate(kind, { ins = ['a', 'b'], values = [0, 0], id = 'y', delay } = {}) {
  return {
    name: `one ${kind.toUpperCase()} gate`,
    sources: ins.map((s, i) => input(s, values[i])),
    gates: [{ id, kind, in: ins, ...(delay ? { delay } : {}) }],
    outputs: [id],
  }
}

/**
 * NAND as the only gate there is: NOT, AND, OR and XOR built from it.
 *
 * With `reference` the library's own cell for the same function is put in the
 * same netlist as `ref`, so one run measures both the built gate and the cell
 * it replaces.
 */
export function nandOnly(which, { a = 0, b = 0, reference = false } = {}) {
  const nets = {
    not: { gates: [{ id: 'y', kind: 'nand', in: ['a', 'a'] }], ins: ['a'] },
    and: { gates: [{ id: 'n1', kind: 'nand', in: ['a', 'b'] }, { id: 'y', kind: 'nand', in: ['n1', 'n1'] }], ins: ['a', 'b'] },
    or: { gates: [{ id: 'na', kind: 'nand', in: ['a', 'a'] }, { id: 'nb', kind: 'nand', in: ['b', 'b'] }, { id: 'y', kind: 'nand', in: ['na', 'nb'] }], ins: ['a', 'b'] },
    xor: {
      gates: [
        { id: 'n1', kind: 'nand', in: ['a', 'b'] },
        { id: 'n2', kind: 'nand', in: ['a', 'n1'] },
        { id: 'n3', kind: 'nand', in: ['b', 'n1'] },
        { id: 'y', kind: 'nand', in: ['n2', 'n3'] },
      ],
      ins: ['a', 'b'],
    },
  }
  const spec = nets[which]
  const values = { a, b }
  const gates = [...spec.gates]
  if (reference) gates.push({ id: 'ref', kind: which, in: spec.ins })
  return {
    name: `${which.toUpperCase()} from NAND gates`,
    sources: spec.ins.map((s) => input(s, values[s])),
    gates,
    outputs: reference ? ['y', 'ref'] : ['y'],
  }
}

/**
 * The two sides of one Boolean identity, in one netlist, so a single run
 * measures both truth tables and both delays.
 *
 * `lhs` and `rhs` are the two outputs. The identity is true when the two agree
 * in every row, and the point of each is that they agree while costing
 * different gates.
 */
export const IDENTITIES = {
  absorption: { law: 'a + a·b = a', vars: ['a', 'b'] },
  distribution: { law: 'a·(b + c) = a·b + a·c', vars: ['a', 'b', 'c'] },
  demorgan: { law: "(a·b)' = a' + b'", vars: ['a', 'b'] },
  consensus: { law: "a·b + a'·c = a·b + a'·c + b·c", vars: ['a', 'b', 'c'] },
}

export function identityNet(which, values = {}) {
  const spec = IDENTITIES[which]
  if (!spec) throw new Error(`this engine has no identity called "${which}"`)
  const sources = spec.vars.map((s) => input(s, values[s] ?? 0))
  const gates = {
    absorption: [
      { id: 'ab', kind: 'and', in: ['a', 'b'] },
      { id: 'lhs', kind: 'or', in: ['a', 'ab'] },
      { id: 'rhs', kind: 'buf', in: ['a'] },
    ],
    distribution: [
      { id: 'bc', kind: 'or', in: ['b', 'c'] },
      { id: 'lhs', kind: 'and', in: ['a', 'bc'] },
      { id: 'ab', kind: 'and', in: ['a', 'b'] },
      { id: 'ac', kind: 'and', in: ['a', 'c'] },
      { id: 'rhs', kind: 'or', in: ['ab', 'ac'] },
    ],
    demorgan: [
      { id: 'lhs', kind: 'nand', in: ['a', 'b'] },
      { id: 'na', kind: 'not', in: ['a'] },
      { id: 'nb', kind: 'not', in: ['b'] },
      { id: 'rhs', kind: 'or', in: ['na', 'nb'] },
    ],
    consensus: [
      { id: 'na', kind: 'not', in: ['a'] },
      { id: 'p', kind: 'and', in: ['a', 'b'] },
      { id: 'q', kind: 'and', in: ['na', 'c'] },
      { id: 'lhs', kind: 'or', in: ['p', 'q'] },
      { id: 'r', kind: 'and', in: ['b', 'c'] },
      { id: 'rhs', kind: 'or', in: ['p', 'q', 'r'] },
    ],
  }[which]
  return { name: spec.law, sources, gates, outputs: ['lhs', 'rhs'] }
}

/**
 * A chain of `n` gates of one kind, with a step at its head. The output's
 * arrival is the sum of the delays along it, which is the only thing D1 claims.
 */
export function chain(n = 4, { kind = 'buf', at = 200, from = 0, to = 1, delay } = {}) {
  const gates = Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}`, kind, in: [i === 0 ? 'a' : `g${i}`], ...(delay ? { delay } : {}) }))
  return { name: `a chain of ${n} ${kind} gates`, sources: [{ id: 'a', kind: 'step', at, from, to }], gates, outputs: [`g${n}`] }
}

/**
 * The static-1 hazard, y = a·b + a'·c. With b and c both 1 the output is 1 for
 * either value of a, and the two paths from a reconverge on the OR with the
 * inverter's delay between them. `consensus` adds the b·c term the Karnaugh
 * map draws as the bridge between the two loops, and the pulse goes away.
 */
export function hazardNet({ a = 1, b = 1, c = 1, consensus = false } = {}) {
  const gates = [
    { id: 'na', kind: 'not', in: ['a'] },
    { id: 'p', kind: 'and', in: ['a', 'b'] },
    { id: 'q', kind: 'and', in: ['na', 'c'] },
  ]
  if (consensus) {
    gates.push({ id: 'r', kind: 'and', in: ['b', 'c'] })
    gates.push({ id: 'y', kind: 'or', in: ['p', 'q', 'r'] })
  } else {
    gates.push({ id: 'y', kind: 'or', in: ['p', 'q'] })
  }
  return { name: consensus ? 'the hazard covered' : 'the static-1 hazard', sources: [input('a', a), input('b', b), input('c', c)], gates, outputs: ['y'] }
}

/** A two-to-one multiplexer, y = a·s' + b·s. */
export function mux2({ a = 0, b = 1, s = 0 } = {}) {
  return {
    name: 'a two-to-one multiplexer',
    sources: [input('a', a), input('b', b), input('s', s)],
    gates: [
      { id: 'ns', kind: 'not', in: ['s'] },
      { id: 'm0', kind: 'and', in: ['a', 'ns'] },
      { id: 'm1', kind: 'and', in: ['b', 's'] },
      { id: 'y', kind: 'or', in: ['m0', 'm1'] },
    ],
    outputs: ['y'],
  }
}

/** A two-to-four decoder: one output high, chosen by a1 a0. */
export function decoder24({ a1 = 0, a0 = 0 } = {}) {
  return {
    name: 'a two-to-four decoder',
    sources: [input('a1', a1), input('a0', a0)],
    gates: [
      { id: 'n1', kind: 'not', in: ['a1'] },
      { id: 'n0', kind: 'not', in: ['a0'] },
      { id: 'd0', kind: 'and', in: ['n1', 'n0'] },
      { id: 'd1', kind: 'and', in: ['n1', 'a0'] },
      { id: 'd2', kind: 'and', in: ['a1', 'n0'] },
      { id: 'd3', kind: 'and', in: ['a1', 'a0'] },
    ],
    outputs: ['d0', 'd1', 'd2', 'd3'],
  }
}

/** A half adder: sum and carry from two bits. */
export function halfAdder({ a = 0, b = 0 } = {}) {
  return {
    name: 'a half adder',
    sources: [input('a', a), input('b', b)],
    gates: [
      { id: 's', kind: 'xor', in: ['a', 'b'] },
      { id: 'c', kind: 'and', in: ['a', 'b'] },
    ],
    outputs: ['s', 'c'],
  }
}

/** A full adder: sum and carry-out from two bits and a carry-in. */
export function fullAdder({ a = 0, b = 0, cin = 0 } = {}) {
  return {
    name: 'a full adder',
    sources: [input('a', a), input('b', b), input('cin', cin)],
    gates: [
      { id: 'x', kind: 'xor', in: ['a', 'b'] },
      { id: 's', kind: 'xor', in: ['x', 'cin'] },
      { id: 'g', kind: 'and', in: ['a', 'b'] },
      { id: 'p', kind: 'and', in: ['x', 'cin'] },
      { id: 'cout', kind: 'or', in: ['g', 'p'] },
    ],
    outputs: ['s', 'cout'],
  }
}

/**
 * The gates of an `n`-bit ripple-carry adder, reading whatever drives its bits.
 * Bit 0 is the least significant, the carry runs c1, c2, … to `cout`, and the
 * partial sums are x0, x1, …. Kept separate from the sources so the same
 * gates sit between registers in `pipelinedAdder` with no second copy.
 */
export function rippleGates(n, { a = (i) => `a${i}`, b = (i) => `b${i}`, cin = 'cin' } = {}) {
  const gates = []
  for (let i = 0; i < n; i++) {
    const carryIn = i === 0 ? cin : `c${i}`
    const carryOut = i === n - 1 ? 'cout' : `c${i + 1}`
    gates.push({ id: `x${i}`, kind: 'xor', in: [a(i), b(i)] })
    gates.push({ id: `s${i}`, kind: 'xor', in: [`x${i}`, carryIn] })
    gates.push({ id: `g${i}`, kind: 'and', in: [a(i), b(i)] })
    gates.push({ id: `p${i}`, kind: 'and', in: [`x${i}`, carryIn] })
    gates.push({ id: carryOut, kind: 'or', in: [`g${i}`, `p${i}`] })
  }
  return gates
}

/**
 * An `n`-bit ripple-carry adder with its bits held as inputs. The critical
 * path is the carry chain, and its length is what group C measures.
 */
export function rippleAdder(n = 4, { a = 0, b = 0, cin = 0 } = {}) {
  const bitOf = (word, i) => (word >> i) & 1
  const sources = []
  for (let i = 0; i < n; i++) {
    sources.push(input(`a${i}`, bitOf(a, i)))
    sources.push(input(`b${i}`, bitOf(b, i)))
  }
  sources.push(input('cin', cin))
  return { name: `a ${n}-bit ripple-carry adder`, sources, gates: rippleGates(n), outputs: [...Array.from({ length: n }, (_, i) => `s${i}`), 'cout'] }
}

/** The cross-coupled NOR pair: the first circuit in the suite that remembers. */
export function srLatch({ s = 0, r = 0, q = 0 } = {}) {
  return {
    name: 'the set-reset latch',
    sources: [input('s', s), input('r', r)],
    gates: [
      { id: 'q', kind: 'nor', in: ['r', 'qn'], init: q },
      { id: 'qn', kind: 'nor', in: ['s', 'q'], init: q ^ 1 },
    ],
    outputs: ['q', 'qn'],
  }
}

/** A level-sensitive D latch on NAND gates: transparent while `g` is high. */
export function dLatch({ d = 0, g = 0, q = 0 } = {}) {
  return {
    name: 'the D latch',
    sources: [input('d', d), input('g', g)],
    gates: [
      { id: 'nd', kind: 'not', in: ['d'] },
      { id: 'sa', kind: 'nand', in: ['d', 'g'] },
      { id: 'ra', kind: 'nand', in: ['nd', 'g'] },
      { id: 'q', kind: 'nand', in: ['sa', 'qn'], init: q },
      { id: 'qn', kind: 'nand', in: ['ra', 'q'], init: q ^ 1 },
    ],
    outputs: ['q', 'qn'],
  }
}

/**
 * The edge-triggered flip-flop as two latches, master then slave, on opposite
 * clock phases. Built from gates rather than from the `flops` primitive, so a
 * lesson can watch the master close before the slave opens.
 */
export function masterSlave({ d = 0, period = 2000, q = 0 } = {}) {
  return {
    name: 'a flip-flop from two latches',
    sources: [{ id: 'clk', kind: 'clock', period, high: period / 2 }, input('d', d)],
    gates: [
      { id: 'nclk', kind: 'not', in: ['clk'] },
      { id: 'nd', kind: 'not', in: ['d'] },
      { id: 'ma', kind: 'nand', in: ['d', 'nclk'] },
      { id: 'mb', kind: 'nand', in: ['nd', 'nclk'] },
      // The master is transparent while the clock is low, so it starts holding
      // D. Starting it anywhere else is an inconsistent initial state, and the
      // pair then chases itself for as long as the run lasts.
      { id: 'm', kind: 'nand', in: ['ma', 'mn'], init: d },
      { id: 'mn', kind: 'nand', in: ['mb', 'm'], init: d ^ 1 },
      { id: 'nm', kind: 'not', in: ['m'] },
      { id: 'sa', kind: 'nand', in: ['m', 'clk'] },
      { id: 'sb', kind: 'nand', in: ['nm', 'clk'] },
      { id: 'q', kind: 'nand', in: ['sa', 'qn'], init: q },
      { id: 'qn', kind: 'nand', in: ['sb', 'q'], init: q ^ 1 },
    ],
    outputs: ['q', 'qn'],
  }
}

/**
 * One flip-flop with the launch and capture clocks separated by a wire, so
 * skew is a delay a reader can turn. `d` arrives through `logic` gates of the
 * given delay, which is how the setup and hold groups make a violation happen.
 */
export function onePath({ period = 1000, skew = 0, logic = 200, tsu = FLOP.tsu, th = FLOP.th, tcq = FLOP.tcq } = {}) {
  const gates = [{ id: 'mid', kind: 'buf', in: ['q1'], delay: logic }]
  const wires = skew > 0 ? [{ id: 'clk2', from: 'clk', delay: skew }] : []
  return {
    name: 'one flip-flop to the next',
    sources: [{ id: 'clk', kind: 'clock', period, high: Math.round(period / 2) }, input('din', 1)],
    gates,
    wires,
    flops: [
      { id: 'q1', d: 'din', clk: 'clk', tcq, tsu, th, init: 0 },
      { id: 'q2', d: 'mid', clk: skew > 0 ? 'clk2' : 'clk', tcq, tsu, th, init: 0 },
    ],
    outputs: ['q2'],
  }
}

/**
 * A register, an adder and a register: the shape every synchronous design has,
 * and the one whose clock period the critical path decides. The operands are
 * launched from flip-flops rather than held as inputs, so the path the clock
 * has to fit is a whole clock-to-Q, the carry chain, and a setup time.
 *
 * `skew` is how much later the capturing clock arrives than the launching one,
 * as the delay of a wire between them.
 */
export function pipelinedAdder(n = 4, { period = 1000, a = 5, b = 3, cin = 0, skew = 0 } = {}) {
  const bitOf = (word, i) => (word >> i) & 1
  const sources = [{ id: 'clk', kind: 'clock', period, high: Math.round(period / 2) }]
  const flops = []
  for (let i = 0; i < n; i++) {
    sources.push(input(`a${i}`, bitOf(a, i)))
    sources.push(input(`b${i}`, bitOf(b, i)))
    flops.push({ id: `ra${i}`, d: `a${i}`, clk: 'clk', init: 0 })
    flops.push({ id: `rb${i}`, d: `b${i}`, clk: 'clk', init: 0 })
  }
  sources.push(input('cin', cin))
  const capture = skew > 0 ? 'clk2' : 'clk'
  for (let i = 0; i < n; i++) flops.push({ id: `r${i}`, d: `s${i}`, clk: capture, init: 0 })
  flops.push({ id: 'rc', d: 'cout', clk: capture, init: 0 })
  return {
    name: `a ${n}-bit adder between registers`,
    sources,
    gates: rippleGates(n, { a: (i) => `ra${i}`, b: (i) => `rb${i}`, cin: 'cin' }),
    wires: skew > 0 ? [{ id: 'clk2', from: 'clk', delay: skew }] : [],
    flops,
    outputs: [...Array.from({ length: n }, (_, i) => `r${i}`), 'rc'],
  }
}

/**
 * A ring of an odd number of inverters: the netlist with no settled state.
 *
 * The stages start alternating, so exactly one of them disagrees with its own
 * input at t = 0 and the wave travels from there. Starting them all at the
 * same value is the symmetric state, where every stage flips together and the
 * period comes out as two gate delays instead of two laps.
 */
export function ring(n = 3, { delay } = {}) {
  const gates = Array.from({ length: n }, (_, i) => ({ id: `i${i}`, kind: 'not', in: [`i${(i + n - 1) % n}`], init: i % 2, ...(delay ? { delay } : {}) }))
  return { name: `a ring of ${n} inverters`, sources: [], gates, outputs: ['i0'] }
}

/**
 * A synchronous binary counter, `n` bits, counting every rising edge.
 *
 * Bit i toggles when every bit below it is 1, and that condition is carried up
 * the counter one AND at a time: `e(i) = e(i-1) · q(i-1)`. It is the ripple
 * adder's carry chain in another shape, and it grows by one AND per bit for
 * the same reason.
 */
export function counter(n = 4, { period = 1000 } = {}) {
  const gates = []
  const flops = []
  for (let i = 0; i < n; i++) flops.push({ id: `q${i}`, d: `d${i}`, clk: 'clk', init: 0 })
  // Bit 0 toggles every clock, so its enable is a constant and needs no gate.
  gates.push({ id: 'd0', kind: 'not', in: ['q0'] })
  const enable = (i) => (i === 1 ? 'q0' : `e${i}`)
  for (let i = 2; i < n; i++) gates.push({ id: `e${i}`, kind: 'and', in: [enable(i - 1), `q${i - 1}`] })
  for (let i = 1; i < n; i++) gates.push({ id: `d${i}`, kind: 'xor', in: [`q${i}`, enable(i)] })
  return {
    name: `a ${n}-bit synchronous counter`,
    sources: [{ id: 'clk', kind: 'clock', period, high: Math.round(period / 2) }],
    gates,
    flops,
    outputs: Array.from({ length: n }, (_, i) => `q${i}`),
  }
}

/**
 * A finite state machine, from its description.
 *
 * The description is the specification a reader writes down first:
 *
 *   { name, inputs: ['x'], states: ['s0', 's1', 's2'], reset: 's0',
 *     next: (state, v) => state, out: (state, v) => ({ y: 0 }) }
 *
 * `next` and `out` are functions of the state name and an object of input
 * bits. A machine whose `out` reads `v` is a Mealy machine and one whose `out`
 * ignores it is a Moore machine, and `fsmTable` says which it is by testing.
 *
 * The build is the whole design flow, in order: enumerate the state table,
 * encode the states, minimise each next-state bit and each output bit with
 * Quine–McCluskey, and build the two-level logic that results. Every step is
 * exact and every step is inspectable.
 */
export function fsmTable(spec) {
  const states = spec.states
  const ins = spec.inputs
  const bits = Math.max(1, Math.ceil(Math.log2(states.length)))
  const code = Object.fromEntries(states.map((s, i) => [s, i]))
  const rows = []
  for (let si = 0; si < states.length; si++) {
    for (let vi = 0; vi < 2 ** ins.length; vi++) {
      const v = Object.fromEntries(ins.map((s, k) => [s, (vi >> (ins.length - 1 - k)) & 1]))
      const to = spec.next(states[si], v)
      if (!states.includes(to)) throw new Error(`the machine's next state from ${states[si]} is "${to}", which is not one of its states`)
      rows.push({ state: states[si], code: code[states[si]], in: v, next: to, nextCode: code[to], out: spec.out(states[si], v) })
    }
  }
  const outNames = Object.keys(rows[0].out)
  const moore = rows.every((r) => {
    const same = rows.filter((x) => x.state === r.state)
    return same.every((x) => outNames.every((o) => x.out[o] === same[0].out[o]))
  })
  return { states, inputs: ins, bits, code, rows, outputs: outNames, type: moore ? 'Moore' : 'Mealy', unused: 2 ** bits - states.length }
}

/** The minimised equations of a state table, one per next-state bit and per output. */
export function fsmEquations(spec) {
  const table = fsmTable(spec)
  const vars = [...Array.from({ length: table.bits }, (_, i) => `q${table.bits - 1 - i}`), ...table.inputs]
  const n = vars.length
  const indexOf = (r) => {
    let i = 0
    for (let k = 0; k < table.bits; k++) i = (i << 1) | ((r.code >> (table.bits - 1 - k)) & 1)
    for (const s of table.inputs) i = (i << 1) | r.in[s]
    return i
  }
  const used = new Set(table.rows.map(indexOf))
  const dontCare = Array.from({ length: 2 ** n }, (_, i) => i).filter((i) => !used.has(i))
  const eq = {}
  const targets = [
    ...Array.from({ length: table.bits }, (_, k) => ({ name: `d${table.bits - 1 - k}`, of: (r) => (r.nextCode >> (table.bits - 1 - k)) & 1 })),
    ...table.outputs.map((o) => ({ name: o, of: (r) => r.out[o] })),
  ]
  for (const t of targets) {
    const minterms = table.rows.filter((r) => t.of(r) === 1).map(indexOf)
    const primes = primeImplicants(minterms, n, dontCare)
    const cover = minterms.length ? minimalCover(minterms, primes, n) : { cover: [], essential: [], literals: 0, cubes: 0 }
    eq[t.name] = { ...cover, minterms, expression: expressionOf(cover.cover, vars) }
  }
  return { table, vars, dontCare, equations: eq }
}

/** The netlist of a state machine: its minimised logic, and one flip-flop per state bit. */
export function fsmNet(spec, opts = {}) {
  const { table, vars, equations } = fsmEquations(spec)
  const period = opts.period ?? 1000
  const values = opts.values || {}
  const sources = [{ id: 'clk', kind: 'clock', period, high: Math.round(period / 2) }, ...table.inputs.map((s) => input(s, values[s] ?? 0))]
  const gates = []
  const seen = new Set()
  for (const [name, cover] of Object.entries(equations)) {
    // A bit that is 0 in every row, or 1 in every row, is a tie-off rather than
    // a gate. It becomes a source held at that value, which is what a reader
    // would draw and what the gate count should say.
    if (!cover.cover.length) {
      sources.push(input(name, 0))
      continue
    }
    if (cover.cover.length === 1 && cover.cover[0].mask === 0) {
      sources.push(input(name, 1))
      continue
    }
    const piece = netFromCover(cover.cover, vars, { output: name })
    for (const g of piece.gates) {
      const id = g.id === name ? name : `${name}_${g.id}`
      if (seen.has(id)) continue
      seen.add(id)
      gates.push({ ...g, id, in: g.in.map((s) => (vars.includes(s) ? s : `${name}_${s}`)) })
    }
  }
  const start = table.code[spec.reset ?? table.states[0]]
  const flops = Array.from({ length: table.bits }, (_, k) => {
    const bit = table.bits - 1 - k
    return { id: `q${bit}`, d: `d${bit}`, clk: 'clk', init: (start >> bit) & 1 }
  })
  return { name: spec.name || 'a state machine', sources, gates, flops, outputs: [...table.outputs, ...flops.map((f) => f.id)], spec, table }
}

/** The truth table of a built netlist, for the test that the build kept the specification. */
export const tableOf = (net) => truthTable(net)
export { evaluate }
