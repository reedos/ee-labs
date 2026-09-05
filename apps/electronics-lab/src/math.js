// The analysis behind every pane, and the math panel that explains it.
//
// One entry point: `analyse(exp, p, cursor)` solves the experiment's circuit
// at its knob settings and returns everything a pane can draw. What it
// computes depends on what the experiment declares, so a DC experiment pays
// for no sweep and a static one pays for no transient:
//
//   always          the operating point, by region search or by Newton
//   `signal`        the small-signal netlist, its exact H(s), its poles
//   `window`        the response in time, exact inside every region
//   `junction`      Group C's closed forms at the point the circuit sets
//   `sweepOver`     the quasi-static sweep, one solve per point
//
// Every number a lesson quotes is read out of this object by `readQuantity` in
// lessons.js, and experiments.test.js checks each one against the sentence
// that quotes it.

import {
  NetworkError,
  builtIn,
  corners,
  depletionWidth,
  diffusionCap,
  doubling,
  evalTF,
  isAt,
  junctionCap,
  newtonDC,
  normalize,
  operatingPoint,
  polesOf,
  pointsOf,
  pwlTransient,
  smallSignal,
  solveAC,
  solveDC,
  solvePWL,
  thermalVoltage,
  transferOf,
  transitFreq,
  vbeSlope,
  zerosOf,
  complex as cx,
  hasCompanion,
  sourceValue,
} from '@ee-labs/network'
import { ENTRIES } from './mathEntries.js'

/** Does this netlist need Newton, or does a region search settle it? */
const needsNewton = (norm) => norm.elements.some(hasCompanion)

/**
 * The operating point, by whichever method the models in the circuit call for,
 * with every source read at t = 0. A source that carries a wave has no `value`
 * of its own, and the circuit at the instant the window opens is the one whose
 * operating point a DC pane is asking for.
 */
export function solvePoint(net) {
  const norm = net.nodeNames ? net : normalize(net)
  const sources = {}
  for (const e of norm.elements) if (e.type === 'V' || e.type === 'I') sources[e.id] = sourceValue(e, 0)
  const opts = { sources }
  return needsNewton(norm) ? newtonDC(norm, opts) : solvePWL(norm, opts)
}

/**
 * Everything the panes draw, for one experiment at one setting of its knobs.
 * `cursor` is in seconds and only means anything for an experiment with a
 * window; absent, the experiment's own opening fraction of it is used.
 */
export function analyse(exp, p, cursor) {
  const net = exp.net(p)
  const norm = normalize(net)
  const dynamic = typeof exp.window === 'function'
  const x = { exp, p, net, norm, sol: null, refusal: null, regions: {}, point: {} }

  // In time: exact inside every region, and every region change an event. The
  // schematic's meters read the circuit at the cursor, so the walk comes first
  // and the operating point is read off it.
  if (dynamic) {
    x.tEnd = exp.window(p)
    x.cursor = Number.isFinite(cursor) ? Math.min(Math.max(cursor, 0), x.tEnd) : (exp.cursor ?? 0.5) * x.tEnd
    try {
      x.tr = pwlTransient(net, { tEnd: x.tEnd, points: exp.points ?? 601 })
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err
      x.refusal = err
      return x
    }
    x.now = x.tr.at(x.cursor)
    x.sol = x.now.sol
    x.events = x.tr.events
    x.regions = x.tr.regionsAt(x.cursor)
    x.op = { sol: x.sol, regions: x.regions }
  } else {
    try {
      const op = solvePoint(net)
      x.sol = op.sol
      x.regions = op.regions || {}
      x.iters = op.iters || []
      x.op = op
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err
      x.refusal = err
      return x
    }
  }
  x.point = pointsOf(norm, x.op)

  // The tangent, and the polynomials that come off it.
  if (exp.signal) {
    try {
      x.ss = smallSignal(norm, x.op, { caps: !!exp.caps })
      x.label = x.ss.label
      x.tf = transferOf({ elements: x.ss.elements }, { ...exp.signal, check: false })
      x.poles = polesOf(x.tf).sort((a, b) => a.hz - b.hz)
      x.zeros = zerosOf(x.tf).sort((a, b) => a.hz - b.hz)
      x.corner = corners(x.tf, { at: 2 * Math.PI * (exp.at ?? 1) })
      x.gain = evalTF(x.tf, [0, 1e-9])[0]
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err
      x.signalRefusal = err
    }
  }


  // Group C: the closed forms, evaluated at the bias the circuit settled on.
  if (exp.junction) x.junction = junctionOf(exp, p, x)

  // The quasi-static sweep: one exact solve per point, which is what the
  // transfer characteristic and the harmonic distortion are read from.
  if (exp.sweepOver) x.sweep = quasiStatic(exp, p)
  return x
}

/**
 * Group C's four closed forms at the doping, geometry and temperature the
 * knobs set, with the junction's own current read off the circuit so that
 * C_d follows the bias rather than a number typed beside it.
 */
export function junctionOf(exp, p, x) {
  const T = p.T ?? 300
  const vt = thermalVoltage(T)
  const doping = { na: p.na, nd: p.nd, T }
  const v0 = builtIn(doping)
  // The junction's own voltage and current, read off the circuit rather than
  // typed beside it, so every closed form below follows the bias the knobs set.
  const v = x.sol ? x.sol.volt.D1 : 0
  const i = x.sol ? Math.abs(x.sol.i.D1 ?? 0) : 0
  const out = { v0, vt, T, v }
  try {
    const w = depletionWidth(doping, v)
    out.w = w.w
    out.xp = w.xp
    out.xn = w.xn
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err
    out.widthRefusal = err
  }
  try {
    out.cj = junctionCap({ cj0: p.cj0 ?? 2e-12, v0 }, v)
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err
    out.capRefusal = err
  }
  out.i = i
  out.gm = i / vt
  out.cd = diffusionCap({ tauF: p.tauF ?? 0.5e-9 }, out.gm)
  out.cpi = out.cd + (p.cje ?? 0.7e-12)
  out.fT = out.cpi > 0 ? transitFreq({ gm: out.gm, cpi: out.cpi, cmu: p.cmu ?? 2e-12 }) : 0
  out.fTlimit = 1 / (2 * Math.PI * (p.tauF ?? 0.5e-9))
  out.is = isAt({ is: p.is ?? 1e-14 }, T)
  out.doubling = doubling({ is: p.is ?? 1e-14 }, T)
  out.slope = vbeSlope({ vbe: v }, T)
  return out
}

/**
 * The transfer characteristic: the experiment's `sweepOver` knob walked across
 * its range, one exact solve per point. This is route 2 of the plan's §2.8,
 * and its guard is a frequency rather than an amplitude: it describes a slow
 * input, and the pane says so.
 */
export function quasiStatic(exp, p) {
  const { key, from, to, points = 121, read } = exp.sweepOver
  const xs = []
  const ys = []
  for (let k = 0; k < points; k++) {
    const v = from + ((to - from) * k) / (points - 1)
    try {
      const sol = solvePoint(exp.net({ ...p, [key]: v })).sol
      xs.push(v)
      ys.push(read ? read(sol) : sol.v[exp.signal ? exp.signal.output : 'out'])
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err
    }
  }
  return { key, xs, ys }
}

/** Σ p for the meters: a residual below a part in a billion of the largest is the zero Tellegen promises. */
export function netPower(sol) {
  let scale = 0
  for (const w of Object.values(sol.p)) scale = Math.max(scale, Math.abs(w))
  return Math.abs(sol.pTotal) <= 1e-9 * scale ? 0 : sol.pTotal
}

/** A refusal as a sentence, for the pane that has nothing to draw. */
export const refusalReason = (err) => (err ? err.message : 'No solution.')

/** The math panel's entry for an experiment, or null where it has none. */
export function experimentMath(exp, p, x) {
  const fn = ENTRIES[exp.id]
  if (!fn) return null
  try {
    return fn(p, x)
  } catch {
    return null
  }
}

/**
 * The frequency response of the small-signal netlist, as points, for the Bode
 * pane. Read from the polynomials, which have already been checked against the
 * phasor solve, so the curve and the pole markers cannot disagree.
 */
export function bodePoints(x, { lo = 1, hi = 1e9, points = 241 } = {}) {
  if (!x.tf) return null
  const f = new Float64Array(points)
  const db = new Float64Array(points)
  const deg = new Float64Array(points)
  for (let k = 0; k < points; k++) {
    const freq = lo * (hi / lo) ** (k / (points - 1))
    const h = evalTF(x.tf, [0, 2 * Math.PI * freq])
    f[k] = freq
    db[k] = 20 * Math.log10(Math.max(cx.cabs(h), 1e-300))
    deg[k] = (Math.atan2(h[1], h[0]) * 180) / Math.PI
  }
  return { f, db, deg }
}

/** The largest and smallest value a trace reaches over the window: a scope's flat tops. */
export function clipOf(x, node) {
  if (!x.tr) return null
  let high = -Infinity
  let low = Infinity
  for (const s of x.tr.samples) {
    high = Math.max(high, s.sol.v[node])
    low = Math.min(low, s.sol.v[node])
  }
  return { high, low }
}

/**
 * The slope of a trace between two instants, in volts per second. The two
 * instants are a tenth and a half of the window unless the experiment says
 * otherwise, so the measurement sits inside the ramp rather than across its
 * corners.
 */
export function slopeOf(x, node, a = null, b = null) {
  if (!x.tr) return null
  const [f1, f2] = x.exp.slopeAt || [0.05, 0.25]
  const t1 = a ?? f1 * x.tEnd
  const t2 = b ?? f2 * x.tEnd
  return (x.tr.at(t2).sol.v[node] - x.tr.at(t1).sol.v[node]) / (t2 - t1)
}

/** The peak of a trace over the window. */
export function peakOf(x, node) {
  if (!x.tr) return null
  return Math.max(...x.tr.samples.map((s) => s.sol.v[node]))
}

/** The mean of a trace over the last whole cycle of the drive, or the window. */
export function meanOf(x, node) {
  if (!x.tr) return null
  const ys = x.tr.samples.map((s) => s.sol.v[node])
  return ys.reduce((s, v) => s + v, 0) / ys.length
}
