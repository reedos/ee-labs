// S, Z, Y and ABCD are one object, written four ways.
//
// CLASS, under CORE_SCOPE.md: EXACT, and never hedged. Each conversion is a
// bilinear map on two by two complex matrices, invertible wherever its own
// inverse exists. Where it does not, the function throws with the reason the
// singular matrix gives, rather than returning a large number that a reader
// would take for an answer. An ideal transformer has no Z-matrix and a finite
// S-matrix, and that case is shown rather than hidden.
//
// The reference form is S = (Z - Z_0 I)(Z + Z_0 I)^-1 with a real scalar Z_0,
// and every other form follows from it. Invariant 1 of RF_LAB_PLAN.md §2.13
// requires the S to Z to ABCD to Y to S round trip to return the input to
// 1e-12 relative, at every frequency, for every network with a non-singular
// path.

import { complex as cx } from '@ee-labs/network'
import { RfError, require_, toC, twoPort } from './sparam.js'

const { C, cabs, cadd, cdiv, cmul, cscale, csub } = cx

// ------------------------------------------------ two by two complex algebra

/** The two by two identity. */
export const eye2 = () => [[C(1), C(0)], [C(0), C(1)]]

/** A matrix from four entries in reading order. */
export const m2 = (a, b, c, d) => [[toC(a), toC(b)], [toC(c), toC(d)]]

export const madd = (A, B) => A.map((row, i) => row.map((v, j) => cadd(v, B[i][j])))
export const msub = (A, B) => A.map((row, i) => row.map((v, j) => csub(v, B[i][j])))
export const mscale = (A, k) => A.map((row) => row.map((v) => (Array.isArray(k) ? cmul(v, k) : cscale(v, k))))

export const mmul = (A, B) => [
  [cadd(cmul(A[0][0], B[0][0]), cmul(A[0][1], B[1][0])), cadd(cmul(A[0][0], B[0][1]), cmul(A[0][1], B[1][1]))],
  [cadd(cmul(A[1][0], B[0][0]), cmul(A[1][1], B[1][0])), cadd(cmul(A[1][0], B[0][1]), cmul(A[1][1], B[1][1]))],
]

/** The determinant, which is the number that decides whether an inverse exists. */
export const mdet = (A) => csub(cmul(A[0][0], A[1][1]), cmul(A[0][1], A[1][0]))

/** The largest magnitude in a matrix: the scale a small determinant is judged against. */
export const mnorm = (A) => Math.max(...A.flat().map(cabs))

/**
 * The inverse, or a stated refusal.
 *
 * A determinant below `1e-12` times the square of the matrix's own largest
 * entry is treated as zero, in the way `linalg.js` treats a small pivot: a
 * matrix that is singular by rounding is singular, and the alternative is a
 * 1e15-ohm answer that reads as a measurement.
 */
export function minv(A, what = 'matrix') {
  const det = mdet(A)
  const scale = mnorm(A) ** 2 || 1
  require_(
    cabs(det) > 1e-12 * scale,
    `This ${what} has no inverse: its determinant is ${cabs(det).toExponential(2)} against a scale of ${scale.toExponential(2)}, which is zero to the arithmetic. An ideal transformer is the standard case, and its S-matrix is finite even though its Z-matrix does not exist.`,
    { field: what, det: cabs(det), kind: 'singular-conversion' },
  )
  return [[cdiv(A[1][1], det), cdiv(cscale(A[0][1], -1), det)], [cdiv(cscale(A[1][0], -1), det), cdiv(A[0][0], det)]]
}

const z0Of = (z0) => {
  require_(z0 > 0, `The reference impedance must be a positive resistance, not ${z0}.`, { field: 'z0' })
  return C(z0)
}

/** The 2 by 2 part of a scattering record, or a bare matrix passed straight through. */
export const matrixOf = (rec) => (Array.isArray(rec) ? rec : rec.s)

// --------------------------------------------------------- S to and from Z

/** Z = Z_0 (I + S)(I - S)^-1. */
export function sToZ(S, z0 = 50) {
  const s = matrixOf(S)
  const zr = z0Of(z0)
  return mscale(mmul(madd(eye2(), s), minv(msub(eye2(), s), 'scattering matrix')), zr)
}

/** S = (Z - Z_0 I)(Z + Z_0 I)^-1. */
export function zToS(Z, z0 = 50) {
  const zr = z0Of(z0)
  const I = mscale(eye2(), zr)
  return mmul(msub(Z, I), minv(madd(Z, I), 'impedance matrix'))
}

// --------------------------------------------------------- S to and from Y

/** Y = (I - S)(I + S)^-1 / Z_0. */
export function sToY(S, z0 = 50) {
  const s = matrixOf(S)
  const zr = z0Of(z0)
  return mscale(mmul(msub(eye2(), s), minv(madd(eye2(), s), 'scattering matrix')), cdiv(C(1), zr))
}

/** S = (I - Z_0 Y)(I + Z_0 Y)^-1. */
export function yToS(Y, z0 = 50) {
  const zr = z0Of(z0)
  const zy = mscale(Y, zr)
  return mmul(msub(eye2(), zy), minv(madd(eye2(), zy), 'admittance matrix'))
}

// ------------------------------------------------------ S to and from ABCD

/**
 * ABCD from S, in closed form.
 *
 *   A = ((1+S11)(1-S22) + S12 S21) / (2 S21)
 *   B = Z_0 ((1+S11)(1+S22) - S12 S21) / (2 S21)
 *   C = ((1-S11)(1-S22) - S12 S21) / (2 S21 Z_0)
 *   D = ((1-S11)(1+S22) + S12 S21) / (2 S21)
 *
 * A two-port with S21 = 0 has no ABCD matrix, because ABCD describes a chain
 * and nothing passes along this one.
 */
export function sToAbcd(S, z0 = 50) {
  const s = matrixOf(S)
  const zr = z0Of(z0)
  const [[s11, s12], [s21, s22]] = s
  require_(
    cabs(s21) > 1e-15,
    'This two-port passes nothing from port 1 to port 2, so it has no ABCD matrix. ABCD describes a chain, and a chain needs something to travel along it.',
    { field: 's21', kind: 'singular-conversion' },
  )
  const den = cscale(s21, 2)
  const cross = cmul(s12, s21)
  const A = cdiv(cadd(cmul(cadd(C(1), s11), csub(C(1), s22)), cross), den)
  const B = cmul(zr, cdiv(csub(cmul(cadd(C(1), s11), cadd(C(1), s22)), cross), den))
  const Cc = cdiv(csub(cmul(csub(C(1), s11), csub(C(1), s22)), cross), cmul(den, zr))
  const D = cdiv(cadd(cmul(csub(C(1), s11), cadd(C(1), s22)), cross), den)
  return [[A, B], [Cc, D]]
}

/**
 * S from ABCD, in closed form. The denominator A + B/Z_0 + C Z_0 + D is the
 * sum of the four terms a source of internal resistance Z_0 sees, and it is
 * zero only for a two-port that is not passive.
 */
export function abcdToS(M, z0 = 50) {
  const zr = z0Of(z0)
  const [[A, B], [Cc, D]] = M
  const bz = cdiv(B, zr)
  const cz = cmul(Cc, zr)
  const den = cadd(cadd(A, bz), cadd(cz, D))
  require_(
    cabs(den) > 1e-15 * Math.max(1, mnorm(M)),
    'This ABCD matrix has no scattering matrix at this reference impedance: the sum A + B/Z0 + C Z0 + D is zero, so no wave can be defined at the ports.',
    { field: 'abcd', kind: 'singular-conversion' },
  )
  const s11 = cdiv(csub(cadd(A, bz), cadd(cz, D)), den)
  const s12 = cdiv(cscale(csub(cmul(A, D), cmul(B, Cc)), 2), den)
  const s21 = cdiv(C(2), den)
  const s22 = cdiv(cadd(csub(bz, A), csub(D, cz)), den)
  return [[s11, s12], [s21, s22]]
}

// ------------------------------------------------------ Z, Y and ABCD among
// themselves, which is what closes invariant 1's round trip.

/** ABCD from Z: A = Z11/Z21, B = det Z / Z21, C = 1/Z21, D = Z22/Z21. */
export function zToAbcd(Z) {
  require_(cabs(Z[1][0]) > 1e-15 * (mnorm(Z) || 1), 'A two-port with Z21 = 0 has no ABCD matrix: nothing couples port 1 to port 2.', {
    field: 'z21',
    kind: 'singular-conversion',
  })
  const z21 = Z[1][0]
  return [[cdiv(Z[0][0], z21), cdiv(mdet(Z), z21)], [cdiv(C(1), z21), cdiv(Z[1][1], z21)]]
}

/** Z from ABCD, the same map read the other way. */
export function abcdToZ(M) {
  const [[A, B], [Cc, D]] = M
  require_(cabs(Cc) > 1e-15 * (mnorm(M) || 1), 'A two-port with C = 0 has no Z-matrix: an ideal transformer is the standard case, and its S-matrix is finite.', {
    field: 'c',
    kind: 'singular-conversion',
  })
  return [[cdiv(A, Cc), cdiv(csub(cmul(A, D), cmul(B, Cc)), Cc)], [cdiv(C(1), Cc), cdiv(D, Cc)]]
}

/** Y from ABCD: Y11 = D/B, Y12 = -(AD - BC)/B, Y21 = -1/B, Y22 = A/B. */
export function abcdToY(M) {
  const [[A, B], [Cc, D]] = M
  require_(cabs(B) > 1e-15 * (mnorm(M) || 1), 'A two-port with B = 0 has no Y-matrix: a short from port to port is the standard case.', {
    field: 'b',
    kind: 'singular-conversion',
  })
  return [
    [cdiv(D, B), cdiv(cscale(csub(cmul(A, D), cmul(B, Cc)), -1), B)],
    [cdiv(C(-1), B), cdiv(A, B)],
  ]
}

/** ABCD from Y, the same map read the other way. */
export function yToAbcd(Y) {
  require_(cabs(Y[1][0]) > 1e-15 * (mnorm(Y) || 1), 'A two-port with Y21 = 0 has no ABCD matrix: nothing couples port 1 to port 2.', {
    field: 'y21',
    kind: 'singular-conversion',
  })
  const y21 = Y[1][0]
  return [
    [cdiv(cscale(Y[1][1], -1), y21), cdiv(C(-1), y21)],
    [cdiv(cscale(mdet(Y), -1), y21), cdiv(cscale(Y[0][0], -1), y21)],
  ]
}

/** Z and Y are each other's inverse, where both exist. */
export const zToY = (Z) => minv(Z, 'impedance matrix')
export const yToZ = (Y) => minv(Y, 'admittance matrix')

/**
 * The round trip invariant 1 names: S to Z to ABCD to Y to S.
 *
 * Returns the matrix that comes back, the largest entry-by-entry error against
 * the input, the largest scale any intermediate matrix reached, and the bound
 * that scale allows. The bound is 1e-12 on the entries plus one part in 1e15
 * of the largest intermediate, because a two-port whose ABCD entries reach a
 * million while its S entries are of order one has already thrown away six
 * digits before the last conversion starts. No rearrangement of the algebra
 * puts them back, so the invariant states the loss rather than hiding it in a
 * looser fixed tolerance.
 */
export function roundTrip(S, z0 = 50) {
  const s = matrixOf(S)
  const Z = sToZ(s, z0)
  const M = zToAbcd(Z)
  const Y = abcdToY(M)
  const back = yToS(Y, z0)
  const scale = Math.max(mnorm(Z) / z0, mnorm(M), mnorm(Y) * z0, 1)
  let worst = 0
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) worst = Math.max(worst, cabs(csub(back[i][j], s[i][j])))
  return { s: back, error: worst, scale, tolerance: 1e-12 + 1e-15 * scale }
}

/** A matrix back into a scattering record, keeping the frequency and reference. */
export const asRecord = (m, { f = null, z0 = 50, label = null } = {}) => twoPort({ f, z0, s: m, label })

export { RfError }
