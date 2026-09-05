// The closed forms: capacitance, resistance and inductance of the geometries
// an electromagnetics course solves with a pencil.
//
// CORE_SCOPE Rule 1, in this package's terms. Each function below is exact for
// the idealisation named in its comment, and it is presented without a hedge,
// because the counter-rule says an exact mapping is never hedged. What each
// idealisation neglects is stated once, in the comment and in the returned
// `neglects` field, so the app can put it on screen instead of burying it.
//
// The proof that these are right is not that the formula matches a textbook.
// It is closed.test.js, which integrates the field law itself over the same
// geometry and gets the same number. Coulomb's law summed over a charged ring
// does not know what a ring's closed form says.

import { EPS0, MU0, positive, require_ } from './const.js'
import { describeGeometry, epsOf, hasClosedForm, KINDS, muOf } from './geometry.js'

/** arccosh, which JavaScript spells Math.acosh. Named here so the formulas read as the books write them. */
const acosh = Math.acosh

/**
 * Capacitance of a geometry, in farads.
 *
 * Returns `{ C, perMetre, formula, neglects }`. `C` is the whole object's
 * capacitance including its `length`. `perMetre` is the per-unit-length value
 * for a geometry that has one, and null for one that does not, because a
 * sphere has no per-metre capacitance.
 *
 * The four forms:
 *
 *   parallel plate   C = eps A / d          fringing neglected
 *   coaxial          C' = 2 pi eps / ln(b/a)
 *   spherical        C = 4 pi eps a b / (b - a)
 *   two-wire         C' = pi eps / acosh(d / 2a)
 *   wire over ground C' = 2 pi eps / acosh(h / a)
 *
 * The two-wire form is exact for round conductors at any spacing, not only for
 * d much larger than a. The image charges that produce it sit inside each wire
 * at an offset, and acosh carries that exactly. The ln(d/a) form found in older
 * books is the wide-spacing limit of this one.
 */
export function capacitance(geometry) {
  const g = describeGeometry(geometry)
  require_(
    hasClosedForm(g.kind, 'capacitance'),
    `A ${KINDS[g.kind].name.toLowerCase()} geometry has no closed-form capacitance in this package. Solve it on a grid.`,
    { field: 'kind' },
  )
  const eps = epsOf(g)
  switch (g.kind) {
    case 'parallelPlate': {
      const C = (eps * g.area) / g.gap
      return out(C, null, 'C = eps A / d', 'the fringing field beyond the plate edges', 'C')
    }
    case 'coax': {
      const perMetre = (2 * Math.PI * eps) / Math.log(g.b / g.a)
      return out(perMetre * g.length, perMetre, "C' = 2 pi eps / ln(b/a)", 'the field beyond the two ends', 'C')
    }
    case 'spherical': {
      const C = (4 * Math.PI * eps * g.a * g.b) / (g.b - g.a)
      return out(C, null, 'C = 4 pi eps a b / (b - a)', 'nothing: a closed shell has no fringing field', 'C')
    }
    case 'twoWire': {
      const perMetre = (Math.PI * eps) / acosh(g.d / (2 * g.a))
      return out(perMetre * g.length, perMetre, "C' = pi eps / acosh(d / 2a)", 'the field beyond the two ends', 'C')
    }
    case 'wireOverGround': {
      const perMetre = (2 * Math.PI * eps) / acosh(g.h / g.a)
      return out(perMetre * g.length, perMetre, "C' = 2 pi eps / acosh(h / a)", 'the field beyond the two ends, and a ground plane of finite width', 'C')
    }
    default:
      return unreachable(g.kind)
  }
}

/**
 * Resistance of a geometry, in ohms, for a conductivity `sigma` in siemens per
 * metre. Two quite different questions share this function, and the geometry
 * says which one is asked.
 *
 *   bar             R = l / (sigma A)         current along the bar
 *   parallel plate  R = d / (sigma A)         leakage straight across the gap
 *   coaxial         R' = ln(b/a) / (2 pi sigma)   leakage radially outward, per metre
 *   spherical       R = (1/a - 1/b) / (4 pi sigma)
 *
 * The coaxial and spherical forms are the capacitance forms with eps replaced
 * by sigma and the result inverted. That is not a coincidence and it is not a
 * mnemonic. Laplace's equation governs both potentials, the boundary conditions
 * are the same, so the fields are the same and R C = eps / sigma for any
 * two-conductor geometry. `rcProduct` below returns that, and the fuzz test
 * checks it against every geometry that has both forms.
 */
export function resistance(geometry, sigma) {
  const g = describeGeometry(geometry)
  const s = positive(sigma ?? g.sigma, 'sigma')
  require_(
    hasClosedForm(g.kind, 'resistance'),
    `A ${KINDS[g.kind].name.toLowerCase()} geometry has no closed-form resistance in this package. Solve it on a grid.`,
    { field: 'kind' },
  )
  switch (g.kind) {
    case 'bar': {
      const R = g.len / (s * g.area)
      return out(R, null, 'R = l / (sigma A)', 'a current spread evenly over the cross-section', 'R')
    }
    case 'parallelPlate': {
      const R = g.gap / (s * g.area)
      return out(R, null, 'R = d / (sigma A)', 'the leakage path beyond the plate edges', 'R')
    }
    case 'coax': {
      const perMetre = Math.log(g.b / g.a) / (2 * Math.PI * s)
      return out(perMetre / g.length, perMetre, "R' = ln(b/a) / (2 pi sigma)", 'the leakage path beyond the two ends', 'R')
    }
    case 'spherical': {
      const R = (1 / g.a - 1 / g.b) / (4 * Math.PI * s)
      return out(R, null, 'R = (1/a - 1/b) / (4 pi sigma)', 'nothing: a closed shell has no leakage path around it', 'R')
    }
    default:
      return unreachable(g.kind)
  }
}

/**
 * Inductance of a geometry, in henries.
 *
 *   coaxial          L' = (mu / 2 pi) ln(b/a)          external field only
 *   two-wire         L' = (mu / pi) acosh(d / 2a)      external field only
 *   wire over ground L' = (mu / 2 pi) acosh(h / a)
 *   solenoid         L = mu N^2 A / l                  end effects neglected
 *   toroid           L = mu N^2 h ln(b/a) / (2 pi)     exact for a filled ring
 *   loop             L = mu a (ln(8a/r) - 2)           thin-wire, r much less than a
 *
 * `opts.internal` adds the field inside a solid round inner conductor, which
 * contributes mu / (8 pi) per metre whatever the radius. It is off by default,
 * because at any frequency where the current has crowded to the surface it has
 * gone, and the transmission-line group works at those frequencies.
 *
 * The loop form is the one approximation in this function, and it carries its
 * guard. The neglected terms are of order (r/a)^2, so `guard` reports the ratio
 * and whether it is inside the threshold.
 */
export function inductance(geometry, opts = {}) {
  const g = describeGeometry(geometry)
  require_(
    hasClosedForm(g.kind, 'inductance'),
    `A ${KINDS[g.kind].name.toLowerCase()} geometry has no closed-form inductance in this package. Solve it on a grid.`,
    { field: 'kind' },
  )
  const mu = muOf(g)
  const internal = opts.internal ? MU0 / (8 * Math.PI) : 0
  switch (g.kind) {
    case 'coax': {
      const perMetre = (mu / (2 * Math.PI)) * Math.log(g.b / g.a) + internal
      return out(perMetre * g.length, perMetre, "L' = (mu / 2 pi) ln(b/a)", 'the field inside the conductors, unless internal is set', 'L')
    }
    case 'twoWire': {
      const perMetre = (mu / Math.PI) * acosh(g.d / (2 * g.a)) + 2 * internal
      return out(perMetre * g.length, perMetre, "L' = (mu / pi) acosh(d / 2a)", 'the field inside the conductors, unless internal is set', 'L')
    }
    case 'wireOverGround': {
      const perMetre = (mu / (2 * Math.PI)) * acosh(g.h / g.a) + internal
      return out(perMetre * g.length, perMetre, "L' = (mu / 2 pi) acosh(h / a)", 'the field inside the conductor, unless internal is set', 'L')
    }
    case 'solenoid': {
      const L = (mu * g.turns * g.turns * g.area) / g.len
      return out(L, null, 'L = mu N^2 A / l', 'the field that leaks out of the two ends', 'L')
    }
    case 'toroid': {
      const L = (mu * g.turns * g.turns * g.height * Math.log(g.b / g.a)) / (2 * Math.PI)
      return out(L, null, 'L = mu N^2 h ln(b/a) / (2 pi)', 'nothing: the field of a closely wound toroid is inside it', 'L')
    }
    case 'loop': {
      const L = mu * g.a * (Math.log((8 * g.a) / g.wire) - 2)
      const ratio = g.wire / g.a
      const res = out(L, null, 'L = mu a (ln(8a/r) - 2)', 'terms of order (r/a) squared', 'L')
      res.guard = {
        quantity: 'wire radius over loop radius',
        value: ratio,
        threshold: 0.1,
        ok: ratio <= 0.1,
        says:
          ratio <= 0.1
            ? `r/a is ${ratio.toPrecision(3)}, inside the thin-wire threshold of 0.1.`
            : `r/a is ${ratio.toPrecision(3)}, past the thin-wire threshold of 0.1. The neglected terms are of order (r/a) squared, so this value is high by roughly ${(100 * ratio * ratio).toPrecision(2)} per cent.`,
      }
      return res
    }
    default:
      return unreachable(g.kind)
  }
}

/**
 * The R C product of a two-conductor geometry, eps / sigma, in seconds.
 *
 * The same Laplace solution serves both, so the product depends on the
 * material and not on the shape at all. It is the relaxation time of the
 * medium. This is the identity closed.test.js uses to check the resistance
 * forms against the capacitance forms without integrating either again.
 */
export function rcProduct(geometry, sigma) {
  const g = describeGeometry(geometry)
  const s = positive(sigma ?? g.sigma, 'sigma')
  return epsOf(g) / s
}

/**
 * The energy stored in a capacitor's field at voltage V, in joules, and the
 * energy density at a named place in the geometry.
 *
 * W = C V^2 / 2 is the whole-object figure. `density` is eps E^2 / 2 at the
 * inner conductor's surface, which is where a coaxial or spherical geometry has
 * its largest field and where a real cable breaks down.
 */
export function fieldEnergy(geometry, voltage) {
  const g = describeGeometry(geometry)
  const V = positive(Math.abs(voltage), 'voltage')
  const C = capacitance(g).value
  const W = 0.5 * C * V * V
  const eps = epsOf(g)
  const Emax = peakField(g, V)
  return { W, Emax, density: 0.5 * eps * Emax * Emax, at: peakFieldAt(g) }
}

/**
 * The largest field magnitude in the geometry at voltage V, volts per metre.
 *
 * A parallel plate is uniform, so its peak is V/d everywhere. A coaxial or
 * spherical geometry peaks at the inner conductor. The two-wire and
 * wire-over-ground cases need the image construction: the field of two round
 * charged wires is the field of two line charges placed not at the wire centres
 * but at +/- s from the midpoint, where s^2 = (d/2)^2 - a^2. The surface field
 * is largest at the point of each wire facing the other, where the two line
 * charges' contributions add:
 *
 *   E = (rho / 2 pi eps) (1/(s - u) + 1/(s + u)) = (rho / pi eps) s / (s^2 - u^2)
 *
 * with u the distance from the midpoint to that surface point. For the two-wire
 * line u = d/2 - a and s^2 - u^2 = a (d - 2a). For the wire over a plane
 * u = h - a and s^2 - u^2 = 2 a (h - a). Both reduce to rho / (2 pi eps a), the
 * isolated wire, as the spacing grows.
 */
export function peakField(geometry, voltage) {
  const g = describeGeometry(geometry)
  const V = Math.abs(voltage)
  const eps = epsOf(g)
  switch (g.kind) {
    case 'parallelPlate':
      return V / g.gap
    case 'coax':
      return V / (g.a * Math.log(g.b / g.a))
    case 'spherical':
      return (V * g.b) / (g.a * (g.b - g.a))
    case 'twoWire': {
      const rho = capacitance(g).perMetre * V
      const s = Math.sqrt((g.d / 2) ** 2 - g.a * g.a)
      return (rho * s) / (Math.PI * eps * g.a * (g.d - 2 * g.a))
    }
    case 'wireOverGround': {
      const rho = capacitance(g).perMetre * V
      const s = Math.sqrt(g.h * g.h - g.a * g.a)
      return (rho * s) / (2 * Math.PI * eps * g.a * (g.h - g.a))
    }
    default:
      return V / characteristicLength(g)
  }
}

/** Where the peak field sits, as words a caption can use. */
function peakFieldAt(g) {
  switch (g.kind) {
    case 'parallelPlate':
      return 'everywhere between the plates, since the field is uniform'
    case 'coax':
      return 'at the inner conductor, r = a'
    case 'spherical':
      return 'at the inner sphere, r = a'
    case 'twoWire':
      return 'on each wire, at the point facing the other wire'
    case 'wireOverGround':
      return 'on the wire, at the point facing the plane'
    default:
      return 'at the inner conductor'
  }
}

/** A length that stands for the geometry's scale, for a fallback field estimate. */
function characteristicLength(g) {
  if ('gap' in g) return g.gap
  if ('a' in g && 'b' in g) return g.b - g.a
  if ('a' in g && 'd' in g) return g.d
  return 1
}

/**
 * The shape every closed form returns. `value` is the whole object's figure and
 * `perMetre` the per-unit-length one where the geometry has it. `symbol` names
 * the quantity, so a caption can read "C = 101 pF/m" without being told which
 * letter it is holding.
 */
function out(value, perMetre, formula, neglects, symbol) {
  return { value, perMetre, formula, neglects, symbol }
}

function unreachable(kind) {
  require_(false, `${kind} reached a branch that should not exist.`, { field: 'kind' })
}

/** EPS0 re-exported so a caller building a geometry does not import two modules. */
export { EPS0, MU0 }
