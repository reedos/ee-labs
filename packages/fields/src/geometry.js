// The geometry description: one object shape for every canonical geometry, so
// that a closed form, a grid solve and a lesson all name the same thing.
//
// A geometry is a plain object with a `kind`, the dimensions that kind needs in
// metres, and the material it sits in. Nothing else. The app's knobs write into
// this object, closed.js reads it, and relax.js builds a mesh from it, so a
// dimension has one name across the lab.
//
//   { kind: 'coax', a: 1e-3, b: 3.5e-3, epsr: 2.1, mur: 1, sigma: 0, length: 1 }
//
// `length` is the axial length of a two-dimensional geometry, in metres. The
// closed forms return whole-object values, and each also reports its
// per-metre value where the geometry has one, because a coaxial cable is
// quoted at 101 pF/m and not at the capacitance of the piece on the bench.
//
// Every kind below is one an undergraduate electromagnetics course solves in
// closed form. A geometry that is not on this list has no closed form here,
// and is solved on a grid by relax.js with the convergence guard that goes
// with it. That split is the lab's whole structure.

import { EPS0, FieldsError, MU0, nonNegative, positive, require_ } from './const.js'

/**
 * The kinds, their dimensions, and which quantities each has a closed form for.
 *
 * `dims` is in the order a lesson names them. `has` lists the closed forms
 * closed.js provides. `planar` marks a geometry whose fields do not vary along
 * one axis, which is the class relax.js can mesh in two dimensions.
 */
export const KINDS = {
  parallelPlate: {
    name: 'Parallel plate',
    dims: ['area', 'gap'],
    has: ['capacitance', 'resistance'],
    planar: false,
    note: 'Two conducting plates of area A a distance d apart, fringing neglected.',
  },
  coax: {
    name: 'Coaxial',
    dims: ['a', 'b'],
    has: ['capacitance', 'inductance', 'resistance'],
    planar: true,
    note: 'An inner conductor of radius a inside a shield of inner radius b.',
  },
  spherical: {
    name: 'Spherical shell',
    dims: ['a', 'b'],
    has: ['capacitance', 'resistance'],
    planar: false,
    note: 'A sphere of radius a inside a shell of inner radius b.',
  },
  twoWire: {
    name: 'Two-wire line',
    dims: ['a', 'd'],
    has: ['capacitance', 'inductance'],
    planar: true,
    note: 'Two parallel wires of radius a with their centres a distance d apart.',
  },
  wireOverGround: {
    name: 'Wire over ground',
    dims: ['a', 'h'],
    has: ['capacitance', 'inductance'],
    planar: true,
    note: 'One wire of radius a at height h above a conducting plane, solved by images.',
  },
  bar: {
    name: 'Rectangular bar',
    dims: ['area', 'len'],
    has: ['resistance'],
    planar: false,
    note: 'A uniform bar of cross-section A and length l carrying current end to end.',
  },
  solenoid: {
    name: 'Solenoid',
    dims: ['area', 'len', 'turns'],
    has: ['inductance'],
    planar: false,
    note: 'A long coil of N turns over a length l, end effects neglected.',
  },
  toroid: {
    name: 'Toroid',
    dims: ['a', 'b', 'height', 'turns'],
    has: ['inductance'],
    planar: false,
    note: 'N turns wound on a ring of inner radius a, outer radius b and height h.',
  },
  loop: {
    name: 'Circular loop',
    dims: ['a', 'wire'],
    has: ['inductance'],
    planar: false,
    note: 'One circular turn of loop radius a wound from wire of radius r.',
  },
}

/** The dimensions every kind allows, for a caller that wants to validate a knob name. */
export const DIM_NAMES = ['area', 'gap', 'a', 'b', 'd', 'h', 'len', 'turns', 'height', 'wire']

const MATERIAL_DEFAULTS = { epsr: 1, mur: 1, sigma: 0 }

/**
 * Validate a geometry and fill its defaults. Throws FieldsError with a message
 * a reader can act on, naming the dimension and what it must be.
 *
 * Returns a new object. The input is never modified, so a React state object
 * can be passed straight in.
 */
export function describeGeometry(g) {
  require_(g && typeof g === 'object', 'A geometry must be an object with a kind.', { field: 'geometry' })
  const spec = KINDS[g.kind]
  if (!spec) {
    throw new FieldsError(
      `${g.kind} is not a geometry this package knows. The kinds are ${Object.keys(KINDS).join(', ')}.`,
      { field: 'kind' },
    )
  }
  const out = { kind: g.kind, ...MATERIAL_DEFAULTS }
  for (const dim of spec.dims) {
    require_(dim in g, `A ${spec.name.toLowerCase()} geometry needs ${dim}, and it is missing.`, { field: dim })
    out[dim] = dim === 'turns' ? turns(g[dim]) : positive(g[dim], dim)
  }
  out.epsr = positive(g.epsr ?? 1, 'epsr')
  out.mur = positive(g.mur ?? 1, 'mur')
  out.sigma = nonNegative(g.sigma ?? 0, 'sigma')
  out.length = positive(g.length ?? 1, 'length')
  checkOrder(out, spec)
  return out
}

function turns(n) {
  require_(
    Number.isFinite(n) && n >= 1 && Number.isInteger(n),
    `turns must be a whole number of one or more, and it is ${n}.`,
    { field: 'turns' },
  )
  return n
}

/**
 * The orderings a geometry needs to exist at all. An inner radius larger than
 * an outer one is not a small error to clamp away. It is a different object,
 * and the message says so.
 */
function checkOrder(g, spec) {
  if (g.kind === 'coax' || g.kind === 'spherical') {
    require_(
      g.b > g.a,
      `The outer radius b must be larger than the inner radius a. Here a is ${g.a} m and b is ${g.b} m.`,
      { field: 'b' },
    )
  }
  if (g.kind === 'toroid') {
    require_(
      g.b > g.a,
      `The outer radius b must be larger than the inner radius a. Here a is ${g.a} m and b is ${g.b} m.`,
      { field: 'b' },
    )
  }
  if (g.kind === 'twoWire') {
    require_(
      g.d > 2 * g.a,
      `Two wires of radius ${g.a} m cannot have their centres ${g.d} m apart. The centres must be more than 2a apart or the wires overlap.`,
      { field: 'd' },
    )
  }
  if (g.kind === 'wireOverGround') {
    require_(
      g.h > g.a,
      `A wire of radius ${g.a} m cannot sit ${g.h} m above the plane. The height must exceed the radius.`,
      { field: 'h' },
    )
  }
  if (g.kind === 'loop') {
    require_(
      g.a > g.wire,
      `A loop of radius ${g.a} m cannot be wound from wire of radius ${g.wire} m. The loop radius must exceed the wire radius.`,
      { field: 'wire' },
    )
  }
  require_(Array.isArray(spec.dims), 'A geometry kind must list its dimensions.', { field: 'kind' })
}

/** Whether `kind` has a closed form for `quantity` ('capacitance', 'inductance' or 'resistance'). */
export function hasClosedForm(kind, quantity) {
  return Boolean(KINDS[kind] && KINDS[kind].has.includes(quantity))
}

/** The absolute permittivity of a described geometry, farads per metre. */
export const epsOf = (g) => g.epsr * EPS0

/** The absolute permeability of a described geometry, henries per metre. */
export const muOf = (g) => g.mur * MU0

/** A one-line description of a geometry with its dimensions, for a caption or a report. */
export function labelOf(g) {
  const spec = KINDS[g.kind]
  const parts = spec.dims.map((dim) => `${dim} = ${dim === 'turns' ? g[dim] : `${g[dim]} m`}`)
  return `${spec.name}, ${parts.join(', ')}`
}
