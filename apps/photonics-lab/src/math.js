// One analysis per experiment, and every view and every lesson reads from it.
//
// `analyse(exp, p)` dispatches on the experiment's `kind` and returns an object
// whose shape is fixed per kind. Nothing in the app calls the engine directly.
// That is what makes `experiments.test.js` able to recompute every number a
// lesson quotes: it calls the same function with the same settings.
//
// Two conversions happen here and nowhere else. A fibre length is a knob in
// metres and an engine argument in kilometres. A wavelength is metres in both.
// Keeping the conversion at this one boundary is why a lesson can quote "80 km"
// and a knob can hold 80000 and the test can compare them.

import * as P from '@ee-labs/photonics'
import { newtonDC } from '@ee-labs/network'

/** Kilometres from the metres a knob holds. */
const km = (metres) => metres / 1000

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
    if (err && err.name === 'PhotonicsError') return declined(exp, p, err)
    throw err
  }
}

/**
 * A setting the engine will not describe.
 *
 * A cladding index above the core's is not clamped back into a fibre. It is a
 * different object, and `numericalAperture` throws a message naming the two
 * indices and what they must be. The app shows that sentence where the headline
 * would be, rather than the last answer that happened to work.
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

/** The guard an experiment shows, or null where its answer is exact. */
export const guardOf = (x) => x.guard || null

/** The refusal an experiment states, or null. */
export const refusalOf = (x) => (x.declined ? x.declined.says : x.refusal || null)

const KINDS = {
  photon: analysePhoton,
  detector: analyseDetector,
  speed: analyseSpeed,
  fibre: analyseFibre,
  dispersion: analyseDispersion,
  geometry: analyseGeometry,
  link: analyseLink,
  cavity: analyseCavity,
  wdm: analyseWdm,
}

// -------------------------------------------------------------- group A

/** A1 and A3: the closed forms of one photon and one detector, against wavelength. */
function analysePhoton(exp, p) {
  const photon = {
    energyEv: P.photonEnergyEv(p.lambda),
    energyJ: P.photonEnergy(p.lambda),
    frequency: P.opticalFrequency(p.lambda),
    flux: P.photonFlux({ power: p.power ?? 1e-3, lambda: p.lambda }),
  }
  const detector =
    p.eta === undefined
      ? null
      : {
          responsivity: P.responsivity({ eta: p.eta, lambda: p.lambda }),
          ideal: P.idealResponsivity(p.lambda),
          cutoff: P.cutoffWavelength(p.eg),
          eta: p.eta,
        }
  const out = { photon, detector }
  out.sweep = detector
    ? sweepOver(p, 'lambda', 400e-9, 2000e-9, (q) =>
        q.lambda <= P.cutoffWavelength(q.eg) ? P.responsivity({ eta: q.eta, lambda: q.lambda }) : 0,
        'Responsivity',
        'A/W',
      )
    : sweepOver(p, 'lambda', 400e-9, 2000e-9, (q) => P.photonEnergyEv(q.lambda), 'Photon energy', 'eV')
  out.headline = detector
    ? { value: detector.responsivity, unit: 'A/W', label: 'Responsivity at this wavelength' }
    : { value: photon.energyEv, unit: 'eV', label: 'Energy one photon carries' }
  return out
}

/** A2 and A4: the photodiode as a circuit, solved by the same Newton iteration. */
function analyseDetector(exp, p) {
  const spec = { eta: p.eta, lambda: p.lambda, power: p.power, dark: p.dark, bias: p.bias, load: p.load }
  const net = P.photodiodeNet(spec)
  const { sol } = newtonDC(net)
  const detector = {
    responsivity: P.responsivity({ eta: p.eta, lambda: p.lambda }),
    current: P.photocurrent(spec),
    dark: p.dark,
    crossover: P.darkCrossover({ eta: p.eta, lambda: p.lambda, dark: p.dark }),
  }
  const circuit = {
    net,
    sol,
    current: Math.abs(sol.i.RL),
    node: sol.v.k,
    junction: sol.i.D1,
    residual: sol.maxResidual,
    reverse: p.bias - sol.v.k,
  }
  return {
    detector,
    circuit,
    photon: { energyEv: P.photonEnergyEv(p.lambda), frequency: P.opticalFrequency(p.lambda) },
    sweep: sweepOver(p, 'power', 1e-12, 1e-4, (q) => P.photocurrent({ ...spec, ...q }), 'Detector current', 'A', 'log'),
    headline: { value: circuit.current, unit: 'A', label: 'Current the load carries' },
  }
}

/** A5: the area a detector needs, against the speed it costs. */
function analyseSpeed(exp, p) {
  const capacitance = P.detectorCapacitance({ area: p.area, cPerArea: p.cPerArea })
  const corner = P.detectorCorner({ load: p.load, capacitance })
  const collected = P.collectedPower({ irradiance: p.irradiance, area: p.area })
  return {
    speed: { capacitance, corner, collected, product: collected * corner },
    sweep: sweepOver(
      p,
      'area',
      1e-10,
      1e-4,
      (q) => P.detectorCorner({ load: q.load, capacitance: P.detectorCapacitance({ area: q.area, cPerArea: q.cPerArea }) }),
      'Corner frequency',
      'Hz',
      'log',
    ),
    headline: { value: corner, unit: 'Hz', label: 'Corner of the detector and its load' },
  }
}

// -------------------------------------------------------------- group E

/** E1: what a length of fibre takes out. */
function analyseFibre(exp, p) {
  const through = P.throughFibre({ alpha: p.alpha, length: km(p.length), power: p.power })
  return {
    fibre: { db: through.db, ratio: through.ratio, out: through.out, lengthKm: km(p.length) },
    link: linkProfile(p, through),
    sweep: sweepOver(p, 'length', 1, 5e5, (q) => P.throughFibre({ alpha: q.alpha, length: km(q.length), power: q.power }).out, 'Power along the fibre', 'W', 'log'),
    headline: { value: through.db, unit: 'dB', label: 'Loss over this length' },
  }
}

/** E2 and E3: the pulse the fibre spreads, and the rate that spread allows. */
function analyseDispersion(exp, p) {
  const seconds = P.pulseSpread({ D: p.D, length: km(p.length), dLambda: p.dLambda })
  const criterion = p.criterion ?? P.CRITERION
  const spread = {
    ps: seconds,
    beta2: P.beta2FromD({ D: p.D, lambda: p.lambda }),
    D: P.dFromBeta2({ beta2: P.beta2FromD({ D: p.D, lambda: p.lambda }), lambda: p.lambda }),
  }
  const limit = seconds > 0 ? P.bandwidthLimit({ spread: seconds, criterion }) : { rate: Infinity, criterion }
  const product = p.D !== 0 && p.dLambda > 0 ? P.bandwidthDistance({ D: p.D, dLambda: p.dLambda, criterion }).product : Infinity
  return {
    spread,
    limit: { ...limit, product, criterion },
    pulse: pulseShape(p, seconds),
    sweep: sweepOver(p, 'length', 1, 5e5, (q) => P.pulseSpread({ D: q.D, length: km(q.length), dLambda: q.dLambda }), 'Pulse spread', 's', 'log'),
    headline: { value: seconds, unit: 's', label: 'How far the pulse spreads' },
  }
}

/** E4: the core, the cladding, and how many modes fit. */
function analyseGeometry(exp, p) {
  const na = P.numericalAperture({ n1: p.n1, n2: p.n2 })
  const V = P.vNumber({ a: p.a, n1: p.n1, n2: p.n2, lambda: p.lambda })
  const count = P.modeCount(V)
  const single = P.singleModeCore({ n1: p.n1, n2: p.n2, lambda: p.lambda })
  return {
    geo: {
      na,
      angle: P.acceptanceAngle({ n1: p.n1, n2: p.n2 }),
      delta: P.indexContrast({ n1: p.n1, n2: p.n2 }),
      V,
      singleMode: single.diameter,
      modes: count.modes,
    },
    guard: count,
    sweep: sweepOver(p, 'a', 1e-6, 5e-5, (q) => P.vNumber({ a: q.a, n1: q.n1, n2: q.n2, lambda: q.lambda }), 'Normalised frequency V', '', 'log'),
    headline: { value: V, unit: '', label: 'Normalised frequency V' },
  }
}

/** E5: the budget, and the two reaches it allows. */
function analyseLink(exp, p) {
  const losses = {
    fibre: P.lossDb({ alpha: p.alpha, length: km(p.length) }),
    connectors: p.connectors,
    splices: p.splices,
    dispersion: p.penalty,
  }
  const budget = P.linkBudget({ pinDbm: p.pinDbm, sensitivityDbm: p.sensitivityDbm, losses })
  const fixedDb = p.connectors + p.splices + p.penalty
  const loss = P.lossLimitedReach({
    pinDbm: p.pinDbm,
    sensitivityDbm: p.sensitivityDbm,
    fixedDb,
    reserveDb: p.reserve,
    alpha: p.alpha,
  })
  const dispersion = P.dispersionLimitedReach({ rate: p.rate, D: p.D, dLambda: p.dLambda })
  return {
    budget,
    reach: P.bindingLimit({ loss, dispersion }),
    link: linkProfile(p, { db: losses.fibre, out: P.wattsOf(budget.outDbm), ratio: P.powerRatio(losses.fibre) }),
    headline: { value: budget.margin, unit: 'dB', label: 'Margin over the sensitivity' },
  }
}

// -------------------------------------------------------------- group F

/** F1: the cavity, its three numbers, and the hand-over it declines. */
function analyseCavity(exp, p) {
  const spec = { n: p.n, length: p.length, R1: p.R1, R2: p.R1, lossInternal: p.lossInternal }
  const fsr = P.freeSpectralRange(spec)
  const centre = P.opticalFrequency(p.lambda)
  const guard = P.linewidthGuard(spec)
  return {
    cavity: {
      spec,
      fsr,
      fsrNm: P.fsrWavelength({ ...spec, lambda: p.lambda }),
      finesse: P.finesse(spec),
      linewidth: P.linewidth(spec),
      exact: P.halfPowerWidth(spec),
      contrast: P.contrast(spec).db,
      mirrorLoss: P.mirrorLoss({ R1: p.R1, R2: p.R1, length: p.length }),
      tau: P.photonLifetime(spec),
      facet: P.facetReflectance({ n: p.n }),
      guard,
    },
    guard,
    refusal: P.rationalAvailable().says,
    spectrum: P.spectrum({ ...spec, centre, span: (p.spans ?? 4) * fsr, points: 401 }),
    headline: { value: fsr, unit: 'Hz', label: 'Free spectral range' },
  }
}

/** F2: the grid, the band, and how many channels fit on it. */
function analyseWdm(exp, p) {
  const gridNm = P.gridWavelength({ lambda: p.lambda, spacing: p.spacing })
  const band = P.bandChannels({ lambdaLow: p.lambdaLow, lambdaHigh: p.lambdaHigh, spacing: p.spacing })
  const channels = []
  for (let k = 0; k < Math.min(band.channels, 64); k++) {
    const freq = P.opticalFrequency(p.lambdaHigh) + k * p.spacing
    channels.push({ index: k, freq, lambda: P.wavelengthOf(freq) })
  }
  return {
    wdm: {
      gridNm,
      bandHz: band.width,
      channels: band.channels,
      spacing: p.spacing,
      spread: P.pulseSpread({ D: p.D, length: km(p.length), dLambda: gridNm }),
    },
    grid: channels,
    headline: { value: band.channels, unit: '', label: 'Channels the band holds' },
  }
}

// ------------------------------------------------------------ the pictures

/**
 * One knob swept across its own range, with the reading at each step. The view
 * draws it and nothing else reads it, so a sweep is never the source of a
 * number a lesson quotes.
 */
function sweepOver(p, key, from, to, read, label, unit, scale = 'log', points = 121) {
  const out = []
  for (let k = 0; k < points; k++) {
    const t = k / (points - 1)
    const value = scale === 'log' ? from * Math.pow(to / from, t) : from + (to - from) * t
    let y = NaN
    try {
      y = read({ ...p, [key]: value })
    } catch {
      y = NaN
    }
    out.push({ x: value, y })
  }
  return { key, label, unit, scale, points: out, from, to }
}

/** The power falling along the fibre, which is what the link view draws. */
function linkProfile(p, through, points = 61) {
  const metres = p.length
  const pin = p.power ?? P.wattsOf(p.pinDbm ?? 0)
  const line = []
  for (let k = 0; k < points; k++) {
    const at = (metres * k) / (points - 1)
    line.push({ at, power: pin * P.powerRatio(P.lossDb({ alpha: p.alpha, length: km(at) })) })
  }
  return { line, pin, out: through.out, db: through.db, ratio: through.ratio, length: metres }
}

/**
 * A Gaussian pulse in and the same pulse out, both normalised to unit height.
 * The width in is the reader's knob and the width out is that width and the
 * spread added in quadrature, which is how two independent widths combine.
 */
function pulseShape(p, spread, points = 121) {
  const inWidth = p.pulseIn ?? 100e-12
  const outWidth = Math.sqrt(inWidth * inWidth + spread * spread)
  const span = 4 * Math.max(inWidth, outWidth)
  const shape = []
  for (let k = 0; k < points; k++) {
    const t = -span + (2 * span * k) / (points - 1)
    shape.push({
      t,
      in: Math.exp(-0.5 * Math.pow(t / inWidth, 2)),
      out: Math.exp(-0.5 * Math.pow(t / outWidth, 2)),
    })
  }
  return { shape, inWidth, outWidth, spread, span }
}
