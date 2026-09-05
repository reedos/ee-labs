// Group D's terms, merged into the one registry by terms.js.
//
// House rules, as terms.js states them: two to four sentences, the first
// saying what the thing IS, concrete numbers over abstraction, and no term
// defined out of another that is not defined yet. A pattern is matched
// against the prose in reading order, so it has to be specific enough not to
// claim words a different term needs.

export const TERMS_D = {
  ebersmoll: {
    name: 'The Ebers–Moll model',
    def:
      'The transistor written as two junction diodes and one controlled source that carries current across the ' +
      'base from the emitter junction to the collector. Each junction takes its own share of base current, ' +
      'I_S/β of what crosses. Nothing else is in it, which is why the curve is an exponential in v_BE.',
  },
  currentgain: {
    name: 'Current gain, β and α',
    def:
      'The two ratios a transistor is described by. β is the collector current over the base current, 100 for ' +
      'the device here. α is the collector current over the emitter current, β/(β + 1), which is 0.990 at ' +
      'β = 100. A base thin enough to lose almost nothing puts α near one, and β is what is left over.',
  },
  operatingpoint: {
    name: 'The operating point',
    def:
      'The steady currents and voltages a circuit settles at with no signal applied, here (I_C, V_CE). Every ' +
      'small-signal number a later group quotes is a slope taken at this point. Move it and every one of them ' +
      'moves, which is why bias comes before amplification.',
  },
  earlyvoltage: {
    name: 'The Early voltage, V_A',
    def:
      'The one number that says how far from flat a transistor’s curves are in the active region. Collector ' +
      'current rises as (1 + v_CE/V_A), so every curve of the family extrapolates back to the same point on ' +
      'the voltage axis, v_CE = −V_A. At 100 V, the current climbs 1 % for each volt on the collector.',
  },
  threeregions: {
    name: 'The three-region model',
    def:
      'The transistor drawn as three straight pieces instead of a curve. Cut off, everything is open. Active, ' +
      'v_BE is 0.7 V and i_C is β i_B. Saturated, v_BE is 0.7 V and v_CE is pinned at 0.2 V. It is the model a ' +
      'hand analysis uses, and it is piecewise-linear, so every exact method in the engine applies to it.',
  },
  squarelaw: {
    name: 'The square law',
    def:
      'The MOSFET’s current law in saturation, i_D = ½k_n(v_GS − V_t)². It is a parabola rather than an ' +
      'exponential, so the same 100 mV of extra gate drive buys far less current than it would at a junction. ' +
      'In triode the law is i_D = k_n(V_OV v_DS − v_DS²/2), and the two meet at v_DS = V_OV.',
  },
  overdrive: {
    name: 'Overdrive voltage, V_OV',
    def:
      'How far the gate is driven past the threshold, v_GS − V_t. It is the number the square law is really ' +
      'written in, and it is also the drain voltage below which the device leaves saturation. At V_OV = 0.2 V ' +
      'and k_n = 20 mA/V², the drain carries 0.4 mA.',
  },
  channelmod: {
    name: 'Channel-length modulation, λ',
    def:
      'The MOSFET’s version of the Early effect: drain current in saturation rises as (1 + λ v_DS) rather than ' +
      'staying flat. At λ = 0.02 V⁻¹ and 0.4 mA, the slope is an output resistance of 125 kΩ. Setting λ to ' +
      'zero makes the curves flat and the output resistance infinite.',
  },
  forcedbeta: {
    name: 'Forced β',
    def:
      'The ratio i_C/i_B a saturated transistor actually shows, which is smaller than its own β because the ' +
      'load, not the device, is setting the collector current. Driving the base well past I_C/β is what holds ' +
      'a switch down at 0.2 V. Here 0.43 mA of base current carries 9.80 mA of load, a forced β of 22.8.',
  },
  noisemargin: {
    name: 'Noise margins, V_IL and V_IH',
    def:
      'The two input voltages where a logic gate’s transfer curve has a slope of exactly −1. Between them the ' +
      'gate amplifies, and outside them it restores. A matched inverter on 5 V with V_t = 0.7 V has ' +
      'V_IL = 2.05 V and V_IH = 2.95 V. Either input then has about 2 V of room before the gate stops ' +
      'cleaning its input up.',
  },
  loadline: {
    name: 'The load line',
    def:
      'The straight line a supply and a resistor draw across the device’s curves, i_C = (V_CC − v_CE)/R_C. It ' +
      'is Ohm’s law for the load, so the circuit sits somewhere on it. Where it crosses the curve for the ' +
      'drive applied is the operating point. From 10 V and 5 kΩ it runs to 2 mA at no volts.',
  },
}

export const MATCH_D = {
  ebersmoll: /\bEbers–Moll\b/,
  currentgain: /\bcurrent gain\b/i,
  operatingpoint: /\boperating point\b/i,
  earlyvoltage: /\bEarly voltage\b/,
  threeregions: /\bthree-region\b|\bthree regions\b/i,
  squarelaw: /\bsquare law\b/i,
  overdrive: /\boverdrive\b/i,
  channelmod: /\bchannel-length modulation\b/i,
  forcedbeta: /\bforced β/i,
  noisemargin: /\bnoise margins?\b/i,
  loadline: /\bload line\b/i,
}
