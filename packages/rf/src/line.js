// The line as a two-port at one frequency, and the transfer function it does
// not have.
//
// CORE_SCOPE classes, both of them, in one file.
//
//   ADMITTED, EXACT: the uniform line's chain matrix at a frequency. Every
//   entry is cosh(γl) or sinh(γl) evaluated in complex arithmetic, with no
//   series truncation. A reader who asks for 241 frequencies gets 241 exact
//   answers.
//
//   DECLINED: the same line as a rational H(s). e^{−γl} is transcendental, so
//   no ratio of polynomials equals it and no finite set of poles describes it.
//   `refuseRational` throws with that reason and `rationalAvailable` returns it
//   as a sentence for the pane. Rule 2 says a refused bridge is a finished
//   feature, so nothing here ships the nearest approximation instead.
//
// Where Z0 and γ come from is the Fields Lab's, and this module evaluates
// rather than derives. `describeLine` and `lineAt` are that lab's, imported
// rather than copied, so the two labs cannot disagree about what a line is.

import { complex as cx } from '@ee-labs/network'
import { ccosh, csinh, describeLine, inputImpedance, lineAt } from '@ee-labs/fields'
import { RfError, nonNegative, positive, require_ } from './const.js'
import { abcdToS } from './convert.js'
import { sparam } from './sparam.js'

const { C, cabs, cdiv, cmul, cscale } = cx

export { describeLine, inputImpedance, lineAt }

/** The speed of light, and the phase velocity a dielectric constant sets. */
export const C0 = 299792458
export const phaseVelocity = (epsr) => C0 / Math.sqrt(epsr)

/**
 * The line this lab turns the knobs on: a characteristic impedance, a
 * dielectric constant, a length, and an attenuation in nepers per metre.
 *
 * The loss is put in as R and G per metre with R/L = G/C, which makes
 * gamma = alpha + j omega / v_p and Z0 = sqrt(L/C) both exact. That is the
 * distortionless line, and the choice is a definition of the line rather than
 * an approximation of one: alpha is the same at every frequency here, where a
 * real conductor's alpha rises as the square root of frequency with the skin
 * effect. The description says which line is on the bench, and every number
 * that follows from it is exact for that line.
 */
export function uniformLine({ Z0 = 50, epsr = 1, len = 1, alpha = 0 } = {}) {
  positive(Z0, 'Z0')
  positive(epsr, 'epsr')
  positive(len, 'len')
  nonNegative(alpha, 'alpha')
  const vp = phaseVelocity(epsr)
  const L = Z0 / vp
  const Cp = 1 / (Z0 * vp)
  return describeLine({ R: alpha * Z0, L, G: alpha / Z0, C: Cp, len })
}

/** Nepers per metre as decibels per metre, and back. The factor is 20 log10 e. */
export const NP_TO_DB = 20 * Math.log10(Math.E)
export const dbPerMetre = (alpha) => alpha * NP_TO_DB
export const npPerMetre = (db) => db / NP_TO_DB

/**
 * The chain matrix of a length of uniform line at one frequency.
 *
 *   A = cosh(γl)        B = Z0 sinh(γl)
 *   C = sinh(γl)/Z0     D = cosh(γl)
 *
 * `atLength` overrides the line's own length, which is what the length sweep
 * and the split-into-N-sections invariant use.
 */
export function lineAbcd(line, f, { atLength } = {}) {
  const at = lineAt(line, f)
  const l = atLength === undefined ? at.line.len : atLength
  const gl = cscale(at.gamma, l)
  const ch = ccosh(gl)
  const sh = csinh(gl)
  const z0 = at.Z0
  return {
    abcd: [
      [ch, cmul(z0, sh)],
      [cdiv(sh, z0), ch],
    ],
    at,
    length: l,
  }
}

/** The same length of line as an S record, referred to `z0`. */
export function lineSparam(line, f, { z0 = 50, atLength } = {}) {
  const { abcd, at, length } = lineAbcd(line, f, { atLength })
  return { ...sparam({ f, z0, s: abcdToS(abcd, z0) }), at, length }
}

/**
 * The electrical length of a line at a frequency, in degrees and in
 * wavelengths. A quarter wave is 90 degrees, and it stops being a quarter wave
 * the moment the frequency moves, which is what the schematic draws.
 */
export function electricalLength(line, f) {
  const at = lineAt(line, f)
  return {
    lambda: at.lambda,
    degrees: at.electricalDeg,
    wavelengths: at.electricalDeg / 360,
    beta: at.beta,
    alpha: at.alpha,
    vp: at.vp,
    Z0: at.Z0mag,
    length: at.line.len,
  }
}

/**
 * The characteristic impedance a quarter-wave section needs to turn one real
 * impedance into another: Z0 = sqrt(Z_in Z_L). Exact, and the Fields Lab's
 * `quarterWave` is the same closed form with the same refusal for a reactive
 * load.
 */
export function quarterWaveZ0(Zin, ZL) {
  require_(
    Number.isFinite(Zin) && Number.isFinite(ZL) && Zin > 0 && ZL > 0,
    'A quarter-wave transformer matches two positive real impedances. Cancel the load reactance first, then transform what is left.',
    { field: 'ZL' },
  )
  return Math.sqrt(Zin * ZL)
}

// ------------------------------------------------------------- the refusal

/**
 * The hand-over to `@ee-labs/systems`, declined, with the reason.
 *
 * A rational transfer function is a ratio of polynomials in s, and it is fixed
 * by a finite list of poles and zeros. A line of length l contributes the
 * factor e^{−γl}, and with γ = α + jβ that factor is transcendental: it has no
 * zero anywhere in the finite plane and no pole anywhere in it either. An
 * entire function with no zeros is not a ratio of polynomials, so there is no
 * H(s) to hand over, at any order.
 *
 * The message names what is available instead, because a refusal that does not
 * say where to go is only half of one. The sweep is exact at every frequency,
 * point by point, and it is what the pane draws.
 *
 * Both numbers in the sentence are quoted to four significant figures. This
 * message is on screen under A5's plot rather than in a log, so `STYLE.md` S12
 * governs it: a length carries its unit and its figures. The reference line's
 * length is computed from the phase velocity, so printing it raw put sixteen
 * digits of it in front of a reader.
 */
export function refuseRational(line, f) {
  const ln = describeLine(line)
  const at = lineAt(ln, f || 1e9)
  const delay = ln.len / at.vp
  throw new RfError(
    `A line ${ln.len.toPrecision(4)} m long has no rational transfer function. Its response carries the factor e^(-gamma l), a delay of ${(delay * 1e9).toPrecision(4)} ns at this phase velocity, and that factor has no finite poles and no finite zeros. A ratio of polynomials cannot equal it at any order, so there is nothing to hand to the pole-zero view. The frequency response of this same line is exact at every frequency, and the sweep computes it point by point.`,
    { field: 'systems', kind: 'not-rational', delay, length: ln.len },
  )
}

/**
 * Whether the line has a rational transfer function, and why not. The app calls
 * this before offering the hand-over, so the refusal arrives as a sentence on
 * the panel and not as an exception.
 */
export function rationalAvailable(line, f) {
  try {
    refuseRational(line, f)
    return { ok: true, says: '' }
  } catch (err) {
    if (err instanceof RfError) return { ok: false, says: err.message, delay: err.detail.delay }
    throw err
  }
}

/**
 * The standing wave along the line, at one frequency.
 *
 * With the incident wave taken as one at the load, the voltage a distance d
 * back towards the source is
 *
 *   V(d) = e^{gamma d} + Gamma_L e^{-gamma d}
 *
 * and the current is the same expression with the sign of the reflected term
 * reversed, divided by Z0. Both are exact at every d, and the pattern they make
 * is what the line view draws.
 *
 * The extrema are not searched for. On a lossless line the largest voltage is
 * 1 + |Gamma| where the reflected wave arrives in phase, and the smallest is
 * 1 − |Gamma| half a wavelength further, so their positions come out of the
 * angle of Gamma in closed form. With loss the envelope decays towards the
 * source, and the two positions reported are the ones nearest the load.
 */
export function standingWave(line, ZL, f, { points = 129, length } = {}) {
  const at = lineAt(line, f)
  const len = length === undefined ? at.line.len : length
  const zl = ZL === Infinity ? Infinity : Array.isArray(ZL) ? ZL : C(ZL)
  const gL = zl === Infinity ? C(1) : cx.cdiv(cx.csub(zl, at.Z0), cx.cadd(zl, at.Z0))
  const mag = cabs(gL)
  const theta = Math.atan2(gL[1], gL[0])

  const V = (d) => {
    const gd = cscale(at.gamma, d)
    const up = ccosh(gd)
    const down = csinh(gd)
    // e^{gamma d} = cosh + sinh, e^{-gamma d} = cosh − sinh.
    const forward = cx.cadd(up, down)
    const back = cmul(gL, cx.csub(up, down))
    return { v: cx.cadd(forward, back), i: cx.cdiv(cx.csub(forward, back), at.Z0) }
  }

  // Each sample carries the LOCAL reflection magnitude as well as the voltage.
  // A wave reflected at the load crosses the line twice before it is seen a
  // distance d back, so |Gamma(d)| is |Gamma_L| exp(-2 alpha d), and that is
  // the number the pattern's depth follows. On a lossless line it does not
  // move, which is why the standing wave there has the same ripple everywhere.
  const samples = []
  for (let k = 0; k < points; k++) {
    const d = (len * k) / (points - 1)
    const { v, i } = V(d)
    const g = mag * Math.exp(-2 * at.alpha * d)
    samples.push({ d, v: cabs(v), i: cabs(i) * at.Z0mag, g, swr: g >= 1 ? Infinity : (1 + g) / (1 - g) })
  }

  // The first maximum is where 2 beta d − theta is zero, and the first minimum
  // a quarter wavelength past it. The pattern repeats every HALF wavelength,
  // not every wavelength, because the reflected wave crosses the same distance
  // twice, so that is the period the two positions are wrapped into.
  const quarter = Math.PI / (2 * at.beta)
  const period = 2 * quarter
  const wrap = (d) => {
    const m = ((d % period) + period) % period
    // A position one whole period along is the same position, and the modulo
    // of two floats that differ in the last bit returns the period rather than
    // zero. The snap is relative to the period, never an absolute epsilon.
    return period - m < 1e-9 * period ? 0 : m
  }
  const dMax = wrap(theta / (2 * at.beta))
  const dMin = wrap(dMax + quarter)
  return {
    at,
    length: len,
    gammaLoad: gL,
    mag,
    samples,
    dMax,
    dMin,
    vmax: cabs(V(dMax).v),
    vmin: cabs(V(dMin).v),
    swr: mag >= 1 ? Infinity : (1 + mag) / (1 - mag),
    quarter,
  }
}

/**
 * The frequency spacing at which a line's response repeats, exactly: v_p / 2l.
 *
 * Adding that much to the frequency adds j pi to gamma l, and tanh is periodic
 * in j pi, so every impedance the line presents comes back unchanged. The
 * repeat holds on a lossy line too, because alpha does not depend on the
 * frequency here and only the imaginary part of gamma l moves.
 *
 * This is the second half of the refusal in `refuseRational`, and the half a
 * reader can watch. A ratio of polynomials that is not constant takes each of
 * its values finitely many times, so it cannot repeat for ever. The line's
 * response repeats for ever, so it is not a ratio of polynomials.
 */
export function repeatFrequency(line, f = 1e9) {
  const at = lineAt(line, f)
  return at.vp / (2 * at.line.len)
}

/**
 * The exact sweep the pane draws instead of a pole-zero picture.
 *
 * `points` frequencies from `from` to `to`, each one an independent exact
 * solve of the closed form. Nothing is interpolated between them and nothing
 * is fitted through them. The reader who wanted a pole gets this.
 */
export function sweepLine(line, ZL, { from, to, points = 241, z0 = 50, log = false } = {}) {
  require_(points >= 2, `A sweep needs at least two frequencies, and this one asks for ${points}.`, { field: 'points' })
  const out = []
  for (let k = 0; k < points; k++) {
    const t = k / (points - 1)
    const f = log ? from * Math.pow(to / from, t) : from + (to - from) * t
    const zin = inputImpedance(line, ZL, f)
    const Z = zin.Z === Infinity ? Infinity : zin.Z
    const g = Z === Infinity ? C(1) : cdiv(cx.csub(Z, C(z0)), cx.cadd(Z, C(z0)))
    const mag = cabs(g)
    out.push({ f, Z, gamma: g, mag, vswr: mag >= 1 ? Infinity : (1 + mag) / (1 - mag), electricalDeg: zin.at.electricalDeg })
  }
  return out
}

export { RfError }
