import { describe, it, expect } from 'vitest'
import {
  CONV_CODES,
  binaryEntropy,
  blockedHuffman,
  capacityAWGNDb,
  capacityBSC,
  codewords,
  correctionRadius,
  detectionRadius,
  encoder,
  entropy,
  freeDistance,
  golayCode,
  hammingCode,
  huffman,
  L12,
  minimumDistance,
  parityCheckCode,
  rateOf,
  repetitionCode,
  rsCode,
  shannonLimitDb,
  softAsymptoticGain,
  spherePacking,
  syndromeTable,
  tracebackRule,
  weightDistribution,
} from '@ee-labs/codes'
import { EXPERIMENTS, GROUPS, VIEW_LABELS, VIEW_ORDER, byId, defaultsOf, noteOf } from './experiments.js'
import { readQuantity } from './lessons.js'
import { analyse } from './analysis.js'
import { SOURCES } from './groups/shared.js'
import { fmtBits, fmtDb, fmtPercent } from './format.js'

// Every note makes a claim, and every claim is measured here.
//
// The rule this lab adds to the suite's: no number in a lesson is a constant in
// a test. Every expectation below is recomputed from the code's own parameters,
// so changing a code moves the expectation with the lesson or fails.

/**
 * What this sitting has built, as the two counts the sidebar shows and
 * `NEEDS.md` gives the progression test. The plan names 25 experiments in 6
 * groups. Group F and B4 wait on the Communications Lab (BACKLOG.md), so the
 * count below moves when that lab lands and not before.
 */
const BUILT = { groups: 5, experiments: 21, planned: 25, plannedGroups: 6 }

const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p) }
}

describe('every experiment', () => {
  it('has a unique id, a group from the list, knobs, a view and its terms', () => {
    const ids = new Set()
    for (const e of EXPERIMENTS) {
      expect(ids.has(e.id), e.id).toBe(false)
      ids.add(e.id)
      expect(GROUPS, e.id).toContain(e.group)
      expect(e.name.length, e.id).toBeGreaterThan(8)
      expect(e.params.length, e.id).toBeGreaterThan(0)
      expect(e.views, e.id).toContain(e.view)
      expect(e.terms.length, `${e.id} names its terms`).toBeGreaterThanOrEqual(3)
      for (const v of e.views) expect(VIEW_ORDER, `${e.id} view ${v}`).toContain(v)
      for (const k of e.params) {
        if (k.kind === 'choice') {
          expect(k.options.length, `${e.id}.${k.key}`).toBeGreaterThan(1)
          expect(k.options.map((o) => o.value), `${e.id}.${k.key} default`).toContain(k.default)
          continue
        }
        expect(k.default, `${e.id}.${k.key}`).toBeGreaterThanOrEqual(k.min)
        expect(k.default, `${e.id}.${k.key}`).toBeLessThanOrEqual(k.max)
      }
    }
  })

  it('runs at its defaults, and asks for at least one part of the analysis', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      expect(x.refusal, `${e.id}: ${x.refusal && x.refusal.message}`).toBeNull()
      const parts = ['source', 'capacity', 'block', 'field', 'conv', 'ldpc'].filter((k) => x[k])
      expect(parts.length, `${e.id} computes nothing`).toBeGreaterThan(0)
      if (e.curve) {
        expect(x.curve.points.length, `${e.id} curve`).toBeGreaterThan(1)
        for (const q of x.curve.points) expect(Number.isFinite(q.x) && Number.isFinite(q.y), `${e.id} curve point`).toBe(true)
      }
    }
  })

  it('moves every one of its knobs without failing', () => {
    // A knob that does nothing is a defect (REVIEW_PLAYBOOK §1), and a knob
    // that throws is worse. This walks each one to both ends of its range.
    for (const e of EXPERIMENTS) {
      for (const k of e.params) {
        const values = k.kind === 'choice' ? k.options.map((o) => o.value) : [k.min, k.max, k.default]
        for (const v of values) {
          const { x } = at(e.id, { [k.key]: v })
          // C5 at five erasures is a refusal, and the refusal is the lesson.
          if (x.refusal) expect(x.refusal.code, `${e.id}.${k.key} = ${v}`).toMatch(/^(rs|code|source|ldpc|conv|entropy|channel)-/)
          else expect(x, `${e.id}.${k.key} = ${v}`).toBeTruthy()
        }
      }
    }
  })
})

describe('group A pins the coders', () => {
  it('A1: the entropy of the reference source, and the two ends of the scale', () => {
    const { x, p } = at('a1')
    expect(readQuantity(x, p, 'H')).toBeCloseTo(entropy(SOURCES.S5), 12)
    expect(readQuantity(x, p, 'Hmax')).toBeCloseTo(Math.log2(5), 12)
    const uniform = at('a1', { source: 'S5u' })
    expect(readQuantity(uniform.x, uniform.p, 'H')).toBeCloseTo(Math.log2(5), 12)
    const certain = at('a1', { source: 'S5c' })
    expect(readQuantity(certain.x, certain.p, 'H')).toBe(0)
    // The uniform source is the largest entropy an alphabet of five can have.
    for (const id of ['S5', 'S4d', 'S2', 'S5c']) {
      const one = at('a1', { source: id })
      expect(readQuantity(one.x, one.p, 'H'), id).toBeLessThanOrEqual(Math.log2(SOURCES[id].length) + 1e-12)
    }
  })

  it('A2: Huffman on the reference source, against its own bound', () => {
    const { x, p } = at('a2')
    const code = huffman(SOURCES.S5)
    expect(readQuantity(x, p, 'L')).toBeCloseTo(code.meanLength, 12)
    expect(readQuantity(x, p, 'redundancy')).toBeCloseTo(code.meanLength - entropy(SOURCES.S5), 12)
    expect(readQuantity(x, p, 'efficiency')).toBeCloseTo((100 * entropy(SOURCES.S5)) / code.meanLength, 9)
    expect(readQuantity(x, p, 'kraft')).toBeCloseTo(1, 12)
    // H ≤ L < H + 1, over every source this group offers. The bound is over
    // the symbols a source actually sends, so the source with four impossible
    // symbols is not one of them: it needs a codeword for a symbol whose
    // probability is zero, and pays a whole bit for an entropy of zero.
    for (const id of Object.keys(SOURCES).filter((s2) => SOURCES[s2].every((q) => q > 0))) {
      const one = at('a2', { source: id })
      const H = readQuantity(one.x, one.p, 'H')
      const L = readQuantity(one.x, one.p, 'L')
      expect(L, id).toBeGreaterThanOrEqual(H - 1e-12)
      expect(L, id).toBeLessThan(H + 1)
    }
  })

  it('A3: exact on the dyadic source, worst on the nearly certain one', () => {
    const { x, p } = at('a3')
    expect(readQuantity(x, p, 'L')).toBeCloseTo(readQuantity(x, p, 'H'), 12)
    expect(readQuantity(x, p, 'redundancy')).toBeCloseTo(0, 12)
    // Every codeword length is −log₂ p exactly, which is what dyadic means.
    SOURCES.S4d.forEach((prob, i) => expect(readQuantity(x, p, `length.${i + 1}`)).toBe(-Math.log2(prob)))
    const binary = at('a3', { source: 'S2' })
    expect(readQuantity(binary.x, binary.p, 'L')).toBe(1)
    expect(readQuantity(binary.x, binary.p, 'H')).toBeCloseTo(binaryEntropy(0.1), 12)
    expect(readQuantity(binary.x, binary.p, 'efficiency')).toBeCloseTo(100 * binaryEntropy(0.1), 9)
  })

  it('A4: blocking falls towards the entropy, and stays inside 1/n of it', () => {
    const { x, p } = at('a4')
    const H = binaryEntropy(0.1)
    let last = Infinity
    for (const n of [1, 2, 3, 4]) {
      const measured = readQuantity(x, p, `blocked.${n}`)
      expect(measured, `n = ${n}`).toBeCloseTo(blockedHuffman([0.9, 0.1], n).meanLength, 12)
      expect(measured, `n = ${n}`).toBeGreaterThan(H)
      expect(measured, `n = ${n}`).toBeLessThan(H + 1 / n + 1e-12)
      expect(measured, `n = ${n}`).toBeLessThan(last)
      last = measured
    }
    // An even source is already exact, so blocking it buys nothing.
    const even = at('a4', { p: 0.5 })
    expect(readQuantity(even.x, even.p, 'H')).toBe(1)
    for (const n of [1, 2, 3, 4]) expect(readQuantity(even.x, even.p, `blocked.${n}`), `n = ${n}`).toBe(1)
  })

  it('A5: the arithmetic coder lands inside −log₂ P + 2, and beats a whole bit a symbol', () => {
    for (const n of [10, 100, 1000]) {
      const { x, p } = at('a5', { n })
      const ideal = n * binaryEntropy(0.1)
      expect(readQuantity(x, p, 'arith.ideal'), `n = ${n}`).toBeCloseTo(ideal, 6)
      expect(readQuantity(x, p, 'arith.bound'), `n = ${n}`).toBeCloseTo(ideal + 2, 6)
      expect(readQuantity(x, p, 'arith.bits'), `n = ${n}`).toBeLessThanOrEqual(ideal + 2)
      expect(readQuantity(x, p, 'arith.per'), `n = ${n}`).toBeCloseTo((ideal + 2) / n, 9)
    }
    // The overhead is paid once, so the rate per symbol falls with the length.
    const short = at('a5', { n: 10 })
    const long = at('a5', { n: 1000 })
    expect(readQuantity(long.x, long.p, 'arith.per')).toBeLessThan(readQuantity(short.x, short.p, 'arith.per'))
    expect(readQuantity(long.x, long.p, 'arith.per')).toBeGreaterThan(binaryEntropy(0.1))
    expect(readQuantity(long.x, long.p, 'arith.per')).toBeLessThan(readQuantity(long.x, long.p, 'L'))
  })
})

describe('group B pins the capacities', () => {
  it('B1: log₂(1 + S/N) at four ratios, and no ceiling', () => {
    for (const db of [-10, 0, 6, 10, 20]) {
      const { x, p } = at('b1', { snrDb: db })
      expect(readQuantity(x, p, 'capacity.awgn'), `${db} dB`).toBeCloseTo(Math.log2(1 + 10 ** (db / 10)), 12)
    }
    expect(readQuantity(at('b1', { snrDb: 0 }).x, {}, 'capacity.awgn')).toBe(1)
    // Ten times the power is 10 dB, and adds under 3.5 bit/s/Hz at this end.
    const low = capacityAWGNDb(0)
    const high = capacityAWGNDb(10)
    expect(high - low).toBeLessThan(3.5)
  })

  it('B2: 1 − h₂(p) and 1 − e, and the crossover where the first is one half', () => {
    for (const crossover of [0.001, 0.01, 0.1, 0.25, 0.5]) {
      const { x, p } = at('b2', { crossover })
      expect(readQuantity(x, p, 'capacity.bsc'), `p = ${crossover}`).toBeCloseTo(1 - binaryEntropy(crossover), 12)
    }
    for (const erasure of [0, 0.1, 0.25, 0.5, 1]) {
      const { x, p } = at('b2', { erasure })
      expect(readQuantity(x, p, 'capacity.bec'), `e = ${erasure}`).toBe(1 - erasure)
    }
    const { x, p } = at('b2')
    expect(capacityBSC(readQuantity(x, p, 'half'))).toBeCloseTo(0.5, 9)
    // Knowing where the damage is worth more than knowing how much of it there is.
    expect(readQuantity(x, p, 'capacity.bec')).toBeGreaterThan(capacityBSC(0.25))
  })

  it('B3: (2^r − 1)/r at four rates, its floor at ln 2, and the integral’s guard', () => {
    for (const r of [0.5, 1, 2, 4]) {
      const { x, p } = at('b3', { efficiency: r })
      expect(readQuantity(x, p, 'limitdb'), `r = ${r}`).toBeCloseTo(10 * Math.log10((2 ** r - 1) / r), 12)
    }
    const { x, p } = at('b3')
    expect(readQuantity(x, p, 'floordb')).toBeCloseTo(10 * Math.log10(Math.LN2), 12)
    expect(readQuantity(x, p, 'limitdb')).toBeCloseTo(0, 12)
    // The guard: the integral is taken twice and the difference is reported.
    expect(readQuantity(x, p, 'bi.delta')).toBeLessThan(x.capacity.bi.tolerance)
    expect(x.capacity.bi.converged).toBe(true)
    // A binary input carries less than an unrestricted one at the same ratio.
    expect(readQuantity(x, p, 'bi.capacity')).toBeLessThan(readQuantity(x, p, 'capacity.awgn'))
    expect(readQuantity(x, p, 'bi.capacity')).toBeLessThan(1)
  })
})

describe('group C pins the block codes', () => {
  it('C1: one check detects one error and misses two', () => {
    const code = parityCheckCode(4)
    const { x, p } = at('c1')
    expect(readQuantity(x, p, 'n')).toBe(code.n)
    expect(readQuantity(x, p, 'd')).toBe(minimumDistance(code).d)
    expect(readQuantity(x, p, 't')).toBe(correctionRadius(2))
    expect(readQuantity(x, p, 'detect')).toBe(detectionRadius(2))
    // Every single flip shows, and every double flip does not.
    for (let bit = 1; bit <= code.n; bit++) {
      const one = at('c1', { flip1: bit, flip2: 0 })
      expect(readQuantity(one.x, one.p, 'syndrome'), `bit ${bit}`).toBe(1)
      for (let other = bit + 1; other <= code.n; other++) {
        const two = at('c1', { flip1: bit, flip2: other })
        expect(readQuantity(two.x, two.p, 'syndrome'), `bits ${bit} and ${other}`).toBe(0)
      }
    }
    const w = weightDistribution(code)
    expect(readQuantity(x, p, 'weights.2')).toBe(w[2])
    expect(readQuantity(x, p, 'weights.4')).toBe(w[4])
  })

  it('C2: the syndrome is the column of H at the flipped bit, whatever the message', () => {
    const code = hammingCode(3)
    const { x, p } = at('c2')
    expect(readQuantity(x, p, 'cosets')).toBe(2 ** (code.n - code.k))
    // The syndrome depends on the error alone, over every message and every
    // single-error pattern.
    for (let bit = 1; bit <= code.n; bit++) {
      const column = code.H.map((row) => row[bit - 1]).reduce((acc, b) => acc * 2 + b, 0)
      for (const message of [0, 6, 11, 15]) {
        const one = at('c2', { message, flip1: bit, flip2: 0 })
        expect(readQuantity(one.x, one.p, 'syndrome'), `bit ${bit}, message ${message}`).toBe(column)
        expect(readQuantity(one.x, one.p, 'right'), `bit ${bit}, message ${message}`).toBe(1)
      }
    }
    // A double error is decoded to the wrong codeword, every time.
    for (let a = 1; a <= code.n; a++)
      for (let b = a + 1; b <= code.n; b++) {
        const two = at('c2', { flip1: a, flip2: b })
        expect(readQuantity(two.x, two.p, 'right'), `bits ${a} and ${b}`).toBe(0)
        expect(readQuantity(two.x, two.p, 'corrected'), `bits ${a} and ${b}`).toBe(1)
      }
  })

  it('C3: the weight distribution, the two radii, and the sphere-packing count', () => {
    const cases = { P54: parityCheckCode(4), H74: hammingCode(3), H15: hammingCode(4), G23: golayCode(), R5: repetitionCode(5) }
    for (const [id, code] of Object.entries(cases)) {
      const { x, p } = at('c3', { code: id })
      const d = minimumDistance(code)
      expect(readQuantity(x, p, 'n'), id).toBe(code.n)
      expect(readQuantity(x, p, 'k'), id).toBe(code.k)
      expect(readQuantity(x, p, 'rate'), id).toBeCloseTo(code.k / code.n, 12)
      expect(readQuantity(x, p, 'd'), id).toBe(d.d)
      expect(readQuantity(x, p, 't'), id).toBe(correctionRadius(d.d))
      expect(readQuantity(x, p, 'detect'), id).toBe(detectionRadius(d.d))
      const packing = spherePacking(code, d.d)
      expect(readQuantity(x, p, 'sphere'), id).toBe(packing.sphere)
      expect(readQuantity(x, p, 'covered'), id).toBe(packing.covered)
      expect(readQuantity(x, p, 'perfect'), id).toBe(packing.perfect ? 1 : 0)
      // The distribution the pane draws is the one the engine counts.
      const w = weightDistribution(code)
      w.forEach((count, weight) => expect(readQuantity(x, p, `weights.${weight}`), `${id} weight ${weight}`).toBe(count))
    }
    // The two perfect codes of this list are the ones that leave nothing over.
    expect(readQuantity(at('c3', { code: 'H74' }).x, {}, 'spare')).toBe(0)
    expect(readQuantity(at('c3', { code: 'G23' }).x, {}, 'spare')).toBe(0)
    expect(readQuantity(at('c3', { code: 'P54' }).x, {}, 'spare')).toBeGreaterThan(0)
  })

  it('C4: the cyclic remainder is the matrix syndrome, over every message and flip', () => {
    const code = hammingCode(3)
    for (const message of [0, 6, 11, 15]) {
      for (let bit = 0; bit <= code.n; bit++) {
        const { x, p } = at('c4', { message, flip1: bit })
        expect(readQuantity(x, p, 'remainder'), `message ${message}, bit ${bit}`).toBe(readQuantity(x, p, 'syndrome'))
        if (bit === 0) expect(readQuantity(x, p, 'remainder'), `message ${message}`).toBe(0)
      }
    }
    // The codeword set of the polynomial view is the codeword set of the matrix.
    expect(codewords(code).map((c) => c.join(''))).toEqual(codewords(hammingCode(3)).map((c) => c.join('')))
    const golay = at('c4', { code: 'G23' })
    expect(readQuantity(golay.x, golay.p, 'd')).toBe(minimumDistance(golayCode()).d)
    expect(readQuantity(golay.x, golay.p, 'rate')).toBeCloseTo(12 / 23, 12)
  })

  it('C5: the field, the Singleton bound, and the erasures the code pays for', () => {
    const rs = rsCode(4, 15, 11)
    const { x, p } = at('c5')
    expect(readQuantity(x, p, 'field.order')).toBe(15)
    expect(readQuantity(x, p, 'field.powers')).toBe(15)
    expect(readQuantity(x, p, 'rs.d')).toBe(rs.n - rs.k + 1)
    expect(readQuantity(x, p, 'rs.t')).toBe(Math.floor((rs.n - rs.k) / 2))
    expect(readQuantity(x, p, 'rs.erasures')).toBe(rs.n - rs.k)
    // Every count of erasures the code pays for is filled, and one more is not.
    for (let count = 0; count <= rs.n - rs.k; count++) {
      const one = at('c5', { erasures: count })
      expect(readQuantity(one.x, one.p, 'filled'), `${count} erasures`).toBe(1)
      expect(one.x.field.refusal, `${count} erasures`).toBeNull()
    }
    const beyond = at('c5', { erasures: 5 })
    expect(beyond.x.field.refusal.code).toBe('rs-erasures')
    expect(beyond.x.field.refusal.message).toMatch(/fills up to 4 erasures/)
  })
})

describe('group D pins the trellis', () => {
  it('D1: the state count, the branch count, and the generators as the impulse response', () => {
    for (const [id, spec] of [['K3', CONV_CODES.K3], ['K5', CONV_CODES.K5]]) {
      const enc = encoder(spec)
      const { x, p } = at('d1', { K: id })
      expect(readQuantity(x, p, 'states'), id).toBe(2 ** (spec.K - 1))
      expect(readQuantity(x, p, 'branches'), id).toBe(2 * enc.states)
      expect(readQuantity(x, p, 'memory'), id).toBe(spec.K - 1)
      expect(readQuantity(x, p, 'outputs'), id).toBe(spec.gens.length)
      // 8 message bits and one flush per memory bit, at n bits a step.
      expect(readQuantity(x, p, 'encoded'), id).toBe(enc.n * (8 + enc.memory))
    }
    // A single one in puts the generators out, one down each output.
    const impulse = at('d1', { message: 128 })
    const bits = impulse.x.conv.sent.bits
    expect(bits.filter((_, i) => i % 2 === 0).slice(0, 3)).toEqual([1, 0, 1])
    expect(bits.filter((_, i) => i % 2 === 1).slice(0, 3)).toEqual([1, 1, 1])
  })

  it('D2: every path is a codeword and every codeword is a path', () => {
    const { x, p } = at('d2')
    const enc = encoder(CONV_CODES.K3)
    expect(readQuantity(x, p, 'steps')).toBe(6 + enc.memory)
    expect(readQuantity(x, p, 'paths')).toBe(2 ** 6)
    expect(readQuantity(x, p, 'encoded')).toBe(2 * (6 + enc.memory))
    // Enumerated: 64 messages give 64 distinct codewords, and each returns to
    // state 00 at the end.
    const words = new Set()
    for (let m = 0; m < 64; m++) {
      const one = at('d2', { message: m })
      words.add(one.x.conv.sent.bits.join(''))
      expect(one.x.conv.sent.state, `message ${m}`).toBe(0)
      expect(readQuantity(one.x, one.p, 'metric'), `message ${m}`).toBe(0)
      expect(readQuantity(one.x, one.p, 'errors'), `message ${m}`).toBe(0)
    }
    expect(words.size).toBe(64)
  })

  it('D3: the survivor is the maximum-likelihood path, and the work is counted', () => {
    const { x, p } = at('d3')
    const enc = encoder(CONV_CODES.K3)
    expect(readQuantity(x, p, 'acsstep')).toBe(2 * enc.states)
    expect(readQuantity(x, p, 'acs')).toBe(2 * enc.states * readQuantity(x, p, 'steps'))
    expect(readQuantity(x, p, 'paths')).toBe(2 ** 8)
    expect(readQuantity(x, p, 'flips')).toBe(2)
    expect(readQuantity(x, p, 'metric')).toBe(2)
    expect(readQuantity(x, p, 'errors')).toBe(0)
    // The metric of the survivor is the lowest of every path, by exhaustive
    // search over all 256 messages of eight bits.
    const received = x.conv.received
    let best = Infinity
    for (let m = 0; m < 256; m++) {
      const one = at('d3', { message: m, flip1: 0, flip2: 0 })
      best = Math.min(best, one.x.conv.sent.bits.reduce((acc, b, i) => acc + (b === received[i] ? 0 : 1), 0))
    }
    expect(readQuantity(x, p, 'metric')).toBe(best)
    // Both flips off costs nothing at all.
    const clean = at('d3', { flip1: 0, flip2: 0 })
    expect(readQuantity(clean.x, clean.p, 'metric')).toBe(0)
  })

  it('D4: the free distance is searched for, and the gain follows from it', () => {
    for (const [id, spec] of Object.entries(CONV_CODES)) {
      const enc = encoder(spec)
      const { x, p } = at('d4', { K: id })
      const d = freeDistance(enc)
      expect(readQuantity(x, p, 'dfree'), id).toBe(d)
      expect(readQuantity(x, p, 'gain.soft'), id).toBeCloseTo(softAsymptoticGain(enc.rate, d), 12)
      expect(readQuantity(x, p, 'acsstep'), id).toBe(2 * enc.states)
      expect(readQuantity(x, p, 'traceback'), id).toBe(tracebackRule(enc))
    }
    // The error events of the reference code carry (i + 1)2^i message bits.
    const { x, p } = at('d4')
    const d = freeDistance(encoder(CONV_CODES.K3))
    for (let i = 0; i <= 7; i++) expect(readQuantity(x, p, `bits.${d + i}`), `weight ${d + i}`).toBe((i + 1) * 2 ** i)
    expect(readQuantity(x, p, `spectrum.${d}`)).toBe(1)
    // A longer constraint length buys distance, at 2^(K−1) states.
    const long = at('d4', { K: 'K7' })
    expect(readQuantity(long.x, long.p, 'dfree')).toBeGreaterThan(readQuantity(x, p, 'dfree'))
    expect(readQuantity(long.x, long.p, 'acsstep')).toBeGreaterThan(readQuantity(x, p, 'acsstep'))
  })

  it('D5: the error count falls with the traceback depth and stops at the rule of thumb', () => {
    const { x, p } = at('d5')
    const enc = encoder(CONV_CODES.K3)
    expect(readQuantity(x, p, 'traceback')).toBe(5 * enc.K)
    expect(readQuantity(x, p, 'encoded')).toBe(2 * (1000 + enc.memory))
    // The curve falls, and the depth of the rule of thumb reaches the floor
    // that a traceback to the start of the block gives.
    const shallow = readQuantity(x, p, 'curve.2')
    const rule = readQuantity(x, p, `curve.${5 * enc.K}`)
    expect(shallow).toBeGreaterThan(rule)
    expect(rule).toBe(readQuantity(x, p, 'curve.floor'))
    for (const depth of [20, 25, 30, 40]) expect(readQuantity(x, p, `curve.${depth}`), `depth ${depth}`).toBe(rule)
    // A soft decode beats a hard one on the same received values.
    expect(x.conv.soft).toBe(true)
    expect(readQuantity(x, p, 'errors')).toBeLessThan(readQuantity(x, p, 'flips'))
  })
})

describe('group E pins the graph', () => {
  it('E1: the graph’s counts, its rank, and the rate that follows', () => {
    const H = L12()
    const { x, p } = at('e1')
    const rate = rateOf(H)
    expect(readQuantity(x, p, 'vars')).toBe(12)
    expect(readQuantity(x, p, 'checks')).toBe(8)
    expect(readQuantity(x, p, 'edges')).toBe(12 * 2)
    expect(readQuantity(x, p, 'degreev')).toBe(2)
    expect(readQuantity(x, p, 'degreec')).toBe(3)
    expect(readQuantity(x, p, 'rank')).toBe(rate.rank)
    expect(readQuantity(x, p, 'dependent')).toBe(rate.m - rate.rank)
    expect(readQuantity(x, p, 'designrate')).toBeCloseTo(1 - 2 / 3, 12)
    expect(readQuantity(x, p, 'rate')).toBeCloseTo(1 - rate.rank / 12, 12)
    expect(readQuantity(x, p, 'k')).toBe(12 - rate.rank)
    // Every column has even weight, which is why a row is dependent.
    for (let v = 0; v < 12; v++) expect(H.reduce((acc, row) => acc + row[v], 0) % 2, `bit ${v}`).toBe(0)
    // One flip fails the two checks that cover that bit, and two flips that
    // share no check fail four.
    for (let bit = 1; bit <= 12; bit++) {
      const one = at('e1', { flip1: bit, flip2: 0 })
      expect(readQuantity(one.x, one.p, 'syndromeweight'), `bit ${bit}`).toBe(2)
    }
    const pair = at('e1', { flip1: 5, flip2: 8 })
    expect(readQuantity(pair.x, pair.p, 'syndromeweight')).toBe(4)
    const none = at('e1', { flip1: 0, flip2: 0 })
    expect(readQuantity(none.x, none.p, 'syndromeweight')).toBe(0)
  })

  it('E2: the iteration the syndrome reaches zero at, and one that never does', () => {
    const { x, p } = at('e2')
    expect(readQuantity(x, p, 'flips')).toBe(2)
    expect(readQuantity(x, p, 'weight.1')).toBe(2)
    expect(readQuantity(x, p, 'weight.2')).toBe(0)
    expect(readQuantity(x, p, 'iteration')).toBe(2)
    expect(readQuantity(x, p, 'right')).toBe(1)
    // Whenever it converges, the word satisfies every check. Over the seeds the
    // knob offers, that holds and some of them do not converge.
    let converged = 0
    let stuck = 0
    for (let seed = 1; seed <= 40; seed++) {
      const one = at('e2', { seed })
      if (readQuantity(one.x, one.p, 'converged')) {
        converged++
        expect(one.x.ldpc.bp.syndromeWeights[one.x.ldpc.bp.iteration - 1] ?? 0, `seed ${seed}`).toBe(0)
      } else {
        stuck++
        for (const w of one.x.ldpc.bp.syndromeWeights) expect(w, `seed ${seed}`).toBeGreaterThan(0)
      }
    }
    expect(converged).toBeGreaterThan(20)
    expect(stuck).toBeGreaterThan(0)
    const never = at('e2', { seed: 12 })
    expect(readQuantity(never.x, never.p, 'converged')).toBe(0)
    expect(new Set(never.x.ldpc.bp.syndromeWeights)).toEqual(new Set([2]))
  })

  it('E3: iterations buy error rate, and the curve flattens', () => {
    const { x, p } = at('e3')
    const counts = x.curve.counts
    expect(counts.bits).toBe(20 * 102)
    expect(readQuantity(x, p, 'curve.0')).toBe(counts.totals[0])
    // The first iterations take out most of the errors, and by the end every
    // block has decoded.
    expect(readQuantity(x, p, 'curve.1')).toBeLessThan(readQuantity(x, p, 'curve.0'))
    expect(readQuantity(x, p, 'curve.3')).toBeLessThan(readQuantity(x, p, 'curve.1'))
    expect(readQuantity(x, p, 'curve.12')).toBe(0)
    expect(counts.converged).toBe(20)
    // A lower ratio leaves errors the iterations cannot remove.
    const low = at('e3', { ebN0Db: 2 })
    expect(readQuantity(low.x, low.p, 'curve.12')).toBeGreaterThan(0)
    expect(readQuantity(low.x, low.p, 'curve.0')).toBeGreaterThan(readQuantity(x, p, 'curve.0'))
    // The stuck decode holds its syndrome weight for every iteration.
    const stuck = at('e3', { case: 'stuck' })
    expect(readQuantity(stuck.x, stuck.p, 'converged')).toBe(0)
    expect(readQuantity(stuck.x, stuck.p, 'curve.1')).toBe(readQuantity(stuck.x, stuck.p, 'curve.12'))
  })
})

// The lesson registers, measured. A step's `set` is applied over the defaults,
// each `reads` pair is solved and compared, and then every number a sentence
// quotes has to be one of those readings or a knob value.
describe('every lesson is measured', () => {
  // A number with a unit, a number with the thing it counts, or a number after
  // the quantity it is a value of.
  const UNIT = /(-?\d+(?:\.\d+)?)\s*(bit\/s\/Hz|bits?|dB|%)(?![A-Za-z])/g
  const NOUN =
    /(-?\d+(?:\.\d+)?)\s*(?:message |channel |symbol |failed |nonzero |further )?(symbols?|states?|branches?|checks?|edges?|codewords?|words?|paths?|steps?|operations?|iterations?|errors?|erasures?|elements?|cosets?|blocks?|wrong)(?![A-Za-z])/g
  const OF =
    /(?:rate|distance|weight|rank|metric|remainder|syndrome|crossover|efficiency|capacity|entropy|probabilit(?:y|ies))\s+(?:is|of|to|reads|at|are)?\s*(-?\d+(?:\.\d+)?)/g

  /** Every number a sentence quotes, in the units a reading uses. */
  const quoted = (text) => {
    const s = text.replace(/−/g, '-')
    const out = []
    const push = (raw, m) => out.push({ text: m[0].trim(), digits: (raw.split('.')[1] || '').length, value: Math.abs(Number(raw)) })
    for (const m of s.matchAll(UNIT)) push(m[1], m)
    for (const m of s.matchAll(NOUN)) push(m[1], m)
    for (const m of s.matchAll(OF)) push(m[1], m)
    return out
  }
  /** A quoted number stands for a value when it is that value rounded to the digits printed. */
  const stands = (q, v) => {
    const half = 0.5 * 10 ** -q.digits
    return Math.abs(q.value - Math.abs(v)) <= Math.max(0.006 * Math.abs(v), half * (1 + 1e-9))
  }
  const close = (got, want) => (want === 0 ? got === 0 : Math.abs(got - want) <= Math.max(1e-9, 0.006 * Math.abs(want)))
  const words = (s) => s.trim().split(/\s+/).length
  const knobOf = (e, key) => e.params.find((k) => k.key === key)
  const knobValues = (e) => e.params.filter((k) => !k.kind).map((k) => k.default)

  /** Solve one register and check its reads; returns the numbers it justifies. */
  function measure(e, p, reads, label) {
    const x = analyse(e, p)
    if (!e.expects) expect(x.refusal, `${label}: ${x.refusal && x.refusal.message}`).toBeNull()
    const values = []
    for (const [path, want] of reads) {
      const got = readQuantity(x, p, path, e)
      expect(Number.isFinite(got), `${label}: ${path} is ${got}`).toBe(true)
      expect(close(got, want), `${label}: ${path} reads ${got}, the lesson says ${want}`).toBe(true)
      values.push(want)
      // A reading taken at a point of the curve justifies that point too, the
      // way a cursor time stands for itself in the other labs.
      if (path.startsWith('curve.') && Number.isFinite(Number(path.split('.')[1]))) values.push(Number(path.split('.')[1]))
      if (path.startsWith('weight.')) values.push(Number(path.split('.')[1]))
      if (path.startsWith('length.') || path.startsWith('weights.') || path.startsWith('prob.')) values.push(Number(path.split('.')[1]))
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
          if (k.kind === 'choice') expect(k.options.map((o) => o.value), `${label} ${key}`).toContain(v)
          else {
            expect(v, `${label} ${key} below min`).toBeGreaterThanOrEqual(k.min)
            expect(v, `${label} ${key} above max`).toBeLessThanOrEqual(k.max)
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
    const a2 = at('a2')
    expect(readQuantity(a2.x, a2.p, 'symbols')).toBe(5)
    expect(() => readQuantity(a2.x, a2.p, 'nope.y')).toThrow(/unknown quantity path/)
    expect(() => readQuantity(a2.x, a2.p, 'dfree')).toThrow(/did not ask for that analysis/)
    expect(() => readQuantity(a2.x, a2.p, 'blocked.2')).toThrow(/did not ask for that analysis/)
    const a4 = at('a4')
    expect(() => readQuantity(a4.x, a4.p, 'blocked.7')).toThrow(/codes blocks of 1, 2, 3, 4/)
    const c2 = at('c2')
    expect(readQuantity(c2.x, c2.p, 'parity')).toBe(3)
    expect(() => readQuantity(c2.x, c2.p, 'capacity.awgn')).toThrow(/did not ask for that analysis/)
    const c5 = at('c5')
    expect(() => readQuantity(c5.x, c5.p, 'field.nope')).toThrow(/order, its size or its powers/)
    const e2 = at('e2', { seed: 12 })
    expect(() => readQuantity(e2.x, e2.p, 'iteration')).toThrow(/never converged/)
    const d5 = at('d5')
    expect(() => readQuantity(d5.x, d5.p, 'curve.7')).toThrow(/no point at x = 7/)
  })
})

describe('the chrome names what it shows', () => {
  it('every view in the order has a label and a hover title', () => {
    for (const v of VIEW_ORDER) {
      expect(VIEW_LABELS[v], v).toBeDefined()
      expect(VIEW_LABELS[v].label.split(/\s+/).length, `${v} label`).toBeLessThanOrEqual(4)
      expect(VIEW_LABELS[v].title.length, `${v} title`).toBeGreaterThan(20)
    }
    // Every view the experiments offer is one the shell can draw.
    const offered = new Set(EXPERIMENTS.flatMap((e) => e.views))
    for (const v of offered) expect(VIEW_ORDER, v).toContain(v)
  })

  it('every group heading names its content, and every experiment belongs to a built one', () => {
    // Six headings, because the plan names six groups (INFORMATION_LAB_PLAN.md
    // §5) and the sidebar lists what the lab is, not what this sitting got to.
    // Group F is specified and not built, and BUILT says how much is left.
    const built = GROUPS.filter((g) => EXPERIMENTS.some((e) => e.group === g))
    for (const g of GROUPS) expect(g, g).toMatch(/^[A-F] · /)
    for (const e of EXPERIMENTS) expect(built, e.id).toContain(e.group)
    expect(GROUPS.length).toBe(BUILT.plannedGroups)
    expect(built.length).toBe(BUILT.groups)
    expect(EXPERIMENTS.length).toBe(BUILT.experiments)
    expect(BUILT.planned - BUILT.experiments).toBe(4)
  })

  it('formats a number the way a reader reads it', () => {
    expect(fmtBits(2.121928)).toBe('2.1219 bit')
    expect(fmtBits(1)).toBe('1.0000 bit')
    expect(fmtBits(null)).toBe('—')
    expect(fmtDb(-1.591745)).toBe('−1.592 dB')
    expect(fmtPercent(0.96451277)).toBe('96.45 %')
  })
})
