// One analysis per experiment, and every view and every lesson reads from it.
//
// `analyse(exp, p)` dispatches on the experiment's `kind` and returns an object
// whose shape is fixed per kind. Nothing in the app calls the engine directly.
// That is what makes `experiments.test.js` able to recompute every number a
// lesson quotes: it calls the same function with the same settings.
//
// The grid solves are cached. A three-level convergence report on a 240-cell
// mesh takes seconds, and a view switch must not pay for one twice. The key is
// the experiment's id and the settings that reach the solver, so moving a knob
// that only changes a caption does not throw the cache away.

import * as F from '@ee-labs/fields'

// ------------------------------------------------------------------ the cache

const CACHE = new Map()
const LIMIT = 24

function cached(key, make) {
  if (CACHE.has(key)) {
    const hit = CACHE.get(key)
    // Move it to the end, so the least recently used falls off first.
    CACHE.delete(key)
    CACHE.set(key, hit)
    return hit
  }
  const made = make()
  CACHE.set(key, made)
  if (CACHE.size > LIMIT) CACHE.delete(CACHE.keys().next().value)
  return made
}

/** Empty the cache. Only the tests need this, so that one experiment's solve cannot pay for another's. */
export const clearCache = () => CACHE.clear()

// ------------------------------------------------------------- the dispatcher

/**
 * The analysis for one experiment at one set of knob values.
 *
 * Every return carries `kind`, `exp`, `p`, and a `headline`, which is the one
 * number the experiment is about with its unit and its label. The rest depends
 * on the kind, and `readQuantity` in lessons.js knows the paths.
 */
export function analyse(exp, p) {
  const fn = KINDS[exp.kind]
  if (!fn) throw new Error(`No analysis for kind ${exp.kind} (experiment ${exp.id})`)
  try {
    return { kind: exp.kind, exp, p, ...fn(exp, p) }
  } catch (err) {
    if (err && err.name === 'FieldsError') return declined(exp, p, err)
    throw err
  }
}

/**
 * A setting the engine will not describe.
 *
 * An inner radius larger than an outer one is not clamped back into a valid
 * geometry. `FIELDS_LAB_PLAN.md` §2.1 says why: it is a different object, and
 * `describeGeometry` throws a message naming the dimension and what it must be.
 * The app shows that sentence where the headline would be, rather than the last
 * answer that happened to work, so a knob taken past what a geometry allows
 * reads as a refusal and not as a number.
 */
function declined(exp, p, err) {
  return {
    kind: exp.kind,
    exp,
    p,
    declined: { says: err.message, field: err.field },
    headline: { value: NaN, unit: '', label: 'Declined' },
  }
}

const KINDS = {
  charges: analyseCharges,
  capacitance: analyseCapacitance,
  grid: analyseGrid,
  conduction: analyseConduction,
  magnetics: analyseMagnetics,
  induction: analyseInduction,
  wave: analyseWave,
  line: analyseLine,
  bounce: analyseBounce,
  guide: analyseGuide,
  antenna: analyseAntenna,
}

// ------------------------------------------------------------------- group A

function analyseCharges(exp, p) {
  const charges = exp.charges(p)
  const field = (q) => F.pointChargeField(charges, q)
  const potential = (q) => F.pointChargePotential(charges, q)
  const out = {
    charges,
    field,
    potential,
    // The probe the map reads out, in metres.
    probe: exp.probe ? exp.probe(p) : [0, 0, 0],
  }
  out.atProbe = safeField(field, out.probe)
  out.vAtProbe = safePotential(potential, out.probe)
  if (exp.gauss) {
    const g = exp.gauss(p)
    out.gauss = F.gaussFlux(field, { ...g, charges, n: g.n ?? 24 })
  }
  if (exp.force) out.force = exp.force(p)
  if (exp.lineCharge) out.lineField = F.lineChargeField(exp.lineCharge(p).lambda, exp.lineCharge(p).r)
  if (exp.sheetCharge) out.sheetField = F.sheetChargeField(exp.sheetCharge(p).sigma)
  if (exp.ring) {
    const r = exp.ring(p)
    out.ring = {
      closed: F.ringOnAxis(r.a, r.Q, r.z),
      byParts: F.pointChargeField(F.ringCharges(r.a, r.Q, r.sides ?? 720), [0, 0, r.z])[2],
    }
  }
  if (exp.equipotential) {
    const e = exp.equipotential(p)
    out.curve = F.traceEquipotential(potential, field, e.start, { step: e.step, maxSteps: e.maxSteps ?? 8000 })
  }
  out.headline = exp.headline(out, p)
  return out
}

const safeField = (field, at) => {
  try {
    return field(at)
  } catch {
    return [NaN, NaN, NaN]
  }
}
const safePotential = (potential, at) => {
  try {
    return potential(at)
  } catch {
    return NaN
  }
}

// ------------------------------------------------------------------- group B

function analyseCapacitance(exp, p) {
  const geometry = exp.geometry(p)
  const out = { geometry }
  if (F.hasClosedForm(geometry.kind, 'capacitance')) {
    out.C = F.capacitance(geometry)
    out.energy = F.fieldEnergy(geometry, p.V ?? 1)
    out.peakField = F.peakField(geometry, p.V ?? 1)
  }
  if (F.hasClosedForm(geometry.kind, 'inductance')) out.L = withInternal(geometry, p)
  if (F.hasClosedForm(geometry.kind, 'resistance') && p.sigma) out.R = F.resistance(geometry, p.sigma)
  if (exp.radial) out.radial = exp.radial(out, p)
  out.headline = exp.headline(out, p)
  return out
}

// ------------------------------------------------------------------- group C

function analyseGrid(exp, p) {
  const key = `${exp.id}|${JSON.stringify(exp.gridKey ? exp.gridKey(p) : p)}`
  const solved = cached(key, () => {
    const build = (n) => exp.spec(p, n)
    const report = F.converge(build, {
      n: exp.cells(p),
      threshold: exp.threshold ?? 1e-3,
      read: (s) => exp.read(s, p),
    })
    return report
  })
  const out = { grid: solved, sol: solved.solution }
  if (exp.compare) {
    out.compare = exp.compare(p)
    // The true error, where there is something exact to measure against. The
    // guard's band is what the report defends without knowing this number; C3's
    // whole point is that the band holds it.
    out.compare.error = Math.abs(solved.value - out.compare.value) / Math.abs(out.compare.value)
  }
  if (exp.contour) {
    const c = exp.contour(out.sol, p)
    out.flux = {
      contour: c,
      value: (c.symmetry ?? 1) * F.fluxThrough(out.sol, c),
      inside: (c.symmetry ?? 1) * F.chargeInside(out.sol, c),
    }
  }
  out.staircase = F.staircaseFraction(out.sol)
  out.headline = exp.headline(out, p)
  return out
}

// ------------------------------------------------------------------- group D

function analyseConduction(exp, p) {
  const out = {}
  if (exp.bar) out.bar = F.currentDensity(exp.bar(p))
  if (exp.geometry) {
    const geometry = exp.geometry(p)
    out.geometry = geometry
    if (F.hasClosedForm(geometry.kind, 'resistance')) out.R = F.resistance(geometry, p.sigma)
    if (F.hasClosedForm(geometry.kind, 'capacitance')) {
      out.C = F.capacitance(geometry)
      out.rc = F.rcProduct(geometry, p.sigma)
    }
  }
  if (exp.fourPoint) out.fourPoint = F.fourPointProbe(exp.fourPoint(p))
  out.headline = exp.headline(out, p)
  return out
}

// ------------------------------------------------------------------- group E

function analyseMagnetics(exp, p) {
  const out = {}
  if (exp.path) {
    const path = exp.path(p)
    const I = p.I ?? 1
    out.path = path
    out.field = (q) => F.biotSavart(path, I, q)
    out.probe = exp.probe ? exp.probe(p) : [0, 0, 0]
    out.atProbe = out.field(out.probe)
    out.magProbe = Math.hypot(...out.atProbe)
    if (exp.closedForm) out.closed = exp.closedForm(p)
    if (exp.ampere) {
      const a = exp.ampere(p)
      out.ampere = { integral: F.ampereLoop(out.field, a), enclosed: F.enclosedCurrent(F.ampereLoop(out.field, a)), expected: a.expected }
    }
  }
  if (exp.solenoid) out.solenoid = F.solenoidOnAxis(...exp.solenoid(p))
  if (exp.geometry) {
    const geometry = exp.geometry(p)
    out.geometry = geometry
    if (F.hasClosedForm(geometry.kind, 'inductance')) out.L = withInternal(geometry, p)
    // The same geometry's capacitance, where it has one. E4's note leans on it:
    // an inductance per metre and a capacitance per metre are between them
    // everything a transmission line needs, which is where group I starts.
    if (F.hasClosedForm(geometry.kind, 'capacitance')) out.C = F.capacitance(geometry)
  }
  if (exp.circuit) out.circuit = F.magneticCircuit(exp.circuit(p))
  if (exp.transformer) out.xfmr = F.transformer(exp.transformer(p))
  out.headline = exp.headline(out, p)
  return out
}

/**
 * The inductance, with the field inside the conductors counted or not, and the
 * difference between the two named. That difference is mu over 8 pi per
 * conductor whatever the radius, which is E4's claim and F4's starting point,
 * so it is a number the engine produces rather than one a lesson asserts.
 */
function withInternal(geometry, p) {
  const L = F.inductance(geometry, { internal: p.internal > 0.5 })
  return { ...L, internalPerMetre: F.inductance(geometry, { internal: true }).perMetre - F.inductance(geometry, { internal: false }).perMetre }
}

// ------------------------------------------------------------------- group F

function analyseInduction(exp, p) {
  const out = {}
  if (exp.faraday) out.emf = F.faradayEmf(exp.faraday(p))
  if (exp.moving) out.moving = F.motionalEmf(exp.moving(p))
  if (exp.rotating) out.rotating = F.rotatingLoop(exp.rotating(p))
  if (exp.eddy) out.eddy = F.eddyLossSheet(exp.eddy(p))
  if (exp.wire) {
    const w = exp.wire(p)
    out.skin = { delta: F.skinDepth(w.f, w.material) }
    out.wire = F.wireImpedance(w.a, w.f, w.material)
    out.tube = F.wireHighFrequency(w.a, w.f, w.material)
    out.surface = F.surfaceImpedance(w.f, w.material)
  }
  out.headline = exp.headline(out, p)
  return out
}

// ---------------------------------------------------------------- groups G, H

function analyseWave(exp, p) {
  const out = {}
  if (exp.medium) out.wave = F.planeWave(p.f, exp.medium(p))
  if (exp.pair) {
    const [m1, m2] = exp.pair(p)
    out.m1 = m1
    out.m2 = m2
    out.refl = F.reflectNormal(p.f, m1, m2)
    out.standing = F.standingWave(out.refl.gamma, out.refl.wave1.beta)
  }
  if (exp.oblique) {
    const o = exp.oblique(p)
    out.oblique = F.reflectOblique(o.thetaDeg, o.m1, o.m2, o.pol)
  }
  if (exp.polarisation) out.pol = F.polarisation(exp.polarisation(p))
  if (exp.displacement) out.displacement = exp.displacement(p)
  out.headline = exp.headline(out, p)
  return out
}

// ------------------------------------------------------------------- group I

function analyseLine(exp, p) {
  const line = exp.line(p)
  const out = { line: F.describeLine(line), at: F.lineAt(line, p.f) }
  out.available = F.timeDomainAvailable(line)
  if (exp.load !== undefined) {
    const ZL = exp.load(p)
    out.ZL = ZL
    out.gamma = F.reflectionCoefficient(ZL, out.at.Z0)
    out.sw = F.lineStandingWave(line, ZL, p.f)
    out.zin = F.inputImpedance(line, ZL, p.f, { atLength: exp.atLength ? exp.atLength(p, out) : undefined })
    out.smith = {
      z: F.normalise(ZL === Infinity ? Infinity : ZL, out.at.Z0mag),
      gamma: out.gamma,
      rotated: F.towardsGenerator(out.gamma, out.at.beta * (exp.atLength ? exp.atLength(p, out) : out.line.len), out.at.alpha * (exp.atLength ? exp.atLength(p, out) : out.line.len)),
    }
  }
  if (exp.transformer) out.qw = F.quarterWave(...exp.transformer(p))
  out.s = F.sMatrix(line, p.f, exp.zref ? exp.zref(p) : out.at.Z0mag)
  if (exp.sweep) out.sweep = exp.sweep(p, out)
  out.headline = exp.headline(out, p)
  return out
}

function analyseBounce(exp, p) {
  const spec = exp.bounce(p)
  const out = { diagram: F.bounceDiagram(spec) }
  out.trace = F.loadTrace(out.diagram, { until: (p.cycles ?? 8) * out.diagram.T })
  out.snap = F.snapshot(out.diagram, (p.at ?? 0.5) * out.diagram.T)
  out.headline = exp.headline(out, p)
  return out
}

// ------------------------------------------------------------------- group K

function analyseGuide(exp, p) {
  const guide = exp.guide(p)
  const out = { guide: F.describeGuide(guide), spec: guide }
  out.cutoffs = F.modes(guide, exp.upTo ? exp.upTo(p) : 4 * F.cutoff(guide, 1, 0))
  out.band = F.singleModeBand(guide)
  if (p.f) out.mode = F.modeAt(guide, p.f, exp.mode ? exp.mode(p) : {})
  if (exp.cavity) {
    const c = exp.cavity(p)
    out.cavity = { f: F.cavityResonance(c), list: F.resonances(c, 3 * F.cavityResonance(c)) }
    if (p.sigma) out.q = F.cavityQ(c, { sigma: p.sigma })
  }
  out.headline = exp.headline(out, p)
  return out
}

// ------------------------------------------------------------------- group L

function analyseAntenna(exp, p) {
  const out = {}
  if (exp.dipole) out.dipole = F.dipole(...exp.dipole(p))
  if (exp.hertzian) out.hertzian = F.hertzianDipole(exp.hertzian(p))
  if (exp.array) out.array = F.arrayFactor(exp.array(p))
  if (exp.gain) out.gain = F.gainOf(...exp.gain(p, out))
  if (exp.friis) out.friis = F.friis(exp.friis(p))
  out.headline = exp.headline(out, p)
  return out
}

// ------------------------------------------------------------------- shared

/**
 * The guard an experiment is showing, if it has one. Every guard in the engine
 * has the same five fields, so the panel renders one without knowing which.
 */
export function guardOf(x) {
  if (x.grid) {
    return {
      quantity: 'change between two mesh refinements',
      value: x.grid.change,
      threshold: x.grid.threshold,
      ok: x.grid.ok,
      says: x.grid.says,
    }
  }
  for (const key of ['tube', 'eddy', 'circuit', 'q', 'friis', 'dipole', 'hertzian', 'L']) {
    const holder = x[key]
    if (holder && holder.guard) return holder.guard
  }
  // A transformer's magnetic circuit is nested under it, and it is the same
  // approximation with the same guard, so E6 flies the flag E5 does.
  if (x.xfmr && x.xfmr.circuit && x.xfmr.circuit.guard) return x.xfmr.circuit.guard
  return null
}

/** The refusal an experiment is showing, if its whole point is one. */
export function refusalOf(x) {
  if (x.declined) return x.declined.says
  if (x.available && !x.available.ok) return x.available.says
  return null
}
