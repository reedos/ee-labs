// Groups J and K: the half-bridge's siblings, and resonant conversion.
//
// J is the rest of the isolated buck-derived family. The flyback stores each
// cycle's energy in the core and dumps it; these three send it straight
// through the transformer, and what separates them is the ratio, the voltage
// each switch stands off, and what the magnetising current does. So the
// magnetising current is a state here and a trace on the scope, because the
// forward's reset interval and the push-pull's flux walk are both about it.
//
// K is the tank. Every switch up to this point has opened on full current
// and closed on full voltage. Put an LC between the bridge and the rectifier
// and the current the switch commutates is a piece of a sine, which above
// resonance is still flowing the wrong way at the instant of the edge.
//
// Everything here is a table the app's own tables take by spread, so the
// director can merge three lanes by union. The knob shapes are written out
// again rather than imported, because `experiments.js` imports this file and
// a module cannot borrow a value from one that is still evaluating.

import {
  forwardFamily,
  forwardM,
  forwardMeasures,
  windowedSteadyState,
  fluxWalk,
  resetCeiling,
  waveforms,
  average,
  signalIntegral,
  integral,
  Rcrit,
  K as Kof,
  Kcrit,
  halfBridge,
  steadyState,
  measures,
  resonantConverter,
  resonantSteadyState,
  resonantMeasures,
  fhaRatio,
  fhaGain,
  seriesResonance,
  lowerResonance,
  tankImpedance,
  tankQ,
  acLoad,
  hardSwitchedEdgeLoss,
  FORWARD_KINDS,
  RESONANT_KINDS,
} from '@ee-labs/switched'
import { fmt } from '@ee-labs/ui'

// ------------------------------------------------------------------ knobs
// The same shapes `experiments.js` uses, with the ranges these lessons need.
const Vin = (def = 48) => ({ key: 'Vin', label: 'V_in', unit: 'V', min: 12, max: 200, scale: 'linear', step: 0.5, default: def, hint: 'Input voltage' })
const Dfw = (def = 0.4) => ({ key: 'D', label: 'D', unit: '%', percent: true, min: 0.02, max: 0.49, scale: 'linear', step: 0.001, default: def, hint: 'Duty of each switch, at most one half of the period' })
const Ratio = (def = 4) => ({ key: 'Np', label: 'N_p:N_s', unit: '', min: 1, max: 20, scale: 'log', default: def, hint: 'Turns ratio, primary to secondary' })
const Lm = (def = 1e-3) => ({ key: 'Lm', label: 'L_m', unit: 'H', min: 100e-6, max: 20e-3, scale: 'log', default: def, hint: 'Magnetising inductance, seen from the primary' })
const LmK = (def = 150e-6) => ({ key: 'Lm', label: 'L_m', unit: 'H', min: 30e-6, max: 2e-3, scale: 'log', default: def, hint: 'Magnetising inductance across the primary' })
const Lr = (def = 30e-6) => ({ key: 'Lr', label: 'L_r', unit: 'H', min: 10e-6, max: 100e-6, scale: 'log', default: def, hint: 'Resonant inductance, in series with the tank' })
const Cr = (def = 84.4e-9) => ({ key: 'Cr', label: 'C_r', unit: 'F', min: 30e-9, max: 300e-9, scale: 'log', default: def, hint: 'Resonant capacitor, in series with the tank' })
const L = (def = 100e-6) => ({ key: 'L', label: 'L', unit: 'H', min: 1e-6, max: 10e-3, scale: 'log', default: def, hint: 'Output inductance' })
const C = (def = 100e-6) => ({ key: 'C', label: 'C', unit: 'F', min: 1e-6, max: 10e-3, scale: 'log', default: def, hint: 'Output capacitance' })
const R = (def = 5) => ({ key: 'R', label: 'R_load', unit: 'Ω', min: 0.5, max: 1000, scale: 'log', default: def, hint: 'Load resistance' })
const Rk = (def = 12) => ({ key: 'R', label: 'R_load', unit: 'Ω', min: 2, max: 200, scale: 'log', default: def, hint: 'Load resistance' })
const Fs = (def = 100e3) => ({ key: 'fs', label: 'f_s', unit: 'Hz', min: 20e3, max: 1e6, scale: 'log', default: def, hint: 'Switching frequency' })
const FsK = (def = 120e3) => ({ key: 'fs', label: 'f_s', unit: 'Hz', min: 50e3, max: 400e3, scale: 'log', default: def, hint: 'Switching frequency, which is what a resonant converter regulates with' })
const Ron = (def = 0.05) => ({ key: 'Ron', label: 'R_on', unit: 'Ω', min: 0, max: 0.5, scale: 'linear', step: 0.001, default: def, hint: 'On-resistance of one switch' })
const Mismatch = (def = 0.5) => ({ key: 'mismatch', label: 'R_on mismatch', unit: '%', percent: true, min: 0, max: 2, scale: 'linear', step: 0.005, default: def, hint: 'How much more resistance the second switch has than the first' })
const Rs = (def = 0.2) => ({ key: 'Rs', label: 'R_s', unit: 'Ω', min: 0, max: 2, scale: 'linear', step: 0.005, default: def, hint: 'Series resistance of the tank loop: the winding, the switches and the capacitor' })
const Tsw = (def = 20e-9) => ({ key: 'tsw', label: 't_sw', unit: 's', min: 0, max: 200e-9, scale: 'linear', step: 1e-9, default: def, hint: 'Switch rise and fall time (each edge)' })

// ------------------------------------------------------------------ tables

export const JK_GROUPS = ['Isolated converters', 'Resonant conversion']

export const JK_GROUP_INTROS = {
  'Isolated converters':
    'A flyback stores each cycle\u2019s energy in its core and then dumps it. These three send it ' +
    'straight through the transformer instead, and they differ in what each switch must block.',
  'Resonant conversion':
    'Every switch so far has opened on full current and closed on full voltage. A tank between the ' +
    'bridge and the rectifier changes what the switch meets at each edge.',
}

export const JK_TRACES = {
  iM: { label: 'i_M', axis: 'A', title: 'Magnetising current, referred to the primary' },
  iT: { label: 'i_T', axis: 'A', title: 'Current the transformer carries into the rectifier' },
}

/** The two trace colours the shared palette does not already name. */
export const JK_TRACE_COLORS = { iM: '#e0aaff', iT: '#80ed99' }

export const JK_VIEWS = {
  family: { label: 'Family', title: 'The forward, the push-pull and the full bridge, solved side by side' },
}

export const JK_SWEEP_X = {
  mismatch: { label: 'R_on mismatch', unit: '', scale: 'linear', fmt: (v) => `${(v * 100).toFixed(0)} %` },
}

export const JK_SWEEP_Y = {
  // A ratio whose ideal line is not M = D, so it is its own axis rather than
  // the buck's, which the sweep's legend names in words.
  Mn: { label: 'M = V_out / V_in', unit: '', lo: 0 },
  iMdc: { label: '⟨i_M⟩', unit: 'A' },
  etaHard: { label: 'η, hard-switched', unit: '', lo: 0, hi: 1, percent: true },
}

export const JK_TERMS = {
  'forward-converter': {
    name: 'Forward converter',
    def:
      'A buck with a transformer between the switch and the output filter. The secondary hands the ' +
      'filter n times the input for the duty the switch is on, so the ratio is n·D. A third winding ' +
      'returns the core\u2019s magnetising current to the source between pulses.',
  },
  'reset-winding': {
    name: 'Reset winding',
    def:
      'A third winding that returns the magnetising current to the source when the switch opens. It ' +
      'holds V_in/n_r across the primary, so the return takes n_r·D·T. With equal turns the duty ' +
      'cannot exceed one half, and the switch stands off twice the rail.',
  },
  'magnetising-current': {
    name: 'Magnetising current',
    def:
      'The current a transformer draws to carry its own flux, over and above what the load asks for. ' +
      'It rises at V/L_m while voltage is applied and has to come back to where it started each ' +
      'period. At 48 V for 4 µs on 1 mH it reaches 192 mA.',
  },
  'push-pull': {
    name: 'Push-pull converter',
    def:
      'Two switches driving a centre-tapped primary in turn, so the core is used both ways round. The ' +
      'rectified secondary feeds the filter twice a period, and the ratio is 2·n·D. The switch that ' +
      'is off stands off twice the rail.',
  },
  'full-bridge': {
    name: 'Full-bridge converter',
    def:
      'Four switches that swing the primary both ways from one rail. The ratio is 2·n·D, as the ' +
      'push-pull\u2019s is, and each switch stands off the rail and no more. Two of them are in series ' +
      'with the primary each half cycle, so the conduction loss is doubled.',
  },
  'flux-walk': {
    name: 'Flux walk',
    def:
      'A DC offset in the magnetising current, left by two half cycles that do not put equal ' +
      'volt-seconds on the core. Resistance in the primary stops it, at ⟨i_M⟩ = n·I_out(R_on2 − ' +
      'R_on1)/(R_on1 + R_on2). With no resistance at all nothing stops it.',
  },
  'resonant-tank': {
    name: 'Resonant tank',
    def:
      'An inductor and a capacitor in series between the bridge and the rectifier. At 1/(2π√(L_r C_r)) ' +
      'the pair is a short and the tank passes the square wave through. Away from it the pair is an ' +
      'impedance, so the frequency sets the output.',
  },
  zvs: {
    name: 'Zero-voltage switching (ZVS)',
    def:
      'Turning a switch on while the current is still flowing the other way through it. The node has ' +
      'already swung, so the switch closes on no voltage and the turn-on costs nothing. A tank run ' +
      'above its resonance gives it, because the current lags the voltage.',
  },
  llc: {
    name: 'LLC',
    def:
      'A resonant tank with the magnetising inductance left in as a third element. It gives the tank ' +
      'a second, slower resonance, and between the two the gain can exceed what a series tank can ' +
      'reach. Below the lower one the switching goes hard, so converters stay above it.',
  },
  'first-harmonic': {
    name: 'First-harmonic gain',
    def:
      'The gain of a resonant tank worked out from the fundamental alone. The rectifier and the load ' +
      'become 8R/(π²n²). It is a good approximation near resonance and a poor one well below, where ' +
      'the tank current is a train of arcs rather than a sine.',
  },
}

// ------------------------------------------------------- the experiments

const forwardExp = (kind, over) => ({
  kind,
  jk: true,
  headline: 'eta',
  traces: ['vsw', 'iL', 'iM'],
  allTraces: ['vsw', 'vout', 'vL', 'iL', 'iM', 'iQ', 'iD', 'iC', 'iin'],
  views: ['measures', 'scrub', 'math', 'sweep', 'losses'],
  view: 'measures',
  sweep: { x: 'D', y: 'Mn' },
  periods: 2,
  ...over,
})

const tank = (kind, over) => ({
  kind,
  jk: true,
  headline: 'eta',
  traces: ['vsw', 'iL'],
  allTraces: ['vsw', 'vout', 'vL', 'iL', 'iD', 'iC', 'iQ'],
  views: ['sweep', 'measures', 'math', 'losses'],
  view: 'sweep',
  sweep: { x: 'fs', y: 'Mn' },
  periods: 2,
  ...over,
})

export const JK_EXPERIMENTS = [
  forwardExp('forward', {
    id: 'j1',
    about: 'D',
    chips: [0.4, 0.45],
    try: { knob: 'D', text: 'Set D to 45 %: the reset takes 4.50 µs and leaves 1.00 µs.' },
    group: 'Isolated converters',
    name: 'A buck through a transformer',
    params: [Dfw(0.4), Ratio(4), Vin(48), R(5), Lm(1e-3), L(), C(), Fs()],
    note:
      'The switch puts 48 V across the primary and the secondary hands the filter n times it, so ' +
      'volt-second balance gives M = n·D. At D = 40 % on a 4:1 transformer that is 4.80 V. The core ' +
      'has its own volt-seconds to return, through a reset winding, and that takes 4.00 µs. So the ' +
      'duty stops at one half and the switch blocks 96.0 V.',
    terms: ['forward-converter', 'reset-winding', 'magnetising-current', 'volt-second', 'turns-ratio', 'isolation', 'duty'],
  }),
  forwardExp('pushpull', {
    id: 'j2',
    about: 'mismatch',
    chips: [0.5, 0, 1],
    try: { knob: 'mismatch', text: 'Set the mismatch to 100 %: the offset grows to 40.0 mA.' },
    group: 'Isolated converters',
    name: 'The push-pull and the flux walk',
    params: [Mismatch(0.5), Ron(0.05), Ratio(8), Vin(48), Lm(4e-3), R(5), L(), C(), Fs()],
    traces: ['iM', 'iL', 'vsw'],
    sweep: { x: 'mismatch', y: 'iMdc' },
    note:
      'Two switches drive a centre-tapped primary in turn, so the core works both ways and M = 2·n·D. ' +
      'Give one switch more resistance and the two half cycles stop cancelling. The magnetising ' +
      'current then drifts until the resistances stop it. At 50 % that offset is 24.0 mA on a 48.0 mA ' +
      'ripple, so the triangle sits above zero. At 0 % it is centred on zero.',
    terms: ['push-pull', 'flux-walk', 'magnetising-current', 'turns-ratio', 'volt-second', 'ripple'],
  }),
  forwardExp('fullbridge', {
    id: 'j3',
    about: 'D',
    chips: [0.4, 0.45],
    try: { knob: 'D', text: 'Set D to 45 %: the output rises to 5.40 V on the same 48 V.' },
    group: 'Isolated converters',
    name: 'Four switches, half the stress',
    params: [Dfw(0.4), Ratio(8), Vin(48), Ron(0.05), R(5), Lm(1e-3), L(), C(), Fs()],
    views: ['family', 'measures', 'math', 'sweep', 'losses'],
    view: 'family',
    traces: ['vsw', 'iL', 'iQ'],
    note:
      'A push-pull switch sits across half the primary while the other half is driven, so the ' +
      'transformer adds that half to the rail and it stands off 96.0 V. A full-bridge switch stands ' +
      'off 48.0 V. It pays with two switches in series each half cycle, so 1.41 mW of conduction ' +
      'against 0.71 mW. Both give M = 2·n·D, which at D = 40 % is 0.100.',
    terms: ['full-bridge', 'push-pull', 'turns-ratio', 'conduction-loss', 'isolation'],
  }),
  tank('src', {
    id: 'k1',
    about: 'fs',
    chips: [120e3, 60e3],
    try: { knob: 'fs', text: 'Set f_s to 60 kHz: M holds at 0.250 while the formula says 0.222.' },
    group: 'Resonant conversion',
    name: 'The series resonant tank',
    params: [FsK(120e3), Ratio(2), Vin(48), Rk(12), Lr(), Cr(), C(100e-6)],
    note:
      'An LC tank between the bridge and the rectifier makes the switch current a piece of a sine. ' +
      'At the tank\u2019s own resonance the pair is a short and M is n/2. Above it the current lags, so ' +
      'each switch turns on into a current still flowing the other way. At 120 kHz M is 0.239, and ' +
      'the first-harmonic gain is 3.0 % out.',
    terms: ['resonant-tank', 'zvs', 'first-harmonic', 'rectifier', 'turns-ratio', 'isolation'],
  }),
  tank('llc', {
    id: 'k2',
    about: 'Lm',
    chips: [150e-6, 60e-6],
    try: { knob: 'Lm', text: 'Set L_m to 60 µH: the peak gain rises to 0.593 at 66.3 kHz.' },
    group: 'Resonant conversion',
    name: 'The LLC and its two resonances',
    traces: ['vsw', 'iL', 'iT'],
    allTraces: ['vsw', 'vout', 'vL', 'iL', 'iT', 'iM', 'iD', 'iC', 'iQ'],
    params: [LmK(150e-6), FsK(80e3), Ratio(2), Vin(48), Rk(12), Lr(), Cr(), C(100e-6)],
    note:
      'Leave the magnetising inductance in and the tank has a second, slower resonance at 40.8 kHz. ' +
      'Between the two the gain can pass what a series tank can reach. At 80 kHz with L_m = 150 µH ' +
      'the output is 13.7 V, which is 1.14 times n/2. The peak of the curve moves with the ' +
      'inductance ratio, and at 60 µH it reaches 0.593.',
    terms: ['llc', 'resonant-tank', 'magnetising-current', 'zvs', 'first-harmonic'],
  }),
  tank('llc', {
    id: 'k3',
    about: 'tsw',
    chips: [20e-9, 100e-9],
    try: { knob: 'tsw', text: 'Set t_sw to 100 ns: the edges cost 439 mW and the bridge 2.08 W.' },
    group: 'Resonant conversion',
    name: 'What the soft edge saves',
    params: [Tsw(20e-9), FsK(130e3), Rs(0.2), Rk(12), Vin(48), Ratio(2), LmK(150e-6), Lr(), Cr(), C(100e-6)],
    views: ['losses', 'measures', 'math', 'sweep'],
    view: 'losses',
    sweep: { x: 'fs', y: 'eta', y2: 'etaHard', shared: true },
    traces: ['vsw', 'iL', 'iT'],
    allTraces: ['vsw', 'vout', 'vL', 'iL', 'iT', 'iM', 'iD', 'iC', 'iQ'],
    note:
      'The tank current is still flowing the other way when a switch turns on, so the turn-on costs ' +
      'nothing and only the turn-off is charged. At t_sw = 20 ns that is 87.7 mW. A hard-switched ' +
      'half-bridge delivering the same 10.2 V pays both edges at the load current, 208 mW. The tank ' +
      'itself takes 55.2 mW, and the whole converter runs at 98.4 %.',
    terms: ['zvs', 'llc', 'switching-loss', 'resonant-tank', 'half-bridge'],
  }),
]

// -------------------------------------------------------------- analysis

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** Forward-family parameters from the knobs. */
export function forwardParams(params) {
  const p = { Vin: 48, D: 0.4, Np: 4, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Lm: 1e-3, Ron: 0, Vf: 0, RL: 0, ESR: 0, mismatch: 0, tsw: 0, ...params }
  return {
    Vin: p.Vin,
    D: p.D,
    n: 1 / p.Np,
    L: p.L,
    C: p.C,
    R: p.R,
    fs: p.fs,
    Lm: p.Lm,
    nr: 1,
    Ron: p.Ron,
    Vf: p.Vf,
    rd: 0,
    RL: p.RL,
    ESR: p.ESR,
    mismatch: p.mismatch,
    tr: p.tsw,
    tf: p.tsw,
  }
}

/** Resonant parameters from the knobs. */
export function resonantParams(params) {
  const p = { Vin: 48, fs: 120e3, Lr: 30e-6, Cr: 84.4e-9, Lm: 150e-6, Np: 2, C: 100e-6, R: 12, Rs: 0, Vf: 0, tsw: 0, ...params }
  return { Vin: p.Vin, fs: p.fs, Lr: p.Lr, Cr: p.Cr, Lm: p.Lm, n: 1 / p.Np, C: p.C, R: p.R, Rs: p.Rs, Vf: p.Vf, tr: p.tsw, tf: p.tsw }
}

/**
 * Why a solve is not to be read.
 *
 * The shooting method finds the periodic state of a circuit whose intervals
 * move with its own state, and at a few corners of the knob space it circles
 * a point without settling on it. The plan's rule for that case is that the
 * pane says so and names the setting, rather than drawing a waveform that is
 * not the converter's. Every number on the screen then carries this line,
 * and the math panel stops comparing anything.
 */
function gateOf(ss, conv, base) {
  if (ss.converged) return null
  const periods = base.R * base.C * base.fs
  const where = conv.fr ? `f/f_r = ${(base.fs / conv.fr).toFixed(2)}` : `D = ${(base.D * 100).toFixed(1)} %`
  return (
    `The periodic state did not settle here, after ${ss.passes} passes. The output filter runs to ` +
    `${periods.toFixed(0)} switching periods at ${fmt(base.R, '\u03a9', 3)} and ${fmt(base.C, 'F', 3)}, and at ${where} ` +
    `almost nothing reaches it. Move the load, the capacitor or the frequency. Read nothing off this screen until it settles.`
  )
}

/** Volt-seconds and coulombs per interval, for the Balance pane's shape. */
function balanceOf(ss) {
  const segs = ss.segments
    .filter((s) => s.T > 0)
    .map((seg) => {
      const ix = integral(seg)
      return { name: seg.name, T: seg.T, vs: signalIntegral(seg, 'vL', ix), q: signalIntegral(seg, 'iC', ix) }
    })
  return { segs, vs: segs.reduce((a, s) => a + s.vs, 0), q: segs.reduce((a, s) => a + s.q, 0) }
}

function analyseForward(params, exp) {
  const base = forwardParams(params)
  const conv = forwardFamily(exp.kind, base)
  const ss = windowedSteadyState(conv)
  const m = forwardMeasures(ss)
  const wf = waveforms(ss, { periods: exp.periods || 2, n: 300 })
  const p = conv.p
  const pair = exp.kind !== 'forward'
  const M = forwardM(exp.kind, p.D, base.n)
  const Vo = p.Vin * M
  // The filter is a buck's, fed with n·V_in for the duty the switch is on,
  // once a period for the forward and twice for the other two.
  const pulse = base.n * p.Vin
  const dI = ((pulse - Vo) * p.D) / (base.L * p.fs)
  const feed = pair ? 2 * p.fs : p.fs
  const dV = dI / (8 * feed * base.C)
  // The reset can be interrupted by the output inductor running dry, which
  // splits it into two segments carrying the same magnetising slope.
  const reset = ss.segments.filter((s) => s.name.startsWith('reset')).reduce((a, s) => a + s.T, 0)
  const iMpk = (p.Vin * p.D) / (base.Lm * p.fs)
  const formulas = {
    n: base.n,
    Np: params.Np || 4,
    M,
    Vo,
    pulse,
    dI,
    dV,
    dVatFs: pair ? dI / (8 * p.fs * base.C) : null,
    ripplePulses: pair ? 2 : 1,
    feed,
    K: Kof({ L: base.L, fs: feed, R: base.R }),
    Kcrit: Kcrit('buck', pair ? 2 * p.D : p.D),
    Rcrit: Rcrit('buck', { L: base.L, fs: feed, D: pair ? 2 * p.D : p.D }),
    resetTime: conv.resetTime || 0,
    resetMeasured: reset,
    maxDuty: conv.maxDuty,
    resets: conv.resets,
    blocking: conv.blocking(),
    rail: p.Vin,
    stressRatio: conv.blocking() / p.Vin,
    iMpk,
    iMdc: m.sig.iM.avg,
    iMripple: m.sig.iM.pp,
    iMwalk: pair ? fluxWalk({ n: base.n, Iout: m.Iout, Ron1: conv.Ron1, Ron2: conv.Ron2 }) : 0,
    Ron1: pair ? conv.Ron1 : p.Ron,
    Ron2: pair ? conv.Ron2 : p.Ron,
    driftFree: !!conv.driftFree,
    switches: exp.kind === 'forward' ? 1 : exp.kind === 'pushpull' ? 2 : 4,
    switching: { D: p.D, fs: p.fs, T: conv.T, n: base.n },
    fo: 1 / (2 * Math.PI * Math.sqrt(base.L * base.C)),
    family: pair ? familyTable(base, exp) : null,
  }
  return { kind: exp.kind, jk: true, isolated: true, forward: true, T: ss.T, p, base, conv, ss, m, wf, formulas, gate: gateOf(ss, conv, base), inverted: false, sign: 1, balance: balanceOf(ss) }
}

/**
 * The three converters at one operating point, each solved. The forward gets
 * twice the turns ratio, because its transformer is used one way round and
 * its ratio carries one D rather than two — so the table compares three
 * converters delivering the same output rather than three different outputs.
 */
export function familyTable(base, exp) {
  return FORWARD_KINDS.map((kind) => {
    const n = kind === 'forward' ? 2 * base.n : base.n
    const conv = forwardFamily(kind, { ...base, n })
    const m = forwardMeasures(windowedSteadyState(conv))
    return {
      kind,
      here: kind === exp.kind,
      label: kind === 'forward' ? 'forward' : kind === 'pushpull' ? 'push-pull' : 'full bridge',
      switches: kind === 'forward' ? 1 : kind === 'pushpull' ? 2 : 4,
      turns: 1 / n,
      M: m.M,
      Vout: m.sig.vout.avg,
      stress: conv.blocking(),
      stressRatio: conv.blocking() / base.Vin,
      switchLoss: m.loss.switch,
      dI: m.sig.iL.pp,
      dV: m.sig.vout.pp,
      pulses: kind === 'forward' ? 1 : 2,
      eta: m.eta,
    }
  })
}

function analyseResonant(params, exp) {
  const base = resonantParams(params)
  const conv = resonantConverter(exp.kind, base)
  const ss = resonantSteadyState(conv)
  const m = resonantMeasures(ss)
  const wf = waveforms(ss, { periods: exp.periods || 2, n: 400 })
  const p = conv.p
  const formulas = {
    n: base.n,
    Np: params.Np || 2,
    fr: conv.fr,
    fr2: conv.fr2,
    Z0: conv.Z0,
    Rac: conv.Rac,
    Q: conv.Q,
    ratio: base.fs / conv.fr,
    Mfha: m.Mfha,
    fhaGain: fhaGain(exp.kind, base),
    fhaError: m.fhaError,
    clamp: base.n / 2,
    zvs: m.zvs,
    zcs: m.zcs,
    iOn: m.iTurnOn,
    iOff: m.iTurnOff,
    lossTurnOn: m.lossTurnOn,
    lossTurnOff: m.lossTurnOff,
    ratioLm: base.Lm / base.Lr,
    blocking: p.Vin,
    rail: p.Vin,
    switching: { D: 0.5, fs: base.fs, T: conv.T, n: base.n },
    hard: hardReference(base, m),
  }
  return { kind: exp.kind, jk: true, resonant: true, isolated: true, T: ss.T, p, base, conv, ss, m, wf, formulas, gate: gateOf(ss, conv, base), inverted: false, sign: 1, balance: balanceOf(ss) }
}

/**
 * The hard-switched half-bridge that delivers the same output from the same
 * rail into the same load, with the same devices. Its edges are charged at
 * the current it is actually carrying when they happen, which is the load's,
 * because nothing has moved it out of the way.
 *
 * A half-bridge switch is on for at most half the period, so a ratio it
 * cannot reach is clamped and `matched` says so rather than the row
 * pretending to compare like with like.
 */
export function hardReference(base, m) {
  const n = 0.5
  const want = m.sig.vout.avg / (n * base.Vin)
  const D = clamp(want, 0.02, 0.49)
  const conv = halfBridge({ Vin: base.Vin, n, D, L: 100e-6, C: 100e-6, R: base.R, fs: base.fs, RL: base.Rs, tr: base.tr, tf: base.tf })
  const hm = measures(steadyState(conv))
  return {
    matched: Math.abs(D - want) < 1e-9,
    D,
    Vout: hm.sig.vout.avg,
    iOn: hm.iTurnOn,
    iOff: hm.iTurnOff,
    switching: hm.loss.switching,
    eta: hm.eta,
    Pout: hm.Pout,
    closedForm: hardSwitchedEdgeLoss({ Vin: base.Vin, Iout: Math.abs(hm.Iout), tr: base.tr, tf: base.tf, fs: base.fs }),
  }
}

/** Everything the panes draw, for an experiment of these two groups. */
export function analyseJk(params, exp) {
  if (FORWARD_KINDS.includes(exp.kind)) return analyseForward(params, exp)
  if (RESONANT_KINDS.includes(exp.kind)) return analyseResonant(params, exp)
  throw new Error(`no analysis for "${exp.kind}"`)
}

// ---------------------------------------------------------------- sweeps

const linSpace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1))
const logSpace = (a, b, n) => Array.from({ length: n }, (_, i) => a * Math.pow(b / a, i / (n - 1)))

/** M against duty, at the current load, with the ideal ratio beside it. */
export function sweepDuty(params, exp, n = 41) {
  const base = forwardParams(params)
  return linSpace(0.02, 0.49, n).map((D) => {
    const conv = forwardFamily(exp.kind, { ...base, D })
    const ss = windowedSteadyState(conv)
    const m = forwardMeasures(ss)
    return { x: D, Mn: m.M, pred: forwardM(exp.kind, D, base.n), mode: ss.mode, eta: m.eta }
  })
}

/** The magnetising offset against the mismatch that causes it. */
export function sweepMismatch(params, exp, n = 33) {
  const base = forwardParams(params)
  return linSpace(0, 2, n).map((mismatch) => {
    const conv = forwardFamily(exp.kind, { ...base, mismatch })
    const m = forwardMeasures(windowedSteadyState(conv))
    return {
      x: mismatch,
      iMdc: m.sig.iM.avg,
      pred: fluxWalk({ n: base.n, Iout: m.Iout, Ron1: conv.Ron1, Ron2: conv.Ron2 }),
    }
  })
}

/** The gain curve against frequency, with the first-harmonic answer beside it. */
export function sweepGain(params, exp, n = 21) {
  const base = resonantParams(params)
  return logSpace(50e3, 400e3, n).map((fs) => {
    const conv = resonantConverter(exp.kind, { ...base, fs })
    const m = resonantMeasures(resonantSteadyState(conv))
    return { x: fs, Mn: m.M, pred: fhaRatio(exp.kind, { ...base, fs }), eta: m.eta }
  })
}

/** Efficiency against frequency, with the hard-switched bridge's under it. */
export function sweepSoft(params, exp, n = 15) {
  const base = resonantParams(params)
  return logSpace(60e3, 400e3, n).map((fs) => {
    const conv = resonantConverter(exp.kind, { ...base, fs })
    const m = resonantMeasures(resonantSteadyState(conv))
    return { x: fs, eta: m.eta, etaHard: hardReference({ ...base, fs }, m).eta }
  })
}

/** Which sweep an experiment of these groups draws. */
export function sweepJk(exp, params) {
  const s = exp.sweep
  if (!s) return null
  if (s.x === 'mismatch') return { points: sweepMismatch(params, exp), at: params.mismatch, label: '⟨i_M⟩ measured' }
  if (s.x === 'D') return { points: sweepDuty(params, exp), at: params.D, label: 'M measured' }
  if (s.y === 'eta') return { points: sweepSoft(params, exp), at: params.fs, label: 'η, resonant', label2: 'η, hard-switched' }
  return { points: sweepGain(params, exp), at: params.fs, label: 'M measured' }
}

// ------------------------------------------------------------- the top bar

/** The top bar's chips: what this converter is doing, in its own terms. */
export function jkFlow(exp, params, x) {
  const f = x.formulas
  if (x.resonant) {
    return {
      mode: x.gate ? 'did not settle' : f.zvs ? 'zero-voltage turn-on' : f.zcs ? 'zero current at the edge' : 'hard turn-on',
      mid: `f / f_r = ${f.ratio.toFixed(3)}`,
      out: `M = ${x.m.M.toFixed(4)}`,
      outSub: `n/2 = ${f.clamp.toFixed(3)}`,
    }
  }
  return {
    mid: `${fmt(f.rail, 'V', 3)} in, ${f.Np}:1`,
    out: `M = ${x.m.M.toFixed(4)}`,
    outSub: `blocks ${fmt(f.blocking, 'V', 3)}`,
  }
}

/** The one-line result, for the top bar and the report. */
export function jkOutcome(exp, x) {
  const f = x.formulas
  if (x.gate) return 'the periodic state did not settle at these settings'
  if (x.resonant) {
    return `M = ${x.m.M.toFixed(4)} at f/f_r = ${f.ratio.toFixed(3)}, ${f.zvs ? 'zero-voltage' : f.zcs ? 'zero-current' : 'hard'} turn-on, η = ${(x.m.eta * 100).toFixed(2)} %`
  }
  return `M = ${x.m.M.toFixed(4)}, each switch blocks ${fmt(f.blocking, 'V', 3)}, η = ${(x.m.eta * 100).toFixed(2)} %`
}

// ----------------------------------------------------------- the math panel

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const Ck = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })
const row = (label, predicted, measured, unit = '', tol = 0.01, abs = 0, unchecked = null) => ({
  label,
  predicted,
  measured,
  unit,
  tol,
  abs,
  ...(unchecked ? { unchecked } : {}),
})

const INTRO = {
  j1:
    'The switch puts the rail across the primary and the secondary hands the filter n times it, so ' +
    'volt-second balance on the output inductor gives n·D. The core takes its own volt-seconds at ' +
    'the same time, and the reset winding is what gives them back.',
  j2:
    'Two half cycles, driven through two resistances. Volt-second balance on the magnetising ' +
    'inductance over the whole period says the two have to cancel, and the only thing free to ' +
    'change is the DC current each switch carries.',
  j3:
    'The output side of a push-pull and a full bridge is one circuit, so the ratio is one formula. ' +
    'What differs is the primary: the push-pull reflects the driven half onto the idle switch, and ' +
    'the bridge does not.',
  k1:
    'A series L and C is a short at one frequency and an impedance everywhere else, so the tank ' +
    'passes the whole square wave at resonance and less of it away from there. What the rectifier ' +
    'clamps the primary to is what sets the output.',
  k2:
    'With the rectifier blocking, the magnetising inductance joins the tank and the pair rings ' +
    'slower. Between that resonance and the tank\u2019s own, the primary can carry more than the ' +
    'square wave that drives it.',
  k3:
    'The switching-loss model is the same one Group G uses, with one change: the turn-on term is ' +
    'charged only when the current is flowing the wrong way to pay for it.',
}

function forwardMath(exp, params, x) {
  const m = x.m
  const f = x.formulas
  const p = x.p
  const pair = exp.kind !== 'forward'
  const dcm = x.ss.mode === 'DCM'
  const dcmWhy = dcm
    ? 'The output inductor empties before the period ends, so a dead interval appears and the ratio leaves the duty behind. The continuous-conduction form does not apply here.'
    : null
  const lossy = p.Ron > 0
  const lossyWhy = lossy
    ? `The switch drops ${fmt(p.Ron, 'Ω', 3)} times the primary current, so the winding sees less than the rail and the ideal form is high by that much.`
    : null
  // The flux-walk form takes the load current as a flat number, because it
  // balances volt-seconds over two intervals with one current in each. A
  // large output ripple, or a dead interval, makes the current the switch
  // actually carries through its own half differ from the period's mean, and
  // then the form has the wrong number in it.
  const rippleShare = m.sig.iL.pp / Math.max(1e-12, Math.abs(m.Iout))
  const walkWhy = dcm || rippleShare > 0.3
    ? `The form uses the load current as a flat ${fmt(Math.abs(m.Iout), 'A', 3)}. Here the inductor's ripple is ${(rippleShare * 100).toFixed(0)} % of it, so what each switch carries through its own half is not that number.`
    : null
  const esrWhy = p.ESR > 0
    ? `The capacitor's ${fmt(p.ESR, 'Ω', 3)} of series resistance puts a step on the ripple that the triangle's own form does not carry.`
    : null
  const rows = [
    row('M = V_out/V_in', f.M, m.M, '', 5e-3, 0, dcmWhy || lossyWhy),
    row('⟨v_L⟩ over a period', 0, m.sig.vL.avg, 'V', 0, 1e-9 * p.Vin),
    row('⟨i_C⟩ over a period', 0, m.sig.iC.avg, 'A', 0, 1e-6 * Math.max(1e-6, m.sig.iL.rms)),
    row('⟨i_D⟩ = I_out', Math.abs(m.Iout), m.sig.iD.avg, 'A', 5e-3),
    row('ΔI_L', f.dI, m.sig.iL.pp, 'A', 2e-2, 0, dcmWhy || lossyWhy),
    row('ΔV_out', f.dV, m.sig.vout.pp, 'V', 5e-2, 0, dcmWhy || esrWhy || lossyWhy),
    pair
      ? row('ΔI_M = V_in·D/(L_m f_s)', f.iMpk, m.sig.iM.pp, 'A', 5e-2, 0, lossyWhy)
      : row('the reset interval, n_r·D·T', f.resetTime, f.resetMeasured, 's', 1e-6, 0, lossy ? lossyWhy : null),
    pair
      ? row('⟨i_M⟩ = n·I_out(R_on2 − R_on1)/(R_on1 + R_on2)', f.iMwalk, f.iMdc, 'A', 1e-1, 1e-4 * Math.max(1e-6, f.iMripple), walkWhy || (f.driftFree ? 'With no resistance in the primary the two half cycles cancel whatever offset the core carries, so no offset is preferred and the form has nothing to divide by. The solver holds the period mean at zero instead.' : null))
      : row('i_M peak = V_in·D/(L_m f_s)', f.iMpk, m.sig.iM.max, 'A', 2e-2, 0, lossyWhy),
    row('P_in = P_out + conduction losses', m.Pout + m.Pcond, m.Pin, 'W', 1e-7),
  ]
  const values = [
    { label: 'turns ratio n = N_s/N_p', value: f.n, unit: '', note: `${fmt(f.Np, '', 3)}:1 primary to secondary` },
    { label: 'the secondary pulse n·V_in', value: f.pulse, unit: 'V', note: `for ${((pair ? 2 : 1) * p.D * 100).toFixed(1)} % of each period in total` },
    { label: 'V_out', value: m.sig.vout.avg, unit: 'V' },
    { label: 'I_out', value: m.Iout, unit: 'A' },
    { label: 'each switch blocks', value: f.blocking, unit: 'V', note: `${f.stressRatio.toFixed(2)}× the rail, across ${f.switches} switch${f.switches === 1 ? '' : 'es'}` },
    { label: 'ripple pulses per switching period', value: f.ripplePulses, unit: '', note: pair ? `two, at ${fmt(2 * p.fs, 'Hz', 3)}` : 'one, at f_s' },
    { label: '⟨i_M⟩', value: f.iMdc, unit: 'A', note: pair ? (f.driftFree ? 'held at zero: no offset is preferred' : `of a ${fmt(f.iMripple, 'A', 3)} ripple`) : 'the reset returns it each period' },
    { label: 'R_crit', value: f.Rcrit, unit: 'Ω', note: 'the output inductor empties above this load' },
    { label: 'the duty ceiling', value: f.maxDuty, unit: '', note: pair ? 'both switches would conduct at once above this' : 'the reset needs the rest of the period' },
    { label: 'η', value: m.eta * 100, unit: '%' },
  ]
  return {
    blocks: [
      T(INTRO[exp.id]),
      F(
        pair
          ? '(n V_{in} - V_{out})\\,D = V_{out}\\left(\\tfrac{1}{2} - D\\right) \\;\\Rightarrow\\; M = 2 n D'
          : '(n V_{in} - V_{out})\\,D = V_{out}(1 - D) \\;\\Rightarrow\\; M = n D',
        'volt-second balance on the output inductor',
      ),
      F(
        pair
          ? '\\langle i_M \\rangle = \\frac{n I_{out}(R_{on2} - R_{on1})}{R_{on1} + R_{on2}}, \\qquad |\\langle i_M \\rangle| < n I_{out}'
          : 't_{reset} = n_r D T, \\qquad D < \\frac{1}{1 + n_r}, \\qquad V_{switch} = V_{in}\\left(1 + \\tfrac{1}{n_r}\\right)',
        pair ? 'volt-second balance on the magnetising inductance' : 'the reset, and what it costs the switch',
      ),
      Ck(rows),
      V(values),
    ],
  }
}

function resonantMath(exp, params, x) {
  const m = x.m
  const f = x.formulas
  const p = x.p
  // Rule 3's guard, as a row that stops comparing rather than a hedge: the
  // first-harmonic gain is compared where it holds and footnoted where it
  // does not, with the measured gap in the footnote.
  const fhaWhy = Math.abs(f.fhaError) > 0.05
    ? `At f/f_r = ${f.ratio.toFixed(3)} the tank current is not close enough to a sine for the fundamental to stand for it. The measured ratio is ${(f.fhaError * 100).toFixed(1)} % from what the formula says.`
    : null
  const rows = [
    row('⟨v_Lr⟩ over a period', 0, m.sig.vL.avg, 'V', 0, 1e-7 * p.Vin),
    row('⟨i_r⟩ over a period', 0, m.sig.iL.avg, 'A', 0, 1e-6 * Math.max(1e-6, m.sig.iL.rms)),
    row('⟨i_C⟩ over a period', 0, m.sig.iC.avg, 'A', 0, 1e-6 * Math.max(1e-6, m.sig.iL.rms)),
    row('M against the first-harmonic gain', f.Mfha, m.M, '', 6e-2, 0, fhaWhy),
    row('⟨i_D⟩ = I_out', Math.abs(m.Iout), m.sig.iD.avg, 'A', 1e-6),
    row('P_in = ⟨v_sw · i_r⟩', m.meanProd('vsw', 'iL'), m.Pin, 'W', 1e-7),
    row('P_in = P_out + conduction losses', m.Pout + m.Pcond, m.Pin, 'W', 1e-7),
  ]
  const values = [
    { label: 'turns ratio n = N_s/N_p', value: f.n, unit: '', note: `${fmt(f.Np, '', 3)}:1 primary to secondary` },
    { label: 'f_r, the tank\u2019s own resonance', value: f.fr, unit: 'Hz', note: `f_s is ${f.ratio.toFixed(3)} times it` },
    { label: 'f_r2, with the magnetising inductance in', value: f.fr2, unit: 'Hz', note: x.kind === 'llc' ? `L_m/L_r = ${f.ratioLm.toFixed(2)}` : 'the same, with no L_m to add' },
    { label: 'Z_0 = √(L_r/C_r)', value: f.Z0, unit: 'Ω' },
    { label: 'R_ac = 8R/(π²n²)', value: f.Rac, unit: 'Ω', note: 'the load the rectifier reflects back' },
    { label: 'Q = Z_0/R_ac', value: f.Q, unit: '' },
    { label: 'M at resonance, n/2', value: f.clamp, unit: '', note: 'what the tank gives when the pair is a short' },
    { label: 'i_r at turn-on', value: f.iOn, unit: 'A', note: f.zvs ? 'flowing the other way, so the turn-on is free' : f.zcs ? 'already at zero' : 'the switch pays for this one' },
    { label: 'i_r at turn-off', value: f.iOff, unit: 'A' },
    { label: 'turn-off charge', value: f.lossTurnOff, unit: 'W', note: `½·V_in·i·t_f, twice a period` },
    { label: 'the same output, hard-switched', value: f.hard.switching, unit: 'W', note: f.hard.matched ? `at ${(f.hard.eta * 100).toFixed(2)} % against this converter's ${(m.eta * 100).toFixed(2)} %` : 'the nearest a half-bridge can reach from this rail' },
    { label: 'η', value: m.eta * 100, unit: '%' },
  ]
  return {
    blocks: [
      T(INTRO[exp.id]),
      F(
        '\\omega_r = \\frac{1}{\\sqrt{L_r C_r}}, \\qquad Z_0 = \\sqrt{L_r/C_r}, \\qquad R_{ac} = \\frac{8R}{\\pi^2 n^2}, \\qquad Q = Z_0/R_{ac}',
        'the tank, in four numbers',
      ),
      F(
        x.kind === 'llc'
          ? 'M = \\frac{n}{2}\\left|\\frac{Z_p}{Z_p + j\\omega L_r + 1/(j\\omega C_r)}\\right|, \\qquad Z_p = j\\omega L_m \\parallel R_{ac}'
          : 'M = \\frac{n}{2}\\left|\\frac{R_{ac}}{R_{ac} + j\\left(\\omega L_r - 1/(\\omega C_r)\\right)}\\right|',
        'the first-harmonic gain, which is an approximation and is drawn as one',
      ),
      Ck(rows),
      V(values),
    ],
  }
}

/** The math panel for an experiment of these two groups. */
export function jkMath(exp, params, x) {
  const entry = x.resonant ? resonantMath(exp, params, x) : forwardMath(exp, params, x)
  if (!x.gate) return entry
  // A solve that did not settle is compared against nothing. The rows stay on
  // the screen, each carrying the reason, so the reader sees which claims are
  // waiting rather than a panel that has gone blank.
  for (const b of entry.blocks) {
    if (b.kind === 'check') for (const r of b.rows) r.unchecked = x.gate
  }
  entry.blocks[0] = T(x.gate)
  return entry
}
