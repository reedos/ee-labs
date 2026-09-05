// The terms Group F, the transform itself, needs.

export const TERMS = {
  dft: {
    name: 'The direct sum',
    short: 'discrete Fourier transform',
    def:
      'The definition the transform computes: each of N outputs is a sum of N terms, so N squared ' +
      'complex multiplies in all. At 1024 points that is 1048576. Nothing about it is wrong, and ' +
      'it is what the fast transform returns to within 1e-13.',
  },
  twiddle: {
    name: 'Twiddle factor',
    short: 'twiddle',
    def:
      'The complex number e^{-j 2 pi k / N} that one butterfly multiplies by. It is a point on the ' +
      'unit circle at an angle of minus 360 k over N degrees. At k of zero it is 1 and the ' +
      'multiply disappears. At k of N over four it is minus j, which is a quarter turn.',
  },
  butterfly: {
    name: 'Butterfly',
    short: 'butterfly',
    def:
      'The two-input two-output step a radix-2 transform is built from. X is a plus W b and Y is a ' +
      'minus W b, which is one complex multiply and two complex additions. A transform of N points ' +
      'is log2 N stages of N over 2 of them.',
  },
  bitreversal: {
    name: 'Bit reversal',
    short: 'bit reversal',
    def:
      'The order a decimation-in-time transform reads its input in, which is each index with its ' +
      'bits written backwards. At eight points that is 0, 4, 2, 6, 1, 5, 3, 7. Doing it twice ' +
      'returns the original order, so the permutation is its own inverse.',
  },
  padding: {
    name: 'Zero padding',
    short: 'padding',
    def:
      'Adding zeros to a record so its length reaches the next power of two, which is what a ' +
      'radix-2 transform needs. It adds no information. It changes the bin spacing, so every ' +
      'frequency the readout prints moves with it.',
  },
}

/** The words that mean a reader has met one of these terms. */
export const TERM_WORDS = {
  dft: [/\bdirect sum\b/i, /\bdiscrete Fourier\b/i],
  twiddle: [/\btwiddle/i],
  butterfly: [/\bbutterfl/i],
  bitreversal: [/\bbit revers/i],
  padding: [/\bpadded\b/i, /\bpadding\b/i, /\bzero pad/i],
}
