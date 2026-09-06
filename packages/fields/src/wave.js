// Maxwell's equations as a wave: the plane wave in a medium, its polarisation,
// and what happens at an interface.
//
// Everything here is exact and none of it is hedged. A lossy medium's
// propagation constant is a complex square root, which is exact arithmetic, and
// a lossy medium's wave impedance is another. The one place this package
// declines is the LOSSY LINE IN TIME, and that refusal lives in line.js, not
// here, because a plane wave in a lossy medium at one frequency is exactly
// solvable and only its time-domain pulse is not.
//
// The convention: a wave travelling in +z is written E(z) = E0 exp(-gamma z)
// with gamma = alpha + j beta, so alpha is the attenuation in nepers per metre
// and beta the phase constant in radians per metre. Time dependence is
// exp(j omega t).

import { complex as cx } from '@ee-labs/network'
import { EPS0, ETA0, MU0, C0, nonNegative, positive, require_ } from './const.js'

// The complex arithmetic is @ee-labs/network's, reused rather than rewritten.
// A complex number is [re, im] there and here, and phasor.js already sweeps
// with it, so the two packages speak one representation.
const { C, cabs, cadd, carg, cdiv, cmul, cscale, csub } = cx

/** The principal square root of a complex number. */
export function csqrt(z) {
  const r = Math.sqrt(cabs(z))
  const t = carg(z) / 2
  return [r * Math.cos(t), r * Math.sin(t)]
}

/**
 * A medium: `{ epsr, mur, sigma }`. Every wave function below takes one.
 * `sigma` is the conduction current's conductivity in siemens per metre, and
 * zero makes the medium lossless.
 */
export function describeMedium(m = {}) {
  return {
    epsr: positive(m.epsr ?? 1, 'epsr'),
    mur: positive(m.mur ?? 1, 'mur'),
    sigma: nonNegative(m.sigma ?? 0, 'sigma'),
    name: m.name || '',
  }
}

/**
 * The plane wave in a medium at frequency f.
 *
 * Returns alpha and beta in nepers and radians per metre, the complex intrinsic
 * impedance eta, the phase and group speeds, the wavelength, the loss tangent,
 * and the depth at which the amplitude falls to 1/e.
 *
 *   gamma = j omega sqrt(mu eps) sqrt(1 - j sigma / (omega eps))
 *   eta   = sqrt(j omega mu / (sigma + j omega eps))
 *
 * Both are exact. In a lossless medium eta is real and equals sqrt(mu/eps),
 * and alpha is exactly zero rather than a small number, because the square root
 * of a positive real is real.
 */
export function planeWave(f, medium = {}) {
  const m = describeMedium(medium)
  positive(f, 'f')
  const omega = 2 * Math.PI * f
  const eps = EPS0 * m.epsr
  const mu = MU0 * m.mur
  const lossTangent = m.sigma / (omega * eps)
  let alpha
  let beta
  let eta
  if (m.sigma === 0) {
    alpha = 0
    beta = omega * Math.sqrt(mu * eps)
    eta = C(Math.sqrt(mu / eps))
  } else {
    // gamma = j omega sqrt(mu (eps - j sigma / omega)). The bracket is the
    // complex permittivity, and the conduction current is the whole of its
    // imaginary part.
    const gamma = cmul(C(0, omega), csqrt(cscale(C(eps, -m.sigma / omega), mu)))
    alpha = gamma[0]
    beta = gamma[1]
    eta = csqrt(cdiv(C(0, omega * mu), C(m.sigma, omega * eps)))
  }
  const vp = beta === 0 ? Infinity : omega / beta
  return {
    f,
    omega,
    alpha,
    beta,
    gamma: [alpha, beta],
    eta,
    etaMag: cabs(eta),
    etaDeg: (carg(eta) * 180) / Math.PI,
    vp,
    lambda: beta === 0 ? Infinity : (2 * Math.PI) / beta,
    lambda0: C0 / f,
    n: C0 / vp,
    lossTangent,
    penetration: alpha === 0 ? Infinity : 1 / alpha,
    medium: m,
    lossless: m.sigma === 0,
  }
}

/**
 * Polarisation of a wave whose two transverse components are `ax` and `ay` with
 * `ay` lagging `ax` by `phaseDeg`.
 *
 * Returns the kind (linear, circular or elliptical), the axial ratio in
 * decibels, the tilt of the major axis in degrees, and the sense of rotation
 * seen by a receiver looking back along the direction of travel.
 *
 * The classification is exact and its boundaries are stated: circular needs the
 * two amplitudes equal and the phase a quarter cycle, and linear needs the
 * phase a whole number of half cycles. Anything else is elliptical, and the
 * axial ratio says how far from either it sits.
 */
export function polarisation({ ax = 1, ay = 1, phaseDeg = 0 } = {}) {
  nonNegative(ax, 'ax')
  nonNegative(ay, 'ay')
  require_(ax > 0 || ay > 0, 'A wave with no amplitude in either transverse direction has no polarisation.', { field: 'ax' })
  const d = ((((phaseDeg % 360) + 360) % 360) + 360) % 360
  const dr = (d * Math.PI) / 180
  const linear = Math.abs(Math.sin(dr)) < 1e-12
  const circular = !linear && Math.abs(ax - ay) < 1e-12 * Math.max(ax, ay) && Math.abs(Math.abs(Math.sin(dr)) - 1) < 1e-12
  // The ellipse the tip traces: the standard polarisation ellipse of two
  // orthogonal sinusoids with a phase difference.
  const num = 2 * ax * ay * Math.cos(dr)
  const den = ax * ax - ay * ay
  const tilt = 0.5 * Math.atan2(num, den)
  const c = Math.cos(tilt)
  const s = Math.sin(tilt)
  // Amplitudes along the ellipse's own axes.
  const major = Math.sqrt(Math.max(0, ax * ax * c * c + ay * ay * s * s + num * s * c))
  const minor = Math.sqrt(Math.max(0, ax * ax * s * s + ay * ay * c * c - num * s * c))
  const hi = Math.max(major, minor)
  const lo = Math.min(major, minor)
  const axialRatio = lo === 0 ? Infinity : hi / lo
  const sense = linear ? 'none' : Math.sin(dr) > 0 ? 'left hand' : 'right hand'
  return {
    kind: linear ? 'linear' : circular ? 'circular' : 'elliptical',
    axialRatio,
    axialRatioDb: lo === 0 ? Infinity : 20 * Math.log10(axialRatio),
    tiltDeg: (tilt * 180) / Math.PI,
    sense,
    major: hi,
    minor: lo,
    ax,
    ay,
    phaseDeg: d,
    /** The tip of the field vector at phase `wt` radians, for the app to draw. */
    at: (wt) => [ax * Math.cos(wt), ay * Math.cos(wt + dr)],
  }
}

/**
 * Reflection and transmission at normal incidence between two media.
 *
 *   Gamma = (eta2 - eta1) / (eta2 + eta1)
 *   tau   = 2 eta2 / (eta2 + eta1) = 1 + Gamma
 *
 * Returns both as complex numbers with their magnitudes and angles, the power
 * fractions, and the standing-wave ratio in medium 1. For two lossless media
 * the reflected and transmitted power fractions sum to one exactly, and
 * wave.test.js checks that on every fuzzed pair.
 */
export function reflectNormal(f, medium1, medium2) {
  const w1 = planeWave(f, medium1)
  const w2 = planeWave(f, medium2)
  const gamma = cdiv(csub(w2.eta, w1.eta), cadd(w2.eta, w1.eta))
  const tau = cadd(C(1), gamma)
  const mag = cabs(gamma)
  const powerReflected = mag * mag
  // The transmitted power fraction, from the Poynting vectors on the two sides.
  const t2 = cabs(tau) * cabs(tau)
  const powerTransmitted = t2 * (cabs(w1.eta) / cabs(w2.eta)) * (Math.cos(carg(w2.eta)) / Math.cos(carg(w1.eta)))
  return {
    gamma,
    tau,
    mag,
    deg: (carg(gamma) * 180) / Math.PI,
    tauMag: cabs(tau),
    tauDeg: (carg(tau) * 180) / Math.PI,
    powerReflected,
    powerTransmitted,
    swr: standingWaveRatio(mag),
    eta1: w1.eta,
    eta2: w2.eta,
    wave1: w1,
    wave2: w2,
  }
}

/** The standing-wave ratio for a reflection coefficient magnitude: (1 + m) / (1 - m). */
export function standingWaveRatio(mag) {
  nonNegative(mag, 'mag')
  return mag >= 1 ? Infinity : (1 + mag) / (1 - mag)
}

/**
 * The standing wave in front of a reflecting interface.
 *
 * The total field a distance z in FRONT of the interface (z positive going back
 * towards the source) is E0 (exp(j beta z) + Gamma exp(-j beta z)), whose
 * magnitude runs between 1 + |Gamma| and 1 - |Gamma|. Returns the ratio, the
 * distance from the interface to the first minimum, and a sampler the app plots.
 *
 * The first minimum sits where the two terms are half a cycle apart. The
 * incident term's phase at z is beta z and the reflected term's is
 * angle(Gamma) - beta z, so they oppose where 2 beta z - angle(Gamma) is pi:
 *
 *   z_min = (pi + angle(Gamma)) / (2 beta)
 *
 * That is the measurement a slotted line makes, read the other way. A minimum
 * found at z gives the load's reflection phase as 2 beta z - pi, which is what
 * the Smith chart turns into a load impedance.
 */
export function standingWave(gamma, beta, { E0 = 1 } = {}) {
  const g = Array.isArray(gamma) ? gamma : C(gamma)
  const mag = cabs(g)
  const ang = carg(g)
  const period = Math.PI / beta
  // Wrapped into the first period, so the answer is the FIRST minimum and not
  // one an integer number of half wavelengths further along.
  const firstMin = (((Math.PI + ang) / (2 * beta)) % period + period) % period
  return {
    swr: standingWaveRatio(mag),
    max: E0 * (1 + mag),
    min: E0 * (1 - mag),
    firstMinAt: firstMin,
    period,
    at: (z) => {
      const inc = [Math.cos(beta * z), Math.sin(beta * z)]
      const ref = cmul(g, [Math.cos(-beta * z), Math.sin(-beta * z)])
      const total = cadd(inc, ref)
      return { mag: E0 * cabs(total), deg: (carg(total) * 180) / Math.PI }
    },
  }
}

/**
 * Oblique incidence between two lossless dielectrics: the Fresnel coefficients,
 * the transmitted angle from Snell's law, the Brewster angle where the parallel
 * polarisation reflects nothing, and the critical angle where nothing is
 * transmitted at all.
 *
 * `pol` is 'perpendicular' (E out of the plane of incidence, the TE case) or
 * 'parallel' (E in it, TM). Both are returned, so a lesson can show them
 * together, and `gamma` is the one `pol` named.
 *
 * Past the critical angle the transmitted wave is evanescent. It carries no
 * power away, the reflection has unit magnitude and a phase, and the function
 * says so in `total` rather than returning a complex angle without comment.
 */
export function reflectOblique(thetaDeg, medium1, medium2, pol = 'perpendicular') {
  const m1 = describeMedium(medium1)
  const m2 = describeMedium(medium2)
  require_(m1.sigma === 0 && m2.sigma === 0, 'Oblique incidence here is between two lossless dielectrics. A conducting medium bends the transmitted angle into the complex plane, and this package declines that case.', { field: 'sigma' })
  require_(pol === 'perpendicular' || pol === 'parallel', `pol must be 'perpendicular' or 'parallel', and it is ${pol}.`, { field: 'pol' })
  const th = (thetaDeg * Math.PI) / 180
  require_(th >= 0 && th < Math.PI / 2, `The angle of incidence is measured from the normal and must be under 90 degrees. It is ${thetaDeg}.`, { field: 'thetaDeg' })
  const n1 = Math.sqrt(m1.epsr * m1.mur)
  const n2 = Math.sqrt(m2.epsr * m2.mur)
  const eta1 = ETA0 * Math.sqrt(m1.mur / m1.epsr)
  const eta2 = ETA0 * Math.sqrt(m2.mur / m2.epsr)
  const sinT = (n1 / n2) * Math.sin(th)
  const total = sinT > 1
  const critical = n2 < n1 ? (Math.asin(n2 / n1) * 180) / Math.PI : null
  const brewster = (Math.atan(n2 / n1) * 180) / Math.PI
  const cosI = Math.cos(th)
  // Past the critical angle the transmitted cosine is imaginary, which is the
  // evanescent wave, and the reflection coefficient keeps unit magnitude.
  const cosT = total ? C(0, Math.sqrt(sinT * sinT - 1)) : C(Math.sqrt(1 - sinT * sinT))
  const perp = fresnel(C(eta2), cosI, C(eta1), cosT, true)
  const para = fresnel(C(eta2), cosI, C(eta1), cosT, false)
  const chosen = pol === 'perpendicular' ? perp : para
  return {
    thetaDeg,
    transmittedDeg: total ? null : (Math.asin(sinT) * 180) / Math.PI,
    total,
    criticalDeg: critical,
    brewsterDeg: brewster,
    n1,
    n2,
    perpendicular: perp,
    parallel: para,
    gamma: chosen.gamma,
    mag: chosen.mag,
    deg: chosen.deg,
    powerReflected: chosen.mag * chosen.mag,
  }
}

/** One Fresnel coefficient, from the two impedances and the two cosines. */
function fresnel(eta2, cosI, eta1, cosT, perpendicular) {
  // Perpendicular: Gamma = (eta2 cos i - eta1 cos t) / (eta2 cos i + eta1 cos t)
  // Parallel:      Gamma = (eta2 cos t - eta1 cos i) / (eta2 cos t + eta1 cos i)
  const a = perpendicular ? cscale(eta2, cosI) : cmul(eta2, cosT)
  const b = perpendicular ? cmul(eta1, cosT) : cscale(eta1, cosI)
  const gamma = cdiv(csub(a, b), cadd(a, b))
  return { gamma, mag: cabs(gamma), deg: (carg(gamma) * 180) / Math.PI, tau: cadd(C(1), gamma) }
}

export { C0, EPS0, ETA0, MU0 }
