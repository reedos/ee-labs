import { describe, it, expect } from 'vitest'
import {
  erf, erfc, qFunction, qInv, phi, Phi, zFor, gammaP, gammaQ, chi2Inv,
  distribution, DISTRIBUTION_NAMES,
} from './dist.js'

// Closed forms, checked against values a reader can look up, and against each
// other's identities. Every one of these is exact in the CORE_SCOPE sense and
// is printed with no interval, so the accuracy has to be real rather than
// plausible.

describe('the error function', () => {
  // Abramowitz and Stegun, table 7.1, to ten places.
  const KNOWN = [
    [0.5, 0.5204998778],
    [1, 0.8427007929],
    [1.5, 0.9661051465],
    [2, 0.9953222650],
    [2.5, 0.9995930480],
  ]
  for (const [x, want] of KNOWN) {
    it(`erf(${x}) is ${want}`, () => {
      expect(erf(x)).toBeCloseTo(want, 9)
    })
  }

  it('is odd', () => {
    for (const x of [0.1, 0.7, 1.3, 2.9, 4.4]) {
      expect(erf(-x)).toBeCloseTo(-erf(x), 15)
    }
  })

  it('erfc is 1 - erf where that subtraction is safe', () => {
    for (const x of [0, 0.25, 0.5, 1]) expect(erfc(x)).toBeCloseTo(1 - erf(x), 14)
  })

  it('keeps relative accuracy in the tail, where 1 - erf would keep none', () => {
    // erfc(5) = 1.5374597944e-12. Forming it as 1 - erf(5) in double precision
    // leaves nothing at all: erf(5) rounds to exactly 1 in a double, so the
    // subtraction returns zero. These must carry eleven significant figures.
    expect(erfc(5) / 1.5374597944280327e-12).toBeCloseTo(1, 10)
    expect(erfc(8) / 1.1224297172982905e-29).toBeCloseTo(1, 9)
    // Independently, against the asymptotic series, which shares no code path.
    const asym = (x) => {
      const u = 1 / (2 * x * x)
      return (Math.exp(-x * x) / (x * Math.sqrt(Math.PI))) * (1 - u + 3 * u * u - 15 * u ** 3)
    }
    for (const x of [5, 6, 8]) expect(erfc(x) / asym(x)).toBeCloseTo(1, 4)
  })
})

describe('the Q function', () => {
  it('is one half at zero', () => {
    expect(qFunction(0)).toBe(0.5)
  })

  // The values every communications text prints.
  const KNOWN = [
    [1, 0.15865525393145705],
    [2, 0.022750131948179195],
    [3, 0.0013498980316300933],
    [4, 3.167124183311998e-5],
    [5, 2.866515718791939e-7],
    [6, 9.865876450376946e-10],
    [7, 1.279812543885835e-12],
  ]
  for (const [x, want] of KNOWN) {
    it(`Q(${x}) is ${want.toExponential(4)}`, () => {
      expect(qFunction(x) / want).toBeCloseTo(1, 9)
    })
  }

  it('and Phi together account for all the mass', () => {
    for (const x of [-3, -1, 0, 1, 2.5, 4]) {
      expect(qFunction(x) + Phi(x)).toBeCloseTo(1, 15)
    }
  })

  it('has phi as its derivative', () => {
    const h = 1e-5
    for (const x of [-2, -0.5, 0.5, 1.5, 3]) {
      const d = (qFunction(x + h) - qFunction(x - h)) / (2 * h)
      expect(d / -phi(x)).toBeCloseTo(1, 8)
    }
  })

  it('inverts to machine precision, including far into the tail', () => {
    for (const p of [0.5, 0.25, 0.025, 1e-3, 1e-6, 1e-9, 1e-12, 1 - 1e-6]) {
      expect(qFunction(qInv(p)) / p).toBeCloseTo(1, 12)
    }
  })

  it('gives the coverage factors the suite quotes', () => {
    expect(zFor(0.95)).toBeCloseTo(1.959963984540054, 12)
    expect(zFor(0.99)).toBeCloseTo(2.5758293035489004, 12)
    expect(zFor(0.6827)).toBeCloseTo(1.0000217133229983, 12)
  })

  it('refuses a probability outside (0, 1) rather than returning an infinity', () => {
    expect(() => qInv(0)).toThrow(/in \(0, 1\)/)
    expect(() => qInv(1)).toThrow(/in \(0, 1\)/)
    expect(() => zFor(1)).toThrow(/in \(0, 1\)/)
  })
})

describe('the incomplete gamma and the chi-square quantile', () => {
  it('P and Q account for all the mass', () => {
    for (const a of [0.5, 1, 3, 10, 100]) {
      for (const x of [0.1, 1, 5, 20]) {
        expect(gammaP(a, x) + gammaQ(a, x)).toBeCloseTo(1, 14)
      }
    }
  })

  it('gives the chi-square points a table prints', () => {
    // dof 1, median. dof 10 and dof 20 at the 0.95 point.
    expect(chi2Inv(0.5, 1)).toBeCloseTo(0.4549364231, 9)
    expect(chi2Inv(0.95, 10)).toBeCloseTo(18.3070380533, 8)
    expect(chi2Inv(0.05, 10)).toBeCloseTo(3.9402991361, 8)
    expect(chi2Inv(0.975, 20)).toBeCloseTo(34.1696069028, 8)
    expect(chi2Inv(0.025, 20)).toBeCloseTo(9.5907773923, 8)
  })

  it('round-trips through the distribution function', () => {
    for (const dof of [1, 2, 4, 15, 64, 256, 1000]) {
      for (const p of [0.01, 0.1, 0.5, 0.9, 0.99]) {
        const x = chi2Inv(p, dof)
        expect(gammaP(dof / 2, x / 2)).toBeCloseTo(p, 10)
      }
    }
  })

  it('has mean dof, which the median approaches from below', () => {
    for (const dof of [4, 20, 100]) {
      expect(chi2Inv(0.5, dof)).toBeLessThan(dof)
      expect(chi2Inv(0.5, dof)).toBeGreaterThan(dof - 1)
    }
  })
})

describe('the distribution registry', () => {
  it('names every distribution the app offers', () => {
    for (const n of DISTRIBUTION_NAMES) expect(() => distribution(n)).not.toThrow()
  })

  it('refuses a name it does not have', () => {
    expect(() => distribution('cauchy')).toThrow(/unknown distribution/)
  })

  const CASES = [
    ['uniform', { a: -1, b: 3 }, 1, 16 / 12],
    ['gaussian', { mu: 2, sigma: 3 }, 2, 9],
    ['exponential', { lambda: 4 }, 0.25, 1 / 16],
    ['bernoulli', { p: 0.3 }, 0.3, 0.21],
    ['rayleigh', { sigma: 2 }, 2 * Math.sqrt(Math.PI / 2), ((4 - Math.PI) / 2) * 4],
  ]

  for (const [name, params, mean, variance] of CASES) {
    it(`${name} states its mean and variance in closed form`, () => {
      const d = distribution(name, params)
      expect(d.mean).toBeCloseTo(mean, 12)
      expect(d.variance).toBeCloseTo(variance, 12)
      expect(d.sd).toBeCloseTo(Math.sqrt(variance), 12)
    })
  }

  for (const [name, params, mean, variance] of CASES) {
    if (name === 'bernoulli') continue
    it(`${name}'s density integrates to its own mean and variance`, () => {
      // The density and the moments are stated separately in the registry, so
      // integrating one against the other is a real check rather than a
      // restatement. Simpson's rule over the stated support, with the upper
      // limit pulled back by a billionth of the span. A uniform density is zero
      // AT its upper edge and non-zero just below it, so a grid ending exactly
      // on that edge drops half an endpoint panel and reads 0.99997. Every
      // density here is smooth on the interval this leaves.
      const d = distribution(name, params)
      const [lo, b0] = d.support(1 - 1e-10)
      const hi = b0 - (b0 - lo) * 1e-9
      const n = 24000
      const h = (hi - lo) / n
      let m0 = 0
      let m1 = 0
      let m2 = 0
      for (let i = 0; i <= n; i++) {
        const x = lo + i * h
        const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2
        const f = d.pdf(x)
        m0 += w * f
        m1 += w * x * f
        m2 += w * x * x * f
      }
      const g = h / 3
      // The mass the interval holds, from the distribution function, which is a
      // separate formula from the density being integrated.
      expect(m0 * g).toBeCloseTo(d.cdf(hi) - d.cdf(lo), 5)
      expect(m1 * g).toBeCloseTo(mean, 4)
      expect(m2 * g - mean * mean).toBeCloseTo(variance, 4)
    })
  }

  for (const [name, params] of CASES) {
    it(`${name}'s distribution function is the integral of its density`, () => {
      const d = distribution(name, params)
      if (name === 'bernoulli') {
        expect(d.cdf(-0.5)).toBe(0)
        expect(d.cdf(0.5)).toBeCloseTo(1 - params.p, 12)
        expect(d.cdf(1.5)).toBe(1)
        return
      }
      const [lo, b0] = d.support(1 - 1e-10)
      const at = lo + 0.37 * (b0 - lo)
      const n = 8000
      const h = (at - lo) / n
      let acc = 0
      for (let i = 0; i <= n; i++) {
        const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2
        acc += w * d.pdf(lo + i * h)
      }
      expect((acc * h) / 3).toBeCloseTo(d.cdf(at) - d.cdf(lo), 5)
    })
  }
})
