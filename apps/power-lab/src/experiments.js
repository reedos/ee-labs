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
// conduction, the boundary between the modes, and real parts; E the line
// side — diode rectifiers into a capacitor, what they ask of the grid, the
// phase-cut dimmer, and the three-phase six-pulse bridge. The other groups
// (boost and buck-boost, control, inverters, magnetics, …) are the plan's
// later phases and are not here yet.

export const GROUPS = ['A · Why switch', 'B · The buck', 'C · Boost & buck-boost', 'E · AC in']

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
}

export const VIEWS = {
  measures: { label: 'Measures', title: 'Average, RMS and peak-to-peak of every waveform, and the power' },
  balance: { label: 'Balance', title: 'Volt-seconds on the inductor and coulombs on the capacitor, segment by segment' },
  sweep: { label: 'Sweep', title: 'One measure as one knob sweeps its range' },
  losses: { label: 'Losses', title: 'Where the input power goes' },
  spectrum: { label: 'Spectrum', title: 'The harmonics of the current drawn from the line, and what they cost in power factor' },
}

// What a sweep can put on its axes. `sweepFor` in App.jsx runs the matching
// sweep; SweepCanvas reads the labels and scales from here.
export const SWEEP_X = {
  D: { label: 'D', unit: '', scale: 'linear', fmt: (v) => v.toFixed(3) },
  R: { label: 'R_load', unit: 'Ω', scale: 'log' },
  C: { label: 'C', unit: 'F', scale: 'log' },
  alpha: { label: 'α', unit: '°', scale: 'linear', fmt: (v) => `${v.toFixed(0)}°` },
}
export const SWEEP_Y = {
  M: { label: 'M = V_out / V_in', unit: '', lo: 0, hi: 1 },
  eta: { label: 'η', unit: '', lo: 0, hi: 1, percent: true },
  Pout: { label: 'P_out', unit: 'W', scale: 'log' },
  Vout: { label: 'V_out', unit: 'V', lo: 0 },
  angle: { label: 'conduction angle', unit: '°', lo: 0 },
  iPeak: { label: 'i_D peak', unit: 'A', lo: 0 },
  share: { label: 'P / P_full', unit: '', lo: 0, hi: 1 },
  pf: { label: 'power factor', unit: '', lo: 0, hi: 1 },
}

const buck = (over) => ({
  kind: 'buck',
  traces: ['vsw', 'vout', 'iL'],
  views: ['measures', 'balance', 'sweep', 'losses'],
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
  params: [Vin(), D(0.5), L(), C(), Rlb(), Fs()],
  traces: ['vsw', 'vout', 'iL'],
  allTraces: ['vsw', 'vout', 'vL', 'iL', 'iQ', 'iD', 'iC', 'iin'],
  views: ['measures', 'balance', 'sweep', 'losses'],
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
  params: [Vs(), Cf(), Rl(), Rs(), Vfd(), F()],
  traces: ['vin', 'vout', 'iD'],
  allTraces: ['vin', 'vrect', 'vout', 'vD', 'iD', 'iin', 'iC', 'iR'],
  views: ['measures', 'spectrum', 'losses'],
  view: 'measures',
  periods: 2,
  ...over,
})

export const EXPERIMENTS = [
  // ---------------------------------------------------------- A · Why switch
  {
    id: 'a1',
    group: GROUPS[0],
    name: 'The linear regulator',
    kind: 'linreg',
    params: [Vin(), Vo(), R()],
    traces: ['vsw', 'vout', 'iL'],
    views: ['losses', 'measures', 'sweep'],
    view: 'losses',
    sweep: { x: 'D', y: 'eta' },
    note:
      'A series pass element drops the difference and carries the load current, so it dissipates their ' +
      'product. From 12 V to 5 V at 1 A: 5 W reach the load, 7 W heat the regulator, and efficiency is ' +
      '5/12 = 41.7 % — the ratio V_out/V_in, whatever the current. The sweep shows there is no setting ' +
      'that improves it: a linear regulator is exactly as efficient as its conversion ratio.',
    terms: ['efficiency', 'linear-regulator'],
  },
  {
    id: 'a2',
    group: GROUPS[0],
    name: 'Chop it',
    kind: 'chopper',
    params: [Vin(), D(), R(), Fs()],
    traces: ['vsw', 'iL'],
    views: ['measures'],
    view: 'measures',
    note:
      'Replace the pass element with a switch: on for a fraction D of each period, off for the rest. It ' +
      'wastes nothing — an ideal switch has no voltage when on and no current when off — and the average ' +
      'output is D·V_in = 5.00 V. But the load does not get 5 V. It gets 12 V for 41.7 % of the time and ' +
      'nothing otherwise: RMS 7.75 V, and 12.0 W of heating instead of the 5.00 W a steady 5 V would ' +
      'give. Average is not the same as steady; the switch alone has moved the problem, not solved it.',
    terms: ['duty', 'rms', 'average'],
  },
  buck({
    id: 'a3',
    group: GROUPS[0],
    name: 'Let the LC do the averaging',
    params: [Vin(), D(), L(), C(), R(), Fs()],
    traces: ['vsw', 'vout'],
    note:
      'Put an inductor and capacitor between the chopped node and the load. The switch node still swings ' +
      '0 ↔ 12 V, but the output is 5.000 V with 3.65 mV of ripple: the filter passes the average and ' +
      'stops the rest, because its corner (1.59 kHz) is 63× below the switching frequency. The load draws ' +
      '5.00 W, the source supplies 5.00 W, and nothing heats up. This is the buck converter — a chopper ' +
      'plus a low-pass filter — and the rest of this group is why it works.',
    terms: ['buck', 'ripple', 'switch-node'],
  }),

  // ---------------------------------------------------------- B · The buck
  buck({
    id: 'b1',
    group: GROUPS[1],
    name: 'Volt-second balance',
    params: [Vin(), D(), L(), R()],
    traces: ['vL', 'iL'],
    view: 'balance',
    note:
      'In steady state the inductor current ends each period where it began, so the inductor voltage ' +
      'averages to exactly zero: the volt-seconds it takes on while the switch is on equal the ' +
      'volt-seconds it gives back while off. Here that is 7 V × 4.17 µs = 29.2 V·µs up and 5 V × 5.83 µs ' +
      '= 29.2 V·µs down. Write it out — D·(V_in − V_out) = (1 − D)·V_out — and the output falls out: ' +
      'V_out = D·V_in, with no L in it. Change L: the ripple changes, the balance and the output do not.',
    terms: ['volt-second', 'steady-state', 'charge-balance'],
  }),
  buck({
    id: 'b2',
    group: GROUPS[1],
    name: 'M = D',
    params: [D(), Vin(), R(), L(), Fs()],
    traces: ['vsw', 'vout'],
    view: 'sweep',
    sweep: { x: 'D', y: 'M' },
    note:
      'The conversion ratio M = V_out/V_in equals the duty, and only the duty: at D = 0.417 the output is ' +
      '5.000 V from 12 V, and the sweep is a straight line through the origin at every load that keeps ' +
      'the inductor current from reaching zero. The formula has no L, C, R or f_s in it because ' +
      'volt-second balance has none — those set the ripple and the losses, not the ratio. (Turn R up ' +
      'past 34 Ω and the line bends away: that is B4.)',
    terms: ['conversion-ratio', 'duty'],
  }),
  buck({
    id: 'b3',
    group: GROUPS[1],
    name: 'Ripple',
    params: [L(), C(), Fs(), D(), Vin(), R()],
    traces: ['iL', 'vout'],
    note:
      'The inductor current is a triangle: it rises at (V_in − V_out)/L while the switch is on and falls ' +
      'at V_out/L while it is off, so its peak-to-peak swing is V_out·(1 − D)/(L·f_s) = 0.292 A around ' +
      'the 1.00 A load current. The capacitor takes that triangle’s AC part and integrates it into ' +
      '3.65 mV of output ripple, ΔI_L/(8·f_s·C). Both formulas assume the output is flat while they ' +
      'compute how much it is not — and land within 0.03 % of the exact waveform here. Four times the ' +
      'frequency: a quarter the current ripple and a sixteenth the voltage ripple.',
    terms: ['ripple', 'small-ripple'],
  }),
  buck({
    id: 'b4',
    group: GROUPS[1],
    name: 'Light load: discontinuous conduction',
    params: [R(200), Sync(), L(), Fs(), D(), Vin()],
    traces: ['vsw', 'iL', 'vout'],
    view: 'sweep',
    sweep: { x: 'R', y: 'M' },
    periods: 2,
    note:
      'At 200 Ω the load wants 25 mA and the ripple is 145 mA peak: the falling current reaches zero ' +
      'before the period ends, and a diode cannot carry it negative. It blocks, the switch node floats ' +
      'up to V_out for the rest of the period (41 % of it here), and volt-second balance now has a ' +
      'third term. The output is 8.52 V — M = 0.710, not D = 0.417 — and it depends on the load, which ' +
      'the sweep shows. Replace the diode with a synchronous switch and the current simply goes ' +
      'negative (to −121 mA): conduction is continuous again and the output is back to 5.00 V.',
    terms: ['dcm', 'ccm', 'synchronous'],
  }),
  buck({
    id: 'b5',
    group: GROUPS[1],
    name: 'The boundary',
    params: [R(34.2857142857), L(), Fs(), D(), Vin()],
    traces: ['iL', 'vsw'],
    view: 'sweep',
    sweep: { x: 'R', y: 'M' },
    note:
      'Conduction is continuous while the average current exceeds half the ripple. In the dimensionless ' +
      'form K = 2·L·f_s/R that is K > 1 − D: with 100 µH at 100 kHz and D = 0.417 the boundary is ' +
      'R_crit = 34.3 Ω, and the knob starts there — the current valley just touches zero. Either side, ' +
      'the two formulas for M agree at the boundary and the curve is continuous, with a kink rather ' +
      'than a step: nothing jumps when the diode first blocks for an instant. Slower switching or a ' +
      'smaller inductor moves R_crit down; the converter stays continuous into lighter loads.',
    terms: ['k-parameter', 'dcm', 'ccm'],
  }),
  buck({
    id: 'b6',
    group: GROUPS[1],
    name: 'Real parts',
    params: [Ron(0.05), Vf(0.5), RL(0.03), ESR(0.05), Tsw(20e-9), Sync(), R(), D()],
    traces: ['vsw', 'vout', 'iL'],
    view: 'losses',
    sweep: { x: 'R', y: 'eta' },
    note:
      'Give the switch 50 mΩ, the diode 0.5 V, the inductor 30 mΩ, the capacitor 50 mΩ and each edge ' +
      '20 ns. The output drops to 4.66 V (M = 0.388, not 0.417) and efficiency to 92.7 %. The diode ' +
      'takes 272 mW of the 340 mW lost — its 0.5 V drop, carried for 58 % of every period — with the ' +
      'winding 26 mW, the switching edges 23 mW, the switch 18 mW and the ESR under 1 mW. A ' +
      'synchronous switch in place of the diode puts efficiency at 97.9 %; at 0.5 Ω (8.5 A, the ' +
      'output sagging to 4.27 V) the resistive losses grow with I² and efficiency is 85.0 %. The input ' +
      'power equals the output plus every conduction loss to the last digit: the engine keeps the ' +
      'books, and they balance.',
    terms: ['efficiency', 'conduction-loss', 'switching-loss', 'synchronous'],
  }),

  // ------------------------------------------------ C · Boost & buck-boost
  pwm('boost', {
    id: 'c1',
    group: GROUPS[2],
    name: 'Stacking on the source',
    note:
      'Swap the switch and the inductor around and the inductor charges from the source, then discharges ' +
      'in series with it — its voltage stacks on top of V_in instead of subtracting from it. Volt-second ' +
      'balance gives M = 1/(1 − D), so at D = 0.500 the output is 24.00 V from a 12 V source, with 60.0 mV ' +
      'of ripple. Nothing is created: the source carries 2.400 A to deliver 1.200 A at twice the voltage, ' +
      '28.80 W in and 28.80 W out. The sweep shows the ratio running away as D → 1, which is the promise ' +
      'the next experiment breaks.',
    terms: ['boost', 'volt-second', 'conversion-ratio'],
  }),
  pwm('boost', {
    id: 'c2',
    group: GROUPS[2],
    name: 'The peak ideal theory misses',
    params: [RLw(), D(0.5), Rlb(), Vin(), L(), Fs()],
    traces: ['vout', 'iL'],
    views: ['sweep', 'measures', 'losses'],
    view: 'sweep',
    sweep: { x: 'D', y: 'M', y2: 'eta' },
    note:
      'Give the inductor 0.2 Ω of winding. The ideal curve still climbs forever; the real one turns over ' +
      'and comes back down. The reason is that the winding carries the load current divided by (1 − D), so ' +
      'as D → 1 the current diverges faster than the voltage: M = (1 − D)/((1 − D)² + R_L/R), which peaks ' +
      'at M = ½·√(R/R_L) = 5.00 where 1 − D = √(R_L/R), here D = 0.900. Theory promised 10.0 there. Push ' +
      'past it — D = 0.950 — and the output *falls* to 48.00 V while 460.8 W cooks the winding. Efficiency ' +
      'tells the same story from the other side: η = M·(1 − D), the fraction of the promised voltage that ' +
      'arrives, which at the peak is exactly 50 %. This is why "just increase D" ends in smoke.',
    terms: ['boost', 'winding-resistance', 'efficiency'],
  }),
  pwm('boost', {
    id: 'c3',
    group: GROUPS[2],
    name: 'The boost runs dry too',
    params: [Rlb(400), Vin(), D(0.5), L(), C(), Fs()],
    traces: ['vout', 'iL', 'iD'],
    views: ['sweep', 'measures', 'balance'],
    view: 'sweep',
    sweep: { x: 'R', y: 'M' },
    note:
      'Lighten the load and the boost empties its inductor too. Above R_crit = 160 Ω a third interval ' +
      'appears — switch off, diode blocking, i_L pinned at zero — and M leaves 1/(1 − D) behind: at 400 Ω ' +
      'it is 2.791 against the ideal 2.000, and the output has climbed to 33.50 V with the same 600 mA of ' +
      'ripple current it always had. The closed form is M = (1 + √(1 + 4D²/K))/2 with K = 2Lf_s/R, and ' +
      'K_crit = D(1 − D)² = 0.1250 rather than the buck\u2019s 1 − D. Note which way it goes: the buck sags in ' +
      'DCM, the boost climbs. Both are the same statement — with no current to hold it down, the output ' +
      'runs towards whatever the volt-seconds allow.',
    terms: ['boost', 'dcm', 'k-parameter'],
  }),
  pwm('buckboost', {
    id: 'c4',
    group: GROUPS[2],
    name: 'The inverting bucket',
    traces: ['vsw', 'vout', 'iL'],
    note:
      'Move the diode and the output to the other side of the inductor and the source and the load never ' +
      'share a path. On: the source charges the inductor, the capacitor alone feeds the load. Off: the ' +
      'inductor dumps into the capacitor and the load, and the source is disconnected — watch i_in go flat ' +
      'at zero for the whole off interval, which no buck ever does. Every joule is carried across by the ' +
      'inductor, and it arrives the other way up: M = −D/(1 − D), so D = 0.500 gives −12.00 V from +12 V, ' +
      'and the switch node swings between +12.0 V and −12.0 V. The output is negative against ground here, ' +
      'and the currents are drawn in the direction each part carries them.',
    terms: ['buck-boost', 'inverting', 'volt-second'],
  }),
  pwm('buckboost', {
    id: 'c5',
    group: GROUPS[2],
    name: 'All the energy through one part',
    params: [Rlb(200), Vin(), D(0.5), L(), C(), Fs()],
    traces: ['vout', 'iL'],
    views: ['sweep', 'measures', 'balance'],
    view: 'sweep',
    sweep: { x: 'R', y: 'Pout', y2: 'Vout' },
    note:
      'In the buck, most of the power flows straight through and the inductor only smooths it. Here there ' +
      'is no through-path at all, so the inductor must lift every joule — and in discontinuous conduction ' +
      'that makes the books exact. It picks up ½L·i_pk² each cycle and hands over all of it: with i_pk = ' +
      '600 mA, P_out = ½L·i_pk²·f_s = 1.800 W. The startling part is what that does not depend on. The peak ' +
      'is set by V_in·D/(L·f_s) alone, so the power is the same at every load: 1.800 W at 100 Ω, at 200 Ω ' +
      'and at 500 Ω, while the output climbs −13.42 → −18.97 → −30.00 V to keep it. A buck-boost in DCM is a ' +
      'constant-power source, and the flat line on the sweep is the inductor\u2019s energy budget, not a ' +
      'regulator doing anything clever. Below R_crit = 80 Ω conduction becomes continuous and the spell breaks.',
    terms: ['buck-boost', 'dcm', 'inductor-energy'],
  }),

  // ---------------------------------------------------------- E · AC in
  rect('half', {
    id: 'e1',
    group: GROUPS[3],
    name: 'Half-wave into a capacitor',
    note:
      'A 12.6 V RMS secondary peaks at 17.8 V. One diode and a capacitor: the diode conducts only while ' +
      'the source exceeds the capacitor (plus its own 0.7 V), which at 1000 µF into 100 Ω is 42.9° of ' +
      'every 360° cycle. The capacitor carries the load alone for the other 14.7 ms and sags 2.30 V — the ' +
      'ripple. The output is 15.6 V DC, not the 5.67 V (V_p/π) a bare half-wave rectifier averages to: ' +
      'the capacitor holds the peak, not the mean. The price is paid in current. The diode delivers the ' +
      'load’s 156 mA as 2.03 A spikes, and the winding’s RMS current is 500 mA — 3.2× its average — so ' +
      'it heats 10× more than a steady 156 mA would. And while it is off, the diode holds off the peak on ' +
      'one side and the charged capacitor on the other: 33.3 V, nearly 2·V_p.',
    terms: ['rectifier', 'conduction-angle', 'form-factor', 'piv'],
  }),
  rect('bridge', {
    id: 'e2',
    group: GROUPS[3],
    name: 'The bridge',
    traces: ['vin', 'vrect', 'vout', 'iD'],
    note:
      'Four diodes steer both half-cycles into the capacitor: two pulses per cycle instead of one, so it ' +
      'holds for 6.8 ms rather than 14.7 and the ripple falls from 2.30 V to 1.07 V on the same 1000 µF. ' +
      'Two diodes are in series at every instant and cost 1.4 V, so the ceiling is 16.4 V — yet the DC ' +
      'output is the same 15.6 V, because it sags half as far from a ceiling 0.7 V lower. The current ' +
      'is spread over twice the pulses: 1.30 A peaks instead of 2.03, form factor 2.57 instead of 3.2. ' +
      'And each diode now blocks only the peak source voltage, 17.1 V, not 33 — the capacitor is on its ' +
      'own side of the bridge. The four diodes drop 218 mW between them, 8 % of what comes in.',
    terms: ['rectifier', 'piv', 'form-factor'],
  }),
  rect('bridge', {
    id: 'e3',
    group: GROUPS[3],
    name: 'The price of a big capacitor',
    params: [Cf(), Rs(), Rl(), Vs(), Vfd(), F()],
    traces: ['vout', 'iD'],
    views: ['sweep', 'measures', 'losses'],
    view: 'sweep',
    sweep: { x: 'C', y: 'angle', y2: 'iPeak' },
    note:
      'More capacitance, less ripple: 100 µF leaves 6.9 V, 1000 µF 1.07 V, 4700 µF 0.23 V. But the ' +
      'diodes conduct for a shorter slice of each cycle — 67°, 33°, 32° — and must deliver the same ' +
      'charge inside it, so the peak current climbs from 0.60 A to 1.30 to 1.34 and the form factor from ' +
      '1.84 to 2.61. The sweep shows the two together: ripple falls without limit, the conduction angle ' +
      'does not. It floors near 32° where R_s sets it — the winding resistance, not the capacitor, decides ' +
      'how narrow the gulp can get. Halve R_s and the floor drops; the peak current goes up to match. ' +
      'The power factor slides from 0.65 to 0.54 along the way: the smoother the output, the worse ' +
      'the source is asked to supply it.',
    terms: ['conduction-angle', 'form-factor', 'power-factor'],
  }),
  rect('bridge', {
    id: 'e4',
    group: GROUPS[3],
    name: 'What the grid sees',
    params: [Cf(), Rl(), Rs(), Vs(), Vfd(), F()],
    traces: ['vin', 'iin'],
    views: ['spectrum', 'measures', 'losses'],
    view: 'spectrum',
    note:
      'The line current is not a sine but two spikes a cycle, and the supply is sized for what it does ' +
      'not use. Fourier says how much: the fundamental is 219 mA RMS of a 401 mA total — the ' +
      'distortion factor is 0.545 and the THD 154 %, with the 3rd harmonic at 94 % of the fundamental, ' +
      'the 5th at 81 %, the 7th at 66 %. The fundamental itself lags the voltage by only 7.6°, a ' +
      'displacement factor of 0.991: this is not a phase-shift problem, and a capacitor across the line ' +
      'will not fix it. Power factor is the product, 0.991 × 0.545 = 0.540, so the line carries 1.85× the ' +
      'RMS current that 2.73 W would need as a sine. Odd orders only: both half-cycles draw the same ' +
      'shape, which cancels every even harmonic exactly.',
    terms: ['power-factor', 'thd', 'displacement', 'harmonic'],
  }),
  {
    id: 'e5',
    group: GROUPS[3],
    name: 'The dimmer',
    kind: 'dimmer',
    params: [Alpha(), Vline(), Rl(), F()],
    traces: ['vin', 'vout', 'iR'],
    allTraces: ['vin', 'vout', 'vD', 'iin', 'iR'],
    views: ['sweep', 'spectrum', 'measures'],
    view: 'sweep',
    sweep: { x: 'alpha', y: 'share' },
    periods: 2,
    note:
      'A triac fires at an angle α into each half-cycle and conducts to the zero crossing, so the load ' +
      'gets the tail of every half-sine. Its share of full power is 1 − α/π + sin 2α/(2π): at 90° exactly ' +
      'half — 72.0 W of the 144 W that 120 V puts into 100 Ω — and the sweep follows the formula to the ' +
      'degree, from all of it at 0° to none at 180°. The current is chopped mid-sine, so it is rich in ' +
      'harmonics (THD 65 %) and its fundamental lags 32.5° (the wave’s weight has moved late): the power ' +
      'factor is 0.707, the displacement 0.844 times the distortion 0.838. Dim to 135° and 9.1 % of the ' +
      'power arrives at a power factor of 0.30. The sharp edge at every firing is the buzz in cheap ' +
      'dimmers and the harmonics on the line; the rectifier-plus-capacitor of E4 draws worse.',
    terms: ['phase-cut', 'power-factor', 'displacement', 'thd'],
  },
  rect('six', {
    id: 'e6',
    group: GROUPS[3],
    name: 'Three phases, six pulses',
    traces: ['vin', 'vrect', 'vout', 'iin'],
    note:
      'Three 12.6 V secondaries 120° apart into six diodes: at every instant the pair with the highest ' +
      'line-to-line voltage conducts, the pair changes every 60°, and the output ripples at six times ' +
      'the line frequency. The capacitor is charged towards the peak line voltage, √3 × 17.8 = 30.9 V ' +
      'less two diode drops, and sits at 28.8 V — nearly twice the single-phase bridge from the same ' +
      'secondaries, with 0.52 V of ripple at 1000 µF into the same 100 Ω. Without the capacitor it would ' +
      'average 1.35·V_LL = 29.5 V, so the capacitor is barely doing anything: six pulses are already ' +
      'smooth. Each diode blocks the peak line-to-line voltage, 30.2 V. And the line current has no 3rd ' +
      'harmonic at all — the triplens cancel between three phases — so the 5th (91 %) and 7th (82 %) are ' +
      'the first that survive, which is why industrial rectifiers are three-phase.',
    terms: ['six-pulse', 'harmonic', 'piv'],
  }),
]

export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))

export function defaultsOf(id) {
  const out = {}
  for (const k of byId[id].params) out[k.key] = k.default
  return out
}
