// The pn junction, in the four closed forms a course states.
//
// Circuit Elements Lab gave Shockley's law as a fact: the current rises as
// e^{v/V_T}, and the constant I_S is a property of the part. This file is where
// that fact comes from. Two doped regions meet, the carriers that cross leave
// their donors and acceptors behind, and the exposed charge builds a barrier —
// the built-in potential V_0. Forward bias lowers the barrier, and the current
// that crosses it is exponential in how much it was lowered.
//
// Four results, and every later default in the Electronics Lab that is not a
// resistor value comes from one of them:
//
//   V_0        the barrier, from the doping         → C1
//   C_j(v)     the depletion charge's slope         → C2, and the transistor's C_μ
//   C_d        the stored charge's slope            → C3, and most of C_π
//   I_S(T)     the temperature law                  → C4, and E4's bias drift
//
// Nothing here is a fit or a datasheet number. Each is an algebraic consequence
// of the depletion approximation, which is the one step taken on trust, and the
// pane says so. What the file does NOT do is put a voltage-dependent
// capacitance into a time-domain solve: C_j(v) is a small-signal value at an
// operating point, and a capacitance that changes with its own voltage is not
// linear inside a region. That is declined for the reason diode.js gives.

import { NetworkError } from './netlist.js'
import { K_B, Q_E, T_ROOM, thermalVoltage } from './diode.js'

/** Silicon's relative permittivity, and the permittivity of free space (SI). */
export const EPS_0 = 8.8541878128e-12
export const EPS_SI = 11.7 * EPS_0
/** Silicon's band gap at 300 K, in electron volts. */
export const EG_SI = 1.12
/** The intrinsic carrier concentration of silicon at 300 K: 1.5 × 10¹⁰ cm⁻³, in m⁻³. */
export const N_I_300 = 1.5e16

/**
 * The intrinsic concentration at T. It follows the same law I_S does, because
 * it is the reason I_S follows it: n_i² ∝ T³ e^{−E_g/kT}.
 */
export function niAt(T = T_ROOM, { ni = N_I_300, eg = EG_SI } = {}) {
  if (!(T > 0)) throw new NetworkError('value', 'Temperature must be above absolute zero')
  const vt = thermalVoltage(T)
  const vt0 = thermalVoltage(T_ROOM)
  return ni * (T / T_ROOM) ** 1.5 * Math.exp((-eg / 2) * (1 / vt - 1 / vt0))
}

/**
 * The built-in potential: V_0 = V_T ln(N_A N_D / n_i²).
 * Doping in m⁻³. At 10¹⁷ and 10¹⁶ cm⁻³ this is 752.9 mV — larger than the
 * 0.7 V a diode drops, which is the point: the applied bias never reaches it.
 */
export function builtIn({ na, nd, T = T_ROOM, ni = null, eg = EG_SI }) {
  if (!(na > 0) || !(nd > 0)) throw new NetworkError('value', 'Both dopings must be positive')
  const n = ni ?? niAt(T, { eg })
  return thermalVoltage(T) * Math.log((na * nd) / (n * n))
}

/**
 * The depletion region at bias v, under the depletion approximation: every
 * carrier gone inside it, none gone outside. Returns the total width in metres
 * and the part on each side. The lightly doped side takes most of it, because
 * the charge each side exposes has to match.
 *
 * Forward bias narrows the region, and at v = V_0 the width is zero — beyond
 * that the approximation has nothing left to describe, so it refuses.
 */
export function depletionWidth({ na, nd, T = T_ROOM, ni = null, eg = EG_SI, eps = EPS_SI }, v = 0) {
  const v0 = builtIn({ na, nd, T, ni, eg })
  if (v >= v0)
    throw new NetworkError(
      'junction-forward',
      `A forward bias of ${v.toPrecision(4)} V is at or past the built-in potential of ${v0.toPrecision(4)} V. The depletion approximation describes a region emptied of carriers, and at that bias there is no such region: the barrier is gone and the junction is a resistor of the neutral material.`,
      { v, v0 },
    )
  const w = Math.sqrt(((2 * eps * (v0 - v)) / Q_E) * (1 / na + 1 / nd))
  return { w, xp: (w * nd) / (na + nd), xn: (w * na) / (na + nd), v0 }
}

/**
 * The depletion capacitance: the slope of the stored depletion charge against
 * the bias, C_j = C_j0/(1 − v/V_0)^m. A step junction has m = ½, which is the
 * same square root the width has. This is the transistor's C_μ, and it is why
 * a reverse-biased collector junction gets faster as the voltage rises.
 */
export function junctionCap({ cj0, v0, m = 0.5 }, v = 0) {
  if (!(cj0 > 0)) throw new NetworkError('value', 'C_j0 must be positive')
  if (!(v0 > 0)) throw new NetworkError('value', 'The built-in potential must be positive')
  if (v >= v0)
    throw new NetworkError(
      'junction-forward',
      `C_j is unbounded at the built-in potential of ${v0.toPrecision(4)} V and has no value past it. A forward-biased junction's capacitance is the diffusion capacitance instead, τ_F g_m, which stays finite.`,
      { v, v0 },
    )
  return cj0 / (1 - v / v0) ** m
}

/**
 * The diffusion capacitance: a forward junction stores τ_F·I of minority
 * charge, so its slope against voltage is τ_F·di/dv = τ_F·g_m. At 1 mA with a
 * transit time of 0.5 ns this is 19.3 pF, and it is most of a transistor's
 * C_π. It rises with current where C_j falls with voltage, which is why f_T
 * has a maximum.
 */
export function diffusionCap({ tauF }, gm) {
  if (!(tauF >= 0)) throw new NetworkError('value', 'The transit time cannot be negative')
  return tauF * gm
}

/**
 * SPICE's temperature law for the saturation current:
 * I_S(T) = I_S(T₀)(T/T₀)^XTI e^{(E_g/V_T0)(1 − T₀/T)}.
 * The exponential dominates: I_S doubles about every 4.5 K near room
 * temperature, which is why a diode left to itself runs away.
 */
export function isAt({ is, T0 = T_ROOM, eg = EG_SI, xti = 3 }, T) {
  if (!(is > 0)) throw new NetworkError('value', 'I_S must be positive')
  if (!(T > 0) || !(T0 > 0)) throw new NetworkError('value', 'Temperature must be above absolute zero')
  const vt0 = thermalVoltage(T0)
  return is * (T / T0) ** xti * Math.exp((eg / vt0) * (1 - T0 / T))
}

/**
 * How far apart two temperatures have to be for I_S to double, exactly, from
 * the law above rather than from its slope. Near 300 K it is 4.5 K.
 */
export function doubling(params, T = T_ROOM, factor = 2) {
  const base = isAt(params, T)
  let lo = 0
  let hi = T
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    if (isAt(params, T + mid) / base < factor) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * dV_BE/dT at a fixed collector current, in volts per kelvin.
 *
 * V_BE = V_T ln(I/I_S), and differentiating with I held fixed gives
 * (V_BE − E_g − XTI·V_T)/T. It is negative, and it depends on where the
 * junction is biased: −1.66 mV/K at 0.7 V and −1.99 mV/K at 0.6 V. The
 * textbook's "−2 mV/K" is the second of those.
 */
export function vbeSlope({ vbe, eg = EG_SI, xti = 3 }, T = T_ROOM) {
  if (!(T > 0)) throw new NetworkError('value', 'Temperature must be above absolute zero')
  return (vbe - eg - xti * thermalVoltage(T)) / T
}

/**
 * The transition frequency a transistor's capacitances allow:
 * f_T = g_m/(2π(C_π + C_μ)). With C_π mostly diffusion, raising the current
 * raises g_m and C_π together, and f_T climbs toward 1/(2π τ_F).
 */
export function transitFreq({ gm, cpi, cmu = 0 }) {
  if (!(cpi + cmu > 0)) throw new NetworkError('value', 'A transistor with no capacitance has no f_T')
  return gm / (2 * Math.PI * (cpi + cmu))
}

/** The ceiling f_T climbs toward as the current rises: 1/(2π τ_F). */
export const transitLimit = (tauF) => 1 / (2 * Math.PI * tauF)

export { K_B, Q_E, T_ROOM, thermalVoltage }
