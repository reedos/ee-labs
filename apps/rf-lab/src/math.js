// One analysis per experiment, and every view and every lesson reads from it.
//
// `analyse(exp, p)` dispatches on the experiment's `kind` and returns an object
// whose shape is fixed per kind. Nothing in the app calls the engine directly.
// That is what makes `experiments.test.js` able to recompute every number a
// lesson quotes: it calls the same function with the same settings.
//
// Seven kinds carry groups A to D. A `mismatch` is a load against a reference
// impedance, with nothing between them. A `chart` is the families themselves. A
// `line` is a length of transmission line with a load on the far end. A `match`
// is an L network synthesised for one pair of impedances, and a `qwave` is the
// line that makes the same transformation. A `wave` is a load read as an
// incident and a reflected wave, and a `twoport` is a circuit described by its
// scattering matrix.

import * as R from '@ee-labs/rf'

/**
 * The analysis for one experiment at one set of knob values.
 *
 * Every return carries `kind`, `exp`, `p` and a `headline`, which is the one
 * number the experiment is about with its unit and its label. The rest depends
 * on the kind, and `readQuantity` in lessons.js knows the paths.
 */
export function analyse(exp, p) {
  const fn = KINDS[exp.kind]
  if (!fn) throw new Error(`No analysis for kind ${exp.kind} (experiment ${exp.id})`)
  let out
  try {
    out = { kind: exp.kind, exp, p, ...fn(exp, p) }
  } catch (err) {
    if (err && err.name === 'RfError') return declined(exp, p, err)
    throw err
  }
  return { ...out, headline: exp.headline(out, p) }
}

/**
 * A setting the engine will not describe.
 *
 * A load equal to the negative of the reference impedance has no reflection
 * coefficient, and no passive circuit builds one. The app shows the engine's
 * own sentence where the headline would be, rather than the last answer that
 * happened to work, so a knob taken past what an object allows reads as a
 * refusal and not as a number.
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
  mismatch: analyseMismatch,
  chart: analyseChart,
  line: analyseLine,
  match: analyseMatch,
  qwave: analyseQuarterWave,
  wave: analyseWave,
  twoport: analyseTwoPort,
}

/** The load a `mismatch` or a `line` experiment is terminated in. */
const loadOf = (p) => (p.RL === 0 && p.XL === 0 ? 0 : [p.RL, p.XL])

/**
 * The window a sweep is drawn over, for an experiment whose frequency knob is
 * the frequency the circuit is designed at.
 *
 * The experiment states the window at its own default frequency, and the
 * window follows the knob from there. A matching network is synthesised again
 * at whatever frequency is set, so its whole response moves with the knob. A
 * window that stayed where it was would carry the band off the plot: C3 set to
 * 2.000 GHz has its upper edge at 2.512 GHz, and the window written for
 * 1.000 GHz stops at 2.200 GHz. `REVIEW_PLAYBOOK.md` §4 asks a range to hold
 * still while components are tuned and to re-frame on a circuit change, and
 * the design frequency is a circuit change here.
 */
function designWindow(exp, p) {
  if (!exp.sweep) return { from: p.f / 4, to: p.f * 4 }
  const knob = exp.params.find((k) => k.key === 'f')
  const f0 = knob ? knob.default : p.f
  const scale = Number.isFinite(p.f) && f0 > 0 ? p.f / f0 : 1
  return { from: exp.sweep.from * scale, to: exp.sweep.to * scale }
}

// ------------------------------------------------------------------ group A

function analyseMismatch(exp, p) {
  const z0 = p.z0
  const ZL = loadOf(p)
  const m = R.mismatch(ZL, z0)
  const place = R.place(ZL, z0)
  // The normalised admittance, which is what the second half of group B reads.
  // A short has no finite admittance, and that is spelled rather than clamped.
  const y = invert(place.z)
  const out = { z0, ZL, m, place, y }

  // B1's landmarks: the points every reader looks for, each mapped by the same
  // closed form and carried so a test can check them all at once.
  if (exp.landmarks) {
    out.landmarks = exp.landmarks.map((l) => {
      const at = R.place(l.ZL === Infinity ? Infinity : Array.isArray(l.ZL) ? [l.ZL[0] * z0, l.ZL[1] * z0] : l.ZL * z0, z0)
      return { name: l.name, ...at }
    })
  }

  // B4's shunt element: adding susceptance to the admittance moves the point
  // along one constant-conductance circle, and how far off that circle it lands
  // is the measurement.
  if (p.b !== undefined) {
    const moved = [y[0], y[1] + p.b]
    const gammaY = R.zToGamma(moved)
    const gammaZ = [-gammaY[0], -gammaY[1]]
    out.shunt = {
      y: moved,
      gamma: gammaZ,
      mag: Math.hypot(gammaZ[0], gammaZ[1]),
      deg: (Math.atan2(gammaZ[1], gammaZ[0]) * 180) / Math.PI,
    }
    out.gCircle = R.conductanceCircle(y[0])
    out.offCircle = R.circleError(out.gCircle, gammaZ)
  }
  return out
}

/** 1/z for a normalised impedance, with the open and the short as their own cases. */
function invert(z) {
  if (z === Infinity) return [0, 0]
  const d = z[0] * z[0] + z[1] * z[1]
  if (d === 0) return Infinity
  return [z[0] / d, -z[1] / d]
}

// ------------------------------------------------------------------ group B

function analyseChart(exp, p) {
  const circles = {
    r: R.resistanceCircle(p.r),
    x: R.reactanceCircle(p.x),
    g: R.conductanceCircle(p.r),
    b: R.susceptanceCircle(p.x),
  }
  const z = [p.r, p.x]
  const gamma = R.zToGamma(z)
  return {
    z0: p.z0,
    z,
    gamma,
    circles,
    // How far the point lands from each of the two circles it is supposed to
    // sit on. Both are zero, and the test is what says so.
    onCircle: {
      r: R.circleError(circles.r, gamma),
      x: R.circleError(circles.x, gamma),
    },
    families: R.chartFamilies({ mode: 'impedance' }),
  }
}

// -------------------------------------------------------------- the line

function analyseLine(exp, p) {
  const line = R.uniformLine({ Z0: p.z0line, epsr: p.epsr, len: p.len, alpha: p.alpha })
  const ZL = loadOf(p)
  const el = R.electricalLength(line, p.f)
  const zin = R.inputImpedance(line, ZL, p.f)
  const load = R.mismatch(ZL, p.z0line)
  const source = R.mismatch(zin.Z, p.z0line)
  const wave = R.standingWave(line, ZL, p.f, { points: 161 })
  const repeat = R.repeatFrequency(line, p.f)
  const handOver = R.rationalAvailable(line, p.f)
  const sweepRange = exp.sweep || { from: p.f / 4, to: p.f * 4 }
  const sweep = R.sweepLine(line, ZL, {
    from: sweepRange.from,
    to: sweepRange.to,
    points: p.points || 121,
    z0: p.z0line,
  })
  // What a length of line does on the chart: a rotation of twice beta times the
  // length, clockwise, shrinking by exp(-2 alpha l) when the line loses energy.
  const turn = {
    deg: (2 * el.beta * p.len * 180) / Math.PI,
    perMetre: (2 * el.beta * 180) / Math.PI,
    shrink: Math.exp(-2 * p.alpha * p.len),
  }
  const locus = R.lineLocus(load.gamma, { beta: el.beta, alpha: p.alpha, length: p.len, steps: 96 })
  return {
    line,
    ZL,
    el,
    zin,
    load,
    source,
    wave,
    repeat,
    handOver,
    sweep,
    sweepRange,
    turn,
    locus,
    place: R.place(ZL, p.z0line),
    placeIn: R.place(zin.Z, p.z0line),
    vswrCircle: R.vswrCircle(load.vswr === Infinity ? 1e6 : load.vswr),
    loss: {
      alphaDb: R.dbPerMetre(p.alpha),
      oneWay: R.dbPerMetre(p.alpha * p.len),
      roundTrip: R.dbPerMetre(2 * p.alpha * p.len),
    },
    delay: p.len / el.vp,
  }
}

// ------------------------------------------------------------- what the app reads

/**
 * The declined hand-over, as a sentence for the pane.
 *
 * A5's refusal is not a refusal of the analysis. The sweep is exact and the
 * picture is drawn. What is declined is the hand-over to the rational core, and
 * the message sits under the plot rather than in a tooltip, because that is
 * where a reader looking for a pole-zero view will be looking.
 */
export function refusalOf(x) {
  if (x.declined) return x.declined.says
  if (x.handOver && !x.handOver.ok) return x.handOver.says
  // A description a two-port does not have is the same kind of statement. The
  // ideal transformer has a finite S-matrix and no Z-matrix, and D3 is the
  // experiment where that sentence is the content.
  if (x.conv && x.conv.missing.length) return x.conv.missing[0].says
  return null
}

/** Nothing in groups A to D ships an approximation, so nothing in them carries a guard. */
export const guardOf = () => null

// ------------------------------------------------------------------ group C

/**
 * A matching network: the synthesis, the network it produces, and what that
 * network reads against frequency.
 *
 * Nothing here searches. `lMatch` solves two equations in two unknowns and
 * this function reads the answer, so every element value on screen is a closed
 * form of the two resistances and the frequency.
 */
function analyseMatch(exp, p) {
  const ZL = p.XL ? [p.RL, p.XL] : p.RL
  const design = R.lMatch({ RS: p.RS, ZL, f: p.f, pick: p.pick })
  const sol = design.chosen
  const at = design.at
  const m = R.mismatch(at.Z, p.RS)
  const bw = R.matchBandwidth(sol, ZL, p.RS, p.f, { vswr: p.target ?? 1.5 })
  const sweepRange = designWindow(exp, p)
  const sweep = R.sweepMatch(sol, ZL, p.RS, { from: sweepRange.from, to: sweepRange.to, points: p.points || 161 })
  return {
    z0: p.RS,
    ZL,
    design,
    solutions: design.solutions,
    chosen: sol,
    element: elementsByPlace(sol.elements),
    cancel: design.cancel,
    m,
    zin: { Z: at.Z },
    at,
    bw,
    // The fractional bandwidth a single resonance of this loaded Q would have,
    // which is the figure the synthesis predicts before anything is measured.
    oneOverQ: R.loadedQBandwidth(design.Q),
    // A lumped network's response does not repeat, which is the difference C4's
    // line makes visible. The sweep pane says so rather than drawing repeat
    // lines that are not there.
    repeat: null,
    sweep,
    sweepRange,
    arcs: R.matchPath(sol, ZL, p.RS),
    // Every arrangement's reading at the design frequency and at twice it, so
    // C2 can say that the two that match here differ there without needing a
    // second analysis.
    away: design.solutions.map((s) => ({
      id: s.id,
      ok: s.ok,
      says: s.says,
      elements: s.elements,
      here: s.ok ? R.matchMag(s, ZL, p.RS, p.f) : null,
      twice: s.ok ? R.matchMag(s, ZL, p.RS, 2 * p.f) : null,
    })),
    count: design.solutions.filter((s) => s.ok).length,
    // Where the arrangements are compared, which is one octave above the
    // design frequency. A lesson that quotes a reading there names the
    // frequency it was taken at.
    awayAt: 2 * p.f,
  }
}

/** The elements of a network by where they sit, so a lesson can name one. */
function elementsByPlace(elements) {
  const out = {}
  for (const el of elements) if (!out[el.place]) out[el.place] = el
  return out
}

/**
 * The quarter-wave transformer, and the L network it is measured against.
 *
 * Both bandwidths are read off exact responses by the same bisection, so C4's
 * claim that the line is the wider of the two is a comparison of two
 * measurements rather than of two formulas.
 */
function analyseQuarterWave(exp, p) {
  const qw = R.quarterWaveMatch({ RS: p.RS, RL: p.RL, f0: p.f, epsr: p.epsr })
  const at = qw.at(p.f)
  const m = R.mismatch(at.Z, p.RS)
  const target = p.target ?? 1.2222
  const bw = R.bandwidthOf(qw.read, p.f, { vswr: target, span: 1.99 })
  const lumped = R.lMatch({ RS: p.RS, ZL: p.RL, f: p.f })
  const lumpedBw = R.matchBandwidth(lumped.chosen, p.RL, p.RS, p.f, { vswr: target })
  const sweepRange = designWindow(exp, p)
  const sweep = R.sweepQuarterWave(qw, { from: sweepRange.from, to: sweepRange.to, points: p.points || 201 })
  const el = R.electricalLength(qw.line, p.f)
  return {
    z0: p.RS,
    ZL: p.RL,
    qw,
    el,
    m,
    zin: { Z: at.Z },
    at,
    bw,
    lumped,
    lumpedBw,
    wider: bw.fractional / lumpedBw.fractional,
    repeat: R.repeatFrequency(qw.line, p.f),
    repeats: R.quarterWaveRepeats(p.f, sweepRange.to),
    sweep,
    sweepRange,
    path: R.transformerPath(qw, p.f),
    delay: qw.len / el.vp,
  }
}

// ------------------------------------------------------------------ group D

/**
 * A load read as a wave rather than as an impedance.
 *
 * The reflection comes back two ways. `reflection` evaluates the closed form,
 * and `s11FromNetlist` drives the load through the reference impedance and
 * solves the circuit. D1's claim is that the two are one number, so both are
 * computed and their difference is carried.
 */
function analyseWave(exp, p) {
  const z0 = p.z0
  const ZL = p.XL ? [p.RL, p.XL] : p.RL
  const m = R.mismatch(ZL, z0)
  const place = R.place(ZL, z0)
  const solved = R.s11FromNetlist(onePortNetlist(p.RL, p.XL, p.f), 'p1', p.f, { z0 })
  const scale = Math.max(1e-30, m.mag)
  return {
    z0,
    ZL,
    m,
    place,
    y: invert(place.z),
    solved,
    solvedMag: Math.hypot(solved[0], solved[1]),
    // Two routes, one number: the closed form and the MNA solve, apart by this
    // fraction of what they measure.
    agree: Math.hypot(solved[0] - m.gamma[0], solved[1] - m.gamma[1]) / scale,
    waves: {
      // With a one-volt source through Z0 the incident wave is fixed, so the
      // returning one is the incident one times Γ. Both are printed, because
      // D1 is the experiment that says what a wave is.
      a: 1 / (2 * Math.sqrt(z0)),
      b: m.mag / (2 * Math.sqrt(z0)),
    },
  }
}

/** A load as a circuit: its resistance, and the component that has its reactance here. */
function onePortNetlist(RL, XL, f) {
  // A reactance below a nanoohm is a wire at any frequency this lab reaches,
  // and a component of that reactance is a component the node equations cannot
  // solve for. The resistance alone is the circuit there.
  if (!XL || Math.abs(XL) < 1e-9) return { elements: [{ type: 'R', id: 'RL', nodes: ['p1', 'gnd'], value: RL }] }
  const w = 2 * Math.PI * f
  const part = XL > 0 ? { type: 'L', value: XL / w } : { type: 'C', value: 1 / (w * -XL) }
  return {
    elements: [
      { type: 'R', id: 'RL', nodes: ['p1', 'nx'], value: RL },
      { type: part.type, id: 'XL', nodes: ['nx', 'gnd'], value: part.value },
    ],
  }
}

/**
 * A two-port, described by its scattering matrix and by every other
 * description that exists for it.
 *
 * The experiment's own `build` returns the S-matrix and, where a second route
 * to the same matrix exists, that route as well. A route shares no arithmetic
 * with the first: a circuit solved by the MNA solver against the same
 * circuit's chain matrix, or the closed composition of two blocks against the
 * product of their chain matrices. Their disagreement is a measurement, and it
 * is what D2 and D4 quote.
 */
function analyseTwoPort(exp, p) {
  const z0 = p.z0
  const f = p.f
  const built = exp.build(p, f)
  const sp = built.sp
  const routes = (built.routes || []).map((r) => ({ label: r.label, diff: R.sDiff(sp, r.sp), sp: r.sp }))
  const s = {
    11: R.entryOf(sp, 0, 0),
    12: R.entryOf(sp, 0, 1),
    21: R.entryOf(sp, 1, 0),
    22: R.entryOf(sp, 1, 1),
  }
  const sweepRange = exp.sweep || { from: f / 4, to: f * 4 }
  return {
    z0,
    sp,
    built,
    s,
    routes,
    agree: routes.length ? Math.max(...routes.map((r) => r.diff)) : 0,
    conv: conversionsOf(sp),
    power: {
      sum: s[11].mag ** 2 + s[21].mag ** 2,
      dissipated: R.dissipated(sp),
      reciprocity: R.reciprocityError(sp),
      unitarity: R.unitarityError(sp),
      largest: R.largestSingular(sp),
    },
    place: { gamma: sp.s[0][0], mag: s[11].mag, deg: s[11].deg },
    trace: traceOf(exp, p, sweepRange),
    sweepRange,
  }
}

/** The four entries against frequency, each one an exact rebuild of the circuit. */
function traceOf(exp, p, range) {
  const points = p.points || 81
  const out = []
  for (let k = 0; k < points; k++) {
    const f = range.from + ((range.to - range.from) * k) / (points - 1)
    const sp = exp.build(p, f).sp
    out.push({
      f,
      11: R.entryOf(sp, 0, 0),
      12: R.entryOf(sp, 0, 1),
      21: R.entryOf(sp, 1, 0),
      22: R.entryOf(sp, 1, 1),
    })
  }
  return out
}

/**
 * Which of the four descriptions this two-port has, and the round trip through
 * the ones it does.
 *
 * A description that does not exist is a refusal with a reason rather than a
 * large number, which is `CORE_SCOPE.md` Rule 2 where a reader meets it. An
 * ideal transformer has a finite S-matrix and neither a Z-matrix nor a
 * Y-matrix. A two-port with no path through it has no chain matrix.
 */
function conversionsOf(sp) {
  const tryOne = (fn) => {
    try {
      return { ok: true, M: fn() }
    } catch (err) {
      if (err && err.name === 'RfError') return { ok: false, says: err.message }
      throw err
    }
  }
  const z = tryOne(() => R.sToZ(sp.s, sp.z0))
  const y = tryOne(() => R.sToY(sp.s, sp.z0))
  const abcd = tryOne(() => R.sToAbcd(sp.s, sp.z0))
  const have = [
    ['S', { ok: true }],
    ['Z', z],
    ['Y', y],
    ['ABCD', abcd],
  ]
  // The plan's round trip is S to Z to ABCD to Y to S, and it runs only when
  // every description it passes through exists.
  let roundTrip = {
    ok: false,
    error: NaN,
    says: 'This two-port does not have every description the round trip passes through, so there is no round trip to measure.',
  }
  if (z.ok && y.ok && abcd.ok) {
    const viaAbcd = R.abcdToS(R.sToAbcd(R.zToS(z.M, sp.z0), sp.z0), sp.z0)
    const back = R.yToS(R.zToY(R.sToZ(viaAbcd, sp.z0)), sp.z0)
    roundTrip = { ok: true, error: R.mdiff(back, sp.s), says: '' }
  }
  return {
    z,
    y,
    abcd,
    roundTrip,
    count: have.filter(([, d]) => d.ok).length,
    names: have.filter(([, d]) => d.ok).map(([n]) => n),
    missing: have.filter(([, d]) => !d.ok).map(([n, d]) => ({ name: n, says: d.says })),
  }
}
