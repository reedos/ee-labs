// Group D's math panel: the law behind each number, and the closed form
// checked against what the solver measured.
//
// The discipline is mathEntries.js's. Every predicted side is written from
// the knobs, so turning a knob moves both columns. A row whose closed form
// the current settings cannot show is footnoted with the reason rather than
// crossed out, because the formula has not stopped being true — a curve model
// in saturation is still described by the exponential, it is just not
// described by β i_B any more.

import { thermalVoltage } from '@ee-labs/network'
import { inverterMargins, tryPoint } from './d.js'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

const VT = thermalVoltage(300)
const IS = 1e-14

/** The Ebers–Moll currents at the two junction voltages, in the transport form bjt.js uses. */
function ebersMoll(vbe, vbc, beta, va = Infinity) {
  const ebe = Math.exp(vbe / VT)
  const ebc = Math.exp(vbc / VT)
  const f = Number.isFinite(va) ? 1 + (vbe - vbc) / va : 1
  const iT = IS * (ebe - ebc) * f
  const ibe = (IS / beta) * (ebe - 1)
  const ibc = IS * (ebc - 1)
  return { ic: iT - ibc, ib: ibe + ibc }
}

/** A reason a row cannot be checked here, or null. */
const notActive = (pt) => (pt && pt.region === 'active' ? null : `The device is ${pt ? pt.region : 'not solved'} here, and this form describes the active region.`)
const tooSmall = (i) => (Math.abs(i) > 1e-12 ? null : 'The current here is below a picoamp, which is the solver’s own floor rather than a reading.')

export const ENTRIES_D = {
  d1(p, x) {
    const pt = x.point.Q1
    const m = ebersMoll(p.vbe, p.vbe - p.vcc, p.beta)
    return {
      blocks: [
        T('Two junctions and one source across the base. The emitter junction passes the exponential, and almost all of what it passes comes out of the collector.'),
        F('i_T = I_S\\left(e^{v_{BE}/V_T} - e^{v_{BC}/V_T}\\right), \\qquad i_B = \\frac{I_S}{\\beta_F}\\left(e^{v_{BE}/V_T} - 1\\right) + \\frac{I_S}{\\beta_R}\\left(e^{v_{BC}/V_T} - 1\\right)'),
        C([
          row('i_C, drawn as two diodes and a source', m.ic, pt.ic, 'A', 1e-6, { abs: 1e-18 }),
          row('i_B, the two junctions’ own share', m.ib, pt.ib, 'A', 1e-6, { abs: 1e-18 }),
          row('α = β/(β + 1)', p.beta / (p.beta + 1), pt.ic / -pt.ie, '', 1e-6, { unchecked: notActive(pt) || tooSmall(pt.ic) }),
        ]),
        V([
          { label: 'thermal voltage V_T at 300 K', value: VT, unit: 'V', note: 'kT/q, the scale the exponential is written in' },
          { label: 'saturation current I_S', value: IS, unit: 'A', note: 'the constant of the same law Circuit Elements Lab gave the diode' },
        ]),
      ],
    }
  },

  d2(p, x) {
    const pt = x.point.Q1
    const m = ebersMoll(p.vbe, p.vbe - p.vcc, p.beta, p.va)
    const decade = tryPoint(x.exp.net({ ...p, vbe: p.vbe + VT * Math.LN10 }))
    const far = tryPoint(x.exp.net({ ...p, vcc: 2 * p.vcc }))
    const slope = far && far.point.Q1 ? (far.point.Q1.ic - pt.ic) / (far.point.Q1.vce - pt.vce) : NaN
    return {
      blocks: [
        T('The same law with the Early factor on it. Collector current rises with v_CE as (1 + v_CE/V_A), so the curves are not flat and their slope is an output resistance.'),
        F('i_C = I_S e^{v_{BE}/V_T}\\left(1 + \\frac{v_{CE}}{V_A}\\right), \\qquad r_o = \\frac{V_A + V_{CE}}{I_C}'),
        C([
          row('i_C with the Early factor', m.ic, pt.ic, 'A', 1e-6, { abs: 1e-18 }),
          row('r_o = (V_A + V_CE)/I_C', (p.va + p.vcc) / m.ic, pt.ro, 'Ω', 1e-3, {
            unchecked:
              pt.ic > 1e-6
                ? null
                : 'Below a microamp the collector current is mostly the reverse junction’s leakage, and this form describes the forward one.',
          }),
          row('current per V_T ln 10 of extra drive', 10, decade && decade.point.Q1 ? decade.point.Q1.ic / pt.ic : NaN, '×', 1e-3, {
            unchecked: decade && decade.point.Q1 ? tooSmall(pt.ic) : 'The circuit has no answer a decade of current above this one.',
          }),
          row('where the curve extrapolates back to', -p.va, Number.isFinite(slope) ? pt.vce - pt.ic / slope : NaN, 'V', 1e-4, {
            unchecked: notActive(pt) || tooSmall(pt.ic),
          }),
        ]),
      ],
    }
  },

  d3(p, x) {
    const flat = tryPoint(x.exp.net({ ...p, model: 'regions' }))
    const curve = tryPoint(x.exp.net({ ...p, model: 'exp' }))
    const fp = flat && flat.point.Q1
    const cp = curve && curve.point.Q1
    const gap = fp && cp && fp.ic > 0 ? cp.ic / fp.ic - 1 : NaN
    const missing = 'The three-region model has no answer at this collector voltage, because its saturated state pins v_CE itself.'
    return {
      blocks: [
        T('Two descriptions of one device. The three-region model makes the active region exactly flat at β i_B. The curve adds the Early slope, and rounds the knee the flat model turns square.'),
        F('\\text{flat: } i_C = \\beta i_B, \\qquad \\text{curve: } i_C = \\beta i_B\\left(1 + \\frac{v_{CE}}{V_A}\\right)'),
        C([
          row('the flat model’s i_C', p.beta * p.ib, fp ? fp.ic : NaN, 'A', 1e-6, { unchecked: fp ? notActive(fp) : missing }),
          row('the curve’s i_C', p.beta * p.ib * (1 + p.vce / p.va), cp ? cp.ic : NaN, 'A', 1e-3, { unchecked: cp ? notActive(cp) : 'The curve has no answer here.' }),
          row('the gap between them, v_CE/V_A', p.vce / p.va, gap, '', 5e-3, {
            unchecked: !fp || !cp ? missing : notActive(fp) || notActive(cp),
          }),
        ]),
      ],
    }
  },

  d4(p, x) {
    const pt = x.point.M1
    const vov = p.vgs - p.vt
    const lam = 1 + p.lam * p.vds
    const sat = vov > 0 ? 0.5 * p.kn * vov * vov * lam : 0
    const tri = vov > 0 ? p.kn * (vov * p.vds - 0.5 * p.vds * p.vds) * lam : 0
    const inTriode = vov > 0 && p.vds < vov
    const off = vov <= 0 ? 'The gate is below threshold here, so the channel is not formed and no current flows.' : null
    return {
      blocks: [
        T('One law in two pieces. Below v_DS = V_OV the channel reaches the drain and the device is a resistor. Above it the channel pinches off and the current stops following the drain.'),
        F('i_D = \\tfrac12 k_n V_{OV}^2 (1 + \\lambda v_{DS}) \\;\\; (v_{DS} \\ge V_{OV}), \\qquad i_D = k_n\\left(V_{OV}v_{DS} - \\tfrac{v_{DS}^2}{2}\\right)(1 + \\lambda v_{DS})'),
        C([
          row('i_D in saturation', sat, pt.id_, 'A', 1e-6, { unchecked: off || (inTriode ? 'The drain is below V_OV here, so the device is in triode and the other row describes it.' : null) }),
          row('i_D in triode', tri, pt.id_, 'A', 1e-6, { unchecked: off || (inTriode ? null : 'The drain is above V_OV here, so the device is saturated and the row above describes it.') }),
          row('g_m = k_n V_OV in saturation', p.kn * vov * lam, pt.gm, 'A/V', 1e-6, { unchecked: off || (inTriode ? 'In triode the gate’s slope is k_n v_DS instead.' : null) }),
          row('r_o = 1/(λ i_D)', p.lam > 0 ? 1 / (p.lam * 0.5 * p.kn * vov * vov) : Infinity, pt.ro, 'Ω', 1e-5, {
            unchecked: off || (inTriode ? 'The output slope in triode is the channel resistance, not λ.' : p.lam > 0 ? null : 'With λ at zero the curves are flat and r_o is unbounded.'),
          }),
        ]),
        V([{ label: 'overdrive V_OV = v_GS − V_t', value: vov, unit: 'V', note: 'the number the square law is really written in' }]),
      ],
    }
  },

  d5(p, x) {
    const pt = x.point.Q1
    const ib = p.vin > 0.7 ? (p.vin - 0.7) / p.RB : 0
    const iSat = (p.vcc - 0.2) / p.RC
    const cut = p.vin <= 0.7 ? 'The drive is below V_BE(on), so the base junction never conducts and the load carries nothing.' : null
    const notSat = pt.region === 'saturation' ? null : `The device is ${pt.region} here, so the load rather than the knee sets what flows.`
    return {
      blocks: [
        T('A switch is a transistor driven so hard that the load, not the device, decides the current. What the base is given is then far more than the collector current divided by β.'),
        F('i_B = \\frac{V_{in} - V_{BE}}{R_B}, \\qquad i_{C,\\text{on}} = \\frac{V_{CC} - V_{CE(sat)}}{R_C}, \\qquad \\beta_{forced} = \\frac{i_C}{i_B}'),
        C([
          row('base current from the drive', ib, pt.ib, 'A', 1e-6, { unchecked: cut }),
          row('load current with the switch on', iSat, pt.ic, 'A', 1e-6, { unchecked: cut || notSat }),
          row('forced β, the ratio the load leaves', iSat / ib, pt.ic / pt.ib, '', 1e-5, { unchecked: cut || notSat }),
          row('the drop across the closed switch', 0.2, pt.vce, 'V', 1e-6, { unchecked: cut || notSat }),
        ]),
        V([{ label: 'base current the load needs, i_C/β', value: iSat / p.beta, unit: 'A', note: 'anything past this drives the device into saturation' }]),
      ],
    }
  },

  d6(p, x) {
    const m = inverterMargins(p)
    const vdd = x.sol.v.vdd
    const ends = tryPoint(x.exp.net({ ...p, vin: 0 }))
    const tooHigh = p.vt >= vdd / 2 ? 'With a threshold this high the two devices are never both on, and the curve has no gain region to measure a margin in.' : null
    return {
      blocks: [
        T('Two switches on one gate, one of which is on whenever the other is off. Matched, the curve is symmetric about half the supply, and the margins are set by the threshold alone.'),
        F('V_M = \\frac{V_{DD}}{2}, \\qquad V_{IL} = \\frac{3V_{DD} + 2V_t}{8}, \\qquad V_{IH} = \\frac{5V_{DD} - 2V_t}{8}'),
        C([
          row('switching threshold V_M', vdd / 2, m.vm, 'V', 1e-6, { unchecked: tooHigh }),
          row('V_IL, where the slope first reaches −1', (3 * vdd + 2 * p.vt) / 8, m.vil, 'V', 1e-3, { unchecked: tooHigh }),
          row('V_IH, where it comes back through −1', (5 * vdd - 2 * p.vt) / 8, m.vih, 'V', 1e-3, { unchecked: tooHigh }),
          row('supply current with the input low', 0, ends ? Math.abs(ends.sol.i.VDD) : NaN, 'A', 1e-6, { abs: 1e-12 }),
        ]),
        V([{ label: 'peak supply current, at V_M', value: 0.5 * p.kn * (vdd / 2 - p.vt) ** 2, unit: 'A', note: 'the one input where both devices conduct at once' }]),
      ],
    }
  },

  d7(p, x) {
    const pt = x.point.Q1
    const early = p.model === 'exp' ? 1 + pt.vce / p.va : 1
    const saturated = pt.region === 'saturation'
    return {
      blocks: [
        T('The resistor draws a straight line across the device’s curves, and the circuit has to sit on it. Where the line meets the curve for the base current applied is the operating point.'),
        F('i_C = \\frac{V_{CC} - v_{CE}}{R_C}, \\qquad i_C = \\beta i_B \\text{ while the device is active}'),
        C([
          row('the load line, read at the measured v_CE', (p.vcc - pt.vce) / p.RC, pt.ic, 'A', 1e-9, { abs: 1e-15 }),
          row('i_C = β i_B in the active region', p.beta * p.ib * early, pt.ic, 'A', 1e-3, { unchecked: notActive(pt) }),
          row('v_CE at the saturated end', 0.2, pt.vce, 'V', 1e-6, {
            unchecked: !saturated
              ? 'The device is not saturated here, so the knee is not what sets v_CE.'
              : p.model === 'exp'
                ? 'The curve model has no flat 0.2 V knee. It rounds into saturation, so its floor is a reading rather than a constant.'
                : null,
          }),
        ]),
        V([
          { label: 'the line’s current axis intercept', value: p.vcc / p.RC, unit: 'A', note: 'the most the load could pass, at v_CE = 0' },
          { label: 'the line’s voltage axis intercept', value: p.vcc, unit: 'V', note: 'the supply, at no current at all' },
        ]),
      ],
    }
  },
}
