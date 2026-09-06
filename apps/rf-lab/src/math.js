// One analysis per experiment, and every view and every lesson reads from it.
//
// `analyse(exp, p)` dispatches on the experiment's `kind` and returns an object
// whose shape is fixed per kind. Nothing in the app calls the engine directly.
// That is what makes `experiments.test.js` able to recompute every number a
// lesson quotes: it calls the same function with the same settings.
//
// Three kinds carry groups A and B. A `mismatch` is a load against a reference
// impedance, with nothing between them. A `chart` is the families themselves. A
// `line` is a length of transmission line with a load on the far end.

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
}

/** The load a `mismatch` or a `line` experiment is terminated in. */
const loadOf = (p) => (p.RL === 0 && p.XL === 0 ? 0 : [p.RL, p.XL])

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
export const refusalOf = (x) => (x.declined ? x.declined.says : x.handOver && !x.handOver.ok ? x.handOver.says : null)

/** Nothing in groups A and B ships an approximation, so nothing in them carries a guard. */
export const guardOf = () => null
