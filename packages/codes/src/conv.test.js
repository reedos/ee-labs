import { describe, it, expect } from 'vitest'
import { rng } from '@ee-labs/random'
import { CONV_CODES, branchMetric, encode, encoder, freeDistance, softAsymptoticGain, stateText, tracebackRule, trellis, viterbi, weightSpectrum } from './conv.js'
import { bitStream, errorCount, gaussian } from './channel.js'
import { allVectors } from './gf2.js'

// The convolutional encoder and Viterbi's decoder.
//
// The reference code is K = 3 with generators 5 and 7. Its whole trellis is
// eight rows, and the table in INFORMATION_LAB_PLAN.md §3 is repeated here as
// the value the encoder has to reproduce.

const K3 = encoder(CONV_CODES.K3)

// state, input, next state, output, exactly as the plan prints them.
const PLAN_TRELLIS = [
  ['00', 0, '00', '00'],
  ['00', 1, '10', '11'],
  ['01', 0, '00', '11'],
  ['01', 1, '10', '00'],
  ['10', 0, '01', '01'],
  ['10', 1, '11', '10'],
  ['11', 0, '01', '10'],
  ['11', 1, '11', '01'],
]

describe('the encoder', () => {
  it('has 2^(K−1) states and two branches out of each', () => {
    expect(K3.states).toBe(4)
    expect(K3.memory).toBe(2)
    expect(K3.rate).toBe(0.5)
    expect(K3.table.length).toBe(8)
    expect(K3.acs).toBe(8)
    expect(encoder(CONV_CODES.K7).states).toBe(64)
    expect(encoder(CONV_CODES.K7).acs).toBe(128)
    expect(encoder(CONV_CODES.K9).acs).toBe(512)
  })

  it('reproduces the trellis of the plan, row for row', () => {
    const rows = K3.table.map((b) => [stateText(K3, b.state), b.bit, stateText(K3, b.next), b.out.join('')])
    expect(rows).toEqual(PLAN_TRELLIS)
  })

  it('puts out the generator itself for a single one', () => {
    // The impulse response of the encoder is the generator, read down each
    // output in turn: 5 is 101 and 7 is 111.
    const out = encode(K3, [1, 0, 0], { terminate: false })
    expect(out.bits.filter((_, i) => i % 2 === 0)).toEqual([1, 0, 1])
    expect(out.bits.filter((_, i) => i % 2 === 1)).toEqual([1, 1, 1])
  })

  it('returns to state zero when the message is terminated', () => {
    const r = rng(5)
    for (let trial = 0; trial < 100; trial++) {
      const bits = Array.from({ length: 10 }, () => (r.uniform() < 0.5 ? 0 : 1))
      const out = encode(K3, bits)
      expect(out.state).toBe(0)
      expect(out.steps).toBe(12)
      expect(out.bits.length).toBe(24)
      expect(out.path[0]).toBe(0)
      expect(out.path[out.path.length - 1]).toBe(0)
    }
  })

  it('makes every path a codeword and every codeword a path', () => {
    // Over blocks of six the two sets are the same size and the same set,
    // which is what "the trellis is the encoder unrolled" means.
    const words = new Set()
    for (const bits of allVectors(6)) words.add(encode(K3, bits).bits.join(''))
    expect(words.size).toBe(64)
    const steps = trellis(K3, 8)
    expect(steps.length).toBe(8)
    for (const step of steps) expect(step.length).toBe(8)
    // Walk every path of the trellis that starts and ends at state 0.
    const paths = new Set()
    const walk = (state, i, out) => {
      if (i === 8) {
        if (state === 0) paths.add(out.join(''))
        return
      }
      // The last two steps are the termination, so they take the zero input.
      for (const b of i < 6 ? [0, 1] : [0]) {
        const branch = steps[i].find((x) => x.state === state && x.bit === b)
        walk(branch.next, i + 1, [...out, ...branch.out])
      }
    }
    walk(0, 0, [])
    expect(paths).toEqual(words)
  })

  it('refuses a generator it cannot hold', () => {
    expect(() => encoder({ K: 3, gens: [17] })).toThrow(/more than 3 taps/)
    expect(() => encoder({ K: 1, gens: [1] })).toThrow(/2 to 10/)
    expect(() => encoder({ K: 3, gens: [] })).toThrow(/at least one generator/)
  })
})

describe('free distance', () => {
  it('is found by search, not quoted', () => {
    expect(freeDistance(K3)).toBe(5)
    expect(freeDistance(encoder(CONV_CODES.K5))).toBe(7)
    expect(freeDistance(encoder(CONV_CODES.K7))).toBe(10)
    expect(freeDistance(encoder(CONV_CODES.K9))).toBe(12)
  })

  it('is the lowest weight of any terminated codeword but the zero one', () => {
    // The search says 5. An enumeration over every message of eight bits says
    // the same, which is what makes the search trustworthy on the codes too
    // large to enumerate.
    let smallest = Infinity
    for (const bits of allVectors(8)) {
      if (!bits.some((b) => b)) continue
      const w = encode(K3, bits).bits.reduce((a, b) => a + b, 0)
      smallest = Math.min(smallest, w)
    }
    expect(smallest).toBe(freeDistance(K3))
  })

  it('gives the asymptotic soft gain 10 log₁₀(R d_free)', () => {
    expect(softAsymptoticGain(0.5, 5)).toBeCloseTo(3.9794, 4)
    expect(softAsymptoticGain(0.5, 10)).toBeCloseTo(6.9897, 4)
    expect(tracebackRule(K3)).toBe(15)
    expect(tracebackRule(encoder(CONV_CODES.K7))).toBe(35)
  })

  it('counts the error events, and the reference code has (i + 1)2^i of them', () => {
    const { a, b } = weightSpectrum(K3, 12)
    expect(a.slice(0, 5)).toEqual([0, 0, 0, 0, 0])
    expect(a[5]).toBe(1)
    // The bit multiplicities of the reference code, which the union bound uses.
    for (let i = 0; i <= 7; i++) expect(b[5 + i], `d = ${5 + i}`).toBe((i + 1) * 2 ** i)
    expect(b.slice(5, 13)).toEqual([1, 4, 12, 32, 80, 192, 448, 1024])
    // The first weight with any path at all is the free distance.
    expect(a.findIndex((c) => c > 0)).toBe(freeDistance(K3))
  })
})

describe('Viterbi', () => {
  it('returns the transmitted path on a clean channel, at metric zero', () => {
    const r = rng(6)
    for (let trial = 0; trial < 100; trial++) {
      const bits = Array.from({ length: 12 }, () => (r.uniform() < 0.5 ? 0 : 1))
      const sent = encode(K3, bits)
      const out = viterbi(K3, sent.bits)
      expect(out.bits).toEqual(bits)
      expect(out.metric).toBe(0)
      expect(out.path).toEqual(sent.path)
      // Every survivor on the transmitted path has metric zero.
      out.steps.forEach((step, i) => expect(step.states[sent.path[i + 1]].metric, `step ${i}`).toBe(0))
    }
  })

  it('finds the same path as an exhaustive search over every message of eight bits', () => {
    const r = rng(7)
    for (let trial = 0; trial < 60; trial++) {
      const bits = Array.from({ length: 8 }, () => (r.uniform() < 0.5 ? 0 : 1))
      const sent = encode(K3, bits)
      const received = sent.bits.map((b) => (r.uniform() < 0.12 ? b ^ 1 : b))
      const out = viterbi(K3, received)
      let best = null
      for (const guess of allVectors(8)) {
        const m = encode(K3, guess).bits.reduce((acc, b, i) => acc + (b === received[i] ? 0 : 1), 0)
        if (!best || m < best.m) best = { guess, m }
      }
      expect(out.metric, `${bits.join('')}`).toBe(best.m)
      // Ties are possible, so the claim is the metric and not the bits. Where
      // one path is strictly best, the decoder returns it.
      const ties = allVectors(8).filter((g) => encode(K3, g).bits.reduce((acc, b, i) => acc + (b === received[i] ? 0 : 1), 0) === best.m)
      if (ties.length === 1) expect(out.bits).toEqual(best.guess)
    }
  })

  it('keeps every step, with both branches into every state', () => {
    const sent = encode(K3, [1, 0, 1, 1, 0, 0, 1, 0])
    const out = viterbi(K3, sent.bits)
    expect(out.steps.length).toBe(10)
    expect(out.acs).toBe(K3.acs * 10)
    // From the second step on, every state is reachable from two states.
    for (const step of out.steps.slice(2)) {
      for (const cell of step.states) {
        expect(cell.branches.length).toBe(2)
        expect(cell.branches.filter((b) => b.survivor).length).toBe(1)
        const kept = cell.branches.find((b) => b.survivor)
        for (const br of cell.branches) expect(kept.total).toBeLessThanOrEqual(br.total)
      }
    }
  })

  it('counts add-compare-select operations rather than describing them', () => {
    for (const [name, spec] of Object.entries(CONV_CODES)) {
      const enc = encoder(spec)
      const out = viterbi(enc, encode(enc, [1, 0, 1, 1]).bits)
      expect(out.acs, name).toBe(2 * enc.states * out.steps.length)
      // Exhaustive search over the same block is 2^L paths, which passes the
      // trellis count at every constraint length in the table.
      expect(2 ** 4, name).toBeLessThan(out.acs)
    }
  })

  it('measures the squared distance on soft values and the Hamming distance on hard ones', () => {
    expect(branchMetric([0, 0], [1, 1], false)).toBe(2)
    expect(branchMetric([0, 1], [0, 1], false)).toBe(0)
    // The soft metric of a clean symbol is zero, and of an inverted one is 4.
    expect(branchMetric([0, 1], [1, -1], true)).toBeCloseTo(0, 12)
    expect(branchMetric([0, 1], [-1, 1], true)).toBeCloseTo(8, 12)
  })

  it('decodes better from soft values than from hard ones, on the same noise', () => {
    const bits = bitStream(1000, 21)
    const sent = encode(K3, bits)
    const ch = gaussian(sent.bits, { ebN0Db: 2, rate: 0.5, seed: 31 })
    const soft = viterbi(K3, ch.y, { soft: true })
    const hard = viterbi(K3, ch.hard)
    expect(errorCount(soft.bits, bits)).toBeLessThan(errorCount(hard.bits, bits))
    // Both are better than no code at all on the same channel.
    expect(errorCount(hard.bits, bits)).toBeLessThan(ch.flips)
  })

  it('loses bits to a traceback shorter than the rule of thumb', () => {
    const bits = bitStream(2000, 21)
    const sent = encode(K3, bits)
    const ch = gaussian(sent.bits, { ebN0Db: 3, rate: 0.5, seed: 31 })
    const full = errorCount(viterbi(K3, ch.y, { soft: true }).bits, bits)
    const short = errorCount(viterbi(K3, ch.y, { soft: true, depth: 2 }).bits, bits)
    const rule = errorCount(viterbi(K3, ch.y, { soft: true, depth: tracebackRule(K3) }).bits, bits)
    expect(short).toBeGreaterThan(rule)
    expect(rule).toBe(full)
  })

  it('refuses a received sequence that is not a whole number of branches', () => {
    expect(() => viterbi(K3, [1, 0, 1])).toThrow(/whole number of 2-bit branches/)
  })
})
