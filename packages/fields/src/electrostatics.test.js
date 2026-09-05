import { describe, it, expect } from 'vitest'
import {
  coulombForce,
  gaussFlux,
  K_E,
  lineChargeField,
  pointChargeField,
  pointChargePotential,
  ringCharges,
  ringOnAxis,
  sheetChargeField,
  traceEquipotential,
} from './electrostatics.js'
import { EPS0, FieldsError } from './const.js'
import { logUniform, relative, rng, uniform } from './fuzz.js'

// Invariant 1 for the electric field, and invariant 3, Gauss's law.
//
// The superposition code is checked against the ring's closed form by cutting a
// ring into 720 point charges. Neither side of that comparison knows the other,
// and it is the electric mirror of the Biot-Savart check in magnetics.test.js.
//
// Gauss's law is checked as a law and not as an identity. The flux is
// integrated over a sphere from a field the integrator did not build, and it is
// compared with the charge inside. Moving a charge around inside the sphere
// must not change the answer, and moving it outside must take the answer to
// zero. Both are tested.

const at = (x, y = 0, z = 0) => [x, y, z]

describe('Coulomb, and the field of a point charge', () => {
  it('the force follows one over r squared, over 200 random pairs', () => {
    const r = rng(0xc001)
    for (let k = 0; k < 200; k++) {
      const q1 = uniform(r, -1e-6, 1e-6)
      const q2 = uniform(r, -1e-6, 1e-6)
      const d = logUniform(r, 1e-4, 10)
      const f1 = coulombForce(q1, q2, d)
      const f2 = coulombForce(q1, q2, 2 * d)
      expect(relative(f1, 4 * f2)).toBeLessThan(1e-12)
    }
  })

  it('the field is the force per unit charge', () => {
    const r = rng(0xc002)
    for (let k = 0; k < 100; k++) {
      const q = uniform(r, -1e-6, 1e-6)
      const d = logUniform(r, 1e-3, 1)
      const E = pointChargeField([{ q, at: at(0) }], at(d))[0]
      expect(relative(E, coulombForce(q, 1, d))).toBeLessThan(1e-12)
    }
  })

  it('the potential differentiates back into the field', () => {
    const charges = [
      { q: 3e-9, at: at(-0.01, 0.002) },
      { q: -1.5e-9, at: at(0.013, -0.004) },
      { q: 0.8e-9, at: at(0.001, 0.02) },
    ]
    const h = 1e-7
    const p = at(0.004, 0.006)
    const dvdx = (pointChargePotential(charges, [p[0] + h, p[1], p[2]]) - pointChargePotential(charges, [p[0] - h, p[1], p[2]])) / (2 * h)
    const dvdy = (pointChargePotential(charges, [p[0], p[1] + h, p[2]]) - pointChargePotential(charges, [p[0], p[1] - h, p[2]])) / (2 * h)
    const E = pointChargeField(charges, p)
    expect(relative(E[0], -dvdx)).toBeLessThan(1e-6)
    expect(relative(E[1], -dvdy)).toBeLessThan(1e-6)
  })

  it('the field at a charge itself is declined, with the reason', () => {
    expect(() => pointChargeField([{ q: 1e-9, at: at(0) }], at(0))).toThrow(FieldsError)
    expect(() => pointChargeField([{ q: 1e-9, at: at(0) }], at(0))).toThrow(/not defined at a point charge/)
    expect(() => pointChargePotential([{ q: 1e-9, at: at(0) }], at(0))).toThrow(/not defined at a point charge/)
  })

  it("Coulomb's constant is one over four pi eps0", () => {
    expect(relative(K_E, 1 / (4 * Math.PI * EPS0))).toBeLessThan(1e-15)
  })
})

describe('superposition against the ring closed form', () => {
  it('720 point charges reproduce the ring, over 40 random rings', () => {
    const r = rng(0x81f9)
    let worst = 0
    for (let k = 0; k < 40; k++) {
      const a = logUniform(r, 1e-3, 0.5)
      const Q = uniform(r, -1e-8, 1e-8)
      const z = a * logUniform(r, 0.2, 8)
      const byParts = pointChargeField(ringCharges(a, Q, 720), at(0, 0, z))[2]
      worst = Math.max(worst, relative(byParts, ringOnAxis(a, Q, z)))
    }
    expect(worst).toBeLessThan(1e-13)
  })

  it('on the axis the sum is exact at any side count, because the charges are equidistant', () => {
    // Every point of a ring is the same distance from a point on its axis, so
    // cutting the ring into N charges introduces no error at all there. The
    // components across the axis cancel in pairs and the axial ones add. This
    // is why A2 opens on the axis: the superposition can be checked against the
    // closed form with nothing else in the way.
    const a = 0.02
    const Q = 5e-9
    const z = 0.03
    const exact = ringOnAxis(a, Q, z)
    for (const n of [8, 24, 180, 720]) {
      expect(relative(pointChargeField(ringCharges(a, Q, n), at(0, 0, z))[2], exact)).toBeLessThan(1e-13)
    }
  })

  it('off the axis the sum converges as the ring is cut more finely', () => {
    // Off the axis the distances differ, so the sum is a quadrature. The
    // integrand is smooth and periodic, so it converges faster than any power
    // of the step and reaches floating point by a couple of dozen pieces.
    const a = 0.02
    const Q = 5e-9
    const p = at(0.005, 0.002, 0.03)
    const mag = (v) => Math.hypot(v[0], v[1], v[2])
    const ref = mag(pointChargeField(ringCharges(a, Q, 5760), p))
    const coarse = relative(mag(pointChargeField(ringCharges(a, Q, 6), p)), ref)
    const fine = relative(mag(pointChargeField(ringCharges(a, Q, 48), p)), ref)
    expect(coarse).toBeGreaterThan(fine)
    expect(fine).toBeLessThan(1e-12)
  })

  it('a ring is zero on its own axis at its own plane', () => {
    expect(Math.abs(ringOnAxis(0.02, 5e-9, 0))).toBeLessThan(1e-30)
  })
})

describe('invariant 3: the flux out of a closed surface counts the charge inside', () => {
  it('holds wherever the charge sits inside the sphere', () => {
    const R = 0.05
    const r = rng(0x9a55)
    let worst = 0
    for (let k = 0; k < 12; k++) {
      const q = uniform(r, -5e-9, 5e-9)
      // A charge somewhere inside, but not on the surface.
      const pos = at(uniform(r, -0.03, 0.03), uniform(r, -0.03, 0.03), uniform(r, -0.03, 0.03))
      const charges = [{ q, at: pos }]
      const g = gaussFlux((p) => pointChargeField(charges, p), { r: R, charges, n: 24 })
      worst = Math.max(worst, relative(g.impliedCharge, q))
    }
    expect(worst).toBeLessThan(1e-9)
  })

  it('is zero when the charge sits outside, whatever its size', () => {
    const charges = [{ q: 7e-9, at: at(0.4, 0.1, -0.2) }]
    const g = gaussFlux((p) => pointChargeField(charges, p), { r: 0.05, charges, n: 24 })
    expect(g.enclosed).toBe(0)
    expect(Math.abs(g.impliedCharge)).toBeLessThan(1e-18)
  })

  it('counts several charges, inside and outside, and adds only the inside ones', () => {
    const charges = [
      { q: 2e-9, at: at(0.01, 0.005) },
      { q: -3e-9, at: at(-0.02, 0.01) },
      { q: 9e-9, at: at(0.5, 0) },
    ]
    const g = gaussFlux((p) => pointChargeField(charges, p), { r: 0.05, charges, n: 24 })
    expect(g.enclosed).toBeCloseTo(-1e-9, 15)
    expect(relative(g.impliedCharge, -1e-9)).toBeLessThan(1e-8)
  })
})

describe('a line and a sheet fall off differently from a point', () => {
  it('a line falls as one over r', () => {
    const r = rng(0x11e5)
    for (let k = 0; k < 50; k++) {
      const lambda = uniform(r, -1e-8, 1e-8)
      const d = logUniform(r, 1e-3, 1)
      expect(relative(lineChargeField(lambda, d), 2 * lineChargeField(lambda, 2 * d))).toBeLessThan(1e-12)
    }
  })

  it('a sheet does not fall off at all', () => {
    const s = 1e-9
    expect(sheetChargeField(s)).toBe(sheetChargeField(s))
    expect(sheetChargeField(s)).toBeCloseTo(s / (2 * EPS0), 20)
  })

  it('the plan quotes 1798 V/m and 56.47 V/m', () => {
    expect(lineChargeField(1e-9, 0.01)).toBeCloseTo(1798, 0)
    expect(sheetChargeField(1e-9)).toBeCloseTo(56.47, 2)
  })
})

describe('an equipotential holds its level all the way round', () => {
  it('a traced curve holds its level to a part in a hundred million', () => {
    const charges = [
      { q: 2e-9, at: at(-0.01, 0) },
      { q: -2e-9, at: at(0.01, 0) },
    ]
    const potential = (p) => pointChargePotential(charges, p)
    const field = (p) => pointChargeField(charges, p)
    const start = at(-0.006, 0)
    const out = traceEquipotential(potential, field, start, { step: 5e-5, maxSteps: 8000 })
    expect(out.points.length).toBeGreaterThan(100)
    expect(out.worstRelative).toBeLessThan(1e-8)
  })

  it('the deviation falls as the fourth power of the step', () => {
    const charges = [
      { q: 2e-9, at: at(-0.01, 0) },
      { q: -2e-9, at: at(0.01, 0) },
    ]
    const walk = (step) =>
      traceEquipotential(
        (p) => pointChargePotential(charges, p),
        (p) => pointChargeField(charges, p),
        at(-0.006, 0),
        { step, maxSteps: 16000 },
      ).worstRelative
    const a = walk(2e-4)
    const b = walk(1e-4)
    const c = walk(5e-5)
    // Halving the step divides the deviation by about sixteen, which is the
    // second-order step plus the Newton correction that follows it.
    expect(a / b).toBeGreaterThan(10)
    expect(b / c).toBeGreaterThan(10)
  })

  it('the curve closes on itself around one charge', () => {
    const charges = [
      { q: 2e-9, at: at(-0.01, 0) },
      { q: -2e-9, at: at(0.01, 0) },
    ]
    const start = at(-0.006, 0)
    const out = traceEquipotential(
      (p) => pointChargePotential(charges, p),
      (p) => pointChargeField(charges, p),
      start,
      { step: 1e-4, maxSteps: 4000 },
    )
    const last = out.points[out.points.length - 1]
    expect(Math.hypot(last[0] - start[0], last[1] - start[1])).toBeLessThan(2e-4)
  })
})

describe('the figures the plan quotes', () => {
  it('two 1 nC charges 10 mm apart push with 89.88 microN', () => {
    expect(coulombForce(1e-9, 1e-9, 0.01) * 1e6).toBeCloseTo(89.88, 2)
  })

  it('the midpoint field of an opposed pair is twice one charge alone', () => {
    const pair = [
      { q: 1e-9, at: at(-0.005) },
      { q: -1e-9, at: at(0.005) },
    ]
    const both = pointChargeField(pair, at(0, 0.001))[0]
    const one = pointChargeField([pair[0]], at(0, 0.001))[0]
    expect(relative(both, 2 * one)).toBeLessThan(1e-12)
    expect(both).toBeCloseTo(677900, -2)
  })

  it('an off-centre 2 nC inside a 50 mm sphere still gives 2 nC of flux', () => {
    const charges = [{ q: 2e-9, at: at(0.002, 0.001) }]
    const g = gaussFlux((p) => pointChargeField(charges, p), { r: 0.05, charges, n: 40 })
    expect(g.impliedCharge / 1e-9).toBeCloseTo(2.0, 6)
    expect(g.error).toBeLessThan(1e-12)
  })
})
