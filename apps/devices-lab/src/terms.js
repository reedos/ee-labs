// Definitions, delivered where the term first does work.
//
// Each experiment lists the terms its note leans on, and the first place the
// prose uses one is marked and opens its definition on tap. A term is
// introduced by the first experiment that lists it, and terms.test.js checks
// that no earlier experiment uses the word, so nothing arrives before its
// meaning.
//
// House rules: two or three sentences. The first says what the thing is, the
// rest say why it matters here. Concrete numbers over abstraction, and no term
// defined using an undefined term.

export const TERMS = {
  carrier: {
    name: 'Carrier',
    def:
      'A mobile charge in the crystal. Electrons in the conduction band carry negative charge and holes in the ' +
      'valence band carry positive charge. Both move under a field, and both count toward a current.',
  },
  doping: {
    name: 'Doping',
    def:
      'Atoms put into the crystal on purpose to set how many of each carrier there are. A donor gives up an ' +
      'electron and an acceptor takes one. At 10¹⁶ cm⁻³ that is one dopant atom for every five million silicon ' +
      'atoms, and it changes the conductivity by six decades.',
  },
  massaction: {
    name: 'The law of mass action',
    def:
      'In equilibrium the product of the two carrier concentrations is fixed at n_i², whatever the doping is. ' +
      'Adding donors raises the electrons and lowers the holes by the same factor. It holds because generation ' +
      'and recombination balance at every point.',
  },
  intrinsic: {
    name: 'The intrinsic concentration, n_i',
    def:
      'How many electron and hole pairs thermal energy alone makes, in undoped silicon. At 300 K the suite uses ' +
      '1.5 × 10¹⁰ cm⁻³. It is the smallest concentration a doped sample can have of either carrier.',
  },
  bandgap: {
    name: 'Band gap, E_g',
    def:
      'The energy between the top of the valence band and the bottom of the conduction band. Silicon is 1.12 eV ' +
      'at 300 K. An electron needs that much to leave a bond and become mobile, so the gap sets how strongly ' +
      'n_i depends on temperature.',
  },
  bandedge: {
    name: 'Band-edge densities, N_c and N_v',
    def:
      'How many states each band offers within about kT of its edge. They come from the effective masses, which ' +
      'are measured rather than derived. Green’s 1990 values are 2.86 × 10¹⁹ and 2.66 × 10¹⁹ cm⁻³, and they ' +
      'are data here.',
  },
  extrinsic: {
    name: 'Extrinsic',
    def:
      'A sample whose majority carriers come from its dopants rather than from thermal pairs. It stays extrinsic ' +
      'while the net doping is far above n_i. Warming the sample raises n_i until the two are comparable, and ' +
      'the doping stops deciding anything.',
  },
  fermilevel: {
    name: 'Fermi level, E_F',
    def:
      'The energy at which a state is half likely to be occupied. Its distance above the intrinsic level is ' +
      'kT ln(n/n_i), so it reads the doping directly. One decade of doping moves it 59.5 meV at 300 K.',
  },
  banddiagram: {
    name: 'Band diagram',
    def:
      'The four energies drawn against position: the conduction edge, the valence edge, the intrinsic level and ' +
      'the Fermi level. In one uniform piece of silicon all four are flat. Bending appears only where the ' +
      'potential varies, which is what a junction does.',
  },

  depletion: {
    name: 'The depletion region',
    def:
      'The zone at a junction that the mobile carriers have left, so only the fixed dopant charge remains. It is ' +
      'a few hundred nanometres wide at these dopings. Calling it empty is a labelled model, and its error is ' +
      'the carrier tails at the two edges.',
  },
  neutrality: {
    name: 'Charge neutrality',
    def:
      'The two sides of a junction expose equal and opposite charge, so N_A x_p = N_D x_n. The lightly doped ' +
      'side has to give more width to expose the same charge. That is why a one-sided junction spreads almost ' +
      'entirely into the lighter side.',
  },
  stepjunction: {
    name: 'Step junction',
    def:
      'A junction whose doping changes abruptly at one plane, from N_A on one side to N_D on the other. Every ' +
      'closed form in this group assumes it. A junction graded gradually gives the same shapes with different ' +
      'exponents.',
  },
  poisson: {
    name: 'Poisson’s equation',
    def:
      'The relation between charge density and potential, d²ψ/dx² = −ρ/ε. Integrated once it gives the field, ' +
      'and integrated again it gives the potential. Over a step charge both integrals are polynomials, so ' +
      'nothing here is on a grid.',
  },
  gauss: {
    name: 'Gauss’s law',
    def:
      'The field leaving a closed surface is the charge inside it over the permittivity. Across the whole ' +
      'depletion region the enclosed charge is zero, so the field is zero at both edges. That is the check the ' +
      'profile has to pass at every bias.',
  },
  builtin: {
    name: 'The built-in potential, V₀',
    def:
      'The barrier the exposed dopant charge builds, from the doping alone. It is V_T ln(N_A N_D/n_i²), which is ' +
      '752.9 mV at 10¹⁷ and 10¹⁶ cm⁻³. No applied bias ever reaches it, because at that bias there is no ' +
      'region left to describe.',
  },
  saturationcurrent: {
    name: 'Saturation current, I_S',
    def:
      'The one constant in Shockley’s law, and the current the junction would pass in reverse if no leakage ' +
      'existed. It follows from the area, the dopings, the diffusion constants and the lifetimes. Nothing about ' +
      'it is a datasheet number.',
  },
  diffusionlength: {
    name: 'Diffusion length, L',
    def:
      'How far a minority carrier travels before it recombines, which is √(Dτ). At a lifetime of 1 µs it is tens ' +
      'of micrometres in silicon. It sets how much of the injected charge reaches the other side.',
  },
  einstein: {
    name: 'Einstein’s relation',
    def:
      'Diffusion and drift come from the same random motion, so D = (kT/q)µ. A mobility measured in a field ' +
      'therefore gives the diffusion constant with no second measurement. At 300 K the factor is 25.852 mV.',
  },
  junctioncap: {
    name: 'Junction capacitance, C_j',
    def:
      'The slope of the stored depletion charge against the bias, which is ε_s/W per unit area. Reverse bias ' +
      'widens the region and lowers it, following the square root of the barrier. It is the transistor’s ' +
      'C_µ under another name.',
  },
  breakdown: {
    name: 'Breakdown',
    def:
      'The reverse bias at which the junction starts conducting hard. It is not damage, and a diode run inside ' +
      'its power rating recovers. What decides the voltage is the peak field reaching a number the material ' +
      'sets.',
  },
  avalanche: {
    name: 'Avalanche',
    def:
      'A carrier accelerated by the field knocks another pair loose, and each new carrier does the same. In ' +
      'silicon it runs away near 3 × 10⁵ V/cm. It needs enough width to accelerate in, so it is the mechanism ' +
      'of the more lightly doped junction.',
  },
  tunnelling: {
    name: 'Tunnelling',
    def:
      'A carrier crosses the barrier without going over it, which quantum mechanics allows when the barrier is ' +
      'thin. It needs about 10⁶ V/cm and two heavily doped sides. Diodes rated below about 6 V work this way.',
  },

  oxidecap: {
    name: 'Oxide capacitance, C_ox',
    def:
      'The capacitance per unit area of the gate oxide alone, ε_ox/t_ox. At 10 nm it is 345.3 nF/cm². Every ' +
      'voltage the gate spends on charge in the semiconductor is divided by this number.',
  },
  moscapacitor: {
    name: 'The MOS capacitor',
    def:
      'A gate, an insulating oxide and a doped semiconductor, stacked. It is a capacitor whose lower plate is ' +
      'made of carriers the gate itself arranges. Every transistor in a digital circuit is this structure with ' +
      'two contacts added.',
  },
  accumulation: {
    name: 'Accumulation',
    def:
      'A gate voltage that pulls the substrate’s majority carriers to the surface. They pile up where the ' +
      'lower plate would be, so the measured capacitance is the oxide’s own. It is the flat left-hand end ' +
      'of the sweep.',
  },
  inversion: {
    name: 'Inversion',
    def:
      'A gate voltage large enough that the surface holds more minority carriers than the bulk holds majority ' +
      'carriers. The surface has changed type. That thin layer of minority carriers is the channel a transistor ' +
      'conducts through.',
  },
  bulkpotential: {
    name: 'Bulk potential, φ_F',
    def:
      'How far the Fermi level sits from the intrinsic level in the neutral substrate, in volts. It is ' +
      '(kT/q) ln(N_A/n_i), or 406.2 mV at 10¹⁷ cm⁻³. Inversion begins when the surface has been bent by twice ' +
      'this amount.',
  },
  surfacepotential: {
    name: 'Surface potential, ψ_s',
    def:
      'How far the bands have been bent at the semiconductor surface, in volts. The gate voltage divides between ' +
      'the oxide and this bending. Which of the three regimes the capacitor is in is a condition on this one ' +
      'number.',
  },
  threshold: {
    name: 'Threshold voltage, V_T',
    def:
      'The gate voltage at which the surface reaches twice the bulk potential and the inversion layer forms. ' +
      'Below it a transistor is off, and above it the channel charge grows with the gate. It is four terms, and ' +
      'a process sets each of them.',
  },
  cvcurve: {
    name: 'The C–V curve',
    def:
      'Capacitance against gate voltage, swept. The industry measures it because its shape reads the substrate ' +
      'doping, the oxide thickness and the fixed charge in the oxide. It falls from C_ox to a floor that the ' +
      'doping alone sets.',
  },
  generationrate: {
    name: 'Generation rate',
    def:
      'How fast thermal energy makes new minority carriers, per second. An inversion layer can only follow a ' +
      'signal slower than this rate. It is what decides which of the two curves a measurement shows, and this ' +
      'lab names it without modelling it.',
  },
  flatband: {
    name: 'Flat-band voltage, V_FB',
    def:
      'The gate voltage that leaves the semiconductor bands unbent. With no charge in the oxide it is the ' +
      'work-function difference between the gate and the substrate. Charge trapped in the oxide shifts it, and ' +
      'shifts the whole curve with it.',
  },
  implant: {
    name: 'Threshold implant',
    def:
      'A shallow dose of dopant put under the gate to move the threshold voltage where a design wants it. Each ' +
      'q·N/C_ox of dose is worth that many volts. It is how one process serves circuits that were designed ' +
      'against different numbers.',
  },

  channel: {
    name: 'Channel',
    def:
      'The inversion layer between the source and the drain, and the only path current takes in this device. ' +
      'The gate sets how much charge is in it. A drain voltage then drags that charge along.',
  },
  overdrive: {
    name: 'Overdrive, V_OV',
    def:
      'How far the gate is above the threshold voltage, V_GS − V_T. It is the quantity every current and every ' +
      'slope in this group is written in. A device at zero overdrive is at the edge of conducting.',
  },
  gradualchannel: {
    name: 'The gradual-channel model',
    def:
      'The assumption that the field along the channel is small beside the field across the oxide, so the charge ' +
      'at each point follows the local gate-to-channel voltage. It is what makes the square law an integral ' +
      'rather than a fit. It is labelled on every pane that uses it.',
  },
  triode: {
    name: 'Triode',
    def:
      'The region where the channel still reaches the drain, so the device behaves as a resistor the gate sets. ' +
      'The current rises with the drain voltage and then bends over. It is where a switch that is on lives.',
  },
  pinchoff: {
    name: 'Pinch-off',
    def:
      'The drain voltage at which the channel charge reaches zero at the drain end, which is V_DS = V_OV. Past ' +
      'it the current stops rising with the drain voltage. The two expressions for the current agree in value ' +
      'and in slope there.',
  },
  transconductance: {
    name: 'Transconductance, g_m',
    def:
      'How much drain current a volt of gate buys, in amps per volt. It is the derivative of the current ' +
      'against the gate voltage at the operating point. In this model it is also 2I_D/V_OV, so a design can ' +
      'trade current for gain.',
  },
  bodyeffect: {
    name: 'Body effect',
    def:
      'Biasing the substrate below the source gives the depletion layer more charge to hold, so the gate has ' +
      'more to pay for and the threshold rises. The coefficient γ is √(2qε_sN_A)/C_ox. It is why stacked ' +
      'transistors are not identical.',
  },
  subthreshold: {
    name: 'Subthreshold conduction',
    def:
      'Below the threshold voltage the current is exponential rather than quadratic, and it falls one decade ' +
      'every S millivolts. S cannot go below 60 mV per decade at 300 K. It is why a switched-off transistor ' +
      'still leaks.',
  },
  velocitysaturation: {
    name: 'Velocity saturation',
    def:
      'Above about 20 kV/cm along the channel the carriers stop going faster, so the current stops following ' +
      'the square law. A short channel reaches that field at a small voltage. The device then reads nearer to a ' +
      'straight line than to a parabola.',
  },

  neutralbase: {
    name: 'The neutral base',
    def:
      'What is left of the base after both junctions have taken their depletion regions out of it. Only this ' +
      'part carries the diffusing charge. It is shorter than the base the process laid down, and it shrinks as ' +
      'the collector voltage rises.',
  },
  gummelnumber: {
    name: 'Gummel number',
    def:
      'A doping times a thickness, so it counts dopant atoms per unit area that a carrier has to cross. The ' +
      'base’s sets the saturation current, and the ratio of the emitter’s to the base’s sets the ' +
      'current gain. Both are numbers a process controls directly.',
  },
  currentgain: {
    name: 'Current gain, β',
    def:
      'How many carriers reach the collector for each one the base has to supply. Doping the emitter far more ' +
      'heavily than the base is what makes it large. The value here is the ceiling that emitter injection sets, ' +
      'and a real device falls below it.',
  },
  transittime: {
    name: 'Base transit time, τ_B',
    def:
      'How long a carrier takes to diffuse across the neutral base, which is W_B²/2D_B. It caps the transition ' +
      'frequency at 1/(2πτ_B). Halving the base thickness quarters the time, which is why thin bases are worth ' +
      'the process difficulty.',
  },
  earlyvoltage: {
    name: 'Early voltage, V_A',
    def:
      'The voltage that measures how much the collector current rises with the collector voltage. It comes from ' +
      'the collector depletion edge moving into the base and thinning it. A larger value means a flatter ' +
      'collector curve and more gain.',
  },

  photocurrent: {
    name: 'Photocurrent, I_L',
    def:
      'The current light makes by creating pairs inside and near the depletion region, which the field then ' +
      'sweeps apart. It flows the reverse way through the junction. It is proportional to the light, so ten ' +
      'suns give ten times as much.',
  },
  opencircuit: {
    name: 'Open-circuit voltage, V_oc',
    def:
      'The voltage a cell settles at with nothing drawing from it, where the forward diode current has grown to ' +
      'match the photocurrent. It is V_T ln(I_L/I_S + 1), so it climbs 59.5 mV for every decade of light. It ' +
      'can never reach the band gap.',
  },
  maxpower: {
    name: 'The maximum power point',
    def:
      'The one place on the curve where the product of voltage and current is largest. Everywhere else a cell ' +
      'is throwing something away. It is the only quantity in this group without a closed form, and it is found ' +
      'by bisection.',
  },
  fillfactor: {
    name: 'Fill factor',
    def:
      'The maximum power over the product of the open-circuit voltage and the short-circuit current. It says ' +
      'how square the corner of the curve is. A good silicon cell reaches about 0.83, and series resistance is ' +
      'what spoils it.',
  },
  efficiency: {
    name: 'Efficiency',
    def:
      'The maximum electrical power out over the light power in. At one sun on a square centimetre the light ' +
      'power is 100 mW. The number this model gives is the ceiling the junction sets, before reflection and ' +
      'recombination are counted.',
  },
  emission: {
    name: 'Emission',
    def:
      'A forward-biased junction returns some of its injected carriers as photons, each carrying the band gap ' +
      'away. The wavelength is therefore hc/E_g and nothing else. How large that fraction is depends on the ' +
      'material, and this lab does not compute it.',
  },

  implantdose: {
    name: 'Implant dose',
    def:
      'How many dopant atoms an implanter fires into each unit area, in cm⁻². Spread over the depth the drive-in ' +
      'step gives them, the dose becomes a concentration. That concentration is the doping every earlier group ' +
      'took as a knob.',
  },
  drivein: {
    name: 'Drive-in',
    def:
      'The high-temperature step that spreads an implanted layer to its final depth. It sets the junction depth, ' +
      'and the depth divides the dose to give the doping. A real profile from a real thermal budget needs a tool ' +
      'this suite does not have.',
  },
}

/** Where each term's word appears in prose, so the first use can be marked. */
export const MATCH = {
  carrier: /\bcarriers?\b/i,
  doping: /\bdoping\b/i,
  massaction: /\bmass action\b/i,
  intrinsic: /\bintrinsic\b/i,
  bandgap: /\bband gap\b/i,
  bandedge: /\bband-edge densit(?:y|ies)\b/i,
  extrinsic: /\bextrinsic\b/i,
  fermilevel: /\bFermi level\b/,
  banddiagram: /\bband diagram\b/i,

  depletion: /\bdepletion region\b/i,
  neutrality: /\bneutrality\b/i,
  stepjunction: /\bstep junction\b/i,
  poisson: /\bPoisson’s equation\b/,
  gauss: /\bGauss’s law\b/,
  builtin: /\bbuilt-in potential\b/i,
  saturationcurrent: /\bsaturation current\b/i,
  diffusionlength: /\bdiffusion lengths?\b/i,
  einstein: /\bEinstein’s relation\b/,
  junctioncap: /\bjunction capacitance\b/i,
  breakdown: /\bbreakdown\b/i,
  avalanche: /\bavalanche\b/i,
  tunnelling: /\btunnelling\b/i,

  oxidecap: /\boxide capacitance\b/i,
  moscapacitor: /\bMOS capacitor\b/,
  accumulation: /\baccumulation\b/i,
  inversion: /\binversion\b/i,
  bulkpotential: /\bbulk potential\b/i,
  surfacepotential: /\bsurface potential\b/i,
  threshold: /\bthreshold\b/i,
  cvcurve: /\bC–V curve\b/,
  generationrate: /\bgeneration rate\b/i,
  flatband: /\bflat[- ]band\b/i,
  implant: /\bimplant\b/i,

  channel: /\bchannel\b/i,
  overdrive: /\boverdrive\b/i,
  gradualchannel: /\bgradual-channel\b/i,
  triode: /\btriode\b/i,
  pinchoff: /\bpinch(?:es|ed)?[- ]off\b/i,
  transconductance: /\btransconductance\b/i,
  bodyeffect: /\bbody effect\b/i,
  subthreshold: /\bsubthreshold\b/i,
  velocitysaturation: /\bvelocity saturation\b/i,

  neutralbase: /\bneutral base\b/i,
  gummelnumber: /\bGummel numbers?\b/,
  currentgain: /\bcurrent gain\b/i,
  transittime: /\btransit time\b/i,
  earlyvoltage: /\bEarly voltage\b/,

  photocurrent: /\bphotocurrent\b/i,
  opencircuit: /\bopen-circuit voltage\b/i,
  maxpower: /\bmaximum power point\b/i,
  fillfactor: /\bfill factor\b/i,
  efficiency: /\befficiency\b/i,
  emission: /\bemi(?:ts|ssion)\b/i,

  implantdose: /\bimplant dose\b/i,
  drivein: /\bdrive-in\b/i,
}
