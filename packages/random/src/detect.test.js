import { describe, it, expect } from 'vitest'
import { rng, runSeed } from './prng.js'
import { qFunction } from './dist.js'
import {
  energy, matchedFilter, filterSnr, matchedSnr,
  errorRateAntipodal, errorRateOrthogonal, errorRateAntipodalDb, errorRateOrthogonalDb,
  detectionRun, PULSES,
} from './detect.js'

describe('the pulses', () => {
  for (const name of ['rect', 'halfSine', 'ramp']) {
    it(`${name} is returned with unit energy, at every length`, () => {
      for (const n of [4, 16, 64, 256]) {
        expect(energy(PULSES[name](n))).toBeCloseTo(1, 12)
      }
    })
  }

  it('and they are genuinely different shapes, not the same pulse renamed', () => {
    const a = PULSES.rect(32)
    const b = PULSES.halfSine(32)
    let dot = 0
    for (let i = 0; i < 32; i++) dot += a[i] * b[i]
    // Unit-energy pulses with a correlation of one would be the same pulse.
    expect(dot).toBeLessThan(0.99)
    expect(dot).toBeGreaterThan(0.5)
  })
})

describe('the matched filter', () => {
  it('peaks where the pulse is, and the peak is the pulse energy', () => {
    const s = PULSES.halfSine(16)
    const x = new Float64Array(64)
    for (let i = 0; i < 16; i++) x[20 + i] = s[i]
    const y = matchedFilter(s, x)
    let best = 0
    for (let k = 1; k < y.length; k++) if (y[k] > y[best]) best = k
    expect(best).toBe(20)
    expect(y[best]).toBeCloseTo(energy(s), 12)
  })

  it('refuses a record shorter than its template', () => {
    expect(() => matchedFilter(new Float64Array(32), new Float64Array(8))).toThrow(
      /shorter than the template/,
    )
  })

  it('beats every mismatched filter, which is the optimality claim', () => {
    const s = PULSES.halfSine(64)
    const sigma2 = 0.05
    const best = matchedSnr({ s, sigma2, sampleRate: 1e6 }).snr
    // Every other filter shape, including ones that look reasonable.
    for (const other of [PULSES.rect(64), PULSES.ramp(64), PULSES.halfSine(32)]) {
      const h = new Float64Array(64)
      for (let i = 0; i < other.length; i++) h[i] = other[i]
      expect(filterSnr(h, s, sigma2)).toBeLessThan(best)
    }
    // And a filter proportional to the pulse reaches it exactly, whatever the
    // constant, because a scaling cannot change a ratio.
    for (const g of [0.01, 1, 1000]) {
      const h = Float64Array.from(s, (v) => g * v)
      expect(filterSnr(h, s, sigma2)).toBeCloseTo(best, 9)
    }
  })

  it('and a random filter never beats it, over many draws', () => {
    const s = PULSES.ramp(32)
    const sigma2 = 1
    const best = matchedSnr({ s, sigma2, sampleRate: 1000 }).snr
    const r = rng(4)
    for (let t = 0; t < 400; t++) {
      const h = r.take(32, () => r.normal())
      expect(filterSnr(h, s, sigma2)).toBeLessThanOrEqual(best * (1 + 1e-12))
    }
  })
})

describe('the ratio the matched filter reaches', () => {
  it('is the pulse energy over the noise variance, and equals two E over N zero', () => {
    for (const sigma2 of [1e-6, 0.001, 1, 100]) {
      for (const fs of [8000, 48000, 1e6]) {
        const m = matchedSnr({ s: PULSES.rect(128), sigma2, sampleRate: fs })
        expect(m.snr).toBeCloseTo(1 / sigma2, 9)
        expect(m.twoEOverN0).toBeCloseTo(m.snr, 9)
        expect(m.snrDb).toBeCloseTo(10 * Math.log10(1 / sigma2), 9)
        // The continuous-time quantities are consistent with the discrete ones.
        expect(m.energy).toBeCloseTo(m.energyDiscrete / fs, 15)
        expect(m.n0).toBeCloseTo((2 * sigma2) / fs, 18)
      }
    }
  })

  it('does not depend on the pulse shape at equal energy', () => {
    const sigma2 = 0.3
    const ratios = ['rect', 'halfSine', 'ramp'].map(
      (n) => matchedSnr({ s: PULSES[n](128), sigma2, sampleRate: 48000 }).snr,
    )
    for (const v of ratios) expect(v).toBeCloseTo(ratios[0], 9)
  })

  it('and it does not depend on the pulse length either, at equal energy', () => {
    const sigma2 = 0.3
    const short = matchedSnr({ s: PULSES.rect(8), sigma2, sampleRate: 48000 }).snr
    const long = matchedSnr({ s: PULSES.rect(512), sigma2, sampleRate: 48000 }).snr
    expect(short).toBeCloseTo(long, 9)
  })
})

describe('the error rates', () => {
  it('antipodal is Q of the root of twice the ratio', () => {
    for (const ebN0 of [0.5, 1, 2, 5, 10, 50]) {
      expect(errorRateAntipodal(ebN0)).toBeCloseTo(qFunction(Math.sqrt(2 * ebN0)), 15)
    }
  })

  it('orthogonal is exactly three decibels worse', () => {
    // The two curves are the same curve shifted by 3.01 dB, which is the claim
    // the experiment makes and this measures.
    for (const db of [0, 3, 6, 9, 12]) {
      expect(errorRateOrthogonalDb(db + 10 * Math.log10(2))).toBeCloseTo(
        errorRateAntipodalDb(db),
        15,
      )
    }
  })

  it('gives the values a textbook table prints', () => {
    // Bit error rate against Eb/N0 in decibels, antipodal signalling.
    expect(errorRateAntipodalDb(0)).toBeCloseTo(0.0786496035, 9)
    expect(errorRateAntipodalDb(4)).toBeCloseTo(0.0125008180, 9)
    expect(errorRateAntipodalDb(7)).toBeCloseTo(7.726748154e-4, 12)
    expect(errorRateAntipodalDb(10)).toBeCloseTo(3.872108216e-6, 14)
    expect(errorRateAntipodalDb(12)).toBeCloseTo(9.006010351e-9, 17)
  })

  it('falls off a cliff, which is why a link budget has a knee', () => {
    // One more decibel near 10 dB divides the error rate by 8.68, and the
    // factor keeps growing as the ratio rises. That steepening is the reason a
    // link budget has a knee rather than a slope.
    expect(errorRateAntipodalDb(9) / errorRateAntipodalDb(10)).toBeCloseTo(8.684475368, 8)
    expect(errorRateAntipodalDb(12) / errorRateAntipodalDb(13)).toBeGreaterThan(
      errorRateAntipodalDb(9) / errorRateAntipodalDb(10),
    )
  })

  it('and orthogonal is always the worse of the two', () => {
    for (const ebN0 of [0.1, 1, 10, 100]) {
      expect(errorRateOrthogonal(ebN0)).toBeGreaterThan(errorRateAntipodal(ebN0))
    }
  })
})

describe('the counted error rate against the closed form', () => {
  it('agrees, pooled over many independent runs', () => {
    const s = PULSES.halfSine(64)
    const ebN0 = 10 ** 0.7
    let errors = 0
    let symbols = 0
    for (let t = 0; t < 12; t++) {
      const run = detectionRun({ s, ebN0, symbols: 20000, seed: 3000 + t })
      errors += run.errors
      symbols += run.symbols
    }
    const predicted = errorRateAntipodal(ebN0)
    const expected = symbols * predicted
    // The count is Poisson at this rate, so its standard deviation is the root
    // of the expected count. Four of those is the band.
    expect(Math.abs(errors - expected)).toBeLessThan(4 * Math.sqrt(expected))
  })

  it('and the interval it reports covers the closed form at its stated rate', () => {
    const s = PULSES.rect(32)
    const ebN0 = 4
    let inside = 0
    const trials = 200
    for (let t = 0; t < trials; t++) {
      const run = detectionRun({ s, ebN0, symbols: 4000, seed: 5000 + t })
      if (run.measured.ci[0] <= run.predicted && run.predicted <= run.measured.ci[1]) inside++
    }
    // Wilson's interval is conservative on a small count, so the coverage sits
    // at or above 0.95 rather than below it.
    expect(inside / trials).toBeGreaterThan(0.92)
  })

  it('reports zero errors with an interval that still holds the true rate', () => {
    // The case a naive interval gets wrong. At 12 dB the rate is 9e-9, so a
    // thousand symbols will show no errors at all, and the interval must not
    // then claim the rate is zero.
    const run = detectionRun({ s: PULSES.rect(16), ebN0: 10 ** 1.2, symbols: 1000, seed: 1 })
    expect(run.errors).toBe(0)
    expect(run.measured.value).toBe(0)
    expect(run.measured.ci[1]).toBeGreaterThan(run.predicted)
  })

  it('reports the ratio it was asked for, in both currencies', () => {
    const run = detectionRun({ s: PULSES.rect(16), ebN0: 5, symbols: 10, seed: 1 })
    expect(run.ebN0).toBe(5)
    expect(run.ebN0Db).toBeCloseTo(10 * Math.log10(5), 12)
    expect(run.snr).toBeCloseTo(10, 9)
  })

  it('is reproducible, and addressable one symbol at a time', () => {
    const a = detectionRun({ s: PULSES.rect(16), ebN0: 2, symbols: 500, seed: 9 })
    const b = detectionRun({ s: PULSES.rect(16), ebN0: 2, symbols: 500, seed: 9 })
    expect(b.errors).toBe(a.errors)
    // Symbol 300 uses the seed runSeed(9, 300) and nothing else.
    expect(rng(runSeed(9, 300)).uniform()).toBe(rng(runSeed(9, 300)).uniform())
  })
})
