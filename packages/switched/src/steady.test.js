import { describe, it, expect } from 'vitest'
import { converter, KINDS, DEFAULTS } from './topologies.js'
import { steadyState, periodMap, waveforms, measures } from './steady.js'
import { endState } from './segment.js'
import {
  conversionRatio,
  inductorRipple,
  outputRipple,
  K,
  Kcrit,
  Rcrit,
  dcmRatio,
  predictedRatio,
  ratioWithRL,
  boostPeak,
} from './formulas.js'

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const logU = (r, lo, hi) => lo * (hi / lo) ** r()

// Converter parameters drawn across the ranges the lab's knobs allow, with
// every non-ideality sometimes on and sometimes off, in both conduction
// modes and with and without a synchronous switch.
function randomParams(r) {
  const on = () => r() < 0.6
  return {
    Vin: logU(r, 3, 48),
    D: 0.08 + 0.84 * r(),
    L: logU(r, 4.7e-6, 2.2e-3),
    C: logU(r, 1e-6, 2.2e-3),
    R: logU(r, 0.5, 1000),
    fs: logU(r, 20e3, 1e6),
    Ron: on() ? logU(r, 1e-3, 0.5) : 0,
    Vf: on() ? 0.2 + 0.8 * r() : 0,
    rd: on() ? logU(r, 1e-3, 0.2) : 0,
    RL: on() ? logU(r, 1e-3, 0.5) : 0,
    ESR: on() ? logU(r, 1e-3, 1) : 0,
    sync: r() < 0.3,
    tr: r() < 0.5 ? logU(r, 5e-9, 100e-9) : 0,
    tf: r() < 0.5 ? logU(r, 5e-9, 100e-9) : 0,
  }
}

const r = rng(2026)
const cases = []
for (let i = 0; i < 60; i++) cases.push([KINDS[i % 3], i, randomParams(r)])

describe('invariants every converter must satisfy in periodic steady state', () => {
  it.each(cases)('%s #%i', (kind, _, p) => {
    const conv = converter(kind, p)
    const ss = steadyState(conv)
    const m = measures(ss)
    const Vs = Math.max(p.Vin, m.sig.vout.avg)
    const Is = Math.max(1e-9, m.sig.iL.max)

    // 1. Volt-second balance: the inductor's average voltage is zero.
    expect(Math.abs(m.sig.vL.avg)).toBeLessThan(1e-9 * Vs)
    // 2. Charge balance: the capacitor's average current is zero.
    expect(Math.abs(m.sig.iC.avg)).toBeLessThan(1e-9 * Is)
    // 3. Energy: source power in = load power + conduction losses.
    expect(Math.abs(m.balance)).toBeLessThan(1e-9 * Math.max(m.Pin, m.Pout))
    // 4. Continuity: each segment starts where the previous ended (the dead
    //    segment's current is pinned at zero, which the model allows to be
    //    off by the bisection width).
    const live = ss.segments.filter((s) => s.T > 0)
    for (let k = 1; k < live.length; k++) {
      const xe = endState(live[k - 1])
      expect(Math.abs(live[k].x0[1] - xe[1])).toBeLessThan(1e-9 * Vs)
      expect(Math.abs(live[k].x0[0] - xe[0])).toBeLessThan(1e-9 * Is)
    }
    // 6. Steady is steady: one more period lands on the same state.
    const xT = periodMap(ss)
    expect(Math.abs(xT[0] - ss.x0[0])).toBeLessThan(1e-9 * Is)
    expect(Math.abs(xT[1] - ss.x0[1])).toBeLessThan(1e-9 * Vs)
    // Diodes conduct one way.
    if (conv.hasDead) expect(m.sig.iD.min).toBeGreaterThan(-1e-9 * Is)
    // DCM bookkeeping: the diode turns off inside the off interval, at zero current.
    if (ss.mode === 'DCM') {
      expect(ss.td).toBeGreaterThan(0)
      expect(ss.td).toBeLessThan(ss.tOff)
      expect(Math.abs(endState(ss.segments[1])[0])).toBeLessThan(1e-9 * Is)
      expect(ss.x0[0]).toBe(0)
    }
    // Every measure is a finite number.
    for (const s of Object.values(m.sig)) for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true)
    expect(m.eta).toBeGreaterThan(0)
    expect(m.eta).toBeLessThanOrEqual(1 + 1e-12)
  })
})

describe('the ideal buck against its textbook', () => {
  const conv = converter('buck')
  const ss = steadyState(conv)
  const m = measures(ss)

  it('M = D exactly — volt-second balance with no drops is the whole derivation', () => {
    expect(m.M).toBeCloseTo(DEFAULTS.D, 13)
    expect(m.sig.vout.avg).toBeCloseTo(5, 12)
    expect(ss.mode).toBe('CCM')
  })

  it('ripple formulas hold to the small-ripple approximation (0.1%)', () => {
    const dI = inductorRipple('buck', conv.p)
    const dV = outputRipple('buck', conv.p)
    expect(dI).toBeCloseTo(0.29167, 5)
    expect(dV).toBeCloseTo(3.6458e-3, 7)
    expect(Math.abs(m.sig.iL.pp - dI) / dI).toBeLessThan(1e-3)
    expect(Math.abs(m.sig.vout.pp - dV) / dV).toBeLessThan(1e-3)
  })

  it('an ideal converter loses nothing', () => {
    expect(m.eta).toBeCloseTo(1, 12)
    expect(m.Pin).toBeCloseTo(m.Pout, 12)
    // 5 W plus what the 3.6 mV ripple adds to the output RMS: under a microwatt.
    expect(m.Pin).toBeGreaterThan(5)
    expect(m.Pin).toBeLessThan(5 + 1e-6)
  })

  it('the conduction boundary lands where K = 1 − D says', () => {
    const Rc = Rcrit('buck', conv.p)
    expect(Rc).toBeCloseTo((2 * 100e-6 * 100e3) / (1 - 5 / 12), 9)
    expect(steadyState(converter('buck', { R: Rc * 0.98 })).mode).toBe('CCM')
    expect(steadyState(converter('buck', { R: Rc * 1.02 })).mode).toBe('DCM')
  })

  it('in DCM the ratio follows 2/(1+√(1+4K/D²)) to 0.1%', () => {
    const light = converter('buck', { R: 200 })
    const ssl = steadyState(light)
    const ml = measures(ssl)
    expect(ssl.mode).toBe('DCM')
    const k = K(light.p)
    expect(k).toBeLessThan(Kcrit('buck', light.p.D))
    const pred = dcmRatio('buck', light.p.D, k)
    expect(Math.abs(ml.M - pred) / pred).toBeLessThan(1e-3)
    expect(predictedRatio('buck', light.p)).toBe(pred)
  })

  it('M is continuous across the boundary — a kink, not a step', () => {
    // Either side of R_crit the ratio differs by an amount that shrinks with
    // the distance from the boundary (dM/dlnR is about 0.3 on the DCM side
    // and zero on the CCM side). A step would fail the tightest margin.
    const Rc = Rcrit('buck', conv.p)
    for (const eps of [1e-3, 1e-4, 1e-5]) {
      const below = measures(steadyState(converter('buck', { R: Rc * (1 - eps) }))).M
      const above = measures(steadyState(converter('buck', { R: Rc * (1 + eps) }))).M
      expect(Math.abs(above - below)).toBeLessThan(eps)
      expect(above).toBeGreaterThan(below)
    }
  })

  it('a synchronous buck never enters DCM: the current simply goes negative', () => {
    const ssS = steadyState(converter('buck', { R: 200, sync: true }))
    expect(ssS.mode).toBe('CCM')
    expect(measures(ssS).sig.iL.min).toBeLessThan(0)
    expect(measures(ssS).M).toBeCloseTo(5 / 12, 12)
  })
})

describe('the diode blocks at the first zero of its current', () => {
  // A small L and C ring faster than the switch: the off interval holds more
  // than a resonant period, and the current would pass through zero again
  // and again if the diode let it. The period residual then has a root for
  // each of those zeros; only the first is a state the circuit visits, and
  // it is where a walk from rest arrives (transient.test.js). Found by the
  // walker: the solver had settled on a later root, with the diode carrying
  // −11 A in between.
  const ringing = {
    Vin: 17.34,
    D: 0.1352,
    L: 5.828e-6,
    C: 2.432e-6,
    R: 48.97,
    fs: 20217,
    Ron: 0.00708,
    RL: 0.00568,
    ESR: 0.0641,
  }
  it('an off interval longer than the ringing period ends at the first zero, with no reverse current', () => {
    const ss = steadyState(converter('buck', ringing))
    expect(ss.mode).toBe('DCM')
    const m = measures(ss)
    expect(m.sig.iD.min).toBeGreaterThan(-1e-9 * m.sig.iL.max)
    expect(m.sig.iL.min).toBeGreaterThan(-1e-9 * m.sig.iL.max)
    expect(ss.td / ss.T).toBeLessThan(0.05)
  })
})

describe('boost and buck-boost ideal ratios', () => {
  it.each([
    ['boost', 0.5],
    ['boost', 0.7],
    ['buckboost', 0.3],
    ['buckboost', 0.6],
  ])('%s at D = %f is within 1% of the small-ripple formula', (kind, D) => {
    const conv = converter(kind, { D, R: 20 })
    const m = measures(steadyState(conv))
    const M = conversionRatio(kind, D)
    expect(Math.abs(m.M - M) / M).toBeLessThan(1e-2)
    expect(m.eta).toBeCloseTo(1, 10)
  })
})

describe('the winding resistance in the ratio', () => {
  // r = R_L/R is the only parameter the closed form needs; the engine is run
  // with that R_L and nothing else lossy, so any gap is the small-ripple
  // approximation and not a missing term.
  it.each([
    ['buck', 0.3],
    ['buck', 0.7],
    ['boost', 0.5],
    ['boost', 0.8],
    ['boost', 0.95],
    ['buckboost', 0.4],
    ['buckboost', 0.75],
  ])('%s at D = %f matches M with R_L to a part in a thousand', (kind, D) => {
    const R = 20
    const RL = 0.2
    const m = measures(steadyState(converter(kind, { D, R, RL })))
    const M = ratioWithRL(kind, D, RL / R)
    expect(Math.abs(m.M - M) / M).toBeLessThan(1e-3)
    // The ideal formula is the r = 0 case of the same expression.
    expect(ratioWithRL(kind, D, 0)).toBeCloseTo(conversionRatio(kind, D), 12)
  })

  it('costs the boost its efficiency in exactly the proportion it costs it voltage', () => {
    // η = M/M_ideal = M·(1−D): the volts theory promised and did not deliver
    // are the ones the winding took.
    for (const D of [0.5, 0.8, 0.9, 0.95]) {
      const m = measures(steadyState(converter('boost', { D, R: 20, RL: 0.2 })))
      expect(Math.abs(m.M * (1 - D) - m.eta) / m.eta).toBeLessThan(1e-3)
    }
  })

  it('turns the boost around at D′ = √r, where half the power is in the winding', () => {
    const R = 20
    const RL = 0.2
    const peak = boostPeak(RL / R)
    expect(peak.D).toBeCloseTo(0.9, 12)
    expect(peak.M).toBeCloseTo(5, 12)
    const at = (D) => measures(steadyState(converter('boost', { D, R, RL })))
    const top = at(peak.D)
    expect(top.M).toBeCloseTo(5, 3)
    // Either side of it the measured ratio is lower: it is a maximum of the
    // real converter, not only of the formula.
    expect(at(peak.D - 0.1).M).toBeLessThan(top.M)
    expect(at(peak.D + 0.05).M).toBeLessThan(top.M)
    // At the peak the load and the winding split the power evenly.
    expect(top.eta).toBeCloseTo(0.5, 3)
    expect(top.loss.inductor).toBeCloseTo(top.Pout, 1)
  })
})

describe('the buck-boost in discontinuous conduction', () => {
  it('delivers the energy the inductor picks up, and no more: P_out = ½L·i_pk²·f_s at any load', () => {
    const p = { D: 0.5, R: 200, L: 100e-6, fs: 100e3 }
    for (const R of [100, 200, 500, 1000]) {
      const m = measures(steadyState(converter('buckboost', { ...p, R })))
      const E = 0.5 * p.L * m.sig.iL.max ** 2 * p.fs
      expect(m.Pout).toBeCloseTo(E, 9)
      // The same energy every cycle whatever the load: a constant-power source.
      expect(m.Pout).toBeCloseTo(1.8, 9)
    }
  })
})

describe('waveforms', () => {
  it('cover the requested periods, start at the steady state and put both sides of every edge on the trace', () => {
    const ss = steadyState(converter('buck'))
    const w = waveforms(ss, { periods: 3, n: 100 })
    expect(w.t[0]).toBe(0)
    expect(w.t[w.t.length - 1]).toBeCloseTo(3 * ss.T, 18)
    expect(w.sig.iL[0]).toBe(ss.x0[0])
    expect(w.edges).toHaveLength(6)
    // The switch node holds 12 V before the off edge and 0 V just after.
    const iEdge = w.t.findIndex((t, i) => i > 0 && t === w.t[i - 1])
    expect(w.sig.vsw[iEdge - 1]).toBe(12)
    expect(w.sig.vsw[iEdge]).toBe(0)
  })
})

describe('cost', () => {
  it('a steady state with measures is interactive', () => {
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) measures(steadyState(converter('buck', { R: 200 + i })))
    expect((performance.now() - t0) / 5).toBeLessThan(150)
  })
})
