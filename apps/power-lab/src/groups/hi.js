// Groups H and I: closing the loop, and three phases out.
//
// Everything these two groups add to the app is a named table exported from
// here, and `experiments.js`, `math.js`, `terms.js` and `analysis.js` each
// take one appended line per table. Three lanes were building at once, so a
// merge is a union rather than a rewrite.
//
// H is the bridge POWER_LAB_PLAN.md §1.5 describes. A converter is two linear
// circuits a period, so it has no transfer function until the two are
// averaged. The averaged one has six coefficients, and Control Lab's
// `plant=custom` carries exactly six. What averaging discards is the ripple,
// and the guard that ships with it says where that stops being a detail.
//
// I is F's bridge leg, three times over, into a balanced wye whose neutral
// floats. That one fact — anything common to the three legs lands in the
// neutral's own potential — carries the absent triplens, the six-level phase
// voltage, the fifteen per cent of headroom a third-harmonic offset buys, and
// the bus that does not pulse.

import { fmt } from '@ee-labs/ui'
import { T, F, C, V, row } from '../math.js'

// ------------------------------------------------------------ groups

export const HI_GROUPS = ['Closing the loop', 'Three-phase out']

export const HI_GROUP_INTROS = {
  'Closing the loop':
    'A converter is two circuits a period, so it has no transfer function until the two are averaged. ' +
    'This group builds that model, checks it against the switched truth, and finds the zero that limits ' +
    'how fast a loop can be.',
  'Three-phase out':
    'One bridge leg makes a square wave. Three of them, a third of a cycle apart, make three voltages ' +
    'that sum to zero. Their triplens never reach the load, and their power does not pulse.',
}

// ------------------------------------------------------------ knobs

const Vin = (def = 12) => ({ key: 'Vin', label: 'V_in', unit: 'V', min: 1, max: 48, scale: 'linear', step: 0.1, default: def, hint: 'Input voltage' })
const D = (def = 5 / 12) => ({ key: 'D', label: 'D', unit: '%', percent: true, min: 0.02, max: 0.98, scale: 'linear', step: 0.001, default: def, hint: 'Duty: the share of each period the switch is on' })
const L = (def = 100e-6) => ({ key: 'L', label: 'L', unit: 'H', min: 1e-6, max: 10e-3, scale: 'log', default: def, hint: 'Inductance' })
const C_ = (def = 100e-6) => ({ key: 'C', label: 'C', unit: 'F', min: 1e-6, max: 10e-3, scale: 'log', default: def, hint: 'Output capacitance' })
const R = (def = 5) => ({ key: 'R', label: 'R_load', unit: 'Ω', min: 0.5, max: 1000, scale: 'log', default: def, hint: 'Load resistance' })
const Fs = (def = 100e3) => ({ key: 'fs', label: 'f_s', unit: 'Hz', min: 10e3, max: 2e6, scale: 'log', default: def, hint: 'Switching frequency' })
const Ron = (def = 0) => ({ key: 'Ron', label: 'R_on', unit: 'Ω', min: 0, max: 0.5, scale: 'linear', step: 0.001, default: def, hint: 'Switch on-resistance' })
const RL = (def = 0) => ({ key: 'RL', label: 'R_L', unit: 'Ω', min: 0, max: 0.5, scale: 'linear', step: 0.001, default: def, hint: 'Inductor winding resistance' })
const Sync = (def = 1) => ({ key: 'sync', label: 'Freewheel', kind: 'toggle', default: def, on: 'synchronous switch', off: 'diode', hint: 'What carries the inductor current while the switch is off' })

/** The load the step lands on: an absolute value, not an increment. */
const Rstep = (def = 2.5) => ({ key: 'Rstep', label: 'R after', unit: 'Ω', min: 0.5, max: 1000, scale: 'log', default: def, hint: 'The load the step lands on' })
/** How far the duty is stepped, in the same units the duty is read in. */
const Dstep = (def = 0.05) => ({ key: 'dD', label: 'ΔD', unit: '%', percent: true, min: 0.005, max: 0.3, scale: 'linear', step: 0.001, default: def, hint: 'How far the duty steps' })

// Three-phase. The load is a wye of R and L, which is what a winding is, so
// its inductance runs in millihenries rather than in microhenries.
const Vdc = (def = 48) => ({ key: 'Vdc', label: 'V_dc', unit: 'V', min: 12, max: 400, scale: 'log', default: def, hint: 'The DC bus the three legs switch' })
const Fund = (def = 60) => ({ key: 'f1', label: 'f₁', unit: 'Hz', min: 20, max: 400, scale: 'log', default: def, hint: 'Output frequency the modulator asks for' })
const Lw = (def = 20e-3) => ({ key: 'L', label: 'L', unit: 'H', min: 1e-3, max: 200e-3, scale: 'log', default: def, hint: 'Inductance of each winding' })
const Rw = (def = 10) => ({ key: 'R', label: 'R_load', unit: 'Ω', min: 0.5, max: 1000, scale: 'log', default: def, hint: 'Resistance of each winding' })
const Ma = (def = 0.8) => ({ key: 'ma', label: 'm_a', unit: '%', percent: true, min: 0.05, max: 1.4, scale: 'linear', step: 0.005, default: def, hint: 'Modulation index: the reference’s height against the carrier’s' })
const Fsw = (def = 1260) => ({ key: 'fsw', label: 'f_sw', unit: 'Hz', min: 300, max: 8e3, scale: 'log', default: def, hint: 'Carrier frequency, locked to an odd multiple of three times f₁' })
const Inject = (def = 0) => ({ key: 'inject', label: 'Reference', kind: 'toggle', default: def, on: 'plus a third harmonic', off: 'plain sine', hint: 'Whether a third harmonic of one sixth is added to all three references' })

// ------------------------------------------------------------ traces

export const HI_TRACES = {
  vao: { label: 'v_ao', axis: 'V', title: 'Leg voltage: what one leg puts on its terminal, against the middle of the bus' },
  vab: { label: 'v_ab', axis: 'V', title: 'Line-to-line voltage, between terminals a and b' },
  van: { label: 'v_an', axis: 'V', title: 'Phase voltage: what one winding sees, against the load’s floating neutral' },
  ia: { label: 'i_a', axis: 'A', title: 'Current in phase a' },
  idc: { label: 'i_dc', axis: 'A', title: 'Current the DC bus supplies' },
}

export const HI_VIEWS = {
  step: { label: 'Step', title: 'The averaged model laid over the switched waveform, through one step' },
  plant: { label: 'Plant', title: 'The control-to-output transfer function, its guard, and the hand-over' },
  power: { label: 'Power', title: 'Instantaneous power, one phase against the whole bus' },
}

export const HI_SWEEP_Y = {
  vll1: { label: 'line-to-line fundamental, peak', unit: 'V', lo: 0 },
  vll1off: { label: 'with the offset', unit: 'V', lo: 0 },
}

// ------------------------------------------------------------ experiments

const loop = (kind, over) => ({
  kind,
  loop: true,
  headline: 'eta',
  traces: ['vout', 'iL'],
  allTraces: ['vsw', 'vout', 'vL', 'iL', 'iQ', 'iD', 'iC', 'iin'],
  views: ['step', 'plant', 'math', 'measures', 'balance'],
  view: 'step',
  periods: 2,
  ...over,
})

const three = (kind, over) => ({
  kind,
  threePhase: true,
  headline: 'thd',
  traces: ['vab', 'van', 'ia'],
  allTraces: ['vao', 'vab', 'van', 'ia', 'idc'],
  views: ['spectrum', 'measures', 'math'],
  view: 'spectrum',
  periods: 1,
  ...over,
})

export const HI_EXPERIMENTS = [
  // ------------------------------------------------- H · Closing the loop
  loop('buck', {
    id: 'h1',
    about: 'Rstep',
    chips: [2.5, 10],
    try: { knob: 'Rstep', text: 'Set the load after the step to 10 Ω: the output rises 48.5 mV.' },
    group: 'Closing the loop',
    name: 'The averaged model',
    params: [Rstep(2.5), R(5), Ron(0.05), RL(0.05), Sync(1), Vin(), D(), L(), C_(), Fs()],
    step: { param: 'R', to: 'Rstep', periods: 200, out: 'vout' },
    note:
      'A converter switches, so it is not one linear circuit. Average the two switch positions over a ' +
      'period and it becomes one. Step the load from 5 Ω to 2.5 Ω and the output sags 94.3 mV, from ' +
      '4.902 V to 4.808 V. The smooth curve is the averaged model. It follows the cycle averages to ' +
      'within 325 µV, an eleventh of the 3.65 mV of ripple it left out.',
    terms: ['averaged-model', 'average', 'ripple', 'synchronous'],
  }),
  loop('buck', {
    id: 'h2',
    about: 'fs',
    chips: [100e3, 10e3],
    try: { knob: 'fs', text: 'Set f_s to 10 kHz: the ceiling drops to 2.00 kHz and the panel warns.' },
    group: 'Closing the loop',
    name: 'The buck as a plant',
    params: [Fs(), Sync(1), Vin(), D(), L(), C_(), R(5)],
    views: ['plant', 'math', 'measures', 'balance'],
    view: 'plant',
    note:
      'The averaged model is a rational transfer function from duty to output, which Control Lab calls ' +
      'a plant. This buck’s has no zero, a corner at 1.59 kHz, and Q = 5.00. Its DC gain is 12.00 V, ' +
      'and dV_out/dD on the switched engine agrees. Averaging discards everything inside one period, so ' +
      'the model holds below f_s/5. At 100 kHz that ceiling is 20.0 kHz. At 10 kHz it falls to ' +
      '2.00 kHz and the panel warns.',
    terms: ['averaged-model', 'plant', 'transfer-function', 'duty', 'buck'],
  }),
  loop('boost', {
    id: 'h3',
    about: 'D',
    chips: [0.5, 0.6],
    try: { knob: 'D', text: 'Set D to 60 %: the zero falls to 255 Hz, the dip to 857 mV.' },
    group: 'Closing the loop',
    name: 'The zero in the wrong half',
    params: [D(0.5), Dstep(0.05), Sync(1), Vin(), L(1e-3), C_(), R(10), Fs()],
    step: { param: 'D', by: 'dD', periods: 200, out: 'vout' },
    traces: ['vsw', 'vout', 'iL'],
    views: ['step', 'plant', 'math', 'measures', 'sweep'],
    view: 'step',
    sweep: { x: 'D', y: 'M' },
    note:
      'Step a boost’s duty up and its output falls before it rises. The inductor has to divert its ' +
      'current away from the load before it can carry more. At D = 50 % a 5 % step ends at 26.67 V and ' +
      'dips 391 mV first, on a slope of −2400 V/s. That is a zero at D′²R/(2πL) = 398 Hz, in the right ' +
      'half plane. At D = 60 % it moves down to 255 Hz.',
    terms: ['rhp-zero', 'boost', 'duty', 'averaged-model'],
  }),

  // -------------------------------------------------- I · Three-phase out
  three('sixstep', {
    id: 'i1',
    about: 'Vdc',
    chips: [48, 24],
    try: { knob: 'Vdc', text: 'Set V_dc to 24 V: every voltage halves and every harmonic share holds.' },
    group: 'Three-phase out',
    name: 'Three square waves, 120° apart',
    params: [Vdc(48), Fund(), Lw(), Rw()],
    note:
      'Each leg swings between the rails once a cycle, 120° after the last. The line-to-line voltage ' +
      'v_ab is a quasi-square with 60° gaps. Its fundamental is (√6/π)·V_dc, or 37.43 V rms on a 48 V ' +
      'bus. The load’s neutral floats, so the phase voltage is a staircase of ±16.0 V and ±32.0 V. No ' +
      'third harmonic reaches the line, and the 5th is 20.0 %.',
    terms: ['six-step', 'harmonic', 'rms', 'inverter'],
  }),
  three('spwm3', {
    id: 'i2',
    about: 'ma',
    chips: [0.8, 1.15],
    try: { knob: 'inject', text: 'Turn on the offset at m_a = 115 %: the line reaches 47.80 V.' },
    group: 'Three-phase out',
    name: 'Sine PWM, three references, one carrier',
    params: [Ma(0.8), Inject(0), Fsw(1260), Vdc(48), Fund(), Lw(), Rw()],
    traces: ['vao', 'vab', 'ia'],
    views: ['sweep', 'spectrum', 'measures', 'math'],
    view: 'sweep',
    sweep: { x: 'ma', y: 'vll1', y2: 'vll1off', shared: true },
    note:
      'Three sine references share one triangular carrier at 21 times the output frequency. The ' +
      'line-to-line fundamental follows (√3/2)·m_a·V_dc, which at 80 % is 33.26 V peak. Above ' +
      'm_a = 1 the plain sine runs out, and 115 % buys 45.19 V of the 47.80 V the line promises. Add ' +
      'a third harmonic of one sixth to every reference and the line reaches 47.80 V. It is common to ' +
      'all three legs, so it cancels between them.',
    terms: ['carrier', 'modulation-index', 'harmonic', 'triplen'],
  }),
  three('spwm3', {
    id: 'i3',
    about: 'ma',
    chips: [0.8, 0.4],
    try: { knob: 'ma', text: 'Set m_a to 40 %: the load takes 8.84 W and the bus stays quiet.' },
    group: 'Three-phase out',
    name: 'A balanced load, and a quiet bus',
    params: [Ma(0.8), Fsw(1260), Vdc(48), Fund(), Lw(), Rw()],
    traces: ['van', 'ia', 'idc'],
    views: ['power', 'spectrum', 'measures', 'math'],
    view: 'power',
    note:
      'Phase a alone averages 11.77 W and swings 14.72 W at twice the output frequency. The swing is ' +
      'the mean divided by cos φ, at φ = 37.0°. The other two phases swing the same amount 120° and ' +
      '240° late, so the three add to nothing. At m_a = 80 % the bus carries 35.31 W, with no 120 Hz ' +
      'component at all. One bridge on its own has no second phase to cancel with.',
    terms: ['balanced-load', 'inverter', 'average'],
  }),
]

// ------------------------------------------------------------ terms

export const HI_TERMS = {
  'averaged-model': {
    name: 'Averaged model',
    def:
      'The one linear circuit that replaces a converter’s two switch positions, weighted by the duty. ' +
      'Its equilibrium is the cycle average the exact solver finds. What it leaves out is the ripple ' +
      'inside each period, which is why it holds only well below the switching frequency.',
  },
  plant: {
    name: 'Plant',
    def:
      'The thing a control loop acts on, written as a transfer function from what the controller sets ' +
      'to what it measures. Here that is duty in, output voltage out. Control Lab takes one as six ' +
      'coefficients, and the link from this panel carries them exactly.',
  },
  'transfer-function': {
    name: 'Transfer function',
    def:
      'A ratio of two polynomials in s, describing how a linear circuit answers a small change. Its ' +
      'denominator’s roots are the poles and its numerator’s the zeros. A buck’s averaged model is one ' +
      'of these, and a switched converter is not.',
  },
  'rhp-zero': {
    name: 'Right-half-plane zero',
    def:
      'A zero of the transfer function at a positive frequency, which sends the output the wrong way ' +
      'before it goes the right way. A boost has one at D′²R/L because the inductor must stop feeding ' +
      'the load before it can feed it more. It puts a ceiling on how fast a loop around it can be.',
  },
  'six-step': {
    name: 'Six-step',
    def:
      'The simplest three-phase modulator: each leg switches once a cycle, a third of a cycle after ' +
      'the last. The six combinations give six 60° steps. The line-to-line voltage is a quasi-square ' +
      'whose fundamental is (√6/π)·V_dc.',
  },
  triplen: {
    name: 'Triplen',
    def:
      'A harmonic at a multiple of three times the output frequency. In a balanced three-phase set all ' +
      'three phases carry it in step, so it lands in the neutral’s own potential and never reaches the ' +
      'load. That is what lets a third harmonic be added to the references for free.',
  },
  'balanced-load': {
    name: 'Balanced load',
    def:
      'Three equal impedances fed by three equal voltages a third of a cycle apart. Their currents sum ' +
      'to zero, so a neutral wire would carry nothing. Their instantaneous powers sum to a constant, so ' +
      'the DC bus feeding them sees no ripple at twice the output frequency.',
  },
}

// ------------------------------------------------------------ math

export const HI_TEX = {
  'G_vd(0) against dV_out/dD': 'G_{vd}(0) \\;\\text{against}\\; dV_{out}/dD',
  'f_0 of the averaged model': 'f_0 \\;\\text{of the averaged model}',
  'the zero, f_z': 'f_z',
  'dV_out/dD on the switched engine': 'dV_{out}/dD \\;\\text{on the switched engine}',
  'the averaged curve against the cycle averages': '\\max_k |\\bar{v}_k - \\hat{v}(t_k)|',
  'V_ll1, the line-to-line fundamental': 'V_{ll,1}',
  'V_ph1, the phase fundamental': 'V_{ph,1}',
  '⟨v_ab⟩ over a cycle': '\\langle v_{ab} \\rangle',
  'the third harmonic of v_ab': '|V_{ab,3}|',
  'V_dc·⟨i_dc⟩ against the windings': 'V_{dc}\\langle i_{dc}\\rangle = 3 R\\, I_{rms}^2',
  'the bus at twice the output frequency': '|P_{dc,2}|',
  'one phase at twice the output frequency': '|P_{a,2}| / P_a',
}

const LOOP_INTRO = {
  h1:
    'Averaging replaces the two switch positions with one circuit weighted by the duty, so the state it carries is the cycle average rather than the state. The equilibrium of that circuit is exactly what the switched solver reports as the period average, and the trajectory through a step is one matrix exponential.',
  h2:
    'The averaged circuit is linear, so a small change in duty gives a rational transfer function. Its denominator is the characteristic polynomial of A, and its numerator carries how much the duty moves the state and how much it moves the output directly. Six coefficients is the whole model.',
  h3:
    'Stepping the duty up on a boost makes the diode conduct for less of each period before the inductor current has grown, so the output loses charge first. In the transfer function that is a numerator root at a positive frequency, and the initial slope is the wrong sign.',
}

/** Attach the TeX for the row names this file adds, before the panel builds. */
const tx = (rows) => rows.map((r) => (HI_TEX[r.label] && !r.tex ? { ...r, tex: HI_TEX[r.label] } : r))

/** The math panel for the loop experiments (H1, H2, H3). */
export function loopEntry(exp, params, x) {
  const f = x.formulas
  const tf = x.plant
  const g = x.guard
  // Two things put the model outside its own terms, and each footnotes the
  // rows it invalidates rather than crossing them out. The closed forms of
  // §1.5 are for ideal parts, and a converter that runs dry is not a
  // two-interval converter at all.
  const lossy = x.p.Ron > 0 || x.p.RL > 0 || x.p.ESR > 0 || x.p.Vf > 0
  const idealWhy = lossy
    ? 'The closed form is written for ideal parts. R_on, R_L and the ESR move the corner and the damping, and the model carries them where the formula does not.'
    : null
  const dry = x.m.mode !== 'CCM'
  const dryWhy = dry
    ? 'Averaging over a fixed on/off pattern describes a converter in continuous conduction. This one runs dry, so the period has a third interval and the two-state average is not its model.'
    : null
  // The third limit is the ripple itself. Averaging keeps the cycle average
  // of the state and drops the correlation between the two ripples, which is
  // second order in them and invisible at a per-cent output ripple. Past a
  // twentieth of the output it is not, and the model's equilibrium parts
  // from the exact one by that amount.
  const dVrel = x.m.sig.vout.pp / Math.max(1e-12, Math.abs(x.m.sig.vout.avg))
  const ripplyWhy =
    dVrel > 0.05
      ? `The averaged model keeps the cycle average and drops the correlation between the ripples, which is second order in them. Here the output ripple is ${(dVrel * 100).toFixed(1)} % of V_out, so that term is not small.`
      : null
  // ...and past f_s/5 the model is not this converter at all, which is the
  // guard's own sentence rather than a second one.
  const why = dryWhy || (g.state === 'refuse' ? g.reason : null) || ripplyWhy
  const rows = [
    row('G_vd(0) against dV_out/dD', tf.dc, f.dcMeasured, 'V', 2e-2, 0, why),
    row('f_0 of the averaged model', f.f0ideal, f.f0plant, 'Hz', 1e-9, 0, dryWhy || idealWhy),
    row('Q', f.Qideal, tf.Q, '', 1e-9, 0, dryWhy || idealWhy),
  ]
  if (Number.isFinite(f.fzIdeal)) rows.push(row('the zero, f_z', f.fzIdeal, f.fz, 'Hz', 1e-9, 0, dryWhy || idealWhy))
  if (x.step) {
    // The averaging error is second order in the ripple, so the bound is the
    // ripple's own share rather than a constant: the same bound loop.test.js
    // holds the engine to.
    rows.push(
      row(
        'the averaged curve against the cycle averages',
        0,
        x.step.worst * x.step.span,
        exp.step.out === 'iL' ? 'A' : 'V',
        0,
        0.05 * x.step.span + 0.5 * x.step.ripple,
        x.step.blocked
          ? 'The inductor current reversed during the walk, so the diode blocked and the fixed pattern is not this circuit.'
          : why,
      ),
    )
  }
  const values = [
    { label: 'b₀ of the numerator', value: tf.b[2], unit: '', note: 'the constant term, G(0)·a₀' },
    { label: 'b₁ of the numerator', value: tf.b[1], unit: '', note: Number.isFinite(f.fz) ? 'the zero lives here' : 'zero, so there is no zero' },
    { label: 'a₁ of the denominator', value: tf.a[1], unit: '', note: 'ω₀/Q' },
    { label: 'a₀ of the denominator', value: tf.a[2], unit: '', note: 'ω₀²' },
    { label: 'f_0 of the averaged model', value: f.f0plant, unit: 'Hz', note: `Q = ${tf.Q.toFixed(3)}` },
    { label: 'the zero, f_z', value: Number.isFinite(f.fz) ? f.fz : 0, unit: 'Hz', note: Number.isFinite(f.fz) ? (tf.rhp ? 'right half plane' : 'left half plane') : 'no zero' },
    { label: 'f_s / 5', value: g.limit, unit: 'Hz', note: `the model’s ceiling, ${(g.ratio * 100).toFixed(1)} % used` },
  ]
  if (x.step) {
    values.push(
      { label: 'the step', value: x.step.to - x.step.from, unit: exp.step.out === 'iL' ? 'A' : 'V', note: `from ${fmt(x.step.from, 'V', 4)}` },
      { label: 'ripple left out', value: x.step.ripple, unit: exp.step.out === 'iL' ? 'A' : 'V' },
      { label: 'initial slope per unit duty', value: tf.slope0, unit: 'V/s' },
    )
  }
  return {
    blocks: [
      T(LOOP_INTRO[exp.id]),
      F(
        'A = D\\,A_{on} + D\'\\,A_{off}, \\qquad X = -A^{-1} f, \\qquad G_{vd}(s) = c\\,(sI - A)^{-1} B_d + E_d',
        'state-space averaging, and the transfer function it gives',
      ),
      F(
        x.kind === 'buck'
          ? 'G_{vd}(s) = \\frac{V_{in}}{1 + s/(Q\\omega_0) + s^2/\\omega_0^2}, \\qquad \\omega_0 = \\frac{1}{\\sqrt{LC}},\\; Q = R\\sqrt{C/L}'
          : 'G_{vd}(s) = \\frac{V_{out}}{D\'}\\cdot\\frac{1 - s/\\omega_z}{1 + s/(Q\\omega_0) + s^2/\\omega_0^2}, \\qquad \\omega_z = \\frac{D\'^2 R}{L}',
        'the closed form the plan writes down, for ideal parts',
      ),
      C(tx(rows)),
      V(tx(values)),
    ],
  }
}

const THREE_INTRO = {
  i1:
    'Each leg is a two-level square wave and the three are a third of a cycle apart. The load’s neutral floats, so what a winding sees is the leg voltage less the average of all three, which removes every harmonic the three carry in step.',
  i2:
    'One carrier serves three references, at an odd multiple of three so a 120° shift of a reference is a whole number of carrier periods. A third harmonic added to all three references lands in the neutral, so it lowers the reference’s own peak without touching the line.',
  i3:
    'A single phase carries p(t) = P(1 − cos 2ωt) plus a quadrature term, so it swings by its own apparent power at twice the output frequency. Three of them, a third of a cycle apart, add to a constant, and the DC bus supplies the sum rather than any one of them.',
}

/** The math panel for the three-phase experiments (I1, I2, I3). */
export function threePhaseEntry(exp, params, x) {
  const m = x.m
  const f = x.formulas
  const p = x.p
  const six = x.kind === 'sixstep'
  // Two settings put the modulator outside the identity it is checked
  // against: a reference taller than the carrier, and a carrier so slow that
  // its lowest sideband lands on the fundamental.
  const over = !six && p.ma > 0.995 * f.ceiling
  const crowded = !six && f.mf < 9
  const modWhy = over
    ? `Past m_a = ${f.ceiling.toFixed(4)} the reference leaves the carrier, pulses go missing, and the fundamental stops following the line. It is ${((1 - (m.Vll1 * Math.SQRT2) / ((Math.sqrt(3) / 2) * p.ma * p.Vdc)) * 100).toFixed(1)} % short of it here.`
    : crowded
      ? `The carrier's lowest sideband is at harmonic ${f.mf - 2}, which at m_f = ${f.mf} is too near the fundamental to be separated from it.`
      : null
  const rows = [
    row('V_ll1, the line-to-line fundamental', f.Vll1ideal, m.Vll1, 'V', six ? 1e-9 : 1e-5, 0, modWhy),
    row('V_ph1, the phase fundamental', f.Vph1ideal, m.V1, 'V', six ? 1e-9 : 1e-5, 0, modWhy),
    row('⟨v_ab⟩ over a cycle', 0, m.sig.vab.avg, 'V', 0, 1e-9 * p.Vdc),
    row('the third harmonic of v_ab', 0, third(x), 'V', 0, 1e-9 * p.Vdc),
    row('V_dc·⟨i_dc⟩ against the windings', m.Pout, m.Pdc, 'W', 1e-9),
    row('the bus at twice the output frequency', 0, m.p2, 'W', 0, 1e-9 * m.Pdc),
  ]
  if (six) rows.push(row('THD of v_ab', f.thdIdeal, m.thdLine, '', 1e-9))
  const values = [
    { label: 'V_dc', value: p.Vdc, unit: 'V' },
    { label: 'm_f', value: f.mf, unit: '', note: six ? 'one edge a half cycle' : `carrier at ${fmt(f.fsw, 'Hz', 4)}` },
    { label: 'V_ll1, the line-to-line fundamental', value: m.Vll1, unit: 'V', note: `peak ${fmt(m.Vll1 * Math.SQRT2, 'V', 4)}` },
    { label: 'THD of v_ab', value: m.thdLine * 100, unit: '%' },
    { label: 'THD of i_a', value: m.thdCurrent * 100, unit: '%', note: `the winding is the filter, |Z| = ${fmt(f.Z, 'Ω', 3)}` },
    { label: 'I_rms per phase', value: m.Irms, unit: 'A', note: `I₁ = ${fmt(m.I1, 'A', 4)}` },
    { label: 'P at the load', value: m.Pout, unit: 'W', note: `φ = ${f.phiDeg.toFixed(2)}°` },
    { label: 'one phase at twice the output frequency', value: m.phaseSwing, unit: '', note: `1/cos φ = ${f.onePhaseSwing.toFixed(4)}` },
    { label: 'the bus at six times the output frequency', value: m.p6, unit: 'W' },
  ]
  if (!six) {
    values.push(
      { label: 'the reference’s own peak', value: f.referencePeak, unit: '', note: f.inject ? 'sin θ + sin 3θ/6' : 'sin θ' },
      { label: 'the modulation index it allows', value: f.ceiling, unit: '', note: f.inject ? '2/√3, a rise of 15.47 %' : 'the carrier’s own height' },
    )
  }
  return {
    blocks: [
      T(THREE_INTRO[exp.id]),
      F(
        'v_{no} = \\tfrac{1}{3}(v_{ao} + v_{bo} + v_{co}), \\qquad v_{an} = v_{ao} - v_{no}, \\qquad v_{ab} = v_{ao} - v_{bo}',
        'the floating neutral, which is why the line carries no triplen',
      ),
      F(
        six
          ? 'V_{ll,1} = \\frac{\\sqrt6}{\\pi} V_{dc}, \\qquad V_{ph,1} = \\frac{\\sqrt2}{\\pi} V_{dc}, \\qquad V_{ab,k}/V_{ab,1} = 1/k'
          : '\\hat{v}_{ll,1} = \\frac{\\sqrt3}{2} m_a V_{dc}, \\qquad m_{a,max} = 1 \\;\\text{or}\\; \\frac{2}{\\sqrt3} \\;\\text{with the offset}',
        six ? 'six-step, whatever the bus' : 'the modulator, whatever the carrier',
      ),
      C(tx(rows)),
      V(tx(values)),
    ],
  }
}

/** The third harmonic of the line-to-line voltage, which a balanced set has none of. */
function third(x) {
  const h = x.m.harmonics.find((q) => q.k === 3)
  return h ? h.rms * Math.SQRT2 : 0
}

// ------------------------------------------------------------ the top bar

/** The one-line result of a three-phase experiment. */
export function threePhaseOutcome(x) {
  const m = x.m
  return `V_ll1 = ${fmt(m.Vll1, 'V', 4)} rms, THD ${(m.thdLine * 100).toFixed(1)} %, ${
    x.conv.kind === 'sixstep' ? 'six steps' : `m_f = ${x.conv.mf}`
  }`
}

/** The top bar's middle and output chips for a three-phase experiment. */
export function threePhaseFlow(exp, params, x) {
  const m = x.m
  return {
    mode: x.conv.kind === 'sixstep' ? 'six-step' : `carrier × ${x.conv.mf}`,
    mid: `${fmt(x.p.Vdc, 'V', 3)} bus`,
    out: `V_ll1 = ${fmt(m.Vll1, 'V', 4)}`,
    outSub: `THD ${(m.thdLine * 100).toFixed(1)} %`,
  }
}
