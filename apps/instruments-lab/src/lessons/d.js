// Group D's three registers. Every number is a reading the solver produced.

/** The capacitance that tunes the filter to `f`, with L as it stands. */
const tuneTo = (L, f) => 1 / ((2 * Math.PI * f) ** 2 * L)
/** The filter's centre, its Q and its width, from the three knobs. */
const f0 = (p) => 1 / (2 * Math.PI * Math.sqrt(p.L * p.C))
const Q = (p) => Math.sqrt(p.L / p.C) / p.R
const RBW = (p) => f0(p) / Q(p)
const TAU = (p) => (2 * p.L) / p.R
/** The two half-power points of a band-pass of centre f₀ and quality Q. */
const half = (p, sign) => f0(p) * (Math.sqrt(1 + 1 / (4 * Q(p) ** 2)) + sign / (2 * Q(p)))

export const LESSONS_D = {
  d1: {
    see:
      'The analyser’s filter is an inductor, a capacitor and a resistor in series, read across the ' +
      'resistor. It peaks at 10.00 kHz, and it is 3.01 dB down at 9.950 kHz and at 10.05 kHz. Those two ' +
      'are 100 Hz apart, and 100 Hz is the resolution bandwidth.',
    seeReads: [
      ['fzero', 10000],
      ['rbw', 100],
      [(x, p) => half(p, -1), 9950.12],
      [(x, p) => half(p, +1), 10050.1],
      [(x, p) => 20 * Math.log10(Math.SQRT2), 3.0103],
    ],
    try: [
      {
        say: 'Raise the filter resistance ten times. The Q falls from 100 to 10 and the resolution bandwidth opens to 1.000 kHz, while the centre has not moved.',
        set: { R: 10 * 10e-3 * 2 * Math.PI * 100 },
        reads: [
          ['qfactor', 10],
          ['rbw', 1000],
          ['fzero', 10000],
          [(x, p) => 10 * Q(p), 100],
        ],
      },
      {
        say: 'Set the tone to 9.950 kHz, the lower half-power point. The reading falls to 0.7071 of its peak.',
        set: { f: 9950.12 },
        reads: [['H.mag', 0.707107]],
      },
      {
        say: 'Tune the capacitor for 5.000 kHz. The centre halves, and so does Q, so the resolution bandwidth is 100 Hz still. Tuning with C alone does not hold Q.',
        set: { C: tuneTo(10e-3, 5000) },
        reads: [
          ['fzero', 5000],
          ['rbw', 100],
          ['qfactor', 50],
        ],
      },
    ],
    why:
      'A series RLC read across R has magnitude [1 + Q²(f/f₀ − f₀/f)²]^(−1/2), with f₀ = 1/(2π√(LC)) and ' +
      'Q = ω₀L/R. The bracket is zero at f₀ and one at the two frequencies where the reactance equals ' +
      'R, so those are the half-power points and their gap is f₀/Q exactly. Their geometric mean is f₀, ' +
      'not ' +
      'their average, because the response is symmetric in log frequency rather than in frequency. The ' +
      'analyser quotes that gap as its resolution bandwidth, and every claim about resolving two lines ' +
      'refers to it.',
    whyReads: [['fzero', 10000], ['qfactor', 100]],
  },

  d2: {
    see:
      'One tone sits exactly at the filter’s centre, and the trace shows a peak 100 Hz wide. The tone ' +
      'has no width at all. What is on the screen is the filter’s own shape, drawn out as the analyser ' +
      'sweeps past a frequency that is not moving.',
    seeReads: [
      ['H.mag', 1],
      ['rbw', 100],
    ],
    try: [
      {
        say: 'Move the tone up to 10.05 kHz, half a bandwidth off centre. The reading falls to 0.708, which is half the power and the edge of the filter.',
        set: { f: 10050 },
        reads: [['H.mag', 0.707987]],
      },
      {
        say: 'Move it to 10.20 kHz instead, two bandwidths off. The reading is 0.2448, which is 12.22 dB down, and the tone is still the same tone.',
        set: { f: 10200 },
        reads: [
          ['H.mag', 0.244794],
          ['H.db', -12.224],
        ],
      },
      {
        say: 'Widen the resolution bandwidth ten times with the tone at 10.20 kHz. The reading rises to 0.9297, because the tone is now well inside the filter.',
        set: { R: 10 * 10e-3 * 2 * Math.PI * 100, f: 10200 },
        reads: [
          ['H.mag', 0.929729],
          ['rbw', 1000],
        ],
      },
    ],
    why:
      'The analyser has one filter and one detector, and the trace is the detector’s reading against ' +
      'where the filter is tuned. A tone at one frequency therefore draws the filter’s magnitude ' +
      'reversed, and a narrower filter draws a narrower line. A real analyser sweeps the filter past a ' +
      'fixed tone rather than the tone past a fixed filter, and the two functions differ in the skirts ' +
      'by about Δf/f₀. At the peak and at the half-power points they agree, so the width on the screen is ' +
      'the same number either way.',
    whyReads: [['rbw', 100]],
  },

  d3: {
    see:
      'Two tones, at 9.900 kHz and 10.100 kHz, into a filter tuned between them. The detector reads ' +
      '447.2 mV, and each tone alone would have given 445.4 mV and 449.0 mV. Nothing on the trace yet ' +
      'says there are two of them.',
    seeReads: [
      ['detect.rms', 0.447206],
      [(x, p) => Math.abs(p.fb - p.fa), 200],
    ],
    try: [
      {
        say: 'Tune the filter onto the lower tone. The detector reads 728.0 mV, and this is one of the two peaks.',
        set: { C: tuneTo(10e-3, 9900) },
        reads: [['detect.rms', 0.727989]],
      },
      {
        say: 'Tune it onto the upper tone. The detector reads 727.2 mV, the other peak, and the 447.2 mV between them is the dip that makes this a pair.',
        set: { C: tuneTo(10e-3, 10100) },
        reads: [['detect.rms', 0.727228], [() => 0.447206, 0.447206]],
      },
      {
        say: 'Widen the resolution bandwidth to 1.000 kHz with the filter back between them. The detector reads 980.6 mV.',
        set: { R: 10 * 10e-3 * 2 * Math.PI * 100 },
        reads: [
          ['detect.rms', 0.980578],
          ['rbw', 1000],
        ],
      },
      {
        say: 'Keep the wide filter and tune it onto the lower tone. The reading falls to 965.5 mV, below the middle, so there is no dip and no pair.',
        set: { R: 10 * 10e-3 * 2 * Math.PI * 100, C: tuneTo(10e-3, 9900) },
        reads: [['detect.rms', 0.965510]],
      },
    ],
    why:
      'The detector reads the rms of the filter’s output over its dwell. Two tones inside the filter ' +
      'beat, and over a whole number of beat periods the cross term averages away, so the reading is ' +
      '√((a₁² + a₂²)/2) with each a the tone through the filter. With the filter narrower than the ' +
      'spacing the two peaks stand above the middle and the pair is resolved. With it wider the middle ' +
      'is the highest point on the trace. Signal Lab’s Resolution needs time is the same trade in a ' +
      'frame length rather than a bandwidth.',
  },

  d4: {
    see:
      'Switch the tone on and the filter does not answer at once. The output climbs with a time ' +
      'constant of 3.183 ms, which is 1/(π × 100 Hz), and reaches nine tenths of its final 1 V after ' +
      '7.329 ms. A sweep that crosses the peak faster than that reads low.',
    seeReads: [
      [(x, p) => TAU(p), 3.1831e-3],
      [(x, p) => TAU(p) * Math.log(10), 7.32936e-3],
      [(x, p) => RBW(p), 100],
      [(x) => x.ac ? Math.hypot(x.ac.v.out[0], x.ac.v.out[1]) : NaN, 1],
    ],
    try: [
      {
        say: 'Put the cursor at 3.183 ms, one time constant in. The envelope has covered 63.2 % of the way to its final value.',
        at: 3.1831e-3,
        reads: [[(x, p) => 100 * (1 - Math.exp(-1)), 63.2]],
      },
      {
        say: 'Widen the resolution bandwidth ten times. The time constant falls to 318.3 µs and the nine-tenths point to 732.9 µs, so a wide filter is a fast one.',
        set: { R: 10 * 10e-3 * 2 * Math.PI * 100 },
        reads: [
          [(x, p) => TAU(p), 3.1831e-4],
          [(x, p) => TAU(p) * Math.log(10), 7.32936e-4],
          [(x, p) => RBW(p), 1000],
        ],
      },
      {
        say: 'Set the span to 20.00 kHz with the narrow filter back. Two hundred resolution bandwidths at one time constant each need 636.6 ms.',
        set: { span: 20000 },
        reads: [
          [(x, p) => (p.span / RBW(p)) * TAU(p), 0.63662],
          [(x, p) => p.span / RBW(p), 200],
          [(x, p) => p.span, 20000],
        ],
      },
    ],
    why:
      'The filter’s poles have real part R/2L, so its natural response decays with 2L/R, and that is ' +
      '1/(π·Δf) for a bandwidth of Δf. A narrow filter is therefore a slow one, and halving the ' +
      'resolution bandwidth doubles the time constant while doubling the number of windows in the span. ' +
      'A sweep takes four times as long. That is the rule every analyser’s sweep-time setting obeys, ' +
      'and it is why an analyser refuses to sweep faster than its own filter can follow.',
    whyReads: [[(x, p) => TAU(p), 3.1831e-3]],
  },
}
