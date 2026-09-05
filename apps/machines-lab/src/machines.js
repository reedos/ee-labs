// The library machines every experiment is written against.
//
// One set of numbers per machine, named once, so that a `reads` path and a
// layout agree across every group. An experiment may override a field. It may
// not rename one. The values are `MACHINES_LAB_PLAN.md` §4.3, and
// `scripts/numbers.mjs` prints every consequence of them.

/** A small permanent-magnet DC motor. Groups A. */
export const DC = { Va: 24, Ra: 1.2, La: 3e-3, k: 0.06, J: 2e-4, B: 1e-5, TL: 0.05 }

/**
 * The same motor with a flywheel on it and no load torque. A5 and A6 need the
 * two time constants far apart, so the speed barely moves while the current
 * reaches its peak.
 */
export const DC_FLYWHEEL = { ...DC, J: 4e-3, TL: 0 }

/** A 2.4 kVA 240 V to 120 V single-phase transformer. Group B. */
export const XF = {
  Vp: 240,
  f: 60,
  n: 2,
  R1: 0.6,
  X1: 1.2,
  R2: 0.15,
  X2: 0.3,
  Rc: 1800,
  Xm: 800,
  RL: 6,
  XL: 0,
}

/** A 3 kW 400 V 50 Hz four-pole cage induction machine. Group C. */
export const IM = {
  V: 400 / Math.sqrt(3),
  f: 50,
  poles: 4,
  R1: 1.4,
  X1: 2.4,
  R2: 1.2,
  X2: 2.4,
  Xm: 65,
  Rc: 1200,
  J: 0.05,
  B: 0.002,
  TL: 20,
}

/** A 400 V 50 Hz four-pole synchronous machine, round rotor by default. */
export const SM = {
  V: 400 / Math.sqrt(3),
  f: 50,
  poles: 4,
  E: 260,
  Xs: 8,
  Xd: 8,
  Xq: 5,
  delta: (20 * Math.PI) / 180,
}

/** A small surface-magnet servo motor. Group D. */
export const PM = {
  R: 0.5,
  Ld: 2e-3,
  Lq: 2e-3,
  lambda: 0.08,
  pairs: 3,
  J: 5e-4,
  B: 1e-4,
  omegaE: 2 * Math.PI * 100,
}

/**
 * The loss budget. The first four numbers are the induction machine's own
 * split at its operating point, so Group E audits Group C's machine rather
 * than a new one. `scripts/numbers.mjs` prints both and they agree.
 */
export const LOSS = {
  pOut: 3000,
  pCuFull: 252,
  pCore: 116,
  pFriction: 46,
  strayFraction: 0.005,
  Rth: 0.17,
  Cth: 6000,
  ambient: 40,
  classLimit: 155,
}

/** The magnetising branch's saturation model, for E5. */
export const SAT = { model: 'knee', L0: 8, lambdaSat: 1.2, hard: 20 }
