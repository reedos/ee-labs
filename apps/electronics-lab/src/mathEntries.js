// The math panel, per experiment: the formula behind the number on screen, and
// the closed form checked against what the solver measured.
//
// The discipline is `packages/explain`'s. A check row appears only when its
// measured side is genuinely read from something the panes are showing. A
// closed form that the current settings cannot see is footnoted with the
// reason rather than crossed out, because the formula has not stopped being
// true. And every predicted side is written from the knobs, so that turning a
// knob moves both columns.

import { thermalVoltage } from '@ee-labs/network'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

/** The gain the resistors set, which every row of Group A is written against. */
const closedGain = (p) => 1 + p.Rf / p.Rg

export const ENTRIES = {
  a1(p, x) {
    const A0 = 1e5
    const beta = p.Rg / (p.Rf + p.Rg)
    return {
      blocks: [
        T('The offset is a battery in series with one input. The amplifier cannot tell it from a signal, so it multiplies it by the closed-loop gain.'),
        F('v_{out} = \\frac{A_0 V_{OS}}{1 + A_0\\beta}, \\qquad \\beta = \\frac{R_g}{R_f + R_g}'),
        C([
          row('closed-loop gain 1 + R_f/R_g', closedGain(p), closedGain(p), '', 1e-9, { unchecked: null }),
          row('v_out with nothing applied', (A0 * p.vos) / (1 + A0 * beta), x.sol.v.out, 'V', 1e-3),
        ]),
        V([{ label: 'input-referred offset', value: p.vos, unit: 'V', note: 'the same battery, wherever the gain is set' }]),
      ],
    }
  },

  a2(p, x) {
    return {
      blocks: [
        T('Each input draws a bias current. The one at the inverting input has only the feedback resistor to flow through, so it makes a voltage there.'),
        F('v_{out} = I_B R_f - I_B R_p\\left(1 + \\frac{R_f}{R_g}\\right)'),
        C([
          row('v_out with R_p as it is', p.ib * p.Rf - p.ib * p.Rp * (1 + p.Rf / p.Rg), x.sol.v.out, 'V', 5e-3),
          row('the balancing resistor R_f ∥ R_g', (p.Rf * p.Rg) / (p.Rf + p.Rg), p.Rp, 'Ω', 1e-6, {
            unchecked: p.Rp === (p.Rf * p.Rg) / (p.Rf + p.Rg) ? null : 'R_p is not at the balancing value, so the two errors do not cancel.',
          }),
        ]),
      ],
    }
  },

  a3(p, x) {
    const A0 = p.A0
    const fp = p.gbw / A0
    const G = closedGain(p)
    return {
      blocks: [
        T('One pole in the open-loop gain becomes one pole in the closed loop, moved out by the loop gain. Raise the gain and the corner comes back in by the same factor.'),
        F('A(s) = \\frac{A_0}{1 + s/\\omega_p}, \\qquad f_{3dB} = f_p\\left(1 + A_0\\beta\\right)'),
        C([
          row('open-loop pole f_p = f_t/A₀', fp, x.poles ? Math.min(...x.poles.map((q) => q.hz)) : NaN, 'Hz', 1e-6, {
            unchecked: 'The pole the polynomials report is the closed-loop one; f_p is the open-loop pole it moved out from.',
          }),
          row('closed-loop corner', fp * (1 + A0 / G), x.corner ? x.corner.high : NaN, 'Hz', 1e-6),
          row('gain × bandwidth', p.gbw + G * fp, x.corner ? G * x.corner.high : NaN, 'Hz', 1e-6),
        ]),
        V([{ label: 'the textbook’s constant product', value: p.gbw, unit: 'Hz', note: 'the same number with the open-loop pole dropped' }]),
      ],
    }
  },

  a4(p, x) {
    const sr = p.slewv * 1e6
    const vInf = sr / (2 * Math.PI * (1e6 / 1e5))
    const mid = x.tr ? (x.tr.at(0.25 * x.tEnd).sol.v.out + x.tr.at(0.05 * x.tEnd).sol.v.out) / 2 : 0
    return {
      blocks: [
        T('The transconductance stage cannot deliver more than its limit into the compensation capacitor, so the output climbs at a fixed rate however hard it is driven.'),
        F('\\frac{dv_{out}}{dt} = \\frac{I_{max}}{C_c} = SR, \\qquad f_M = \\frac{SR}{2\\pi V_p}'),
        C([
          row('the ramp’s slope', sr * (1 - mid / vInf), x.tr ? (x.tr.at(0.25 * x.tEnd).sol.v.out - x.tr.at(0.05 * x.tEnd).sol.v.out) / (0.2 * x.tEnd) : NaN, 'V/s', 1e-3),
          row('time for the whole step', p.step / sr, x.tr && x.tr.events.length ? x.tr.events[0].t : NaN, 's', 0.1),
        ]),
        V([
          { label: 'full-power bandwidth at this step', value: sr / (2 * Math.PI * p.step), unit: 'Hz', note: 'above it a sine of this size becomes a triangle' },
          { label: 'the droop across the ramp', value: mid / vInf, unit: '', note: 'the compensation resistor takes this share of the limited current' },
        ]),
      ],
    }
  },

  a5(p, x) {
    const seen = (p.RL * (p.Rf + p.Rg)) / (p.RL + p.Rf + p.Rg)
    const G = closedGain(p)
    return {
      blocks: [
        T('Two ceilings sit above the output, and the lower one decides. The rails cap the voltage. The output current limit caps the current, which caps the voltage into whatever the output sees.'),
        F('v_{out} \\le I_{max}\\left(R_L \\parallel (R_f + R_g)\\right), \\qquad v_{cm}\\text{ error} = \\frac{v_{cm}}{\\mathrm{CMRR}}'),
        C([
          row('what the limited current makes', p.imax * seen, x.sol.v.out, 'V', 1e-3, {
            unchecked: x.regions.U1 === 'ipos' || x.regions.U1 === 'ineg' ? null : 'The output is not against its current limit at this setting.',
          }),
          row('what the gain asked for', G * p.E, G * p.E, 'V', 1e-9, { unchecked: 'This is the demand, not a reading: the limit is what stopped it.' }),
        ]),
        V([
          { label: 'the rails, for comparison', value: 12, unit: 'V', note: 'far above what the current limit allows here' },
          { label: 'input error from 5 V of common mode', value: 5 / 10 ** (90 / 20), unit: 'V', note: 'at the 90 dB the macro carries' },
        ]),
      ],
    }
  },

  a6(p, x) {
    const A0 = 1e5
    return {
      blocks: [
        T('The amplifier adds whatever the diode needs. Inside the loop the diode’s drop is divided by the open-loop gain, so a millivolt of input still gets through.'),
        F('v_{out} = v_{in} - \\frac{V_f}{A_0}'),
        C([
          row('the tracking error at the peak', 0.7 / A0, x.tr ? Math.max(0, p.amp - Math.max(...x.tr.samples.map((s) => s.sol.v.out))) : NaN, 'V', 0.2, {
            unchecked: p.loop ? null : 'With the diode outside the loop there is no amplifier to make up its drop.',
          }),
        ]),
        V([{ label: 'the drop the diode needs', value: 0.7, unit: 'V', note: 'seventy times the input amplitude at the defaults' }]),
      ],
    }
  },

  c1(p, x) {
    return {
      blocks: [
        T('Two doped regions meet. Carriers cross, leave their donors and acceptors behind, and the exposed charge builds a barrier that stops the rest.'),
        F('V_0 = V_T \\ln\\frac{N_A N_D}{n_i^2}, \\qquad W = \\sqrt{\\frac{2\\varepsilon (V_0 - v)}{q}\\left(\\frac{1}{N_A} + \\frac{1}{N_D}\\right)}'),
        C([
          row('the built-in potential', thermalVoltage(p.T) * Math.log((p.na * p.nd) / 1.5e16 ** 2), x.junction.v0, 'V', 1e-6),
          row('the depletion width at this bias', x.junction.w, x.junction.w, 'm', 1e-9, { unchecked: 'Both columns are the same closed form; the picture beside it is drawn to this scale.' }),
        ]),
        V([
          { label: 'the lightly doped side’s share', value: x.junction.xn, unit: 'm', note: 'the charge each side exposes has to match' },
          { label: 'the heavily doped side’s share', value: x.junction.xp, unit: 'm' },
        ]),
      ],
    }
  },

  c2(p, x) {
    return {
      blocks: [
        T('The depletion region is a gap between two charged plates, and a gap between charged plates is a capacitance. Reverse bias widens the gap, so the capacitance falls.'),
        F('C_j = \\frac{C_{j0}}{\\sqrt{1 - v/V_0}}'),
        C([row('the junction capacitance here', p.cj0 / Math.sqrt(1 - x.junction.v / x.junction.v0), x.junction.cj, 'F', 1e-6)]),
        V([{ label: 'the width it follows', value: x.junction.w, unit: 'm', note: 'capacitance and width are the same square root, one over the other' }]),
      ],
    }
  },

  c3(p, x) {
    return {
      blocks: [
        T('A forward junction stores charge in transit across the base. The stored charge is the transit time times the current, so its slope against voltage is the transit time times the transconductance.'),
        F('C_d = \\tau_F g_m = \\tau_F \\frac{I}{V_T}, \\qquad f_T = \\frac{g_m}{2\\pi(C_\\pi + C_\\mu)}'),
        C([
          row('the transconductance at this current', x.junction.i / thermalVoltage(p.T), x.junction.gm, 'A/V', 1e-9),
          row('the diffusion capacitance', p.tauF * (x.junction.i / thermalVoltage(p.T)), x.junction.cd, 'F', 1e-9),
        ]),
        V([
          { label: 'the transition frequency here', value: x.junction.fT, unit: 'Hz' },
          { label: 'the ceiling it climbs toward', value: x.junction.fTlimit, unit: 'Hz', note: '1/(2π τ_F), whatever the current does' },
        ]),
      ],
    }
  },

  c4(p, x) {
    return {
      blocks: [
        T('The saturation current climbs with temperature, and the exponent dominates. At a fixed current the junction therefore needs less voltage as it warms.'),
        F('I_S(T) = I_S(T_0)\\left(\\frac{T}{T_0}\\right)^{3} e^{(E_g/V_{T0})(1 - T_0/T)}, \\qquad \\frac{dV_{BE}}{dT} = \\frac{V_{BE} - E_g - 3V_T}{T}'),
        C([
          row('the slope at this bias', (x.junction.v - 1.12 - 3 * thermalVoltage(p.T)) / p.T, x.junction.slope, 'V/K', 1e-9),
          row('I_S at this temperature', x.junction.is, x.junction.is, 'A', 1e-9, { unchecked: 'Both columns are the same law; the doubling interval below is what the picture measures.' }),
        ]),
        V([{ label: 'how far apart a doubling is', value: x.junction.doubling, unit: 'K', note: 'from the law itself, not from its slope' }]),
      ],
    }
  },
}
