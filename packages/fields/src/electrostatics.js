// Coulomb, Gauss, and the potential: the first three lessons' arithmetic.
//
// A charge distribution here is a list of point charges, or a line or a sheet
// with its own closed form. Everything is superposition, which is the whole
// content of the group: the field of many charges is the sum of the fields of
// each, and no other rule is needed until a conductor appears.
//
// Gauss's law is not a second way to compute the same field. It is a CHECK on
// one, and `gaussFlux` integrates a computed field over a closed surface so
// that a lesson can compare the answer with the enclosed charge over eps0. The
// integral is done by quadrature on a sphere, which converges fast because the
// integrand is smooth wherever no charge sits on the surface.

import { EPS0, positive, require_ } from './const.js'
import { quad } from './integrate.js'

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norm = (a) => Math.hypot(a[0], a[1], a[2])

/** Coulomb's constant, 1 / (4 pi eps0), newton metres squared per coulomb squared. */
export const K_E = 1 / (4 * Math.PI * EPS0)

/**
 * The force between two point charges, newtons, along the line joining them.
 * Positive is repulsion. F = q1 q2 / (4 pi eps0 r^2).
 */
export function coulombForce(q1, q2, r, { epsr = 1 } = {}) {
  positive(r, 'r')
  return (q1 * q2) / (4 * Math.PI * EPS0 * positive(epsr, 'epsr') * r * r)
}

/**
 * The field at `p` of a list of point charges `[{ q, at: [x, y, z] }]`, volts
 * per metre, by superposition. A field point sitting exactly on a charge has no
 * defined field, and the function says so rather than returning an infinity
 * that would propagate into a plot.
 */
export function pointChargeField(charges, p, { epsr = 1 } = {}) {
  const k = 1 / (4 * Math.PI * EPS0 * positive(epsr, 'epsr'))
  let E = [0, 0, 0]
  for (const c of charges) {
    const d = sub(p, c.at)
    const r = norm(d)
    require_(r > 0, `The field is not defined at a point charge's own position, and the field point sits on the charge at ${c.at.join(', ')}.`, { field: 'at' })
    const s = (k * c.q) / (r * r * r)
    E = [E[0] + s * d[0], E[1] + s * d[1], E[2] + s * d[2]]
  }
  return E
}

/**
 * The potential at `p` of the same list, volts, taking infinity as the zero.
 * V = sum of q / (4 pi eps0 r). The potential is a scalar, so the sum needs no
 * geometry, which is the reason it is the easier of the two to compute and the
 * reason every solver in this package solves for it.
 */
export function pointChargePotential(charges, p, { epsr = 1 } = {}) {
  const k = 1 / (4 * Math.PI * EPS0 * positive(epsr, 'epsr'))
  let V = 0
  for (const c of charges) {
    const r = norm(sub(p, c.at))
    require_(r > 0, `The potential is not defined at a point charge's own position, and the field point sits on the charge at ${c.at.join(', ')}.`, { field: 'at' })
    V += (k * c.q) / r
  }
  return V
}

/** The field a distance r from an infinite line of charge density lambda: E = lambda / (2 pi eps0 r). */
export const lineChargeField = (lambda, r, { epsr = 1 } = {}) => lambda / (2 * Math.PI * EPS0 * epsr * positive(r, 'r'))

/** The field of an infinite sheet of charge density sigma: E = sigma / (2 eps0), the same at every distance. */
export const sheetChargeField = (sigma, { epsr = 1 } = {}) => sigma / (2 * EPS0 * epsr)

/**
 * The field on the axis of a uniformly charged ring of radius a and total
 * charge Q, a distance z from its plane:
 *
 *   E_z = Q z / (4 pi eps0 (a^2 + z^2)^{3/2})
 *
 * This is the closed form electrostatics.test.js checks the point-charge
 * superposition against, by cutting the ring into many charges and summing.
 * That check is what says the superposition code is right, and it is the
 * electric mirror of the Biot-Savart check in magnetics.
 */
export function ringOnAxis(a, Q, z, { epsr = 1 } = {}) {
  positive(a, 'a')
  return (Q * z) / (4 * Math.PI * EPS0 * epsr * Math.pow(a * a + z * z, 1.5))
}

/** A ring of radius a and total charge Q, cut into `n` equal point charges. */
export function ringCharges(a, Q, n = 720, { z = 0 } = {}) {
  const out = []
  for (let k = 0; k < n; k++) {
    const t = (2 * Math.PI * k) / n
    out.push({ q: Q / n, at: [a * Math.cos(t), a * Math.sin(t), z] })
  }
  return out
}

/**
 * Gauss's law as a check: the flux of a field out of a sphere of radius `r`
 * centred on `centre`, in volt-metres.
 *
 *   flux = integral of E . n dA over the closed surface
 *
 * Gauss's law says this equals the enclosed charge over eps0, whatever the
 * shape of the surface and wherever the charges sit inside it. The quadrature
 * is a product rule in the two spherical angles, and the integrand is smooth as
 * long as no charge sits ON the sphere, which the caller must arrange.
 *
 * Returns the flux, the charge it implies, and the charge actually enclosed
 * when the caller passes the charge list, so a lesson can put the two side by
 * side.
 */
export function gaussFlux(field, { centre = [0, 0, 0], r, n = 40, charges } = {}) {
  positive(r, 'r')
  const integrand = (theta, phi) => {
    const st = Math.sin(theta)
    const nx = st * Math.cos(phi)
    const ny = st * Math.sin(phi)
    const nz = Math.cos(theta)
    const p = [centre[0] + r * nx, centre[1] + r * ny, centre[2] + r * nz]
    const E = field(p)
    return (E[0] * nx + E[1] * ny + E[2] * nz) * r * r * st
  }
  const flux = quad((theta) => quad((phi) => integrand(theta, phi), 0, 2 * Math.PI, { n: 24, panels: n }), 0, Math.PI, { n: 24, panels: n })
  const out = { flux, impliedCharge: flux * EPS0 }
  if (charges) {
    let q = 0
    for (const c of charges) if (norm(sub(c.at, centre)) < r) q += c.q
    out.enclosed = q
    out.error = q === 0 ? Math.abs(out.impliedCharge) : Math.abs(out.impliedCharge - q) / Math.abs(q)
  }
  return out
}

/**
 * The equipotential through a point, as a polyline, traced by walking
 * perpendicular to the field.
 *
 * The step is a fixed arc length, and each step moves at right angles to the
 * local field, so the potential does not change along the walk. Every few steps
 * the walk is corrected back onto the level set by a Newton step along the
 * field, which stops the accumulated error from drifting the curve onto a
 * neighbouring level. Returns the points and the largest potential deviation
 * along the way, so the app can say how well the curve holds its value.
 */
export function traceEquipotential(potential, field, start, { step, maxSteps = 4000, close = true } = {}) {
  const V0 = potential(start)
  const pts = [start.slice()]
  let p = start.slice()
  let worst = 0
  for (let k = 0; k < maxSteps; k++) {
    const E = field(p)
    const m = Math.hypot(E[0], E[1])
    if (!Number.isFinite(m) || m === 0) break
    // Perpendicular to the field, in the plane, so the potential is unchanged.
    const tx = -E[1] / m
    const ty = E[0] / m
    p = [p[0] + step * tx, p[1] + step * ty, p[2]]
    // One Newton correction along the field, back onto the level set.
    const Ec = field(p)
    const mc = Math.hypot(Ec[0], Ec[1])
    if (mc > 0) {
      const dV = potential(p) - V0
      p = [p[0] + (dV / mc) * (Ec[0] / mc), p[1] + (dV / mc) * (Ec[1] / mc), p[2]]
    }
    worst = Math.max(worst, Math.abs(potential(p) - V0))
    pts.push(p.slice())
    if (close && k > 8 && Math.hypot(p[0] - start[0], p[1] - start[1]) < step) break
  }
  return {
    points: pts,
    level: V0,
    worstDeviation: worst,
    // The deviation relative to the level, which is the figure a caption
    // quotes. It falls as the fourth power of the step, because the walk is a
    // second-order step followed by a Newton correction.
    worstRelative: worst / Math.max(1e-300, Math.abs(V0)),
    step,
  }
}

export { EPS0 }
