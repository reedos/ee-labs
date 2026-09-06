// Symmetrical components: three unbalanced phasors as three balanced sets.
//
// With a = 1∠120°, the transform and its inverse are
//
//     [I_0]       [1  1   1 ] [I_a]              [I_a]   [1  1   1 ] [I_0]
//     [I_1] = 1/3 [1  a   a²] [I_b]              [I_b] = [1  a²  a ] [I_1]
//     [I_2]       [1  a²  a ] [I_c]              [I_c]   [1  a   a²] [I_2]
//
// That is a change of basis, so it is exact and carries no guard. `A A⁻¹ = I`
// and the round trip are invariant 3, measured rather than asserted.
//
// Two facts fall straight out of the matrices and are the whole of F2. The sum
// of the three phase currents is 3 I_0, so a neutral carries three times the
// zero-sequence current. A delta winding has no neutral, so no zero-sequence
// current can flow inside it and I_0 there is zero.

import { C, cabs, carg, cadd, cdiv, cmul, cscale, csub, polar } from './cx.js'

/** a = 1∠120°, and its square. */
export const A_OP = polar(1, (2 * Math.PI) / 3)
export const A2_OP = polar(1, (-2 * Math.PI) / 3)

/** The forward matrix A⁻¹, which takes phase quantities to sequence ones. */
export const A_INV = [
  [C(1 / 3), C(1 / 3), C(1 / 3)],
  [C(1 / 3), cscale(A_OP, 1 / 3), cscale(A2_OP, 1 / 3)],
  [C(1 / 3), cscale(A2_OP, 1 / 3), cscale(A_OP, 1 / 3)],
]

/** The matrix A, which takes sequence quantities back to phase ones. */
export const A_MAT = [
  [C(1), C(1), C(1)],
  [C(1), A2_OP, A_OP],
  [C(1), A_OP, A2_OP],
]

const apply = (M, v) => M.map((row) => row.reduce((s, z, k) => cadd(s, cmul(z, v[k])), C(0)))

/** The product of the two matrices, which invariant 3 requires to be the identity. */
export function matrixProduct() {
  return A_MAT.map((row, i) => A_INV[0].map((_, j) => row.reduce((s, z, k) => cadd(s, cmul(z, A_INV[k][j])), C(0))))
}

/** Sequence quantities from three phase quantities, with magnitudes and angles. */
export function toSequence(abc) {
  const seq = apply(A_INV, abc)
  return { seq, zero: seq[0], positive: seq[1], negative: seq[2], mag: seq.map(cabs), ang: seq.map(carg) }
}

/** Phase quantities from three sequence quantities. */
export function toPhase(seq) {
  const list = Array.isArray(seq) && seq.length === 3 && Array.isArray(seq[0]) ? seq : [seq.zero, seq.positive, seq.negative]
  const abc = apply(A_MAT, list)
  return { abc, a: abc[0], b: abc[1], c: abc[2], mag: abc.map(cabs), ang: abc.map(carg) }
}

/** The neutral current, which is the sum of the three phases and also 3 I_0. */
export function neutral(abc) {
  const sum = abc.reduce((s, z) => cadd(s, z), C(0))
  const zero = cscale(sum, 1 / 3)
  return { sum, zero, threeZero: cscale(zero, 3), mag: cabs(sum) }
}

/** |I_2| / |I_1|, the number a motor's extra heating is quoted against. */
export function unbalanceFactor(seqOrAbc) {
  const s = Array.isArray(seqOrAbc) ? toSequence(seqOrAbc) : seqOrAbc
  return s.mag[1] > 0 ? s.mag[2] / s.mag[1] : Infinity
}

/**
 * A balanced set at one magnitude and angle, for the round-trip test and for
 * the picture: the positive-sequence set alone rebuilds three phasors 120°
 * apart.
 */
export function balancedSet(mag, angle = 0, order = 'positive') {
  const step = order === 'positive' ? (-2 * Math.PI) / 3 : (2 * Math.PI) / 3
  return [polar(mag, angle), polar(mag, angle + step), polar(mag, angle + 2 * step)]
}

/**
 * The three sets drawn beside the set they add to, which is F1's picture.
 * Each entry is the three phasors of one sequence, so the canvas draws four
 * triples and the reader adds them by eye.
 */
export function sets(abc) {
  const s = toSequence(abc)
  return {
    total: abc,
    zero: [s.zero, s.zero, s.zero],
    positive: [s.positive, cmul(A2_OP, s.positive), cmul(A_OP, s.positive)],
    negative: [s.negative, cmul(A_OP, s.negative), cmul(A2_OP, s.negative)],
    sequence: s,
  }
}

/** The largest error in rebuilding the phase quantities from the sequence ones. */
export function roundTripError(abc) {
  const back = toPhase(toSequence(abc)).abc
  return abc.reduce((m, z, k) => Math.max(m, cabs(csub(z, back[k]))), 0)
}
