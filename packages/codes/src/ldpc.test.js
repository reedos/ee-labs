import { describe, it, expect } from 'vitest'
import { L102, L12, L12_CHECKS, arrayLdpc, fourCycles, hardOf, matrixOf, rateOf, sumProduct, syndrome, syndromeWeight, tannerGraph } from './ldpc.js'
import { codeFromParity, codewords, encode, minimumDistance } from './block.js'
import { errorCount, gaussian, symmetric } from './channel.js'
import { weight } from './gf2.js'

// The graph, its rate, and the decoder that walks it.

const H12 = L12()
const CODE12 = codeFromParity(H12, { name: 'L12' })

describe('the drawable code', () => {
  it('has 12 bits, 8 checks, two checks per bit and three bits per check', () => {
    const g = tannerGraph(H12)
    expect(g.n).toBe(12)
    expect(g.m).toBe(8)
    expect(g.edges.length).toBe(24)
    expect(g.regular).toBe(true)
    expect(g.degreeV).toBe(2)
    expect(g.degreeC).toBe(3)
    expect(g.dv.every((d) => d === 2)).toBe(true)
    expect(g.dc.every((d) => d === 3)).toBe(true)
    expect(L12_CHECKS.flat().length).toBe(24)
  })

  it('has no four-cycle, so its girth is six', () => {
    expect(fourCycles(H12)).toBe(0)
  })

  it('has a design rate of one third and a true rate of five twelfths', () => {
    const r = rateOf(H12)
    expect(r.designRate).toBeCloseTo(1 / 3, 12)
    expect(r.rank).toBe(7)
    expect(r.dependent).toBe(1)
    expect(r.rate).toBeCloseTo(5 / 12, 12)
    // Every bit sits in two checks, so every column has even weight and the
    // eight rows sum to zero. A d_v = 2 code can never have all its rows
    // independent, and the design rate is a promise its degrees cannot keep.
    const sum = H12.reduce((acc, row) => acc.map((b, i) => b ^ row[i]))
    expect(sum.every((b) => b === 0)).toBe(true)
    expect(CODE12.k).toBe(5)
    expect(CODE12.k / CODE12.n).toBeCloseTo(r.rate, 12)
  })

  it('has distance 4, so it corrects one error and detects three', () => {
    const d = minimumDistance(CODE12)
    expect(d.d).toBe(4)
    expect(d.weights[4]).toBe(6)
    expect(codewords(CODE12).length).toBe(32)
    for (const c of codewords(CODE12)) expect(syndromeWeight(H12, c)).toBe(0)
  })

  it('reads the syndrome off the check nodes', () => {
    const c = encode(CODE12, [1, 0, 1, 1, 0])
    expect(syndromeWeight(H12, c)).toBe(0)
    for (let i = 0; i < 12; i++) {
      const r = [...c]
      r[i] ^= 1
      // A bit sits in two checks, so one flip fails exactly those two.
      expect(syndromeWeight(H12, r), `bit ${i}`).toBe(2)
      const s = syndrome(H12, r)
      const failing = s.map((b, k) => (b ? k : null)).filter((k) => k !== null)
      for (const k of failing) expect(L12_CHECKS[k]).toContain(i)
    }
  })
})

describe('belief propagation', () => {
  it('leaves a codeword alone, and reports the zero iteration', () => {
    const c = encode(CODE12, [1, 1, 0, 1, 0])
    const out = sumProduct(H12, c.map((b) => (b ? -4 : 4)))
    expect(out.converged).toBe(true)
    expect(out.iteration).toBe(0)
    expect(out.bits).toEqual(c)
  })

  it('corrects one flip, and the syndrome weight reaches zero', () => {
    const c = encode(CODE12, [1, 0, 1, 1, 0])
    for (let i = 0; i < 12; i++) {
      const r = [...c]
      r[i] ^= 1
      const out = sumProduct(H12, r.map((b) => (b ? -2 : 2)), { maxIter: 10 })
      expect(out.converged, `bit ${i}`).toBe(true)
      expect(out.bits, `bit ${i}`).toEqual(c)
      expect(out.syndromeWeights[out.syndromeWeights.length - 1]).toBe(0)
    }
  })

  it('stops at a codeword whenever it converges, over 200 channels', () => {
    const c = encode(CODE12, [0, 1, 1, 0, 1])
    let converged = 0
    for (let seed = 1; seed <= 200; seed++) {
      const ch = symmetric(c, { p: 0.1, seed })
      const out = sumProduct(H12, ch.llr, { maxIter: 12 })
      if (!out.converged) continue
      converged++
      // The claim is not that it decodes rightly. It is that a decode it calls
      // converged satisfies every check.
      expect(syndromeWeight(H12, out.bits), `seed ${seed}`).toBe(0)
      expect(out.syndromeWeights[out.iteration - 1] ?? 0).toBe(0)
    }
    expect(converged).toBeGreaterThan(100)
  })

  it('keeps a message on every edge in both directions at every iteration', () => {
    const c = encode(CODE12, [1, 0, 1, 1, 0])
    const ch = symmetric(c, { p: 0.1, seed: 9 })
    const out = sumProduct(H12, ch.llr, { maxIter: 12, stopEarly: false })
    expect(out.iterations.length).toBe(12)
    for (const it of out.iterations) {
      expect(it.toCheck.length).toBe(24)
      expect(it.toVar.length).toBe(24)
      expect(it.posterior.length).toBe(12)
      expect(it.bits).toEqual(hardOf(it.posterior))
      expect(it.syndromeWeight).toBe(syndromeWeight(H12, it.bits))
    }
    // This channel puts two bits wrong, and the second iteration fixes both.
    expect(ch.flips).toBe(2)
    expect(out.iteration).toBe(2)
    expect(out.syndromeWeights.slice(0, 2)).toEqual([2, 0])
    expect(out.bits).toEqual(c)
  })

  it('can fail to converge, because the graph has cycles', () => {
    const c = encode(CODE12, [1, 0, 1, 1, 0])
    const ch = symmetric(c, { p: 0.1, seed: 12 })
    const out = sumProduct(H12, ch.llr, { maxIter: 20, stopEarly: false })
    expect(ch.flips).toBe(2)
    expect(out.converged).toBe(false)
    expect(out.iteration).toBeNull()
    // The syndrome weight sits at 2 and stays there. Belief propagation on a
    // graph with cycles is not maximum-likelihood decoding.
    expect(new Set(out.syndromeWeights)).toEqual(new Set([2]))
  })

  it('refuses a belief of the wrong length', () => {
    expect(() => sumProduct(H12, [1, 2, 3])).toThrow(/12 bits/)
    expect(() => matrixOf([[12]], 12)).toThrow(/not one of the 12 bits/)
  })
})

describe('the larger regular code', () => {
  const L = L102()

  it('is 102 bits and 51 checks, with no four-cycle', () => {
    expect(L.n).toBe(102)
    expect(L.m).toBe(51)
    expect(L.dv).toBe(3)
    expect(L.dc).toBe(6)
    expect(L.fourCycles).toBe(0)
    const g = tannerGraph(L.H)
    expect(g.regular).toBe(true)
    expect(g.edges.length).toBe(306)
  })

  it('has the design rate one half, and two dependent rows', () => {
    const r = rateOf(L.H)
    expect(r.designRate).toBeCloseTo(0.5, 12)
    expect(r.rank).toBe(49)
    expect(r.dependent).toBe(2)
    expect(r.rate).toBeCloseTo(1 - 49 / 102, 12)
  })

  it('buys error rate with iterations, and then stops', () => {
    const zero = new Array(102).fill(0)
    const iters = 12
    const errors = new Array(iters + 1).fill(0)
    const blocks = 20
    for (let b = 0; b < blocks; b++) {
      const ch = gaussian(zero, { ebN0Db: 4, rate: 0.5, seed: 100 + b })
      errors[0] += ch.flips
      const out = sumProduct(L.H, ch.llr, { maxIter: iters, stopEarly: false })
      for (let i = 0; i < iters; i++) {
        const it = out.iterations[Math.min(i, out.iterations.length - 1)]
        errors[i + 1] += errorCount(it.bits, zero)
      }
    }
    // The first iterations take most of the errors out, and the curve flattens.
    expect(errors[1]).toBeLessThan(errors[0])
    expect(errors[3]).toBeLessThan(errors[1])
    expect(errors[iters]).toBe(0)
    expect(errors[iters]).toBeLessThanOrEqual(errors[6])
  })

  it('refuses a block size that is not prime, and degrees that do not fit in it', () => {
    expect(() => arrayLdpc({ p: 16 })).toThrow(/prime block size/)
    expect(() => arrayLdpc({ p: 5, dv: 3, dc: 6 })).toThrow(/degrees below 5/)
    // The construction generalises, and every one of them is four-cycle free.
    for (const p of [7, 11, 13]) {
      const c = arrayLdpc({ p, dv: 3, dc: 5 })
      expect(c.n, `p = ${p}`).toBe(5 * p)
      expect(c.fourCycles, `p = ${p}`).toBe(0)
      expect(weight(c.H[0])).toBe(5)
    }
  })
})
