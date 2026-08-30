import { defaultsOf } from './circuits.js'

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

const p = (id, over = {}) => ({ ...defaultsOf(id), ...over })

export const LESSON_GROUPS = ['Reading a response', 'Resonance', 'Active circuits', 'One object, two names']

export const LESSONS = [
  // ------------------------------------------------- Reading a response
  {
    group: 'Reading a response',
    name: 'A divider has no dynamics',
    note:
      'Two resistors. The response is a flat line and the phase is zero, at every frequency, ' +
      'because resistors store no energy and so nothing can depend on how fast the signal ' +
      'changes. Every other circuit here is this one with a frequency-dependent impedance in ' +
      'place of a resistor.',
    patch: { circuit: 'divider', view: 'step' },
    claim: { flat: true, gain: 0.5 },
  },
  {
    group: 'Reading a response',
    name: 'Where the corner comes from',
    note:
      'The cutoff is not a convention: it is the frequency where the capacitor’s impedance ' +
      'equals the resistor’s. There the two split the input evenly in magnitude but 45° apart ' +
      'in phase, which is why the output is 1/√2 of the input and −3.01 dB rather than −6. ' +
      'Change R or C and watch the corner move as 1/(2πRC).',
    patch: { circuit: 'rcLow', view: 'step' },
    claim: { cornerDb: -3.0103, cornerPhase: -45 },
  },
  {
    group: 'Reading a response',
    name: 'The same filter, read backwards',
    note:
      'Move the probe to the resistor and the low-pass becomes a high-pass. Nothing else ' +
      'changed — the same current flows through both components — so whatever one keeps, the ' +
      'other discards. Their squared magnitudes sum to exactly 1 at every frequency.',
    patch: { circuit: 'rcHigh', view: 'pz' },
    claim: { complementary: true },
  },
  {
    group: 'Reading a response',
    name: 'Different physics, same algebra',
    note:
      'An inductor resists a change in current where a capacitor resists a change in voltage, ' +
      'and yet this is the RC low-pass again with L/R in its place. Nothing downstream can tell ' +
      'them apart, which is why filters are designed as transfer functions first and built out ' +
      'of whatever is cheap second.',
    patch: { circuit: 'rlLow', view: 'step' },
    claim: { sameAsRc: true },
  },

  // ------------------------------------------------------------ Resonance
  {
    group: 'Resonance',
    name: 'One circuit, three filters',
    note:
      'Switch the output between C, R and L. Same components, same resonance, three completely ' +
      'different filters — low-pass, band-pass, high-pass — because they share a denominator ' +
      'and differ only in how many powers of s sit on top. Those three numerators add up to the ' +
      'denominator, so the three outputs sum to the input exactly.',
    patch: { circuit: 'rlcSeries', output: 'c', view: 'step' },
    claim: { threeShapes: true },
  },
  {
    group: 'Resonance',
    name: 'Q is how sharp, and R sets it',
    note:
      'Drag R from 10 Ω upward. The resonant peak collapses, because at resonance the inductor ' +
      'and capacitor cancel exactly and only the resistor is left to limit the current. Double ' +
      'R and Q halves: Q = (1/R)√(L/C), and none of it depends on frequency.',
    patch: { circuit: 'rlcSeries', params: p('rlcSeries', { r: 20 }), output: 'c', view: 'step' },
    claim: { qInverseInR: true },
  },
  {
    group: 'Resonance',
    name: 'The same R, the opposite effect',
    note:
      'The same three components in parallel. Now the impedance PEAKS at resonance where the ' +
      'series circuit dipped, and R has swapped roles: more resistance means a sharper peak, ' +
      'not a blunter one. Q = R√(C/L) — the reciprocal of the series case, because in one R is ' +
      'in the current path and in the other it is the leak across it.',
    patch: { circuit: 'rlcParallel', view: 'pz' },
    claim: { qProportionalToR: true, peaksAtR: true },
  },
  {
    group: 'Resonance',
    name: 'Resonance, seen in time',
    note:
      'The same circuit, hit with a step. A resonance that reads as a bump on the frequency ' +
      'plot reads as overshoot and ringing here, and ζ = 1/2Q connects them. Note where the ' +
      'overshoot stops: at Q = 0.5, not at the famous 0.707, which still overshoots 4.3%.',
    patch: { circuit: 'rlcSeries', params: p('rlcSeries', { r: 200 }), output: 'c', view: 'step' },
    claim: { overshootMatchesZeta: true },
  },

  // ------------------------------------------------------- Active circuits
  {
    group: 'Active circuits',
    name: 'Why active filters exist',
    note:
      'A second-order low-pass with no inductor anywhere. Two RC sections alone can only ever ' +
      'give real poles, and a real pole cannot ring; the op-amp feeding the output back through ' +
      'C1 is what pushes the pole pair off the real axis. And Q comes from ratios of components ' +
      'rather than their absolute size — which is what a chip can do well and a coil cannot.',
    patch: { circuit: 'sallenKey', view: 'pz' },
    claim: { complexPair: true, noInductor: true },
  },
  {
    group: 'Active circuits',
    name: 'Gain is a ratio, and negative',
    note:
      'Negative feedback holds the inverting input at zero without connecting it to anything, ' +
      'so all the input current must flow on through the feedback resistor. The gain is −Rf/Rin: ' +
      'a ratio, which is why it depends on how well two resistors match rather than on either ' +
      'being any particular value. The minus sign is a real 180° of phase.',
    patch: { circuit: 'inverting', view: 'step' },
    claim: { negativeGain: true },
  },
  {
    group: 'Active circuits',
    name: 'A pole exactly at the origin',
    note:
      'Replace the feedback resistor with a capacitor and the ratio becomes a division by s — ' +
      'which is integration. The pole sits on the boundary rather than inside it, so this is ' +
      'the one circuit here that never settles: a step in gives a ramp out, forever. A real ' +
      'integrator needs a large resistor across C to stop it drifting into its supply rail.',
    patch: { circuit: 'integrator', view: 'pz' },
    claim: { poleAtOrigin: true, neverSettles: true },
  },

  // ------------------------------------------------- One object, two names
  {
    group: 'One object, two names',
    name: 'This circuit is a biquad',
    note:
      'Open "The same filter, sampled" below. This RLC is a low-pass biquad with a cutoff of ' +
      '5.03 kHz and a Q of 3.16 — not similar to one, the same one. Copy the link, paste it ' +
      'after Signal Lab’s URL, and the identical filter is loaded there with noise running ' +
      'through it. A circuit and a difference equation are one object described twice.',
    patch: { circuit: 'rlcSeries', output: 'c', view: 'step' },
    claim: { handsOver: 'lowpass' },
  },
]

/** Apply a lesson to the app's state shape. */
export function applyLesson(lesson) {
  const circuit = lesson.patch.circuit
  return {
    id: circuit,
    params: lesson.patch.params || defaultsOf(circuit),
    output: lesson.patch.output || null,
    view: lesson.patch.view || 'step',
  }
}
