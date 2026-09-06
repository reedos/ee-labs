import { describe, it, expect } from 'vitest'
import { qFunction } from '@ee-labs/random'
import {
  PULSES,
  matchedSample,
  matchedFilterSnr,
  softMetric,
  fskCoherentBer,
  fskNoncoherentBer,
  toneCorrelation,
  outsideRegion,
} from './detect.js'
import { shapeTaps } from './shape.js'
import { constellation, mapBits, randomBits, decide } from './mappers.js'
import { rng } from '@ee-labs/random'

describe('the matched filter', () => {
  it('reaches 2E over N0, whatever the pulse shape is', () => {
    for (const pulse of ['rect', 'halfSine', 'ramp']) {
      const s = matchedFilterSnr({ pulse, length: 64, n0: 0.05, trials: 40000, seed: 5 })
      // The measurement is an estimate, so it is checked against the form by
      // its own interval rather than by a tolerance chosen to make it pass.
      const half = (s.variance.ci[1] - s.variance.ci[0]) / 2 / s.variance.value
      expect(Math.abs(s.measured / s.twoEOverN0 - 1), pulse).toBeLessThan(3 * half)
    }
  })

  it('reads 40.000 for a unit-energy pulse at N0 = 0.05', () => {
    const s = matchedFilterSnr({ pulse: 'rect', n0: 0.05, trials: 20000, seed: 1 })
    expect(s.twoEOverN0).toBeCloseTo(40, 10)
    expect(s.energy).toBeCloseTo(1, 12)
  })

  it('puts the mean and the variance where the theory puts them', () => {
    // The seed is fixed, because a 95 % interval misses one time in twenty by
    // construction and a test that drew a new seed would fail that often.
    const s = matchedFilterSnr({ pulse: 'halfSine', n0: 0.05, trials: 40000, seed: 1 })
    expect(s.mean.ci[0]).toBeLessThanOrEqual(s.expectedMean)
    expect(s.mean.ci[1]).toBeGreaterThanOrEqual(s.expectedMean)
    expect(s.variance.ci[0]).toBeLessThanOrEqual(s.expectedVariance)
    expect(s.variance.ci[1]).toBeGreaterThanOrEqual(s.expectedVariance)
  })

  it('does worse with a filter that does not match, which is the Cauchy-Schwarz bound', () => {
    const s = matchedFilterSnr({
      pulse: 'halfSine',
      mismatch: 'rect',
      n0: 0.05,
      trials: 40000,
      seed: 7,
    })
    expect(s.mismatchLoss).toBeLessThan(1)
    expect(s.measured).toBeLessThan(s.twoEOverN0)
  })

  it('samples a shaped stream at the symbol instants', () => {
    const sps = 8
    const h = shapeTaps({ kind: 'rrc', beta: 0.35, span: 16, sps })
    const bits = randomBits(2 * 32, rng(1))
    const syms = mapBits('qpsk', bits)
    // Upsample by inserting zeros, then shape, which is what the chain does.
    const up = new Float64Array(2 * syms.length * sps)
    for (let i = 0; i < syms.length / 2; i++) {
      up[2 * i * sps] = syms[2 * i]
      up[2 * i * sps + 1] = syms[2 * i + 1]
    }
    const shaped = new Float64Array(up.length)
    for (let i = 0; i < up.length / 2; i++) {
      let re = 0
      let im = 0
      for (let k = 0; k < h.length; k++) {
        if (i - k < 0) continue
        re += h[k] * up[2 * (i - k)]
        im += h[k] * up[2 * (i - k) + 1]
      }
      shaped[2 * i] = re
      shaped[2 * i + 1] = im
    }
    const got = matchedSample(shaped, h, sps)
    // The first few samples come back as the symbols that went in, up to the
    // energy the kernel pair carries.
    // The truncation's peak distortion bounds how close this can come, and at
    // a span of 16 that is about 7e-3 of the wanted sample.
    const scale = got[0] / syms[0]
    for (let s = 0; s < 8; s++) {
      expect(Math.abs(got[2 * s] / scale - syms[2 * s]), `${s} in phase`).toBeLessThan(0.02)
      expect(Math.abs(got[2 * s + 1] / scale - syms[2 * s + 1]), `${s} quadrature`).toBeLessThan(0.02)
    }
  })
})

describe('the soft metric', () => {
  it('favours a zero with a positive value and a one with a negative one', () => {
    const c = constellation('qpsk')
    const bits = randomBits(2 * 64, rng(1))
    const syms = mapBits('qpsk', bits)
    const llr = softMetric('qpsk', syms, 0.01)
    for (let i = 0; i < bits.length; i++) {
      expect(llr[i] > 0 ? 0 : 1, `bit ${i}`).toBe(bits[i])
    }
    expect(llr.length).toBe((syms.length / 2) * c.bits)
  })

  it('grows as the noise variance falls, because the reading is more certain', () => {
    const syms = mapBits('bpsk', Uint8Array.from([1]))
    const loud = softMetric('bpsk', syms, 1)
    const quiet = softMetric('bpsk', syms, 0.01)
    expect(Math.abs(quiet[0])).toBeGreaterThan(Math.abs(loud[0]))
  })
})

describe('binary FSK', () => {
  it('is 3.010 dB worse than antipodal signalling, exactly', () => {
    for (const g of [2, 8, 20]) {
      expect(fskCoherentBer(2 * g)).toBeCloseTo(qFunction(Math.sqrt(2 * g)), 15)
    }
  })

  it('costs a further step without a phase reference', () => {
    for (const g of [4, 10, 20]) {
      expect(fskNoncoherentBer(g)).toBeGreaterThan(fskCoherentBer(g))
    }
  })

  it('is not a point in the plane, and its tones are orthogonal at half the rate', () => {
    expect(Math.abs(toneCorrelation({ spacing: 500, symbolRate: 1000 }))).toBeLessThan(1e-12)
    expect(Math.abs(toneCorrelation({ spacing: 1000, symbolRate: 1000 }))).toBeLessThan(1e-12)
    expect(Math.abs(toneCorrelation({ spacing: 250, symbolRate: 1000 }))).toBeGreaterThan(0.1)
  })
})

describe('the decision region', () => {
  it('counts nothing outside on a clean constellation', () => {
    const bits = randomBits(4 * 200, rng(1))
    const syms = mapBits('qam16', bits)
    const sent = decide('qam16', syms)
    expect(outsideRegion('qam16', syms, sent).errors).toBe(0)
  })

  it('counts about seven in a thousand for 16-QAM at 10 dB', () => {
    const c = constellation('qam16')
    const r = rng(21)
    const n = 200000
    const bits = randomBits(c.bits * n, r)
    const syms = mapBits('qam16', bits)
    const sent = decide('qam16', syms)
    const sigma = Math.sqrt(1 / (2 * c.bits * 10))
    const noisy = new Float64Array(syms.length)
    for (let i = 0; i < syms.length; i++) noisy[i] = syms[i] + r.normal(0, sigma)
    const { errors } = outsideRegion('qam16', noisy, sent)
    expect(errors / n).toBeCloseTo(7.004e-3, 3)
  })
})
