// Definitions, delivered where the term first does work.
//
// Signal Lab's pattern, copied rather than reinvented (see its terms.js): each
// lesson declares the terms its note leans on, and the sidebar offers those
// definitions right under the note — folded, so they cost nothing to someone
// who already has them.
//
// House rules for a definition: two or three sentences; the first says what
// the thing IS, the rest why it is used here; concrete numbers over
// abstraction; no term defined using an undefined term.

export const TERMS = {
  tf: {
    name: 'Transfer function H(s)',
    def:
      'The ratio of output to input, written as a function of the complex frequency s. Put ' +
      's = jω (a sinusoid at ω rad/s) and |H| is how much gets through while its angle is the ' +
      'phase shift — one formula that answers every "what does this circuit do at f?" at once.',
  },
  pole: {
    name: 'Pole',
    def:
      'A root of H(s)’s denominator — a complex frequency where the circuit’s own dynamics ' +
      'diverge. Each independent energy store (capacitor or inductor) contributes one, though ' +
      'a pole–zero cancellation can hide a mode from H(s) — the twin-T’s three capacitors ' +
      'show only two poles. Poles in the left half plane mean every disturbance dies out on ' +
      'its own. On the boundary, like the integrator’s, it never does.',
  },
  zero: {
    name: 'Zero',
    def:
      'A root of H(s)’s numerator — a complex frequency the circuit refuses to pass. The ' +
      'closer a zero sits to the jω axis, the deeper the dent in the response; exactly ON the ' +
      'axis, as in the twin-T, one frequency is removed completely rather than attenuated.',
  },
  db: {
    name: 'dB (decibel)',
    def:
      'A logarithmic way to state a ratio: 20·log₁₀ of |output/input|, so ×10 is +20 dB, ×2 ' +
      'is +6 dB, and half is −6 dB. Here 0 dB means the output equals the input, and the ' +
      'famous −3.01 dB is 1/√2 — the corner’s even split written as a log.',
  },
  corner: {
    name: 'Corner (cutoff) frequency',
    def:
      'For a first-order filter: the frequency where its two impedances are equal, so the ' +
      'output is 1/√2 of the input (−3.01 dB) with 45° of phase. Not a convention but a ' +
      'consequence: for an RC it lands at 1/(2πRC), and moving R or C moves it exactly that ' +
      'way. A resonant second-order circuit does something different at its equal-impedance ' +
      'frequency — the series RLC across C reads Q× there, not −3 dB.',
  },
  q: {
    name: 'Q (quality factor)',
    def:
      'How resonant a 2nd-order circuit is. For the series RLC read across C it is literally ' +
      '|H| at f₀ (Q = 10 → 10× the input); the true maximum sits a shade higher and just ' +
      'below f₀ — 1.3% higher at Q = 3, vanishing by Q = 10. For a band-pass Q sets width ' +
      'instead (bandwidth = f₀/Q). High Q also means long ringing after a step — the same ' +
      'fact in the time domain.',
  },
  zeta: {
    name: 'ζ (damping ratio)',
    def:
      'The control-course name for the same fact as Q: ζ = 1/2Q. It reads off the step ' +
      'response — ζ ≥ 1 means no overshoot at all, ζ = 0.707 still overshoots 4.3%, and ' +
      'smaller ζ rings harder and longer. One circuit, two vocabularies, one number.',
  },
  impedance: {
    name: 'Impedance',
    def:
      'Resistance generalized to sinusoids: how hard a component resists a current at a given ' +
      'frequency, with a magnitude and a phase. A resistor holds R at every frequency; a ' +
      'capacitor’s 1/ωC falls as frequency rises; an inductor’s ωL rises. Every filter here ' +
      'is two impedances taking turns winning.',
  },
  resonance: {
    name: 'Resonance',
    def:
      'An inductor and capacitor exchanging the same energy back and forth, at the frequency ' +
      'ω₀ = 1/√LC where their impedances are equal and opposite and cancel. What remains at ' +
      'that frequency is only the resistance — which is why the series circuit dips to R ' +
      'there and the parallel one peaks at it.',
  },
  phase: {
    name: 'Phase',
    def:
      'How far the output sinusoid lags or leads the input, in degrees. It is the half of ' +
      'the response a magnitude plot cannot show: two circuits can pass the same amplitude ' +
      'while shifting it very differently, and feedback around a circuit cares about phase ' +
      'more than about gain.',
  },
  tau: {
    name: 'Time constant τ',
    def:
      'The seconds a first-order circuit takes to cover 63% of any change (RC for a ' +
      'resistor-capacitor, L/R for an inductor). After 5τ the step has effectively arrived. ' +
      'Its reciprocal is the corner in rad/s — the same number governing both domains.',
  },
  tolerance: {
    name: 'Part tolerance',
    def:
      'The ±% band a component is sold within: a "10 kΩ ±5%" resistor is anything from 9.5 ' +
      'to 10.5 kΩ, and which one you got decides where your corner really lands. Specs built ' +
      'from ratios and products inherit these errors in different amounts — that is the ' +
      'wobble lesson.',
  },
  biquad: {
    name: 'Biquad',
    def:
      'A second-order digital filter section — two poles, up to two zeros, five multiplies ' +
      'per sample. Any second-order circuit with a low-, band- or high-pass shape IS one, ' +
      'with the same f₀ and Q, which is what the hand-over to Signal Lab demonstrates ' +
      'rather than claims.',
  },
  virtualearth: {
    name: 'Virtual earth',
    def:
      'The op-amp’s inverting input, held at 0 V by negative feedback without being wired to ' +
      'ground. Held there, all the input current must continue through the feedback ' +
      'impedance — which is why the inverting amplifier’s gain is a clean ratio, −Zf/Zin.',
  },
}

/** The definitions a lesson asked for, in the order it asked. */
export function termsFor(ids = []) {
  return ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
}
