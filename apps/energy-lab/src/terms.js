/**
 * Definitions on contact. Every term a lesson leans on is defined here, in a
 * folded panel under the note, which costs nothing to a reader who already
 * knows them. `experiments.test.js` requires every referenced term to be
 * defined and every definition to be referenced.
 *
 * Each definition is three or four sentences at most, prefers a number to an
 * abstraction, and names the experiment where the term is first used.
 */

export const TERMS = {
  photocurrent: {
    term: 'Photocurrent',
    def: 'The current the light makes inside the cell, written I_ph. It is proportional to the irradiance and does not depend on what the terminals are doing. At 1000 W of light per square metre this cell makes 5 A of it.',
  },
  shortcircuit: {
    term: 'Short-circuit current',
    def: 'The current a cell delivers with its terminals joined, written I_sc. The junction then has no voltage across it and takes almost nothing, so I_sc is nearly the whole photocurrent.',
  },
  opencircuit: {
    term: 'Open-circuit voltage',
    def: 'The voltage across a cell delivering no current, written V_oc. All the photocurrent goes through the junction, and V_oc is the voltage the junction needs to swallow it. For this cell that is 0.633 V.',
  },
  singlediode: {
    term: 'Single-diode model',
    def: 'A photocurrent source, one exponential diode, a series resistance and a shunt resistance. It is the model every datasheet is fitted to. Its two parasitic resistances are toggles here, so a reader can see what each one costs.',
  },
  loadline: {
    term: 'Load line',
    def: 'The straight line a resistor draws on the current-voltage plane, i = v/R through the origin. The operating point is where it crosses the device curve. Elements I2 introduces it with a diode and a source.',
  },
  operatingpoint: {
    term: 'Operating point',
    def: 'The one voltage and current that satisfy both the device and the circuit around it. For a nonlinear device it is found rather than calculated, by Newton’s method here.',
  },
  newton: {
    term: 'Newton’s method',
    def: 'Replace the curve by its tangent at a guess, solve that linear circuit, and repeat. Near the answer the error squares each time, so three to twelve iterations is normal here and fifty is a circuit that is not converging.',
  },
  mpp: {
    term: 'Maximum power point',
    def: 'The voltage on the curve where the product of voltage and current is largest. It is zero at both ends and has one maximum between, unless bypass diodes have split the string into two curves.',
  },
  fillfactor: {
    term: 'Fill factor',
    def: 'The maximum power divided by the product V_oc·I_sc, written FF. That product is a rectangle no cell reaches. The fill factor is how much of it the knee leaves, and 0.83 is a good silicon cell.',
  },
  seriesresistance: {
    term: 'Series resistance',
    def: 'The contacts, the fingers on the cell and the wire between cells, written R_s. It costs nothing at either intercept and everything at the knee, where the current and the voltage are both large.',
  },
  shuntresistance: {
    term: 'Shunt resistance',
    def: 'A leakage path straight across the junction, written R_sh. Every real cell has one. It gives the flat top of the curve a slope of −1/R_sh, and it takes some of the photocurrent that would otherwise set V_oc.',
  },
  thermalvoltage: {
    term: 'Thermal voltage',
    def: 'The quantity kT/q, written V_T, which is 25.7 mV at 25 °C. It sets the diode’s scale: every factor of ten in junction current costs about 59 mV.',
  },
  saturationcurrent: {
    term: 'Saturation current',
    def: 'The constant I_s in the diode law. It is tiny, 10⁻¹⁰ A here, and it doubles about every five kelvin. That doubling is what pulls the open-circuit voltage down as a cell warms.',
  },
  bandgap: {
    term: 'Band gap',
    def: 'The energy a carrier needs to cross the junction, 1.12 eV in silicon. It appears in the exponent of the saturation current’s temperature law, which is why that law is so steep.',
  },
  string: {
    term: 'String',
    def: 'Cells joined in series, so they carry one current and add their voltages. Twelve cells give twelve times the voltage and the same current. The price is that the worst cell decides what the rest may deliver.',
  },
  shading: {
    term: 'Shading',
    def: 'One cell of a string getting less light than its neighbours. Its photocurrent falls, and the string cannot carry more than the shaded cell makes without driving that cell backwards.',
  },
  hotspot: {
    term: 'Hot spot',
    def: 'A shaded cell driven backwards by its neighbours, dissipating their power instead of adding to it. Tens of watts in one cell is enough to damage a module, which is what bypass diodes prevent.',
  },
  breakdown: {
    term: 'Reverse breakdown',
    def: 'The avalanche that lets a real silicon cell conduct backwards near −15 V. This model does not have it, so its only reverse path is the shunt resistance, and the notes say so wherever a reverse voltage is printed.',
  },
  bypass: {
    term: 'Bypass diode',
    def: 'A diode across a cell or a group of cells, anode at the bottom. It conducts as soon as the string tries to push current backwards through what it protects, giving that current a way round.',
  },
  mppt: {
    term: 'Maximum power point tracking',
    def: 'Holding an array at its maximum power point while the light and the temperature move it. The point is not at a fixed voltage or a fixed resistance, so it has to be found again and again.',
  },
  perturbobserve: {
    term: 'Perturb and observe',
    def: 'The commonest tracking rule. Move the terminal one step, measure the power, and reverse if it fell. It needs a voltmeter, an ammeter and a memory of one previous power, and nothing else.',
  },
  dither: {
    term: 'Dither',
    def: 'The oscillation a perturb-and-observe tracker settles into at the top of the curve. It is two steps wide, and the power it gives up goes as the square of the step size.',
  },
  buck: {
    term: 'Buck converter',
    def: 'A switching converter whose output is D times its input, where D is the fraction of each period the switch is on. Power Lab’s Group B builds it from volt-second balance.',
  },
  inputresistance: {
    term: 'Input resistance',
    def: 'The resistance a converter shows its source. For an ideal buck in continuous conduction it is R/D², so the duty is a resistance knob. That is what lets a converter track a maximum power point.',
  },
  equivalentcircuit: {
    term: 'Equivalent circuit',
    def: 'A battery drawn as circuit elements: a charge store, a series resistance and one or more parallel RC pairs. It is not chemistry. It is what the terminals do, which is what an engineer designs against.',
  },
  internalresistance: {
    term: 'Internal resistance',
    def: 'The resistance between a cell’s store and its terminals. A step shows R₀ alone, and a settled current shows all of it, which here is 25 mΩ against 50 mΩ.',
  },
  timeconstant: {
    term: 'Time constant',
    def: 'The product RC of a parallel pair, the time it takes to reach 63 % of its final voltage. This cell has two, at 30 s and 200 s, which is why its terminal keeps moving after a step.',
  },
  stateofcharge: {
    term: 'State of charge',
    def: 'The fraction of a cell’s capacity still stored, written z. Here it is a capacitor’s charge divided by the capacity, so it really is the integral of the current rather than an estimate of it.',
  },
  capacity: {
    term: 'Capacity',
    def: 'The charge a cell holds, quoted in amp hours. This one holds 2.00 Ah, which is 7200 coulombs. It is charge and not energy, which is why a capacity alone does not say how many joules a cell stores.',
  },
  roundtrip: {
    term: 'Round-trip efficiency',
    def: 'Energy out divided by energy in over a closed cycle that ends where it began. Measured over anything else it is not efficiency, because a cycle that does not close has stored or released energy nobody counted.',
  },
  cccv: {
    term: 'Constant current, constant voltage',
    def: 'The charging profile a lithium cell is given. Current is held until the terminal reaches a limit, then the terminal is held and the current falls away. The long tail is why the last tenth takes as long as the first half.',
  },
  labelleddata: {
    term: 'Labelled data',
    def: 'A number in this suite that is not computed from physics. The day’s three profiles are labelled data, and so is the straight-line fit of open-circuit voltage against state of charge. Everything downstream of them is exact.',
  },
  irradiance: {
    term: 'Irradiance',
    def: 'The power of light arriving per unit area, in watts per square metre. The standard test condition is 1000 W/m². It is the quantity the photocurrent is proportional to.',
  },
  curtailment: {
    term: 'Curtailment',
    def: 'Energy an array could have made and was not asked for, because the store was full and the load did not want it. Nothing is dissipated. It is still usually the largest number in a microgrid’s ledger.',
  },
  unserved: {
    term: 'Unserved load',
    def: 'Demand the bus could not meet, because the array was not making enough and the store was empty. A day can both curtail and go dark, and a store that is too small does exactly that.',
  },
}

/** Every term an experiment names, in the order it names them. */
export const termsFor = (exp) => (exp.terms || []).map((k) => ({ key: k, ...TERMS[k] }))
