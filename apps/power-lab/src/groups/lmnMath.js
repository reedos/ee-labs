// The math panel for Groups L, M and N.
//
// Every check row puts a closed form against a measurement that did not use
// it. Where the settings put a form outside its own assumptions the row is
// footnoted with the reason rather than crossed out, which is the pattern
// `math.js` set for the buck's ripple.
//
// The rows that are identities carry an absolute tolerance and nothing else:
// volt-second balance, charge balance, the torque balance, the power books
// and the mean rise under a pulse are all exact in periodic steady state, so
// a tolerance on them would be hiding something.

import { fmt } from '@ee-labs/ui'
import { stepRise, fosterZth } from '@ee-labs/switched'

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.01, abs = 0, unchecked = null, tex = null) => ({
  label,
  predicted,
  measured,
  unit,
  tol,
  abs,
  ...(unchecked ? { unchecked } : {}),
  ...(tex ? { tex } : {}),
})

/** The entry for one of the nine, chosen by its kind. */
export function lmnMath(exp, params, x) {
  if (exp.kind === 'emi') return emiEntry(exp, x)
  if (exp.kind === 'ringing') return ringEntry(exp, x)
  if (exp.kind === 'thermal') return thermalEntry(exp, x)
  return driveEntry(exp, x)
}

// ------------------------------------------------------------ the drives

const DRIVE_TEX =
  'L_a \\frac{di_a}{dt} = v - (R_a + r)\\, i_a - k\\,\\omega, \\qquad J \\frac{d\\omega}{dt} = k\\, i_a - B\\,\\omega - T_L'

const DRIVE_INTRO = {
  l1:
    'The armature is a resistance and an inductance with one more voltage in series, the back EMF k·ω. ' +
    'The shaft is a second state on the same footing, so the pair is solved together and the speed ripple ' +
    'is measured rather than assumed away.',
  l2:
    'A full bridge is the same two states with the terminals free to take either sign. The average ' +
    'terminal voltage is (2D − 1)·V_dc, so half duty commands zero and everything below it commands ' +
    'reverse. What the rail supplies follows the same sign.',
  l3:
    'Two of the three phases carry the link current at a time, so the electrical circuit is that pair in ' +
    'series. Its resistance and inductance are twice one phase’s, and its EMF constant is twice the ' +
    'magnet’s flux linkage times the pole pairs.',
}

function driveEntry(exp, x) {
  const m = x.m
  const f = x.formulas
  const p = x.p
  const dcm = x.ss.mode === 'DCM'
  const dcmWhy = dcm
    ? 'The armature current reaches zero inside the off interval, so the terminals float at the back EMF for the rest of it and the duty no longer sets the average.'
    : null
  // The written ripple takes the ramp as a straight line. It is one while the
  // period is short against the armature's own time constant, and the panel
  // says how short that is here.
  const periods = (p.fs * f.La) / f.Ra
  const rampWhy =
    periods < 10
      ? `The armature settles in ${fmt(f.La / f.Ra, 's', 3)}, which is only ${periods.toFixed(1)} switching periods, so the current curves inside each interval instead of ramping.`
      : null
  const scaleV = Math.max(1e-9, p.Vdc)
  const scaleI = Math.max(1e-9, Math.abs(m.sig.iL.max))
  const rows = [
    row('⟨v_L⟩ over a period', 0, m.sig.vL.avg, 'V', 0, 1e-9 * scaleV, null, '\\langle v_L \\rangle \\;\\text{over a period}'),
    row('⟨v_a⟩ the duty commands', f.Va, m.sig.vout.avg, 'V', 1e-7, 1e-9 * scaleV, dcmWhy, '\\langle v_a \\rangle = D V_{dc}'),
    row('T_e against the load', m.torqueLoad, m.torque, 'N·m', 1e-6, 0, null, 'T_e = B\\,\\omega + T_L'),
    row('ω the averaged machine gives', f.avg.omega, m.omega, 'rad/s', 1e-6, 1e-9, dcmWhy, '\\omega \\;\\text{from}\\; k(V_a - k\\omega)/R_a = B\\omega + T_L'),
    row('ΔI_a', f.dI, m.sig.iL.pp, 'A', 0.02, 1e-9 * scaleI, dcm ? dcmWhy : rampWhy, '\\Delta I_a'),
    row('P_in = P_shaft + Σ losses', m.Pout + m.Pcond, m.Pin, 'W', 1e-6, 0, null, 'P_{in} = P_{shaft} + \\sum \\text{losses}'),
  ]
  const values = [
    { label: 'terminal voltage', value: f.Va, unit: 'V', note: `${(p.D * 100).toFixed(1)} % of ${fmt(p.Vdc, 'V', 3)}` },
    { label: 'speed', value: m.rpm, unit: 'rpm', note: `${fmt(m.omega, 'rad/s', 4)}, no-load ${fmt((f.noLoad * 60) / (2 * Math.PI), 'rpm', 4)}` },
    { label: 'torque', value: m.torque, unit: 'N·m', note: `k·⟨i_a⟩, stall ${fmt(f.stall, 'N·m', 3)}` },
    { label: 'armature ripple', value: m.ripple, unit: 'A', note: `${((100 * m.ripple) / Math.max(1e-12, Math.abs(m.Iavg))).toFixed(1)} % of the mean` },
    { label: 'speed ripple', value: m.omegaRipple, unit: 'rad/s', note: `${(m.omegaRipple / Math.max(1e-12, Math.abs(m.omega))).toExponential(2)} of the speed` },
    { label: 'τ_e against τ_m', value: f.avg.separated, unit: '', note: `${fmt(f.avg.tauE, 's', 3)} and ${fmt(f.avg.tauM, 's', 3)}` },
    { label: 'from the rail', value: m.Iin, unit: 'A', note: m.regenerating ? 'negative: the shaft is driving the bridge' : 'positive: the rail is driving the shaft' },
    {
      label: 'η',
      value: m.eta * 100,
      unit: '%',
      note:
        m.delivering === 'shaft'
          ? 'the shaft’s power over the rail’s'
          : m.delivering === 'rail'
            ? 'braking: the rail’s power over the shaft’s'
            : 'the rail and the shaft both feed the losses, so nothing is delivered',
    },
  ]
  if (f.comm) {
    values.push(
      { label: 'electrical frequency', value: f.comm.fe, unit: 'Hz', note: `${f.comm.pairs} pole pairs` },
      { label: 'one sector', value: f.comm.sector, unit: 's', note: `60°, ${f.comm.rate.toFixed(0)} commutations a second` },
      { label: 'periods in a sector', value: f.comm.periodsPerSector, unit: '', note: 'switching periods between commutations' },
      { label: 'phase current, rms', value: f.comm.phaseShare * m.Irms, unit: 'A', note: '√(2/3) of the link current: 120° of every 180°' },
    )
  }
  return {
    blocks: [
      T(DRIVE_INTRO[exp.id]),
      F(DRIVE_TEX, 'the armature and the shaft, one linear system inside each switch state'),
      F(
        exp.kind === 'hbridge'
          ? '\\langle v_a \\rangle = (2D - 1) V_{dc}, \\qquad \\Delta I_a = \\frac{2 V_{dc} D (1-D)}{L_a f_s}'
          : '\\langle v_a \\rangle = D\\, V_{dc}, \\qquad \\Delta I_a = \\frac{V_{dc} D (1-D)}{L_a f_s}',
        'what the duty commands, and the ripple it leaves',
      ),
      C(rows),
      V(values),
    ],
  }
}

// ------------------------------------------------------------ the input side

function emiEntry(exp, x) {
  const m = x.m
  const f = x.formulas
  const p = x.p
  const I = m.sig.iL.avg
  const ripple = Math.abs(I) > 0 ? m.sig.iL.pp / Math.abs(I) : Infinity
  // The series describes a rectangle of height I. What the switch gates is a
  // trapezoid, and once the current changes sign inside the interval it is
  // not even that, so the row says so rather than comparing two shapes.
  const pulseWhy =
    m.sig.iL.min < 0
      ? 'The inductor current changes sign inside the period, so what the switch gates is not a one-sided pulse and this series does not describe it.'
      : ripple > 0.5
        ? `The inductor ripples ${(100 * ripple).toFixed(0)} % of its mean, so what the switch gates is a trapezoid rather than the rectangle this series describes.`
        : null
  const first = f.pulse[0]
  const scaleI = Math.max(1e-9, Math.abs(m.sig.iL.max))
  const rows = [
    row('⟨v_L⟩ over a period', 0, m.sig.vL.avg, 'V', 0, 1e-9 * p.Vin, null, '\\langle v_L \\rangle \\;\\text{over a period}'),
    row('⟨i_Cin⟩ over a period', 0, m.sig.icin.avg, 'A', 0, 1e-8 * scaleI, null, '\\langle i_{Cin} \\rangle \\;\\text{over a period}'),
    row('⟨i_line⟩ = ⟨i_in⟩', m.sig.iin.avg, m.sig.iline.avg, 'A', 1e-6, 1e-9 * scaleI, null, '\\langle i_{line} \\rangle = \\langle i_{in} \\rangle'),
    row('the first harmonic of the pulse train', first.ideal, first.peak, 'A', 0.05, 1e-9 * scaleI, pulseWhy, '\\hat{I}_1 = \\frac{2 I |\\sin \\pi D|}{\\pi}'),
    row('i_line / i_in at f_s', f.predicted, f.attenuation, '', 1e-6, 1e-12, null, '\\frac{i_{line}}{i_{in}} = \\frac{1}{|1 + j\\omega C_{in} Z_{branch}|}'),
    row('P_in = P_out + Σ losses', m.Pout + m.Pcond, m.Pin, 'W', 1e-6, 0, null, 'P_{in} = P_{out} + \\sum \\text{losses}'),
  ]
  const values = [
    { label: 'input current, average', value: m.Iconv, unit: 'A', note: `D times the ${fmt(I, 'A', 4)} the inductor carries` },
    { label: 'input current, peak to peak', value: m.convRipple, unit: 'A', note: 'the whole pulse, edge to edge' },
    { label: 'the capacitor’s share', value: m.sig.icin.rms, unit: 'A', note: `against I√(D(1−D)) = ${fmt(f.Icap, 'A', 4)}` },
    { label: 'input ripple', value: m.cinRipple, unit: 'V', note: 'peak to peak on the input capacitor' },
    { label: 'line ripple', value: m.lineRipple, unit: 'A', note: 'peak to peak, what the source sees' },
    { label: 'filter corner', value: f.f0, unit: 'Hz', note: `Q = ${Number.isFinite(f.Q) ? f.Q.toFixed(1) : '∞'}, Z₀ = ${fmt(f.Z0, 'Ω', 3)}` },
    { label: 'rejection at f_s', value: f.rejection, unit: '', note: `${fmt(f.attenuation * m.conv1, 'A', 3)} of ${fmt(m.conv1, 'A', 3)}` },
    { label: 'Z_out of the filter', value: f.middlebrook.Zout, unit: 'Ω', note: `its peak, at ${fmt(f.middlebrook.atF, 'Hz', 3)}` },
    { label: 'Z_in of the converter', value: f.middlebrook.Zin, unit: 'Ω', note: 'V_in²/P_in, and negative to a loop that holds the output' },
    {
      label: 'Middlebrook’s ratio',
      value: f.middlebrook.ratio,
      unit: '',
      note: f.middlebrook.safe ? 'well under one, so the rule holds' : 'at or over one, which the rule forbids',
    },
  ]
  const harmonics = f.pulse.slice(0, 5).map((h) => ({
    label: `harmonic ${h.k}, at ${fmt(h.k * p.fs, 'Hz', 3)}`,
    value: h.peak,
    unit: 'A',
    note: `closed form ${fmt(h.ideal, 'A', 3)}, at the line ${fmt(h.line, 'A', 3)}`,
  }))
  return {
    blocks: [
      T(
        'A buck draws its input current in pulses: the inductor’s current while the switch is closed, and ' +
          'nothing while it is open. The capacitor beside the switch supplies the alternating part, and the ' +
          'inductance in the line keeps the rest off the source.',
      ),
      F('\\hat{I}_k = \\frac{2 I}{k\\pi} \\left| \\sin k\\pi D \\right|, \\qquad \\langle i_{in} \\rangle = D\\, I', 'the pulse train, harmonic by harmonic'),
      F(
        '\\frac{i_{line}}{i_{in}} = \\frac{1}{1 + j\\omega C_{in} Z_{branch}}, \\qquad Z_{branch} = (R_f + j\\omega L_f) \\parallel R_d',
        'Kirchhoff at the input node, with a rail that carries no alternating voltage',
      ),
      C(rows),
      V(values),
      V(harmonics),
    ],
  }
}

// ------------------------------------------------------------ the switch node

function ringEntry(exp, x) {
  const m = x.m
  const f = x.formulas
  const p = x.p
  const meas = m.measured
  // The peak finder needs two maxima inside the on interval, and the closed
  // form describes a ring that started from rest, so it needs the previous
  // interval to have been long enough for the last one to have died away.
  const tau = 2 * p.Rp * f.Ctotal
  const settled = Math.min(p.D, 1 - p.D) / p.fs > 4 * tau
  const cyclesOn = f.fr * (p.D / p.fs)
  const notFound = !meas ? 'The node does not complete two ring cycles inside the on interval at this setting, so there is no period to read off the waveform.' : null
  const ringWhy =
    notFound ||
    (f.snubbed && p.Rsn * f.Ctotal * 2 * Math.PI * f.fr > 0.5
      ? 'The snubber’s resistance is large beside its own reactance at the ring, so only part of C_sn joins the node and the form over-counts it.'
      : cyclesOn < 2.5
        ? 'Fewer than three ring cycles fit the on interval, so the two maxima the reading needs sit on the interval’s own ends.'
        : !settled
          ? 'The previous interval is shorter than four decay times, so the last ring had not died away and the peaks this one is read from sit on top of it.'
          : null)
  const overWhy =
    notFound ||
    (!settled
      ? 'The previous interval is shorter than four decay times, so the node was still moving when this edge arrived and the overshoot is measured from somewhere other than rest.'
      : f.snubbed
        ? 'The snubber damps the node through its own resistance, which this form does not carry: it has only the loop’s damping in it.'
        : null)
  const scaleV = Math.max(1e-9, p.Vin)
  const rows = [
    row('⟨v_sw⟩ = D·V_in', f.Vsw, m.sig.vsw.avg, 'V', 1e-6, 1e-9 * scaleV, null, '\\langle v_{sw} \\rangle = D V_{in}'),
    row('⟨v_L⟩ over a period', 0, m.sig.vL.avg, 'V', 0, 1e-8 * scaleV, null, '\\langle v_L \\rangle \\;\\text{over a period}'),
    row('⟨v_out⟩ from the node', m.sig.vsw.avg - p.RL * m.sig.iL.avg, m.sig.vout.avg, 'V', 1e-6, 1e-8 * scaleV, null, '\\langle v_{out} \\rangle = \\langle v_{sw} \\rangle - R_L \\langle i_L \\rangle'),
    // The peaks are spaced by the undamped period to second order in ζ, so
    // the tolerance carries that term rather than a number chosen to pass.
    row('the ring frequency', f.f0, meas ? meas.f : NaN, 'Hz', 0.01 + 2 * f.zeta * f.zeta, 0, ringWhy, 'f_r = \\frac{1}{2\\pi\\sqrt{L_p C}}'),
    row('the overshoot', f.overshoot, m.overshoot, '', 0.05, 0.005, overWhy, '\\exp\\!\\left(\\frac{-\\zeta\\pi}{\\sqrt{1-\\zeta^2}}\\right)'),
    row('P_in = P_out + Σ losses', m.Pout + m.Pcond, m.Pin, 'W', 1e-5, 0, null, 'P_{in} = P_{out} + \\sum \\text{losses}'),
  ]
  const values = [
    { label: 'on the node', value: f.Ctotal, unit: 'F', note: f.snubbed ? `C_p and the snubber's ${fmt(p.Csn, 'F', 3)}` : 'the diode’s own capacitance' },
    { label: 'ring frequency', value: f.f0, unit: 'Hz', note: meas ? `read off the waveform as ${fmt(meas.f, 'Hz', 5)}` : 'not resolved inside the interval' },
    { label: 'ζ', value: f.zeta, unit: '', note: `Q = ${Number.isFinite(f.Q) ? f.Q.toFixed(2) : '∞'}` },
    { label: 'ring cycles a period', value: f.cycles, unit: '' },
    { label: 'peak on the node', value: m.peak, unit: 'V', note: `${(100 * m.overshoot).toFixed(1)} % over a ${fmt(p.Vin, 'V', 3)} rail` },
    { label: 'energy on the node', value: f.Ep, unit: 'J', note: '½C_p·V², spent at every edge' },
    { label: 'the loop’s dissipation', value: m.loss.parasitic, unit: 'W' },
    { label: 'the snubber’s dissipation', value: m.loss.snubber, unit: 'W', note: f.snubbed ? `C_sn·V²·f_s is ${fmt(f.Psn, 'W', 3)}` : 'no snubber fitted' },
    { label: 'η', value: m.eta * 100, unit: '%' },
  ]
  return {
    blocks: [
      T(
        'The loop from the rail through the switch to the node has inductance, and the node has ' +
          'capacitance. Together they are a series resonant circuit that the switch steps twice a period, ' +
          'so the node rings at every edge and the ring is what radiates.',
      ),
      F(
        'f_r = \\frac{1}{2\\pi\\sqrt{L_p C}}, \\qquad \\zeta = \\frac{1}{2 R_p}\\sqrt{\\frac{L_p}{C}}, \\qquad \\hat{v} = V_{in}\\left(1 + e^{-\\zeta\\pi/\\sqrt{1-\\zeta^2}}\\right)',
        'the node, in three statements',
      ),
      F('P_{sn} = C_{sn} V_{in}^2 f_s', 'what a snubber costs, whatever its resistance is'),
      C(rows),
      V(values),
    ],
  }
}

// ------------------------------------------------------------ the thermal

const THERMAL_INTRO = {
  n1:
    'Every watt the ledger accounts for leaves as heat, and it leaves down a resistance measured in ' +
    'kelvins per watt. The stages from junction to ambient add, so the steady rise is the loss times ' +
    'their sum, and the junction limit fixes how much loss the package will take.',
  n2:
    'The stages do not respond together. A die reaches its own temperature in milliseconds and a heatsink ' +
    'in minutes, so a load that comes and goes quickly is felt as its average, and one that comes and ' +
    'goes slowly is felt whole.',
  n3:
    'Conduction does not follow the switching frequency and the edges do, so the loss is a straight line ' +
    'in f_s. Through the thermal resistance that line is a junction temperature, and where it crosses ' +
    'the limit is the frequency this package can afford.',
}

function thermalEntry(exp, x) {
  const m = x.m
  const t = m.thermal
  const led = m.ledger
  const net = t.net
  // Far enough out that every mode has settled: an RC network's slowest time
  // constant is never longer than the sum of its resistances times the sum of
  // its capacitances.
  const far = 60 * net.Rtotal * net.Ctotal
  const settled = stepRise(net, t.P, [far])[0]
  const probe = Math.min(1, 3 * Math.max(...net.taus) )
  const zProbe = stepRise(net, 1, [probe])[0]
  const cauerWhy =
    t.model === 'cauer'
      ? 'A ladder has no closed form for its step response: its own time constants are the eigenvalues of the whole network rather than the stages’ own.'
      : null
  const rows = [
    row('the steady rise, from the propagator', t.P * net.Rtotal, settled, 'K', 1e-6, 0, null, '\\Delta T_\\infty = P \\sum R_{th}'),
    row('Z_th on the way there', fosterZth(t.stages, probe), zProbe, 'K/W', 1e-6, 0, cauerWhy, 'Z_{th}(t) = \\sum R_i \\left(1 - e^{-t/\\tau_i}\\right)'),
    row('the mean rise under a pulse', t.pulse.flat, t.pulse.mean, 'K', 1e-7, 0, null, '\\langle \\Delta T \\rangle = \\langle P \\rangle \\sum R_{th}'),
    row('P_in = P_out + Σ conduction', led.Pout + led.conduction, led.Pin, 'W', 1e-7, 0, null, 'P_{in} = P_{out} + \\sum \\text{conduction}'),
  ]
  const values = [
    { label: 'delivered', value: led.Pout, unit: 'W', note: `η = ${(100 * led.eta).toFixed(2)} %` },
    { label: 'conduction', value: t.conduction, unit: 'W', note: 'flat in the switching frequency' },
    { label: 'the edges', value: t.switching, unit: 'W', note: `${fmt(t.kSw, 'W/Hz', 3)} of switching` },
    { label: 'lost in all', value: t.P, unit: 'W' },
    { label: 'thermal resistance', value: net.Rtotal, unit: 'K/W', note: `${t.model === 'cauer' ? 'a ladder' : 'three stages'}, ${net.taus.map((q) => fmt(q, 's', 2)).join(', ')}` },
    { label: 'rise above ambient', value: t.rise, unit: 'K' },
    { label: 'junction temperature', value: t.Tj, unit: '°C', note: `ambient ${t.Ta.toFixed(1)} °C, limit ${t.Tjmax.toFixed(0)} °C` },
    { label: 'headroom', value: t.headroom, unit: 'K', note: t.headroom > 0 ? 'left before the limit' : 'past the limit' },
    { label: 'the package’s budget', value: t.Pmax, unit: 'W', note: `(T_j,max − T_a)/R_th, ${(100 * t.margin).toFixed(0)} % of it spent` },
    {
      label: 'the frequency it can afford',
      value: t.ceiling.feasible ? t.ceiling.fs : 0,
      unit: 'Hz',
      note: t.ceiling.feasible ? 'where the whole budget is spent' : 'conduction alone already exceeds the budget',
    },
    { label: 'peak under the pulse', value: t.Ta + t.pulse.peak, unit: '°C', note: `swing ${fmt(t.pulse.swing, 'K', 3)} about ${fmt(t.pulse.mean, 'K', 3)}` },
  ]
  return {
    blocks: [
      T(THERMAL_INTRO[exp.id]),
      F('T_j = T_a + P \\sum R_{th}, \\qquad P_{max} = \\frac{T_{j,max} - T_a}{\\sum R_{th}}', 'the steady state, and the limit it works to'),
      F('Z_{th}(t) = \\sum_i R_i \\left(1 - e^{-t/\\tau_i}\\right), \\qquad C_i = \\tau_i / R_i', 'the stages a datasheet is fitted with'),
      F('f_{s,max} = \\frac{(T_{j,max} - T_a)/\\sum R_{th} - P_{cond}}{\\tfrac{1}{2} V (t_r + t_f) I}', 'where the frequency runs out of thermal budget'),
      C(rows),
      V(values),
    ],
  }
}

export const LMN_MATH = lmnMath
