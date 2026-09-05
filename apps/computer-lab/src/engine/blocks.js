// The blocks, as netlists for @ee-labs/events at this lab's model card.
//
// Group A and Group B are gate-level, so their numbers are not stated here.
// They are measured by the same discrete-event engine the Logic Lab runs, on a
// netlist a reader can see, with this lab's delays reaching it through the
// netlist's own `lib` field. A ripple carry is 64 gate delays because the
// engine adds 32 carries of two gates each, and not because this file says so.
//
// The one place a delay is stated rather than measured is the model card's
// table of block delays (`card.js`), which the datapath uses. A memory and a
// register file are arrays of cells, and simulating a thousand of them would
// measure the array rather than teach the machine.

import { criticalPath, normalize, rippleGates, simulate, timingPaths } from '@ee-labs/events'
import { CARD, UNIT, gates, libOf, psOf } from './card.js'

const input = (id, value = 0) => ({ id, kind: 'input', value })
const bitOf = (word, i) => (word >>> i) & 1

/** The shell every netlist here shares: this lab's grid and this lab's delays. */
const netOf = (name, parts, card = CARD) => ({ name, unit: UNIT, lib: libOf(card), ...parts })

/**
 * An `n`-bit ripple-carry adder, with the carry as a step so the reader can
 * watch it walk. The gates are the Logic Lab's own `rippleGates`, so the
 * circuit is the one that lab builds and only the delays are this lab's.
 */
export function rippleAdder(n = 32, { a = -1, b = 0, cin = 0, step = null, at = 0, card = CARD } = {}) {
  const sources = []
  for (let i = 0; i < n; i++) {
    sources.push(input(`a${i}`, bitOf(a, i)))
    sources.push(input(`b${i}`, bitOf(b, i)))
  }
  sources.push(step === 'cin' ? { id: 'cin', kind: 'step', at, from: cin, to: cin ^ 1 } : input('cin', cin))
  return netOf(`a ${n}-bit ripple-carry adder`, {
    sources,
    gates: rippleGates(n),
    outputs: [...Array.from({ length: n }, (_, i) => `s${i}`), 'cout'],
  }, card)
}

/**
 * One level of carry lookahead, over up to four items.
 *
 * Each item hands up a generate and a propagate. `gpOf` builds the pair the
 * level above reads, and `carriesOf` builds the carry into every item but the
 * first, once the carry into the level itself has a name.
 *
 * The carry into item k is one AND-OR level over k + 1 terms, which is why a
 * lookahead unit costs two gate delays whatever its width, and why the width
 * is capped at four by the library's fan-in.
 */
function gpOf(tag, items) {
  const gates = []
  const terms = []
  const m = items.length
  for (let i = m - 1; i >= 0; i--) {
    const ps = items.slice(i + 1, m).map((x) => x.p)
    if (!ps.length) terms.push(items[i].g)
    else {
      const id = `${tag}G_${i}`
      gates.push({ id, kind: 'and', in: [...ps, items[i].g] })
      terms.push(id)
    }
  }
  gates.push({ id: `${tag}G`, kind: 'or', in: terms })
  gates.push({ id: `${tag}P`, kind: 'and', in: items.map((x) => x.p) })
  return { gates, G: `${tag}G`, P: `${tag}P` }
}

/** The carry into each named item, from the carry into the level itself. */
function carriesOf(tag, items, cin, names) {
  const gates = []
  names.forEach((name, idx) => {
    const k = idx + 1
    const terms = []
    for (let i = k - 1; i >= 0; i--) {
      const ps = items.slice(i + 1, k).map((x) => x.p)
      if (!ps.length) terms.push(items[i].g)
      else {
        const id = `${tag}t${k}_${i}`
        gates.push({ id, kind: 'and', in: [...ps, items[i].g] })
        terms.push(id)
      }
    }
    const all = `${tag}t${k}c`
    gates.push({ id: all, kind: 'and', in: [...items.slice(0, k).map((x) => x.p), cin] })
    terms.push(all)
    gates.push({ id: name, kind: 'or', in: terms })
  })
  return gates
}

/**
 * A 32-bit adder with two levels of block lookahead over four-bit groups.
 *
 * The bits hand their generate and propagate to a group of four, the groups
 * hand theirs to a supergroup of four, and the two supergroups hand theirs to
 * the top. The top carry is then four AND-OR levels above the operands rather
 * than thirty-two, which is the whole of A2.
 */
export function lookaheadAdder(n = 32, { a = -1, b = 0, cin = 0, step = null, at = 0, card = CARD } = {}) {
  if (n !== 32) throw new Error(`this lookahead adder is two supergroups of four four-bit groups, so its width is 32 and not ${n}`)
  const sources = []
  for (let i = 0; i < n; i++) {
    sources.push(input(`a${i}`, bitOf(a, i)))
    sources.push(input(`b${i}`, bitOf(b, i)))
  }
  sources.push(step === 'cin' ? { id: 'cin', kind: 'step', at, from: cin, to: cin ^ 1 } : input('cin', cin))

  const gates = []
  for (let i = 0; i < n; i++) {
    gates.push({ id: `p${i}`, kind: 'xor', in: [`a${i}`, `b${i}`] })
    gates.push({ id: `g${i}`, kind: 'and', in: [`a${i}`, `b${i}`] })
  }
  const bitsOfGroup = (j) => [0, 1, 2, 3].map((i) => ({ g: `g${j * 4 + i}`, p: `p${j * 4 + i}` }))
  const carryName = (i) => (i === 0 ? 'cin' : `c${i}`)

  // Up the tree: every group's generate and propagate, then every supergroup's.
  const groups = []
  for (let j = 0; j < n / 4; j++) {
    const unit = gpOf(`b${j}_`, bitsOfGroup(j))
    gates.push(...unit.gates)
    groups.push({ g: unit.G, p: unit.P })
  }
  const supers = []
  for (let s = 0; s * 4 < groups.length; s++) {
    const unit = gpOf(`s${s}_`, groups.slice(s * 4, s * 4 + 4))
    gates.push(...unit.gates)
    supers.push({ g: unit.G, p: unit.P })
  }

  // Down the tree: the carry out at the top, then the carry into every
  // supergroup, every group and every bit.
  gates.push(...carriesOf('top', supers, 'cin', [carryName(16), 'cout']))
  supers.forEach((_, s) => gates.push(...carriesOf(`s${s}c`, groups.slice(s * 4, s * 4 + 4), carryName(16 * s), [carryName(16 * s + 4), carryName(16 * s + 8), carryName(16 * s + 12)])))
  groups.forEach((_, j) => gates.push(...carriesOf(`b${j}c`, bitsOfGroup(j), carryName(4 * j), [carryName(4 * j + 1), carryName(4 * j + 2), carryName(4 * j + 3)])))
  for (let i = 0; i < n; i++) gates.push({ id: `s${i}`, kind: 'xor', in: [`p${i}`, carryName(i)] })

  return netOf(`a ${n}-bit adder with two levels of lookahead`, {
    sources,
    gates,
    outputs: [...Array.from({ length: n }, (_, i) => `s${i}`), 'cout'],
  }, card)
}

/**
 * The arithmetic and logic unit: one adder, the logic units, and an output
 * multiplexer over them.
 *
 * Subtraction runs through the same adder with the second operand inverted and
 * a carry in of one, which is A3's second claim. The multiplexer sits on every
 * operation, and its two gate delays are what generality costs.
 */
export function alu32(n = 32, { a = 0, b = 0, fn = 'add', card = CARD } = {}) {
  const FNS = ['add', 'sub', 'and', 'or']
  if (!FNS.includes(fn)) throw new Error(`this netlist draws the ALU for ${FNS.join(', ')}, and not for "${fn}"`)
  const sub = fn === 'sub' ? 1 : 0
  const adder = lookaheadAdder(n, { a, b, cin: sub, card })
  const gates = [...adder.gates]
  const sources = adder.sources.filter((s) => s.id !== 'cin')
  sources.push(input('sub', sub))
  // The second operand passes an exclusive-or with the subtract signal, so one
  // adder does both operations.
  const bIn = []
  for (let i = 0; i < n; i++) {
    bIn.push({ id: `bx${i}`, kind: 'xor', in: [`b${i}`, 'sub'] })
    gates.push({ id: `land${i}`, kind: 'and', in: [`a${i}`, `b${i}`] })
    gates.push({ id: `lor${i}`, kind: 'or', in: [`a${i}`, `b${i}`] })
  }
  // Rewire the adder onto the inverted operand, and take its carry in from the
  // same subtract signal.
  for (const g of gates) {
    if (/^(p|g)\d+$/.test(g.id)) g.in = g.in.map((s) => (/^b\d+$/.test(s) ? `bx${s.slice(1)}` : s))
    g.in = g.in.map((s) => (s === 'cin' ? 'sub' : s))
  }
  gates.unshift(...bIn)
  // A two-bit function select, decoded, and one AND-OR multiplexer a bit.
  sources.push(input('f1', fn === 'and' || fn === 'or' ? 1 : 0), input('f0', fn === 'sub' || fn === 'or' ? 1 : 0))
  gates.push({ id: 'nf1', kind: 'not', in: ['f1'] }, { id: 'nf0', kind: 'not', in: ['f0'] })
  gates.push({ id: 'selAdd', kind: 'nor', in: ['f1', 'f0'] })
  gates.push({ id: 'selSub', kind: 'and', in: ['nf1', 'f0'] })
  gates.push({ id: 'selAnd', kind: 'and', in: ['f1', 'nf0'] })
  gates.push({ id: 'selOr', kind: 'and', in: ['f1', 'f0'] })
  for (let i = 0; i < n; i++) {
    gates.push({ id: `ma${i}`, kind: 'and', in: [`s${i}`, 'selAdd'] })
    gates.push({ id: `mb${i}`, kind: 'and', in: [`s${i}`, 'selSub'] })
    gates.push({ id: `mc${i}`, kind: 'and', in: [`land${i}`, 'selAnd'] })
    gates.push({ id: `md${i}`, kind: 'and', in: [`lor${i}`, 'selOr'] })
    gates.push({ id: `y${i}`, kind: 'or', in: [`ma${i}`, `mb${i}`, `mc${i}`, `md${i}`] })
  }
  return netOf(`a ${n}-bit arithmetic and logic unit`, { sources, gates, outputs: [...Array.from({ length: n }, (_, i) => `y${i}`), 'cout'] }, card)
}

/**
 * The register file's address decoder: five bits in, thirty-two word lines
 * out, exactly one of them high.
 *
 * Two levels of gates over the complemented address, which is B1. The card's
 * eight gate delays for a register file read cover this decode, the cell and
 * the read multiplexer, and this netlist measures the first of the three.
 */
export function decoder5to32({ addr = 0, card = CARD } = {}) {
  const sources = [0, 1, 2, 3, 4].map((i) => input(`a${i}`, (addr >> i) & 1))
  const gates = [0, 1, 2, 3, 4].map((i) => ({ id: `n${i}`, kind: 'not', in: [`a${i}`] }))
  const pair = (hi, lo, tag) => {
    for (let k = 0; k < 4; k++) {
      const one = (k >> 1) & 1
      const zero = k & 1
      gates.push({ id: `${tag}${k}`, kind: 'and', in: [one ? `a${hi}` : `n${hi}`, zero ? `a${lo}` : `n${lo}`] })
    }
  }
  pair(1, 0, 'l')
  pair(3, 2, 'h')
  const outputs = []
  for (let w = 0; w < 32; w++) {
    const low = w & 3
    const high = (w >> 2) & 3
    const top = (w >> 4) & 1
    gates.push({ id: `w${w}`, kind: 'and', in: [`l${low}`, `h${high}`, top ? 'a4' : 'n4'] })
    outputs.push(`w${w}`)
  }
  return netOf('a five-to-thirty-two decoder', { sources, gates, outputs }, card)
}

/**
 * A register, an adder and a register: the shape every stage of the pipeline
 * has, and the one whose clock period the critical path decides.
 *
 * The operands are launched from flip-flops rather than held as inputs, so the
 * path the clock has to fit is a whole clock-to-Q, the carry chain and a setup
 * time. That is the sum `fMax` reports, and E2 is the lesson about it.
 */
export function registeredAdder(n = 8, { period = 300000, a = 5, b = -1, toggle = true, card = CARD } = {}) {
  const sources = [{ id: 'clk', kind: 'clock', period, high: Math.round(period / 2) }]
  const flops = []
  const gates = rippleGates(n, { a: (i) => `ra${i}`, b: (i) => `rb${i}` })
  for (let i = 0; i < n; i++) {
    // With `toggle` the low bit of the first operand alternates, one cycle
    // each, against a second operand of zeros and a carry in of one. Every
    // propagate is then on, so the carry crosses the whole word and the top
    // sum bit waits for it. That is the longest path in the design, and it is
    // the one the clock has to fit. A register whose input never changes never
    // violates a setup time, and invariant 5 is about the one that does.
    sources.push(toggle && i === 0 ? { id: 'a0', kind: 'pattern', period, at: Math.round(period / 4), bits: [0, 1], repeat: true } : input(`a${i}`, toggle ? 1 : bitOf(a, i)))
    sources.push(input(`b${i}`, toggle ? 0 : bitOf(b, i)))
    flops.push({ id: `ra${i}`, d: `a${i}`, clk: 'clk', tcq: card.tcq, tsu: card.tsu, th: card.th, init: 0 })
    flops.push({ id: `rb${i}`, d: `b${i}`, clk: 'clk', tcq: card.tcq, tsu: card.tsu, th: card.th, init: 0 })
    flops.push({ id: `r${i}`, d: `s${i}`, clk: 'clk', tcq: card.tcq, tsu: card.tsu, th: card.th, init: 0 })
  }
  sources.push(input('cin', toggle ? 1 : 0))
  flops.push({ id: 'rc', d: 'cout', clk: 'clk', tcq: card.tcq, tsu: card.tsu, th: card.th, init: 0 })
  return netOf(`a ${n}-bit adder between two registers`, { sources, gates, flops, outputs: [...Array.from({ length: n }, (_, i) => `r${i}`), 'rc'] }, card)
}

/** A two-to-one multiplexer, the one block that sits on every path. */
export function mux2Net({ a = 0, b = 1, s = 0, card = CARD } = {}) {
  return netOf('a two-to-one multiplexer', {
    sources: [input('a', a), input('b', b), input('s', s)],
    gates: [
      { id: 'ns', kind: 'not', in: ['s'] },
      { id: 'm0', kind: 'and', in: ['a', 'ns'] },
      { id: 'm1', kind: 'and', in: ['b', 's'] },
      { id: 'y', kind: 'or', in: ['m0', 'm1'] },
    ],
    outputs: ['y'],
  }, card)
}

/** The word a set of signals reads, most significant first. */
export const wordOf = (final, prefix, n) => {
  let acc = 0
  for (let i = n - 1; i >= 0; i--) acc = acc * 2 + final[`${prefix}${i}`]
  return acc
}

/**
 * A netlist's longest path, in the three units a lesson quotes: grid units,
 * picoseconds and gate delays.
 */
export function pathOf(net, card = CARD) {
  const p = criticalPath(net)
  return { ...p, units: p.delay, ps: psOf(p.delay), gates: p.delay / card.gate }
}

/** Every arrival in the netlist, for the paths pane and for a lesson's reads. */
export function arrivalsOf(net) {
  return timingPaths(net)
}

/** The netlist run to `tEnd`, with the gate count beside it. */
export function runNet(net, tEnd) {
  const norm = normalize(net)
  return { norm, res: simulate(norm, { tEnd }), gates: norm.gates.length }
}

/** A delay in gate delays, from a delay in grid units. */
export const inGates = (units, card = CARD) => units / card.gate

/** The multiply loop of A4: one addition a cycle, one bit at a time. */
export function multiplyCost(width = 32, period) {
  return { cycles: width, period, time: width * period, adders: { loop: 1, array: width } }
}

export { gates, psOf }
