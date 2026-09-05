// Cascading two-ports, two ways that agree.
//
// CLASS, under CORE_SCOPE.md: EXACT, and never hedged. ABCD composes by one
// matrix product and needs no reference impedance. S composes by one closed
// form and is what a network analyser reports. The two routes give the same
// two-port to floating point, which is invariant 2 of RF_LAB_PLAN.md §2.13.
//
// The S composition has one singular case, and it is a real circuit rather
// than an arithmetic accident. When A22 B11 = 1 the two mismatched ports form
// a lossless resonance between them, the wave bouncing back and forth never
// dies, and no steady amplitude exists. The function throws with that reason.

import { complex as cx } from '@ee-labs/network'
import { require_, twoPort } from './sparam.js'
import { abcdToS, matrixOf, mmul, sToAbcd } from './convert.js'

const { C, cabs, cadd, cdiv, cmul, csub } = cx

/** Two ABCD matrices in a chain, left first: one matrix product and nothing else. */
export const cascadeAbcd = (A, B) => mmul(A, B)

/**
 * Two scattering matrices in a chain, left first, in closed form.
 *
 *   d   = 1 - A22 B11
 *   S11 = A11 + A12 B11 A21 / d
 *   S12 = A12 B12 / d
 *   S21 = A21 B21 / d
 *   S22 = B22 + B21 A22 B12 / d
 *
 * `d` is one minus the round trip between the two facing ports. It counts the
 * reflections: the wave that goes into the junction, comes back off B, bounces
 * off A and goes in again, summed as a geometric series.
 */
export function cascadeS(SA, SB) {
  const a = matrixOf(SA)
  const b = matrixOf(SB)
  const [[a11, a12], [a21, a22]] = a
  const [[b11, b12], [b21, b22]] = b
  const d = csub(C(1), cmul(a22, b11))
  require_(
    cabs(d) > 1e-14,
    'These two two-ports resonate against each other at this frequency. The round trip between the facing ports has unit gain and no phase shift, so the wave between them never dies and no steady amplitude exists. Add loss, or move off this frequency.',
    { field: 'cascade', kind: 'lossless-resonance' },
  )
  return [
    [cadd(a11, cdiv(cmul(cmul(a12, b11), a21), d)), cdiv(cmul(a12, b12), d)],
    [cdiv(cmul(a21, b21), d), cadd(b22, cdiv(cmul(cmul(b21, a22), b12), d))],
  ]
}

const refOf = (parts) => {
  const z0 = parts[0].z0 ?? 50
  for (const p of parts)
    require_(
      Math.abs((p.z0 ?? 50) - z0) < 1e-12 * z0,
      `These two-ports are referred to different impedances, ${p.z0} and ${z0} ohms. Convert one before cascading them: an S entry means nothing without its reference.`,
      { field: 'z0' },
    )
  return z0
}

const freqOf = (parts) => {
  const f = parts[0].f ?? null
  for (const p of parts)
    require_(
      p.f === null || f === null || Math.abs(p.f - f) < 1e-9 * f,
      `These two-ports were measured at different frequencies, ${p.f} Hz and ${f} Hz. A cascade is composed one frequency at a time.`,
      { field: 'f' },
    )
  return f
}

/**
 * A chain of scattering records, left to right, composed by the S route.
 * Every record must share one reference impedance and one frequency, because
 * an S entry means nothing without either.
 */
export function cascade(parts) {
  require_(parts.length > 0, 'A cascade needs at least one two-port.', { field: 'parts' })
  const z0 = refOf(parts)
  const f = freqOf(parts)
  for (const p of parts) require_(p.s.length === 2, 'Only two-ports cascade. A one-port is the end of a chain, not a link in it.', { field: 'parts' })
  const s = parts.map((p) => p.s).reduce((acc, next) => cascadeS(acc, next))
  return twoPort({ f, z0, s })
}

/**
 * The same chain composed by the ABCD route: convert each link, multiply, and
 * convert back. Invariant 2 pins the two against each other.
 */
export function cascadeByAbcd(parts) {
  require_(parts.length > 0, 'A cascade needs at least one two-port.', { field: 'parts' })
  const z0 = refOf(parts)
  const f = freqOf(parts)
  const m = parts.map((p) => sToAbcd(p, z0)).reduce((acc, next) => cascadeAbcd(acc, next))
  return twoPort({ f, z0, s: abcdToS(m, z0) })
}

/**
 * The reflection looking into a two-port terminated in a load, which is what
 * the input of a matching network reads.
 *
 *   Gamma_in = S11 + S12 S21 Gamma_L / (1 - S22 Gamma_L)
 */
export function gammaIn(rec, gammaL) {
  const [[s11, s12], [s21, s22]] = rec.s
  const gl = Array.isArray(gammaL) ? gammaL : C(gammaL, 0)
  const d = csub(C(1), cmul(s22, gl))
  require_(cabs(d) > 1e-14, 'This load resonates against the two-port at this frequency, so no steady input reflection exists.', {
    field: 'gammaL',
    kind: 'lossless-resonance',
  })
  return cadd(s11, cdiv(cmul(cmul(s12, s21), gl), d))
}

/**
 * The reflection looking back into a two-port from its output, with the source
 * reflection at port 1.
 *
 *   Gamma_out = S22 + S12 S21 Gamma_S / (1 - S11 Gamma_S)
 */
export function gammaOut(rec, gammaS) {
  const [[s11, s12], [s21, s22]] = rec.s
  const gs = Array.isArray(gammaS) ? gammaS : C(gammaS, 0)
  const d = csub(C(1), cmul(s11, gs))
  require_(cabs(d) > 1e-14, 'This source resonates against the two-port at this frequency, so no steady output reflection exists.', {
    field: 'gammaS',
    kind: 'lossless-resonance',
  })
  return cadd(s22, cdiv(cmul(cmul(s12, s21), gs), d))
}

/** A series impedance as a two-port: ABCD [[1, Z], [0, 1]]. */
export const seriesTwoPort = (Z, { f = null, z0 = 50 } = {}) =>
  twoPort({ f, z0, s: abcdToS([[C(1), Array.isArray(Z) ? Z : C(Z, 0)], [C(0), C(1)]], z0) })

/** A shunt admittance as a two-port: ABCD [[1, 0], [Y, 1]]. */
export const shuntTwoPort = (Y, { f = null, z0 = 50 } = {}) =>
  twoPort({ f, z0, s: abcdToS([[C(1), C(0)], [Array.isArray(Y) ? Y : C(Y, 0), C(1)]], z0) })

/** An ideal transformer of turns ratio n as a two-port: ABCD [[n, 0], [0, 1/n]]. */
export const transformerTwoPort = (n, { f = null, z0 = 50 } = {}) =>
  twoPort({ f, z0, s: abcdToS([[C(n), C(0)], [C(0), C(1 / n)]], z0) })
