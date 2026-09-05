// Group F's terms, merged into the one registry by terms.js.
//
// The house rules are that file's: two or three sentences, the first saying
// what the thing is, concrete numbers over abstraction, and no term defined
// with a term that is not defined. Every number below is the reading Group F's
// own experiments produce at their defaults.

export const TERMS_F = {
  smallsignalslope: {
    name: 'The small-signal slope',
    def:
      'The slope of a device’s own curve at the bias it is sitting at, which is what a signal too small to ' +
      'move that bias travels along. A junction carrying 1.00 mA has a slope of 25.85 Ω, and a transistor ' +
      'passing 1.00 mA has one of 38.68 mA/V. Both are V_T divided by the current, read one way up or the other.',
  },
  operatingpoint: {
    name: 'The operating point',
    def:
      'The DC voltages and currents a circuit settles at with no signal applied, quoted as a pair such as ' +
      'V_CE = 5.00 V and I_C = 1.00 mA. Every small-signal number is a property of that point rather than of ' +
      'the device on its own. Move the point and the slope, the input resistance and the gain all move.',
  },
  superposition: {
    name: 'Superposition',
    def:
      'A linear circuit’s response to two sources at once is the sum of its responses to each alone. It is ' +
      'what allows a meter to print 5.00 V and 184.6 mV of signal as two separate numbers on one wire. The ' +
      'transistor itself is not linear, so the split holds only as far as its tangent describes its curve.',
  },
  hybridpi: {
    name: 'The hybrid-π model',
    def:
      'The small-signal netlist a bipolar transistor becomes at its operating point. A resistance r_π sits ' +
      'between base and emitter, a current source of g_m v_be runs from collector to emitter, and r_o sits ' +
      'across that source. At 1.00 mA and 5 V they read 2.71 kΩ, 38.68 mA/V and 105.0 kΩ.',
  },
  quasistatic: {
    name: 'The quasi-static sweep',
    def:
      'One exact DC solution per input value, walked across a range and drawn as output against input. It ' +
      'describes an input slow enough that no capacitance has time to matter. The transfer characteristic and ' +
      'the distortion figures in this group are both read off it.',
  },
  harmonic: {
    name: 'The second harmonic',
    def:
      'A component at twice the input frequency, made by the curvature of a device’s law rather than by ' +
      'anything in the input. HD2 states its amplitude as a fraction of the fundamental’s. A 5.00 mV peak on ' +
      'a bipolar base gives 4.4 %, and doubling the drive roughly doubles it.',
  },
  amplitudeguard: {
    name: 'The amplitude guard',
    def:
      'The drive past which this lab stops presenting the straight line as the answer, 4.14 mV on a bipolar ' +
      'base. The second harmonic the series predicts is 4 % of the fundamental there. Past the guard the math ' +
      'panel footnotes the straight line with that reason rather than checking it.',
  },
  squarelaw: {
    name: 'The square law',
    def:
      'The MOSFET’s saturation current, i_D = ½k_n(v_GS − V_t)²(1 + λv_DS). A square rather than an ' +
      'exponential, which is why its slope climbs as the square root of the current where a bipolar ' +
      'device’s climbs in proportion to it.',
  },
  overdrive: {
    name: 'The overdrive voltage, V_OV',
    def:
      'How far a MOSFET’s gate sits above its threshold, v_GS − V_t. It is the one number the square law ' +
      'depends on, and 200 mV of it gives 440 µA of drain current here. The device’s slope is twice the ' +
      'current divided by it.',
  },
  channelmodulation: {
    name: 'Channel-length modulation, λ',
    def:
      'The slow rise of drain current with drain voltage in saturation, written as a factor of 1 + λv_DS. It ' +
      'gives the device a finite output resistance of 1/(λI_D), 125.0 kΩ at λ = 0.02 V⁻¹ and 400 µA. With λ ' +
      'at zero the current in saturation would not depend on the drain at all.',
  },
}

/** Each term's pattern, tried in the order the prose is read. */
export const MATCH_F = {
  smallsignalslope: /\bsmall-signal slope\b/i,
  operatingpoint: /\boperating point\b/i,
  superposition: /\bsuperposition\b/i,
  hybridpi: /\bhybrid-π/i,
  quasistatic: /\bquasi-static\b/i,
  harmonic: /\bsecond harmonic\b/i,
  amplitudeguard: /\bamplitude guard\b/i,
  squarelaw: /\bsquare law\b/i,
  overdrive: /\boverdrive\b/i,
  channelmodulation: /\bchannel-length modulation\b/i,
}
