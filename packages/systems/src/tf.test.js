import { describe, it, expect } from 'vitest'
import {
  evalAtFreq,
  magnitudeAt,
  phaseAt,
  dcGain,
  bode,
  roots,
  polesZeros,
  isStable,
  toStateSpace,
  stepResponse,
  simulate,
  secondOrderMetrics,
  bilinear,
} from './tf.js'

// Checked against closed forms wherever one exists, because this package is
// about to become the thing several tools trust for their numbers.

const db = (a) => 20 * Math.log10(a)

// H(s) = 1 / (1 + sRC): the first filter anyone meets.
const rc = (R, C) => ({ b: [1], a: [R * C, 1] })

// Series RLC, output taken across the capacitor.
//   H(s) = 1 / (LC s^2 + RC s + 1)
const rlcAcrossC = (R, L, C) => ({ b: [1], a: [L * C, R * C, 1] })

describe('frequency response', () => {
  it('an RC low-pass is -3.01 dB at 1/(2 pi RC), with -45 degrees of phase', () => {
    const R = 1000
    const C = 100e-9
    const tf = rc(R, C)
    const fc = 1 / (2 * Math.PI * R * C)

    expect(db(magnitudeAt(tf, fc))).toBeCloseTo(-3.0103, 4)
    expect((phaseAt(tf, fc) * 180) / Math.PI).toBeCloseTo(-45, 6)
    expect(magnitudeAt(tf, 1e-6)).toBeCloseTo(1, 8)
    expect(magnitudeAt(tf, fc * 1000)).toBeLessThan(0.002)
  })

  it('rolls off at 6 dB per octave, one order at a time', () => {
    const tf = rc(1000, 100e-9)
    const fc = 1 / (2 * Math.PI * 1000 * 100e-9)
    const slope = db(magnitudeAt(tf, 64 * fc)) - db(magnitudeAt(tf, 128 * fc))
    expect(slope).toBeCloseTo(6.02, 1)

    // Two poles, twice the slope.
    const two = { b: [1], a: [(1e-4) ** 2, 2e-4, 1] }
    const f2 = 1 / (2 * Math.PI * 1e-4)
    const s2 = db(magnitudeAt(two, 64 * f2)) - db(magnitudeAt(two, 128 * f2))
    expect(s2).toBeCloseTo(12.04, 1)
  })

  it('reports DC gain from the constant terms', () => {
    expect(dcGain(rc(1000, 1e-6))).toBeCloseTo(1, 12)
    expect(dcGain({ b: [5], a: [1, 2] })).toBeCloseTo(2.5, 12)
    // A differentiator has no DC response at all.
    expect(dcGain({ b: [1, 0], a: [1, 1] })).toBe(0)
  })

  it('unwraps phase instead of jumping at the branch cut', () => {
    // Two cascaded lags run past -90 degrees, so a wrapped angle would jump.
    const tf = { b: [1], a: [1e-8, 2e-4, 1] }
    const freqs = Float64Array.from({ length: 400 }, (_, i) => 10 * Math.pow(10, (4 * i) / 399))
    const { phase } = bode(tf, freqs)
    for (let i = 1; i < phase.length; i++) {
      expect(Math.abs(phase[i] - phase[i - 1]), `step at ${i}`).toBeLessThan(0.5)
    }
    // ...and it really does reach -180, which a wrapped version never shows.
    expect((phase[phase.length - 1] * 180) / Math.PI).toBeLessThan(-170)
  })
})

describe('roots, poles and zeros', () => {
  it('finds real roots', () => {
    const r = roots([1, -3, 2]).map(([re]) => re).sort((a, b) => a - b)
    expect(r[0]).toBeCloseTo(1, 9)
    expect(r[1]).toBeCloseTo(2, 9)
  })

  it('finds a complex conjugate pair', () => {
    // s^2 + 2s + 5 has roots at -1 +- 2j.
    const r = roots([1, 2, 5])
    expect(r).toHaveLength(2)
    for (const [re, im] of r) {
      expect(re).toBeCloseTo(-1, 8)
      expect(Math.abs(im)).toBeCloseTo(2, 8)
    }
    expect(r[0][1] * r[1][1]).toBeLessThan(0) // genuinely a conjugate pair
  })

  it('handles roots at the origin without stalling', () => {
    const r = roots([1, 3, 0]) // s(s+3)
    const res = r.map(([re]) => re).sort((a, b) => a - b)
    expect(res[0]).toBeCloseTo(-3, 9)
    expect(res[1]).toBeCloseTo(0, 9)
  })

  it('places an RLC pair where the algebra says', () => {
    const R = 100
    const L = 10e-3
    const C = 100e-9
    const { poles, zeros } = polesZeros(rlcAcrossC(R, L, C))
    expect(zeros).toHaveLength(0)
    expect(poles).toHaveLength(2)
    // Sum of roots = -a1/a0, product = a2/a0.
    const sum = poles[0][0] + poles[1][0]
    const prod = poles[0][0] * poles[1][0] - poles[0][1] * poles[1][1]
    expect(sum).toBeCloseTo(-(R * C) / (L * C), 4)
    expect(prod).toBeCloseTo(1 / (L * C), 2)
  })

  it('calls a right-half-plane pole unstable', () => {
    expect(isStable(rc(1000, 1e-6))).toBe(true)
    expect(isStable({ b: [1], a: [1, -1] })).toBe(false)
    expect(isStable({ b: [1], a: [1, 0, 1] })).toBe(false) // on the axis, not inside it
  })
})

describe('time domain', () => {
  it('an RC step response is 1 - exp(-t/RC), to four places', () => {
    const R = 1000
    const C = 1e-6
    const tau = R * C
    const { t, y } = stepResponse(rc(R, C), { duration: 5 * tau, points: 400 })
    for (let i = 0; i < t.length; i += 40) {
      expect(y[i], `t = ${t[i]}`).toBeCloseTo(1 - Math.exp(-t[i] / tau), 4)
    }
  })

  it('a second-order step overshoots by exactly exp(-pi zeta / sqrt(1 - zeta^2))', () => {
    // The identity we corrected in Signal Lab, now checked by simulation of the
    // continuous system rather than by a digital filter.
    for (const q of [0.5, 0.707, 1, 2, 5]) {
      const wn = 2 * Math.PI * 100
      const tf = { b: [wn * wn], a: [1, wn / q, wn * wn] }
      const m = secondOrderMetrics(tf)
      const { y } = stepResponse(tf, { duration: 12 / (m.zeta * wn), points: 4000 })
      let pk = 0
      for (const v of y) if (v > pk) pk = v
      expect(pk - 1, `Q = ${q}`).toBeCloseTo(m.overshoot, 2)
    }
  })

  it('settles to the DC gain', () => {
    const tf = { b: [3], a: [1e-6, 1] }
    const { y } = stepResponse(tf, { duration: 1e-3, points: 500 })
    expect(y[y.length - 1]).toBeCloseTo(dcGain(tf), 5)
  })

  it('simulates any input, not only a step', () => {
    // A sine well below the corner passes at close to unity, and lags a little.
    const tf = rc(1000, 1e-6)
    const f = 20
    const { t, y } = simulate(tf, (tv) => Math.sin(2 * Math.PI * f * tv), {
      duration: 20 / f,
      points: 4000,
    })
    let pk = 0
    for (let i = Math.floor(y.length / 2); i < y.length; i++) pk = Math.max(pk, Math.abs(y[i]))
    expect(pk).toBeCloseTo(magnitudeAt(tf, f), 2)
  })

  it('builds a state space whose feedthrough matches the numerator order', () => {
    // Equal orders means a direct path from input to output.
    const ss = toStateSpace({ b: [2, 1], a: [1, 3] })
    expect(ss.n).toBe(1)
    expect(ss.D).toBeCloseTo(2, 12)
    // Strictly proper means none.
    expect(toStateSpace({ b: [1], a: [1, 3] }).D).toBe(0)
  })
})

describe('second-order metrics', () => {
  it('recovers wn, zeta and Q from the coefficients', () => {
    const R = 100
    const L = 10e-3
    const C = 100e-9
    const m = secondOrderMetrics(rlcAcrossC(R, L, C))
    expect(m.wn).toBeCloseTo(1 / Math.sqrt(L * C), 6)
    expect(m.zeta).toBeCloseTo((R / 2) * Math.sqrt(C / L), 9)
    expect(m.q).toBeCloseTo((1 / R) * Math.sqrt(L / C), 6)
  })

  it('agrees with the peak of the frequency response', () => {
    // For an underdamped low-pass the response at wn is exactly Q.
    const wn = 2 * Math.PI * 1000
    for (const q of [1, 2, 5, 10]) {
      const tf = { b: [wn * wn], a: [1, wn / q, wn * wn] }
      expect(magnitudeAt(tf, 1000), `Q = ${q}`).toBeCloseTo(q, 6)
    }
  })

  it('refuses to invent a damping ratio for a system that has none', () => {
    expect(secondOrderMetrics({ b: [1], a: [1, 1] })).toBeNull()
    expect(secondOrderMetrics({ b: [1], a: [1, 1, 1, 1] })).toBeNull()
  })

  it('stops overshooting at critical damping', () => {
    const wn = 1
    const at = (q) => secondOrderMetrics({ b: [1], a: [1, wn / q, wn * wn] })
    expect(at(0.5).zeta).toBeCloseTo(1, 9)
    expect(at(0.5).overshoot).toBe(0)
    expect(at(0.4).overshoot).toBe(0)
    expect(at(Math.SQRT1_2).overshoot).toBeCloseTo(0.0432, 3)
  })
})

describe('bilinear transform', () => {
  it('matches the analogue response at the pre-warped frequency', () => {
    const fs = 48000
    const R = 1000
    const C = 100e-9
    const tf = rc(R, C)
    const fc = 1 / (2 * Math.PI * R * C)
    const d = bilinear(tf, fs, fc)

    // Evaluate the digital filter directly on the unit circle.
    const dmag = (f) => {
      const w = (2 * Math.PI * f) / fs
      let nr = 0
      let ni = 0
      let dr = 0
      let di = 0
      for (let i = 0; i < d.b.length; i++) {
        nr += d.b[i] * Math.cos(-i * w)
        ni += d.b[i] * Math.sin(-i * w)
      }
      for (let i = 0; i < d.a.length; i++) {
        dr += d.a[i] * Math.cos(-i * w)
        di += d.a[i] * Math.sin(-i * w)
      }
      return Math.hypot(nr, ni) / Math.hypot(dr, di)
    }
    expect(db(dmag(fc))).toBeCloseTo(-3.0103, 3)
    expect(dmag(1)).toBeCloseTo(1, 4)
  })

  it('keeps the DC gain', () => {
    const d = bilinear({ b: [4], a: [1e-4, 1] }, 48000)
    const sum = (c) => c.reduce((s, v) => s + v, 0)
    expect(sum(d.b) / sum(d.a)).toBeCloseTo(4, 6)
  })
})

describe('systems with no state at all', () => {
  // A purely resistive network stores no energy, so its denominator has degree
  // zero. That is a legitimate circuit and not an error — and treating it as one
  // crashed Circuit Lab the moment anyone clicked "voltage divider", which is
  // the first entry in its list.
  const divider = { b: [1000], a: [3000] }

  it('has a state space with no states', () => {
    const ss = toStateSpace(divider)
    expect(ss.n).toBe(0)
    expect(ss.D).toBeCloseTo(1 / 3, 12)
  })

  it('responds to a step instantly, and stays there', () => {
    const { t, y } = stepResponse(divider, { duration: 1e-3, points: 50 })
    expect(t).toHaveLength(50)
    for (const v of y) expect(v).toBeCloseTo(1 / 3, 12)
  })

  it('follows any other input exactly, with no lag', () => {
    const { t, y } = simulate(divider, (tv) => Math.sin(2 * Math.PI * 50 * tv), {
      duration: 0.04,
      points: 200,
    })
    for (let i = 0; i < t.length; i++) {
      expect(y[i]).toBeCloseTo(Math.sin(2 * Math.PI * 50 * t[i]) / 3, 12)
    }
  })

  it('is flat in frequency and has no poles', () => {
    expect(magnitudeAt(divider, 1)).toBeCloseTo(1 / 3, 12)
    expect(magnitudeAt(divider, 1e9)).toBeCloseTo(1 / 3, 12)
    expect(polesZeros(divider).poles).toHaveLength(0)
  })
})
