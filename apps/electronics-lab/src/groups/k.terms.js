// Group K's definitions, merged into the lab's one registry by terms.js.
//
// The patterns are narrow so that none of them fires before the experiment
// that introduces the word: "Miller effect" belongs to K3, "cascode" to K6,
// and glossary.test.js fails on either appearing earlier.

export const TERMS_K = {
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
}

/** Each term's pattern, narrow enough not to fire before its own experiment. */
export const MATCH_K = {
  bypass: /\bbypass capacitor\b/i,
  miller: /\bMiller effect\b|\bMiller\b/,
  octc: /\bopen-circuit time constant/i,
}
