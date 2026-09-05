import { describe, it, expect } from 'vitest'
import { rng } from '@ee-labs/random'
import {
  SHANNON_FLOOR_DB,
  becMatrix,
  biAwgnCapacity,
  binaryEntropy,
  bscCrossoverAt,
  bscMatrix,
  capacityAWGNDb,
  capacityBEC,
  capacityBSC,
  crossoverForCapacity,
  entropy,
  esN0ForBiAwgnCapacity,
  esN0ForBscCapacity,
  maxEntropy,
  mutualInformation,
  shannonLimit,
  shannonLimitDb,
} from './entropy.js'
import { arithmeticDecode, arithmeticEncode, blockSource, blockedHuffman, huffman, huffmanDecode, huffmanEncode, idealBits, probsOf, typicalSequence } from './source.js'

// Entropy, capacity, and the two coders. Every number here is a closed form
// computed twice: once by the module, and once in the test from the definition
// it comes from.

const S5 = [0.4, 0.2, 0.2, 0.1, 0.1]
const S4D = [0.5, 0.25, 0.125, 0.125]
const S2 = [0.9, 0.1]
const log2 = (x) => Math.log(x) / Math.LN2

describe('entropy', () => {
  it('is the sum of −p log₂ p, and is largest at the uniform distribution', () => {
    expect(entropy(S5)).toBeCloseTo(S5.reduce((a, p) => a - p * log2(p), 0), 12)
    expect(entropy(S5)).toBeCloseTo(2.121928, 6)
    expect(entropy([0.2, 0.2, 0.2, 0.2, 0.2])).toBeCloseTo(maxEntropy(5), 12)
    expect(maxEntropy(5)).toBeCloseTo(2.321928, 6)
    expect(entropy(S5)).toBeLessThan(maxEntropy(5))
    expect(entropy([1, 0, 0, 0, 0])).toBe(0)
    expect(entropy(S4D)).toBeCloseTo(1.75, 12)
    expect(binaryEntropy(0.1)).toBeCloseTo(0.468996, 6)
    expect(binaryEntropy(0.5)).toBe(1)
    expect(binaryEntropy(0)).toBe(0)
  })

  it('refuses a distribution that is not one', () => {
    expect(() => entropy([0.5, 0.4])).toThrow(/sums to 0.900000/)
    expect(() => entropy([1.5, -0.5])).toThrow(/probability of -0.5/)
    expect(() => entropy([])).toThrow(/at least one symbol/)
    expect(() => binaryEntropy(1.2)).toThrow(/between 0 and 1/)
  })
})

describe('capacity', () => {
  it('is 1 − h₂(p) on the binary symmetric channel, and the mutual information agrees', () => {
    for (const p of [0.001, 0.01, 0.1, 0.25, 0.5]) {
      expect(capacityBSC(p)).toBeCloseTo(1 - binaryEntropy(p), 12)
      // The capacity is the mutual information at the uniform input, which is
      // the maximising input for this channel by its symmetry.
      expect(mutualInformation([0.5, 0.5], bscMatrix(p)).I, `p = ${p}`).toBeCloseTo(capacityBSC(p), 12)
    }
    expect(capacityBSC(0.001)).toBeCloseTo(0.988592, 6)
    expect(capacityBSC(0.01)).toBeCloseTo(0.919207, 6)
    expect(capacityBSC(0.1)).toBeCloseTo(0.531004, 6)
    expect(capacityBSC(0.5)).toBeCloseTo(0, 12)
    expect(crossoverForCapacity(0.5)).toBeCloseTo(0.110028, 6)
    expect(capacityBSC(crossoverForCapacity(0.5))).toBeCloseTo(0.5, 9)
  })

  it('is 1 − e on the erasure channel, exactly', () => {
    for (const e of [0, 0.1, 0.25, 0.5, 1]) {
      expect(capacityBEC(e)).toBe(1 - e)
      expect(mutualInformation([0.5, 0.5], becMatrix(e)).I, `e = ${e}`).toBeCloseTo(1 - e, 12)
    }
  })

  it('is log₂(1 + S/N) on the Gaussian channel', () => {
    expect(capacityAWGNDb(0)).toBeCloseTo(1, 12)
    expect(capacityAWGNDb(6)).toBeCloseTo(2.316456, 6)
    expect(capacityAWGNDb(10)).toBeCloseTo(3.459432, 6)
    expect(capacityAWGNDb(20)).toBeCloseTo(6.658211, 6)
    for (const db of [-3, 0, 6, 10, 20]) expect(capacityAWGNDb(db)).toBeCloseTo(log2(1 + 10 ** (db / 10)), 12)
  })

  it('puts the Shannon limit at (2^r − 1)/r, and its floor at ln 2', () => {
    expect(shannonLimitDb(0.5)).toBeCloseTo(-0.817457, 6)
    expect(shannonLimitDb(1)).toBeCloseTo(0, 12)
    expect(shannonLimitDb(2)).toBeCloseTo(1.760913, 6)
    expect(shannonLimitDb(4)).toBeCloseTo(5.740313, 6)
    expect(SHANNON_FLOOR_DB).toBeCloseTo(-1.591745, 6)
    // The limit rises with the spectral efficiency, and falls to ln 2 as it
    // goes to zero.
    let last = shannonLimit(1e-6)
    expect(last).toBeCloseTo(Math.LN2, 6)
    for (const r of [0.25, 0.5, 1, 2, 4, 8]) {
      expect(shannonLimit(r), `r = ${r}`).toBeGreaterThan(last)
      last = shannonLimit(r)
    }
    // The capacity at the limit is the spectral efficiency it was taken at.
    for (const r of [0.5, 1, 2]) expect(log2(1 + r * shannonLimit(r))).toBeCloseTo(r, 12)
    expect(() => shannonLimit(0)).toThrow(/above zero/)
  })

  it('integrates the binary-input Gaussian capacity, and reports how far the two grids differ', () => {
    const c = biAwgnCapacity(0)
    expect(c.converged).toBe(true)
    expect(c.delta).toBeLessThan(c.tolerance)
    // The capacity of a binary input is at most one bit, and is below the
    // unconstrained capacity at the same ratio.
    for (const db of [-4, -2, 0, 4, 10]) {
      const x = biAwgnCapacity(db)
      expect(x.capacity, `${db} dB`).toBeLessThanOrEqual(1)
      expect(x.capacity, `${db} dB`).toBeLessThan(capacityAWGNDb(db) + 1e-9)
      expect(x.capacity, `${db} dB`).toBeGreaterThan(0)
    }
    expect(biAwgnCapacity(10).capacity).toBeCloseTo(1, 4)
    // Rate one half is reached 1.585 dB lower with soft decisions than with
    // hard ones, which is the number F3 is about.
    const soft = esN0ForBiAwgnCapacity(0.5)
    const hard = esN0ForBscCapacity(0.5)
    expect(soft).toBeCloseTo(-2.823, 3)
    expect(hard).toBeCloseTo(-1.238, 3)
    expect(hard - soft).toBeCloseTo(1.585, 3)
    // The hard-decision channel is the Gaussian one after a threshold, so its
    // crossover at that ratio is the one the capacity was solved for.
    expect(bscCrossoverAt(hard)).toBeCloseTo(crossoverForCapacity(0.5), 9)
  })
})

describe('Huffman', () => {
  it('reaches within one bit of the entropy, and never below it', () => {
    for (const probs of [S5, S4D, S2, [0.99, 0.01], [0.25, 0.25, 0.25, 0.25], [0.3, 0.3, 0.2, 0.1, 0.05, 0.05]]) {
      const c = huffman(probs)
      expect(c.meanLength, `${probs}`).toBeGreaterThanOrEqual(c.entropy - 1e-12)
      expect(c.meanLength, `${probs}`).toBeLessThan(c.entropy + 1)
      expect(c.kraft, `${probs}`).toBeCloseTo(1, 12)
    }
  })

  it('gives the reference source lengths 2, 2, 2, 3, 3 and an average of 2.2 bit', () => {
    const c = huffman(S5)
    expect(c.lengths).toEqual([2, 2, 2, 3, 3])
    expect(c.meanLength).toBeCloseTo(2.2, 12)
    expect(c.redundancy).toBeCloseTo(0.078072, 6)
    expect(100 * c.efficiency).toBeCloseTo(96.451, 3)
    expect(c.kraft).toBeCloseTo(1, 12)
    expect(c.fixed).toBe(3)
    expect(1 - c.meanLength / c.fixed).toBeCloseTo(0.266667, 6)
  })

  it('is exact on a dyadic source and worst on a nearly certain one', () => {
    const dyadic = huffman(S4D)
    expect(dyadic.lengths).toEqual([1, 2, 3, 3])
    expect(dyadic.meanLength).toBeCloseTo(dyadic.entropy, 12)
    expect(dyadic.redundancy).toBeCloseTo(0, 12)
    // Every length is −log₂ p exactly, which is what a dyadic source means.
    dyadic.lengths.forEach((l, i) => expect(l).toBe(-log2(S4D[i])))
    const binary = huffman(S2)
    expect(binary.meanLength).toBe(1)
    expect(binary.entropy).toBeCloseTo(0.468996, 6)
    expect(binary.redundancy).toBeCloseTo(0.531004, 6)
  })

  it('recovers the gap by blocking, as 1/n', () => {
    const measured = [1, 2, 3, 4].map((n) => blockedHuffman(S2, n).meanLength)
    expect(measured[0]).toBeCloseTo(1, 12)
    expect(measured[1]).toBeCloseTo(0.645, 6)
    expect(measured[2]).toBeCloseTo(0.532667, 6)
    expect(measured[3]).toBeCloseTo(0.49255, 6)
    const H = binaryEntropy(0.1)
    for (let i = 1; i < 4; i++) {
      expect(measured[i], `n = ${i + 1}`).toBeLessThan(measured[i - 1])
      expect(measured[i], `n = ${i + 1}`).toBeGreaterThan(H)
      expect(measured[i], `n = ${i + 1}`).toBeLessThan(H + 1 / (i + 1) + 1e-12)
    }
    // The blocked source is the product distribution, so its entropy is n times
    // the original's.
    for (const n of [2, 3, 4]) expect(blockSource(S2, n).entropy, `n = ${n}`).toBeCloseTo(n * H, 12)
    expect(() => blockSource(S5, 8)).toThrow(/past this coder/)
  })

  it('round-trips every message it codes', () => {
    const r = rng(12)
    for (const probs of [S5, S4D, S2]) {
      const c = huffman(probs)
      for (let trial = 0; trial < 200; trial++) {
        const symbols = Array.from({ length: 40 }, () => Math.floor(r.uniform() * probs.length))
        const bits = huffmanEncode(symbols, c)
        expect(huffmanDecode(bits, c), `${probs}`).toEqual(symbols)
      }
    }
    const c = huffman(S5)
    expect(() => huffmanEncode([9], c)).toThrow(/not a symbol/)
    expect(() => huffmanDecode('1', c)).toThrow(/part way down the tree/)
  })
})

describe('the arithmetic coder', () => {
  const counts = [9, 1]

  it('codes a sequence in at most −log₂ P + 2 bits', () => {
    for (const n of [100, 1000]) {
      const seq = typicalSequence(counts, n)
      const a = arithmeticEncode(seq, counts)
      expect(a.ideal).toBeCloseTo(n * binaryEntropy(0.1), 9)
      expect(a.bound).toBeCloseTo(a.ideal + 2, 12)
      expect(a.length).toBeLessThanOrEqual(a.bound)
      expect(a.length).toBeGreaterThan(a.ideal)
      expect(a.bound / n, `n = ${n}`).toBeCloseTo(n === 100 ? 0.488996 : 0.470996, 6)
    }
    // The bound per symbol falls to the entropy as the sequence lengthens,
    // which is why the coder needs no blocking.
    const short = arithmeticEncode(typicalSequence(counts, 100), counts)
    const long = arithmeticEncode(typicalSequence(counts, 1000), counts)
    expect(long.bound / 1000).toBeLessThan(short.bound / 100)
    expect(long.bound / 1000).toBeGreaterThan(binaryEntropy(0.1))
  })

  it('beats Huffman on a skewed source, at 100 symbols', () => {
    const seq = typicalSequence(counts, 100)
    const a = arithmeticEncode(seq, counts)
    const h = huffman(probsOf(counts))
    expect(a.length / 100).toBeLessThan(h.meanLength)
    expect(probsOf(counts)).toEqual([0.9, 0.1])
  })

  it('round-trips 10 000 random streams', () => {
    const r = rng(21)
    const models = [[9, 1], [1, 1], [5, 3, 2], [1, 2, 3, 4]]
    let streams = 0
    for (const model of models) {
      const total = model.reduce((a, b) => a + b, 0)
      for (let trial = 0; trial < 2500; trial++) {
        const n = 1 + Math.floor(r.uniform() * 24)
        const symbols = Array.from({ length: n }, () => {
          let u = r.uniform() * total
          for (let s = 0; s < model.length; s++) {
            u -= model[s]
            if (u < 0) return s
          }
          return model.length - 1
        })
        const a = arithmeticEncode(symbols, model)
        expect(arithmeticDecode(a.bits, model, n), `${model} ${symbols.join('')}`).toEqual(symbols)
        expect(a.length, `${model} ${symbols.join('')}`).toBeLessThanOrEqual(Math.ceil(idealBits(symbols, model)) + 2)
        streams++
      }
    }
    expect(streams).toBe(10000)
  })

  it('refuses a model it cannot work in', () => {
    expect(() => arithmeticEncode([0], [0.9, 0.1])).toThrow(/whole numbers above zero/)
    expect(() => arithmeticEncode([5], [9, 1])).toThrow(/not a symbol/)
    expect(() => typicalSequence([9, 1], 15)).toThrow(/whole shares/)
  })
})
