// S-parameters: the wave description a network analyser reports.
//
// CORE_SCOPE class: ADMITTED, EXACT. The S-matrix of a lumped linear circuit at
// one frequency is a complex matrix read off the exact AC solve, with no
// approximation between the two.
//
// Why waves rather than voltages. At 1 GHz an open circuit is not open and a
// short is not a short, because the stray reactance of the fixture that holds
// them is comparable with the impedance being measured. Z-parameters need an
// open at the other port and Y-parameters need a short, so neither can be
// measured. S-parameters need the other port terminated in the reference
// impedance, which is the one termination that stays what it claims to be.
//
// The definition this module implements is the one the lab teaches. At port k,
// with V_k the port voltage and I_k the current flowing INTO the network,
//
//   a_k = (V_k + Z0 I_k) / (2 sqrt(Z0))     the wave going in
//   b_k = (V_k − Z0 I_k) / (2 sqrt(Z0))     the wave coming back
//
// and S is the matrix with b = S a. A record is
// `{ f, z0, s: [[S11, S12], [S21, S22]] }`, each entry a complex.js pair.

import { complex as cx, solveAC } from '@ee-labs/network'
import { RfError, dB, deg, nonNegative, positive, require_ } from './const.js'
import { mdagger, mdiff, mmul, mnorm, msub, eye2 } from './convert.js'

const { C, cabs, cadd, carg, cdiv, cmul, cscale, csub, polar } = cx

/** A complex value from a number, a pair, or a magnitude-and-degrees pair. */
export const toComplex = (v) => (Array.isArray(v) ? [v[0], v[1]] : [Number(v), 0])

/** A complex value from a magnitude and an angle in degrees, which is how a device is quoted. */
export const fromPolarDeg = (mag, angleDeg) => polar(mag, (angleDeg * Math.PI) / 180)

/**
 * A two-port record, checked.
 *
 * `s` may be given as complex pairs or as `{ mag, deg }` objects, because a
 * device is quoted the second way on every datasheet and in every textbook.
 */
export function sparam({ f, z0 = 50, s }) {
  positive(z0, 'z0')
  nonNegative(f ?? 0, 'f')
  require_(Array.isArray(s) && s.length === 2 && s.every((row) => Array.isArray(row) && row.length === 2), 'A two-port needs a two-by-two S-matrix.', { field: 's' })
  const entry = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? fromPolarDeg(v.mag, v.deg) : toComplex(v))
  return { f, z0, s: [[entry(s[0][0]), entry(s[0][1])], [entry(s[1][0]), entry(s[1][1])]] }
}

/** One entry, as magnitude, decibels and degrees, which is how every readout prints it. */
export function entryOf(sp, i, j) {
  const v = sp.s[i][j]
  const mag = cabs(v)
  return { re: v[0], im: v[1], mag, db: mag === 0 ? -Infinity : dB(mag), deg: deg(carg(v)) }
}

// ------------------------------------------------------ the one-port numbers

/**
 * The reflection coefficient of a load against a reference impedance.
 *
 *   Γ = (Z_L − Z0) / (Z_L + Z0)
 *
 * An open circuit is its own case rather than a large number divided by
 * another, so it returns exactly 1.
 */
export function reflection(ZL, z0 = 50) {
  positive(z0, 'z0')
  if (ZL === Infinity) return C(1)
  const zl = toComplex(ZL)
  const zr = C(z0)
  const den = cadd(zl, zr)
  require_(cabs(den) > 1e-15 * Math.max(1, cabs(zl)), `A load of ${zl[0]} + j${zl[1]} ohms against a reference of ${z0} ohms has no reflection coefficient, because the sum in the denominator is zero. That load is the negative of the reference impedance, which no passive circuit builds.`, { field: 'ZL' })
  return cdiv(csub(zl, zr), den)
}

/** The load a reflection coefficient stands for: Z0 (1 + Γ)/(1 − Γ). */
export function loadFrom(gamma, z0 = 50) {
  const g = toComplex(gamma)
  const den = csub(C(1), g)
  if (cabs(den) < 1e-15) return Infinity
  return cscale(cdiv(cadd(C(1), g), den), z0)
}

/** The standing-wave ratio a reflection magnitude produces: (1 + |Γ|)/(1 − |Γ|). */
export function vswr(gamma) {
  const m = typeof gamma === 'number' ? Math.abs(gamma) : cabs(toComplex(gamma))
  if (m >= 1) return Infinity
  return (1 + m) / (1 - m)
}

/** The reflection magnitude a standing-wave ratio implies: (S − 1)/(S + 1). */
export const gammaFromVswr = (s) => (s === Infinity ? 1 : (s - 1) / (s + 1))

/** Return loss in decibels, the positive number a bench instrument prints. */
export function returnLossDb(gamma) {
  const m = typeof gamma === 'number' ? Math.abs(gamma) : cabs(toComplex(gamma))
  return m === 0 ? Infinity : -dB(m)
}

/** Mismatch loss in decibels: the fraction of incident power the load does not accept. */
export function mismatchLossDb(gamma) {
  const m = typeof gamma === 'number' ? Math.abs(gamma) : cabs(toComplex(gamma))
  return m >= 1 ? Infinity : -10 * Math.log10(1 - m * m)
}

/**
 * Every costume the one number wears, at once.
 *
 * A1 and A2 are one experiment split in two, and this is the object both read.
 * Γ, its magnitude and angle, the standing-wave ratio, the return loss and the
 * mismatch loss are five ways of writing one complex number, and a reader who
 * sees them move together stops treating them as five facts.
 */
export function mismatch(ZL, z0 = 50) {
  const g = reflection(ZL, z0)
  const mag = cabs(g)
  return {
    z0,
    ZL,
    gamma: g,
    mag,
    deg: deg(carg(g)),
    vswr: vswr(g),
    returnLossDb: returnLossDb(g),
    mismatchLossDb: mismatchLossDb(g),
    powerAccepted: 1 - mag * mag,
  }
}

// ------------------------------------------------ S from a circuit we solve

/**
 * The S-matrix of any circuit `@ee-labs/network` can solve.
 *
 * Port 1 is driven by a one-volt source through a resistance Z0 and port 2 is
 * terminated in Z0, then the two ports are swapped and the circuit is solved
 * again. Two exact AC solves give four exact complex numbers.
 *
 * With port 2 terminated in Z0 the wave into it is zero, so at port 1
 * a1 = Vs / (2 sqrt(Z0)) and b1 = (2 V1 − Vs) / (2 sqrt(Z0)), and at port 2
 * b2 = V2 / sqrt(Z0). With Vs = 1 that is
 *
 *   S11 = 2 V1 − 1        S21 = 2 V2
 *
 * and nothing in it needs the current, which is why the reading is exact
 * whatever the fixture would have done on a bench.
 *
 * `ports` names the two port nodes, both referred to ground, and the netlist
 * itself carries no independent source: a two-port is described by what is
 * driven into it.
 */
export function sFromNetlist(net, ports, f, { z0 = 50 } = {}) {
  positive(z0, 'z0')
  positive(f, 'f')
  require_(Array.isArray(ports) && ports.length === 2, 'A two-port needs two port nodes, each referred to ground.', { field: 'ports' })
  const elements = net.elements || net
  require_(
    !elements.some((e) => e.type === 'V' || e.type === 'I'),
    'This circuit carries an independent source of its own. An S-matrix describes what a circuit does to waves driven into it, so the two-port must be passive at the ports and the drive is added here.',
    { field: 'elements' },
  )
  const omega = 2 * Math.PI * f
  const drive = (a, b) => {
    const net2 = {
      elements: [
        ...elements,
        { type: 'V', id: '__vs', nodes: ['__s', 'gnd'], value: 0 },
        { type: 'R', id: '__rs', nodes: ['__s', ports[a]], value: z0 },
        { type: 'R', id: '__rl', nodes: [ports[b], 'gnd'], value: z0 },
      ],
    }
    const ac = solveAC(net2, omega, { sources: { __vs: [1, 0] } })
    return { vDriven: ac.v[ports[a]], vOther: ac.v[ports[b]] }
  }
  const one = drive(0, 1)
  const two = drive(1, 0)
  const s11 = csub(cscale(one.vDriven, 2), C(1))
  const s21 = cscale(one.vOther, 2)
  const s22 = csub(cscale(two.vDriven, 2), C(1))
  const s12 = cscale(two.vOther, 2)
  return sparam({ f, z0, s: [[s11, s12], [s21, s22]] })
}

/**
 * A one-port's reflection, read the same way: drive it through Z0 and read the
 * node. S11 = 2 V − 1, and nothing else.
 */
export function s11FromNetlist(net, port, f, { z0 = 50 } = {}) {
  positive(f, 'f')
  const elements = net.elements || net
  const net2 = {
    elements: [...elements, { type: 'V', id: '__vs', nodes: ['__s', 'gnd'], value: 0 }, { type: 'R', id: '__rs', nodes: ['__s', port], value: z0 }],
  }
  const ac = solveAC(net2, 2 * Math.PI * f, { sources: { __vs: [1, 0] } })
  return csub(cscale(ac.v[port], 2), C(1))
}

// ------------------------------------------------------------ the properties

/** Reciprocity: S12 equals S21 for any network of ordinary passive elements. */
export const reciprocityError = (sp) => cabs(csub(sp.s[0][1], sp.s[1][0])) / Math.max(1e-300, mnorm(sp.s))

/** How far a two-port is from lossless, as the largest entry of S†S − I. */
export const unitarityError = (sp) => mnorm(msub(mmul(mdagger(sp.s), sp.s), eye2()))

/**
 * The fraction of the incident power at port 1 that the network dissipates.
 * A network of L and C alone dissipates none, and a resistor in it dissipates
 * exactly what the sum of the squared magnitudes falls short of.
 */
export const dissipated = (sp) => 1 - cabs(sp.s[0][0]) ** 2 - cabs(sp.s[1][0]) ** 2

/**
 * The largest singular value of S, which is the most any combination of
 * incident waves can be amplified by. A passive network holds it at or below
 * one, and that is the numerical statement of passivity.
 *
 * For a two-by-two matrix it is the square root of the larger eigenvalue of
 * S†S, and that eigenvalue is a root of a real quadratic, so it is exact.
 */
export function largestSingular(sp) {
  const M = mmul(mdagger(sp.s), sp.s)
  // S†S is Hermitian, so its diagonal is real and its eigenvalues are
  //   (m11 + m22)/2 ± sqrt(((m11 − m22)/2)² + |m12|²).
  //
  // Written that way rather than through the trace and the determinant. The
  // determinant form subtracts two numbers that are equal for a lossless
  // network, so it loses eight digits exactly where the answer matters, and it
  // reported a singular value of 1 + 5e-9 for a network that is unitary to
  // 1e-11. Nothing here subtracts two nearly equal quantities.
  const half = (M[0][0][0] + M[1][1][0]) / 2
  const d = (M[0][0][0] - M[1][1][0]) / 2
  const off = cabs(M[0][1])
  return Math.sqrt(Math.max(0, half + Math.hypot(d, off)))
}

/** How far two S records are apart, relative to their scale. */
export const sDiff = (a, b) => mdiff(a.s, b.s)

export { RfError, mdiff }
