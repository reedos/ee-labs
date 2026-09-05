// Group I's definitions, delivered where each word first does work.

export const TERMS_I = {
  mirror: {
    name: 'The current mirror',
    def:
      'Two transistors of the same kind sharing one base-emitter voltage, one of them wired as a diode so ' +
      'that a reference current sets that voltage. The other then carries the same current. It is how a ' +
      'chip makes a current source, because it needs no large resistor and no accurate supply.',
  },
  matching: {
    name: 'Matching',
    def:
      'Two devices made side by side on one piece of silicon behave almost identically, far more closely ' +
      'than two parts out of a drawer. A mirror trades an absolute accuracy nothing on a chip has for a ' +
      'ratio accuracy the process gives away. Every current source and every differential stage rests on ' +
      'it.',
  },
  widlar: {
    name: 'The Widlar source',
    def:
      'A mirror with one resistor under the copying emitter, so the two base-emitter voltages differ by the ' +
      'drop across it. Because current depends on that voltage exponentially, a hundred millivolts of drop ' +
      'buys a ratio near a hundred. It makes a microamp without the megohm a plain resistor would need.',
  },
  activeload: {
    name: 'The active load',
    def:
      'A current source used where a resistor would otherwise sit. Its small-signal resistance is r_o, tens ' +
      'or hundreds of kilohms, while its DC drop is only what is left over from the supply. A resistor that ' +
      'large would need far more voltage than the circuit has.',
  },
  intrinsicgain: {
    name: 'Intrinsic gain',
    def:
      'The largest voltage gain one transistor can give, g_m r_o, reached when nothing but its own output ' +
      'resistance loads it. For a bipolar device it works out as V_A over V_T and comes to a few thousand. ' +
      'It depends on the device and not on any value a designer chooses.',
  },
  cascode: {
    name: 'The cascode',
    def:
      'A common base standing on a common emitter, the two carrying the same current. The lower device sets ' +
      'the current and the upper one presents the output, so the pair’s output resistance is about β times ' +
      'one transistor’s. The lower collector barely moves, which is what keeps the pair fast.',
  },
  cascade: {
    name: 'Cascade, and loading',
    def:
      'Two stages in a row, the first driving the second. Their gains do not simply multiply. The first ' +
      'stage’s output resistance and the second stage’s input resistance form a divider between them, and ' +
      'that divider is counted once. A follower between them makes it almost disappear.',
  },
}

/** Each term's pattern, tried in the order the prose is read. */
export const MATCH_I = {
  mirror: /\bcurrent mirror\b|\bmirrors?\b/i,
  matching: /\bmatched\b|\bmatching\b/i,
  widlar: /\bWidlar\b/i,
  activeload: /\bactive load\b/i,
  intrinsicgain: /\bintrinsic gain\b/i,
  cascode: /\bcascode\b/i,
  cascade: /\bcascade\b/i,
}
