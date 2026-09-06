// Definitions, delivered where the term first does work.
//
// Each experiment declares the terms its text leans on (`terms: [...]` in
// groups/*.js), and the sidebar offers those definitions under the note, folded,
// so they cost nothing to a reader who already knows them.
//
// House rules for a definition. The first sentence says what the thing is. The
// rest say why it is used here. Numbers over abstraction, and no term defined
// using an undefined term. `terms.test.js` enforces the last of those.
//
// CHROME_TERMS are the words the top bar and the readouts use on every screen.
// They live in a second folded block and count as defined on every lesson.

export const TERMS = {
  seed: {
    name: 'Seed',
    short: 'seed',
    def:
      'The integer that fixes a stream of random numbers. The same seed gives the same numbers every ' +
      'time, so every value this lab quotes can be reproduced. Neighbouring seeds give unrelated ' +
      'streams. The top bar prints the seed each view drew.',
  },
  realisation: {
    name: 'Realisation',
    short: 'realisation',
    def:
      'One signal a random process produced, out of all the signals it could have produced. The scope ' +
      'shows one realisation. The ensemble view shows many at once, which is what the process itself ' +
      'is.',
  },
  ensemble: {
    name: 'Ensemble',
    short: 'ensemble',
    def:
      'The whole set of signals a random process can produce, with a probability on that set. This lab ' +
      'draws 200 realisations and treats them as the ensemble. Averaging across runs at one instant is ' +
      'an ensemble average, and averaging along one run is a time average.',
  },
  density: {
    name: 'Probability density',
    short: 'density',
    def:
      'A curve whose area over an interval is the probability of landing in that interval. Its units ' +
      'are one over the units of the variable. The whole area is 1. A histogram normalised by the ' +
      'sample count and the bin width estimates it.',
  },
  histogram: {
    name: 'Histogram',
    short: 'histogram',
    def:
      'Counts of how many samples fell into each bin, normalised here to a density. At 40 bins from ' +
      'minus 4 to 4 the bin width is 0.2. Every bar is an estimate and carries an interval, and the ' +
      'bars approach the density as one over the root of the sample count.',
  },
  bin: {
    name: 'Bin',
    short: 'bin',
    def:
      'One slot of a histogram or one frequency of a spectrum. A histogram bin here is 0.2 wide. A ' +
      'spectrum bin at 512 samples and 48 kHz is 93.75 Hz wide. A count in a bin is binomial, so its ' +
      'standard error falls as one over the root of the count.',
  },
  estimator: {
    name: 'Estimator',
    short: 'estimator',
    def:
      'A recipe that turns data into a number. It is itself random, because the data are. So it has a ' +
      'variance of its own, which is not the variance of the data, and this lab prints that variance ' +
      'as an interval beside every estimate.',
  },
  interval: {
    name: 'Confidence interval',
    short: 'interval',
    def:
      'A range around an estimate, computed so that it holds the true value a stated fraction of the ' +
      'time. It describes the procedure, not this one measurement. Repeat the whole estimate 4000 ' +
      'times at a 95 % level and about 3800 of the intervals hold the truth.',
  },
  level: {
    name: 'Level',
    short: 'level',
    def:
      'The fraction of intervals that hold the true value, 0.95 unless a lesson says otherwise. A 95 % ' +
      'interval on a mean reaches 1.9600 standard errors each side. A 99 % one reaches 2.5758, so more ' +
      'confidence costs width.',
  },
  coverage: {
    name: 'Coverage',
    short: 'coverage',
    def:
      'How often an interval actually holds the true value, counted rather than claimed. An interval ' +
      'whose coverage matches its level is working. This lab counts it over 4000 repeats and reads ' +
      '0.951 against a claimed 0.950.',
  },
  expectation: {
    name: 'Expectation',
    short: 'expectation',
    def:
      'The balance point of a density, written E[X]. For a uniform on (a, b) it is (a + b)/2. It is a ' +
      'closed form, not a measurement, so this lab prints it with no interval. The sample mean is the ' +
      'estimate that approaches it.',
  },
  variance: {
    name: 'Variance',
    short: 'variance',
    def:
      'The expected squared distance from the mean, in the square of the signal units. Variances of ' +
      'independent quantities add, which standard deviations do not. A uniform on (0, 1) has variance ' +
      '1/12. The square root is the standard deviation.',
  },
  kurtosis: {
    name: 'Kurtosis',
    short: 'kurtosis',
    def:
      'The fourth moment divided by the variance squared, a measure of how heavy the tails are. A ' +
      'Gaussian reads 3, a flat distribution reads 1.8, and an exponential reads 9. It decides how ' +
      'wide the interval on a variance estimate has to be.',
  },
  samplemean: {
    name: 'Sample mean',
    short: 'sample mean',
    def:
      'The arithmetic average of N samples, the usual estimate of the expectation. Its own variance is ' +
      'the data variance divided by N. So a hundredfold N narrows its interval tenfold, and precision ' +
      'is bought at that rate and no better.',
  },
  gaussian: {
    name: 'Gaussian',
    short: 'Gaussian',
    def:
      'The bell-shaped density set by a mean and a standard deviation. It holds 68.27 % of its mass ' +
      'within one standard deviation, 95.45 % within two and 99.73 % within three. It appears wherever ' +
      'many small independent contributions add.',
  },
  clt: {
    name: 'Central limit theorem',
    short: 'central limit theorem',
    def:
      'The statement that a sum of many independent contributions approaches a Gaussian, whatever each ' +
      'contribution looks like. Four uniforms summed already read a kurtosis of 2.71 against the ' +
      'Gaussian 3. The tails converge last, and that is where a detection result lives.',
  },
  qfunction: {
    name: 'Q function',
    short: 'Q function',
    def:
      'The probability that a standard Gaussian exceeds x, written Q(x). Q(1) is 0.15866, Q(3) is ' +
      '0.0013499, and Q(7) is 1.28e-12. Every detection result in this lab is a Q of something, so it ' +
      'is computed to full precision rather than fitted.',
  },
  autocorrelation: {
    name: 'Autocorrelation',
    short: 'autocorrelation',
    def:
      'The average of a signal times a shifted copy of itself, against the shift. At zero lag it is the ' +
      'mean square. White noise correlates with nothing but itself. A filtered process stays correlated ' +
      'over the filter time constant.',
  },
  stationary: {
    name: 'Stationary',
    short: 'stationary',
    def:
      'A process whose statistics do not depend on when you look. Its mean is one number and its ' +
      'autocorrelation depends only on the lag between two instants. Every process in this lab is ' +
      'stationary, and one of them is stationary without being ergodic.',
  },
  ergodic: {
    name: 'Ergodic',
    short: 'ergodic',
    def:
      'A process whose time average along one realisation approaches its ensemble average. Most useful ' +
      'processes are ergodic, which is what lets one long measurement stand in for many. A value drawn ' +
      'once per run is stationary and not ergodic, because a longer run adds nothing.',
  },
  psd: {
    name: 'Power spectral density',
    short: 'power spectral density',
    def:
      'How the mean square of a random signal is spread over frequency, in signal units squared per ' +
      'hertz. Its integral over a band is the power in that band, and over the whole band it is the ' +
      'variance. A random signal has this rather than a line spectrum.',
  },
  asd: {
    name: 'Amplitude spectral density',
    short: 'V/√Hz',
    def:
      'The square root of the power spectral density, in signal units per root hertz. 1 mV rms spread ' +
      'over 24 kHz reads 6.4550 µV/√Hz. It is the unit a noise specification is written in, because it ' +
      'does not depend on the measurement bandwidth.',
  },
  periodogram: {
    name: 'Periodogram',
    short: 'periodogram',
    def:
      'The squared magnitude of one frame of a signal, scaled to a density. One frame is a poor ' +
      'estimate, because each bin spreads as much as its own mean. Averaging M independent frames ' +
      'narrows that spread as one over the root of M.',
  },
  wienerkhinchin: {
    name: 'Wiener-Khinchin',
    short: 'Wiener-Khinchin',
    def:
      'The theorem that the power spectral density is the Fourier transform of the autocorrelation. On ' +
      'a finite record it is also an identity about arithmetic, and the two routes here agree to 11 ' +
      'digits. The two views are one object.',
  },
  dof: {
    name: 'Degrees of freedom',
    short: 'degrees of freedom',
    def:
      'How many independent numbers an estimate rests on. One periodogram bin has 2, and averaging M ' +
      'frames gives 2M. The relative spread of the estimate is the root of two over this number, so ' +
      '100 averages give 200 and a 10 % spread.',
  },
  chisquare: {
    name: 'Chi-square',
    short: 'chi-square',
    def:
      'The distribution a sum of squared Gaussians follows. A periodogram bin is the true density times ' +
      'a chi-square divided by its degrees of freedom, so its interval is a chi-square interval. At 200 ' +
      'degrees of freedom that interval runs from 0.830 to 1.229 of the estimate.',
  },
  whitenoise: {
    name: 'White noise',
    short: 'white noise',
    def:
      'A random signal with the same power at every frequency and no correlation between samples. Its ' +
      'density is flat, so its integral over a band rises with the bandwidth. 1 mV rms at 48 kHz gives ' +
      '6.4550 µV/√Hz.',
  },
  noisebandwidth: {
    name: 'Noise bandwidth',
    short: 'noise bandwidth',
    def:
      'The width of the brick wall that would pass the same noise power as a real filter. A first-order ' +
      'analogue stage has (π/2) f_c, which is 57 % wider than its corner, because the roll-off keeps ' +
      'passing power above it. The sampled filter here has its own, slightly narrower value.',
  },
  ktc: {
    name: 'kT over C',
    short: 'kT/C',
    def:
      'The mean-square noise voltage a resistor leaves on a capacitor, kT/C, whatever the resistance ' +
      'is. At 1 nF and 300 K the rms is 2.035 µV. Raising R raises the density as the root of R and ' +
      'narrows the bandwidth as 1/R, and the product does not move.',
  },
  montecarlo: {
    name: 'Monte Carlo',
    short: 'Monte Carlo',
    def:
      'Answering a question by drawing many random cases and counting. The answer is an estimate, so it ' +
      'carries an interval, and 2000 runs give a yield to about one percentage point. It is the same ' +
      'ensemble object with a specification attached.',
  },
  yield: {
    name: 'Yield',
    short: 'yield',
    def:
      'The fraction of runs whose outcome falls inside a specification band. A target of 10 units with ' +
      'a 0.5 spread and a band from 9 to 11 gives 95.85 %, against the 95.45 % the Gaussian predicts. ' +
      'It is a counted proportion, so it carries an interval.',
  },
  matchedfilter: {
    name: 'Matched filter',
    short: 'matched filter',
    def:
      'The filter whose impulse response is the pulse being looked for, reversed. Among all linear ' +
      'filters it gives the largest signal-to-noise ratio at the sampling instant. Any filter ' +
      'proportional to the pulse reaches the same ratio, and every other shape falls short.',
  },
  snr: {
    name: 'Signal-to-noise ratio',
    short: 'SNR',
    def:
      'Signal power divided by noise power, printed here as a ratio and in decibels. A ratio of 100 is ' +
      '20 dB. After the matched filter it equals 2E/N0, which depends on the pulse energy and not on ' +
      'the pulse shape.',
  },
  ebn0: {
    name: 'Eb over N0',
    short: 'Eb/N0',
    def:
      'Energy per bit divided by the one-sided noise density, the ratio a link is designed against. It ' +
      'is dimensionless and is usually quoted in decibels. At 7 dB an antipodal link has a bit error ' +
      'rate of 7.7267e-4, and at 12 dB it has 9.006e-9.',
  },
  ber: {
    name: 'Bit error rate',
    short: 'error rate',
    def:
      'The fraction of decisions that come out wrong. For antipodal signalling it is Q of the root of ' +
      'twice Eb/N0. Counting it is a Monte Carlo estimate, so it carries an interval, and zero counted ' +
      'errors does not mean the rate is zero.',
  },
  wiener: {
    name: 'Wiener filter',
    short: 'Wiener filter',
    def:
      'The linear filter that minimises mean-square error between its output and a target. With one ' +
      'weight it is a variance ratio and cannot change a signal-to-noise ratio at all. With more taps ' +
      'it uses the correlation in the signal and does better.',
  },
  mmse: {
    name: 'Minimum mean-square error',
    short: 'MMSE',
    def:
      'The smallest average squared error a linear estimate can leave. For one weight on one sample it ' +
      'is the harmonic combination of the signal and noise variances. It is the quantity a Wiener or ' +
      'Kalman filter minimises, and it is not the same thing as a signal-to-noise ratio.',
  },
  kalman: {
    name: 'Kalman filter',
    short: 'Kalman filter',
    def:
      'The recursive form of the same best linear estimate, computed one sample at a time from a state ' +
      'model. Its gain settles to a constant set only by the ratio of process noise to measurement ' +
      'noise. So its behaviour is decided before any data arrive.',
  },
  gain: {
    name: 'Kalman gain',
    short: 'gain',
    def:
      'How far the filter moves its estimate towards each new measurement, between 0 and 1. It is the ' +
      'prior variance divided by the prior variance plus the measurement noise. A noisier measurement ' +
      'lowers it, and a noisier process raises it.',
  },
  innovation: {
    name: 'Innovation',
    short: 'innovation',
    def:
      'The gap between a measurement and what the filter predicted before seeing it. In a filter that ' +
      'is tuned correctly the innovations are white and have variance equal to the prior variance plus ' +
      'the measurement noise. It is the quantity a real filter is checked against.',
  },
}

/**
 * The words in a note or a try line that mean a reader has just met a term.
 * `prose.test.js` scans every lesson with these and fails when a word appears in
 * a lesson that does not list its term.
 */
export const TERM_WORDS = {
  seed: ['seed', 'seeded'],
  realisation: ['realisation', 'realisations'],
  ensemble: ['ensemble', 'ensembles'],
  density: ['density'],
  histogram: ['histogram'],
  bin: ['bin', 'bins'],
  estimator: ['estimator', 'estimate'],
  interval: ['interval'],
  level: ['level'],
  coverage: ['coverage', 'covers'],
  expectation: ['expectation'],
  variance: ['variance'],
  kurtosis: ['kurtosis'],
  samplemean: ['sample mean'],
  gaussian: ['gaussian'],
  clt: ['central limit'],
  qfunction: ['q function'],
  autocorrelation: ['autocorrelation', 'correlation'],
  stationary: ['stationary'],
  ergodic: ['ergodic'],
  psd: ['power spectral density', 'spectral density'],
  asd: ['per root hertz'],
  periodogram: ['periodogram'],
  wienerkhinchin: ['wiener-khinchin'],
  dof: ['degrees of freedom'],
  chisquare: ['chi-square'],
  whitenoise: ['white noise'],
  noisebandwidth: ['noise bandwidth'],
  ktc: ['kt/c'],
  montecarlo: ['monte carlo'],
  yield: ['yield'],
  matchedfilter: ['matched filter'],
  snr: ['signal-to-noise'],
  ebn0: ['eb/n0'],
  ber: ['error rate'],
  wiener: ['wiener filter'],
  mmse: ['mean-square error'],
  kalman: ['kalman'],
  gain: ['kalman gain'],
  innovation: ['innovation'],
}

/** The words the chrome uses on every screen, defined once for all lessons. */
export const CHROME_TERMS = ['seed', 'realisation', 'ensemble', 'interval', 'level', 'estimator']

/** The definitions an experiment asks for, in the order it named them. */
export function termsFor(ids = []) {
  return ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
}

/** Every term whose words appear in `text`, whether or not the lesson listed it. */
export function termsInText(text) {
  const lower = String(text || '').toLowerCase()
  const hits = []
  for (const [id, words] of Object.entries(TERM_WORDS)) {
    if (words.some((w) => lower.includes(w))) hits.push(id)
  }
  return hits
}
