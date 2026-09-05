import { CIRCUITS, defaultsOf } from './circuits.js'
import { tolsOf } from './tolerance.js'

// The curriculum.
//
// Circuit Lab was an instrument before this: correct, well tested, and no help
// at all to someone who does not already know what to try. Signal Lab's value
// turned out to be its twenty-three questions rather than its block registry,
// and the same is true here.
//
// Every note makes a claim, and lessons.test.js renders each lesson and measures
// whether the claim holds. That is not ceremony — the equivalent tests in Signal
// Lab caught four confidently wrong explanations, including two I wrote myself.
//
// Each lesson also carries:
//   try       one imperative, apart from the note: which knob, what should happen
//   chips     one-click settings for that imperative — each a partial patch
//             (params / output / tols / circuit) applied on top of the LESSON's
//             own setup, so "set R to 200 Ω" never means "find R below the
//             fold" — and never compounds with the chip pressed before it
//             (R 10 kΩ then C 10 nF used to leave both, lighting a chip whose
//             promised corner was ten times off)
//   featured  the component fields (or the tolerance / output / hand-over
//             control) the try line names, rendered right under it. A string
//             names the field; { id, min, max } also scopes its slider to the
//             range the try line describes, so "drag R from 20 to 200 Ω" is
//             most of the slider rather than 46 px of a 1 Ω–1 MΩ one.
// Every number a try line quotes is measured in lessons.test.js like the
// notes' own claims.

const p = (id, over = {}) => ({ ...defaultsOf(id), ...over })

export const LESSON_GROUPS = ['Reading a response', 'Resonance', 'Active circuits', 'One object, two names']

/** The lesson the lab opens on: a curve that moves when you touch R. */
export const START_LESSON = 'Where the corner comes from'

export const LESSONS = [
  // ------------------------------------------------- Reading a response
  {
    group: 'Reading a response',
    name: 'A divider has no dynamics',
    terms: ['db', 'impedance', 'phase'],
    note:
      'The circuit is two resistors. The response is a flat line and the phase is zero, at every frequency, ' +
    'because resistors store no energy and so nothing can depend on how fast the signal changes. Every other ' +
    'circuit here is this one with a frequency-dependent impedance in place of a resistor.',
    try: 'Set R2 to 3 kΩ, H becomes 3/4 (−2.5 dB) and the phase is still 0° at every frequency.',
    chips: [
      { label: 'R2 1 kΩ', params: { r2: 1000 } },
      { label: 'R2 3 kΩ', params: { r2: 3000 } },
    ],
    featured: [{ id: 'r2', min: 100, max: 10000 }],
    patch: { circuit: 'divider', view: 'step' },
    claim: { flat: true, gain: 0.5, tryGain: 0.75, tryDb: -2.5 },
  },
  {
    group: 'Reading a response',
    name: 'Where the corner comes from',
    terms: ['corner', 'db', 'phase', 'impedance', 'tf', 'pole', 'lhp'],
    note:
      'The cutoff is the frequency where the capacitor’s impedance equals the resistor’s. There the two split ' +
    'the input evenly in magnitude, and each sits 45° from the input in phase, so 90° from each other, as R ' +
    'and C always are. That is why the output is 1/√2 of the input, −3.01 dB rather than −6. Change R or C ' +
    'and the corner moves as 1/(2πRC).',
    try: 'Drop C from 100 nF to 10 nF, the corner jumps from 1.59 kHz to 15.9 kHz: ten times less C, ten times ' +
    'higher.',
    chips: [
      { label: 'C 10 nF', params: { c: 10e-9 } },
      { label: 'C 100 nF', params: { c: 100e-9 } },
      { label: 'C 1 µF', params: { c: 1e-6 } },
      { label: 'R 10 kΩ', params: { r: 10000 } },
    ],
    featured: [
      { id: 'c', min: 1e-9, max: 10e-6 },
      { id: 'r', min: 100, max: 100000 },
    ],
    patch: { circuit: 'rcLow', view: 'step' },
    claim: { cornerDb: -3.0103, cornerPhase: -45, splitDeg: 90, tryCorners: { 100e-9: 1591.5, 10e-9: 15915 } },
  },
  {
    group: 'Reading a response',
    name: 'The same filter, read backwards',
    terms: ['corner', 'db', 'phase', 'shapes'],
    note:
      'The same two components, with the output read across the resistor instead, and the low-pass becomes a ' +
    'high-pass. Nothing else changed, the same current flows through both components, so whatever one keeps, ' +
    'the other discards. Their squared magnitudes sum to exactly 1 at every frequency.',
    try: 'Flip between the two, at 1.59 kHz both read −3.01 dB, and their squares sum to 1.',
    chips: [
      { label: 'low-pass, across C', circuit: 'rcLow' },
      { label: 'high-pass, across R', circuit: 'rcHigh' },
    ],
    featured: [{ id: 'c', min: 1e-9, max: 10e-6 }],
    // The note is about |H| at the corner — the frequency pane — so the lower
    // pane opens on the step, not on poles the note never mentions.
    patch: { circuit: 'rcHigh', view: 'step' },
    claim: { complementary: true, tryCorner: 1591.5, tryDb: -3.01 },
  },
  {
    group: 'Reading a response',
    name: 'Different physics, same algebra',
    terms: ['tau', 'corner', 'impedance', 'tf', 'shapes'],
    note:
      'An inductor resists a change in current where a capacitor resists a change in voltage. Even so, this is ' +
    'the RC low-pass again with L/R in its place, and nothing downstream can tell them apart. Filters are ' +
    'therefore designed as transfer functions first, and built out of whatever is cheap second.',
    try: 'Drop L from 100 mH to 10 mH, the corner jumps from 1.59 kHz to 15.9 kHz, exactly as the RC did for ten ' +
    'times less C.',
    chips: [
      { label: 'L 10 mH', params: { l: 10e-3 } },
      { label: 'L 100 mH', params: { l: 100e-3 } },
    ],
    featured: [{ id: 'l', min: 1e-3, max: 1 }],
    patch: { circuit: 'rlLow', view: 'step' },
    claim: { sameAsRc: true, tryCorners: { 100e-3: 1591.5, 10e-3: 15915 } },
  },
  {
    group: 'Reading a response',
    name: 'The impulse response, and why the step is its integral',
    terms: ['impulse', 'convolution', 'tau'],
    note:
      'h(t) is the impulse response, what this circuit gives back to a single, infinitely narrow spike. It ' +
    'equals (1/τ)e^{−t/τ}, 10 000 at t = 0 here, falling by a factor of e every 100 µs. That curve is also ' +
    'the step response’s own slope at every instant, so integrating h(t) hands the step back exactly. A ' +
    'square wave is shifted steps added with alternating sign, and convolution is exactly that sum, weighted ' +
    'by h(t).',
    try: 'Drop R to 100 Ω. τ falls tenfold to 10.0 µs and h(0) rises tenfold to 100 000, and the derivative of ' +
    'the drawn step curve still lands on it exactly.',
    chips: [
      { label: 'R 100 Ω', params: { r: 100 } },
      { label: 'R 1 kΩ', params: { r: 1000 } },
    ],
    featured: [{ id: 'r', min: 100, max: 100000 }],
    patch: { circuit: 'rcLow', view: 'step' },
    claim: { h0: 10000, tauUs: 100, tryH0: 100000, tryTauUs: 10, derivMatchesH: true, squareIsShiftedSteps: true },
  },

  // ------------------------------------------------------------ Resonance
  {
    group: 'Resonance',
    name: 'One circuit, three filters',
    terms: ['tf', 'resonance', 's', 'shapes', 'overshoot', 'zeta', 'damping'],
    note:
      'Switch the output between C, R and L. Same components, same resonance, three completely different ' +
    'filters, low-pass, band-pass, high-pass, because they share a denominator and differ only in how many ' +
    'powers of s sit on top. Those three numerators add up to the denominator, so the three outputs sum to ' +
    'the input exactly.',
    try: 'Tap across R, it becomes a band-pass. Tap across L, a high-pass. All three share the one resonance at ' +
    '5.03 kHz.',
    chips: [
      { label: 'across C', output: 'c' },
      { label: 'across R', output: 'r' },
      { label: 'across L', output: 'l' },
    ],
    // The chips ARE the output control here; the select in the Schematic
    // section is the same state, a scroll below.
    featured: [],
    patch: { circuit: 'rlcSeries', output: 'c', view: 'step' },
    claim: { threeShapes: true, tryF0: 5033 },
  },
  {
    group: 'Resonance',
    name: 'Q is how sharp, and R sets it',
    terms: ['q', 'zeta', 'damping', 'resonance', 'overshoot'],
    note:
      'Drag R up from its 20 Ω. The resonant peak collapses, because at resonance the inductor ' +
      'and capacitor cancel exactly and only the resistor is left to limit the current. Double ' +
      'R and Q halves: Q = (1/R)√(L/C), and none of it depends on frequency.',
    try: 'Drag R from 20 Ω to 200 Ω, Q falls from 15.8 to 1.58, halving with each doubling.',
    chips: [
      { label: '20 Ω', params: { r: 20 } },
      { label: '100 Ω', params: { r: 100 } },
      { label: '200 Ω', params: { r: 200 } },
    ],
    featured: [{ id: 'r', min: 10, max: 1000 }],
    patch: { circuit: 'rlcSeries', params: p('rlcSeries', { r: 20 }), output: 'c', view: 'step' },
    claim: { qInverseInR: true, tryQ: { 20: 15.8, 100: 3.16, 200: 1.58 } },
  },
  {
    group: 'Resonance',
    name: 'The same R, the opposite effect',
    terms: ['tank', 'q', 'impedance', 'db', 'dbohm', 'resonance', 'zeta', 'damping'],
    note:
      'The same three components sit in parallel here. The impedance now peaks at resonance where the series ' +
    'circuit dipped, and R has swapped roles, so more resistance means a sharper peak. Q = R√(C/L), the ' +
    'reciprocal of the series case. There R sat in the current path, and here it is the leak across it.',
    try: 'Raise R from 10 kΩ to 100 kΩ, Q climbs tenfold, 31.6 to 316, and the peak reads exactly R: 80 dBΩ is 10 ' +
    'kΩ, 100 dBΩ is 100 kΩ.',
    chips: [
      { label: 'R 1 kΩ', params: { r: 1000 } },
      { label: 'R 10 kΩ', params: { r: 10000 } },
      { label: 'R 100 kΩ', params: { r: 100000 } },
    ],
    featured: [{ id: 'r', min: 1000, max: 1e6 }],
    // The note is about the impedance PEAK — the frequency pane — so the
    // lower pane opens on the step rather than on poles the note never names.
    patch: { circuit: 'rlcParallel', view: 'step' },
    claim: {
      qProportionalToR: true,
      peaksAtR: true,
      tryQ: { 10000: 31.6, 100000: 316 },
      tryDbOhm: { 10000: 80, 100000: 100 },
    },
  },
  {
    group: 'Resonance',
    name: 'Resonance, seen in time',
    terms: ['zeta', 'damping', 'q', 'resonance', 'overshoot', 'butterworth'],
    note:
      'The same circuit, hit with a step. A resonance that reads as a bump on the frequency ' +
      'plot reads as overshoot and ringing here, and ζ = 1/2Q connects them. Note where the ' +
      'overshoot stops: at Q = 0.5, not at the famous 0.707, which still overshoots 4.3%.',
    try: 'Set R to 447 Ω for ζ = 0.707, 4.3% overshoot remains. At 632.46 Ω (ζ = 1.000) it is gone. Back at 200 Ω ' +
    'it is 35%.',
    // 632.46 Ω is 2√(L/C) to five figures — ζ = 1.000007. A rounder 632 Ω
    // reads ζ = 0.999 beside a try line saying 1, and the pane called it
    // underdamped.
    chips: [
      { label: '200 Ω', params: { r: 200 } },
      { label: '447 Ω', params: { r: 447 } },
      { label: '632.46 Ω', params: { r: 632.46 } },
    ],
    featured: [{ id: 'r', min: 100, max: 1000 }],
    patch: { circuit: 'rlcSeries', params: p('rlcSeries', { r: 200 }), output: 'c', view: 'step' },
    claim: {
      overshootMatchesZeta: true,
      tryOvershoot: { 200: 0.35, 447: 0.043, 632.46: 0 },
      tryZeta: { 447: 0.707, 632.46: 1 },
    },
  },
  {
    group: 'Resonance',
    name: 'A zero on the axis is silence',
    terms: ['twint', 'zero', 'pole', 'jw', 'tf', 'phase', 'q', 'zeta', 'damping'],
    note:
      'The twin-T’s two tees deliver equal and opposite signals at one frequency, so the zeros of H(s) sit ON ' +
    'the imaginary axis. That frequency is removed, not attenuated. The notch has no bottom, the plot’s floor ' +
    'is the grid’s, not the notch’s, and the phase snaps 180° across it. Q is fixed at 1/4 by the topology.',
    try: 'Set R to 47 kΩ, the notch moves to 339 Hz, and Q still reads 0.250.',
    chips: [
      { label: 'R 10 kΩ', params: { r: 10000 } },
      { label: 'R 47 kΩ', params: { r: 47000 } },
    ],
    featured: [{ id: 'r', min: 1000, max: 100000 }],
    patch: { circuit: 'twinT', view: 'pz' },
    claim: { zeroOnAxis: true, qFixed: 0.25, tryNotch: { 47000: 339 } },
  },

  {
    group: 'Resonance',
    name: 'Real parts wobble',
    terms: ['tolerance', 'q', 'pole', 'jw', 'zeta', 'damping'],
    note:
      'No part in a drawer is exact. Here the series RLC is built 120 times from ±5% parts, and the poles view ' +
    'shows where they land. f₀ = 1/2π√LC wobbles ±4.3% and Q ±8.2%, twice as far. R enters Q at full strength ' +
    'and f₀ not at all. Q is the spec that costs money.',
    try: 'Switch every part to ±1%, f₀’s spread shrinks to ±0.85%, Q’s to ±1.7% (at ±5%: ±4.3% and ±8.2%).',
    chips: [
      { label: 'exact', tol: 0 },
      { label: '±1%', tol: 0.01 },
      { label: '±5%', tol: 0.05 },
    ],
    featured: ['tol'],
    // R = 560 (an E12 value, ζ ≈ 0.89): the 240 sampled poles then sweep
    // an arc some 0.3·ω₀ tall, an inch of scatter on a laptop. At the
    // default 100 Ω the same ±5% kept every dot inside the 16 px pole
    // marker — a wobble lesson with no visible wobble. (The pole view
    // auto-fits its axes, so parts are the only zoom; see NEEDS.md.)
    patch: { circuit: 'rlcSeries', params: p('rlcSeries', { r: 560 }), view: 'pz', tol: 0.05 },
    claim: {
      tolQHarderThanF0: true,
      builds: 120,
      trySpread: { 0.01: { f0: 0.85, q: 1.7 }, 0.05: { f0: 4.3, q: 8.2 } },
    },
  },
  {
    group: 'Resonance',
    name: 'Blame the right part',
    terms: ['tolerance', 'q', 'resonance', 'omega0', 'pole', 'jw', 'zeta', 'damping'],
    note:
      'Give R alone ±10% and f₀ does not move at all. f₀ = 1/(2π√LC) has no R in it, so not one of the 120 ' +
    'builds resonates anywhere else. The poles slide along a circle of constant radius ω₀ while Q takes the ' +
    'entire hit. A spec only inherits error from the parts in its own formula.',
    try: 'Move the ±10% from R to C, f₀ now wanders ±5.3% and the circle breaks. Back on R it is ±0.0%.',
    chips: [
      { label: 'R ±10%', tols: { r: 0.1 } },
      { label: 'C ±10%', tols: { c: 0.1 } },
      { label: 'L ±10%', tols: { l: 0.1 } },
    ],
    featured: ['tol:r', 'tol:c'],
    // R = 560 (an E12 value) sets ζ ≈ 0.89, so the ±10% builds span ζ 0.80
    // to 0.97 and the poles sweep a ~24° arc of the circle — long enough to
    // read as an arc past the pole marker. At the default 100 Ω the same
    // tolerance slides them ~2°, a smudge smaller than the marker; any
    // higher than ~570 Ω and the worst build goes overdamped, the pair
    // lands on the real axis, and the circle story stops being true.
    patch: {
      circuit: 'rlcSeries',
      params: p('rlcSeries', { r: 560 }),
      view: 'pz',
      tols: { r: 0.1 },
    },
    claim: { f0Immune: true, polesOnCircle: true, tryF0OnC: 5.3 },
  },
  // ------------------------------------------------------- Active circuits
  {
    group: 'Active circuits',
    name: 'Why active filters exist',
    terms: ['opamp', 'pole', 'jw', 'q', 'shapes', 'zeta', 'damping'],
    note:
      'A second-order low-pass with no inductor anywhere. Two RC sections alone can only give real poles, and a ' +
    'real pole cannot ring. The op-amp feeding the output back through C1 is what pushes the pole pair off ' +
    'the real axis. Q then comes from ratios of components rather than their absolute size, which a chip does ' +
    'well and a coil cannot.',
    try: 'Raise C1 from 22 nF to 100 nF, Q climbs from 0.74 to 1.58 with no resistor touched.',
    chips: [
      { label: 'C1 4.7 nF', params: { c1: 4.7e-9 } },
      { label: 'C1 22 nF', params: { c1: 22e-9 } },
      { label: 'C1 100 nF', params: { c1: 100e-9 } },
    ],
    featured: [{ id: 'c1', min: 1e-9, max: 1e-6 }],
    patch: { circuit: 'sallenKey', view: 'pz' },
    claim: { complexPair: true, noInductor: true, tryQ: { 22e-9: 0.74, 100e-9: 1.58 } },
  },
  {
    group: 'Active circuits',
    name: 'Gain is a ratio, and negative',
    terms: ['feedback', 'virtualearth', 'db', 'phase', 'corner', 'pole'],
    note:
      'Negative feedback holds the inverting input at zero without connecting it to anything, so all the input ' +
    'current must flow on through the feedback resistor. The gain is −Rf/Rin, a ratio, so it depends on how ' +
    'well two resistors match rather than on either being any particular value. The minus sign is a real 180° ' +
    'of phase at DC. The small Cf across Rf adds one pole, and above its corner gain and phase both fall.',
    try:
      'Set R feedback to 100 kΩ, the gain becomes −100 (40 dB) below the corner Cf puts at 1.59 kHz. The phase ' +
    'is 180° at DC and 135° at that corner.',
    chips: [
      { label: 'Rf 10 kΩ', params: { rf: 10000 } },
      { label: 'Rf 100 kΩ', params: { rf: 100000 } },
    ],
    featured: [{ id: 'rf', min: 1000, max: 1e6 }],
    patch: { circuit: 'inverting', view: 'step' },
    // The first cut said "the phase is still 180°" with the corner at
    // 1.59 kHz in the middle of the span: false on screen, 135° in the panel.
    claim: {
      negativeGain: true,
      tryGain: { 100000: -100 },
      tryDb: 40,
      tryCorner: { 100000: 1591.5 },
      tryCornerPhase: 135,
      tryDcPhase: 180,
    },
  },
  {
    group: 'Active circuits',
    name: 'A pole exactly at the origin',
    terms: ['pole', 'jw', 'lhp', 'feedback', 'tau', 'overshoot', 'rail'],
    note:
      'Replace the feedback resistor with a capacitor and the ratio becomes a division by s, which is ' +
    'integration. The pole sits on the boundary rather than inside it, so this is the one circuit here that ' +
    'never settles. A step in gives a ramp out, forever. A real integrator needs a large resistor across C to ' +
    'stop it drifting into its supply rail.',
    try: 'Set R to 100 kΩ, the ramp is ten times slower, and still never levels off.',
    chips: [
      { label: 'R 10 kΩ', params: { r: 10000 } },
      { label: 'R 100 kΩ', params: { r: 100000 } },
    ],
    featured: [{ id: 'r', min: 1000, max: 1e6 }],
    // Opens on the STEP: "ten times slower" is a ramp's slope, and the poles
    // view is identical at both R (one pole at the origin either way). The
    // app holds the step frame from these defaults while the lesson is
    // loaded, so the R = 100 kΩ ramp is drawn ten times shallower rather than
    // re-framed to the same pixels.
    patch: { circuit: 'integrator', view: 'step' },
    claim: { poleAtOrigin: true, neverSettles: true, trySlowerBy: 10 },
  },

  // ------------------------------------------------- One object, two names
  {
    group: 'One object, two names',
    name: 'This circuit is a biquad',
    terms: ['biquad', 'sampled', 'tf', 'corner', 'q', 'shapes', 'zeta', 'damping'],
    note:
      'This RLC is a low-pass biquad with a cutoff of 5.03 kHz and a Q of 3.16, not similar to one, the same ' +
    'one. Open in Signal Lab → loads the identical filter there with a square wave running through it. A ' +
    'circuit and a difference equation are one object described twice.',
    try: 'Tap Open in Signal Lab →, the same 5.03 kHz, Q 3.16 low-pass appears there, square wave through it.',
    chips: [],
    featured: ['handover'],
    patch: { circuit: 'rlcSeries', output: 'c', view: 'step' },
    claim: { handsOver: 'lowpass', trySource: 'square' },
  },
]

/** Apply a lesson to the app's state shape. */
export function applyLesson(lesson) {
  const circuit = lesson.patch.circuit
  return {
    id: circuit,
    params: lesson.patch.params || defaultsOf(circuit),
    output: lesson.patch.output || CIRCUITS[circuit].outputs[0].key,
    view: lesson.patch.view || 'step',
    // A tolerance spec: `tol` (a number) grades every part alike, `tols` (a
    // map) grades parts individually — the wobble lesson wants the first, the
    // blame lesson the second. tolsOf() normalises either.
    tols: lesson.patch.tols ?? lesson.patch.tol ?? 0,
  }
}

/**
 * A chip applied to a setup: the partial patch on top of `{ id, params,
 * output, tols }`, returning the same shape. Pure, so the function the app
 * calls is the one the tests measure.
 *
 * A `circuit` chip keeps the component values when the two circuits share
 * parameter keys (the RC pair does — that is the point of flipping between
 * them) and falls back to the defaults when they do not. `tol` grades every
 * part alike; `tols` REPLACES the per-part map, so "C ±10%" means C alone.
 */
export function applyChip(state, chip) {
  let id = state.id
  let params = state.params
  let output = state.output
  let tols = state.tols
  if (chip.circuit && chip.circuit !== id) {
    const keys = (c) => CIRCUITS[c].params.map((q) => q.key).join(',')
    params = keys(chip.circuit) === keys(id) ? params : defaultsOf(chip.circuit)
    id = chip.circuit
    output = CIRCUITS[id].outputs[0].key
    tols = tolsOf(id, tols)
  }
  if (chip.params) params = { ...params, ...chip.params }
  if (chip.output) output = chip.output
  if (chip.tol != null) tols = tolsOf(id, chip.tol)
  if (chip.tols) tols = tolsOf(id, chip.tols)
  return { id, params, output, tols }
}

/**
 * Does the setup on screen still match the lesson's — or a chip's — patch?
 * Values compare numerically (a chip's 20 and a typed 20 are the same 20);
 * tolerances compare per part after normalising.
 */
export function sameSetup(a, b) {
  if (a.id !== b.id || a.output !== b.output) return false
  for (const q of CIRCUITS[a.id].params) {
    const want = b.params[q.key]
    if (!(Math.abs(a.params[q.key] - want) <= 1e-12 * Math.max(1, Math.abs(want)))) return false
  }
  const ta = tolsOf(a.id, a.tols)
  const tb = tolsOf(b.id, b.tols)
  for (const q of CIRCUITS[a.id].params) if ((ta[q.key] || 0) !== (tb[q.key] || 0)) return false
  return true
}

/**
 * The setup a chip PROMISES: the lesson's own patch with the chip on top.
 * Chips never compound — "R 10 kΩ" then "C 10 nF" is the lesson at C = 10 nF,
 * not the lesson at R = 10 kΩ and C = 10 nF with a chip lit whose promised
 * 15.9 kHz corner sits at 1.59 kHz. The app applies this, and matchingChip
 * lights a chip only when the screen equals it.
 */
export function chipSetup(lesson, chip) {
  const s = applyLesson(lesson)
  return applyChip({ id: s.id, params: s.params, output: s.output, tols: s.tols }, chip)
}

/** Which of a lesson's chips the current setup equals, if any. */
export function matchingChip(lesson, state) {
  for (const chip of lesson.chips || []) {
    if (sameSetup(state, chipSetup(lesson, chip))) return chip.label
  }
  return null
}

/** A featured entry's field id, whether it was written as a string or a range. */
export function featuredId(f) {
  return typeof f === 'string' ? f : f.id
}
