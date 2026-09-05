// Per unit: one change of variables, and it is exact.
//
// Pick a three-phase base power S_b and a line-to-line base voltage V_b at one
// point of the network. Every other base follows from those two:
//
//     Z_b = V_b² / S_b        I_b = S_b / (√3 V_b)      V_LN = V_b / √3
//
// At 100 MVA and 230 kV that is 529 Ω, 251.022 A and 132.791 kV. Dividing
// every quantity by its own base scales the equations by constants, so no
// information is lost and no approximation is made. GRID_LAB_PLAN.md §2.2
// states that as invariant 5, and `perUnit.test.js` measures it: a network
// solved in ohms, volts and amperes equals the per-unit network scaled back,
// to floating point.
//
// The reason the subject is written this way is the transformer. A transformer
// between two zones has two voltage bases in its own turns ratio, so the ratio
// divides out and the per-unit impedance is the same number seen from either
// side. `zoneBases` builds the second zone's bases from the first and the
// ratio, and that identity is a test rather than a claim.

const SQRT3 = Math.sqrt(3)

/**
 * The four bases that follow from a base power and a base voltage.
 *
 * @param Sbase three-phase apparent power, VA
 * @param Vbase line-to-line voltage, V
 */
export function bases({ Sbase = 100e6, Vbase = 230e3 } = {}) {
  if (!(Sbase > 0)) throw new Error('Sbase: a base power must be positive')
  if (!(Vbase > 0)) throw new Error('Vbase: a base voltage must be positive')
  return {
    Sbase,
    Vbase,
    Zbase: (Vbase * Vbase) / Sbase,
    Ibase: Sbase / (SQRT3 * Vbase),
    Ybase: Sbase / (Vbase * Vbase),
    VbaseLN: Vbase / SQRT3,
  }
}

/**
 * The bases on the other side of a transformer whose ratio is `Vbase2/Vbase1`.
 * The base power does not change, because a transformer passes power through.
 */
export function zoneBases(base, Vbase2) {
  return bases({ Sbase: base.Sbase, Vbase: Vbase2 })
}

/**
 * An impedance quoted on one device's own rating, moved to the system base.
 *
 *     Z_new = Z_old · (S_new/S_old) · (V_old/V_new)²
 *
 * A generator marked 0.20 pu on 90 MVA is 0.222222 pu on 100 MVA.
 */
export function changeBase(zOld, { Sold, Vold, Snew, Vnew }) {
  if (!(Sold > 0) || !(Snew > 0)) throw new Error('changeBase: both base powers must be positive')
  if (!(Vold > 0) || !(Vnew > 0)) throw new Error('changeBase: both base voltages must be positive')
  return zOld * (Snew / Sold) * (Vold / Vnew) ** 2
}

/** Per unit from SI, by kind. */
export const toPu = {
  S: (va, b) => va / b.Sbase,
  P: (w, b) => w / b.Sbase,
  V: (v, b) => v / b.Vbase,
  Vln: (v, b) => v / b.VbaseLN,
  I: (a, b) => a / b.Ibase,
  Z: (ohm, b) => ohm / b.Zbase,
  Y: (s, b) => s / b.Ybase,
}

/** SI from per unit, by kind. Every entry is the inverse of `toPu`'s. */
export const fromPu = {
  S: (pu, b) => pu * b.Sbase,
  P: (pu, b) => pu * b.Sbase,
  V: (pu, b) => pu * b.Vbase,
  Vln: (pu, b) => pu * b.VbaseLN,
  I: (pu, b) => pu * b.Ibase,
  Z: (pu, b) => pu * b.Zbase,
  Y: (pu, b) => pu * b.Ybase,
}

/**
 * A load given as real power and a power factor, in both readings.
 *
 * 60 MW at 0.85 lagging is 37.1847 Mvar. Lagging means the current lags the
 * voltage, so the reactive power is positive and the load takes it.
 */
export function loadFromPf(P, pf, { lagging = true } = {}) {
  if (!(pf > 0) || pf > 1) throw new Error('pf: a power factor lies between 0 and 1')
  const phi = Math.acos(pf)
  const Q = P * Math.tan(phi) * (lagging ? 1 : -1)
  return { P, Q, S: Math.hypot(P, Q), phi: lagging ? phi : -phi, pf }
}

/**
 * The same load as a constant impedance, at a stated voltage in per unit.
 *
 * A constant-power load takes P + jQ whatever the voltage. A constant-
 * impedance load takes V²/Z*, so at 0.90 pu it takes 81 % of what it took at
 * 1.00 pu. The two models are the same object only at the voltage the
 * conversion was made at, which is D1's and A4's lesson.
 */
export function zipModels({ P, Q }, Vref = 1) {
  const S2 = P * P + Q * Q
  if (!(S2 > 0)) throw new Error('zipModels: a load of zero has no equivalent impedance')
  const Zmag = (Vref * Vref) / Math.sqrt(S2)
  const phi = Math.atan2(Q, P)
  return {
    Vref,
    Z: [Zmag * Math.cos(phi), Zmag * Math.sin(phi)],
    Zmag,
    /** What each model takes at voltage V, in per unit. */
    power: (V) => ({
      constantPower: { P, Q },
      constantImpedance: { P: P * (V / Vref) ** 2, Q: Q * (V / Vref) ** 2 },
      constantCurrent: { P: P * (V / Vref), Q: Q * (V / Vref) },
    }),
  }
}
