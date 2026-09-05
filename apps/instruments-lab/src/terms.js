// Definitions, delivered where the term first does work — the suite's pattern
// (see circuit-elements-lab/src/terms.js). Each experiment lists the terms its
// lesson leans on, and the first place the prose spells one out is marked.
//
// House rules: two to four sentences; the first says what the thing IS, the
// rest why it matters here; concrete numbers over abstraction; no term defined
// using an undefined term.

export const TERMS = {
  inputz: {
    name: 'Input impedance',
    def:
      'The impedance an instrument shows at its terminals, which is what the circuit under test has to ' +
      'drive. A scope input is 1 MΩ in parallel with 15 pF, so it is a megohm at DC and 10.6 kΩ at 1 MHz. ' +
      'The higher it is, the less the reading changes the circuit.',
  },
  loading: {
    name: 'Loading',
    def:
      'The change an instrument makes to the circuit by being connected to it. A 10 MΩ voltmeter across a ' +
      'source of 500 kΩ reads 4.762 V where the true value is 5 V. Loading is a systematic error, so ' +
      'repeating the measurement does not reduce it.',
  },
  probe: {
    name: 'Probe',
    def:
      'The lead between the circuit and the instrument, and part of the measurement. A 1× probe passes the ' +
      'signal whole and puts the scope input straight on the node. A 10× probe divides by ten and shows the ' +
      'node 10 MΩ and 1.5 pF instead.',
  },
  compensation: {
    name: 'Compensation',
    def:
      'Setting a probe’s trimmer capacitor so that its RC product matches the scope input’s. When ' +
      'R1·C1 = R2·C2 the divider passes every frequency by the same factor. A square wave shows the mismatch ' +
      'as a rounded corner or an overshoot.',
  },
  bandwidth: {
    name: 'Bandwidth',
    def:
      'The frequency at which a response has fallen to 1/√2 of its low-frequency value, which is 3.01 dB ' +
      'down. For one pole it is 1/(2πRC). It also fixes the fastest edge an instrument can show, since ' +
      't_r · f₃ = ln 9/2π = 0.3497.',
  },
  risetime: {
    name: 'Rise time',
    def:
      'How long a step response takes to climb from 10 % to 90 % of its final value. For a single pole it ' +
      'is 2.197 time constants. A scope with a 100 MHz bandwidth cannot show an edge faster than 3.5 ns, ' +
      'whatever the signal did.',
  },
  samplerate: {
    name: 'Sample rate',
    def:
      'How many times a second a digital instrument reads its input, in samples per second. Between samples ' +
      'it knows nothing. At 10 kSa/s a 9 kHz tone gives the same numbers as a 1 kHz tone, so the two cannot ' +
      'be told apart from the samples alone.',
  },
  alias: {
    name: 'Alias',
    def:
      'The frequency a tone appears at once it has been sampled, |f − m·f_s| for the nearest whole m. It is ' +
      'not distortion, and no filter after the sampler removes it. Signal Lab’s Sampling group is the ' +
      'full treatment.',
  },
  antialias: {
    name: 'Anti-alias filter',
    def:
      'A low-pass filter in front of a sampler, there to make sure nothing above half the sample rate ' +
      'arrives. One pole is 40 dB down only a hundred times past its corner. So a scope samples far ' +
      'above its own analog bandwidth rather than filtering harder.',
  },
  shunt: {
    name: 'Shunt',
    def:
      'The low resistance an ammeter puts in the circuit so that a current becomes a voltage it can read. ' +
      'For a 10 A range at 100 mV full scale it is 10 mΩ, and it turns 1 W into heat. A smaller shunt ' +
      'disturbs the circuit less and gives the meter less to read.',
  },
  burden: {
    name: 'Burden voltage',
    def:
      'The voltage an ammeter drops across itself while measuring, equal to the current times its shunt. A ' +
      '1 Ω shunt carrying 98 mA drops 98 mV, which comes straight out of the circuit under test. It is why ' +
      'an ammeter in a 3 V supply line can stop the circuit working.',
  },
  buffer: {
    name: 'Buffer',
    def:
      'An op-amp wired so its output follows its input and draws almost no current from it. It is what lets ' +
      'a meter’s divider set the input resistance instead of the converter behind it. Elements E5 builds ' +
      'the same circuit around one op-amp.',
  },
  fourwire: {
    name: 'Four-wire measurement',
    def:
      'Forcing a known current down one pair of leads and sensing the voltage with another pair. The sense ' +
      'leads carry almost no current, so their resistance drops almost no voltage. It turns a 20 % error on ' +
      'a 1 Ω resistor into one part in ten million.',
  },
  rbw: {
    name: 'Resolution bandwidth',
    def:
      'The −3 dB width of the filter a spectrum analyser sweeps, in hertz. Two tones closer together than ' +
      'this appear as one. At 100 Hz the filter needs 3.2 ms to respond, so a narrow setting and a fast ' +
      'sweep cannot both be had.',
  },
  detector: {
    name: 'Detector',
    def:
      'The part of an analyser that turns the filter’s output into the height of the trace, by taking ' +
      'its rms over the dwell at each point. For two tones inside the filter the powers add, so the reading ' +
      'is √((a₁² + a₂²)/2).',
  },
  lockin: {
    name: 'Lock-in amplifier',
    def:
      'An instrument that multiplies its input by a reference at a known frequency and averages the result. ' +
      'Everything not at the reference frequency averages away. It reads a 10 mV signal as a steady 5 mV ' +
      'through a band of a few hertz.',
  },
  mixer: {
    name: 'Mixer',
    def:
      'A multiplier of two signals. For two sinusoids the product is exactly two sinusoids, one at the ' +
      'difference of the frequencies and one at their sum, each of half the amplitude product. At equal ' +
      'frequencies the difference term is a constant.',
  },
  quadrature: {
    name: 'Quadrature',
    def:
      'Ninety degrees of phase away from the reference. A lock-in’s output follows cos φ, so a signal in ' +
      'quadrature reads zero. A second channel driven 90° from the first catches it, and the two together ' +
      'give the amplitude and the phase.',
  },
  enbw: {
    name: 'Equivalent noise bandwidth',
    def:
      'The width of the ideal rectangular filter that passes as much noise power as the real one. For a ' +
      'single pole it is 1/(4RC), which is π/2 times the −3 dB frequency. It is the number a detection band ' +
      'is quoted in.',
  },
  count: {
    name: 'Count',
    def:
      'The smallest step a digital meter can display, equal to the range divided by one more than the ' +
      'number of counts. A 3½-digit meter has 1999 counts, so its 20 V range steps in 10 mV. Half a count ' +
      'is the resolution of any reading on it.',
  },
  accuracy: {
    name: 'Accuracy specification',
    def:
      'What a maker promises a reading is worth, usually as a per cent of the reading plus a number of ' +
      'counts. At 4.76 V with ±(0.5 % + 2 counts) the two terms are 23.8 mV and 20 mV. It says nothing ' +
      'about the error the meter made by being connected.',
  },
  sensitivity: {
    name: 'Sensitivity',
    def:
      'How much a result moves for a given move in one input, written here as ∂ln y/∂ln x so that per cents ' +
      'go in and per cents come out. For a divider of equal resistors the two sensitivities are −0.5 and ' +
      '+0.5. It is the first term of a Taylor series, so it is exact only in the limit.',
  },
  noisefloor: {
    name: 'Noise floor',
    def:
      'The smallest signal an instrument can show above its own noise. A 1 MΩ resistance at 300 K carries ' +
      '128.7 nV/√Hz of thermal noise, and across 15 pF that comes to 16.62 µV rms. Nothing in this lab ' +
      'generates noise, and both numbers are stated from their formulas.',
  },
}

/**
 * The pattern that finds each term in a sentence. Longer names first where two
 * overlap, so "resolution bandwidth" claims its words before "bandwidth".
 */
export const MATCH = {
  inputz: /\binput impedance\b/i,
  loading: /\bloads?\b|\bloading\b/i,
  probe: /\bprobes?\b/i,
  compensation: /\bcompensat\w*\b/i,
  bandwidth: /\b(?<!resolution )bandwidth\b/i,
  risetime: /\brise time\b/i,
  samplerate: /\bsample rate\b/i,
  alias: /\balias\w*\b/i,
  antialias: /\banti-alias\w*\b/i,
  shunt: /\bshunts?\b/i,
  burden: /\bburden voltage\b/i,
  buffer: /\bbuffers?\b/i,
  fourwire: /\bfour[- ]wires?\b/i,
  rbw: /\bresolution bandwidth\b/i,
  detector: /\bdetectors?\b/i,
  lockin: /\block-in\b/i,
  mixer: /\bmixer\b/i,
  quadrature: /\bquadrature\b/i,
  enbw: /\bequivalent noise bandwidth\b/i,
  count: /\bcounts?\b/i,
  accuracy: /\baccuracy\b/i,
  sensitivity: /\bsensitivit(?:y|ies)\b/i,
  noisefloor: /\bnoise floor\b/i,
}
