import { describe, it, expect } from 'vitest'
import { complex as cx } from '@ee-labs/network'
import {
  arcPoints,
  chart,
  conductanceCircle,
  gammaOfY,
  gammaToZ,
  impedanceAt,
  inWavelengths,
  magnitudeCircle,
  markerAt,
  onCircle,
  pathTowardsGenerator,
  pointOn,
  qArc,
  qOf,
  reactanceCircle,
  resistanceCircle,
  susceptanceCircle,
  turnDegrees,
  vswrCircle,
  zToGamma,
} from './smith.js'
import { rng } from './fuzz.js'

const { C, cabs, cdiv, csub } = cx

const close = (a, b, tol = 1e-12) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(a), Math.abs(b)))
const closeC = (x, y, tol = 1e-12) => expect(cabs(csub(x, y))).toBeLessThanOrEqual(tol * Math.max(1, cabs(x), cabs(y)))

describe('the chart is one map', () => {
  it('sends the short to minus one, the open to plus one and the match to the centre', () => {
    closeC(zToGamma(C(0, 0)), C(-1, 0))
    closeC(zToGamma(C(1, 0)), C(0, 0))
    closeC(zToGamma(Infinity), C(1, 0))
  })

  it('sends the right half plane inside the unit disc, at two hundred points', () => {
    const r = rng(4242)
    for (let k = 0; k < 200; k++) {
      const z = C(0.001 * Math.pow(1e6, r()), 2000 * (r() - 0.5))
      expect(cabs(zToGamma(z)), `z = ${z}`).toBeLessThan(1)
    }
  })

  it('is its own inverse both ways, so a point read off the chart is the impedance', () => {
    const r = rng(77)
    for (let k = 0; k < 100; k++) {
      const z = C(0.01 * Math.pow(1e4, r()), 100 * (r() - 0.5))
      closeC(gammaToZ(zToGamma(z)), z, 1e-9)
    }
  })

  it('the reactance axis maps to the unit circle, because a reactance takes no power', () => {
    for (const x of [-5, -1, -0.2, 0.2, 1, 5]) close(cabs(zToGamma(C(0, x))), 1)
  })
})

// ---------------------------------------------------------------- invariant 5

describe('invariant 5: the chart is the algebra', () => {
  it('every point on a constant-resistance circle has that resistance', () => {
    for (const rv of [0, 0.2, 0.5, 1, 2, 5, 20]) {
      const circle = resistanceCircle(rv)
      for (let k = 0; k < 36; k++) {
        const p = pointOn(circle, (2 * Math.PI * k) / 36)
        if (Math.abs(p[0] - 1) < 1e-9 && Math.abs(p[1]) < 1e-9) continue // the open circuit
        const z = gammaToZ(p)
        expect(Math.abs(z[0] - rv), `r = ${rv} at ${k}`).toBeLessThan(1e-9 * Math.max(1, rv))
      }
    }
  })

  it('every point on a constant-reactance arc has that reactance', () => {
    for (const xv of [-5, -1, -0.2, 0.2, 1, 5]) {
      const circle = reactanceCircle(xv)
      for (let k = 0; k < 36; k++) {
        const p = pointOn(circle, (2 * Math.PI * k) / 36)
        if (Math.hypot(p[0], p[1]) > 1 - 1e-9) continue // outside the chart, or the open circuit
        const z = gammaToZ(p)
        expect(Math.abs(z[1] - xv), `x = ${xv} at ${k}`).toBeLessThan(1e-9 * Math.max(1, Math.abs(xv)))
      }
    }
  })

  it('the two circles the plan names have the centres and radii it quotes', () => {
    const r1 = resistanceCircle(1)
    close(r1.cx, 0.5)
    close(r1.cy, 0)
    close(r1.radius, 0.5)
    const x1 = reactanceCircle(1)
    close(x1.cx, 1)
    close(x1.cy, 1)
    close(x1.radius, 1)
  })

  it('a circle contains the points it claims to, to 1e-12', () => {
    for (const rv of [0.2, 1, 5]) {
      const circle = resistanceCircle(rv)
      for (let k = 0; k < 12; k++) expect(onCircle(circle, pointOn(circle, k), 1e-12)).toBe(true)
    }
    // The centre of a circle is not on it, and the match point is the centre
    // of the r = 1 circle.
    expect(onCircle(resistanceCircle(1), [0.5, 0], 1e-12)).toBe(false)
  })

  it('every circle the chart draws is placed by the map and not by a table', () => {
    const { circles } = chart({ mode: 'both', vswr: [2, 3], q: [1, 3], mag: [1 / 3] })
    const family = (name) => circles.filter((c) => c.family === name)
    expect(family('r').length).toBe(6)
    expect(family('x').length).toBe(10)
    expect(family('g').length).toBe(6)
    expect(family('b').length).toBe(10)
    expect(family('vswr').length).toBe(2)
    expect(family('q').length).toBe(4)
    expect(family('mag').length).toBe(1)
    for (const c of family('r')) {
      const want = resistanceCircle(c.value)
      close(c.cx, want.cx)
      close(c.radius, want.radius)
    }
    expect(() => chart({ mode: 'polar' })).toThrow(/'z', 'y' or 'both'/)
  })
})

describe('the admittance chart is the impedance chart turned round', () => {
  it('a load read on both charts gives y = 1 over z', () => {
    for (const z of [C(2, 0), C(0.5, 1), C(1, -3)]) {
      const gz = zToGamma(z)
      const gy = gammaOfY(gz)
      closeC(gammaToZ(gy), cdiv(C(1), z), 1e-9)
    }
  })

  it('the conductance and susceptance families are the resistance and reactance ones mirrored', () => {
    for (const v of [0.2, 1, 5]) {
      close(conductanceCircle(v).cx, -resistanceCircle(v).cx)
      close(conductanceCircle(v).radius, resistanceCircle(v).radius)
      close(susceptanceCircle(v).cy, -reactanceCircle(v).cy)
    }
  })
})

describe('the other families', () => {
  it('a VSWR circle is centred at the origin with the reflection magnitude as its radius', () => {
    close(vswrCircle(2).radius, 1 / 3)
    close(vswrCircle(3).radius, 0.5)
    close(vswrCircle(1).radius, 0)
    close(vswrCircle(Infinity).radius, 1)
    close(magnitudeCircle(1 / 3).radius, 1 / 3)
    expect(() => vswrCircle(0.5)).toThrow(/at least one/)
  })

  it('a constant-Q arc passes through both ends of the real axis and holds its Q', () => {
    for (const Q of [0.5, 1, 3]) {
      const arc = qArc(Q, 1)
      expect(onCircle(arc, [1, 0], 1e-12)).toBe(true)
      expect(onCircle(arc, [-1, 0], 1e-12)).toBe(true)
      // A point on the arc inside the disc has |x| / r equal to Q.
      for (let k = 1; k < 12; k++) {
        const p = pointOn(arc, (2 * Math.PI * k) / 12)
        if (Math.hypot(p[0], p[1]) > 1 - 1e-6) continue
        close(qOf(p), Q, 1e-7)
      }
    }
    expect(() => qArc(0)).toThrow(/positive Q/)
  })

  it('a circle drawn as a polyline is clipped to the disc and broken where it leaves', () => {
    const inside = arcPoints(resistanceCircle(1))
    expect(inside.every((p) => p === null || Math.hypot(p[0], p[1]) <= 1 + 1e-12)).toBe(true)
    expect(inside.filter(Boolean).length).toBeGreaterThan(100)
    const outside = arcPoints(reactanceCircle(0.2))
    expect(outside.filter(Boolean).length).toBeLessThan(outside.length)
  })
})

describe('the marker a reader drags', () => {
  it('reads one load as an impedance, an admittance and three costumes of one number', () => {
    const m = markerAt(C(100, 0), 50, { label: 'load' })
    close(m.mag, 1 / 3)
    close(m.vswr, 2)
    close(m.z[0], 2)
    close(m.y[0], 0.5)
    close(m.returnLossDb, -20 * Math.log10(1 / 3))
    expect(m.label).toBe('load')
  })

  it('reads a complex load, and its Q', () => {
    const m = markerAt(C(30, -40), 50)
    close(m.mag, 0.5, 1e-12)
    close(m.vswr, 3, 1e-12)
    close(m.q, 40 / 30, 1e-12)
    closeC(m.gamma, C(0, -0.5), 1e-12)
  })

  it('puts an open circuit at plus one and reads its admittance as zero', () => {
    const m = markerAt(Infinity, 50)
    closeC(m.gamma, C(1, 0))
    expect(m.z).toBe(Infinity)
    closeC(m.y, C(0, 0))
    expect(m.q).toBe(Infinity)
  })

  it('turns a point on the chart back into ohms', () => {
    closeC(impedanceAt(C(1 / 3, 0), 50), C(100, 0), 1e-9)
    expect(impedanceAt(C(1, 0), 50)).toBe(Infinity)
    expect(() => markerAt(C(50, 0), 0)).toThrow(/positive resistance/)
  })
})

describe('motion along the line', () => {
  it('a quarter wave is half a turn, and a half wave is a whole one', () => {
    const beta = 2 * Math.PI // one radian per metre times 2 pi: a wavelength of one metre
    close(turnDegrees(beta, 0.25), 180)
    close(turnDegrees(beta, 0.5), 360)
    close(inWavelengths(beta, 0.25), 0.25)
  })

  it('on a lossless line the path is a circle of constant magnitude', () => {
    const gL = zToGamma(C(2, 0))
    const path = pathTowardsGenerator(gL, { beta: 2 * Math.PI, length: 0.5, points: 73 })
    for (const p of path) close(cabs(p), cabs(gL), 1e-12)
    // A whole half wavelength brings the point back to where it started.
    closeC(path[path.length - 1], gL, 1e-9)
    // A quarter wave sends 100 ohms to 25 ohms, which is B3's claim and A3's.
    const quarter = pathTowardsGenerator(gL, { beta: 2 * Math.PI, length: 0.25, points: 3 })
    closeC(gammaToZ(quarter[2]), C(0.5, 0), 1e-9)
  })

  it('on a lossy line the path spirals inward', () => {
    const gL = zToGamma(C(2, 0))
    const path = pathTowardsGenerator(gL, { beta: 2 * Math.PI, length: 0.5, alpha: 0.5, points: 33 })
    expect(cabs(path[path.length - 1])).toBeLessThan(cabs(gL))
    for (let k = 1; k < path.length; k++) expect(cabs(path[k])).toBeLessThanOrEqual(cabs(path[k - 1]) + 1e-15)
    expect(() => pathTowardsGenerator(gL, { beta: 0, length: 1 })).toThrow(/phase constant/)
    expect(() => pathTowardsGenerator(gL, { beta: 1, length: -1 })).toThrow(/not negative/)
  })
})
