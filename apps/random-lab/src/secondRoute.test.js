import { describe, it, expect } from 'vitest'
import { qFunction, chi2Inv, zFor, PULSES, filterSnr, matchedSnr } from '@ee-labs/random'
import {
  gaussianTail,
  insideSigma,
  normalQuantile,
  chi2Upper,
  chi2Quantile,
  psdIntervalFactors,
  mismatchFraction,
} from './secondRoute.js'

// The second route, measured against the first.
//
// This file is where the table values are allowed to be typed in, because here
// they are the subject rather than a shortcut. Everywhere else in this lab a
// quoted number is a function of the knobs, and this file is what makes that
// possible without weakening the check.

describe('the Gaussian tail by quadrature', () => {
  // Abramowitz and Stegun, table 26.1. Q(1), Q(2), Q(3).
  const TABLE = [
    [1, 0.15865525393145705],
    [2, 0.022750131948179195],
    [3, 0.0013498980316300933],
  ]

  for (const [x, want] of TABLE) {
    it(`Q(${x}) is ${want.toPrecision(6)}`, () => {
      // Ten digits is the quadrature's accuracy in the far tail, where the
      // integrand is smallest and Simpson's error is largest as a fraction of
      // it. Every claim that quotes this route allows far more room than that.
      expect(gaussianTail(x) / want).toBeCloseTo(1, 10)
    })
  }

  it('agrees with the engine over the whole range the lab uses', () => {
    for (let x = -6; x <= 6; x += 0.125) {
      const a = gaussianTail(x)
      const b = qFunction(x)
      // The engine's rational approximation is the looser of the two, and this
      // is the accuracy it claims. A disagreement past this is a defect in one
      // file or the other, and the experiments that quote either would move.
      expect(Math.abs(a / b - 1), `x = ${x}`).toBeLessThan(1e-9)
    }
  })

  it('is symmetric, and the two tails plus the middle are the whole mass', () => {
    for (let x = 0; x <= 5; x += 0.25) {
      expect(gaussianTail(x) + gaussianTail(-x)).toBeCloseTo(1, 14)
      expect(insideSigma(x) + 2 * gaussianTail(x)).toBeCloseTo(1, 14)
    }
  })

  it('gives the three masses the curriculum quotes', () => {
    expect(insideSigma(1)).toBeCloseTo(0.6826894921, 10)
    expect(insideSigma(2)).toBeCloseTo(0.9544997361, 10)
    expect(insideSigma(3)).toBeCloseTo(0.9973002039, 10)
  })

  it('inverts to the z the engine uses at every level the app offers', () => {
    for (const level of [0.5, 0.68, 0.9, 0.95, 0.99, 0.999]) {
      const z = normalQuantile(1 - (1 - level) / 2)
      expect(z / zFor(level), `level ${level}`).toBeCloseTo(1, 9)
    }
  })
})

describe('the chi-square by its finite sum', () => {
  it('refuses an odd number of degrees of freedom rather than approximating', () => {
    expect(() => chi2Upper(1, 3)).toThrow(/even/)
    expect(() => chi2Upper(1, 0)).toThrow(/even/)
  })

  it('is a survival function, one at zero and falling to nothing', () => {
    for (const dof of [2, 10, 200]) {
      expect(chi2Upper(0, dof), `dof ${dof}`).toBeCloseTo(1, 15)
      // Never rising, to the last bit the arithmetic has. Well into the left
      // tail the sum is a very large number multiplied by a very small
      // exponential, and the product lands either side of one by an ulp. That
      // region is nowhere near where an interval is read, and the tolerance
      // here names the noise rather than hiding it.
      let last = 1
      for (let x = 1; x < 4 * dof; x += dof / 8) {
        const v = chi2Upper(x, dof)
        expect(v, `dof ${dof} at ${x}`).toBeLessThanOrEqual(last + 4 * Number.EPSILON)
        last = v
      }
      // The distribution leans left, so the mean has more than a third of the
      // mass above it and never half. Twenty times the mean has nothing left,
      // at every dof and not only the large ones.
      expect(chi2Upper(dof, dof), `dof ${dof}`).toBeGreaterThan(0.36)
      expect(chi2Upper(dof, dof), `dof ${dof}`).toBeLessThan(0.5)
      expect(chi2Upper(2 * dof, dof), `dof ${dof}`).toBeLessThan(0.2)
      expect(chi2Upper(20 * dof, dof), `dof ${dof}`).toBeLessThan(1e-6)
    }
  })

  it('agrees with the engine at every even dof and level the lab reaches', () => {
    for (const dof of [2, 8, 50, 200, 800]) {
      for (const p of [0.025, 0.05, 0.5, 0.95, 0.975]) {
        expect(chi2Quantile(p, dof) / chi2Inv(p, dof), `dof ${dof}, p ${p}`).toBeCloseTo(1, 8)
      }
    }
  })

  it('gives the multipliers E3 quotes, at two hundred degrees of freedom', () => {
    const { lo, hi } = psdIntervalFactors(200, 0.95)
    expect(lo).toBeCloseTo(0.8296762, 7)
    expect(hi).toBeCloseTo(1.2290449, 7)
  })

  it('narrows both multipliers towards one as the averages rise', () => {
    let lastLo = 0
    let lastHi = Infinity
    for (const m of [1, 4, 25, 100, 400]) {
      const { lo, hi } = psdIntervalFactors(2 * m, 0.95)
      expect(lo, `M ${m}`).toBeGreaterThan(lastLo)
      expect(hi, `M ${m}`).toBeLessThan(lastHi)
      expect(lo).toBeLessThan(1)
      expect(hi).toBeGreaterThan(1)
      lastLo = lo
      lastHi = hi
    }
  })
})

describe('the mismatch fraction as a correlation', () => {
  it('is one when the filter is the pulse, at every shape and length', () => {
    for (const name of ['rect', 'halfSine', 'ramp']) {
      for (const len of [8, 64, 257]) {
        const s = PULSES[name](len)
        expect(mismatchFraction(s, s), `${name} ${len}`).toBeCloseTo(1, 12)
      }
    }
  })

  it('is below one for any other filter, as Cauchy-Schwarz requires', () => {
    for (const len of [16, 64]) {
      const s = PULSES.halfSine(len)
      const h = PULSES.rect(len)
      expect(mismatchFraction(s, h)).toBeLessThan(1)
      expect(mismatchFraction(s, h)).toBeGreaterThan(0)
    }
  })

  it('is the fraction the engine reaches through the two ratios', () => {
    for (const name of ['rect', 'halfSine', 'ramp']) {
      for (const len of [16, 64, 128]) {
        for (const sigma2 of [1e-3, 0.01, 1]) {
          const s = PULSES[name](len)
          const h = PULSES.rect(len)
          const engine =
            filterSnr(h, s, sigma2) / matchedSnr({ s, sigma2, sampleRate: 1e6 }).snr
          expect(mismatchFraction(s, h), `${name} ${len} ${sigma2}`).toBeCloseTo(engine, 12)
        }
      }
    }
  })
})
