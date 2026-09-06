// The math panel: the formula a first course writes down, next to what the
// engine measured on the exact solve.
//
// Every check row puts a closed form against a measurement that did not use
// it, which is the discipline `packages/explain` asks of every lab. A row the
// current settings put outside a formula's assumptions is footnoted rather
// than marked wrong.

import { cx } from '@ee-labs/grid'

const { deg } = cx

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

function baseBlocks(exp, p, x) {
  return [
    T('Two bases are chosen and the rest follow. Nothing here is approximated, so every row is an identity.'),
    F('Z_b = \\dfrac{V_b^2}{S_b},\\qquad I_b = \\dfrac{S_b}{\\sqrt{3}\\,V_b},\\qquad V_{LN} = \\dfrac{V_b}{\\sqrt{3}}'),
    C([
      row('Z_b', (x.b.Vbase * x.b.Vbase) / x.b.Sbase, x.b.Zbase, 'Ω', 0, 1e-9),
      row('I_b', x.b.Sbase / (Math.sqrt(3) * x.b.Vbase), x.b.Ibase, 'A', 0, 1e-9),
      row('Impedance seen from the two sides', x.puFromHigh, x.puFromLow, 'pu', 0, 1e-12),
    ]),
    T('An impedance quoted on a device rating moves to the system base by one formula.'),
    F('Z_{new} = Z_{old}\\,\\dfrac{S_{new}}{S_{old}}\\left(\\dfrac{V_{old}}{V_{new}}\\right)^2'),
    V([
      val('Generator on the system base', x.gen, 'pu'),
      val('Transformer on the system base', x.tx, 'pu'),
      val('Low-side impedance base', x.low.Zbase, 'Ω'),
      val('Load in per unit', x.pu.P, 'pu', `and ${x.pu.Q.toFixed(6)} pu of reactive power`),
    ]),
  ]
}

function phaseBlocks(exp, p, x) {
  return [
    T('A balanced three-phase load is three copies of one circuit, so one phase carries the whole answer.'),
    F('P_{3\\phi} = 3\\,V_{LN} I \\cos\\varphi = \\sqrt{3}\\,V_{LL} I_L \\cos\\varphi'),
    C([
      row('Three-phase power, both forms', x.load.Pline, x.load.P, 'W', 1e-12),
      row('Line to neutral', x.load.Vll / Math.sqrt(3), x.load.Vln, 'V', 0, 1e-9),
    ]),
    T('One phase pulses at twice the supply frequency. Three balanced phases do not pulse at all.'),
    F('p_a(t) = V I\\cos\\varphi - V I\\cos(2\\omega t - \\varphi)'),
    C([
      row('One phase swing about its mean', x.load.Vln * x.load.I, x.inst.max - x.inst.mean, 'W', 1e-9),
      row('Three-phase ripple', 0, Math.abs(x.inst.rippleThree), '', 0, 1e-12),
    ]),
    T('Any three phasors resolve into three balanced sets, and the neutral carries three times the zero one.'),
    F('I_0 = \\tfrac{1}{3}(I_a + I_b + I_c),\\qquad I_n = 3 I_0'),
    C([row('Neutral against three times the zero sequence', 3 * x.seq.mag[0], x.neutral.mag, 'A', 0, 1e-12)]),
  ]
}

function lineBlocks(exp, p, x) {
  return [
    T('The lumped π model against the exact solution of a uniform line, at this length.'),
    F('\\dfrac{V_r}{V_s}\\bigg|_{exact} = \\dfrac{1}{\\cosh\\gamma l},\\qquad \\dfrac{V_r}{V_s}\\bigg|_{\\pi} = \\dfrac{1}{1 + ZY/2}'),
    C([
      row('Open-end rise', x.rise.exact, x.rise.nominal, '', x.model.long ? 0.05 : 0.001, 0, x.model.long ? 'Past 250 km the lumped model is replaced by the exact form, and the gap here is why.' : null),
      row('Surge impedance', Math.sqrt(x.spec.x / x.spec.b), x.surge.Zc, 'Ω', 0, 1e-9),
    ]),
    T('At the surge impedance loading a line absorbs exactly as much reactive power as it produces.'),
    F('Z_c = \\sqrt{L/C},\\qquad P_{SIL} = \\dfrac{V^2}{Z_c}'),
    C([row('Reactive balance at this loading', 0, x.balance.net, 'var', 0, 1e-6 * x.balance.produced, p.loading !== 1 ? 'The balance closes only at the surge impedance loading, and this knob is off it.' : null)]),
    T('A series reactance drops voltage mostly in proportion to the reactive current through it.'),
    F('\\Delta V \\approx \\dfrac{Q X}{V}'),
    C([row('Drop, estimate against the solve', x.estimate, x.drop, 'pu', 0.2, 0, 'The estimate drops the term in P, which is what the gap measures.')]),
    V([
      val('Tap that restores 1.00 pu', x.tapNeeded, ''),
      val('Shunt that does the same', x.shunt.mvar, 'Mvar'),
      val('Model in force', x.model.long ? 1 : 0, '', x.model.guard),
    ]),
  ]
}

function flowBlocks(exp, p, x) {
  if (!x.sol)
    return [
      T('There is no solution at this loading, so there is nothing to check a formula against.'),
      T(x.refusal),
    ]
  const b3 = x.sol.byId.bus3
  return [
    T('Each bus injection is the voltage times the conjugate of the current the matrix gives it.'),
    F('P_i = V_i \\sum_k V_k (G_{ik}\\cos\\theta_{ik} + B_{ik}\\sin\\theta_{ik})'),
    C([
      row('Bus 3 real injection against its schedule', b3.scheduled.P, b3.P, 'pu', 0, 1e-9),
      row('Bus 3 reactive injection against its schedule', b3.scheduled.Q, b3.Q, 'pu', 0, 1e-9),
    ]),
    T('The slack takes up the loss, so two different sums of the same solution have to agree.'),
    F('\\sum_i S_i = \\sum_{branches} I^2 (R + jX)'),
    C([row('Total loss, injections against branches', x.sol.Ploss, x.sol.flows.reduce((s, f) => s + f.Ploss, 0), 'pu', 0, 1e-12)]),
    T('The linear model drops the resistance, pins every magnitude and replaces the sine of each angle by the angle.'),
    F("\\theta = B'^{-1} P,\\qquad P_{ik} = \\dfrac{\\theta_i - \\theta_k}{x_{ik}}"),
    C([
      row('Bus 3 angle, linear against exact', deg(x.dc.theta[2]), b3.thetaDeg, '°', 0.05, 0, x.guard.warn ? 'The guard has fired here, so the linear model is outside the range it was measured in.' : null),
    ]),
    V([
      val('Newton updates', x.sol.iterations, ''),
      val('Largest branch angle', deg(x.guard.maxAngle), '°'),
      val('Lowest bus magnitude', x.guard.minV, 'pu'),
      val('Largest branch-flow error', 100 * x.compare.maxError, '%', x.guard.text),
    ]),
  ]
}

function seqBlocks(exp, p, x) {
  return [
    T('The transform is a change of basis, so its round trip is exact.'),
    F('\\begin{bmatrix}I_0\\\\I_1\\\\I_2\\end{bmatrix} = \\tfrac{1}{3}\\begin{bmatrix}1&1&1\\\\1&a&a^2\\\\1&a^2&a\\end{bmatrix}\\begin{bmatrix}I_a\\\\I_b\\\\I_c\\end{bmatrix}'),
    C([
      row('Rebuild error', 0, x.abc.reduce((m, z, k) => Math.max(m, Math.hypot(z[0] - x.rebuilt.abc[k][0], z[1] - x.rebuilt.abc[k][1])), 0), 'A', 0, 1e-12),
      row('Neutral against three times the zero sequence', 3 * x.seq.mag[0], x.neutral.mag, 'A', 0, 1e-12),
    ]),
    T('Each sequence sees its own network, and a neutral impedance appears three times in the zero one.'),
    F('Z_0 = Z_{0,line} + Z_{0,tx} + 3 Z_n \\ \\text{(when the winding passes it)}'),
    V([
      val('Positive-sequence impedance', x.z.Z1[1], 'pu'),
      val('Negative-sequence impedance', x.z.Z2[1], 'pu'),
      val('Zero-sequence impedance', x.z.Z0[1], 'pu', x.z.throughTransformer ? 'the winding passes zero sequence' : 'the delta winding blocks zero sequence'),
      val('Unbalance factor', 100 * x.unbalance, '%'),
    ]),
  ]
}

function faultBlocks(exp, p, x) {
  const s = x.study
  const closed = {
    '3ph': 1 / x.z.Z1[1],
    slg: 3 / (x.z.Z1[1] + x.z.Z2[1] + x.z.Z0[1]),
    ll: Math.sqrt(3) / (x.z.Z1[1] + x.z.Z2[1]),
    dlg: NaN,
  }[s.kind]
  const measured = { '3ph': s.phaseMag[0], slg: s.phaseMag[0], ll: s.phaseMag[1], dlg: s.phaseMag[1] }[s.kind]
  return [
    T(s.connection),
    F('I_f^{3\\phi} = \\dfrac{E}{Z_1},\\quad I_f^{LG} = \\dfrac{3E}{Z_0+Z_1+Z_2},\\quad I_f^{LL} = \\dfrac{\\sqrt{3}E}{Z_1+Z_2}'),
    C([
      row('Fault current, closed form against the sequence solve', Number.isFinite(closed) ? closed * (x.spec.prefault ?? 1) : measured, measured, 'pu', 0, 1e-9, Number.isFinite(closed) ? null : 'The double line to ground has no one-line closed form, because the split between the negative and zero networks depends on both.'),
      row('Ground current against three times the zero sequence', 3 * s.seqMag[0], s.groundMag, 'pu', 0, 1e-12),
    ]),
    V([
      val('Positive-sequence current', s.seqMag[1], 'pu'),
      val('Negative-sequence current', s.seqMag[2], 'pu'),
      val('Zero-sequence current', s.seqMag[0], 'pu'),
      val('Largest phase current', Math.max(...s.phaseMag) * x.b.Ibase, 'A'),
    ]),
  ]
}

function relayBlocks(exp, p, x) {
  return [
    T('The characteristic is a definition, so the row below compares the engine against the constants it is written from.'),
    F('t = TDS\\,\\dfrac{K}{M^{\\alpha} - 1},\\qquad M = \\dfrac{I}{I_{pickup}}'),
    C([row('Operating time', (x.setting.tds * 13.5) / (x.I / x.setting.pickup - 1), x.down, 's', 0, 1e-9, x.setting.curve === 'veryInverse' ? null : 'The constants above are the very inverse curve, and another curve is selected.')]),
    T('An upstream relay waits a fixed margin behind the downstream one at the same current.'),
    F('t_{up} = t_{down} + \\Delta t'),
    C([row('Upstream time', x.down + (p.margin ?? 0.3), x.up.time, 's', 0, 1e-9)]),
    T('A distance relay reads its own voltage over its own current, and an infeed past a tap lengthens what it reads.'),
    F('Z_{app} = Z_{near} + (1 + k) Z_{far}'),
    C([row('Apparent impedance', x.z.near + (1 + (p.infeed ?? 0)) * x.z.far, x.z.Z, 'Ω', 0, 1e-9)]),
    V([
      val('Zone 1 reach', x.zones.zone1, 'Ω'),
      val('Zone 2 reach', x.zones.zone2, 'Ω'),
      val('Zone this fault falls in', x.zone.zone ?? 0, '', x.zone.says),
    ]),
  ]
}

function swingBlocks(exp, p, x) {
  const st = x.st
  return [
    T('The swing equation, with the inertia taken on the electrical speed because the angle is an electrical angle.'),
    F('M\\ddot\\delta = P_m - P_{max}\\sin\\delta,\\qquad M = \\dfrac{2H}{\\omega_s}'),
    C([
      row('M', (2 * (p.H ?? 4)) / (2 * Math.PI * 60), st.M, 'pu·s²/rad', 0, 1e-12),
      row('Equilibrium angle', deg(Math.asin(st.Pm / x.machine.Pm / (p.pre ?? 2))), deg(st.delta0), '°', 0, 1e-9),
    ]),
    T('Integrating once gives the energy relation the equal-area criterion uses. Both areas below come from quadrature.'),
    F('\\cos\\delta_{cr} = \\dfrac{P_m(\\delta_{max}-\\delta_0) + P_3\\cos\\delta_{max} - P_2\\cos\\delta_0}{P_3 - P_2}'),
    C([row('Accelerating area against decelerating area', st.areaAccel, st.areaDecel, 'pu·rad', 0, 1e-10)]),
    T('The time solution runs under a named integrator, and the energy relation is its guard.'),
    F('\\tfrac{M}{2}\\omega_c^2 + P_m(\\delta_{pk}-\\delta_c) + P_3(\\cos\\delta_{pk}-\\cos\\delta_c) = 0'),
    C([
      row('First-swing peak, integrated against the closed form', deg(x.run.peakExact), deg(x.run.peak), '°', 0, 0.01, x.run.stable ? null : 'The machine does not turn back at this clearing time, so there is no peak to compare.'),
    ]),
    V([
      val('Critical clearing angle', deg(st.deltaCr), '°'),
      val('Critical clearing time', st.tcr, 's', `${st.cycles.toFixed(3)} cycles at 60 Hz`),
      val('Swing frequency after the trip', st.fnPost, 'Hz'),
      val('Integrator step in force', x.run.step, 's', x.run.says || ''),
    ]),
  ]
}

function dispatchBlocks(exp, p, x) {
  const free = x.d.units.filter((u) => !u.limited)
  return [
    T('Minimising the total cost at a fixed demand puts every free unit at the same incremental cost.'),
    F('\\dfrac{dC_i}{dP_i} = b_i + 2c_iP_i = \\lambda,\\qquad \\sum_i P_i = D'),
    C([
      row('Largest gap between a free unit and λ', 0, free.reduce((m, u) => Math.max(m, Math.abs(u.incremental - x.d.lambda)), 0), '$/MWh', 0, 1e-6),
      row('Outputs against the demand', x.demand, x.d.served, 'MW', 0, 1e-6),
    ]),
    T('The multiplier predicts what the next megawatt costs, and solving again one megawatt up measures it.'),
    F('\\lambda \\approx C(D+1) - C(D)'),
    C([row('Marginal cost against λ', x.d.lambda, x.marginal, '$/MWh', 0.001)]),
    V([
      val('λ', x.d.lambda, '$/MWh'),
      val('Cost at the cheapest split', x.d.cost, '$/h'),
      val('Cost at three equal shares', x.d.equalCost, '$/h'),
      val('Saving', x.d.saving, '$/h'),
    ]),
  ]
}

const BLOCKS = {
  base: baseBlocks,
  phase: phaseBlocks,
  line: lineBlocks,
  flow: flowBlocks,
  seq: seqBlocks,
  fault: faultBlocks,
  relay: relayBlocks,
  swing: swingBlocks,
  dispatch: dispatchBlocks,
}

/** The math view's content for one experiment at its current settings. */
export function experimentMath(exp, params, x) {
  const make = BLOCKS[x.kind]
  return { blocks: make ? make(exp, params, x) : [] }
}
