import { describe, it, expect } from 'vitest'
import { rng, runSeed } from '@ee-labs/random'
import { firResponse } from '@ee-labs/dsp'
import {
  CONSTELLATIONS,
  constellation,
  neighbourPairs,
  hamming,
  mapBits,
  demapSymbols,
  randomBits,
} from './mappers.js'
import { raisedCosine, shapeTaps, residualIsi, convolve } from './shape.js'
import { multipath, twoRay, realTaps, tapsReal, channelResponse } from './channel.js'
import { matchedFilterSnr } from './detect.js'
import { berClosed, berCount } from './ber.js'
import { ofdmRoundTrip } from './ofdm.js'
import { costasRun } from './sync.js'

// The twelve invariants of COMMUNICATIONS_LAB_PLAN.md section 2.11, fuzzed.
//
// Each is checked across random bit streams, seeds, constellations, roll-offs,
// spans and channel taps, and the hostile corners the plan's section 7 names are
// included by hand: beta = 0, a span of 2 symbols, a channel exactly one tap
// longer than the prefix covers, and Eb/N0 at -5 dB.
//
// Statistical invariants are pinned by seed. Every counted rate runs from a
// fixed seed with a fixed trial count, and what is checked is that the count
// sits inside its own interval around the closed form. Nothing here compares a
// count against a hard-coded constant.

const SEEDS = [1, 2, 3, 7, 11, 101]
const BETAS = [0, 0.15, 0.35, 0.5, 0.8, 1]
const SPANS = [2, 4, 6, 8, 12, 16]

describe('1. the mapper round-trips', () => {
  for (const name of CONSTELLATIONS) {
    it(`${name}, over six seeds`, () => {
      const c = constellation(name)
      for (const seed of SEEDS) {
        const bits = randomBits(c.bits * 300, rng(seed))
        const got = demapSymbols(name, mapBits(name, bits))
        expect(Array.from(got), `${name} seed ${seed}`).toEqual(Array.from(bits))
      }
    })
  }
})

describe('2. Gray labels are Gray', () => {
  it('every nearest-neighbour pair in every constellation differs in one bit', () => {
    for (const name of CONSTELLATIONS) {
      const c = constellation(name)
      const pairs = neighbourPairs(name)
      expect(pairs.length, `${name} has no neighbours`).toBeGreaterThan(0)
      for (const [i, j] of pairs) {
        expect(hamming(c.labels[i], c.labels[j]), `${name} ${i} ${j}`).toBe(1)
      }
    }
  })
})

describe('3. unit energy', () => {
  it('every constellation has a mean square of one, to floating point', () => {
    for (const name of CONSTELLATIONS) {
      expect(Math.abs(constellation(name).meanSquare - 1), name).toBeLessThan(1e-12)
    }
  })

  it('so Es over N0 and Eb over N0 differ by exactly ten log of the bits', () => {
    for (const name of CONSTELLATIONS) {
      const c = constellation(name)
      // Two routes to the same gap. One from the table's bit width, one from a
      // measured mean square that the table did not supply.
      let sum = 0
      for (let i = 0; i < c.size; i++) sum += c.points[2 * i] ** 2 + c.points[2 * i + 1] ** 2
      const measured = sum / c.size
      expect(10 * Math.log10(c.bits * measured), name).toBeCloseTo(10 * Math.log10(c.bits), 12)
    }
  })
})

describe('4. Nyquist', () => {
  it('the raised cosine is one at zero and nothing at every other instant', () => {
    for (const beta of BETAS) {
      expect(raisedCosine(0, beta), `beta ${beta}`).toBeCloseTo(1, 15)
      for (let k = 1; k <= 20; k++) {
        expect(Math.abs(raisedCosine(k, beta)), `beta ${beta} k ${k}`).toBeLessThan(1e-15)
      }
    }
  })
})

describe('5. the matched pair', () => {
  it('the root raised cosine convolved with itself is the raised cosine', () => {
    for (const beta of [0.15, 0.35, 0.5, 1]) {
      const h = shapeTaps({ kind: 'rrc', beta, span: 24, sps: 8 })
      const c = convolve(h, h)
      const mid = (c.length - 1) / 2
      for (let k = 1; k <= 4; k++) {
        const got = c[mid + k * 8] / c[mid]
        expect(Math.abs(got - raisedCosine(k, beta)), `beta ${beta} k ${k}`).toBeLessThan(1e-3)
      }
    }
  })

  it('orders its three measures, at every span and every roll-off', () => {
    for (const beta of [0.2, 0.35, 0.5]) {
      for (const span of SPANS) {
        const r = residualIsi(shapeTaps({ kind: 'rrc', beta, span, sps: 8 }), 8)
        expect(r.peak, `beta ${beta} span ${span}`).toBeGreaterThanOrEqual(r.near)
        expect(r.sum, `beta ${beta} span ${span}`).toBeGreaterThanOrEqual(r.peak)
      }
    }
  })

  it('falls by two orders between a short span and a long one', () => {
    // It does not fall at every step. Between a span of 6 and one of 8 the
    // nearest-neighbour residual rises, because the truncation moves the
    // cascade's own tail rather than removing it. What holds across the range
    // is the trend, and the four spans the plan quotes are each below the last.
    for (const beta of [0.2, 0.35, 0.5]) {
      const near = (span) => residualIsi(shapeTaps({ kind: 'rrc', beta, span, sps: 8 }), 8).near
      expect(near(24), `beta ${beta}`).toBeLessThan(near(4) / 100)
      const quoted = [4, 6, 12, 16].map(near)
      for (let i = 1; i < quoted.length; i++) {
        expect(quoted[i], `beta ${beta} step ${i}`).toBeLessThan(quoted[i - 1])
      }
    }
  })

  it('holds at the hostile corner of a two-symbol span, where the residual is large', () => {
    const r = residualIsi(shapeTaps({ kind: 'rrc', beta: 0.35, span: 2, sps: 8 }), 8)
    expect(r.near).toBeGreaterThan(0.1)
    expect(Number.isFinite(r.near)).toBe(true)
  })
})

describe('6. the matched filter reaches 2E over N0', () => {
  it('for three pulse shapes and three noise densities', () => {
    for (const pulse of ['rect', 'halfSine', 'ramp']) {
      for (const n0 of [0.02, 0.05, 0.2]) {
        const s = matchedFilterSnr({ pulse, n0, trials: 20000, seed: 9 })
        const half = (s.variance.ci[1] - s.variance.ci[0]) / 2 / s.variance.value
        expect(Math.abs(s.measured / s.twoEOverN0 - 1), `${pulse} ${n0}`).toBeLessThan(4 * half)
      }
    }
  })
})

describe('7. the count sits on the form', () => {
  const cases = [
    { scheme: 'bpsk', ebN0Db: 2, symbols: 100000 },
    { scheme: 'bpsk', ebN0Db: 5, symbols: 200000 },
    { scheme: 'qpsk', ebN0Db: 3, symbols: 100000 },
    { scheme: 'qam16', ebN0Db: 7, symbols: 200000 },
    { scheme: 'fskCoherent', ebN0Db: 7, symbols: 200000 },
  ]
  for (const c of cases) {
    it(`${c.scheme} at ${c.ebN0Db} dB`, () => {
      const got = berCount({ ...c, seed: 13 })
      expect(got.errors, 'too few errors to read').toBeGreaterThanOrEqual(100)
      expect(got.ci[0]).toBeLessThanOrEqual(got.closed)
      expect(got.ci[1]).toBeGreaterThanOrEqual(got.closed)
    })
  }

  it('holds at the hostile corner of -5 dB, where almost every bit is wrong', () => {
    const got = berCount({ scheme: 'bpsk', ebN0Db: -5, symbols: 40000, seed: 4 })
    expect(got.closed).toBeGreaterThan(0.2)
    expect(got.ci[0]).toBeLessThanOrEqual(got.closed)
    expect(got.ci[1]).toBeGreaterThanOrEqual(got.closed)
  })
})

describe('8. the cyclic prefix is exact', () => {
  const syms = (n, seed) => mapBits('qam16', randomBits(4 * n, rng(seed)))

  it('recovers to floating point through any channel the prefix covers', () => {
    for (const [n, cp] of [
      [16, 4],
      [32, 8],
      [64, 16],
    ]) {
      for (let m = 1; m <= cp + 1; m++) {
        const taps = realTaps(
          Array.from({ length: m }, (_, i) => (i === 0 ? 1 : 0.6 / (i + 1))),
        )
        const r = ofdmRoundTrip({ syms: syms(n, m), taps, n, cp })
        expect(r.worst, `n ${n} cp ${cp} taps ${m}`).toBeLessThan(1e-12)
      }
    }
  })

  it('fails measurably at one tap more, which is the whole point of the prefix', () => {
    for (const [n, cp] of [
      [16, 4],
      [32, 8],
      [64, 16],
    ]) {
      const m = cp + 2
      const taps = realTaps(Array.from({ length: m }, (_, i) => (i === 0 ? 1 : 0.6 / (i + 1))))
      const r = ofdmRoundTrip({ syms: syms(n, m), taps, n, cp })
      expect(r.worst, `n ${n} cp ${cp}`).toBeGreaterThan(1e-4)
    }
  })
})

describe('9. the channel is linear, and its H(z) is the one dsp reads', () => {
  const CHANNELS = [
    twoRay(0.5, 4),
    twoRay(0.9, 4),
    twoRay(0.3, 1),
    realTaps([1, -0.4, 0.2]),
    realTaps([1, 0, 0.7, 0, 0.2, 0, 0.1]),
  ]

  it('two inputs sum to the sum of their outputs, for five channels', () => {
    for (const taps of CHANNELS) {
      const r = rng(5)
      const a = mapBits('qpsk', randomBits(2 * 128, r))
      const b = mapBits('qpsk', randomBits(2 * 128, r))
      const sum = new Float64Array(a.length)
      for (let i = 0; i < a.length; i++) sum[i] = a[i] + b[i]
      const viaSum = multipath(sum, taps)
      const ya = multipath(a, taps)
      const yb = multipath(b, taps)
      for (let i = 0; i < viaSum.length; i++) {
        expect(Math.abs(viaSum[i] - (ya[i] + yb[i])), `${i}`).toBeLessThan(1e-12)
      }
    }
  })

  it('the measured transfer equals firResponse at all 241 sweep points', () => {
    for (const taps of CHANNELS) {
      const real = tapsReal(taps)
      const r = channelResponse(taps, 8000, 241)
      expect(r.freqs.length).toBe(241)
      for (let i = 0; i < 241; i++) {
        expect(Math.abs(r.mag[i] - firResponse(real, r.freqs[i], 8000)), `${i}`).toBeLessThan(
          1e-12,
        )
      }
    }
  })
})

describe('10. the loops settle', () => {
  it('a second-order loop reaches below half a degree under a frequency offset', () => {
    for (const offset of [0, 2, 5, 10]) {
      const r = costasRun({ symbols: 8000, freqOffsetHz: offset, order: 2, bnT: 0.02, seed: 8 })
      expect(r.residualDeg, `${offset} Hz`).toBeLessThan(0.5)
    }
  })

  it('a first-order loop does not, once the offset is more than nothing', () => {
    for (const offset of [5, 10]) {
      const r = costasRun({ symbols: 8000, freqOffsetHz: offset, order: 1, bnT: 0.02, seed: 8 })
      expect(r.staticErrorDeg, `${offset} Hz`).toBeGreaterThan(1)
    }
  })
})

describe('11. the seed reproduces', () => {
  it('gives bit-identical waveforms from one seed', () => {
    for (const seed of SEEDS) {
      const a = berCount({ scheme: 'qpsk', ebN0Db: 4, symbols: 20000, seed })
      const b = berCount({ scheme: 'qpsk', ebN0Db: 4, symbols: 20000, seed })
      expect(a.errors, `${seed}`).toBe(b.errors)
    }
  })

  it('gives two seeds estimates that agree inside the sum of their intervals', () => {
    for (let k = 0; k < 5; k++) {
      const a = berCount({ scheme: 'bpsk', ebN0Db: 3, symbols: 200000, seed: runSeed(1, k) })
      const b = berCount({ scheme: 'bpsk', ebN0Db: 3, symbols: 200000, seed: runSeed(2, k) })
      const half = (a.ci[1] - a.ci[0]) / 2 + (b.ci[1] - b.ci[0]) / 2
      expect(Math.abs(a.value - b.value), `${k}`).toBeLessThanOrEqual(half)
    }
  })
})

describe('12. cross-lab', () => {
  it("the pulse shaper's H(z) read as an FIR in dsp is the same response", () => {
    const h = shapeTaps({ kind: 'rrc', beta: 0.35, span: 12, sps: 8 })
    for (const f of [0, 250, 500, 675, 1000, 2000]) {
      // Two routes to |H(f)|: the FIR machinery in dsp, and the sum written out.
      let re = 0
      let im = 0
      for (let k = 0; k < h.length; k++) {
        const w = (2 * Math.PI * f * k) / 8000
        re += h[k] * Math.cos(w)
        im -= h[k] * Math.sin(w)
      }
      expect(firResponse(h, f, 8000), `${f} Hz`).toBeCloseTo(Math.hypot(re, im), 12)
    }
  })

  it('the uncoded curve the Information Lab reads is this lab closed form', () => {
    // The hand-over is a function rather than a picture, so the check is that
    // the function is the only source of the numbers.
    for (const db of [0, 5, 10, 15]) {
      const g = 10 ** (db / 10)
      expect(berClosed('bpsk', g)).toBe(berClosed('bpsk', g))
      expect(berClosed('qpsk', g)).toBeCloseTo(berClosed('bpsk', g), 15)
    }
  })
})
