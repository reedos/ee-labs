import { describe, it, expect } from 'vitest'
import { PLANTS, PLANT_GROUPS, CONTROLLERS, buildLoop, defaultsOf } from './systems.js'
import {
  dcGain,
  magnitudeAt,
  phaseAt,
  bode,
  polesZeros,
  isStable,
  margins,
  secondOrderMetrics,
  stepResponse,
  roots,
} from '@ee-labs/systems'

// Each plant and controller is checked against what it must do, not against its
// formula being retyped: where its poles are, what it does at DC and at high
// frequency, and — for the controllers — how much phase it adds or spends.

const GRID = Float64Array.from({ length: 6000 }, (_, i) => Math.pow(10, -4 + 8 * (i / 5999)))
const deg = (r) => (r * 180) / Math.PI

describe('the registries', () => {
  it('every plant declares a group, params and a formula', () => {
    for (const [id, p] of Object.entries(PLANTS)) {
      expect(PLANT_GROUPS, id).toContain(p.group)
      expect(p.params.length, id).toBeGreaterThan(0)
      expect(p.tex, id).toBeTruthy()
      const tf = p.tf(defaultsOf(p))
      expect(tf.a.length, id).toBeGreaterThan(0)
      expect(Number.isFinite(magnitudeAt(tf, 1)), id).toBe(true)
    }
  })

  it('every controller produces a finite response', () => {
    for (const [id, c] of Object.entries(CONTROLLERS)) {
      const tf = c.tf(defaultsOf(c))
      for (const f of [0.01, 1, 100]) {
        expect(Number.isFinite(magnitudeAt(tf, f)), `${id} at ${f}`).toBe(true)
      }
    }
  })
})

describe('plants behave as their physics demands', () => {
  it('a first-order lag has one real pole and cannot be destabilised', () => {
    const p = PLANTS.firstOrder
    const tf = p.tf({ k: 2, tau: 0.5 })
    expect(dcGain(tf)).toBeCloseTo(2, 12)
    const { poles } = polesZeros(tf)
    expect(poles).toHaveLength(1)
    expect(poles[0][0]).toBeCloseTo(-2, 9) // -1/tau
    expect(poles[0][1]).toBe(0)

    // However hard it is driven, one pole cannot reach the right half plane.
    for (const kp of [1, 10, 1000]) {
      const { closed } = buildLoop('firstOrder', { k: 2, tau: 0.5 }, 'p', { kp })
      expect(isStable(closed), `kp=${kp}`).toBe(true)
    }
  })

  it('an integrator has its pole at the origin and infinite DC gain', () => {
    const tf = PLANTS.integrator.tf({ k: 1 })
    expect(polesZeros(tf).poles[0][0]).toBeCloseTo(0, 12)
    expect(magnitudeAt(tf, 1e-6)).toBeGreaterThan(1e5)
    // ...which is what makes proportional control alone give zero error.
    const { closed } = buildLoop('integrator', { k: 1 }, 'p', { kp: 3 })
    expect(dcGain(closed)).toBeCloseTo(1, 9)
  })

  it('a second-order plant resonates at its stated frequency and damping', () => {
    const tf = PLANTS.secondOrder.tf({ k: 1, wn: 10, zeta: 0.2 })
    const m = secondOrderMetrics(tf)
    expect(m.wn).toBeCloseTo(10, 9)
    expect(m.zeta).toBeCloseTo(0.2, 9)
    expect(dcGain(tf)).toBeCloseTo(1, 12)
    // Lightly damped, so the response peaks near wn at about Q.
    expect(magnitudeAt(tf, 10 / (2 * Math.PI))).toBeCloseTo(1 / (2 * 0.2), 6)
  })

  it('three lags can reach -180 degrees, and one lag never can', () => {
    // This is the whole reason the three-lag plant is in the "hard" group.
    const three = PLANTS.threePole.tf({ k: 1, t1: 1, t2: 0.5, t3: 0.25 })
    const one = PLANTS.firstOrder.tf({ k: 1, tau: 1 })
    // bode() unwraps; phaseAt() does not, and a phase of -270 comes back from
    // atan2 as +90. For a claim about how far the phase has FALLEN, only the
    // unwrapped version means anything.
    const endPhase = (tf) => deg(bode(tf, GRID).phase[GRID.length - 1])
    expect(endPhase(three)).toBeLessThan(-260)
    expect(endPhase(one)).toBeGreaterThan(-91)

    // So a proportional loop around it goes unstable at high enough gain...
    expect(isStable(buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 1 }).closed)).toBe(true)
    expect(isStable(buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 100 }).closed)).toBe(false)
  })

  it('the unstable plant starts in the right half plane and needs ENOUGH gain', () => {
    const tf = PLANTS.unstable.tf({ k: 1, p: 2 })
    expect(polesZeros(tf).poles[0][0]).toBeCloseTo(2, 9)
    expect(isStable(tf)).toBe(false)

    // Feedback is not an improvement here, it is the only reason it works —
    // and the failure mode is inverted: too little gain, not too much.
    expect(isStable(buildLoop('unstable', { k: 1, p: 2 }, 'p', { kp: 0.5 }).closed)).toBe(false)
    expect(isStable(buildLoop('unstable', { k: 1, p: 2 }, 'p', { kp: 5 }).closed)).toBe(true)
  })
})

describe('controllers do what they are for', () => {
  it('proportional control leaves steady-state error unless the plant integrates', () => {
    // No integrator anywhere: the error cannot reach zero, because zero error
    // would mean zero output.
    const { closed } = buildLoop('firstOrder', { k: 1, tau: 1 }, 'p', { kp: 9 })
    expect(dcGain(closed)).toBeCloseTo(9 / 10, 9)
    expect(dcGain(closed)).toBeLessThan(1)
  })

  it('PI removes it, exactly', () => {
    const { closed } = buildLoop('firstOrder', { k: 1, tau: 1 }, 'pi', { kp: 1, ki: 1 })
    expect(dcGain(closed)).toBeCloseTo(1, 9)
    const { y } = stepResponse(closed, { duration: 40, points: 3000 })
    expect(y[y.length - 1]).toBeCloseTo(1, 3)
  })

  it('the integrator in PI costs phase, and derivative action buys it back', () => {
    const at = (id, params) => deg(phaseAt(CONTROLLERS[id].tf(params), 1))
    // Proportional is flat: no phase at all.
    expect(at('p', { kp: 1 })).toBeCloseTo(0, 9)
    // PI lags, approaching -90 as the integral term dominates.
    expect(at('pi', { kp: 1, ki: 100 })).toBeLessThan(-70)
    // PID with strong derivative leads instead.
    expect(at('pid', { kp: 1, ki: 0.01, kd: 10 })).toBeGreaterThan(70)
  })

  it('a lead network adds phase between its zero and its pole', () => {
    const c = CONTROLLERS.lead.tf({ k: 1, z: 1, p: 100 })
    // Maximum lead sits at the geometric mean of z and p.
    const wMax = Math.sqrt(1 * 100) / (2 * Math.PI)
    const lead = deg(phaseAt(c, wMax))
    expect(lead).toBeGreaterThan(0)
    // For z:p of 1:100 the peak lead is about 78.6 degrees.
    expect(lead).toBeCloseTo(78.6, 0)
    // And it flattens out either side.
    expect(deg(phaseAt(c, 1e-4))).toBeCloseTo(0, 1)
    expect(deg(phaseAt(c, 1e4))).toBeCloseTo(0, 0)
  })
})

describe('the loop as a whole', () => {
  it('more proportional gain spends phase margin and buys speed', () => {
    let lastPm = Infinity
    let lastRise = Infinity
    for (const kp of [0.5, 2, 8]) {
      const { open, closed } = buildLoop('motor', { k: 1, tau: 0.5 }, 'p', { kp })
      const m = margins(open, GRID)
      expect(m.phaseMargin, `kp=${kp}`).toBeLessThan(lastPm)
      lastPm = m.phaseMargin

      // Faster: the closed loop reaches 90% of its target sooner.
      const { t, y } = stepResponse(closed, { duration: 20, points: 4000 })
      let rise = Infinity
      for (let i = 0; i < y.length; i++) if (y[i] >= 0.9) { rise = t[i]; break }
      expect(rise, `kp=${kp}`).toBeLessThan(lastRise)
      lastRise = rise
    }
  })

  it('a low phase margin means a lively step response', () => {
    // The link between the frequency-domain margin and the time-domain
    // overshoot, which is the single most useful rule of thumb in the subject.
    const loose = buildLoop('motor', { k: 1, tau: 0.5 }, 'p', { kp: 0.4 })
    const tight = buildLoop('motor', { k: 1, tau: 0.5 }, 'p', { kp: 20 })
    const pmLoose = margins(loose.open, GRID).phaseMargin
    const pmTight = margins(tight.open, GRID).phaseMargin
    expect(pmTight).toBeLessThan(pmLoose)

    const peak = (tf) => {
      const { y } = stepResponse(tf, { duration: 30, points: 4000 })
      return Math.max(...y)
    }
    expect(peak(tight.closed)).toBeGreaterThan(peak(loose.closed))
    // Roughly: phase margin in degrees ~= 100 * zeta for a second-order loop.
    const z = secondOrderMetrics(tight.closed).zeta
    expect(pmTight / 100).toBeCloseTo(z, 1)
  })

  it('the gain margin says exactly how much further the gain can go', () => {
    const plant = { k: 1, t1: 1, t2: 0.5, t3: 0.25 }
    const { open } = buildLoop('threePole', plant, 'p', { kp: 1 })
    const gm = margins(open, GRID).gainMargin
    expect(gm).toBeGreaterThan(1)

    // Just inside it, stable; just outside, not. That is what the number means.
    expect(isStable(buildLoop('threePole', plant, 'p', { kp: gm * 0.95 }).closed)).toBe(true)
    expect(isStable(buildLoop('threePole', plant, 'p', { kp: gm * 1.05 }).closed)).toBe(false)
  })
})

describe('the disturbance path', () => {
  // Gd = P/(1+CP): what the output does when a step lands on the plant input.
  it('has DC gain P(0)/(1+L(0)) under proportional control — shrunk, not removed', () => {
    const { plant, open, disturbance } = buildLoop(
      'firstOrder',
      { k: 2, tau: 1 },
      'p',
      { kp: 9 },
    )
    const want = dcGain(plant) / (1 + dcGain(open))
    expect(dcGain(disturbance)).toBeCloseTo(want, 12)
    expect(want).toBeCloseTo(2 / 19, 12)
  })

  it('is erased EXACTLY at DC by an integrator in the controller', () => {
    for (const [plantId, pp] of [
      ['firstOrder', { k: 2, tau: 1 }],
      ['secondOrder', { k: 1, wn: 6.283, zeta: 0.3 }],
      ['threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }],
    ]) {
      const { disturbance } = buildLoop(plantId, pp, 'pi', { kp: 1, ki: 1 })
      // Exactly zero: the numerator Pb·Ca carries the controller's pole at the
      // origin as a factor of s, so this is algebra, not a small number.
      expect(dcGain(disturbance), plantId).toBe(0)
    }
  })

  // One loop, one characteristic polynomial. However the loop is poked —
  // reference or disturbance — the poles are the same, so the two responses
  // ring at the same frequencies and decay at the same rates.
  it('shares its poles with the closed loop exactly', () => {
    const { closed, disturbance } = buildLoop(
      'secondOrder',
      { k: 1, wn: 10, zeta: 0.2 },
      'pid',
      { kp: 2, ki: 1, kd: 0.1 },
    )
    const a = roots(closed.a).sort((p, q) => p[0] - q[0] || p[1] - q[1])
    const b = roots(disturbance.a).sort((p, q) => p[0] - q[0] || p[1] - q[1])
    expect(b).toHaveLength(a.length)
    for (let i = 0; i < a.length; i++) {
      expect(b[i][0], `pole ${i} re`).toBeCloseTo(a[i][0], 8)
      expect(b[i][1], `pole ${i} im`).toBeCloseTo(a[i][1], 8)
    }
  })

  it('simulates to a nonzero settle under P and back to zero under PI', () => {
    const p = { k: 2, tau: 0.5 }
    const settled = (ctrl, cp) => {
      const { disturbance } = buildLoop('firstOrder', p, ctrl, cp)
      const { y } = stepResponse(disturbance, { duration: 30, points: 600 })
      return y[y.length - 1]
    }
    expect(settled('p', { kp: 9 })).toBeCloseTo(2 / 19, 4)
    expect(Math.abs(settled('pi', { kp: 2, ki: 2 }))).toBeLessThan(1e-4)
  })
})
