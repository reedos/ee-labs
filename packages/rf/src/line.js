// The line as a two-port at one frequency, and the reason it has no H(s).
//
// CLASS, under CORE_SCOPE.md, is two classes at once, and the pair is the
// content of this lab's Group A.
//
//   EXACT, and never hedged: the uniform line's ABCD matrix at any one
//   frequency. A = D = cosh(gamma l), B = Z_0 sinh(gamma l), C = sinh(gamma l)
//   / Z_0, every entry a complex number computed in complex arithmetic with no
//   series truncation. A reader who asks for 241 frequencies gets 241 exact
//   answers.
//
//   DECLINED, with the reason as content: the line as a rational H(s). The
//   factor e^(-gamma l) is transcendental. It has no finite poles and no finite
//   zeros, so no ratio of polynomials equals it, and the hand-over to
//   @ee-labs/systems is refused rather than approximated. A Pade model would be
//   a new labelled object under Rule 3, and no experiment in this lab needs one.
//
// The physics is `packages/fields/src/line.js`, which derives Z_0 and gamma
// from the telegrapher's equations and is fuzzed there. Decision 3 of
// RF_LAB_PLAN.md is that the Fields Lab derives and this lab evaluates, so
// this module holds the record shape the RF Lab's two-port arithmetic takes,
// and the refusal, and nothing else.

import { complex as cx } from '@ee-labs/network'
import { ccosh, csinh, describeLine, inputImpedance, lineAt, lineStandingWave, reflectionCoefficient } from '@ee-labs/fields'
import { RfError, require_, twoPort } from './sparam.js'
import { abcdToS } from './convert.js'

const { cdiv, cmul, cscale } = cx

export { describeLine, inputImpedance, lineAt, lineStandingWave }

/**
 * The ABCD matrix of a length of uniform line at one frequency.
 *
 *   A = cosh(gamma l)        B = Z_0 sinh(gamma l)
 *   C = sinh(gamma l) / Z_0  D = cosh(gamma l)
 *
 * `atLength` overrides the described line's own length, which is what a length
 * sweep and the N-section split of invariant 6 use.
 */
export function lineAbcd(line, f, { atLength } = {}) {
  const at = lineAt(line, f)
  const l = atLength === undefined ? at.line.len : atLength
  require_(l >= 0, `A length of line is not negative, and this one is ${l} m.`, { field: 'atLength' })
  const gl = cscale(at.gamma, l)
  const ch = ccosh(gl)
  const sh = csinh(gl)
  return { m: [[ch, cmul(at.Z0, sh)], [cdiv(sh, at.Z0), ch]], at, l }
}

/**
 * The same line as a scattering record at a reference impedance. The record is
 * what everything else in this package takes, so a length of line cascades
 * with a lumped network without either knowing about the other.
 */
export function lineTwoPort(line, f, { z0 = 50, atLength, label = null } = {}) {
  const { m, at, l } = lineAbcd(line, f, { atLength })
  const rec = twoPort({ f, z0, s: abcdToS(m, z0), label })
  return { ...rec, abcd: m, at, l }
}

/**
 * The line as a rational transfer function, declined.
 *
 * `CORE_SCOPE.md`'s worked-example table names this object, and Rule 2 says a
 * refused bridge is a finished feature. The message states the mathematics and
 * names what is available instead, because a refusal that does not say where to
 * go is only half of one. It holds for a lossless line and for a lossy one, and
 * a test asserts both.
 */
export function refuseRational(line) {
  const ln = describeLine(line)
  throw new RfError(
    `A ${ln.lossy ? 'lossy' : 'lossless'} line ${ln.len} m long carries the factor e^(-gamma l), which is transcendental. It has no finite poles and no finite zeros, so no ratio of polynomials equals it and no pole-zero picture describes it. @ee-labs/systems trades in rational transfer functions, so this hand-over is declined. The same line's response is exact at every single frequency: sweep it point by point with lineTwoPort.`,
    { field: 'systems', kind: 'no-rational-line', lossy: ln.lossy, len: ln.len },
  )
}

/**
 * Whether the hand-over to `@ee-labs/systems` is available for this line, and
 * why not when it is not. The app calls this before offering the link, so the
 * refusal arrives as a sentence under the sweep and not as an exception.
 */
export function rationalAvailable(line) {
  const ln = describeLine(line)
  try {
    refuseRational(ln)
  } catch (err) {
    return { ok: false, says: err.message, kind: err.kind }
  }
  /* c8 ignore next */
  return { ok: true, says: '' }
}

/**
 * The exact swept response of a loaded line: the input impedance at each of
 * `points` frequencies, evenly spaced, and the reflection that impedance sends
 * back against the reference. Every point is a separate closed-form
 * evaluation, which is what A5 counts.
 */
export function sweepLine(line, ZL, { from, to, points = 241, z0 = 50 }) {
  require_(from > 0 && to > from, `A sweep runs from a positive frequency upwards, and this one runs from ${from} to ${to} Hz.`, { field: 'from' })
  require_(points >= 2, `A sweep needs at least two points, not ${points}.`, { field: 'points' })
  const f = new Float64Array(points)
  const Z = []
  const gamma = []
  for (let k = 0; k < points; k++) {
    const fk = from + ((to - from) * k) / (points - 1)
    f[k] = fk
    const zin = inputImpedance(line, ZL, fk)
    Z.push(zin.Z)
    gamma.push(reflectionCoefficient(zin.Z, z0))
  }
  return { f, Z, gamma, points, z0 }
}
