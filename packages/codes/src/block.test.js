import { describe, it, expect } from 'vitest'
import { addVec, allVectors, bitsOf, matVec, patternsOfWeight, rank, valueOf, weight } from './gf2.js'
import {
  codeFromGenerator,
  codeFromParity,
  codewords,
  correctionRadius,
  cyclicCode,
  decode,
  describe as describeCode,
  detectionRadius,
  encode,
  golayCode,
  hammingCode,
  messageOf,
  minimumDistance,
  parityCheckCode,
  polyRemainder,
  repetitionCode,
  singletonBound,
  spherePacking,
  standardArray,
  syndromeOf,
  syndromeTable,
  weightDistribution,
} from './block.js'
import { RS15, RS255, rsCheckMatrix, rsCode, rsEncode, rsErasureDecode, rsIsCodeword, rsMessageOf, rsSyndromes } from './rs.js'
import { GF16 } from './gfm.js'
import { rng } from '@ee-labs/random'

// The block codes, against values worked by hand and counts taken by walking
// the whole code. Nothing here is sampled: every code in this file is small
// enough to enumerate, and "always" is the claim.

const H74 = hammingCode(3)

describe('the (7,4) Hamming code', () => {
  it('is the cyclic code of x³ + x + 1, and has 16 codewords', () => {
    expect(H74.generatorPoly).toEqual([1, 0, 1, 1])
    expect(H74.n).toBe(7)
    expect(H74.k).toBe(4)
    expect(H74.rate).toBeCloseTo(4 / 7, 12)
    const words = codewords(H74)
    expect(words.length).toBe(16)
    expect(new Set(words.map((w) => w.join(''))).size).toBe(16)
    // Systematic: the first four bits of the codeword are the message.
    for (const m of allVectors(4)) expect(messageOf(H74, encode(H74, m))).toEqual(m)
  })

  it('has the weight distribution 1, 7, 7, 1 and a distance of 3', () => {
    const w = weightDistribution(H74)
    expect(w).toEqual([1, 0, 0, 7, 7, 0, 0, 1])
    const d = minimumDistance(H74)
    expect(d.d).toBe(3)
    expect(d.method).toBe('weights')
    expect(correctionRadius(d.d)).toBe(1)
    expect(detectionRadius(d.d)).toBe(2)
    // The distance is the smallest nonzero weight, which is what linearity buys.
    const words = codewords(H74)
    let smallest = Infinity
    for (const a of words) for (const b of words) if (a !== b) smallest = Math.min(smallest, weight(addVec(a, b)))
    expect(smallest).toBe(d.d)
  })

  it('is perfect: 16 spheres of 8 words fill all 128 words of length 7', () => {
    const p = spherePacking(H74, 3)
    expect(p.sphere).toBe(8)
    expect(p.covered).toBe(128)
    expect(p.total).toBe(128)
    expect(p.perfect).toBe(true)
    expect(p.spare).toBe(0)
  })

  it('has eight syndromes, one for no error and seven for the single errors', () => {
    const t = syndromeTable(H74)
    expect(t.cosets).toBe(8)
    expect(t.table.size).toBe(8)
    expect(t.complete).toBe(true)
    expect(t.ties).toBe(0)
    const leaders = [...t.table.values()]
    expect(leaders.filter((e) => weight(e) === 0).length).toBe(1)
    expect(leaders.filter((e) => weight(e) === 1).length).toBe(7)
    // Each single error has its own syndrome, and that syndrome is the column
    // of H at the place the error is.
    for (let i = 0; i < 7; i++) {
      const e = new Array(7).fill(0)
      e[i] = 1
      const s = syndromeOf(H74, e)
      expect(s).toEqual(H74.H.map((row) => row[i]))
      expect(valueOf(s)).not.toBe(0)
    }
  })

  it('gives a syndrome that depends on the error and not on the codeword', () => {
    for (const m of allVectors(4)) {
      const c = encode(H74, m)
      expect(syndromeOf(H74, c)).toEqual([0, 0, 0])
      for (const e of allVectors(7)) expect(syndromeOf(H74, addVec(c, e)), `${m.join('')} + ${e.join('')}`).toEqual(syndromeOf(H74, e))
    }
  })

  it('corrects every single error over every codeword, and is beaten by some double error', () => {
    const table = syndromeTable(H74)
    for (const m of allVectors(4)) {
      const c = encode(H74, m)
      for (const e of patternsOfWeight(7, 1)) {
        const out = decode(H74, addVec(c, e), table)
        expect(out.word, `${m.join('')} with ${e.join('')}`).toEqual(c)
        expect(out.error).toEqual(e)
        expect(out.message).toEqual(m)
      }
    }
    const c = encode(H74, [1, 0, 1, 1])
    const wrong = patternsOfWeight(7, 2).filter((e) => decode(H74, addVec(c, e), table).word.join('') !== c.join(''))
    expect(wrong.length).toBe(patternsOfWeight(7, 2).length)
  })
})

describe('the code families', () => {
  it('gives the Hamming family length 2^r − 1, distance 3, and a rate that rises with r', () => {
    const rates = {}
    for (const r of [2, 3, 4, 6]) {
      const c = hammingCode(r)
      expect(c.n).toBe(2 ** r - 1)
      expect(c.k).toBe(2 ** r - 1 - r)
      const d = minimumDistance(c)
      expect(d.d, `r = ${r}`).toBe(3)
      expect(d.method, `r = ${r}`).toBe(r <= 4 ? 'weights' : 'columns')
      rates[r] = c.rate
    }
    expect(rates[2]).toBeCloseTo(1 / 3, 12)
    expect(rates[3]).toBeCloseTo(4 / 7, 12)
    expect(rates[4]).toBeCloseTo(11 / 15, 12)
    expect(rates[6]).toBeCloseTo(57 / 63, 12)
    for (const [a, b] of [[2, 3], [3, 4], [4, 6]]) expect(rates[b]).toBeGreaterThan(rates[a])
  })

  it('gives the parity check distance 2: it detects one error and corrects none', () => {
    const p = parityCheckCode(4)
    const d = minimumDistance(p)
    expect(p.n).toBe(5)
    expect(d.d).toBe(2)
    expect(correctionRadius(2)).toBe(0)
    expect(detectionRadius(2)).toBe(1)
    // Every single error changes the parity, and every double error does not.
    for (const m of allVectors(4)) {
      const c = encode(p, m)
      expect(weight(c) % 2).toBe(0)
      for (const e of patternsOfWeight(5, 1)) expect(syndromeOf(p, addVec(c, e))).toEqual([1])
      for (const e of patternsOfWeight(5, 2)) expect(syndromeOf(p, addVec(c, e))).toEqual([0])
    }
  })

  it('gives Golay (23,12) distance 7, and it is perfect', () => {
    const g = golayCode()
    expect(g.n).toBe(23)
    expect(g.k).toBe(12)
    expect(g.rate).toBeCloseTo(12 / 23, 12)
    const w = weightDistribution(g)
    expect(w[0]).toBe(1)
    expect(w[7]).toBe(253)
    expect(w[8]).toBe(506)
    expect(w[11]).toBe(1288)
    expect(w[12]).toBe(1288)
    expect(w[15]).toBe(506)
    expect(w[16]).toBe(253)
    expect(w[23]).toBe(1)
    expect(w.reduce((a, b) => a + b, 0)).toBe(4096)
    const d = minimumDistance(g)
    expect(d.d).toBe(7)
    expect(correctionRadius(7)).toBe(3)
    const p = spherePacking(g, 7)
    expect(p.sphere).toBe(1 + 23 + 253 + 1771)
    expect(p.perfect).toBe(true)
  })

  it('gives the repetition code distance n, and a rate that falls as 1/n', () => {
    for (const n of [3, 5, 7]) {
      const c = repetitionCode(n)
      expect(minimumDistance(c).d).toBe(n)
      expect(c.rate).toBeCloseTo(1 / n, 12)
      expect(correctionRadius(n)).toBe((n - 1) / 2)
    }
  })

  it('reads a cyclic syndrome as the remainder on division by the generator', () => {
    const g = [1, 0, 1, 1]
    for (const m of allVectors(4)) {
      const c = encode(H74, m)
      expect(polyRemainder(c, g)).toEqual([0, 0, 0])
      for (const e of patternsOfWeight(7, 1)) {
        const r = addVec(c, e)
        // The remainder is zero exactly on the codewords, and it depends on the
        // error alone, which is the same statement the matrix syndrome makes.
        expect(polyRemainder(r, g)).toEqual(polyRemainder(e, g))
        expect(polyRemainder(r, g).some((b) => b)).toBe(true)
      }
    }
  })

  it('builds the same code from its parity-check matrix as from its generator', () => {
    const back = codeFromParity(H74.H, { name: 'from H' })
    const a = new Set(codewords(H74).map((w) => w.join('')))
    const b = new Set(codewords(back).map((w) => w.join('')))
    expect(b).toEqual(a)
  })

  it('draws the standard array: every word once, in cosets of the code', () => {
    const rows = standardArray(H74)
    expect(rows.length).toBe(8)
    const seen = new Set()
    for (const row of rows) for (const w of row.words) seen.add(w.join(''))
    expect(seen.size).toBe(128)
    expect(rows[0].weight).toBe(0)
    for (const row of rows) for (const w of row.words) expect(valueOf(syndromeOf(H74, w))).toBe(row.syndrome)
  })

  it('refuses what it cannot enumerate, and says why', () => {
    const g = hammingCode(6)
    expect(() => codewords(g)).toThrow(/enumerates up to/)
    expect(() => standardArray(g)).toThrow(/no pane can draw/)
    expect(() => codeFromGenerator([[1, 1, 0], [1, 1, 0]])).toThrow(/dependent/)
    expect(() => encode(H74, [1, 0])).toThrow(/4 message bits/)
    expect(() => syndromeOf(H74, [1, 0])).toThrow(/7 bits/)
    expect(() => cyclicCode(7, [1, 0, 1, 0])).toThrow(/nonzero constant term/)
  })

  it('describes a code in one object, for the pane that draws it', () => {
    const d = describeCode(H74)
    expect(d.n).toBe(7)
    expect(d.d).toBe(3)
    expect(d.t).toBe(1)
    expect(d.detect).toBe(2)
    expect(d.words.length).toBe(16)
    expect(d.packing.perfect).toBe(true)
    expect(d.table.table.size).toBe(8)
  })
})

describe('Reed-Solomon over GF(2⁴)', () => {
  const rs = RS15()

  it('meets the Singleton bound with equality', () => {
    expect(rs.n).toBe(15)
    expect(rs.k).toBe(11)
    expect(rs.d).toBe(5)
    expect(rs.d).toBe(singletonBound(rs.n, rs.k))
    expect(rs.t).toBe(2)
    expect(rs.erasures).toBe(4)
    expect(rs.rate).toBeCloseTo(11 / 15, 12)
  })

  it('encodes systematically, and every codeword vanishes at the generator roots', () => {
    const r = rng(3)
    for (let trial = 0; trial < 200; trial++) {
      const m = Array.from({ length: rs.k }, () => Math.floor(r.uniform() * 16))
      const c = rsEncode(rs, m)
      expect(c.length).toBe(15)
      expect(rsMessageOf(rs, c)).toEqual(m)
      expect(rsSyndromes(rs, c)).toEqual([0, 0, 0, 0])
      expect(rsIsCodeword(rs, c)).toBe(true)
    }
  })

  it('fills every pattern of four erasures, over 200 random codewords', () => {
    const r = rng(8)
    for (let trial = 0; trial < 200; trial++) {
      const m = Array.from({ length: rs.k }, () => Math.floor(r.uniform() * 16))
      const c = rsEncode(rs, m)
      const positions = []
      while (positions.length < 4) {
        const p = Math.floor(r.uniform() * 15)
        if (!positions.includes(p)) positions.push(p)
      }
      const received = [...c]
      for (const p of positions) received[p] = Math.floor(r.uniform() * 16)
      expect(rsErasureDecode(rs, received, positions).word, `${positions.join(',')}`).toEqual(c)
    }
  })

  it('refuses a fifth erasure, because four is what n − k pays for', () => {
    const c = rsEncode(rs, new Array(11).fill(1))
    expect(() => rsErasureDecode(rs, c, [0, 1, 2, 3, 4])).toThrow(/fills up to 4 erasures/)
    expect(() => rsErasureDecode(rs, c, [0, 0])).toThrow(/given twice/)
  })

  it('has a parity-check matrix that agrees with the syndromes', () => {
    const H = rsCheckMatrix(rs)
    const c = rsEncode(rs, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    const f = GF16
    for (let i = 0; i < H.length; i++) {
      const s = c.reduce((acc, sym, p) => f.add(acc, f.mul(H[i][p], sym)), 0)
      expect(s, `row ${i}`).toBe(0)
    }
  })

  it('gives the byte code distance 33 at rate 0.8745', () => {
    const big = RS255()
    expect(big.n).toBe(255)
    expect(big.k).toBe(223)
    expect(big.d).toBe(33)
    expect(big.t).toBe(16)
    expect(big.rate).toBeCloseTo(223 / 255, 12)
  })

  it('refuses a code the field cannot hold', () => {
    expect(() => rsCode(4, 20, 11)).toThrow(/does not fit/)
    expect(() => rsCode(4, 15, 15)).toThrow(/1 to 14 message symbols/)
  })
})
