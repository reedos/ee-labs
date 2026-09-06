// Definitions, delivered where the term first does work. Each experiment lists
// the terms its notes lean on, and the sidebar offers them under the note.
//
// House rules: two to four sentences, the first saying what the thing IS and
// the rest why it matters here, concrete numbers over abstraction, and no term
// defined using an undefined term. terms.test.js checks the last of those by
// walking the experiments in order.
//
// `MATCH` is how a word is recognised in prose. It is a pattern per term rather
// than the term's own name, because a note says "dark current" where the term
// id is `darkcurrent`, and a rule that only caught the id would pass every
// lesson in the lab.

export const TERMS = {
  // ---------------------------------------------------------------- Group A
  photon: {
    name: 'Photon',
    def:
      'One quantum of light, carrying an energy of hc divided by its wavelength. At 1550 nm that is 0.7999 eV, ' +
      'and at 850 nm it is 1.459 eV. A detector counts photons, so every optical measurement in this lab is a ' +
      'count dressed as a current.',
  },
  wavelength: {
    name: 'Wavelength',
    def:
      'The distance one cycle of the light occupies in vacuum, in metres. Fibre work quotes it in nanometres, and ' +
      'the three windows are 850, 1310 and 1550 nm. The optical frequency is the speed of light divided by it, ' +
      'which at 1550 nm is 193.4 THz.',
  },
  electronvolt: {
    name: 'Electronvolt',
    def:
      'The energy an electron gains falling through one volt, 1.602 × 10⁻¹⁹ joules. Photon energies and material ' +
      'bandgaps are both quoted in it, so the two can be compared directly. A photon detected is a photon whose ' +
      'energy in electronvolts exceeds the bandgap in electronvolts.',
  },
  flux: {
    name: 'Photon flux',
    def:
      'Photons a second in a beam, which is the optical power divided by one photon’s energy. A milliwatt at ' +
      '1550 nm is about 7.8 × 10¹⁵ a second. The flux, not the power, is what sets the current a detector makes.',
  },
  photodiode: {
    name: 'Photodiode',
    def:
      'A reverse-biased junction that turns absorbed photons into current. In this lab it is four circuit ' +
      'elements rather than a formula, which are the bias, the load, the junction and a current source the light ' +
      'sets. Its operating point comes from the same solver every other diode in the suite uses.',
  },
  responsivity: {
    name: 'Responsivity',
    def:
      'Amps of photocurrent for each watt of light, written R. It is the quantum efficiency times the wavelength ' +
      'in micrometres divided by 1.23984. At a quantum efficiency of 0.8 and 1550 nm it is 1.000 A/W, which is why ' +
      'a microwatt reads as a microamp.',
  },
  reversebias: {
    name: 'Reverse bias',
    def:
      'A voltage applied to a junction the way it does not conduct. It widens the depletion region, which lowers ' +
      'the capacitance and sweeps out carriers faster. A photodiode is run this way so the photocurrent is flat ' +
      'against voltage and the detector is quick.',
  },
  loadline: {
    name: 'Load line',
    def:
      'The straight line the load resistor and the supply allow, drawn on the same axes as the device’s own ' +
      'curve. Where the two cross is the operating point. For a photodiode the device curve is flat, so the ' +
      'crossing moves only when the light or the load moves.',
  },
  bandgap: {
    name: 'Bandgap',
    def:
      'The energy an electron needs to cross from the valence band to the conduction band, in electronvolts. ' +
      'Silicon is 1.12 eV and indium gallium arsenide is about 0.75 eV. It decides both what a detector sees and ' +
      'what colour a source emits.',
  },
  cutoff: {
    name: 'Cut-off wavelength',
    def:
      'The longest wavelength a material still detects, hc divided by its bandgap. Silicon’s 1.12 eV puts it at ' +
      '1107 nm. Past the cut-off the responsivity is exactly zero rather than small, because a photon below the ' +
      'gap makes no carrier at all.',
  },
  darkcurrent: {
    name: 'Dark current',
    def:
      'The current a photodiode carries with no light on it, which is the junction’s reverse saturation current. ' +
      'A nanoamp of it is invisible under a microamp of photocurrent and doubles a nanoamp one. It sets the floor ' +
      'a receiver design has to get the signal above.',
  },
  junctioncapacitance: {
    name: 'Junction capacitance',
    def:
      'The capacitance of the depletion region, permittivity times area over width. It falls as reverse bias ' +
      'widens the region and rises in proportion to the detector’s area. With the load it makes a first-order ' +
      'lag, so it is what limits a detector’s speed.',
  },
  corner: {
    name: 'Corner frequency',
    def:
      'The frequency at which a first-order response is 3 dB down, one over two pi R C. A 100 µm detector into ' +
      '1 kΩ sits at 912 MHz. Above the corner the response falls at 6 dB an octave, which is 20 dB a decade.',
  },
  areabandwidth: {
    name: 'Area bandwidth product',
    def:
      'The detector’s area multiplied by the corner frequency it reaches into a given load. Because the ' +
      'capacitance rises with area and the corner falls with capacitance, the product does not depend on area at ' +
      'all. It is the figure of merit a detector is chosen on.',
  },

  // ---------------------------------------------------------------- Group C
  forwardbias: {
    name: 'Forward bias',
    def:
      'A voltage applied to a junction the way it does conduct. The current rises exponentially with it, so a ' +
      'wide range of currents sits inside a narrow range of volts. An LED and a laser are both run this way, at ' +
      'about 1.2 V for a 1550 nm device.',
  },
  shockley: {
    name: 'Shockley’s law',
    def:
      'The exponential law a junction carries current by, I_S times e to the voltage over n times the thermal ' +
      'voltage, less one. I_S and the ideality factor n are the two numbers that place the curve. It is the same ' +
      'law every diode in the suite is solved by.',
  },
  led: {
    name: 'Light-emitting diode',
    def:
      'A forward-biased junction whose recombining carriers leave as spontaneous light. Its power is linear in ' +
      'current and its speed is set by one carrier lifetime. At a 5.0 ns lifetime it is 31.831 MHz wide, which is ' +
      'why a fast fibre link uses a laser instead.',
  },
  laserdiode: {
    name: 'Laser diode',
    def:
      'The same forward-biased junction inside a cavity, so that recombination is driven by the light already ' +
      'there. Below threshold it behaves as an LED. Above it the carrier density stops rising and every extra ' +
      'electron leaves as light in one mode.',
  },
  recombination: {
    name: 'Recombination',
    def:
      'An electron and a hole meeting and disappearing, which is what a forward-biased junction does with its ' +
      'current. Spontaneous recombination sends a photon in any direction. Stimulated recombination sends one ' +
      'into the mode that provoked it, which is what makes a laser.',
  },
  internalefficiency: {
    name: 'Internal efficiency',
    def:
      'The fraction of recombining carriers that leave as photons rather than as heat. It multiplies the volts ' +
      'one photon costs to give the slope in milliwatts a milliamp. At 0.2 and 1550 nm that slope is ' +
      '0.15998 mW/mA.',
  },
  voltsperphoton: {
    name: 'Volts one photon costs',
    def:
      'The photon energy read as a voltage, hν over q, which is 0.79990 V at 1550 nm. An electron falling ' +
      'through it carries exactly one photon’s worth of energy. Every optical power in this group is that ' +
      'voltage times a current times an efficiency.',
  },
  carrierlifetime: {
    name: 'Carrier lifetime',
    def:
      'How long a carrier lasts in the active region before it recombines, written τ_c. It stands for every ' +
      'recombination path at once, which is the model. A 2.0 ns lifetime is typical of the material a 1550 nm ' +
      'device is grown in.',
  },
  modulationbandwidth: {
    name: 'Modulation bandwidth',
    def:
      'The frequency at which a device’s optical output is 3 dB below its low-frequency value. For an LED it is ' +
      'one over two pi times the carrier lifetime. Above it the response falls at 20 dB a decade, which is ' +
      '6.0206 dB an octave.',
  },
  threshold: {
    name: 'Threshold current',
    def:
      'The current at which a laser’s gain first equals its cavity loss, written I_th. Below it the carrier ' +
      'density is still rising and almost no light leaves. Above it the density is clamped and the output rises ' +
      'at the slope efficiency.',
  },
  slopeefficiency: {
    name: 'Slope efficiency',
    def:
      'How much optical power each extra milliamp above threshold buys, in milliwatts a milliamp. It is the ' +
      'differential efficiency times the volts one photon costs. At 0.4 and 1550 nm it is 0.31996 mW/mA.',
  },
  stimulated: {
    name: 'Stimulated emission',
    def:
      'A photon provoking a carrier to recombine and produce a second photon in the same mode. It is the term ' +
      'that couples the two rate equations. Its rate is the gain times the photon density, so it grows as the ' +
      'light in the cavity grows.',
  },
  gainclamp: {
    name: 'Gain clamping',
    def:
      'The carrier density holding still above threshold, because any rise would make the gain exceed the loss. ' +
      'It is why the kink at threshold is sharp. Every electron past threshold leaves as light rather than ' +
      'raising the density.',
  },
  photonlifetime: {
    name: 'Photon lifetime',
    def:
      'How long a photon stays in the cavity before it is lost, written τ_p. It is the index over the speed of ' +
      'light times the total loss per metre. A 100 µm cleaved chip of index 3.5 holds a photon for 1.9862 ps.',
  },
  mirrorloss: {
    name: 'Mirror loss',
    def:
      'The loss per metre that stands for light leaving through the two ends, one over twice the length times ' +
      'the logarithm of one over the reflectance. A 100 µm chip with 0.30864 facets loses 58.779 per cm. Some ' +
      'texts spread the same reflectance over a round trip and quote twice this.',
  },
  facet: {
    name: 'Facet',
    def:
      'A cleaved end of a semiconductor chip, which reflects because the index steps from 3.5 to 1. That step ' +
      'alone gives 0.30864, so a laser chip needs no mirror added. Coating a facet raises the reflectance and ' +
      'lowers the threshold.',
  },

  // ---------------------------------------------------------------- Group D
  rateequations: {
    name: 'The rate equations',
    def:
      'Two coupled equations for a laser, one counting carriers and one counting photons in the mode. Every ' +
      'term in them is a rate of density, per cubic metre a second. Setting both to zero gives the steady state, ' +
      'and that is algebra rather than an integration.',
  },
  carrierdensity: {
    name: 'Carrier density',
    def:
      'Electron-hole pairs for each cubic metre of the active region, written N. The pump raises it, ' +
      'recombination and stimulated emission lower it. Above threshold it is clamped at 1.6713 × 10²⁴ m⁻³ and ' +
      'stops responding to the drive.',
  },
  photondensity: {
    name: 'Photon density',
    def:
      'Photons for each cubic metre of the mode, written S. It is zero below threshold when no spontaneous ' +
      'light is coupled into the mode, and rises in a straight line above it. At twice threshold it is ' +
      '4.9792 × 10²⁰ m⁻³.',
  },
  pump: {
    name: 'The pump term',
    def:
      'The rate at which the drive current delivers carriers, I over q times the active volume. It is the only ' +
      'term the reader controls directly. At 26.777 mA into 10⁻¹⁶ m³ it is 1.6713 × 10³³ carriers a cubic metre ' +
      'a second.',
  },
  steadystate: {
    name: 'Steady state',
    def:
      'The densities at which both rate equations are zero, so nothing is changing. It is the root of one ' +
      'quadratic and is returned exactly at every current. Nothing about it is integrated, which is why this ' +
      'lab states it without a hedge.',
  },
  thresholddensity: {
    name: 'Threshold density',
    def:
      'The carrier density at which the gain equals one over the photon lifetime, written N_th. It is the ' +
      'transparency density plus one over the confinement factor times the differential gain times the photon ' +
      'lifetime. Here that is 1.6713 × 10²⁴ m⁻³.',
  },
  relaxation: {
    name: 'Relaxation oscillation',
    def:
      'The ringing between carriers and photons after the drive current moves, at 3.9844 GHz at twice threshold ' +
      'here. Carriers build the light, the light eats the carriers, and the pair overshoots. It is the fastest ' +
      'thing a directly modulated laser does.',
  },
  dampingratio: {
    name: 'Damping ratio',
    def:
      'How quickly a second-order response settles, written ζ. Below one over the square root of two the ' +
      'magnitude peaks, and the smaller ζ is the taller that peak stands. A laser at twice threshold has ζ of ' +
      '0.034848, so its peak is 23.141 dB high.',
  },
  linearisation: {
    name: 'Linearisation',
    def:
      'Replacing a nonlinear pair by the straight-line behaviour of small departures from one steady state. It ' +
      'produces an exactly rational second-order H(s), so it crosses to the rest of the suite without a hedge. ' +
      'The steady state it was taken at is part of the answer.',
  },
  modulationdepth: {
    name: 'Modulation depth',
    def:
      'How far a step moves the drive current, as a fraction of the bias. It is the knob the guard on the ' +
      'linearisation is written in. At 5 per cent the linear prediction misses the overshoot by 5.2639 per cent ' +
      'and at 30 per cent it misses by 26.760 per cent.',
  },
  overshoot: {
    name: 'Overshoot',
    def:
      'How far past its final value a response goes before settling, as a fraction of the step. A second-order ' +
      'response overshoots by e to minus pi ζ over the square root of one minus ζ squared. At ζ of 0.034848 ' +
      'that is most of the step again.',
  },
  guard: {
    name: 'Guard',
    def:
      'A stated threshold on an approximation, with what the pane does on each side of it. This lab draws the ' +
      'linear prediction plainly to 5 per cent depth, as an estimate to 30 per cent, and not at all past that. ' +
      'The two numbers come from the measured error, not from taste.',
  },

  // ---------------------------------------------------------------- Group E
  attenuation: {
    name: 'Attenuation',
    def:
      'The power a fibre takes out of the light, quoted in decibels a kilometre. Standard fibre is 0.20 dB/km at ' +
      '1550 nm. Because it is quoted in decibels, the loss of two spans in series is the sum of the two, which is ' +
      'what makes a link budget a sum.',
  },
  decibel: {
    name: 'Decibel',
    def:
      'Ten times the base-ten logarithm of a power ratio. A loss of 3 dB is a halving and 10 dB is a factor of ' +
      'ten. Ratios multiply, so decibels add, and every budget in this lab is written that way.',
  },
  dbm: {
    name: 'dBm',
    def:
      'A power level referred to one milliwatt, in decibels. Zero dBm is 1 mW, −30 dBm is 1 µW, and −60 dBm is ' +
      '1 nW. An optical level is quoted this way so that a loss in decibels can be subtracted from it directly.',
  },
  window: {
    name: 'Transmission window',
    def:
      'A band of wavelengths where silica happens to be quiet. The three are near 850, 1310 and 1550 nm. ' +
      'Scattering rises towards shorter wavelengths and an absorption band rises towards longer ones, which ' +
      'leaves 1550 nm as the quietest place to build a long link.',
  },
  dispersion: {
    name: 'Chromatic dispersion',
    def:
      'The spread a fibre adds to a pulse because different colours travel at different speeds. It is the ' +
      'dispersion parameter D times the length times the source’s spectral width. Standard fibre has D of about ' +
      '17 ps for each nanometre of width and each kilometre of length, at 1550 nm.',
  },
  spectralwidth: {
    name: 'Spectral width',
    def:
      'How many colours a source emits, as a width in nanometres. A light-emitting diode is tens of nanometres ' +
      'wide and a single-mode laser is a small fraction of one. The pulse spread is proportional to it, so a ' +
      'narrow source buys reach directly.',
  },
  beta2: {
    name: 'Group-velocity dispersion',
    def:
      'The same fibre property as D, written as the second derivative of the propagation constant against ' +
      'angular frequency. It is minus D times the wavelength squared over two pi c. At 1550 nm with D of 17 it is ' +
      '−21.68 ps² a kilometre, and the sign is opposite to D’s.',
  },
  bandwidthlimit: {
    name: 'Bandwidth limit',
    def:
      'The highest bit rate a spread pulse still allows, under a stated criterion. This lab holds the spread to a ' +
      'quarter of a bit period. A different criterion gives a different rate on the same fibre, so the pane names ' +
      'the one it used.',
  },
  criterion: {
    name: 'Dispersion criterion',
    def:
      'The rule that says how much pulse spread is too much, written as the spread times the bit rate. This lab ' +
      'uses 0.25. It is a definition rather than a measurement, so it is on the pane beside the number it ' +
      'produced.',
  },
  bandwidthdistance: {
    name: 'Bandwidth-distance product',
    def:
      'The bit rate a fibre allows multiplied by the length it allows it over. Both the spread and the rate scale ' +
      'with length, so the product does not, which makes it a property of the fibre and the source together. It ' +
      'is quoted in gigabits a second times kilometres.',
  },
  numericalaperture: {
    name: 'Numerical aperture',
    def:
      'The sine of the largest angle from the axis that a fibre still guides, the square root of the difference ' +
      'of the two squared indices. Standard single-mode fibre is about 0.125, which is an acceptance angle near ' +
      '7 degrees. A wider aperture takes more light and carries more modes.',
  },
  normalisedfrequency: {
    name: 'Normalised frequency V',
    def:
      'Two pi times the core radius times the numerical aperture, divided by the wavelength. It gathers the ' +
      'geometry, the glass and the colour into one number. How many modes a fibre carries depends on V alone.',
  },
  singlemode: {
    name: 'Single-mode fibre',
    def:
      'A fibre whose core is small enough that only one mode propagates, which happens below V of 2.405. At ' +
      '1550 nm that is a core under about 9.5 µm across. One mode means no spread from modes arriving at ' +
      'different times, which leaves chromatic dispersion as the only spread.',
  },
  linkbudget: {
    name: 'Link budget',
    def:
      'The transmitter’s power in dBm with every loss in the path subtracted from it. What remains is the power ' +
      'at the receiver. Every loss the model does not include is written as a line item of zero, so a zero on the ' +
      'waterfall is a decision rather than an omission.',
  },
  sensitivity: {
    name: 'Receiver sensitivity',
    def:
      'The least optical power a receiver can work at, in dBm, for a stated error rate. A link closes when the ' +
      'power arriving is above it. Where that number comes from is Group B’s subject, and here it is a knob.',
  },
  margin: {
    name: 'Margin',
    def:
      'The decibels between the power arriving and the receiver’s sensitivity. A link with no margin fails the ' +
      'first time a connector is dirty or a splice ages. Three decibels is a common figure to hold back when ' +
      'a reach is computed.',
  },
  reach: {
    name: 'Reach',
    def:
      'How far a link runs before one of its two limits stops it. The loss-limited reach is what the power ' +
      'budget pays for. The dispersion-limited reach is where the pulse spread breaks the criterion, and the ' +
      'shorter of the two is the answer.',
  },

  // ---------------------------------------------------------------- Group F
  cavity: {
    name: 'Fabry-Perot cavity',
    def:
      'Two mirrors facing each other with a length of material between them. Light that returns in phase after a ' +
      'round trip adds to itself, so the transmission peaks at evenly spaced frequencies. A cleaved semiconductor ' +
      'chip is one, with no mirrors added.',
  },
  freespectralrange: {
    name: 'Free spectral range',
    def:
      'The frequency spacing between one cavity resonance and the next, the speed of light over twice the ' +
      'optical length. A 300 µm chip of index 3.5 gives 142.8 GHz. In wavelength at 1550 nm that is 1.144 nm.',
  },
  finesse: {
    name: 'Finesse',
    def:
      'How many linewidths fit into one free spectral range, pi times the square root of the reflectance over ' +
      'one minus it. A bare cleaved facet gives about 2.5. A reflectance of 0.99 gives 313, and the peaks become ' +
      'spikes.',
  },
  linewidth: {
    name: 'Linewidth',
    def:
      'The width of one cavity resonance at half its height, which is the free spectral range divided by the ' +
      'finesse. The chip cavity’s lines are 56.5 GHz wide. Raising the reflectance narrows them without moving ' +
      'the spacing between them.',
  },
  grid: {
    name: 'Channel grid',
    def:
      'The fixed frequency spacing multiplexed channels are placed on, commonly 50 or 100 GHz. It is stated in ' +
      'frequency because that spacing is the same across the band, while the same spacing in wavelength is not. ' +
      'A 100 GHz grid at 1550 nm is 0.801 nm wide.',
  },
  cband: {
    name: 'C band',
    def:
      'The conventional band for long-haul fibre, 1530 to 1565 nm. It is 4.38 THz wide, which holds 43 channels ' +
      'on a 100 GHz grid. It sits where both the fibre loss and the erbium amplifier’s gain are convenient.',
  },
  multiplexing: {
    name: 'Wavelength multiplexing',
    def:
      'Running several channels down one fibre, each on its own wavelength. The fibre’s capacity becomes the ' +
      'channel count times the rate each channel carries. Each source has to be narrower than the grid spacing, ' +
      'or its light lands in a neighbour’s channel.',
  },
}

/** How a term's word is recognised in prose. One pattern per term. */
export const MATCH = {
  photon: /\bphotons?\b/i,
  wavelength: /\bwavelengths?\b/i,
  electronvolt: /\belectronvolts?\b|\beV\b/,
  flux: /\bflux\b/i,
  photodiode: /\bphotodiodes?\b/i,
  responsivity: /\bresponsivit(y|ies)\b/i,
  reversebias: /\breverse (bias|voltage)\b/i,
  loadline: /\bload line\b/i,
  bandgap: /\bband ?gaps?\b/i,
  cutoff: /\bcut-?off\b/i,
  darkcurrent: /\bdark current\b/i,
  junctioncapacitance: /\bjunction capacitance\b/i,
  corner: /\bcorner\b/i,
  areabandwidth: /\barea bandwidth\b/i,
  forwardbias: /\bforward(-| )bias(ed)?\b/i,
  shockley: /\bShockley\b/,
  led: /\bLED\b|\blight-emitting diode\b/,
  laserdiode: /\blaser diode\b|\blasers?\b/i,
  recombination: /\brecombin(ation|es?|ing|ed)\b/i,
  internalefficiency: /\binternal efficiency\b/i,
  voltsperphoton: /\bvolts one photon costs\b/i,
  carrierlifetime: /\bcarrier lifetime\b/i,
  modulationbandwidth: /\bmodulation bandwidth\b/i,
  threshold: /\bthreshold\b/i,
  slopeefficiency: /\bslope efficiency\b/i,
  stimulated: /\bstimulated\b/i,
  gainclamp: /\bclamp(s|ed|ing)?\b/i,
  photonlifetime: /\bphoton lifetime\b/i,
  mirrorloss: /\bmirror loss\b/i,
  facet: /\bfacets?\b/i,
  rateequations: /\brate equations\b/i,
  carrierdensity: /\bcarrier density\b/i,
  photondensity: /\bphoton density\b/i,
  pump: /\bpump\b/i,
  steadystate: /\bsteady state\b/i,
  thresholddensity: /\bthreshold density\b/i,
  relaxation: /\brelaxation\b/i,
  dampingratio: /\bdamping ratio\b/i,
  linearisation: /\blinearis(ation|ed|e)\b/i,
  modulationdepth: /\bmodulation depth\b/i,
  overshoot: /\bovershoot(s|ing)?\b/i,
  guard: /\bguard\b/i,
  attenuation: /\battenuation\b/i,
  decibel: /\bdecibels?\b|\bdB\b/,
  dbm: /\bdBm\b/,
  window: /\bwindows?\b/i,
  dispersion: /\bdispersion\b/i,
  spectralwidth: /\b(spectral width|source width)\b/i,
  beta2: /\bgroup-velocity dispersion\b/i,
  bandwidthlimit: /\blimited to\b|\bbandwidth limit\b/i,
  criterion: /\bcriterion\b/i,
  bandwidthdistance: /\bbandwidth-distance\b/i,
  numericalaperture: /\bnumerical aperture\b/i,
  normalisedfrequency: /\bnormalised frequency\b/i,
  singlemode: /\bsingle-mode\b/i,
  linkbudget: /\blink budget\b/i,
  sensitivity: /\bsensitivity\b/i,
  margin: /\bmargins?\b/i,
  reach: /\breach(es)?\b/i,
  cavity: /\bcavity\b/i,
  freespectralrange: /\bfree spectral range\b/i,
  finesse: /\bfinesse\b/i,
  linewidth: /\blinewidths?\b/i,
  grid: /\bgrid\b/i,
  cband: /\bC band\b/,
  multiplexing: /\bmultiplex(ed|ing)\b/i,
}

/** The definitions an experiment lists, in the order it lists them. */
export const termsFor = (ids = []) => ids.filter((id) => TERMS[id]).map((id) => ({ id, ...TERMS[id] }))
