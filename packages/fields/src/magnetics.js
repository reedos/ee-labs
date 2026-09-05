// Magnetostatics: Biot-Savart on a wire path, Ampere's law as a check on it,
// and the magnetic circuit the Power Lab's transformer group assumes.
//
// Biot-Savart is an integral, and a straight segment's integral has a closed
// form. `segmentField` is that closed form, derived in the comment beside it,
// and `biotSavart` sums it over a polyline. Nothing here is a special case for
// a loop or a solenoid: the loop is a polyline with many sides. A polygon of s
// sides differs from the circle it approximates by a term of order 1/s squared,
// and magnetics.test.js measures that agreement against the loop's axial closed
// form at three side counts. That is the whole argument for trusting the shapes
// the app draws.
//
// The magnetic circuit is the one approximation in this file, and it carries
// its guard. Reluctances in series assume the flux stays inside the core and
// crosses the gap without spreading. Both fail as the gap grows, so
// `magneticCircuit` reports the gap-to-core ratio against a threshold and says
// what the fringing correction would do.

import { MU0, nonNegative, positive, require_ } from './const.js'

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const norm = (a) => Math.hypot(a[0], a[1], a[2])

/**
 * The field at `p` of a straight segment from `a` to `b` carrying current `I`,
 * in teslas. Every vector is [x, y, z] in metres.
 *
 * Parameterise the wire as X(s) = a + s lhat. The vector from the wire to the
 * field point is (pa - s lhat) with pa = p - a, so
 *
 *   dB = (mu0 I / 4 pi) (lhat x pa) ds / |pa - s lhat|^3
 *
 * The cross product does not depend on s, and the remaining integral is
 * elementary. Writing pb = p - b, d for the perpendicular distance and chat for
 * the unit vector along lhat x pa,
 *
 *   B = (mu0 I / 4 pi d) chat (lhat . pahat - lhat . pbhat)
 *
 * which is the "sine of the two end angles" form the books write, with the
 * angles replaced by the dot products that produce them.
 *
 * On the segment's own line the field is not defined, and the function returns
 * zero there rather than an infinity, because a polyline's own corner is on the
 * line of both its segments and the two contributions are genuinely zero.
 */
export function segmentField(a, b, I, p, mu = MU0) {
  const l = sub(b, a)
  const L = norm(l)
  if (L === 0) return [0, 0, 0]
  const lhat = scale(l, 1 / L)
  const pa = sub(p, a)
  const pb = sub(p, b)
  const c = cross(lhat, pa)
  const d = norm(c)
  if (d < 1e-15 * Math.max(L, norm(pa))) return [0, 0, 0]
  const na = norm(pa)
  const nb = norm(pb)
  if (na === 0 || nb === 0) return [0, 0, 0]
  const k = ((mu * I) / (4 * Math.PI * d)) * (dot(lhat, pa) / na - dot(lhat, pb) / nb)
  return scale(scale(c, 1 / d), k)
}

/**
 * The field at `p` of a current `I` along the polyline `path`, in teslas.
 * `path` is an array of [x, y, z] points. A closed path repeats its first
 * point, and `closePath` does that for a caller.
 */
export function biotSavart(path, I, p, mu = MU0) {
  require_(Array.isArray(path) && path.length >= 2, 'A current path needs at least two points.', { field: 'path' })
  let B = [0, 0, 0]
  for (let k = 0; k + 1 < path.length; k++) B = add(B, segmentField(path[k], path[k + 1], I, p, mu))
  return B
}

/** The same path with its first point repeated at the end, so the current has somewhere to go. */
export const closePath = (path) => (path.length && path[0].every((v, i) => v === path[path.length - 1][i]) ? path : [...path, path[0]])

/** A circle of radius `a` in the z = z0 plane, as a polyline of `sides` sides. */
export function circlePath(a, { sides = 720, z = 0, centre = [0, 0] } = {}) {
  positive(a, 'a')
  const pts = []
  for (let k = 0; k <= sides; k++) {
    const t = (2 * Math.PI * k) / sides
    pts.push([centre[0] + a * Math.cos(t), centre[1] + a * Math.sin(t), z])
  }
  return pts
}

/** A solenoid of `turns` turns, radius `a`, length `len`, as one helical polyline. */
export function solenoidPath(a, len, turns, { perTurn = 48 } = {}) {
  positive(a, 'a')
  positive(len, 'len')
  const pts = []
  const steps = Math.round(turns * perTurn)
  for (let k = 0; k <= steps; k++) {
    const t = (2 * Math.PI * turns * k) / steps
    pts.push([a * Math.cos(t), a * Math.sin(t), -len / 2 + (len * k) / steps])
  }
  return pts
}

/**
 * The field on the axis of a circular loop, teslas.
 *
 *   B_z = mu I a^2 / (2 (a^2 + z^2)^{3/2})
 *
 * At the centre this is mu I / 2a. It is the closed form biotSavart is checked
 * against, and the check is the reason either is trusted.
 */
export function loopOnAxis(a, I, z, mu = MU0) {
  positive(a, 'a')
  return (mu * I * a * a) / (2 * Math.pow(a * a + z * z, 1.5))
}

/** The field a distance r from a long straight wire, teslas: B = mu I / 2 pi r. */
export function wireField(I, r, mu = MU0) {
  return (mu * I) / (2 * Math.PI * positive(r, 'r'))
}

/**
 * The field on the axis of a finite solenoid of `turns` turns over `len`,
 * radius `a`, at axial position z measured from the centre, teslas.
 *
 *   B_z = (mu n I / 2) (cos theta1 - cos theta2)
 *
 * with n = turns / len. As len grows against a this becomes mu n I, the long
 * solenoid, and the function reports how far from that limit it is.
 */
export function solenoidOnAxis(a, len, turns, I, z = 0, mu = MU0) {
  positive(a, 'a')
  positive(len, 'len')
  const n = turns / len
  const z1 = z + len / 2
  const z2 = z - len / 2
  const c1 = z1 / Math.hypot(z1, a)
  const c2 = z2 / Math.hypot(z2, a)
  const B = ((mu * n * I) / 2) * (c1 - c2)
  const infinite = mu * n * I
  return { B, infinite, fraction: infinite === 0 ? 1 : B / infinite, n }
}

/** The field inside a toroid at radius r, teslas: B = mu N I / 2 pi r. */
export function toroidField(turns, I, r, mu = MU0) {
  return (mu * turns * I) / (2 * Math.PI * positive(r, 'r'))
}

/**
 * Ampere's law around a circular contour, as a check on a computed field.
 *
 * Integrates B . dl around a circle of radius `r` in the plane whose normal is
 * `axis`, centred at `centre`, using `points` equally spaced samples. The
 * result should be mu0 times the current the contour encloses, and
 * magnetics.test.js checks exactly that against biotSavart for paths whose
 * enclosed current is known by inspection.
 *
 * The trapezoid rule on a periodic integrand converges faster than any power of
 * the step, so 256 points gives twelve figures on a smooth field.
 */
export function ampereLoop(field, { centre = [0, 0, 0], r, axis = [0, 0, 1], points = 256 }) {
  positive(r, 'r')
  const n = scale(axis, 1 / norm(axis))
  // Two unit vectors spanning the plane the contour lies in.
  const seed = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  const u = cross(n, seed)
  const uh = scale(u, 1 / norm(u))
  const vh = cross(n, uh)
  let sum = 0
  for (let k = 0; k < points; k++) {
    const t = (2 * Math.PI * k) / points
    const pos = add(centre, add(scale(uh, r * Math.cos(t)), scale(vh, r * Math.sin(t))))
    const tangent = add(scale(uh, -Math.sin(t)), scale(vh, Math.cos(t)))
    sum += dot(field(pos), tangent) * r * ((2 * Math.PI) / points)
  }
  return sum
}

/** The current Ampere's law says a contour encloses, given the line integral it measured. */
export const enclosedCurrent = (lineIntegral, mu = MU0) => lineIntegral / mu

/**
 * A magnetic circuit: a core of relative permeability mu_r with an air gap,
 * wound with N turns.
 *
 * ```js
 * magneticCircuit({ meanLength, area, mur, gap, gapArea, turns, current })
 * ```
 *
 * Reluctance is length / (mu area), it adds in series exactly as resistance
 * does, and the flux is the magnetomotive force N I divided by the total.
 * Returns the two reluctances, the flux, the flux density in the core and in
 * the gap, the inductance N^2 / R, and the fraction of the magnetomotive force
 * the gap takes.
 *
 * The guard, under CORE_SCOPE Rule 3. Series reluctance assumes the flux stays
 * in the core and crosses the gap without spreading. The spreading is real, and
 * the standard correction adds the gap length to each cross-sectional dimension
 * of the gap, which lowers the gap's reluctance. `guard` reports the gap length
 * against the square root of the core area, with a threshold of 0.1, and
 * `fringed` gives the corrected inductance so the app can show both.
 */
export function magneticCircuit(spec) {
  const meanLength = positive(spec.meanLength, 'meanLength')
  const area = positive(spec.area, 'area')
  const mur = positive(spec.mur ?? 1, 'mur')
  const gap = nonNegative(spec.gap ?? 0, 'gap')
  const gapArea = positive(spec.gapArea ?? area, 'gapArea')
  const turns = positive(spec.turns, 'turns')
  const current = spec.current ?? 0
  require_(Number.isFinite(current), `current must be a finite number, and it is ${current}.`, { field: 'current' })
  require_(
    gap < meanLength,
    `The gap is ${gap} m and the mean path is ${meanLength} m. A gap cannot be longer than the path it sits in.`,
    { field: 'gap' },
  )
  const core = (meanLength - gap) / (MU0 * mur * area)
  const gapR = gap > 0 ? gap / (MU0 * gapArea) : 0
  const total = core + gapR
  const mmf = turns * current
  const flux = mmf / total
  const side = Math.sqrt(area)
  const ratio = gap / side
  // The fringing correction: the gap's effective cross-section grows by the gap
  // length in each transverse dimension.
  const fringedArea = (side + gap) * (side + gap)
  const fringedGapR = gap > 0 ? gap / (MU0 * fringedArea) : 0
  const fringedL = (turns * turns) / (core + fringedGapR)
  return {
    reluctance: { core, gap: gapR, total },
    mmf,
    flux,
    Bcore: flux / area,
    Bgap: flux / gapArea,
    Hcore: flux / (MU0 * mur * area),
    Hgap: flux / (MU0 * gapArea),
    inductance: (turns * turns) / total,
    gapShare: total === 0 ? 0 : gapR / total,
    fringed: { area: fringedArea, reluctance: fringedGapR, inductance: fringedL },
    guard: {
      quantity: 'gap length over the square root of the core area',
      value: ratio,
      threshold: 0.1,
      ok: gap === 0 || ratio <= 0.1,
      says:
        gap === 0
          ? 'There is no gap, so nothing fringes and the series reluctance is exact for a core of uniform permeability.'
          : ratio <= 0.1
            ? `The gap is ${(100 * ratio).toPrecision(3)} per cent of the core's width, inside the 10 per cent threshold, so the flux crosses it without spreading much.`
            : `The gap is ${(100 * ratio).toPrecision(3)} per cent of the core's width, past the 10 per cent threshold. The flux spreads into the air beside the gap, and the fringing correction raises the inductance by ${(100 * (fringedL / ((turns * turns) / total) - 1)).toPrecision(3)} per cent.`,
    },
  }
}

/**
 * A transformer built from the magnetic circuit rather than assumed.
 *
 * Two windings on one core. Each winding's self-inductance is its turns squared
 * over the reluctance it sees, and the mutual inductance is the product of the
 * turns over the reluctance they share. With no leakage every path is shared,
 * so k = 1 exactly and L1 L2 = M^2. `leakage` splits a fraction of each
 * winding's flux onto a path the other does not link, which is what makes k
 * less than one and what a real transformer's short-circuit test measures.
 *
 * Returns the inductances, the coupling coefficient, the turns ratio, and the
 * voltage and current ratios an ideal transformer would give, so a lesson can
 * show how far the real one is from it.
 */
export function transformer(spec) {
  const n1 = positive(spec.n1, 'n1')
  const n2 = positive(spec.n2, 'n2')
  const leakage = nonNegative(spec.leakage ?? 0, 'leakage')
  require_(leakage < 1, `leakage is the fraction of flux that does not link the other winding, so it must be below 1. It is ${leakage}.`, { field: 'leakage' })
  const circuit = magneticCircuit({ ...spec, turns: n1 })
  const R = circuit.reluctance.total
  const Lm1 = (n1 * n1) / R
  const Lm2 = (n2 * n2) / R
  const l1 = (leakage / (1 - leakage)) * Lm1
  const l2 = (leakage / (1 - leakage)) * Lm2
  const L1 = Lm1 + l1
  const L2 = Lm2 + l2
  const M = (n1 * n2) / R
  const k = M / Math.sqrt(L1 * L2)
  return {
    circuit,
    L1,
    L2,
    M,
    k,
    leakageInductance: { primary: l1, secondary: l2 },
    magnetising: { primary: Lm1, secondary: Lm2 },
    turnsRatio: n1 / n2,
    voltageRatio: n1 / n2,
    currentRatio: n2 / n1,
    reluctance: R,
  }
}
