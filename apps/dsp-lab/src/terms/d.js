// The terms Group D, estimating a spectrum, needs.

export const TERMS = {
  density: {
    name: 'Power density',
    short: 'density',
    def:
      'How much power a signal carries in each hertz of bandwidth, in units of power per hertz. A ' +
      'signal made of sinusoids has lines to read instead. Noise has no lines, so the number at a ' +
      'point means nothing until a bandwidth is attached to it.',
  },
  periodogram: {
    name: 'Periodogram',
    short: 'periodogram',
    def:
      'One transform of one record, squared and scaled to a density. It is what every other ' +
      'estimate here is built out of. On its own it scatters about the true density by about the ' +
      'density itself, however long the record is.',
  },
  scatter: {
    name: 'Scatter',
    short: 'scatter',
    def:
      'How far the bins of an estimate spread about their own mean, as the standard deviation over ' +
      'that mean. A single periodogram reads about 1.0 whatever the record length is. Averaging K ' +
      'of them brings it to about one over the root of K.',
  },
  resolution: {
    name: 'Resolution',
    short: 'resolution',
    def:
      'How far apart two components must be before an estimate shows two things rather than one, ' +
      'which is about one bin. A 16384-point record at 48 kHz gives a bin of 2.93 Hz. Cutting it ' +
      'into 64 segments gives 187.5 Hz, and two tones 120 Hz apart then merge.',
  },
  bartlett: {
    name: 'Bartlett',
    short: "Bartlett's method",
    def:
      'Cut the record into K abutting pieces, take the periodogram of each, and average them. The ' +
      'pieces are independent, so the scatter falls as one over the root of K. Each piece is K ' +
      'times shorter, so the bin is K times wider.',
  },
  welch: {
    name: 'Welch',
    short: "Welch's method",
    def:
      'Bartlett with a window on each segment and the segments overlapping. The window stops a ' +
      'strong component covering the estimate with its own skirts, and the overlap recovers the ' +
      'samples the taper threw away. K segments then need about half the record.',
  },
  armodel: {
    name: 'All-pole model',
    short: 'all-pole model',
    def:
      'A model that assumes the signal came from white noise through a filter with poles and no ' +
      'zeros, and fits that filter. The fit is a few coefficients rather than a curve. It ' +
      'resolves a peak from far fewer samples than an average needs.',
  },
  ordercriterion: {
    name: 'Order criterion',
    short: 'order criterion',
    def:
      'A rule for choosing how many poles to fit, since more poles always fit better. Akaike ' +
      'charges 2p over N for them and the description length charges p ln N over N. The second ' +
      'charges more, so it picks a lower order on the same data.',
  },
}

/** The words that mean a reader has met one of these terms. */
export const TERM_WORDS = {
  density: [/\bdensity\b/i, /\bdensities\b/i],
  periodogram: [/\bperiodogram/i],
  scatter: [/\bscatter/i],
  resolution: [/\bresolution\b/i, /\bresolves?\b/i, /\bresolved\b/i, /\bmerges?\b/i, /\bmerged\b/i],
  bartlett: [/\bBartlett\b/],
  welch: [/\bWelch\b/],
  armodel: [/\ball-pole\b/i, /\bAR model\b/i, /\bAR\(/],
  ordercriterion: [/\bAkaike\b/i, /\bdescription length\b/i, /\border criterion\b/i],
}
