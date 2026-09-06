import { describe, it, expect } from 'vitest'
import {
  ADAPTIVE_ALGORITHMS,
  autocorr,
  crosscorr,
  lmsStepBound,
  makeAdaptive,
  misadjustment,
  runAdaptive,
  tailPower,
  weightError,
  wiener,
} from './adaptive.js'
import { convolveFir } from './multirate.js'
import { hash01 } from './signals.js'
import { firResponse } from './fir.js'

// The adaptive invariants.
//
// The claim that has to be measured rather than asserted: LMS converges to the
// Wiener solution, and the error it settles at exceeds the Wiener minimum by the
// misadjustment. Both halves are checked, and the second one needs measurement
// noise in the wanted signal, because with none the Wiener minimum is zero and
// there is nothing for the excess to be a fraction of.

const white = (n, seed) => Float64Array.from({ length: n }, (_, i) => 2 * hash01(i, seed) - 1)
const power = (x) => x.reduce((a, v) => a + v * v, 0) / x.length
const PLANT = Float64Array.from([0.4, -0.3, 0.25, 0.1, -0.05, 0.02, 0.01, 0])

describe('the Wiener solution is a linear system with one answer', () => {
  it('recovers a known plant exactly from a white input', () => {
    const x = white(40000, 3)
    const d = convolveFir(x, PLANT)
    const w = wiener(x, d, PLANT.length)
    expect(w.singular).toBe(false)
    expect(weightError(w.w, PLANT)).toBeLessThan(1e-3)
  })

  it('its autocorrelation matrix is the input power on the diagonal', () => {
    const x = white(20000, 4)
    const r = autocorr(x, 8)
    expect(r[0]).toBeCloseTo(power(x), 12)
    // White noise decorrelates, so every other lag is small next to lag zero.
    for (let k = 1; k < 8; k++) expect(Math.abs(r[k])).toBeLessThan(r[0] / 20)
  })

  it('the cross-correlation with a filtered copy is the plant times the power', () => {
    const x = white(40000, 5)
    const d = convolveFir(x, PLANT)
    const p = crosscorr(x, d, PLANT.length)
    const px = power(x)
    for (let k = 0; k < PLANT.length; k++) {
      // A finite record estimates it, and forty thousand samples leave a
      // couple of per cent of scatter.
      expect(p[k] / px, `k=${k}`).toBeCloseTo(PLANT[k], 1)
    }
  })
})

describe('LMS converges to the Wiener solution', () => {
  const x = white(60000, 7)
  const px = power(x)

  it('lands on the plant, from any step size inside the bound', () => {
    const bound = lmsStepBound({ taps: PLANT.length, inputPower: px })
    for (const mu of [0.01, 0.05, 0.15]) {
      expect(mu, `mu=${mu}`).toBeLessThan(bound.meanSquare)
      const r = runAdaptive({ x, plant: PLANT, algorithm: 'lms', taps: PLANT.length, mu, stride: 1000 })
      expect(weightError(r.w, PLANT), `mu=${mu}`).toBeLessThan(1e-6)
      // ...and agrees with the Wiener solution of the same data.
      const w = wiener(x, r.d, PLANT.length)
      expect(weightError(r.w, w.w), `mu=${mu}`).toBeLessThan(1e-3)
    }
  })

  it('diverges above the bound, which is what makes it a bound', () => {
    const bound = lmsStepBound({ taps: PLANT.length, inputPower: px })
    const mu = 4 * bound.mean
    const r = runAdaptive({ x: x.slice(0, 4000), plant: PLANT, algorithm: 'lms', taps: PLANT.length, mu, stride: 1000 })
    expect(Number.isFinite(r.w[0]) && Math.abs(r.w[0]) < 1e3).toBe(false)
  })

  it('settles above the Wiener floor by the misadjustment, and no further', () => {
    // A wanted signal the filter cannot fully explain: the Wiener error is then
    // the noise power, and the excess is the misadjustment's business.
    const noise = Float64Array.from({ length: x.length }, (_, i) => 0.05 * (2 * hash01(i, 99) - 1))
    const floor = power(noise)
    for (const mu of [0.01, 0.02, 0.05]) {
      const r = runAdaptive({ x, plant: PLANT, algorithm: 'lms', taps: PLANT.length, mu, noise, stride: 2000 })
      const settled = tailPower(r.e, 10000)
      const bound = misadjustment({ mu, taps: PLANT.length, inputPower: px })
      // Above the floor, and within the predicted excess plus a quarter of it.
      expect(settled / floor, `mu=${mu}`).toBeGreaterThan(1)
      expect(settled / floor, `mu=${mu}`).toBeLessThan(1 + 1.25 * bound)
    }
  })

  it('a larger step converges sooner and settles noisier, which is the whole trade', () => {
    const noise = Float64Array.from({ length: x.length }, (_, i) => 0.05 * (2 * hash01(i, 99) - 1))
    const fast = runAdaptive({ x, plant: PLANT, algorithm: 'lms', taps: PLANT.length, mu: 0.05, noise, stride: 1 })
    const slow = runAdaptive({ x, plant: PLANT, algorithm: 'lms', taps: PLANT.length, mu: 0.005, noise, stride: 1 })
    const reach = (r) => r.history.findIndex((w) => weightError(w, PLANT) < 0.1)
    expect(reach(fast)).toBeLessThan(reach(slow))
    expect(tailPower(fast.e, 10000)).toBeGreaterThan(tailPower(slow.e, 10000))
  })
})

describe('the other two algorithms, against the same plant', () => {
  const x = white(20000, 11)

  it('every algorithm reaches the plant', () => {
    for (const algorithm of ADAPTIVE_ALGORITHMS) {
      const opts = algorithm === 'lms' ? { mu: 0.02 } : algorithm === 'nlms' ? { mu: 0.5 } : {}
      const r = runAdaptive({ x, plant: PLANT, algorithm, taps: PLANT.length, ...opts, stride: 100 })
      expect(weightError(r.w, PLANT), algorithm).toBeLessThan(1e-4)
    }
  })

  it('RLS gets there in about 2N samples, LMS in thousands', () => {
    const reach = (algorithm, opts) => {
      const r = runAdaptive({ x, plant: PLANT, algorithm, taps: PLANT.length, ...opts, stride: 1 })
      return r.history.findIndex((w) => weightError(w, PLANT) < 0.1)
    }
    const rls = reach('rls', { lambda: 0.999, delta: 0.01 })
    const nlms = reach('nlms', { mu: 0.5 })
    const lms = reach('lms', { mu: 0.02 })
    expect(rls).toBeGreaterThan(0)
    expect(rls).toBeLessThan(4 * PLANT.length)
    expect(rls).toBeLessThan(nlms)
    expect(nlms).toBeLessThan(lms)
  })

  it('NLMS holds its convergence rate when the input level changes', () => {
    const reach = (scale, algorithm, mu) => {
      const loud = Float64Array.from(x, (v) => scale * v)
      const r = runAdaptive({ x: loud, plant: PLANT, algorithm, taps: PLANT.length, mu, stride: 1 })
      return r.history.findIndex((w) => weightError(w, PLANT) < 0.1)
    }
    // Ten times the amplitude is a hundred times the power. NLMS divides it out.
    expect(reach(1, 'nlms', 0.5)).toBe(reach(10, 'nlms', 0.5))
    // Plain LMS at the same step size does not survive it.
    const quiet = reach(1, 'lms', 0.02)
    const loud = reach(10, 'lms', 0.02)
    expect(quiet).toBeGreaterThan(0)
    expect(loud === -1 || loud < quiet / 4).toBe(true)
  })
})

describe('the echo canceller is the same filter with the plant named', () => {
  it('removes an echo it has learned, and leaves the near-end signal', () => {
    // The far-end signal goes down the line and comes back through the echo
    // path. The canceller sees the far-end signal and the returning mixture.
    const far = white(40000, 21)
    const path = Float64Array.from([0, 0, 0, 0.6, 0.3, -0.2, 0.1, 0.05])
    const near = Float64Array.from({ length: far.length }, (_, i) =>
      0.1 * Math.sin((2 * Math.PI * 300 * i) / 8000),
    )
    const r = runAdaptive({
      x: far,
      plant: path,
      algorithm: 'nlms',
      taps: 12,
      mu: 0.5,
      noise: near,
      stride: 4000,
    })
    // What is left after the echo is cancelled is the near-end talker.
    const residual = tailPower(r.e, 8000)
    const nearPower = power(near.slice(-8000))
    // What is left is the near-end talker plus the misadjustment, which at
    // mu = 0.5 is a third of it again.
    expect(residual / nearPower).toBeGreaterThan(0.9)
    expect(residual / nearPower).toBeLessThan(1.5)
    // The echo return loss enhancement: how much of the echo went away.
    const echoPower = power(convolveFir(far, path).slice(-8000))
    const erle = 10 * Math.log10(echoPower / residual)
    expect(erle).toBeGreaterThan(9)
  })
})

describe('a time-varying filter is shown as the sequence of filters it is', () => {
  it('keeps a weight vector per stride, and each one is an ordinary FIR', () => {
    const x = white(4000, 31)
    const r = runAdaptive({ x, plant: PLANT, algorithm: 'lms', taps: 8, mu: 0.02, stride: 50 })
    expect(r.history.length).toBe(Math.ceil(4000 / 50) + 1)
    // The first row is the vector the run started from: an FIR of all zeros.
    for (const w of r.history) expect(w.length).toBe(8)

    // Each row has a response of its own, and the response at DC walks from
    // zero to the plant's sum of taps. There is no single H(z) for the run, and
    // that is the point of keeping the rows.
    const dcOf = (w) => firResponse(w, 0, 8000)
    expect(dcOf(r.history[0])).toBeCloseTo(0, 12)
    const target = PLANT.reduce((a, v) => a + v, 0)
    expect(dcOf(r.history[r.history.length - 1])).toBeCloseTo(target, 4)
  })

  it('the weights are state: the same run twice gives the same sequence', () => {
    const x = white(2000, 41)
    const a = runAdaptive({ x, plant: PLANT, algorithm: 'lms', taps: 8, mu: 0.02, stride: 10 })
    const b = runAdaptive({ x, plant: PLANT, algorithm: 'lms', taps: 8, mu: 0.02, stride: 10 })
    for (let i = 0; i < a.history.length; i++) {
      for (let k = 0; k < 8; k++) expect(a.history[i][k]).toBe(b.history[i][k])
    }
  })

  it('one update is the equation, written out', () => {
    const f = makeAdaptive({ algorithm: 'lms', taps: 3, mu: 0.5 })
    // First sample: the line holds [1,0,0], the output is zero, the error is d,
    // and the weight moves by mu * e * x.
    const r = f.update(1, 2)
    expect(r.y).toBe(0)
    expect(r.e).toBe(2)
    expect(Array.from(f.w)).toEqual([1, 0, 0])
  })
})
