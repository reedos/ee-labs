// Antennas: the dipole's pattern in closed form, directivity and gain, the
// array factor, and the Friis equation.
//
// The pattern of a thin wire dipole carrying an assumed sinusoidal current has
// a closed form. The directivity does not, because it is that pattern's
// integral over the sphere, so it is computed by quadrature from the pattern
// itself rather than looked up. The half-wave dipole's 1.6409 and its 73.08
// ohms are outputs of this module, not constants typed into it, and
// antenna.test.js pins them against the published values as a check on the
// quadrature. The 73.08 is worth a sentence: the number tables give is 73.13,
// and the difference is that the tables round eta / 4 pi to 30. This module
// keeps the exact coefficient and reports both.
//
// The one assumption everything here rests on is stated once: the current on a
// thin dipole of length L is taken to be sin(k (L/2 - |z|)), the standing wave
// a lossless open-ended line would carry. That is an assumption about the
// current, not an approximation of an integral, and it is what a course means
// by "the dipole". Its consequence is that the results hold for a wire thin
// against a wavelength, which is the guard `dipole` reports.

import { C0, ETA0, nonNegative, positive, require_ } from './const.js'
import { quad, quadTo } from './integrate.js'

const EULER = 0.5772156649015329

/**
 * The pattern function of a centre-fed dipole of length L at wavelength lambda,
 * as a function of the angle theta from the wire's axis.
 *
 *   F(theta) = [cos((kL/2) cos theta) - cos(kL/2)] / sin theta
 *
 * At theta = 0 and pi the numerator and the denominator both vanish, and the
 * limit is zero: a dipole radiates nothing along its own wire. The function
 * returns exactly zero there rather than a ratio of two small numbers.
 */
export function dipolePattern(lengthOverLambda, thetaRad) {
  const kl2 = Math.PI * lengthOverLambda
  const s = Math.sin(thetaRad)
  if (Math.abs(s) < 1e-12) return 0
  return (Math.cos(kl2 * Math.cos(thetaRad)) - Math.cos(kl2)) / s
}

/**
 * The Hertzian dipole: a current element much shorter than a wavelength.
 *
 *   U(theta) proportional to sin^2 theta,  D = 3/2,  R_rad = 80 pi^2 (dl/lambda)^2
 *
 * The directivity of exactly 3/2 is one of the few numbers in antenna theory
 * that is a plain fraction, and `directivityOf` reproduces it by quadrature to
 * eleven figures, which is the check that the quadrature is right before it is
 * turned on the dipole.
 */
export function hertzianDipole(lengthOverLambda) {
  const u = positive(lengthOverLambda, 'lengthOverLambda')
  return {
    directivity: 1.5,
    directivityDbi: 10 * Math.log10(1.5),
    radiationResistance: 80 * Math.PI * Math.PI * u * u,
    pattern: (theta) => Math.sin(theta),
    guard: {
      quantity: 'element length over wavelength',
      value: u,
      threshold: 0.02,
      ok: u <= 0.02,
      says:
        u <= 0.02
          ? `The element is ${u.toPrecision(3)} wavelengths long, inside the one-fiftieth threshold, so the current is uniform along it.`
          : `The element is ${u.toPrecision(3)} wavelengths long, past the one-fiftieth threshold. The current is no longer uniform along it, and the finite dipole's pattern is the right one to use.`,
    },
  }
}

/**
 * The directivity of a pattern, by quadrature over the sphere.
 *
 *   D = 4 pi U_max / P_rad,  P_rad = integral of U sin(theta) dtheta dphi
 *
 * `pattern(theta)` returns the FIELD, and the power pattern is its square. The
 * integral is one-dimensional because every pattern in this module has rotational
 * symmetry about the wire, so the phi integral is 2 pi.
 *
 * Returns the directivity, its value in dBi, the angle of the maximum, and the
 * half-power beamwidth in degrees, found by bisection on the pattern rather
 * than from a formula.
 */
export function directivityOf(pattern, { points = 4000 } = {}) {
  const U = (t) => {
    const f = pattern(t)
    return f * f
  }
  // The maximum, found on a fine sweep and then refined by golden section.
  let best = 0
  let bestT = Math.PI / 2
  for (let k = 0; k <= points; k++) {
    const t = (Math.PI * k) / points
    const u = U(t)
    if (u > best) {
      best = u
      bestT = t
    }
  }
  const step = Math.PI / points
  let lo = Math.max(0, bestT - step)
  let hi = Math.min(Math.PI, bestT + step)
  for (let it = 0; it < 200; it++) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    if (U(m1) < U(m2)) lo = m1
    else hi = m2
  }
  const tMax = (lo + hi) / 2
  const Umax = U(tMax)
  const Prad = 2 * Math.PI * quad((t) => U(t) * Math.sin(t), 0, Math.PI, { n: 24, panels: 400 })
  const D = (4 * Math.PI * Umax) / Prad
  // The half-power points either side of the maximum, by bisection.
  const half = Umax / 2
  const findEdge = (from, to) => {
    let a = from
    let b = to
    if ((U(a) - half) * (U(b) - half) > 0) return null
    for (let it = 0; it < 200; it++) {
      const m = (a + b) / 2
      if ((U(a) - half) * (U(m) - half) <= 0) b = m
      else a = m
    }
    return (a + b) / 2
  }
  const left = findEdge(tMax, 0)
  const right = findEdge(tMax, Math.PI)
  const beamwidth = left !== null && right !== null ? ((right - left) * 180) / Math.PI : null
  return {
    directivity: D,
    directivityDbi: 10 * Math.log10(D),
    Prad,
    Umax,
    thetaMaxDeg: (tMax * 180) / Math.PI,
    beamwidthDeg: beamwidth,
  }
}

/** The cosine integral Ci(x), by quadrature on its convergent form. */
export function cosineIntegral(x) {
  positive(x, 'x')
  // Ci(x) = gamma + ln x + integral from 0 to x of (cos t - 1) / t dt.
  // The integrand is smooth at zero, where it tends to zero, so the quadrature
  // needs no special case there.
  const f = (t) => (t === 0 ? 0 : (Math.cos(t) - 1) / t)
  return EULER + Math.log(x) + quadTo(f, 0, x, { n: 24, tol: 1e-14 }).value
}

/** The sine integral Si(x), by quadrature. */
export function sineIntegral(x) {
  nonNegative(x, 'x')
  if (x === 0) return 0
  return quadTo((t) => (t === 0 ? 1 : Math.sin(t) / t), 0, x, { n: 24, tol: 1e-14 }).value
}

/**
 * A centre-fed dipole of length `lengthOverLambda` wavelengths.
 *
 * Returns the pattern, the directivity by quadrature, the half-power beamwidth,
 * and the radiation resistance referred to the feed and to the current maximum.
 * For the half-wave dipole the radiation resistance also has a closed form,
 *
 *   R_rad = (eta / 4 pi) [gamma + ln(2 pi) - Ci(2 pi)]
 *
 * and the function computes Ci by quadrature rather than quoting the number.
 * The two routes agree, which is the check that the quadrature is sound.
 *
 * The guard is the thin-wire assumption. The current is taken to be the
 * standing wave sin(k (L/2 - |z|)), which is the current a lossless open line
 * carries, and it holds for a wire thin against a wavelength. `wireRadius`, if
 * given in wavelengths, is measured against a threshold of one five-hundredth.
 */
export function dipole(lengthOverLambda, { wireRadius } = {}) {
  const u = positive(lengthOverLambda, 'lengthOverLambda')
  const pattern = (theta) => dipolePattern(u, theta)
  const d = directivityOf(pattern)
  const out = {
    lengthOverLambda: u,
    pattern,
    ...d,
    current: (zOverLambda) => Math.sin(2 * Math.PI * (u / 2 - Math.abs(zOverLambda))),
  }
  // The radiated power, from the pattern's own integral over the sphere. With a
  // feed current of one ampere peak,
  //
  //   P_rad = (eta / 4 pi) integral of |F|^2 sin(theta) dtheta
  //
  // and the resistance is 2 P_rad over the square of the current it is referred
  // to. Two currents are worth referring to, and the dipole group uses both.
  // The FEED current is what a source drives, and it is what a matching network
  // sees. The current MAXIMUM along the wire is what the pattern is written
  // from, and it is the one that stays finite when the feed current does not.
  const kl = 2 * Math.PI * u
  const feed = Math.abs(Math.sin(kl / 2))
  const iMax = u >= 0.5 ? 1 : feed
  const Prad =
    (ETA0 / (4 * Math.PI)) *
    quad(
      (t) => {
        const fv = pattern(t)
        return fv * fv * Math.sin(t)
      },
      0,
      Math.PI,
      { n: 24, panels: 400 },
    )
  out.radiatedPower = Prad
  out.radiationResistance = feed < 1e-9 ? Infinity : (2 * Prad) / (feed * feed)
  out.radiationResistanceAtMax = (2 * Prad) / (iMax * iMax)
  out.radiationResistanceFormula = 'R = 2 P_rad / I^2, with P_rad the pattern integrated over the sphere'
  if (Math.abs(u - 0.5) < 1e-12) {
    // The half-wave dipole has a closed form for the same number, and the two
    // agree to the quadrature's accuracy. The familiar 73.13 ohms comes from
    // rounding eta / 4 pi to 30, and the exact coefficient gives 73.08.
    out.radiationResistanceClosed = (ETA0 / (4 * Math.PI)) * (EULER + Math.log(2 * Math.PI) - cosineIntegral(2 * Math.PI))
    out.radiationResistanceFormula = 'R = (eta / 4 pi) [gamma + ln(2 pi) - Ci(2 pi)], the same number as the integral'
    out.roundedCoefficient = 30 * (EULER + Math.log(2 * Math.PI) - cosineIntegral(2 * Math.PI))
  }
  if (wireRadius !== undefined) {
    const r = positive(wireRadius, 'wireRadius')
    out.guard = {
      quantity: 'wire radius in wavelengths',
      value: r,
      threshold: 0.002,
      ok: r <= 0.002,
      says:
        r <= 0.002
          ? `The wire is ${r.toPrecision(3)} wavelengths thick, inside the threshold of 0.002, so the assumed sinusoidal current holds.`
          : `The wire is ${r.toPrecision(3)} wavelengths thick, past the threshold of 0.002. A fat dipole's current is not the assumed sinusoid, its resonance shifts down and its bandwidth widens, so these figures are for the thin wire only.`,
    }
  }
  return out
}

/** The gain of an antenna of directivity D and radiation efficiency e: G = e D. */
export function gainOf(directivity, efficiency = 1) {
  const e = positive(efficiency, 'efficiency')
  require_(e <= 1, `Radiation efficiency is a fraction at or below 1, and it is ${e}.`, { field: 'efficiency' })
  const G = e * directivity
  return { gain: G, gainDbi: 10 * Math.log10(G), efficiency: e, lossDb: -10 * Math.log10(e) }
}

/**
 * Radiation efficiency from the two resistances a feed point sees:
 * e = R_rad / (R_rad + R_loss). The loss resistance is the wire's own, which
 * the first half's skin-effect group computes.
 */
export const efficiencyOf = (Rrad, Rloss) => Rrad / (Rrad + nonNegative(Rloss, 'Rloss'))

/**
 * The array factor of `n` equally spaced identical elements.
 *
 *   psi = k d cos(theta) + beta
 *   AF  = sum over m of a_m exp(j m psi)
 *
 * For uniform amplitudes this sums to sin(n psi / 2) / sin(psi / 2), and the
 * normalised magnitude divides by n. `beta` in degrees is the progressive phase
 * shift between elements, which is what steers the beam: zero points it
 * broadside, and -k d points it along the array.
 *
 * `amplitudes` takes a taper, so a lesson can show a binomial or Chebyshev
 * array trading beamwidth for sidelobes. The sum is done term by term when a
 * taper is given, because the closed form is the uniform case only.
 */
export function arrayFactor({ n, spacingOverLambda, betaDeg = 0, amplitudes } = {}) {
  const N = Math.round(positive(n, 'n'))
  const d = positive(spacingOverLambda, 'spacingOverLambda')
  const beta = (betaDeg * Math.PI) / 180
  const k = 2 * Math.PI
  const uniform = !amplitudes
  if (amplitudes) require_(amplitudes.length === N, `amplitudes has ${amplitudes.length} entries for ${N} elements.`, { field: 'amplitudes' })
  const psiOf = (theta) => k * d * Math.cos(theta) + beta
  const mag = (theta) => {
    const psi = psiOf(theta)
    if (uniform) {
      const s = Math.sin(psi / 2)
      if (Math.abs(s) < 1e-12) return 1
      return Math.abs(Math.sin((N * psi) / 2) / (N * s))
    }
    let re = 0
    let im = 0
    for (let m = 0; m < N; m++) {
      re += amplitudes[m] * Math.cos(m * psi)
      im += amplitudes[m] * Math.sin(m * psi)
    }
    const total = amplitudes.reduce((a, b) => a + b, 0)
    return Math.hypot(re, im) / total
  }
  // Where the beam points: the theta at which psi is zero, when there is one.
  const cosMain = -beta / (k * d)
  const mainDeg = Math.abs(cosMain) <= 1 ? (Math.acos(cosMain) * 180) / Math.PI : null
  const d2 = directivityOf(mag)
  return {
    n: N,
    spacingOverLambda: d,
    betaDeg,
    psiOf,
    mag,
    mainBeamDeg: mainDeg,
    grating: gratingLobes(d, beta, k),
    ...d2,
  }
}

/**
 * Where the array's grating lobes are, and whether it has any.
 *
 * A grating lobe is a second direction in which every element adds in phase,
 * and it appears once the spacing passes a wavelength (or half of one for an
 * array steered to end-fire). The function returns the angles, and an empty
 * list is the answer for a spacing that has none.
 */
function gratingLobes(d, beta, k) {
  const out = []
  for (let m = -6; m <= 6; m++) {
    if (m === 0) continue
    const c = (2 * Math.PI * m - beta) / (k * d)
    if (Math.abs(c) <= 1) out.push({ order: m, thetaDeg: (Math.acos(c) * 180) / Math.PI })
  }
  return out
}

/**
 * The Friis transmission equation.
 *
 *   P_r / P_t = G_t G_r (lambda / 4 pi R)^2
 *
 * Exact for two antennas in each other's far field, matched, aligned and
 * co-polarised. Every one of those four conditions is a place a real link loses
 * decibels, and `budget` lists them so a lesson can add them up.
 *
 * The far-field condition is the guard. The Fraunhofer distance is 2 D^2 /
 * lambda for an aperture of largest dimension D, and a link shorter than that
 * is not in the regime the equation describes.
 */
export function friis({ f, distance, gainT = 1, gainR = 1, powerT = 1, apertureT, apertureR }) {
  positive(f, 'f')
  const R = positive(distance, 'distance')
  const lambda = C0 / f
  const spread = (lambda / (4 * Math.PI * R)) ** 2
  const Pr = powerT * gainT * gainR * spread
  const out = {
    lambda,
    freeSpaceLossDb: -10 * Math.log10(spread),
    received: Pr,
    receivedDbm: 10 * Math.log10(Pr / 1e-3),
    pathGainDb: 10 * Math.log10((gainT * gainR * spread)),
    spread,
  }
  const D = Math.max(apertureT || 0, apertureR || 0)
  if (D > 0) {
    const fraunhofer = (2 * D * D) / lambda
    out.guard = {
      quantity: 'link distance over the Fraunhofer distance',
      value: R / fraunhofer,
      threshold: 1,
      fraunhofer,
      ok: R >= fraunhofer,
      says:
        R >= fraunhofer
          ? `The link is ${(R / fraunhofer).toPrecision(3)} times the ${fraunhofer.toPrecision(3)} m far-field distance, so each antenna sees the other's far field and Friis holds.`
          : `The link is ${R.toPrecision(3)} m and the far-field distance is ${fraunhofer.toPrecision(3)} m. The two antennas are in each other's near field, where the pattern has not formed and gain does not mean what Friis assumes.`,
    }
  }
  return out
}

/** The effective aperture of an antenna of gain G: A = G lambda^2 / 4 pi. */
export const effectiveAperture = (gain, lambda) => (gain * lambda * lambda) / (4 * Math.PI)

export { C0, ETA0 }
