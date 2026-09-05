import { describe, it, expect } from 'vitest'
import {
  rng, runSeed, sampleMean, averagedPeriodogram, integratePsd, whitePsd, whiteNoise,
  firstOrderLowpass, filteredPsd, matchedSnr, PULSES, autocorrelation, psdFromAcf,
  periodogram, ensemble, zFor,
} from '../index.js'

// The six invariants of RANDOM_LAB_PLAN.md section 3, fuzzed.
//
// Each one is a claim the lab makes in prose, and each is checked across a
// spread of parameters rather than at one convenient point. Where a claim is
// about an estimate, the tolerance is the estimate's OWN interval and not a
// number chosen to make the test pass. That is the difference between a test
// that measures a claim and a test that records the current output.

const SEEDS = [1, 2, 3, 7, 11, 23, 101, 4242]

describe('invariant 1: the same seed gives the same numbers', () => {
  it('holds for every draw the package makes', () => {
    for (const seed of SEEDS) {
      const a = rng(seed)
      const b = rng(seed)
      for (let i = 0; i < 500; i++) {
        expect(b.uniform()).toBe(a.uniform())
        expect(b.normal(1, 3)).toBe(a.normal(1, 3))
        expect(b.exponential(2)).toBe(a.exponential(2))
        expect(b.bernoulli(0.4)).toBe(a.bernoulli(0.4))
      }
    }
  })

  it('holds for a whole ensemble, drawn twice', () => {
    const build = () =>
      ensemble({
        seed: 99, runs: 24, length: 128,
        make: (r) => r.take(128, () => r.normal()),
        stat: (x) => x[0],
      })
    const a = build()
    const b = build()
    for (let k = 0; k < a.runs; k++) {
      expect(Array.from(b.paths[k])).toEqual(Array.from(a.paths[k]))
    }
    expect(Array.from(b.stats)).toEqual(Array.from(a.stats))
  })

  it('holds when only one run of the ensemble is drawn', () => {
    // The addressability claim, which is what lets the app render a subset.
    const full = ensemble({ seed: 5, runs: 16, length: 32, make: (r) => r.take(32, () => r.normal()) })
    const alone = rng(runSeed(5, 11)).take(32, undefined)
    expect(Array.from(full.paths[11])).toEqual(Array.from(alone))
  })
})

describe("invariant 2: the sample mean's variance is sigma squared over N", () => {
  // The claim is about the ESTIMATOR, so it is checked by repeating the whole
  // estimate many times and comparing the spread of the estimates against the
  // formula. The tolerance is the standard error OF THAT SPREAD, computed here.
  const CASES = [
    { N: 50, sigma: 1 },
    { N: 200, sigma: 0.5 },
    { N: 1000, sigma: 3 },
    { N: 4000, sigma: 0.1 },
  ]

  for (const { N, sigma } of CASES) {
    it(`holds at N = ${N}, sigma = ${sigma}`, () => {
      const trials = 3000
      const mu = 1.5
      const vals = new Float64Array(trials)
      for (let t = 0; t < trials; t++) {
        const r = rng(runSeed(N * 7919 + 13, t))
        vals[t] = sampleMean(r.take(N, () => r.normal(mu, sigma))).value
      }
      let m = 0
      for (const v of vals) m += v
      m /= trials
      let ss = 0
      for (const v of vals) ss += (v - m) * (v - m)
      const measured = ss / (trials - 1)
      const predicted = (sigma * sigma) / N
      // The variance estimate over `trials` Gaussian samples has variance
      // 2 predicted^2 / (trials - 1), so this bound is the estimate's own
      // interval and nothing else.
      const se = predicted * Math.sqrt(2 / (trials - 1))
      expect(Math.abs(measured - predicted)).toBeLessThan(4 * se)
    })
  }

  it('and the interval it reports covers the truth at the rate it claims', () => {
    const trials = 4000
    const N = 300
    const mu = -2
    const sigma = 2.5
    let inside = 0
    for (let t = 0; t < trials; t++) {
      const r = rng(runSeed(31337, t))
      const est = sampleMean(r.take(N, () => r.normal(mu, sigma)), { level: 0.95 })
      if (est.ci[0] <= mu && mu <= est.ci[1]) inside++
    }
    // The coverage count is binomial(trials, 0.95), so its standard error is
    // 0.00345. Three of those is the band a sound interval sits inside.
    const se = Math.sqrt((0.95 * 0.05) / trials)
    expect(Math.abs(inside / trials - 0.95)).toBeLessThan(3 * se)
  })
})

describe('invariant 3: the averaged periodogram flattens as one over root M', () => {
  const fs = 48000

  for (const segment of [128, 256, 512]) {
    it(`the spread across bins matches sqrt(2/dof) at a ${segment}-sample segment`, () => {
      const n = segment * 256
      const { x } = whiteNoise({ n, sampleRate: fs, rms: 1e-3, seed: segment })
      const ap = averagedPeriodogram(x, fs, { segment, window: 'hann' })
      expect(ap.dofExact).toBe(true)
      expect(ap.dof).toBe(2 * ap.segments)
      // `flatness` is the relative standard deviation measured across the
      // interior bins. For a flat spectrum it estimates sqrt(2/dof), and a
      // standard deviation estimated from B bins has relative error
      // 1/sqrt(2B). A Hann window correlates neighbouring bins, so the
      // independent count is nearer B/1.5 and the bound uses that.
      const bins = ap.interior[1] - ap.interior[0] + 1
      const tol = 4 / Math.sqrt((2 * bins) / 1.5)
      expect(Math.abs(ap.flatness / ap.relativeSe - 1)).toBeLessThan(tol)
    })
  }

  it('halves when the number of averages is quadrupled', () => {
    const n = 512 * 1024
    const { x } = whiteNoise({ n, sampleRate: fs, rms: 1, seed: 6 })
    const few = averagedPeriodogram(x.subarray(0, 512 * 64), fs, { segment: 512 })
    const many = averagedPeriodogram(x, fs, { segment: 512 })
    expect(many.segments / few.segments).toBe(16)
    expect(many.relativeSe / few.relativeSe).toBeCloseTo(0.25, 12)
    // And the measurement follows the formula, within the spread of a spread.
    // Each flatness is itself an estimate from `bins` correlated bins, so the
    // ratio of two of them carries both errors.
    const bins = many.interior[1] - many.interior[0] + 1
    const tol = 5 * Math.sqrt(2) / Math.sqrt((2 * bins) / 1.5)
    expect(few.flatness / many.flatness).toBeGreaterThan(4 * (1 - tol))
    expect(few.flatness / many.flatness).toBeLessThan(4 * (1 + tol))
  })

  it('carries a chi-square interval that covers the true density at its stated rate', () => {
    const fsLocal = 8000
    const sigma = 0.7
    const truth = whitePsd(sigma * sigma, fsLocal)
    let inside = 0
    let total = 0
    for (let t = 0; t < 60; t++) {
      const { x } = whiteNoise({ n: 256 * 32, sampleRate: fsLocal, rms: sigma, seed: 900 + t })
      const ap = averagedPeriodogram(x, fsLocal, { segment: 256, window: 'hann', level: 0.9 })
      // Interior bins only. The Hann window's first and last bins see the
      // frame edge, which is a different statistic and not what is claimed.
      for (let k = 3; k < ap.psd.length - 3; k++) {
        total++
        if (ap.ci[k][0] <= truth && truth <= ap.ci[k][1]) inside++
      }
    }
    // Neighbouring bins of one estimate are not independent, so this is a
    // generous band on a rate that would be far from 0.9 if the interval were
    // the wrong shape.
    expect(inside / total).toBeGreaterThan(0.84)
    expect(inside / total).toBeLessThan(0.96)
  })
})

describe('invariant 4: the integral of the density returns the variance', () => {
  const CASES = [
    { fs: 8000, sigma: 1, segment: 512 },
    { fs: 48000, sigma: 1e-3, segment: 1024 },
    { fs: 1000, sigma: 12, segment: 256 },
  ]

  for (const { fs, sigma, segment } of CASES) {
    it(`holds within 1 % for white noise at ${sigma} rms and ${fs} Hz`, () => {
      const { x } = whiteNoise({ n: segment * 512, sampleRate: fs, rms: sigma, seed: segment + fs })
      const ap = averagedPeriodogram(x, fs, { segment, window: 'hann' })
      expect(Math.abs(ap.integral / (sigma * sigma) - 1)).toBeLessThan(0.01)
    })
  }

  it('holds for a filtered process, where the density is not flat', () => {
    const fs = 48000
    const lp = firstOrderLowpass(2000, fs)
    const { x } = whiteNoise({ n: 1024 * 512, sampleRate: fs, rms: 1, seed: 4242 })
    const y = lp.run(x)
    const ap = averagedPeriodogram(y, fs, { segment: 1024, window: 'hann' })
    // The variance the filter passes has a closed form: sum h^2 = K/(K+1).
    expect(Math.abs(ap.integral / lp.noiseGain - 1)).toBeLessThan(0.01)
  })

  it('and the density itself integrates to what the closed form says', () => {
    const fs = 8000
    const freqs = new Float64Array(4097)
    for (let k = 0; k < freqs.length; k++) freqs[k] = (k * fs) / 8192
    const flat = new Float64Array(freqs.length).fill(whitePsd(9, fs))
    expect(integratePsd({ freqs, psd: flat })).toBeCloseTo(9, 10)
  })
})

describe('invariant 5: the output density is the magnitude squared times the input', () => {
  const fs = 48000

  for (const fc of [500, 2000, 8000]) {
    it(`holds for a first-order low-pass at ${fc} Hz, band by band`, () => {
      const lp = firstOrderLowpass(fc, fs)
      const { x } = whiteNoise({ n: 1024 * 512, sampleRate: fs, rms: 1, seed: fc })
      const measured = averagedPeriodogram(lp.run(x), fs, { segment: 1024, window: 'hann' })
      const sIn = whitePsd(1, fs)
      const predicted = filteredPsd(
        measured.freqs,
        new Float64Array(measured.freqs.length).fill(sIn),
        (f) => lp.magnitude(f),
      )
      // One bin of the estimate has a relative standard error of
      // sqrt(2/dof), so a comparison bin by bin would be dominated by that.
      // Averaging over a band of bins divides it by the root of the count,
      // which is what the pane does and what is checked here.
      const bins = measured.psd.length
      const width = 32
      for (let start = 0; start + width <= bins; start += width) {
        let m = 0
        let p = 0
        for (let k = start; k < start + width; k++) {
          m += measured.psd[k]
          p += predicted[k]
        }
        const se = Math.sqrt(2 / measured.dof / width)
        expect(Math.abs(m / p - 1), `band from bin ${start}`).toBeLessThan(5 * se)
      }
    })
  }

  it('agrees with a directly filtered ensemble, run for run', () => {
    // The same claim reached without a spectrum at all: filter each run of an
    // ensemble and compare the variance across runs against the integral of
    // |H|^2 S. Two routes to one number.
    const fc = 3000
    const lp = firstOrderLowpass(fc, fs)
    const e = ensemble({
      seed: 808, runs: 400, length: 4096,
      make: (r) => lp.run(r.take(4096, () => r.normal(0, 1))),
      // The variance late in the run, after the filter has forgotten its start.
      stat: (y) => {
        let s = 0
        for (let i = 2048; i < y.length; i++) s += y[i] * y[i]
        return s / (y.length - 2048)
      },
    })
    let m = 0
    for (const v of e.stats) m += v
    m /= e.runs
    expect(Math.abs(m / lp.noiseGain - 1)).toBeLessThan(0.02)
  })
})

describe("invariant 6: the matched filter's output ratio is two E over N zero", () => {
  const PULSE_NAMES = ['rect', 'halfSine', 'ramp']

  for (const name of PULSE_NAMES) {
    for (const len of [8, 32, 128]) {
      it(`holds for a ${len}-sample ${name} pulse`, () => {
        const s = PULSES[name](len)
        for (const sigma2 of [1e-4, 0.01, 1, 25]) {
          for (const fs of [1000, 48000, 1e6]) {
            const m = matchedSnr({ s, sigma2, sampleRate: fs })
            // The two routes to the number are computed independently in
            // `matchedSnr`, so this compares them rather than restating one.
            expect(m.twoEOverN0).toBeCloseTo(m.snr, 9)
            expect(m.snr).toBeCloseTo(1 / sigma2, 9)
          }
        }
      })
    }
  }

  it('and the ratio does not depend on the pulse shape at equal energy', () => {
    // Every pulse in PULSES is returned with unit energy, so the claim is that
    // all three reach the same ratio. That is the content of the experiment.
    const sigma2 = 0.02
    const ratios = PULSE_NAMES.map((n) => matchedSnr({ s: PULSES[n](64), sigma2, sampleRate: 1e6 }).snr)
    for (const r of ratios) expect(r).toBeCloseTo(ratios[0], 9)
  })

  it('and it is measured on a real record, not only stated', () => {
    // Run the filter over noise plus pulse many times, and compare the measured
    // peak-to-spread ratio against the formula.
    const s = PULSES.halfSine(64)
    const sigma2 = 0.05
    const trials = 3000
    const vals = new Float64Array(trials)
    for (let t = 0; t < trials; t++) {
      const r = rng(runSeed(70000, t))
      let y = 0
      for (let n = 0; n < s.length; n++) y += s[n] * (s[n] + r.normal(0, Math.sqrt(sigma2)))
      vals[t] = y
    }
    let m = 0
    for (const v of vals) m += v
    m /= trials
    let ss = 0
    for (const v of vals) ss += (v - m) * (v - m)
    const measured = (m * m) / (ss / (trials - 1))
    const predicted = matchedSnr({ s, sigma2, sampleRate: 1e6 }).snr
    // The measured ratio is a ratio of two estimates, so its relative spread is
    // about 2/sqrt(trials) from the mean and sqrt(2/trials) from the variance.
    const tol = 5 * Math.sqrt(4 / trials + 2 / trials)
    expect(Math.abs(measured / predicted - 1)).toBeLessThan(tol)
  })
})

describe('the pair the invariants rest on: Wiener and Khinchin', () => {
  for (const n of [256, 1024, 4096]) {
    it(`the biased autocorrelation transforms to the periodogram at n = ${n}`, () => {
      const { x } = whiteNoise({ n, sampleRate: 1000, rms: 1, seed: n })
      const acf = autocorrelation(x, n - 1, { removeMean: false })
      const viaAcf = psdFromAcf(acf.r, 1000)
      const direct = periodogram(x, 1000, { window: 'none' })
      let worst = 0
      for (let k = 0; k <= n / 2; k++) {
        const j = Math.round((direct.freqs[k] * viaAcf.nfft) / 1000)
        worst = Math.max(worst, Math.abs(viaAcf.psd[j] - direct.psd[k]) / direct.psd[k])
      }
      // This is an identity about arithmetic, not a statistical claim, so the
      // tolerance is floating point and nothing else.
      expect(worst).toBeLessThan(1e-9)
    })
  }

  it('and the zero lag is the variance, which is the integral of the density', () => {
    const { x } = whiteNoise({ n: 4096, sampleRate: 2000, rms: 3, seed: 77 })
    const acf = autocorrelation(x, 4095, { removeMean: false })
    const viaAcf = psdFromAcf(acf.r, 2000)
    // The trapezoid rule takes half of each end panel, and the exact bin sum
    // takes all of both. That difference is a known fraction of the total, and
    // it is what separates these two numbers rather than any error in either.
    const df = viaAcf.freqs[1] - viaAcf.freqs[0]
    const endGap = 0.5 * (viaAcf.psd[0] + viaAcf.psd[viaAcf.psd.length - 1]) * df
    expect(integratePsd(viaAcf) + endGap).toBeCloseTo(acf.r0, 9)
  })
})

describe('every estimate carries an interval, and the interval is the guard', () => {
  it('a sample mean reports variance, standard error, interval and level', () => {
    const r = rng(1)
    const est = sampleMean(r.take(100, () => r.normal()))
    for (const key of ['value', 'variance', 'se', 'ci', 'level', 'n']) {
      expect(est[key], key).toBeDefined()
    }
    expect(est.se).toBeCloseTo(Math.sqrt(est.variance), 15)
    expect(est.ci[1] - est.ci[0]).toBeCloseTo(2 * zFor(est.level) * est.se, 12)
  })

  it('an averaged periodogram reports one interval per bin, bracketing the estimate', () => {
    const { x } = whiteNoise({ n: 8192, sampleRate: 8000, rms: 1, seed: 2 })
    const ap = averagedPeriodogram(x, 8000, { segment: 256 })
    expect(ap.ci.length).toBe(ap.psd.length)
    for (let k = 0; k < ap.psd.length; k++) {
      expect(ap.ci[k][0]).toBeLessThanOrEqual(ap.psd[k])
      expect(ap.ci[k][1]).toBeGreaterThanOrEqual(ap.psd[k])
    }
  })

  it('a narrower level gives a narrower interval, at every estimator', () => {
    const r = rng(3)
    const x = r.take(200, () => r.normal())
    const wide = sampleMean(x, { level: 0.99 })
    const narrow = sampleMean(x, { level: 0.8 })
    expect(narrow.ci[1] - narrow.ci[0]).toBeLessThan(wide.ci[1] - wide.ci[0])
  })
})
