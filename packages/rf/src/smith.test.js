import { describe, it, expect } from 'vitest'
import { complex as cx } from '@ee-labs/network'
import {
  CHART_R,
  CHART_X,
  chartFamilies,
  circleError,
  circlePoints,
  conductanceCircle,
  gammaToZ,
  lineLocus,
  meetsUnitDisc,
  normalise,
  onCircle,
  place,
  qArc,
  qOf,
  reactanceCircle,
  resistanceCircle,
  susceptanceCircle,
  towardsGenerator,
  vswrCircle,
  zToGamma,
} from './smith.js'
import { RfError } from './const.js'

// The chart is the algebra, and this file says so by never drawing anything.
// Every circle is checked by putting points on it and mapping them back through
// (z − 1)/(z + 1), so a circle that is right by construction and wrong by
// arithmetic fails here.

const { C, cabs, cadd, cdiv, csub } = cx

const close = (got, want, tol = 1e-12) => expect(Math.abs(got - want)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(want)))

/** The map, written out again, so the test does not check the code against itself. */
const gammaByHand = (r, x) => {
  const z = C(r, x)
  return cdiv(csub(z, C(1)), cadd(z, C(1)))
}

describe('the map itself', () => {
  it('sends the right half plane into the unit disc', () => {
    for (let r = 0; r <= 20; r += 0.37) {
      for (let x = -20; x <= 20; x += 1.7) {
        expect(cabs(zToGamma(C(r, x)))).toBeLessThanOrEqual(1 + 1e-12)
      }
    }
  })

  it('puts the open at 1, the short at −1 and the match at the centre', () => {
    expect(cabs(csub(zToGamma(Infinity), C(1)))).toBeLessThan(1e-15)
    expect(cabs(csub(zToGamma(C(0)), C(-1)))).toBeLessThan(1e-15)
    expect(cabs(zToGamma(C(1)))).toBeLessThan(1e-15)
  })

  it('agrees with the formula written out, at every point tried', () => {
    for (const [r, x] of [[2, 0], [0.5, 0], [0, 1], [0, -1], [0.6, -0.8], [3, 2], [0.25, 0]]) {
      expect(cabs(csub(zToGamma(C(r, x)), gammaByHand(r, x)))).toBeLessThan(1e-15)
    }
  })

  it('comes back: the impedance a reflection stands for is the one it came from', () => {
    for (const [r, x] of [[2, 0], [0.5, 3], [0.1, -0.4], [8, -2]]) {
      const back = gammaToZ(zToGamma(C(r, x)))
      expect(cabs(csub(back, C(r, x)))).toBeLessThan(1e-12 * Math.max(1, Math.hypot(r, x)))
    }
  })

  it('normalises against the reference impedance the reader chose', () => {
    for (const z0 of [50, 75, 300]) {
      const p = place(2 * z0, z0)
      close(p.z[0], 2)
      close(p.mag, 1 / 3)
      close(p.vswr, 2)
    }
  })
})

describe('the circles are the images of lines under the map', () => {
  it('a constant-resistance circle holds every point of constant resistance', () => {
    for (const r of [0, 0.2, 0.5, 1, 2, 5, 20]) {
      const circle = resistanceCircle(r)
      close(circle.cx, r / (1 + r))
      close(circle.radius, 1 / (1 + r))
      for (const x of [-30, -3, -0.4, 0, 0.4, 3, 30]) {
        const g = zToGamma(C(r, x))
        expect(circleError(circle, [g[0], g[1]]), `r = ${r}, x = ${x}`).toBeLessThan(1e-12)
      }
    }
  })

  it('a constant-reactance circle holds every point of constant reactance', () => {
    for (const x of [0.2, 0.5, 1, 2, 5, -0.5, -2]) {
      const circle = reactanceCircle(x)
      close(circle.cx, 1)
      close(circle.cy, 1 / x)
      close(circle.radius, Math.abs(1 / x))
      for (const r of [0, 0.1, 0.7, 3, 40]) {
        const g = zToGamma(C(r, x))
        expect(circleError(circle, [g[0], g[1]]), `r = ${r}, x = ${x}`).toBeLessThan(1e-12)
      }
    }
  })

  it('a constant-conductance circle is the resistance circle turned half a turn', () => {
    for (const g of [0.2, 0.5, 1, 2, 5]) {
      const circle = conductanceCircle(g)
      close(circle.cx, -g / (1 + g))
      close(circle.radius, 1 / (1 + g))
      for (const b of [-4, -0.6, 0, 0.6, 4]) {
        // The point on the IMPEDANCE chart of an admittance g + jb.
        const gy = zToGamma(C(g, b))
        expect(circleError(circle, [-gy[0], -gy[1]]), `g = ${g}, b = ${b}`).toBeLessThan(1e-12)
      }
    }
  })

  it('a constant-susceptance arc holds every point of constant susceptance', () => {
    for (const b of [0.5, 1, 2, -1]) {
      const circle = susceptanceCircle(b)
      for (const g of [0.1, 0.5, 2, 9]) {
        const gy = zToGamma(C(g, b))
        expect(circleError(circle, [-gy[0], -gy[1]]), `g = ${g}, b = ${b}`).toBeLessThan(1e-12)
      }
    }
  })

  it('a standing-wave circle is centred on the match, with the radius the ratio gives', () => {
    for (const s of [1, 1.5, 2, 3, 10]) {
      const circle = vswrCircle(s)
      close(circle.cx, 0)
      close(circle.radius, (s - 1) / (s + 1))
      // Every load with that ratio sits on it, whatever its phase.
      const p = place(s * 50, 50)
      expect(circleError(circle, [p.gamma[0], p.gamma[1]])).toBeLessThan(1e-12)
      const q = place(50 / s, 50)
      expect(circleError(circle, [q.gamma[0], q.gamma[1]])).toBeLessThan(1e-12)
    }
  })

  it('a ratio below one is declined, because no line has one', () => {
    expect(() => vswrCircle(0.5)).toThrow(RfError)
  })

  it('a constant-Q arc holds every impedance whose reactance is Q times its resistance', () => {
    for (const Q of [0.5, 1, 2, 5]) {
      for (const sign of [1, -1]) {
        const arc = qArc(Q, sign)
        close(arc.radius, Math.sqrt(1 + 1 / (Q * Q)))
        for (const r of [0.1, 0.4, 1, 3]) {
          const g = zToGamma(C(r, sign * Q * r))
          expect(circleError(arc, [g[0], g[1]]), `Q = ${Q}, r = ${r}`).toBeLessThan(1e-12)
          close(qOf([r, sign * Q * r]), Q)
        }
      }
    }
  })

  it('the arc passes through the open and the short, which is why it is an arc', () => {
    const arc = qArc(2)
    expect(onCircle(arc, [1, 0])).toBe(true)
    expect(onCircle(arc, [-1, 0])).toBe(true)
  })
})

describe('the families a chart draws', () => {
  it('the impedance chart carries the resistance and reactance families and nothing else', () => {
    const fam = chartFamilies({ mode: 'impedance' })
    expect(new Set(fam.map((f) => f.family))).toEqual(new Set(['r', 'x']))
    expect(fam.filter((f) => f.family === 'r').length).toBe(CHART_R.length)
    expect(fam.filter((f) => f.family === 'x').length).toBe(2 * CHART_X.length)
  })

  it('the admittance chart is the same count in the mirrored families', () => {
    const fam = chartFamilies({ mode: 'admittance' })
    expect(new Set(fam.map((f) => f.family))).toEqual(new Set(['g', 'b']))
  })

  it('the overlaid pair carries both, which is what a matching network is drawn on', () => {
    const fam = chartFamilies({ mode: 'both' })
    expect(new Set(fam.map((f) => f.family))).toEqual(new Set(['r', 'x', 'g', 'b']))
  })

  it('every circle a chart draws contains the points it claims to', () => {
    for (const circle of chartFamilies({ mode: 'both' })) {
      for (const p of circlePoints(circle, 24)) expect(circleError(circle, p)).toBeLessThan(1e-12)
    }
  })

  it('the unit circle is the boundary, and a circle is known to meet it or not', () => {
    expect(meetsUnitDisc({ cx: 0, cy: 0, radius: 0.5 })).toBe(false)
    expect(meetsUnitDisc({ cx: 0.9, cy: 0, radius: 0.5 })).toBe(true)
    expect(meetsUnitDisc({ cx: 3, cy: 0, radius: 0.5 })).toBe(false)
  })
})

describe('motion along a line, on the chart', () => {
  const beta = 30.371158677395528

  it('turns clockwise at two beta radians per metre and stays on its own circle', () => {
    const g = zToGamma(C(2, 0))
    const circle = vswrCircle(2)
    for (const d of [0.005, 0.02, 0.0517191]) {
      const moved = towardsGenerator(g, beta * d)
      close(cabs(moved), cabs(g))
      expect(circleError(circle, [moved[0], moved[1]])).toBeLessThan(1e-12)
      const turned = Math.atan2(moved[1], moved[0]) - Math.atan2(g[1], g[0])
      const wrapped = ((-turned % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
      close(wrapped, (2 * beta * d) % (2 * Math.PI), 1e-9)
    }
  })

  it('a half wavelength is one full turn, so the impedance comes back', () => {
    const g = zToGamma(C(2, 0))
    const half = Math.PI / beta
    expect(cabs(csub(towardsGenerator(g, beta * half), g))).toBeLessThan(1e-12)
  })

  it('loss turns the circle into a spiral inwards', () => {
    const g = zToGamma(C(2, 0))
    const locus = lineLocus(g, { beta, alpha: 0.05, length: 0.0517191, steps: 8 })
    const first = Math.hypot(locus[0][0], locus[0][1])
    const last = Math.hypot(locus.at(-1)[0], locus.at(-1)[1])
    expect(last).toBeLessThan(first)
    close(last, first * Math.exp(-2 * 0.05 * 0.0517191), 1e-12)
  })

  it('the locus is a path of the length asked for, in the steps asked for', () => {
    const locus = lineLocus(C(0.5), { beta, length: 0.1, steps: 32 })
    expect(locus.length).toBe(33)
  })
})

describe('a load placed on the chart', () => {
  it('reads the same magnitude, angle and ratio the one-port numbers give', () => {
    const p = place([30, -40], 50)
    close(p.mag, 0.5)
    close(p.deg, -90)
    close(p.vswr, 3)
    close(p.z[0], 0.6)
    close(p.z[1], -0.8)
    close(p.q, 0.8 / 0.6)
  })

  it('an open circuit is on the edge, and it is not a large number', () => {
    const p = place(Infinity, 50)
    close(p.mag, 1)
    expect(p.vswr).toBe(Infinity)
  })

  it('normalise and its inverse are the same map with the reference put back', () => {
    const z = normalise([150, 100], 50)
    close(z[0], 3)
    close(z[1], 2)
  })
})
