// Group N's terms, merged into the lab's one registry by terms.js.
//
// The house rules are that file's: two or three sentences, the first saying
// what the thing is, concrete numbers over abstraction, and no term defined
// with a term the reader has not met.

export const TERMS_N = {
  oscillator: {
    name: 'Oscillator',
    def:
      'A circuit whose own poles sit in the right half of the s-plane. It has no steady answer to settle to, so ' +
      'its output grows on its own from whatever charge is already on it. Every other circuit in this lab ' +
      'settles. This one is built so that it does not.',
  },
  barkhausen: {
    name: 'Barkhausen’s condition',
    def:
      'The gain around one trip of the loop is one, and the phase around it is zero. At that frequency a signal ' +
      'comes back to where it started unchanged, which is what a steady oscillation is. The Wien network passes a ' +
      'third of the output with no phase shift, so the amplifier has to supply a gain of three.',
  },
  threshold: {
    name: 'The oscillation threshold',
    def:
      'The gain at which the pole pair crosses the jω axis. Below it a disturbance decays, above it a disturbance ' +
      'grows, and the crossing itself is the boundary between the two. It is a property of the loop, not of the ' +
      'amplitude, and every number in this group is measured against it.',
  },
  limitcycle: {
    name: 'Limit cycle',
    def:
      'The steady waveform a growing oscillation settles into once something stops it growing. Its amplitude is ' +
      'set by whatever the nonlinearity is, a rail or a limiter, and not by the poles. The poles decide only how ' +
      'fast it gets there.',
  },
  thd: {
    name: 'Total harmonic distortion',
    def:
      'The root of the summed power in every harmonic above the first, divided by the first. A pure sine reads ' +
      'zero. A square wave reads 43.8 %, because its harmonics fall only as one over the harmonic number. It is ' +
      'quoted here over the first twelve harmonics, which is where the energy is.',
  },
  relaxation: {
    name: 'Relaxation oscillator',
    def:
      'An oscillator with no resonant network in it. A capacitor charges toward one level, a comparator flips ' +
      'when it reaches a threshold, and the capacitor then charges toward the other. Its period comes from a ' +
      'time constant and two thresholds rather than from a resonance.',
  },
  hysteresis: {
    name: 'Hysteresis',
    def:
      'The gap between the level at which a comparator switches one way and the level at which it switches back. ' +
      'Positive feedback makes it, and here it is ±6.00 V out of ±12 V rails. Without it the comparator would ' +
      'chatter at every crossing instead of holding its state.',
  },
  tank: {
    name: 'The LC tank',
    def:
      'An inductor and a capacitor across each other. Energy moves between the two twice per cycle and the ' +
      'exchange happens at one frequency, 1/(2π√(LC)). A resistance across the tank drains that energy, and an ' +
      'oscillator built on a tank is an amplifier that puts it back.',
  },
  colpitts: {
    name: 'The Colpitts arrangement',
    def:
      'A tank whose capacitance is two capacitors in series, with the amplifier reading the tap between them. ' +
      'The divider sets the fraction of the tank voltage that comes back, C₁/(C₁ + C₂). One network therefore ' +
      'sets both the frequency and the feedback, which is why the arrangement has a name.',
  },
}

/** Each term's pattern, tried in the order the prose is read. */
export const MATCH_N = {
  oscillator: /\boscillator\b|\boscillates\b/i,
  barkhausen: /\bBarkhausen\b/i,
  threshold: /\bthreshold\b/i,
  limitcycle: /\blimit cycle\b|\bsteady amplitude\b/i,
  thd: /\bdistortion\b/i,
  relaxation: /\brelaxation\b/i,
  hysteresis: /\bhysteresis\b/i,
  tank: /\btank\b/i,
  colpitts: /\bColpitts\b/i,
}
