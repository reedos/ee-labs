import { describe, it, expect } from 'vitest'
import { rng, runSeed } from './prng.js'
import {
  wienerScalar, wienerFir, wienerResponse, solveToeplitz, levinsonDurbin,
} from './wiener.js'
import { firstOrderLowpass } from './noise.js'

describe('the one-weight Wiener estimate', () => {
  it('is the variance ratio, and leaves the harmonic combination as its error', () => {
    const w = wienerScalar({ signalVariance: 1, noiseVariance: 0.25 })
    expect(w.w).toBeCloseTo(0.8, 12)
    expect(w.mmse).toBeCloseTo(0.2, 12)
    expect(w.unfilteredMse).toBe(0.25)
  })

  it('beats doing nothing by exactly the weight', () => {
    for (const s of [0.1, 1, 10]) {
      for (const n of [0.01, 1, 100]) {
        const w = wienerScalar({ signalVariance: s, noiseVariance: n })
        expect(w.mmse / w.unfilteredMse).toBeCloseTo(w.w, 12)
      }
    }
  })

  it('cannot change the ratio of powers, which is the lesson', () => {
    // A single weight scales signal and noise together, so the output ratio is
    // the input ratio for every input. This identity is the reason the group
    // then needs a filter with more than one tap.
    for (const s of [0.01, 1, 7, 1000]) {
      for (const n of [0.001, 0.5, 40]) {
        const w = wienerScalar({ signalVariance: s, noiseVariance: n })
        expect(w.snrOut).toBeCloseTo(w.snrIn, 9)
        expect(w.gainDb).toBeCloseTo(0, 9)
      }
    }
  })

  it('trusts the measurement when the noise is small, and discards it when it is large', () => {
    expect(wienerScalar({ signalVariance: 1, noiseVariance: 1e-6 }).w).toBeGreaterThan(0.999)
    expect(wienerScalar({ signalVariance: 1, noiseVariance: 1e6 }).w).toBeLessThan(1e-5)
  })
})

describe('the Toeplitz solve', () => {
  it('solves a system whose answer is known', () => {
    // R = [[2, 1], [1, 2]], p = [3, 3] gives w = [1, 1].
    const w = solveToeplitz(Float64Array.from([2, 1]), Float64Array.from([3, 3]))
    expect(w[0]).toBeCloseTo(1, 12)
    expect(w[1]).toBeCloseTo(1, 12)
  })

  it('returns a vector that reproduces the right-hand side', () => {
    const r = Float64Array.from([4, 2, 1, 0.5, 0.25, 0.125])
    const p = Float64Array.from([1, -2, 0.5, 3, -1, 0])
    const w = solveToeplitz(r, p)
    for (let i = 0; i < p.length; i++) {
      let acc = 0
      for (let j = 0; j < p.length; j++) acc += r[Math.abs(i - j)] * w[j]
      expect(acc).toBeCloseTo(p[i], 9)
    }
  })

  it('refuses a correlation sequence no real process could have produced', () => {
    // r = [1, 2] would need a correlation coefficient of 2.
    expect(() => solveToeplitz(Float64Array.from([1, 2]), Float64Array.from([1, 1]))).toThrow(
      /not positive definite at order 2/,
    )
  })

  it('refuses a row shorter than the system it is asked to solve', () => {
    expect(() => solveToeplitz(Float64Array.from([1]), Float64Array.from([1, 1]))).toThrow(
      /shorter than the target/,
    )
  })
})

describe('the prediction recursion', () => {
  it('recovers the coefficients of the process that made the correlation', () => {
    // A first-order process x[k] = a x[k-1] + v has r[m] = r0 a^|m|, and its
    // one-step predictor is exactly a.
    const a = 0.8
    const r = new Float64Array(6)
    for (let m = 0; m < 6; m++) r[m] = a ** m
    const { a: coeffs, reflection, error } = levinsonDurbin(r, 5)
    expect(coeffs[0]).toBeCloseTo(a, 10)
    for (let k = 1; k < 5; k++) expect(coeffs[k]).toBeCloseTo(0, 9)
    expect(reflection[0]).toBeCloseTo(a, 10)
    expect(error).toBeCloseTo(1 - a * a, 10)
  })

  it('keeps every reflection coefficient below one, which is positive definiteness', () => {
    const r = rng(1)
    for (let t = 0; t < 100; t++) {
      // Any genuine autocorrelation: build one from a random spectrum, which
      // guarantees it is positive definite.
      const bins = 32
      const s = r.take(bins, () => Math.abs(r.normal()) + 0.05)
      const rr = new Float64Array(8)
      for (let m = 0; m < 8; m++) {
        let acc = 0
        for (let k = 0; k < bins; k++) acc += s[k] * Math.cos((Math.PI * k * m) / bins)
        rr[m] = acc / bins
      }
      const { reflection } = levinsonDurbin(rr, 7)
      for (const kappa of reflection) expect(Math.abs(kappa)).toBeLessThan(1)
    }
  })

  it('refuses a zero-lag correlation that is not positive', () => {
    expect(() => levinsonDurbin(Float64Array.from([0, 1]), 1)).toThrow(/must be positive/)
  })
})

describe('the multi-tap Wiener filter', () => {
  it('estimates a filtered signal out of white noise better than doing nothing', () => {
    // The signal is a low-pass filtered process, so it has structure a filter
    // can use. The noise is white, so it does not.
    const fs = 8000
    const n = 1 << 15
    const lp = firstOrderLowpass(400, fs)
    const r = rng(21)
    const clean = lp.run(r.take(n, () => r.normal(0, 1)))
    let power = 0
    for (let i = 0; i < n; i++) power += clean[i] * clean[i]
    power /= n
    const sigma = Math.sqrt(power)
    const x = new Float64Array(n)
    for (let i = 0; i < n; i++) x[i] = clean[i] + r.normal(0, sigma)

    const wf = wienerFir({ x, d: clean, taps: 12 })
    // Doing nothing leaves the noise variance. The filter must beat it.
    expect(wf.mmse).toBeLessThan(sigma * sigma)
    // And it must beat the one-weight answer, because it sees more than one
    // sample. This is the claim the scalar case sets up.
    const scalar = wienerScalar({ signalVariance: power, noiseVariance: sigma * sigma })
    expect(wf.mmse).toBeLessThan(scalar.mmse)
  })

  it('and the error it reports is the error the weights actually leave', () => {
    const fs = 8000
    const n = 1 << 15
    const lp = firstOrderLowpass(400, fs)
    const r = rng(22)
    const clean = lp.run(r.take(n, () => r.normal(0, 1)))
    const x = new Float64Array(n)
    for (let i = 0; i < n; i++) x[i] = clean[i] + r.normal(0, 0.5)
    const wf = wienerFir({ x, d: clean, taps: 8 })
    const y = wf.apply(x)
    let mse = 0
    for (let i = 100; i < n; i++) mse += (y[i] - clean[i]) ** 2
    mse /= n - 100
    // `mmse` is a formula from the correlations, and `mse` is measured from the
    // filtered record. They are two routes to one number.
    expect(mse / wf.mmse).toBeCloseTo(1, 1)
  })

  it('reduces to no filtering when the target is the input', () => {
    const r = rng(23)
    const x = r.take(4096, () => r.normal())
    const wf = wienerFir({ x, d: x, taps: 6 })
    expect(wf.w[0]).toBeCloseTo(1, 6)
    for (let k = 1; k < 6; k++) expect(wf.w[k]).toBeCloseTo(0, 6)
    expect(wf.mmse).toBeCloseTo(0, 6)
  })
})

describe('the frequency-domain Wiener filter', () => {
  it('passes where the signal dominates and stops where the noise does', () => {
    const s = Float64Array.from([100, 10, 1, 0.1, 0.01])
    const n = Float64Array.from([1, 1, 1, 1, 1])
    const h = wienerResponse(s, n)
    expect(h[0]).toBeCloseTo(100 / 101, 12)
    expect(h[2]).toBeCloseTo(0.5, 12)
    expect(h[4]).toBeCloseTo(0.01 / 1.01, 12)
    // Monotone, and always between zero and one.
    for (let k = 1; k < h.length; k++) {
      expect(h[k]).toBeLessThan(h[k - 1])
      expect(h[k]).toBeGreaterThan(0)
      expect(h[k]).toBeLessThan(1)
    }
  })

  it('returns zero rather than a division by zero where there is no power at all', () => {
    const h = wienerResponse(Float64Array.from([0, 1]), Float64Array.from([0, 1]))
    expect(h[0]).toBe(0)
    expect(h[1]).toBeCloseTo(0.5, 12)
  })
})
