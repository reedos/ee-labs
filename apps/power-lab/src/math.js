// The math panel: the formula a first course writes down, next to what the
// engine measured on the exact waveform.
//
// Every check row puts a closed form against a measurement that did not use
// it — a ripple formula against the peak-to-peak of the solved current, the
// energy identity against two independent integrals. A row the current
// settings put outside a formula's assumptions is footnoted, not crossed.

import { fmt } from '@ee-labs/ui'
import { LINREG_R_PASS } from './analysis.js'


/**
 * The TeX for each row name that is an equation rather than a phrase. Keyed by
 * the plain label so the rows themselves stay readable and the tests, which
 * report by label, are unchanged. A name missing from here renders as text —
 * which is right for "mode" and wrong for nothing.
 */
const TEX = {
  '⟨v_out⟩': '\\langle v_{out} \\rangle',
  V_rms: 'V_{rms}',
  'P (in the load)': 'P \\;\\text{in the load}',
  'P at a steady ⟨v⟩': 'P \\;\\text{at a steady}\\; \\langle v \\rangle',
  I_out: 'I_{out}',
  P_out: 'P_{out}',
  P_diss: 'P_{diss}',
  P_in: 'P_{in}',
  V_out: 'V_{out}',
  R_pass: 'R_{pass}',
  P_full: 'P_{full}',
  'η': '\\eta',
  'M = V_out/V_in': 'M = V_{out}/V_{in}',
  '⟨v_L⟩ over a period': '\\langle v_L \\rangle \\;\\text{over a period}',
  '⟨i_C⟩ over a period': '\\langle i_C \\rangle \\;\\text{over a period}',
  '⟨i_C⟩ over a cycle': '\\langle i_C \\rangle \\;\\text{over a cycle}',
  'ΔI_L': '\\Delta I_L',
  'ΔV_out': '\\Delta V_{out}',
  'P_in = P_out + conduction losses': 'P_{in} = P_{out} + \\text{conduction losses}',
  'η = M·(1 − D)': '\\eta = M\\,(1 - D)',
  'ΔV over the hold, V_hold·(1 − e^{−t_hold/RC})': '\\Delta V = V_{hold}\\left(1 - e^{-t_{hold}/RC}\\right)',
  'PF = cos φ₁ · I₁/I_rms': '\\lambda = \\cos\\varphi_1 \\cdot I_1/I_{rms}',
  'P / P_full = 1 − α/π + sin 2α/(2π)': 'P/P_{full} = 1 - \\dfrac{\\alpha}{\\pi} + \\dfrac{\\sin 2\\alpha}{2\\pi}',
  'K = 2Lf_s/R': 'K = 2 L f_s / R',
  R_crit: 'R_{crit}',
  'f_0 of the LC': 'f_0 \\;\\text{of the LC}',
  'i_L peak': '\\hat{i}_L',
  'i_D peak': '\\hat{i}_D',
  '½L·i_pk²·f_s': '\\tfrac{1}{2} L\\, i_{pk}^2 f_s',
  'M the ideal formula promises': 'M \\;\\text{the ideal formula promises}',
  'the peak this R_L allows': 'M_{max} \\;\\text{this}\\; R_L \\;\\text{allows}',
  V_p: 'V_p',
  V_dc: 'V_{dc}',
  'V_dc with no capacitor': 'V_{dc} \\;\\text{with no capacitor}',
  'form factor I_rms/I_avg': '\\text{form factor}\\; I_{rms}/I_{avg}',
  PF: '\\lambda',
  THD: '\\mathrm{THD}',
  'series R_s loss': 'R_s I_{D,rms}^2',
  'diode loss': 'V_f \\langle i_D \\rangle',
  V_rms_line: 'V_{rms}',
  I_rms: 'I_{rms}',
  'I₁': 'I_1',
  P: 'P',
  ratio: '\\text{ratio}',
}

/** Attach the TeX for a row's name, where there is one. */
const addTex = (r) => (r.tex || !TEX[r.label] ? r : { ...r, tex: TEX[r.label] })

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows: rows.map(addTex) })
const V = (rows) => ({ kind: 'values', rows: rows.map(addTex) })
const row = (label, predicted, measured, unit = '', tol = 0.01, abs = 0, unchecked = null) => ({
  label,
  predicted,
  measured,
  unit,
  tol,
  abs,
  ...(unchecked ? { unchecked } : {}),
})

/** Trapezoid over a waveform that carries both sides of each edge: exact for piecewise-linear traces. */
export function trapz(t, y) {
  let s = 0
  for (let i = 1; i < t.length; i++) s += ((y[i] + y[i - 1]) / 2) * (t[i] - t[i - 1])
  return s
}

/** Composite Simpson on a smooth integrand: an independent reading of a closed-form integral. */
export function simpson(g, a, b, n = 400) {
  const h = (b - a) / n
  let s = g(a) + g(b)
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * g(a + i * h)
  return (s * h) / 3
}

export function experimentMath(exp, params, x) {
  if (exp.kind === 'linreg') return linearEntry(params, x)
  if (exp.kind === 'chopper') return chopperEntry(params, x)
  if (exp.kind === 'rectifier') return rectifierEntry(exp, params, x)
  if (exp.kind === 'dimmer') return dimmerEntry(exp, params, x)
  if (x.m.mode === 'inverter') return inverterEntry(exp, params, x)
  if (x.isolated) return isolatedEntry(exp, params, x)
  if (x.saturating) return coreEntry(exp, params, x)
  return pwmEntry(exp, params, x)
}

// ------------------------------------------------------------ magnetics

/**
 * The core's own panel: flux from the current, flux from the volt-seconds,
 * and the current at which the two stop agreeing.
 *
 * The two definitions of flux linkage — λ = L·i and λ = ∫v dt — are the same
 * statement, and the panel puts one against the other because they are
 * computed along different routes: the algebraic map, and the propagator's
 * exact integral of the inductor voltage.
 */
function coreEntry(exp, params, x) {
  const p = x.p
  const m = x.m
  const f = x.formulas
  const core = x.core
  const sat = x.ss.mode === 'SAT'
  const dcm = x.ss.mode === 'DCM'
  const satWhy = sat
    ? `Past the knee the inductance is ${fmt(f.Lsat, 'H', 3)}, so the slope multiplies part-way through the interval and this form, which has one L in it, does not describe the whole ramp.`
    : null
  // Volt-second balance has no inductance in it, so M = D holds through
  // saturation. Running dry is a different matter: the ratio then depends on
  // the inductance, and a saturating core has two of them.
  const ratioWhy = dcm && sat
    ? 'In discontinuous conduction the ratio depends on the inductance, and this core runs on two of them. There is no single-L form to compare against.'
    : null
  const Mpred = dcm ? f.Mdcm : p.D
  // The on interval's ramp, from the output the converter actually holds.
  const dIpred = ((p.Vin - m.sig.vout.avg) * p.D) / (p.L * p.fs)
  // Both the ramp and the volt-seconds take the output as the flat number the
  // period averages to, and what drives the inductor is the difference
  // between the input and that number. The ripple is measured against the
  // difference rather than against the output, because that is what it is a
  // share of.
  const drive = Math.abs(p.Vin - m.sig.vout.avg)
  const sag = m.sig.vout.pp / Math.max(1e-12, drive)
  const sagWhy = sag > 0.01
    ? `The form drives the inductor with V_in − V_out = ${fmt(drive, 'V', 3)}. The output ripples ${fmt(m.sig.vout.pp, 'V', 3)} across the interval, which is ${(sag * 100).toFixed(0)} % of that, so what the inductor sees is not what the period averages.`
    : null
  // The flux the on interval's volt-seconds buy, added to where the period
  // started: an independent route to the peak the current implies.
  const Bstart = fluxOf(f, x.ss.x0[0])
  const rows = [
    row('ΔB over the on interval', f.dBideal, f.dB, 'T', 5e-3, 0, sagWhy),
    row('peak B, from ∫v dt', Bstart + f.dB, f.Bpk, 'T', 5e-3),
    row('M = V_out/V_in', Mpred, m.M, '', dcm ? 1e-2 : 5e-3, 0, ratioWhy),
    row('⟨v_L⟩ over a period', 0, m.sig.vL.avg, 'V', 0, 1e-9 * p.Vin),
    row('⟨i_C⟩ over a period', 0, m.sig.iC.avg, 'A', 0, 1e-9 * Math.max(1e-3, m.sig.iL.max)),
    row('ΔI_L', dIpred, m.sig.iL.pp, 'A', 1e-2, 0, satWhy || sagWhy),
    row('P_in = P_out + conduction losses', m.Pout + m.Pcond, m.Pin, 'W', 1e-7),
  ]
  const values = [
    { label: 'N·A_e', value: f.coreArea, unit: 'Wb/T', note: `${fmt(core.N, '', 3)} turns on ${fmt(core.Ae * 1e6, 'mm²', 3)}` },
    { label: 'I_sat', value: f.Isat, unit: 'A', note: 'B_sat·N·A_e/L' },
    { label: 'i_L peak', value: m.sig.iL.max, unit: 'A', note: sat ? 'over the knee' : 'under the knee' },
    { label: 'peak B', value: f.Bpk, unit: 'T', note: `against a ceiling of ${fmt(f.Bsat, 'T', 3)}` },
    { label: 'L past the knee', value: f.Lsat, unit: 'H', note: `L divided by ${(p.L / f.Lsat).toFixed(0)}` },
    { label: 'the period spent saturated', value: f.satShare * 100, unit: '%', note: sat ? `first crossing at ${fmt(f.tSat, 's', 3)}` : 'the core stays under the knee' },
    { label: 'mode', value: sat ? 0 : 1, unit: '', note: sat ? '0 = part of the period saturated' : '1 = linear all period' },
    { label: 'η', value: m.eta * 100, unit: '%' },
  ]
  const intro = {
    d1: 'Flux linkage is L·i, and it is also the integral of the voltage across the winding. Divide by N turns and A_e of core and both give the flux density, so the volt-seconds a converter takes each period are its flux excursion.',
    d2: 'Below the knee the inductance is L; above it the core takes almost no more flux, and what is left is a much smaller inductance. The crossing is at the current whose flux is B_sat, and it is placed as an event rather than stepped over.',
  }[exp.id]
  return {
    blocks: [
      T(intro),
      F('B = \\frac{L\\,i}{N A_e}, \\qquad \\Delta B = \\frac{1}{N A_e}\\int v_L\\,dt, \\qquad I_{sat} = \\frac{B_{sat} N A_e}{L}', 'the core, in three statements'),
      F(SAT_TEX, 'the piecewise-linear knee, which is a model of iron rather than a law'),
      C(rows),
      V(values),
    ],
  }
}

const SAT_TEX = 'L(i) = \\begin{cases} L & |i| < I_{sat} \\\\ L/h & |i| > I_{sat}\\end{cases}'

/** The flux density a current implies, in the same piecewise map the engine uses. */
function fluxOf(f, i) {
  const s = Math.sign(i) || 1
  const a = Math.abs(i)
  if (a <= f.Isat) return (f.Isat > 0 ? (f.Bsat * i) / f.Isat : 0)
  return s * (f.Bsat + (f.Lsat * (a - f.Isat)) / f.coreArea)
}

// ------------------------------------------------------------ isolated

/**
 * The flyback and the half-bridge: volt-second balance with the turns in it,
 * and the stress that isolation costs the switch.
 */
function isolatedEntry(exp, params, x) {
  const p = x.p
  const m = x.m
  const f = x.formulas
  const fly = x.kind === 'flyback'
  const dcm = x.ss.mode === 'DCM'
  const sw = f.switching
  const dcmWhy = dcm
    ? 'The core empties before the period ends, so a third interval appears and the ratio leaves the duty behind. The continuous-conduction form does not apply here.'
    : null
  // The flyback's capacitor is alone with the load while the switch is on,
  // and in discontinuous conduction for the dead interval as well.
  const tAlone = dcm ? x.T - x.ss.td : p.D * x.T
  const dVpred = fly ? (Math.abs(m.Iout) * tAlone) / (p.C || x.base.C) : f.dV
  // The form gives the capacitor a steady load current for exactly the
  // interval it is alone. The output sags across that interval, so the
  // current it supplies falls with it.
  const dvOver = m.sig.vout.pp > 0 ? dVpred / m.sig.vout.pp - 1 : 0
  const sagFrac = m.sig.vout.pp / Math.max(1e-12, Math.abs(m.sig.vout.avg))
  const dVwhy = dcmWhy || (Math.abs(dvOver) > 0.02
    ? `The form gives the capacitor a steady ${fmt(Math.abs(m.Iout), 'A', 3)} for the whole interval it is alone. Here the output sags ${(sagFrac * 100).toFixed(0)} % across it, so the current falls with the voltage and the form is out by ${(Math.abs(dvOver) * 100).toFixed(1)} %.`
    : null)
  const rows = [
    row('M = V_out/V_in', f.M, m.M, '', 5e-3, 0, dcmWhy),
    row('⟨v_L⟩ over a period', 0, m.sig.vL.avg, 'V', 0, 1e-9 * p.Vin),
    row('⟨i_C⟩ over a period', 0, m.sig.iC.avg, 'A', 0, 1e-9 * Math.max(1e-3, m.sig.iL.max)),
    row('⟨i_D⟩ = I_out', Math.abs(m.Iout), m.sig.iD.avg, 'A', 5e-3, 0, fly ? null : 'The rectifier carries the output inductor’s current in both intervals, so its average is the load’s and this row is the same statement twice.'),
    row('ΔI', f.dI, m.sig.iL.pp, 'A', 1e-2, 0, dcmWhy),
    row('ΔV_out', dVpred, m.sig.vout.pp, 'V', 3e-2, 0, dVwhy),
    row('P_in = P_out + conduction losses', m.Pout + m.Pcond, m.Pin, 'W', 1e-7),
  ]
  if (fly) {
    rows.push(
      row('the switch blocks V_in + (V_out + V_f)/n', f.blocking, m.sig.vsw.max, 'V', 1e-2, 0, dcm ? 'In discontinuous conduction the drain rings down to V_in once the secondary stops, and the peak is still the reflected one.' : null),
    )
  }
  const values = [
    { label: 'turns ratio n = N_s/N_p', value: f.n, unit: '', note: `${fmt(f.Np, '', 3)}:1 primary to secondary` },
    { label: 'V_out', value: m.sig.vout.avg, unit: 'V', note: `M·V_in with M = ${f.M.toFixed(4)}` },
    { label: 'I_out', value: m.Iout, unit: 'A' },
    { label: 'i_L peak', value: m.sig.iL.max, unit: 'A', note: fly ? 'in the magnetising inductance, on the primary side' : 'in the output inductor' },
    { label: 'i_D peak', value: m.sig.iD.max, unit: 'A', note: fly ? `the primary current divided by n` : 'the output inductor’s own' },
    { label: 'the switch blocks', value: f.blocking, unit: 'V', note: fly ? `${(f.blocking / p.Vin).toFixed(2)}× the rail` : 'the rail, and no more' },
    { label: 'R_crit', value: f.Rcrit, unit: 'Ω', note: 'the core empties above this load' },
    { label: 'ripple pulses per switching period', value: f.ripplePulses, unit: '', note: fly ? 'one, at f_s' : `two, at ${fmt(2 * sw.fs, 'Hz', 3)}` },
    { label: 'η', value: m.eta * 100, unit: '%' },
  ]
  if (!fly) {
    values.push(
      { label: 'the secondary pulse n·V_in/2', value: f.vpulse, unit: 'V', note: `for ${(sw.D * 200).toFixed(1)} % of each period in total` },
      { label: 'ΔV_out if it were fed at f_s', value: f.dVatFs, unit: 'V', note: 'twice what the doubled rate leaves' },
    )
  }
  const intro = {
    d3: 'The switch puts V_in across the primary and the magnetising current rises; when it opens, the winding reverses and the secondary delivers what the core stored. Volt-second balance across the two intervals gives the ratio, with the turns ratio scaling the second one.',
    d4: 'The primary sees ±V_in/2 while a switch is on and nothing while neither is, so the rectified secondary is a pulse train of amplitude n·V_in/2 at twice the switching frequency. Volt-second balance on the output inductor turns that into n·D.',
  }[exp.id]
  return {
    blocks: [
      T(intro),
      F(
        fly
          ? 'V_{in} D = \\frac{V_{out} + V_f}{n}(1 - D) \\;\\Rightarrow\\; M = \\frac{n D}{1 - D}'
          : '\\left(\\frac{n V_{in}}{2} - V_{out}\\right) D = V_{out}\\left(\\tfrac{1}{2} - D\\right) \\;\\Rightarrow\\; M = n D',
        'volt-second balance, with the turns in it',
      ),
      F(
        fly
          ? '\\Delta I_M = \\frac{V_{in} D}{L f_s}, \\qquad \\Delta V_{out} = \\frac{I_{out} D}{C f_s}'
          : '\\Delta I_L = \\frac{(n V_{in}/2 - V_{out})D}{L f_s}, \\qquad \\Delta V_{out} = \\frac{\\Delta I_L}{8 (2 f_s) C}',
        'the ripples, in the small-ripple approximation',
      ),
      C(rows),
      V(values),
    ],
  }
}

// ------------------------------------------------------------ inverters

/**
 * The inverter's panel: the fundamental the modulator commanded against the
 * one the bridge produced, and what the filter did to the rest.
 */
function inverterEntry(exp, params, x) {
  const p = x.p
  const m = x.m
  const f = x.formulas
  const square = x.kind === 'square'
  const over = !square && p.ma > 1
  const overWhy = over
    ? `Past m_a = 1 the reference spends part of each half cycle outside the carrier, so pulses go missing and the fundamental stops following m_a·V_dc. It is ${((1 - (m.Vsw1 * Math.SQRT2) / (p.ma * p.Vdc)) * 100).toFixed(1)} % short of the line here.`
    : null
  // The lowest sideband of the carrier's cluster sits at m_f − 2. At m_f = 3
  // that is the fundamental itself, and below m_f = 9 it is near enough to
  // add to it, so the fundamental stops being m_a·V_dc alone.
  const crowded = !square && f.mf < 9
    ? `The carrier's lowest sideband is at harmonic ${f.mf - 2}, which is too near the fundamental to be separated from it at m_f = ${f.mf}. The identity needs a carrier well clear of the output frequency.`
    : null
  const rows = [
    square
      ? row('V₁ of the bridge = (4/π)·V_dc/√2', f.V1ideal, m.Vsw1, 'V', 1e-6)
      : row('peak V₁ of the bridge = m_a·V_dc', f.peakIdeal, m.Vsw1 * Math.SQRT2, 'V', 1e-5, 0, overWhy || crowded),
    row('⟨v_L⟩ over a period', 0, m.sig.vL.avg, 'V', 0, 1e-9 * p.Vdc),
    row('⟨i_C⟩ over a period', 0, m.sig.iC.avg, 'A', 0, 1e-9 * Math.max(1e-3, Math.abs(m.sig.iL.max))),
    row('P_in = P_out + conduction losses', m.Pout + m.Pcond, m.Pin, 'W', 1e-6),
  ]
  if (square) {
    rows.push(row('THD of the bridge = √(π²/8 − 1)', f.thdIdeal, m.thdSw, '', 1e-6))
  } else if (m.carrier && Number.isFinite(m.attenuation)) {
    rows.push(
      row(`the filter at harmonic ${m.carrier.k}`, f.Hcarrier, m.attenuation, '', 5e-3, 0,
        Math.abs(m.carrier.k * p.f1 - f.fsw) > 1e-6
          ? `The largest component of the cluster is at harmonic ${m.carrier.k} rather than at m_f itself, and the row compares the filter there.`
          : null),
    )
  }
  const values = [
    { label: 'V_dc', value: p.Vdc, unit: 'V' },
    { label: 'm_f', value: f.mf, unit: '', note: square ? 'two edges a cycle' : `carrier at ${fmt(f.fsw, 'Hz', 4)}` },
    { label: 'V₁ of the bridge', value: m.Vsw1, unit: 'V', note: `peak ${fmt(m.Vsw1 * Math.SQRT2, 'V', 4)}` },
    { label: 'THD of the bridge', value: m.thdSw * 100, unit: '%' },
    { label: 'V₁ at the load', value: m.V1, unit: 'V' },
    { label: 'THD at the load', value: m.thd * 100, unit: '%' },
    { label: 'f_0 of the LC', value: f.fo, unit: 'Hz', note: `Q = ${f.Q.toFixed(2)}` },
    { label: '|H| at the third harmonic', value: f.Hthird, unit: '', note: `at ${fmt(3 * p.f1, 'Hz', 3)}` },
    { label: 'P at the load', value: m.Pout, unit: 'W' },
  ]
  if (!square) values.push({ label: '|H| at the carrier', value: f.Hcarrier, unit: '', note: `at ${fmt(f.fsw, 'Hz', 4)}` })
  const intro = {
    f1: 'Two edges a cycle give a square wave, whose fundamental is (4/π)·V_dc and whose remaining harmonics are the odd ones at 1/k. They start at three times the output frequency, which is too close to it for a filter to separate.',
    f2: 'A comparator against a triangle sets the pulse widths, and the average over each carrier period follows the reference. That is why the fundamental is m_a·V_dc, and why it stops being so once the reference leaves the carrier behind.',
    f3: 'Switching at m_f times the output frequency puts the energy it leaves behind in clusters at m_f and its multiples, with nothing in between. The filter then has a whole decade to work in rather than one octave.',
    f4: 'The filter is second order, so what it does to a cluster depends on where the cluster sits against its corner. Moving the carrier up moves every cluster with it, and the distortion left at the load falls with the square of the ratio.',
  }[exp.id]
  return {
    blocks: [
      T(intro),
      F(
        square
          ? 'V_1 = \\frac{4}{\\pi}\\frac{V_{dc}}{\\sqrt2}, \\qquad \\mathrm{THD} = \\sqrt{\\frac{\\pi^2}{8} - 1} = 48.34\\,\\%'
          : '\\hat{v}_1 = m_a V_{dc} \\;(m_a \\le 1), \\qquad m_f = \\text{odd},\\; f_{sw} = m_f f_1',
        square ? 'the square wave, whatever the rail' : 'the modulator, whatever the carrier',
      ),
      F('|H(f)| = \\left|\\frac{1}{1 - \\omega^2 LC + j\\omega L/R}\\right|, \\qquad f_0 = \\frac{1}{2\\pi\\sqrt{LC}}', 'the output filter, which decides what survives'),
      C(rows),
      V(values),
    ],
  }
}

function linearEntry(p, x) {
  const { lr } = x
  return {
    blocks: [
      T('The pass element is a fixed resistor. It carries the load current and drops the rest of the voltage across itself, and the product is heat. There is nothing to measure against here: the loss is how the divider is built.'),
      F('V_{out} = V_{in}\\,\\frac{R}{R + R_{pass}}, \\qquad P_{diss} = (V_{in} - V_{out})\\,I_{out}, \\qquad \\eta = \\frac{V_{out}}{V_{in}}'),
      V([
        { label: 'R_pass', value: LINREG_R_PASS, unit: 'Ω' },
        { label: 'I_out', value: lr.Io, unit: 'A' },
        { label: 'V_out', value: lr.Vo, unit: 'V' },
        { label: 'P_out', value: lr.Pout, unit: 'W' },
        { label: 'P_diss', value: lr.Pdiss, unit: 'W', note: 'in the resistor' },
        { label: 'η', value: lr.eta * 100, unit: '%' },
      ]),
    ],
  }
}

function chopperEntry(p, x) {
  const { t, sig } = x.wf
  const Tp = x.T
  // Measured from the trace: it carries both sides of each edge, so the
  // trapezoid is exact — and independent of the formulas on the left.
  const avg = trapz(t, sig.vout) / (2 * Tp)
  const rms = Math.sqrt(trapz(t, sig.vout.map((v) => v * v)) / (2 * Tp))
  const P = trapz(t, sig.vout.map((v) => (v * v) / p.R)) / (2 * Tp)
  return {
    blocks: [
      T('A switch at duty D delivers V_in for a fraction D of the time. The average scales with D; the heating scales with D too, but from the full V_in² — so it is D·V_in²/R, not (D·V_in)²/R.'),
      F('\\langle v \\rangle = D\\,V_{in}, \\qquad V_{rms} = \\sqrt{D}\\,V_{in}, \\qquad P = \\frac{D\\,V_{in}^2}{R}'),
      C([
        row('⟨v_out⟩', p.D * p.Vin, avg, 'V', 1e-9),
        row('V_rms', Math.sqrt(p.D) * p.Vin, rms, 'V', 1e-9),
        row('P (in the load)', (p.D * p.Vin * p.Vin) / p.R, P, 'W', 1e-9),
      ]),
      V([
        { label: 'P at a steady ⟨v⟩', value: (p.D * p.Vin) ** 2 / p.R, unit: 'W', note: 'what 5 V DC would give' },
        { label: 'ratio', value: 1 / p.D, unit: '', note: 'chopped over steady' },
      ]),
    ],
  }
}

function pwmEntry(exp, params, x) {
  const p = x.p
  const m = x.m
  const f = x.formulas
  const ss = x.ss
  const kind = x.kind
  const boostLike = kind !== 'buck'
  const sgn = x.sign
  const Dp = 1 - p.D
  const lossy = p.Ron > 0 || p.Vf > 0 || p.RL > 0 || p.ESR > 0
  const dcm = ss.mode === 'DCM'
  const Iout = m.Iout

  // Volt-second balance with the drops in it (reduces to the ideal ratio when
  // ideal). The buck's switch and freewheel drops are carried term by term;
  // the boost and buck-boost carry the winding, which is the one that decides
  // their shape, and footnote the others rather than pretending to.
  const fwV = p.sync ? 0 : p.Vf
  const fwR = p.sync ? p.Ron : 0
  const voutPred = (p.D * p.Vin - (1 - p.D) * fwV) / (1 + (p.D * p.Ron + (1 - p.D) * fwR + p.RL) / p.R)
  const ccmM = boostLike ? f.Mreal : voutPred / p.Vin
  const Mpred = dcm ? f.Mdcm : ccmM
  const otherDrops = boostLike && (p.Ron > 0 || fwV > 0 || p.ESR > 0)
  const dropWhy = otherDrops
    ? `The CCM form here carries the winding, which is what bends the curve; the switch, diode and ESR drops at these settings are left out of it and shift M by the ${(Math.abs(ccmM - m.M) / Math.abs(m.M) * 100).toFixed(1)} % you see.`
    : null

  // The small-ripple approximation's two conditions, measured: the switching
  // frequency well above the filter's corner (else the "triangle" curves),
  // and the load well above the capacitor's impedance at f_s (else the AC
  // current goes through R instead of C). Outside them the formulas are off
  // by more than the panel tolerates, and the row says so rather than
  // crossing out a textbook formula for being applied where the textbook
  // says not to.
  const fsOverFo = p.fs / f.fo
  const rOverZc = p.R * 2 * Math.PI * p.fs * p.C
  const slow = fsOverFo < 20
  const leaky = rOverZc < 20
  const slowWhy = `The formula assumes f_s ≫ f_0; here f_s/f_0 = ${fsOverFo.toFixed(1)} and the current is no longer a straight-sided triangle.`
  const leakyWhy = `The formula assumes R ≫ 1/(2πf_sC); here R is only ${rOverZc.toFixed(1)}× the capacitor's impedance at f_s, so part of the ripple current goes through the load.`

  // The boost family's CCM ratio comes from charge balance, ⟨i_D⟩ =
  // (1 − D)·⟨i_L⟩, which needs a current that barely ripples — the buck has no
  // such step, which is why only these two carry the condition.
  const ripFrac = Math.abs(m.sig.iL.avg) > 0 ? Math.abs(m.sig.iL.pp / m.sig.iL.avg) : Infinity
  const rippled = ripFrac > 0.4
  const rippledWhy = `The ratio comes from ⟨i_D⟩ = (1 − D)·⟨i_L⟩, which takes the current as flat across the interval; here the ripple is ${(ripFrac * 100).toFixed(0)} % of the average.`

  // The DCM closed form also takes the output as constant: same conditions.
  const Mwhy = dcm && lossy
    ? 'The DCM formula assumes ideal parts; this converter has drops in it.'
    : dcm && slow
      ? slowWhy
      : dcm && leaky
        ? leakyWhy
        : !dcm && boostLike
          ? slow
            ? slowWhy
            : leaky
              ? leakyWhy
              : rippled
                ? rippledWhy
                : null
          : null

  // Ripple: the on-segment rise, from the measured output. The resistive drop
  // is taken at the current the on interval carries: the load current in CCM
  // (the triangle is symmetric about it). In DCM the ramp starts from zero
  // and the on interval with resistance is an exact exponential towards
  // v_on/r_on, so that is what is used — a linearised drop is out by
  // (DT/τ)²/12, which is past the row's tolerance once DT/τ nears 0.25.
  const rOn = p.Ron + p.RL
  // The buck's inductor sees V_in − V_out while the switch is on; the boost
  // and buck-boost see the whole of V_in, with the same resistive correction
  // at the current the on interval carries.
  const vOn = boostLike ? p.Vin : p.Vin - m.sig.vout.avg
  const iOn = dcm ? m.sig.iL.max / 2 : boostLike ? m.sig.iL.avg : Iout
  const dIideal = (vOn * p.D) / (p.L * p.fs)
  const dIpred = dcm
    ? rOn > 0
      ? (vOn / rOn) * (1 - Math.exp((-rOn * p.D) / (p.L * p.fs)))
      : dIideal
    : dIideal - (iOn * rOn * p.D) / (p.L * p.fs)
  // The buck's capacitor integrates a triangle of current; the boost family's
  // is left alone with the load whenever the diode is off, so its ripple is
  // the charge it hands over in that time: I_out·t_alone/C. In CCM that is the
  // on interval; in DCM the diode also stops early, and the dead interval
  // counts too.
  const tAlone = dcm ? x.T - ss.td : p.D * x.T
  const dVpred = boostLike ? (Math.abs(m.Iout) * tAlone) / p.C : dIpred / (8 * p.fs * p.C)
  // Two assumptions in that: the load current holds steady while the output
  // sags, and the capacitor is discharging exactly while the diode is off. The
  // second fails once the diode's current dips below the load current before
  // it stops — at the end of a DCM ramp, always a little.
  const sagFrac = m.sig.vout.pp / Math.max(1e-12, Math.abs(m.sig.vout.avg))
  // How far the first-order figure lands from the exact one, so the row can
  // say the size of what it left out rather than only that it left something.
  const dvOver = m.sig.vout.pp > 0 ? dVpred / m.sig.vout.pp - 1 : 0
  const dvMiss = `${Math.abs(dvOver * 100).toFixed(1)} %`
  // The ramp is a straight line only while the resistive drop across it is a
  // small share of the driving voltage; past that it is an exponential and
  // the linearised correction is not enough.
  const curved = (rOn * p.D) / (p.L * p.fs) > 0.05
  const curvedWhy = `The on interval is ${((rOn * p.D) / (p.L * p.fs)).toFixed(2)} time constants long, so the current curves towards its own limit rather than ramping, and a straight-line form cannot describe it.`
  const dIwhy = curved
    ? curvedWhy
    : slow
    ? slowWhy
    : dcm && p.ESR > 0
      ? 'With ESR the output the inductor sees carries a step of ESR·i_C; over a DCM on interval, starting from zero current, it does not average out.'
      : null
  const dVwhy = curved
    ? curvedWhy
    : p.ESR > 0
    ? 'With ESR the ripple is capacitive plus a step of ESR·ΔI_L; the two do not simply add.'
    : boostLike
      ? Math.abs(dvOver) > 0.02
        ? sagFrac > 0.05
          ? `The formula gives the capacitor a steady load current for exactly the interval the diode is off. Here the output sags ${(sagFrac * 100).toFixed(0)} % across that interval, so the current it supplies falls with it, and the formula is out by ${dvMiss}.`
          : `The capacitor discharges for longer than the diode is off: the diode's current drops below the load's before it stops, and the load goes on drawing through the difference. The formula is out by ${dvMiss}.`
        : leaky
          ? leakyWhy
          : null
      : dcm
        ? 'The capacitive ripple formula assumes a full-period triangle of current; in DCM there is a dead interval.'
        : slow
          ? slowWhy
          : leaky
            ? leakyWhy
            : null

  const rows = [
    row('M = V_out/V_in', Mpred, m.M, '', dcm ? 5e-3 : 1e-3, 0, Mwhy || dropWhy),
    row('⟨v_L⟩ over a period', 0, m.sig.vL.avg, 'V', 0, 1e-9 * p.Vin),
    row('⟨i_C⟩ over a period', 0, m.sig.iC.avg, 'A', 0, 1e-9 * Math.max(1e-3, m.sig.iL.max)),
    row('ΔI_L', dIpred, m.sig.iL.pp, 'A', 5e-3, 0, dIwhy),
    row('ΔV_out', dVpred, m.sig.vout.pp, 'V', boostLike ? 2e-2 : 5e-3, 0, dVwhy),
    row('P_in = P_out + conduction losses', m.Pout + m.Pcond, m.Pin, 'W', 1e-7),
  ]
  // The boost's two extra identities: what the winding takes it takes as
  // voltage too, and in discontinuous conduction the inductor's energy is the
  // whole output power.
  if (kind === 'boost' && p.RL > 0 && !dcm) {
    // η = M(1−D) comes from ⟨i_D⟩ = (1−D)·⟨i_L⟩, which takes the current as
    // flat across the off interval.
    // And P_out is ⟨v_out²⟩/R, which is more than ⟨v_out⟩²/R by the
    // square of the output's relative deviation — about (ripple/√12)² for
    // a sawtooth, past the row's tolerance once the ripple nears 15 %.
    const ripFrac = m.sig.iL.avg > 0 ? m.sig.iL.pp / m.sig.iL.avg : Infinity
    const vRip = m.sig.vout.pp / Math.max(1e-12, Math.abs(m.sig.vout.avg))
    const ripWhy =
      ripFrac > 0.4
        ? `The identity takes ⟨i_D⟩ as (1 − D)·⟨i_L⟩, which needs a flat current; here the ripple is ${(ripFrac * 100).toFixed(0)} % of the average.`
        : vRip > 0.15
          ? `The identity takes P_out as ⟨v_out⟩²/R; it is ⟨v_out²⟩/R, which is more by the square of the output's deviation. Here the output ripples ${(vRip * 100).toFixed(0)} % of its average.`
          : null
    rows.push(row('η = M·(1 − D)', m.M * Dp, m.eta, '', 5e-3, 0, ripWhy))
  }
  if (boostLike && dcm) {
    // The inductor empties every cycle, so its energy is the power it carries.
    // In the boost the source is still in the loop while the diode conducts
    // and adds V_in·⟨i_D⟩ on top; in the buck-boost it is not, and the
    // inductor's energy is the whole of the output.
    const through = kind === 'boost' ? p.Vin * m.sig.iD.avg : 0
    const label = kind === 'boost' ? 'P_out = ½L·i_pk²·f_s + V_in·⟨i_D⟩' : 'P_out = ½L·i_pk²·f_s'
    const tex =
      kind === 'boost'
        ? 'P_{out} = \\tfrac{1}{2} L i_{pk}^2 f_s + V_{in} \\langle i_D \\rangle'
        : 'P_{out} = \\tfrac{1}{2} L i_{pk}^2 f_s'
    rows.push({
      ...row(label, f.Ecyc + through, m.Pout, 'W', 1e-6, 0, lossy ? 'The energy identity assumes nothing takes a cut on the way through; this converter has drops in it.' : null),
      tex,
    })
  }

  const values = [
    { label: 'mode', value: dcm ? 0 : 1, unit: '', note: dcm ? '0 = discontinuous conduction' : '1 = continuous conduction' },
    { label: 'K = 2Lf_s/R', value: f.K, unit: '', note: `boundary at K_crit = ${KCRIT_TEX[kind]} = ${f.Kcrit.toFixed(4)}` },
    { label: 'R_crit', value: f.Rcrit, unit: 'Ω', note: 'DCM above this load resistance' },
    { label: 'f_0 of the LC', value: f.fo, unit: 'Hz', note: `${fmt(p.fs / f.fo, '', 3)}× below f_s` },
    { label: 'η', value: m.eta * 100, unit: '%' },
    { label: 'P_in', value: m.Pin, unit: 'W' },
    { label: 'P_out', value: m.Pout, unit: 'W' },
  ]
  if (dcm) values.push({ label: 'diode conducts for', value: (ss.td / ss.T) * 100, unit: '% of T', note: `dead for ${(((ss.tOff - ss.td) / ss.T) * 100).toFixed(1)} %` })
  if (boostLike) {
    values.push({ label: 'i_L peak', value: m.sig.iL.max, unit: 'A', note: `${(m.sig.iL.avg / Math.max(1e-12, Math.abs(m.Iout))).toFixed(2)}× the load current, on average` })
    if (dcm) {
      values.push({
        label: '½L·i_pk²·f_s',
        value: f.Ecyc,
        unit: 'W',
        note: kind === 'boost' ? `plus V_in·⟨i_D⟩ = ${fmt(p.Vin * m.sig.iD.avg, 'W', 3)} straight through` : 'the whole output power',
      })
    }
  }
  if (kind === 'boost' && p.RL > 0) {
    values.push({ label: 'M the ideal formula promises', value: 1 / Dp, unit: '', note: `measured ${m.M.toFixed(3)}` })
    if (Number.isFinite(f.Mpeak)) values.push({ label: 'the peak this R_L allows', value: f.Mpeak, unit: '', note: `at D = ${f.Dpeak.toFixed(3)}` })
  }
  if (lossy || p.tr > 0) {
    for (const [k, label] of [
      ['switch', 'switch I²R_on'],
      ['diode', p.sync ? 'sync switch I²R_on' : 'diode V_f·I'],
      ['inductor', 'winding I²R_L'],
      ['esr', 'ESR I²'],
      ['switching', 'switching edges'],
    ]) {
      values.push({ label, value: m.loss[k] * 1e3, unit: 'mW' })
    }
  }

  const intro = {
    c1: 'The inductor charges from the source, then discharges in series with it. Volt-second balance over the two intervals is D·V_in = (1 − D)·(V_out − V_in), and the ratio follows with no L in it.',
    c2: 'Charge balance puts the load current through the winding divided by (1 − D); volt-second balance then carries that current’s drop. The two together bend M back down, and the maximum is where the derivative of the result vanishes.',
    c3: 'When the current reaches zero the diode blocks and a third interval appears, with v_L = 0. Balance then has two unknowns — V_out and the diode’s conduction time — and the closed form needs K.',
    c4: 'The two intervals share no path: the source charges the inductor, then the inductor alone feeds the output. Volt-second balance is D·V_in = (1 − D)·|V_out|, and the polarity comes from which end of the inductor the load is on.',
    c5: 'In discontinuous conduction the inductor starts and ends each cycle empty, so the energy it picks up is the energy the load receives. The peak is set by the on interval alone, which is why the load does not appear in the answer.',
    a3: 'The filter passes the switch node’s average and stops the rest. The output is what volt-second balance says, the ripple what the inductor and capacitor leave.',
    b1: 'Over a period the inductor current returns to its start, so ∫v_L dt = 0. Split the integral at the switching edge and the ratio drops out with no L in it.',
    b2: 'Volt-second balance with ideal parts is D·(V_in − V_out) = (1 − D)·V_out; nothing else enters. With drops, the same balance carries them and M slips below D.',
    b3: 'The current is a triangle with slopes set by the inductor voltage; the capacitor integrates the triangle’s AC part into a parabolic ripple.',
    b4: 'When the current reaches zero the diode blocks and a third interval appears, with v_L = 0. Balance then has two unknowns — V_out and the diode’s conduction time — and the closed form needs K.',
    b5: 'The boundary is where the current valley just touches zero: average equals half the ripple. In K it is K = 1 − D, and both formulas for M give D there.',
    b6: 'The diode’s drop enters the volt-second balance for the (1 − D) of each period it conducts, so the output loses (1 − D)·V_f; the diode takes V_f times its average current. The books balance exactly.',
    b7: 'Each resistance takes I²R with the RMS current through it, and the drops they cause enter the volt-second balance. The ESR carries the inductor’s ripple current, so it adds a step to the output rather than a loss.',
    b8: 'While an edge lasts the switch holds the blocking voltage and the inductor current at once; the energy in each edge is ½·V·I·t, charged twice a period, so the loss is proportional to f_s.',
  }[exp.id]

  const formula = dcm
    ? F(DCM_TEX[kind], 'the conversion ratio in discontinuous conduction')
    : boostLike
      ? F(CCM_TEX[kind], p.RL > 0 ? 'volt-second and charge balance with the winding in them' : 'volt-second balance, and its consequence')
      : lossy
        ? F('V_{out} = \\frac{D\\,V_{in} - (1-D)\\,V_f}{1 + \\dfrac{D R_{on} + R_L}{R}}', 'volt-second balance with the drops in it (ESR neglected)')
        : F('D\\,(V_{in} - V_{out}) = (1 - D)\\,V_{out} \\;\\Rightarrow\\; M = \\frac{V_{out}}{V_{in}} = D', 'volt-second balance, and its consequence')

  const blocks = [T(intro), formula]
  if (kind === 'boost' && p.RL > 0) {
    blocks.push(F('M_{max} = \\tfrac{1}{2}\\sqrt{R/R_L} \\;\\text{ at }\\; 1 - D = \\sqrt{R_L/R}, \\qquad \\eta = M\\,(1-D)', 'where the real ratio turns over, and what it costs there'))
  }
  blocks.push(F(RIPPLE_TEX[kind], 'the ripples, in the small-ripple approximation'))
  if (boostLike && dcm) blocks.push(F('P_{out} = \\tfrac{1}{2} L\\, i_{pk}^2 f_s, \\qquad i_{pk} = \\frac{V_{in} D}{L f_s}', 'the inductor empties every cycle, so its energy is the power'))
  blocks.push(C(rows), V(values))
  return { blocks }
}

// The three converters' closed forms, kept beside each other so the family
// resemblance is visible: same balance, different intervals.
const CCM_TEX = {
  buck: 'M = D',
  boost:
    'D\\,V_{in} = (1-D)\\,(V_{out} - V_{in}) \\;\\Rightarrow\\; M = \\frac{1-D}{(1-D)^2 + R_L/R} \\;\\xrightarrow{R_L \\to 0}\\; \\frac{1}{1-D}',
  buckboost:
    'D\\,V_{in} = (1-D)\\,|V_{out}| \\;\\Rightarrow\\; M = -\\frac{D\\,(1-D)}{(1-D)^2 + R_L/R} \\;\\xrightarrow{R_L \\to 0}\\; -\\frac{D}{1-D}',
}
const DCM_TEX = {
  buck: 'M = \\frac{2}{1 + \\sqrt{1 + 4K/D^2}}, \\qquad K = \\frac{2 L f_s}{R} < K_{crit} = 1 - D',
  boost: 'M = \\frac{1 + \\sqrt{1 + 4D^2/K}}{2}, \\qquad K = \\frac{2 L f_s}{R} < K_{crit} = D\\,(1-D)^2',
  buckboost: 'M = -\\frac{D}{\\sqrt{K}}, \\qquad K = \\frac{2 L f_s}{R} < K_{crit} = (1-D)^2',
}
const KCRIT_TEX = { buck: '1 − D', boost: 'D(1 − D)²', buckboost: '(1 − D)²' }
const RIPPLE_TEX = {
  buck: '\\Delta I_L = \\frac{(V_{in} - V_{out})\\,D}{L f_s}, \\qquad \\Delta V_{out} = \\frac{\\Delta I_L}{8 f_s C}',
  boost: '\\Delta I_L = \\frac{V_{in} D}{L f_s}, \\qquad \\Delta V_{out} = \\frac{V_{out} D}{R C f_s}',
  buckboost: '\\Delta I_L = \\frac{V_{in} D}{L f_s}, \\qquad \\Delta V_{out} = \\frac{|V_{out}|\\, D}{R C f_s}',
}

// ------------------------------------------------------------ line side

function rectifierEntry(exp, params, x) {
  const p = x.p
  const m = x.m
  const f = x.formulas
  const conv = x.conv
  const three = conv.threePhase
  const pulses = conv.pulses

  // The textbook ripple takes the capacitor to feed the load for the whole
  // interval between peaks, at a constant current. It recharges for the
  // conduction angle of that interval and the current falls as it sags, so
  // the formula is an overestimate; where the two effects are small it lands
  // within the panel's tolerance and is checked, and where they are not the
  // row says by how much rather than crossing out a formula for being what
  // it is.
  const over = m.ripple > 0 ? f.dVfirst / m.ripple - 1 : 0
  const holdShare = (m.angle * pulses) / 360
  const firstWhy =
    over > 0.02
      ? `The formula assumes the capacitor supplies the load for the whole 1/(${pulses}f) between peaks at a constant current. Here the diodes recharge it for ${(holdShare * 100).toFixed(0)} % of that interval and the load current falls as the voltage sags, so the formula is over by ${(over * 100).toFixed(1)} %.`
      : null
  const holdWhy = m.tHold > 0 ? null : 'The diodes never stop conducting at this setting, so there is no hold interval to measure.'

  const rows = [
    row('ΔV over the hold, V_hold·(1 − e^{−t_hold/RC})', f.dVhold, m.holdDrop, 'V', 1e-6, 1e-9 * conv.Vp, holdWhy),
    row('⟨i_C⟩ over a cycle', 0, m.sig.iC.avg, 'A', 0, 1e-9 * Math.max(1e-3, m.iPeak)),
    {
      ...row(`P_in = P_out + R_s·I_D,rms² + ${conv.nD}·V_f·⟨i_D⟩`, m.Pout + m.Pcond, m.Pin, 'W', 1e-7),
      // A coefficient of one is not worth printing: one diode drop is V_f.
      tex: `P_{in} = P_{out} + R_s I_{D,rms}^2 + ${conv.nD === 1 ? '' : `${conv.nD}\\,`}V_f \\langle i_D \\rangle`,
    },
    row('PF = cos φ₁ · I₁/I_rms', m.displacement * m.distortion, m.pf, '', 1e-7),
    {
      ...row(`ΔV_out, first order I_out/(${pulses}·f·C)`, f.dVfirst, m.ripple, 'V', 0.02, 0, firstWhy),
      tex: `\\Delta V_{out} \\approx \\dfrac{I_{out}}{${pulses === 1 ? '' : `${pulses}`}f C}`,
    },
  ]

  const bare = three ? '3√3·V_p/π = 1.35·V_LL' : pulses === 2 ? '2·V_p/π' : 'V_p/π'
  const values = [
    { label: 'V_p', value: conv.Vp, unit: 'V', note: three ? `phase peak; line-to-line peak √3·V_p = ${fmt(f.Vpk, 'V', 4)}` : '√2 · V_s' },
    { label: 'ceiling', value: f.ceiling, unit: 'V', note: `${three ? '√3·V_p' : 'V_p'} − ${conv.nD}·V_f` },
    { label: 'V_dc', value: m.Vdc, unit: 'V', note: `${fmt(f.ceiling - m.Vdc, 'V', 3)} below the ceiling` },
    { label: 'V_dc with no capacitor', value: f.VdcNoC, unit: 'V', note: `${bare}, the average a bare rectifier gives` },
    { label: 'ripple', value: m.ripple, unit: 'V', note: `${((100 * m.ripple) / m.Vdc).toFixed(2)} % of V_dc` },
    { label: 'conduction angle', value: m.angle, unit: '°', note: `per pulse, ${m.pulses} pulse${m.pulses === 1 ? '' : 's'} per cycle` },
    { label: 'hold', value: m.tHold * 1e3, unit: 'ms', note: `RC = ${fmt(f.RC, 's', 3)}, T = ${fmt(x.T, 's', 3)}` },
    { label: 'i_D peak', value: m.iPeak, unit: 'A', note: `for ⟨i_D⟩ = ${fmt(m.sig.iD.avg, 'A', 3)}` },
    { label: 'form factor I_rms/I_avg', value: m.formFactor, unit: '', note: `heating ×${(m.formFactor ** 2).toFixed(1)} for the same DC` },
    { label: 'PIV', value: m.piv, unit: 'V', note: three ? 'the line-to-line peak' : pulses === 2 ? '≈ V_p' : '≈ 2·V_p: the source peak plus the held capacitor' },
    { label: 'PF', value: m.pf, unit: '', note: `cos φ₁ = ${m.displacement.toFixed(3)}, I₁/I_rms = ${m.distortion.toFixed(3)}` },
    { label: 'THD', value: m.thd * 100, unit: '%' },
    { label: 'series R_s loss', value: m.loss.series * 1e3, unit: 'mW' },
    { label: 'diode loss', value: m.loss.diodes * 1e3, unit: 'mW' },
  ]

  const intro = {
    e1: 'The diode conducts only while the source exceeds the capacitor by its drop, so the capacitor sits near the peak and discharges through the load between pulses. The exact discharge is an RC decay over the hold; the first-order formula pretends it lasts the whole cycle.',
    e2: 'Both half-cycles reach the capacitor, so the hold is half as long and the ripple about half. Two diodes are always in series, so the ceiling is V_p − 2V_f.',
    e3: 'The ripple falls as C grows, but the charge each pulse must deliver does not, so it arrives in a narrower, taller spike. The angle floors where the source resistance limits the gulp.',
    e4: 'Only the fundamental of the current carries power from a sinusoidal source. The rest is harmonics: they heat the wiring and count in the RMS the supply must carry, which is what the power factor measures.',
    e6: 'Six diodes on three phases: the conducting pair is the one with the highest line-to-line voltage, and the output sits near its peak, √3 times a phase peak. Six pulses per cycle leave little for the capacitor to do.',
  }[exp.id]

  return {
    blocks: [
      T(intro),
      F(
        three
          ? `V_{dc} \\le \\sqrt{3}\\,V_p - 2 V_f, \\qquad \\Delta V \\approx \\frac{I_{out}}{6 f C}`
          : `V_{dc} \\le V_p - ${conv.nD === 1 ? '' : '2'}V_f, \\qquad \\Delta V \\approx \\frac{I_{out}}{${pulses === 1 ? '' : '2'} f C}`,
        'the ceiling, and the first-order ripple',
      ),
      F('\\Delta V_{hold} = V_{hold}\\left(1 - e^{-t_{hold}/RC}\\right)', 'what the capacitor alone does between pulses'),
      F('PF = \\frac{P}{V_{rms} I_{rms}} = \\cos\\varphi_1 \\cdot \\frac{I_1}{I_{rms}}', 'power factor as displacement times distortion'),
      C(rows),
      V(values),
    ],
  }
}

function dimmerEntry(exp, params, x) {
  const p = x.p
  const d = x.d
  const m = x.m
  const Vp = d.Vp
  const { alpha, R } = p
  // Independent readings of the closed forms: Simpson on the conducting
  // arc [α, π], where the integrands are smooth.
  const shareNum = (2 / Math.PI) * simpson((th) => Math.sin(th) ** 2, alpha, Math.PI)
  const a1 = (2 / Math.PI) * simpson((th) => Vp * Math.sin(th) * Math.cos(th), alpha, Math.PI)
  const b1 = (2 / Math.PI) * simpson((th) => Vp * Math.sin(th) * Math.sin(th), alpha, Math.PI)
  const I1num = Math.hypot(a1, b1) / Math.SQRT2 / R
  const rows = [
    row('P / P_full = 1 − α/π + sin 2α/(2π)', d.share, shareNum, '', 1e-9, 1e-12),
    {
      ...row('I₁ from a₁ = −(V_p/π) sin²α, b₁ = V_p·(P/P_full)', d.I1, I1num, 'A', 1e-9, 1e-12),
        tex: 'I_1 \\;\\text{from}\\; a_1 = -\\tfrac{V_p}{\\pi}\\sin^2\\alpha,\\; b_1 = V_p \\tfrac{P}{P_{full}}',
    },
    row('PF = cos φ₁ · I₁/I_rms', d.displacement * d.distortion, d.pf, '', 1e-9, 1e-12),
  ]
  const values = [
    { label: 'P_full', value: d.Pfull, unit: 'W', note: 'V_s² / R, at α = 0' },
    { label: 'P', value: d.P, unit: 'W' },
    { label: 'V_rms', value: d.Vrms, unit: 'V', note: 'V_s · √(P/P_full)' },
    { label: 'I_rms', value: d.Irms, unit: 'A' },
    { label: 'I₁', value: d.I1, unit: 'A', note: `lagging ${((-d.phi1 * 180) / Math.PI).toFixed(1)}°` },
    { label: 'PF', value: d.pf, unit: '', note: `= √(P/P_full); cos φ₁ = ${d.displacement.toFixed(3)}, I₁/I_rms = ${d.distortion.toFixed(3)}` },
    { label: 'THD', value: d.thd * 100, unit: '%' },
  ]
  return {
    blocks: [
      T('The load sees the sine from α to π in each half-cycle. Its power is the integral of sin² over that arc, in closed form; the fundamental of the chopped wave lags because its weight has moved late in the half-cycle, and everything above it is harmonics.'),
      F('\\frac{P}{P_{full}} = 1 - \\frac{\\alpha}{\\pi} + \\frac{\\sin 2\\alpha}{2\\pi}, \\qquad V_{rms} = V_s\\sqrt{P/P_{full}}, \\qquad PF = \\sqrt{P/P_{full}}', 'a resistive load, so the power factor is the RMS ratio'),
      F('a_1 = -\\frac{V_p}{\\pi}\\sin^2\\alpha, \\qquad b_1 = V_p\\,\\frac{P}{P_{full}}, \\qquad \\varphi_1 = \\operatorname{atan2}(a_1, b_1)', 'the fundamental of the phase-cut sine'),
      C(rows),
      V(values),
    ],
  }
}
