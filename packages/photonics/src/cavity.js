// The Fabry-Perot cavity: two mirrors, one round trip, and no transfer function.
//
// CORE_SCOPE.md class, restated where the work happens.
//
//   EXACT, never hedged: the Airy transmission of a two-mirror cavity as a
//   function of the round-trip phase; the free spectral range c/(2 n L) and its
//   width in wavelength lambda^2/(2 n L); the finesse pi sqrt(R)/(1 - R); the
//   linewidth, which is the free spectral range over the finesse; the peak to
//   valley contrast; the facet reflectance of a cleaved end; the mirror loss
//   (1/2L) ln(1/R) the photon lifetime is built from.
//
//   DECLINED (Rule 2), with the reason as content: the cavity as a rational
//   H(s). The round trip carries the factor e^(-j 2 beta L), which is
//   transcendental, so no ratio of polynomials equals it and no finite set of
//   poles describes it. `refuseRational` throws with that sentence and
//   `rationalAvailable` returns it. The response itself is exact at every
//   frequency and is returned as numbers, which is the same shape the
//   transmission line's refusal takes in the Fields Lab and the RF Lab.
//
// Nothing here is approximated, so nothing here carries a guard.

import { C0, PhotonicsError, fraction, nonNegative, positive, require_ } from './const.js'

/**
 * A cavity of length `L` in a medium of index `n`, closed by two mirrors.
 *
 * `r1` and `r2` are power reflectances. Given one `r`, both mirrors take it,
 * which is the symmetric cavity a cleaved semiconductor chip is. `loss` is the
 * internal power loss per metre, which lowers the finesse without touching the
 * free spectral range.
 */
export function describeCavity(spec) {
  const n = positive(spec.n ?? 1, 'n')
  const L = positive(spec.L, 'L')
  const r1 = fraction(spec.r1 ?? spec.r ?? 0, 'r1')
  const r2 = fraction(spec.r2 ?? spec.r ?? 0, 'r2')
  const loss = nonNegative(spec.loss ?? 0, 'loss')
  require_(r1 * r2 > 0, 'A cavity needs two mirrors that reflect something. A reflectance of zero has no round trip and no resonance.', { field: 'r1' })
  const roundTrip = Math.sqrt(r1 * r2) * Math.exp(-loss * L)
  return { n, L, r1, r2, loss, roundTrip, opticalLength: n * L }
}

/**
 * The free spectral range, in hertz and in metres of wavelength at `lambda`.
 *
 *   fsr = c / (2 n L)      and      dLambda = lambda^2 / (2 n L)
 *
 * It is one over the round-trip time, so a shorter cavity has its resonances
 * further apart. At n = 3.5 and L = 300 um that is 142.76 GHz, or 1.1440 nm at
 * 1550 nm.
 */
export function freeSpectralRange(spec, lambda = null) {
  const c = describeCavity(spec)
  const fsr = C0 / (2 * c.opticalLength)
  return {
    fsr,
    roundTripTime: 1 / fsr,
    wavelength: lambda === null ? null : (positive(lambda, 'lambda') ** 2) / (2 * c.opticalLength),
  }
}

/**
 * The finesse, pi sqrt(rho) / (1 - rho) with rho the round-trip amplitude
 * factor, and the linewidth that follows from it.
 *
 * The finesse counts how many linewidths fit in a free spectral range. At a
 * facet reflectance of 0.3086 it is 2.52, so the resonances are broad and
 * barely separated. At 0.99 it is 312.6 and each line is a spike.
 */
export function finesse(spec) {
  const c = describeCavity(spec)
  const f = (Math.PI * Math.sqrt(c.roundTrip)) / (1 - c.roundTrip)
  const fsr = freeSpectralRange(spec).fsr
  return { finesse: f, fsr, linewidth: fsr / f, roundTrip: c.roundTrip }
}

/**
 * The Airy transmission at a round-trip phase `phi`, in radians.
 *
 *   T = (1 - rho)^2 / ((1 - rho)^2 + 4 rho sin^2(phi/2))
 *
 * It is one at every multiple of 2 pi and it is periodic in phi with period
 * 2 pi exactly, which is the invariant the fuzzer checks. The peak-to-valley
 * contrast is 1 + 4 rho / (1 - rho)^2.
 */
export function airy(spec, phi) {
  const c = describeCavity(spec)
  const rho = c.roundTrip
  const s = Math.sin(phi / 2)
  return (1 - rho) ** 2 / ((1 - rho) ** 2 + 4 * rho * s * s)
}

/** The round-trip phase at optical frequency `f`: 2 beta L, with beta = 2 pi n f / c. */
export const roundTripPhase = (spec, f) => {
  const c = describeCavity(spec)
  return (4 * Math.PI * c.opticalLength * nonNegative(f, 'f')) / C0
}

/** The Airy transmission at an optical frequency, which is `airy` at that frequency's phase. */
export const transmissionAt = (spec, f) => airy(spec, roundTripPhase(spec, f))

/**
 * The transmission over a span of optical frequency, as the pane draws it.
 *
 * `points` samples are taken from `from` to `to`, and the resonance frequencies
 * inside the span are listed beside them so the plot can mark them without
 * hunting for maxima in the sampled curve.
 */
export function sweep(spec, { from, to, points = 401 }) {
  positive(from, 'from')
  require_(to > from, `The sweep's top frequency must be above its bottom, and ${to} is not above ${from}.`, { field: 'to' })
  const c = describeCavity(spec)
  const fsr = C0 / (2 * c.opticalLength)
  const f = []
  const t = []
  for (let k = 0; k < points; k++) {
    const x = from + ((to - from) * k) / (points - 1)
    f.push(x)
    t.push(transmissionAt(spec, x))
  }
  // The peaks are the multiples of the free spectral range inside the span. The
  // ends are compared with a relative slack, because a caller who asks for
  // exactly ten to fourteen free spectral ranges has computed those two numbers
  // by multiplication and one of them will land a bit outside itself.
  const slack = 1e-9
  const peaks = []
  for (let m = Math.ceil(from / fsr - slack); m * fsr <= to * (1 + slack); m++) peaks.push(m * fsr)
  return { f, t, peaks, fsr }
}

/** The peak to valley contrast of the Airy curve, as a ratio and in decibels. */
export function contrast(spec) {
  const rho = describeCavity(spec).roundTrip
  const ratio = 1 + (4 * rho) / (1 - rho) ** 2
  return { ratio, db: 10 * Math.log10(ratio) }
}

/**
 * The power reflectance of a cleaved facet between two indices, at normal
 * incidence: ((n1 - n2)/(n1 + n2))^2.
 *
 * A semiconductor of index 3.5 against air gives 0.3086 with no mirror at all,
 * which is why a laser chip needs no coating to lase.
 */
export function facetReflectance({ n1, n2 = 1 }) {
  positive(n1, 'n1')
  positive(n2, 'n2')
  return ((n1 - n2) / (n1 + n2)) ** 2
}

/**
 * The mirror loss of a cavity, per metre, in the convention
 * `PHOTONICS_LAB_PLAN.md` §2.8 states:
 *
 *   alpha_m = (1 / 2L) ln(1 / R)   for two equal mirrors,
 *   alpha_m = ln(1 / (r1 r2)) / 4L in general.
 *
 * The convention is the one where a SINGLE pass of length L loses the factor R,
 * so exp(-2 alpha_m L) = R. Some texts spread the same reflectance over a round
 * trip instead and quote twice this number. The convention decides a factor of
 * two in a threshold current, so it is written down here rather than assumed.
 *
 * This is the loss the photon lifetime is built from, so it is the number that
 * carries a facet reflectance through to a laser's threshold. At R = 0.3086 and
 * L = 300 um it is 1959.3 per metre, which is 19.593 per centimetre.
 */
export function mirrorLoss(spec) {
  const c = describeCavity(spec)
  return Math.log(1 / (c.r1 * c.r2)) / (4 * c.L)
}

/**
 * The photon lifetime a cavity's losses give, in seconds.
 *
 *   1 / tau_p = (c / n) (alpha_i + alpha_m)
 *
 * Group C and Group D are not built in this sitting, and this is the number they
 * will take from here rather than typing. It is put in now because C5 turns the
 * facet reflectance and reads the threshold, and the threshold is this lifetime.
 */
export function photonLifetime(spec) {
  const c = describeCavity(spec)
  const alpha = c.loss + mirrorLoss(spec)
  positive(alpha, 'alpha')
  return { alpha, mirror: mirrorLoss(spec), internal: c.loss, tauP: c.n / (C0 * alpha) }
}

// -------------------------------------------------------------------- declined

/**
 * The cavity as a rational transfer function, declined with the reason.
 *
 * The wording is deliberately the transmission line's. Both objects are
 * periodic in a round-trip phase and neither has a rational form, and the two
 * labs that meet them say the same thing about them.
 */
export function refuseRational() {
  throw new PhotonicsError(
    'The cavity has no transfer function in s. Its round trip carries the factor e^(-j2betaL), which is transcendental, so no ratio of polynomials equals it and no finite set of poles describes it. The transmission over frequency is exact at every frequency and is returned as numbers.',
    { field: 'systems' },
  )
}

/** The same refusal as a sentence, for a pane that has to explain rather than throw. */
export const rationalAvailable = () => {
  try {
    refuseRational()
    return null
  } catch (err) {
    return err.message
  }
}
