// The experiments: each is a converter (or the thing a converter replaces),
// the knobs on it, a note that makes a claim, and which panes best show the
// claim.
//
// The note is prose, and prose drifts — so experiments.test.js loads every
// experiment at its defaults and measures the claim its note makes, from the
// same analysis the panes draw. A number in a note that the engine does not
// reproduce fails a test rather than misleading a reader.
//
// Groups follow POWER_LAB_PLAN.md: A is why a switch beats a resistor, B the
// buck converter — volt-second balance, M = D, ripple, discontinuous
// conduction, the boundary between the modes, and real parts; C the boost
// and the buck-boost; D the magnetics — flux, saturation, and the two
// converters a transformer makes; E the line side — diode rectifiers into a
// capacitor, what they ask of the grid, the phase-cut dimmer, and the
// three-phase six-pulse bridge; F the inverters, square wave and sine PWM;
// G where the watts go. The control bridge and the groups after it are the
// plan's later phases and are not here yet.
//
// The plan's letters live in the ids (a1 … g4) and nowhere the reader sees:
// a list that runs A, B, C, E advertises the group that is not built yet,
// and the letters said nothing a name does not.

import {
  LMN_GROUPS,
  LMN_GROUP_INTROS,
  LMN_TRACES,
  LMN_VIEWS,
  LMN_SWEEP_X,
  LMN_SWEEP_Y,
  LMN_EXPERIMENTS,
} from './groups/lmn.js'

export const GROUPS = ['Why switch', 'The buck', 'Boost & buck-boost', 'Magnetics', 'AC in', 'Inverters', 'Losses', ...LMN_GROUPS]

// What each group sets out to establish, read once at its boundary: the
// sidebar shows it on the group's first experiment and while another group's
// tab is being browsed. Two sentences, at most 45 words (path.test.js).
export const GROUP_INTROS = {
  'Why switch':
    'A part that drops voltage while carrying current wastes their product. This group replaces it ' +
    'with a switch, sees what the switch alone gets wrong, and adds the filter that fixes it.',
  'The buck':
    'One rule, volt-second balance, gives the buck its output ratio. The same rule gives its ripple, ' +
    'what happens when it runs dry at light load, where that boundary sits, and what real parts cost.',
  'Boost & buck-boost':
    'Move the switch and the inductor\u2019s volt-seconds stack on the source instead of subtracting from it. ' +
    'The ideal ratios run away as D \u2192 1; winding resistance and light load say where they really go.',
  'AC in':
    'Before any converter there is a rectifier and a capacitor. This group measures what they deliver, ' +
    'what they ask of the line, and how a dimmer and a three-phase bridge compare.',
  Magnetics:
    'An inductance is a number until you ask what holds the flux. This group puts the inductor on a core, ' +
    'finds the current past which the core holds no more flux, and gives it a second winding.',
  Inverters:
    'A bridge that rectifies AC into DC runs the other way round as well. This group turns a rail back ' +
    'into a sine, first by switching twice a cycle and then by switching a hundred times a cycle.',
  Losses:
    'Every loss so far has been one bar on a chart. This group prices them against frequency, against ' +
    'load, and against each other in a ledger that has to add up.',
  ...LMN_GROUP_INTROS,
}

// ------------------------------------------------------------ knobs
const Vin = (def = 12) => ({ key: 'Vin', label: 'V_in', unit: 'V', min: 1, max: 48, scale: 'linear', step: 0.1, default: def, hint: 'Input voltage' })
const Vo = (def = 5) => ({ key: 'Vo', label: 'V_out', unit: 'V', min: 0.5, max: 48, scale: 'linear', step: 0.1, default: def, hint: 'The regulated output; must be below V_in' })
const D = (def = 5 / 12) => ({ key: 'D', label: 'D', unit: '%', percent: true, min: 0.02, max: 0.98, scale: 'linear', step: 0.001, default: def, hint: 'Duty: the share of each period the switch is on' })
const L = (def = 100e-6) => ({ key: 'L', label: 'L', unit: 'H', min: 1e-6, max: 10e-3, scale: 'log', default: def, hint: 'Inductance' })
const C = (def = 100e-6) => ({ key: 'C', label: 'C', unit: 'F', min: 1e-6, max: 10e-3, scale: 'log', default: def, hint: 'Output capacitance' })
const R = (def = 5) => ({ key: 'R', label: 'R_load', unit: 'Ω', min: 0.5, max: 1000, scale: 'log', default: def, hint: 'Load resistance' })
const Fs = (def = 100e3) => ({ key: 'fs', label: 'f_s', unit: 'Hz', min: 10e3, max: 2e6, scale: 'log', default: def, hint: 'Switching frequency' })
const Ron = (def = 0) => ({ key: 'Ron', label: 'R_on', unit: 'Ω', min: 0, max: 0.5, scale: 'linear', step: 0.001, default: def, hint: 'Switch on-resistance' })
const Vf = (def = 0) => ({ key: 'Vf', label: 'V_f', unit: 'V', min: 0, max: 1.2, scale: 'linear', step: 0.005, default: def, hint: 'Diode forward drop' })
const RL = (def = 0) => ({ key: 'RL', label: 'R_L', unit: 'Ω', min: 0, max: 0.5, scale: 'linear', step: 0.001, default: def, hint: 'Inductor winding resistance' })
const ESR = (def = 0) => ({ key: 'ESR', label: 'ESR', unit: 'Ω', min: 0, max: 1, scale: 'linear', step: 0.002, default: def, hint: 'Capacitor series resistance' })
const Tsw = (def = 0) => ({ key: 'tsw', label: 't_sw', unit: 's', min: 0, max: 200e-9, scale: 'linear', step: 1e-9, default: def, hint: 'Switch rise and fall time (each edge)' })
/** A two-position knob: `on` and `off` are the texts of the two positions. */
const Sync = (def = 0) => ({ key: 'sync', label: 'Freewheel', kind: 'toggle', default: def, on: 'synchronous switch', off: 'diode', hint: 'What carries the inductor current while the switch is off' })
// Line side.
const Rlb = (def = 20) => ({ key: 'R', label: 'R_load', unit: 'Ω', min: 0.5, max: 1000, scale: 'log', default: def, hint: 'Load resistance' })
const RLw = (def = 0.2) => ({ key: 'RL', label: 'R_L', unit: 'Ω', min: 0, max: 0.5, scale: 'linear', step: 0.001, default: def, hint: 'Inductor winding resistance' })

const Vs = (def = 12.6) => ({ key: 'Vs', label: 'V_s', unit: 'V', min: 3, max: 48, scale: 'linear', step: 0.1, default: def, hint: 'Source voltage, RMS (a transformer secondary, phase to neutral)' })
const Vline = (def = 120) => ({ key: 'Vs', label: 'V_s', unit: 'V', min: 12, max: 240, scale: 'linear', step: 0.5, default: def, hint: 'Line voltage, RMS' })
const F = (def = 60) => ({ key: 'f', label: 'f', unit: 'Hz', min: 20, max: 1000, scale: 'log', default: def, hint: 'Line frequency' })
const Rs = (def = 0.5) => ({ key: 'Rs', label: 'R_s', unit: 'Ω', min: 0.05, max: 10, scale: 'log', default: def, hint: 'Source resistance: the winding and wiring the diode current must come through' })
const Vfd = (def = 0.7) => ({ key: 'Vf', label: 'V_f', unit: 'V', min: 0, max: 1.2, scale: 'linear', step: 0.005, default: def, hint: 'Forward drop of each diode' })
const Cf = (def = 1000e-6) => ({ key: 'C', label: 'C', unit: 'F', min: 10e-6, max: 10e-3, scale: 'log', default: def, hint: 'Reservoir capacitor' })
const Rl = (def = 100) => ({ key: 'R', label: 'R_load', unit: 'Ω', min: 5, max: 2000, scale: 'log', default: def, hint: 'Load resistance' })
const Alpha = (def = 90) => ({ key: 'alphaDeg', label: 'α', unit: '°', min: 0, max: 180, scale: 'linear', step: 0.5, default: def, hint: 'Firing angle: how far into each half-cycle the triac turns on' })

// Magnetics. The core is three numbers, and the saturation current follows
// from them: I_sat = B_sat·N·A_e/L. The area is carried in mm², which is the
// unit a core is sold in and the one an engineering prefix does not mangle.
const Turns = (def = 40) => ({ key: 'N', label: 'N', unit: '', min: 5, max: 400, scale: 'log', default: def, hint: 'Turns of wire on the core' })
const Area = (def = 40) => ({ key: 'Ae', label: 'A_e', unit: 'mm²', min: 5, max: 400, scale: 'log', default: def, hint: 'Cross-section of the core the flux runs through' })
const Bsat = (def = 0.3) => ({ key: 'Bsat', label: 'B_sat', unit: 'T', min: 0.1, max: 1.5, scale: 'linear', step: 0.005, default: def, hint: 'Flux density past which the core holds no more' })
// The turns ratio is written the way a transformer is labelled, primary to
// secondary, so a step-down converter's knob reads 2 rather than 500 m.
const Ratio = (def = 2) => ({ key: 'Np', label: 'N_p:N_s', unit: '', min: 1, max: 20, scale: 'log', default: def, hint: 'Turns ratio, primary to secondary' })
// Each half-bridge switch is on for at most half the period; past that the
// two would conduct at once.
const Dhb = (def = 5 / 12) => ({ key: 'D', label: 'D', unit: '%', percent: true, min: 0.02, max: 0.49, scale: 'linear', step: 0.001, default: def, hint: 'Duty of each switch, at most one half of the period' })

// Inverters.
const Vdc = (def = 48) => ({ key: 'Vdc', label: 'V_dc', unit: 'V', min: 12, max: 400, scale: 'log', default: def, hint: 'The DC rail the bridge switches' })
const Fund = (def = 60) => ({ key: 'f1', label: 'f₁', unit: 'Hz', min: 50, max: 400, scale: 'log', default: def, hint: 'Output frequency the modulator asks for' })
const Ma = (def = 0.8) => ({ key: 'ma', label: 'm_a', unit: '%', percent: true, min: 0.05, max: 1.4, scale: 'linear', step: 0.005, default: def, hint: 'Modulation index: the reference’s height against the carrier’s' })
const Fsw = (def = 3780) => ({ key: 'fsw', label: 'f_sw', unit: 'Hz', min: 300, max: 8e3, scale: 'log', default: def, hint: 'Carrier frequency, locked to an odd multiple of f₁' })

// Scope traces: voltages on the left axis, currents on the right.
export const TRACES = {
  vin: { label: 'v_in', axis: 'V', title: 'Source voltage (phase a, for the three-phase bridge)' },
  vsw: { label: 'v_sw', axis: 'V', title: 'Switch node: what the inductor sees on its input side' },
  vrect: { label: 'v_rect', axis: 'V', title: 'What the diodes pass: the rectified source the conducting pair sees' },
  vout: { label: 'v_out', axis: 'V', title: 'Output voltage across the load' },
  vL: { label: 'v_L', axis: 'V', title: 'Voltage across the inductor' },
  vD: { label: 'v_D', axis: 'V', title: 'Voltage across the first diode, anode to cathode: its most negative is the PIV' },
  iL: { label: 'i_L', axis: 'A', title: 'Inductor current' },
  iC: { label: 'i_C', axis: 'A', title: 'Capacitor current' },
  iR: { label: 'i_R', axis: 'A', title: 'Load current' },
  iQ: { label: 'i_Q', axis: 'A', title: 'Current in the switch' },
  iD: { label: 'i_D', axis: 'A', title: 'Current in the diode (or synchronous switch)' },
  iin: { label: 'i_in', axis: 'A', title: 'Current drawn from the source (phase a, for the three-phase bridge)' },
  ...LMN_TRACES,
}

/** The trace pills the scope offers: the experiment's own list, else its opening traces. */
export const offeredTraces = (exp) => exp.allTraces || exp.traces

export const VIEWS = {
  measures: { label: 'Measures', title: 'Average, RMS and peak-to-peak of every waveform, and the power' },
  balance: { label: 'Balance', title: 'Volt-seconds on the inductor and coulombs on the capacitor, segment by segment' },
  math: { label: 'Math', title: 'Every formula the note leans on, evaluated beside what the waveform measures' },
  sweep: { label: 'Sweep', title: 'One measure as one knob sweeps its range' },
  losses: { label: 'Losses', title: 'Where the input power goes' },
  spectrum: { label: 'Spectrum', title: 'The harmonics of the waveform, and what they cost in power factor or distortion' },
  flux: { label: 'Flux', title: 'Flux density over one period, against the ceiling the core sets' },
  scrub: { label: 'Scrub', title: 'The conducting path at one instant, scrubbed through the period' },
  ledger: { label: 'Ledger', title: 'Every loss mechanism, its formula, and the residual the identity leaves' },
  ...LMN_VIEWS,
}

// What a sweep can put on its axes. `sweepFor` in App.jsx runs the matching
// sweep; SweepCanvas reads the labels and scales from here.
export const SWEEP_X = {
  D: { label: 'D', unit: '', scale: 'linear', fmt: (v) => v.toFixed(3) },
  // The linear regulator has no switch and no duty. Its sweep runs over the
  // conversion ratio it is set to, which is the same number on the axis and a
  // different quantity entirely — and on the lab's opening screen, an axis
  // labelled "Duty D" beside a circuit with no switch in it is simply wrong.
  ratio: { label: 'V_out / V_in', unit: '', scale: 'linear', fmt: (v) => v.toFixed(3) },
  R: { label: 'R_load', unit: 'Ω', scale: 'log' },
  C: { label: 'C', unit: 'F', scale: 'log' },
  fs: { label: 'f_s', unit: 'Hz', scale: 'log' },
  alpha: { label: 'α', unit: '°', scale: 'linear', fmt: (v) => `${v.toFixed(0)}°` },
  ma: { label: 'm_a', unit: '', scale: 'linear', fmt: (v) => `${(v * 100).toFixed(0)} %` },
  fsw: { label: 'f_sw', unit: 'Hz', scale: 'log' },
  ...LMN_SWEEP_X,
}
// A sweep's `y2` goes on a right-hand axis of its own, unless the sweep says
// `shared: true` — then both curves share the left axis (the chopper's ⟨v⟩
// and V_rms are both volts, and the gap between them is the lesson).
export const SWEEP_Y = {
  M: { label: 'M = V_out / V_in', unit: '', lo: 0, hi: 1 },
  eta: { label: 'η', unit: '', lo: 0, hi: 1, percent: true },
  Pout: { label: 'P_out', unit: 'W', scale: 'log' },
  Vout: { label: 'V_out', unit: 'V', lo: 0 },
  vavg: { label: '⟨v⟩', unit: 'V', lo: 0 },
  vrms: { label: 'V_rms', unit: 'V', lo: 0 },
  angle: { label: 'conduction angle', unit: '°', lo: 0 },
  iPeak: { label: 'i_D peak', unit: 'A', lo: 0 },
  share: { label: 'P / P_full', unit: '', lo: 0, hi: 1 },
  pf: { label: 'power factor', unit: '', lo: 0, hi: 1 },
  v1: { label: 'fundamental, peak', unit: 'V', lo: 0 },
  thd: { label: 'THD of v_out', unit: '', lo: 0, percent: true },
  ...LMN_SWEEP_Y,
}

// The top bar's third meter is the experiment's own headline — η for a
// converter, PF on the line side, and V_rms against ⟨v⟩ for the chopper,
// whose η is 1 by definition and the opposite of its lesson (A2).
const buck = (over) => ({
  kind: 'buck',
  headline: 'eta',
  traces: ['vsw', 'vout', 'iL'],
  allTraces: ['vsw', 'vout', 'vL', 'iL', 'iQ', 'iD', 'iC', 'iin'],
  views: ['measures', 'balance', 'math', 'sweep', 'losses'],
  view: 'measures',
  sweep: { x: 'D', y: 'M' },
  periods: 2,
  ...over,
})

// The boost and the buck-boost: the same clocked steady state as the buck, so
// the same panes, with the group's own load and the switch node on the scope
// (it is where the two topologies differ most visibly).
const pwm = (kind, over) => ({
  kind,
  headline: 'eta',
  symbols: ['K'],
  params: [Vin(), D(0.5), L(), C(), Rlb(), Fs()],
  traces: ['vsw', 'vout', 'iL'],
  allTraces: ['vsw', 'vout', 'vL', 'iL', 'iQ', 'iD', 'iC', 'iin'],
  views: ['measures', 'balance', 'math', 'sweep', 'losses'],
  view: 'measures',
  sweep: { x: 'D', y: 'M' },
  periods: 2,
  ...over,
})

// A rectifier experiment: which bridge, the line-side knobs, and every one
// of its signals on the scope's menu.
const rect = (kind, over) => ({
  kind: 'rectifier',
  rect: kind,
  headline: 'pf',
  params: [Vs(), Cf(), Rl(), Rs(), Vfd(), F()],
  traces: ['vin', 'vout', 'iD'],
  allTraces: ['vin', 'vrect', 'vout', 'vD', 'iD', 'iin', 'iC', 'iR'],
  views: ['measures', 'spectrum', 'math', 'losses'],
  view: 'measures',
  periods: 2,
  ...over,
})

// A buck whose inductor is wound on a core: the same converter, with the
// three numbers that decide when the core runs out of flux.
const core = (over) => ({
  kind: 'buck',
  core: true,
  headline: 'eta',
  traces: ['iL', 'vout'],
  allTraces: ['vsw', 'vout', 'vL', 'iL', 'iQ', 'iD', 'iC', 'iin'],
  views: ['flux', 'measures', 'math', 'balance', 'losses'],
  view: 'flux',
  periods: 2,
  ...over,
})

// The two isolated converters. `Np` is the turns ratio as a transformer is
// labelled, primary to secondary, and analysis.js inverts it into the
// engine's n = N_s/N_p.
const iso = (kind, over) => ({
  kind,
  headline: 'eta',
  traces: ['vsw', 'vout', 'iL'],
  allTraces: ['vsw', 'vout', 'vL', 'iL', 'iQ', 'iD', 'iC', 'iin'],
  views: ['measures', 'scrub', 'math', 'sweep', 'losses'],
  view: 'measures',
  sweep: { x: 'D', y: 'M' },
  periods: 2,
  ...over,
})

// An inverter: the bridge, the LC and the load, over one fundamental cycle.
const inv = (kind, over) => ({
  kind,
  headline: 'thd',
  params: [Vdc(), Fund(), L(1e-3), C(10e-6), Rlb(10)],
  traces: ['vsw', 'vout'],
  allTraces: ['vsw', 'vout', 'vL', 'iL', 'iC', 'iR', 'iin'],
  views: ['spectrum', 'measures', 'math'],
  view: 'spectrum',
  periods: 1,
  ...over,
})

// The load at which a buck's efficiency peaks: √12·L·f_s/(1 − D), which is
// √3 times the load at the CCM boundary and carries no V_out at all (G2).
const G2_PEAK_LOAD = (Math.sqrt(12) * 22e-6 * 100e3) / (1 - 5 / 12)

export const EXPERIMENTS = [
  // ---------------------------------------------------------- A · Why switch
  {
    id: 'a1',
    about: 'Vo',
    chips: [5, 9],
    try: { knob: 'Vo', text: 'Set V_out to 9 V: efficiency 75.0 %, and 5.4 W still heats the regulator.' },
    group: 'Why switch',
    name: 'The linear regulator',
    kind: 'linreg',
    headline: 'eta',
    params: [Vin(), Vo(), R()],
    // A regulator has no time-domain story: its scope would be three flat
    // lines, and §11.6.5 is right that the first screen should show the 7 W —
    // the number the lab exists to beat. What it should NOT be is two bars
    // blown up to fill a column, which is a poster where a reading belongs.
    // So the bars are sized as information and the efficiency line sits under
    // them in the same pane: the loss first, then the claim that no setting
    // improves it.
    scope: false,
    traces: ['vsw', 'vout', 'iL'],
    views: ['losses', 'measures', 'math', 'sweep'],
    view: 'losses',
    sweep: { x: 'ratio', y: 'eta' },
    note:
      'A series pass element drops the difference and carries the load current, so it dissipates their ' +
      'product. From 12 V to 5 V at 1 A, the load receives 5 W and the regulator dissipates 7 W. ' +
      'Efficiency is 5/12 = 41.7 %, the ratio V_out/V_in at any current. No setting in the sweep ' +
      'improves it. A linear regulator is as efficient as its voltage ratio.',
    terms: ['efficiency', 'linear-regulator'],
  },
  {
    id: 'a2',
    about: 'D',
    chips: [5 / 12, 0.75],
    try: { knob: 'D', text: 'Set D to 75 %: average 9.00 V, RMS 10.4 V. Closer, still not equal.' },
    group: 'Why switch',
    name: 'Chop it',
    kind: 'chopper',
    headline: 'rms',
    params: [Vin(), D(), R(), Fs()],
    // With no filter the output is the switch node and the load current is
    // the same shape over R: one voltage on the scope, the current a chip
    // away, and the measures table lists each once. The sweep is the claim —
    // V_rms above ⟨v⟩ at every D — so it opens there.
    traces: ['vout'],
    allTraces: ['vout', 'iR'],
    views: ['sweep', 'measures', 'losses', 'math'],
    view: 'sweep',
    sweep: { x: 'D', y: 'vavg', y2: 'vrms', shared: true },
    note:
      'Replace the pass element with a switch, on for a fraction D of each period and off for the ' +
      'rest. It dissipates nothing, and the average output is D·V_in = 5.00 V. The load sees 12 V for ' +
      '41.7 % of the time and 0 V for the rest, so its RMS voltage is 7.75 V. That heats by 12.0 W, ' +
      'not the 5.00 W a steady 5 V gives. In the sweep, V_rms = √D·V_in stays above ⟨v⟩ = D·V_in.',
    terms: ['duty', 'rms', 'average'],
  },
  buck({
    id: 'a3',
    about: 'C',
    chips: [100e-6, 10e-6],
    try: { knob: 'C', text: 'Set C to 10 \u00b5F, from 100 \u00b5F: tenfold ripple, 36.5 mV, average still 5.000 V.' },
    group: 'Why switch',
    name: 'Let the LC do the averaging',
    params: [Vin(), D(), L(), C(), R(), Fs()],
    // The output alone: 3.65 mV on 5 V is the claim, and it is invisible on
    // any axis that also holds the 12 V switch node (v_sw is a chip away).
    traces: ['vout'],
    allTraces: ['vsw', 'vout', 'iL'],
    note:
      'Put an inductor and capacitor between the chopped node and the load. The switch node still swings ' +
      '0 ↔ 12 V, but the output is 5.000 V with 3.65 mV of ripple. The filter passes the average and ' +
      'stops the rest: its corner, 1.59 kHz, is 63× below the switching frequency. The load draws ' +
      '5.00 W, the source supplies 5.00 W, and nothing heats up. This is the buck converter, and the ' +
      'next group is why it works.',
    terms: ['buck', 'ripple', 'switch-node', 'average'],
  }),

  // ---------------------------------------------------------- B · The buck
  buck({
    id: 'b1',
    about: 'L',
    chips: [100e-6, 22e-6],
    try: { knob: 'L', text: 'Set L to 22 \u00b5H, from 100 \u00b5H: ripple 1.33 A, balance still 29.2 V\u00b7\u00b5s.' },
    group: 'The buck',
    name: 'Volt-second balance',
    params: [Vin(), D(), L(), R()],
    traces: ['vL', 'iL'],
    view: 'balance',
    note:
      'In steady state the inductor current ends each period where it began, so its voltage averages ' +
      'to zero. The volt-seconds taken on while the switch is on equal those given back while off. ' +
      'That is 29.2 V·µs each way, 7 V for 4.17 µs and 5 V for 5.83 µs. So V_out = D·V_in, and L ' +
      'does not appear. Change L and the ripple changes, the balance does not.',
    terms: ['volt-second', 'steady-state', 'charge-balance', 'ripple'],
  }),
  buck({
    id: 'b2',
    about: 'D',
    chips: [5 / 12, 0.75, 0.25],
    try: { knob: 'D', text: 'Set D to 75 %: 9.000 V out, M = 0.750. At 25 %, 3.000 V.' },
    group: 'The buck',
    name: 'M = D',
    params: [D(), Vin(), R(), L(), Fs()],
    traces: ['vsw', 'vout'],
    view: 'sweep',
    sweep: { x: 'D', y: 'M' },
    note:
      'The conversion ratio M = V_out/V_in equals the duty, and only the duty. At D = 0.417 the output is ' +
      '5.000 V from 12 V. The sweep is a straight line through the origin, at every load that keeps the ' +
      'inductor current above zero. L, C, R and f_s are absent because volt-second balance has none. ' +
      'They set the ripple and the losses, not the ratio. Turn R past 34 Ω and the line bends away, ' +
      'which is the light-load experiment two on from here.',
    terms: ['conversion-ratio', 'duty', 'volt-second', 'ripple'],
  }),
  buck({
    id: 'b3',
    about: 'fs',
    chips: [100e3, 400e3],
    try: { knob: 'fs', text: 'Set f_s to 400 kHz, from 100 kHz: 73 mA of current ripple, 0.23 mV out.' },
    group: 'The buck',
    name: 'Ripple',
    params: [L(), C(), Fs(), D(), Vin(), R()],
    traces: ['iL', 'vout'],
    note:
      'The inductor current is a triangle. It rises at (V_in − V_out)/L while the switch is on and falls ' +
      'at V_out/L while it is off. Its swing is V_out·(1 − D)/(L·f_s) = 0.292 A around the 1.00 A load ' +
      'current. The capacitor integrates that triangle into 3.65 mV of output ripple, ΔI_L/(8·f_s·C). ' +
      'Both formulas assume a flat output while computing how far from flat it is, and land within ' +
      '0.03 % of the exact waveform here.',
    terms: ['ripple', 'small-ripple'],
  }),
  buck({
    id: 'b4',
    about: 'R',
    chips: [200, 5],
    try: { knob: 'R', text: 'Set R_load to 5 \u03a9: continuous conduction, output back at 5.00 V.' },
    group: 'The buck',
    name: 'Light load: discontinuous conduction',
    symbols: ['K'],
    params: [R(200), Sync(), L(), Fs(), D(), Vin()],
    traces: ['vsw', 'iL', 'vout'],
    view: 'sweep',
    sweep: { x: 'R', y: 'M' },
    periods: 2,
    note:
      'At 200 Ω the load wants 25 mA and the ripple is 145 mA peak, so the current reaches zero ' +
      'mid-period. A diode cannot carry it negative, so it blocks. The switch node floats to V_out for ' +
      '41 % of the period, and volt-second balance gains a third term. The output is 8.52 V, M = 0.710 ' +
      'against D = 0.417, and depends on the load. A synchronous switch lets the current go to −121 mA ' +
      'and the output returns to 5.00 V.',
    terms: ['dcm', 'ccm', 'synchronous', 'ripple', 'switch-node', 'volt-second'],
  }),
  buck({
    id: 'b5',
    about: 'R',
    chips: [34.2857142857, 100, 10],
    try: { knob: 'R', text: 'Set R_load to 100 \u03a9: M rises to 0.594, 7.13 V. At 10 \u03a9, 0.417.' },
    group: 'The buck',
    name: 'The boundary',
    symbols: ['K'],
    params: [R(34.2857142857), L(), Fs(), D(), Vin()],
    traces: ['iL', 'vsw'],
    view: 'sweep',
    sweep: { x: 'R', y: 'M' },
    note:
      'Conduction is continuous while the average current exceeds half the ripple. In the dimensionless ' +
      'form K = 2·L·f_s/R that is K > 1 − D. With 100 µH at 100 kHz and D = 0.417 the boundary is ' +
      'R_crit = 34.3 Ω, and the knob starts there: the current valley just touches zero. The two ' +
      'formulas for M agree at the boundary, so the curve has a kink, not a step. Nothing jumps when ' +
      'the diode first blocks for an instant.',
    terms: ['k-parameter', 'dcm', 'ccm', 'average', 'ripple'],
  }),
  buck({
    id: 'b6',
    about: 'Vf',
    chips: [0.5, 1, 0],
    try: { knob: 'Vin', text: 'Set V_in to 48 V: the same rent on 19.7 V out, efficiency 98.5 %.' },
    group: 'The buck',
    name: 'The diode’s rent',
    symbols: ['K'],
    // One real part at a time (§11.2.2): the diode here, the resistances in
    // B7, the edges in B8. Every other loss knob is off the panel, so the
    // losses pane has one bar and the note one number to explain.
    params: [Vf(0.5), Sync(), Vin(), D(), R()],
    traces: ['vsw', 'vout', 'iL'],
    view: 'losses',
    sweep: { x: 'D', y: 'eta' },
    note:
      'Give the diode a 0.5 V drop. It carries the inductor current for the 58 % of each period the ' +
      'switch is off, so volt-second balance charges (1 − D)·V_f = 0.292 V. The output is 4.708 V ' +
      '(M = 0.392), efficiency 94.2 %, 275 mW in the diode. The rent is fixed, so it matters at 5 V ' +
      'out and not at 48 V. At V_f = 1 V efficiency is 88.3 %. At 0 V, a synchronous switch, it is 100 %.',
    terms: ['efficiency', 'conduction-loss', 'synchronous', 'volt-second'],
  }),
  buck({
    id: 'b7',
    about: 'ESR',
    chips: [0.05, 0.5, 0],
    try: { knob: 'ESR', text: 'Set ESR to 0.5 Ω: a 132 mV step. At 0 Ω, none.' },
    group: 'The buck',
    name: 'The resistances',
    symbols: ['K'],
    params: [ESR(0.05), Ron(0.05), RL(0.03), R(), D(), Vin()],
    // The output and the inductor current: the ESR step on one is the
    // ripple current in the other, and the switch node would dwarf both.
    traces: ['vout', 'iL'],
    view: 'losses',
    sweep: { x: 'R', y: 'eta' },
    note:
      'Give the switch 50 mΩ, the winding 30 mΩ and the capacitor 50 mΩ of ESR. Each takes I²R from ' +
      'the 1 A load, 21, 30 and 0.3 mW, so the output sags to 4.950 V and efficiency is 99.0 %. At ' +
      '0.5 Ω and 9.1 A, I² makes it 90.8 %. The ESR loses almost nothing, but it shows. The ripple ' +
      'current through it adds a step, ESR·ΔI_L ≈ 14.5 mV, and 3.63 mV of ripple becomes 14.4 mV.',
    terms: ['efficiency', 'conduction-loss', 'ripple'],
  }),
  buck({
    id: 'b8',
    about: 'tsw',
    chips: [20e-9, 5e-9, 100e-9],
    try: { knob: 'fs', text: 'Set f_s to 1 MHz: ripple 36.5 µV, a hundredth. The edges cost 240 mW.' },
    group: 'The buck',
    name: 'The edges',
    symbols: ['K'],
    params: [Tsw(20e-9), Fs(), Vin(), D(), R()],
    // The switch node carries the edges; the inductor current is what they
    // carry. The sweep is against f_s, the knob the edges tax.
    traces: ['vsw', 'iL'],
    views: ['losses', 'sweep', 'measures', 'math', 'balance'],
    view: 'losses',
    sweep: { x: 'fs', y: 'eta' },
    note:
      'Give each edge 20 ns. Between states the switch holds 12 V and 1 A at once. That costs ½·V·I·t ' +
      'per edge, twice a period, or 24 mW at 100 kHz and an efficiency of 99.5 %. It is the first loss ' +
      'that charges per cycle, so it grows as ∝ f_s·t_sw. At 1 MHz the same edges cost ' +
      '240 mW and 95.4 %. At 100 ns and 100 kHz it is 120 mW, and at 5 ns, 6 mW. Ripple falls as f_s ' +
      'rises, and the edges cost more.',
    terms: ['efficiency', 'switching-loss', 'ripple'],
  }),

  // ------------------------------------------------ C · Boost & buck-boost
  pwm('boost', {
    id: 'c1',
    about: 'D',
    chips: [0.5, 0.75],
    try: { knob: 'D', text: 'Set D to 75 %: M = 4.00, 48.0 V out, 9.60 A in the inductor.' },
    group: 'Boost & buck-boost',
    name: 'Stacking on the source',
    note:
      'Swap the switch and the inductor, and the inductor’s volt-seconds stack on V_in instead of ' +
      'subtracting. Volt-second balance gives M = 1/(1 − D): at D = 0.500, 24.00 V from 12 V, 60.0 mV ' +
      'of ripple. Nothing is created: 2.400 A in delivers 1.200 A at twice the voltage, 28.80 W in and ' +
      'out. The ratio runs away as D → 1, the promise the next experiment breaks.',
    terms: ['boost', 'volt-second', 'conversion-ratio', 'ripple'],
  }),
  pwm('boost', {
    id: 'c2',
    about: 'D',
    chips: [0.9, 0.5, 0.95],
    try: { knob: 'D', text: 'Set D to 50 %: M = 1.92 against the ideal 2.00, at 96.1 % efficiency.' },
    group: 'Boost & buck-boost',
    name: 'The peak ideal theory misses',
    // The knob starts on the peak, so the screen at arrival is the one the
    // note is about — not a well-behaved boost at D = 0.5 with the story a
    // pane below.
    params: [RLw(), D(0.9), Rlb(), Vin(), L(), Fs()],
    traces: ['vout', 'iL'],
    views: ['sweep', 'measures', 'math', 'losses'],
    view: 'sweep',
    sweep: { x: 'D', y: 'M', y2: 'eta' },
    note:
      'Give the inductor 0.2 Ω of winding. The ideal curve climbs without limit. The real one turns over. The ' +
      'winding carries the load current divided by (1 − D), so as D → 1 the current outruns the ' +
      'voltage. M peaks at ½·√(R/R_L) = 5.00, where the knob starts. At D = 0.900 that is 60.0 V, where theory ' +
      'promised 120 V, 180 W in the winding to deliver 180 W. At D = 0.950 the output falls to ' +
      '48.00 V while 460.8 W cooks the winding.',
    terms: ['boost', 'winding-resistance', 'efficiency'],
  }),
  pwm('boost', {
    id: 'c3',
    about: 'R',
    chips: [400, 160, 40],
    try: { knob: 'R', text: 'Set R_load to 40 \u03a9: continuous again, M = 2.000 and 24.00 V out.' },
    group: 'Boost & buck-boost',
    name: 'The boost runs dry too',
    params: [Rlb(400), Vin(), D(0.5), L(), C(), Fs()],
    traces: ['vout', 'iL', 'iD'],
    views: ['sweep', 'measures', 'math', 'balance'],
    view: 'sweep',
    sweep: { x: 'R', y: 'M' },
    note:
      'Lighten the load and the boost empties its inductor too. Above R_crit = 160 Ω a third interval ' +
      'appears, i_L at zero, and M leaves 1/(1 − D) behind. At 400 Ω it is 2.791 against the ideal ' +
      '2.000, so 33.50 V out with the same 600 mA of ripple current. The closed form is drawn dashed. ' +
      'Its boundary is K_crit = D(1 − D)² = 0.1250, not the buck\u2019s 1 − D. The buck sags in DCM and ' +
      'the boost climbs.',
    terms: ['boost', 'dcm', 'k-parameter', 'ripple'],
  }),
  pwm('buckboost', {
    id: 'c4',
    about: 'D',
    chips: [0.5, 0.75],
    try: { knob: 'D', text: 'Set D to 75 %: M = \u22123.00, \u221236.0 V out, 7.20 A in the inductor.' },
    group: 'Boost & buck-boost',
    name: 'The inverting bucket',
    traces: ['vsw', 'vout', 'iL', 'iin'],
    note:
      'Move the diode and output to the far side of the inductor: the source and the load never share ' +
      'a path. On, the source charges the inductor while the capacitor feeds the load. Off, the ' +
      'inductor dumps into both and the source is disconnected. Watch i_in sit at zero for the whole ' +
      'off interval. Every joule crosses through the inductor and arrives the other way up, ' +
      'M = −D/(1 − D): D = 0.500 gives −12.00 V from +12 V.',
    terms: ['buck-boost', 'inverting', 'volt-second'],
  }),
  pwm('buckboost', {
    id: 'c5',
    about: 'R',
    chips: [200, 100, 500],
    try: { knob: 'R', text: 'Set R_load to 40 \u03a9: continuous conduction, 3.60 W. The budget no longer holds.' },
    group: 'Boost & buck-boost',
    name: 'All the energy through one part',
    params: [Rlb(200), Vin(), D(0.5), L(), C(), Fs()],
    traces: ['vout', 'iL'],
    views: ['sweep', 'measures', 'math', 'balance'],
    view: 'sweep',
    sweep: { x: 'R', y: 'Pout', y2: 'Vout' },
    note:
      'The inductor carries every joule, and in DCM the totals are exact. It takes up ½L·i_pk² each ' +
      'cycle and delivers it all: at i_pk = 600 mA, P_out = ½L·i_pk²·f_s = 1.800 W. The peak depends ' +
      'on V_in·D/(L·f_s) alone. The power is 1.800 W at 100 Ω, 200 Ω and 500 Ω alike, while the ' +
      'output climbs −13.42 → −18.97 → −30.00 V. Below R_crit = 80 Ω conduction is continuous and ' +
      'the rule stops.',
    terms: ['buck-boost', 'dcm', 'inductor-energy'],
  }),

  // -------------------------------------------------------- D · Magnetics
  core({
    id: 'd1',
    about: 'fs',
    chips: [100e3, 10e3],
    try: { knob: 'fs', text: 'Set f_s to 10 kHz: 186 mT of flux swing, ten times as far.' },
    group: 'Magnetics',
    name: 'Volt-seconds are flux',
    params: [Fs(), Turns(), Area(), Bsat(), L(), R(2), D(), Vin()],
    note:
      'An inductor’s flux is its volt-seconds spread over N turns and A_e of core area. At 100 kHz this ' +
      'buck takes 29.2 V·µs each period on 40 turns of 40 mm², so the flux swings 18.2 mT and peaks at ' +
      '165 mT. Drop f_s to 10 kHz and the same 5 V output costs ten times the volt-seconds.',
    terms: ['flux-density', 'volt-second', 'buck'],
  }),
  core({
    id: 'd2',
    about: 'R',
    chips: [1, 2],
    try: { knob: 'R', text: 'Set R_load to 2 Ω: the peak falls to 2.65 A, under the knee.' },
    group: 'Magnetics',
    name: 'Saturation, as an event',
    params: [R(1), Bsat(), Turns(), L(), Fs(), Vin(), D()],
    traces: ['iL', 'vsw'],
    views: ['flux', 'scrub', 'measures', 'math', 'balance'],
    note:
      'The core saturates at I_sat = B_sat·N·A_e/L = 4.80 A. At 1 Ω the load draws 5.00 A, so the ' +
      'current crosses the knee 2.90 µs into the period and stays over it for 30 % of the period. Past ' +
      'the knee the inductance is 5 µH rather than 100 µH, so the ripple grows from 0.292 A to 1.98 A ' +
      'and the peak reaches 6.58 A. The flux reaches 306 mT and goes no further.',
    terms: ['saturation', 'flux-density', 'ripple'],
  }),
  iso('flyback', {
    id: 'd3',
    about: 'D',
    chips: [0.5, 0.75],
    try: { knob: 'D', text: 'Set D to 75 %: M rises to 1.50 and the output to 36.0 V.' },
    group: 'Magnetics',
    name: 'The flyback',
    params: [D(0.5), Ratio(2), Vin(24), Rlb(12), L(), Fs()],
    traces: ['vsw', 'iL', 'iD'],
    note:
      'Give the buck-boost’s inductor a second winding, and the output crosses an isolation barrier. ' +
      'The two intervals are unchanged, so volt-second balance still sets the ratio with the turns in ' +
      'it. At D = 50 % on a 2:1 transformer, M = 0.500 and 24 V becomes 11.99 V. The isolation costs ' +
      'the switch its rating. It blocks 48.0 V, the rail plus the output reflected back.',
    terms: ['flyback', 'isolation', 'turns-ratio', 'buck-boost', 'volt-second'],
  }),
  iso('halfbridge', {
    id: 'd4',
    about: 'D',
    chips: [5 / 12, 0.25],
    try: { knob: 'D', text: 'Set D to 25 %: M falls to 0.0625 and the output to 3.00 V.' },
    group: 'Magnetics',
    name: 'The half-bridge',
    params: [Dhb(5 / 12), Ratio(4), Vin(48), R(5), L(), Fs()],
    view: 'scrub',
    note:
      'Two switches across a capacitor divider drive the primary with ±V_in/2, and the rectified ' +
      'secondary feeds the filter twice per period. Nothing is stored in the core. The gearing is the ' +
      'turns ratio alone, M = n·D, so 48 V at D = 41.7 % on a 4:1 transformer gives 5.000 V. The ripple ' +
      'repeats at 200 kHz, so 41.7 mA in the inductor leaves 260 µV rather than 521 µV. Each switch ' +
      'blocks 48 V, where the flyback’s blocks twice its rail.',
    terms: ['half-bridge', 'flyback', 'turns-ratio', 'isolation', 'ripple'],
  }),

  // ---------------------------------------------------------- E · AC in
  rect('half', {
    id: 'e1',
    about: 'C',
    chips: [1000e-6, 100e-6],
    try: { knob: 'C', text: 'Set C to 100 \u00b5F: the diode conducts for 87.8\u00b0, the output sags 12.4 V.' },
    group: 'AC in',
    name: 'Half-wave into a capacitor',
    note:
      'A 12.6 V RMS secondary peaks at 17.8 V. The diode conducts while the source exceeds the ' +
      'capacitor plus 0.7 V: 42.9° of each cycle at 1000 µF. The capacitor carries the load for ' +
      '14.7 ms and sags 2.30 V, so the output is 15.6 V. A bare rectifier averages 5.67 V, while this one ' +
      'holds near the peak. The cost is current: 156 mA arrives as 2.03 A spikes.',
    terms: ['rectifier', 'conduction-angle', 'form-factor', 'piv', 'rms'],
  }),
  rect('bridge', {
    id: 'e2',
    about: 'C',
    chips: [1000e-6, 100e-6, 4700e-6],
    try: { knob: 'C', text: 'Set C to 4700 \u00b5F: ripple 0.23 V, 1.34 A peaks. At 100 \u00b5F, 6.9 V.' },
    group: 'AC in',
    name: 'The bridge',
    traces: ['vin', 'vrect', 'vout', 'iD'],
    note:
      'Four diodes steer both half-cycles into the capacitor: two pulses per cycle. It holds for ' +
      '6.8 ms rather than 14.7, and the ripple falls from 2.30 V to 1.07 V on the same 1000 µF. Two ' +
      'diodes conduct in series and cost 1.4 V, so the ceiling is 16.4 V. The output is still 15.6 V: ' +
      'it sags half as far from a ceiling 0.7 V lower. Twice the pulses means 1.30 A peaks instead ' +
      'of 2.03.',
    terms: ['rectifier', 'form-factor', 'ripple'],
  }),
  rect('bridge', {
    id: 'e3',
    about: 'C',
    chips: [1000e-6, 100e-6, 4700e-6],
    try: { knob: 'Rs', text: 'Set R_s to 0.25 \u03a9: the floor drops to 28.0\u00b0, the peak rises to 1.60 A.' },
    group: 'AC in',
    name: 'The price of a big capacitor',
    params: [Cf(), Rs(), Rl(), Vs(), Vfd(), F()],
    traces: ['vout', 'iD'],
    views: ['sweep', 'measures', 'math', 'losses'],
    view: 'sweep',
    sweep: { x: 'C', y: 'angle', y2: 'iPeak' },
    note:
      'More capacitance, less ripple: 100 µF leaves 6.9 V, 1000 µF 1.07 V, 4700 µF 0.23 V. The diodes ' +
      'conduct for a shorter slice, 67° → 33° → 32°, and must deliver the same charge inside it. The ' +
      'peak current climbs 0.60 → 1.30 → 1.34 A. Ripple falls without limit, while the conduction angle ' +
      'floors near 32°, where R_s sets it. The power factor falls from 0.65 to 0.54, so the smoother the ' +
      'output, the harder it is to supply.',
    terms: ['conduction-angle', 'form-factor', 'power-factor', 'ripple'],
  }),
  rect('bridge', {
    id: 'e4',
    about: 'C',
    chips: [1000e-6, 100e-6, 4700e-6],
    try: { knob: 'C', text: 'Set C to 100 \u00b5F: THD 91 %, PF 0.650. At 4700 \u00b5F, 157 %, 0.537.' },
    group: 'AC in',
    name: 'What the grid sees',
    params: [Cf(), Rl(), Rs(), Vs(), Vfd(), F()],
    traces: ['vin', 'iin'],
    views: ['spectrum', 'measures', 'math', 'losses'],
    view: 'spectrum',
    note:
      'The line current at 1000 µF is two spikes a cycle, not a sine. The fundamental is 219 mA RMS of ' +
      'a 401 mA total. Distortion factor 0.545, THD 154 %, the 3rd harmonic at 94 % of the fundamental. That ' +
      'fundamental lags the voltage by only 7.6°, a displacement factor of 0.991, so this is not a ' +
      'phase-shift problem. Power factor is the product, 0.991 × 0.545 = 0.540: the line carries 1.85× ' +
      'the RMS current that 2.73 W would need as a sine.',
    terms: ['power-factor', 'thd', 'displacement', 'harmonic', 'rms'],
  }),
  {
    id: 'e5',
    about: 'alphaDeg',
    chips: [90, 45, 135],
    try: { knob: 'alphaDeg', text: 'Set \u03b1 to 45\u00b0: 90.9 % of the power, power factor 0.95, THD 26 %.' },
    group: 'AC in',
    name: 'The dimmer',
    kind: 'dimmer',
    headline: 'pf',
    params: [Alpha(), Vline(), Rl(), F()],
    traces: ['vin', 'vout', 'iR'],
    allTraces: ['vin', 'vout', 'vD', 'iin', 'iR'],
    views: ['sweep', 'spectrum', 'math', 'measures'],
    view: 'sweep',
    sweep: { x: 'alpha', y: 'share' },
    periods: 2,
    note:
      'A triac fires at an angle α into each half-cycle, so the load gets the tail of every half-sine. ' +
      'Its share of full power is 1 − α/π + sin 2α/(2π), at 90° exactly half: 72.0 W of the full ' +
      '144 W. The chopped current has THD 65 % and its fundamental lags 32.5°. The power factor is ' +
      '0.707 = 0.844 × 0.838. Dim to 135° and 9.1 % of the power arrives at PF 0.30.',
    terms: ['phase-cut', 'power-factor', 'displacement', 'thd'],
  },
  rect('six', {
    id: 'e6',
    about: 'C',
    chips: [1000e-6, 100e-6],
    try: { knob: 'C', text: 'Set C to 100 \u00b5F: ripple 3.21 V on 28.1 V, against the bridge\u2019s 6.9 V.' },
    group: 'AC in',
    name: 'Three phases, six pulses',
    traces: ['vin', 'vrect', 'vout', 'iin'],
    note:
      'Three 12.6 V secondaries 120° apart into six diodes: the pair with the highest line-to-line ' +
      'voltage conducts. The output ripples at six times the line frequency. The capacitor charges ' +
      'towards √3 × 17.8 = 30.9 V and sits at 28.8 V, nearly twice the bridge, with 0.52 V of ripple ' +
      'at 1000 µF. Bare, it would sit at 29.5 V, because six pulses are already smooth. The line current has ' +
      'no 3rd harmonic. The 5th, at 91 %, is the first that survives.',
    terms: ['six-pulse', 'harmonic', 'piv', 'ripple'],
  }),

  // -------------------------------------------------------- F · Inverters
  inv('square', {
    id: 'f1',
    about: 'Vdc',
    chips: [48, 24],
    try: { knob: 'Vdc', text: 'Set V_dc to 24 V: 21.6 V of fundamental, and the same 48.3 % THD.' },
    group: 'Inverters',
    name: 'The square-wave inverter',
    note:
      'A full bridge swings ±48 V at 60 Hz. Its fundamental is (4/π)·V_dc, or 43.2 V RMS, and its THD ' +
      'is √(π²/8 − 1) = 48.3 %. The filter’s corner is at 1.59 kHz while the third harmonic sits at ' +
      '180 Hz, so the filter leaves it alone. The load still sees 48.2 %.',
    terms: ['inverter', 'rms', 'thd', 'harmonic'],
  }),
  inv('spwm', {
    id: 'f2',
    about: 'ma',
    chips: [0.8, 0.4, 1.2],
    try: { knob: 'ma', text: 'Set m_a to 120 %: 53.0 V of fundamental, short of the 57.6 V commanded.' },
    group: 'Inverters',
    name: 'Sine PWM',
    params: [Ma(0.8), Fsw(3780), Vdc(), Fund(), L(1e-3), C(10e-6), Rlb(10)],
    views: ['sweep', 'spectrum', 'measures', 'math'],
    view: 'sweep',
    sweep: { x: 'ma', y: 'v1' },
    note:
      'Compare a sine reference against a triangular carrier, and the bridge takes the sign of the ' +
      'difference. The pulse widths breathe with the sine, and the fundamental comes out at m_a·V_dc. ' +
      'At 80 % of the carrier’s height that is 38.4 V peak, and the load’s THD is 21.2 %. At 40 % the ' +
      'fundamental halves to 19.2 V. Past 100 % the reference outruns the carrier, and 120 % buys ' +
      '53.0 V rather than 57.6 V.',
    terms: ['inverter', 'modulation-index', 'carrier', 'thd'],
  }),
  inv('spwm', {
    id: 'f3',
    about: 'fsw',
    chips: [3780, 1980],
    try: { knob: 'fsw', text: 'Set f_sw to 1.98 kHz: the attenuation is 0.736 and the THD 81 %.' },
    group: 'Inverters',
    name: 'The spectrum has families',
    params: [Fsw(3780), Ma(0.8), L(1e-3), C(10e-6), Rlb(10), Vdc(), Fund()],
    note:
      'The carrier puts no energy near the fundamental. It puts it in clusters around m_f and 2·m_f. At ' +
      '3.78 kHz the cluster at the 63rd harmonic carries 102 % of the fundamental, and nothing below it ' +
      'reaches 0.02 %. That gap is the filter’s opportunity. The LC attenuates the 63rd by 0.192, which ' +
      'is |H| at 3.78 kHz, and the load’s THD is 21.2 %.',
    terms: ['inverter', 'carrier', 'harmonic', 'thd'],
  }),
  inv('spwm', {
    id: 'f4',
    about: 'fsw',
    chips: [3780, 900, 7740],
    try: { knob: 'fsw', text: 'Set f_sw to 7.74 kHz: the THD falls to 4.8 %.' },
    group: 'Inverters',
    name: 'Distortion against effort',
    params: [Fsw(3780), Ma(0.8), L(1e-3), C(10e-6), Rlb(10), Vdc(), Fund()],
    traces: ['vout', 'iL'],
    views: ['sweep', 'spectrum', 'measures', 'math'],
    view: 'sweep',
    sweep: { x: 'fsw', y: 'thd' },
    note:
      'Sweep the carrier and the THD of the load voltage falls, as the clusters retreat from the ' +
      'filter’s corner. At 900 Hz the carrier sits below the 1.59 kHz corner and the THD is 135 %. At ' +
      '1.98 kHz it is 81 %, at 3.78 kHz 21.2 %, and at 7.74 kHz 4.8 %. The next group prices the same ' +
      'sweep in switching loss.',
    terms: ['inverter', 'carrier', 'thd', 'switching-loss'],
  }),

  // ----------------------------------------------------------- G · Losses
  buck({
    id: 'g1',
    about: 'fs',
    chips: [488e3, 100e3, 2e6],
    try: { knob: 'fs', text: 'Set f_s to 2 MHz: 469 mW in the edges, efficiency 89.1 %.' },
    group: 'Losses',
    name: 'Conduction against switching',
    params: [Fs(488e3), Tsw(20e-9), Ron(0.12), Sync(1), R(), D(), Vin()],
    traces: ['vsw', 'iL'],
    views: ['sweep', 'ledger', 'measures', 'math'],
    view: 'sweep',
    sweep: { x: 'fs', y: 'eta' },
    note:
      'Conduction takes I²·R_on whatever the frequency. Each edge costs ½·V·I·t_sw and is charged twice ' +
      'a period, so switching loss follows f_s. They cross at R_on·I/(V·t_sw) = 488 kHz, where each is ' +
      '114 mW and efficiency is 95.4 %. At 100 kHz the edges cost 23 mW and efficiency is 97.2 %.',
    terms: ['switching-loss', 'conduction-loss', 'efficiency'],
  }),
  buck({
    id: 'g2',
    about: 'R',
    chips: [G2_PEAK_LOAD, 1, 1000],
    try: { knob: 'R', text: 'Set R_load to 1 kΩ: efficiency 53.2 %, on 25.0 mW delivered.' },
    group: 'Losses',
    name: 'The efficiency curve',
    params: [R(G2_PEAK_LOAD), L(22e-6), Ron(0.1), RL(0.05), Sync(1), D(), Vin(), Fs()],
    traces: ['iL', 'vout'],
    views: ['sweep', 'ledger', 'measures', 'math'],
    view: 'sweep',
    sweep: { x: 'R', y: 'eta' },
    note:
      'The winding and the switch carry the load current and the ripple current together, and only one ' +
      'of those follows the load. Efficiency peaks where the two cost the same, which puts the load at ' +
      '√12·L·f_s/(1 − D) = 13.1 Ω. That is √3 times the 7.54 Ω boundary, and it carries no V_out at ' +
      'all. There the ripple costs 22.0 mW and the load 21.5 mW, at 97.7 %. At 1 Ω it is 86.9 %.',
    terms: ['efficiency', 'conduction-loss', 'ripple'],
  }),
  pwm('boost', {
    id: 'g3',
    about: 'ESR',
    chips: [0.05, 0.2, 0],
    try: { knob: 'ESR', text: 'Set ESR to 200 mΩ: 196 mW of heat. At 0 Ω, none.' },
    group: 'Losses',
    name: 'The capacitor’s hidden heater',
    params: [ESR(0.05), Rlb(24), Vin(), D(0.5), L(), C(220e-6), Fs()],
    traces: ['iC', 'vout'],
    views: ['measures', 'ledger', 'math', 'sweep'],
    view: 'measures',
    sweep: { x: 'R', y: 'eta' },
    note:
      'A buck’s output capacitor carries the inductor’s triangle and nothing else. A boost’s carries ' +
      'the whole load current for the D of each period the diode is off. At 12 V into 24 V with 0.600 A ' +
      'of inductor ripple that is 1.003 A RMS, against the 0.173 A a buck would give. Heat goes as the ' +
      'square, so 50 mΩ of ESR makes 50.3 mW here and 1.5 mW there.',
    terms: ['boost', 'buck', 'ripple', 'rms', 'conduction-loss'],
  }),
  buck({
    id: 'g4',
    about: 'Ron',
    chips: [0.05, 0.2, 0],
    try: { knob: 'Ron', text: 'Set R_on to 0 Ω: the switch’s row empties and efficiency reaches 93.1 %.' },
    group: 'Losses',
    name: 'Where the watts went',
    params: [Ron(0.05), Vf(0.5), RL(0.03), ESR(0.05), Tsw(20e-9), R(), D(), Vin(), Fs()],
    traces: ['vout', 'iL'],
    views: ['ledger', 'measures', 'math', 'sweep', 'losses'],
    view: 'ledger',
    sweep: { x: 'R', y: 'eta' },
    note:
      'Every loss here is an integral of the same waveform, so the ledger closes exactly. At 50 mΩ the ' +
      'switch takes 18.3 mW, the diode 272 mW, the winding 26.3 mW and the ESR 0.374 mW, with the edges ' +
      'charged 23.3 mW on top. That leaves 4.345 W in the load out of 4.685 W drawn, at 92.7 % ' +
      'efficiency. Turn R_on to 200 mΩ and the switch’s row grows to 71.3 mW.',
    terms: ['efficiency', 'conduction-loss', 'switching-loss'],
  }),

  ...LMN_EXPERIMENTS,
]

// The knob an experiment is about (`about`) is the first in its list, so it
// is the first the reader meets — the rest of the list keeps its order. An
// `about` that names no knob is a mistake in the data, caught here at load.
for (const e of EXPERIMENTS) {
  const i = e.params.findIndex((p) => p.key === e.about)
  if (i < 0) throw new Error(`${e.id} is about "${e.about}", which is not one of its knobs`)
  e.params = [e.params[i], ...e.params.slice(0, i), ...e.params.slice(i + 1)]
}

export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))

// The path: EXPERIMENTS order, first to last. The top bar's next and previous
// and the note's "Next:" link all read from here, so they cannot disagree.
const indexOf = (id) => EXPERIMENTS.findIndex((e) => e.id === id)
export const nextOf = (id) => EXPERIMENTS[indexOf(id) + 1]?.id ?? null
export const prevOf = (id) => (indexOf(id) > 0 ? EXPERIMENTS[indexOf(id) - 1].id : null)
export const positionOf = (id) => ({ n: indexOf(id) + 1, of: EXPERIMENTS.length })

export function defaultsOf(id) {
  const out = {}
  for (const k of byId[id].params) out[k.key] = k.default
  return out
}
