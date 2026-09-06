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
  carrier: {
    name: 'Carrier',
    short: 'carrier',
    def:
      'The sine wave a message is impressed on. This lab puts it at 1000 Hz for the analog group and at ' +
      '2000 Hz for the digital one. A carrier by itself carries no information.',
  },
  sideband: {
    name: 'Sideband',
    short: 'sideband',
    def:
      'A copy of the message spectrum shifted to sit beside the carrier. A 250 Hz message on a 1000 Hz ' +
      'carrier gives sidebands at 750 and 1250 Hz. Both carry the same information.',
  },
  index: {
    name: 'Modulation index',
    short: 'index',
    def:
      'How far the modulation swings the carrier, written m for amplitude modulation. At m of 0.5 each ' +
      'sideband sits 12.041 dB below the carrier. Above 1 the envelope folds through zero.',
  },
  deviation: {
    name: 'Frequency deviation',
    short: 'deviation',
    def:
      'How far frequency modulation swings the carrier, in hertz. A deviation of 500 Hz on a 250 Hz ' +
      'message gives a modulation index of 2. The index is the deviation over the message frequency.',
  },
  bessel: {
    name: 'Bessel function',
    short: 'Bessel',
    def:
      'The series that gives the amplitude of each line in a frequency-modulated spectrum. At an index ' +
      'of 2 the first four are 0.2239, 0.5767, 0.3528 and 0.1289. The carrier vanishes at an index of ' +
      '2.404826.',
  },
  carson: {
    name: "Carson's bandwidth",
    short: 'Carson',
    def:
      'Twice the deviation plus the message frequency, which is 1500 Hz at this lab defaults. It is a ' +
      'rule of thumb rather than a bound, and it holds 99.759 % of the power rather than all of it.',
  },
  envelope: {
    name: 'Envelope detector',
    short: 'envelope',
    def:
      'A rectifier and a low-pass filter, which together follow the outline of a modulated waveform. It ' +
      'recovers the message while the index stays at or below 1. Above that the outline folds and the ' +
      'output gains harmonics.',
  },
  coherent: {
    name: 'Coherent detector',
    short: 'coherent',
    def:
      'A multiply by a local copy of the carrier, then a low-pass filter. It needs the local copy to be ' +
      'in phase. A 30 degree error scales the recovered message by 0.866, which costs 1.249 dB.',
  },
  merit: {
    name: 'Figure of merit',
    short: 'merit',
    def:
      'The output signal-to-noise ratio a modulation reaches, referred to a suppressed carrier at one. ' +
      'Amplitude modulation at an index of 1 reads 0.3333. Frequency modulation at an index of 2 reads ' +
      '6, bought with three times the bandwidth.',
  },
  constellation: {
    name: 'Constellation',
    short: 'constellation',
    def:
      'The fixed set of points in the plane a modulation uses, one point per symbol. Every constellation ' +
      'here has a mean square of 1, so schemes can be compared at the same power. The in-phase and ' +
      'quadrature values are the two coordinates.',
  },
  symbol: {
    name: 'Symbol',
    short: 'symbol',
    def:
      'One point of the constellation, sent once every symbol period. This lab sends 1000 a second at 8 ' +
      'samples each. A 16-QAM symbol carries 4 bits, so the bit rate is four times the symbol rate.',
  },
  gray: {
    name: 'Gray labelling',
    short: 'Gray',
    def:
      'A way of putting bits on constellation points so that neighbours differ in exactly one bit. It ' +
      'costs nothing and it turns the likely symbol error into a one-bit error. Natural binary leaves ' +
      'neighbours two bits apart.',
  },
  mindistance: {
    name: 'Minimum distance',
    short: 'minimum distance',
    def:
      'The shortest gap between two points of a constellation, at unit mean square. BPSK reads 2.0, QPSK ' +
      '1.4142 and 16-QAM 0.6325. A smaller gap needs more power for the same error rate.',
  },
  evm: {
    name: 'Error vector magnitude',
    short: 'error vector',
    def:
      'How far the received points sit from their ideal positions, as a fraction of the signal. It is ' +
      'reported in per cent and in decibels. Noise, a phase error and interference all raise it.',
  },
  papr: {
    name: 'Peak to average',
    short: 'peak to average',
    def:
      'The largest instantaneous power over the mean power, in decibels. A 16-QAM constellation reads ' +
      '2.553 dB. An OFDM symbol of 64 subcarriers can reach 18.062 dB, which is what an amplifier has ' +
      'to hold.',
  },
  nyquistpulse: {
    name: 'Nyquist criterion',
    short: 'Nyquist criterion',
    def:
      'A pulse causes no interference between symbols when it is zero at every symbol instant except its ' +
      'own. The raised cosine meets it at every roll-off. What the pulse does between the instants does ' +
      'not matter.',
  },
  rolloff: {
    name: 'Roll-off',
    short: 'roll-off',
    def:
      'How much bandwidth a raised cosine takes above the minimum, written beta. The bandwidth is 675 Hz ' +
      'at a beta of 0.35 against 500 Hz at 0. A larger roll-off buys a shorter tail.',
  },
  isi: {
    name: 'Intersymbol interference',
    short: 'intersymbol interference',
    def:
      'The part of one symbol that lands at another symbol instant. A Nyquist pulse leaves none. ' +
      'Truncating one leaves a little, and a channel with an echo leaves a lot.',
  },
  eye: {
    name: 'Eye diagram',
    short: 'eye',
    def:
      'Two symbol periods of a long stream, drawn one over another. The height of the opening at the ' +
      'decision instant is the margin against noise. The width of the crossing region is the margin ' +
      'against a timing error.',
  },
  rrc: {
    name: 'Root raised cosine',
    short: 'root raised cosine',
    def:
      'Half the shaping put at each end of the link, so the cascade of the two is a raised cosine. The ' +
      'receive filter is then the matched filter. The identity is exact in continuous time and truncated ' +
      'in this app.',
  },
  matchedfilter: {
    name: 'Matched filter',
    short: 'matched filter',
    def:
      'The receive filter that maximises the signal-to-noise ratio at the decision instant. It is a copy ' +
      'of the transmitted pulse, and its output ratio is twice the pulse energy over the noise density. ' +
      'No other filter does better.',
  },
  awgn: {
    name: 'Additive Gaussian noise',
    short: 'Gaussian noise',
    def:
      'Noise added to the signal, with a Gaussian density and a flat spectrum. Its density is written ' +
      'N0, and each of the two arms carries half of it. It is drawn from a seeded generator here, so the ' +
      'same seed gives the same waveform.',
  },
  ebn0: {
    name: 'Eb over N0',
    short: 'Eb/N0',
    def:
      'The energy in one bit over the noise density, in decibels. It is the knob half this lab turns. ' +
      'Es over N0 is the same quantity for one symbol, and the two differ by ten times the log of the ' +
      'bits a symbol carries.',
  },
  ber: {
    name: 'Bit error rate',
    short: 'bit error rate',
    def:
      'The fraction of bits the receiver gets wrong. It has a closed form and a counted estimate, and ' +
      'this lab shows both. BPSK reads 3.8721e-6 at an Eb over N0 of 10 dB.',
  },
  ser: {
    name: 'Symbol error rate',
    short: 'symbol error rate',
    def:
      'The fraction of symbols the receiver decides wrongly. With Gray labelling one symbol error is ' +
      'usually one bit error, so the symbol rate is close to the bit rate times the bits a symbol ' +
      'carries.',
  },
  qfunction: {
    name: 'Q function',
    short: 'Q function',
    def:
      'The probability that a standard Gaussian exceeds a value. Every closed-form error rate in this ' +
      'lab is written with it. It comes from the Random Signals Lab and is not rewritten here.',
  },
  interval: {
    name: 'Confidence interval',
    short: 'interval',
    def:
      'The range a counted rate is consistent with, at a stated level. A hundred errors give a half ' +
      'width of 19.6 % and a thousand give 6.2 %. The interval depends on the error count and on ' +
      'nothing else.',
  },
  seed: {
    name: 'Seed',
    short: 'seed',
    def:
      'The integer that fixes a stream of random numbers. The same seed gives the same bits and the same ' +
      'noise every time, so every value this lab quotes can be reproduced. Neighbouring seeds give ' +
      'unrelated streams.',
  },
  softmetric: {
    name: 'Soft metric',
    short: 'soft metric',
    def:
      'A number per bit that says how strongly a received sample favours a zero. A positive value ' +
      'favours a zero and a negative one favours a one. The magnitude says how strongly. The ' +
      'Information Lab decoders read it instead of a hard decision.',
  },
  costas: {
    name: 'Costas loop',
    short: 'Costas loop',
    def:
      'A carrier recovery loop for a signal with no carrier line. Its error signal is the product of the ' +
      'in-phase and quadrature arms. The version here is second order, so it follows a frequency offset ' +
      'as well as a phase one.',
  },
  loopbandwidth: {
    name: 'Loop bandwidth',
    short: 'loop bandwidth',
    def:
      'How wide a range of disturbances a loop follows, written Bn. At a normalised 0.02 and 1000 ' +
      'symbols a second it is 20.00 Hz. A narrow loop is quieter and takes longer to acquire.',
  },
  earlylate: {
    name: 'Early-late gate',
    short: 'early-late gate',
    def:
      'A symbol timing loop. It correlates a quarter of a symbol either side of the decision instant and ' +
      'steers on the difference. The difference is zero at the right instant and rises either side of ' +
      'it.',
  },
  ofdm: {
    name: 'OFDM',
    short: 'OFDM',
    def:
      'Many narrow subcarriers sent at once, built by an inverse transform. This lab uses 64 spaced ' +
      '125 Hz apart. Each subcarrier sees a flat channel, so one complex divide equalises it.',
  },
  subcarrier: {
    name: 'Subcarrier',
    short: 'subcarrier',
    def:
      'One of the tones an OFDM symbol is made of. Two subcarriers spaced by a whole number of one over ' +
      'the useful symbol correlate to zero, which is what lets them overlap.',
  },
  prefix: {
    name: 'Cyclic prefix',
    short: 'cyclic prefix',
    def:
      'A copy of the last samples of an OFDM symbol, put in front of it. It turns the channel linear ' +
      'convolution into a circular one, so the transform diagonalises the channel. It covers a channel ' +
      'of the prefix length plus one tap.',
  },
  pilot: {
    name: 'Pilot',
    short: 'pilot',
    def:
      'A subcarrier carrying a known symbol, used to estimate the channel. Four pilots in 52 subcarriers ' +
      'cost 0.348 dB of rate. The estimate between them is interpolated.',
  },
  multipath: {
    name: 'Multipath',
    short: 'multipath',
    def:
      'More than one path from transmitter to receiver, so a delayed copy adds to the direct one. An ' +
      'echo four samples late at half amplitude puts a notch every 2000 Hz, the first at 1000 Hz.',
  },
  notch: {
    name: 'Notch',
    short: 'notch',
    def:
      'A frequency where the paths cancel. With an echo at half amplitude the notch is 6.021 dB down, ' +
      'and at 0.9 it is 20.000 dB down. Inverting a deep notch amplifies the noise there.',
  },
  coherence: {
    name: 'Coherence bandwidth',
    short: 'coherence bandwidth',
    def:
      'How wide a band the channel treats alike. It is 1000 Hz for this lab two-ray channel. A signal ' +
      'wider than that meets a different gain at each end of its band.',
  },
  equaliser: {
    name: 'Equaliser',
    short: 'equaliser',
    def:
      'A filter that undoes what the channel did. The zero-forcing one inverts the channel exactly and ' +
      'amplifies noise at a notch. The minimum mean-square one leaves some interference and less noise.',
  },
  lms: {
    name: 'Least mean square',
    short: 'least mean square',
    def:
      'An equaliser that learns its taps from a training sequence, one step at a time. It belongs to the ' +
      'DSP Lab adaptive group. Above a step size of two over the tap count times the input power it does ' +
      'not converge.',
  },
  fading: {
    name: 'Fading',
    short: 'fading',
    def:
      'A channel gain that varies, modelled here as one complex Gaussian per symbol. It is a statistical ' +
      'model rather than an exact object, and its three assumptions are printed with its numbers.',
  },
  pathloss: {
    name: 'Free-space path loss',
    short: 'path loss',
    def:
      'How much a signal spreads out on the way, twenty times the log of four pi times the distance over ' +
      'the wavelength. At 2.4 GHz it is 100.052 dB at a kilometre. It rises 20 dB for every decade of ' +
      'distance.',
  },
  noisefigure: {
    name: 'Noise figure',
    short: 'noise figure',
    def:
      'How much a receiver stage worsens the signal-to-noise ratio, in decibels. The first stage sets ' +
      'most of the total, which is why the amplifier goes in front of the mixer. The rule is Friis.',
  },
  margin: {
    name: 'Margin',
    short: 'margin',
    def:
      'How many decibels of Eb over N0 a link has above what it needs. This lab budget reads 19.325 dB ' +
      'over the 9.588 dB QPSK needs. At zero margin the range is 9252 m.',
  },
}

/** The words the scanner looks for, per term. */
export const TERM_WORDS = {
  carrier: ['carrier'],
  sideband: ['sideband'],
  index: ['modulation index'],
  deviation: ['frequency deviation'],
  bessel: ['bessel'],
  carson: ['carson'],
  envelope: ['envelope detector'],
  coherent: ['coherent detector'],
  merit: ['figure of merit'],
  constellation: ['constellation'],
  symbol: ['symbol'],
  gray: ['gray'],
  mindistance: ['minimum distance'],
  evm: ['error vector'],
  papr: ['peak to average', 'peak-to-average'],
  nyquistpulse: ['nyquist'],
  rolloff: ['roll-off'],
  isi: ['intersymbol'],
  eye: ['eye'],
  rrc: ['root raised cosine'],
  matchedfilter: ['matched filter'],
  awgn: ['gaussian noise'],
  ebn0: ['eb over n0', 'eb/n0'],
  ber: ['bit error rate'],
  ser: ['symbol error rate'],
  qfunction: ['q function'],
  interval: ['interval'],
  seed: ['seed'],
  softmetric: ['soft metric'],
  costas: ['costas'],
  loopbandwidth: ['loop bandwidth'],
  earlylate: ['early-late'],
  ofdm: ['ofdm'],
  subcarrier: ['subcarrier'],
  prefix: ['cyclic prefix'],
  pilot: ['pilot'],
  multipath: ['multipath'],
  notch: ['notch'],
  coherence: ['coherence bandwidth'],
  equaliser: ['equaliser'],
  lms: ['least mean square'],
  fading: ['fading'],
  pathloss: ['path loss'],
  noisefigure: ['noise figure'],
  margin: ['margin'],
}

/** The words the chrome uses on every screen, defined once for all lessons. */
export const CHROME_TERMS = ['seed', 'symbol', 'ebn0', 'constellation', 'interval']

/** The definitions an experiment asks for, in the order it named them. */
export function termsFor(ids = []) {
  return ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
}

/**
 * Every term whose words appear in `text`, whether or not the lesson listed it.
 *
 * The match is on whole words rather than on substrings. A plain `includes`
 * finds "carrier" inside "subcarrier" and "eye" inside "eyes", and both put a
 * term on a lesson that never used it.
 */
export function termsInText(text) {
  const lower = String(text || '').toLowerCase()
  const hits = []
  for (const [id, words] of Object.entries(TERM_WORDS)) {
    const found = words.some((w) => {
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(?<![a-z])${escaped}(?![a-z])`).test(lower)
    })
    if (found) hits.push(id)
  }
  return hits
}
