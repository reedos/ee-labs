// Group I's math panel. The same discipline as Group H's: every predicted side
// is written from the knobs or from the operating point the solve reports, and
// a row the settings cannot show carries its reason instead of a number.

import { VCC, VT, gainFrom, portR } from './h.js'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

const par = (...rs) => 1 / rs.reduce((s, r) => s + 1 / r, 0)
/**
 * The footnote a row carries when a collector has come within a few thermal
 * voltages of its own emitter. The region label still reads active there, but
 * the collector junction has begun to inject, and every formula in this file
 * is written for the forward term alone.
 */
const nearSat = (...pts) =>
  pts.every((q) => q && Math.abs(q.vce) > 0.2)
    ? null
    : 'A collector is within 200 mV of its emitter here, so its own junction is injecting and the active-region forms do not describe it.'

const offRegion = (...pts) =>
  pts.every((q) => q && q.region === 'active') ? null : 'One of the transistors has left its active region, and every formula here is the hybrid-π taken there.'

/** The current the reference resistor actually passes, read off the solve. */
const refCurrent = (p, x, net) => (VCC - x.sol.v.ref) / net.elements.find((e) => e.id === 'Rref').value

export const MATH_I = {
  i1(p, x) {
    const [q1, q2] = [x.point.Q1, x.point.Q2]
    const iref = refCurrent(p, x, x.net)
    const early = Number.isFinite(q2.ro) ? (1 + q2.vce / p.va) / (1 + q1.vce / p.va) : 1
    return {
      blocks: [
        T('Both transistors share one base-emitter voltage, so both carry the same current up to two effects: the base currents taken out of the reference, and the different collector voltages.'),
        F('\\frac{I_{out}}{I_{ref}} = \\frac{1}{1 + 2/\\beta}\\cdot\\frac{1 + V_{CE2}/V_A}{1 + V_{CE1}/V_A}, \\qquad R_{out} = r_o'),
        C([
          row('the copy ratio', early / (1 + 2 / p.beta), q2.ic / iref, '', 5e-3, { unchecked: offRegion(q1, q2) || nearSat(q2) }),
          row('the output resistance, r_o of the copy', q2.ro, portR(x, 'out', ['Vout']), 'Ω', 5e-3, {
            unchecked: Number.isFinite(q2.ro) ? offRegion(q1, q2) || nearSat(q2) : 'With the Early effect off the copy is an ideal current source, and a test source at it finds no resistance at all.',
          }),
        ]),
        V([
          { label: 'the reference current the resistor passes', value: iref, unit: 'A' },
          { label: 'the base-current error alone, 2/β', value: 2 / p.beta, unit: '', note: 'the same fraction whatever the currents are' },
          { label: 'the reference transistor’s collector voltage', value: q1.vce, unit: 'V', note: 'a diode-connected transistor sits at its own V_BE' },
        ]),
      ],
    }
  },

  i2(p, x) {
    const [q1, q2] = [x.point.Q1, x.point.Q2]
    const iref = refCurrent(p, x, x.net)
    // What the copying base is fed from: the diode-connected reference in
    // parallel with the resistor above it. It is tens of ohms, and leaving it
    // out is what makes the closed form below an approximation.
    const rb = par(1 / q1.gm, q1.rpi, x.net.elements.find((e) => e.id === 'Rref').value)
    const re = par(p.RE, q2.rpi + rb)
    // The textbook's boost, and what a test source at the port actually finds.
    // The closed form carries no ceiling, and the circuit has one: no amount of
    // degeneration pushes a collector past about β r_o, because the base
    // current has to come from somewhere. So the two are shown side by side
    // with the gap between them, rather than asserted equal.
    const estimate = q2.ro * (1 + q2.gm * re) + re
    const measured = portR(x, 'out', ['Vout'])
    return {
      blocks: [
        T('The resistor under the copying emitter drops a voltage, and the two base-emitter voltages differ by exactly that drop. Current depends on it exponentially, so a little drop goes a long way.'),
        F('V_T \\ln\\frac{I_{ref}}{I_{out}} = I_{E2} R_E, \\qquad R_{out} \\approx r_o (1 + g_m (R_E \\parallel r_\\pi))'),
        C([
          row('the emitter drop, I_E2 R_E', -q2.ie * p.RE, x.sol.v.e2, 'V', 1e-6, { unchecked: offRegion(q1, q2) }),
        ]),
        V([
          { label: 'the ratio the two currents come out at', value: iref / q2.ic, unit: '', note: 'set by the drop, through the exponential' },
          { label: 'the output resistance by test source', value: measured, unit: 'Ω' },
          { label: 'what r_o(1 + g_m(R_E ∥ r_π)) estimates', value: estimate, unit: 'Ω', note: `${(100 * Math.abs(estimate / measured - 1)).toFixed(1)} % away here, and the gap grows as the boost approaches β` },
          { label: 'what one decade of ratio costs, V_T ln 10', value: VT * Math.LN10, unit: 'V', note: 'at the emitter, whatever the currents are' },
          { label: 'the output transistor’s own r_o', value: q2.ro, unit: 'Ω', note: 'large already, because the current is small' },
        ]),
      ],
    }
  },

  i3(p, x) {
    const [q1, q3] = [x.point.Q1, x.point.Q3]
    return {
      blocks: [
        T('The load is a current source, so the only resistance at the output node is the two output resistances in parallel. That is as far as one transistor can go.'),
        F('A_v = -g_m (r_{on} \\parallel r_{op}), \\qquad g_m r_o = \\frac{V_A + V_{CE}}{V_T}'),
        C([
          row('the gain −g_m(r_on ∥ r_op)', -q1.gm * par(q1.ro, q3.ro), x.gain, '', 5e-3, { unchecked: x.tf ? offRegion(q1, q3) || nearSat(q1, q3) : 'This setting has no small-signal transfer function.' }),
          row('the intrinsic gain (V_A + V_CE)/V_T', (p.va + q1.vce) / VT, q1.gm * q1.ro, '', 5e-3, { unchecked: offRegion(q1, q3) || nearSat(q1, q3) }),
          row('the resistance at the output node', par(q1.ro, q3.ro), portR(x, 'c'), 'Ω', 5e-3, { unchecked: offRegion(q1, q3) || nearSat(q1, q3) }),
        ]),
        V([
          { label: 'where the output settled', value: x.sol.v.c, unit: 'V', note: 'wherever the two currents happen to meet' },
          { label: 'what one per cent of mismatch moves it', value: 0.01 * Math.abs(q1.ic) * par(q1.ro, q3.ro), unit: 'V', note: 'the current error times the node’s own resistance' },
          { label: 'the textbook’s V_A/V_T, for comparison', value: p.va / VT, unit: '', note: 'the same figure with the collector voltage dropped' },
        ]),
      ],
    }
  },

  i4(p, x) {
    const [q1, q2] = [x.point.Q1, x.point.Q2]
    const rlower = par(q2.rpi, q1.ro)
    const rout = q2.ro * (1 + q2.gm * rlower) + rlower
    const alpha = (q2.gm * q2.rpi) / (1 + q2.gm * q2.rpi)
    // The model keeps a base-collector resistance of a teraohm, which caps what
    // any test source at the collector can find. Once the cascode's estimate
    // comes within two decades of it, the estimate is describing a circuit the
    // model does not have.
    const pastRmu =
      Number.isFinite(q2.rmu) && rout > 0.01 * q2.rmu
        ? 'The estimate has climbed to within two decades of the base-collector resistance the model carries, and that resistance is what the port finds instead.'
        : null
    return {
      blocks: [
        T('The upper transistor takes the lower one’s collector current and passes it on from a much higher resistance. The lower collector barely moves, because it is looking into 1/g_m.'),
        F('R_{out} = r_{o2}\\left(1 + g_{m2}(r_{\\pi 2} \\parallel r_{o1})\\right), \\qquad A_v = -\\alpha\\, g_{m1} (R_C \\parallel R_{out})'),
        C([
          row('the output resistance with R_C lifted off', rout, portR(x, 'c', ['RC']), 'Ω', 5e-3, { unchecked: offRegion(q1, q2) || nearSat(q1, q2) || pastRmu }),
          row('the gain into R_C', -alpha * q1.gm * par(p.RC, rout), x.gain, '', 5e-3, { unchecked: x.tf ? offRegion(q1, q2) || nearSat(q1, q2) || pastRmu : 'This setting has no small-signal transfer function.' }),
        ]),
        V([
          { label: 'one transistor’s r_o, for comparison', value: q1.ro, unit: 'Ω', note: 'what a common emitter alone would offer' },
          { label: 'the boost the upper transistor gives', value: rout / q1.ro, unit: '×', note: 'about β, and it follows β when β is turned' },
          { label: 'the lower collector’s voltage', value: x.sol.v.c1, unit: 'V', note: 'held by the upper transistor’s base' },
        ]),
      ],
    }
  },

  i5(p, x) {
    const [q1, q2] = [x.point.Q1, x.point.Q2]
    const rout1 = portR(x, 'c1', ['CC'])
    const rin2 = portR(x, 'b2', ['CC'])
    const g2 = gainFrom(x, 'b2', 'c2', ['CC', 'Vs'])
    const total = x.hAt ? Math.hypot(x.hAt[0], x.hAt[1]) : NaN
    // Both rows are midband forms, and the gain is read at one frequency. The
    // coupling capacitor's own corner has to sit well below that frequency for
    // the reading to be the midband at all: a factor of twenty is the guard the
    // plan sets for a quasi-static claim, and it is used again here.
    const corner = 1 / (2 * Math.PI * p.CC * (rout1 + rin2))
    const tooLow = corner > (x.probe || 1) / 20 ? 'The coupling capacitor’s corner is not far enough below the frequency the gain is read at, so this reading is the high-pass rather than the midband.' : null
    return {
      blocks: [
        T('Each stage’s output resistance and the next stage’s input resistance make a divider, and the divider belongs to the pair rather than to either stage.'),
        F('A = A_{v1}\\cdot\\frac{R_{in2}}{R_{out1} + R_{in2}}\\cdot A_{v2}'),
        C([
          row('the first stage loaded by the second', q1.gm * par(rout1, rin2), total / Math.abs(g2), '', 5e-3, { unchecked: x.tf ? offRegion(q1, q2) || nearSat(q1, q2) || tooLow : 'This setting has no small-signal transfer function.' }),
          row('the divider between the stages', rin2 / (rout1 + rin2), total / (q1.gm * rout1 * Math.abs(g2)), '', 5e-3, { unchecked: x.tf ? offRegion(q1, q2) || nearSat(q1, q2) || tooLow : 'This setting has no small-signal transfer function.' }),
        ]),
        V([
          { label: 'the first stage’s output resistance', value: rout1, unit: 'Ω' },
          { label: 'the second stage’s input resistance', value: rin2, unit: 'Ω' },
          { label: 'the first stage unloaded', value: q1.gm * rout1, unit: '', note: 'what it would give into an open circuit' },
          { label: 'the pair, in decibels', value: 20 * Math.log10(total), unit: 'dB' },
        ]),
      ],
    }
  },
}
