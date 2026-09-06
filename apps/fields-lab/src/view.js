// What FieldMapCanvas is given, per experiment. The physics an experiment has
// already computed lives in its analysis (`math.js`); this module only turns
// that into the map's props — a domain, a scalar, a vector, the conductors,
// and (where a group's plan calls for it) the profile that draws one cut.
//
// A domain comes from the experiment's own `domain(p)`, never invented here.
// A conductor's outline is drawn from the geometry, not sampled — every
// canonical geometry in this lab is one of nine shapes, and each has a closed
// form for its outline that is exact, unlike the field the mesh would give.

import * as F from '@ee-labs/fields'

// ---------------------------------------------------------------- outlines

const CIRCLE_SIDES = 48

function circleOutline(cx, cy, r) {
  const pts = []
  for (let i = 0; i <= CIRCLE_SIDES; i++) {
    const a = (2 * Math.PI * i) / CIRCLE_SIDES
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

function rectOutline(cx, cy, w, h) {
  return [
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
    [cx - w / 2, cy - h / 2],
  ]
}

/** The conductor outlines a geometry draws, with the potential each one is at. */
function conductorsFor(geometry, V) {
  switch (geometry.kind) {
    case 'parallelPlate': {
      const w = Math.sqrt(geometry.area)
      return [
        { path: rectOutline(0, geometry.gap / 2, w, w / 20), potential: V },
        { path: rectOutline(0, -geometry.gap / 2, w, w / 20), potential: 0 },
      ]
    }
    case 'coax':
      return [
        { path: circleOutline(0, 0, geometry.a), potential: V },
        { path: circleOutline(0, 0, geometry.b), potential: 0 },
      ]
    case 'spherical':
      return [
        { path: circleOutline(0, 0, geometry.a), potential: V },
        { path: circleOutline(0, 0, geometry.b), potential: 0 },
      ]
    case 'twoWire':
      return [
        { path: circleOutline(-geometry.d / 2, 0, geometry.a), potential: V / 2 },
        { path: circleOutline(geometry.d / 2, 0, geometry.a), potential: -V / 2 },
      ]
    case 'wireOverGround':
      return [
        { path: circleOutline(0, geometry.h, geometry.a), potential: V },
        { path: rectOutline(0, -geometry.h * 0.02, geometry.h * 4, geometry.h * 0.04), potential: 0 },
      ]
    case 'bar':
      return [{ path: rectOutline(0, 0, geometry.len, Math.sqrt(geometry.area) * 4), potential: V }]
    default:
      return []
  }
}

/**
 * The exact potential at (x, y) for a geometry with a radially symmetric
 * closed form. Coulomb's law in a cylinder or a sphere, not a fit — the same
 * expression `closed.js` integrates to get the capacitance. Everywhere else
 * (a rectangular geometry, a two-wire line, or the space outside the map) the
 * caller falls back to the conductor colours alone.
 */
function radialPotential(geometry, V) {
  const { kind, a, b } = geometry
  if (kind === 'coax') {
    return (x, y) => {
      const r = Math.hypot(x, y)
      if (r <= a) return V
      if (r >= b) return 0
      return (V * Math.log(b / r)) / Math.log(b / a)
    }
  }
  if (kind === 'spherical') {
    return (x, y) => {
      const r = Math.hypot(x, y)
      if (r <= a) return V
      if (r >= b) return 0
      return (V * a * (b - r)) / (r * (b - a))
    }
  }
  return null
}

/** The two-wire line's exact potential, from the image pair `closed.js`'s acosh form already implies. */
function twoWirePotential(geometry, V) {
  const { a, d } = geometry
  const half = d / 2
  const c = Math.sqrt(Math.max(1e-300, half * half - a * a))
  const lnK = Math.acosh(half / a)
  return (x, y) => {
    const rNear = Math.hypot(x + c, y) // to the image beside the +V wire, at -c
    const rFar = Math.hypot(x - c, y) // to the image beside the -V wire, at +c
    if (rNear <= 1e-300 || rFar <= 1e-300) return x < 0 ? V / 2 : -V / 2
    return (V / 2) * (Math.log(rFar / rNear) / lnK)
  }
}

// ---------------------------------------------------------------- 2d map

/** The FieldMapCanvas props for an experiment's top pane, in `mode: '2d'`. */
export function mapPropsFor(exp, p, x) {
  const domain = exp.domain(p)
  const units = unitsFor(exp)
  if (exp.kind === 'charges') {
    return {
      mode: '2d',
      domain,
      scalar: (a, b) => safe(x.potential, [a, b, 0]),
      vector: (a, b) => {
        const f = safe(x.field, [a, b, 0])
        return Array.isArray(f) ? [f[0], f[1]] : [0, 0]
      },
      charges: (x.charges || []).map((c) => ({ q: c.q, at: [c.at[0], c.at[1]] })),
      equipotentials: x.curve ? [{ level: x.curve.level, points: x.curve.points.map((pt) => [pt[0], pt[1]]) }] : [],
      probe: x.probe ? { x: x.probe[0], y: x.probe[1] } : null,
      units,
    }
  }
  if (exp.kind === 'capacitance' || (exp.kind === 'conduction' && x.geometry) || (exp.kind === 'magnetics' && x.geometry && x.L)) {
    const geometry = x.geometry
    const V = p.V ?? 1
    const conductors = conductorsFor(geometry, V)
    const scalar = geometry.kind === 'twoWire' ? twoWirePotential(geometry, V) : radialPotential(geometry, V)
    return {
      mode: '2d',
      domain,
      scalar: scalar || null,
      vector: null,
      conductors,
      probe: null,
      units,
    }
  }
  if (exp.kind === 'magnetics' && exp.path) {
    // A long straight wire's field circles it, so its map is the plane across
    // the wire (x, y). A loop's field is axisymmetric about its own axis, so
    // its map is the plane through that axis instead (r, z) — a probe moved
    // along z, as E1's is, only makes sense drawn that way.
    const transverse = exp.id === 'e2'
    return {
      mode: '2d',
      domain,
      scalar: null,
      vector: (a, b) => {
        const at = transverse ? [a, b, 0] : [a, 0, b]
        const f = safe(x.field, at)
        return Array.isArray(f) ? (transverse ? [f[0], f[1]] : [f[0], f[2]]) : [0, 0]
      },
      conductors: [],
      probe: x.probe ? (transverse ? { x: x.probe[0], y: x.probe[1] } : { x: x.probe[0], y: x.probe[2] }) : null,
      units,
    }
  }
  // A grid experiment (group C) has its own Mesh view for the guard; the map
  // still shows the potential the finest solve found, read off the solution.
  if (exp.kind === 'grid' && x.sol) {
    return {
      mode: '2d',
      domain,
      scalar: (a, b) => {
        try {
          return F.valueAt(x.sol, a, b)
        } catch {
          return NaN
        }
      },
      vector: null,
      conductors: [],
      probe: null,
      units,
    }
  }
  return { mode: '2d', domain, scalar: null, vector: null, conductors: [], probe: null, units }
}

function safe(fn, at) {
  if (!fn) return null
  try {
    return fn(at)
  } catch {
    return null
  }
}

function unitsFor(exp) {
  if (exp.kind === 'charges') return { length: 'mm', scalar: 'V', vector: 'V/m' }
  if (exp.kind === 'magnetics') return { length: 'mm', scalar: 'T', vector: 'T' }
  if (exp.kind === 'grid') return { length: 'mm', scalar: 'V' }
  return { length: 'mm', scalar: 'V' }
}

// ---------------------------------------------------------------- profile

/** The FieldMapCanvas props for an experiment's profile view, per-id where the plan names a specific cut. */
export function profilePropsFor(exp, p, x) {
  // A group may carry its own cut in its own file, which is how a lane that
  // owns `groups/<letter>.js` gets a profile without editing this one.
  if (exp.profile) return exp.profile(p, x)
  const byId = PROFILES[exp.id]
  if (byId) return byId(p, x)
  return genericProfile(exp, p, x)
}

const V_PER_M = 'V/m'

const PROFILES = {
  a1: (p, x) => radialCharges(p, x),
  a2: (p, x) => radialCharges(p, x),
  a4: (p) => ({
    axis: 'x',
    cut: 0,
    from: p.r * 0.2,
    to: p.r * 5,
    scalar: { read: (t) => F.lineChargeField(p.lambda, t), label: 'Line, field', unit: V_PER_M },
    secondary: { read: () => F.sheetChargeField(p.sigma), label: 'Sheet, field', unit: V_PER_M },
    regions: [],
  }),
  a5: (p, x) => ({
    axis: 'x',
    cut: 0,
    from: -p.d,
    to: p.d,
    scalar: { read: (t) => safe(x.potential, [t, 0, 0]), label: 'Potential', unit: 'V' },
    regions: [],
  }),
  b1: (p) => plateProfile(p),
  b2: (p) => radialProfile(p, 'coax'),
  b3: (p) => radialProfile(p, 'spherical'),
  b4: (p) => twoWireProfile(p),
  b5: (p) => radialProfile(p, 'coax'),
  d1: (p) => ({
    axis: 'x',
    cut: 0,
    from: 0,
    to: p.len,
    scalar: { read: (t) => p.V * (1 - t / p.len), label: 'Potential along the bar', unit: 'V' },
    regions: [],
  }),
  f1: (p) => ({
    axis: 'x',
    cut: 0,
    from: 1,
    to: 1e4,
    scalar: { read: (f) => F.faradayEmf({ turns: p.N, area: p.area, Bpeak: p.B, f }).rms, label: 'Induced emf, rms', unit: 'V' },
    regions: [],
  }),
  f3: (p) => ({
    axis: 'x',
    cut: 0,
    from: p.t * 0.25,
    to: p.t * 4,
    scalar: { read: (t) => F.eddyLossSheet({ thickness: t, Bpeak: p.B, f: p.f, rho: p.rho }).P, label: 'Eddy-current loss', unit: 'W/m³' },
    regions: [{ from: 0, to: p.t, label: 'lamination' }],
  }),
  e3: (p, x) => ({
    axis: 'x',
    cut: 0,
    from: -p.len,
    to: p.len,
    scalar: { read: (t) => F.solenoidOnAxis(p.a, p.len, p.N, p.I, t).B, label: 'Flux density on axis', unit: 'T' },
    regions: [
      { from: -p.len / 2, to: p.len / 2, label: 'winding' },
    ],
  }),
  f4: (p) => ({
    axis: 'x',
    cut: 0,
    from: 1,
    to: 1e7,
    log: true,
    scalar: {
      read: (f) => F.wireImpedance(p.a, f, { sigma: p.sigma }).ratio,
      label: 'Resistance over its direct-current value',
      unit: '',
    },
    regions: [],
  }),
}

function radialCharges(p, x) {
  return {
    axis: 'x',
    cut: 0,
    from: p.d * 0.1,
    to: p.d * 3,
    scalar: { read: (t) => Math.hypot(...safe(x.field, [t, 0, 0])), label: 'Field magnitude', unit: V_PER_M },
    regions: [],
  }
}

function plateProfile(p) {
  return {
    axis: 'y',
    cut: 0,
    from: -p.gap / 2,
    to: p.gap / 2,
    scalar: { read: (y) => p.V * (0.5 - y / p.gap), label: 'Potential', unit: 'V' },
    regions: [
      { from: -p.gap / 2, to: p.gap / 2, label: 'dielectric' },
    ],
  }
}

function radialProfile(p, kind) {
  const geometry = { kind, a: p.a, b: p.b, epsr: p.epsr }
  // An experiment about a resistance (D2, D3) has no voltage knob, because its
  // answer does not depend on one. Its profile is drawn at one volt, which is
  // the convention `mapPropsFor` already uses for the same geometries: the
  // shape of the potential is what the view is about, and the shape is the
  // same at every voltage.
  const V = p.V ?? 1
  const scalar = radialPotential(geometry, V)
  // The field along the same cut: one over r in a cylinder, one over r
  // squared in a sphere — Gauss's law on the two surfaces, restated in A4.
  const field =
    kind === 'coax'
      ? (r) => V / (r * Math.log(p.b / p.a))
      : (r) => (V * p.a * p.b) / (r * r * (p.b - p.a))
  return {
    axis: 'x',
    cut: 0,
    from: p.a,
    to: p.b,
    scalar: { read: (r) => scalar(r, 0), label: 'Potential', unit: 'V' },
    secondary: { read: field, label: 'Field', unit: V_PER_M },
    regions: [{ from: p.a, to: p.b, label: 'dielectric' }],
  }
}

function twoWireProfile(p) {
  const geometry = { kind: 'twoWire', a: p.a, d: p.d }
  const scalar = twoWirePotential(geometry, p.V)
  return {
    axis: 'x',
    cut: 0,
    from: -p.d / 2 - p.a * 2,
    to: p.d / 2 + p.a * 2,
    scalar: { read: (t) => scalar(t, 0), label: 'Potential', unit: 'V' },
    regions: [
      { from: -p.d / 2 - p.a, to: -p.d / 2 + p.a, label: 'wire' },
      { from: p.d / 2 - p.a, to: p.d / 2 + p.a, label: 'wire' },
    ],
  }
}

/** A profile no per-id builder claims: the potential along the domain's x axis, at y = 0. */
function genericProfile(exp, p, x) {
  const domain = exp.domain(p)
  const x0 = domain.centre ? -domain.width / 2 : 0
  if (x.geometry && (x.geometry.kind === 'coax' || x.geometry.kind === 'spherical')) return radialProfile(p, x.geometry.kind)
  if (x.geometry && x.geometry.kind === 'twoWire') return twoWireProfile(p)
  if (exp.kind === 'grid' && x.sol) {
    const y = p.py ?? domain.height / 2
    return {
      axis: 'x',
      cut: y,
      from: 0,
      to: domain.width,
      scalar: {
        read: (t) => {
          try {
            return F.valueAt(x.sol, t, y)
          } catch {
            return NaN
          }
        },
        label: 'Potential',
        unit: 'V',
      },
      regions: [],
    }
  }
  if (exp.kind === 'charges') {
    return {
      axis: 'x',
      cut: 0,
      from: x0,
      to: x0 + domain.width,
      scalar: { read: (t) => safe(x.potential, [t, 0, 0]), label: 'Potential', unit: 'V' },
      regions: [],
    }
  }
  return {
    axis: 'x',
    cut: 0,
    from: 0,
    to: 1,
    scalar: { read: () => x.headline?.value ?? 0, label: x.headline?.label || 'Value', unit: x.headline?.unit || '' },
    regions: [],
  }
}
