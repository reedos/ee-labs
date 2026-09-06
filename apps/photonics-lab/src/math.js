// One analysis per experiment, and every view and every lesson reads from it.
//
// `analyse(exp, p)` dispatches on the experiment's `kind` and returns an object
// whose shape is fixed per kind. Nothing in the app calls the engine directly.
// That is what makes `experiments.test.js` able to recompute every number a
// lesson quotes: it calls this function with the same settings.
//
// Every analysis carries `at(over)`, which re-runs itself with some knobs
// changed. A curve is drawn by calling it once per sample, so a plotted line is
// the same engine the headline came from and not a second expression of it.
//
// Two unit conversions live here and nowhere else. Attenuation is entered in
// decibels a kilometre, which the engine takes directly. The dispersion
// parameter is entered in picoseconds per nanometre per kilometre, which is
// 1e-6 seconds per square metre, and `PS_NM_KM` is that factor.

import * as P from '@ee-labs/photonics'

/** One picosecond per nanometre per kilometre, in seconds per square metre. */
export const PS_NM_KM = 1e-6

/**
 * The analysis for one experiment at one set of knob values.
 *
 * Every return carries `kind`, `exp`, `p`, `at` and a `headline`, which is the
 * one number the experiment is about with its unit and its label. The rest
 * depends on the kind, and `readQuantity` in lessons.js knows the paths.
 */
export function analyse(exp, p) {
  const fn = KINDS[exp.kind]
  if (!fn) throw new Error(`No analysis for kind ${exp.kind} (experiment ${exp.id})`)
  try {
    const body = fn(exp, p)
    const x = { kind: exp.kind, exp, p, ...body }
    x.at = (over) => analyse(exp, { ...p, ...over })
    x.headline = exp.headline(x, p)
    return x
  } catch (err) {
    if (err && err.name === 'PhotonicsError') return declined(exp, p, err)
    throw err
  }
}

/**
 * A setting the engine will not describe.
 *
 * A cladding index above the core's is not clamped back into a fibre that
 * guides. It is a different object, and `numericalAperture` throws a message
 * naming the index and what it must be. The app shows that sentence where the
 * headline would be, rather than the last answer that happened to work.
 */
function declined(exp, p, err) {
  const x = {
    kind: exp.kind,
    exp,
    p,
    declined: { says: err.message, field: err.field },
    headline: { value: NaN, unit: '', label: 'Declined' },
  }
  x.at = (over) => analyse(exp, { ...p, ...over })
  return x
}

/** The refusal an experiment is showing, or null. */
export const refusalOf = (x) => (x && x.declined ? x.declined.says : x && x.refusal ? x.refusal : null)

/** The guard an experiment is showing, or null. Nothing in this sitting carries one. */
export const guardOf = (x) => (x && x.guard) || null

const KINDS = {
  detector: analyseDetector,
  fibre: analyseFibre,
  link: analyseLink,
  cavity: analyseCavity,
  channels: analyseChannels,
}

// ------------------------------------------------------------------ detector

/**
 * Group A. The photon's own numbers, the responsivity, the solved photodiode,
 * and the area-to-speed trade.
 *
 * The photodiode is solved whenever the experiment carries a bias and a load.
 * A1 and A3 have neither, because neither is about a circuit, and their
 * analyses carry no `pd`.
 */
function analyseDetector(exp, p) {
  const lambda = p.lambda ?? 1550e-9
  const eta = p.eta ?? 1
  const eg = p.eg ?? null
  const photon = P.photonEnergy(lambda)
  const out = {
    // The constant every conversion in this group passes through, in the units
    // a reader carries it in: hc/q is 1.23984 electronvolt micrometres.
    hc: P.HC_EV * 1e6,
    photon: { ...photon, flux: p.power === undefined ? null : P.photonFlux(p.power, lambda) },
    R: P.responsivity({ eta, lambda, eg }),
    cutoff: eg === null ? Infinity : P.cutoffWavelength(eg),
  }
  if (p.bias !== undefined && p.load !== undefined && p.power !== undefined) {
    const spec = { bias: p.bias, load: p.load, dark: p.dark, eta, lambda, eg, power: p.power }
    out.pd = P.photodiode(spec)
    out.level = out.R > 0 ? P.darkEqualsLight({ eta, lambda, eg, dark: p.dark }) : Infinity
  }
  if (p.d !== undefined) {
    const speed = P.detectorSpeed({ d: p.d, load: p.load, bias: p.bias })
    out.speed = { ...speed, collected: P.collectedPower({ d: p.d, irradiance: p.irradiance }) }
  }
  return out
}

// --------------------------------------------------------------------- fibre

/**
 * Groups E1 to E4. Whatever the experiment's knobs reach: the attenuation over
 * the span, the pulse spread and its beta_2, the rate the spread allows, and
 * the step-index geometry.
 */
function analyseFibre(exp, p) {
  const out = {}
  const lambda = p.lambda ?? 1550e-9
  if (p.alphaDb !== undefined) {
    out.att = P.powerAfter({ alphaDb: p.alphaDb, length: p.length, power: p.power ?? 1e-3 })
  }
  if (p.D !== undefined) {
    const D = p.D * PS_NM_KM
    const b2 = P.beta2({ D, lambda })
    // beta_2 in base units is 1e-26 s^2/m, which no datasheet writes. The pane
    // and the lessons quote picoseconds squared a kilometre, so that number is
    // carried beside it rather than converted twice.
    out.disp = { ...P.dispersion({ D, length: p.length, dLambda: p.dLambda }), beta2: b2, beta2ps: b2 * 1e27 }
    const criterion = p.criterion ?? P.BANDWIDTH_CRITERION
    out.limit =
      out.disp.spread > 0
        ? { ...P.bandwidthLimit({ spread: out.disp.spread, criterion }), ...P.bandwidthDistance({ D, dLambda: p.dLambda, criterion }) }
        : { rate: Infinity, product: Infinity, criterion, text: P.CRITERION_TEXT, spread: 0 }
  }
  if (p.n1 !== undefined) {
    const na = P.numericalAperture({ n1: p.n1, n2: p.n2 })
    const v = P.vNumber({ a: p.a, na: na.na, lambda })
    const single = P.singleModeDiameter({ na: na.na, lambda })
    out.geo = { ...na, v, single, singleRadius: single / 2, vLimit: P.V_SINGLE_MODE, ...P.modeCount(v) }
  }
  return out
}

// ---------------------------------------------------------------------- link

/**
 * E5. The budget as a sum of named line items, both reaches, and which of them
 * binds. Every loss the model does not include is a line item set to zero, so a
 * zero on the waterfall is a decision a reader can see.
 */
function analyseLink(exp, p) {
  const fibre = P.attenuation({ alphaDb: p.alphaDb, length: p.length })
  const items = [
    { name: 'Fibre', db: fibre.db },
    { name: 'Connectors', db: p.connectors },
    { name: 'Splices', db: p.splices },
    { name: 'Dispersion penalty', db: p.penalty },
    { name: 'Modal noise', db: 0 },
    { name: 'Reflection penalty', db: 0 },
    { name: 'Mode-partition noise', db: 0 },
  ]
  const budget = P.linkBudget({ txDbm: p.txDbm, items, sensitivityDbm: p.sensitivityDbm })
  const fixed = p.connectors + p.splices + p.penalty
  const D = p.D * PS_NM_KM
  const dispersionLength = P.dispersionReach({ D, dLambda: p.dLambda, rate: p.rate })
  const out = { budget, fibre, fixed, dispersionLength }
  try {
    const loss = P.lossReach({
      txDbm: p.txDbm,
      sensitivityDbm: p.sensitivityDbm,
      fixedDb: fixed,
      marginDb: p.reserve,
      alphaDb: p.alphaDb,
    })
    out.reach = { ...loss, dispersion: dispersionLength, ...P.bindingLimit({ loss: loss.length, dispersionLength }) }
  } catch (err) {
    if (!err || err.name !== 'PhotonicsError') throw err
    // A budget the fixed items already spend is a real setting and not a crash.
    // The waterfall still draws, and the reach reads as the refusal it is.
    out.reach = { forFibre: 0, length: 0, dispersion: dispersionLength, binds: 'loss', reach: 0 }
    out.refusal = err.message
  }
  return out
}

// -------------------------------------------------------------------- cavity

/** F1. The Airy curve, its three numbers, the facet the default came from, and the refusal. */
function analyseCavity(exp, p) {
  const spec = { n: p.n, L: p.L, r: p.r }
  const fsr = P.freeSpectralRange(spec, p.lambda)
  const f = P.finesse(spec)
  return {
    spec,
    fsr: fsr.fsr,
    fsrWavelength: fsr.wavelength,
    roundTripTime: fsr.roundTripTime,
    finesse: f.finesse,
    linewidth: f.linewidth,
    contrast: P.contrast(spec),
    facet: P.facetReflectance({ n1: p.n }),
    mirrorLoss: P.mirrorLoss(spec),
    sweep: P.sweep(spec, { from: 0.5 * fsr.fsr, to: 3.5 * fsr.fsr, points: 601 }),
    // The hand-over to @ee-labs/systems, declined. The sentence is content, so
    // it is carried in the analysis rather than thrown from the view.
    refusal: P.rationalAvailable(),
  }
}

// ------------------------------------------------------------------ channels

/** F2. The grid in wavelength, the band in frequency, and how many channels fit. */
function analyseChannels(exp, p) {
  const grid = P.channelGrid({ spacing: p.spacing, lambda: p.lambda })
  const band = P.bandChannels({ from: p.from, to: p.to, spacing: p.spacing })
  return {
    grid,
    band,
    // The requirement E2 states from the other side: a source wider than the
    // grid puts light in its neighbour's channel.
    fits: p.dLambda <= grid.width,
    widthRatio: p.dLambda / grid.width,
    centres: Array.from({ length: Math.min(band.channels, 64) }, (_, k) => P.C0 / (P.C0 / p.to + k * p.spacing)),
  }
}
