// What the reading pane lists, per structure, and the closed form behind each.
//
// One place, so the reading pane and the equations pane cannot disagree about
// what a quantity is or where it came from. Every `value` is read out of what
// `analyse` returned and nothing here recomputes physics.

const row = (label, value, unit, form, note) => ({ label, value, unit, form, note })

export const READINGS = {
  bulk: (x) => {
    const c = x.carrier
    return [
      row('electrons n', c.n, 'm⁻³', 'n = (ΔN + √(ΔN² + 4n_i²))/2', 'from the neutrality condition, solved exactly'),
      row('holes p', c.p, 'm⁻³', 'p = n_i²/n', 'the law of mass action, not an approximation'),
      row('n_i at T', c.ni, 'm⁻³', 'n_i(T) = n_i(300)(T/300)^{3/2} e^{−E_g/2k(1/T − 1/300)}', 'the suite’s constant, carried to T'),
      row('n_i from N_c and N_v', c.niComputed, 'm⁻³', 'n_i = √(N_c N_v) e^{−E_g/2kT}', 'the other value in print'),
      row('the ratio between them', c.niRatio, '', 'n_i(suite)/n_i(computed)', 'which book a number came from'),
      row('band gap the suite’s n_i implies', c.gapImplied, 'eV', 'E_g = 2kT ln(√(N_c N_v)/n_i)', 'the same law read backwards'),
      row('E_F − E_i', c.efi, 'V', 'E_F − E_i = (kT/q) ln(n/n_i)', 'one decade of doping is 59.5 meV'),
      row('E_c − E_F', c.barrier, 'V', 'E_c − E_F = E_g/2 − (E_F − E_i)', 'how far an electron is from the band'),
      row('thermal voltage', c.vt, 'V', 'kT/q', ''),
      row('extrinsic', c.extrinsic ? 'yes' : 'no', '', '|ΔN| > 2n_i', 'whether the dopants still decide'),
      row('intrinsic above', c.intrinsicT, 'K', 'n(T) = 1.1 ΔN', 'where pair production catches the dopants'),
    ]
  },

  junction: (x) => {
    const j = x.j
    return [
      row('built-in potential V₀', j.v0, 'V', 'V₀ = (kT/q) ln(N_A N_D/n_i²)', 'from the doping alone'),
      row('junction potential V_j', j.vj, 'V', 'V_j = V₀ − v', 'what the applied bias leaves'),
      row('depletion width W', j.w, 'm', 'W = √(2ε_s V_j/q · (1/N_A + 1/N_D))', ''),
      row('into the p side x_p', j.xp, 'm', 'x_p = W N_D/(N_A + N_D)', 'charge neutrality sets the split'),
      row('into the n side x_n', j.xn, 'm', 'x_n = W N_A/(N_A + N_D)', ''),
      row('peak field, from the charge', j.byCharge, 'V/m', 'E_max = q N_A x_p/ε_s', ''),
      row('peak field, from the area', j.byQuadrature, 'V/m', 'E_max = 2V_j/W', 'the same number by the other route'),
      row('capacitance C_j', j.byArea, 'F/m²', 'C_j = ε_s/W', ''),
      row('capacitance by the square-root law', j.byLaw, 'F/m²', 'C_j = C_j0/√(1 − v/V₀)', 'the form an electronics course states'),
      row('saturation current I_S', j.is, 'A', 'I_S = qA n_i²(D_p/L_pN_D + D_n/L_nN_A)', ''),
      row('hole diffusion length L_p', j.lp, 'm', 'L_p = √(D_pτ_p)', ''),
      row('electron diffusion length L_n', j.ln, 'm', 'L_n = √(D_nτ_n)', ''),
      row('forward voltage at 1 mA', j.vAt1mA, 'V', 'v = (kT/q) ln(I/I_S)', ''),
      row('one decade of current', j.decade, 'V', '(kT/q) ln10', ''),
      row('breakdown, as a junction potential', j.vbr, 'V', 'V_j = ε_sE_crit²(1/N_A + 1/N_D)/2q', 'the critical field is data'),
      row('breakdown, as an applied bias', j.vbrApplied, 'V', 'v = V₀ − V_j', 'what a rating on a part means'),
      row('mechanism', j.mechanism, '', 'tunnelling below 6 V', 'avalanche needs width to accelerate in'),
      row('the model’s error at the edges', j.modelError, '', '(L_Dp + L_Dn)/W', 'the two carrier tails a step charge replaces'),
    ]
  },

  mos: (x) => {
    const m = x.mos
    return [
      row('oxide capacitance C_ox', m.cox, 'F/m²', 'C_ox = ε_ox/t_ox', ''),
      row('bulk potential φ_F', m.phiF, 'V', 'φ_F = (kT/q) ln(N_A/n_i)', ''),
      row('surface potential ψ_s', m.psi, 'V', 'V_G = V_FB + ψ_s + √(2qε_sN_Aψ_s)/C_ox', 'the root of the divider, exactly'),
      row('regime', m.regime, '', 'ψ_s against 0 and 2φ_F', ''),
      row('depletion width under the gate', m.w, 'm', 'W = √(2ε_sψ_s/qN_A)', ''),
      row('widest it gets W_max', m.wmax, 'm', 'W_max = √(4ε_sφ_F/qN_A)', 'the inversion layer takes the rest'),
      row('capacitance at high frequency', m.cHigh, 'F/m²', 'C = C_oxC_d/(C_ox + C_d)', ''),
      row('capacitance at low frequency', m.cLow, 'F/m²', 'C = C_ox in inversion', 'the minority carriers keep up'),
      row('floor C_min', m.cmin, 'F/m²', 'C_min = C_oxC_dmin/(C_ox + C_dmin)', ''),
      row('C_min/C_ox', m.ratio, '', 'C_dmin/(C_ox + C_dmin)', 'what reads the substrate doping'),
      row('doping this ratio reads back', m.dopingRead, 'm⁻³', 'the ratio inverted, by bisection', ''),
      row('flat-band voltage V_FB', m.vfb, 'V', 'V_FB = φ_ms − qQ_f/C_ox', ''),
      row('work-function difference φ_ms', m.phims, 'V', 'φ_ms = −(E_g/2 + φ_F) for an n⁺ gate', ''),
      row('depletion charge at threshold', m.qdep, 'C/m²', 'Q_dep = qN_AW_max', ''),
      row('what that charge costs the gate', m.depTerm, 'V', 'Q_dep/C_ox', ''),
      row('what the implant is worth', m.implantTerm, 'V', 'qN_implant/C_ox', ''),
      row('threshold voltage V_T', m.vt, 'V', 'V_T = V_FB + 2φ_F + Q_dep/C_ox + qN/C_ox', 'four terms, and a process sets each'),
      row('body coefficient γ', m.gamma, '', 'γ = √(2qε_sN_A)/C_ox', ''),
      row('subthreshold swing S', m.swing, 'V', 'S = (kT/q)ln10(1 + C_dmin/C_ox)', 'where the square law stops'),
    ]
  },

  mosfet: (x) => {
    const f = x.fet
    return [
      ...READINGS.mos(x),
      row('process transconductance k′', f.kprime, 'A/V²', 'k′ = µ_n C_ox', ''),
      row('device transconductance k_n', f.kn, 'A/V²', 'k_n = k′ W/L', ''),
      row('threshold with the body bias', f.vt, 'V', 'V_T(V_SB) = V_T(0) + γ(√(2φ_F + V_SB) − √(2φ_F))', ''),
      row('overdrive V_OV', f.vov, 'V', 'V_OV = V_GS − V_T', ''),
      row('channel charge', f.charge, 'C/m²', 'Q_n = C_ox V_OV', ''),
      row('region', f.region, '', 'V_DS against V_OV', ''),
      row('drain current, closed form', f.id, 'A', 'I_D = k_n[V_OVV_DS − V_DS²/2], or ½k_nV_OV²', ''),
      row('drain current, by quadrature', f.integral, 'A', 'I_D = k_n∫(V_OV − V)dV', 'the integral the closed form came from'),
      row('transconductance g_m', f.gm, 'A/V', 'g_m = k_nV_OV in saturation', ''),
      row('g_m by finite difference', f.gmMeasured, 'A/V', 'ΔI_D/ΔV_GS', 'measured on the same model'),
      row('output resistance r_o', f.ro, 'Ω', 'r_o = 1/λI_D', 'infinite where λ is zero'),
      row('gate swing to the off current', f.dv, 'V', 'ΔV = S log₁₀(I_D/I_off)', ''),
      row('overdrive velocity saturation takes', f.vsat, 'V', 'V_OV = E_sat L', ''),
    ]
  },

  bjt: (x) => {
    const b = x.bjt
    return [
      row('base Gummel number', b.gummelBase, 'm⁻²', 'N_B W_B', ''),
      row('emitter Gummel number', b.gummelEmitter, 'm⁻²', 'N_E W_E', ''),
      row('saturation current I_S', b.is, 'A', 'I_S = qA n_i²D_B/(N_BW_B)', ''),
      row('current gain β', b.beta, '', 'β = D_BN_EW_E/(D_EN_BW_B)', 'the emitter-injection ceiling'),
      row('α', b.alpha, '', 'α = β/(β + 1)', ''),
      row('V_BE at the stated current', b.vbe, 'V', 'V_BE = (kT/q) ln(I_C/I_S + 1)', ''),
      row('base transit time τ_B', b.tauB, 's', 'τ_B = W_B²/2D_B', ''),
      row('the f_T that caps', b.ftLimit, 'Hz', 'f_T ≤ 1/2πτ_B', ''),
      row('collector junction into the base', b.intoBase, 'm', 'x_p = W N_C/(N_B + N_C)', ''),
      row('neutral base left', b.neutralBase, 'm', 'W_B − x_p', ''),
      row('fraction of the base taken', b.taken, '', 'x_p/W_B', ''),
      row('the edge’s rate', b.rate, 'm/V', 'dx_p/dV = x_p/2V_j', ''),
      row('Early voltage V_A', b.va, 'V', 'V_A = W_B/(dx_p/dV)', ''),
      row('emitter junction width', b.emitterWidth, 'm', 'the same closed form, at zero bias', ''),
    ]
  },

  cell: (x) => {
    const c = x.pv
    return [
      row('short-circuit current I_sc', c.isc, 'A', 'I_sc = I_L', ''),
      row('open-circuit voltage V_oc', c.voc, 'V', 'V_oc = (kT/q) ln(I_L/I_S + 1)', ''),
      row('voltage at maximum power', c.vmp, 'V', 'dP/dV = 0, by bisection', 'the only quantity here without a closed form'),
      row('current there', c.imp, 'A', 'I(V_mp)', ''),
      row('maximum power', c.pmax, 'W', 'P = V_mp I_mp', ''),
      row('fill factor', c.ff, '', 'FF = P_max/(V_ocI_sc)', ''),
      row('fill factor, empirical form', c.ffEmpirical, '', '(v_oc − ln(v_oc + 0.72))/(v_oc + 1)', 'an approximation, with its error beside it'),
      row('the empirical form’s error', c.ffError, '', '(FF_emp − FF)/FF', ''),
      row('efficiency', c.efficiency, '', 'P_max/(irradiance × area)', ''),
      row('what a series ohm costs', c.seriesLoss, 'V', 'I_mp R_s', ''),
    ]
  },

  led: (x) => [
    row('band gap', x.led.eg, 'eV', 'a material fact, taken as data', ''),
    row('emission wavelength', x.led.wavelength, 'm', 'λ = hc/E_g', ''),
    row('forward-voltage floor', x.led.vf, 'V', 'V_f ≥ E_g/q', ''),
    row('photon energy', x.led.photonEnergy, 'J', 'E = E_g q', ''),
    ...READINGS.cell(x),
  ],

  fab: (x) => {
    const f = x.fab
    const out = [
      row('implant dose', f.dose, 'm⁻²', 'what the implanter fires per unit area', ''),
      row('junction depth', f.depth, 'm', 'what the drive-in step reaches', ''),
      row('doping the two give', f.doping, 'm⁻³', 'N = dose/depth', 'the knob every earlier group turned'),
    ]
    if (x.j) out.push(...READINGS.junction(x))
    if (x.mos) out.push(...READINGS.mosfet(x))
    return out
  },
}
