// The Smith chart, as numbers rather than as a picture.
//
// CLASS, under CORE_SCOPE.md: EXACT, and never hedged. The chart is the map
// Gamma = (z - 1)/(z + 1) from the normalised impedance plane to the unit
// disc. A Mobius map sends lines and circles to lines and circles, so every
// family the chart draws has a centre and a radius in closed form. Nothing
// here is drawn from a table or traced off an image.
//
// The base map and the two impedance families are `packages/fields/src/line.js`
// and are re-exported rather than written again. Decision 3 of RF_LAB_PLAN.md
// says the Fields Lab derives and this lab evaluates, and the Fields Lab's
// NEEDS.md §3.2 records that the RF Lab inherits the arithmetic. What this
// module adds is what the chart needs beyond the impedance grid: the
// admittance chart, the constant-magnitude and standing-wave circles, the
// constant-Q arcs, the marker a reader drags, and the path a length of line
// traces.
//
// Invariant 5 of RF_LAB_PLAN.md §2.13 is the test: every point this module
// places is (z - 1)/(z + 1) evaluated directly, and every circle it returns
// contains the points it claims to, to 1e-12.

import { complex as cx } from '@ee-labs/network'
import { gammaToZ, normalise, reactanceCircle, resistanceCircle, standingWaveRatio, towardsGenerator, zToGamma } from '@ee-labs/fields'
import { mismatch, require_, toC } from './sparam.js'

const { C, cabs, cadd, cdiv, cscale, csub } = cx

export { gammaToZ, normalise, reactanceCircle, resistanceCircle, towardsGenerator, zToGamma }

/** The default rungs of the impedance grid, chosen so the chart reads on a phone. */
export const R_GRID = [0, 0.2, 0.5, 1, 2, 5]
export const X_GRID = [0.2, 0.5, 1, 2, 5]

// ------------------------------------------------------ the admittance chart

/**
 * The admittance chart is the impedance chart rotated by 180 degrees, because
 * y = 1/z and (1/z - 1)/(1/z + 1) = -(z - 1)/(z + 1). So one map serves both,
 * and a shunt element moves along a constant-conductance circle in exactly the
 * way a series element moves along a constant-resistance one.
 */
export const gammaOfY = (gamma) => cscale(toC(gamma), -1)

const mirror = ({ cx: x, cy: y, radius }) => ({ cx: -x, cy: -y, radius })

/** The constant-conductance circle for normalised conductance g. */
export const conductanceCircle = (g) => mirror(resistanceCircle(g))

/** The constant-susceptance arc for normalised susceptance b. */
export const susceptanceCircle = (b) => mirror(reactanceCircle(b))

// ------------------------------------------------------- the other families

/** The circle of constant reflection magnitude, centred at the origin. */
export const magnitudeCircle = (mag) => ({ cx: 0, cy: 0, radius: Math.abs(mag) })

/**
 * The standing-wave circle for a ratio S. A load's reflection magnitude and
 * its standing-wave ratio are the same number in two costumes, so this is the
 * magnitude circle of (S - 1)/(S + 1).
 */
export function vswrCircle(swr) {
  require_(swr >= 1, `A standing-wave ratio is at least one, not ${swr}. It is the ratio of the largest voltage on the line to the smallest.`, { field: 'swr' })
  return magnitudeCircle(swr === Infinity ? 1 : (swr - 1) / (swr + 1))
}

/**
 * The constant-Q arc. A point whose normalised impedance is r + jx has
 * Q = |x|/r, and the locus of constant Q is the circle through Gamma = 1 and
 * Gamma = -1 centred at (0, 1/Q) with radius sqrt(1 + 1/Q^2). The sign picks
 * the inductive half or the capacitive one.
 */
export function qArc(Q, sign = 1) {
  require_(Q > 0, `A constant-Q arc needs a positive Q, not ${Q}.`, { field: 'Q' })
  return { cx: 0, cy: (sign >= 0 ? 1 : -1) / Q, radius: Math.sqrt(1 + 1 / (Q * Q)) }
}

/** The Q of a point on the chart: the reactance over the resistance, in magnitude. */
export function qOf(gamma) {
  const z = gammaToZ(toC(gamma))
  if (z === Infinity) return Infinity
  return z[0] === 0 ? Infinity : Math.abs(z[1] / z[0])
}

// --------------------------------------------------------------- the chart

/**
 * Every circle the canvas draws, as a list of records with a family, the value
 * the curve is labelled with, a centre and a radius.
 *
 * `mode` is 'z' for the impedance chart, 'y' for the admittance chart, or
 * 'both' for the pair overlaid, which is what a matching network needs. The
 * extra families are passed in as numbers rather than as records, so that the
 * caller states what it wants shown and this module states where it goes.
 */
export function chart({ mode = 'z', r = R_GRID, x = X_GRID, vswr = [], q = [], mag = [] } = {}) {
  require_(['z', 'y', 'both'].includes(mode), `The chart is drawn as 'z', 'y' or 'both', not '${mode}'.`, { field: 'mode' })
  const circles = []
  const wantZ = mode === 'z' || mode === 'both'
  const wantY = mode === 'y' || mode === 'both'
  if (wantZ) {
    for (const v of r) circles.push({ family: 'r', value: v, ...resistanceCircle(v) })
    for (const v of x) {
      circles.push({ family: 'x', value: v, ...reactanceCircle(v) })
      circles.push({ family: 'x', value: -v, ...reactanceCircle(-v) })
    }
  }
  if (wantY) {
    for (const v of r) circles.push({ family: 'g', value: v, ...conductanceCircle(v) })
    for (const v of x) {
      circles.push({ family: 'b', value: v, ...susceptanceCircle(v) })
      circles.push({ family: 'b', value: -v, ...susceptanceCircle(-v) })
    }
  }
  for (const v of vswr) circles.push({ family: 'vswr', value: v, ...vswrCircle(v) })
  for (const v of mag) circles.push({ family: 'mag', value: v, ...magnitudeCircle(v) })
  for (const v of q) {
    circles.push({ family: 'q', value: v, ...qArc(v, 1) })
    circles.push({ family: 'q', value: -v, ...qArc(v, -1) })
  }
  return { mode, circles }
}

/** A point on a circle at angle theta, for the drawing and for the test. */
export const pointOn = (circle, theta) => [circle.cx + circle.radius * Math.cos(theta), circle.cy + circle.radius * Math.sin(theta)]

/** Whether a point lies on a circle, to a tolerance. */
export const onCircle = (circle, pt, tol = 1e-12) => Math.abs(Math.hypot(pt[0] - circle.cx, pt[1] - circle.cy) - circle.radius) <= tol

/** A circle as a polyline, clipped to the unit disc, which is what the canvas draws. */
export function arcPoints(circle, { points = 181, clip = true } = {}) {
  const out = []
  for (let i = 0; i < points; i++) {
    const p = pointOn(circle, (2 * Math.PI * i) / (points - 1))
    if (clip && Math.hypot(p[0], p[1]) > 1 + 1e-12) {
      if (out.length) out.push(null)
      continue
    }
    out.push(p)
  }
  return out
}

// -------------------------------------------------------------- the marker

/**
 * Everything a reader reads off one point: the impedance, the normalised
 * impedance, the admittance, the reflection coefficient and its three
 * costumes. An open circuit is `Infinity`, and it lands at Gamma = 1.
 */
export function markerAt(Z, z0 = 50, { label = null } = {}) {
  require_(z0 > 0, `The reference impedance must be a positive resistance, not ${z0}.`, { field: 'z0' })
  const z = normalise(Z, z0)
  const gamma = zToGamma(z)
  const m = mismatch(gamma)
  const y = z === Infinity ? C(0) : cdiv(C(1), z)
  return {
    label,
    z0,
    Z: Z === Infinity ? Infinity : toC(Z),
    z: z === Infinity ? Infinity : z,
    y,
    gammaY: gammaOfY(gamma),
    q: qOf(gamma),
    ...m,
  }
}

/** The impedance a point on the chart stands for, at a reference impedance. */
export function impedanceAt(gamma, z0 = 50) {
  const z = gammaToZ(toC(gamma))
  return z === Infinity ? Infinity : cscale(z, z0)
}

/**
 * The path a length of line traces on the chart.
 *
 * Moving away from the load towards the generator turns Gamma clockwise by
 * 2 beta d and shrinks it by exp(-2 alpha d). On a lossless line that is a
 * circle of constant magnitude, and half a wavelength is one whole turn. On a
 * lossy line it is a spiral inward.
 */
export function pathTowardsGenerator(gammaL, { beta, length, alpha = 0, points = 181 }) {
  require_(beta > 0, `The phase constant must be positive, not ${beta}.`, { field: 'beta' })
  require_(length >= 0, `A length of line is not negative, and this one is ${length} m.`, { field: 'length' })
  require_(points >= 2, `A path needs at least two points, not ${points}.`, { field: 'points' })
  const out = []
  for (let i = 0; i < points; i++) {
    const d = (length * i) / (points - 1)
    out.push(towardsGenerator(toC(gammaL), beta * d, alpha * d))
  }
  return out
}

/** How far a length of line turns the point, in degrees: 2 beta d, clockwise. */
export const turnDegrees = (beta, length) => (2 * beta * length * 180) / Math.PI

/** How many wavelengths a length is, which is the chart's own scale. */
export const inWavelengths = (beta, length) => (beta * length) / (2 * Math.PI)

export { mismatch, standingWaveRatio }
