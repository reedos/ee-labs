// S, Z, Y and ABCD are one object, written four ways.
//
// CORE_SCOPE class: ADMITTED, EXACT, and never hedged. Each conversion below is
// a closed form on two-by-two complex matrices, and the map from S to Z is
// bilinear, so it is invertible wherever the inverse exists. Where it does not
// the function throws with the reason the singular matrix gives, in the
// register `SingularError` uses in `linalg.js`. An ideal transformer has no
// Z-matrix and a finite S-matrix, and this module says so rather than returning
// a large number a reader would take for a measurement.
//
// The matrix helpers at the top are here rather than in a file of their own
// because conversion is the only arithmetic in this package that needs a
// two-by-two inverse. `sparam.js` and `cascade.js` import them from here.

import { complex as cx } from '@ee-labs/network'
import { RfError, positive, require_ } from './const.js'

const { C, cabs, cadd, cdiv, cmul, cscale, csub } = cx

// ------------------------------------------------------- two-by-two complex

/** The two-by-two identity, scaled by a complex k. */
export const eye2 = (k = C(1)) => [
  [k, C(0)],
  [C(0), k],
]

export const madd = (A, B) => [
  [cadd(A[0][0], B[0][0]), cadd(A[0][1], B[0][1])],
  [cadd(A[1][0], B[1][0]), cadd(A[1][1], B[1][1])],
]

export const msub = (A, B) => [
  [csub(A[0][0], B[0][0]), csub(A[0][1], B[0][1])],
  [csub(A[1][0], B[1][0]), csub(A[1][1], B[1][1])],
]

export const mscale = (A, k) => [
  [cmul(A[0][0], k), cmul(A[0][1], k)],
  [cmul(A[1][0], k), cmul(A[1][1], k)],
]

export const mmul = (A, B) => [
  [cadd(cmul(A[0][0], B[0][0]), cmul(A[0][1], B[1][0])), cadd(cmul(A[0][0], B[0][1]), cmul(A[0][1], B[1][1]))],
  [cadd(cmul(A[1][0], B[0][0]), cmul(A[1][1], B[1][0])), cadd(cmul(A[1][0], B[0][1]), cmul(A[1][1], B[1][1]))],
]

/** The determinant, which is also the Δ of `stability.js`. */
export const mdet = (A) => csub(cmul(A[0][0], A[1][1]), cmul(A[0][1], A[1][0]))

/** The conjugate transpose, for the unitarity check a lossless network satisfies. */
export const mdagger = (A) => [
  [cx.conj(A[0][0]), cx.conj(A[1][0])],
  [cx.conj(A[0][1]), cx.conj(A[1][1])],
]

/** The largest magnitude in a matrix, which is the scale a residual is measured against. */
export const mnorm = (A) => Math.max(cabs(A[0][0]), cabs(A[0][1]), cabs(A[1][0]), cabs(A[1][1]))

/**
 * The inverse, or a refusal naming what is singular.
 *
 * The threshold is relative to the matrix's own scale, never a fixed epsilon: a
 * two-port written in ohms and one written in siemens differ by four decades of
 * determinant and are the same object.
 */
export function minv(A, what = 'this matrix') {
  const det = mdet(A)
  const scale = mnorm(A)
  require_(
    cabs(det) > 1e-14 * Math.max(1, scale * scale),
    `The determinant of ${what} is ${cabs(det).toExponential(3)} against a scale of ${scale.toExponential(3)}, so it has no inverse. This description does not exist for this circuit, and another one does.`,
    { field: 'matrix', kind: 'singular' },
  )
  const inv = cdiv(C(1), det)
  return [
    [cmul(A[1][1], inv), cmul(cscale(A[0][1], -1), inv)],
    [cmul(cscale(A[1][0], -1), inv), cmul(A[0][0], inv)],
  ]
}

/** How far two matrices are apart, relative to their own scale. */
export const mdiff = (A, B) => mnorm(msub(A, B)) / Math.max(1e-300, Math.max(mnorm(A), mnorm(B)))

// --------------------------------------------------------------- S to Z, Y

/**
 * Z from S at a real reference impedance.
 *
 *   Z = Z0 (I + S)(I − S)^{-1}
 *
 * (I − S) is singular exactly when the two-port has a wave that comes back
 * unchanged, which is what an ideal transformer's S-matrix does. The refusal
 * names it.
 */
export function sToZ(S, z0) {
  positive(z0, 'z0')
  const I = eye2()
  return mscale(mmul(madd(I, S), minv(msub(I, S), 'I − S')), C(z0))
}

/** S from Z: S = (Z − Z0 I)(Z + Z0 I)^{-1}. */
export function zToS(Z, z0) {
  positive(z0, 'z0')
  const Z0 = eye2(C(z0))
  return mmul(msub(Z, Z0), minv(madd(Z, Z0), 'Z + Z0 I'))
}

/** Y from S: Y = (1/Z0)(I − S)(I + S)^{-1}. */
export function sToY(S, z0) {
  positive(z0, 'z0')
  const I = eye2()
  return mscale(mmul(msub(I, S), minv(madd(I, S), 'I + S')), C(1 / z0))
}

/** S from Y: S = (I − Z0 Y)(I + Z0 Y)^{-1}. */
export function yToS(Y, z0) {
  positive(z0, 'z0')
  const I = eye2()
  const ZY = mscale(Y, C(z0))
  return mmul(msub(I, ZY), minv(madd(I, ZY), 'I + Z0 Y'))
}

/** Y is the inverse of Z, and the refusal names which of the two is missing. */
export const zToY = (Z) => minv(Z, 'the Z-matrix')
export const yToZ = (Y) => minv(Y, 'the Y-matrix')

// ------------------------------------------------------------ S to ABCD

/**
 * ABCD from S at a real reference impedance.
 *
 * The chain matrix is the one to cascade with, because it composes by
 * multiplication and carries no reference impedance of its own. It does not
 * exist when S21 is zero, which is a two-port with no path from port 1 to
 * port 2, and the refusal says that rather than dividing by nothing.
 */
export function sToAbcd(S, z0) {
  positive(z0, 'z0')
  const [[s11, s12], [s21, s22]] = S
  require_(
    cabs(s21) > 1e-14 * Math.max(1, mnorm(S)),
    `S21 is ${cabs(s21).toExponential(3)}, so no wave reaches port 2 and there is no chain matrix. A two-port with no path through it has an S-matrix and a Y-matrix, and this description is the one it does not have.`,
    { field: 's21', kind: 'singular' },
  )
  const two = cscale(s21, 2)
  const one = C(1)
  const d = cmul(s12, s21)
  const A = cdiv(cadd(cmul(cadd(one, s11), csub(one, s22)), d), two)
  const B = cscale(cdiv(csub(cmul(cadd(one, s11), cadd(one, s22)), d), two), z0)
  const Cc = cscale(cdiv(csub(cmul(csub(one, s11), csub(one, s22)), d), two), 1 / z0)
  const D = cdiv(cadd(cmul(csub(one, s11), cadd(one, s22)), d), two)
  return [
    [A, B],
    [Cc, D],
  ]
}

/**
 * S from ABCD.
 *
 *   den = A + B/Z0 + C Z0 + D
 *   S11 = (A + B/Z0 − C Z0 − D)/den      S12 = 2(AD − BC)/den
 *   S21 = 2/den                          S22 = (−A + B/Z0 − C Z0 + D)/den
 */
export function abcdToS(M, z0) {
  positive(z0, 'z0')
  const [[A, B], [Cc, D]] = M
  const bz = cscale(B, 1 / z0)
  const cz = cscale(Cc, z0)
  const den = cadd(cadd(A, bz), cadd(cz, D))
  require_(
    cabs(den) > 1e-14 * Math.max(1, mnorm(M)),
    `A + B/Z0 + C Z0 + D is ${cabs(den).toExponential(3)}, so this chain matrix has no scattering description at ${z0} ohms. The reference impedance is what fails here, and another one works.`,
    { field: 'z0', kind: 'singular' },
  )
  const det = mdet(M)
  return [
    [cdiv(csub(cadd(A, bz), cadd(cz, D)), den), cdiv(cscale(det, 2), den)],
    [cdiv(C(2), den), cdiv(cadd(csub(bz, A), csub(D, cz)), den)],
  ]
}

export { RfError }
