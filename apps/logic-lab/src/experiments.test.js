import { describe, it, expect } from 'vitest'
import { criticalPath, expressionOf, KINDS, libDelay, minimalCover, primeImplicants, simulate, truthTable, WIRE_DELAY } from '@ee-labs/events'
import { EXPERIMENTS, GROUPS, VIEW_LABELS, VIEW_ORDER, byId, bussesOf, defaultsOf, noteOf, signalsOf } from './experiments.js'
import { readQuantity } from './lessons.js'
import { analyse, heldOf, levelsOf } from './analysis.js'
import { FUNCTIONS, sopNet } from './groups/b.js'
import { ps, hz, span, wordOf } from './format.js'

// Every note makes a claim, and every claim is measured here.
//
// The rule this lab adds to the suite's: no number in a lesson is a constant in
// a test. Every delay below is a sum of library entries, computed here from the
// library rather than typed in, so changing the inverter from 30 ps to 25 ps
// moves the expectation with the lesson or fails.

const D = {
  not: libDelay('not', 1),
  buf: libDelay('buf', 1),
  wire: WIRE_DELAY,
  and2: libDelay('and', 2),
  and3: libDelay('and', 3),
  or2: libDelay('or', 2),
  or3: libDelay('or', 3),
  nand2: libDelay('nand', 2),
  xor2: libDelay('xor', 2),
}

/**
 * What this sitting has built, as the two counts the sidebar shows and
 * `NEEDS.md` gives the progression test. The plan names 45 experiments in 8
 * groups, and this number moves when a group lands and not before.
 */
const BUILT = { groups: 7, experiments: 42 }

const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p) }
}

describe('every experiment', () => {
  it('has a unique id, a group from the list, knobs, signals and views', () => {
    const ids = new Set()
    for (const e of EXPERIMENTS) {
      expect(ids.has(e.id), e.id).toBe(false)
      ids.add(e.id)
      expect(GROUPS, e.id).toContain(e.group)
      expect(e.name.length, e.id).toBeGreaterThan(8)
      expect(e.params.length, e.id).toBeGreaterThan(0)
      expect(e.views, e.id).toContain(e.view)
      for (const v of e.views) expect(VIEW_ORDER, `${e.id} view ${v}`).toContain(v)
      for (const k of e.params) {
        if (k.kind === 'bit') {
          expect([0, 1], `${e.id}.${k.key}`).toContain(k.default)
          continue
        }
        if (k.kind === 'choice') {
          expect(k.options.length, `${e.id}.${k.key}`).toBeGreaterThan(1)
          expect(k.options.map((o) => o.value), `${e.id}.${k.key} default`).toContain(k.default)
          continue
        }
        expect(k.default, `${e.id}.${k.key}`).toBeGreaterThanOrEqual(k.min)
        expect(k.default, `${e.id}.${k.key}`).toBeLessThanOrEqual(k.max)
        expect(Number.isInteger(k.default), `${e.id}.${k.key} is a whole unit`).toBe(true)
      }
    }
  })

  it('runs at its defaults, and every signal it draws is a net of its own netlist', () => {
    for (const e of EXPERIMENTS) {
      const { x, p } = at(e.id)
      // An experiment whose subject is a refusal says which one it expects, and
      // the refusal is then the answer rather than a failure. E1 is the ring
      // that has no truth table, which is what memory is.
      if (e.expects) expect(x.refusal && x.refusal.code, e.id).toBe(e.expects)
      else expect(x.refusal, `${e.id}: ${x.refusal && x.refusal.message}`).toBeNull()
      expect(x.res, e.id).toBeTruthy()
      expect(x.res.settled, `${e.id} settles at t = 0`).toBe(true)
      expect(x.res.conflicts, `${e.id} has no driver conflict`).toEqual([])
      for (const s of signalsOf(e, p)) expect(x.norm.nets, `${e.id} draws ${s}`).toContain(s)
      for (const b of bussesOf(e, p)) for (const s of b.signals) expect(x.norm.nets, `${e.id} bus ${b.label} names ${s}`).toContain(s)
    }
  })

  it('every time in every netlist is a whole number of units, at the picosecond grid', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      expect(x.norm.unit, e.id).toEqual({ num: 1, den: 1e12 })
      for (const g of x.norm.gates) {
        expect(Number.isInteger(g.tr), `${e.id} ${g.id}`).toBe(true)
        expect(Number.isInteger(g.tf), `${e.id} ${g.id}`).toBe(true)
      }
      for (const ev of x.res.events) expect(Number.isInteger(ev.t), `${e.id} event at ${ev.t}`).toBe(true)
    }
  })

  it('the settled state of every experiment equals its truth table, which nothing here derived from it', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      if (!x.table) continue
      const held = heldOf(x.norm)
      for (const row of x.table.rows) {
        const vector = Object.fromEntries(x.table.inputs.map((s, i) => [s, row.in[i]]))
        const run = simulate({ ...netOf(held), sources: held.sources.map((s) => ({ ...s, value: vector[s.out] })) }, { tEnd: 20000 })
        for (let k = 0; k < x.table.outputs.length; k++) expect(run.final[x.table.outputs[k]], `${e.id} row ${row.index} ${x.table.outputs[k]}`).toBe(row.out[k])
      }
    }
  })
})

/** A normalised netlist back as plain data, so a test can vary one field of it. */
const netOf = (norm) => ({
  name: norm.name,
  unit: norm.unit,
  lib: norm.lib,
  cells: norm.cells,
  delayMode: norm.delayMode,
  resolve: Object.fromEntries(norm.resolve),
  sources: norm.sources,
  gates: norm.gates,
  wires: norm.wires,
  flops: norm.flops,
  outputs: norm.outputs,
})

describe('group A pins the library', () => {
  it('A1: an inverter changes one gate delay after its input', () => {
    const { x, p } = at('a1')
    expect(readQuantity(x, p, 'path.long')).toBe(D.not)
    expect(readQuantity(x, p, 'edge.y.1')).toBe(200 + D.not)
    expect(readQuantity(x, p, 'rows')).toBe(2)
  })

  it('A2 and A3: an AND is a NAND and an inverter, and costs more as a pair than as a cell', () => {
    const a2 = at('a2')
    expect(readQuantity(a2.x, a2.p, 'arrive.yand')).toBe(D.and2)
    expect(readQuantity(a2.x, a2.p, 'arrive.yor')).toBe(D.or2)
    const a3 = at('a3')
    expect(readQuantity(a3.x, a3.p, 'arrive.n')).toBe(D.nand2)
    expect(readQuantity(a3.x, a3.p, 'arrive.aa')).toBe(D.and2)
    expect(readQuantity(a3.x, a3.p, 'arrive.ni')).toBe(D.nand2 + D.not)
    expect(D.nand2 + D.not).toBeGreaterThan(D.and2)
  })

  it('A4: every NAND construction costs more than the cell it replaces', () => {
    for (const which of ['not', 'and', 'or', 'xor']) {
      const { x, p } = at('a4', { which })
      const built = readQuantity(x, p, 'arrive.y')
      const cell = readQuantity(x, p, 'arrive.ref')
      expect(cell, which).toBe(libDelay(which, KINDS[which].fanIn[0]))
      expect(built, which).toBeGreaterThan(cell)
      // The two agree in every row, which is what universality means.
      for (const r of x.table.rows) expect(r.out[0], `${which} row ${r.index}`).toBe(r.out[1])
    }
  })

  it('A5: eight rows for three inputs, and the minterms are the rows where the output is 1', () => {
    const { x, p } = at('a5')
    expect(readQuantity(x, p, 'rows')).toBe(2 ** readQuantity(x, p, 'inputs'))
    expect(readQuantity(x, p, 'minterms.y')).toBe(x.table.rows.filter((r) => r.out[0] === 1).length)
  })

  it('A6: the wire and the buffer both copy, at their own delays', () => {
    const { x, p } = at('a6')
    expect(readQuantity(x, p, 'arrive.w')).toBe(D.wire)
    expect(readQuantity(x, p, 'arrive.buf')).toBe(D.buf)
    expect(readQuantity(x, p, 'final.w')).toBe(readQuantity(x, p, 'final.buf'))
  })
})

describe('group B pins the minimisation', () => {
  it('B1 and B2: both sides of every identity agree in every row', () => {
    for (const id of ['b1', 'b2']) {
      const laws = id === 'b1' ? ['absorption', 'distribution'] : [null]
      for (const law of laws) {
        const { x } = at(id, law ? { law } : {})
        for (const r of x.table.rows) expect(r.out[0], `${id} ${law} row ${r.index}`).toBe(r.out[1])
      }
    }
  })

  it('B2: one NAND cell against two inverters and an OR', () => {
    const { x, p } = at('b2')
    expect(readQuantity(x, p, 'arrive.lhs')).toBe(D.nand2)
    expect(readQuantity(x, p, 'arrive.rhs')).toBe(D.not + D.or2)
  })

  it('B3 and B5: the canonical form is one term per minterm, and the minimum is smaller', () => {
    for (const fn of Object.keys(FUNCTIONS)) {
      const minterms = FUNCTIONS[fn].minterms
      const canonical = at('b5', { fn, form: 'canonical' })
      const minimal = at('b5', { fn, form: 'minimal' })
      const cover = minimalCover(minterms, primeImplicants(minterms, 3), 3)
      // One AND per minterm, one inverter per complemented variable, the OR tree.
      expect(readQuantity(canonical.x, canonical.p, 'minterms.y'), fn).toBe(minterms.length)
      expect(readQuantity(minimal.x, minimal.p, 'cubes'), fn).toBe(cover.cubes)
      expect(readQuantity(minimal.x, minimal.p, 'literals'), fn).toBe(cover.literals)
      expect(readQuantity(minimal.x, minimal.p, 'gates'), fn).toBeLessThanOrEqual(readQuantity(canonical.x, canonical.p, 'gates'))
      expect(readQuantity(minimal.x, minimal.p, 'arrive.y'), fn).toBeLessThanOrEqual(readQuantity(canonical.x, canonical.p, 'arrive.y'))
      // Both forms compute the same function, which is the whole claim.
      expect(truthTable(sopNet(fn, 'canonical', [0, 0, 0])).minterms.y, fn).toEqual(minterms)
      expect(truthTable(sopNet(fn, 'minimal', [0, 0, 0])).minterms.y, fn).toEqual(minterms)
    }
  })

  it('B3: six terms need two levels of OR, and that is where the 260 ps comes from', () => {
    const { x, p } = at('b3', { fn: 'six' })
    expect(readQuantity(x, p, 'arrive.y')).toBe(D.not + D.and3 + D.or3 + D.or2)
    expect(readQuantity(x, p, 'gates')).toBe(3 + 6 + 3)
  })

  it('B4 and B5: the minimum cover of the six-term function is three cubes and six literals', () => {
    const minterms = FUNCTIONS.six.minterms
    const primes = primeImplicants(minterms, 3)
    const cover = minimalCover(minterms, primes, 3)
    const { x, p } = at('b4')
    expect(readQuantity(x, p, 'primes')).toBe(primes.length)
    expect(readQuantity(x, p, 'cubes')).toBe(cover.cubes)
    expect(readQuantity(x, p, 'literals')).toBe(cover.literals)
    expect(expressionOf(cover.cover, ['a', 'b', 'c'])).toBe(byId.b4.claim.expression)
    const built = at('b5', { form: 'minimal' })
    expect(readQuantity(built.x, built.p, 'arrive.y')).toBe(D.not + D.and2 + D.or3)
  })

  it('B6: the multiplexer minimises to the circuit C1 draws', () => {
    const { x, p } = at('b6')
    const t = truthTable(x.norm)
    const cover = minimalCover(t.minterms.y, primeImplicants(t.minterms.y, 3), 3)
    expect(readQuantity(x, p, 'cubes')).toBe(cover.cubes)
    expect(readQuantity(x, p, 'literals')).toBe(cover.literals)
    expect(expressionOf(cover.cover, t.inputs)).toBe(byId.b6.claim.expression)
    // Two cubes of two literals is exactly the two AND gates in the picture.
    expect(x.norm.gates.filter((g) => g.kind === 'and').length).toBe(cover.cubes)
  })
})

describe('group C pins the blocks', () => {
  it('C1: the select path is one inverter longer than the data path', () => {
    const { x, p } = at('c1')
    expect(readQuantity(x, p, 'arrive.y')).toBe(D.not + D.and2 + D.or2)
    expect(readQuantity(x, p, 'arrive.y') - (D.and2 + D.or2)).toBe(D.not)
    for (const r of x.table.rows) {
      const [a, b, s] = r.in
      expect(r.out[0], `a=${a} b=${b} s=${s}`).toBe(s ? b : a)
    }
  })

  it('C2: exactly one output high in every row, and d3 needs no complement', () => {
    const { x, p } = at('c2')
    for (const r of x.table.rows) {
      expect(r.out.reduce((a, b) => a + b, 0), `row ${r.index}`).toBe(1)
      expect(r.out[r.index], `row ${r.index}`).toBe(1)
    }
    expect(readQuantity(x, p, 'arrive.d0')).toBe(D.not + D.and2)
    expect(readQuantity(x, p, 'arrive.d3')).toBe(D.and2)
  })

  it('C3 and C4: the outputs count the ones, and the carry path is what a wide adder repeats', () => {
    const c3 = at('c3')
    for (const r of c3.x.table.rows) expect(r.out[1] * 2 + r.out[0], `half adder ${r.in}`).toBe(r.in[0] + r.in[1])
    expect(readQuantity(c3.x, c3.p, 'arrive.s')).toBe(D.xor2)
    expect(readQuantity(c3.x, c3.p, 'arrive.c')).toBe(D.and2)
    const c4 = at('c4')
    for (const r of c4.x.table.rows) expect(r.out[1] * 2 + r.out[0], `full adder ${r.in}`).toBe(r.in[0] + r.in[1] + r.in[2])
    expect(readQuantity(c4.x, c4.p, 'arrive.s')).toBe(2 * D.xor2)
    expect(readQuantity(c4.x, c4.p, 'arrive.cout')).toBe(D.xor2 + D.and2 + D.or2)
    // The number a wide adder repeats is the carry in to the carry out.
    expect(D.and2 + D.or2).toBe(140)
  })

  it('C5: every one of the 256 operand pairs adds, and the bits do not arrive together', () => {
    for (let a = 0; a < 16; a++)
      for (let b = 0; b < 16; b++) {
        const { x } = at('c5', { a, b })
        const sum = [0, 1, 2, 3].reduce((acc, i) => acc + (x.res.final[`s${i}`] << i), 0) + 16 * x.res.final.cout
        expect(sum, `${a} + ${b}`).toBe(a + b)
      }
    const { x, p } = at('c5')
    const one = D.and2 + D.or2
    expect(readQuantity(x, p, 'arrive.s0')).toBe(2 * D.xor2)
    expect(readQuantity(x, p, 'arrive.s3')).toBe(D.xor2 + one + 2 * one + D.xor2)
    expect(readQuantity(x, p, 'arrive.cout')).toBe(D.xor2 + 4 * one)
    expect(readQuantity(x, p, 'arrive.cout')).toBeGreaterThan(readQuantity(x, p, 'arrive.s0'))
  })

  it('C6: the carry chain grows by one AND and one OR a bit', () => {
    const one = D.and2 + D.or2
    let last = null
    for (const n of [1, 2, 4, 8]) {
      const { x, p } = at('c6', { n })
      expect(readQuantity(x, p, 'path.long'), `${n} bits`).toBe(D.xor2 + n * one)
      expect(readQuantity(x, p, 'gates'), `${n} bits`).toBe(5 * n)
      if (last) expect(readQuantity(x, p, 'path.long') - last.delay).toBe((n - last.n) * one)
      last = { n, delay: readQuantity(x, p, 'path.long') }
    }
  })
})

describe('group D pins the timing', () => {
  it('D1: a path is the sum of the gates on it', () => {
    for (const n of [1, 4, 8]) {
      const { x, p } = at('d1', { n })
      expect(readQuantity(x, p, 'path.long'), `${n} gates`).toBe(n * D.buf)
      expect(readQuantity(x, p, `edge.g${n}.1`), `${n} gates`).toBe(200 + n * D.buf)
    }
  })

  it('D2: the two routes differ by the inverter, and by nothing else', () => {
    for (const tnot of [1, 30, 100]) {
      const { x, p } = at('d2', { tnot })
      const direct = readQuantity(x, p, 'edge.p.1')
      const round = readQuantity(x, p, 'edge.q.1')
      expect(round - direct, `inverter ${tnot}`).toBe(tnot)
      expect(direct, `inverter ${tnot}`).toBe(200 + D.and2)
    }
  })

  it('D3: the pulse is the inverter delay wide, and the settled value is the table’s', () => {
    for (const tnot of [1, 30, 100]) {
      const { x, p } = at('d3', { tnot })
      expect(readQuantity(x, p, 'pulse.y.width'), `inverter ${tnot}`).toBe(tnot)
      expect(readQuantity(x, p, 'final.y'), `inverter ${tnot}`).toBe(1)
      // The value before and after the change is the same row of the table.
      expect(readQuantity(x, p, 'table.7.y')).toBe(readQuantity(x, p, 'table.3.y'))
    }
    const { x, p } = at('d3')
    expect(readQuantity(x, p, 'edge.y.1')).toBe(200 + D.and2 + D.or2)
    expect(readQuantity(x, p, 'edge.y.2')).toBe(200 + D.not + D.and2 + D.or2)
  })

  it('D4: the consensus term removes the pulse and costs one wider OR', () => {
    const on = at('d4', { cover: 1 })
    const off = at('d4', { cover: 0 })
    expect(readQuantity(on.x, on.p, 'edges.y')).toBe(0)
    expect(readQuantity(off.x, off.p, 'edges.y')).toBe(2)
    expect(readQuantity(on.x, on.p, 'path.long') - readQuantity(off.x, off.p, 'path.long')).toBe(D.or3 - D.or2)
    expect(readQuantity(on.x, on.p, 'gates') - readQuantity(off.x, off.p, 'gates')).toBe(1)
    // The term that removes it is the consensus, and it is a prime implicant.
    const t = off.x.table
    const primes = primeImplicants(t.minterms.y, 3)
    expect(primes.map((c) => expressionOf([c], t.inputs))).toContain('bc')
  })

  it('D5: inertial delay rejects a pulse shorter than the gate, transport passes it', () => {
    const narrow = at('d5', { mode: 'inertial', tnot: D.not })
    expect(readQuantity(narrow.x, narrow.p, 'edges.y')).toBe(0)
    expect(readQuantity(narrow.x, narrow.p, 'swallowed')).toBe(1)
    expect(readQuantity(narrow.x, narrow.p, 'swallow.1.width')).toBe(D.not)
    expect(D.not).toBeLessThan(D.or2)
    const wide = at('d5', { mode: 'inertial', tnot: 100 })
    expect(readQuantity(wide.x, wide.p, 'pulse.y.width')).toBe(100)
    expect(100).toBeGreaterThan(D.or2)
    const transport = at('d5')
    expect(readQuantity(transport.x, transport.p, 'pulse.y.width')).toBe(D.not)
    expect(readQuantity(transport.x, transport.p, 'swallowed')).toBe(0)
  })

  it('D6: each sum bit moves once, in carry order, and the last is the longest path', () => {
    const { x, p } = at('d6')
    const one = D.and2 + D.or2
    const step = p.at
    expect(readQuantity(x, p, 'edge.s0.1')).toBe(step + 2 * D.xor2)
    expect(readQuantity(x, p, 'edge.s3.1')).toBe(step + 3 * one + D.xor2)
    for (const s of ['s0', 's1', 's2', 's3']) expect(readQuantity(x, p, `edges.${s}`), s).toBe(1)
    // Settled, the adder reads the answer.
    const late = [0, 1, 2, 3].map((i) => readQuantity(x, p, `at.s${i}.${step + 2000}`))
    expect(wordOf([...late].reverse())).toBe((p.a + 1) & 15)
  })
})

// The lesson registers, measured. A step's `set` is applied over the defaults,
// each `reads` pair is solved and compared, and then every number-with-unit in
// the sentence has to be one of those readings or a knob value.
describe('every lesson is measured', () => {
  // Times are quoted in picoseconds or nanoseconds and read back in the
  // netlist's own unit, which is the picosecond. A frequency is in hertz and a
  // count carries the word it counts.
  const SCALE = { p: 1, n: 1e3, 'µ': 1e6, u: 1e6, m: 1e9, '': 1e12 }
  const TIME = /(-?\d+(?:\.\d+)?)\s*([pnµum]?)s(?![A-Za-z])/g
  const FREQ = /(-?\d+(?:\.\d+)?)\s*([kMG]?)Hz(?![A-Za-z])/g
  const COUNT = /(-?\d[\d\s]*(?:\.\d+)?)\s*(million\s+|billion\s+)?(gates?|literals?|rows?|terms?|inputs?|bits?|levels?|cubes?|primes?|years?|flip-flops?|stages?|states?|codes?)(?![A-Za-z])/g
  const HZ = { k: 1e3, M: 1e6, G: 1e9, '': 1 }

  /** Every number-with-unit in a sentence, in the units a reading uses. */
  const quoted = (text) => {
    const s = text.replace(/−/g, '-')
    const out = []
    for (const m of s.matchAll(TIME)) out.push({ text: m[0].trim(), digits: (m[1].split('.')[1] || '').length, scale: SCALE[m[2]], value: Math.abs(+m[1]) * SCALE[m[2]] })
    for (const m of s.matchAll(FREQ)) out.push({ text: m[0].trim(), digits: (m[1].split('.')[1] || '').length, scale: HZ[m[2]], value: Math.abs(+m[1]) * HZ[m[2]] })
    // A count may carry a magnitude word, so "20 million years" is the same
    // reading as the number of years itself.
    const BIG = { 'million ': 1e6, 'billion ': 1e9 }
    for (const m of s.matchAll(COUNT)) {
      const scale = BIG[m[2]] || 1
      out.push({ text: m[0].trim(), digits: (m[1].split('.')[1] || '').length, scale, value: Math.abs(+m[1].replace(/\s/g, '')) * scale })
    }
    return out
  }
  /** A quoted number stands for a value when it is that value rounded to the digits printed. */
  const stands = (q, v) => {
    const half = 0.5 * 10 ** -q.digits * q.scale
    return Math.abs(q.value - Math.abs(v)) <= Math.max(0.006 * Math.abs(v), half * (1 + 1e-9))
  }
  const close = (got, want) => (want === 0 ? got === 0 : Math.abs(got - want) <= Math.max(1e-9, 0.006 * Math.abs(want)))
  const words = (s) => s.trim().split(/\s+/).length
  const knobOf = (e, key) => e.params.find((k) => k.key === key)
  const knobValues = (e) => e.params.filter((k) => !k.kind).map((k) => k.default)

  /** Solve one register and check its reads; returns the numbers it justifies. */
  function measure(e, p, reads, label) {
    const x = analyse(e, p)
    if (e.expects) expect(x.refusal && x.refusal.code, label).toBe(e.expects)
    else expect(x.refusal, `${label}: ${x.refusal && x.refusal.message}`).toBeNull()
    const values = []
    for (const [path, want] of reads) {
      const got = readQuantity(x, p, path, e)
      // A reading can be a word rather than a number: the code of a refusal,
      // or the kind of a violation. It is checked exactly and it justifies no
      // digits, because there are none in it.
      if (typeof want === 'string') {
        expect(got, `${label}: ${path} reads ${got}, the lesson says ${want}`).toBe(want)
        continue
      }
      expect(Number.isFinite(got), `${label}: ${path} is ${got}`).toBe(true)
      expect(close(got, want), `${label}: ${path} reads ${got}, the lesson says ${want}`).toBe(true)
      values.push(want)
      // A reading taken at an instant justifies that instant too, the way the
      // other labs let a cursor time stand for itself. A word read off several
      // signals at once is the same kind of reading, with the instant last.
      if (path.startsWith('at.')) values.push(Number(path.split('.')[2]))
      if (path.startsWith('word.')) values.push(Number(path.split('.')[3]))
    }
    return values
  }
  /** Every quoted number in `text` stands for one of `values`. */
  function justified(text, values, label) {
    for (const q of quoted(text)) {
      const ok = values.some((v) => stands(q, v))
      expect(ok, `${label}: "${q.text}" is not a reading or a knob value (have ${values.map((v) => +v.toPrecision(6)).join(', ')})`).toBe(true)
    }
  }

  it('every experiment has a see, two to four tries and a why, all within their budgets', () => {
    for (const e of EXPERIMENTS) {
      expect(typeof e.see, e.id).toBe('string')
      expect(typeof e.why, e.id).toBe('string')
      expect(e.try.length, `${e.id} tries`).toBeGreaterThanOrEqual(2)
      expect(e.try.length, `${e.id} tries`).toBeLessThanOrEqual(4)
      expect(words(e.see), `${e.id} see is ${words(e.see)} words`).toBeLessThanOrEqual(70)
      expect(words(e.why), `${e.id} why is ${words(e.why)} words`).toBeLessThanOrEqual(160)
      for (const t of e.try) expect(words(t.say), `${e.id} try "${t.say.slice(0, 30)}…" is ${words(t.say)} words`).toBeLessThanOrEqual(45)
      expect(noteOf(e)).toBe(`${e.see} ${e.why}`)
    }
  })

  it('the numbers in see and why are readings at the defaults, or at a setting the register names', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const seen = measure(e, p, e.seeReads || [], `${e.id} see`)
      // A register that compares two settings names the second one, and its
      // readings are measured there rather than taken on trust. The setting
      // itself justifies the number it is, the way a try step's does.
      const also = (list, label) =>
        (list || []).flatMap((a, i) => [
          ...Object.entries(a.set || {})
            .filter(([key]) => !knobOf(e, key).kind)
            .map(([, v]) => v),
          ...measure(e, { ...p, ...a.set }, a.reads || [], `${label} also ${i + 1}`),
        ])
      const seeAlso = also(e.seeAlso, `${e.id} see`)
      justified(e.see, [...seen, ...seeAlso, ...knobValues(e)], `${e.id} see`)
      const why = measure(e, p, e.whyReads || [], `${e.id} why`)
      const whyAlso = also(e.whyAlso, `${e.id} why`)
      justified(e.why, [...why, ...whyAlso, ...seen, ...seeAlso, ...knobValues(e)], `${e.id} why`)
    }
  })

  it('every try sets knobs inside their range and reads what it says', () => {
    let steps = 0
    for (const e of EXPERIMENTS) {
      const d = defaultsOf(e.id)
      e.try.forEach((t, i) => {
        const label = `${e.id} try ${i + 1}`
        const values = []
        for (const [key, v] of Object.entries(t.set || {})) {
          const k = knobOf(e, key)
          expect(k, `${label} sets ${key}, which is not a knob`).toBeDefined()
          if (k.kind === 'bit') expect([0, 1], `${label} ${key}`).toContain(v)
          else if (k.kind === 'choice') expect(k.options.map((o) => o.value), `${label} ${key}`).toContain(v)
          else {
            expect(v, `${label} ${key} below min`).toBeGreaterThanOrEqual(k.min)
            expect(v, `${label} ${key} above max`).toBeLessThanOrEqual(k.max)
            expect(Number.isInteger(v), `${label} ${key} is a whole unit`).toBe(true)
            values.push(v)
          }
        }
        const p = { ...d, ...(t.set || {}) }
        values.push(...measure(e, p, t.reads || [], label))
        justified(t.say, [...values, ...knobValues(e)], label)
        steps++
      })
    }
    expect(steps).toBeGreaterThanOrEqual(2 * EXPERIMENTS.length)
  })

  it('readQuantity reads every kind of path it documents, and throws on one it does not know', () => {
    const a1 = at('a1')
    expect(readQuantity(a1.x, a1.p, 'final.y')).toBe(0)
    expect(readQuantity(a1.x, a1.p, 'at.y.0')).toBe(1)
    expect(readQuantity(a1.x, a1.p, 'first.y')).toBe(readQuantity(a1.x, a1.p, 'last.y'))
    expect(readQuantity(a1.x, a1.p, 'levels')).toBe(1)
    expect(() => readQuantity(a1.x, a1.p, 'nope.y')).toThrow(/unknown quantity path/)
    expect(() => readQuantity(a1.x, a1.p, 'edge.y.9')).toThrow(/changed 1 times/)
    const d3 = at('d3')
    expect(readQuantity(d3.x, d3.p, 'pulse.y.from')).toBe(readQuantity(d3.x, d3.p, 'edge.y.1'))
    expect(readQuantity(d3.x, d3.p, 'pulse.y.to')).toBe(readQuantity(d3.x, d3.p, 'edge.y.2'))
    expect(readQuantity(d3.x, d3.p, 'path.short')).toBeLessThanOrEqual(readQuantity(d3.x, d3.p, 'path.long'))
    const c5 = at('c5')
    expect(readQuantity(c5.x, c5.p, 'arrive.x0')).toBe(D.xor2)
    expect(() => readQuantity(c5.x, c5.p, 'arrive.nope')).toThrow(/not a net/)
    const a4 = at('a4')
    expect(() => readQuantity(a4.x, a4.p, 'table.0.nope')).toThrow(/no output called/)
    expect(() => readQuantity(a4.x, a4.p, 'primes')).toThrow(/did not ask for that analysis/)
    expect(readQuantity(d3.x, d3.p, 'swallowed')).toBe(0)
    expect(() => readQuantity(d3.x, d3.p, 'swallow.1.width')).toThrow(/swallowed 0 pulses/)
  })
})

describe('the chrome names what it shows', () => {
  it('every view in the order has a label and a hover title', () => {
    for (const v of VIEW_ORDER) {
      expect(VIEW_LABELS[v], v).toBeDefined()
      expect(VIEW_LABELS[v].label.split(/\s+/).length, `${v} label`).toBeLessThanOrEqual(4)
      expect(VIEW_LABELS[v].title.length, `${v} title`).toBeGreaterThan(20)
    }
  })

  it('every group heading names its content, and every experiment belongs to a built one', () => {
    // Eight headings, because the plan names eight groups (LOGIC_LAB_PLAN.md
    // §5) and the sidebar lists what the lab is, not what this sitting got to.
    // A heading with nothing under it is a group that is specified and not
    // built, and the count below says how many of those are left.
    const built = GROUPS.filter((g) => EXPERIMENTS.some((e) => e.group === g))
    for (const g of GROUPS) expect(g, g).toMatch(/^[A-H] · /)
    for (const e of EXPERIMENTS) expect(built, e.id).toContain(e.group)
    expect(GROUPS.length).toBe(8)
    expect(built.length).toBe(BUILT.groups)
    expect(EXPERIMENTS.length).toBe(BUILT.experiments)
  })

  it('formats a time in the unit a reader reads, and a rate as a rate', () => {
    expect(ps(30)).toBe('30 ps')
    expect(ps(1500)).toBe('1.5 ns')
    expect(ps(-30)).toBe('−30 ps')
    expect(ps(null)).toBe('—')
    expect(hz(1.2987e9)).toBe('1.299 GHz')
    expect(span(16.93 * 365.25 * 24 * 3600)).toMatch(/16.93 years/)
    expect(wordOf([1, 0, 1])).toBe(5)
  })

  it('the critical path of every experiment is the path list’s longest', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      if (!x.paths) continue
      expect(criticalPath(x.norm).delay, e.id).toBe(x.paths.long.delay)
      // A netlist of flip-flops and nothing else is zero gates deep, which is
      // the right answer and the floor every other design is measured from.
      if (x.norm.gates.length) expect(levelsOf(x.norm), e.id).toBeGreaterThan(0)
      else expect(levelsOf(x.norm), e.id).toBe(0)
    }
  })
})
