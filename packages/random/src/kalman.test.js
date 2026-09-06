import { describe, it, expect } from 'vitest'
import { rng } from './prng.js'
import { kalmanSteadyState, kalmanRun, stationaryVariance } from './kalman.js'
import { wienerScalar } from './wiener.js'

describe('the steady-state gain', () => {
  it('is the fixed point of the recursion, which the recursion reaches', () => {
    for (const a of [0.5, 0.9, 0.99, 1]) {
      for (const q of [0.001, 0.1, 1]) {
        for (const r of [0.01, 1, 100]) {
          const ss = kalmanSteadyState({ a, q, r })
          // Run the recursion from a poor start and check it lands there.
          let p = 1000
          for (let i = 0; i < 5000; i++) {
            const prior = a * a * p + q
            p = (1 - prior / (prior + r)) * prior
          }
          expect(p / ss.posteriorVariance).toBeCloseTo(1, 8)
          const prior = a * a * p + q
          expect(prior / ss.priorVariance).toBeCloseTo(1, 8)
          expect(ss.gain).toBeCloseTo(ss.priorVariance / (ss.priorVariance + r), 12)
        }
      }
    }
  })

  it('trusts the measurement more when the process is noisier', () => {
    const quiet = kalmanSteadyState({ a: 1, q: 0.001, r: 1 })
    const busy = kalmanSteadyState({ a: 1, q: 10, r: 1 })
    expect(busy.gain).toBeGreaterThan(quiet.gain)
    expect(quiet.gain).toBeLessThan(0.05)
    expect(busy.gain).toBeGreaterThan(0.9)
  })

  it('and it trusts it less when the measurement is noisier', () => {
    const clean = kalmanSteadyState({ a: 1, q: 1, r: 0.01 })
    const dirty = kalmanSteadyState({ a: 1, q: 1, r: 100 })
    expect(clean.gain).toBeGreaterThan(dirty.gain)
  })

  it('is one when the measurement is perfect, and zero when the process does not move', () => {
    expect(kalmanSteadyState({ a: 1, q: 1, r: 1e-12 }).gain).toBeGreaterThan(0.999999)
    expect(kalmanSteadyState({ a: 0.9, q: 0, r: 1 }).gain).toBe(0)
  })

  it('refuses a measurement variance of zero, which has no interval', () => {
    expect(() => kalmanSteadyState({ a: 1, q: 1, r: 0 })).toThrow(/need q >= 0 and r > 0/)
    expect(() => kalmanSteadyState({ a: 1, q: -1, r: 1 })).toThrow(/need q >= 0 and r > 0/)
  })
})

describe('the filter over a record', () => {
  const record = ({ a, q, r, n, seed }) => {
    const g = rng(seed)
    const z = new Float64Array(n)
    const truth = new Float64Array(n)
    let x = 0
    for (let i = 0; i < n; i++) {
      x = a * x + g.normal(0, Math.sqrt(q))
      truth[i] = x
      z[i] = x + g.normal(0, Math.sqrt(r))
    }
    return { z, truth }
  }

  it('leaves the error the steady state says it will', () => {
    const a = 0.9
    const q = 0.1
    const r = 1
    const n = 40000
    const { z, truth } = record({ a, q, r, n, seed: 31 })
    const k = kalmanRun({ z, q, r, a, x0: 0, p0: 10 })
    let mse = 0
    for (let i = 500; i < n; i++) mse += (k.x[i] - truth[i]) ** 2
    mse /= n - 500
    // The mean-square error is itself an estimate over about n independent
    // samples, so its relative standard error is sqrt(2/n).
    const se = Math.sqrt(2 / (n - 500))
    expect(Math.abs(mse / k.steady.posteriorVariance - 1)).toBeLessThan(5 * se)
  })

  it('beats the raw measurement, and beats it more when the measurement is noisier', () => {
    for (const r of [0.1, 1, 10]) {
      const k = kalmanSteadyState({ a: 0.9, q: 0.1, r })
      expect(k.posteriorVariance).toBeLessThan(r)
    }
    const easy = kalmanSteadyState({ a: 0.9, q: 0.1, r: 0.1 })
    const hard = kalmanSteadyState({ a: 0.9, q: 0.1, r: 10 })
    expect(0.1 / easy.posteriorVariance).toBeLessThan(10 / hard.posteriorVariance)
  })

  it('forgets a wrong start, and says when it has', () => {
    const { z } = record({ a: 0.9, q: 0.1, r: 1, n: 200, seed: 32 })
    const k = kalmanRun({ z, q: 0.1, r: 1, a: 0.9, x0: 500, p0: 1e6 })
    expect(k.settledAt).toBeGreaterThan(0)
    expect(k.settledAt).toBeLessThan(30)
    // The gain reaches the steady-state value and stays there.
    expect(k.gain[199]).toBeCloseTo(k.steady.gain, 9)
    // And a start 500 away from the truth is gone within the settling.
    expect(Math.abs(k.x[100])).toBeLessThan(10)
  })

  it('starts at the steady state when it is not told otherwise, so the gain never moves', () => {
    const { z } = record({ a: 0.8, q: 0.2, r: 0.5, n: 50, seed: 33 })
    const k = kalmanRun({ z, q: 0.2, r: 0.5, a: 0.8 })
    for (const g of k.gain) expect(g).toBeCloseTo(k.steady.gain, 12)
    expect(k.settledAt).toBe(0)
  })

  it('has an innovation whose variance is the prior plus the measurement noise', () => {
    const a = 0.9
    const q = 0.1
    const r = 1
    const n = 40000
    const { z } = record({ a, q, r, n, seed: 34 })
    const k = kalmanRun({ z, q, r, a })
    let m = 0
    for (let i = 100; i < n; i++) m += k.innovation[i]
    m /= n - 100
    let v = 0
    for (let i = 100; i < n; i++) v += (k.innovation[i] - m) ** 2
    v /= n - 101
    // The innovation is white with variance P- + r. That is the check a real
    // filter is tuned by, and it is the one this lab shows.
    const predicted = k.steady.priorVariance + r
    expect(Math.abs(v / predicted - 1)).toBeLessThan(5 * Math.sqrt(2 / (n - 100)))
  })
})

describe('the Kalman filter against the one-shot Wiener estimate', () => {
  it('does better, because it has every earlier measurement', () => {
    const a = 0.9
    const q = 0.1
    const r = 1
    const varX = stationaryVariance({ a, q })
    expect(varX).toBeCloseTo(q / (1 - a * a), 12)
    const oneShot = wienerScalar({ signalVariance: varX, noiseVariance: r })
    const recursive = kalmanSteadyState({ a, q, r })
    expect(recursive.posteriorVariance).toBeLessThan(oneShot.mmse)
    // The memory is worth about 38 % of the error here, and the gap is the
    // number the experiment prints.
    expect(recursive.posteriorVariance / oneShot.mmse).toBeCloseTo(0.6244, 3)
  })

  it('and the gap closes as the process becomes white, which has nothing to remember', () => {
    // With a = 0 the process is white, so there is no earlier information and
    // the recursive filter can do no better than the one-shot estimate.
    const q = 1
    const r = 2
    const recursive = kalmanSteadyState({ a: 0, q, r })
    const oneShot = wienerScalar({ signalVariance: stationaryVariance({ a: 0, q }), noiseVariance: r })
    expect(recursive.posteriorVariance).toBeCloseTo(oneShot.mmse, 12)
  })

  it('declines to state a variance for a random walk, which has none', () => {
    expect(() => stationaryVariance({ a: 1, q: 0.1 })).toThrow(/non-stationary/)
    expect(() => stationaryVariance({ a: 1.2, q: 0.1 })).toThrow(/non-stationary/)
    // The Kalman filter still works there, which is the point of the comparison.
    expect(kalmanSteadyState({ a: 1, q: 0.1, r: 1 }).gain).toBeGreaterThan(0)
  })
})
