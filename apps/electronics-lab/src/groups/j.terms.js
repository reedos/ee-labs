// Group J's definitions, merged into the lab's one registry by terms.js.
//
// House rules, as terms.js states them: two or three sentences, the first
// saying what the thing is, the rest why it matters here, concrete numbers
// over abstraction, and no term defined using an undefined term.
//
// A pattern must not fire in any experiment that comes before the one which
// introduces the term, because a reader who meets a word before its meaning
// has been failed. `glossary.test.js` measures that, so the patterns here are
// narrow on purpose: "differential pair", not "pair".

export const TERMS_J = {
  diffpair: {
    name: 'The differential pair',
    def:
      'Two matched transistors sharing one current source at their emitters, driven by the difference between ' +
      'their two bases. It is the input stage of every operational amplifier. The pair responds to that ' +
      'difference and largely ignores whatever the two inputs have in common.',
  },
  tailcurrent: {
    name: 'The tail current',
    def:
      'The fixed current the source under a differential pair takes from the two emitters together, 1.00 mA ' +
      'here. Whatever one transistor stops carrying the other picks up, so the two collector currents always ' +
      'add to it. That constraint is what makes the pair steer rather than amplify each side alone.',
  },
  halfcircuit: {
    name: 'The half-circuit',
    def:
      'One side of a differential pair, analysed alone, with its emitter treated as signal ground. A balanced ' +
      'drive moves one base up by as much as it moves the other down, so the emitters they share do not move ' +
      'at all. Each side is then an ordinary common-emitter stage at half the tail current.',
  },
  tailresistance: {
    name: 'Tail resistance, R_EE',
    def:
      'The output resistance of the source that sets the tail current, drawn here as a resistor beside it. An ' +
      'ideal source would have none. A real one is a transistor, and its r_o is what appears here, 100 kΩ at ' +
      'this current. It is the only thing that lets a signal common to both inputs through.',
  },
  inputoffset: {
    name: 'Input-referred offset',
    def:
      'The input voltage that brings an unbalanced output back to zero. It is quoted at the input rather than ' +
      'at the output, so that it does not depend on the gain. A 1 % mismatch between the two collector ' +
      'resistors reads as 257.2 µV here, and every data sheet quotes a number of this kind.',
  },
}

/** Each term's pattern, narrow enough not to fire before its own experiment. */
export const MATCH_J = {
  diffpair: /\bdifferential pair\b/i,
  tailcurrent: /\btail current\b/i,
  halfcircuit: /\bhalf-circuit\b/i,
  tailresistance: /\btail resistance\b|\bR_EE\b/,
  inputoffset: /\binput-referred\b/i,
}
