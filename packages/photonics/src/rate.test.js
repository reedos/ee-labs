import { describe, it, expect } from 'vitest'
import {
  DEPTH_DECLINE,
  DEPTH_WARN,
  LASER_CHIP,
  LASER_DEFAULTS,
  depthGuard,
  largeSignalAvailable,
  laserSpec,
  linearStep,
  modulationAt,
  modulationPhase,
  rateTerms,
  refuseLargeSignal,
  smallSignal,
  steadyState,
  stepOvershoot,
  threshold,
} from './rate.js'
import { PhotonicsError, Q_E } from './const.js'
import { mirrorLoss, photonLifetime } from './cavity.js'
import { logUniform, randomCoupledLaser, randomLaser, relative, rng } from './fuzz.js'

// The rate equations. `PHOTONICS_LAB_PLAN.md` §2.11 invariants 4 to 8 are the
// spine of this file, and each is named beside the test that measures it.
//
// Nothing below compares the module against a second expression of the same
// formula. Invariant 4 substitutes the returned densities back into the two
// equations the module's own header writes, and asks the sums to be zero
// against the largest term in each, which is the arithmetic's own floor.
// Invariant 6 differences the steady-state curve and compares the slope with
// the linearisation's low-frequency gain. Invariant 8 integrates the pair and
// compares the overshoot with what the linear answer predicted. Each is a
// measurement of the thing, not a restatement of it.
//
// One correction to the plan is measured here rather than asserted. The plan's
// §2.6 quotes the textbook relaxation frequency, which drops the transparency
// density. `smallSignal` returns the exact one and the textbook one side by
// side, and the ratio between them is exactly the square root of
// Gamma g0 N_th tau_p, which the last test in the linearisation block pins.

const S = LASER_DEFAULTS

/** The two equations, written out again from the plan, for substituting back into. */
const dN = (s, n, ph, current) => current / (Q_E * s.V) - n / s.tauC - s.g0 * (n - s.ntr) * ph
const dS = (s, n, ph) => s.gamma * s.g0 * (n - s.ntr) * ph - ph / s.tauP + (s.gamma * s.beta * n) / s.tauC

describe('the laser is one chip, and its photon lifetime is that chip’s', () => {
  it('the facet reflectance is computed from the index, not typed', () => {
    expect(LASER_CHIP.r).toBeCloseTo(((3.5 - 1) / (3.5 + 1)) ** 2, 15)
  })

  it('the photon lifetime is the cavity’s mirror loss, in the plan’s convention', () => {
    // Group C turns this reflectance and reads a threshold. Group F turns the
    // same reflectance and reads a free spectral range. One number, two panes.
    const alpha = Math.log(1 / LASER_CHIP.r) / (2 * LASER_CHIP.L)
    expect(relative(mirrorLoss(LASER_CHIP), alpha)).toBeLessThan(1e-15)
    expect(relative(S.tauP, photonLifetime(LASER_CHIP).tauP)).toBeLessThan(1e-15)
    expect(S.tauP).toBeCloseTo(1.9862e-12, 16)
  })

  it('the other convention, where a round trip loses R, doubles the loss and moves the threshold', () => {
    // The brief tells this lane to check its threshold against the convention
    // before pinning one. Here is the check, as a number rather than a note.
    const halved = threshold({ tauP: S.tauP / 2 })
    expect(halved.ith * 1e3).toBeCloseTo(18.766, 3)
    expect(threshold().ith * 1e3).toBeCloseTo(13.389, 3)
  })
})

describe('the threshold is algebra over the six parameters', () => {
  it('the plan’s laser reaches threshold at the density and the current it quotes', () => {
    const t = threshold()
    // Both recomputed from the parameters rather than typed, then read to the
    // figures the lessons quote.
    expect(relative(t.nth, S.ntr + 1 / (S.gamma * S.g0 * S.tauP))).toBeLessThan(1e-15)
    expect(relative(t.ith, (Q_E * S.V * t.nth) / S.tauC)).toBeLessThan(1e-15)
    expect(t.nth).toBeCloseTo(1.67129e24, -20)
    expect(t.ith * 1e3).toBeCloseTo(13.389, 3)
  })

  it('the gain at threshold is exactly one photon lifetime, over random lasers', () => {
    const r = rng(0x5a71)
    for (let k = 0; k < 200; k++) {
      const spec = randomLaser(r)
      const t = threshold(spec)
      expect(relative(spec.gamma * spec.g0 * (t.nth - spec.ntr), 1 / spec.tauP)).toBeLessThan(1e-14)
      expect(relative(t.gth, 1 / spec.tauP)).toBeLessThan(1e-15)
    }
  })

  it('a parameter outside its meaning is refused by name', () => {
    expect(() => threshold({ gamma: 0 })).toThrow(/confinement factor must be above zero/)
    expect(() => threshold({ g0: 0 })).toThrow(/g0 must be a positive number/)
    expect(() => threshold({ beta: 1 })).toThrow(/below one/)
    expect(() => steadyState({ current: -1 })).toThrow(PhotonicsError)
  })
})

// ---------------------------------------------------------------- invariant 4

describe('invariant 4: the steady state satisfies the equations', () => {
  it('both derivatives are zero at what the module returns, at ten currents above threshold', () => {
    const t = threshold()
    for (let k = 1; k <= 10; k++) {
      const current = t.ith * (1 + k / 2)
      const x = steadyState({ current })
      expect(Math.abs(dN(x.spec, x.n, x.s, current))).toBeLessThan(1e-13 * Math.abs(current / (Q_E * x.spec.V)))
      expect(Math.abs(dS(x.spec, x.n, x.s))).toBeLessThan(1e-13 * Math.abs(x.s / x.spec.tauP))
    }
  })

  it('the same holds over random lasers, above and below threshold', () => {
    const r = rng(0x11e5)
    for (let k = 0; k < 160; k++) {
      const spec = randomLaser(r)
      const t = threshold(spec)
      const current = t.ith * logUniform(r, 0.1, 20)
      const x = steadyState({ ...spec, current })
      const pump = current / (Q_E * spec.V)
      const loss = Math.max(x.s / spec.tauP, 1e-300)
      expect(Math.abs(dN(spec, x.n, x.s, current)) / pump, `carriers at ${current}`).toBeLessThan(1e-12)
      expect(Math.abs(dS(spec, x.n, x.s)) / loss, `photons at ${current}`).toBeLessThan(1e-11)
    }
  })

  it('a spontaneous coupling above zero is still an exact solution, and it softens the corner', () => {
    const r = rng(0x2c0f)
    for (let k = 0; k < 120; k++) {
      const spec = randomCoupledLaser(r)
      const t = threshold(spec)
      const current = t.ith * logUniform(r, 0.2, 8)
      const x = steadyState({ ...spec, current })
      const pump = current / (Q_E * spec.V)
      expect(Math.abs(dN(spec, x.n, x.s, current)) / pump).toBeLessThan(1e-11)
      expect(Math.abs(dS(spec, x.n, x.s)) / (x.s / spec.tauP)).toBeLessThan(1e-9)
      // With any coupling at all the device emits below threshold, which is
      // what makes the turn-on a bend rather than a corner.
      expect(x.s).toBeGreaterThan(0)
    }
  })

  it('at zero coupling the plan’s two closed forms are exactly what it returns', () => {
    const t = threshold()
    for (const k of [0.3, 0.9, 1.5, 2, 4]) {
      const current = k * t.ith
      const x = steadyState({ current })
      const carriersIfDark = (current * S.tauC) / (Q_E * S.V)
      expect(relative(x.n, Math.min(t.nth, carriersIfDark))).toBeLessThan(1e-14)
      const closed = k > 1 ? (S.gamma * S.tauP * (current - t.ith)) / (Q_E * S.V) : 0
      if (closed === 0) expect(x.s).toBe(0)
      else expect(relative(x.s, closed)).toBeLessThan(1e-12)
    }
  })

  it('each term of each equation is printed with its own value, and the two sums are zero', () => {
    // D1 prints this table. The floor each sum is measured against is the
    // largest term in it times the machine epsilon, not a chosen number.
    const t = threshold()
    const x = rateTerms({ current: 2 * t.ith })
    expect(x.carriers.map((c) => c.name)).toEqual(['Pump', 'Recombination', 'Stimulated emission'])
    expect(x.photons.map((c) => c.name)).toEqual(['Stimulated emission', 'Cavity loss', 'Spontaneous'])
    expect(Math.abs(x.carrierSum)).toBeLessThanOrEqual(x.carrierFloor)
    expect(Math.abs(x.photonSum)).toBeLessThanOrEqual(x.photonFloor)
    // At twice threshold the pump splits evenly: half the carriers recombine
    // and half are taken by stimulated emission.
    expect(relative(-x.carriers[1].value, -x.carriers[2].value)).toBeLessThan(1e-14)
    expect(relative(x.carriers[0].value, 2 * -x.carriers[1].value)).toBeLessThan(1e-14)
    for (const c of [...x.carriers, ...x.photons]) expect(c.formula.length).toBeGreaterThan(4)
  })
})

// ---------------------------------------------------------------- invariant 5

describe('invariant 5: threshold is where the slope changes', () => {
  it('the photon density is zero below threshold and rises at one slope above it', () => {
    const t = threshold()
    for (const k of [0.1, 0.5, 0.99]) expect(steadyState({ current: k * t.ith }).s).toBe(0)
    // The slope above threshold, measured off the curve rather than quoted.
    const slope = (i) => {
      const h = 1e-6 * t.ith
      return (steadyState({ current: i + h }).s - steadyState({ current: i - h }).s) / (2 * h)
    }
    const exact = (S.gamma * S.tauP) / (Q_E * S.V)
    for (const k of [1.5, 2, 3, 6]) expect(relative(slope(k * t.ith), exact)).toBeLessThan(1e-6)
  })

  it('the carrier density clamps at threshold, over random lasers', () => {
    const r = rng(0x7d31)
    for (let k = 0; k < 120; k++) {
      const spec = randomLaser(r)
      const t = threshold(spec)
      const hot = steadyState({ ...spec, current: t.ith * logUniform(r, 1.2, 15) })
      // Every extra electron goes to the photons, so the carrier density does
      // not move once the gain has clamped.
      expect(relative(hot.n, t.nth)).toBeLessThan(1e-12)
    }
  })
})

// ---------------------------------------------------------------- invariant 6

describe('invariant 6: the linearisation is the derivative', () => {
  it('the low-frequency gain equals the slope of the steady-state curve, to 1e-6 relative', () => {
    const t = threshold()
    for (const k of [1.2, 1.5, 2, 3, 5]) {
      const current = k * t.ith
      const sm = smallSignal({}, current)
      const h = 1e-6 * t.ith
      const slope = (steadyState({ current: current + h }).s - steadyState({ current: current - h }).s) / (2 * h)
      expect(relative(sm.dc, slope), `at ${k} I_th`).toBeLessThan(1e-6)
    }
  })

  it('the same holds over random lasers', () => {
    const r = rng(0x3f5c)
    for (let k = 0; k < 100; k++) {
      const spec = randomLaser(r)
      const t = threshold(spec)
      const current = t.ith * logUniform(r, 1.2, 12)
      const sm = smallSignal(spec, current)
      const h = 1e-6 * t.ith
      const slope = (steadyState({ ...spec, current: current + h }).s - steadyState({ ...spec, current: current - h }).s) / (2 * h)
      expect(relative(sm.dc, slope)).toBeLessThan(1e-6)
    }
  })

  it('the transfer function it hands to systems is a real rational second order', () => {
    const sm = smallSignal({}, 2 * threshold().ith)
    expect(sm.a.length).toBe(3)
    expect(sm.b.length).toBe(1)
    expect(sm.a[0]).toBe(1)
    expect(relative(sm.a[1], sm.gamma)).toBeLessThan(1e-15)
    expect(relative(sm.a[2], sm.wr * sm.wr)).toBeLessThan(1e-14)
    // The low-frequency value of b/a is the gain, so the coefficients and the
    // readout cannot disagree.
    expect(relative(sm.b[0] / sm.a[2], sm.dc)).toBeLessThan(1e-14)
  })

  it('the magnitude is one at zero, three decibels down at f3db, and peaks where it says', () => {
    const sm = smallSignal({}, 2 * threshold().ith)
    expect(modulationAt(sm, 0)).toBeCloseTo(1, 12)
    expect(20 * Math.log10(modulationAt(sm, sm.f3db))).toBeCloseTo(-3.0103, 4)
    expect(20 * Math.log10(modulationAt(sm, sm.peakHz))).toBeCloseTo(sm.peakDb, 9)
    // The peak is the largest value on a fine sweep through it.
    // Swept close in around the peak, because a lightly damped peak is
    // narrower than a coarse sweep's own step.
    let best = 0
    for (let k = -2000; k <= 2000; k++) best = Math.max(best, modulationAt(sm, sm.peakHz * (1 + k * 1e-5)))
    expect(relative(best, sm.peak)).toBeLessThan(1e-9)
  })

  it('the phase comes with the magnitude, and it is 90 degrees at omega_r', () => {
    // REVIEW_PLAYBOOK.md §3. The natural frequency is where the phase crosses
    // ninety degrees, whatever the damping is, and that is what makes it
    // readable off the response when the magnitude's own peak has moved.
    const r = rng(0x1a4c)
    for (let k = 0; k < 80; k++) {
      const spec = randomLaser(r)
      const t = threshold(spec)
      const sm = smallSignal(spec, t.ith * logUniform(r, 1.2, 12))
      expect(modulationPhase(sm, 0)).toBe(-0)
      expect(modulationPhase(sm, sm.fr)).toBeCloseTo(-90, 11)
      // Below omega_r the lag is under ninety and above it over, and it never
      // passes a hundred and eighty.
      expect(modulationPhase(sm, 0.5 * sm.fr)).toBeGreaterThan(-90)
      expect(modulationPhase(sm, 2 * sm.fr)).toBeLessThan(-90)
      expect(modulationPhase(sm, 1e6 * sm.fr)).toBeGreaterThan(-180)
      // One H(s), read two ways: the magnitude and the phase are the modulus
      // and the argument of the same denominator.
      const f = sm.fr * logUniform(r, 0.05, 40)
      const w = 2 * Math.PI * f
      const phi = (modulationPhase(sm, f) * Math.PI) / 180
      const re = (sm.wr * sm.wr - w * w) * modulationAt(sm, f)
      expect(relative(re / (sm.wr * sm.wr), Math.cos(phi))).toBeLessThan(1e-12)
    }
  })

  it('with no photons in the cavity there is no oscillation to linearise, and it says so', () => {
    const t = threshold()
    expect(() => smallSignal({}, 0.5 * t.ith)).toThrow(/no photons in the cavity/)
    expect(() => smallSignal({}, t.ith)).toThrow(/no relaxation oscillation is defined/)
    // With a coupling there are photons everywhere, so the same current answers.
    const soft = smallSignal({ beta: 1e-4 }, 0.5 * t.ith)
    expect(Number.isFinite(soft.fr)).toBe(true)
    expect(soft.zeta).toBeGreaterThan(1)
  })
})

// ---------------------------------------------------------------- invariant 7

describe('invariant 7: the relaxation frequency scales as the square root of I/I_th − 1', () => {
  it('f_r divided by that square root is one number at ten currents', () => {
    const t = threshold()
    const first = smallSignal({}, 1.5 * t.ith)
    const constant = first.fr / Math.sqrt(0.5)
    for (let k = 1; k <= 10; k++) {
      const ratio = 1 + k / 2
      const sm = smallSignal({}, ratio * t.ith)
      expect(relative(sm.fr / Math.sqrt(ratio - 1), constant), `at ${ratio} I_th`).toBeLessThan(1e-12)
    }
  })

  it('the same holds over random lasers', () => {
    const r = rng(0x6ab2)
    for (let k = 0; k < 80; k++) {
      const spec = randomLaser(r)
      const t = threshold(spec)
      const a = smallSignal(spec, 2 * t.ith)
      const b = smallSignal(spec, 5 * t.ith)
      expect(relative(b.fr / a.fr, 2)).toBeLessThan(1e-11)
    }
  })

  it('the plan’s laser gives the frequencies, the damping and the peak the lessons quote', () => {
    const t = threshold()
    const sm = smallSignal({}, 2 * t.ith)
    expect(sm.fr / 1e9).toBeCloseTo(3.9844, 4)
    expect(sm.gamma / 1e9).toBeCloseTo(1.7448, 4)
    expect(sm.zeta).toBeCloseTo(0.034848, 6)
    expect(sm.peakDb).toBeCloseTo(23.141, 3)
    expect(sm.f3db / 1e9).toBeCloseTo(6.1855, 4)
    // The damping is the sum of the two rates the plan writes, recomputed.
    expect(relative(sm.gamma, 1 / S.tauC + S.g0 * sm.s)).toBeLessThan(1e-13)
  })

  it('the textbook form is low by the square root of Gamma g0 N_th tau_p, and both are returned', () => {
    // PHOTONICS_LAB_PLAN.md §2.6 quotes sqrt((I/I_th − 1)/(tau_p tau_c)), which
    // holds only when the transparency density is negligible. It is not, here,
    // so D3 prints both and this test measures the gap rather than hiding it.
    const t = threshold()
    const factor = Math.sqrt(S.gamma * S.g0 * t.nth * S.tauP)
    for (const k of [1.5, 2, 3, 5]) {
      const sm = smallSignal({}, k * t.ith)
      expect(relative(sm.fr / sm.frText, factor), `at ${k} I_th`).toBeLessThan(1e-12)
    }
    expect(factor).toBeCloseTo(1.5779, 4)
    // At zero transparency density the two agree exactly, which is the
    // condition the textbook form assumes.
    const flat = { ...S, ntr: 1e-30 }
    const ft = threshold(flat)
    const sm = smallSignal(flat, 2 * ft.ith)
    expect(relative(sm.fr, sm.frText)).toBeLessThan(1e-9)
  })
})

// ---------------------------------------------------------------- invariant 8

describe('invariant 8: the guard is measured, not chosen', () => {
  const t = threshold()

  it('the integrated step and the linear prediction agree at small depth and part at large', () => {
    const errors = [0.01, 0.05, 0.1, 0.3, 0.6].map((d) => stepOvershoot({}, 2 * t.ith, d).error)
    expect(errors[0] * 100).toBeCloseTo(1.0853, 3)
    expect(errors[1] * 100).toBeCloseTo(5.2638, 3)
    expect(errors[2] * 100).toBeCloseTo(10.152, 2)
    expect(errors[3] * 100).toBeCloseTo(26.76, 1)
    expect(errors[4] * 100).toBeCloseTo(45.596, 2)
    // The error grows with the depth, at every step.
    for (let k = 1; k < errors.length; k++) expect(errors[k]).toBeGreaterThan(errors[k - 1])
  })

  it('the two thresholds are where the plan’s rule puts them', () => {
    // PHOTONICS_LAB_PLAN.md §11: a warn threshold whose own measured error
    // passes a tenth has to move. So the bar is measured at the threshold
    // rather than the threshold being asserted.
    expect(stepOvershoot({}, 2 * t.ith, DEPTH_WARN).error).toBeLessThan(0.1)
    expect(stepOvershoot({}, 2 * t.ith, DEPTH_DECLINE).error).toBeGreaterThan(0.25)
    // And the depth the plan first proposed does not clear the bar, which is
    // why the warn threshold sits where it does.
    expect(stepOvershoot({}, 2 * t.ith, 0.1).error).toBeGreaterThan(0.1)
  })

  it('the guard says which side of each threshold a depth is on, with the error in the sentence', () => {
    const inside = depthGuard({}, 2 * t.ith, 0.02)
    expect(inside.ok).toBe(true)
    expect(inside.declined).toBe(false)
    expect(inside.says).toMatch(/without a flag/)

    const between = depthGuard({}, 2 * t.ith, 0.2)
    expect(between.ok).toBe(false)
    expect(between.declined).toBe(false)
    expect(between.says).toMatch(/drawn as an estimate/)

    const past = depthGuard({}, 2 * t.ith, 0.5)
    expect(past.declined).toBe(true)
    expect(past.says).toMatch(/stops drawing it/)
    expect(past.says).toMatch(/steady state at each current is still exact/)
    // Every sentence carries the measured error it is talking about.
    for (const g of [inside, between, past]) expect(g.says).toContain(`${(100 * g.error).toPrecision(4)} %`)
  })

  it('the integrated step starts and settles where the exact steady states are', () => {
    const step = stepOvershoot({}, 2 * t.ith, 0.05)
    expect(relative(step.start, steadyState({ current: 2 * t.ith }).s)).toBeLessThan(1e-15)
    expect(relative(step.trace[0], step.start)).toBeLessThan(1e-15)
    expect(relative(step.trace[step.trace.length - 1], step.final)).toBeLessThan(0.01)
    expect(step.measured).toBeGreaterThan(step.final)
    expect(step.peakAt).toBeGreaterThan(0)
    expect(step.peakAt).toBeLessThan(3 / step.dt / step.steps + 1)
  })

  it('the linear step response starts at zero, ends at one, and overshoots by its damping ratio', () => {
    const sm = smallSignal({}, 2 * t.ith)
    expect(linearStep(sm, 0)).toBeCloseTo(0, 12)
    expect(linearStep(sm, 60 / sm.gamma)).toBeCloseTo(1, 6)
    let peak = 0
    for (let k = 0; k <= 4000; k++) peak = Math.max(peak, linearStep(sm, (20 * k) / 4000 / sm.wr))
    expect(relative(peak - 1, sm.overshoot)).toBeLessThan(1e-4)
    // An overdamped pair does not overshoot at all, and the same function says so.
    const soft = smallSignal({ beta: 1e-4 }, 0.5 * t.ith)
    expect(soft.overshoot).toBe(0)
    for (let k = 1; k <= 200; k++) expect(linearStep(soft, (10 * k) / 200 / soft.wr)).toBeLessThanOrEqual(1 + 1e-12)
  })

  it('a depth of zero or one is not a step this measures, and it says which', () => {
    expect(() => stepOvershoot({}, 2 * t.ith, 0)).toThrow(/modulation depth of zero is no step/)
    expect(() => stepOvershoot({}, 2 * t.ith, 1.5)).toThrow(/must be between 0 and 1/)
  })
})

// ------------------------------------------------------------------- declined

describe('the large-signal solution in time is declined, with the reason', () => {
  it('the refusal names the integrator and what it would be teaching', () => {
    expect(() => refuseLargeSignal()).toThrow(PhotonicsError)
    const says = largeSignalAvailable()
    expect(says).toMatch(/cannot be told apart from physics/)
    expect(says).toMatch(/steady state/)
    expect(says).toMatch(/declines to draw a large-signal solution/)
    // The sentence goes on a pane, so it starts as a sentence does.
    expect(says).toContain('The turn-on transient')
    expect(says.slice(0, 1)).toBe(says.slice(0, 1).toUpperCase())
    expect(largeSignalAvailable()).toBe(says)
  })

  it('the refusal is the reason diode.js gives, in the same words', () => {
    // Two places in the suite decline a timestep answer, and they decline it
    // for one reason. A reader who meets both must not read two arguments.
    expect(largeSignalAvailable()).toMatch(/timestep solver's error cannot be told apart from physics/)
  })

  it('the integrator that measures the guard is not offered as an answer', () => {
    // `stepOvershoot` integrates the same pair. What makes it legitimate is
    // that it returns an ERROR against a prediction, and every field it
    // returns is about that comparison.
    const step = stepOvershoot({}, 2 * threshold().ith, 0.05)
    for (const key of ['error', 'predicted', 'measured', 'rise']) expect(step[key]).toBeDefined()
    expect(typeof step.predict).toBe('function')
    expect(step.predict(0)).toBeCloseTo(step.start, 6)
  })
})

describe('the spec is checked before anything is solved', () => {
  it('laserSpec fills the defaults in and keeps what a caller set', () => {
    const s = laserSpec({ gamma: 0.5 })
    expect(s.gamma).toBe(0.5)
    expect(s.g0).toBe(LASER_DEFAULTS.g0)
    expect(s.tauP).toBe(LASER_DEFAULTS.tauP)
  })

  it('every solved quantity is finite over two hundred random lasers and currents', () => {
    const r = rng(0x4e2d)
    for (let k = 0; k < 200; k++) {
      const spec = randomLaser(r)
      const t = threshold(spec)
      const current = t.ith * logUniform(r, 1.05, 20)
      const sm = smallSignal(spec, current)
      for (const key of ['fr', 'gamma', 'zeta', 'peakDb', 'f3db', 'dc', 'wr']) {
        expect(Number.isFinite(sm[key]), `${key} is ${sm[key]}`).toBe(true)
      }
      expect(sm.fr).toBeGreaterThan(0)
      // A lightly damped pair passes its own relaxation frequency and rolls off
      // above it. A heavily damped one is three decibels down before it, which
      // is the same second-order fact and not a different one.
      if (sm.resonant) expect(sm.f3db).toBeGreaterThan(sm.fr)
      else expect(sm.f3db).toBeLessThanOrEqual(sm.fr * (1 + 1e-12))
    }
  })
})
