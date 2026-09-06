// Group H's math panel: the formula behind the number on screen, and the
// closed form checked against what the solver measured.
//
// Every predicted side is written from the knobs or from the operating point
// the solve reports, so turning a knob moves both columns. A row whose closed
// form the current settings cannot show is footnoted with the reason rather
// than crossed out, which is the discipline packages/explain enforces.
//
// The recurring footnote is the region. Every formula in this group is the
// hybrid-π or the square law in saturation, and a device driven into
// saturation, triode or cutoff is described by neither.

import { BJT_DEFAULTS } from '@ee-labs/network'
import { VCC, VT, gainFrom, portR } from './h.js'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

/** Resistances in parallel, written so that an infinite one costs nothing. */
const par = (...rs) => 1 / rs.reduce((s, r) => s + 1 / r, 0)

/** The footnote a row carries when the device has left the region its formula describes. */
const offRegion = (pt, want = 'active') =>
  pt && pt.region === want ? null : `The transistor is ${pt ? pt.region : 'not solved'} here, and the hybrid-π describes the active region.`
/** The footnote a knob-side row carries once the input is somewhere other than zero. */
const driven = (p) => (p.vin === 0 ? null : 'The input is not at zero here, so the current carries the signal as well as the bias.')

/**
 * The footnote a port row carries once r_π is no longer small beside r_μ.
 *
 * The model keeps a base-collector resistance of a teraohm, which is nothing
 * beside a two-kilohm r_π and everything beside the thirty gigohms a β of
 * fifty thousand asks for. At the port the two are in parallel.
 */
const nearRmu = (pt) =>
  pt && Number.isFinite(pt.rmu) && pt.rpi > 1e-3 * pt.rmu
    ? 'β is large enough here that r_π is comparable with the base-collector resistance the model carries, and the port sees the two in parallel.'
    : null

const offSat = (pt) => (pt && pt.region === 'saturation' ? null : `The MOSFET is ${pt ? pt.region : 'not solved'} here, and this formula is the square law in saturation.`)

/**
 * The hybrid-π solved by hand for a common emitter with an emitter resistance,
 * one volt held at the base. Two nodes and two currents, so it is three lines
 * of algebra, and it is exact rather than the textbook's 1 + g_m R_E form: at a
 * large β or a small Early voltage the two differ by several per cent, and the
 * panel would then be checking one approximation against a different one.
 */
function ceTangent({ gm, rpi, ro }, RC, RE) {
  const a = 1 / rpi + gm
  const re = RE > 0 ? RE : 1e-12
  const go = Number.isFinite(ro) ? 1 / ro : 0
  // v_c in terms of v_e, then v_e from the emitter node.
  const k = (gm + go) / (1 / RC + go)
  const c0 = -gm / (1 / RC + go)
  const ve = (a + c0 * go) / (a + go + 1 / re - k * go)
  const vc = k * ve + c0
  return { av: vc, rin: rpi / (1 - ve) }
}

export const MATH_H = {
  h1(p, x) {
    const q = x.point.Q1
    const av = -q.gm * par(p.RC, q.ro)
    return {
      blocks: [
        T('The collector current is an exponential of the base-emitter voltage. Its slope there is the transconductance, and the gain is that slope times what the collector sees.'),
        F('g_m = \\frac{I_C}{V_T}, \\qquad A_v = -g_m (R_C \\parallel r_o), \\qquad R_{in} = r_\\pi'),
        C([
          row('the current the bias asks for', p.ic, q.ic, 'A', 5e-3, { unchecked: offRegion(q) || driven(p) }),
          row('the transconductance I_C/V_T', p.ic / VT, q.gm, 'A/V', 5e-3, { unchecked: offRegion(q) || driven(p) }),
          row('the gain −g_m(R_C ∥ r_o)', av, x.gain, '', 5e-3, { unchecked: x.tf ? offRegion(q) : 'This setting has no small-signal transfer function.' }),
          row('the input resistance by test source', q.rpi, portR(x, 'b', ['Vs']), 'Ω', 5e-3, { unchecked: offRegion(q) || nearRmu(q) }),
          row('the output resistance by test source', par(p.RC, q.ro), portR(x, 'c'), 'Ω', 5e-3, { unchecked: offRegion(q) }),
        ]),
        V([
          { label: 'the operating point’s collector voltage', value: q.vce, unit: 'V', note: 'what is left of the supply after R_C' },
          { label: 'the transistor’s own output resistance', value: q.ro, unit: 'Ω', note: '(V_A + V_CE)/I_C, which is where the Early effect enters the tangent' },
        ]),
      ],
    }
  },

  h2(p, x) {
    const q = x.point.Q1
    const hand = ceTangent(q, p.RC, p.RE)
    return {
      blocks: [
        T('The emitter resistor takes back part of the input before it reaches the junction. Everything about the stage moves by the same factor.'),
        F('1 + g_m R_E, \\qquad R_{in} = r_\\pi + (\\beta + 1) R_E'),
        C([
          row('the current the bias asks for', p.ic, q.ic, 'A', 5e-3, { unchecked: offRegion(q) || driven(p) }),
          row('the input resistance the hybrid-π gives', hand.rin, portR(x, 'b', ['Vs']), 'Ω', 5e-3, { unchecked: offRegion(q) || nearRmu(q) }),
          row('the gain the hybrid-π gives', hand.av, x.gain, '', 5e-3, { unchecked: x.tf ? offRegion(q) : 'This setting has no small-signal transfer function.' }),
        ]),
        V([
          { label: 'the degeneration factor 1 + g_m R_E', value: 1 + q.gm * p.RE, unit: '', note: 'the gain falls by it and the input resistance rises by it' },
          { label: 'the textbook’s r_π + (β + 1)R_E', value: q.rpi + (p.beta + 1) * p.RE, unit: 'Ω', note: 'the same input resistance with r_o dropped' },
          { label: 'the gain without the resistor', value: -q.gm * par(p.RC, q.ro), unit: '', note: 'what the same stage gives with the emitter grounded' },
        ]),
      ],
    }
  },

  h3(p, x) {
    const q = x.point.Q1
    const rl = par(p.RL, q.ro)
    const ge = q.gm + 1 / q.rpi
    return {
      blocks: [
        T('The emitter follows the base within a drop, so almost the whole signal appears across the load. What the two ends of the stage look like is where the interest is.'),
        F('A_v = \\frac{g_m R_L\'}{1 + g_m R_L\'}, \\qquad R_{in} = r_\\pi + (1 + g_m r_\\pi) R_L\', \\qquad R_{out} = \\frac{R_s + r_\\pi}{1 + g_m r_\\pi} \\parallel r_o'),
        C([
          row('the follower’s own gain', (ge * rl) / (1 + ge * rl), gainFrom(x, 'b', 'out', ['Vs', 'Rs']), '', 5e-3, { unchecked: offRegion(q) }),
          row('the input resistance at the base', q.rpi + (1 + q.gm * q.rpi) * rl, portR(x, 'b', ['Rs']), 'Ω', 5e-3, { unchecked: offRegion(q) || nearRmu(q) }),
          row('the output resistance at the emitter', par((p.Rs + q.rpi) / (1 + q.gm * q.rpi), q.ro), portR(x, 'out', ['RL']), 'Ω', 5e-3, { unchecked: offRegion(q) || nearRmu(q) }),
        ]),
        V([{ label: '1/g_m, the floor under the output resistance', value: 1 / q.gm, unit: 'Ω', note: 'what is left when the source resistance is nothing' }]),
      ],
    }
  },

  h4(p, x) {
    const q = x.point.Q1
    return {
      blocks: [
        T('The signal drives the emitter, which is inside the junction, so the port is low. The collector delivers the same current into R_C, and nothing is inverted.'),
        F('A_v(\\text{emitter}) = g_m (R_C \\parallel r_o), \\qquad R_{in} \\approx 1/g_m, \\qquad \\alpha = \\frac{\\beta}{\\beta + 1}'),
        C([
          row('the current the bias asks for', p.ic, q.ic, 'A', 5e-3, { unchecked: offRegion(q) || driven(p) }),
          row('the gain measured at the emitter', q.gm * par(p.RC, q.ro), gainFrom(x, 'e', 'c', ['Rs', 'Vs']), '', 5e-3, { unchecked: offRegion(q) }),
        ]),
        V([
          { label: '1/g_m, the resistance the emitter port is near', value: 1 / q.gm, unit: 'Ω', note: 'the measured port also carries a little of R_C back through r_o' },
          { label: 'the emitter port by test source', value: portR(x, 'e', ['Rs']), unit: 'Ω' },
          { label: 'the current gain α', value: p.beta / (p.beta + 1), unit: '', note: 'the fraction of the emitter current that reaches the collector' },
        ]),
      ],
    }
  },

  h5(p, x) {
    const m = x.point.M1
    // The gate is driven straight from the bias source, so the overdrive on
    // screen is the knob's plus whatever the input is set to.
    const vov = p.vov + p.vin
    return {
      blocks: [
        T('The square law sets the current from the overdrive, and its slope there is the transconductance. From that point on the stage is the common emitter again.'),
        F('I_D = \\tfrac{1}{2} k_n V_{OV}^2 (1 + \\lambda v_{DS}), \\qquad g_m = k_n V_{OV}, \\qquad A_v = -g_m (R_D \\parallel r_o)'),
        C([
          row('the drain current', 0.5 * p.kn * vov * vov * (1 + p.lambda * m.vds), m.id_, 'A', 5e-3, { unchecked: offSat(m) }),
          row('the transconductance k_n V_OV', p.kn * vov * (1 + p.lambda * m.vds), m.gm, 'A/V', 5e-3, { unchecked: offSat(m) }),
          row('the gain −g_m(R_D ∥ r_o)', -m.gm * par(p.RD, m.ro), x.gain, '', 5e-3, { unchecked: x.tf ? offSat(m) : 'This setting has no small-signal transfer function.' }),
        ]),
        V([
          { label: 'the drain voltage the current leaves', value: m.vds, unit: 'V' },
          { label: 'r_o from channel-length modulation', value: m.ro, unit: 'Ω', note: '1/(λ I_D) at the flat-band current' },
        ]),
      ],
    }
  },

  h6(p, x) {
    const m = x.point.M1
    const rl = par(p.RL, m.ro)
    return {
      blocks: [
        T('The source follows the gate within a threshold and an overdrive. The resistance at the source is 1/g_m, whether the port is being driven or being loaded.'),
        F('A_v = \\frac{g_m R_L\'}{1 + g_m R_L\'}, \\qquad R_{source} = \\frac{1}{g_m} \\parallel r_o'),
        C([
          row('the follower’s gain', (m.gm * rl) / (1 + m.gm * rl), x.gain, '', 5e-3, { unchecked: x.tf ? offSat(m) : 'This setting has no small-signal transfer function.' }),
          row('the resistance at the source', par(1 / m.gm, m.ro), portR(x, 'out', ['RL']), 'Ω', 5e-3, { unchecked: offSat(m) }),
        ]),
        V([{ label: '1/g_m on its own', value: 1 / m.gm, unit: 'Ω', note: 'the same port a common gate would be driven at' }]),
      ],
    }
  },

  h7(p, x) {
    const q = x.point.Q1
    const clipped = x.tr && x.tr.events.length > 0
    const hi = x.tr ? Math.max(...x.tr.samples.map((s) => s.sol.v.c)) : NaN
    const lo = x.tr ? Math.min(...x.tr.samples.map((s) => s.sol.v.c)) : NaN
    const notClipping = 'The drive is small enough that the stage stays in its active region, so neither end of the load line is reached.'
    // The two ends are only what the trace reports while the trace is on the
    // load line. A large β into a large R_C asks the active piece for a
    // collector current the supply cannot deliver, and the walk then leaves
    // the range the line covers.
    const onLine = x.tr && hi <= VCC + 1e-6 && lo >= -1e-6
    const offLine = onLine ? null : 'The walk went outside what the supply allows at this setting, so what the trace reports is not the load line’s two ends.'
    return {
      blocks: [
        T('On the three-region model the base current is what R_B lets through, and the collector current is β times it. The two ends of the load line are the supply and the saturation voltage.'),
        F('i_B = \\frac{V_{BB} - V_{BE(on)}}{R_B}, \\qquad A_v = -\\frac{\\beta R_C}{R_B}, \\qquad v_{out} \\in [V_{CE(sat)},\\, V_{CC}]'),
        C([
          row('the quiescent collector current', p.ic + (p.beta * p.vin) / p.RB, q.ic, 'A', 5e-3, { unchecked: offRegion(q) }),
          row('the top of the swing, V_CC', VCC, hi, 'V', 1e-6, { unchecked: offLine || (clipped ? null : notClipping) }),
          row('the bottom of the swing, V_CE(sat)', BJT_DEFAULTS.vcesat, lo, 'V', 1e-6, { unchecked: offLine || (clipped ? null : notClipping) }),
        ]),
        V([
          { label: 'the gain this model gives', value: (-p.beta * p.RC) / p.RB, unit: '', note: 'v_BE is pinned, so R_B alone sets the base current' },
          { label: 'how many region changes the walk recorded', value: x.tr ? x.tr.events.length : NaN, unit: '', note: clipped ? 'two per half cycle at each end it reaches' : 'none: the stage never leaves its active region' },
        ]),
      ],
    }
  },
}
