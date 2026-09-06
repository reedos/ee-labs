// The terms Group E, the arithmetic a processor has, needs.

export const TERMS = {
  wordlength: {
    name: 'Word length',
    short: 'word length',
    def:
      'How many bits a stored number has, split between the ones above the binary point and the ' +
      'ones below it. Twelve bits with two above give a step of 2^-9, which is 1.95e-3, and a ' +
      'range from -4 to 4 minus one step. Every number the processor holds is a multiple of that step.',
  },
  quantiser: {
    name: 'Quantiser',
    short: 'quantiser',
    def:
      'The rule that puts a number on the grid a word length makes, by rounding it to the nearest ' +
      'multiple of the step. Its error is at most half a step. Applied once to a coefficient it ' +
      'gives a different filter. Applied to every stored value it makes the recursion nonlinear.',
  },
  poleradius: {
    name: 'Pole radius',
    short: 'pole radius',
    def:
      'How far a pole sits from the centre of the z-plane. A radius below one decays and a radius ' +
      'above one grows without limit. The reference section here has a radius of 0.996085, which ' +
      'is 3.9e-3 of room, and a coarse grid can spend all of it.',
  },
  stability: {
    name: 'Stability',
    short: 'stability',
    def:
      'A filter is stable when every pole radius is below one, so a finite input gives a finite ' +
      'output. Quantising the coefficients moves the poles, and a pole that lands on or outside ' +
      'the unit circle leaves a filter that does not settle.',
  },
  polegrid: {
    name: 'Pole grid',
    short: 'pole grid',
    def:
      'The pole positions a second-order section can reach once its two feedback coefficients are ' +
      'on a grid. The positions crowd together near 45 degrees and thin out against the real axis ' +
      'near z of 1, which is where a low-frequency resonator needs to be.',
  },
  directform: {
    name: 'Direct form',
    short: 'direct form',
    def:
      'The structure that stores the two inputs and two outputs a biquad needs and multiplies them ' +
      'by the five coefficients as written. It is the cheapest arrangement and it has the worst ' +
      'pole grid. Other structures store different numbers and reach different positions.',
  },
  limitcycle: {
    name: 'Limit cycle',
    short: 'limit cycle',
    def:
      'A state a rounded recursion returns to with no input at all, so the filter repeats forever ' +
      'instead of decaying. The same filter in float64 decays to nothing. It exists because ' +
      'rounding makes the recursion nonlinear, and it is exact rather than approximate.',
  },
  deadband: {
    name: 'Dead band',
    short: 'dead band',
    def:
      'The range of levels a rounded recursion cannot decay out of, in steps of the stored value. ' +
      'For the section here it is 81 steps at every word length tried. The coefficients set that ' +
      'count. The word length sets only how large a step is.',
  },
  overflow: {
    name: 'Overflow',
    short: 'overflow',
    def:
      'What happens when a value is larger than the largest the word length holds. The processor ' +
      'has two answers and both are wrong in different ways, so a design chooses one and then ' +
      'scales the filter so that it rarely has to.',
  },
  saturation: {
    name: 'Saturation',
    short: 'saturation',
    def:
      'The answer to overflow that clamps a value to the largest the range holds. The error is ' +
      'large but its sign is right, so a saturating filter distorts and keeps working. Every ' +
      'signal processor has an instruction for it.',
  },
  wrap: {
    name: 'Wrapping',
    short: 'wrapping',
    def:
      'The answer to overflow that keeps the low bits and throws the top one away, so a value just ' +
      'past the top reappears just past the bottom. It is what plain two-complement addition does. ' +
      'Inside a recursion the wrong sign comes back round the loop.',
  },
  headroom: {
    name: 'Headroom',
    short: 'headroom',
    def:
      'The room between the largest value a filter asks for and the largest its word length holds. ' +
      'A resonant section asks for far more than its input, so headroom is bought either with ' +
      'integer bits or by scaling the input down.',
  },
  roundingnoise: {
    name: 'Rounding noise',
    short: 'rounding noise',
    def:
      'The error rounding leaves inside a filter, modelled as noise with a power of one step ' +
      'squared over twelve. The model needs the error to look random, which needs a signal that ' +
      'moves across many values of the grid.',
  },
  noisegain: {
    name: 'Noise gain',
    short: 'noise gain',
    def:
      'How much a recursion amplifies an error injected at its own output, which is the sum of the ' +
      'squared impulse response of its feedback part alone. The section here has a noise gain of ' +
      '10502, so one rounding of 2.82e-4 becomes 2.89e-2.',
  },
}

/** The words that mean a reader has met one of these terms. */
export const TERM_WORDS = {
  wordlength: [/\bword lengths?\b/i],
  quantiser: [/\bquantis/i],
  poleradius: [/\bpole radius\b/i, /\bpole radii\b/i],
  stability: [/\bunstable\b/i, /\bno longer stable\b/i],
  polegrid: [/\bpole grid\b/i],
  directform: [/\bdirect form\b/i],
  limitcycle: [/\blimit cycles?\b/i],
  deadband: [/\bdead band\b/i],
  overflow: [/\boverflow/i],
  saturation: [/\bsaturat/i],
  wrap: [/\bwraps?\b/i, /\bwrapped\b/i, /\bwrapping\b/i],
  headroom: [/\bheadroom\b/i],
  roundingnoise: [/\brounding noise\b/i],
  noisegain: [/\bnoise gain\b/i],
}
