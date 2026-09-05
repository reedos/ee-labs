// Group E's math panel: the bias equations, and what the circuit measured.
//
// Three of the six use the three-region model, whose closed forms are the
// ones a hand analysis writes and which the solver reproduces to floating
// point. The other three use the curve, where the closed form is the base
// loop itself rather than a formula for I_C, so the row that checks it is a
// loop of measured voltages against a supply that is a knob.

import { isAt, thermalVoltage } from '@ee-labs/network'
import { tryPoint } from './d.js'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

const notActive = (pt) => (pt && pt.region === 'active' ? null : `The device is ${pt ? pt.region : 'not solved'} here, and this form describes the active region.`)
/** The divider seen from the base: its open-circuit voltage and its resistance. */
const thevenin = (p) => ({ vbb: (p.vcc * p.R2) / (p.R1 + p.R2), rb: (p.R1 * p.R2) / (p.R1 + p.R2) })

export const ENTRIES_E = {
  e1(p, x) {
    const pt = x.point.Q1
    const { vbb, rb } = thevenin(p)
    // The stage carries one capacitor, so its response has one pole and the
    // form below is exact. The pole itself is what the polynomials report; the
    // topbar's corner is the same number wherever the reading band holds it.
    const fL = x.poles && x.poles.length ? x.poles[0].hz : NaN
    const hMag = x.hAt ? Math.hypot(x.hAt[0], x.hAt[1]) : NaN
    const rin = 1 / (1 / p.R1 + 1 / p.R2 + 1 / (pt.rpi + (p.beta + 1) * p.RE))
    return {
      blocks: [
        T('Two circuits on one drawing. At DC the capacitor is an open, so the divider alone sets the base. At the signal frequency its impedance is small, so the source reaches the base almost undiminished.'),
        F('v_B = V_{BB} - i_B R_B, \\qquad |H(f)| = \\frac{1}{\\sqrt{1 + (f_L/f)^2}}, \\qquad f_L = \\frac{1}{2\\pi R_{in} C_C}'),
        C([
          row('DC current through the capacitor', 0, x.sol.i.CC, 'A', 1e-6, { abs: 1e-12 }),
          row('base voltage from the divider alone', vbb - pt.ib * rb, x.sol.v.b, 'V', 1e-5),
          row('|H| at the signal frequency, from one pole', 1 / Math.sqrt(1 + (fL / p.f) ** 2), hMag, '', 1e-4, {
            unchecked: Number.isFinite(fL) && fL > 0 ? null : 'The response has no pole at these settings, so there is nothing for the one-pole form to describe.',
          }),
        ]),
        V([
          { label: 'divider open-circuit voltage V_BB', value: vbb, unit: 'V', note: 'what the base would sit at drawing no current' },
          { label: 'divider resistance R_B', value: rb, unit: 'Ω', note: 'R₁ ∥ R₂, what the base current flows back through' },
          { label: 'input resistance the tangent shows', value: rin, unit: 'Ω', note: 'R₁ ∥ R₂ ∥ (r_π + (β + 1)R_E), which sets the corner' },
          { label: 'capacitor impedance at this frequency', value: 1 / (2 * Math.PI * p.f * p.CC), unit: 'Ω', note: 'compare it with the input resistance above' },
        ]),
      ],
    }
  },

  e2(p, x) {
    const pt = x.point.Q1
    const ib = p.vcc > 0.7 ? (p.vcc - 0.7) / p.RB : 0
    const iSat = (p.vcc - 0.2) / p.RC
    const cut = p.vcc <= 0.7 ? 'The supply is below V_BE(on), so no base current flows and the device is cut off.' : null
    const sat = pt.region === 'saturation'
    return {
      blocks: [
        T('One resistor from the supply to the base fixes the base current. Nothing in the circuit then limits what β does to it, so the collector current is proportional to a device property.'),
        F('I_B = \\frac{V_{CC} - V_{BE}}{R_B}, \\qquad I_C = \\beta I_B = \\frac{\\beta(V_{CC} - 0.7)}{R_B}'),
        C([
          row('base current the resistor sets', ib, pt.ib, 'A', 1e-6, { unchecked: cut }),
          row('collector current, β times it', p.beta * ib, pt.ic, 'A', 1e-6, {
            unchecked: cut || (sat ? 'β I_B is more than the load can pass here, so the device is saturated and the row below is what it reads.' : null),
          }),
          row('the most the load can pass', iSat, pt.ic, 'A', 1e-6, { unchecked: cut || (sat ? null : 'The device is not saturated here, so β I_B is what sets the current.') }),
        ]),
        V([{ label: 'the current β asks for', value: p.beta * ib, unit: 'A', note: 'compared with the load line’s ceiling above' }]),
      ],
    }
  },

  e3(p, x) {
    const pt = x.point.Q1
    const { vbb, rb } = thevenin(p)
    const ic = (p.beta * (vbb - 0.7)) / (rb + (p.beta + 1) * p.RE)
    const vce = p.vcc - ic * p.RC - ic * ((p.beta + 1) / p.beta) * p.RE
    return {
      blocks: [
        T('The divider holds the base at a voltage, and the emitter resistor turns the current back down whenever it rises. β enters only through R_B/(β + 1), which the rule below keeps small.'),
        F('I_C = \\frac{\\beta(V_{BB} - V_{BE})}{R_B + (\\beta + 1)R_E}, \\qquad R_B \\le 0.1(\\beta + 1)R_E'),
        C([
          row('collector current from the base loop', ic, pt.ic, 'A', 1e-6, { unchecked: notActive(pt) }),
          row('v_CE from the collector loop', vce, pt.vce, 'V', 1e-5, { unchecked: notActive(pt) }),
        ]),
        V([
          { label: 'divider open-circuit voltage V_BB', value: vbb, unit: 'V' },
          { label: 'divider resistance R_B', value: rb, unit: 'Ω' },
          { label: 'the rule’s ceiling, 0.1(β + 1)R_E', value: 0.1 * (p.beta + 1) * p.RE, unit: 'Ω', note: 'R_B below this and β moves the answer by a few percent' },
        ]),
      ],
    }
  },

  e4(p, x) {
    const pt = x.point.Q1
    const { vbb, rb } = thevenin(p)
    const vtT = thermalVoltage(p.T)
    const isT = isAt({ is: 1e-14 }, p.T)
    const early = 1 + pt.vce / p.va
    const hot = tryPoint(x.exp.net({ ...p, T: p.T + 10 }))
    const cold = tryPoint(x.exp.net({ ...p, T: p.T - 10 }))
    const hp = hot && hot.point.Q1
    const cp = cold && cold.point.Q1
    const shift = hp && cp ? -(hp.vbe - cp.vbe) / (p.RE + rb / (p.beta + 1)) : NaN
    return {
      blocks: [
        T('Temperature enters through I_S alone. At a fixed current the junction needs less voltage as it warms, and whatever V_BE gives up the emitter resistor takes as current.'),
        F('v_{BE} = V_T \\ln\\frac{i_C}{I_S(T)(1 + v_{CE}/V_A)}, \\qquad \\Delta I_C = \\frac{-\\Delta v_{BE}}{R_E + R_B/(\\beta + 1)}'),
        C([
          row('v_BE the junction law asks for', vtT * Math.log(pt.ic / (isT * early)), pt.vbe, 'V', 1e-5, {
            unchecked: pt.ic > 1e-12 ? notActive(pt) : 'The collector current here is below a picoamp, so its logarithm is the solver’s floor rather than a reading.',
          }),
          row('the base loop closes on V_BB', vbb, pt.ib * rb + pt.vbe - pt.ie * p.RE, 'V', 1e-6, { unchecked: notActive(pt) }),
          row('ΔI_C over 20 K, from ΔV_BE', shift, hp && cp ? hp.ic - cp.ic : NaN, 'A', 0.05, {
            unchecked: hp && cp ? notActive(hp) || notActive(cp) : 'The circuit has no answer ten kelvin either side of this one.',
          }),
        ]),
        V([
          { label: 'I_S at this temperature', value: isT, unit: 'A', note: 'from the same law Group C measured' },
          { label: 'thermal voltage V_T here', value: vtT, unit: 'V' },
          { label: 'what the shift divides by, R_E + R_B/(β + 1)', value: p.RE + rb / (p.beta + 1), unit: 'Ω' },
        ]),
      ],
    }
  },

  e5(p, x) {
    const pt = x.point.M1
    const over = p.vg - p.vt
    // The square law with a source resistor is a quadratic in the overdrive.
    // Written this way it stays exact as R_S goes to nothing.
    const u = over > 0 ? (2 * over) / (1 + Math.sqrt(1 + 2 * p.kn * p.RS * over)) : 0
    const id = 0.5 * p.kn * u * u
    const vds = p.vdd - id * (p.RD + p.RS)
    const off = over <= 0 ? 'The gate sits below threshold here, so no channel forms and the drain carries nothing.' : null
    const triode = pt.region === 'triode' ? 'The drain has fallen below V_OV, so the device is in triode and the saturation form does not describe it.' : null
    return {
      blocks: [
        T('The gate draws no current, so the divider holds it wherever it is set. The source resistor then subtracts the drain current from the overdrive, which is what keeps a threshold shift from squaring itself into the answer.'),
        F('I_D = \\tfrac12 k_n V_{OV}^2, \\qquad V_{OV} = V_G - V_t - I_D R_S, \\qquad V_{DS} = V_{DD} - I_D(R_D + R_S)'),
        C([
          row('drain current from the square law', id, pt.id_, 'A', 1e-6, { unchecked: off || triode }),
          row('overdrive left after R_S', u, pt.vov, 'V', 1e-6, { unchecked: off || triode }),
          row('v_DS from the two resistors', vds, pt.vds, 'V', 1e-5, { unchecked: off || triode }),
          row('g_m = k_n V_OV', p.kn * u, pt.gm, 'A/V', 1e-6, { unchecked: off || triode }),
        ]),
        V([{ label: 'gate drive above threshold, V_G − V_t', value: over, unit: 'V', note: 'the overdrive there would be with no source resistor' }]),
      ],
    }
  },

  e6(p, x) {
    const pt = x.point.Q1
    const alpha = p.beta / (p.beta + 1)
    return {
      blocks: [
        T('The source sets the emitter current, and the emitter current is the sum of the other two. So the collector takes α of a number that no property of the device appears in.'),
        F('I_E = I_{source}, \\qquad I_C = \\alpha I_E = \\frac{\\beta}{\\beta + 1} I_E, \\qquad v_C = V_{CC} - I_C R_C'),
        C([
          row('emitter current the source sets', p.ie, -pt.ie, 'A', 1e-5, { abs: 1e-15 }),
          row('collector current, α of it', alpha * p.ie, pt.ic, 'A', 0.01, { unchecked: notActive(pt) }),
          row('collector voltage across R_C', p.vcc - pt.ic * p.RC, x.sol.v.c, 'V', 1e-9, { abs: 1e-12 }),
        ]),
        V([
          { label: 'α = β/(β + 1)', value: alpha, unit: '', note: 'the only device property left in the answer' },
          { label: 'base voltage, −i_B R_B', value: -pt.ib * p.RB, unit: 'V', note: 'the base current still has to come from somewhere' },
        ]),
      ],
    }
  },
}
