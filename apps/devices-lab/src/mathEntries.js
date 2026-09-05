// The math panel, per experiment: the formula behind the number on screen, and
// a second route to it checked against the first.
//
// The discipline is `packages/explain`'s. A check row appears only when its
// measured side is genuinely read from something the panes are showing, and a
// closed form the current settings cannot see is footnoted rather than crossed
// out. Every predicted side is written from the knobs, so turning a knob moves
// both columns.
//
// Where a row would print one expression twice it is marked `unchecked` with
// the reason, because a tick that carries no information teaches a reader to
// discount the ones that do.

import { EPS_OX, EPS_SI, N_I_300, Q_E, earlyVoltage, niAt, thermalVoltage } from '@ee-labs/network'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.02, extra = {}) => ({ label, predicted, measured, unit, tol, ...extra })

const HC = 6.62607015e-34 * 299792458

/** The three rows every bulk experiment shows, because they are what it is. */
const bulkRows = (p, x) => {
  const c = x.carrier
  return [
    row('n p against n_i²', c.ni * c.ni, c.n * c.p, 'm⁻⁶', 1e-9),
    row('n − p against the net doping', (p.nd ?? 0) - (p.na ?? 0), c.n - c.p, 'm⁻³', 1e-6, {
      abs: 2 * c.ni,
    }),
  ]
}

export const ENTRIES = {
  a1(p, x) {
    return {
      blocks: [
        T('Doping fixes the difference between the two carrier concentrations. The law of mass action fixes their product. Two equations, two unknowns, and one positive root.'),
        F('n - p = N_D - N_A, \\qquad n\\,p = n_i^2'),
        C(bulkRows(p, x)),
        V([{ label: 'minority carriers', value: x.carrier.minority, unit: 'm⁻³', note: 'what crosses a junction' }]),
      ],
    }
  },

  a2(p, x) {
    const c = x.carrier
    const vt = thermalVoltage(p.T ?? 300)
    return {
      blocks: [
        T('The intrinsic concentration follows from the band-edge densities and the gap. Read the same law backwards and a stated concentration implies a gap.'),
        F('n_i = \\sqrt{N_c N_v}\\,e^{-E_g/2kT}'),
        C([
          // The round trip: the gap the suite's constant implies, put back
          // through the law, has to return that constant.
          row('the gap the suite’s n_i implies, put back', N_I_300, Math.sqrt(p.nc * p.nv) * Math.exp(-c.gapImplied / (2 * vt)), 'm⁻³', 1e-6),
          ...bulkRows(p, x),
        ]),
        V([
          { label: 'ratio between the two values', value: c.niRatio, unit: '', note: 'which book a number came from' },
          { label: 'gap the suite’s constant implies', value: c.gapImplied, unit: 'eV', note: 'against the 1.12 eV the pane draws' },
        ]),
      ],
    }
  },

  a3(p, x) {
    const c = x.carrier
    return {
      blocks: [
        T('The intrinsic pairs climb as T to the three halves times an exponential of the gap over kT. The exponential wins over any range a circuit lives in.'),
        F('n_i(T) \\propto T^{3/2} e^{-E_g/2kT}'),
        C([
          ...bulkRows(p, x),
          row('n against the doping, while the sample is extrinsic', Math.abs(p.nd - p.na), c.majority, 'm⁻³', 1e-3, {
            unchecked:
              Math.abs(c.net) > 1e3 * c.ni
                ? null
                : 'The intrinsic pairs are within a thousandth of the dopants here, so the doping no longer sets the majority carriers on its own.',
          }),
        ]),
        V([{ label: 'goes intrinsic above', value: c.intrinsicT, unit: 'K', note: 'where pair production catches the dopants' }]),
      ],
    }
  },

  a4(p, x) {
    const c = x.carrier
    const vt = thermalVoltage(p.T ?? 300)
    return {
      blocks: [
        T('The Fermi level’s height above the intrinsic level is a logarithm of the electron concentration. One decade of doping is one kT ln 10.'),
        F('E_F - E_i = \\frac{kT}{q}\\ln\\frac{n}{n_i}'),
        C([
          row('the level, from the concentrations on screen', vt * Math.log(c.n / c.ni), c.efi, 'V', 1e-9),
          ...bulkRows(p, x),
        ]),
        V([{ label: 'one decade of doping', value: vt * Math.LN10, unit: 'V', note: 'the same step a decade of diode current costs' }]),
      ],
    }
  },

  a5(p, x) {
    const c = x.carrier
    return {
      blocks: [
        T('Four energies against position. The two edges are properties of the crystal, and only the Fermi level moves when the doping moves.'),
        F('E_c - E_v = E_g, \\qquad E_c - E_F = \\frac{E_g}{2} - (E_F - E_i)'),
        C([
          row('the two gaps the diagram draws, added', p.eg, c.barrier + (c.ef - c.ev), 'eV', 1e-9),
          ...bulkRows(p, x),
        ]),
        V([{ label: 'distance to the conduction edge', value: c.barrier, unit: 'V', note: 'what an electron has to find' }]),
      ],
    }
  },

  b1(p, x) {
    const j = x.j
    return {
      blocks: [
        T('Inside the region the mobile carriers have gone and the dopant charge stays. The two sides expose the same charge, so the lighter side gives the wider part.'),
        F('N_A x_p = N_D x_n, \\qquad x_p + x_n = W'),
        C([
          row('the two exposed charges', p.na * j.xp, p.nd * j.xn, 'm⁻²', 1e-6),
          row('the two parts against the whole', j.w, j.xp + j.xn, 'm', 1e-9),
        ]),
        V([{ label: 'the model’s error at the edges', value: j.modelError, unit: '', note: 'the two carrier tails against the width' }]),
      ],
    }
  },

  b2(p, x) {
    const j = x.j
    return {
      blocks: [
        T('Poisson’s equation integrated once over a step charge gives a triangle. Its peak can be written from the charge or from the area, and both are on screen.'),
        F('E_{max} = \\frac{q N_A x_p}{\\varepsilon_s} = \\frac{2 V_j}{W}'),
        C([
          row('the peak, both ways', (Q_E * p.na * j.xp) / EPS_SI, (2 * j.vj) / j.w, 'V/m', 1e-6),
          row('the field at the p-side edge', 0, j.field(-j.xp), 'V/m', 1e-9, { abs: 1e-6 * j.emax }),
          row('the field at the n-side edge', 0, j.field(j.xn), 'V/m', 1e-9, { abs: 1e-6 * j.emax }),
        ]),
      ],
    }
  },

  b3(p, x) {
    const j = x.j
    const w0 = Math.sqrt(((2 * EPS_SI * j.v0) / Q_E) * (1 / p.na + 1 / p.nd))
    return {
      blocks: [
        T('Integrating again gives two parabolas that meet. The whole climb is the barrier the doping built, less whatever the bias has taken off it.'),
        F('V_0 = \\frac{kT}{q}\\ln\\frac{N_A N_D}{n_i^2}, \\qquad W \\propto \\sqrt{V_0 - v}'),
        C([
          row('the width against the square-root law', w0 * Math.sqrt(j.vj / j.v0), j.w, 'm', 1e-9),
          row('the potential across the whole region', j.vj, j.potential(j.xn) - j.potential(-j.xp), 'V', 1e-9),
        ]),
        V([{ label: 'barrier at zero bias', value: j.v0, unit: 'V', note: 'from the doping alone' }]),
      ],
    }
  },

  b4(p, x) {
    const j = x.j
    const vt = thermalVoltage(p.T ?? 300)
    return {
      blocks: [
        T('The saturation current is one term for each side. Each carries a diffusion constant from Einstein’s relation and a diffusion length from the lifetime.'),
        F('I_S = qA n_i^2\\left(\\frac{D_p}{L_p N_D} + \\frac{D_n}{L_n N_A}\\right), \\quad D = \\frac{kT}{q}\\mu, \\quad L = \\sqrt{D\\tau}'),
        C([
          row('the hole diffusion constant', vt * p.mup, j.dp, 'm²/s', 1e-9),
          row('the hole diffusion length', Math.sqrt(j.dp * p.taup), j.lp, 'm', 1e-9),
          row('the voltage the law needs at 1 mA', vt * Math.log(1e-3 / j.is), j.vAt1mA, 'V', 1e-9),
        ]),
        V([{ label: 'one decade of current', value: j.decade, unit: 'V', note: 'the same kT ln 10 again' }]),
      ],
    }
  },

  b5(p, x) {
    const j = x.j
    return {
      blocks: [
        T('The capacitance is the slope of the stored depletion charge against the bias. Written from the width it is one expression, and written as a law it is another.'),
        F('C_j = \\frac{\\varepsilon_s}{W} = \\frac{C_{j0}}{\\sqrt{1 - v/V_0}}'),
        C([
          row('the capacitance, both ways', j.byArea, j.byLaw, 'F/m²', 1e-9),
          row('the charge one side exposes, differentiated', j.byArea, chargeSlope(p, j), 'F/m²', 1e-4),
        ]),
        V([{ label: 'the whole junction', value: j.cjTotal, unit: 'F', note: 'the area times the value per unit area' }]),
      ],
    }
  },

  b6(p, x) {
    const j = x.j
    return {
      blocks: [
        T('The rating is the peak field reaching a number the material sets. Read the profile back at the bias the rating names and the peak is that field again.'),
        F('V_j = \\frac{\\varepsilon_s E_{crit}^2}{2q}\\left(\\frac{1}{N_A} + \\frac{1}{N_D}\\right)'),
        C([
          row('the rating, from the peak field', (EPS_SI * j.ecrit * j.ecrit * (1 / p.na + 1 / p.nd)) / (2 * Q_E), j.vbr, 'V', 1e-6),
          row('the applied bias it corresponds to', j.v0 - j.vbr, j.vbrApplied, 'V', 1e-9),
        ]),
        V([
          { label: 'peak field at the bias set', value: j.emax, unit: 'V/m', note: 'against the critical field on the knob' },
          { label: 'mechanism', value: j.mechanism === 'tunnelling' ? 1 : 0, unit: '', note: j.mechanism },
        ]),
      ],
    }
  },

  c1(p, x) {
    const m = x.mos
    return {
      blocks: [
        T('The oxide is an insulator of a fixed thickness, so its capacitance per unit area is one division. Every charge the semiconductor holds is divided by it.'),
        F('C_{ox} = \\frac{\\varepsilon_{ox}}{t_{ox}}'),
        C([
          row('the oxide capacitance times its thickness', EPS_OX, m.cox * p.tox, 'F/m', 1e-9),
          row('the charge a volt on the gate puts there', m.cox, m.gateCharge, 'C/m²', 1e-9),
        ]),
      ],
    }
  },

  c2(p, x) {
    const m = x.mos
    const back = m.regime === 'depletion' ? m.vfb + m.psi + Math.sqrt(2 * Q_E * EPS_SI * p.na * m.psi) / m.cox : NaN
    return {
      blocks: [
        T('The gate voltage divides between the oxide and the bending at the surface. Where the bending has reached twice the bulk potential, the depletion layer stops.'),
        F('V_G = V_{FB} + \\psi_s + \\frac{\\sqrt{2q\\varepsilon_s N_A \\psi_s}}{C_{ox}}, \\qquad W_{max} = \\sqrt{\\frac{4\\varepsilon_s\\varphi_F}{qN_A}}'),
        C([
          row('the gate voltage the surface potential implies', p.vg, back, 'V', 1e-6, {
            unchecked: m.regime === 'depletion' ? null : `The surface is in ${m.regime} here, where the divider is not what sets the bending.`,
          }),
          row('the width at twice the bulk potential', m.wmax, Math.sqrt((2 * EPS_SI * 2 * m.phiF) / (Q_E * p.na)), 'm', 1e-9),
        ]),
        V([{ label: 'surface potential', value: m.psi, unit: 'V', note: 'the one number the three regimes are conditions on' }]),
      ],
    }
  },

  c3(p, x) {
    const m = x.mos
    return {
      blocks: [
        T('The floor is the oxide in series with the widest the depletion layer ever gets. That width is set by the substrate doping, so the ratio reads it back.'),
        F('C_{min} = \\frac{C_{ox}C_{dmin}}{C_{ox} + C_{dmin}}, \\qquad C_{dmin} = \\frac{\\varepsilon_s}{W_{max}}'),
        C([
          row('the floor, from the series pair', (m.cox * m.cdmin) / (m.cox + m.cdmin), m.cmin, 'F/m²', 1e-9),
          row('the doping the ratio reads back', p.na, m.dopingRead, 'm⁻³', 1e-3),
        ]),
        V([{ label: 'C_min over C_ox', value: m.ratio, unit: '', note: 'one sweep, and the substrate doping falls out' }]),
      ],
    }
  },

  c4(p, x) {
    const m = x.mos
    return {
      blocks: [
        T('In inversion the two frequencies part company, because the inversion charge can only follow a signal slower than the generation rate. Outside inversion they are one curve.'),
        F('C_{hf} \\to C_{min}, \\qquad C_{lf} \\to C_{ox}'),
        C([
          row('the factor between the two, in inversion', m.inversionFactor, m.cLow / m.cHigh, '', 1e-9, {
            unchecked: m.regime === 'inversion' ? null : `The gate is in ${m.regime} here, where the two curves are the same curve.`,
          }),
          row('the two curves outside inversion', m.cHigh, m.cLow, 'F/m²', 1e-12, {
            unchecked: m.regime === 'inversion' ? 'Inversion is where they part company, so this row has nothing to compare.' : null,
          }),
        ]),
      ],
    }
  },

  c5(p, x) {
    const m = x.mos
    return {
      blocks: [
        T('The threshold is four terms added up, and a process controls each one. The gate material, the substrate doping, the oxide thickness, and one implanted dose.'),
        F('V_T = V_{FB} + 2\\varphi_F + \\frac{Q_{dep}}{C_{ox}} + \\frac{qN_{implant}}{C_{ox}}'),
        C([
          row('the four terms, added', m.vfb + 2 * m.phiF + m.depTerm + m.implantTerm, m.vt, 'V', 1e-9),
          row('what the implant is worth', (Q_E * p.implant) / m.cox, m.implantTerm, 'V', 1e-9),
          row('what the oxide charge is worth', (Q_E * p.qf) / m.cox, m.oxideShift, 'V', 1e-9),
        ]),
        V([{ label: 'depletion charge at threshold', value: m.qdep, unit: 'C/m²', note: 'q N_A W_max' }]),
      ],
    }
  },

  d1(p, x) {
    const f = x.fet
    const m = x.mos
    return {
      blocks: [
        T('Above the threshold every further volt on the gate puts C_ox of charge into the channel. That product carries the rest of this group.'),
        F('Q_n = C_{ox}(V_{GS} - V_T), \\qquad I_D = \\tfrac{1}{2}k_n V_{OV}^2'),
        C([
          row('the channel charge', f.vov > 0 ? m.cox * f.vov : 0, f.charge, 'C/m²', 1e-9),
          row('the current, closed form against the integral', f.id, f.integral, 'A', 1e-6, {
            abs: 1e-18,
            unchecked: f.vov > 0 ? null : 'The gate is below the threshold here, so there is no channel to integrate along.',
          }),
        ]),
        V([{ label: 'overdrive', value: f.vov, unit: 'V', note: 'what every current in this group is written in' }]),
      ],
    }
  },

  d2(p, x) {
    const f = x.fet
    return {
      blocks: [
        T('The charge falls along the channel because the channel rises toward the drain. Integrating what is left gives the closed form, and the pane runs both routes.'),
        F('I_D = k_n\\left[V_{OV}V_{DS} - \\frac{V_{DS}^2}{2}\\right]'),
        C([
          row('the current, closed form against the integral', f.id, f.integral, 'A', 1e-6, {
            abs: 1e-18,
            unchecked: f.vov > 0 ? null : 'The gate is below the threshold here, so there is no channel to integrate along.',
          }),
          row('the transconductance parameter', p.mun * x.mos.cox * p.wOverL, f.kn, 'A/V²', 1e-9),
        ]),
        V([{ label: 'region', value: f.region === 'triode' ? 1 : 0, unit: '', note: f.region }]),
      ],
    }
  },

  d3(p, x) {
    const f = x.fet
    return {
      blocks: [
        T('At a drain voltage equal to the overdrive the two expressions meet, in value and in slope. Past it the current holds, unless channel-length modulation is turned on.'),
        F('I_{D,sat} = \\tfrac{1}{2}k_n V_{OV}^2 (1 + \\lambda(V_{DS} - V_{OV}))'),
        C([
          row('the triode form at the boundary', f.vov > 0 ? f.kn * (f.vov * f.vov - (f.vov * f.vov) / 2) : 0, f.saturation, 'A', 1e-9, { abs: 1e-18 }),
          row('the output resistance', p.lambda > 0 && f.region === 'saturation' ? 1 / (p.lambda * f.saturation) : Infinity, f.ro, 'Ω', 1e-6, {
            unchecked: p.lambda > 0 && f.region === 'saturation' ? null : 'With λ at zero, or outside saturation, the curve is flat and r_o has no finite value.',
          }),
        ]),
        V([{ label: 'the boundary', value: f.boundary, unit: 'V', note: 'where the channel reaches zero at the drain' }]),
      ],
    }
  },

  d4(p, x) {
    const f = x.fet
    return {
      blocks: [
        T('The transconductance is the derivative of the current against the gate voltage, and the pane takes it both ways. The body bias moves the threshold it is measured around.'),
        F('g_m = k_n V_{OV} = \\frac{2I_D}{V_{OV}}, \\qquad \\Delta V_T = \\gamma\\left(\\sqrt{2\\varphi_F + V_{SB}} - \\sqrt{2\\varphi_F}\\right)'),
        C([
          row('the closed form against a finite difference', f.gm, f.gmMeasured, 'A/V', 1e-5, { abs: 1e-15 }),
          row('the threshold shift the body bias buys', f.gamma * (Math.sqrt(2 * x.mos.phiF + f.vsb) - Math.sqrt(2 * x.mos.phiF)), f.shift, 'V', 1e-9),
        ]),
        V([{ label: 'g_m over I_D', value: f.id > 0 ? f.gm / f.id : 0, unit: '', note: 'what a designer trades current for' }]),
      ],
    }
  },

  d5(p, x) {
    const f = x.fet
    return {
      blocks: [
        T('The square law stops at both ends. Below the threshold the current is exponential, and above it the carriers reach a speed the crystal will not exceed.'),
        F('S = \\frac{kT}{q}\\ln 10\\left(1 + \\frac{C_{dmin}}{C_{ox}}\\right), \\qquad V_{OV,sat} = E_{sat}L'),
        C([
          row('the swing', thermalVoltage(p.T ?? 300) * Math.LN10 * (1 + x.mos.cdmin / x.mos.cox), f.swing, 'V', 1e-9),
          row('the gate the stated fall costs', f.decades * f.swing, f.dv, 'V', 1e-9, { abs: 1e-12 }),
          row('the overdrive velocity saturation takes', 2e6 * p.length, f.vsat, 'V', 1e-9),
        ]),
        V([{ label: 'decades to the off current', value: f.decades, unit: '', note: 'from the current on screen to the floor on the knob' }]),
      ],
    }
  },

  e1(p, x) {
    const b = x.bjt
    return {
      blocks: [
        T('Both junctions eat into the base. What is left between them is the neutral base, and it is the only part that carries the diffusing charge.'),
        F('W_{B,neutral} = W_B - x_p, \\qquad x_p = W\\frac{N_C}{N_B + N_C}'),
        C([
          row('what the collector took, plus what is left', p.wb, b.intoBase + b.neutralBase, 'm', 1e-9),
          row('the fraction taken', b.intoBase / p.wb, b.taken, '', 1e-9),
        ]),
        V([{ label: 'the whole collector depletion region', value: b.w, unit: 'm', note: 'most of it is on the lightly doped side' }]),
      ],
    }
  },

  e2(p, x) {
    const b = x.bjt
    const vt = thermalVoltage(p.T ?? 300)
    return {
      blocks: [
        T('A doping times a thickness is a Gummel number. The base’s divides the saturation current, and the ratio of the two sets the current gain.'),
        F('I_S = \\frac{qA n_i^2 D_B}{N_B W_B}, \\qquad \\beta = \\frac{D_B N_E W_E}{D_E N_B W_B}'),
        C([
          row('the saturation current, from the base Gummel number', (Q_E * p.area * niAt(p.T ?? 300) ** 2 * p.db) / b.gummelBase, b.is, 'A', 1e-9),
          row('the current the stated V_BE gives back', p.ic, b.is * (Math.exp(b.vbe / vt) - 1), 'A', 1e-6),
          row('α from β', b.beta / (b.beta + 1), b.alpha, '', 1e-12),
        ]),
        V([{ label: 'base Gummel number', value: b.gummelBase, unit: 'm⁻²', note: 'dopant atoms per unit area to cross' }]),
      ],
    }
  },

  e3(p, x) {
    const b = x.bjt
    return {
      blocks: [
        T('Crossing the base by diffusion takes a time that goes as the square of the distance. That time caps the transition frequency, whatever the bias does.'),
        F('\\tau_B = \\frac{W_B^2}{2D_B}, \\qquad f_T \\le \\frac{1}{2\\pi\\tau_B}'),
        C([
          row('the transit time', (p.wb * p.wb) / (2 * p.db), b.tauB, 's', 1e-9),
          row('the ceiling times the transit time', 1 / (2 * Math.PI), b.ftLimit * b.tauB, '', 1e-12),
        ]),
        V([{ label: 'the ceiling', value: b.ftLimit, unit: 'Hz', note: 'set by the process, not by the bias' }]),
      ],
    }
  },

  e4(p, x) {
    const b = x.bjt
    // The rate the edge moves at, measured as a difference of the profile
    // rather than restated from the closed form beside it.
    const h = Math.max(1e-4, 1e-4 * (p.vcb || 1))
    const edge = (v) => earlyVoltage({ nb: p.nb, wb: p.wb, nc: p.nc, T: p.T ?? 300 }, v).intoBase
    const measured = (edge(p.vcb + h) - edge(Math.max(p.vcb - h, 0))) / (p.vcb + h - Math.max(p.vcb - h, 0))
    return {
      blocks: [
        T('The collector junction’s edge moves into the base as the bias rises, so the base thins and the current climbs. The base thickness over that rate is the Early voltage.'),
        F('\\frac{dx_p}{dV} = \\frac{x_p}{2V_j}, \\qquad V_A = \\frac{W_B}{dx_p/dV}'),
        C([
          row('the rate, closed form against a difference', b.rate, measured, 'm/V', 5e-3),
          row('the Early voltage', p.wb / b.rate, b.va, 'V', 1e-9),
        ]),
        V([{ label: 'the edge, at this bias', value: b.intoBase, unit: 'm', note: 'measured from the metallurgical boundary' }]),
      ],
    }
  },

  f1(p, x) {
    const c = x.pv
    return {
      blocks: [
        T('The photocurrent shifts Shockley’s law down. Where the shifted curve crosses zero current is the open-circuit voltage, and that is a logarithm of the light.'),
        F('I = I_L - I_S\\left(e^{V/V_T} - 1\\right), \\qquad V_{oc} = V_T\\ln\\left(\\frac{I_L}{I_S} + 1\\right)'),
        C([
          row('the current at the open-circuit voltage', 0, c.current(c.voc), 'A', 1e-9, { abs: 1e-9 * c.isc + 1e-18 }),
          row('the current at zero volts', c.isc, c.current(0), 'A', 1e-9),
        ]),
        V([{ label: 'one decade of light', value: c.vt * Math.LN10, unit: 'V', note: 'what concentrating the sun buys in voltage' }]),
      ],
    }
  },

  f2(p, x) {
    const c = x.pv
    return {
      blocks: [
        T('Power peaks between the two corners, and the peak has no closed form. It is a root-find on the derivative, and the fill factor says how much of the rectangle the curve fills.'),
        F('\\frac{dP}{dV} = 0, \\qquad FF = \\frac{P_{max}}{V_{oc}I_{sc}}'),
        C([
          row('the slope at the maximum power point', 0, c.slope(c.vmp), 'A', 1e-9, { abs: 1e-9 * c.isc + 1e-18 }),
          row('the power there, against the fill factor', c.ff * c.voc * c.isc, c.pmax, 'W', 1e-9),
          row('the empirical fill factor', c.ff, c.ffEmpirical, '', 5e-3, {
            unchecked:
              c.voc / c.vt > 10
                ? null
                : `Green’s form is fitted above a normalised open-circuit voltage of ten, and this cell is at ${(c.voc / c.vt).toPrecision(3)}.`,
          }),
        ]),
        V([
          { label: 'the empirical form’s error', value: c.ffError, unit: '', note: 'printed rather than hidden inside a tick' },
          { label: 'efficiency', value: c.efficiency, unit: '', note: 'against the light falling on the area' },
        ]),
      ],
    }
  },

  f3(p, x) {
    const l = x.led
    const c = x.pv
    return {
      blocks: [
        T('Run the junction forward and the photon carries the gap away. The wavelength is fixed by the gap alone, and the forward voltage cannot fall below it.'),
        F('\\lambda = \\frac{hc}{E_g}, \\qquad V_f \\ge \\frac{E_g}{q}'),
        C([
          row('the wavelength times the photon energy', HC, l.wavelength * l.photonEnergy, 'J·m', 1e-12),
          row('the photon energy against the gap', l.eg * Q_E, l.photonEnergy, 'J', 1e-12),
          row('what a series ohm costs at the maximum power point', c.imp * p.rs, c.seriesLoss, 'V', 1e-9, { abs: 1e-15 }),
        ]),
        V([{ label: 'forward-voltage floor', value: l.vf, unit: 'V', note: 'why a blue lamp needs three volts' }]),
      ],
    }
  },

  g1(p, x) {
    const f = x.fab
    return {
      blocks: [
        T('The implant fires a dose and the drive-in spreads it over a depth. Those two divide to give the doping every earlier group turned as a knob.'),
        F('N_A = \\frac{\\text{dose}}{\\text{depth}}, \\qquad V_0 = \\frac{kT}{q}\\ln\\frac{N_A N_D}{n_i^2}'),
        C([
          row('the dose, from the doping and the depth', p.dose, f.doping * p.depth, 'm⁻²', 1e-9),
          row('the barrier the two dopings give', x.j.v0, f.v0, 'V', 1e-9),
        ]),
        V([{ label: 'the doping this step sets', value: f.doping, unit: 'm⁻³', note: 'the knob Group B opened with' }]),
      ],
    }
  },

  g2(p, x) {
    const f = x.fab
    return {
      blocks: [
        T('Three steps and three numbers. The oxide sets C_ox, the substrate implant sets the doping, and the threshold implant lands the device on the voltage a design was drawn against.'),
        F('C_{ox} = \\frac{\\varepsilon_{ox}}{t_{ox}}, \\qquad \\Delta V_T = \\frac{qN_{implant}}{C_{ox}}'),
        C([
          row('the oxide capacitance times its thickness', EPS_OX, f.cox * p.tox, 'F/m', 1e-9),
          row('what the threshold implant is worth', (Q_E * p.implant) / f.cox, x.mos.implantTerm, 'V', 1e-9),
          row('the current the finished device passes', x.fet.id, f.id, 'A', 1e-12, { abs: 1e-18 }),
        ]),
        V([{ label: 'the threshold this sequence produces', value: f.vt, unit: 'V', note: 'the fact an electronics course is handed' }]),
      ],
    }
  },
}

/** The depletion charge one side exposes, differentiated against the bias. */
function chargeSlope(p, j) {
  const h = Math.max(1e-6, Math.abs(j.vj) * 1e-6)
  const at = (v) => {
    const w = Math.sqrt(((2 * EPS_SI * (j.v0 - v)) / Q_E) * (1 / p.na + 1 / p.nd))
    return Q_E * p.na * ((w * p.nd) / (p.na + p.nd))
  }
  return -(at(j.v + h) - at(j.v - h)) / (2 * h)
}
