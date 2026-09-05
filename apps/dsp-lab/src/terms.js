// Definitions, delivered where the term first does work.
//
// Signal Lab's registry is the model, and the house rules are its rules. Three
// or four sentences. The first says what the thing is. Concrete numbers over
// abstraction, and no term defined using an undefined term.
//
// TERM_WORDS is the other half of the contract. The words in a `see`, a `try` or
// a `why` that mean a reader has just met the term. terms.test.js scans every
// lesson with these and fails when a word appears in a lesson that does not list
// its term, which is how a definition stops being optional.
//
// CHROME_TERMS are the words the top bar and the readouts use on every screen.
// They count as defined everywhere.

export const TERMS = {
  decimation: {
    name: 'Decimation',
    short: 'decimation',
    def:
      'Keeping every Mth sample and discarding the rest, so the rate falls by M. At 48 kHz with ' +
      'M of 4 the result is a 12 kHz signal whose Nyquist is 6 kHz. It is not a filter, and ' +
      'delaying its input by one sample changes which samples survive.',
  },
  interpolation: {
    name: 'Interpolation',
    short: 'interpolation',
    def:
      'Raising the rate by L, in two steps. Zero stuffing writes L minus one zeros after every ' +
      'sample, and a low-pass then removes the images that leaves. The filter carries a passband ' +
      'gain of L, because three of every four samples are now zero.',
  },
  alias: {
    name: 'Alias',
    short: 'alias',
    def:
      'A frequency that arrives somewhere else because the rate is too low to hold it. Above ' +
      'Nyquist a tone at f appears at the distance from the nearest multiple of the rate. At a ' +
      '12 kHz rate a 9 kHz tone appears at 3 kHz, and the samples do not record which it was.',
  },
  nyquist: {
    name: 'Nyquist frequency',
    short: 'Nyquist',
    def:
      'Half the sample rate, and the boundary of what a sampled signal can hold. Everything below ' +
      'it survives sampling and everything above it folds back. Decimating by M divides it by M, ' +
      'so at 48 kHz and M of 4 it falls from 24 kHz to 6 kHz.',
  },
  image: {
    name: 'Image',
    short: 'image',
    def:
      'A copy of the signal’s band that appears when the rate is raised. Zero stuffing leaves the ' +
      'spectrum unchanged, so L minus one copies of the band sit below the new Nyquist. A 1500 Hz ' +
      'tone on a 12 kHz grid gives images at 10.5, 13.5 and 22.5 kHz.',
  },
  zerostuff: {
    name: 'Zero stuffing',
    short: 'zero stuffing',
    def:
      'Writing L minus one zeros after every sample, which is the first half of interpolation. It ' +
      'changes no value and adds no information. The amplitude falls by L because the same energy ' +
      'now sits in L times as many samples.',
  },
  holddroop: {
    name: 'Zero-order hold droop',
    short: 'hold droop',
    def:
      'The amplitude a held sample loses at higher frequencies. Holding a value for M samples is a ' +
      'rectangle M samples wide, whose transform is a sinc. At 3 kHz with M of 4 at 48 kHz the ' +
      'factor is 0.9003, so a full-scale tone reads about 0.90.',
  },
  antialias: {
    name: 'Anti-alias filter',
    short: 'anti-alias filter',
    def:
      'The low-pass that goes before a decimator, removing everything above the new Nyquist while ' +
      'it can still be told apart from the signal. Afterwards it cannot. Its cutoff sits inside ' +
      'the new Nyquist, at 4800 Hz for a 6 kHz Nyquist here, to leave room for it to fall.',
  },
  polyphase: {
    name: 'Polyphase',
    short: 'polyphase',
    def:
      'Dealing a filter’s taps out to M shorter filters, so subfilter p holds taps p, p plus M and ' +
      'so on. Each runs at the low rate, and the outputs are combined. Nothing is approximated, ' +
      'and the work falls by exactly M.',
  },
  noble: {
    name: 'The noble identities',
    short: 'noble identities',
    def:
      'Two exact rules for moving a filter across a rate change. Downsampling then H(z) equals ' +
      'H(z^M) then downsampling. H(z) then upsampling equals upsampling then H(z^L). H(z^M) is the ' +
      'same taps with M minus one zeros between them.',
  },
  specification: {
    name: 'Specification',
    short: 'specification',
    def:
      'The mask a response has to stay inside, written as bands. Four numbers give two bands here: ' +
      'the passband to 4 kHz within 1 dB, and the stopband from 6 kHz below 60 dB. The gap between ' +
      'them carries no bound.',
  },
  margin: {
    name: 'Margin',
    short: 'margin',
    def:
      'The decibels to spare against a bound. Positive means the response is inside the mask and ' +
      'negative names a frequency where it is not. The pane reports one margin per band and marks ' +
      'the band that binds.',
  },
  passband: {
    name: 'Passband',
    short: 'passband',
    def:
      'The band a filter is meant to pass, and the ripple it may have there. Measured from the ' +
      'passband’s own peak, so a filter with a gain of two meets a ripple specification as well as ' +
      'one with a gain of one.',
  },
  stopband: {
    name: 'Stopband',
    short: 'stopband',
    def:
      'The band a filter is meant to remove, and how far down it must be. Here it runs from 6 kHz ' +
      'to Nyquist and must stay 60 dB below the passband. A window’s own sidelobes set the deepest ' +
      'stopband it can reach.',
  },
  transition: {
    name: 'Transition band',
    short: 'transition',
    def:
      'The gap between the passband and the stopband, where the response may be anything. Its ' +
      'width sets the cost: taps go as one over the width, so halving it roughly doubles the ' +
      'filter. Here it is 2 kHz wide.',
  },
  window: {
    name: 'Window',
    short: 'window',
    def:
      'The taper applied to a truncated sinc, and the choice that sets a design’s stopband. Four ' +
      'are offered, with transition constants 0.9, 3.1, 3.3 and 5.5 and sidelobes about 21, 44, 53 ' +
      'and 74 dB down. The depth does not improve with length.',
  },
  sidelobe: {
    name: 'Sidelobe',
    short: 'sidelobe',
    def:
      'A ripple in the stopband, left by cutting the ideal sinc off. Its height is the window’s ' +
      'property rather than the length’s. A Hamming design reads 48.7 dB at 41 taps and 51.6 dB ' +
      'at 201 taps, while its transition narrows five times.',
  },
  equiripple: {
    name: 'Equiripple',
    short: 'equiripple',
    def:
      'A design whose error reaches the same height everywhere in a band. It is the best possible ' +
      'fit for a given length, because spending less error anywhere means spending more somewhere ' +
      'else. Parks-McClellan finds it, and it meets this mask in 53 taps where a window needs 133.',
  },
  alternation: {
    name: 'Alternation',
    short: 'alternation',
    def:
      'The signature of the best Chebyshev fit. The error touches its peak, with signs that ' +
      'alternate, at M plus two frequencies, where M is half the filter’s length. Finding those ' +
      'frequencies is what the Remez exchange does.',
  },
  refusal: {
    name: 'A refused design',
    short: 'refusal',
    def:
      'A design the method cannot reach, reported with the reason rather than returned as a ' +
      'filter that misses. A Hamming window asked for 60 dB is one. Its sidelobes sit about 53 dB ' +
      'down at any length, so no search over lengths finds it.',
  },
  bilinear: {
    name: 'The bilinear transform',
    short: 'bilinear',
    def:
      'The map from an analog filter to a digital one that sends the whole left half plane inside ' +
      'the unit circle. A stable prototype becomes a stable filter. It compresses the frequency ' +
      'axis through a tangent, which is what prewarping corrects for.',
  },
  prewarp: {
    name: 'Prewarping',
    short: 'prewarp',
    def:
      'Moving the analog corner to the frequency the bilinear transform will map back onto the one ' +
      'wanted. The corner goes to 2 fs tan(pi fc / fs) before the prototype is scaled. With it the ' +
      'digital corner lands exactly where it was asked for.',
  },
  butterworth: {
    name: 'Butterworth',
    short: 'Butterworth',
    def:
      'The prototype whose magnitude is as flat as it can be at DC, with poles evenly spaced on a ' +
      'circle. It is 3.0103 dB down at its corner at every order, and it falls at 6 dB an octave ' +
      'per order well above it.',
  },
  chebyshev: {
    name: 'Chebyshev type I',
    short: 'Chebyshev',
    def:
      'The prototype that allows ripple in the passband and falls faster for it. Its poles sit on ' +
      'an ellipse rather than a circle. At 1 dB of ripple it meets this mask at order 9, where a ' +
      'Butterworth needs order 18.',
  },
  groupdelay: {
    name: 'Group delay',
    short: 'group delay',
    def:
      'How long a band takes to get through, in samples. A symmetric FIR delays every frequency by ' +
      'the same (N-1)/2, so a waveform keeps its shape. An IIR does not, and its delay peaks near ' +
      'the corner where its poles are.',
  },
}

/** The words that mean a reader has met a term, by term id. */
export const TERM_WORDS = {
  decimation: [/\bdecimat/i],
  interpolation: [/\binterpolat/i],
  alias: [/\balias/i, /\bfolds? (down|back)\b/i],
  nyquist: [/\bnyquist\b/i],
  image: [/\bimages?\b/i],
  zerostuff: [/\bzero stuff/i, /\bstuffed zero/i],
  holddroop: [/\bdroop\b/i, /\bheld for\b/i],
  antialias: [/\banti-alias\b/i],
  polyphase: [/\bpolyphase\b/i],
  noble: [/\bnoble\b/i],
  specification: [/\bspecification\b/i, /\bmask\b/i],
  margin: [/\bmargins?\b/i],
  passband: [/\bpassband\b/i],
  stopband: [/\bstopband\b/i],
  transition: [/\btransition band\b/i, /\btransition width\b/i],
  window: [/\bwindows?\b/i, /\bHamming\b/, /\bBlackman\b/, /\bHann\b/],
  sidelobe: [/\bsidelobe/i],
  equiripple: [/\bequiripple\b/i, /\bParks-McClellan\b/],
  alternation: [/\balternation\b/i, /\balternating signs\b/i],
  refusal: [/\brefusal\b/i, /\bcannot reach\b/i],
  bilinear: [/\bbilinear\b/i],
  prewarp: [/\bprewarp/i],
  butterworth: [/\bbutterworth\b/i],
  chebyshev: [/\bchebyshev\b/i],
  groupdelay: [/\bgroup delay\b/i],
}

/** Words the chrome uses everywhere, defined once in the top bar's own panel. */
export const CHROME_TERMS = ['nyquist', 'specification', 'margin']

/** Every term id a piece of text has just introduced. */
export function termsInText(text) {
  const found = new Set()
  for (const [id, patterns] of Object.entries(TERM_WORDS)) {
    for (const re of patterns) {
      if (re.test(text)) {
        found.add(id)
        break
      }
    }
  }
  return found
}
