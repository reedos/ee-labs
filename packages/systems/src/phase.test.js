import { describe, it, expect } from 'vitest'
import { closeLoop, polyMul, series, toStateSpace } from './tf.js'
import { lyapunov, ssTrajectory } from './ss.js'
import {
  ALGEBRAIC_LOOP_DECLINED,
  PhaseError,
  equilibria,
  loopRegions,
  lyapunovRate,
  oscillationOf,
  phaseField,
  pwlTrajectory,
  switchingLines,
} from './phase.js'
import { NonlinearError, SMOOTH_DECLINED } from './nonlinear.js'

// The loop the phase plane draws: a first-order plant with a PI controller.
// Two states, so the whole life of the loop is one curve on one picture. The
// controller's state is the integral of the error, and the plant's is its
// output.
const TAU = 1
const KPLANT = 1
const plant = toStateSpace({ b: [KPLANT], a: [TAU, 1] })
const piCtrl = (kp, ki) => ({ A: [[0]], B: [1], C: [ki], D: kp })

const specOf = (kp, ki, delta, reference = 1) => ({
  ctrl: piCtrl(kp, ki),
  plant,
  kind: 'saturation',
  delta,
  reference,
})

describe('the exact trajectory', () => {
  it('is the linear one when the drive never reaches the limit', () => {
    // A limit far above anything the loop asks for: the saturation is never
    // entered, and the walk is the linear closed loop exactly.
    const kp = 1
    const ki = 0.5
    const spec = specOf(kp, ki, 1000)
    const sim = pwlTrajectory(spec, { x0: [0, 0], duration: 20, points: 401 })
    expect(sim.events.length).toBe(0)
    const linear = ssTrajectory(
      toStateSpace(closeLoop(series({ b: [kp, ki], a: [1, 0] }, { b: [KPLANT], a: [TAU, 1] }))),
      () => 1,
      { duration: 20, points: 401 },
    )
    for (let i = 0; i < sim.y.length; i += 10) {
      expect(sim.y[i], `sample ${i}`).toBeCloseTo(linear.y[i], 9)
    }
  })

  it('every event lands exactly on a switching line', () => {
    const spec = specOf(4, 2, 1.5)
    const sim = pwlTrajectory(spec, { x0: [0, 0], duration: 30, points: 3001 })
    expect(sim.events.length).toBeGreaterThan(0)
    for (const e of sim.events) {
      // The nudge past the boundary is one part in 1e12 of a step, so the
      // recorded input is the limit to within that.
      expect(Math.abs(Math.abs(e.u) - spec.delta) / spec.delta, `event at t = ${e.t}`).toBeLessThan(1e-9)
    }
  })

  it('refuses the wrong number of initial states', () => {
    expect(() => pwlTrajectory(specOf(1, 1, 1), { x0: [0], duration: 1 })).toThrow(/needs 2 entries/)
  })

  it('a plant with direct feedthrough is declined, with the reason', () => {
    const spec = {
      ctrl: piCtrl(1, 1),
      plant: { A: [[-1]], B: [1], C: [1], D: 0.5 },
      kind: 'saturation',
      delta: 1,
    }
    let err = null
    try {
      pwlTrajectory(spec, { x0: [0, 0], duration: 1 })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(PhaseError)
    expect(err.code).toBe('algebraic-loop')
    expect(err.message).toBe(ALGEBRAIC_LOOP_DECLINED)
    expect(ALGEBRAIC_LOOP_DECLINED).toMatch(/algebraic loop through a discontinuous slope/)
  })

  it('a smooth nonlinearity is declined in time, with the reason', () => {
    let err = null
    try {
      pwlTrajectory({ ...specOf(1, 1, 1), kind: 'cubic' }, { x0: [0, 0], duration: 1 })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(NonlinearError)
    expect(err.code).toBe('smooth-declined')
    expect(err.message).toBe(SMOOTH_DECLINED)
  })

  it('refining the grid does not change the answer, because there is no step size', () => {
    // The trajectory is exact between events, so asking for more points gives
    // more samples of the same curve rather than a different one.
    const spec = specOf(4, 2, 1.5)
    const coarse = pwlTrajectory(spec, { x0: [0, 0], duration: 20, points: 401 })
    const fine = pwlTrajectory(spec, { x0: [0, 0], duration: 20, points: 4001 })
    for (let i = 0; i < 401; i++) {
      expect(coarse.y[i], `sample ${i}`).toBeCloseTo(fine.y[i * 10], 9)
    }
    // And the events are the same events, to the same instants.
    expect(coarse.events.length).toBe(fine.events.length)
    for (let i = 0; i < coarse.events.length; i++) {
      expect(coarse.events[i].t).toBeCloseTo(fine.events[i].t, 8)
    }
  })
})

describe('windup, in the plane', () => {
  it('a saturating actuator makes the loop overshoot further than the linear one does', () => {
    // The mechanism, measured. While the drive is on its limit the error stays
    // large, so the integrator keeps accumulating, and the loop has to unwind
    // all of that before the output can come back.
    const kp = 2
    const ki = 4
    const withLimit = pwlTrajectory(specOf(kp, ki, 1.5), { x0: [0, 0], duration: 25, points: 2501 })
    const withoutLimit = pwlTrajectory(specOf(kp, ki, 1e6), { x0: [0, 0], duration: 25, points: 2501 })
    const peak = (y) => Math.max(...y)
    expect(peak(withLimit.y)).toBeGreaterThan(peak(withoutLimit.y))
    // Both still arrive at the reference: the saturation costs time and
    // overshoot, not the steady state, because the integrator is still there
    // and the limit is above the drive the loop needs to hold.
    expect(withLimit.y[withLimit.y.length - 1]).toBeCloseTo(1, 5)
    expect(withoutLimit.y[withoutLimit.y.length - 1]).toBeCloseTo(1, 5)
    // And the integrator state goes further out with the limit in place.
    const maxState = (sim) => Math.max(...sim.x.map((z) => z[0]))
    expect(maxState(withLimit)).toBeGreaterThan(maxState(withoutLimit))
  })

  it('a tighter limit winds the integrator further, every time', () => {
    const rows = [4, 1.5, 1.2, 1.05].map((delta) => {
      const sim = pwlTrajectory(specOf(2, 4, delta), { x0: [0, 0], duration: 40, points: 4001 })
      return { delta, peak: Math.max(...sim.y), wind: Math.max(...sim.x.map((z) => z[0])) }
    })
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].wind, `delta = ${rows[i].delta}`).toBeGreaterThan(rows[i - 1].wind)
    }
  })

  it('the overshoot rises with the limit and then falls again, and the reason is not windup', () => {
    // Worth recording, because "tighter limit, worse overshoot" is the
    // obvious rule and it is false at the tight end. Once the limit is close
    // to the drive the loop needs to hold, the actuator is what sets the
    // approach speed, the output arrives slowly, and it arrives with little
    // overshoot. The integrator is still winding further the whole time, so
    // the two effects part company.
    const peakAt = (delta) =>
      Math.max(...pwlTrajectory(specOf(2, 4, delta), { x0: [0, 0], duration: 40, points: 4001 }).y)
    expect(peakAt(1.5)).toBeGreaterThan(peakAt(4))
    expect(peakAt(1.2)).toBeGreaterThan(peakAt(1.5))
    expect(peakAt(1.05)).toBeLessThan(peakAt(1.2))
  })

  it('an actuator too small for the reference has nowhere to rest, and the integrator does not stop', () => {
    // The drive the loop needs to hold y at 1 is 1 / K. With a limit below
    // that, no state of the loop is a resting point: the output stops at
    // K times the limit and the integrator keeps accumulating the error that
    // remains.
    const spec = specOf(2, 4, 0.5)
    expect(equilibria(spec).every((e) => !e.real)).toBe(true)
    const short = pwlTrajectory(spec, { x0: [0, 0], duration: 20, points: 2001 })
    const long = pwlTrajectory(spec, { x0: [0, 0], duration: 40, points: 4001 })
    expect(short.y[short.y.length - 1]).toBeCloseTo(KPLANT * spec.delta, 6)
    expect(long.y[long.y.length - 1]).toBeCloseTo(KPLANT * spec.delta, 6)
    // Twice the time, about twice the wind: the integrator is ramping.
    const wind = (sim) => sim.x[sim.x.length - 1][0]
    expect(wind(long) / wind(short)).toBeGreaterThan(1.8)
  })
})

describe('the picture the plane draws', () => {
  it('the switching lines are where the drive reaches its limit', () => {
    const spec = specOf(2, 4, 1.5)
    const lines = switchingLines(spec)
    expect(lines.length).toBe(2)
    const L = loopRegions(spec)
    // A point on the upper line has u exactly at the limit.
    // a*x + b*y = c, so pick x = 0 and solve for y (b is nonzero here).
    for (const line of lines) {
      const y = line.c / line.b
      expect(L.uOf([0, y])).toBeCloseTo(line.level, 9)
    }
  })

  it('the field changes slope across a switching line, and matches the state equation', () => {
    const spec = specOf(2, 4, 0.5)
    const field = phaseField(spec, { xMin: -1, xMax: 2, yMin: -1, yMax: 2, nx: 9, ny: 9 })
    expect(field.arrows.length).toBe(81)
    expect(new Set(field.arrows.map((a) => a.region)).size).toBeGreaterThan(1)
    // Each arrow is the exact derivative at its point, which is what the
    // trajectory integrates.
    const L = loopRegions(spec)
    for (const arrow of field.arrows.slice(0, 12)) {
      const { M, m } = L.regions[String(arrow.region)]
      expect(arrow.dx).toBeCloseTo(M[0][0] * arrow.x + M[0][1] * arrow.y + m[0], 12)
      expect(arrow.dy).toBeCloseTo(M[1][0] * arrow.x + M[1][1] * arrow.y + m[1], 12)
    }
  })

  it('a loop with more than two states is declined for the plane, by name', () => {
    const three = toStateSpace({ b: [1], a: polyMul(polyMul([1, 1], [0.5, 1]), [0.25, 1]) })
    expect(() =>
      phaseField({ ctrl: piCtrl(1, 1), plant: three, kind: 'saturation', delta: 1 }, { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }),
    ).toThrow(/phase plane draws two states, and this loop has 4/)
  })

  it('the resting point is where the loop settles, and the saturated ones are virtual', () => {
    const spec = specOf(2, 4, 1.5)
    const eq = equilibria(spec)
    const real = eq.filter((e) => e.real)
    expect(real.length).toBe(1)
    expect(real[0].region).toBe(0)
    // With an integrator the loop settles with y at the reference exactly, so
    // the plant state is 1 and the drive is 1 / K.
    const settled = pwlTrajectory(spec, { x0: [0, 0], duration: 60, points: 3001 })
    expect(settled.y[settled.y.length - 1]).toBeCloseTo(1, 6)
    expect(real[0].point[1]).toBeCloseTo(1, 9)
    // The saturated regions' resting points sit outside the regions they
    // belong to, so they are not resting points of the loop.
    for (const e of eq.filter((x) => x.region !== 0)) expect(e.real).toBe(false)
  })
})

describe('the Lyapunov argument', () => {
  it('V falls along every trajectory inside the linear region, and V-dot is exactly -z Q z', () => {
    const spec = specOf(2, 4, 1e6) // never saturates: the linear region is all of it
    const L = loopRegions(spec)
    const Q = [
      [1, 0],
      [0, 1],
    ]
    const P = lyapunov(L.regions['0'].M, Q)
    // P must be positive definite for V to be a Lyapunov function at all.
    expect(P[0][0]).toBeGreaterThan(0)
    expect(P[0][0] * P[1][1] - P[0][1] * P[1][0]).toBeGreaterThan(0)
    // Inside the linear region, V-dot is exactly -z Q z. Measured at points,
    // not asserted from the equation that produced P: the reference is
    // computed from Q, and the rate from the state equation.
    // The reference is set to zero here so the origin is the equilibrium.
    const home = { ...spec, reference: 0 }
    const homeL = loopRegions(home)
    const homeP = lyapunov(homeL.regions['0'].M, Q)
    for (const z of [[1, 0], [0, 1], [0.4, -0.7], [-2, 3]]) {
      const { V, Vdot } = lyapunovRate(home, homeP, z)
      expect(V).toBeGreaterThan(0)
      const want = -(z[0] * z[0] + z[1] * z[1])
      expect(Vdot, `at ${z}`).toBeCloseTo(want, 9)
    }
  })

  it('V really does fall along the simulated trajectory', () => {
    const home = { ...specOf(2, 4, 1e6), reference: 0 }
    const L = loopRegions(home)
    const P = lyapunov(L.regions['0'].M, [
      [1, 0],
      [0, 1],
    ])
    const sim = pwlTrajectory(home, { x0: [1, 1], duration: 15, points: 601 })
    let prev = Infinity
    for (let i = 0; i < sim.x.length; i += 20) {
      const { V } = lyapunovRate(home, P, sim.x[i])
      expect(V, `sample ${i}`).toBeLessThan(prev)
      prev = V
    }
  })

  it('the guarantee stops at the switching line, and the rate says where', () => {
    // With the limit in place, the same V is still positive, but its rate is
    // no longer -z Q z outside the linear region. The function reports which
    // region each point is in, so a pane can shade where the argument holds.
    const home = { ...specOf(2, 4, 0.4), reference: 0 }
    const linear = loopRegions({ ...home, delta: 1e6 })
    const P = lyapunov(linear.regions['0'].M, [
      [1, 0],
      [0, 1],
    ])
    const inside = lyapunovRate(home, P, [0.05, 0.02])
    expect(inside.region).toBe(0)
    expect(inside.Vdot).toBeCloseTo(-(0.05 * 0.05 + 0.02 * 0.02), 9)
    const outside = lyapunovRate(home, P, [3, -2])
    expect(outside.region).not.toBe(0)
    expect(outside.Vdot).not.toBeCloseTo(-(9 + 4), 3)
  })
})

describe('measuring an oscillation', () => {
  it('reads back the amplitude and period of a clean sine', () => {
    const t = Float64Array.from({ length: 4001 }, (_, i) => (i * 20) / 4000)
    const y = Float64Array.from(t, (tv) => 0.3 + 2.5 * Math.sin(3 * tv + 0.4))
    const osc = oscillationOf(t, y, { tailFraction: 0.5 })
    expect(osc.amplitude).toBeCloseTo(2.5, 2)
    expect(osc.omega).toBeCloseTo(3, 3)
    expect(osc.settled).toBeLessThan(1e-3)
  })

  it('returns null for a trace that never crosses its own mean three times', () => {
    const t = Float64Array.from({ length: 200 }, (_, i) => i * 0.1)
    const y = Float64Array.from(t, (tv) => 1 - Math.exp(-tv))
    expect(oscillationOf(t, y)).toBeNull()
  })
})
