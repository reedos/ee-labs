// Group O's terms, merged into the lab's one registry by terms.js.

export const TERMS_O = {
  density: {
    name: 'Spectral density',
    def:
      'How much of a random signal’s power sits in each hertz of frequency, in volts squared per hertz, or its ' +
      'root in volts per root hertz. A sine has a spectrum, one line at one frequency. A random signal has no ' +
      'lines at all, and a density is what it has instead.',
  },
  periodogram: {
    name: 'Periodogram',
    def:
      'The squared magnitude of one frame’s transform, scaled so that its integral is the frame’s power. It is ' +
      'an estimate of the density and a poor one on its own. Each bin carries two degrees of freedom, so its ' +
      'standard deviation equals the density it is estimating.',
  },
  averaging: {
    name: 'Averaging frames',
    def:
      'Cutting a record into frames, taking each frame’s periodogram, and averaging them bin by bin. M ' +
      'independent frames give 2M degrees of freedom and a relative spread of √(2/2M). A hundred frames ' +
      'therefore scatter by about a tenth where one frame scatters by its whole height.',
  },
  thermal: {
    name: 'Thermal noise',
    def:
      'The noise voltage every resistance carries because its own carriers are in motion, √(4kTR) volts per ' +
      'root hertz. It depends on the resistance and the temperature and on nothing else, not on the material ' +
      'and not on any current through it. A kilohm at 300 K makes 4.07 nV per root hertz.',
  },
  noisebandwidth: {
    name: 'Noise bandwidth',
    def:
      'The width of the brick wall that would pass the same noise power as the real response. For one pole it ' +
      'is (π/2) times the −3 dB corner, 57 % wider, because the roll-off keeps passing power above the corner. ' +
      'An rms quoted without the band it was integrated over means nothing.',
  },
  ktoverc: {
    name: 'kT/C',
    def:
      'The mean-square noise voltage a capacitor holds when it is charged through any resistance at all. ' +
      'Raising the resistance raises the density as its root and narrows the band as its reciprocal, and the ' +
      'two cancel. A nanofarad at 300 K holds 2.04 µV rms whatever charges it.',
  },
  shot: {
    name: 'Shot noise',
    def:
      'The noise a current carries because it crosses a barrier as separate charges, √(2qI) amps per root ' +
      'hertz. A milliamp makes 17.9 pA per root hertz. It depends on the current alone, so unlike thermal ' +
      'noise it does not change with temperature.',
  },
  granularity: {
    name: 'Why shot noise exists',
    def:
      'A current across a junction is a countable number of carriers arriving one at a time. The count in any ' +
      'interval has a spread, and that spread is the noise. A current flowing smoothly through a resistor has ' +
      'no barrier to cross and carries no shot noise of its own.',
  },
  noisefigure: {
    name: 'Noise figure',
    def:
      'How much worse the signal-to-noise ratio at an amplifier’s output is than the ratio at its source, in ' +
      'decibels. A figure of 0 dB means the amplifier added nothing of its own. The reference is the source ' +
      'resistance’s own thermal noise, so a figure is quoted with the source resistance it was measured at.',
  },
  optimumsource: {
    name: 'The optimum source resistance',
    def:
      'The source resistance at which an amplifier’s noise figure is least, √β/g_m for a bipolar stage. Below ' +
      'it the collector current’s noise dominates, above it the base current’s does, and the two cross at 259 Ω ' +
      'for this stage. It is a property of the amplifier, not of the signal.',
  },
  snr: {
    name: 'Signal-to-noise ratio',
    def:
      'The signal’s rms over the noise’s rms at the same point, usually in decibels. Both are read at one node ' +
      'and over one stated band, so a gain that multiplies both leaves the ratio alone. That is why the ratio ' +
      'and not the noise voltage is the number worth following through a chain.',
  },
  friis: {
    name: 'Friis’s formula',
    def:
      'A chain’s noise figure is the first stage’s, plus each later stage’s excess divided by all the gain in ' +
      'front of it. With enough gain in the first stage the later ones contribute almost nothing. The rule that ' +
      'follows is to put the quietest stage first and give it gain.',
  },
}

/** Each term's pattern, tried in the order the prose is read. */
export const MATCH_O = {
  density: /\bdensity\b/i,
  periodogram: /\bperiodogram\b|\bone frame\b/i,
  averaging: /\baveraged\b|\baveraging\b/i,
  thermal: /\bthermal noise\b/i,
  noisebandwidth: /\bnoise bandwidth\b/i,
  ktoverc: /\bkT\/C\b/,
  shot: /\bshot noise\b/i,
  granularity: /\bcountable\b/i,
  noisefigure: /\bnoise figure\b/i,
  optimumsource: /\boptimum\b/i,
  snr: /\bsignal-to-noise\b/i,
  friis: /\bFriis\b/i,
}
