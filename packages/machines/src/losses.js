// Losses, efficiency and the thermal limit.
//
// A machine's rating is not set by its magnetics or its bearings. It is set by
// how much heat it can get rid of. Everything in this file is bookkeeping
// towards that one number.
//
// Four losses, and only one of them moves with the load:
//
//   copper       I²R, so it rises with the square of the load
//   core         hysteresis and eddy currents, fixed by the flux and the
//                frequency, so it does not move with the load at all
//   friction and windage, fixed by the speed
//   stray        a fraction of the output, by convention
//
// Efficiency therefore peaks where the load-dependent loss equals the fixed
// loss, and the fraction of full load at which that happens is
// √(P_fixed / P_cu,full). That is a closed form and the test measures it
// against a sweep of the curve rather than quoting it.
//
// The thermal side is a first-order circuit, and it is the same circuit the
// network engine already solves: the loss is a current, the thermal resistance
// is a resistance, the thermal capacitance is a capacitance, and the
// temperature rise is a node voltage. The steady rise is P·R_th and the time
// constant is R_th·C_th, both exact.

import { GROUND } from '@ee-labs/network'

/** A 3 kW machine's loss budget at full load, filled in by `lossesOf`. */
export const LOSS_DEFAULTS = {
  pOut: 3000, // rated output, W
  pCuFull: 252, // copper loss at full load, W. Stator and rotor together
  pCore: 116, // core loss, W. Fixed at rated voltage and frequency
  pFriction: 46, // friction and windage, W. Fixed at rated speed
  strayFraction: 0.005, // stray load loss, as a fraction of output
  Rth: 0.17, // thermal resistance to ambient, K/W
  Cth: 6000, // thermal capacitance, J/K
  ambient: 40, // ambient temperature, °C
  classLimit: 155, // insulation class F, °C
}

export function lossesOf(spec = {}) {
  const m = { ...LOSS_DEFAULTS, ...spec }
  for (const key of ['pOut', 'pCuFull', 'Rth', 'Cth']) if (!(m[key] > 0)) throw new Error(`${key}: must be positive`)
  if (m.strayFraction < 0) throw new Error('strayFraction: cannot be negative')
  return m
}

/**
 * The loss split at a fraction x of full load, and the efficiency there.
 * Copper and stray scale with x², everything else stands still.
 */
export function lossSplit(spec = {}, x = 1) {
  const m = lossesOf(spec)
  const pOut = x * m.pOut
  const pCu = x * x * m.pCuFull
  const pStray = x * x * m.strayFraction * m.pOut
  const fixed = m.pCore + m.pFriction
  const loss = pCu + pStray + fixed
  const pIn = pOut + loss
  return {
    machine: m,
    x,
    pOut,
    pCu,
    pStray,
    pCore: m.pCore,
    pFriction: m.pFriction,
    fixed,
    variable: pCu + pStray,
    loss,
    pIn,
    efficiency: pIn > 0 ? pOut / pIn : 0,
  }
}

/** The efficiency curve against load fraction, for the plot and for the tests. */
export function efficiencyCurve(spec = {}, { from = 0.05, to = 1.4, points = 401 } = {}) {
  const x = []
  const efficiency = []
  const loss = []
  for (let k = 0; k < points; k++) {
    const f = from + ((to - from) * k) / (points - 1)
    const s = lossSplit(spec, f)
    x.push(f)
    efficiency.push(s.efficiency)
    loss.push(s.loss)
  }
  return { x, efficiency, loss, machine: lossesOf(spec) }
}

/**
 * Where the efficiency peaks, in closed form.
 *
 * The variable loss at fraction x is x²(P_cu,full + stray·P_out) and the fixed
 * loss does not move, so the maximum is at x = √(P_fixed / P_var,full).
 */
export function bestEfficiency(spec = {}) {
  const m = lossesOf(spec)
  const varFull = m.pCuFull + m.strayFraction * m.pOut
  const x = Math.sqrt((m.pCore + m.pFriction) / varFull)
  return { x, ...lossSplit(spec, x) }
}

/**
 * The thermal picture at a steady loss: the rise, the final temperature, the
 * time constant, and how much of the insulation class's headroom is left.
 * `overLimit` is the sentence the app shows when the machine cooks.
 */
export function thermal(spec = {}, pLoss) {
  const m = lossesOf(spec)
  const rise = pLoss * m.Rth
  const final = m.ambient + rise
  const tau = m.Rth * m.Cth
  const headroom = m.classLimit - final
  return {
    machine: m,
    pLoss,
    rise,
    final,
    tau,
    headroom,
    limitLoss: (m.classLimit - m.ambient) / m.Rth,
    over: final > m.classLimit,
    riseAt: (t) => rise * (1 - Math.exp(-t / tau)),
    timeTo: (T) => {
      const target = T - m.ambient
      if (target >= rise) return Infinity
      return -tau * Math.log(1 - target / rise)
    },
  }
}

/**
 * The same first-order thermal model as a netlist, so the transient engine
 * draws it and the two answers can be compared. The loss is a current source,
 * the rise is the node voltage in kelvins.
 */
export function thermalNetlist(spec = {}, pLoss, { step = true } = {}) {
  const m = lossesOf(spec)
  return {
    elements: [
      {
        type: 'I',
        id: 'Ploss',
        nodes: [GROUND, 'hot'],
        value: pLoss,
        ...(step ? { wave: { kind: 'step', from: 0, to: pLoss } } : {}),
      },
      { type: 'R', id: 'Rth', nodes: ['hot', GROUND], value: m.Rth },
      { type: 'C', id: 'Cth', nodes: ['hot', GROUND], value: m.Cth },
    ],
    machine: m,
    pLoss,
  }
}
