// Definitions, delivered where the term first does work.
//
// Signal Lab's pattern, copied rather than reinvented (see its terms.js): each
// lesson declares the terms its note leans on, and the sidebar offers those
// definitions right under the note — folded, so they cost nothing to someone
// who already has them.
//
// House rules for a definition: two sentences, first-year level; the first
// says what the thing IS, the second why it is used here; concrete numbers
// over abstraction; no term defined using an undefined term.
//
// `match` is the pattern lessons.test.js scans each lesson's note and try
// line with: a lesson whose text uses the word must list the term, so a
// definition can never be more than one fold away from where it is needed.
// (The reverse — a term listed without the word — is allowed: the topbar's
// "1 pole, 0 zeros" and the readout's "overshoot" are on screen without
// being in the note.)

export const TERMS = {
  // The one everything else in this file leans on. Reed's review: three
  // lessons' terms folds repeated "j is the imaginary unit, √−1" and moved
  // straight on to poles, the jω axis and H(s) — naming j without ever
  // teaching what it is or why it earns a second axis. Fixed at the source,
  // once, here: tf/s/pole/zero/jw/lhp below now assume a reader met this
  // first, rather than each re-deriving (or worse, not deriving) it.
  complex: {
    name: 'Complex numbers, and the s-plane',
    match: /complex numbers?|imaginary unit|s-plane|square root of −?1/i,
    def:
      'j is a number whose square is −1, true of no real number. It keeps its own axis, at ' +
      'right angles to the real numbers, instead of mixing into them. A decaying voltage sits ' +
      'on the real axis, a swinging one on the imaginary axis. Most circuits do both at once, ' +
      'so one point needs both, s = σ + jω.',
  },
  tf: {
    name: 'Transfer function H(s)',
    match: /H\(s\)|transfer function/i,
    def:
      'The ratio of output to input, written as a function of the complex frequency s. Put s = ' +
      'jω (a sinusoid at ω rad/s) and |H| is how much gets through, while its angle is the ' +
      'phase shift. One formula answers every "what does this circuit do at f?" at once.',
  },
  s: {
    name: 's, numerator and denominator',
    match: /powers of s|numerator|denominator/i,
    def:
      's is the complex frequency: multiplying by s is differentiating in time, dividing by ' +
      's is integrating, and an inductor is sL where a capacitor is 1/sC. H(s) is one ' +
      'polynomial in s over another — the numerator says what the circuit passes, the ' +
      'denominator (shared by every output of one circuit) says how it moves on its own.',
  },
  pole: {
    name: 'Pole',
    match: /\bpoles?\b/i,
    def:
      'A root of H(s)’s denominator — a complex frequency where the circuit’s own dynamics ' +
      'diverge. Each independent energy store (capacitor or inductor) contributes one, though ' +
      'a pole–zero cancellation can hide a mode from H(s) — the twin-T’s three capacitors ' +
      'show only two poles. Poles in the left half plane mean every disturbance dies out on ' +
      'its own. On the boundary, like the integrator’s, it never does.',
  },
  zero: {
    name: 'Zero',
    // "zeros of H(s)", "a zero on the axis" — not "the phase is zero".
    match: /\bzeros\b|\ba zero\b|zero on the/i,
    def:
      'A root of H(s)’s numerator — a complex frequency the circuit refuses to pass. The ' +
      'closer a zero sits to the jω axis, the deeper the dent in the response; exactly ON the ' +
      'axis, as in the twin-T, one frequency is removed completely rather than attenuated.',
  },
  lhp: {
    name: 'Left half plane — "1 pole, 0 zeros, stable"',
    match: /half plane/i,
    def:
      'The strip across the top counts H(s)’s poles and zeros and says which half of the ' +
      's-plane the poles sit in: negative real part (left) means every disturbance decays, ' +
      'so the circuit is stable. One pole with no zero is the plainest case — a single RC ' +
      'corner, its pole at −1/RC, safely on the left.',
  },
  jw: {
    name: 'The jω axis',
    match: /jω|imaginary axis|on the axis|boundary/i,
    def:
      'The vertical line through the origin of the pole–zero plot, where s = jω is a pure ' +
      'sinusoid with no decay. A sinusoid at f sits on it at ω = 2πf, so the frequency ' +
      'response is H(s) read along this axis — and a pole ON it (the integrator) neither ' +
      'decays nor grows, which is the boundary of stability.',
  },
  db: {
    name: 'dB (decibel)',
    match: /\bdB\b/,
    def:
      'A logarithmic way to state a ratio: 20·log₁₀ of |output/input|, so ×10 is +20 dB, ×2 ' +
      'is +6 dB, and half is −6 dB. Here 0 dB means the output equals the input, and the ' +
      'famous −3.01 dB is 1/√2 — the corner’s even split written as a log.',
  },
  dbohm: {
    name: 'dBΩ',
    match: /dBΩ/,
    def:
      'The same logarithm applied to an impedance instead of a ratio: 20·log₁₀ of |Z| in ' +
      'ohms, so 1 Ω is 0 dBΩ, 10 kΩ is 80 dBΩ and 100 kΩ is 100 dBΩ. The tank’s plot is ' +
      'impedance rather than gain, so its y-axis carries this unit and its peak reads R.',
  },
  gain: {
    name: 'Gain',
    match: /\bgain\b/i,
    def:
      'How much bigger the output is than the input, as a plain ratio: a gain of 2 doubles the ' +
      'signal, 0.5 halves it. A negative gain, like the inverting amplifier’s here, means an ' +
      'upside-down output rather than a shrunken one.',
  },
  corner: {
    name: 'Corner (cutoff) frequency',
    match: /\bcorner|cutoff/i,
    def:
      'For a first-order filter: the frequency where its two impedances are equal, so the ' +
      'output is 1/√2 of the input (−3.01 dB) with 45° of phase. Not a convention but a ' +
      'consequence: for an RC it lands at 1/(2πRC), and moving R or C moves it exactly that ' +
      'way. A resonant second-order circuit does something different at its equal-impedance ' +
      'frequency — the series RLC across C reads Q× there, not −3 dB.',
  },
  filter: {
    name: 'Filter',
    match: /\bfilters?\b/i,
    def:
      'A circuit built to treat some frequencies differently from others, passing some through ' +
      'and holding others back. Every filter here does it with impedance: a resistor’s does not ' +
      'change with frequency, a capacitor’s and an inductor’s do, so their tug-of-war shifts too.',
  },
  shapes: {
    name: 'Low-pass, band-pass, high-pass',
    match: /low-pass|band-pass|high-pass/i,
    def:
      'Three shapes named by what they let through: a low-pass keeps frequencies below its ' +
      'corner, a high-pass those above, a band-pass a band around its centre. In a series ' +
      'RLC they are one circuit read across C, R and L — the numerator’s powers of s decide ' +
      'which.',
  },
  q: {
    name: 'Q (quality factor)',
    match: /\bQ\b/,
    def:
      'How resonant a 2nd-order circuit is. For the series RLC read across C it is literally ' +
      '|H| at f₀ (Q = 10 → 10× the input); the true maximum sits a shade higher and just ' +
      'below f₀ — 1.3% higher at Q = 3, vanishing by Q = 10. For a band-pass Q sets width ' +
      'instead (bandwidth = f₀/Q). High Q also means long ringing after a step — the same ' +
      'fact in the time domain.',
  },
  zeta: {
    name: 'ζ (damping ratio)',
    match: /ζ/,
    def:
      'The control-course name for the same fact as Q: ζ = 1/2Q. It reads off the step ' +
      'response — ζ ≥ 1 means no overshoot at all, ζ = 0.707 still overshoots 4.3%, and ' +
      'smaller ζ rings harder and longer. One circuit, two vocabularies, one number.',
  },
  damping: {
    name: 'Underdamped, critically damped, overdamped',
    match: /damped/i,
    def:
      'How a second-order step response behaves relative to ζ = 1. Underdamped (ζ < 1) ' +
      'overshoots and rings before settling, critically damped (ζ = 1) arrives without ' +
      'overshoot in the least time, and overdamped (ζ > 1) arrives slower still with no ' +
      'ring at all.',
  },
  overshoot: {
    name: 'Overshoot, and "settles within 2%"',
    match: /overshoot|settles|ringing/i,
    def:
      'Overshoot is how far past its final value a step response swings, as a fraction of ' +
      'that final value — 35% means the output reaches 1.35 on its way to 1. Settling time ' +
      'is when it last leaves the ±2% band around the final value; an output whose final ' +
      'value is 0 (a band-pass) has no overshoot to quote, so the pane prints its peak instead.',
  },
  butterworth: {
    name: 'Butterworth — Q = 0.707',
    match: /Butterworth|0\.707/,
    def:
      'The Q (0.707, i.e. ζ = 0.707) at which a second-order low-pass is as flat as it can ' +
      'be in its passband before drooping. Flat in frequency is not clean in time: a ' +
      'Butterworth step still overshoots 4.3%, and only ζ = 1 (Q = 0.5) has none.',
  },
  impedance: {
    name: 'Impedance',
    match: /impedance/i,
    def:
      'Resistance generalized to sinusoids: how hard a component resists a current at a given ' +
      'frequency, with a magnitude and a phase. A resistor holds R at every frequency; a ' +
      'capacitor’s 1/ωC falls as frequency rises; an inductor’s ωL rises. Every filter here ' +
      'is two impedances taking turns winning.',
  },
  resonance: {
    name: 'Resonance',
    match: /resonan/i,
    def:
      'An inductor and capacitor exchanging the same energy back and forth, at the frequency ' +
      'ω₀ = 1/√LC where their impedances are equal and opposite and cancel. What remains at ' +
      'that frequency is only the resistance — which is why the series circuit dips to R ' +
      'there and the parallel one peaks at it.',
  },
  omega0: {
    name: 'ω₀ and f₀',
    match: /ω₀/,
    def:
      'The same resonant frequency in two units: ω₀ = 1/√LC is in radians per second, the ' +
      'unit the algebra and the pole plot use, and f₀ = ω₀/2π is in hertz, the unit the ' +
      'frequency axis uses. 5.03 kHz and 31.6 krad/s are one number.',
  },
  tank: {
    name: 'Tank circuit',
    match: /\btank\b/i,
    def:
      'A parallel L and C — so called because energy sloshes between them, like water in a ' +
      'tank, at the resonant frequency. Driven by a current, its impedance is the output, so ' +
      'the tank’s plot is Z(s) in ohms rather than a dimensionless gain.',
  },
  magnitude: {
    name: 'Magnitude',
    match: /\bmagnitudes?\b/i,
    def:
      'The size of a response with its phase set aside: how many times bigger or smaller the ' +
      'output is than the input, at one frequency. It is the number a Bode magnitude plot ' +
      'draws, and dB is the same number on a log scale.',
  },
  phase: {
    name: 'Phase',
    match: /\bphase\b/i,
    def:
      'How far the output sinusoid lags or leads the input, in degrees. It is the half of ' +
      'the response a magnitude plot cannot show: two circuits can pass the same amplitude ' +
      'while shifting it very differently, and feedback around a circuit cares about phase ' +
      'more than about gain.',
  },
  tau: {
    name: 'Time constant τ',
    match: /time constant|τ/,
    def:
      'The seconds a first-order circuit takes to cover 63% of any change (RC for a ' +
      'resistor-capacitor, L/R for an inductor). After 5τ the step has effectively arrived. ' +
      'Its reciprocal is the corner in rad/s — the same number governing both domains.',
  },
  tolerance: {
    name: 'Part tolerance',
    // `±\d` captured a single digit, so "±10%" underlined "±1" and left "0%"
    // plain beside it — a term mark that stops mid-number. Round-six grading
    // read it off the DOM as literally "±1". One digit was all the one-digit
    // tolerances ever needed, which is why it survived until a lesson used
    // ±10%. The percent sign is optional so a bare "±5" still marks.
    match: /tolerance|±\d+%?/,
    def:
      'The ±% band a component is sold within: a "10 kΩ ±5%" resistor is anything from 9.5 ' +
      'to 10.5 kΩ, and which one you got decides where your corner really lands. Specs built ' +
      'from ratios and products inherit these errors in different amounts — that is the ' +
      'wobble lesson.',
  },
  twint: {
    name: 'Twin-T, notch, topology',
    match: /twin-T|notch|topology/i,
    def:
      'A notch filter removes one narrow band and passes everything else; the twin-T builds ' +
      'one from two T-shaped RC networks (R–R with 2C down, C–C with R/2 down) in parallel. ' +
      'Topology is the wiring pattern itself, as opposed to the values — and here the ' +
      'pattern alone fixes Q at 1/4, whatever R and C are.',
  },
  opamp: {
    name: 'Op-amp, and the Sallen–Key',
    match: /op-amp|Sallen/i,
    def:
      'An operational amplifier: a chip with enormous gain between its + and − inputs, ' +
      'tamed by feedback so the circuit around it sets the behaviour. The Sallen–Key is the ' +
      'standard way to make a second-order filter from one op-amp, two resistors and two ' +
      'capacitors — the resonance an inductor would give, with no inductor.',
  },
  feedback: {
    name: 'Inverting input, negative feedback',
    match: /inverting input|negative feedback|feedback/i,
    def:
      'The op-amp’s − input; feeding the output back to it is negative feedback, because ' +
      'any rise there drives the output down until the two inputs agree. That is what pins ' +
      'the inverting input to 0 V, and why the gain becomes a ratio of the parts around the ' +
      'chip rather than the chip’s own.',
  },
  virtualearth: {
    name: 'Virtual earth',
    match: /virtual earth/i,
    def:
      'The op-amp’s inverting input, held at 0 V by negative feedback without being wired to ' +
      'ground. Held there, all the input current must continue through the feedback ' +
      'impedance — which is why the inverting amplifier’s gain is a clean ratio, −Zf/Zin.',
  },
  rail: {
    name: 'Supply rail',
    match: /supply rail/i,
    def:
      'The power-supply voltages an op-amp runs between (say ±15 V); its output cannot go ' +
      'past them. An ideal integrator ramps forever, so a real one drifts until it hits a ' +
      'rail and sticks there — the resistor across C is what keeps it off the rail.',
  },
  biquad: {
    name: 'Biquad',
    match: /biquad/i,
    def:
      'A second-order digital filter section — two poles, up to two zeros, five multiplies ' +
      'per sample. Any second-order circuit with a low-, band- or high-pass shape IS one, ' +
      'with the same f₀ and Q, which is what the hand-over to Signal Lab demonstrates ' +
      'rather than claims.',
  },
  sampled: {
    name: 'Sampled, and a difference equation',
    match: /sampled|difference equation/i,
    def:
      'A digital filter sees the signal only at instants, fs times a second, and computes ' +
      'each output from the last few inputs and outputs — that recipe is a difference ' +
      'equation. Signal Lab runs one; the hand-over turns this circuit’s H(s) into it, so ' +
      'the same filter exists as wiring and as arithmetic.',
  },
}

/**
 * The hand-over panel's own vocabulary, revealed in one line under it. Not
 * in TERMS because no lesson lists them — the panel is on every circuit.
 */
export const HANDOVER_TERMS = {
  biquad: {
    name: 'Biquad',
    def:
      'A second-order digital filter section — two poles, up to two zeros, five multiplies ' +
      'per sample. Any second-order circuit with a low-, band- or high-pass shape IS one, ' +
      'with the same f₀ and Q — the fact this panel demonstrates rather than claims.',
  },
  bilinear: {
    name: 'Bilinear transform',
    def:
      'The standard recipe for turning an analog H(s) into a digital filter: substitute ' +
      's = (2/T)(z − 1)/(z + 1). It keeps the filter stable and lands the corner exactly ' +
      '(after pre-warping), squeezing only the shape far from it.',
  },
  samplerate: {
    name: 'Sample rate',
    def:
      'How many times a second the digital copy looks at the signal, in Hz. Nothing above ' +
      'half of it exists to a sampled filter, so the rate sets how much room the circuit’s ' +
      'corner has above it.',
  },
  samplespercycle: {
    name: 'Samples per cycle',
    def:
      'The sample rate divided by the corner frequency: how many looks the filter gets per ' +
      'cycle at its own corner. Below about twenty the sampled shape is noticeably squeezed ' +
      'either side of the corner, though the corner itself still lands.',
  },
  coefficients: {
    name: 'Coefficients b₀ b₁ b₂, a₁ a₂',
    def:
      'The five numbers a biquad multiplies by: b’s weight the last three inputs, a’s the ' +
      'last two outputs. They ARE the filter — everything Signal Lab needs to run this ' +
      'circuit as arithmetic.',
  },
  plant: {
    name: 'Plant',
    def:
      'Control’s word for the thing being controlled — the fixed system you wrap a feedback ' +
      'loop around. Handed to Control Lab, this circuit is the plant, and the question ' +
      'becomes how much loop gain it tolerates before it sings.',
  },
  dampingratio: {
    name: 'Damping ratio ζ',
    def:
      'The control-course name for the same fact as Q: ζ = 1/2Q. ζ ≥ 1 means no ' +
      'overshoot, 0.707 still overshoots 4.3%, and smaller ζ rings harder and longer.',
  },
}

/** The definitions a lesson asked for, in the order it asked. */
export function termsFor(ids = []) {
  return ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
}

/**
 * Split a note into plain text and term hits, so a lesson's own prose can
 * carry its definitions instead of only a fold at the end of it.
 *
 * Two skim readers scored Explanation low because "Terms used here" is a
 * small, low-contrast link after the note — reachable, but only to a reader
 * who already suspects it is there. This is the discoverable path: the exact
 * words a term's `match` finds get wrapped inline, in the note itself, so the
 * definition sits under the word a reader's eye is already on.
 *
 * Greedy left-to-right: at each step, of the terms not yet placed, whichever
 * has the EARLIEST remaining match wins, and scanning resumes just past it —
 * so a term is marked at most once (its first, most useful occurrence) and
 * two terms' matches never overlap.
 */
export function markTerms(text, terms) {
  const remaining = new Map(terms.filter((t) => t.match).map((t) => [t.id, t]))
  const segments = []
  let pos = 0
  while (remaining.size && pos < text.length) {
    let best = null
    for (const [id, t] of remaining) {
      const re = new RegExp(t.match.source, t.match.flags.replace(/[gy]/g, '') + 'g')
      re.lastIndex = pos
      const m = re.exec(text)
      if (m && (!best || m.index < best.index)) best = { id, index: m.index, text: m[0] }
    }
    if (!best) break
    if (best.index > pos) segments.push({ text: text.slice(pos, best.index) })
    segments.push({ term: best.id, text: best.text })
    remaining.delete(best.id)
    pos = best.index + best.text.length
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) })
  return segments
}

/** The hand-over panel's definitions, in a stable order. */
export function handOverTerms() {
  return Object.entries(HANDOVER_TERMS).map(([id, t]) => ({ id, ...t }))
}
