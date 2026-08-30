import { describe, it, expect } from 'vitest'
import { simulate, dcGain } from '@ee-labs/systems'
import { PLANTS, CONTROLLERS, buildLoop, defaultsOf } from './systems.js'
import { paneRange, watchSignals } from './watch.js'

// The watch view claims to show the loop's ACTUAL internals — the error the
// controller sees, the effort it answers with. Each claim is measured by an
// independent path:
//
//   - e comes from simulating S = 1/(1+L); r − y comes from simulating T.
//     Two separate RK4 runs on two separately-built polynomials must agree.
//   - u is rebuilt from the gains acting on e; feeding it (plus the shove)
//     through the PLANT alone must reproduce the closed loop's output, or
//     the "effort" curve is a picture of nothing.

const loopOf = (plantId, ctrlId, ctrlOver = {}) =>
  buildLoop(plantId, defaultsOf(PLANTS[plantId]), ctrlId, {
    ...defaultsOf(CONTROLLERS[ctrlId]),
    ...ctrlOver,
  })

const OPTS = { duration: 12, points: 900 }
const last = (a) => a[a.length - 1]
const maxAbsDiff = (a, b, from = 0) => {
  let m = 0
  for (let i = from; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]))
  return m
}

describe('the error trace is the loop’s real error', () => {
  it('e simulated through S agrees with r − y simulated through T', () => {
    for (const [plantId, ctrlId] of [
      ['firstOrder', 'p'],
      ['motor', 'pi'],
      ['threePole', 'lead'],
      ['secondOrder', 'pid'],
    ]) {
      const loop = loopOf(plantId, ctrlId)
      const w = watchSignals(loop, ctrlId, defaultsOf(CONTROLLERS[ctrlId]), 'ref', OPTS)
      const viaT = Float64Array.from(w.y, (v) => 1 - v)
      expect(maxAbsDiff(w.e, viaT), `${plantId} + ${ctrlId}`).toBeLessThan(1e-6)
    }
  })

  it('under a shove the error is −y: nothing was asked for, everything seen is error', () => {
    const loop = loopOf('firstOrder', 'pi')
    const w = watchSignals(loop, 'pi', defaultsOf(CONTROLLERS.pi), 'dist', OPTS)
    const negY = Float64Array.from(w.y, (v) => -v)
    expect(maxAbsDiff(w.e, negY)).toBeLessThan(1e-6)
  })
})

describe('the effort trace really drives the plant', () => {
  // The two-path check that makes the bottom pane an exhibit rather than a
  // drawing: u rebuilt from the gains, pushed through the PLANT alone, must
  // reproduce the closed loop's own output. (PID is excluded: its ideal
  // derivative adds an impulse at the step edge that samples cannot carry —
  // the canvas marks the kick instead of pretending.)
  const rebuild = (plantId, ctrlId, stepInput, ctrlOver = {}) => {
    const loop = loopOf(plantId, ctrlId, ctrlOver)
    const ctrlP = { ...defaultsOf(CONTROLLERS[ctrlId]), ...ctrlOver }
    const w = watchSignals(loop, ctrlId, ctrlP, stepInput, OPTS)
    const uIn = (tv) => {
      const f = (tv - w.t[0]) / (w.t[w.t.length - 1] - w.t[0])
      const i = Math.max(0, Math.min(w.t.length - 2, Math.floor(f * (w.t.length - 1))))
      const s = (tv - w.t[i]) / (w.t[i + 1] - w.t[i])
      const u = w.u[i] + s * (w.u[i + 1] - w.u[i])
      return u + (stepInput === 'dist' ? 1 : 0)
    }
    const yRebuilt = simulate(loop.plant, uIn, OPTS).y
    return { w, yRebuilt }
  }

  it('P, PI and lead efforts reproduce the output through the bare plant', () => {
    for (const [plantId, ctrlId, stepInput] of [
      ['firstOrder', 'p', 'ref'],
      ['firstOrder', 'pi', 'ref'],
      ['motor', 'pi', 'ref'],
      ['threePole', 'lead', 'ref'],
      ['firstOrder', 'pi', 'dist'],
    ]) {
      const { w, yRebuilt } = rebuild(plantId, ctrlId, stepInput)
      // Skip the first few samples: the interpolated u cannot represent its
      // own t=0 edge to RK4's sub-steps.
      expect(maxAbsDiff(w.y, yRebuilt, 5), `${plantId} + ${ctrlId} (${stepInput})`).toBeLessThan(5e-3)
    }
  })
})

describe('the pane framing never loses the trace', () => {
  // The defect this rules out shipped: a diverging watch pane was clamped to
  // ±4 and both traces simply left the picture. Now a runaway frames what
  // has happened up to the cursor, on a doubling ladder.
  const runaway = Float64Array.from({ length: 500 }, (_, i) => Math.exp(i / 40))

  it('a stable pane is framed whole, once — the cursor cannot move the axis', () => {
    const y = Float64Array.from({ length: 500 }, (_, i) => 1 - Math.exp(-i / 60))
    const full = paneRange([y], { floor: 1 })
    for (const upTo of [10, 100, 499]) {
      expect(paneRange([y], { floor: 1, upTo, diverges: false })).toEqual(full)
    }
  })

  it('a runaway keeps everything shown so far inside the frame, at every cursor', () => {
    for (const upTo of [5, 50, 150, 300, 499]) {
      const r = paneRange([runaway], { floor: 1, upTo, diverges: true })
      let seen = 0
      for (let i = 0; i <= upTo; i++) seen = Math.max(seen, runaway[i])
      expect(r.hi, `cursor ${upTo}`).toBeGreaterThanOrEqual(seen)
      // ...and the frame stays proportionate: within one doubling plus pad,
      // so the early mechanism is never crushed by a range fit to nothing.
      expect(r.hi, `cursor ${upTo}`).toBeLessThan(seen * 2.4 + 2)
    }
  })

  it('the ladder holds still between rungs — small scrubs do not move the axis', () => {
    const a = paneRange([runaway], { floor: 1, upTo: 200, diverges: true })
    const b = paneRange([runaway], { floor: 1, upTo: 205, diverges: true })
    expect(b).toEqual(a)
    const far = paneRange([runaway], { floor: 1, upTo: 400, diverges: true })
    expect(far.hi).toBeGreaterThan(a.hi)
  })

  it('a runaway downward is framed too', () => {
    const down = Float64Array.from(runaway, (v) => -v)
    const r = paneRange([down], { floor: 1, upTo: 300, diverges: true })
    let worst = 0
    for (let i = 0; i <= 300; i++) worst = Math.min(worst, down[i])
    expect(r.lo).toBeLessThanOrEqual(worst)
  })
})

describe('what the parts show is the story the lessons tell', () => {
  it('P alone: at the end the effort is all proportional, and it is not zero', () => {
    const loop = loopOf('firstOrder', 'p', { kp: 9 })
    const w = watchSignals(loop, 'p', { kp: 9 }, 'ref', { duration: 30, points: 900 })
    expect(last(w.e)).toBeCloseTo(0.1, 3)
    expect(last(w.u)).toBeCloseTo(0.9, 3) // kp·e∞ — the drive holding the plant
  })

  it('PI: the integrator ends up holding ALL of the effort, the P part none', () => {
    const loop = loopOf('firstOrder', 'pi')
    const w = watchSignals(loop, 'pi', defaultsOf(CONTROLLERS.pi), 'ref', {
      duration: 60,
      points: 1200,
    })
    const iPart = w.parts.find((p) => p.key === 'i')
    const pPart = w.parts.find((p) => p.key === 'p')
    expect(last(w.e)).toBeCloseTo(0, 2)
    expect(last(pPart.y)).toBeCloseTo(0, 2)
    // u∞ must hold y at 1 through the plant: u∞ = y∞ / P(0).
    expect(last(iPart.y)).toBeCloseTo(1 / dcGain(loop.plant), 2)
  })

  it('PI against a shove: the integral winds up to exactly minus the shove', () => {
    const loop = loopOf('firstOrder', 'pi')
    const w = watchSignals(loop, 'pi', defaultsOf(CONTROLLERS.pi), 'dist', {
      duration: 60,
      points: 1200,
    })
    expect(last(w.y)).toBeCloseTo(0, 2)
    expect(last(w.u)).toBeCloseTo(-1, 2) // the controller cancels d = 1 exactly
    expect(w.kick).toBeNull()
  })

  it('PID marks the derivative kick on a reference step, and only there', () => {
    const loop = loopOf('secondOrder', 'pid')
    const ref = watchSignals(loop, 'pid', defaultsOf(CONTROLLERS.pid), 'ref', OPTS)
    const dist = watchSignals(loop, 'pid', defaultsOf(CONTROLLERS.pid), 'dist', OPTS)
    expect(ref.kick).toBeTruthy()
    expect(dist.kick).toBeNull()
    // The smooth part of Kd·ė stays finite even at the edge samples.
    const dPart = ref.parts.find((p) => p.key === 'd')
    for (const v of dPart.y) expect(Number.isFinite(v)).toBe(true)
  })

  it('every plant × controller produces finite signals of matching length', () => {
    for (const plantId of Object.keys(PLANTS)) {
      for (const ctrlId of Object.keys(CONTROLLERS)) {
        const loop = loopOf(plantId, ctrlId)
        for (const stepInput of ['ref', 'dist']) {
          const w = watchSignals(loop, ctrlId, defaultsOf(CONTROLLERS[ctrlId]), stepInput, {
            duration: 8,
            points: 300,
          })
          const label = `${plantId} + ${ctrlId} (${stepInput})`
          expect(w.u.length, label).toBe(w.t.length)
          expect(w.e.length, label).toBe(w.t.length)
          for (const p of w.parts) expect(p.y.length, label).toBe(w.t.length)
        }
      }
    }
  })
})
