import { describe, it, expect } from 'vitest'
import { cubeMinterms, expressionOf, grayOrder, literals, minimalCover, netFromCover, primeImplicants } from './boolean.js'
import { evaluate, truthTable } from './analyse.js'
import { fsmEquations, fsmNet, fsmTable, mux2 } from './build.js'
import { simulate } from './simulate.js'

describe('the Karnaugh map', () => {
  it('orders its cells so that neighbours differ in one variable', () => {
    for (const n of [1, 2, 3, 4]) {
      const g = grayOrder(n)
      expect(g.length).toBe(2 ** n)
      expect(new Set(g).size).toBe(2 ** n)
      for (let i = 0; i < g.length; i++) {
        const d = g[i] ^ g[(i + 1) % g.length]
        expect(d & (d - 1), `${n} bits, cell ${i}`).toBe(0)
      }
    }
  })
})

describe('the prime implicants', () => {
  it('finds the two the textbook draws for f = Σ(0, 1, 2, 5, 6, 7) over three variables', () => {
    const primes = primeImplicants([0, 1, 2, 5, 6, 7], 3)
    const written = primes.map((p) => expressionOf([p], ['a', 'b', 'c'])).sort()
    expect(written).toEqual(["a'b'", "a'c'", 'ab', 'ac', "b'c", "bc'"].sort())
  })

  it('covers every minterm it was given, and nothing outside the function', () => {
    const minterms = [0, 1, 2, 5, 6, 7]
    const primes = primeImplicants(minterms, 3)
    const seen = new Set(primes.flatMap((p) => cubeMinterms(p, 3)))
    for (const m of minterms) expect(seen.has(m), `minterm ${m}`).toBe(true)
    for (const p of primes) for (const m of cubeMinterms(p, 3)) expect(minterms).toContain(m)
  })

  it('a function of every minterm has one prime, the constant 1', () => {
    const primes = primeImplicants([0, 1, 2, 3], 2)
    expect(primes.length).toBe(1)
    expect(primes[0].mask).toBe(0)
    expect(literals(primes[0], 2)).toBe(0)
  })
})

describe('the minimum cover', () => {
  const check = (minterms, n, cubes, lits) => {
    const primes = primeImplicants(minterms, n)
    const m = minimalCover(minterms, primes, n)
    expect(m.cubes, `${minterms} cubes`).toBe(cubes)
    expect(m.literals, `${minterms} literals`).toBe(lits)
    const covered = new Set(m.cover.flatMap((c) => cubeMinterms(c, n)))
    expect([...covered].sort((a, b) => a - b)).toEqual([...minterms].sort((a, b) => a - b))
    return m
  }

  it('takes three two-literal terms for f = Σ(0, 1, 2, 5, 6, 7), not four', () => {
    check([0, 1, 2, 5, 6, 7], 3, 3, 6)
  })

  it('reduces the multiplexer to two terms and four literals', () => {
    const t = truthTable(mux2())
    const m = check(t.minterms.y, 3, 2, 4)
    expect(expressionOf(m.cover, ['a', 'b', 's'])).toBe("bs + as'")
  })

  it('leaves the exclusive-or alone, because it has no adjacent pair to merge', () => {
    const m = check([1, 2], 2, 2, 4)
    expect(expressionOf(m.cover, ['a', 'b'])).toBe("a'b + ab'")
  })

  it('uses a spare row where it helps, and does not have to cover it', () => {
    const minterms = [1, 3, 7]
    const primes = primeImplicants(minterms, 3, [5])
    const m = minimalCover(minterms, primes, 3)
    expect(m.cubes).toBe(1)
    expect(expressionOf(m.cover, ['a', 'b', 'c'])).toBe('c')
  })
})

describe('the netlist a cover builds', () => {
  it('computes the function it was minimised from, and no other', () => {
    const t = truthTable(mux2())
    const primes = primeImplicants(t.minterms.y, 3)
    const { cover } = minimalCover(t.minterms.y, primes, 3)
    const built = netFromCover(cover, ['a', 'b', 's'])
    const rebuilt = truthTable(built)
    expect(rebuilt.minterms.y).toEqual(t.minterms.y)
  })

  it('draws one inverter per complemented variable, one AND per term and one OR over them', () => {
    const names = ['a', 'b', 'c']
    const minterms = [0, 1, 2, 5, 6, 7]
    const { cover } = minimalCover(minterms, primeImplicants(minterms, 3), 3)
    const built = netFromCover(cover, names)
    const complemented = new Set()
    for (const cube of cover) for (let k = 0; k < 3; k++) if (((cube.mask >> k) & 1) && !((cube.bits >> k) & 1)) complemented.add(names[2 - k])
    const kinds = built.gates.reduce((acc, g) => ({ ...acc, [g.kind]: (acc[g.kind] || 0) + 1 }), {})
    expect(kinds).toEqual({ not: complemented.size, and: cover.length, or: 1 })
    expect(truthTable(built).minterms.y).toEqual(minterms)
  })

  it('needs no OR when the cover is one term, and no AND when the term is one literal', () => {
    const one = netFromCover([{ mask: 0b100, bits: 0b100 }], ['a', 'b', 'c'])
    expect(one.gates.map((g) => g.kind)).toEqual(['buf'])
    expect(evaluate(one, { a: 1, b: 0, c: 0 }).y).toBe(1)
  })
})

describe('a state machine from its specification', () => {
  // The sequence detector every course sets: y is 1 on the clock where the
  // last three inputs were 1, 0, 1.
  const detector = {
    name: 'the 101 detector',
    inputs: ['x'],
    states: ['s0', 's1', 's2'],
    reset: 's0',
    next: (s, v) => (s === 's0' ? (v.x ? 's1' : 's0') : s === 's1' ? (v.x ? 's1' : 's2') : v.x ? 's1' : 's0'),
    out: (s, v) => ({ y: s === 's2' && v.x ? 1 : 0 }),
  }

  it('enumerates the state table, names it Mealy, and counts the unused codes', () => {
    const t = fsmTable(detector)
    expect(t.rows.length).toBe(6)
    expect(t.bits).toBe(2)
    expect(t.type).toBe('Mealy')
    expect(t.unused).toBe(1)
  })

  it('minimises each next-state bit and the output, with the unused codes free', () => {
    const { equations, dontCare, vars } = fsmEquations(detector)
    expect(vars).toEqual(['q1', 'q0', 'x'])
    expect(dontCare).toEqual([6, 7])
    expect(equations.d1.expression).toBe("q0x'")
    expect(equations.d0.expression).toBe('x')
    expect(equations.y.expression).toBe('q1x')
  })

  it('builds the logic and one flip-flop per state bit, and the built machine detects 101', () => {
    const bits = [0, 1, 0, 1, 1, 0, 1, 0]
    const period = 1000
    const net = fsmNet(detector, { period })
    const driven = { ...net, sources: net.sources.map((s) => (s.id === 'x' ? { id: 'x', kind: 'pattern', period, bits, at: 500 } : s)) }
    const res = simulate(driven, { tEnd: period * (bits.length + 1) })
    // Read y just before each rising edge, where the Mealy output has settled
    // on the input that edge is about to sample.
    const at = (sig, t) => {
      const w = res.waves[sig]
      let v = w.v[0]
      for (let k = 0; k < w.t.length; k++) if (w.t[k] <= t) v = w.v[k]
      return v
    }
    const seen = bits.map((_, k) => at('y', k * period + period - 1))
    // 1, 0, 1 first completes at bits 1 to 3, and again at bits 4 to 6.
    expect(seen).toEqual([0, 0, 0, 1, 0, 0, 1, 0])
    expect(res.violations).toEqual([])
  })

  it('ties off a next-state bit that is the same in every row rather than building a gate for it', () => {
    const toggle = { name: 'a toggle', inputs: ['x'], states: ['a', 'b'], reset: 'a', next: (s) => (s === 'a' ? 'b' : 'a'), out: (s) => ({ y: s === 'b' ? 1 : 0 }) }
    const net = fsmNet(toggle)
    expect(net.gates.some((g) => g.id === 'd0')).toBe(true)
    const table = fsmTable(toggle)
    expect(table.type).toBe('Moore')
  })
})
