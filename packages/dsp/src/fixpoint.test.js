import { describe, it, expect } from 'vitest'
import {
  OVERFLOW,
  ROUNDING,
  findLimitCycle,
  makeFixedBiquad,
  poleGrid,
  quantizeBiquad,
  quantizer,
  roundingNoise,
  scalingNorms,
} from './fixpoint.js'
import { biquadResponse, designBiquad, isStable, makeBiquad, poleRadius } from './biquad.js'
import { hash01 } from './signals.js'

const SR = 8000
const white = (n, seed) => Float64Array.from({ length: n }, (_, i) => 2 * hash01(i, seed) - 1)

describe('the quantiser puts every value on a grid it can name', () => {
  it('returns exact multiples of the step, at every word length', () => {
    for (const bits of [4, 8, 12, 16, 24]) {
      for (const intBits of [0, 1, 2]) {
        const q = quantizer({ bits, intBits })
        expect(q.delta).toBe(Math.pow(2, -(bits - 1 - intBits)))
        for (let i = 0; i < 200; i++) {
          // Inside the range, where no overflow rule applies and the only error
          // is the rounding.
          const x = (2 * hash01(i, bits) - 1) * (Math.pow(2, intBits) - q.delta)
          const v = q(x)
          expect(Math.abs(v / q.delta - Math.round(v / q.delta)), `${bits}/${intBits} i=${i}`).toBeLessThan(1e-9)
          expect(Math.abs(v - x)).toBeLessThanOrEqual(q.delta / 2 + 1e-15)
        }
      }
    }
  })

  it('truncation biases downwards where rounding does not', () => {
    const r = quantizer({ bits: 6, intBits: 0, rounding: 'round' })
    const t = quantizer({ bits: 6, intBits: 0, rounding: 'truncate' })
    let er = 0
    let et = 0
    for (let i = 0; i < 4000; i++) {
      const x = 0.8 * (2 * hash01(i, 3) - 1)
      er += r(x) - x
      et += t(x) - x
    }
    expect(Math.abs(er / 4000)).toBeLessThan(r.delta / 40)
    // Truncation moves towards zero, so a symmetric signal keeps a mean error
    // near zero and every individual error is at most one whole step.
    expect(Math.abs(et / 4000)).toBeLessThan(t.delta)
    for (let i = 0; i < 200; i++) {
      const x = 0.8 * (2 * hash01(i, 3) - 1)
      expect(Math.abs(t(x))).toBeLessThanOrEqual(Math.abs(x) + 1e-15)
    }
  })

  it('saturation sticks at the rail and wrapping crosses to the other one', () => {
    const sat = quantizer({ bits: 8, intBits: 0, overflow: 'saturate' })
    const wrap = quantizer({ bits: 8, intBits: 0, overflow: 'wrap' })
    expect(sat(1.2)).toBe(sat.top)
    expect(sat(-1.4)).toBe(sat.bottom)
    expect(sat(5)).toBe(sat.top)
    // Two's complement: the value is rounded to the grid and then comes back
    // 2.0 lower, which is the range.
    const span = 2 * Math.pow(2, wrap.intBits)
    expect(wrap(1.2)).toBe(Math.round(1.2 / wrap.delta) * wrap.delta - span)
    expect(wrap(-1.3)).toBe(Math.round(-1.3 / wrap.delta) * wrap.delta + span)
    // ...and stays inside the range whatever it is given.
    for (const x of [3.7, -9.1, 100, -100]) {
      expect(wrap(x)).toBeGreaterThanOrEqual(wrap.bottom)
      expect(wrap(x)).toBeLessThanOrEqual(wrap.top)
    }
    expect(ROUNDING).toContain('truncate')
    expect(OVERFLOW).toContain('wrap')
  })
})

describe('a quantised filter is a different filter, stated exactly', () => {
  it('its coefficients are on the grid and its poles are computed, not estimated', () => {
    const exact = designBiquad({ mode: 'lowpass', freq: 100, q: 10 }, SR)
    for (const bits of [10, 12, 16, 20]) {
      const q = quantizer({ bits, intBits: 2 })
      const r = quantizeBiquad(exact, q)
      for (const k of ['b0', 'b1', 'b2', 'a1', 'a2']) {
        const n = r.coeffs[k] / q.delta
        expect(Math.abs(n - Math.round(n)), `${bits} ${k}`).toBeLessThan(1e-9)
      }
      // The poles are the roots of the quantised denominator, and the filter
      // that runs is the filter those poles describe.
      const y = new Float64Array(64)
      const step = makeBiquad(r.coeffs)
      for (let i = 0; i < 64; i++) y[i] = step(i === 0 ? 1 : 0)
      for (const f of [50, 100, 400, 2000]) {
        let re = 0
        let im = 0
        for (let n = 0; n < 64; n++) {
          const w = (2 * Math.PI * f * n) / SR
          re += y[n] * Math.cos(w)
          im -= y[n] * Math.sin(w)
        }
        if (r.radius < 0.99) {
          expect(Math.hypot(re, im), `${bits} at ${f}`).toBeCloseTo(
            biquadResponse(r.coeffs, f, SR),
            2,
          )
        }
      }
    }
  })

  it('the poles move further at every bit removed, and eventually leave the circle', () => {
    const exact = designBiquad({ mode: 'lowpass', freq: 60, q: 20 }, SR)
    let last = 0
    for (const bits of [20, 16, 12, 10, 8]) {
      const q = quantizer({ bits, intBits: 2 })
      const r = quantizeBiquad(exact, q)
      expect(r.moved[0], `${bits} bit`).toBeGreaterThanOrEqual(last * 0.5)
      last = r.moved[0]
    }
    const coarse = quantizeBiquad(exact, quantizer({ bits: 8, intBits: 2 }))
    expect(coarse.stable).toBe(false)
    expect(poleRadius(coarse.coeffs)).toBeGreaterThanOrEqual(1)
    const fine = quantizeBiquad(exact, quantizer({ bits: 20, intBits: 2 }))
    expect(fine.stable).toBe(true)
    expect(isStable(fine.coeffs)).toBe(true)
  })

  it('the reachable pole positions are a grid, and it thins out near z = 1', () => {
    const q = quantizer({ bits: 6, intBits: 2 })
    const pts = poleGrid(q, { maxRadius: 1 })
    expect(pts.length).toBeGreaterThan(50)
    // Count the reachable poles inside two boxes of equal area, one against the
    // real axis near z = 1 and one at 45 degrees. The direct form's grid is
    // sparse exactly where a low-frequency resonator needs it.
    const inBox = (x0, x1, y0, y1) =>
      pts.filter(([re, im]) => re >= x0 && re <= x1 && im >= y0 && im <= y1).length
    const nearOne = inBox(0.85, 1.0, 0, 0.15)
    const diagonal = inBox(0.55, 0.7, 0.55, 0.7)
    expect(nearOne).toBeLessThan(diagonal)
  })
})

describe('rounding inside the loop makes the recursion nonlinear', () => {
  it('a filter that should decay to nothing sits at a fixed level instead', () => {
    const coeffs = designBiquad({ mode: 'lowpass', freq: 100, q: 10 }, SR)
    const coeffQ = quantizer({ bits: 12, intBits: 2 })
    const stateQ = quantizer({ bits: 12, intBits: 1 })
    const step = makeFixedBiquad(coeffs, { coeffQ, stateQ })
    const lc = findLimitCycle(step, { start: [0, 0, 0.05, 0.05] })
    expect(lc.found).toBe(true)
    expect(lc.amplitude).toBeGreaterThan(0)
    // The cycle is made of exact multiples of the state's own step.
    const n = lc.amplitude / stateQ.delta
    expect(Math.abs(n - Math.round(n))).toBeLessThan(1e-9)

    // Float64 in the same filter decays away, which is what makes the cycle a
    // quantisation effect rather than a property of the design.
    const clean = makeFixedBiquad(coeffs, { coeffQ })
    clean.setState([0, 0, 0.05, 0.05])
    let v = 0
    for (let i = 0; i < 20000; i++) v = clean(0)
    expect(Math.abs(v)).toBeLessThan(stateQ.delta / 100)
  })

  it('the cycle really repeats, sample for sample', () => {
    const coeffs = designBiquad({ mode: 'lowpass', freq: 200, q: 8 }, SR)
    const stateQ = quantizer({ bits: 10, intBits: 1 })
    const step = makeFixedBiquad(coeffs, { coeffQ: quantizer({ bits: 16, intBits: 2 }), stateQ })
    const lc = findLimitCycle(step, { start: [0, 0, 0.1, 0.1] })
    if (!lc.found) return
    const first = []
    for (let i = 0; i < lc.period; i++) first.push(step(0))
    for (let i = 0; i < lc.period; i++) expect(step(0), `i=${i}`).toBe(first[i])
  })

  it('the dead band is a fixed number of steps, so it scales with the word length', () => {
    // The recursion is scale invariant in the step: multiply every state by two
    // and halve the step and the same integers come out. So the dead band is a
    // count of steps set by the coefficients, and its size in signal units is
    // that count times the step.
    const coeffs = designBiquad({ mode: 'lowpass', freq: 100, q: 10 }, SR)
    const coeffQ = quantizer({ bits: 16, intBits: 2 })
    const steps = []
    for (const bits of [14, 12, 10]) {
      const stateQ = quantizer({ bits, intBits: 1 })
      const step = makeFixedBiquad(coeffs, { coeffQ, stateQ })
      const start = 200 * stateQ.delta
      const lc = findLimitCycle(step, { start: [0, 0, start, start] })
      expect(lc.found, `${bits} bit`).toBe(true)
      steps.push(Math.round(lc.amplitude / stateQ.delta))
    }
    expect(steps[0]).toBe(81)
    expect(steps[1]).toBe(steps[0])
    expect(steps[2]).toBe(steps[0])
  })
})

describe('the rounding-noise model, and the guard on it', () => {
  it('predicts the output noise of a signal that exercises many codes', () => {
    const coeffs = designBiquad({ mode: 'lowpass', freq: 400, q: 2 }, SR)
    const stateQ = quantizer({ bits: 12, intBits: 1 })
    const predicted = roundingNoise(coeffs, stateQ)

    const n = 40000
    const x = white(n, 5)
    const exact = makeBiquad(coeffs)
    const fixed = makeFixedBiquad(coeffs, { stateQ })
    let acc = 0
    for (let i = 0; i < n; i++) {
      const d = fixed(x[i]) - exact(x[i])
      if (i > 2000) acc += d * d
    }
    const measured = acc / (n - 2000)
    // The model treats each rounding as white noise of delta^2/12. The
    // measurement is within a factor of two of it, which is the accuracy the
    // model is worth and is why it is labelled an approximation.
    expect(measured).toBeGreaterThan(predicted.power / 3)
    expect(measured).toBeLessThan(predicted.power * 3)
  })

  it('the guard: a signal that moves across a few codes breaks the model', () => {
    // A signal only a few steps tall, well into a band the filter rejects. The
    // rounded output sits on one code and the error stops being noise, so the
    // white model over-predicts by more than an order of magnitude. The model
    // is only worth its accuracy where the signal exercises many codes, and
    // that is the threshold the guard states.
    const coeffs = designBiquad({ mode: 'lowpass', freq: 100, q: 10 }, SR)
    const stateQ = quantizer({ bits: 12, intBits: 1 })
    const predicted = roundingNoise(coeffs, stateQ)
    const n = 20000
    const exact = makeBiquad(coeffs)
    const fixed = makeFixedBiquad(coeffs, { stateQ })
    let acc = 0
    for (let i = 0; i < n; i++) {
      const x = 3 * stateQ.delta * Math.sin((2 * Math.PI * 3000 * i) / SR)
      const d = fixed(x) - exact(x)
      if (i > 4000) acc += d * d
    }
    const measured = acc / (n - 4000)
    expect(measured / predicted.power).toBeLessThan(0.1)
  })

  it('the noise gain rises with Q, which is why a resonator needs the word length', () => {
    const q = quantizer({ bits: 16, intBits: 1 })
    let last = 0
    for (const Q of [0.707, 2, 10, 40]) {
      const c = designBiquad({ mode: 'lowpass', freq: 200, q: Q }, SR)
      const g = roundingNoise(c, q).noiseGain
      expect(g, `Q=${Q}`).toBeGreaterThan(last)
      last = g
    }
  })
})

describe('scaling: how much headroom the accumulator needs', () => {
  it('the L1 norm bounds the output for any input inside one', () => {
    const coeffs = designBiquad({ mode: 'lowpass', freq: 300, q: 5 }, SR)
    const norms = scalingNorms(coeffs, SR)
    expect(norms.l1).toBeGreaterThan(norms.peak)
    expect(norms.peak).toBeGreaterThan(norms.l2)

    // The worst-case input is the sign of the time-reversed impulse response,
    // and it reaches the L1 norm.
    const n = 2000
    const h = new Float64Array(n)
    const probe = makeBiquad(coeffs)
    for (let i = 0; i < n; i++) h[i] = probe(i === 0 ? 1 : 0)
    const step = makeBiquad(coeffs)
    let worst = 0
    for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(step(Math.sign(h[n - 1 - i]) || 1)))
    expect(worst).toBeGreaterThan(0.9 * norms.l1)
    expect(worst).toBeLessThanOrEqual(norms.l1 + 1e-9)
  })

  it('and the bits it asks for grow with Q', () => {
    let last = -1
    for (const Q of [0.707, 5, 40]) {
      const c = designBiquad({ mode: 'lowpass', freq: 300, q: Q }, SR)
      const bits = scalingNorms(c, SR).bits
      expect(bits).toBeGreaterThanOrEqual(last)
      last = bits
    }
  })
})
