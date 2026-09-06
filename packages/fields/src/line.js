// The transmission line: the telegrapher's equations, and everything that
// follows from them at one frequency.
//
// This is the module CORE_SCOPE.md's worked-refusal row is about. The table in
// that document reads:
//
//   Transmission-line delay e^(-j beta l) | No. Transcendental, no finite poles
//   or zeros | Refuse at the `systems` boundary.
//
// That refusal is about `@ee-labs/systems`, whose currency is rational transfer
// functions. It is not a refusal to compute the line. A line's response AT ONE
// FREQUENCY is a closed form in complex arithmetic, exact to the last bit, and
// this module states it without a hedge. What the suite declines is turning a
// line into a rational H(s) so that a pole-zero view can hold it, and what
// THIS module declines is the lossy line in TIME, for the reason in
// `refuseLossyTime` below.
//
// So the line appears in three admitted forms and one refused one:
//
//   lossless, frequency domain   exact       lineAt, inputImpedance, sMatrix
//   lossy, frequency domain      exact       the same functions, gamma complex
//   lossless, time domain        exact       bounce.js, a finite event sum
//   lossy, time domain           DECLINED    refuseLossyTime, with the reason
//
// The last one is not missing work. A lossy line's step response is a
// continuum: every frequency travels at its own speed and decays by its own
// amount, so the pulse spreads and no finite set of arrivals describes it.
// There is no state to advance and no event to schedule. The refusal is the
// content, and it has a test.

import { complex as cx } from '@ee-labs/network'
import { C0, EPS0, FieldsError, MU0, nonNegative, positive, require_ } from './const.js'
import { capacitance, inductance } from './closed.js'
import { csqrt, standingWaveRatio } from './wave.js'

const { C, cabs, cadd, carg, cdiv, cmul, cscale, csub } = cx

/** Complex hyperbolic tangent, tanh(z) = sinh(z) / cosh(z), for the general line. */
export function ctanh(z) {
  const [x, y] = z
  // Written from the real and imaginary parts so that a large x does not
  // overflow before the division cancels it.
  const t = Math.tanh(x)
  const ty = Math.tan(y)
  const num = C(t, ty)
  const den = C(1, t * ty)
  return cdiv(num, den)
}

/** Complex hyperbolic cosine and sine, for the ABCD matrix. */
export const ccosh = (z) => C(Math.cosh(z[0]) * Math.cos(z[1]), Math.sinh(z[0]) * Math.sin(z[1]))
export const csinh = (z) => C(Math.sinh(z[0]) * Math.cos(z[1]), Math.cosh(z[0]) * Math.sin(z[1]))

/**
 * A line description. Two ways in, and they produce the same object.
 *
 *   describeLine({ Z0: 50, vp: 2e8, len: 1 })            by its measured pair
 *   describeLine({ R: 0, L: 250e-9, G: 0, C: 100e-12, len: 1 })  by the per-metre four
 *
 * `R` and `G` in ohms and siemens per metre are the losses, and both zero makes
 * the line lossless. A line given as (Z0, vp) is lossless by construction, and
 * `lossy` says which kind is in hand.
 */
export function describeLine(spec) {
  require_(spec && typeof spec === 'object', 'A line needs a description object.', { field: 'line' })
  const len = positive(spec.len ?? 1, 'len')
  // The per-metre four win over (Z0, vp), and the order matters. A described
  // line carries BOTH, because the (Z0, vp) branch derives L and C, so a
  // description read a second time must take the branch that keeps the losses.
  // Reading the other branch first would quietly turn a lossy line into a
  // lossless one, which is the one mistake this module must not make.
  if (spec.L !== undefined && spec.C !== undefined) return fromRLGC(spec, len)
  if (spec.Z0 !== undefined) {
    const Z0 = positive(spec.Z0, 'Z0')
    const vp = positive(spec.vp ?? C0, 'vp')
    require_(vp <= C0 * 1.0000001, `A signal cannot travel at ${vp} m/s. The phase velocity must not exceed the speed of light.`, { field: 'vp' })
    const Lp = Z0 / vp
    const Cp = 1 / (Z0 * vp)
    return { R: 0, L: Lp, G: 0, C: Cp, len, Z0, vp, lossy: false, delay: len / vp, source: 'Z0 and vp' }
  }
  return fromRLGC(spec, len)
}

function fromRLGC(spec, len) {
  const L = positive(spec.L, 'L')
  const Cap = positive(spec.C, 'C')
  const R = nonNegative(spec.R ?? 0, 'R')
  const G = nonNegative(spec.G ?? 0, 'G')
  const vp = 1 / Math.sqrt(L * Cap)
  return {
    R,
    L,
    G,
    C: Cap,
    len,
    Z0: Math.sqrt(L / Cap),
    vp,
    lossy: R > 0 || G > 0,
    delay: len / vp,
    source: 'R, L, G and C per metre',
  }
}

/**
 * A line built from a geometry, so that the per-metre four are the closed forms
 * of the first half rather than numbers typed in.
 *
 * For a coaxial or two-wire geometry, L' and C' come from closed.js, the phase
 * velocity is 1 / sqrt(L'C') and it equals c / sqrt(epsr mur) exactly. That
 * identity is the seam between the two halves of this lab, and line.test.js
 * checks it on every fuzzed geometry.
 */
export function lineFromGeometry(geometry, { len = 1, sigmaDielectric = 0 } = {}) {
  const Cp = capacitance(geometry).perMetre
  const Lp = inductance(geometry).perMetre
  require_(
    Cp !== null && Lp !== null,
    'A line needs a geometry with a per-metre capacitance and inductance. A sphere and a solenoid have neither.',
    { field: 'kind' },
  )
  const G = sigmaDielectric > 0 ? (sigmaDielectric * Cp) / (EPS0 * (geometry.epsr ?? 1)) : 0
  return describeLine({ L: Lp, C: Cp, R: 0, G, len })
}

/**
 * The line at frequency f: the propagation constant and the characteristic
 * impedance, both complex, both exact.
 *
 *   gamma = sqrt((R + j omega L)(G + j omega C))
 *   Z0    = sqrt((R + j omega L) / (G + j omega C))
 *
 * On a lossless line gamma is exactly j omega sqrt(LC) and Z0 is exactly the
 * real sqrt(L/C), computed by the lossless branch rather than by a complex
 * square root that would leave a rounding error in the real part.
 */
export function lineAt(line, f) {
  const ln = describeLine(line)
  positive(f, 'f')
  const omega = 2 * Math.PI * f
  if (!ln.lossy) {
    const beta = omega * Math.sqrt(ln.L * ln.C)
    return {
      line: ln,
      f,
      omega,
      gamma: C(0, beta),
      alpha: 0,
      beta,
      Z0: C(ln.Z0),
      Z0mag: ln.Z0,
      lambda: (2 * Math.PI) / beta,
      vp: omega / beta,
      electricalDeg: (beta * ln.len * 180) / Math.PI,
      lossless: true,
    }
  }
  const z = C(ln.R, omega * ln.L)
  const y = C(ln.G, omega * ln.C)
  const gamma = csqrt(cmul(z, y))
  const Z0 = csqrt(cdiv(z, y))
  const beta = gamma[1]
  return {
    line: ln,
    f,
    omega,
    gamma,
    alpha: gamma[0],
    beta,
    Z0,
    Z0mag: cabs(Z0),
    Z0deg: (carg(Z0) * 180) / Math.PI,
    lambda: (2 * Math.PI) / beta,
    vp: omega / beta,
    electricalDeg: (beta * ln.len * 180) / Math.PI,
    lossless: false,
    dbPerMetre: gamma[0] * 8.685889638065035,
  }
}

/** The reflection coefficient of a load against a reference impedance: (ZL - Z0) / (ZL + Z0). */
export function reflectionCoefficient(ZL, Z0) {
  const zl = toComplex(ZL)
  const z0 = toComplex(Z0)
  if (zl === Infinity) return C(1)
  return cdiv(csub(zl, z0), cadd(zl, z0))
}

/** The load a reflection coefficient stands for: Z0 (1 + G) / (1 - G). */
export function loadFromGamma(gamma, Z0) {
  const g = toComplex(gamma)
  const z0 = toComplex(Z0)
  const den = csub(C(1), g)
  if (cabs(den) < 1e-15) return Infinity
  return cmul(z0, cdiv(cadd(C(1), g), den))
}

/** A number, a [re, im] pair, or Infinity for an open circuit. */
export function toComplex(z) {
  if (z === Infinity) return Infinity
  return Array.isArray(z) ? z : C(Number(z), 0)
}

/**
 * The impedance seen looking into a line of length l terminated in ZL.
 *
 *   Zin = Z0 (ZL + Z0 tanh(gamma l)) / (Z0 + ZL tanh(gamma l))
 *
 * On a lossless line tanh(j beta l) is j tan(beta l), and the expression is the
 * familiar one. An open load is handled as its own case rather than by dividing
 * a large number, so a quarter-wave open stub reports a short exactly.
 *
 * `atLength` overrides the line's own length, which is what the length sweep
 * uses.
 */
export function inputImpedance(line, ZL, f, { atLength } = {}) {
  const at = lineAt(line, f)
  const l = atLength === undefined ? at.line.len : positive(atLength, 'atLength')
  const t = ctanh(cscale(at.gamma, l))
  const zl = toComplex(ZL)
  const z0 = at.Z0
  if (zl === Infinity) {
    // An open load: Zin = Z0 / tanh(gamma l), or infinite where the tangent is zero.
    if (cabs(t) < 1e-15) return { Z: Infinity, at, l, open: true }
    return { Z: cdiv(z0, t), at, l }
  }
  const num = cadd(zl, cmul(z0, t))
  const den = cadd(z0, cmul(zl, t))
  if (cabs(den) < 1e-18 * Math.max(1, cabs(num))) return { Z: Infinity, at, l }
  return { Z: cmul(z0, cdiv(num, den)), at, l }
}

/**
 * The quarter-wave transformer: the characteristic impedance a quarter-wave
 * section needs to turn ZL into Zin.
 *
 *   Z0 = sqrt(Zin ZL)
 *
 * Exact for two real impedances on a lossless line, and the function requires
 * both to be real, because the geometric mean of two complex impedances does
 * not match a complex load with a single line. A reactive load needs a matching
 * network, which is the RF Lab's subject, and the message says so.
 */
export function quarterWave(Zin, ZL, { f, vp = C0 } = {}) {
  const zin = toComplex(Zin)
  const zl = toComplex(ZL)
  require_(zin !== Infinity && zl !== Infinity, 'A quarter-wave transformer cannot match an open circuit.', { field: 'ZL' })
  require_(
    Math.abs(zin[1]) < 1e-12 * Math.max(1, Math.abs(zin[0])) && Math.abs(zl[1]) < 1e-12 * Math.max(1, Math.abs(zl[0])),
    'A quarter-wave transformer matches two REAL impedances. A reactive load needs a matching network, which the RF Lab builds. Cancel the reactance first, then transform what is left.',
    { field: 'ZL' },
  )
  require_(zin[0] > 0 && zl[0] > 0, 'Both impedances must be positive resistances.', { field: 'ZL' })
  const Z0 = Math.sqrt(zin[0] * zl[0])
  const out = { Z0, gammaAtLoad: (zl[0] - Z0) / (zl[0] + Z0) }
  if (f) {
    const lambda = vp / f
    out.length = lambda / 4
    out.lambda = lambda
  }
  return out
}

/**
 * The two-port scattering matrix of a length of line, referred to `Zref`.
 *
 * For a line whose own Z0 equals Zref this is the pure delay: S11 = S22 = 0 and
 * S21 = S12 = exp(-gamma l). For any other reference it is the full expression,
 * and it is reciprocal (S21 equals S12) for any passive line, which is the
 * invariant line.test.js fuzzes.
 */
export function sMatrix(line, f, Zref = 50) {
  const at = lineAt(line, f)
  const zr = C(positive(Zref, 'Zref'))
  const gl = cscale(at.gamma, at.line.len)
  const ch = ccosh(gl)
  const sh = csinh(gl)
  const z0 = at.Z0
  // From the ABCD matrix [[cosh, Z0 sinh], [sinh/Z0, cosh]].
  const A = ch
  const B = cmul(z0, sh)
  const Cc = cdiv(sh, z0)
  const D = ch
  const den = cadd(cadd(A, cdiv(B, zr)), cadd(cmul(Cc, zr), D))
  const s11 = cdiv(csub(cadd(A, cdiv(B, zr)), cadd(cmul(Cc, zr), D)), den)
  const s12 = cdiv(cscale(csub(cmul(A, D), cmul(B, Cc)), 2), den)
  const s21 = cdiv(C(2), den)
  const s22 = cdiv(cadd(csub(cdiv(B, zr), A), csub(D, cmul(Cc, zr))), den)
  return { s11, s12, s21, s22, abcd: { A, B, C: Cc, D }, at, Zref }
}

/**
 * The standing wave on a line: the reflection coefficient at the load, its
 * magnitude everywhere along a lossy line, the standing-wave ratio, and the
 * mismatch loss.
 *
 * On a lossy line the reflection coefficient seen a distance d back from the
 * load is Gamma_L exp(-2 gamma d), so the standing wave flattens as the line
 * gets longer. `atDistance` gives that, and the ratio it produces.
 */
export function lineStandingWave(line, ZL, f) {
  const at = lineAt(line, f)
  const gL = reflectionCoefficient(ZL, at.Z0)
  const mag = cabs(gL)
  return {
    at,
    gamma: gL,
    mag,
    deg: (carg(gL) * 180) / Math.PI,
    swr: standingWaveRatio(mag),
    returnLossDb: mag === 0 ? Infinity : -20 * Math.log10(mag),
    mismatchLossDb: mag >= 1 ? Infinity : -10 * Math.log10(1 - mag * mag),
    atDistance: (d) => {
      const g = cmul(gL, cx.cexpj(-2 * at.beta * d))
      const decayed = cscale(g, Math.exp(-2 * at.alpha * d))
      return { gamma: decayed, mag: cabs(decayed), swr: standingWaveRatio(cabs(decayed)) }
    },
  }
}

/**
 * The Smith chart's mapping, both ways, and the two families of circles it is
 * drawn from. The chart itself is the RF Lab's canvas. This is the arithmetic
 * under it, which is a bilinear map and nothing more.
 *
 *   z = Z / Z0        the normalised impedance
 *   Gamma = (z - 1) / (z + 1)
 *
 * A constant-resistance circle of normalised resistance r has centre
 * (r/(1+r), 0) and radius 1/(1+r). A constant-reactance arc of normalised
 * reactance x has centre (1, 1/x) and radius |1/x|. Both fall straight out of
 * the map, and smith.test.js checks that points on each circle map back to the
 * value the circle is labelled with.
 */
export const normalise = (Z, Z0) => (Z === Infinity ? Infinity : cdiv(toComplex(Z), toComplex(Z0)))
export const zToGamma = (z) => (z === Infinity ? C(1) : cdiv(csub(toComplex(z), C(1)), cadd(toComplex(z), C(1))))
export const gammaToZ = (g) => {
  const den = csub(C(1), toComplex(g))
  return cabs(den) < 1e-15 ? Infinity : cdiv(cadd(C(1), toComplex(g)), den)
}

/** The constant-resistance circle for normalised resistance r, in the gamma plane. */
export const resistanceCircle = (r) => ({ cx: r / (1 + r), cy: 0, radius: 1 / (1 + r) })

/** The constant-reactance arc for normalised reactance x, in the gamma plane. */
export const reactanceCircle = (x) => ({ cx: 1, cy: 1 / x, radius: Math.abs(1 / x) })

/**
 * Moving along the line towards the generator, on the chart: a rotation
 * clockwise by 2 beta d, and a shrink by exp(-2 alpha d) on a lossy line.
 * One half wavelength is a full turn, which is the chart's whole trick.
 */
export function towardsGenerator(gamma, betaD, alphaD = 0) {
  return cscale(cmul(toComplex(gamma), cx.cexpj(-2 * betaD)), Math.exp(-2 * alphaD))
}

/**
 * The lossy line in time, declined.
 *
 * A lossless line's step response is a finite sum of arrivals, because every
 * frequency travels at the same speed and none of them decays. bounce.js
 * computes it exactly. A lossy line has neither property. The phase velocity
 * omega / beta depends on frequency, so the parts of a step arrive at different
 * times and the edge spreads. There is no finite set of arrivals to schedule
 * and no state to advance between them, so no event loop describes the answer.
 *
 * Every approximation on offer here would be a different object: a few terms of
 * an inverse transform, a lumped ladder of N sections, a Pade delay. Under
 * CORE_SCOPE Rule 2 a refused bridge is a finished feature, so this function
 * throws with the reason rather than shipping the nearest thing.
 *
 * What IS available is named in the message, because a refusal that does not
 * say where to go is only half of one. The frequency-domain response of the
 * same lossy line is exact at every frequency, and `lineAt` and `sMatrix`
 * compute it.
 */
export function refuseLossyTime(line) {
  const ln = describeLine(line)
  require_(
    ln.lossy,
    'This line is lossless, and its time-domain response is exact. Use bounceDiagram, which computes it as a finite sum of arrivals.',
    { field: 'R' },
  )
  throw new FieldsError(
    `This line loses energy, with R = ${ln.R} ohms per metre and G = ${ln.G} siemens per metre, so its step response has no finite set of arrivals. Every frequency travels at its own speed, the edge spreads as it goes, and no event loop can describe it. The frequency-domain response of the same line is exact at every frequency: use lineAt and sMatrix, and sweep.`,
    { field: 'time', R: ln.R, G: ln.G, kind: 'lossy-line-in-time' },
  )
}

/**
 * Whether a line's time-domain response is available, and why not when it is
 * not. The app calls this before offering the bounce diagram, so the refusal
 * arrives as a sentence on the panel and not as an exception.
 */
export function timeDomainAvailable(line) {
  const ln = describeLine(line)
  if (!ln.lossy) return { ok: true, says: 'The line is lossless, so its step response is a finite sum of arrivals and the bounce diagram is exact.' }
  return {
    ok: false,
    says: `The line loses energy, with R = ${ln.R} ohms per metre and G = ${ln.G} siemens per metre. Every frequency travels at its own speed, so the edge spreads and no finite set of arrivals describes the answer. The frequency-domain response of this same line is exact at every frequency.`,
  }
}

export { C0, EPS0, MU0, standingWaveRatio }
