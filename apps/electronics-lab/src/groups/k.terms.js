// Group K's definitions, merged into the lab's one registry by terms.js.
//
// The patterns are narrow so that none of them fires before the experiment
// that introduces the word: "Miller effect" belongs to K3, "cascode" to K6,
// and glossary.test.js fails on either appearing earlier.

export const TERMS_K = {
  currentgain: {
    name: 'Short-circuit current gain',
    def:
      'The collector current a transistor delivers per unit of base current, with the collector held at a ' +
      'fixed voltage so that no signal appears across it. At low frequency it is β. It falls at 20 dB per ' +
      'decade above the base circuit’s own corner, and the frequency where it reaches one is f_T.',
  },
  coupling: {
    name: 'The coupling capacitor',
    def:
      'A capacitor in series with a signal path, there to pass the signal and block the bias. It makes a ' +
      'high-pass corner with the resistance on either side of it, 5.203 Hz at 10.0 µF here. Below that corner ' +
      'the amplifier stops, which is the price of separating the signal from the operating point.',
  },
  bypass: {
    name: 'The bypass capacitor',
    def:
      'A capacitor across an emitter resistor. It holds the emitter at signal ground while the resistor goes ' +
      'on setting the bias current. It sees the smallest resistance in the circuit, 33.87 Ω here, so it sets ' +
      'the highest of the low corners. That is usually where the amplifier stops at the bottom.',
  },
  miller: {
    name: 'The Miller effect',
    def:
      'A capacitance bridging the input and output of an inverting stage draws the current of a much larger ' +
      'one. Both of its plates move, and in opposite directions. The factor is 1 + g_m R_L, which is 185.6 ' +
      'here. Two picofarads across the device look like 371 pF at its base.',
  },
  octc: {
    name: 'Open-circuit time constants',
    def:
      'A hand method for the high corner. Take each capacitance in turn, open every other one, measure the ' +
      'resistance across it, and add the products. That sum is exactly the s coefficient of the denominator ' +
      'polynomial, and 1/(2π) over it estimates the corner from below.',
  },
  follower: {
    name: 'The emitter follower',
    def:
      'A stage whose output is its emitter and whose collector is on the supply. Its gain is a little under ' +
      'one, so the voltage across the collector capacitance barely changes, and the input capacitance stays ' +
      'near the device’s own. It buys bandwidth and current gain rather than voltage gain.',
  },
  cascode: {
    name: 'The cascode',
    def:
      'A common-base stage standing on a common-emitter stage, sharing one current. The lower device sees ' +
      'only 26.10 Ω at its collector, so the gain across its collector capacitance is about one and the ' +
      'input capacitance stays small. The upper device carries the current on to the load at full gain.',
  },
}

/** Each term's pattern, narrow enough not to fire before its own experiment. */
export const MATCH_K = {
  currentgain: /\bshort-circuit current gain\b/i,
  coupling: /\bcoupling capacitor\b/i,
  bypass: /\bbypass capacitor\b/i,
  miller: /\bMiller effect\b|\bMiller\b/,
  octc: /\bopen-circuit time constant/i,
  follower: /\bemitter follower\b/i,
  cascode: /\bcascode\b/i,
}
