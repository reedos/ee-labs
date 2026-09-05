// Group H's definitions, delivered where each word first does work.
//
// The house rules of terms.js: two or three sentences, the first saying what
// the thing is and the rest why it matters here, concrete numbers over
// abstraction, and no term defined using an undefined one.

export const TERMS_H = {
  commonemitter: {
    name: 'The common emitter',
    def:
      'The stage with the signal at the base, the output at the collector, and the emitter held. It is the ' +
      'only one of the three that gives both voltage gain and current gain, so it is where a chain of ' +
      'amplification starts. Its output is upside down, because more collector current means less collector ' +
      'voltage.',
  },
  inputresistance: {
    name: 'Input resistance, R_in',
    def:
      'What a source driving the stage has to work into. It is measured by putting a test source at the input ' +
      'and taking the ratio of its voltage to its current. It matters because the source has resistance of ' +
      'its own, and the two divide the signal before anything is amplified.',
  },
  outputresistance: {
    name: 'Output resistance, R_out',
    def:
      'What a load hanging on the output sees looking back in, measured by killing every source and putting ' +
      'a test source at the output. A stage with 5 kΩ of it loses half its signal into a 5 kΩ load. It is ' +
      'the other half of the divider that costs a cascade its gain.',
  },
  degeneration: {
    name: 'Emitter degeneration',
    def:
      'A resistor left in the emitter rather than bypassed, so that the emitter follows the base and takes ' +
      'part of the input back. Everything about the stage moves by the factor 1 + g_m R_E. The gain falls by ' +
      'it, the input resistance rises by it, and the curvature of the exponential is divided by it twice ' +
      'over.',
  },
  distortion: {
    name: 'Second-harmonic distortion, HD2',
    def:
      'The size of the output’s second harmonic against its fundamental, as a per cent. It is what the ' +
      'curvature of the exponential does to a sine. A bipolar stage driven at 5 mV of peak shows about 4 %, ' +
      'and the figure falls in proportion as the drive falls.',
  },
  follower: {
    name: 'The emitter follower',
    def:
      'The stage with the signal at the base, the output at the emitter, and the collector held. Its voltage ' +
      'gain is a little under one and can never exceed one. What it is for is the resistance change. The load ' +
      'looks β + 1 times larger from the base, and the source looks β + 1 times smaller from the emitter.',
  },
  commonbase: {
    name: 'The common base',
    def:
      'The stage with the signal at the emitter, the output at the collector, and the base held. Its voltage ' +
      'gain is the same g_m R_C the common emitter has, without the inversion, but its input resistance is ' +
      'only 1/g_m. Almost nothing can drive it alone, and it is used stacked on another stage.',
  },
  commonsource: {
    name: 'The common source',
    def:
      'The MOSFET stage with the signal at the gate, the output at the drain, and the source held. It is the ' +
      'common emitter with a different device in it. The gate draws no current, so its input resistance is ' +
      'infinite, and its slope at a given current is several times smaller than a bipolar’s.',
  },
  commongate: {
    name: 'The common gate',
    def:
      'The MOSFET stage with the signal at the source, the output at the drain, and the gate held. Its input ' +
      'resistance is 1/g_m, the same port a source follower delivers its output from. Whether that port is ' +
      'driven or loaded is what decides which of the two names it goes by.',
  },
  loadline: {
    name: 'The load line',
    def:
      'The collector resistor’s own law drawn on the transistor’s plane, a straight line from the supply ' +
      'voltage at no current to V_CC/R_C at no volts. Every operating point the circuit can have lies on it. ' +
      'A signal slides the point along the line, and the line’s two ends are where the output flattens.',
  },
  quiescent: {
    name: 'The quiescent point',
    def:
      'Where the circuit sits with no signal applied, given as a current and a voltage such as 1 mA and 5 V. ' +
      'Every small-signal number in this lab is a slope taken there. It also sets how far the output can ' +
      'move each way before it meets one end of the load line.',
  },
}

/** Each term's pattern, tried in the order the prose is read. */
export const MATCH_H = {
  commonemitter: /\bcommon emitter\b/i,
  inputresistance: /\binput resistance\b/i,
  outputresistance: /\boutput resistance\b/i,
  degeneration: /\bdegeneration\b/i,
  distortion: /\bdistortion\b/i,
  follower: /\bfollower\b/i,
  commonbase: /\bcommon base\b/i,
  commonsource: /\bcommon source\b/i,
  commongate: /\bcommon gate\b/i,
  loadline: /\bload line\b/i,
  quiescent: /\bquiescent\b/i,
}
