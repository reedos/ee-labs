import { describe, it, expect } from 'vitest'
import { PEAK_GUARD_DEG, stability } from './swing.js'
import { MACHINE } from './library.js'
import { deg } from './cx.js'

// GRID_LAB_PLAN.md §4.3's machine: H = 4.0 MJ/MVA at 60 Hz, P_m = 1.0 pu,
// with 2.0 pu of transfer before the fault, 0.5 during it and 1.5 after one
// line trips.

const st = stability(MACHINE, { pre: 2, during: 0.5, post: 1.5 })

describe('the machine as a source behind a reactance', () => {
  it('takes its inertia on the electrical speed: M = 0.0212207 pu·s² per radian', () => {
    expect(st.M).toBeCloseTo((2 * 4) / (2 * Math.PI * 60), 12)
    expect(st.M).toBeCloseTo(0.0212207, 7)
  })

  it('sits at 30.000° before the fault and may not pass 138.190° after it', () => {
    expect(deg(st.delta0)).toBeCloseTo(30, 9)
    expect(deg(st.delta0)).toBeCloseTo(deg(Math.asin(1 / 2)), 12)
    expect(deg(st.deltaMax)).toBeCloseTo(138.19, 3)
    expect(deg(st.deltaMax)).toBeCloseTo(180 - deg(Math.asin(1 / 1.5)), 9)
  })

  it('swings at 1.15523 Hz after the trip, a period of 0.865629 s', () => {
    expect(st.Kpost).toBeCloseTo(1.11803, 5)
    expect(st.fnPost).toBeCloseTo(1.15523, 5)
    expect(st.periodPost).toBeCloseTo(0.865629, 6)
    expect(st.fnPost).toBeCloseTo(Math.sqrt(st.Kpost / st.M) / (2 * Math.PI), 12)
  })

  it('hands Control Lab a second-order plant with the right stiffness', () => {
    expect(st.plant.a[2]).toBeCloseTo(st.Kpost / st.M, 12)
    expect(st.plant.b[0]).toBeCloseTo(1 / st.M, 12)
  })
})

describe('the equal areas', () => {
  it('balances at δ_cr = 70.2924°, each area 0.43883275 pu·rad', () => {
    expect(deg(st.deltaCr)).toBeCloseTo(70.2924, 4)
    expect(st.areaAccel).toBeCloseTo(0.43883275, 7)
    expect(st.areaDecel).toBeCloseTo(0.43883275, 7)
  })

  it('agrees to 10⁻¹⁴ pu·rad, by quadrature rather than by the formula that made δ_cr', () => {
    // Both areas here come from the quadrature, and δ_cr came from the closed
    // form, so this is a check and not a restatement.
    expect(st.areaError).toBeLessThan(1e-11)
    const finer = stability(MACHINE, { pre: 2, during: 0.5, post: 1.5 })
    expect(Math.abs(finer.quadrature(st.delta0, st.deltaCr, 0.5) + finer.quadrature(st.deltaCr, st.deltaMax, 1.5))).toBeLessThan(1e-11)
  })

  it('says a fault whose critical angle sits at the start angle cannot be cleared at all', () => {
    // A post-fault transfer barely above the mechanical power leaves almost no
    // room to decelerate in, so there is no clearing time that saves the
    // machine.
    const hopeless = stability(MACHINE, { pre: 1.743, during: 0.746, post: 1.051 })
    expect(hopeless.neverStable).toBe(true)
    expect(hopeless.deltaCr).toBeCloseTo(hopeless.delta0, 12)
    expect(hopeless.tcr).toBe(0)
  })

  it('says a fault the machine rides through has no critical angle', () => {
    const mild = stability(MACHINE, { pre: 2, during: 1.9, post: 1.9 })
    expect(mild.alwaysStable).toBe(true)
    expect(mild.tcr).toBe(Infinity)
  })

  it('refuses a transfer the machine cannot hold at either end', () => {
    expect(() => stability(MACHINE, { pre: 0.5 })).toThrow(/before the fault/)
    expect(() => stability(MACHINE, { pre: 2, during: 0.5, post: 0.5 })).toThrow(/cannot return to step/)
  })
})

describe('from an angle to a time', () => {
  it('reaches the critical angle at 0.206114 s, which is 12.367 cycles', () => {
    expect(st.tcr).toBeCloseTo(0.206114, 5)
    expect(st.cycles).toBeCloseTo(12.367, 3)
    expect(st.cycles).toBeCloseTo(st.tcr * 60, 9)
  })

  it('has a closed form when the fault cuts the transfer to zero', () => {
    const cf = st.closedFormTime()
    // With no transfer during the fault the machine accelerates at a constant
    // rate, so δ(t) = δ₀ + P_m t²/2M and the time follows from the angle.
    expect(cf.tcr).toBeCloseTo(Math.sqrt((2 * st.M * (cf.deltaCr - st.delta0)) / st.Pm), 12)
    expect(deg(cf.deltaCr)).toBeCloseTo(59.1035, 3)
    expect(cf.tcr).toBeCloseTo(0.146827, 6)
    // A fault that removes the whole transfer is the worse one, so it has to
    // be cleared sooner.
    expect(cf.tcr).toBeLessThan(st.tcr)
  })

  it('clears just inside the critical time and just outside it, with the two answers', () => {
    expect(st.clearAt(st.tcr * 0.98).stable).toBe(true)
    expect(st.clearAt(st.tcr * 1.05).stable).toBe(false)
    expect(st.clearAt(st.tcr * 1.05).says).toMatch(/loses synchronism/)
  })
})

describe('the first swing', () => {
  const want = [
    [0.05, 59.4938],
    [0.1, 71.5997],
    [0.15, 89.7763],
    [0.2, 122.922],
  ]

  it('peaks where the plan says, at four clearing times', () => {
    for (const [tc, peak] of want) {
      const run = st.clearAt(tc)
      expect(run.stable, `${tc} s`).toBe(true)
      expect(deg(run.peak), `${tc} s`).toBeCloseTo(peak, 3)
    }
  })

  it('agrees with the energy relation to a thousandth of a degree at every one', () => {
    for (const [tc] of want) {
      const run = st.clearAt(tc)
      expect(Math.abs(deg(run.peak) - deg(run.peakExact)), `${tc} s`).toBeLessThan(0.001)
    }
  })

  it('does not turn back at 0.25 s, past the critical time', () => {
    const run = st.clearAt(0.25)
    expect(run.stable).toBe(false)
    expect(Number.isNaN(run.peak)).toBe(true)
    expect(0.25).toBeGreaterThan(st.tcr)
  })

  it('names its method and the step it settled on', () => {
    const run = st.clearAt(0.15)
    expect(run.method).toBe('fixed-step RK4')
    expect(run.says).toMatch(/RK4/)
    expect(run.says).toMatch(/energy relation/)
    expect(run.trace.length).toBeGreaterThan(100)
    expect(run.trace[0].delta).toBeCloseTo(st.delta0, 12)
  })
})

describe('the integrator against its guard', () => {
  it('fails the guard at a 50 ms step and meets it at 25 ms', () => {
    const coarse = st.clearAt(0.15, { step: 0.05, guard: false })
    expect(Math.abs(deg(coarse.peak) - deg(coarse.peakExact))).toBeGreaterThan(PEAK_GUARD_DEG)
    const halved = st.clearAt(0.15, { step: 0.025, guard: false })
    expect(Math.abs(deg(halved.peak) - deg(halved.peakExact))).toBeLessThan(PEAK_GUARD_DEG)
  })

  it('halves the step until it passes, and reports the step it stopped at', () => {
    const guarded = st.clearAt(0.15, { step: 0.05 })
    expect(guarded.step).toBeCloseTo(0.025, 12)
    expect(guarded.error).toBeLessThan(PEAK_GUARD_DEG)
    expect(guarded.tries.length).toBe(2)
    expect(guarded.tries[0].error).toBeGreaterThan(PEAK_GUARD_DEG)
  })

  it('is already inside the guard at the 1 ms step it opens on', () => {
    const run = st.clearAt(0.15, { step: 1e-3, guard: false })
    expect(Math.abs(deg(run.peak) - deg(run.peakExact))).toBeLessThan(1e-4)
  })
})

describe('the P–δ curves', () => {
  it('give three sine curves through the origin, in the ratio of their transfers', () => {
    const c = st.curves(91)
    expect(c.delta.length).toBe(91)
    const at90 = Math.round(90 / 2)
    expect(c.pre[at90]).toBeCloseTo(2, 9)
    expect(c.during[at90]).toBeCloseTo(0.5, 9)
    expect(c.post[at90]).toBeCloseTo(1.5, 9)
    expect(c.Pm).toBeCloseTo(1, 12)
  })
})
