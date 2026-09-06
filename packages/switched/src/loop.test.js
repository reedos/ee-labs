import { describe, it, expect } from 'vitest'
import { converter } from './topologies.js'
import { steadyState, measures } from './steady.js'
import {
  averagedModel,
  gvd,
  gvdAt,
  gvdClosedForm,
  rhpZero,
  averagingGuard,
  AVERAGING_RATIO,
  switchedStep,
  averagedStep,
  stepAgreement,
  dcGainMeasured,
} from './loop.js'

// The averaged model is the one approximation this package ships, so it is
// held from three sides at once.
//
// From the algebra: its coefficients are built from the switch states'
// matrices, and they must reproduce the closed forms POWER_LAB_PLAN.md §1.5
// writes down — ω₀, Q, the DC gain, and the right-half-plane zero.
//
// From the exact engine: its DC gain is dV_o/dD, and the switched solver can
// be asked that question directly by solving two full periodic steady states
// either side of the duty. Nothing in that route touches the averaging.
//
// From the waveform: the averaged trajectory through a step must thread the
// cycle averages of the switched walk. That is what "averaged" claims, and
// the gap is measured rather than assumed.
//
// Every converter here is synchronous, so the freewheel path cannot block and
// the fixed on/off pattern is the circuit's own at any load. A model of a
// converter that runs dry is a different model, and the guard says so.

const mulberry = (seed) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const KINDS = ['buck', 'boost', 'buckboost']

/** A random synchronous converter, deep in continuous conduction. */
function sample(rnd, kind) {
  const lg = (lo, hi) => lo * (hi / lo) ** rnd()
  const p = {
    Vin: lg(5, 48),
    D: 0.15 + 0.6 * rnd(),
    L: lg(50e-6, 2e-3),
    C: lg(22e-6, 1e-3),
    R: lg(2, 40),
    fs: lg(50e3, 500e3),
    sync: true,
  }
  return { p, conv: converter(kind, p) }
}

describe('the averaged model reproduces the plan’s closed forms', () => {
  it.each(KINDS)('%s: DC gain, ω₀, Q and the zero, at 80 seeded converters', (kind) => {
    const rnd = mulberry(kind.length * 977 + 13)
    for (let i = 0; i < 80; i++) {
      const { p, conv } = sample(rnd, kind)
      const tf = gvd(conv)
      const cf = gvdClosedForm(kind, p)
      const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b))
      expect(rel(tf.dc, cf.dc), `${kind} #${i} G(0)`).toBeLessThan(1e-12)
      expect(rel(tf.w0, cf.w0), `${kind} #${i} ω₀`).toBeLessThan(1e-12)
      expect(rel(tf.Q, cf.Q), `${kind} #${i} Q`).toBeLessThan(1e-12)
      if (kind === 'buck') {
        expect(tf.zeros, `${kind} #${i} has no zero`).toEqual([])
        expect(tf.wz).toBe(Infinity)
      } else {
        expect(rel(tf.wz, cf.wz), `${kind} #${i} ω_z`).toBeLessThan(1e-12)
        expect(tf.rhp, `${kind} #${i} the zero is in the right half plane`).toBe(true)
      }
      // The denominator is the averaged A's own characteristic polynomial.
      const A = averagedModel(conv).A
      expect(tf.a[1]).toBeCloseTo(-(A[0][0] + A[1][1]), 12)
      expect(rel(tf.a[2], A[0][0] * A[1][1] - A[0][1] * A[1][0])).toBeLessThan(1e-12)
    }
  })

  it('the ideal boost’s zero is Q times its corner, which is what makes it hard to control', () => {
    const p = { Vin: 12, D: 0.5, L: 1e-3, C: 100e-6, R: 10, fs: 100e3, sync: true }
    const tf = gvd(converter('boost', p))
    expect(tf.wz / tf.w0).toBeCloseTo(tf.Q, 9)
    expect(tf.wz).toBeCloseTo(rhpZero('boost', p), 9)
  })

  it('the buck-boost’s zero carries the duty the boost’s does not', () => {
    const p = { Vin: 12, D: 0.4, L: 1e-3, C: 100e-6, R: 10, fs: 100e3, sync: true }
    expect(rhpZero('buckboost', p)).toBeCloseTo(rhpZero('boost', p) / p.D, 9)
    expect(gvd(converter('buckboost', p)).wz).toBeCloseTo(rhpZero('buckboost', p), 6)
  })

  it('G(jω) is the coefficients evaluated, and it starts at G(0)', () => {
    const p = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, sync: true }
    const tf = gvd(converter('buck', p))
    expect(gvdAt(tf, 0).mag).toBeCloseTo(tf.dc, 9)
    // At the corner a second-order low-pass with no zero is Q times its DC
    // gain and a quarter turn behind.
    const at0 = gvdAt(tf, tf.w0 / (2 * Math.PI))
    expect(at0.mag / tf.dc).toBeCloseTo(tf.Q, 9)
    expect(at0.phase).toBeCloseTo(-Math.PI / 2, 9)
  })
})

describe('the exact engine gives the same DC gain, by a route that does no averaging', () => {
  it.each(KINDS)('%s: dV_o/dD at 80 seeded converters', (kind) => {
    const rnd = mulberry(kind.length * 613 + 7)
    for (let i = 0; i < 80; i++) {
      const { p, conv } = sample(rnd, kind)
      const measured = dcGainMeasured(conv, (D) => converter(kind, { ...p, D }), { dD: 1e-5 })
      const model = gvd(conv).dc
      // The central difference carries its own third-derivative error, and the
      // ripple the model discards leaves a term of order (f₀/f_s)².
      expect(Math.abs(measured / model - 1), `${kind} #${i}: ${measured} vs ${model}`).toBeLessThan(2e-3)
    }
  })

  it('a lossy buck’s DC gain is not V_in, and both routes agree on what it is', () => {
    const p = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, sync: true, Ron: 0.05, RL: 0.05 }
    const conv = converter('buck', p)
    const tf = gvd(conv)
    expect(tf.dc).toBeLessThan(p.Vin)
    expect(tf.dc).toBeCloseTo((p.Vin * p.R) / (p.R + p.Ron + p.RL), 9)
    expect(dcGainMeasured(conv, (D) => converter('buck', { ...p, D }), { dD: 1e-5 })).toBeCloseTo(tf.dc, 3)
  })
})

describe('the averaged trajectory threads the switched one', () => {
  it.each(KINDS)('%s: 40 seeded steps, cycle average against smooth curve', (kind) => {
    const rnd = mulberry(kind.length * 401 + 29)
    for (let i = 0; i < 40; i++) {
      const { p, conv } = sample(rnd, kind)
      const after = converter(kind, { ...p, D: Math.min(0.8, p.D + 0.03) })
      const a = stepAgreement(conv, after, { periods: 120, n: 16 })
      expect(a.blocked, `${kind} #${i} left continuous conduction`).toBe(false)
      for (const q of a.pairs) expect(Number.isFinite(q.averaged) && Number.isFinite(q.exact)).toBe(true)
      // The averaging error is second order in the ripple, so it is bounded
      // by the ripple's own share of the step rather than by a constant.
      expect(a.worst, `${kind} #${i}: worst ${a.worst}, ripple/step ${a.ripple / a.span}`).toBeLessThan(
        0.05 + 0.5 * (a.ripple / a.span),
      )
    }
  })

  it('the walk from the old orbit lands on the new orbit’s own steady state', () => {
    const cases = [
      ['buck', { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, sync: true }, { R: 2.5 }],
      ['buck', { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, sync: true, Ron: 0.05, RL: 0.05 }, { R: 10 }],
      ['boost', { Vin: 12, D: 0.5, L: 1e-3, C: 100e-6, R: 10, fs: 100e3, sync: true }, { D: 0.55 }],
      ['buckboost', { Vin: 12, D: 0.4, L: 1e-3, C: 220e-6, R: 20, fs: 100e3, sync: true }, { D: 0.45 }],
    ]
    for (const [kind, p, over] of cases) {
      const after = converter(kind, { ...p, ...over })
      const target = steadyState(after)
      const sw = switchedStep(converter(kind, p), after, { periods: 20000, n: 2 })
      const scale = [Math.max(1e-9, Math.abs(target.x0[0])), Math.max(1e-9, Math.abs(target.x0[1]))]
      expect(Math.abs(sw.xEnd[0] - target.x0[0]) / scale[0], `${kind} i_L`).toBeLessThan(1e-6)
      expect(Math.abs(sw.xEnd[1] - target.x0[1]) / scale[1], `${kind} v_C`).toBeLessThan(1e-6)
      // ...and the averaged model lands on the averaged equilibrium.
      const av = averagedStep(converter(kind, p), after, { periods: 20000, n: 2 })
      expect(av.sig.vout[av.sig.vout.length - 1]).toBeCloseTo(av.to.vout, 6)
    }
  })

  it('the switched step starts from the old converter’s own periodic state', () => {
    const p = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, sync: true }
    const before = converter('buck', p)
    const sw = switchedStep(before, converter('buck', { ...p, R: 2.5 }), { periods: 4, n: 8 })
    expect(sw.x0).toEqual(steadyState(before).x0)
    expect(sw.t[0]).toBe(0)
    expect(sw.cycles).toHaveLength(4)
  })

  it('a diode converter that runs dry in the step says so rather than drawing a waveform it does not have', () => {
    const p = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3 }
    const sw = switchedStep(converter('buck', p), converter('buck', { ...p, R: 400 }), { periods: 40, n: 16 })
    expect(sw.blocked).toBe(true)
  })

  it('the boost’s output moves the wrong way first, on the slope the model predicts', () => {
    const p = { Vin: 12, D: 0.5, L: 1e-3, C: 100e-6, R: 10, fs: 100e3, sync: true }
    const conv = converter('boost', p)
    const tf = gvd(conv)
    const dD = 0.05
    const a = stepAgreement(conv, converter('boost', { ...p, D: p.D + dD }), { periods: 200, n: 24 })
    expect(a.to).toBeGreaterThan(a.from)
    expect(a.dip).toBeLessThan(a.from)
    expect(tf.slope0).toBeLessThan(0)
    // The averaged curve's own opening slope is c·B_d, measured on it.
    const av = a.averaged
    const slope = (av.sig.vout[1] - av.sig.vout[0]) / (av.t[1] - av.t[0])
    expect(slope / (tf.slope0 * dD)).toBeCloseTo(1, 2)
    // ...and the buck has none of this: its output only rises.
    const buck = converter('buck', { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, sync: true })
    const b = stepAgreement(buck, converter('buck', { Vin: 12, D: 0.5, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, sync: true }), {
      periods: 200,
      n: 24,
    })
    expect(b.dip).toBeGreaterThanOrEqual(b.from - 1e-9)
  })
})

describe('the guard warns before the model stops being the converter', () => {
  it('names the ceiling as f_s/5 and reports the highest feature against it', () => {
    const p = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, sync: true }
    const tf = gvd(converter('buck', p))
    const g = averagingGuard(tf, p.fs)
    expect(g.limit).toBe(p.fs / AVERAGING_RATIO)
    expect(g.f0).toBeCloseTo(tf.w0 / (2 * Math.PI), 9)
    expect(g.highest).toBeCloseTo(g.f0, 9)
    expect(g.state).toBe('ok')
    expect(g.reason).toBeNull()
  })

  it('crosses from ok to warn to refuse as f_s falls, at the two thresholds', () => {
    const base = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, sync: true }
    const f0 = gvd(converter('buck', { ...base, fs: 100e3 })).w0 / (2 * Math.PI)
    const states = []
    for (let i = 0; i < 40; i++) {
      const fs = 40e3 * 0.9 ** i
      const g = averagingGuard(gvd(converter('buck', { ...base, fs })), fs)
      states.push([fs, g.state, g.ratio])
      // The bands are the ratio's own, so they cannot disagree with it.
      expect(g.state, `f_s = ${fs}`).toBe(g.ratio > 1 ? 'refuse' : g.ratio > 0.5 ? 'warn' : 'ok')
      if (g.state !== 'ok') expect(g.reason.length).toBeGreaterThan(40)
    }
    // Once refused, always refused: the ceiling only falls with f_s.
    const order = ['ok', 'warn', 'refuse']
    for (let i = 1; i < states.length; i++) {
      expect(order.indexOf(states[i][1])).toBeGreaterThanOrEqual(order.indexOf(states[i - 1][1]))
    }
    // The thresholds are where the arithmetic puts them: 5·f₀ and 10·f₀.
    const refuse = states.find((q) => q[1] === 'refuse')
    expect(refuse[0]).toBeLessThan(AVERAGING_RATIO * f0)
    const warn = states.find((q) => q[1] === 'warn')
    expect(warn[0]).toBeLessThan(2 * AVERAGING_RATIO * f0)
    expect(warn[0]).toBeGreaterThan(AVERAGING_RATIO * f0)
  })

  it('counts a loop crossover as a feature, since that is what the model is asked for', () => {
    const p = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, sync: true }
    const tf = gvd(converter('buck', p))
    expect(averagingGuard(tf, p.fs, { at: 3e3 }).state).toBe('ok')
    expect(averagingGuard(tf, p.fs, { at: 15e3 }).state).toBe('warn')
    expect(averagingGuard(tf, p.fs, { at: 25e3 }).state).toBe('refuse')
  })
})

// The equilibrium of the averaged circuit is the cycle average of the exact
// one, up to exactly what averaging throws away: the correlation between the
// two ripples. In the buck the two switch states share one A, so there is
// nothing to correlate and the two agree to floating point. In the boost and
// the buck-boost A changes with the switch, the discarded term is
// ⟨(A_on − A_off)·x̃⟩, and the gap is bounded by the product of the two
// ripples' own shares rather than by a constant.
describe('the averaged equilibrium is the exact solver’s own cycle average', () => {
  it.each(KINDS)('%s: X against ⟨x⟩ over the period, at 40 seeded converters', (kind) => {
    const rnd = mulberry(kind.length * 131 + 3)
    for (let i = 0; i < 40; i++) {
      const { conv } = sample(rnd, kind)
      const m = measures(steadyState(conv))
      const X = averagedModel(conv).X
      const rel = (a, b) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b))
      const ri = m.sig.iL.pp / Math.max(1e-12, Math.abs(m.sig.iL.avg))
      const rv = m.sig.vC.pp / Math.max(1e-12, Math.abs(m.sig.vC.avg))
      const bound = kind === 'buck' ? 1e-9 : 1e-9 + 2 * ri * rv
      expect(rel(X[0], m.sig.iL.avg), `${kind} #${i} ⟨i_L⟩, bound ${bound}`).toBeLessThan(bound)
      expect(rel(X[1], m.sig.vC.avg), `${kind} #${i} ⟨v_C⟩, bound ${bound}`).toBeLessThan(bound)
    }
  })

  it('the buck’s two switch states share one A, so its averaging discards nothing here', () => {
    const p = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, sync: true }
    const conv = converter('buck', p)
    expect(conv.states.on.A).toEqual(conv.states.off.A)
    const m = measures(steadyState(conv))
    expect(averagedModel(conv).X[0]).toBeCloseTo(m.sig.iL.avg, 12)
  })
})
