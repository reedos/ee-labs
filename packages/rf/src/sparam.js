// Scattering parameters: the wave description of a two-port.
//
// CLASS, under CORE_SCOPE.md: EXACT, and never hedged. The S-matrix of a
// lumped linear circuit at one frequency is a complex matrix read off the
// exact AC solve, with no approximation between the circuit and the four
// numbers. Two solves give four numbers, and that is the whole of it.
//
// The definition this module implements is the one the lab teaches. At port k,
// with a real reference impedance Z_0,
//
//   a_k = (V_k + Z_0 I_k) / (2 sqrt(Z_0))     the wave going in
//   b_k = (V_k - Z_0 I_k) / (2 sqrt(Z_0))     the wave coming back
//
// and S is the matrix with b = S a. Every entry is measured with the other
// port terminated in Z_0, which is why the description still works at a
// frequency where an open circuit is not open.
//
// The record is { f, z0, s: [[S11, S12], [S21, S22]] } with each entry a
// complex.js [re, im] pair. A one-port is the same record with a 1 by 1 s.

import { complex as cx, normalize, solveAC } from '@ee-labs/network'
import { reflectionCoefficient, standingWaveRatio } from '@ee-labs/fields'

const { C, cabs, cadd, carg, cmul, conj, cscale, csub, polar } = cx

/** The error every function in this package throws, in `FieldsError`'s register. */
export class RfError extends Error {
  constructor(message, detail = {}) {
    super(message)
    this.name = 'RfError'
    Object.assign(this, detail)
  }
}

/** Throw `RfError` with a stated reason when a requirement does not hold. */
export function require_(cond, message, detail = {}) {
  if (!cond) throw new RfError(message, detail)
  return true
}

/** A number or an [re, im] pair, as a pair. */
export const toC = (v) => (Array.isArray(v) ? [v[0], v[1]] : [Number(v), 0])

/** A complex number written the way a data sheet writes one: magnitude and degrees. */
export const polarDeg = (mag, deg) => polar(mag, (deg * Math.PI) / 180)

/** The magnitude of a complex entry in decibels, and minus infinity at zero. */
export const magDb = (v) => {
  const m = cabs(toC(v))
  return m === 0 ? -Infinity : 20 * Math.log10(m)
}

/** The angle of a complex entry in degrees. */
export const angleDeg = (v) => (carg(toC(v)) * 180) / Math.PI

// ------------------------------------------------------------- the record

const ROWS = (s) => s.length
const square = (s) => Array.isArray(s) && s.length > 0 && s.every((row) => Array.isArray(row) && row.length === s.length)

/**
 * A two-port (or one-port) scattering record, validated and normalised.
 *
 * `f` is the frequency the matrix was measured at, in hertz, and it is carried
 * because every S number depends on it. `z0` is the real reference impedance
 * every entry is referred to, and it is carried for the same reason: an
 * S-matrix without its reference is four numbers with no meaning.
 */
export function twoPort({ f = null, z0 = 50, s, label = null }) {
  require_(square(s), 'A scattering matrix must be square: one entry for a one-port, two by two for a two-port.', { field: 's' })
  require_(ROWS(s) <= 2, `This package describes one-ports and two-ports. A ${ROWS(s)}-port needs a larger solve than two terminations.`, { field: 's' })
  require_(z0 > 0, `The reference impedance must be a positive resistance, not ${z0}.`, { field: 'z0' })
  require_(f === null || f > 0, `The frequency must be positive, not ${f}.`, { field: 'f' })
  const m = s.map((row) => row.map(toC))
  for (const row of m)
    for (const e of row) require_(Number.isFinite(e[0]) && Number.isFinite(e[1]), 'A scattering entry must be a finite complex number.', { field: 's' })
  return { f, z0, s: m, ports: ROWS(s), label }
}

/** A one-port from its reflection coefficient. */
export const onePort = (gamma, { f = null, z0 = 50, label = null } = {}) => twoPort({ f, z0, s: [[toC(gamma)]], label })

/** A two-port from four entries in the reading order S11, S12, S21, S22. */
export const fromEntries = (s11, s12, s21, s22, opts = {}) => twoPort({ ...opts, s: [[s11, s12], [s21, s22]] })

/**
 * A two-port from a data sheet's polar form: magnitude and angle in degrees,
 * in the order S11, S12, S21, S22. The two curated device sets are written
 * this way, because that is the way a device is quoted.
 */
export const fromPolar = (entries, opts = {}) =>
  fromEntries(...entries.map(([mag, deg]) => polarDeg(mag, deg)), opts)

// -------------------------------------------------------------- measures

/** The reflection coefficient of a load against a reference impedance. */
export { reflectionCoefficient as reflection, standingWaveRatio as vswr }

/** Return loss in decibels: how far below the incident wave the reflected one is. */
export const returnLossDb = (mag) => (mag === 0 ? Infinity : -20 * Math.log10(mag))

/** Mismatch loss in decibels: the fraction of the incident power the load does not take. */
export const mismatchLossDb = (mag) => (mag >= 1 ? Infinity : -10 * Math.log10(1 - mag * mag))

/** Every costume one reflection coefficient wears, from the coefficient itself. */
export function mismatch(gamma) {
  const g = toC(gamma)
  const mag = cabs(g)
  return {
    gamma: g,
    mag,
    deg: angleDeg(g),
    vswr: standingWaveRatio(mag),
    returnLossDb: returnLossDb(mag),
    mismatchLossDb: mismatchLossDb(mag),
  }
}

/** Whether a two-port is reciprocal, which every network of R, L and C is: S12 = S21. */
export function reciprocityError(rec) {
  const { s } = rec
  if (s.length < 2) return 0
  return cabs(csub(s[0][1], s[1][0]))
}

/**
 * How far a two-port is from lossless, as the largest entry of S†S - I.
 *
 * A network of L and C alone dissipates nothing, so its scattering matrix is
 * unitary and this is zero to floating point. A resistor in the network makes
 * it positive, and the amount is the dissipated fraction.
 */
export function unitarityError(rec) {
  const { s } = rec
  const n = s.length
  let worst = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = C(0)
      for (let k = 0; k < n; k++) sum = cadd(sum, cmul(conj(s[k][i]), s[k][j]))
      const want = i === j ? 1 : 0
      worst = Math.max(worst, cabs(csub(sum, C(want))))
    }
  }
  return worst
}

/**
 * The power leaving a two-port when port `k` is driven and the other is
 * terminated, as a fraction of the incident power, and what is left over.
 *
 * For a passive network the reflected and transmitted fractions sum to at most
 * one, and the shortfall is what the resistors turned into heat.
 */
export function powerBalance(rec, k = 0) {
  const { s } = rec
  const n = s.length
  let out = 0
  for (let i = 0; i < n; i++) out += cabs(s[i][k]) ** 2
  return { out, dissipated: 1 - out }
}

/**
 * The largest singular value of S, which is at most one for a passive network.
 *
 * Computed as the square root of the largest eigenvalue of S†S, in closed form
 * for the two by two case rather than by an iteration, so the number is exact.
 */
export function maxSingularValue(rec) {
  const { s } = rec
  const n = s.length
  if (n === 1) return cabs(s[0][0])
  // S†S is Hermitian positive semi-definite, so its two eigenvalues are the
  // roots of lambda^2 - trace lambda + det, both real and non-negative.
  const g = (i, j) => {
    let sum = C(0)
    for (let k = 0; k < n; k++) sum = cadd(sum, cmul(conj(s[k][i]), s[k][j]))
    return sum
  }
  const g11 = g(0, 0)[0]
  const g22 = g(1, 1)[0]
  const g12 = g(0, 1)
  const trace = g11 + g22
  const det = g11 * g22 - (g12[0] * g12[0] + g12[1] * g12[1])
  const disc = Math.max(0, trace * trace - 4 * det)
  return Math.sqrt(Math.max(0, (trace + Math.sqrt(disc)) / 2))
}

// ------------------------------------------------- S from a circuit we solve

const SRC = '__rf_drive'
const SRC_NODE = '__rf_src'

/**
 * The scattering matrix of any circuit `@ee-labs/network` can solve.
 *
 * Port k is driven by a source of internal resistance Z_0, every other port is
 * terminated in Z_0, and one exact AC solve reads the waves. With the source
 * emf set to one volt the incident wave is a_k = 1 / (2 sqrt(Z_0)), and the
 * node voltages give the rest with no square roots left in them:
 *
 *   S_kk = 2 V_k - 1        the driven port
 *   S_ik = 2 V_i            every other port, terminated in Z_0
 *
 * because at a terminated port the current is -V_i / Z_0, so b_i = V_i /
 * sqrt(Z_0), and at the driven port the source current is (1 - V_k) / Z_0.
 * Two solves give four exact complex numbers.
 *
 * `ports` names one node per port, each measured against ground. Every
 * independent source already in the netlist is set to zero, because an
 * S-matrix describes what a network does to a wave and not what it generates.
 */
export function sFromNetlist(net, ports, f, { z0 = 50 } = {}) {
  require_(Array.isArray(ports) && ports.length >= 1 && ports.length <= 2, 'A scattering matrix is measured at one or two ports.', { field: 'ports' })
  require_(z0 > 0, `The reference impedance must be a positive resistance, not ${z0}.`, { field: 'z0' })
  require_(f > 0, `The frequency must be positive, not ${f}.`, { field: 'f' })
  const elements = (net.elements || net).slice()
  for (const p of ports) require_(p !== 'gnd' && p !== 'GND' && p !== '0', 'A port cannot be ground. Name the node the wave arrives at.', { field: 'ports' })
  // Every source already in the circuit is silenced. What is measured is the
  // response to the wave this function launches, and nothing else.
  const sources = {}
  for (const e of elements) if (e.type === 'V' || e.type === 'I') sources[e.id] = C(0)
  sources[SRC] = C(1)
  const omega = 2 * Math.PI * f
  const n = ports.length
  const s = Array.from({ length: n }, () => Array.from({ length: n }, () => C(0)))

  for (let k = 0; k < n; k++) {
    const built = [
      ...elements,
      { type: 'V', id: SRC, nodes: [SRC_NODE, 'gnd'], value: 0 },
      { type: 'R', id: `${SRC}_rs`, nodes: [SRC_NODE, ports[k]], value: z0 },
      ...ports.filter((_, j) => j !== k).map((p, j) => ({ type: 'R', id: `${SRC}_rl${j}`, nodes: [p, 'gnd'], value: z0 })),
    ]
    const ac = solveAC(normalize({ elements: built }), omega, { sources, anyFreq: true })
    for (let i = 0; i < n; i++) {
      const v = ac.v[ports[i]]
      require_(v !== undefined, `Port ${ports[i]} is not a node of this circuit.`, { field: 'ports' })
      s[i][k] = i === k ? csub(cscale(v, 2), C(1)) : cscale(v, 2)
    }
  }
  return twoPort({ f, z0, s })
}

/** The reflection looking into a one-port netlist, as a scattering record. */
export const gammaFromNetlist = (net, port, f, opts = {}) => sFromNetlist(net, [port], f, opts)
