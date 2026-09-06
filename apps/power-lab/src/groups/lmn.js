// Groups L, M and N: motor drives, interference, and heat.
//
// Everything the three groups add to the lab lives here, as named tables the
// app's own files pick up with one line each. That is what lets three lanes
// build three groups at once and be merged by union: nothing in
// `experiments.js`, `analysis.js`, `math.js` or `terms.js` is edited, only
// appended to.
//
// The engines are `packages/switched`'s `drive.js`, `emi.js` and
// `thermal.js`. Every number a note quotes came out of
// `scripts/pins-lmn.mjs` first and is pinned in `src/lmn.test.js`.

import { fmt } from '@ee-labs/ui'
import {
  drive,
  driveSteadyState,
  driveMeasures,
  driveAveraged,
  driveBalance,
  armatureRipple,
  commutation,
  DRIVE_DEFAULTS,
  emiConverter,
  ringConverter,
  emiSteadyState,
  emiMeasures,
  ringMeasures,
  emiHarmonics,
  pulseHarmonic,
  EMI_DEFAULTS,
  RING_DEFAULTS,
  converter,
  steadyState,
  measures,
  waveforms,
  lossLedger,
  stagesOf,
  thermalNetwork,
  zth,
  fosterZth,
  pulsedRise,
  derating,
  frequencyCeiling,
  edgeCost,
  THERMAL_DEFAULTS,
} from '@ee-labs/switched'
import { balanceOf } from '../analysis.js'

// ------------------------------------------------------------ the groups

export const LMN_GROUPS = ['Motor drives', 'Interference', 'Thermal']

export const LMN_GROUP_INTROS = {
  'Motor drives':
    'A motor is not a resistor. This group puts a machine under the bridge, drives it both ways, and ' +
    'commutates a brushless one, with the shaft carried as a second state the solver steps.',
  Interference:
    'Every converter pushes a pulse train back into its own supply. This group measures those harmonics, ' +
    'filters them, and finds the ring the switch node makes at each edge.',
  Thermal:
    'A watt of loss is a rise in temperature. This group reads the ledger’s total as degrees, follows ' +
    'it through the network that carries it, and prices the switching frequency in junction heat.',
}

// ------------------------------------------------------------ the knobs

const Vdc = (def = 48) => ({ key: 'Vdc', label: 'V_dc', unit: 'V', min: 6, max: 400, scale: 'log', default: def, hint: 'The DC link the bridge switches' })
const Duty = (def = 0.5) => ({ key: 'D', label: 'D', unit: '%', percent: true, min: 0.02, max: 0.98, scale: 'linear', step: 0.001, default: def, hint: 'Duty: the share of each period the switch is on' })
const FsDrive = (def = 20e3) => ({ key: 'fs', label: 'f_s', unit: 'Hz', min: 1e3, max: 100e3, scale: 'log', default: def, hint: 'Chopping frequency' })
const Ra = (def = 1.2) => ({ key: 'Ra', label: 'R_a', unit: 'Ω', min: 0.05, max: 20, scale: 'log', default: def, hint: 'Armature resistance' })
const La = (def = 3e-3) => ({ key: 'La', label: 'L_a', unit: 'H', min: 100e-6, max: 50e-3, scale: 'log', default: def, hint: 'Armature inductance' })
const Kmot = (def = 0.06) => ({ key: 'k', label: 'k', unit: 'V·s/rad', min: 0.005, max: 1.5, scale: 'log', default: def, hint: 'Volts per radian a second, and newton-metres per amp: one number' })
const Jrot = (def = 2e-4) => ({ key: 'J', label: 'J', unit: 'kg·m²', min: 1e-5, max: 5e-3, scale: 'log', default: def, hint: 'Rotor inertia' })
const Bfric = (def = 1e-5) => ({ key: 'B', label: 'B', unit: 'N·m·s/rad', min: 1e-6, max: 1e-3, scale: 'log', default: def, hint: 'Viscous friction on the shaft' })
const Tload = (def = 0.05) => ({ key: 'TL', label: 'T_L', unit: 'N·m', min: 1e-3, max: 2, scale: 'log', default: def, hint: 'Load torque the shaft has to push' })
const Bipolar = (def = 1) => ({ key: 'bipolar', label: 'Modulation', kind: 'toggle', default: def, on: 'bipolar', off: 'unipolar', hint: 'Whether the terminals swing between the rails or between one rail and zero' })
const Lambda = (def = 0.02) => ({ key: 'lambda', label: 'λ', unit: 'Wb', min: 0.002, max: 0.2, scale: 'log', default: def, hint: 'Magnet flux linkage of one phase' })
const Rphase = (def = 0.5) => ({ key: 'Rs', label: 'R_s', unit: 'Ω', min: 0.02, max: 5, scale: 'log', default: def, hint: 'Resistance of one phase' })
const Lphase = (def = 1.5e-3) => ({ key: 'Ls', label: 'L_s', unit: 'H', min: 50e-6, max: 20e-3, scale: 'log', default: def, hint: 'Inductance of one phase' })

const Vin = (def = 24) => ({ key: 'Vin', label: 'V_in', unit: 'V', min: 5, max: 400, scale: 'log', default: def, hint: 'Input voltage' })
const Lout = (def = 100e-6) => ({ key: 'L', label: 'L', unit: 'H', min: 1e-6, max: 10e-3, scale: 'log', default: def, hint: 'Output inductance' })
const Cout = (def = 100e-6) => ({ key: 'C', label: 'C', unit: 'F', min: 1e-6, max: 10e-3, scale: 'log', default: def, hint: 'Output capacitance' })
const Rload = (def = 6) => ({ key: 'R', label: 'R_load', unit: 'Ω', min: 0.5, max: 1000, scale: 'log', default: def, hint: 'Load resistance' })
const FsEmi = (def = 100e3) => ({ key: 'fs', label: 'f_s', unit: 'Hz', min: 20e3, max: 1e6, scale: 'log', default: def, hint: 'Switching frequency' })
const Lfilt = (def = 1e-6) => ({ key: 'Lf', label: 'L_f', unit: 'H', min: 0.5e-6, max: 470e-6, scale: 'log', default: def, hint: 'Inductance in the supply line, stray or fitted' })
const Cinput = (def = 100e-6) => ({ key: 'Cin', label: 'C_in', unit: 'F', min: 1e-6, max: 1e-3, scale: 'log', default: def, hint: 'Input capacitor, where the switch draws its pulses' })
const Rfilt = (def = 0.05) => ({ key: 'Rf', label: 'R_f', unit: 'Ω', min: 0.005, max: 2, scale: 'log', default: def, hint: 'Resistance of the line inductor' })
const Rdamp = (def = 1e4) => ({ key: 'Rd', label: 'R_d', unit: 'Ω', min: 0.2, max: 1e4, scale: 'log', default: def, hint: 'Damping resistor across the line inductor' })

const FsRing = (def = 1e6) => ({ key: 'fs', label: 'f_s', unit: 'Hz', min: 500e3, max: 4e6, scale: 'log', default: def, hint: 'Switching frequency' })
const Lpar = (def = 100e-9) => ({ key: 'Lp', label: 'L_p', unit: 'H', min: 20e-9, max: 1e-6, scale: 'log', default: def, hint: 'Inductance of the loop from the rail to the node' })
const Cpar = (def = 1e-9) => ({ key: 'Cp', label: 'C_p', unit: 'F', min: 470e-12, max: 10e-9, scale: 'log', default: def, hint: 'Capacitance on the switch node' })
const Rpar = (def = 50) => ({ key: 'Rp', label: 'R_p', unit: 'Ω', min: 5, max: 500, scale: 'log', default: def, hint: 'What damps the loop, across the inductance rather than in series with it' })
const Snub = (def = 0) => ({ key: 'snubber', label: 'Snubber', kind: 'toggle', default: def, on: 'fitted', off: 'none', hint: 'A resistor and capacitor across the node' })
const Csnub = (def = 2.2e-9) => ({ key: 'Csn', label: 'C_sn', unit: 'F', min: 470e-12, max: 10e-9, scale: 'log', default: def, hint: 'Snubber capacitance' })
const Rsnub = (def = 10) => ({ key: 'Rsn', label: 'R_sn', unit: 'Ω', min: 5, max: 200, scale: 'log', default: def, hint: 'Snubber resistance' })

const FsTherm = (def = 300e3) => ({ key: 'fs', label: 'f_s', unit: 'Hz', min: 20e3, max: 3e6, scale: 'log', default: def, hint: 'Switching frequency' })
const Ron = (def = 0.03) => ({ key: 'Ron', label: 'R_on', unit: 'Ω', min: 0, max: 0.5, scale: 'linear', step: 0.001, default: def, hint: 'On-resistance of each switch' })
const RL = (def = 0.02) => ({ key: 'RL', label: 'R_L', unit: 'Ω', min: 0, max: 0.5, scale: 'linear', step: 0.001, default: def, hint: 'Inductor winding resistance' })
const Tsw = (def = 20e-9) => ({ key: 'tsw', label: 't_sw', unit: 's', min: 0, max: 200e-9, scale: 'linear', step: 1e-9, default: def, hint: 'Switch rise and fall time (each edge)' })
const Tamb = (def = 25) => ({ key: 'Ta', label: 'T_a', unit: '°C', min: 0, max: 80, scale: 'linear', step: 0.1, default: def, hint: 'Ambient temperature' })
const Tjmax = (def = 150) => ({ key: 'Tjmax', label: 'T_j,max', unit: '°C', min: 100, max: 200, scale: 'linear', step: 0.25, default: def, hint: 'The junction temperature the device is rated to' })
const Rth1 = (def = 0.6) => ({ key: 'R1', label: 'R_th1', unit: 'K/W', min: 0.05, max: 5, scale: 'log', default: def, hint: 'Junction to case' })
const Tau1 = (def = 1e-3) => ({ key: 'tau1', label: 'τ₁', unit: 's', min: 1e-5, max: 0.1, scale: 'log', default: def, hint: 'Time constant of the first stage' })
const Rth2 = (def = 1.4) => ({ key: 'R2', label: 'R_th2', unit: 'K/W', min: 0.05, max: 10, scale: 'log', default: def, hint: 'Case to sink' })
const Tau2 = (def = 0.1) => ({ key: 'tau2', label: 'τ₂', unit: 's', min: 1e-3, max: 10, scale: 'log', default: def, hint: 'Time constant of the second stage' })
const Rth3 = (def = 12) => ({ key: 'R3', label: 'R_th3', unit: 'K/W', min: 0.5, max: 60, scale: 'log', default: def, hint: 'Sink to ambient' })
const Tau3 = (def = 300) => ({ key: 'tau3', label: 'τ₃', unit: 's', min: 1, max: 3000, scale: 'log', default: def, hint: 'Time constant of the third stage' })
const Model = (def = 0) => ({ key: 'model', label: 'Network', kind: 'toggle', default: def, on: 'ladder', off: 'stages', hint: 'A Cauer ladder, whose nodes are temperatures, or the Foster stages a datasheet fits' })
const PulsePeriod = (def = 1) => ({ key: 'pulsePeriod', label: 'period', unit: 's', min: 1e-4, max: 1000, scale: 'log', default: def, hint: 'How often the load comes and goes' })
const PulseDuty = (def = 0.5) => ({ key: 'pulseDuty', label: 'on time', unit: '%', percent: true, min: 0.02, max: 0.98, scale: 'linear', step: 0.001, default: def, hint: 'The share of each cycle the load is on' })

// ------------------------------------------------------------ the tables

/** Four signals the built groups had no part for. */
export const LMN_TRACES = {
  vemf: { label: 'e', axis: 'V', title: 'Back EMF: the voltage the turning rotor makes, k·ω' },
  vcin: { label: 'v_Cin', axis: 'V', title: 'Voltage on the input capacitor, where the switch draws its pulses' },
  icin: { label: 'i_Cin', axis: 'A', title: 'Current the input capacitor carries' },
  iline: { label: 'i_line', axis: 'A', title: 'Current the source supplies, through the line inductance' },
}

export const LMN_TRACE_COLORS = {
  vemf: '#f4a261',
  vcin: '#b5e48c',
  icin: '#ffd166',
  iline: '#8ecae6',
}

/** Where the new signals sit in the measures table: voltages, then currents. */
export const LMN_ORDER = ['vemf', 'vcin', 'icin', 'iline']

export const LMN_VIEWS = {
  drive: { label: 'Drive', title: 'The shaft: speed, torque, and the averaged machine beside the exact one' },
  filter: { label: 'Filter', title: 'The harmonics the converter draws, and what reaches the line' },
  ring: { label: 'Ring', title: 'The switch node’s ring, against the frequency and damping the parasitics set' },
  thermal: { label: 'Thermal', title: 'The junction, the network that cools it, and the limit it works to' },
}

export const LMN_SWEEP_X = {
  Rd: { label: 'R_d', unit: 'Ω', scale: 'log' },
}

export const LMN_SWEEP_Y = {
  speed: { label: 'speed', unit: 'rpm' },
  torque: { label: 'T_e', unit: 'N·m' },
  iin: { label: '⟨i_in⟩', unit: 'A' },
  ripple: { label: 'ΔI_a', unit: 'A', lo: 0 },
  att: { label: 'i_line / i_conv at f_s', unit: '', scale: 'log' },
  mb: { label: 'Z_out / Z_in', unit: '', scale: 'log' },
  Tj: { label: 'T_j', unit: '°C' },
}

/** The top bar's third meter, for the meters the built groups had no need of. */
export const LMN_HEADLINES = {
  ripple: (m) => ({ label: 'line ripple', value: fmt(m.lineRipple, 'A', 3) }),
  ring: (m) => ({ label: 'ring', value: `${fmt(m.measured ? m.measured.f : m.ring.f0, 'Hz', 3)} at ${(m.overshoot * 100).toFixed(0)} %` }),
  tj: (m) => ({ label: 'T_j', value: `${m.thermal.Tj.toFixed(1)} °C` }),
}

export const LMN_TERMS = {
  armature: {
    name: 'Armature',
    def:
      'The winding a DC machine’s current flows through, and the resistance and inductance it brings. ' +
      'It behaves as an inductor with a voltage source inside it, so a chopper drives it the way it drives ' +
      'a buck’s inductor.',
  },
  'back-emf': {
    name: 'Back EMF',
    def:
      'The voltage a turning rotor makes, e = k·ω. It opposes the current that made the rotation, ' +
      'so a motor at speed draws far less current than a stalled one. The same k gives the torque per amp.',
  },
  torque: {
    name: 'Torque',
    def:
      'The twist a machine puts on its shaft, in newton-metres. It is k times the armature current, so a ' +
      'current ripple is a torque ripple of the same shape. In steady state it equals the load’s.',
  },
  commutation: {
    name: 'Commutation',
    def:
      'Handing the current from one pair of phases to the next. A six-step brushless drive commutates every ' +
      '60° of electrical rotation, six times an electrical revolution, and a four-pole rotor turns once ' +
      'mechanically for four of those.',
  },
  quadrant: {
    name: 'Four quadrants',
    def:
      'The four combinations of shaft direction and torque direction. Two are motoring and two are braking. ' +
      'A full bridge reaches all four, and in the braking two the current returns to the supply.',
  },
  'pulse-train': {
    name: 'Pulse train',
    def:
      'A waveform that holds one value for a share D of each period and another for the rest. Its harmonics ' +
      'are 2·I·|sin(kπD)|/(kπ), so at half duty every even one is missing.',
  },
  'input-filter': {
    name: 'Input filter',
    def:
      'An inductor in the supply line with the input capacitor beyond it. It divides the converter’s ' +
      'pulse current between the capacitor and the source. Two poles, so the rejection climbs as the square ' +
      'of the frequency above its corner.',
  },
  middlebrook: {
    name: 'Middlebrook',
    def:
      'The rule that an input filter’s output impedance must stay well below the converter’s input ' +
      'impedance. A regulated converter takes constant power, so its input looks like −V²/P. Where ' +
      'the two meet, the loop that holds the output can oscillate.',
  },
  parasitic: {
    name: 'Parasitic inductance',
    def:
      'The inductance of the loop a current has to travel, which no part was chosen to supply. At 100 nH ' +
      'with 1 nF on the node it rings at 15.9 MHz, and every switching edge sets it going.',
  },
  snubber: {
    name: 'Snubber',
    def:
      'A resistor and capacitor across a switching node, fitted to damp its ring. It costs C·V²·f_s ' +
      'whatever the resistance is, because the capacitor is charged and discharged once each period.',
  },
  'thermal-resistance': {
    name: 'Thermal resistance',
    def:
      'Kelvins of rise per watt of loss, R_th. Heat flows down it the way current flows down a resistance, ' +
      'and the stages from junction to ambient add. At 14 K/W, 3.40 W lifts the junction 47.6 K.',
  },
  'junction-temperature': {
    name: 'Junction temperature',
    def:
      'The temperature of the silicon itself, T_j = T_a + P·R_th. It is the number a datasheet limits, ' +
      'usually to 150 °C, and it is always above the case and the heatsink a meter can reach.',
  },
  'thermal-impedance': {
    name: 'Transient thermal impedance',
    def:
      'The rise per watt against time, Z_th(t), which starts at zero and settles at R_th. A short pulse ' +
      'lands on the fast part of the curve, so a device survives a burst that would cook it if held.',
  },
  derating: {
    name: 'Derating',
    def:
      'Lowering the power a device is allowed as its surroundings get hotter. The junction limit fixes the ' +
      'rise, so the loss allowed falls one watt for every R_th kelvins the ambient gains.',
  },
}

// ------------------------------------------------------------ parameters

const DRIVE_KEYS = ['Vdc', 'D', 'fs', 'Ra', 'La', 'k', 'J', 'B', 'TL', 'bipolar', 'lambda', 'Rs', 'Ls']

/** The engine's parameters from the knobs, with the defaults the knobs omit. */
export function driveParams(params) {
  const p = { ...DRIVE_DEFAULTS, ...pick(params, DRIVE_KEYS) }
  return { ...p, bipolar: p.bipolar ? 1 : 0 }
}

const EMI_KEYS = ['Vin', 'D', 'fs', 'L', 'C', 'R', 'Ron', 'RL', 'Lf', 'Cin', 'Rf', 'Rd']
export const emiParams = (params) => ({ ...EMI_DEFAULTS, ...pick(params, EMI_KEYS) })

const RING_KEYS = ['Vin', 'D', 'fs', 'L', 'C', 'R', 'RL', 'Lp', 'Cp', 'Rp', 'snubber', 'Csn', 'Rsn']
export const ringParams = (params) => ({ ...RING_DEFAULTS, ...pick(params, RING_KEYS) })

/** The converter Group N heats, and the network that carries its loss away. */
export const THERMAL_BUCK = {
  Vin: 48,
  D: 0.25,
  L: 47e-6,
  C: 100e-6,
  R: 2,
  fs: 300e3,
  Ron: 0.03,
  Vf: 0,
  rd: 0,
  RL: 0.02,
  ESR: 0,
  sync: true,
  tr: 20e-9,
  tf: 20e-9,
}
const THERMAL_KEYS = ['Vin', 'D', 'fs', 'L', 'C', 'R', 'Ron', 'RL']
export function thermalBuckParams(params) {
  const p = { ...THERMAL_BUCK, ...pick(params, THERMAL_KEYS) }
  const t = params.tsw === undefined ? THERMAL_BUCK.tr : params.tsw
  return { ...p, tr: t, tf: t }
}

const THERMAL_NET_KEYS = ['R1', 'tau1', 'R2', 'tau2', 'R3', 'tau3', 'Ta', 'Tjmax']
export const thermalParams = (params) => ({ ...THERMAL_DEFAULTS, ...pick(params, THERMAL_NET_KEYS) })

function pick(src = {}, keys) {
  const out = {}
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k]
  return out
}

// ------------------------------------------------------------ the analysis

export const LMN_KINDS = ['dcdrive', 'hbridge', 'bldc', 'emi', 'ringing', 'thermal']

export function analyseLmn(exp, params) {
  if (exp.kind === 'emi') return analyseEmi(exp, params)
  if (exp.kind === 'ringing') return analyseRing(exp, params)
  if (exp.kind === 'thermal') return analyseThermal(exp, params)
  return analyseDrive(exp, params)
}

function analyseDrive(exp, params) {
  const conv = drive(exp.kind, driveParams(params))
  const ss = driveSteadyState(conv)
  const m = driveMeasures(ss)
  const wf = waveforms(ss, { periods: exp.periods || 2, n: 240 })
  const avg = driveAveraged(conv)
  const comm = commutation(conv, m.omega)
  const p = conv.p
  const formulas = {
    Va: conv.commanded,
    dI: armatureRipple(exp.kind, { Vdc: p.Vdc, D: p.D, La: conv.mach.La, fs: p.fs, bipolar: conv.bipolar }),
    ke: conv.mach.ke,
    km: conv.mach.km,
    Ra: conv.mach.Ra,
    La: conv.mach.La,
    J: conv.mach.J,
    g: conv.mach.B + conv.mach.loadB,
    TL: conv.mach.TL,
    avg,
    comm,
    // The no-load speed and the stall torque, which are where the machine's
    // own line meets the axes.
    noLoad: conv.commanded / conv.mach.ke,
    stall: (conv.mach.km * conv.commanded) / conv.mach.Ra,
    pulses: conv.pulses,
  }
  return {
    kind: exp.kind,
    drive: true,
    T: ss.T,
    p,
    mach: conv.mach,
    conv,
    ss,
    m,
    wf,
    formulas,
    inverted: false,
    sign: 1,
    balance: driveBalance(ss),
  }
}

function analyseEmi(exp, params) {
  const p = emiParams(params)
  const conv = emiConverter(p)
  const ss = emiSteadyState(conv)
  const m = emiMeasures(ss, { harmonics: 9 })
  const wf = waveforms(ss, { periods: exp.periods || 2, n: 300 })
  const I = m.sig.iL.avg
  const formulas = {
    // The pulse train the switch draws, harmonic by harmonic.
    pulse: m.harmonics.map((h) => ({ k: h.k, peak: h.peak, ideal: pulseHarmonic(h.k, conv.p.D) * I, line: m.lineHarmonics[h.k - 1].peak, H: conv.filter.attenuationAt(h.k * conv.p.fs) })),
    Icap: I * Math.sqrt(conv.p.D * (1 - conv.p.D)),
    f0: conv.filter.f0,
    Q: conv.filter.Q,
    Z0: conv.filter.Z0,
    attenuation: m.attenuation,
    predicted: m.predicted,
    rejection: m.attenuation > 0 ? 1 / m.attenuation : Infinity,
    middlebrook: m.middlebrook,
    M: conv.p.D,
  }
  // No balance pane: this circuit's capacitor currents are the input's and
  // the output's, and the two do not sum to one statement about a period.
  return { kind: 'emi', emi: true, T: ss.T, p: conv.p, conv, ss, m, wf, formulas, inverted: false, sign: 1 }
}

function analyseRing(exp, params) {
  const p = ringParams(params)
  const conv = ringConverter(p)
  const ss = emiSteadyState(conv)
  const m = ringMeasures(ss)
  // One period at nine hundred points: the ring runs sixteen times inside it,
  // and fifty points a cycle is what makes it a wave rather than a smear.
  const wf = waveforms(ss, { periods: exp.periods || 1, n: 900 })
  const formulas = {
    ...conv.ring,
    measured: m.measured,
    Vsw: conv.p.D * conv.p.Vin,
    snubbed: conv.snubbed,
    Ctotal: conv.p.Cp + (conv.snubbed ? conv.p.Csn : 0),
  }
  return { kind: 'ringing', ring: true, T: ss.T, p: conv.p, conv, ss, m, wf, formulas, inverted: false, sign: 1 }
}

function analyseThermal(exp, params) {
  const p = thermalBuckParams(params)
  const t = thermalParams(params)
  const conv = converter('buck', p)
  const ss = steadyState(conv)
  const raw = measures(ss)
  const wf = waveforms(ss, { periods: exp.periods || 2, n: 240 })
  const led = lossLedger(raw)
  const stages = stagesOf(t)
  const model = params.model ? 'cauer' : 'foster'
  const net = thermalNetwork(model, stages)
  const other = thermalNetwork(model === 'foster' ? 'cauer' : 'foster', stages)
  const P = led.conduction + led.switching
  const der = derating(net, { Ta: t.Ta, Tjmax: t.Tjmax, P })
  const kSw = edgeCost({ Vblk: raw.Vblk, iOn: raw.iTurnOn, iOff: raw.iTurnOff, tr: p.tr, tf: p.tf })
  const ceiling = frequencyCeiling({ Rtotal: net.Rtotal, Ta: t.Ta, Tjmax: t.Tjmax, Pcond: led.conduction, kSw })
  const period = params.pulsePeriod === undefined ? 1 : params.pulsePeriod
  const duty = params.pulseDuty === undefined ? 0.5 : params.pulseDuty
  const pulse = pulsedRise(net, { P, duty, period })
  const times = Array.from({ length: 61 }, (_, i) => 1e-5 * Math.pow(10, (8 * i) / 60))
  const thermal = {
    stages,
    net,
    other,
    model,
    P,
    conduction: led.conduction,
    switching: led.switching,
    kSw,
    Ta: t.Ta,
    Tjmax: t.Tjmax,
    ...der,
    ceiling,
    pulse,
    times,
    zth: zth(net, times),
    zthOther: zth(other, times),
    fosterClosed: times.map((q) => fosterZth(stages, q)),
  }
  const m = { ...raw, thermal, ledger: led }
  return {
    kind: 'thermal',
    thermal: true,
    T: ss.T,
    p,
    conv,
    ss,
    m,
    wf,
    formulas: { thermal, ledger: led, M: raw.M },
    inverted: false,
    sign: 1,
    balance: balanceOf(ss),
  }
}

// ------------------------------------------------------------ the sweeps

const linSpace = (lo, hi, n) => Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1))
const logSpace = (lo, hi, n) => Array.from({ length: n }, (_, i) => lo * (hi / lo) ** (i / (n - 1)))

/** One drive solved at each duty: the speed the duty commands, and the rest. */
export function sweepDriveD(kind, params, n = 41) {
  return linSpace(0.02, 0.98, n).map((D) => driveAt(kind, { ...params, D }))
}

/** One drive solved at each chopping frequency. */
export function sweepDriveFs(kind, params, n = 25) {
  const k = params.fs === undefined ? 20e3 : params.fs
  return logSpace(Math.min(1e3, k), Math.max(100e3, k), n).map((fs) => driveAt(kind, { ...params, fs }))
}

function driveAt(kind, params) {
  const conv = drive(kind, driveParams(params))
  const ss = driveSteadyState(conv)
  const m = driveMeasures(ss, { dense: 48 })
  const a = driveAveraged(conv)
  return {
    x: params.fs !== undefined && params.D === undefined ? conv.p.fs : conv.p.D,
    speed: m.rpm,
    torque: m.torque,
    iin: m.Iin,
    ripple: m.ripple,
    eta: m.eta,
    mode: ss.mode,
    pred: (a.omega * 60) / (2 * Math.PI),
  }
}

/** The input filter against its damping: what it rejects, and what it risks. */
export function sweepDamping(params, n = 33) {
  return logSpace(0.2, 1e4, n).map((Rd) => {
    const conv = emiConverter(emiParams({ ...params, Rd }))
    const m = emiMeasures(emiSteadyState(conv), { dense: 32, harmonics: 1 })
    return { x: Rd, att: m.attenuation, mb: m.middlebrook.ratio, pred: m.predicted }
  })
}

/** The junction against the load, and against the switching frequency. */
export function sweepThermalR(params, n = 25) {
  return logSpace(0.5, 100, n).map((R) => thermalAt({ ...params, R }, R))
}

export function sweepThermalFs(params, n = 25) {
  return logSpace(20e3, 3e6, n).map((fs) => thermalAt({ ...params, fs }, fs))
}

function thermalAt(params, x) {
  const p = thermalBuckParams(params)
  const t = thermalParams(params)
  const m = measures(steadyState(converter('buck', p)))
  const led = lossLedger(m)
  const net = thermalNetwork(params.model ? 'cauer' : 'foster', stagesOf(t))
  const P = led.conduction + led.switching
  return { x, Tj: t.Ta + P * net.Rtotal, eta: led.eta, P, pred: t.Tjmax, mode: m.mode }
}

/** Which sweep each of the nine draws, and where the knob sits on it. */
export const LMN_SWEEPS = {
  dcdrive: (exp, params) => ({ points: sweepDriveD(exp.kind, params), at: params.D, label: 'the speed the duty commands', pred: 'the averaged machine' }),
  hbridge: (exp, params) => ({ points: sweepDriveD(exp.kind, params), at: params.D, label: 'what the rail supplies' }),
  bldc: (exp, params) => ({ points: sweepDriveFs(exp.kind, params), at: params.fs, label: 'the ripple the chopper leaves' }),
  emi: (exp, params) => ({ points: sweepDamping(params), at: params.Rd, label: 'what reaches the line', label2: 'Middlebrook’s ratio' }),
  thermal: (exp, params) =>
    exp.sweep.x === 'fs'
      ? { points: sweepThermalFs(params), at: params.fs, label: 'the junction against the frequency' }
      : { points: sweepThermalR(params), at: params.R, label: 'the junction against the load' },
}

/** The note's numbers, drawn where they happen on the sweep. */
export const LMN_SWEEP_MARKS = {
  thermal: (exp, x, sweep) => {
    const t = x.m.thermal
    const marks = [{ type: 'hline', axis: 'V', value: t.Tjmax, label: `T_j,max = ${t.Tjmax.toFixed(0)} °C` }]
    if (exp.sweep.x === 'fs' && Number.isFinite(t.ceiling.fs) && t.ceiling.fs > 0) {
      marks.push({ type: 'vline', x: t.ceiling.fs, label: `${fmt(t.ceiling.fs, 'Hz', 3)} ceiling` })
    }
    return marks
  },
  hbridge: (exp, x, sweep) => {
    const q = (sweep.points || []).find((r, i, all) => i > 0 && all[i - 1].iin < 0 !== r.iin < 0)
    return q ? [{ type: 'point', x: q.x, y: q.iin, label: 'the rail changes sign' }] : []
  },
}

// ------------------------------------------------------------ the outcomes

/** The one-line result in the top bar and the report. */
export const LMN_OUTCOME = {
  dcdrive: (x) => driveOutcome(x),
  hbridge: (x) => driveOutcome(x),
  bldc: (x) => driveOutcome(x),
  emi: (x) => `line ${fmt(x.m.line1, 'A', 3)} of the converter's ${fmt(x.m.conv1, 'A', 3)}, ${x.formulas.rejection.toFixed(1)}× down`,
  ringing: (x) => `${fmt(x.m.measured ? x.m.measured.f : x.formulas.f0, 'Hz', 4)} ring, ${(x.m.overshoot * 100).toFixed(1)} % over, Q = ${x.formulas.Q.toFixed(2)}`,
  thermal: (x) => `T_j = ${x.m.thermal.Tj.toFixed(1)} °C on ${fmt(x.m.thermal.P, 'W', 3)}, ${x.m.thermal.headroom.toFixed(1)} K of headroom`,
}

const driveOutcome = (x) =>
  `${x.m.rpm.toFixed(0)} rev/min at ${fmt(x.m.torque, 'N·m', 3)}, η = ${(x.m.eta * 100).toFixed(2)} %`

/** The top bar's strip: mode, then the number the experiment is about. */
export const LMN_FLOW = {
  dcdrive: (exp, params, x) => driveFlow(x),
  hbridge: (exp, params, x) => driveFlow(x),
  bldc: (exp, params, x) => driveFlow(x),
  emi: (exp, params, x) => ({
    mode: 'switched, filtered',
    mid: `${fmt(x.p.Vin, 'V', 3)} in, D = ${(x.p.D * 100).toFixed(0)} %`,
    out: `${x.formulas.rejection.toFixed(1)}× down`,
    outSub: `line ${fmt(x.m.line1, 'A', 3)}`,
  }),
  ringing: (exp, params, x) => ({
    mode: 'hard-switched node',
    mid: `${fmt(x.formulas.Ctotal, 'F', 3)} on the node`,
    out: `${fmt(x.m.measured ? x.m.measured.f : x.formulas.f0, 'Hz', 3)} ring`,
    outSub: `peak ${fmt(x.m.peak, 'V', 3)}`,
  }),
  thermal: (exp, params, x) => ({
    mid: `${fmt(x.m.thermal.P, 'W', 3)} lost`,
    out: `T_j = ${x.m.thermal.Tj.toFixed(1)} °C`,
    outSub: `of ${x.m.thermal.Tjmax.toFixed(0)} °C`,
  }),
}

const driveFlow = (x) => ({
  mode: x.m.regenerating ? 'braking, into the rail' : 'motoring',
  mid: `${fmt(x.formulas.Va, 'V', 3)} at the terminals`,
  out: `${x.m.rpm.toFixed(0)} rev/min`,
  outSub: `${fmt(x.m.torque, 'N·m', 3)}`,
})

/** The words the mode chip uses for the three new engines. */
export const LMN_MODE_WORDS = {
  drive: 'a machine on the shaft',
  emi: 'switched, filtered',
  ring: 'hard-switched node',
}

// ------------------------------------------------------------ the lessons

// The back EMF is a straight line at the defaults: the speed ripples a
// millionth of itself, so a strip framed on it alone would carry six ticks
// reading the same number. It stays a chip away rather than an opening trace,
// and the Drive pane is where its value is read.
const drv = (kind, over) => ({
  kind,
  headline: 'eta',
  traces: ['vout', 'iL'],
  allTraces: ['vout', 'vemf', 'vL', 'iL', 'iQ', 'iD', 'iin'],
  views: ['measures', 'drive', 'math', 'sweep', 'losses'],
  view: 'measures',
  periods: 2,
  ...over,
})

export const LMN_EXPERIMENTS = [
  // ------------------------------------------------------ L · Motor drives
  drv('dcdrive', {
    id: 'l1',
    about: 'D',
    chips: [0.5, 0.75],
    try: { knob: 'D', text: 'Set D to 75 %: the shaft speeds up to 5552 rev/min.' },
    group: 'Motor drives',
    name: 'The armature is an inductor with a speed in it',
    params: [Duty(0.5), Vdc(48), FsDrive(20e3), La(3e-3), Ra(1.2), Kmot(0.06), Tload(0.05), Jrot(2e-4), Bfric(1e-5)],
    sweep: { x: 'D', y: 'speed' },
    note:
      'A chopper feeds an armature, which is a resistance, an inductance and a voltage the rotor makes. ' +
      'At 50 % duty the terminals average 24.0 V. The shaft settles at 3648 rev/min, drawing 897 mA and ' +
      'making 53.8 mN·m. The current ripples 200 mA, a fifth of its mean, while the speed ripples ' +
      '375 µrad/s.',
    terms: ['armature', 'back-emf', 'torque', 'duty', 'average'],
  }),
  drv('hbridge', {
    id: 'l2',
    about: 'D',
    chips: [0.75, 0.3],
    try: { knob: 'bipolar', text: 'Switch to unipolar: the ripple falls to 100 mA, at twice the rate.' },
    group: 'Motor drives',
    name: 'Four quadrants, and the rail takes current back',
    params: [Duty(0.75), Bipolar(1), Vdc(48), FsDrive(20e3), La(3e-3), Ra(1.2), Kmot(0.06), Tload(0.05), Jrot(2e-4), Bfric(1e-5)],
    traces: ['vout', 'iL', 'iin'],
    allTraces: ['vout', 'vemf', 'vL', 'iL', 'iQ', 'iin'],
    sweep: { x: 'D', y: 'iin' },
    note:
      'A full bridge puts either sign across the armature, so the machine runs both ways. At 75 % duty the ' +
      'terminals average 24.0 V and the rail supplies 449 mA. Drop the duty to 30 % and the terminals ' +
      'average −19.2 V. The shaft turns backwards at 3204 rev/min, the load drives it, and the rail ' +
      'takes 311 mA back. Bipolar modulation leaves 300 mA of ripple. Unipolar puts two pulses in each ' +
      'period instead, for 100 mA.',
    terms: ['armature', 'quadrant', 'back-emf', 'duty', 'ripple', 'average'],
  }),
  drv('bldc', {
    id: 'l3',
    about: 'fs',
    chips: [20e3, 5e3],
    try: { knob: 'fs', text: 'Set f_s to 5 kHz: the torque ripple deepens to 63.5 %.' },
    group: 'Motor drives',
    name: 'Six-step commutation, and the torque it leaves',
    params: [FsDrive(20e3), Duty(0.5), Vdc(48), Lambda(0.02), Rphase(0.5), Lphase(1.5e-3), Tload(0.2), Jrot(2e-4), Bfric(1e-5)],
    sweep: { x: 'fs', y: 'ripple' },
    note:
      'Two of the three phases carry the link current at a time. The circuit is that pair in series: ' +
      '1 Ω, 3 mH and 0.16 V·s per radian. At 50 % duty and 20 kHz the shaft holds 1357 rev/min ' +
      'against ' +
      '201 mN·m. The rotor turns 60° between commutations, 543 times a second. The chopper ' +
      'switches 37 times inside each sector. Torque follows the current, so 200 mA of ripple modulates ' +
      'it 15.9 %.',
    terms: ['commutation', 'torque', 'ripple', 'duty', 'armature'],
  }),

  // ------------------------------------------------------ M · Interference
  {
    id: 'm1',
    about: 'Cin',
    chips: [100e-6, 10e-6],
    try: { knob: 'Cin', text: 'Set C_in to 10 µF: the input ripples 638 mV and the line 842 mA.' },
    group: 'Interference',
    name: 'The input current is a pulse train',
    kind: 'emi',
    headline: 'ripple',
    params: [Cinput(100e-6), Vin(24), Duty(0.5), FsEmi(100e3), Lout(100e-6), Cout(100e-6), Rload(6), Lfilt(1e-6), Rfilt(0.05)],
    traces: ['iin', 'icin', 'iline'],
    allTraces: ['vcin', 'vout', 'iL', 'icin', 'iin', 'iline'],
    views: ['filter', 'measures', 'math', 'losses'],
    view: 'filter',
    periods: 2,
    note:
      'The switch takes 2.00 A from the input for half of each period and nothing for the rest. That pulse ' +
      'train has a harmonic at every multiple of 100 kHz. The first is 1.28 A and the third 424 mA. Even ' +
      'multiples are absent. The 100 µF input capacitor supplies 1.03 A rms, so the line sees 64 mA.',
    terms: ['pulse-train', 'harmonic', 'rms', 'input-filter'],
  },
  {
    id: 'm2',
    about: 'Rd',
    chips: [1e4, 1],
    try: { knob: 'Rd', text: 'Set R_d to 1 Ω: the peak falls to 0.99 Ω and the rejection to 6.3.' },
    group: 'Interference',
    name: 'The input filter, and what damping costs',
    kind: 'emi',
    headline: 'ripple',
    params: [Rdamp(1e4), Lfilt(47e-6), Cinput(10e-6), Vin(24), Duty(0.5), FsEmi(100e3), Lout(100e-6), Cout(100e-6), Rload(6), Rfilt(0.05)],
    traces: ['iin', 'iline'],
    allTraces: ['vcin', 'vout', 'iL', 'icin', 'iin', 'iline'],
    views: ['filter', 'sweep', 'measures', 'math', 'losses'],
    view: 'filter',
    periods: 2,
    sweep: { x: 'Rd', y: 'att', y2: 'mb' },
    note:
      'A 47 µH inductor in the line, with the 10 µF input capacitor, corners at 7.34 kHz. At ' +
      '100 kHz it divides the converter’s 1.28 A down to 6.9 mA, 184 times. With 10 kΩ of damping its ' +
      'output ' +
      'impedance peaks at 93 Ω against the converter’s 24 Ω of input resistance, and ' +
      'Middlebrook’s rule fails. A 1 Ω resistor across the inductor brings the peak to ' +
      '0.99 Ω. It also shunts the inductor at 100 kHz, so the rejection falls to 6.3.',
    terms: ['input-filter', 'middlebrook', 'harmonic'],
  },
  {
    id: 'm3',
    about: 'Lp',
    chips: [100e-9, 400e-9],
    try: { knob: 'snubber', text: 'Switch the snubber on: the overshoot falls to 39 % and costs 1.25 W.' },
    group: 'Interference',
    name: 'The switch node rings at every edge',
    kind: 'ringing',
    headline: 'ring',
    params: [Lpar(100e-9), Cpar(1e-9), Rpar(50), Snub(0), Csnub(2.2e-9), Rsnub(10), FsRing(1e6), Vin(24), Duty(0.5), Lout(10e-6), Cout(10e-6), Rload(6)],
    traces: ['vsw', 'iin'],
    allTraces: ['vsw', 'vout', 'vL', 'iL', 'iin'],
    views: ['ring', 'measures', 'math', 'losses'],
    view: 'ring',
    periods: 1,
    note:
      'The loop from the rail to the node carries 100 nH of parasitic inductance, and the node has 1 nF. ' +
      'Together they ring at 15.9 MHz with a Q of 5, sixteen cycles inside each switching period. The node ' +
      'overshoots 72.8 % of the 24 V rail and reaches 41.5 V, against the closed form’s 72.9 %. ' +
      'Ringing costs 557 mW of the 24 W delivered. At 400 nH the ring halves to 7.96 MHz.',
    terms: ['parasitic', 'snubber'],
  },

  // ------------------------------------------------------------ N · Thermal
  {
    id: 'n1',
    about: 'R',
    chips: [2, 1],
    try: { knob: 'R', text: 'Set R_load to 1 Ω: the junction reaches 162 °C, past its limit.' },
    group: 'Thermal',
    name: 'Loss becomes temperature',
    kind: 'thermal',
    headline: 'tj',
    params: [Rload(2), FsTherm(300e3), Vin(48), Duty(0.25), Ron(0.03), RL(0.02), Tsw(20e-9), Lout(47e-6), Cout(100e-6), Tamb(25), Tjmax(150), Rth1(0.6), Tau1(1e-3), Rth2(1.4), Tau2(0.1), Rth3(12), Tau3(300)],
    traces: ['vout', 'iL'],
    allTraces: ['vsw', 'vout', 'vL', 'iL', 'iQ', 'iD', 'iC', 'iin'],
    views: ['thermal', 'ledger', 'measures', 'math', 'sweep'],
    view: 'thermal',
    periods: 2,
    sweep: { x: 'R', y: 'Tj' },
    note:
      'This converter delivers 68.5 W into 2 Ω and loses 3.40 W, 1.72 W in conduction and 1.69 W at the ' +
      'edges. Every ' +
      'watt leaves through 14 K/W of thermal resistance, so the junction sits 47.6 K above a 25 °C ' +
      'ambient, at 72.6 °C. The 150 °C limit allows 8.93 W, so 77 K of headroom is left.',
    terms: ['thermal-resistance', 'junction-temperature', 'derating', 'conduction-loss', 'switching-loss'],
  },
  {
    id: 'n2',
    about: 'pulsePeriod',
    chips: [1, 1e-3],
    try: { knob: 'pulsePeriod', text: 'Set the period to 1 ms: the swing falls to 512 mK.' },
    group: 'Thermal',
    name: 'The thermal RC, from die to heatsink',
    kind: 'thermal',
    headline: 'tj',
    params: [PulsePeriod(1), PulseDuty(0.5), Model(0), Rload(2), Rth1(0.6), Tau1(1e-3), Rth2(1.4), Tau2(0.1), Rth3(12), Tau3(300), Tamb(25), Tjmax(150)],
    traces: ['vout', 'iL'],
    allTraces: ['vsw', 'vout', 'vL', 'iL', 'iQ', 'iD', 'iC', 'iin'],
    views: ['thermal', 'ledger', 'measures', 'math'],
    view: 'thermal',
    periods: 2,
    note:
      'The die reaches its own temperature in milliseconds and the heatsink in minutes. The network is three ' +
      'stages: 0.6 K/W at 1 ms, 1.4 K/W at 100 ms, 12 K/W at 300 s. A 3.40 W load that comes and goes with ' +
      'a 1 s period swings the junction 6.77 K about a 23.8 K mean. At a 1 ms period the swing is 512 mK. ' +
      'The fastest stage can no longer follow.',
    terms: ['thermal-resistance', 'thermal-impedance', 'junction-temperature'],
  },
  {
    id: 'n3',
    about: 'fs',
    chips: [300e3, 1e6],
    try: { knob: 'fs', text: 'Set f_s to 1 MHz: the edges cost 5.62 W and the junction 128 °C.' },
    group: 'Thermal',
    name: 'Faster is hotter',
    kind: 'thermal',
    headline: 'tj',
    params: [FsTherm(300e3), Rload(2), Tsw(20e-9), Vin(48), Duty(0.25), Ron(0.03), RL(0.02), Lout(47e-6), Cout(100e-6), Tamb(25), Tjmax(150), Rth1(0.6), Tau1(1e-3), Rth2(1.4), Tau2(0.1), Rth3(12), Tau3(300)],
    traces: ['vout', 'iL'],
    allTraces: ['vsw', 'vout', 'vL', 'iL', 'iQ', 'iD', 'iC', 'iin'],
    views: ['sweep', 'thermal', 'ledger', 'measures', 'math'],
    view: 'sweep',
    periods: 2,
    sweep: { x: 'fs', y: 'Tj' },
    note:
      'Each edge costs 5.62 µW per hertz of switching, and conduction costs 1.71 W whatever the ' +
      'frequency. At 300 kHz the pair heat the junction to 72.6 °C. At 1 MHz the edges alone take ' +
      '5.62 W and the junction reaches 128 °C. The 150 °C limit allows 8.93 W in all, so this ' +
      'package can afford 1.28 MHz and no more.',
    terms: ['switching-loss', 'conduction-loss', 'junction-temperature', 'thermal-resistance', 'derating'],
  },
]

export { LMN_MATH } from './lmnMath.js'
