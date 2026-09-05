// The transformer: a machine that does not turn.
//
// It has two windings and no shaft, and everything else about it is the
// machine's story. Volts per turn are shared, so the voltage ratio is the turns
// ratio. Ampere-turns cancel, so the current ratio is its reciprocal. Power in
// equals power out. That last sentence is not an extra assumption: it follows
// from the first two, and `idealTransformer` below makes all three exact.
//
// ------------------------------------------------------- the stamping problem
//
// The ideal transformer's two equations are
//
//     v_p = n v_s        i_s = −n i_p
//
// and the second is a current controlled by a current. MNA has no such stamp,
// and `packages/network` is not this lab's to extend. The construction here
// needs none:
//
//   1. A VCVS on the secondary, gain 1/n, controlled by the primary port,
//      sets v_s = v_p/n exactly.
//   2. A sense branch (port.js) in the secondary loop makes i_s readable as a
//      voltage, at no cost, because the sense resistance's drop is cancelled
//      by a second VCVS across it.
//   3. A VCCS on the primary, gain 1/(n R_s), controlled by that sense pair,
//      draws exactly i_s/n.
//
// Every element used is one `mna.js` already stamps. The result is exact, not
// a limit: the answer does not depend on R_s, which invariant 5 checks over
// six decades of it. And because the two ports carry v_p i_p = −v_s i_s by
// construction, Tellegen's theorem across the transformer is the statement
// that it neither stores nor loses energy, which is invariant 4.
//
// --------------------------------------------------------------- the grounds
//
// A winding with no connection to the rest of the circuit has no defined
// voltage, and the solver says so. That is not a defect of this model. It is
// the reason a real secondary is earthed at one end, and the reason isolation
// is a property of the windings and not of the voltages. `transformerNetlist`
// grounds the secondary's − terminal and says so here rather than hiding it.

import { GROUND } from '@ee-labs/network'
import { senseBranch } from './port.js'

/** The default sense resistance. Cancelled, so its value never reaches a result. */
export const IDEAL_SENSE = 1

/**
 * An ideal transformer between two node pairs, as elements.
 *
 * @param id  prefix for the element ids and the internal nodes
 * @param p   [p+, p−], the primary port
 * @param s   [s+, s−], the secondary port
 * @param n   turns ratio N_p/N_s. v_p = n v_s, i_p = i_s/n.
 * @param rs  the sense resistance. Any positive value gives the same answer.
 */
export function idealTransformer(id, p, s, n, rs = IDEAL_SENSE) {
  if (!(n > 0)) throw new Error(`${id}: a turns ratio must be positive`)
  const mid = `${id}.s1`
  const sen = senseBranch(`${id}.sen`, mid, s[1], rs)
  return {
    elements: [
      // v(s+) − v(mid) = (1/n)(v_p+ − v_p−). The sense pair below adds nothing
      // to it, so this is the secondary's whole voltage.
      { type: 'VCVS', id: `${id}.Es`, nodes: [s[0], mid], ctrl: [p[0], p[1]], gain: 1 / n, coupling: 'turns' },
      ...sen.elements,
      // i_p = i_s / n, drawn in at p+ and out at p−.
      //
      // The sign. In the DC machine the armature is a load and its current
      // enters the sense branch at the + end. Here the secondary is a source
      // and its current LEAVES at the + end, so the sensed voltage is the
      // negative of the load current times R_s. The minus below carries that
      // back, and it is why the primary draws current instead of pushing it.
      { type: 'VCCS', id: `${id}.Gp`, nodes: [p[0], p[1]], ctrl: sen.sense, gain: sen.gain(-1 / n), coupling: 'ampere-turns' },
    ],
    sense: sen.sense,
    rs,
    n,
  }
}

/** A 2.4 kVA 240 V to 120 V single-phase transformer, filled in by `transformerOf`. */
export const TRANSFORMER_DEFAULTS = {
  Vp: 240, // primary rms, V
  f: 60, // Hz
  n: 2, // turns ratio N_p/N_s
  R1: 0.6, // primary winding resistance, Ω
  X1: 1.2, // primary leakage reactance, Ω at f
  R2: 0.15, // secondary winding resistance, Ω, on the secondary side
  X2: 0.3, // secondary leakage reactance, Ω at f
  Rc: 1800, // core-loss resistance, Ω, primary side
  Xm: 800, // magnetising reactance, Ω at f, primary side
  RL: 6, // load resistance, Ω, on the secondary
  XL: 0, // load reactance, Ω, on the secondary. Positive is inductive
  rs: IDEAL_SENSE,
}

export function transformerOf(spec = {}) {
  const t = { ...TRANSFORMER_DEFAULTS, ...spec }
  for (const key of ['R1', 'R2', 'Rc']) if (!(t[key] > 0)) throw new Error(`${key}: a resistance must be positive`)
  if (!(t.Xm > 0)) throw new Error('Xm: a magnetising reactance must be positive')
  if (!(t.n > 0)) throw new Error('n: a turns ratio must be positive')
  t.omega = 2 * Math.PI * t.f
  t.L1 = t.X1 / t.omega
  t.L2 = t.X2 / t.omega
  t.Lm = t.Xm / t.omega
  t.LL = t.XL !== 0 ? Math.abs(t.XL) / t.omega : 0
  t.CL = t.XL < 0 ? 1 / (Math.abs(t.XL) * t.omega) : 0
  return t
}

/**
 * The full equivalent circuit as a netlist for `solveAC`.
 *
 * Primary: source → R1 → X1 → the shunt branch (R_c ∥ X_m) → the ideal
 * transformer's primary port. Secondary: the ideal transformer's secondary
 * port → R2 → X2 → the load. `stage` drops the parts an experiment has not
 * reached: 'ideal' is the transformer alone, 'leakage' adds the windings,
 * 'full' adds the shunt branch.
 */
export function transformerNetlist(spec = {}) {
  const t = transformerOf(spec)
  const stage = t.stage || 'full'
  const src = { type: 'V', id: 'Vs', nodes: ['p', GROUND], value: 0, wave: { kind: 'sine', amp: t.Vp * Math.SQRT2, freq: t.f } }
  const elements = [src]
  let hot = 'p'
  if (stage !== 'ideal') {
    elements.push({ type: 'R', id: 'R1', nodes: [hot, 'p1'], value: t.R1 })
    elements.push({ type: 'L', id: 'X1', nodes: ['p1', 'p2'], value: t.L1 })
    hot = 'p2'
  }
  if (stage === 'full') {
    elements.push({ type: 'R', id: 'Rc', nodes: [hot, GROUND], value: t.Rc })
    elements.push({ type: 'L', id: 'Xm', nodes: [hot, GROUND], value: t.Lm })
  }
  const xf = idealTransformer('T1', [hot, GROUND], ['s', GROUND], t.n, t.rs)
  elements.push(...xf.elements)
  let out = 's'
  if (stage !== 'ideal') {
    elements.push({ type: 'R', id: 'R2', nodes: [out, 's1'], value: t.R2 })
    elements.push({ type: 'L', id: 'X2', nodes: ['s1', 's2'], value: t.L2 })
    out = 's2'
  }
  if (t.XL > 0) {
    elements.push({ type: 'R', id: 'RL', nodes: [out, 'l1'], value: t.RL })
    elements.push({ type: 'L', id: 'XL', nodes: ['l1', GROUND], value: t.LL })
  } else if (t.XL < 0) {
    elements.push({ type: 'R', id: 'RL', nodes: [out, 'l1'], value: t.RL })
    elements.push({ type: 'C', id: 'XL', nodes: ['l1', GROUND], value: t.CL })
  } else {
    elements.push({ type: 'R', id: 'RL', nodes: [out, GROUND], value: t.RL })
  }
  return { elements, transformer: t, ideal: xf, outNode: out }
}

/**
 * Reflected impedance: what the primary sees, in closed form.
 *
 * A load Z on the secondary looks like n²Z from the primary, because the
 * voltage is n times larger and the current n times smaller. The whole
 * equivalent circuit follows: R2 and X2 referred to the primary are n²R2 and
 * n²X2, which is why a book draws one series branch and not two.
 */
export function reflected(spec = {}) {
  const t = transformerOf(spec)
  const n2 = t.n * t.n
  return {
    n2,
    ZL: [t.RL, t.XL],
    reflectedZL: [n2 * t.RL, n2 * t.XL],
    Req: t.R1 + n2 * t.R2,
    Xeq: t.X1 + n2 * t.X2,
    // The whole series path from the source to the reflected load, with the
    // shunt branch left out: the approximate equivalent circuit every book
    // draws, and it is an approximation. Group B4 measures the gap.
    seriesZ: [t.R1 + n2 * t.R2 + n2 * t.RL, t.X1 + n2 * t.X2 + n2 * t.XL],
  }
}

/**
 * The two bench tests, in the model's own terms.
 *
 * Open circuit: no load current, so the series branch drops almost nothing and
 * the reading is the shunt branch. Short circuit: the shunt branch carries
 * almost nothing beside the short, and the reading is the series branch. This
 * function returns what each test would read on this model, exactly, from a
 * phasor solve of the same netlist with the load removed or shorted.
 */
export function openShort(spec = {}) {
  const t = transformerOf(spec)
  const n2 = t.n * t.n
  // Open circuit, from the primary: R1 + jX1 in series with Rc ∥ jXm.
  const Ysh = [1 / t.Rc, -1 / t.Xm]
  const den = Ysh[0] * Ysh[0] + Ysh[1] * Ysh[1]
  const Zsh = [Ysh[0] / den, -Ysh[1] / den]
  const Zoc = [t.R1 + Zsh[0], t.X1 + Zsh[1]]
  const Ioc = t.Vp / Math.hypot(Zoc[0], Zoc[1])
  const Poc = Ioc * Ioc * Zoc[0]
  // Short circuit, from the primary: R1 + jX1 in series with (Rc ∥ jXm ∥ n²(R2+jX2)).
  const Zser = [n2 * t.R2, n2 * t.X2]
  const Yser = [Zser[0] / (Zser[0] ** 2 + Zser[1] ** 2), -Zser[1] / (Zser[0] ** 2 + Zser[1] ** 2)]
  const Yp = [Ysh[0] + Yser[0], Ysh[1] + Yser[1]]
  const dp = Yp[0] * Yp[0] + Yp[1] * Yp[1]
  const Zsc = [t.R1 + Yp[0] / dp, t.X1 - Yp[1] / dp]
  return { Zoc, Ioc, Poc, Zsc, Zser, Rc: t.Rc, Xm: t.Xm, Req: t.R1 + n2 * t.R2, Xeq: t.X1 + n2 * t.X2 }
}

/**
 * Regulation: how far the secondary voltage falls between no load and load,
 * as a fraction of the loaded voltage. `noLoad` and `full` are magnitudes.
 */
export function regulation(noLoad, full) {
  if (!(full > 0)) throw new Error('regulation: the loaded voltage must be positive')
  return (noLoad - full) / full
}

/**
 * Efficiency from the three powers, and the load at which it peaks.
 *
 * Copper loss rises with the square of the load, core loss does not move, so
 * efficiency peaks where the two are equal. That is the whole of B6, and the
 * closed form for the fraction of full load at the peak is √(P_core/P_cu,fl).
 */
export function transformerEfficiency({ pOut, pCu, pCore }) {
  const pIn = pOut + pCu + pCore
  return { pIn, pOut, pCu, pCore, efficiency: pIn > 0 ? pOut / pIn : 0, loss: pCu + pCore }
}
