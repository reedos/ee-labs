import { describe, it, expect } from 'vitest'
import { rng, runSeed } from './prng.js'
import { distribution, zFor } from './dist.js'
import {
  estimate, mean, sampleMean, sampleVariance, proportion, histogram, histogramError,
} from './estimate.js'

describe('the estimate shape', () => {
  it('carries the estimator variance, the standard error, the interval and the level', () => {
    const e = estimate(5, 4, { level: 0.95, n: 10 })
    expect(e.value).toBe(5)
    expect(e.variance).toBe(4)
    expect(e.se).toBe(2)
    expect(e.ci[0]).toBeCloseTo(5 - 2 * zFor(0.95), 12)
    expect(e.ci[1]).toBeCloseTo(5 + 2 * zFor(0.95), 12)
    expect(e.n).toBe(10)
  })

  it('does not return a negative standard error from a rounding-negative variance', () => {
    expect(estimate(1, -1e-18).se).toBe(0)
  })
})

describe('the sample mean', () => {
  it('is the arithmetic mean, and reports the data variance beside the estimator variance', () => {
    const x = Float64Array.from([1, 2, 3, 4, 5])
    const e = sampleMean(x)
    expect(e.value).toBe(3)
    expect(e.sampleVariance).toBe(2.5)
    expect(e.variance).toBe(0.5)
    expect(mean(x)).toBe(3)
  })

  it('refuses one sample, which has no variance to report', () => {
    expect(() => sampleMean(Float64Array.from([1]))).toThrow(/at least two/)
  })

  it('narrows as one over root N', () => {
    const r = rng(1)
    const wide = sampleMean(r.take(100, () => r.normal(0, 1)))
    const r2 = rng(1)
    const narrow = sampleMean(r2.take(1600, () => r2.normal(0, 1)))
    // Four times the samples, half the standard error, within the spread of
    // the two sample variances themselves.
    expect(narrow.se / wide.se).toBeGreaterThan(0.2)
    expect(narrow.se / wide.se).toBeLessThan(0.32)
  })
})

describe('the sample variance', () => {
  it('is the unbiased one, divided by N-1', () => {
    const x = Float64Array.from([2, 4, 4, 4, 5, 5, 7, 9])
    // Mean 5, sum of squares 32, so the unbiased variance is 32/7.
    expect(sampleVariance(x).value).toBeCloseTo(32 / 7, 12)
  })

  it('reports the Gaussian formula beside the general one, and they agree on Gaussian data', () => {
    const r = rng(44)
    const e = sampleVariance(r.take(20000, () => r.normal(0, 2)))
    // The estimate carries its own interval, so that is the tolerance. A fixed
    // one would be a number chosen to make this pass.
    expect(e.ci[0]).toBeLessThan(4)
    expect(e.ci[1]).toBeGreaterThan(4)
    expect(e.kurtosis).toBeCloseTo(3, 1)
    // For Gaussian data the two variance formulas agree within their own noise.
    expect(e.variance / e.gaussianVariance).toBeCloseTo(1, 1)
  })

  it('and they part on data that is not Gaussian, which is why both are reported', () => {
    const r = rng(45)
    const d = distribution('exponential', { lambda: 1 })
    const e = sampleVariance(r.take(20000, () => d.draw(r)))
    // An exponential has kurtosis 9, so the true estimator variance is far
    // above the Gaussian formula. A pane that printed only the Gaussian one
    // would claim an interval four times too narrow.
    expect(e.kurtosis).toBeGreaterThan(6)
    expect(e.variance / e.gaussianVariance).toBeGreaterThan(2.5)
  })

  it('refuses a sample too short for a fourth moment', () => {
    expect(() => sampleVariance(Float64Array.from([1, 2, 3]))).toThrow(/at least four/)
  })
})

describe('the proportion', () => {
  it('keeps a non-zero interval at zero counts, which is the case that matters', () => {
    const p = proportion(0, 10000)
    expect(p.value).toBe(0)
    expect(p.ci[0]).toBe(0)
    // The naive interval collapses here and would claim the rate is exactly
    // zero. Wilson's does not.
    expect(p.ci[1]).toBeGreaterThan(0)
    expect(p.ci[1]).toBeLessThan(1e-3)
  })

  it('keeps the interval inside [0, 1] at the other end too', () => {
    const p = proportion(50, 50)
    expect(p.ci[0]).toBeLessThan(1)
    expect(p.ci[1]).toBe(1)
  })

  it('covers a known rate at the rate it claims', () => {
    const truth = 0.02
    const trials = 3000
    let inside = 0
    for (let t = 0; t < trials; t++) {
      const r = rng(runSeed(600, t))
      let k = 0
      for (let i = 0; i < 400; i++) k += r.bernoulli(truth)
      const p = proportion(k, 400)
      if (p.ci[0] <= truth && truth <= p.ci[1]) inside++
    }
    // Wilson's interval is conservative at small p, so the coverage sits at or
    // above the nominal level rather than below it.
    expect(inside / trials).toBeGreaterThan(0.93)
  })

  it('refuses a zero denominator', () => {
    expect(() => proportion(0, 0)).toThrow(/n must be positive/)
  })
})

describe('the histogram', () => {
  it('normalises to a density that integrates to one', () => {
    const r = rng(88)
    const d = distribution('gaussian', { mu: 0, sigma: 1 })
    const h = histogram(r.take(50000, () => d.draw(r)), { bins: 50, lo: -5, hi: 5 })
    let area = 0
    for (const v of h.density) area += v * h.width
    expect(area).toBeCloseTo(1, 3)
    expect(h.outside).toBeLessThan(50)
  })

  it('counts what fell outside rather than piling it into the end bins', () => {
    const r = rng(89)
    const d = distribution('gaussian', { mu: 0, sigma: 1 })
    const h = histogram(r.take(20000, () => d.draw(r)), { bins: 20, lo: -1, hi: 1 })
    // About 31.7 % of a standard normal lies outside one sigma.
    expect(h.outside / 20000).toBeCloseTo(0.3173, 1)
    // And the end bins are not spikes.
    expect(h.density[0]).toBeLessThan(h.density[10])
    expect(h.density[19]).toBeLessThan(h.density[10])
  })

  it('gives each bin an interval that brackets its own density', () => {
    const r = rng(90)
    const d = distribution('uniform', { a: 0, b: 1 })
    const h = histogram(r.take(10000, () => d.draw(r)), { bins: 20, lo: 0, hi: 1 })
    for (let k = 0; k < 20; k++) {
      expect(h.ci[k][0]).toBeLessThanOrEqual(h.density[k])
      expect(h.ci[k][1]).toBeGreaterThanOrEqual(h.density[k])
      // And the true density, 1, is inside most of them.
    }
    let inside = 0
    for (let k = 0; k < 20; k++) if (h.ci[k][0] <= 1 && 1 <= h.ci[k][1]) inside++
    expect(inside).toBeGreaterThanOrEqual(17)
  })

  it('frames itself on the data when no range is given', () => {
    const h = histogram(Float64Array.from([1, 2, 3, 4]), { bins: 4 })
    expect(h.lo).toBe(1)
    expect(h.hi).toBe(4)
    expect(h.outside).toBe(1) // the sample at the upper edge
  })

  it('does not divide by zero when every sample is the same', () => {
    const h = histogram(Float64Array.from([2, 2, 2, 2]), { bins: 4 })
    expect(Number.isFinite(h.width)).toBe(true)
    expect(h.width).toBeGreaterThan(0)
  })
})

describe('the histogram error and its one-over-root-N law', () => {
  it('follows the binomial prediction, and halves when N is quadrupled', () => {
    const d = distribution('gaussian', { mu: 0, sigma: 1 })
    const measure = (N) => {
      let acc = 0
      let accP = 0
      const S = 12
      for (let t = 0; t < S; t++) {
        const r = rng(runSeed(2200, t))
        const h = histogram(r.take(N, () => d.draw(r)), { bins: 40, lo: -4, hi: 4 })
        const e = histogramError(h, (v) => d.pdf(v))
        acc += e.rms * e.rms
        accP += e.predicted * e.predicted
      }
      return { rms: Math.sqrt(acc / S), predicted: Math.sqrt(accP / S) }
    }
    const a = measure(2000)
    const b = measure(8000)
    // Each agrees with the formula.
    expect(a.rms / a.predicted).toBeGreaterThan(0.9)
    expect(a.rms / a.predicted).toBeLessThan(1.15)
    expect(b.rms / b.predicted).toBeGreaterThan(0.9)
    expect(b.rms / b.predicted).toBeLessThan(1.15)
    // And quadrupling N halves the gap.
    expect(a.rms / b.rms).toBeGreaterThan(1.75)
    expect(a.rms / b.rms).toBeLessThan(2.25)
  })
})
