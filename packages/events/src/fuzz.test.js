import { describe, it, expect } from 'vitest'
import { KINDS, KIND_ORDER, libDelay } from './library.js'
import { normalize } from './netlist.js'
import { simulate, valueAt } from './simulate.js'
import { evaluate, fMax, timingPaths, truthTable } from './analyse.js'
import { counter, decoder24, fullAdder, mux2, pipelinedAdder, rippleAdder } from './build.js'

// The four invariants the plan names, fuzzed over random netlists.
//
//   1. Causality. No event happens before the event that caused it, and the
//      gap between them is exactly the gate's own delay.
//   2. Determinism. The same netlist gives the same events, and shuffling the
//      order the gates are declared in changes nothing.
//   3. The truth table. A combinational netlist's settled state equals the
//      table computed with no delays at all, for every input vector. The two
//      routes share no code, so agreement is evidence.
//   4. Slack. A synchronous design's registered outputs do not change when
//      every gate delay is perturbed by less than the slack on its path.

/** A deterministic generator, so a failing seed can be re-run. */
function rng(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >> 17
    s ^= s << 5
    s >>>= 0
    return s / 2 ** 32
  }
}

/**
 * A random combinational netlist: `nIn` inputs, then `nGates` gates, each
 * reading signals that already exist, so it is a directed acyclic graph by
 * construction.
 */
function randomNet(seed, { nIn = 4, nGates = 10, asymmetric = false } = {}) {
  const rnd = rng(seed)
  const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length]
  const sources = Array.from({ length: nIn }, (_, i) => ({ id: `i${i}`, kind: 'input', value: rnd() < 0.5 ? 0 : 1 }))
  const pool = sources.map((s) => s.id)
  const gates = []
  for (let k = 0; k < nGates; k++) {
    const kind = pick(KIND_ORDER)
    const [lo, hi] = KINDS[kind].fanIn
    const want = lo + Math.floor(rnd() * (hi - lo + 1))
    const n = Math.min(want, hi)
    const ins = Array.from({ length: n }, () => pick(pool))
    const base = libDelay(kind, n)
    const g = { id: `g${k}`, kind, in: ins }
    if (asymmetric) {
      g.tr = Math.max(1, base + Math.floor(rnd() * 60) - 30)
      g.tf = Math.max(1, base + Math.floor(rnd() * 60) - 30)
    }
    gates.push(g)
    pool.push(g.id)
  }
  return { name: `random ${seed}`, sources, gates, outputs: [gates[gates.length - 1].id] }
}

const shuffled = (arr, rnd) => {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Every input driven by its own pattern, so the netlist is churning throughout. */
function driven(net, seed, { period = 300, steps = 8 } = {}) {
  const rnd = rng(seed + 7777)
  return {
    ...net,
    sources: net.sources.map((s, i) => ({ id: s.id, kind: 'pattern', period, at: 100 + i * 37, repeat: true, bits: Array.from({ length: steps }, () => (rnd() < 0.5 ? 0 : 1)) })),
  }
}

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 2654435761 + 12345)

describe('invariant 1: causality', () => {
  it('no event precedes its cause, and the gap is the gate delay that produced it', () => {
    for (const seed of SEEDS) {
      const net = driven(randomNet(seed, { asymmetric: seed % 3 === 0 }), seed)
      const res = simulate(net, { tEnd: 4000 })
      const byId = new Map([...normalize(net).gates].map((g) => [g.id, g]))
      for (const e of res.events) {
        if (!e.cause) continue
        expect(e.cause.t, `seed ${seed}: ${e.signal} at ${e.t}`).toBeLessThanOrEqual(e.t)
        expect(e.t - e.cause.t, `seed ${seed}: ${e.signal} at ${e.t}`).toBe(e.delay)
        const g = byId.get(e.by)
        if (g) expect(e.delay, `seed ${seed}: ${e.signal}`).toBe(e.to === 1 ? g.tr : g.tf)
      }
    }
  })

  it('the cause is an input of the gate that moved, and that input changed at that instant', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const net = driven(randomNet(seed), seed)
      const res = simulate(net, { tEnd: 3000 })
      const byId = new Map(normalize(net).gates.map((g) => [g.id, g]))
      const moved = new Set(res.events.map((e) => `${e.signal}@${e.t}`))
      for (const e of res.events) {
        const g = byId.get(e.by)
        if (!g || !e.cause) continue
        expect(g.in, `seed ${seed}: ${e.signal}`).toContain(e.cause.signal)
        // The cause is an event, not a guess: it is in the list at that time.
        if (e.cause.t > 0) expect(moved.has(`${e.cause.signal}@${e.cause.t}`), `seed ${seed}: ${e.signal} at ${e.t}`).toBe(true)
      }
    }
  })
})

describe('invariant 2: determinism', () => {
  it('the same netlist gives the same events twice', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const net = driven(randomNet(seed, { asymmetric: true }), seed)
      const a = simulate(net, { tEnd: 4000 })
      const b = simulate(net, { tEnd: 4000 })
      expect(a.events, `seed ${seed}`).toEqual(b.events)
      expect(a.final).toEqual(b.final)
    }
  })

  it('the order the gates are declared in changes nothing, because an instant has no order inside it', () => {
    for (const seed of SEEDS) {
      const rnd = rng(seed + 999)
      const net = driven(randomNet(seed, { asymmetric: seed % 2 === 0 }), seed)
      const straight = simulate(net, { tEnd: 4000 })
      for (let k = 0; k < 3; k++) {
        const mixed = simulate({ ...net, gates: shuffled(net.gates, rnd), sources: shuffled(net.sources, rnd) }, { tEnd: 4000 })
        expect(mixed.final, `seed ${seed} shuffle ${k}`).toEqual(straight.final)
        const key = (e) => `${e.t}|${e.signal}|${e.from}|${e.to}`
        expect(mixed.events.map(key).sort(), `seed ${seed} shuffle ${k}`).toEqual(straight.events.map(key).sort())
      }
    }
  })
})

describe('invariant 3: the settled state is the truth table', () => {
  it('holds for every input vector of a random netlist', () => {
    for (const seed of SEEDS.slice(0, 25)) {
      const net = randomNet(seed, { nIn: 4, nGates: 12, asymmetric: seed % 2 === 1 })
      const table = truthTable(net)
      for (const row of table.rows) {
        const held = { ...net, sources: net.sources.map((s, i) => ({ ...s, value: row.in[i] })) }
        const res = simulate(held, { tEnd: 20000 })
        expect(res.settled, `seed ${seed} row ${row.index}`).toBe(true)
        for (let k = 0; k < table.outputs.length; k++) expect(res.final[table.outputs[k]], `seed ${seed} row ${row.index} out ${table.outputs[k]}`).toBe(row.out[k])
      }
    }
  })

  it('holds for the library netlists, whichever way the inputs got there', () => {
    for (const net of [mux2(), decoder24(), fullAdder(), rippleAdder(3)]) {
      const table = truthTable(net)
      for (const row of table.rows) {
        const vector = Object.fromEntries(table.inputs.map((s, i) => [s, row.in[i]]))
        const held = { ...net, sources: net.sources.map((s) => ({ ...s, value: vector[s.id] })) }
        const res = simulate(held, { tEnd: 20000 })
        const still = evaluate(held, vector)
        for (const o of table.outputs) {
          expect(res.final[o], `${net.name} row ${row.index} ${o}`).toBe(still[o])
          expect(still[o]).toBe(row.out[table.outputs.indexOf(o)])
        }
      }
    }
  })

  it('reaching the same steady state does not mean it got there without moving', () => {
    // The hazard's whole point: the settled value equals the table and the
    // waveform still pulsed. The invariant is about the end, not the way.
    const net = {
      sources: [{ id: 'a', kind: 'step', at: 500, from: 1, to: 0 }, { id: 'b', kind: 'input', value: 1 }, { id: 'c', kind: 'input', value: 1 }],
      gates: [
        { id: 'na', kind: 'not', in: ['a'] },
        { id: 'p', kind: 'and', in: ['a', 'b'] },
        { id: 'q', kind: 'and', in: ['na', 'c'] },
        { id: 'y', kind: 'or', in: ['p', 'q'] },
      ],
      outputs: ['y'],
    }
    const res = simulate(net, { tEnd: 3000 })
    expect(res.final.y).toBe(1)
    expect(res.events.filter((e) => e.signal === 'y').length).toBe(2)
  })
})

describe('invariant 4: perturbing a gate delay inside the slack changes no registered value', () => {
  /** What every flip-flop holds at the end of each clock period. */
  const captured = (net, { period, cycles }) => {
    const res = simulate(net, { tEnd: period * cycles })
    const norm = normalize(net)
    return {
      violations: res.violations,
      values: Array.from({ length: cycles }, (_, k) => norm.flops.map((f) => valueAt(res, f.id, k * period + period - 1))),
    }
  }

  it('holds for the adder between registers, gate by gate, out to the whole slack', () => {
    const period = 1200
    const cycles = 6
    const base = pipelinedAdder(4, { period, a: 11, b: 7 })
    const want = captured(base, { period, cycles })
    expect(want.violations).toEqual([])
    const paths = timingPaths(base, { starts: 'flops' })
    const closing = fMax(base)
    const slack = period - closing.tMin
    expect(slack).toBeGreaterThan(0)
    for (const g of base.gates) {
      for (const delta of [-20, -1, 1, 20, slack]) {
        const d = libDelay(g.kind, g.in.length)
        if (d + delta < 1) continue
        const moved = { ...base, gates: base.gates.map((x) => (x.id === g.id ? { ...x, delay: d + delta } : x)) }
        const got = captured(moved, { period, cycles })
        expect(got.violations, `${g.id} by ${delta}`).toEqual([])
        expect(got.values, `${g.id} by ${delta}`).toEqual(want.values)
      }
    }
    // The slack is the number that made this true, and it came from the paths.
    expect(paths.long.delay + closing.terms.tsu + slack).toBe(period)
  })

  it('holds for the counter, and fails as soon as the perturbation exceeds the slack', () => {
    const period = 400
    const cycles = 10
    const base = counter(4, { period })
    const want = captured(base, { period, cycles })
    expect(want.violations).toEqual([])
    // The slack is what the period has left over the closing path, and the
    // path that spends it is the one through t3.
    const closing = fMax(base)
    const slack = period - closing.tMin
    expect(closing.path.path).toContain('t3')
    expect(slack).toBeGreaterThan(0)
    const inside = { ...base, gates: base.gates.map((g) => (g.id === 't3' ? { ...g, delay: libDelay('and', 3) + slack } : g)) }
    expect(captured(inside, { period, cycles })).toEqual(want)
    const outside = { ...base, gates: base.gates.map((g) => (g.id === 't3' ? { ...g, delay: libDelay('and', 3) + slack + 1 } : g)) }
    const broken = captured(outside, { period, cycles })
    expect(broken.violations.length).toBeGreaterThan(0)
    expect(broken.violations[0].kind).toBe('setup')
    expect(broken.violations[0].slack).toBe(-1)
  })
})
