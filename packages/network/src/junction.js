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

// ---------------------------------------------------------------------------
// The Devices Lab's additions.
//
// Everything above is the four closed forms an electronics course states. What
// follows is where each of them comes from, and the three devices that stand
// on them. Nothing above changes. Every export keeps its signature, and the
// four results keep their numbers, which junction.test.js checks first.
//
// One model is labelled and everything inside it is exact. The depletion
// approximation says every mobile carrier is gone inside the depletion region
// and none is gone outside it. Poisson's equation over that step charge
// integrates twice in closed form, so `profile` returns polynomials rather
// than a grid. What the model leaves out is named where it is used: the
// carrier tails at the edges, a few Debye lengths wide, the small field in the
// neutral material, and generation inside the layer.
//
// Carrier concentrations inside the depletion region are a different question.
// They need the drift-diffusion system on a mesh, with generation and
// recombination, and its answer is a numerical field rather than a formula.
// diode.js declines the exponential diode in time for the same reason, and
// `driftDiffusion` below declines this with the reason.

/** The permittivity of silicon dioxide: 3.9 ε₀, in F/m. */
export const EPS_OX = 3.9 * EPS_0
/** The conduction and valence band-edge densities of silicon at 300 K (Green 1990), in m⁻³. */
export const N_C_SI = 2.86e25
export const N_V_SI = 2.66e25
/** Planck's constant (J·s) and the speed of light (m/s), for the emission wavelength. */
export const H_PLANCK = 6.62607015e-34
export const C_LIGHT = 299792458
/** The field at which avalanche multiplication runs away in silicon, V/m. Data, not derived. */
export const E_AVALANCHE = 3e7
/** The field tunnelling needs, V/m. Data, not derived. */
export const E_ZENER = 1e8
/** Above this doping the Boltzmann approximation fails and Fermi–Dirac statistics are needed, m⁻³. */
export const DEGENERATE = 1e25

/**
 * The intrinsic concentration from the band-edge densities:
 * n_i = √(N_c N_v) e^{−E_g/2kT}. At Green's values that is 1.079 × 10¹⁶ m⁻³ at
 * 300 K, where the suite's constant is 1.5 × 10¹⁶. Both are in print, and the
 * lab prints the ratio and the band gap each one implies.
 */
export function niFrom({ nc = N_C_SI, nv = N_V_SI, eg = EG_SI, T = T_ROOM } = {}) {
  if (!(T > 0)) throw new NetworkError('value', 'Temperature must be above absolute zero')
  return Math.sqrt(nc * nv) * Math.exp(-eg / (2 * thermalVoltage(T)))
}

/** The band gap a stated n_i implies at T, from the same law read backwards. */
export function gapFrom({ ni = N_I_300, nc = N_C_SI, nv = N_V_SI, T = T_ROOM } = {}) {
  if (!(ni > 0)) throw new NetworkError('value', 'The intrinsic concentration must be positive')
  return 2 * thermalVoltage(T) * Math.log(Math.sqrt(nc * nv) / ni)
}

/**
 * The carrier concentrations, from the neutrality condition solved exactly.
 *
 * n − p = N_D − N_A and n p = n_i² are two equations in two unknowns, and the
 * positive root is the answer at every doping. Writing n ≈ N_D instead is
 * wrong wherever the net doping is not far above n_i, which is where a lightly
 * doped sample goes when it is warmed.
 *
 * `efi` is E_F − E_i in volts, from E_F − E_i = kT ln(n/n_i).
 *
 * The quadratic is solved on the majority side and the minority side follows
 * from n p = n_i². Writing the same root for both loses the minority carrier
 * to cancellation: at 10¹⁷ cm⁻³ the two terms of the numerator agree to
 * fourteen figures and their difference is left with two, which came out 0.08 %
 * wrong before this was written the other way round.
 */
export function carriers({ na = 0, nd = 0, T = T_ROOM, ni = null, eg = EG_SI } = {}) {
  if (!(na >= 0) || !(nd >= 0)) throw new NetworkError('value', 'A doping cannot be negative')
  const n_i = ni ?? niAt(T, { eg })
  const net = nd - na
  const root = Math.sqrt(net * net + 4 * n_i * n_i)
  const n = net >= 0 ? (net + root) / 2 : (2 * n_i * n_i) / (root - net)
  const p = net >= 0 ? (2 * n_i * n_i) / (root + net) : (root - net) / 2
  return {
    n,
    p,
    ni: n_i,
    net,
    efi: thermalVoltage(T) * Math.log(n / n_i),
    type: net > 0 ? 'n' : net < 0 ? 'p' : 'intrinsic',
    majority: Math.max(n, p),
    minority: Math.min(n, p),
    extrinsic: Math.abs(net) > 2 * n_i,
  }
}

/**
 * The guard on Boltzmann statistics, which every formula in this file assumes.
 *
 * Above about 10¹⁹ cm⁻³ the Fermi level enters the band, the Boltzmann tail is
 * no longer the right count of states, and Fermi–Dirac statistics are needed.
 * That is a warning rather than a refusal, because the library's own emitter is
 * doped 10¹⁹ cm⁻³ and its heavily doped junction is 10¹⁹ against 10¹⁸. The
 * numbers there are still the ones the model gives, and the pane says which
 * model gave them.
 */
export function degenerate({ n, threshold = DEGENERATE }) {
  if (!(n > 0)) throw new NetworkError('value', 'The doping must be positive')
  return {
    degenerate: n >= threshold,
    threshold,
    ratio: n / threshold,
    reason:
      n >= threshold
        ? `At ${(n / 1e6).toPrecision(3)} cm⁻³ the Fermi level has entered the band, and every formula here assumes Boltzmann statistics. Fermi–Dirac statistics are needed above ${(threshold / 1e6).toPrecision(2)} cm⁻³, and the band gap narrows as well. The numbers stay the ones this model gives.`
        : '',
  }
}

/**
 * The temperature at which a stated net doping stops being extrinsic.
 *
 * The condition is the one `carriers` reports. The majority concentration has
 * risen a stated factor above the net doping, because intrinsic pair production
 * has caught up with the dopants. Found by bisection on temperature.
 */
export function intrinsicAt({ net, factor = 1.1, eg = EG_SI, lo = 200, hi = 1200 } = {}) {
  if (!(net > 0)) throw new NetworkError('value', 'The net doping must be positive')
  const excess = (T) => carriers({ nd: net, T, eg }).n / net
  if (excess(hi) < factor) return Infinity
  let a = lo
  let b = hi
  for (let k = 0; k < 200; k++) {
    const mid = (a + b) / 2
    if (excess(mid) < factor) a = mid
    else b = mid
  }
  return (a + b) / 2
}

// ---------------------------------------------------------------- the profile

/**
 * Charge, field and potential across a step junction, in closed form.
 *
 * Position runs from −x_p on the p side to +x_n on the n side, with zero at the
 * metallurgical boundary. Inside the depletion region the charge density is the
 * dopant charge alone, −qN_A on the p side and +qN_D on the n side. Poisson's
 * equation integrates once to a triangle and twice to two parabolas that meet,
 * so each of the three is a polynomial and none of them is on a grid.
 *
 * The returned functions take metres and give C/m³, V/m and volts. The
 * potential is measured from the p-side edge, so it climbs to V_0 − v at the
 * n-side edge. The field is negative throughout, which is the direction that
 * holds the carriers back, and `emax` is its magnitude at the boundary.
 */
export function profile({ na, nd, T = T_ROOM, ni = null, eg = EG_SI, eps = EPS_SI }, v = 0) {
  const { w, xp, xn, v0 } = depletionWidth({ na, nd, T, ni, eg, eps }, v)
  const vj = v0 - v
  const emax = (Q_E * na * xp) / eps
  return {
    w,
    xp,
    xn,
    v0,
    vj,
    emax,
    eps,
    edges: [-xp, xn],
    /** The charge density at x, C/m³: a step, and zero outside the region. */
    rho: (x) => (x < -xp || x > xn ? 0 : x < 0 ? -Q_E * na : Q_E * nd),
    /** The field at x, V/m: Poisson integrated once, a triangle peaking at the boundary. */
    field: (x) => {
      if (x <= -xp || x >= xn) return 0
      return x < 0 ? (-Q_E * na * (x + xp)) / eps : (-Q_E * nd * (xn - x)) / eps
    },
    /** The potential at x, volts, measured from the p-side edge: two parabolas that meet. */
    potential: (x) => {
      if (x <= -xp) return 0
      if (x >= xn) return vj
      return x < 0 ? (Q_E * na * (x + xp) * (x + xp)) / (2 * eps) : vj - (Q_E * nd * (xn - x) * (xn - x)) / (2 * eps)
    },
  }
}

/**
 * The peak field, from the depletion charge on one side.
 *
 * The same number is 2V_j/W, because the area under a triangle of height E_max
 * and base W is the junction potential. Both routes are available, and the
 * lesson measures them against each other rather than quoting one twice.
 */
export function peakField(structure, v = 0) {
  return profile(structure, v).emax
}

/**
 * The bias at which the peak field reaches a stated critical field.
 *
 * E_max² = 2qV_j/(ε(1/N_A + 1/N_D)), so the junction potential at breakdown is
 * εE_crit²(1/N_A + 1/N_D)/2q. On a one-sided junction that reduces to the
 * textbook's εE_crit²/2qN_D. Returns the junction potential, the applied bias
 * that produces it, and the width the layer has reached.
 *
 * The critical field is a material constant taken as data. Avalanche runs away
 * near 3 × 10⁵ V/cm. Tunnelling needs about 10⁶ V/cm and two heavily doped
 * sides, which is why a diode rated below about 6 V breaks down the other way.
 */
export function breakdown({ na, nd, T = T_ROOM, ni = null, eg = EG_SI, eps = EPS_SI }, ecrit = E_AVALANCHE) {
  if (!(ecrit > 0)) throw new NetworkError('value', 'The critical field must be positive')
  const v0 = builtIn({ na, nd, T, ni, eg })
  const vj = (eps * ecrit * ecrit * (1 / na + 1 / nd)) / (2 * Q_E)
  const w = Math.sqrt(((2 * eps * vj) / Q_E) * (1 / na + 1 / nd))
  return { vj, v: v0 - vj, w, v0, emax: ecrit, mechanism: vj < 6 ? 'tunnelling' : 'avalanche' }
}

/**
 * The saturation current from the geometry, rather than as a datasheet number.
 *
 * I_S = qA n_i²(D_p/(L_p N_D) + D_n/(L_n N_A)), with each diffusion constant
 * from Einstein's relation D = (kT/q)µ and each diffusion length from
 * L = √(Dτ). This is where Shockley's law's one constant comes from.
 */
export function saturationCurrent({ na, nd, area, mup = 0.045, mun = 0.11, taup = 1e-6, taun = 1e-6, T = T_ROOM, ni = null, eg = EG_SI }) {
  if (!(na > 0) || !(nd > 0)) throw new NetworkError('value', 'Both dopings must be positive')
  if (!(area > 0)) throw new NetworkError('value', 'The junction area must be positive')
  const vt = thermalVoltage(T)
  const n_i = ni ?? niAt(T, { eg })
  const dp = vt * mup
  const dn = vt * mun
  const lp = Math.sqrt(dp * taup)
  const ln = Math.sqrt(dn * taun)
  const hole = dp / (lp * nd)
  const electron = dn / (ln * na)
  return { is: Q_E * area * n_i * n_i * (hole + electron), dp, dn, lp, ln, hole, electron, vt }
}

/**
 * The Debye length, √(ε kT/(q²N)): the width of the carrier tail the depletion
 * approximation replaces with a step. Against the region's own width that ratio
 * is the size of the error the model carries.
 */
export function debyeLength({ n, T = T_ROOM, eps = EPS_SI }) {
  if (!(n > 0)) throw new NetworkError('value', 'The concentration must be positive')
  return Math.sqrt((eps * thermalVoltage(T)) / (Q_E * n))
}

/**
 * Carrier concentrations inside the depletion region, declined.
 *
 * The depletion approximation states the charge there and says nothing about
 * the carriers. Getting them needs the drift-diffusion system solved on a mesh,
 * with generation and recombination, and its answer is a numerical field whose
 * error cannot be separated from the physics by anything this suite has. So the
 * refusal is the content, and it names the three things the model replaces.
 */
export function driftDiffusion() {
  throw new NetworkError(
    'transport-declined',
    'Carrier concentrations inside the depletion region need the drift-diffusion system solved on a mesh, with generation and recombination, and that answer is a numerical field rather than a formula. The depletion approximation replaces three things instead. The carrier tails at the two edges are a few Debye lengths wide. The neutral material carries a small field this model sets to zero. Generation inside the layer adds a current this model leaves out.',
  )
}

// --------------------------------------------------------- the MOS capacitor

/** The oxide capacitance per unit area, F/m²: ε_ox/t_ox and nothing else. */
export function oxideCap({ tox, epsOx = EPS_OX }) {
  if (!(tox > 0)) throw new NetworkError('value', 'The oxide thickness must be positive')
  return epsOx / tox
}

/**
 * The bulk potential φ_F = (kT/q) ln(N_A/n_i), volts, positive on p-type.
 *
 * A substrate whose doping has fallen to n_i is not p-type any more, and every
 * expression built on φ_F takes a square root of it. So the boundary is a
 * refusal with a reason rather than a NaN passed downstream, and it is the same
 * boundary the carriers experiment walks by warming a lightly doped sample.
 */
export function bulkPotential({ na, T = T_ROOM, ni = null, eg = EG_SI }) {
  if (!(na > 0)) throw new NetworkError('value', 'The substrate doping must be positive')
  const n_i = ni ?? niAt(T, { eg })
  if (na <= n_i)
    throw new NetworkError(
      'substrate-intrinsic',
      `A substrate doped ${(na / 1e6).toPrecision(3)} cm⁻³ has gone intrinsic at ${T.toPrecision(4)} K, where n_i is ${(n_i / 1e6).toPrecision(3)} cm⁻³. It is not p-type any more, so it has no bulk potential and no inversion to reach. Dope it more heavily or cool it.`,
      { na, ni: n_i, T },
    )
  return thermalVoltage(T) * Math.log(na / n_i)
}

/**
 * The depletion width under the gate at a surface potential, and the widest it
 * ever gets. Past a surface potential of 2φ_F the inversion layer takes every
 * further electron the gate asks for, so the depletion layer stops growing at
 * W_max = √(4ε_sφ_F/(qN_A)).
 */
export function surfaceDepletion({ na, T = T_ROOM, ni = null, eg = EG_SI, eps = EPS_SI }, psi) {
  const phiF = bulkPotential({ na, T, ni, eg })
  const wmax = Math.sqrt((4 * eps * phiF) / (Q_E * na))
  const held = Math.min(Math.max(psi, 0), 2 * phiF)
  return { w: Math.sqrt((2 * eps * held) / (Q_E * na)), wmax, phiF, psi: held }
}

/**
 * The three gate materials, each as a stated work-function difference against
 * p-type silicon. For an n⁺ polysilicon gate φ_ms = −(E_g/2 + φ_F).
 */
export const GATES = {
  'n+ poly': (phiF, eg) => -(eg / 2 + phiF),
  'p+ poly': (phiF, eg) => eg / 2 - phiF,
  aluminium: (phiF, eg) => -(eg / 2 + phiF) - 0.15,
}

/**
 * The flat-band voltage: the work-function difference, less what any fixed
 * oxide charge is worth. Positive oxide charge pulls the whole curve to the
 * left, which is why a process controls it.
 */
export function flatBand({ na, tox, gate = 'n+ poly', qf = 0, T = T_ROOM, ni = null, eg = EG_SI, epsOx = EPS_OX }) {
  const phiF = bulkPotential({ na, T, ni, eg })
  const work = GATES[gate]
  if (!work) throw new NetworkError('value', `The gate material must be one of ${Object.keys(GATES).join(', ')}`)
  const cox = oxideCap({ tox, epsOx })
  const phims = work(phiF, eg)
  return { vfb: phims - (Q_E * qf) / cox, phims, phiF, cox, oxideShift: (Q_E * qf) / cox }
}

/**
 * The threshold voltage, in the four terms a course states it in:
 * V_T = V_FB + 2φ_F + Q_dep/C_ox, with Q_dep = qN_A W_max the charge the
 * depletion layer holds when the surface has reached 2φ_F.
 *
 * `implant` is a threshold-adjust dose in m⁻², the acceptors an implant step
 * puts under the gate. It shifts the threshold by qN/C_ox, which is how a
 * process lands on the number a circuit designer was handed.
 *
 * Three more numbers come off the same quantities. C_min is the high-frequency
 * floor of the C–V curve. γ = √(2qε_sN_A)/C_ox is the body effect.
 * S = (kT/q)ln10(1 + C_dmin/C_ox) is the subthreshold swing, which is where the
 * square law stops.
 */
export function threshold({ na, tox, gate = 'n+ poly', qf = 0, implant = 0, T = T_ROOM, ni = null, eg = EG_SI, eps = EPS_SI, epsOx = EPS_OX }) {
  const { vfb, phims, phiF, cox, oxideShift } = flatBand({ na, tox, gate, qf, T, ni, eg, epsOx })
  const { wmax } = surfaceDepletion({ na, T, ni, eg, eps }, Infinity)
  const qdep = Q_E * na * wmax
  const depTerm = qdep / cox
  const implantTerm = (Q_E * implant) / cox
  const cdmin = eps / wmax
  return {
    vt: vfb + 2 * phiF + depTerm + implantTerm,
    vfb,
    phims,
    phiF,
    cox,
    wmax,
    qdep,
    depTerm,
    implantTerm,
    oxideShift,
    cdmin,
    cmin: (cox * cdmin) / (cox + cdmin),
    ratio: cdmin / (cox + cdmin),
    gamma: Math.sqrt(2 * Q_E * eps * na) / cox,
    swing: thermalVoltage(T) * Math.LN10 * (1 + cdmin / cox),
    debye: debyeLength({ n: na, T, eps }),
  }
}

/** The implant dose, m⁻², that moves a threshold from where a process puts it to where a design wants it. */
export function implantFor({ from, to, cox }) {
  if (!(cox > 0)) throw new NetworkError('value', 'The oxide capacitance must be positive')
  return ((to - from) * cox) / Q_E
}

/**
 * The threshold with the body biased below the source. The depletion layer has
 * more to hold, so the gate has more to pay for:
 * V_T(V_SB) = V_T(0) + γ(√(2φ_F + V_SB) − √(2φ_F)).
 */
export function bodyEffect(process, vsb = 0) {
  if (!(vsb >= 0)) throw new NetworkError('value', 'The source-to-body bias of an n-channel device cannot be negative')
  const t = threshold(process)
  const shift = t.gamma * (Math.sqrt(2 * t.phiF + vsb) - Math.sqrt(2 * t.phiF))
  return { vt: t.vt + shift, shift, gamma: t.gamma, phiF: t.phiF }
}

/**
 * The surface potential at a gate voltage, under the depletion approximation.
 *
 * Below flat band the surface accumulates, and the capacitance the gate sees is
 * the oxide's alone. Between flat band and threshold the gate voltage divides
 * between the oxide and the depletion layer:
 * V_G = V_FB + ψ_s + √(2qε_sN_Aψ_s)/C_ox. That is a quadratic in √ψ_s, so the
 * root is exact rather than iterated. Past threshold the inversion layer holds
 * the surface at 2φ_F and the depletion layer stops.
 */
export function surfacePotential(process, vg) {
  const t = threshold(process)
  if (vg <= t.vfb) return { ...t, psi: 0, regime: 'accumulation' }
  if (vg >= t.vt) return { ...t, psi: 2 * t.phiF, regime: 'inversion' }
  const g = t.gamma
  const root = (-g + Math.sqrt(g * g + 4 * (vg - t.vfb))) / 2
  return { ...t, psi: root * root, regime: 'depletion' }
}

/**
 * The MOS capacitance per unit area at a gate voltage, at one of two
 * frequencies.
 *
 * The three regimes are three conditions on the surface potential, and each
 * capacitance is a closed form. Accumulation reads C_ox, because the majority
 * carriers the gate has pulled to the surface sit where the other plate would.
 * Depletion puts the depletion layer's ε_s/W in series with the oxide.
 * Inversion is where the two frequencies part company. A high-frequency signal
 * is faster than the minority carriers can be generated, so the depletion layer
 * still carries the response and the capacitance floors at C_min. A
 * low-frequency signal is slower, the inversion layer follows it, and the
 * capacitance returns to C_ox.
 *
 * Which curve a measurement shows depends on the sweep rate against the
 * minority-carrier generation rate. That comparison is named and is not
 * modelled. The two curves share the accumulation and depletion branches
 * exactly, because both branches come from this one model.
 */
export function mosCap(process, vg, { frequency = 'high' } = {}) {
  if (frequency !== 'high' && frequency !== 'low') throw new NetworkError('value', 'The frequency must be "high" or "low"')
  const eps = process.eps ?? EPS_SI
  const s = surfacePotential(process, vg)
  if (s.regime === 'accumulation') return { c: s.cox, cd: Infinity, regime: s.regime, psi: s.psi, w: 0, cox: s.cox }
  const { w } = surfaceDepletion(process, s.psi)
  const cd = eps / w
  if (s.regime === 'inversion' && frequency === 'low') return { c: s.cox, cd, regime: s.regime, psi: s.psi, w, cox: s.cox }
  return { c: (s.cox * cd) / (s.cox + cd), cd, regime: s.regime, psi: s.psi, w, cox: s.cox }
}

/** The C–V curve as points, at one frequency: what a measurement plots. */
export function cvCurve(process, { from = -3, to = 3, points = 241, frequency = 'high' } = {}) {
  const vg = new Float64Array(points)
  const c = new Float64Array(points)
  const regime = []
  for (let k = 0; k < points; k++) {
    const v = from + ((to - from) * k) / (points - 1)
    const m = mosCap(process, v, { frequency })
    vg[k] = v
    c[k] = m.c
    regime.push(m.regime)
  }
  return { vg, c, regime }
}

/**
 * The substrate doping a measured C_min/C_ox reads back, by bisection.
 *
 * This is the industry's use of the curve, and it is one root-find because the
 * ratio climbs monotonically with doping. The oxide thickness has to be known,
 * and it is what C_ox has already given.
 */
export function dopingFromRatio({ ratio, tox, T = T_ROOM, ni = null, eg = EG_SI, eps = EPS_SI, epsOx = EPS_OX, lo = 1e16, hi = 1e28 }) {
  if (!(ratio > 0) || !(ratio < 1)) throw new NetworkError('value', 'C_min/C_ox is between zero and one')
  const at = (na) => threshold({ na, tox, T, ni, eg, eps, epsOx }).ratio
  let a = lo
  let b = hi
  for (let k = 0; k < 200; k++) {
    const mid = Math.sqrt(a * b)
    if (at(mid) < ratio) a = mid
    else b = mid
  }
  return Math.sqrt(a * b)
}

// --------------------------------------------------------------- the MOSFET

/**
 * The drain current, from the gradual-channel argument.
 *
 * The gate holds C_ox(V_GS − V_T − V(y)) of electrons at a point y along the
 * channel, and integrating that charge along the channel gives
 * I_D = k_n[V_OV V_DS − V_DS²/2] while the channel still reaches the drain. At
 * V_DS = V_OV the charge at the drain end reaches zero, the channel pinches
 * off, and the current holds at ½k_nV_OV². The two expressions agree in value
 * and in slope at that boundary, which is what makes the pair one curve.
 *
 * `lambda` is channel-length modulation, the only term here that is a fit
 * rather than a consequence, and it is off by default.
 */
export function drainCurrent({ kn, vt, lambda = 0 }, { vgs, vds }) {
  if (!(kn > 0)) throw new NetworkError('value', 'The transconductance parameter must be positive')
  const vov = vgs - vt
  if (vov <= 0) return { id: 0, region: 'cutoff', vov, gm: 0, ro: Infinity }
  const sat = vds >= vov
  const base = sat ? 0.5 * kn * vov * vov : kn * (vov * vds - (vds * vds) / 2)
  const id = sat ? base * (1 + lambda * (vds - vov)) : base
  return {
    id,
    region: sat ? 'saturation' : 'triode',
    vov,
    gm: sat ? kn * vov * (1 + lambda * (vds - vov)) : kn * vds,
    ro: sat && lambda > 0 ? 1 / (lambda * base) : Infinity,
  }
}

/**
 * The same current from the integral it came from, by quadrature over the
 * channel voltage rather than from the polynomial that integral gives.
 *
 * The point is that the closed form is the integral and not a fit, so the two
 * routes are compared at every setting instead of one of them being restated.
 */
export function channelIntegral({ kn, vt }, { vgs, vds, points = 2001 }) {
  const vov = vgs - vt
  if (vov <= 0) return 0
  const top = Math.min(vds, vov)
  const n = points % 2 === 0 ? points + 1 : points
  const h = top / (n - 1)
  let sum = 0
  for (let k = 0; k < n; k++) {
    const weight = k === 0 || k === n - 1 ? 1 : k % 2 ? 4 : 2
    sum += weight * (vov - k * h)
  }
  return (kn * sum * h) / 3
}

/**
 * The gate voltage a stated fall in current costs below threshold, where the
 * current is exponential rather than quadratic and falls one decade every S
 * millivolts. This is the boundary the square law has at the bottom.
 */
export function subthreshold({ swing, from, to }) {
  if (!(swing > 0)) throw new NetworkError('value', 'The subthreshold swing must be positive')
  if (!(from > 0) || !(to > 0)) throw new NetworkError('value', 'Both currents must be positive')
  const decades = Math.log10(from / to)
  return { decades, dv: decades * swing }
}

/**
 * The overdrive at which the channel field reaches the velocity-saturation
 * field: the boundary the square law has at the top. In a 1 µm channel that is
 * 2 V, and in a 0.1 µm channel 0.2 V, which is why a short device reads nearer
 * to a straight line than to a parabola.
 */
export const velocitySaturation = ({ ecrit = 2e6, length }) => ecrit * length

// ------------------------------------------------------------------ the BJT

/**
 * The saturation current and the current gain, from the two Gummel numbers.
 *
 * A Gummel number is a doping times a thickness, the dopant atoms per unit area
 * a carrier has to cross. The base's sets I_S, and the ratio of the two sets β:
 *
 *   I_S = qA n_i² D_B/(N_B W_B)        β = D_B N_E W_E/(D_E N_B W_B)
 *
 * That β is the emitter-injection ceiling. A real device falls below it through
 * recombination in the base, which needs a lifetime and is therefore a material
 * fact rather than a consequence of the doping.
 *
 * The base transit time W_B²/(2D_B) is what caps f_T, and the cap is 1/(2πτ_B).
 */
export function gummel({ ne, we, nb, wb, area, de, db, T = T_ROOM, ni = null, eg = EG_SI }) {
  for (const [name, value] of [
    ['The emitter doping', ne],
    ['The emitter thickness', we],
    ['The base doping', nb],
    ['The base thickness', wb],
    ['The area', area],
    ['The emitter diffusion constant', de],
    ['The base diffusion constant', db],
  ])
    if (!(value > 0)) throw new NetworkError('value', `${name} must be positive`)
  const n_i = ni ?? niAt(T, { eg })
  const base = nb * wb
  const emitter = ne * we
  const is = (Q_E * area * n_i * n_i * db) / base
  const beta = (db * emitter) / (de * base)
  const tauB = (wb * wb) / (2 * db)
  return {
    is,
    beta,
    alpha: beta / (beta + 1),
    gummelBase: base,
    gummelEmitter: emitter,
    tauB,
    ftLimit: 1 / (2 * Math.PI * tauB),
    vbeAt: (i) => thermalVoltage(T) * Math.log(i / is + 1),
  }
}

/**
 * The Early voltage, from the collector junction's edge moving into the base.
 *
 * The base–collector depletion region eats into the base, and reverse bias
 * makes it eat further. The edge moves at x_p/(2V_j) metres per volt, because
 * the width follows the square root of the junction potential. The base width
 * divided by that rate is the Early voltage, which Electronics D2 reads instead
 * as the slope of a collector curve.
 */
export function earlyVoltage({ nb, wb, nc, T = T_ROOM, ni = null, eg = EG_SI, eps = EPS_SI }, vcb = 0) {
  if (!(wb > 0)) throw new NetworkError('value', 'The base thickness must be positive')
  const { xp, xn, w, v0 } = depletionWidth({ na: nb, nd: nc, T, ni, eg, eps }, -vcb)
  const vj = v0 + vcb
  const rate = xp / (2 * vj)
  return { rate, va: wb / rate, intoBase: xp, intoCollector: xn, w, vj, v0, neutralBase: wb - xp, taken: xp / wb }
}

// ------------------------------------------------- the solar cell and the LED

/**
 * A junction with a photocurrent in parallel: Shockley's law shifted down.
 *
 * I = I_L − I_S(e^{V/V_T} − 1), so the short-circuit current is the
 * photocurrent and the open-circuit voltage is V_T ln(I_L/I_S + 1). Every
 * quantity is a closed form except the maximum power point, which maximises
 * V·I and is found to floating point by bisection on dP/dV.
 *
 * The fill factor is P_max/(V_oc I_sc). Green's empirical form beside it is an
 * approximation, and it carries its own error rather than standing next to the
 * exact one as though the two were the same thing.
 */
export function photovoltaic({ is, il, T = T_ROOM, rs = 0, area = 1e-4, irradiance = 1000 }) {
  if (!(is > 0)) throw new NetworkError('value', 'The saturation current must be positive')
  if (!(il >= 0)) throw new NetworkError('value', 'The photocurrent cannot be negative')
  const vt = thermalVoltage(T)
  const voc = vt * Math.log(il / is + 1)
  const current = (v) => il - is * (Math.exp(v / vt) - 1)
  const power = (v) => v * current(v)
  const slope = (v) => current(v) - (v * is * Math.exp(v / vt)) / vt
  let a = 0
  let b = voc
  for (let k = 0; k < 200; k++) {
    const mid = (a + b) / 2
    if (slope(mid) > 0) a = mid
    else b = mid
  }
  const vmp = (a + b) / 2
  const imp = current(vmp)
  const pmax = vmp * imp
  const ff = pmax / (voc * il)
  const vocN = voc / vt
  const ffEmpirical = (vocN - Math.log(vocN + 0.72)) / (vocN + 1)
  return {
    voc,
    isc: il,
    vmp,
    imp,
    pmax,
    ff,
    ffEmpirical,
    ffError: (ffEmpirical - ff) / ff,
    efficiency: pmax / (irradiance * area),
    vt,
    seriesLoss: imp * rs,
    current,
    power,
    slope,
  }
}

/**
 * The same junction run the other way. The photon carries the band gap away, so
 * the wavelength is hc/E_g and the forward voltage cannot fall below E_g/q.
 * Silicon's 1.12 eV puts it at 1107 nm, past anything an eye can see, which is
 * why no one makes a silicon LED.
 *
 * How much of the current comes back out as light is radiative efficiency, and
 * that is a material fact rather than a consequence of the junction. It is not
 * computed here.
 */
export function emission({ eg }) {
  if (!(eg > 0)) throw new NetworkError('value', 'The band gap must be positive')
  return { wavelength: (H_PLANCK * C_LIGHT) / (eg * Q_E), vf: eg, photonEnergy: eg * Q_E }
}

/** Four materials as data: the band gap in electron volts, and nothing else. */
export const MATERIALS = {
  silicon: 1.12,
  'gallium arsenide': 1.42,
  'gallium phosphide': 2.26,
  'gallium nitride': 3.4,
}

// ------------------------------------------------------- fabrication, Group G

/**
 * What a fabrication step sets. An implant of a stated dose driven to a stated
 * depth gives the doping the earlier groups took as a knob. This is the
 * arithmetic of the step and not a process simulation: a real diffusion profile
 * from a real thermal budget needs a tool this suite does not have.
 */
export function implantDoping({ dose, depth }) {
  if (!(dose > 0)) throw new NetworkError('value', 'The implant dose must be positive')
  if (!(depth > 0)) throw new NetworkError('value', 'The junction depth must be positive')
  return dose / depth
}

/** The dose an implant needs to reach a stated doping over a stated depth. */
export const doseFor = ({ doping, depth }) => doping * depth
