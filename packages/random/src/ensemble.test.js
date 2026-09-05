import { describe, it, expect } from 'vitest'
import { rng, runSeed } from './prng.js'
import { ensemble, ergodicity, quantileOfSorted, SAMPLE_CAP } from './ensemble.js'

const gaussianRuns = (over = {}) => {
  const o = { seed: 12, runs: 300, length: 64, ...over }
  return ensemble({
    ...o,
    make: (r) => r.take(o.length, () => r.normal(0, 1)),
    stat: (x) => {
      let s = 0
      for (let i = 0; i < x.length; i++) s += x[i]
      return s / x.length
    },
  })
}

describe('the ensemble', () => {
  it('returns one path per run, each of the stated length', () => {
    const e = gaussianRuns()
    expect(e.paths.length).toBe(300)
    for (const p of e.paths) expect(p.length).toBe(64)
  })

  it('has the mean and spread across runs the process has', () => {
    const e = gaussianRuns()
    for (let i = 0; i < e.length; i += 16) {
      // The mean across 300 unit-variance runs has standard error 1/sqrt(300).
      expect(Math.abs(e.mean[i])).toBeLessThan(4 / Math.sqrt(300))
      // The spread estimate has relative standard error 1/sqrt(2*299).
      expect(Math.abs(e.sd[i] - 1)).toBeLessThan(5 / Math.sqrt(2 * 299))
    }
  })

  it('leaves the spread undefined with a single run rather than calling it zero', () => {
    const e = ensemble({ seed: 1, runs: 1, length: 8, make: (r) => r.take(8, () => r.normal()) })
    for (const v of e.sd) expect(Number.isNaN(v)).toBe(true)
  })

  it('refuses a run whose length does not match, naming the run', () => {
    expect(() =>
      ensemble({ seed: 1, runs: 3, length: 8, make: (r, k) => r.take(k === 1 ? 7 : 8, () => 0) }),
    ).toThrow(/run 1 returned 7 samples/)
  })

  it('refuses an ensemble larger than the sample cap rather than exhausting memory', () => {
    expect(() => ensemble({ seed: 1, runs: 10000, length: 10000 })).toThrow(
      new RegExp(`${SAMPLE_CAP}-sample cap`),
    )
  })

  it('gives the same run whether the ensemble is drawn whole or one run at a time', () => {
    const e = gaussianRuns({ runs: 20 })
    const alone = rng(runSeed(12, 13)).take(64, undefined)
    expect(Array.from(e.paths[13])).toEqual(Array.from(alone))
  })
})

describe('the bands the ensemble view draws', () => {
  it('the Gaussian band is the mean plus and minus z times the spread', () => {
    const e = gaussianRuns()
    const b = e.band(0.95)
    expect(b.z).toBeCloseTo(1.959963984540054, 12)
    for (let i = 0; i < e.length; i += 8) {
      expect(b.lo[i]).toBeCloseTo(e.mean[i] - b.z * e.sd[i], 12)
      expect(b.hi[i]).toBeCloseTo(e.mean[i] + b.z * e.sd[i], 12)
    }
  })

  it('the empirical band agrees with the Gaussian band on a Gaussian process', () => {
    // The two bands agreeing is a measurable claim, not an assumption, and it
    // is the check that makes the empirical band worth drawing at all.
    const e = gaussianRuns({ runs: 2000 })
    const g = e.band(0.6827)
    const q = e.quantileBand(0.15865)
    for (let i = 0; i < e.length; i += 8) {
      expect(Math.abs(q.lo[i] - g.lo[i])).toBeLessThan(0.15)
      expect(Math.abs(q.hi[i] - g.hi[i])).toBeLessThan(0.15)
    }
  })

  it('and they part on a process that is not Gaussian', () => {
    // A two-point process has no tail at all, so the Gaussian band reaches
    // beyond every sample the process can produce and the empirical band does
    // not. This is why the view offers both.
    const e = ensemble({
      seed: 3, runs: 2000, length: 8,
      make: (r) => r.take(8, () => r.sign()),
    })
    const g = e.band(0.99)
    const q = e.quantileBand(0.005)
    for (let i = 0; i < e.length; i++) {
      expect(g.hi[i]).toBeGreaterThan(1.5)
      expect(q.hi[i]).toBeLessThanOrEqual(1)
    }
  })

  it('the quantile of a sorted buffer interpolates between the samples', () => {
    const s = Float64Array.from([0, 1, 2, 3, 4])
    expect(quantileOfSorted(s, 0)).toBe(0)
    expect(quantileOfSorted(s, 1)).toBe(4)
    expect(quantileOfSorted(s, 0.5)).toBe(2)
    expect(quantileOfSorted(s, 0.25)).toBe(1)
    expect(quantileOfSorted(s, 0.375)).toBeCloseTo(1.5, 12)
  })
})

describe('the per-run outcome, which the Monte Carlo case needs', () => {
  it('estimates the mean outcome with an interval', () => {
    const e = gaussianRuns()
    // The time average of 64 unit-variance samples has variance 1/64.
    expect(e.statEstimate.variance).toBeCloseTo(1 / 64 / 300, 3)
    expect(e.statEstimate.ci[0]).toBeLessThan(0)
    expect(e.statEstimate.ci[1]).toBeGreaterThan(0)
  })

  it('counts the runs inside a specification band, with the interval of that count', () => {
    const e = gaussianRuns({ runs: 4000 })
    // The time average has sd 1/8, so the band from -1/8 to +1/8 is one sigma
    // and should hold 68.27 % of the runs.
    const y = e.withinSpec([-0.125, 0.125])
    expect(y.value).toBeGreaterThan(0.65)
    expect(y.value).toBeLessThan(0.72)
    expect(y.ci[0]).toBeLessThanOrEqual(y.value)
    expect(y.ci[1]).toBeGreaterThanOrEqual(y.value)
    expect(y.interval).toBe('wilson')
  })

  it('takes the band from the ensemble when one was declared', () => {
    const e = gaussianRuns({ spec: [-1, 1] })
    expect(e.withinSpec().value).toBeGreaterThan(0.99)
  })

  it('refuses to compute a yield with no band to compute it against', () => {
    expect(() => gaussianRuns().withinSpec()).toThrow(/no spec band/)
  })
})

describe('ergodicity, measured rather than assumed', () => {
  it('the time average and the ensemble average agree for a stationary process', () => {
    const e = gaussianRuns({ runs: 500, length: 256 })
    const erg = ergodicity(e)
    expect(Math.abs(erg.gap)).toBeLessThan(1e-12)
    // The spread of the per-run time averages is 1/sqrt(256).
    expect(erg.spread).toBeCloseTo(1 / 16, 2)
  })

  it('the spread of the time averages falls as the run lengthens', () => {
    const short = ergodicity(gaussianRuns({ runs: 800, length: 64 }))
    const long = ergodicity(gaussianRuns({ seed: 13, runs: 800, length: 1024 }))
    // Sixteen times the length, four times narrower.
    expect(short.spread / long.spread).toBeGreaterThan(3.2)
    expect(short.spread / long.spread).toBeLessThan(4.8)
  })

  it('and it does not fall when the randomness is drawn once per run', () => {
    // The counter-example the lab needs. Each run is a constant, drawn once, so
    // a longer run adds no new information and the time average never settles
    // towards the ensemble average. This is a process that is stationary and
    // not ergodic.
    const constRuns = (length) =>
      ergodicity(
        ensemble({
          seed: 21, runs: 800, length,
          make: (r) => {
            const c = r.normal()
            return new Float64Array(length).fill(c)
          },
        }),
      )
    const short = constRuns(64)
    const long = constRuns(1024)
    expect(short.spread).toBeCloseTo(1, 1)
    expect(long.spread).toBeCloseTo(1, 1)
    expect(Math.abs(short.spread / long.spread - 1)).toBeLessThan(1e-9)
  })
})
