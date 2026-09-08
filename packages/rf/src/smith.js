// The Smith chart, as numbers rather than as a picture.
//
// CORE_SCOPE class: ADMITTED, EXACT. The chart is the map Γ = (z − 1)/(z + 1)
// from the normalised impedance plane to the unit disc, and every curve on it
// is the image of a line or a circle under a Möbius map, which is a line or a
// circle. So every family below is a centre and a radius in closed form, and
// nothing here is traced from a table or read off a drawing.
//
// The bilinear map itself, and the two families it is built from, are already
// in `@ee-labs/fields` and are tested there. This module inherits them rather
// than writing a second copy, which is what `apps/fields-lab/NEEDS.md` §3.2
// asks for: one set of circles in the suite, not two that drift apart. What is
// added here is the rest of what a chart draws. The admittance families, the
// standing-wave circle, the constant-Q arc, and the arithmetic that says
// whether a point lies on a circle.

import { complex as cx } from '@ee-labs/network'
import { gammaToZ, normalise, reactanceCircle, resistanceCircle, towardsGenerator, zToGamma } from '@ee-labs/fields'
import { positive, require_ } from './const.js'
import { gammaFromVswr } from './sparam.js'

const { C, cabs, cadd, carg, cdiv, cmul, cscale, csub } = cx

export { gammaToZ, normalise, reactanceCircle, resistanceCircle, towardsGenerator, zToGamma }

/** The normalised impedance a reflection coefficient stands for, denormalised. */
export const denormalise = (z, z0) => (z === Infinity ? Infinity : cscale(Array.isArray(z) ? z : C(z), z0))

// ------------------------------------------------------------- the families

/**
 * A constant-conductance circle on the impedance chart.
 *
 * The admittance chart is the impedance chart rotated by half a turn, because
 * y = 1/z sends Γ to −Γ. So a constant-conductance circle of normalised
 * conductance g is the constant-resistance circle of r = g reflected through
 * the origin, which moves its centre and leaves its radius alone.
 */
export const conductanceCircle = (g) => {
  const c = resistanceCircle(g)
  return { cx: -c.cx, cy: 0, radius: c.radius }
}

/** A constant-susceptance arc, the reactance arc reflected through the origin. */
export const susceptanceCircle = (b) => {
  const c = reactanceCircle(b)
  return { cx: -c.cx, cy: -c.cy, radius: c.radius }
}

/**
 * The circle a fixed standing-wave ratio traces: centred at the origin with
 * radius (S − 1)/(S + 1). Moving along a lossless line stays on it.
 */
export function vswrCircle(s) {
  require_(s >= 1, `A standing-wave ratio is at least 1, and this one is ${s}. The ratio of the largest voltage on the line to the smallest cannot be below one.`, { field: 'vswr' })
  return { cx: 0, cy: 0, radius: gammaFromVswr(s) }
}

/**
 * A constant-Q arc: the circle through Γ = ±1 centred at (0, ∓1/Q) with radius
 * sqrt(1 + 1/Q²).
 *
 * The arc is where |x/r| equals Q, so it is the boundary a matching network's
 * path must stay inside to keep its bandwidth. Group C uses it. It is here
 * because it belongs to the chart's geometry and not to the network.
 *
 * `sign` is the sign of the reactance, and the centre sits on the other side of
 * the real axis from the arc it carries. The inductive arc runs through the
 * upper half of the disc and its circle is centred below it, at −1/Q, because
 * the circle through both ±1 that reaches highest is the one pushed down.
 */
export function qArc(Q, sign = 1) {
  positive(Q, 'Q')
  return { cx: 0, cy: (sign >= 0 ? -1 : 1) / Q, radius: Math.sqrt(1 + 1 / (Q * Q)) }
}

/** The Q of a normalised impedance: |x| over r, the ratio the arcs are labelled by. */
export function qOf(z) {
  const [r, x] = Array.isArray(z) ? z : [z, 0]
  return r === 0 ? Infinity : Math.abs(x / r)
}

// --------------------------------------------------------- circles as points

/** `n` points around a circle, for a canvas that draws it as a path. */
export function circlePoints(circle, n = 128) {
  const out = []
  for (let k = 0; k <= n; k++) {
    const t = (2 * Math.PI * k) / n
    out.push([circle.cx + circle.radius * Math.cos(t), circle.cy + circle.radius * Math.sin(t)])
  }
  return out
}

/** How far a point is from a circle, relative to the circle's own radius. */
export function circleError(circle, point) {
  const d = Math.hypot(point[0] - circle.cx, point[1] - circle.cy)
  return Math.abs(d - circle.radius) / Math.max(1e-300, circle.radius)
}

/** Whether a point lies on a circle, to a relative tolerance. */
export const onCircle = (circle, point, tol = 1e-12) => circleError(circle, point) <= tol

/** Whether a circle meets the unit disc, which is the test a stability circle is read by. */
export function meetsUnitDisc(circle) {
  const d = Math.hypot(circle.cx, circle.cy)
  return d < 1 + circle.radius && d > Math.abs(1 - circle.radius) - 1e-15
}

// --------------------------------------------------------------- the chart

/** The grid a chart draws by default: the resistance and reactance values every chart carries. */
export const CHART_R = [0, 0.2, 0.5, 1, 2, 5]
export const CHART_X = [0.2, 0.5, 1, 2, 5]

/**
 * The families one chart draws, as centres and radii, in the mode asked for.
 *
 * `mode` is 'impedance', 'admittance' or 'both'. The overlaid pair is what a
 * matching network is designed on, because a series element moves along a
 * constant-resistance circle and a shunt element along a constant-conductance
 * circle, and both moves have to be visible at once.
 */
export function chartFamilies({ mode = 'impedance', r = CHART_R, x = CHART_X } = {}) {
  const out = []
  if (mode === 'impedance' || mode === 'both') {
    for (const v of r) out.push({ ...resistanceCircle(v), family: 'r', value: v })
    for (const v of x) {
      out.push({ ...reactanceCircle(v), family: 'x', value: v })
      out.push({ ...reactanceCircle(-v), family: 'x', value: -v })
    }
  }
  if (mode === 'admittance' || mode === 'both') {
    for (const v of r) out.push({ ...conductanceCircle(v), family: 'g', value: v })
    for (const v of x) {
      out.push({ ...susceptanceCircle(v), family: 'b', value: v })
      out.push({ ...susceptanceCircle(-v), family: 'b', value: -v })
    }
  }
  return out
}

/**
 * Where a load sits on the chart, with everything a marker prints beside it.
 *
 * The angle is the reflection coefficient's, in degrees, and the radius is its
 * magnitude, so a reader can check the marker against the readout by eye.
 */
export function place(ZL, z0 = 50) {
  const z = normalise(ZL, z0)
  const g = zToGamma(z)
  return {
    z,
    gamma: g,
    mag: cabs(g),
    deg: (carg(g) * 180) / Math.PI,
    vswr: cabs(g) >= 1 ? Infinity : (1 + cabs(g)) / (1 - cabs(g)),
    q: z === Infinity ? Infinity : qOf(z),
  }
}

/**
 * The path a length of line traces on the chart, towards the generator.
 *
 * On a lossless line the path is an arc of the constant-|Γ| circle, clockwise
 * at 2β radians per metre, so half a wavelength is one full turn. Add loss and
 * the arc spirals inwards by exp(−2αl), because the reflected wave crosses the
 * line twice and is attenuated on both passes.
 */
export function lineLocus(gamma, { beta, alpha = 0, length, steps = 96 }) {
  positive(beta, 'beta')
  const out = []
  for (let k = 0; k <= steps; k++) {
    const d = (length * k) / steps
    const g = towardsGenerator(gamma, beta * d, alpha * d)
    out.push([g[0], g[1]])
  }
  return out
}

export { C, cabs, cadd, carg, cdiv, cmul, cscale, csub }
