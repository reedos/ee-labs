// Definitions, delivered where the term first does work — the suite's pattern
// (packages/ui's convention, `apps/circuit-elements-lab/src/terms.js` the
// model here). Each experiment lists the terms its note leans on and the
// sidebar offers them folded under the note, tappable where they first do
// work in the prose.
//
// House rules: two or three sentences; the first says what the thing IS, the
// rest why it matters here; concrete numbers over abstraction; no term
// defined using an undefined term.

import { TERMS_D, MATCH_D } from './groups/d.terms.js'
import { TERMS_E, MATCH_E } from './groups/e.terms.js'
import { MATCH_F, TERMS_F } from './groups/f.terms.js'
import { MATCH_G, TERMS_G } from './groups/g.terms.js'
import { MATCH_H, TERMS_H } from './groups/h.terms.js'
import { MATCH_I, TERMS_I } from './groups/i.terms.js'
import { MATCH_J, TERMS_J } from './groups/j.terms.js'
import { MATCH_K, TERMS_K } from './groups/k.terms.js'
import { MATCH_L, TERMS_L } from './groups/l.terms.js'
import { MATCH_M, TERMS_M } from './groups/m.terms.js'

export const TERMS = {
  ...TERMS_D,
  ...TERMS_E,
  ...TERMS_J,
  ...TERMS_K,
  ...TERMS_L,
  ...TERMS_M,
  opampmacro: {
    name: 'The op-amp macro',
    def:
      'The single op-amp element, expanded at build time into the parts that give it a speed, an offset, a ' +
      'bias current and an output limit. With every one of those fields absent it expands to exactly the ' +
      'ideal box Circuit Elements Lab drew. That box has infinite gain-bandwidth, no offset, no bias current.',
  },
  offset: {
    name: 'Offset voltage, V_OS',
    def:
      'A mismatch inside the input stage that looks, from outside the amplifier, like a small battery of a ' +
      'millivolt or so in series with one input. Nothing downstream can tell it from a real signal. It comes ' +
      'out multiplied by whatever the closed-loop gain is.',
  },
  loopgain: {
    name: 'Loop gain',
    def:
      'How much of a signal survives one trip around the feedback loop before it comes back to compare against ' +
      'itself. A large loop gain is what makes a closed loop track the resistors and ignore the amplifier ' +
      'underneath. Group L breaks the loop and measures this number directly.',
  },
  biascurrent: {
    name: 'Bias current, I_B',
    def:
      'The small current every input of a real op-amp draws to keep its own input transistors on, typically ' +
      'tens to hundreds of nanoamps. It has nowhere to come from but whatever the input is wired to. It makes ' +
      'a voltage there exactly as a stray resistor would.',
  },
  gbw: {
    name: 'Gain-bandwidth product',
    def:
      'The frequency at which the open-loop gain, falling at one pole, reaches unity. It is also, near enough, ' +
      'the constant product of any closed-loop gain and the bandwidth left to that gain. A part rated at ' +
      '1 MHz gives a gain of 10 a bandwidth near 100 kHz, and a gain of 100 one near 10 kHz.',
  },
  pole: {
    name: 'Pole',
    def:
      'A frequency at which a response’s denominator vanishes. Past it the magnitude falls at 20 dB per ' +
      'decade for every pole active there, and the phase drops by 90°. The op-amp’s open-loop gain has one, ' +
      'and the closed loop inherits it, moved out by the loop gain.',
  },
  corner: {
    name: 'The −3 dB corner',
    def:
      'The frequency at which a response has fallen to 1/√2 of its flat value, half the power, hence the ' +
      'name. Below it the circuit is flat. Above it the pole nearest that frequency is what is heard.',
  },
  slew: {
    name: 'Slew rate, SR',
    def:
      'The fastest the output of a real amplifier can move, in volts per microsecond, set by a fixed current ' +
      'charging a fixed capacitor inside it. It is a large-signal limit and has nothing to do with the ' +
      'small-signal bandwidth. A signal too small to need the full current never meets it.',
  },
  currentlimit: {
    name: 'Output current limit',
    def:
      'The largest current the output stage is built to deliver before it protects itself, typically tens of ' +
      'milliamps. Into a light load this is never reached and the rails decide the swing. Into a heavy one it ' +
      'is reached first, and the clip level then depends on the load rather than on the supply.',
  },
  cmrr: {
    name: 'Common-mode rejection ratio, CMRR',
    def:
      'How well an amplifier ignores a voltage applied equally to both inputs, in decibels of the differential ' +
      'gain over the common-mode gain. At 90 dB, five volts of common-mode signal shows up as 158 µV of input ' +
      'error. That is small, but not nothing once the differential gain is high.',
  },
  precision: {
    name: 'The precision rectifier',
    def:
      'A diode placed inside an op-amp’s feedback loop rather than on its own. The loop’s gain divides the ' +
      'diode’s forward drop by the open-loop gain. A signal of a few millivolts, far below what a bare diode ' +
      'would pass, still gets rectified with almost none of the drop showing.',
  },
  junction: {
    name: 'The pn junction',
    def:
      'Where a p-doped and an n-doped region of the same crystal meet. Carriers cross the boundary, leave ' +
      'their donors and acceptors behind as fixed charge, and that exposed charge builds a barrier, the ' +
      'built-in potential, that stops the rest from following. Every later closed form in this group is a ' +
      'consequence of that one barrier.',
  },
  depletion: {
    name: 'The depletion region',
    def:
      'The zone straddling the junction that carriers have left behind, empty of the free charge that carries ' +
      'current elsewhere in the crystal, which is where its name comes from. Its width sets the junction’s ' +
      'capacitance. A wider gap between charged plates stores less charge per volt.',
  },
  builtin: {
    name: 'Built-in potential, V_0',
    def:
      'The barrier voltage a junction builds on its own, with no bias applied, from the doping alone, ' +
      'V_0 = V_T ln(N_A N_D/n_i²). It is larger than the 0.7 V a diode is said to drop. An applied forward ' +
      'bias only ever lowers the barrier partway there.',
  },
  junctioncap: {
    name: 'Junction (depletion) capacitance, C_j',
    def:
      'The small-signal capacitance of the depletion region, C_j = C_j0/√(1 − v/V_0). Reverse bias widens the ' +
      'gap and the capacitance falls. Forward bias narrows it and the capacitance climbs, without bound as ' +
      'the bias nears V_0. It is the transistor’s C_μ under another name.',
  },
  diffusioncap: {
    name: 'Diffusion capacitance, C_d',
    def:
      'The capacitance a forward-biased junction carries because it stores charge in transit rather than at ' +
      'the depletion region, C_d = τ_F g_m, the transit time times the transconductance. It rises with ' +
      'current where C_j falls with reverse voltage. It is most of a transistor’s C_π.',
  },
  transit: {
    name: 'Transit time, τ_F',
    def:
      'The average time a carrier spends crossing the base before it is collected, a property of the ' +
      'device’s geometry rather than its bias. The charge a forward junction stores is this time times the ' +
      'current flowing. That is where the diffusion capacitance comes from.',
  },
  transitfreq: {
    name: 'Transition frequency, f_T',
    def:
      'The frequency at which a transistor’s short-circuit current gain falls to one, ' +
      'f_T = g_m/(2π(C_π + C_μ)). It rises with bias current because g_m does, but only up to a ceiling set ' +
      'by the transit time alone, 1/(2πτ_F). There the diffusion capacitance has come to dominate C_π.',
  },
  saturationcurrent: {
    name: 'Saturation current, I_S(T)',
    def:
      'The constant in Shockley’s law, i = I_S(e^{v/V_T} − 1), and a strong function of temperature, ' +
      'I_S ∝ T³e^{−E_g/kT}. Because the exponential dominates, I_S very nearly doubles for every 4.5 K near ' +
      'room temperature. That is why a forward-biased junction left to itself runs away.',
  },
  tempco: {
    name: 'V_BE’s temperature coefficient',
    def:
      'How much a junction’s forward voltage has to fall, at a fixed current, to keep pace with I_S(T)’s ' +
      'rise, about −1.7 mV per kelvin near 0.7 V. It is the same law as I_S(T), read the other way round. A ' +
      'bias point built from a diode drop drifts with temperature unless something compensates it.',
  },
  ...TERMS_F,
  ...TERMS_G,
  ...TERMS_H,
  ...TERMS_I,
}

/** Every term's pattern, tried in the order the prose is read. */
export const MATCH = {
  ...MATCH_D,
  ...MATCH_E,
  ...MATCH_J,
  ...MATCH_K,
  ...MATCH_L,
  ...MATCH_M,
  opampmacro: /\bop-amp macro\b|\bmacro\b/i,
  offset: /\boffset voltage\b|\boffset\b/i,
  loopgain: /\bloop(?: gain| has)\b|\bclosed[- ]loop gain\b/i,
  biascurrent: /\bbias current\b/i,
  gbw: /\bgain-bandwidth\b|\bf_t\b|\bone pole\b/i,
  pole: /\bpole\b/i,
  corner: /\bcorner\b|−3\s*dB/i,
  slew: /\bslew rate\b|\bslew\b/i,
  currentlimit: /\bcurrent limit\b|\bcurrent-limited\b/i,
  cmrr: /\bCMRR\b|common-mode rejection|common mode/i,
  precision: /\bprecision rectifier\b/i,
  junction: /\bjunction\b/i,
  depletion: /\bdepletion region\b|\bdepletion\b/i,
  builtin: /\bbuilt-in potential\b/i,
  junctioncap: /\bjunction capacitance\b|\bC_j\b/i,
  diffusioncap: /\bdiffusion capacitance\b|\bC_d\b/i,
  transit: /\btransit time\b|\bτ_F\b/i,
  transitfreq: /\btransition frequency\b|\bf_T\b/,
  saturationcurrent: /\bsaturation current\b|\bI_S\b/i,
  tempco: /\btemperature coefficient\b|\bmV\/K\b|dV_BE\/dT/i,
  ...MATCH_F,
  ...MATCH_G,
  ...MATCH_H,
  ...MATCH_I,
}
