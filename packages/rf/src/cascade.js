// Cascading two-ports, two ways, and the two ways agree.
//
// CORE_SCOPE class: ADMITTED, EXACT. One matrix product for ABCD, one closed
// form for S, and the plan's invariant 2 fuzzes their agreement.
//
// Which route to use is a real choice and not a matter of taste. ABCD composes
// by multiplication and carries no reference impedance, so a chain of series
// and shunt elements is one product. S is what an instrument reports, and its
// composition is the closed form below. The S route has a singular case that
// the ABCD route does not: at A22 B11 = 1 a wave bounced between the two
// two-ports returns in phase and with its own amplitude, which is a lossless
// resonance between two mismatched ports, and the function throws with that
// reason rather than returning a large number.

import { complex as cx } from '@ee-labs/network'
import { require_ } from './const.js'
import { abcdToS, eye2, mmul, mnorm, sToAbcd } from './convert.js'
import { sparam } from './sparam.js'

const { C, cabs, cadd, cdiv, cmul, csub } = cx

// ------------------------------------------------------- the element chains

/** A series impedance as a chain matrix: [[1, Z], [0, 1]]. */
export const seriesAbcd = (Z) => [
  [C(1), Array.isArray(Z) ? Z : C(Z)],
  [C(0), C(1)],
]

/** A shunt admittance as a chain matrix: [[1, 0], [Y, 1]]. */
export const shuntAbcd = (Y) => [
  [C(1), C(0)],
  [Array.isArray(Y) ? Y : C(Y), C(1)],
]

/** An ideal transformer of turns ratio n as a chain matrix: [[n, 0], [0, 1/n]]. */
export const transformerAbcd = (n) => [
  [C(n), C(0)],
  [C(0), C(1 / n)],
]

/** The chain matrix of a series impedance at one frequency, for a resistor, an inductor or a capacitor. */
export function elementAbcd(kind, value, f) {
  const w = 2 * Math.PI * f
  switch (kind) {
    case 'R':
      return seriesAbcd(C(value))
    case 'L':
      return seriesAbcd(C(0, w * value))
    case 'C':
      return seriesAbcd(cdiv(C(1), C(0, w * value)))
    case 'Rp':
      return shuntAbcd(C(1 / value))
    case 'Lp':
      return shuntAbcd(cdiv(C(1), C(0, w * value)))
    case 'Cp':
      return shuntAbcd(C(0, w * value))
    default:
      throw new Error(`No chain matrix for element kind ${kind}`)
  }
}

// --------------------------------------------------------------- the two routes

/** Two chain matrices in cascade, left first: one matrix product and nothing else. */
export const cascadeAbcd = (A, B) => mmul(A, B)

/** A whole chain, left to right. An empty chain is the identity, which is a wire. */
export const chainAbcd = (list) => list.reduce((acc, M) => mmul(acc, M), eye2())

/**
 * Two scattering matrices in cascade, by the closed composition.
 *
 *   S11 = A11 + A12 B11 A21 / (1 − A22 B11)
 *   S12 = A12 B12 / (1 − A22 B11)
 *   S21 = A21 B21 / (1 − A22 B11)
 *   S22 = B22 + B21 A22 B12 / (1 − A22 B11)
 *
 * with A the left two-port and B the right. Both must be referred to the same
 * impedance, because the waves the composition adds are defined against it.
 */
export function cascadeS(a, b) {
  require_(
    Math.abs(a.z0 - b.z0) < 1e-12 * a.z0,
    `The left two-port is referred to ${a.z0} ohms and the right to ${b.z0} ohms. A wave leaving one is the wave entering the other only when both are measured against the same impedance, so convert one before composing them.`,
    { field: 'z0' },
  )
  const [[a11, a12], [a21, a22]] = a.s
  const [[b11, b12], [b21, b22]] = b.s
  const den = csub(C(1), cmul(a22, b11))
  require_(
    cabs(den) > 1e-13 * Math.max(1, Math.max(mnorm(a.s), mnorm(b.s))),
    `1 − S22 S11 between the two blocks is ${cabs(den).toExponential(3)}, so a wave bounced between them comes back in phase and at its own amplitude. That is a lossless resonance between two mismatched ports, and no finite steady state describes it. Add a loss, or move off this frequency.`,
    { field: 'cascade', kind: 'resonance' },
  )
  const inv = cdiv(C(1), den)
  return sparam({
    f: a.f,
    z0: a.z0,
    s: [
      [cadd(a11, cmul(cmul(cmul(a12, b11), a21), inv)), cmul(cmul(a12, b12), inv)],
      [cmul(cmul(a21, b21), inv), cadd(b22, cmul(cmul(cmul(b21, a22), b12), inv))],
    ],
  })
}

/** A whole chain of S records, left to right, by the closed composition. */
export const chainS = (list) => list.reduce((acc, sp) => cascadeS(acc, sp))

/**
 * The same cascade by the other route: convert each to ABCD, multiply, convert
 * back. Invariant 2 requires the two routes to agree to floating point.
 */
export function chainViaAbcd(list) {
  const z0 = list[0].z0
  const M = chainAbcd(list.map((sp) => sToAbcd(sp.s, sp.z0)))
  return sparam({ f: list[0].f, z0, s: abcdToS(M, z0) })
}

/** An S record from a chain matrix, at a reference impedance. */
export const abcdToSparam = (M, { f, z0 = 50 }) => sparam({ f, z0, s: abcdToS(M, z0) })

/** The chain matrix of an S record. */
export const sparamToAbcd = (sp) => sToAbcd(sp.s, sp.z0)
