import { describe, it, expect } from 'vitest'
import {
  ampereLoop,
  biotSavart,
  circlePath,
  closePath,
  enclosedCurrent,
  loopOnAxis,
  magneticCircuit,
  segmentField,
  solenoidOnAxis,
  solenoidPath,
  toroidField,
  transformer,
  wireField,
} from './magnetics.js'
import { MU0 } from './const.js'
import { logUniform, relative, rng, uniform } from './fuzz.js'

// Invariant 1 for the magnetic field, and invariant 6, Ampere's law.
//
// Biot-Savart on a polyline is checked against the circular loop's axial closed
// form. Neither knows the other. Then Ampere's law is turned on the same field:
// the line integral around a contour must be mu0 times the current the contour
// encloses, and that is a different statement from the one the field was built
// with.
//
// The magnetic circuit is the one approximation here and it is checked
// differently. It has no field integral to check against, so what is checked is
// its structure: reluctances add in series exactly as resistances do, the flux
// is the magnetomotive force over the total, and the gap's share of the
// magnetomotive force is its share of the reluctance.

const mag = (v) => Math.hypot(v[0], v[1], v[2])

describe('one straight segment, and the polyline made of them', () => {
  it('a very long segment reproduces the infinite wire', () => {
    const r = rng(0x5e6)
    for (let k = 0; k < 40; k++) {
      const I = uniform(r, -20, 20)
      const d = logUniform(r, 1e-3, 0.5)
      const L = d * 1e7
      const B = segmentField([0, 0, -L], [0, 0, L], I, [d, 0, 0])
      expect(relative(mag(B), Math.abs(wireField(I, d)))).toBeLessThan(1e-12)
    }
  })

  it('the field is perpendicular to the wire and to the vector from it', () => {
    const B = segmentField([0, 0, -1e4], [0, 0, 1e4], 5, [0.02, 0, 0])
    expect(Math.abs(B[0])).toBeLessThan(1e-18)
    expect(Math.abs(B[2])).toBeLessThan(1e-18)
    expect(B[1]).toBeGreaterThan(0)
  })

  it('a point on the segment own line has no field, rather than an infinity', () => {
    const B = segmentField([0, 0, -1], [0, 0, 1], 5, [0, 0, 3])
    expect(B).toEqual([0, 0, 0])
    expect(Number.isFinite(mag(B))).toBe(true)
  })

  it('a zero-length segment contributes nothing', () => {
    expect(segmentField([1, 2, 3], [1, 2, 3], 7, [0, 0, 0])).toEqual([0, 0, 0])
  })

  it('reversing the current reverses the field', () => {
    const a = segmentField([0, 0, -1], [0, 0, 1], 3, [0.05, 0, 0])
    const b = segmentField([0, 0, -1], [0, 0, 1], -3, [0.05, 0, 0])
    expect(relative(a[1], -b[1])).toBeLessThan(1e-15)
  })

  it('closePath adds the closing point, and adds nothing to a closed path', () => {
    const open = [[0, 0, 0], [1, 0, 0], [1, 1, 0]]
    expect(closePath(open).length).toBe(4)
    expect(closePath(closePath(open)).length).toBe(4)
  })
})

describe('invariant 1: Biot-Savart against the loop closed form', () => {
  it('a 720-sided polygon agrees to five parts in a hundred thousand', () => {
    const r = rng(0x100b)
    let worst = 0
    for (let k = 0; k < 40; k++) {
      const a = logUniform(r, 5e-3, 0.5)
      const I = uniform(r, -20, 20)
      const z = a * logUniform(r, 0.05, 6)
      const poly = biotSavart(circlePath(a, { sides: 720 }), I, [0, 0, z])[2]
      worst = Math.max(worst, relative(poly, loopOnAxis(a, I, z)))
    }
    // The polygon differs from the circle by a term of order (pi/s) squared,
    // which is 1.9 parts in a hundred thousand at 720 sides. The difference is
    // largest close to the wire, where the field point sees the flat sides.
    expect(worst).toBeLessThan(5e-5)
    expect(worst).toBeGreaterThan(1e-6)
  })

  it('the polygon error falls as one over the square of the side count', () => {
    const a = 0.05
    const I = 3
    const exact = loopOnAxis(a, I, 0)
    const errs = [45, 90, 180].map((sides) => relative(biotSavart(circlePath(a, { sides }), I, [0, 0, 0])[2], exact))
    // Doubling the sides divides the error by about four.
    expect(errs[0] / errs[1]).toBeGreaterThan(3.5)
    expect(errs[1] / errs[2]).toBeGreaterThan(3.5)
    expect(errs[1] / errs[2]).toBeLessThan(4.5)
  })

  it('the loop centre is mu I over 2a', () => {
    const r = rng(0x100c)
    for (let k = 0; k < 30; k++) {
      const a = logUniform(r, 1e-3, 1)
      const I = uniform(r, -10, 10)
      expect(relative(loopOnAxis(a, I, 0), (MU0 * I) / (2 * a))).toBeLessThan(1e-14)
    }
  })

  it('the field off the axis of the loop is not zero, and the plot has something to draw', () => {
    const B = biotSavart(circlePath(0.05, { sides: 720 }), 3, [0.02, 0, 0.01])
    expect(mag(B)).toBeGreaterThan(0)
    // Inside the loop and above its plane, the axial component still points up.
    expect(B[2]).toBeGreaterThan(0)
  })
})

describe('invariant 6: Ampere counts the current a contour encloses', () => {
  const longWire = [[0, 0, -1e5], [0, 0, 1e5]]

  it('a contour around one wire measures its current, whatever its radius', () => {
    const I = 7.5
    const field = (p) => biotSavart(longWire, I, p)
    for (const r of [0.002, 0.02, 0.2, 2]) {
      expect(relative(enclosedCurrent(ampereLoop(field, { r })), I)).toBeLessThan(1e-9)
    }
  })

  it('a contour off to one side, enclosing nothing, measures nothing', () => {
    const field = (p) => biotSavart(longWire, 7.5, p)
    const away = ampereLoop(field, { centre: [0.5, 0, 0], r: 0.1 })
    expect(Math.abs(enclosedCurrent(away))).toBeLessThan(1e-9)
  })

  it('two wires the same way add, and two opposite ways cancel', () => {
    const at = (x) => [[x, 0, -1e5], [x, 0, 1e5]]
    const same = (p) => {
      const a = biotSavart(at(-0.01), 4, p)
      const b = biotSavart(at(0.01), 4, p)
      return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
    }
    const opposite = (p) => {
      const a = biotSavart(at(-0.01), 4, p)
      const b = biotSavart(at(0.01), -4, p)
      return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
    }
    expect(relative(enclosedCurrent(ampereLoop(same, { r: 0.5 })), 8)).toBeLessThan(1e-6)
    expect(Math.abs(enclosedCurrent(ampereLoop(opposite, { r: 0.5 })))).toBeLessThan(1e-6)
  })

  it('a contour that encloses only one of the pair measures only that one', () => {
    const at = (x) => [[x, 0, -1e5], [x, 0, 1e5]]
    const pair = (p) => {
      const a = biotSavart(at(-0.05), 4, p)
      const b = biotSavart(at(0.05), -4, p)
      return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
    }
    const around = ampereLoop(pair, { centre: [-0.05, 0, 0], r: 0.02, points: 512 })
    expect(relative(enclosedCurrent(around), 4)).toBeLessThan(1e-5)
  })
})

describe('the solenoid and the toroid', () => {
  it('a long solenoid approaches mu n I on its axis', () => {
    const near = solenoidOnAxis(0.005, 5, 10000, 1)
    expect(near.fraction).toBeGreaterThan(0.999)
    expect(relative(near.B, MU0 * near.n * 1)).toBeLessThan(1e-3)
  })

  it('a short one falls short, and the function says by how much', () => {
    const short = solenoidOnAxis(0.05, 0.05, 100, 1)
    expect(short.fraction).toBeLessThan(0.8)
    expect(short.B).toBeLessThan(short.infinite)
  })

  it('the field at the end of a long solenoid is half the middle value', () => {
    const mid = solenoidOnAxis(0.005, 2, 4000, 1, 0).B
    const end = solenoidOnAxis(0.005, 2, 4000, 1, 1).B
    expect(relative(end, mid / 2)).toBeLessThan(1e-2)
  })

  it('the helical path reproduces the closed form on the axis', () => {
    const a = 0.01
    const len = 0.2
    const turns = 40
    const closed = solenoidOnAxis(a, len, turns, 2, 0).B
    const path = biotSavart(solenoidPath(a, len, turns, { perTurn: 120 }), 2, [0, 0, 0])[2]
    expect(relative(path, closed)).toBeLessThan(5e-3)
  })

  it('the toroid field falls as one over r across the winding', () => {
    const r = rng(0x707)
    for (let k = 0; k < 20; k++) {
      const N = Math.round(uniform(r, 10, 1000))
      const I = uniform(r, -10, 10)
      const r1 = logUniform(r, 1e-3, 0.1)
      expect(relative(toroidField(N, I, r1), 2 * toroidField(N, I, 2 * r1))).toBeLessThan(1e-13)
    }
  })
})

describe('the magnetic circuit, and its guard', () => {
  const core = { meanLength: 0.2, area: 4e-4, mur: 2000, turns: 200, current: 1 }

  it('reluctances add in series, and the flux is the mmf over the total', () => {
    const mc = magneticCircuit({ ...core, gap: 1e-3 })
    expect(mc.reluctance.total).toBeCloseTo(mc.reluctance.core + mc.reluctance.gap, 6)
    expect(relative(mc.flux, mc.mmf / mc.reluctance.total)).toBeLessThan(1e-14)
    expect(relative(mc.inductance, (core.turns * core.turns) / mc.reluctance.total)).toBeLessThan(1e-14)
  })

  it('the gap takes its share of the magnetomotive force', () => {
    const mc = magneticCircuit({ ...core, gap: 1e-3 })
    expect(relative(mc.gapShare, mc.reluctance.gap / mc.reluctance.total)).toBeLessThan(1e-14)
    // A millimetre of air in a 200 mm path of mur 2000 takes most of it.
    expect(mc.gapShare).toBeGreaterThan(0.9)
  })

  it('a gap divides the inductance, and the ratio follows the reluctances', () => {
    const gapped = magneticCircuit({ ...core, gap: 1e-3 })
    const solid = magneticCircuit({ ...core, gap: 0 })
    expect(relative(solid.inductance / gapped.inductance, gapped.reluctance.total / solid.reluctance.total)).toBeLessThan(1e-14)
    expect(solid.inductance / gapped.inductance).toBeCloseTo(11.0, 1)
  })

  it('the flux density is the flux over the area, in the core and in the gap', () => {
    const mc = magneticCircuit({ ...core, gap: 1e-3, gapArea: 5e-4 })
    expect(relative(mc.Bcore, mc.flux / core.area)).toBeLessThan(1e-14)
    expect(relative(mc.Bgap, mc.flux / 5e-4)).toBeLessThan(1e-14)
  })

  it('the guard is off for no gap, on for a small one, and trips for a large one', () => {
    expect(magneticCircuit({ ...core, gap: 0 }).guard.ok).toBe(true)
    expect(magneticCircuit({ ...core, gap: 0 }).guard.says).toMatch(/no gap/)
    const small = magneticCircuit({ ...core, gap: 1e-3 })
    expect(small.guard.ok).toBe(true)
    expect(small.guard.says).toMatch(/inside the 10 per cent threshold/)
    const big = magneticCircuit({ ...core, gap: 8e-3 })
    expect(big.guard.ok).toBe(false)
    expect(big.guard.says).toMatch(/past the 10 per cent threshold/)
    expect(big.guard.says).toMatch(/fringing correction raises the inductance/)
  })

  it('the fringing correction lowers the gap reluctance and raises the inductance', () => {
    const mc = magneticCircuit({ ...core, gap: 8e-3 })
    expect(mc.fringed.reluctance).toBeLessThan(mc.reluctance.gap)
    expect(mc.fringed.inductance).toBeGreaterThan(mc.inductance)
  })

  it('a gap longer than the path it sits in is declined', () => {
    expect(() => magneticCircuit({ ...core, gap: 0.3 })).toThrow(/cannot be longer than the path/)
  })
})

describe('the transformer, from the reluctance up', () => {
  const core = { meanLength: 0.2, area: 4e-4, mur: 2000, gap: 0, current: 1 }

  it('with no leakage the coupling is exactly one and L1 L2 equals M squared', () => {
    const t = transformer({ ...core, n1: 200, n2: 50, leakage: 0 })
    expect(relative(t.k, 1)).toBeLessThan(1e-14)
    expect(relative(t.L1 * t.L2, t.M * t.M)).toBeLessThan(1e-13)
  })

  it('the coupling coefficient is one minus the leakage fraction', () => {
    const r = rng(0x7f)
    for (let k = 0; k < 30; k++) {
      const leakage = uniform(r, 0, 0.4)
      const t = transformer({ ...core, n1: Math.round(uniform(r, 10, 500)), n2: Math.round(uniform(r, 10, 500)), leakage })
      expect(relative(t.k, 1 - leakage)).toBeLessThan(1e-13)
    }
  })

  it('the inductances follow the square of the turns, and M their product', () => {
    const t = transformer({ ...core, n1: 200, n2: 50, leakage: 0 })
    expect(relative(t.L1 / t.L2, (200 / 50) ** 2)).toBeLessThan(1e-13)
    expect(relative(t.M, Math.sqrt(t.L1 * t.L2))).toBeLessThan(1e-13)
    expect(t.turnsRatio).toBe(4)
    expect(t.voltageRatio).toBe(4)
    expect(t.currentRatio).toBe(0.25)
  })

  it('a leakage of one or more is declined', () => {
    expect(() => transformer({ ...core, n1: 200, n2: 50, leakage: 1 })).toThrow(/must be below 1/)
  })
})

describe('the figures the plan quotes', () => {
  it('a 50 mm loop at 3 A gives 37.70 microtesla at its centre', () => {
    expect(loopOnAxis(0.05, 3, 0) * 1e6).toBeCloseTo(37.7, 1)
  })

  it('a long wire at 10 A gives 100.0 microtesla at 20 mm', () => {
    expect(wireField(10, 0.02) * 1e6).toBeCloseTo(100.0, 1)
  })

  it('400 turns over 200 mm at 2 A give 5.002 mT, 0.99504 of the infinite value', () => {
    const s = solenoidOnAxis(0.01, 0.2, 400, 2)
    expect(s.B * 1000).toBeCloseTo(5.002, 3)
    expect(s.fraction).toBeCloseTo(0.99504, 5)
  })

  it('the gapped core gives 18.29 mH and the gap takes 90.95 per cent', () => {
    const mc = magneticCircuit({ meanLength: 0.2, area: 4e-4, mur: 2000, gap: 1e-3, turns: 200, current: 1 })
    expect(mc.inductance * 1000).toBeCloseTo(18.29, 2)
    expect(100 * mc.gapShare).toBeCloseTo(90.95, 2)
    expect(mc.Bcore).toBeCloseTo(0.2286, 4)
  })

  it('the 200 to 50 transformer gives 205.2, 12.82 and 50.27 mH at k = 0.98', () => {
    const t = transformer({ meanLength: 0.2, area: 4e-4, mur: 2000, gap: 0, n1: 200, n2: 50, leakage: 0.02 })
    expect(t.L1 * 1000).toBeCloseTo(205.2, 1)
    expect(t.L2 * 1000).toBeCloseTo(12.82, 2)
    expect(t.M * 1000).toBeCloseTo(50.27, 2)
    expect(t.k).toBeCloseTo(0.98, 10)
  })
})
