// Group L's terms: the words feedback needs before it can be measured.
//
// Merged into the lab's one registry by terms.js. The house rules are that
// file's: two or three sentences, the first saying what the thing is, numbers
// over abstraction, and no term defined using an undefined term.

export const TERMS_L = {
  returnratio: {
    name: 'Return ratio, T',
    def:
      'What comes back to a controlled source after one trip round the loop. The source is driven by one unit of ' +
      'its own controlling signal, with every input set to zero. It is the number every other result in this ' +
      'group is written in. An amplifier of 10⁵ in a divider of one tenth has T = 10⁴.',
  },
  blackman: {
    name: 'Blackman’s form',
    def:
      'A way of writing a feedback circuit’s answer as A∞·T/(1 + T) + d. A∞ is the gain an infinite controlled ' +
      'source would give, and d is what gets through with that source dead. It needs no assumption about which ' +
      'topology the loop is. The three numbers describe series and shunt feedback alike.',
  },
  desensitivity: {
    name: 'Desensitivity',
    def:
      'The factor 1 + T, by which feedback divides every fractional change in the forward amplifier. Halve the ' +
      'open-loop gain and the closed-loop gain moves by half of one part in 1 + T. That is what makes a closed ' +
      'loop follow its resistors rather than its transistors.',
  },
  mixing: {
    name: 'Series mixing, shunt sampling',
    def:
      'How a loop meets the input and the output. Series mixing puts the fed-back signal in series with the input, ' +
      'which raises the resistance the source sees by 1 + T. Shunt sampling takes the fed-back signal across the ' +
      'output, which lowers the resistance a load sees by the same factor.',
  },
  phasemargin: {
    name: 'Phase margin',
    def:
      'How much phase a loop has left before its return ratio reaches −180° at the frequency where its magnitude ' +
      'passes one. At 90° the closed loop cannot ring. Below about 60° it rings, and at 0° the poles sit on the ' +
      'imaginary axis and the circuit oscillates.',
  },
  righthalfplane: {
    name: 'The right half plane',
    def:
      'The half of the s-plane where a pole’s real part is positive. A pole there makes a term that grows as e^{σt} ' +
      'rather than decaying, so any disturbance builds instead of settling. Raising a loop’s gain moves its closed-loop ' +
      'poles, and crossing the imaginary axis is the moment an amplifier becomes an oscillator.',
  },
}

/** Each term's pattern, tried in the order the prose is read. */
export const MATCH_L = {
  returnratio: /\breturn ratio\b/i,
  blackman: /\bBlackman’s form\b|\bBlackman\b/,
  desensitivity: /\bdesensiti\w+\b/i,
  mixing: /\bseries mixing\b|\bshunt sampling\b/i,
  phasemargin: /\bphase margin\b/i,
  righthalfplane: /\bright half plane\b/i,
}
