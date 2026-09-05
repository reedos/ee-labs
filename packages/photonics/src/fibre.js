// The fibre: attenuation, dispersion, geometry, and the budget of a link.
//
// CORE_SCOPE.md class, restated where the work happens.
//
//   EXACT, never hedged: attenuation over a length, which is an exponential in
//   length and a sum in decibels; the pulse spread D L dLambda of the
//   first-order dispersion model; the conversion between D and beta_2; the
//   numerical aperture, the normalised frequency V and the single-mode
//   condition V < 2.405; a channel grid's width in wavelength and a band's
//   width in frequency; the sum of decibels a link budget is.
//
//   EXACT FOR A STATED CRITERION, and the criterion is on the pane: the bit
//   rate a pulse spread allows. The lab uses B sigma <= 0.25. Another criterion
//   gives another number, so `bandwidthLimit` carries the criterion it used in
//   its return and the app prints it. That is not a guard on an approximation.
//   It is a definition the reader has to be told.
//
//   LABELLED ESTIMATE, with its name in the return: the mode count of a large
//   core, about V^2/2. `modeCount` returns `{ modes, estimate: true }` so a
//   caption cannot quote it as exact.
//
//   DECLINED, with the reason as content: higher-order dispersion and
//   nonlinear propagation. Both need the propagation equation solved along the
//   fibre rather than a closed form at its end. `refuseNonlinear` throws with
//   that reason, and PHOTONICS_LAB_PLAN.md §10 says where that work lives.

import { C0, PhotonicsError, finite, fromDb, nonNegative, positive, require_, toDb, toDbm } from './const.js'

// ------------------------------------------------------------------ attenuation

/**
 * What a length of fibre does to the power in it.
 *
 * `alphaDb` is in decibels a kilometre and `length` is in metres, as every
 * length in this suite is. The loss is alpha times the length and the power
 * ratio is ten to the minus a tenth of it, so 0.20 dB/km over 80 km is
 * 16.000 dB and leaves 2.5119 per cent of the light.
 */
export function attenuation({ alphaDb, length }) {
  nonNegative(alphaDb, 'alphaDb')
  nonNegative(length, 'length')
  const km = length / 1000
  const db = alphaDb * km
  return { alphaDb, length, km, db, ratio: fromDb(-db) }
}

/** The power at the far end of that fibre, in watts and in dBm. */
export function powerAfter({ alphaDb, length, power }) {
  const a = attenuation({ alphaDb, length })
  const out = nonNegative(power, 'power') * a.ratio
  return { ...a, in: power, out, inDbm: toDbm(power), outDbm: toDbm(out) }
}

/** The length of fibre that costs `db` decibels at this attenuation, in metres. */
export function lengthForLoss({ alphaDb, db }) {
  positive(alphaDb, 'alphaDb')
  return (1000 * nonNegative(db, 'db')) / alphaDb
}

// ------------------------------------------------------------------- dispersion

/**
 * Chromatic dispersion, as the spread a pulse picks up over a length.
 *
 *   dTau = D L dLambda
 *
 * `D` is the fibre's dispersion parameter in seconds per metre of length per
 * metre of wavelength, which is what 17 ps/(nm km) is in base units: 17e-6.
 * `dLambda` is the source's spectral width in metres. A 1 nm source over 80 km
 * of standard fibre spreads by 1360 ps, and that spread is what limits the rate.
 */
export function dispersion({ D, length, dLambda }) {
  finite(D, 'D')
  nonNegative(length, 'length')
  nonNegative(dLambda, 'dLambda')
  return { D, length, dLambda, spread: Math.abs(D * length * dLambda) }
}

/**
 * The group-velocity dispersion beta_2 behind a dispersion parameter D.
 *
 *   beta_2 = -D lambda^2 / (2 pi c)
 *
 * The sign flip is the whole content of the relation. A fibre with a positive D
 * in ps/(nm km), which is what a datasheet quotes at 1550 nm, has a negative
 * beta_2 in ps^2/km, and the two describe the same fibre.
 */
export function beta2({ D, lambda }) {
  finite(D, 'D')
  positive(lambda, 'lambda')
  return (-D * lambda * lambda) / (2 * Math.PI * C0)
}

/** The dispersion parameter behind a beta_2, at the same wavelength. The inverse of `beta2`. */
export function dispersionFromBeta2({ beta2: b2, lambda }) {
  finite(b2, 'beta2')
  positive(lambda, 'lambda')
  return (-b2 * 2 * Math.PI * C0) / (lambda * lambda)
}

/** The criterion this lab reads a bandwidth limit under, and its name on the pane. */
export const BANDWIDTH_CRITERION = 0.25
export const CRITERION_TEXT = 'B sigma <= 0.25, the spread held to a quarter of a bit period'

/**
 * The bit rate a pulse spread allows, under a stated criterion.
 *
 * The criterion is returned beside the number because it is a definition and
 * not a measurement. Under B sigma <= 0.25 a 1360 ps spread allows
 * 0.1838 Gbit/s. Under B sigma <= 0.5 the same fibre allows twice that, and
 * neither number is more correct than the other.
 */
export function bandwidthLimit({ spread, criterion = BANDWIDTH_CRITERION }) {
  positive(spread, 'spread')
  positive(criterion, 'criterion')
  return { spread, criterion, rate: criterion / spread, text: CRITERION_TEXT }
}

/**
 * The bandwidth-distance product, in bit per second metres for each metre of
 * source width. Divide by 1e9 and multiply by 1e-3 and 1e9 to read it as the
 * Gbit/s km per nm a datasheet quotes.
 *
 * It is a product because the rate falls as one over the length and one over
 * the source width, so rate times length times width is a property of the fibre
 * alone.
 */
export function bandwidthDistance({ D, dLambda, criterion = BANDWIDTH_CRITERION }) {
  positive(Math.abs(D), 'D')
  positive(dLambda, 'dLambda')
  return { product: criterion / (Math.abs(D) * dLambda), perWidth: criterion / Math.abs(D), criterion }
}

/** The length at which dispersion alone stops a link running at `rate`, in metres. */
export function dispersionReach({ D, dLambda, rate, criterion = BANDWIDTH_CRITERION }) {
  positive(rate, 'rate')
  return bandwidthDistance({ D, dLambda, criterion }).product / rate
}

// -------------------------------------------------------------------- geometry

/** The single-mode condition on the normalised frequency. Above it a second mode propagates. */
export const V_SINGLE_MODE = 2.405

/**
 * The numerical aperture of a step-index fibre, and the cone it accepts.
 *
 *   NA = sqrt(n1^2 - n2^2)
 *
 * The acceptance angle is the arcsine of that, measured from the axis in air.
 * `delta` is the fractional index difference the two indices amount to, which
 * is the number a fibre is specified by.
 */
export function numericalAperture({ n1, n2 }) {
  positive(n1, 'n1')
  positive(n2, 'n2')
  require_(
    n1 > n2,
    `The core index n1 must be larger than the cladding index n2, or no ray is guided. Here n1 is ${n1} and n2 is ${n2}.`,
    { field: 'n1' },
  )
  const na = Math.sqrt(n1 * n1 - n2 * n2)
  return {
    n1,
    n2,
    na,
    angle: (Math.asin(Math.min(1, na)) * 180) / Math.PI,
    delta: (n1 * n1 - n2 * n2) / (2 * n1 * n1),
  }
}

/** The normalised frequency V = 2 pi a NA / lambda, for a core of radius `a`. */
export function vNumber({ a, na, lambda }) {
  positive(a, 'a')
  positive(na, 'na')
  positive(lambda, 'lambda')
  return (2 * Math.PI * a * na) / lambda
}

/** The largest core diameter that stays single mode at this wavelength, in metres. */
export function singleModeDiameter({ na, lambda, vLimit = V_SINGLE_MODE }) {
  positive(na, 'na')
  positive(lambda, 'lambda')
  return (vLimit * lambda) / (Math.PI * na)
}

/**
 * How many modes a core carries, as the labelled estimate it is.
 *
 * Below the single-mode limit the answer is one and it is exact. Above it the
 * count is about V^2/2, which is a large-V asymptote and not a mode solve, so
 * the return says `estimate: true` and the caption has to say so too.
 */
export function modeCount(v) {
  positive(v, 'v')
  if (v < V_SINGLE_MODE) return { v, modes: 1, estimate: false }
  return { v, modes: Math.round((v * v) / 2), estimate: true }
}

// ----------------------------------------------------------------- many colours

/**
 * A channel grid stated in frequency, read as a width in wavelength.
 *
 *   dLambda = lambda^2 df / c
 *
 * A 100 GHz grid at 1550 nm is 0.80139 nm wide. The conversion is exact, and it
 * is why a grid is quoted in frequency: the spacing in wavelength changes across
 * the band while the spacing in frequency does not.
 */
export function channelGrid({ spacing, lambda }) {
  positive(spacing, 'spacing')
  positive(lambda, 'lambda')
  return { spacing, lambda, width: (lambda * lambda * spacing) / C0 }
}

/**
 * A wavelength band as a width in frequency, and the channels a grid fits in it.
 *
 * The C band from 1530 nm to 1565 nm is 4.3821 THz wide, which holds 43 channels
 * on a 100 GHz grid. The count is a floor: a part of a channel is not a channel.
 */
export function bandChannels({ from, to, spacing }) {
  positive(from, 'from')
  positive(to, 'to')
  require_(to > from, `The band's long wavelength must be past its short one, and ${to} is not past ${from}.`, { field: 'to' })
  const width = C0 / from - C0 / to
  return { from, to, width, spacing, channels: Math.floor(width / positive(spacing, 'spacing')) }
}

// ------------------------------------------------------------------ the budget

/**
 * The optical link budget, as a sum of stated line items.
 *
 * `items` is a list of `{ name, db }`, each a loss in decibels. A loss the model
 * does not include is a line item set to zero rather than a line item left out,
 * so a zero on the pane is a decision a reader can see. The three this lab
 * carries at zero are modal noise, the reflection penalty and mode-partition
 * noise.
 *
 * Everything here is a sum, so the composition rule the invariants check is
 * arithmetic and not physics: two fibres in series cost the sum of their losses.
 */
export function linkBudget({ txDbm, items, sensitivityDbm }) {
  finite(txDbm, 'txDbm')
  finite(sensitivityDbm, 'sensitivityDbm')
  require_(Array.isArray(items) && items.length > 0, 'A link budget needs at least one line item.', { field: 'items' })
  let total = 0
  for (const it of items) {
    require_(typeof it.name === 'string' && it.name.length > 0, 'Every line item in a budget is named.', { field: 'items' })
    total += nonNegative(it.db, `${it.name} loss`)
  }
  const received = txDbm - total
  return {
    txDbm,
    items,
    total,
    received,
    sensitivityDbm,
    margin: received - sensitivityDbm,
    receivedWatts: Math.pow(10, received / 10) * 1e-3,
  }
}

/**
 * The length of fibre a budget pays for, with a margin held back, in metres.
 *
 * Everything that is not the fibre is a fixed line item, so the fibre gets what
 * is left of the transmitter's power above the receiver's sensitivity.
 */
export function lossReach({ txDbm, sensitivityDbm, fixedDb, marginDb, alphaDb }) {
  finite(txDbm, 'txDbm')
  finite(sensitivityDbm, 'sensitivityDbm')
  nonNegative(fixedDb, 'fixedDb')
  nonNegative(marginDb, 'marginDb')
  positive(alphaDb, 'alphaDb')
  const forFibre = txDbm - sensitivityDbm - fixedDb - marginDb
  require_(
    forFibre >= 0,
    `The fixed losses and the margin already use ${(fixedDb + marginDb).toPrecision(4)} dB of a ${(txDbm - sensitivityDbm).toPrecision(4)} dB budget, so no length of fibre reaches.`,
    { field: 'marginDb' },
  )
  return { forFibre, length: lengthForLoss({ alphaDb, db: forFibre }) }
}

/** The two reaches side by side, and which of them binds. */
export function bindingLimit({ loss, dispersionLength }) {
  positive(loss, 'loss')
  positive(dispersionLength, 'dispersionLength')
  const binds = dispersionLength < loss ? 'dispersion' : 'loss'
  return { loss, dispersion: dispersionLength, binds, reach: Math.min(loss, dispersionLength) }
}

// -------------------------------------------------------------------- declined

/**
 * Self-phase modulation, four-wave mixing and higher-order dispersion, declined
 * with the reason.
 *
 * Each of them changes the field along the fibre rather than at its end, so the
 * answer is the propagation equation solved in space and not a closed form in
 * length. The suite states what it can state exactly, and this is not one of
 * those things. `PHOTONICS_LAB_PLAN.md` §10 names where that work lives.
 */
export function refuseNonlinear(what = 'nonlinear propagation') {
  throw new PhotonicsError(
    `${what} changes the field as it travels, so the answer is the propagation equation solved along the fibre and not a closed form at its end. This package states the attenuation and the first-order dispersion exactly, and declines the rest rather than shipping an approximation of it.`,
    { field: 'propagation' },
  )
}

/** The same refusal as a sentence, for a pane that has to explain rather than throw. */
export const nonlinearAvailable = () => {
  try {
    refuseNonlinear()
    return null
  } catch (err) {
    return err.message
  }
}

export { toDb, toDbm }
