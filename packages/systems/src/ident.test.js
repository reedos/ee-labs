import { describe, it, expect } from 'vitest'
import { stepResponse } from './tf.js'
import {
  IdentError,
  ZETA_MAX,
  firstOrderStep,
  fitFirstOrder,
  fitSecondOrder,
  fitStep,
  secondOrderStep,
} from './ident.js'

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
/** Box-Muller on the seeded generator, so the noise is the same every run. */
const gauss = (rand) => {
  const u = Math.max(rand(), 1e-12)
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const firstOrder = (K, tau, duration = 6, points = 400) =>
  stepResponse({ b: [K], a: [tau, 1] }, { duration, points })
const secondOrder = (K, wn, zeta, duration = 5, points = 500) =>
  stepResponse({ b: [K * wn * wn], a: [1, 2 * zeta * wn, wn * wn] }, { duration, points })

describe('the model shapes are the closed forms', () => {
  it('the first-order step is 63.2 per cent of the way there after one time constant', () => {
    expect(firstOrderStep(1, 1)).toBeCloseTo(1 - Math.exp(-1), 15)
    expect(firstOrderStep(0, 1)).toBe(0)
  })

  it('the second-order step matches the simulated response in all three damping cases', () => {
    for (const [wn, zeta] of [[3, 0.35], [3, 1], [3, 2.5]]) {
      const r = secondOrder(1, wn, zeta, 6, 601)
      for (let i = 0; i < r.t.length; i += 50) {
        expect(secondOrderStep(r.t[i], wn, zeta), `wn = ${wn}, zeta = ${zeta}, i = ${i}`).toBeCloseTo(r.y[i], 6)
      }
    }
  })

  it('the critically damped form is the limit the other two approach', () => {
    // The three branches are one function. Approaching from either side, the
    // gap closes in proportion to the distance in zeta, which is what
    // continuity across the branch means.
    const t = 1.3
    const critical = secondOrderStep(t, 2, 1)
    let prevBelow = Infinity
    let prevAbove = Infinity
    for (const e of [1e-6, 1e-7, 1e-8]) {
      const below = Math.abs(secondOrderStep(t, 2, 1 - e) - critical)
      const above = Math.abs(secondOrderStep(t, 2, 1 + e) - critical)
      expect(below, `below by ${e}`).toBeLessThan(e)
      expect(above, `above by ${e}`).toBeLessThan(e)
      expect(below).toBeLessThan(prevBelow / 5)
      expect(above).toBeLessThan(prevAbove / 5)
      prevBelow = below
      prevAbove = above
    }
  })
})

describe('a fit on clean data recovers the system', () => {
  it('the first-order fit returns the gain and time constant it was given', () => {
    for (const [K, tau] of [[2.5, 0.8], [0.4, 12], [100, 0.002]]) {
      const r = firstOrder(K, tau, 6 * tau)
      const fit = fitFirstOrder(r.t, r.y)
      expect(fit.K / K, `K = ${K}`).toBeCloseTo(1, 8)
      expect(fit.tau / tau, `tau = ${tau}`).toBeCloseTo(1, 6)
      expect(fit.relResidual).toBeLessThan(1e-8)
      expect(fit.poles[0][0]).toBeCloseTo(-1 / tau, 6)
    }
  })

  it('the second-order fit returns the gain, natural frequency and damping', () => {
    for (const [K, wn, zeta] of [[1.4, 3, 0.35], [0.8, 0.6, 0.9], [3, 40, 0.12]]) {
      const r = secondOrder(K, wn, zeta, 30 / (zeta * wn), 800)
      const fit = fitSecondOrder(r.t, r.y)
      expect(fit.K / K, `K = ${K}`).toBeCloseTo(1, 6)
      expect(fit.wn / wn, `wn = ${wn}`).toBeCloseTo(1, 5)
      expect(fit.zeta / zeta, `zeta = ${zeta}`).toBeCloseTo(1, 5)
      expect(fit.relResidual).toBeLessThan(1e-6)
    }
  })

  it('the fitted transfer function reproduces the data it was fitted to', () => {
    const r = secondOrder(1.4, 3, 0.35)
    const fit = fitSecondOrder(r.t, r.y)
    const again = stepResponse(fit.tf, { duration: 5, points: 500 })
    for (let i = 0; i < r.y.length; i += 25) expect(again.y[i]).toBeCloseTo(r.y[i], 6)
  })
})

describe('the residual is the guard, and it is never hidden', () => {
  it('every fit carries its residual, in the data\'s units and relative to the gain', () => {
    const r = firstOrder(2.5, 0.8)
    for (const fit of [fitFirstOrder(r.t, r.y), fitSecondOrder(r.t, r.y)]) {
      expect(Object.prototype.hasOwnProperty.call(fit, 'residual')).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(fit, 'relResidual')).toBe(true)
      expect(Number.isFinite(fit.residual)).toBe(true)
      expect(fit.relResidual).toBeCloseTo(fit.residual / Math.abs(fit.K), 12)
      // And the model it drew, so a pane can put the fit over the data.
      expect(fit.model.length).toBe(r.y.length)
    }
  })

  it('a first-order fit to second-order data leaves a residual a reader can see', () => {
    const r = secondOrder(1.4, 3, 0.35)
    const fit = fitFirstOrder(r.t, r.y)
    // Thirteen per cent of the step: the model has no way to make an
    // overshoot, so it splits the difference and the residual says so.
    expect(fit.relResidual).toBeGreaterThan(0.1)
    expect(fit.relResidual).toBeLessThan(0.2)
    // The second order, on the same data, is four orders better.
    const second = fitSecondOrder(r.t, r.y)
    expect(second.relResidual).toBeLessThan(fit.relResidual / 1e4)
  })

  it('the residual on noisy data IS the noise, which is what a good fit looks like', () => {
    const r = firstOrder(2.5, 0.8)
    for (const sigma of [0.01, 0.02, 0.05]) {
      const rand = rng(1234)
      const noisy = Float64Array.from(r.y, (v) => v + sigma * 2.5 * gauss(rand))
      const fit = fitFirstOrder(r.t, noisy)
      // A fit that has taken out everything the model can explain is left with
      // the noise and nothing else, so the residual lands on sigma.
      expect(fit.relResidual / sigma, `sigma = ${sigma}`).toBeGreaterThan(0.9)
      expect(fit.relResidual / sigma, `sigma = ${sigma}`).toBeLessThan(1.1)
    }
  })

  it('the estimate is unbiased under noise, and its spread shrinks the way an average does', () => {
    const r = firstOrder(2.5, 0.8)
    const spreadAt = (sigma) => {
      const taus = []
      for (let seed = 1; seed <= 40; seed++) {
        const rand = rng(seed * 7919)
        const noisy = Float64Array.from(r.y, (v) => v + sigma * 2.5 * gauss(rand))
        taus.push(fitFirstOrder(r.t, noisy).tau)
      }
      const mean = taus.reduce((a, b) => a + b, 0) / taus.length
      const sd = Math.sqrt(taus.reduce((a, b) => a + (b - mean) ** 2, 0) / taus.length)
      return { mean, sd }
    }
    const at2 = spreadAt(0.02)
    // Unbiased: the mean of forty fits sits on the true time constant.
    expect(at2.mean).toBeCloseTo(0.8, 2)
    // And the spread halves when the noise halves, which is what makes the
    // residual a usable measure of how much to trust the number.
    const at1 = spreadAt(0.01)
    expect(at1.sd / at2.sd).toBeGreaterThan(0.35)
    expect(at1.sd / at2.sd).toBeLessThan(0.65)
  })
})

describe('which order the data supports', () => {
  it('on noisy first-order data the second order buys nothing', () => {
    const r = firstOrder(2.5, 0.8)
    for (const sigma of [0.01, 0.02, 0.05]) {
      const rand = rng(1234)
      const noisy = Float64Array.from(r.y, (v) => v + sigma * 2.5 * gauss(rand))
      const both = fitStep(r.t, noisy)
      // The extra pole takes less than a per cent off the residual, because
      // there is nothing left in the data for it to explain.
      expect(both.improvement, `sigma = ${sigma}`).toBeGreaterThan(0.99)
      expect(both.improvement, `sigma = ${sigma}`).toBeLessThan(1.001)
    }
  })

  it('on second-order data it buys everything', () => {
    const r = secondOrder(1.4, 3, 0.35)
    const both = fitStep(r.t, r.y)
    expect(both.improvement).toBeLessThan(1e-5)
    expect(both.first.order).toBe(1)
    expect(both.second.order).toBe(2)
  })

  it('the second-order fit to first-order data collapses onto the first-order one', () => {
    // One pole lands on the true one and the other runs out to where it
    // carries nothing. The damping is capped so the numbers stay readable.
    const r = firstOrder(2.5, 0.8)
    const fit = fitSecondOrder(r.t, r.y)
    const poles = fit.poles.map(([re]) => re).sort((a, b) => b - a)
    expect(poles[0]).toBeCloseTo(-1 / 0.8, 1)
    expect(Math.abs(poles[1])).toBeGreaterThan(100 * Math.abs(poles[0]))
    expect(fit.zeta).toBeLessThanOrEqual(ZETA_MAX)
  })
})

describe('data that cannot be fitted is declined', () => {
  it('mismatched arrays, too few samples and a flat trace each have their own reason', () => {
    expect(() => fitFirstOrder([0, 1, 2], [0, 1])).toThrow(IdentError)
    expect(() => fitFirstOrder([0, 1, 2], [0, 1])).toThrow(/same length/)
    expect(() => fitFirstOrder([0, 1, 2], [0, 1, 2])).toThrow(/at least eight samples/)
    const t = Array.from({ length: 20 }, (_, i) => i * 0.1)
    expect(() => fitFirstOrder(t, t.map(() => 0))).toThrow(/no step in it to fit/)
  })
})
