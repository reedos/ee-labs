// Group F's three registers.
//
// The same junction, run both ways. The knobs are the photocurrent, the
// saturation current and the series resistance, because those are the three
// things a cell's curve depends on and the three a process argues about.

export const LESSONS_F = {
  f1: {
    see:
      'A photocurrent in parallel with the junction shifts Shockley’s law downward. The curve crosses zero ' +
      'current at 627.7 mV, which is the open-circuit voltage, and it crosses zero volts at the 35.00 mA the ' +
      'light is making. Between those two corners is everything a cell can deliver.',
    seeReads: [
      ['pv.voc', 0.62765072],
      ['pv.isc', 0.035],
    ],
    try: [
      {
        say: 'Take the light to ten suns, 350.0 mA. The open-circuit voltage rises only one decade’s worth, to 687.2 mV, because it depends on the logarithm of the light.',
        set: { il: 350e-3 },
        reads: [['pv.voc', 0.68717715]],
      },
      {
        say: 'Drop it to a tenth of a sun, 3.500 mA. The voltage falls by the same 59.53 mV step, to 568.1 mV.',
        set: { il: 3.5e-3 },
        reads: [
          ['pv.voc', 0.56812429],
          [(x) => x.pv.vt * Math.LN10, 0.059525754],
        ],
      },
      {
        say: 'Return the light and raise the saturation current to 100 pA. The voltage collapses to 508.6 mV, because a leakier junction matches the photocurrent sooner.',
        set: { is: 1e-10 },
        reads: [['pv.voc', 0.50859786]],
      },
    ],
    why:
      'The cell is a current source and a diode in parallel, and the two argue over the terminals. With the ' +
      'terminals shorted the diode has no voltage across it, so all the photocurrent leaves and the current is ' +
      'the light. With the terminals open nothing can leave, so the photocurrent forward-biases the diode until ' +
      'the diode passes all of it back, and the voltage that takes is V_T ln(I_L/I_S + 1). Two things follow. ' +
      'The voltage climbs only 59.53 mV for every decade of light, so concentrating sunlight buys current and ' +
      'almost no voltage. And it can never reach the band gap, because I_S is what a junction of that gap ' +
      'leaks.',
    whyReads: [
      ['pv.vt', 0.025852],
      [(x) => x.pv.vt * Math.LN10, 0.059525754],
    ],
  },

  f2: {
    see:
      'Power is voltage times current, and it peaks between the two corners. This cell peaks at 547.5 mV and ' +
      '33.42 mA, which is 18.30 mW. Against 100 mW of sunlight on a square centimetre that is 18.30 per cent. ' +
      'The fill factor, which says how square the corner is, reads 0.8330.',
    seeReads: [
      ['pv.vmp', 0.54753108],
      ['pv.imp', 0.033421963],
      ['pv.pmax', 0.018299563],
      ['pv.ff', 0.8330185],
      ['pv.efficiency', 0.18299563],
      // The light falling on the cell, which is what the efficiency divides by.
      [(x, p) => p.irradiance * p.area, 0.1],
    ],
    try: [
      {
        say: 'Take the cell to ten suns, with the light raised to match. The efficiency climbs to 20.29 per cent, because the voltage rose while the fill factor improved to 0.8438.',
        set: { il: 350e-3, irradiance: 10000 },
        reads: [
          ['pv.efficiency', 0.20293437],
          ['pv.ff', 0.84375984],
        ],
      },
      {
        say: 'Return the light and take the saturation current down to 10 fA. The open-circuit voltage rises to 746.7 mV and the efficiency to 22.30 per cent.',
        set: { is: 1e-14 },
        reads: [
          ['pv.voc', 0.74670358],
          ['pv.efficiency', 0.22295089],
        ],
      },
      {
        say: 'Raise the saturation current to 100 pA instead. The fill factor falls to 0.8057 and the efficiency to 14.34 per cent.',
        set: { is: 1e-10 },
        reads: [
          ['pv.ff', 0.80569262],
          ['pv.efficiency', 0.14342074],
        ],
      },
    ],
    why:
      'Everything else in this group is a closed form and this one is not. The maximum power point maximises ' +
      'V(I_L − I_S(e^{V/V_T} − 1)), and setting that derivative to zero gives a transcendental equation. The ' +
      'pane finds it by bisection to floating point, which is a root-find rather than an approximation. The ' +
      'fill factor is that peak power over the product of the two corners, so it is the fraction of the ' +
      'rectangle the curve actually fills. Green’s empirical form gives 0.8331 against the 0.8330 the root-find ' +
      'gives, and the pane prints the difference of 0.01 per cent rather than showing the two as one number. ' +
      'It is an approximation, and it carries its error.',
    whyReads: [
      ['pv.ffEmpirical', 0.83310713],
      ['pv.ffError', 0.00010639499],
    ],
  },

  f3: {
    see:
      'Run the junction the other way and it emits. The photon carries the band gap away, so the wavelength is ' +
      'hc/E_g. Gallium nitride at 3.400 eV gives 364.7 nm and cannot be driven below 3.400 V. Silicon at ' +
      '1.120 eV would give 1107 nm, which is why nobody makes a silicon lamp.',
    seeReads: [
      ['led.wavelength', 3.6465941e-7],
      ['led.vf', 3.4],
      [(x, p, again) => again({ material: 'silicon' }).led.wavelength, 1.1070018e-6],
      [(x, p, again) => again({ material: 'silicon' }).led.vf, 1.12],
    ],
    try: [
      {
        say: 'Switch to gallium arsenide, at 1.420 eV. It emits at 873.1 nm, in the infrared, which is what a remote control uses.',
        set: { material: 'gallium arsenide' },
        reads: [
          ['led.wavelength', 8.7312816e-7],
          ['led.vf', 1.42],
        ],
      },
      {
        say: 'Switch to gallium phosphide, at 2.260 eV. It emits at 548.6 nm, which is green, and it needs 2.260 V to run.',
        set: { material: 'gallium phosphide' },
        reads: [
          ['led.wavelength', 5.4860265e-7],
          ['led.vf', 2.26],
        ],
      },
      {
        say: 'Add an ohm of series resistance to the cell instead. It costs 33.42 mV at the maximum power point, which is the current there through the ohm.',
        set: { rs: 1 },
        reads: [['pv.seriesLoss', 0.033421963]],
      },
    ],
    why:
      'One structure, two uses, one band gap. Forward-biased, the junction injects carriers that recombine, ' +
      'and a fraction of those recombinations give up their energy as a photon of the gap. That fixes the ' +
      'wavelength at hc/E_g with nothing else in it. It also fixes the forward voltage at no less than E_g/q, ' +
      'which is why a blue lamp needs three volts and a red one needs two. What fraction comes out as light is ' +
      'radiative efficiency, and that is a property of the material rather than of the junction. Silicon’s ' +
      'gap is indirect, so the fraction is tiny, and this lab does not compute it. The four materials here are ' +
      'four numbers taken from data.',
  },
}
