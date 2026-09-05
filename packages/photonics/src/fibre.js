// The fibre: attenuation, dispersion, the guided geometry, and the budget that
// adds them up.
//
// Which class each object is in, in `CORE_SCOPE.md`'s three:
//
//   EXACT, and never hedged: the attenuation over a length, which is an
//   exponential written in decibels; the numerical aperture, the acceptance
//   angle, the normalised frequency V and the single-mode core diameter, which
//   are algebra over two refractive indices; the conversion between the
//   dispersion parameter D and the group-velocity term β₂; the wavelength
//   width of a frequency grid; and the link budget, which is a sum of stated
//   line items.
//
//   EXACT FOR THE MODEL IT NAMES: the pulse spread `Δτ = D L Δλ`, which is a
//   first-order dispersion model. `dispersionNote` says what first order leaves
//   out, and the second-order term is a labelled toggle rather than a silent
//   correction.
//
//   STATED RATHER THAN IMPLIED: the bandwidth limit needs a criterion, and this
//   module takes it as an argument with a default of `B σ ≤ 0.25`. Another
//   criterion gives another number, and `criterion` is returned beside every
//   limit so a pane can print which one is in use.
//
//   DECLINED: higher-order dispersion and nonlinear propagation. Both need the
//   propagation equation solved along the fibre rather than a closed form over
//   its length, and `refuseNonlinear` says so.
//
// Units. Fibre lengths are in kilometres and attenuation in dB/km, dispersion
// in ps/(nm km), because that is how a fibre is specified. Wavelengths, core
// radii and spreads are SI: metres and seconds. Bit rates are bit/s.

import { C0, PhotonicsError, finite, fraction, nonNegative, positive, require_ } from './const.js'

/** The single-mode cut-off of the normalised frequency, from the first zero of J₀. */
export const V_CUTOFF = 2.405

/** The bandwidth criterion this lab quotes, `B σ ≤ 0.25`. Another criterion gives another number. */
export const CRITERION = 0.25

// ------------------------------------------------------------- attenuation

/** The loss of `length` kilometres at `alpha` dB/km, in decibels. */
export function lossDb({ alpha, length }) {
  return nonNegative(alpha, 'attenuation') * nonNegative(length, 'fibre length')
}

/** The power ratio a loss in decibels stands for, `10^(−dB/10)`. */
export function powerRatio(db) {
  return Math.pow(10, -finite(db, 'loss in decibels') / 10)
}

/** The loss in decibels a power ratio stands for. The inverse of `powerRatio`. */
export function ratioDb(ratio) {
  return -10 * Math.log10(positive(ratio, 'power ratio'))
}

/**
 * A power through a length of fibre: the loss in decibels, the fraction that
 * survives, and the power that arrives in watts.
 */
export function throughFibre({ alpha, length, power }) {
  const db = lossDb({ alpha, length })
  const ratio = powerRatio(db)
  return { db, ratio, out: nonNegative(power, 'optical power') * ratio }
}

// -------------------------------------------------------------- dispersion

/**
 * The pulse spread `Δτ = D L Δλ`, seconds. `D` is in ps/(nm km), `length` in
 * kilometres and `dLambda` in metres, so the arithmetic is done in the units
 * the datasheet uses and returned in seconds.
 */
export function pulseSpread({ D, length, dLambda }) {
  finite(D, 'dispersion parameter')
  nonNegative(length, 'fibre length')
  nonNegative(dLambda, 'source spectral width')
  return Math.abs(D) * length * (dLambda * 1e9) * 1e-12
}

/** `D` in ps/(nm km) as an SI quantity in s/m², which is what β₂ is computed from. */
const dSi = (D) => finite(D, 'dispersion parameter') * 1e-6

/**
 * The group-velocity dispersion `β₂ = −D λ² / (2π c)`, returned in ps²/km. At
 * 1550 nm and `D = 17 ps/(nm km)` it is −21.684 ps²/km, and the sign is the
 * anomalous one that a standard fibre has in the C band.
 */
export function beta2FromD({ D, lambda }) {
  positive(lambda, 'wavelength')
  const si = (-dSi(D) * lambda * lambda) / (2 * Math.PI * C0)
  return si * 1e27
}

/** The dispersion parameter a β₂ in ps²/km stands for, ps/(nm km). The inverse of `beta2FromD`. */
export function dFromBeta2({ beta2, lambda }) {
  positive(lambda, 'wavelength')
  const si = finite(beta2, 'group-velocity dispersion') * 1e-27
  return ((-si * 2 * Math.PI * C0) / (lambda * lambda)) * 1e6
}

/**
 * The bit rate a pulse spread allows under a stated criterion. The default is
 * `B σ ≤ 0.25`, and the criterion is returned so a pane can name it.
 */
export function bandwidthLimit({ spread, criterion = CRITERION }) {
  positive(spread, 'pulse spread')
  positive(criterion, 'bandwidth criterion')
  return { rate: criterion / spread, criterion }
}

/**
 * The bandwidth-distance product in bit/s km for a source of unit spectral
 * width, under the same criterion. Multiply by a source width in nanometres to
 * get the product for that source.
 */
export function bandwidthDistance({ D, dLambda, criterion = CRITERION }) {
  const perKm = pulseSpread({ D, length: 1, dLambda })
  positive(perKm, 'pulse spread over one kilometre')
  return { product: criterion / perKm, criterion }
}

/** What the first-order dispersion model leaves out, as the sentence a pane prints. */
export function dispersionNote() {
  return (
    'The spread is the first-order model D L Δλ. It leaves out the change of D across the source, ' +
    'the polarisation-mode term, and every nonlinear effect, each of which needs the propagation ' +
    'equation solved along the fibre.'
  )
}

/** Nonlinear propagation and higher-order dispersion, declined with the reason. */
export function refuseNonlinear() {
  throw new PhotonicsError(
    'Self-phase modulation, four-wave mixing and higher-order dispersion have no closed form over a ' +
      'length. Each needs the propagation equation solved along the fibre, so this package states the ' +
      'first-order spread and stops there.',
    { object: 'nonlinear propagation' },
  )
}

// ---------------------------------------------------------------- geometry

/** The numerical aperture `√(n₁² − n₂²)`. */
export function numericalAperture({ n1, n2 }) {
  positive(n1, 'core index')
  positive(n2, 'cladding index')
  require_(
    n1 > n2,
    `The core index n1 must be larger than the cladding index n2, and it is ${n1} against ${n2}. ` +
      'A core that does not slow the light more than its cladding guides nothing.',
    { field: 'n1' },
  )
  return Math.sqrt(n1 * n1 - n2 * n2)
}

/** The half-angle of the acceptance cone in degrees, `asin(NA / n₀)`. */
export function acceptanceAngle({ n1, n2, n0 = 1 }) {
  const na = numericalAperture({ n1, n2})
  positive(n0, 'index outside the fibre')
  require_(
    na <= n0,
    `The numerical aperture is ${na.toPrecision(5)}, which is above the index ${n0} outside the fibre, ` +
      'so every ray entering the end face is guided and there is no acceptance angle.',
    { field: 'n0' },
  )
  return (Math.asin(na / n0) * 180) / Math.PI
}

/** The index contrast `Δ = (n₁² − n₂²) / (2 n₁²)`, a fraction. */
export function indexContrast({ n1, n2 }) {
  const na = numericalAperture({ n1, n2 })
  return (na * na) / (2 * n1 * n1)
}

/** The normalised frequency `V = 2π a NA / λ`, with the core radius `a` in metres. */
export function vNumber({ a, n1, n2, lambda }) {
  positive(a, 'core radius')
  positive(lambda, 'wavelength')
  return (2 * Math.PI * a * numericalAperture({ n1, n2 })) / lambda
}

/**
 * The largest core that carries one mode at this wavelength, from `V < 2.405`.
 * Returns the radius and the diameter in metres.
 */
export function singleModeCore({ n1, n2, lambda, vc = V_CUTOFF }) {
  positive(lambda, 'wavelength')
  positive(vc, 'cut-off V')
  const a = (vc * lambda) / (2 * Math.PI * numericalAperture({ n1, n2 }))
  return { radius: a, diameter: 2 * a }
}

/**
 * About how many modes a core carries, `V² / 2`. This is an ESTIMATE and is
 * labelled one: it counts the modes of a step-index core in the limit of large
 * V, and `ok` is false below the cut-off, where the count is one by definition
 * rather than by this formula.
 */
export function modeCount(V) {
  positive(V, 'normalised frequency')
  const ok = V > 2 * V_CUTOFF
  return {
    modes: (V * V) / 2,
    ok,
    threshold: 2 * V_CUTOFF,
    quantity: 'V',
    says: ok
      ? `V is ${V.toPrecision(5)}, well above the 2.405 cut-off, so the large-V estimate V²/2 holds.`
      : `V is ${V.toPrecision(5)}, near or below the 2.405 cut-off. The estimate V²/2 counts modes only ` +
        'when V is large, and a single-mode fibre carries one mode whatever this number says.',
  }
}

// ------------------------------------------------------------- the budget

/**
 * The line items an optical link budget carries. Every loss the model does not
 * include is here with a value of zero, so a zero is a decision a reader can
 * see rather than an omission. That is the System Lab's guard, applied to an
 * optical link.
 */
export const LINK_ITEMS = ['fibre', 'connectors', 'splices', 'dispersion', 'modalNoise', 'reflection', 'modePartition']

/**
 * The optical link budget: a transmitted power in dBm, a named loss in decibels
 * for each line item, and a receiver sensitivity in dBm. Every item in
 * `LINK_ITEMS` appears in the result, at zero when the caller does not give it.
 */
export function linkBudget({ pinDbm, sensitivityDbm, losses = {} }) {
  finite(pinDbm, 'transmitted power')
  finite(sensitivityDbm, 'receiver sensitivity')
  for (const key of Object.keys(losses)) {
    require_(LINK_ITEMS.includes(key), `"${key}" is not a line item of this budget. The items are ${LINK_ITEMS.join(', ')}.`, {
      field: key,
    })
  }
  let running = pinDbm
  const items = LINK_ITEMS.map((name) => {
    const db = nonNegative(losses[name] ?? 0, `${name} loss`)
    running -= db
    return { name, db, after: running }
  })
  const loss = items.reduce((s, item) => s + item.db, 0)
  return { pinDbm, items, loss, outDbm: pinDbm - loss, sensitivityDbm, margin: pinDbm - loss - sensitivityDbm }
}

/**
 * How far the light reaches before the loss uses up the budget, kilometres.
 * `fixedDb` is every loss that does not grow with length, and `reserveDb` is
 * the margin held back.
 */
export function lossLimitedReach({ pinDbm, sensitivityDbm, fixedDb = 0, reserveDb = 0, alpha }) {
  finite(pinDbm, 'transmitted power')
  finite(sensitivityDbm, 'receiver sensitivity')
  nonNegative(fixedDb, 'fixed loss')
  nonNegative(reserveDb, 'reserved margin')
  positive(alpha, 'attenuation')
  return (pinDbm - sensitivityDbm - fixedDb - reserveDb) / alpha
}

/**
 * How far the light reaches before the pulse spreads past the criterion at this
 * bit rate, kilometres.
 */
export function dispersionLimitedReach({ rate, D, dLambda, criterion = CRITERION }) {
  positive(rate, 'bit rate')
  const perKm = pulseSpread({ D, length: 1, dLambda })
  positive(perKm, 'pulse spread over one kilometre')
  return criterion / (rate * perKm)
}

/** Which of the two limits binds, with both reaches in kilometres. */
export function bindingLimit({ loss, dispersion }) {
  return { loss, dispersion, reach: Math.min(loss, dispersion), binds: dispersion < loss ? 'dispersion' : 'loss' }
}

// --------------------------------------------------------- many colours

/**
 * The wavelength width of a frequency grid at `lambda`, `λ² Δf / c`, metres. A
 * 100 GHz grid at 1550 nm is 0.80139 nm wide.
 */
export function gridWavelength({ lambda, spacing }) {
  positive(lambda, 'wavelength')
  positive(spacing, 'channel spacing')
  return (lambda * lambda * spacing) / C0
}

/**
 * A wavelength band as a frequency width and a channel count on a grid. The
 * count is how many whole channels fit, so it is a floor and not a rounding.
 */
export function bandChannels({ lambdaLow, lambdaHigh, spacing }) {
  positive(lambdaLow, 'shortest wavelength')
  positive(lambdaHigh, 'longest wavelength')
  require_(
    lambdaHigh > lambdaLow,
    `The longest wavelength must be above the shortest, and it is ${lambdaHigh} against ${lambdaLow}.`,
    { field: 'lambdaHigh' },
  )
  positive(spacing, 'channel spacing')
  const width = C0 / lambdaLow - C0 / lambdaHigh
  return { width, channels: Math.floor(width / spacing), spacing }
}

/** A fraction, re-exported so a caller validating a reflectance uses this package's message. */
export { fraction }
