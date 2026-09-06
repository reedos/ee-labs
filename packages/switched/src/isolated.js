// Two converters with a transformer in them, as switched linear circuits.
//
// A turns ratio is a scaling, so an isolated converter is still piecewise
// linear and still has two state variables. Both circuits below are built in
// the shape `converter()` returns, so `steadyState`, `measures` and
// `waveforms` take them unchanged.
//
// The turns ratio is written n = N_s/N_p throughout, secondary over primary.
// Volts scale by n from primary to secondary, amps by 1/n the other way.
//
// ------------------------------------------------------------- the flyback
//
// A buck-boost whose inductor grew a second winding. The magnetising current
// i_M is carried on the primary side, so the state is [i_M, v_C] and the two
// intervals are the buck-boost's:
//
//   on   the switch puts V_in across the primary and i_M rises; the diode is
//        reverse biased and the capacitor alone feeds the load
//   off   the switch opens, the winding reverses, the secondary diode
//        conducts, and the secondary delivers i_M/n into the output
//
// Reflected to the primary, the off interval puts (v_out + V_f)/n across the
// winding, so volt-second balance is V_in·D = (V_out + V_f)(1−D)/n and the
// ideal ratio is M = n·D/(1−D). The switch blocks V_in + V_out/n, which is
// the price of the isolation and the row D4 compares against.
//
// -------------------------------------------------------- the half-bridge
//
// Two switches across a capacitor divider drive the primary with ±V_in/2,
// and the rectified secondary feeds an output inductor. One switching period
// holds four intervals: Q1 on, freewheel, Q2 on, freewheel. The output side
// cannot tell the two halves apart — it sees the same pulse of n·V_in/2
// followed by the same freewheel — so the state at the half-period equals
// the state at the start, and the whole converter is solved over a half
// period with a duty of 2D. That is not an approximation: it is the
// symmetry, and it is why the output ripple runs at 2f_s. The waveform is
// drawn over two of these half periods and the second one is labelled with
// Q2, so the reader sees the full switching period the switches live in.
//
// V1 holds the divider midpoint stiff at V_in/2 and carries no magnetising
// current, so this transformer stores nothing by construction. The duty
// asymmetry the plan's D4 mentions needs the midpoint as a third state, and
// is not modelled here.

import { DEFAULTS } from './topologies.js'

export const ISOLATED_KINDS = ['flyback', 'halfbridge']

export const ISOLATED_DEFAULTS = {
  ...DEFAULTS,
  n: 0.5, // turns ratio N_s/N_p
}

const lin = (c1, c2, d = 0) => ({ c: [c1, c2], d })

/** M = n·D/(1−D) for the flyback, M = n·D for the half-bridge. */
export function isolatedM(kind, D, n) {
  return kind === 'flyback' ? (n * D) / (1 - D) : n * D
}

export function flyback(params = {}) {
  const p = { ...ISOLATED_DEFAULTS, ...params }
  const { Vin, L, C, R, n, Ron, Vf, rd, RL, ESR } = p
  const alpha = R / (R + ESR)
  const T = 1 / p.fs
  const zero = lin(0, 0)
  const iM = lin(1, 0)
  // The secondary current reaches the output node as i_M/n, so the output
  // forms are the standard ones with that current in them.
  const outFed = { vout: lin((alpha * ESR) / n, alpha), iC: lin(alpha / n, -alpha / R) }
  const outAlone = { vout: lin(0, alpha), iC: lin(0, -alpha / R) }

  // On: V_in across the primary, less the switch and winding drops.
  const rOn = Ron + RL
  const on = {
    name: 'on',
    A: [
      [-rOn / L, 0],
      [0, -alpha / (R * C)],
    ],
    f: [Vin / L, 0],
    signals: {
      ...outAlone,
      // The drain sits at the switch drop while it conducts.
      vsw: lin(Ron, 0),
      vL: lin(-rOn, 0, Vin),
      iQ: iM,
      iD: zero,
      iin: iM,
    },
  }
  // Off: the secondary conducts. Referred to the primary, the winding sees
  // (v_out + V_f)/n and the diode's slope resistance appears as rd/n².
  const rOff = RL + rd / (n * n) + (alpha * ESR) / (n * n)
  const off = {
    name: 'off',
    A: [
      [-rOff / L, -alpha / (n * L)],
      [alpha / (n * C), -alpha / (R * C)],
    ],
    f: [-Vf / (n * L), 0],
    signals: {
      ...outFed,
      // The drain carries V_in plus the reflected output.
      vsw: lin(rOff, alpha / n, Vin + Vf / n),
      vL: lin(-rOff, -alpha / n, -Vf / n),
      iQ: zero,
      iD: lin(1 / n, 0),
      iin: zero,
    },
  }
  const dead = {
    name: 'dead',
    A: [
      [0, 0],
      [0, -alpha / (R * C)],
    ],
    f: [0, 0],
    signals: { ...outAlone, vsw: lin(0, 0, Vin), vL: zero, iQ: zero, iD: zero, iin: zero },
  }
  for (const s of [on, off, dead]) {
    s.signals.iL = iM
    s.signals.vC = lin(0, 1)
  }
  return {
    kind: 'flyback',
    p,
    T,
    alpha,
    n,
    states: { on, off, dead },
    hasDead: true,
    inverted: false,
    isolated: true,
    // The switch holds the rail plus the output reflected back through the
    // turns ratio.
    blocking: (voutAvg) => Vin + (voutAvg + Vf) / n,
    idealM: (D = p.D) => isolatedM('flyback', D, n),
  }
}

export function halfBridge(params = {}) {
  const p = { ...ISOLATED_DEFAULTS, ...params }
  const { Vin, L, C, R, n, Ron, Vf, rd, RL, ESR } = p
  const alpha = R / (R + ESR)
  // Solved over a half switching period at twice the duty: the output side
  // repeats every half period, and D is each switch's share of the whole.
  const Tsw = 1 / p.fs
  const T = Tsw / 2
  const Deff = Math.min(0.999999, 2 * p.D)
  const zero = lin(0, 0)
  const iL = lin(1, 0)
  const outFed = { vout: lin(alpha * ESR, alpha), iC: lin(alpha, -alpha / R) }

  // The secondary pulse: n·V_in/2, less the reflected switch drop (the
  // primary carries n·i_L), the rectifier drop and the winding.
  const rOn = n * n * Ron + rd + RL + alpha * ESR
  const on = {
    name: 'Q1 on',
    A: [
      [-rOn / L, -alpha / L],
      [alpha / C, -alpha / (R * C)],
    ],
    f: [((n * Vin) / 2 - Vf) / L, 0],
    signals: {
      ...outFed,
      vsw: lin(-(n * n * Ron + rd), 0, (n * Vin) / 2 - Vf),
      vL: lin(-rOn, -alpha, (n * Vin) / 2 - Vf),
      iQ: lin(n, 0),
      iD: iL,
      // The current the rail supplies, as the equivalent DC draw: the
      // primary carries n·i_L against V_in/2, which is (n/2)·i_L against V_in.
      iin: lin(n / 2, 0),
    },
  }
  // Freewheel: both rectifier legs carry the inductor current and the
  // secondary is shorted, so the filter sees the rectifier drop alone.
  const rFree = rd + RL + alpha * ESR
  const off = {
    name: 'freewheel',
    A: [
      [-rFree / L, -alpha / L],
      [alpha / C, -alpha / (R * C)],
    ],
    f: [-Vf / L, 0],
    signals: {
      ...outFed,
      vsw: lin(-rd, 0, -Vf),
      vL: lin(-rFree, -alpha, -Vf),
      iQ: zero,
      iD: iL,
      iin: zero,
    },
  }
  const dead = {
    name: 'dead',
    A: [
      [0, 0],
      [0, -alpha / (R * C)],
    ],
    f: [0, 0],
    signals: { vout: lin(0, alpha), iC: lin(0, -alpha / R), vsw: lin(0, alpha), vL: zero, iQ: zero, iD: zero, iin: zero },
  }
  for (const s of [on, off, dead]) {
    s.signals.iL = iL
    s.signals.vC = lin(0, 1)
  }
  // What the secondary pulse has left after the rectifier's own drop. At or
  // below zero the rectifier can never conduct, the model's assumption that
  // the output inductor is always fed through it fails, and the caller is
  // told rather than shown a converter with a negative output.
  const headroom = (n * Vin) / 2 - Vf
  return {
    kind: 'halfbridge',
    headroom,
    deliverable: headroom > 0,
    // The solver reads D and fs off p, so they carry the half-period values;
    // `switching` keeps the numbers the reader set.
    p: { ...p, D: Deff, fs: 2 * p.fs },
    switching: { D: p.D, fs: p.fs, T: Tsw, n },
    T,
    alpha,
    n,
    states: { on, off, dead },
    hasDead: true,
    inverted: false,
    isolated: true,
    // Each switch stands off the whole rail while the other conducts.
    blocking: () => Vin,
    idealM: (D = p.D) => isolatedM('halfbridge', D, n),
  }
}

export function isolated(kind, params = {}) {
  if (kind === 'flyback') return flyback(params)
  if (kind === 'halfbridge') return halfBridge(params)
  throw new Error(`unknown isolated converter "${kind}"`)
}
