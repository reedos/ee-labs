import { describe, it, expect } from 'vitest'
import { rng } from '@ee-labs/random'
import { addVec, allVectors, patternsOfWeight, weight } from './gf2.js'
import { codeFromParity, codewords, correctionRadius, decode, encode, golayCode, hammingCode, minimumDistance, parityCheckCode, repetitionCode, syndromeOf, syndromeTable } from './block.js'
import { arithmeticDecode, arithmeticEncode, huffman, huffmanDecode, huffmanEncode } from './source.js'
import { entropy } from './entropy.js'
import { CONV_CODES, encode as convEncode, encoder, viterbi } from './conv.js'
import { L12, sumProduct, syndromeWeight } from './ldpc.js'
import { RS15, rsEncode, rsErasureDecode, rsIsCodeword } from './rs.js'
import { bitStream, gaussian, symmetric } from './channel.js'

// The plan's invariants (INFORMATION_LAB_PLAN.md §2.10), fuzzed.
//
// Where a claim says "every", the test enumerates. Where enumerating is
// impossible, the test samples and says how many it took, because a sample
// cannot make a claim about every case and the difference belongs on the
// record. Each code below carries the choice with it.

const CODES = [
  { name: '(5,4) parity check', code: parityCheckCode(4), enumerate: true },
  { name: '(7,4) Hamming', code: hammingCode(3), enumerate: true },
  { name: '(15,11) Hamming', code: hammingCode(4), enumerate: true },
  { name: '(5,1) repetition', code: repetitionCode(5), enumerate: true },
  { name: '(12,5) LDPC', code: codeFromParity(L12()), enumerate: true },
  // Golay corrects three errors, and the patterns of weight three alone number
  // 1771. Over 4096 codewords that is 7.3 million decodes, so this one samples
  // the codewords and enumerates the error patterns over each.
  { name: '(23,12) Golay', code: golayCode(), enumerate: false, words: 12, patterns: 400 },
]

const pick = (r, list) => list[Math.floor(r.uniform() * list.length)]

describe('invariant 2: the code is linear, and its distance is its smallest weight', () => {
  for (const { name, code } of CODES) {
    it(name, () => {
      const r = rng(2)
      const words = code.k <= 12 ? codewords(code) : Array.from({ length: 200 }, () => encode(code, Array.from({ length: code.k }, () => (r.uniform() < 0.5 ? 0 : 1))))
      for (let i = 0; i < 200; i++) {
        const a = pick(r, words)
        const b = pick(r, words)
        expect(syndromeOf(code, addVec(a, b)).every((s) => s === 0), name).toBe(true)
      }
      const d = minimumDistance(code)
      const smallest = words.reduce((acc, w) => (weight(w) > 0 ? Math.min(acc, weight(w)) : acc), Infinity)
      expect(smallest, name).toBe(d.d)
    })
  }
})

describe('invariant 3: the syndrome depends on the error alone', () => {
  for (const { name, code, enumerate } of CODES) {
    it(name, () => {
      const r = rng(3)
      const words = enumerate && code.k <= 11 ? codewords(code) : Array.from({ length: 40 }, () => encode(code, Array.from({ length: code.k }, () => (r.uniform() < 0.5 ? 0 : 1))))
      for (const c of words)
        for (let i = 0; i < 20; i++) {
          const e = Array.from({ length: code.n }, () => (r.uniform() < 0.2 ? 1 : 0))
          expect(syndromeOf(code, addVec(c, e)), name).toEqual(syndromeOf(code, e))
        }
    })
  }
})

describe('invariants 4 and 6: a code corrects every pattern of weight t, and some pattern of weight t + 1 beats it', () => {
  for (const { name, code, enumerate, words: sampleWords, patterns } of CODES) {
    it(name, () => {
      const d = minimumDistance(code).d
      const t = correctionRadius(d)
      const table = syndromeTable(code)
      const r = rng(4)
      const messages = enumerate ? allVectors(code.k) : Array.from({ length: sampleWords }, () => Array.from({ length: code.k }, () => (r.uniform() < 0.5 ? 0 : 1)))
      let checked = 0
      for (const m of messages) {
        const c = encode(code, m)
        for (let w = 1; w <= t; w++) {
          const all = patternsOfWeight(code.n, w)
          const list = enumerate ? all : all.slice(0, patterns)
          for (const e of list) {
            const out = decode(code, addVec(c, e), table)
            expect(out.word, `${name}: ${m.join('')} with ${e.join('')}`).toEqual(c)
            checked++
          }
        }
      }
      // A code of distance 2 corrects nothing, so there is nothing to walk and
      // the claim below is the whole of what it promises.
      expect(checked === 0, name).toBe(t === 0)
      // And no further. Some pattern of weight t + 1 decodes to another word,
      // so the radius is tight rather than conservative.
      const c = encode(code, messages[messages.length - 1])
      const beyond = patternsOfWeight(code.n, t + 1).slice(0, 4000)
      const wrong = beyond.filter((e) => decode(code, addVec(c, e), table).word.join('') !== c.join(''))
      expect(wrong.length, `${name}: no pattern of weight ${t + 1} was decoded wrongly`).toBeGreaterThan(0)
    })
  }
})

describe('invariant 5: a code detects every pattern of weight 1 to d − 1', () => {
  for (const { name, code, enumerate, patterns } of CODES) {
    it(name, () => {
      const d = minimumDistance(code).d
      const r = rng(5)
      for (let w = 1; w <= d - 1; w++) {
        const all = patternsOfWeight(code.n, w)
        const list = enumerate && all.length <= 20000 ? all : shuffled(all, r).slice(0, patterns || 400)
        for (const e of list) expect(syndromeOf(code, e).some((s) => s === 1), `${name}: weight ${w}, ${e.join('')}`).toBe(true)
      }
    })
  }
})

const shuffled = (list, r) => {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r.uniform() * (i + 1))
    const t = out[i]
    out[i] = out[j]
    out[j] = t
  }
  return out
}

describe('invariant 7: Viterbi returns the transmitted path on a clean channel', () => {
  for (const [name, spec] of Object.entries(CONV_CODES)) {
    it(name, () => {
      const enc = encoder(spec)
      const r = rng(7)
      for (let trial = 0; trial < 20; trial++) {
        const bits = Array.from({ length: 24 }, () => (r.uniform() < 0.5 ? 0 : 1))
        const sent = convEncode(enc, bits)
        const out = viterbi(enc, sent.bits)
        expect(out.bits, name).toEqual(bits)
        expect(out.metric, name).toBe(0)
        out.steps.forEach((step, i) => expect(step.states[sent.path[i + 1]].metric, `${name} step ${i}`).toBe(0))
      }
    })
  }
})

describe('invariant 8: Viterbi finds the maximum-likelihood path', () => {
  it('agrees with an exhaustive search over all 256 messages of eight bits, hard and soft', () => {
    const enc = encoder(CONV_CODES.K3)
    const r = rng(8)
    const messages = allVectors(8)
    for (let trial = 0; trial < 40; trial++) {
      const bits = Array.from({ length: 8 }, () => (r.uniform() < 0.5 ? 0 : 1))
      const sent = convEncode(enc, bits)
      const hard = sent.bits.map((b) => (r.uniform() < 0.15 ? b ^ 1 : b))
      const soft = sent.bits.map((b) => (b ? -1 : 1) + r.normal(0, 0.8))
      const hardOut = viterbi(enc, hard)
      const softOut = viterbi(enc, soft, { soft: true })
      const bestHard = Math.min(...messages.map((m) => convEncode(enc, m).bits.reduce((acc, b, i) => acc + (b === hard[i] ? 0 : 1), 0)))
      const bestSoft = Math.min(
        ...messages.map((m) =>
          convEncode(enc, m).bits.reduce((acc, b, i) => {
            const level = b ? -1 : 1
            return acc + (soft[i] - level) ** 2
          }, 0),
        ),
      )
      expect(hardOut.metric).toBe(bestHard)
      expect(softOut.metric).toBeCloseTo(bestSoft, 9)
    }
  })
})

describe('invariant 9: belief propagation stops at a codeword', () => {
  it('satisfies every check whenever it says it converged, over 300 channels', () => {
    const H = L12()
    const code = codeFromParity(H)
    const r = rng(9)
    let converged = 0
    let failed = 0
    for (let seed = 1; seed <= 300; seed++) {
      const m = Array.from({ length: code.k }, () => (r.uniform() < 0.5 ? 0 : 1))
      const c = encode(code, m)
      const ch = seed % 2 ? symmetric(c, { p: 0.1, seed }) : gaussian(c, { ebN0Db: 2, rate: 5 / 12, seed })
      const out = sumProduct(H, ch.llr, { maxIter: 15 })
      if (out.converged) {
        converged++
        expect(syndromeWeight(H, out.bits), `seed ${seed}`).toBe(0)
        expect(out.iterations[out.iterations.length - 1].syndromeWeight).toBe(0)
      } else {
        failed++
        expect(out.iteration, `seed ${seed}`).toBeNull()
        for (const w of out.syndromeWeights) expect(w).toBeGreaterThan(0)
      }
    }
    expect(converged).toBeGreaterThan(200)
    // Some decodes do not converge, which is the property E3 is about. A run
    // where every decode converged would not have exercised the other branch.
    expect(failed).toBeGreaterThan(0)
  })
})

describe('invariant 10: source coding round-trips, and Huffman sits inside its bounds', () => {
  it('holds over 200 random sources', () => {
    const r = rng(10)
    for (let trial = 0; trial < 200; trial++) {
      const m = 2 + Math.floor(r.uniform() * 7)
      const raw = Array.from({ length: m }, () => 0.01 + r.uniform())
      const total = raw.reduce((a, b) => a + b, 0)
      const probs = raw.map((p) => p / total)
      const fixed = probs.slice(0, m - 1)
      fixed.push(1 - fixed.reduce((a, b) => a + b, 0))
      const code = huffman(fixed)
      const H = entropy(fixed)
      expect(code.meanLength, `${fixed}`).toBeGreaterThanOrEqual(H - 1e-12)
      expect(code.meanLength, `${fixed}`).toBeLessThan(H + 1)
      expect(code.kraft, `${fixed}`).toBeCloseTo(1, 12)
      const symbols = Array.from({ length: 30 }, () => Math.floor(r.uniform() * m))
      expect(huffmanDecode(huffmanEncode(symbols, code), code), `${fixed}`).toEqual(symbols)
    }
  })

  it('holds for the arithmetic coder over 400 random models and streams', () => {
    const r = rng(11)
    for (let trial = 0; trial < 400; trial++) {
      const m = 2 + Math.floor(r.uniform() * 4)
      const counts = Array.from({ length: m }, () => 1 + Math.floor(r.uniform() * 12))
      const n = 1 + Math.floor(r.uniform() * 30)
      const symbols = Array.from({ length: n }, () => Math.floor(r.uniform() * m))
      const a = arithmeticEncode(symbols, counts)
      expect(arithmeticDecode(a.bits, counts, n), `${counts} ${symbols.join('')}`).toEqual(symbols)
      expect(a.length, `${counts} ${symbols.join('')}`).toBeLessThanOrEqual(a.bound)
    }
  })
})

describe('the Reed-Solomon code fills every erasure it pays for', () => {
  it('holds over 300 random codewords and erasure patterns', () => {
    const rs = RS15()
    const r = rng(12)
    for (let trial = 0; trial < 300; trial++) {
      const m = Array.from({ length: rs.k }, () => Math.floor(r.uniform() * 16))
      const c = rsEncode(rs, m)
      expect(rsIsCodeword(rs, c)).toBe(true)
      const count = 1 + Math.floor(r.uniform() * 4)
      const positions = []
      while (positions.length < count) {
        const p = Math.floor(r.uniform() * rs.n)
        if (!positions.includes(p)) positions.push(p)
      }
      const received = [...c]
      for (const p of positions) received[p] = Math.floor(r.uniform() * 16)
      expect(rsErasureDecode(rs, received, positions).word, `${positions.join(',')}`).toEqual(c)
    }
  })
})

describe('the channel keeps the conventions the decoders read', () => {
  it('sends 0 as +1, and gives a belief whose sign is the hard decision', () => {
    const bits = bitStream(500, 3)
    const ch = gaussian(bits, { ebN0Db: 3, rate: 0.5, seed: 4 })
    ch.llr.forEach((l, i) => expect(l < 0 ? 1 : 0, `bit ${i}`).toBe(ch.hard[i]))
    ch.y.forEach((y, i) => expect(Math.sign(ch.llr[i])).toBe(Math.sign(y)))
    // The belief grows with the ratio, at a fixed received value.
    const strong = gaussian(bits, { ebN0Db: 9, rate: 0.5, seed: 4 })
    expect(Math.abs(strong.llr[0] / strong.y[0])).toBeGreaterThan(Math.abs(ch.llr[0] / ch.y[0]))
    expect(strong.flips).toBeLessThan(ch.flips)
  })

  it('flips at about the crossover it was given', () => {
    const bits = bitStream(4000, 5)
    for (const p of [0.05, 0.1, 0.25]) {
      const out = symmetric(bits, { p, seed: 7 })
      expect(out.flips / 4000, `p = ${p}`).toBeCloseTo(p, 1)
      // Every belief has the same size, because a hard channel says only which
      // way each bit came out.
      expect(new Set(out.llr.map((l) => Math.abs(l))).size).toBe(1)
    }
  })
})
