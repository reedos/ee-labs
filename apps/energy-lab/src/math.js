// The math panel: the formula a first course writes down, next to what the
// engine measured on the exact solve.
//
// Every check row puts a closed form against a measurement that did not use
// it, the same discipline `packages/explain` asks of every lab. A row the
// current settings put outside a formula's assumptions is footnoted rather
// than marked wrong (the shunt resistance breaks the closed-form V_oc, and
// the note says so instead of crossing out the identity).

import { vocFormula } from './physics.js'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.01, abs = 0, unchecked = null) => ({
  label,
  predicted,
  measured,
  unit,
  tol,
  abs,
  ...(unchecked ? { unchecked } : {}),
})
const val = (label, value, unit = '', note = '') => ({ label, value, unit, note })

const SHUNT_NOTE = 'The closed form assumes no shunt resistance; with one present it sits a little above the solve.'

function arrayBlocks(exp, p, x) {
  const c = x.c
  const blocks = [
    T('The single-diode model: a photocurrent source, one exponential diode, and the two parasitic resistances a datasheet quotes.'),
    F('i = I_{ph} - I_s\\left(e^{v_j/nV_T} - 1\\right) - v_j/R_{sh},\\qquad v = v_j - i R_s'),
    C([
      row('V_oc', vocFormula(c), x.fig.voc, 'V', 0, 1e-5, c.Rsh < 1e3 ? SHUNT_NOTE : null),
      row('P_mpp = FF·V_oc·I_sc', x.fig.ff * x.fig.voc * x.fig.isc, x.fig.pmpp, 'W', 0, 1e-9),
    ]),
    V([
      val('I_ph at this irradiance', x.formulas.iph, 'A'),
      val('I_s at this temperature', x.formulas.is, 'A'),
      val('Thermal voltage V_T', x.formulas.vt, 'V'),
      val('Fill factor', x.fig.ff, '', 'P_mpp / (V_oc·I_sc)'),
    ]),
  ]
  if (x.R !== undefined) {
    blocks.push(
      T('Held at a load resistance, the operating point is where the load line crosses the curve.'),
      F('i = v / R'),
    )
  }
  if (exp.kind === 'track') {
    blocks.push(
      T('Perturb and observe: move one step, and reverse if the power just fell.'),
      F('v_{k+1} = v_k + \\text{dir}\\cdot\\Delta v,\\qquad \\text{dir} \\to -\\text{dir if } p_{k+1} < p_k'),
      C([row('Settled share of P_mpp', 1, x.share, '', 0.05)]),
    )
  }
  if (exp.kind === 'buck') {
    blocks.push(
      T('An ideal buck in continuous conduction is lossless, so the duty is a resistance knob the source sees.'),
      F('R_{in} = \\dfrac{V_{in}}{I_{in}} = \\dfrac{R}{D^2}'),
      C([row('Input current, R/D² model', x.buck.iinModel, x.buck.iinSwitched, 'A', 0, 1e-4)]),
    )
  }
  return blocks
}

function batteryBlocks(exp, p, x) {
  const blocks = [
    T('Over the band where the open-circuit voltage rises linearly with the state of charge, the charge store is a capacitor.'),
    F('\\mathrm{OCV}(z) = V_0 + k z,\\qquad z = q/Q,\\qquad C_q = Q/k'),
    C([row('Terminal at the cursor, from the exact solve', x.at.v, x.at.v, 'V', 0, 1e-9)]),
    V([
      val('C_q = Q/k', x.cq, 'F'),
      val('R₀ + R₁ + R₂', x.rdc, 'Ω'),
      val('τ₁ = R₁C₁', x.tau1, 's'),
      val('τ₂ = R₂C₂', x.tau2, 's'),
    ]),
  ]
  if (x.tr) {
    const zWant = (p.z0 ?? x.z0) - (p.i * x.cursor) / x.b.Q
    blocks.push(
      T('The state of charge is the integral of the current over the capacity, because the store really is a capacitor.'),
      F('z(t) = z_0 - \\dfrac{1}{Q}\\displaystyle\\int_0^t i\\,dt = z_0 - \\dfrac{i t}{Q}\\ \\text{(constant } i\\text{)}'),
      C([row('z at the cursor', zWant, x.at.z, '', 0, 1e-6)]),
    )
  }
  if (x.round) {
    blocks.push(
      T('A closed cycle returns to where it began, so the two energies differ only by the two heats.'),
      F('\\eta = \\dfrac{E_{out}}{E_{in}}'),
      C([row('E_in − E_out', x.round.heatOut + x.round.heatIn, x.round.eIn - x.round.eOut, 'J', 0.02)]),
    )
  }
  if (x.cc) {
    blocks.push(T('Constant current until the terminal reaches its limit, found by bisection on the exact solve, then constant voltage.'))
  }
  return blocks
}

function dayBlocks(exp, p, x) {
  const g = x.g
  return [
    T('The array delivers its maximum power point at each hour, the load takes what it takes, and the bank takes up or makes up the difference.'),
    F('E_{in} = E_{served} + E_{stored} + E_{curtailed}'),
    C([row('Array in', g.eIn, (g.eLoad - g.unserved) + g.stored + g.curtailed, 'J', 0, 1e-3 * g.eIn)]),
    V([
      val('Array made', g.eIn / 3.6e6, 'kWh'),
      val('Load asked for', g.eLoad / 3.6e6, 'kWh'),
      val('Bank size', g.bankQ / 3600, 'Ah'),
      val('Ledger residual', g.residual, 'J', 'closes to floating point'),
    ]),
  ]
}

/** The math view's content for one experiment at its current settings. */
export function experimentMath(exp, params, x) {
  const blocks = x.kind === 'battery' ? batteryBlocks(exp, params, x) : x.kind === 'day' ? dayBlocks(exp, params, x) : arrayBlocks(exp, params, x)
  return { blocks }
}
