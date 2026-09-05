// From an experiment and its knobs to everything the panes draw.
//
// `physics.js` holds the models. This file holds the one analysis each
// experiment needs, so a pane, a note and a test all read the same numbers
// from the same call.
//
// Everything here is memoised on the cell's own parameters. A tracker run asks
// for the power at the same handful of voltages hundreds of times, because
// crossing the peak back and forth for ever is what the algorithm does. Solved
// afresh each time, a single C3 would be thousands of Newton solves. The cache
// is keyed by the whole cell description, so a knob move empties nothing and
// invalidates everything, which is the correct behaviour and also the simple
// one.

import {
  BATTERY_DEFAULTS,
  BUS_DEFAULTS,
  CELL_DEFAULTS,
  DAY,
  G_REF,
  OCV_FIT,
  T_REF,
  atI,
  atR,
  atV,
  buckPoint,
  CELSIUS,
  buckRin,
  cccv,
  chargeCap,
  day,
  decadeOfLight,
  figures,
  firstReversal,
  heat,
  inBand,
  iphAt,
  isAt,
  maxPower,
  mpptDuty,
  ocv,
  openCircuit,
  poRun,
  pulse,
  rDC,
  restingState,
  roundTrip,
  settled,
  shortCircuit,
  socOf,
  sweepI,
  terminalEnergy,
  vocFormula,
  vtAt,
} from './physics.js'

export { CELL_DEFAULTS, BATTERY_DEFAULTS, BUS_DEFAULTS, OCV_FIT, DAY, G_REF, T_REF }

// ------------------------------------------------------------ the cache

const CACHE = new Map()
const LIMIT = 20000

function memo(key, make) {
  const hit = CACHE.get(key)
  if (hit !== undefined) return hit
  const v = make()
  if (CACHE.size > LIMIT) CACHE.clear()
  CACHE.set(key, v)
  return v
}

/** Empty the cache. Tests call it so one experiment's cost is not another's. */
export const clearCache = () => CACHE.clear()

/**
 * The array a set of knobs describes, as plain data. Shading and bypass are
 * described by numbers rather than by functions, so the whole description is a
 * cache key and two experiments that ask for the same array share their solves.
 */
export function cellOf(exp, p) {
  const base = { ...CELL_DEFAULTS, ...(exp.cell || {}) }
  for (const k of ['iph', 'is', 'n', 'Rs', 'Rsh', 'G', 'T', 'Ns', 'Np']) if (p[k] !== undefined) base[k] = p[k]
  // The temperature knob is in degrees Celsius, because nobody reads a cell
  // temperature in kelvin. The model wants kelvin.
  if (p.Tc !== undefined) base.T = p.Tc + CELSIUS
  // Cell counts are counts. A knob that lands between two of them would build
  // a string whose last cell never reaches the terminal, and the solver would
  // report a node fed only by current sources — correctly, and unhelpfully.
  base.Ns = Math.max(1, Math.round(base.Ns))
  base.Np = Math.max(1, Math.round(base.Np))
  return base
}

/** The shading description: which cell, at what irradiance, and which cells carry a bypass diode. */
export function shadeOf(exp, p) {
  const shade = exp.shade ? { k: exp.shade.k, G: p.Gshade ?? exp.shade.G } : null
  const bypass = p.bypass === undefined ? exp.bypass || null : p.bypass ? exp.bypass || [0] : null
  return { shade, bypass }
}

/** The `opts` those two turn into for `physics.js`. */
export function optsOf({ shade, bypass }) {
  const out = {}
  if (shade) out.cells = (k) => (k === shade.k ? { G: shade.G } : {})
  if (bypass && bypass.length) out.bypass = (k) => bypass.includes(k)
  return out
}

const keyOf = (c, s) => JSON.stringify([c, s])

/** The array's figures, memoised. */
export const figuresOf = (c, s) => memo(`fig${keyOf(c, s)}`, () => figures(c, optsOf(s)))

/** The operating point at a terminal voltage, memoised. This is what the tracker hammers. */
export const powerAt = (c, s, V) => memo(`v${keyOf(c, s)}|${V}`, () => atV(c, V, optsOf(s)))

/**
 * The I–V curve, memoised. The solved circuit behind each point is dropped
 * before the curve is cached: nothing reads it, and keeping it would make one
 * cached curve larger than every other entry in the cache put together.
 */
export const curveOf = (c, s, n = 121) =>
  memo(`sw${keyOf(c, s)}|${n}`, () =>
    sweepI(c, { n, opts: optsOf(s) }).map(({ v, i, p, iters }) => ({ v, i, p, iters })),
  )

// ------------------------------------------------------------ the analysis

export function analyse(exp, params) {
  const p = { ...params }
  switch (exp.kind) {
    case 'battery':
      return analyseBattery(exp, p)
    case 'day':
      return analyseDay(exp, p)
    default:
      return analyseArray(exp, p)
  }
}

/**
 * Every photovoltaic experiment: the curve, its figures, and the one operating
 * point this experiment is about. What sets that point is `exp.kind`. A load
 * resistance for the cell and string groups, a duty for the converter, and the
 * tracker's own walk for the tracking group.
 */
function analyseArray(exp, p) {
  const c = cellOf(exp, p)
  const s = shadeOf(exp, p)
  const opts = optsOf(s)
  const fig = figuresOf(c, s)
  const n = exp.points || 121
  const x = {
    kind: exp.kind,
    c,
    s,
    opts,
    fig,
    voc: fig.voc,
    isc: fig.isc,
    formulas: {
      voc: vocFormula(c),
      decade: decadeOfLight(c),
      halving: (c.Ns || 1) * c.n * vtAt(c.T) * Math.LN2,
      is: isAt(c.is, c.n, c.T),
      iph: iphAt(c.iph, c.G),
      vt: vtAt(c.T),
      rect: fig.voc * fig.isc,
    },
  }
  // The curve is 121 exact solves and its maxima are ninety more, and most
  // reads of an analysis want neither. A pane draws the curve, one lesson
  // reads the humps, and everything else asks for a figure or an operating
  // point. So both are computed on first access rather than up front, and
  // memoised past that. The tests call `analyse` thousands of times without
  // drawing anything, and this is the difference between a suite that runs in
  // a minute and one that times out on a shared runner.
  Object.defineProperty(x, 'curve', {
    enumerable: true,
    configurable: true,
    get: () => curveOf(c, s, n),
  })
  Object.defineProperty(x, 'humps', {
    enumerable: true,
    configurable: true,
    get: () => humpsOf(c, s, n),
  })

  // Where this experiment sits on the curve.
  if (exp.kind === 'track') {
    const power = (v) => powerAt(c, s, v).p
    const path = poRun(power, {
      v0: p.v0 ?? 2,
      step: p.step ?? 0.2,
      n: p.steps ?? 40,
      vmin: 0,
      vmax: fig.voc,
    })
    x.path = path
    x.settled = settled(path)
    x.reversal = firstReversal(path)
    x.share = x.settled.mean / fig.pmpp
    x.at = powerAt(c, s, path[path.length - 1].v)
  } else if (exp.kind === 'buck') {
    const R = p.R ?? 0.5
    const b = buckPoint(c, { D: p.D, R, L: p.L, C: p.C, fs: p.fs, opts })
    x.buck = b
    x.at = { v: b.v, i: b.i, p: b.p, sol: b.sol }
    x.duty = mpptDuty(c, R, opts)
    x.rin = buckRin(R, p.D)
  } else if (exp.drive === 'i') {
    x.at = memo(`i${keyOf(c, s)}|${p.I}`, () => atI(c, p.I, opts))
  } else {
    const R = p.R ?? fig.rmpp
    x.at = memo(`r${keyOf(c, s)}|${R}`, () => atR(c, R, opts))
    x.R = R
  }
  x.share = x.share ?? x.at.p / fig.pmpp
  // Each cell's own junction, for the string view, read off the solved circuit.
  x.cells = cellRows(c, s, x.at.sol)
  return x
}

/**
 * Every cell's own voltage, current and dissipation at the solved point. A
 * cell's voltage is the difference between the nodes above and below it, so
 * this is where the string view's column comes from, and where B4's hot spot
 * is read.
 */
export function cellRows(c, s, sol) {
  if (!sol) return []
  const { Ns = 1, Np = 1 } = c
  const out = []
  for (let str = 0; str < Np; str++) {
    for (let k = 0; k < Ns; k++) {
      const bot = k === 0 ? 'gnd' : `s${str}n${k}`
      const top = k === Ns - 1 ? 't' : `s${str}n${k + 1}`
      const v = sol.v[top] - sol.v[bot]
      const tag = `${str}_${k}`
      const i = -(sol.i[`Iph${tag}`] ?? 0)
      const shaded = !!(s.shade && s.shade.k === k)
      const bypassed = !!(s.bypass && s.bypass.includes(k))
      out.push({
        str,
        k,
        v,
        iph: i,
        vd: sol.volt[`D${tag}`],
        bypass: bypassed ? { v: sol.volt[`Db${tag}`], i: sol.i[`Db${tag}`] } : null,
        shaded,
        reverse: v < 0,
      })
    }
  }
  return out
}

/**
 * The battery experiments. Three shapes: a current step, a closed round trip,
 * and a constant-current charge that becomes a constant-voltage one.
 */
function analyseBattery(exp, p) {
  const b = { ...BATTERY_DEFAULTS }
  for (const k of ['Q', 'R0', 'R1', 'C1', 'R2', 'C2']) if (p[k] !== undefined) b[k] = p[k]
  const z0 = p.z0 ?? BATTERY_DEFAULTS.z0
  const x = {
    kind: 'battery',
    b,
    z0,
    fit: OCV_FIT,
    cq: chargeCap(b),
    rdc: rDC(b),
    tau1: b.R1 * b.C1,
    tau2: b.R2 * b.C2,
    ocv0: ocv(z0),
    inBand: inBand(z0),
  }
  if (exp.mode === 'cccv') {
    const r = cccv(b, { icc: p.i, vlim: p.vlim, tEnd: p.tEnd, z0, points: p.points || 2001 })
    x.cc = r.cc
    x.cv = r.cv
    x.tSwitch = r.tSwitch
    x.zSwitch = r.xSwitch ? socOf(r.xSwitch[0]) : null
    x.tEnd = p.tEnd
    x.trace = cccvTrace(r, p)
    x.reached = r.tSwitch !== null
  } else if (exp.mode === 'round') {
    const r = roundTrip(b, { i: p.i, t: p.tEnd, z0 })
    x.round = r
    x.tEnd = 2 * p.tEnd
    x.trace = roundTrace(r, p)
  } else {
    const tr = pulse(b, { i: p.i, tEnd: p.tEnd, z0, points: p.points || 1201 })
    x.tr = tr
    x.tEnd = p.tEnd
    x.heat = heat(tr)
    x.out = terminalEnergy(tr, p.i)
    x.settledDrop = p.i * rDC(b)
    x.stepDrop = p.i * b.R0
    x.trace = pulseTrace(tr, p.i)
  }
  x.cursor = p.cursor ?? x.tEnd
  x.at = readBattery(x, x.cursor)
  return x
}

/** The terminal, the current and the state of charge at a time, on whichever run holds it. */
export function readBattery(x, t) {
  if (x.mode === 'cccv' || x.cv !== undefined) {
    if (x.tSwitch !== null && t > x.tSwitch) {
      const s = x.cv.at(t - x.tSwitch)
      return { t, v: s.sol.v.t, i: -s.sol.i.Vt, z: socOf(s.x[0]) }
    }
    const s = x.cc.at(Math.min(t, x.tSwitch ?? t))
    return { t, v: s.sol.v.t, i: -s.sol.i.Iload, z: socOf(s.x[0]) }
  }
  if (x.round) {
    const half = x.tEnd / 2
    const tr = t <= half ? x.round.out : x.round.back
    const s = tr.at(t <= half ? t : t - half)
    return { t, v: s.sol.v.t, i: s.sol.i.Iload, z: socOf(s.x[0]) }
  }
  const s = x.tr.at(Math.min(t, x.tEnd))
  return { t, v: s.sol.v.t, i: s.sol.i.Iload, z: socOf(s.x[0]) }
}

const traceFrom = (tr, sign, t0 = 0) =>
  tr.samples.map((s) => ({ t: t0 + s.t, v: s.sol.v.t, i: sign * s.sol.i.Iload, z: socOf(s.x[0]) }))

const pulseTrace = (tr) => traceFrom(tr, 1)

const roundTrace = (r, p) => [...traceFrom(r.out, 1), ...traceFrom(r.back, 1, p.tEnd)]

function cccvTrace(r, p) {
  const cc = r.cc.samples
    .filter((s) => r.tSwitch === null || s.t <= r.tSwitch)
    .map((s) => ({ t: s.t, v: s.sol.v.t, i: -s.sol.i.Iload, z: socOf(s.x[0]) }))
  if (r.tSwitch === null) return cc
  const cv = r.cv.samples.map((s) => ({ t: r.tSwitch + s.t, v: s.sol.v.t, i: -s.sol.i.Vt, z: socOf(s.x[0]) }))
  return [...cc, ...cv]
}

/**
 * What one hour of the day could not do, in a word. `toBank` is the energy
 * the bank actually took or gave over the hour, and `net` is the power the
 * hour had spare or short, so the two are compared over the hour's own 3600
 * seconds. An hour that moved everything it had returns the empty string.
 */
export function shortfallOf(r) {
  const wanted = r.net * 3600
  if (r.net > 0 && r.toBank < wanted - 1e-6) return 'curtailed'
  if (r.net < 0 && r.toBank > wanted + 1e-6) return 'unserved'
  return ''
}

/** The day, with the bank size as the knob. */
function analyseDay(exp, p) {
  const b = { ...BATTERY_DEFAULTS }
  const c = { ...CELL_DEFAULTS }
  const over = { ...BUS_DEFAULTS }
  for (const k of ['modules', 'cellsPerModule', 'bankSeries', 'bankParallel', 'z0']) if (p[k] !== undefined) over[k] = p[k]
  const g = memo(`day${JSON.stringify(over)}`, () => day(c, b, over))
  const peakPv = g.rows.reduce((a, r) => (r.pv > a.pv ? r : a))
  const peakLoad = g.rows.reduce((a, r) => (r.load > a.load ? r : a))
  return {
    kind: 'day',
    c,
    b,
    over,
    g,
    peakPv,
    peakLoad,
    zLow: g.rows.reduce((a, r) => Math.min(a, r.z), 1),
    zHigh: g.rows.reduce((a, r) => Math.max(a, r.z), 0),
    served: (g.eLoad - g.unserved) / g.eLoad,
    at: g.rows[p.hour ?? 12],
    hour: p.hour ?? 12,
  }
}

// ------------------------------------------------------------ reading

const KWH = 3.6e6

/**
 * Read one quantity of an analysis by the path the brief's §4 lists. Every
 * `reads` pair in a lesson names one of these, and `experiments.test.js` fails
 * on a path this does not know.
 */
export function readQuantity(x, p, path, exp) {
  const [head, ...rest] = path.split('.')
  switch (head) {
    case 'pv':
      if (rest[0] === 'voc_formula') return x.formulas.voc
      if (['v', 'i', 'p', 'iters'].includes(rest[0])) return x.at[rest[0]]
      if (rest[0] === 'share') return x.share
      if (rest[0] === 'rect') return x.formulas.rect
      if (rest[0] === 'decade') return x.formulas.decade
      if (rest[0] === 'halving') return x.formulas.halving
      if (rest[0] === 'is') return x.formulas.is
      if (rest[0] === 'vt') return x.formulas.vt
      if (rest[0] === 'slope') return shuntSlope(x)
      if (x.fig[rest[0]] !== undefined) return x.fig[rest[0]]
      break
    case 'cell': {
      const row = x.cells[+rest[0]]
      if (!row) break
      if (rest[1] === 'p') return row.v * x.at.i
      return row[rest[1]]
    }
    case 'bypass': {
      const row = x.cells[+rest[0]]
      if (!row || !row.bypass) break
      return row.bypass[rest[1]]
    }
    case 'mppt':
      if (rest[0] === 'reversal') return x.reversal
      if (rest[0] === 'settled') return x.settled.mean
      if (rest[0] === 'swing') return x.settled.swing
      if (rest[0] === 'share') return x.share
      if (rest[0] === 'shortfall') return 1 - x.share
      break
    case 'buck':
      if (rest[0] === 'rin') return x.rin
      if (rest[0] === 'vout') return x.buck.m.sig.vout.avg
      if (rest[0] === 'pout') return x.buck.m.Pout
      if (rest[0] === 'iinModel') return x.buck.iinModel
      if (rest[0] === 'iinSwitched') return x.buck.iinSwitched
      if (rest[0] === 'D') return x.duty.D
      break
    case 'batt':
      if (['v', 'i', 'z'].includes(rest[0])) return x.at[rest[0]]
      if (rest[0] === 'ocv') return ocv(x.at.z)
      if (rest[0] === 'rest') return x.ocv0
      if (rest[0] === 'heat') return x.heat
      if (rest[0] === 'out') return x.out
      if (rest[0] === 'cq') return x.cq
      if (rest[0] === 'rdc') return x.rdc
      if (rest[0] === 'tau1') return x.tau1
      if (rest[0] === 'tau2') return x.tau2
      if (rest[0] === 'step') return x.stepDrop
      if (rest[0] === 'settled') return x.settledDrop
      if (rest[0] === 'tSwitch') return x.tSwitch
      if (rest[0] === 'zSwitch') return x.zSwitch
      if (rest[0] === 'eta') return x.round.eta
      if (rest[0] === 'eIn') return x.round.eIn
      if (rest[0] === 'eOut') return x.round.eOut
      if (rest[0] === 'heatIn') return x.round.heatIn
      if (rest[0] === 'heatOut') return x.round.heatOut
      break
    case 'day': {
      if (rest.length === 2) {
        const row = x.g.rows[+rest[0]]
        if (row) return row[rest[1]]
        break
      }
      const g = x.g
      if (['eIn', 'eLoad', 'curtailed', 'unserved', 'lost', 'stored'].includes(rest[0])) return g[rest[0]] / KWH
      if (rest[0] === 'zEnd') return g.zEnd
      if (rest[0] === 'residual') return g.residual
      if (rest[0] === 'served') return x.served
      if (rest[0] === 'peakPv') return x.peakPv.pv
      if (rest[0] === 'peakLoad') return x.peakLoad.load
      if (rest[0] === 'bankE') return g.bankE / KWH
      if (rest[0] === 'bankV') return g.bankV
      if (rest[0] === 'bankQ') return g.bankQ / 3600
      break
    }
    default:
      break
  }
  throw new Error(`unknown quantity path ${path}`)
}

/**
 * The slope of the I–V curve just above the short circuit, which is −1/R_sh
 * once the junction has stopped carrying anything. Two exact solves, a tenth
 * of a volt apart, so the number is the curve's and not a fit's.
 */
export function shuntSlope(x) {
  const a = powerAt(x.c, x.s, 0.05 * (x.c.Ns || 1))
  const b = powerAt(x.c, x.s, 0.15 * (x.c.Ns || 1))
  return (b.i - a.i) / (b.v - a.v)
}

/**
 * Every local maximum of the P–V curve, in order of voltage.
 *
 * The scan finds which brackets hold one, and `refine` then finds where in
 * the bracket it is. Without that second step a hump's voltage is the nearest
 * of 121 sample points, which on B5's lower hump is a tenth of a volt out —
 * a reading off the grid rather than off the model. `refine(a, b)` maximises
 * the power over a bracket of the current and returns the point.
 */
export function humps(curve, refine = null) {
  // Current-ascending, which is the order the sweep solved them in.
  const pts = [...curve].sort((a, b) => a.i - b.i)
  const out = []
  for (let k = 1; k < pts.length - 1; k++) {
    if (pts[k].p > pts[k - 1].p && pts[k].p >= pts[k + 1].p) {
      out.push(refine ? refine(pts[k - 1].i, pts[k + 1].i) : pts[k])
    }
  }
  return out.sort((a, b) => a.v - b.v)
}

/**
 * Golden-section maximisation of the power over a bracket of the current,
 * every point of it an exact solve. `physics.js` does the same for the one
 * maximum a lit array has; this is the same search over a bracket the scan
 * chose, so a shaded array's second hump is as exact as its first.
 */
function refineHump(c, s, a, b) {
  const opts = optsOf(s)
  const f = (I) => atI(c, I, opts)
  const phi = (Math.sqrt(5) - 1) / 2
  let lo = a
  let hi = b
  let c1 = hi - phi * (hi - lo)
  let c2 = lo + phi * (hi - lo)
  let f1 = f(c1)
  let f2 = f(c2)
  for (let k = 0; k < 60 && hi - lo > 1e-12 * (b - a + 1); k++) {
    if (f1.p > f2.p) {
      hi = c2
      c2 = c1
      f2 = f1
      c1 = hi - phi * (hi - lo)
      f1 = f(c1)
    } else {
      lo = c1
      c1 = c2
      f1 = f2
      c2 = lo + phi * (hi - lo)
      f2 = f(c2)
    }
  }
  const best = f1.p > f2.p ? f1 : f2
  return { v: best.v, i: best.i, p: best.p, iters: best.iters }
}

/** The refined humps of one array, memoised: the search costs about ninety solves. */
export const humpsOf = (c, s, n = 121) =>
  memo(`hump${keyOf(c, s)}|${n}`, () => humps(curveOf(c, s, n), (a, b) => refineHump(c, s, a, b)))
