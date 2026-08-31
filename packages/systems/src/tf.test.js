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
  polyMul,
  polyAdd,
  series,
  closeLoop,
  errorLoop,
  margins,
  rootLocus,
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

describe('loops', () => {
  // The textbook loop: a plant of 1/(s(s+1)) with proportional gain k, whose
  // closed form is known exactly, so every number below has something to be
  // wrong against.
  const plant = { b: [1], a: [1, 1, 0] }
  const openLoop = (k) => series({ b: [k], a: [1] }, plant)
  const grid = Float64Array.from({ length: 6000 }, (_, i) => Math.pow(10, -3 + 6 * (i / 5999)))

  it('multiplies and adds polynomials', () => {
    expect(polyMul([1, 2], [1, 3])).toEqual([1, 5, 6])
    expect(polyAdd([1, 0], [5])).toEqual([1, 5])
    expect(polyAdd([1, 2, 3], [4, 5])).toEqual([1, 6, 8])
  })

  it('puts blocks in series by multiplying numerators and denominators', () => {
    const L = series({ b: [2], a: [1, 1] }, { b: [3], a: [1, 2] })
    expect(L.b).toEqual([6])
    expect(L.a).toEqual([1, 3, 2])
    expect(dcGain(L)).toBeCloseTo(3, 12)
  })

  it('closes the loop as L/(1+L), which is where feedback moves the poles', () => {
    for (const k of [0.25, 1, 4, 9]) {
      const T = closeLoop(openLoop(k))
      const m = secondOrderMetrics(T)
      // wn = sqrt(k) and zeta = 1/(2 sqrt(k)) for this loop, exactly.
      expect(m.wn, `k=${k}`).toBeCloseTo(Math.sqrt(k), 9)
      expect(m.zeta, `k=${k}`).toBeCloseTo(1 / (2 * Math.sqrt(k)), 9)
      // Unity feedback drives the steady-state error to zero: there is an
      // integrator in the loop, so DC gain is exactly 1.
      expect(dcGain(T), `k=${k}`).toBeCloseTo(1, 9)
    }
  })

  it('the error loop is what feedback fails to reject', () => {
    const L = openLoop(1)
    const E = errorLoop(L)
    // An integrator in the loop means zero steady-state error to a step.
    expect(dcGain(E)).toBeCloseTo(0, 9)
    // ...and T + E = 1 at every frequency, since one is what got through and
    // the other is what did not.
    for (const f of [0.01, 0.1, 1, 10]) {
      const t = evalAtFreq(closeLoop(L), f)
      const e = evalAtFreq(E, f)
      expect(t[0] + e[0], `re at ${f}`).toBeCloseTo(1, 9)
      expect(t[1] + e[1], `im at ${f}`).toBeCloseTo(1e-30, 9)
    }
  })

  it('measures phase margin where the gain passes through one', () => {
    // For k = 1 the gain crossover solves w^4 + w^2 - 1 = 0.
    const wExact = Math.sqrt((Math.sqrt(5) - 1) / 2)
    const pmExact = 180 - 90 - (Math.atan(wExact) * 180) / Math.PI
    const m = margins(openLoop(1), grid)

    // Reported in hertz, like every other frequency in this suite.
    expect(m.gainCrossover * 2 * Math.PI).toBeCloseTo(wExact, 3)
    expect(m.phaseMargin).toBeCloseTo(pmExact, 1)
    // Two poles and no more: the phase approaches -180 but never reaches it,
    // so there is no gain margin to report and none should be invented.
    expect(m.phaseCrossover).toBeNull()
    expect(m.gainMargin).toBeNull()
  })

  it('more gain buys speed and spends phase margin', () => {
    let lastPm = Infinity
    for (const k of [0.25, 1, 4, 16]) {
      const m = margins(openLoop(k), grid)
      expect(m.phaseMargin, `k=${k}`).toBeLessThan(lastPm)
      lastPm = m.phaseMargin
    }
  })

  it('finds the gain margin of a loop that actually has one', () => {
    // Three poles: 1/(s(s+1)(s+2)) goes unstable at k = 6, by Routh.
    const p3 = { b: [1], a: [1, 3, 2, 0] }
    const L = series({ b: [1], a: [1] }, p3)
    const m = margins(L, grid)
    // Phase crossover at w = sqrt(2) rad/s, where |L| = 1/6, so the gain margin
    // is exactly 6 — the factor by which k may rise before it sings.
    expect(m.phaseCrossover * 2 * Math.PI).toBeCloseTo(Math.SQRT2, 2)
    expect(m.gainMargin).toBeCloseTo(6, 1)
    expect(m.gainMarginDb).toBeCloseTo(20 * Math.log10(6), 1)
  })

  it('root locus crosses into the right half plane exactly where it should', () => {
    const p3 = { b: [1], a: [1, 3, 2, 0] }
    const L = series({ b: [1], a: [1] }, p3)
    const locus = rootLocus(L, [1, 3, 5, 5.9, 6.1, 10, 20])
    const worst = (entry) => Math.max(...entry.poles.map(([re]) => re))

    for (const e of locus.filter((x) => x.k < 6)) {
      expect(worst(e), `k=${e.k} should be stable`).toBeLessThan(0)
    }
    for (const e of locus.filter((x) => x.k > 6)) {
      expect(worst(e), `k=${e.k} should be unstable`).toBeGreaterThan(0)
    }
    // And at the crossing the pair sits on the imaginary axis at sqrt(2).
    const at6 = rootLocus(L, [6])[0]
    const onAxis = at6.poles.filter(([re]) => Math.abs(re) < 1e-6)
    expect(onAxis).toHaveLength(2)
    expect(Math.abs(onAxis[0][1])).toBeCloseTo(Math.SQRT2, 4)
  })

  it('agrees with closeLoop about where the closed-loop poles are', () => {
    // Two routes to the same characteristic equation; they must not disagree.
    const L = series({ b: [4], a: [1] }, plant)
    const viaClose = polesZeros(closeLoop(L)).poles.map(([re, im]) => [re, Math.abs(im)])
    const viaLocus = rootLocus(plant, [4])[0].poles.map(([re, im]) => [re, Math.abs(im)])
    viaClose.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    viaLocus.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    for (let i = 0; i < viaClose.length; i++) {
      expect(viaClose[i][0]).toBeCloseTo(viaLocus[i][0], 9)
      expect(viaClose[i][1]).toBeCloseTo(viaLocus[i][1], 9)
    }
  })
})

describe('phase anchoring', () => {
  // Unwrapping fixes the steps in a phase curve but not its offset, and the
  // offset is decided by whatever atan2 returns at the first grid point. For a
  // loop with two integrators the low-frequency phase is -180 degrees, which
  // atan2 may report as +180 — putting the whole curve 360 out and making
  // margins() answer 360 for a phase margin, and find no phase crossover at all.
  const GRID = Float64Array.from({ length: 4000 }, (_, i) => Math.pow(10, -4 + 8 * (i / 3999)))
  const deg = (r) => (r * 180) / Math.PI

  it('starts each curve where the pole count says it must', () => {
    const cases = [
      [{ b: [1], a: [1, 1] }, 0], // no integrator
      [{ b: [1], a: [1, 1, 0] }, -90], // one
      [{ b: [1], a: [1, 1, 0, 0] }, -180], // two
      [{ b: [1, 0], a: [1, 1] }, 90], // a zero at the origin
      [{ b: [-1], a: [1, 1] }, 180], // negative gain
    ]
    for (const [tf, want] of cases) {
      expect(deg(bode(tf, GRID).phase[0]), JSON.stringify(tf)).toBeCloseTo(want, 1)
    }
  })

  it('reports a sane phase margin for a loop with two integrators', () => {
    // PI around a plant that already integrates: this is the case that failed.
    const L = series({ b: [2, 4], a: [1, 0] }, { b: [1], a: [0.5, 1, 0] })
    const m = margins(L, GRID)
    expect(m.phaseMargin).toBeGreaterThan(-180)
    expect(m.phaseMargin).toBeLessThanOrEqual(180)
    // ...and it agrees with whether the loop actually is stable.
    expect(m.phaseMargin > 0).toBe(isStable(closeLoop(L)))
  })

  it('still finds the phase crossover it used to lose', () => {
    // PI around three lags: one integrator, so it starts at -90 and falls past
    // -180 on its way to -270. A loop with TWO integrators would start exactly
    // AT -180 and only fall, never crossing it in the interior — which is not
    // a lost crossover but an absent one.
    const L = series({ b: [1, 3], a: [1, 0] }, { b: [1], a: [1, 7, 14, 8] })
    const m = margins(L, GRID)
    expect(m.phaseCrossover, 'a loop this lagged must cross -180').not.toBeNull()
    expect(m.gainMargin).not.toBeNull()
    // The margin means what it says: just inside it is stable, just outside not.
    const at = (k) => isStable(closeLoop(series({ b: [k], a: [1] }, L)))
    expect(at(m.gainMargin * 0.9)).toBe(true)
    expect(at(m.gainMargin * 1.1)).toBe(false)
  })

  it('leaves a correctly anchored curve alone', () => {
    // The classic loop was always right; anchoring must not disturb it.
    const L = series({ b: [1], a: [1] }, { b: [1], a: [1, 1, 0] })
    const m = margins(L, GRID)
    expect(m.phaseMargin).toBeCloseTo(51.8, 0)
  })
})

// ---- regression pins for the 2026-08-31 control-loop audit fixes ----

describe('roots keeps genuine tiny leading coefficients', () => {
  it('the microsecond-lag characteristic quartic keeps all four roots and its true verdict', () => {
    // threePole k=7.062 tau=(4.29e-7, 6.22e-5, 1.22e-5) + PI kp=31.15 ki=49.01:
    // char poly leading coefficient 3.25e-16 is REAL PHYSICS, not padding.
    // The old absolute 1e-14 strip solved the wrong cubic and called a loop
    // growing as e^(+9621 t) stable.
    const char_ = [3.253e-16, 7.908e-10, 7.486e-5, 220.98, 346.12]
    const r = roots(char_)
    expect(r).toHaveLength(4)
    const unstablePair = r.filter(([re]) => re > 0)
    expect(unstablePair).toHaveLength(2)
    expect(unstablePair[0][0]).toBeCloseTo(9620.7, -1)
    expect(Math.abs(unstablePair[0][1])).toBeCloseTo(5.265e5, -2)
    expect(isStable({ b: [1], a: char_ })).toBe(false)
  })

  it('a genuinely stable slow pole is not called unstable by an absolute epsilon', () => {
    // pole at -2.6e-19: stable, merely slow. The old -1e-12 absolute test
    // flagged it.
    expect(isStable({ b: [1], a: [1, 2.6e-19] })).toBe(true)
    // ...while a pole ON the axis stays not-stable.
    expect(isStable({ b: [1], a: [1, 0] })).toBe(false)
  })
})

describe('margins: geometry over conventions', () => {
  const grid = (lo, hi, n = 4000) =>
    Float64Array.from({ length: n }, (_, i) => lo * Math.pow(hi / lo, i / (n - 1)))

  it('multi-crossing loop: the reported PM agrees in sign with the verdict', () => {
    // secondOrder k=0.004 wn=0.0303 zeta=0.0148 + PI kp=19 ki=0.57: three
    // gain crossings; the old first-crossing rule printed "+94.6 deg to
    // spare" beside an UNSTABLE banner.
    const P0 = { b: [0.004 * 0.0303 * 0.0303], a: [1, 2 * 0.0148 * 0.0303, 0.0303 * 0.0303] }
    const C0 = { b: [19, 0.57], a: [1, 0] }
    const L = { b: polyMul(P0.b, C0.b), a: polyMul(P0.a, C0.a) }
    const m = margins(L, grid(1e-7, 1e3))
    expect(isStable({ b: [1], a: polyAdd(L.b, L.a) })).toBe(false)
    expect(m.gainCrossings.length).toBeGreaterThanOrEqual(3)
    expect(m.phaseMargin).toBeLessThan(0)
  })

  it('a crossover with true phase LEAD reports a large positive margin, not a folded negative one', () => {
    // firstOrder k=7 tau=5e-6 + lead k=0.005 z=0.66 p=35: +53 deg of lead at
    // the crossing - 127 deg from the nearest 180 line, robustly stable. The
    // old fold printed -124.3 and flagged it "thin".
    const P0 = { b: [7], a: [5e-6, 1] }
    const C0 = { b: [0.005 / 0.66, 0.005], a: [1 / 35, 1] }
    const L = { b: polyMul(P0.b, C0.b), a: polyMul(P0.a, C0.a) }
    const m = margins(L, grid(1e-6, 1e9))
    expect(m.phaseMargin).toBeGreaterThan(90)
  })

  it('finds the negative-real-axis crossing of a +180-anchored loop', () => {
    // unstable plant + PID: the loop is stable ONLY because the gain is high
    // enough; its real-axis crossing lives on the +180 branch of unwrapped
    // phase and the old -180-only test reported "phase never reaches -180".
    const P0 = { b: [2167], a: [1, -0.32] }
    const C0 = { b: [0.0088, 0.0029, 6.26], a: [1, 0] }
    const L = { b: polyMul(P0.b, C0.b), a: polyMul(P0.a, C0.a) }
    const m = margins(L, grid(1e-4, 1e4))
    expect(m.phaseCrossover).not.toBeNull()
    // |L| at the crossing ~ 19.6: reduce the gain ~19.6x and it falls over -
    // the gain margin is BELOW 1, the registry hint's own lesson.
    expect(m.gainMargin).toBeLessThan(1)
    expect(m.gainMargin).toBeCloseTo(1 / 19.6, 1)
  })

  it('the binding gain margin, not the first crossing', () => {
    // threePole k=1684 tau=(0.79, 0.0044, 99) + PID(0.536, 1.043, 0.0526):
    // stable, two crossings with 1/|L| of 0.00206 and 0.634. The boundary a
    // reader can act on is 0.634; the old code reported 0.002.
    const Pa = polyMul(polyMul([0.79, 1], [0.0044, 1]), [99, 1])
    const L = { b: polyMul([1684], [0.0526, 0.536, 1.043]), a: polyMul(Pa, [1, 0]) }
    const m = margins(L, grid(1e-6, 1e4))
    expect(isStable({ b: [1], a: polyAdd(L.b, L.a) })).toBe(true)
    expect(m.gainMargin).toBeCloseTo(0.634, 1)
  })

  it('no phantom crossover at an |L| = 0 notch', () => {
    // custom plant with an imaginary-axis zero pair + lead: the true phase
    // never crosses the negative real axis; the unwrap slip once reported a
    // crossover AT the notch with GM = 4e11.
    const P0 = { b: [-2.16e-6, 0, -1.58e-5], a: [0.112, 2.17e-4, -0.367] }
    const C0 = { b: [1 / 0.66, 1], a: [1 / 35, 1] }
    const L = { b: polyMul(P0.b, C0.b), a: polyMul(P0.a, C0.a) }
    const m = margins(L, grid(1e-5, 1e5))
    for (const c of m.phaseCrossings) {
      expect(c.mag).toBeGreaterThan(1e-9)
      expect(1 / c.mag).toBeLessThan(1e9)
    }
  })

  it('still reproduces the MATLAB-checked textbook case exactly', () => {
    // unstable plant p=1, k=1 under Kp=5: PM = atan(sqrt(24)) = 78.46 deg.
    const L = { b: [5], a: [1, -1] }
    const m = margins(L, grid(1e-3, 1e3))
    expect(m.phaseMargin).toBeCloseTo(78.46, 1)
  })
})
