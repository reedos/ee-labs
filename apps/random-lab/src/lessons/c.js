export default {
  C1: {
    see: [
      'The source is a sum of four uniform draws, scaled to unit variance.',
      'One uniform is flat and has kurtosis 1.80.',
      'Four summed read 2.71, against a Gaussian 3.',
      'The histogram is close to the Gaussian curve over it, and is not equal to it.',
    ].join(' '),
    try: [
      { say: 'Set the terms to 1. The histogram is a flat block with hard edges.', set: { cltTerms: 1 } },
      { say: 'Set the terms to 2. The shape becomes a triangle, and kurtosis reads 2.41.', set: { cltTerms: 2 } },
      { say: 'Set the terms to 12. Kurtosis reads 2.93, and the edges are gone.', set: { cltTerms: 12 } },
    ],
    why: [
      'The central limit theorem says a sum of many independent contributions approaches a Gaussian, whatever each one looks like.',
      'The kurtosis of a sum of k uniforms is 3 − 6/(5k), which reaches 3 only in the limit.',
      'At k = 4 that is 2.70 and the picture is already convincing.',
      'The gap between the bars and the Gaussian curve is 3.7 times what sampling alone would leave, so four terms is close and is not the limit.',
      'This is why noise in a resistor, an amplifier or a channel is Gaussian.',
      'Each is a sum of very many small independent events.',
      'The convergence is fastest in the middle and slowest in the tails, and a detection error rate lives in the tail.',
      'That is the one place where assuming a Gaussian too early goes wrong.',
    ].join(' '),
  },

  C2: {
    see: [
      'A Gaussian holds 68.27 % of its mass within one standard deviation.',
      'Two hold 95.45 %, and three hold 99.73 %.',
      'The counted fractions from 100000 draws sit beside each formula.',
      'The two agree inside the count interval.',
    ].join(' '),
    try: [
      { say: 'Set the level to 0.99. The interval on the mean widens to 2.5758 standard errors.', set: { level: 0.99 } },
      { say: 'Set the level to 0.68. It narrows to 1.0000, which is the one-sigma figure.', set: { level: 0.68 } },
      { say: 'Read the counted fraction against the formula beside it.', set: {} },
    ],
    why: [
      'These three numbers are the reason a Gaussian is quoted by its standard deviation at all.',
      'They convert a spread into a probability, and they do it the same way for every Gaussian.',
      'A 95 % two-sided interval is 1.9600 standard deviations each side, which is where the familiar two comes from.',
      'The counts are a check rather than a decoration.',
      'They are computed from the draws, not from the formula, so a generator with the wrong tails would fail here.',
      'The same three numbers reappear in Group G as the coverage an interval claims.',
    ].join(' '),
  },

  C3: {
    see: [
      'Q(x) is the probability that a standard Gaussian exceeds x.',
      'Q(1) is 0.15866, Q(3) is 0.0013499, and Q(7) is 1.28 × 10⁻¹².',
      'It is the shaded tail on the plot.',
      'Every detection result later in this lab is a Q of something.',
    ].join(' '),
    try: [
      { say: 'Move the marker to 2. The tail holds 2.2750 % of the mass.', set: {} },
      { say: 'Move it to 4. The tail holds 3.17 × 10⁻⁵, and the shading is invisible.', set: { sigma: 1 } },
      { say: 'Switch to the error rate view. The same function draws that curve.', set: {} },
    ],
    why: [
      'Q falls faster than any power of x, which is why a small change in a ratio moves an error rate so much.',
      'One more decibel near 10 dB divides the rate by 8.68.',
      'That steepness is the reason a link budget has a knee rather than a slope.',
      'The function is computed here from the incomplete gamma function rather than from a fitted approximation.',
      'A fit good to 1.2 × 10⁻⁷ returns Q(7) as noise, and Q(7) is a rate a real link is designed to.',
      'The tail is where the arithmetic has to be right.',
    ].join(' '),
  },
}
