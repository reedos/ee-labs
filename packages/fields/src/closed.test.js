import { describe, it, expect } from 'vitest'
import { capacitance, fieldEnergy, inductance, peakField, rcProduct, resistance } from './closed.js'
import { describeGeometry, epsOf, KINDS, muOf } from './geometry.js'
import { quad, quadTo } from './integrate.js'
import { EPS0, FieldsError, MU0 } from './const.js'
import { logUniform, pick, randomGeometry, relative, rng } from './fuzz.js'

// Invariant 1: every closed form against an independent numerical integral.
//
// The point of this file is that nothing below rearranges the formula it is
// checking. Each test integrates the FIELD LAW over the geometry and compares
// the result with the closed form. A parallel plate's capacitance is checked by
// integrating eps E squared over two through the gap and dividing by V squared.
// A coaxial cable's is checked the same way, over an integrand that knows only
// Gauss's law in a cylinder.
//
// Invariant 5, the R C product, is here too, because it is a check of the
// resistance forms against the capacitance forms with no third quantity
// involved.

/**
 * The capacitance a geometry's own field implies, by integrating the energy
 * density over the volume between the conductors and using W = C V^2 / 2.
 *
 * The field at each point comes from Gauss's law in the symmetry the geometry
 * has, and the potential difference comes from integrating that field along a
 * path. Neither step uses the capacitance formula.
 */
function capacitanceByEnergy(g) {
  const eps = epsOf(g)
  switch (g.kind) {
    case 'parallelPlate': {
      // A uniform field E = V/d over the volume A d, at V = 1.
      const E = 1 / g.gap
      const W = 0.5 * eps * E * E * g.area * g.gap
      return 2 * W
    }
    case 'coax': {
      // Gauss in a cylinder puts E = lambda / (2 pi eps r). The potential
      // difference is the integral of that from a to b, and the energy is the
      // integral of eps E^2 / 2 over 2 pi r dr per metre. Take lambda = 1.
      const E = (r) => 1 / (2 * Math.PI * eps * r)
      const V = quadTo(E, g.a, g.b, { n: 24, tol: 1e-14 }).value
      const W = quadTo((r) => 0.5 * eps * E(r) * E(r) * 2 * Math.PI * r, g.a, g.b, { n: 24, tol: 1e-14 }).value
      // C = lambda / V per metre, and also 2W / V^2. Return the energy route.
      return ((2 * W) / (V * V)) * g.length
    }
    case 'spherical': {
      // Gauss in a sphere puts E = Q / (4 pi eps r^2). Take Q = 1.
      const E = (r) => 1 / (4 * Math.PI * eps * r * r)
      const V = quadTo(E, g.a, g.b, { n: 24, tol: 1e-14 }).value
      const W = quadTo((r) => 0.5 * eps * E(r) * E(r) * 4 * Math.PI * r * r, g.a, g.b, { n: 24, tol: 1e-14 }).value
      return (2 * W) / (V * V)
    }
    default:
      throw new Error(`capacitanceByEnergy has no case for ${g.kind}`)
  }
}

/**
 * The capacitance of a two-wire line from the image construction, computed
 * without the acosh. Two line charges of +lambda and -lambda sit at +/- s from
 * the midpoint, where s^2 = (d/2)^2 - a^2. The potential of one wire's surface
 * is found by evaluating the two line charges' potentials at a point ON that
 * surface, and C is lambda over the difference.
 *
 * This is a different route to the same number. The acosh form comes from
 * simplifying it, and this test does not simplify.
 */
function twoWireByImages(g) {
  const eps = epsOf(g)
  const s = Math.sqrt((g.d / 2) ** 2 - g.a * g.a)
  const c = g.d / 2
  // A point on the right wire's surface, nearest the origin.
  const x = c - g.a
  const k = 1 / (2 * Math.PI * eps)
  // V = -k ln(r+) + k ln(r-), with r+ the distance to +lambda at +s.
  const V1 = -k * Math.log(Math.abs(x - s)) + k * Math.log(Math.abs(x + s))
  // By symmetry the left wire sits at -V1, so the difference is 2 V1.
  return (1 / (2 * V1)) * g.length
}

/**
 * The inductance of a coaxial line from the flux between the conductors.
 * Ampere puts B = mu I / (2 pi r), and the flux per metre is its integral from
 * a to b. L' is that flux over I. Take I = 1.
 */
function coaxInductanceByFlux(g) {
  const mu = muOf(g)
  const flux = quadTo((r) => mu / (2 * Math.PI * r), g.a, g.b, { n: 24, tol: 1e-14 }).value
  return flux * g.length
}

/**
 * The inductance of a solenoid from the flux its own field links.
 * B = mu N I / l inside, the flux through one turn is B A, and N turns link N
 * times that. Take I = 1.
 */
function solenoidInductanceByFlux(g) {
  const mu = muOf(g)
  const B = (mu * g.turns) / g.len
  return g.turns * B * g.area
}

/**
 * The inductance of a toroid from the flux, integrated across the winding
 * because the field is not uniform there. B = mu N I / (2 pi r).
 */
function toroidInductanceByFlux(g) {
  const mu = muOf(g)
  const flux = quadTo((r) => ((mu * g.turns) / (2 * Math.PI * r)) * g.height, g.a, g.b, { n: 24, tol: 1e-14 }).value
  return g.turns * flux
}

describe('capacitance against the energy in the field it produces', () => {
  for (const kind of ['parallelPlate', 'coax', 'spherical']) {
    it(`${kind}, over 60 random geometries`, () => {
      const r = rng(0x5eed + kind.length)
      let worst = 0
      for (let k = 0; k < 60; k++) {
        const g = describeGeometry(randomGeometry(r, kind))
        const closed = capacitance(g).value
        const byField = capacitanceByEnergy(g)
        worst = Math.max(worst, relative(closed, byField))
      }
      expect(worst).toBeLessThan(1e-11)
    })
  }

  it('the two-wire line, against the image construction it comes from', () => {
    const r = rng(0xbeef)
    let worst = 0
    for (let k = 0; k < 60; k++) {
      const g = describeGeometry(randomGeometry(r, 'twoWire'))
      worst = Math.max(worst, relative(capacitance(g).value, twoWireByImages(g)))
    }
    expect(worst).toBeLessThan(1e-12)
  })

  it('the acosh form and the wide-spacing logarithm agree as the spacing grows', () => {
    const a = 0.4e-3
    const wide = { kind: 'twoWire', a, d: a * 1e5 }
    const closed = capacitance(wide).perMetre
    const log = (Math.PI * EPS0) / Math.log(wide.d / a)
    expect(relative(closed, log)).toBeLessThan(1e-9)
  })

  it('the acosh form and the logarithm differ at a spacing a lesson uses', () => {
    const g = { kind: 'twoWire', a: 0.4e-3, d: 6e-3 }
    const closed = capacitance(g).perMetre
    const log = (Math.PI * EPS0) / Math.log(g.d / g.a)
    // The difference is small and it is real, and B4's note quotes both.
    expect(relative(closed, log)).toBeGreaterThan(1e-3)
    expect(relative(closed, log)).toBeLessThan(1e-2)
  })

  it('a shell moved far away leaves the isolated sphere, 4 pi eps a', () => {
    const a = 0.05
    const far = capacitance({ kind: 'spherical', a, b: a * 1e7 }).value
    expect(relative(far, 4 * Math.PI * EPS0 * a)).toBeLessThan(1e-6)
  })
})

describe('inductance against the flux it links', () => {
  it('the coaxial line, against Ampere integrated across the gap', () => {
    const r = rng(0x10ad)
    let worst = 0
    for (let k = 0; k < 60; k++) {
      const g = describeGeometry(randomGeometry(r, 'coax'))
      worst = Math.max(worst, relative(inductance(g).value, coaxInductanceByFlux(g)))
    }
    expect(worst).toBeLessThan(1e-12)
  })

  it('the solenoid and the toroid, against their own flux', () => {
    const r = rng(0xc0)
    let worstS = 0
    let worstT = 0
    for (let k = 0; k < 40; k++) {
      const s = describeGeometry(randomGeometry(r, 'solenoid'))
      worstS = Math.max(worstS, relative(inductance(s).value, solenoidInductanceByFlux(s)))
      const t = describeGeometry(randomGeometry(r, 'toroid'))
      worstT = Math.max(worstT, relative(inductance(t).value, toroidInductanceByFlux(t)))
    }
    expect(worstS).toBeLessThan(1e-12)
    expect(worstT).toBeLessThan(1e-12)
  })

  it('the internal inductance a solid conductor adds is mu over 8 pi, whatever the radius', () => {
    const r = rng(0x1707)
    for (let k = 0; k < 20; k++) {
      const g = randomGeometry(r, 'coax')
      g.mur = 1
      const bare = inductance(g).perMetre
      const withInside = inductance(g, { internal: true }).perMetre
      expect(relative(withInside - bare, MU0 / (8 * Math.PI))).toBeLessThan(1e-12)
    }
  })

  it('the thin-wire loop carries its guard, and the guard trips', () => {
    const thin = inductance({ kind: 'loop', a: 0.05, wire: 0.05 * 0.01 })
    expect(thin.guard.ok).toBe(true)
    expect(thin.guard.says).toMatch(/inside the thin-wire threshold/)
    const fat = inductance({ kind: 'loop', a: 0.05, wire: 0.05 * 0.3 })
    expect(fat.guard.ok).toBe(false)
    expect(fat.guard.says).toMatch(/past the thin-wire threshold/)
    expect(fat.guard.value).toBeCloseTo(0.3, 12)
  })
})

describe('invariant 5: R C equals eps over sigma, whatever the shape', () => {
  it('holds for every geometry with both a capacitance and a resistance', () => {
    const r = rng(0x2c)
    const kinds = Object.entries(KINDS)
      .filter(([, spec]) => spec.has.includes('capacitance') && spec.has.includes('resistance'))
      .map(([k]) => k)
    expect(kinds.sort()).toEqual(['coax', 'parallelPlate', 'spherical'])
    let worst = 0
    for (let k = 0; k < 90; k++) {
      const kind = pick(r, kinds)
      const g = describeGeometry(randomGeometry(r, kind))
      const sigma = logUniform(r, 1e-14, 1e2)
      const product = capacitance(g).value * resistance(g, sigma).value
      worst = Math.max(worst, relative(product, rcProduct(g, sigma)))
      // And the product does not depend on the shape at all.
      worst = Math.max(worst, relative(product, epsOf(g) / sigma))
    }
    expect(worst).toBeLessThan(1e-12)
  })
})

describe('the field a geometry holds, and the energy in it', () => {
  it('the energy is half C V squared, for every geometry with a capacitance', () => {
    const r = rng(0x33)
    for (const kind of ['parallelPlate', 'coax', 'spherical', 'twoWire']) {
      for (let k = 0; k < 15; k++) {
        const g = randomGeometry(r, kind)
        const V = logUniform(r, 1, 1000)
        const e = fieldEnergy(g, V)
        expect(relative(e.W, 0.5 * capacitance(g).value * V * V)).toBeLessThan(1e-12)
      }
    }
  })

  it('the parallel plate is uniform, so its peak field is V over d', () => {
    expect(peakField({ kind: 'parallelPlate', area: 1e-4, gap: 1e-3 }, 10)).toBeCloseTo(1e4, 6)
  })

  it('the coaxial peak field is at the inner conductor, and matches Gauss there', () => {
    const g = describeGeometry({ kind: 'coax', a: 0.45e-3, b: 1.475e-3, epsr: 2.25 })
    const V = 100
    // From Gauss: lambda = C' V, and E(a) = lambda / (2 pi eps a).
    const lambda = capacitance(g).perMetre * V
    const byGauss = lambda / (2 * Math.PI * epsOf(g) * g.a)
    expect(relative(peakField(g, V), byGauss)).toBeLessThan(1e-12)
  })

  it('a two-wire line far apart has the surface field of an isolated wire', () => {
    const g = describeGeometry({ kind: 'twoWire', a: 0.4e-3, d: 0.4e-3 * 1e5 })
    const V = 100
    const lambda = capacitance(g).perMetre * V
    const isolated = lambda / (2 * Math.PI * epsOf(g) * g.a)
    expect(relative(peakField(g, V), isolated)).toBeLessThan(1e-4)
  })

  it('a wire over a plane has the surface field of an isolated wire when it is high', () => {
    const g = describeGeometry({ kind: 'wireOverGround', a: 1e-3, h: 1e-3 * 1e5 })
    const V = 100
    const lambda = capacitance(g).perMetre * V
    const isolated = lambda / (2 * Math.PI * epsOf(g) * g.a)
    expect(relative(peakField(g, V), isolated)).toBeLessThan(1e-4)
  })
})

describe('a geometry with no closed form is declined, with the reason', () => {
  it('a solenoid has no capacitance here', () => {
    expect(() => capacitance({ kind: 'solenoid', area: 1e-4, len: 0.1, turns: 100 })).toThrow(FieldsError)
    try {
      capacitance({ kind: 'solenoid', area: 1e-4, len: 0.1, turns: 100 })
    } catch (e) {
      expect(e.message).toMatch(/no closed-form capacitance/)
      expect(e.message).toMatch(/Solve it on a grid/)
    }
  })

  it('a two-wire line has no closed-form resistance here', () => {
    expect(() => resistance({ kind: 'twoWire', a: 1e-3, d: 1e-2 }, 1)).toThrow(/no closed-form resistance/)
  })

  it('a parallel plate has no closed-form inductance here', () => {
    expect(() => inductance({ kind: 'parallelPlate', area: 1e-4, gap: 1e-3 })).toThrow(/no closed-form inductance/)
  })
})

describe('the figures the plan quotes', () => {
  const coax = { kind: 'coax', a: 0.45e-3, b: 1.475e-3, epsr: 2.25 }

  it('RG-58 holds 105.4 pF per metre and 237.4 nH per metre', () => {
    expect(capacitance(coax).perMetre * 1e12).toBeCloseTo(105.4, 1)
    expect(inductance(coax).perMetre * 1e9).toBeCloseTo(237.4, 1)
  })

  it('its characteristic impedance and speed follow from those two', () => {
    const L = inductance(coax).perMetre
    const C = capacitance(coax).perMetre
    expect(Math.sqrt(L / C)).toBeCloseTo(47.45, 2)
    // The speed is exactly c over the square root of epsr, which is the seam
    // between this lab's two halves.
    expect(1 / Math.sqrt(L * C)).toBeCloseTo(299792458 / Math.sqrt(2.25), 3)
  })

  it('a 100 mm2 plate at 1 mm holds 0.8854 pF in air', () => {
    expect(capacitance({ kind: 'parallelPlate', area: 1e-4, gap: 1e-3 }).value * 1e12).toBeCloseTo(0.8854, 4)
  })

  it('a sphere of 50 mm in a shell of 60 mm holds 33.38 pF', () => {
    expect(capacitance({ kind: 'spherical', a: 0.05, b: 0.06 }).value * 1e12).toBeCloseTo(33.38, 2)
  })

  it('one metre of RG-58 at 100 V stores 0.5272 microjoule', () => {
    expect(fieldEnergy(coax, 100).W * 1e6).toBeCloseTo(0.5272, 4)
  })

  it('every closed form names what it neglects', () => {
    for (const [kind, spec] of Object.entries(KINDS)) {
      const g = randomGeometry(rng(kind.length * 7 + 1), kind)
      for (const q of spec.has) {
        const fn = q === 'capacitance' ? capacitance : q === 'inductance' ? inductance : (x) => resistance(x, 1)
        const out = fn(g)
        expect(out.formula, `${kind} ${q}`).toBeTruthy()
        expect(out.neglects, `${kind} ${q}`).toBeTruthy()
        expect(out.symbol, `${kind} ${q}`).toMatch(/^[CRL]$/)
      }
    }
  })
})
