// Group C's three registers.
//
// One structure, one gate knob, and three regimes that are three ranges of it.
// Capacitances are written per square centimetre because that is the unit a
// C–V measurement is plotted in, and the engine works in F/m².

export const LESSONS_C = {
  c1: {
    see:
      'A gate, an oxide and a doped substrate make a capacitor. Its oxide capacitance is ε_ox/t_ox and nothing ' +
      'else, so 10 nm of oxide gives 345.3 nF/cm². A volt on the gate therefore puts 345.3 nC/cm² of charge on ' +
      'it. The cross-section beside this is drawn to scale.',
    seeReads: [
      ['mos.cox', 3.4531332e-3],
      ['mos.gateCharge', 3.4531332e-3],
    ],
    try: [
      {
        say: 'Halve the oxide to 5 nm. The capacitance doubles, to 690.6 nF/cm², because the two plates are half as far apart.',
        set: { tox: 5e-9 },
        reads: [['mos.cox', 6.9062664e-3]],
      },
      {
        say: 'Take it to 20 nm. The capacitance halves again from its starting value, to 172.7 nF/cm².',
        set: { tox: 20e-9 },
        reads: [['mos.cox', 1.7265666e-3]],
      },
      {
        say: 'Take it to 50 nm, which is an old process. The capacitance falls to 69.06 nF/cm², a fifth of what 10 nm gave.',
        set: { tox: 50e-9 },
        reads: [['mos.cox', 6.9062664e-4]],
      },
    ],
    why:
      'This is the one part of the MOS capacitor that behaves like an ordinary capacitor. The oxide is an ' +
      'insulator with a fixed permittivity and a fixed thickness, so its capacitance per unit area is one ' +
      'division. Every later number in this group and the next divides by it. A charge the semiconductor has ' +
      'to hold costs the gate that charge over C_ox in volts, and a thinner oxide makes that cost smaller. ' +
      'Thinning the oxide is the most direct thing a process can do to make a transistor better. It is why the ' +
      'number fell from 50 nm to a few nanometres over three decades. What stops it is tunnelling through the ' +
      'oxide itself, which this model does not carry.',
  },

  c2: {
    see:
      'Sweep the gate and the substrate answers three different ways. Negative voltage pulls holes to the ' +
      'surface. Positive voltage pushes them away and leaves a depletion layer. Past a surface potential of ' +
      '812.4 mV, which is twice the bulk potential of 406.2 mV, that layer stops growing at 102.5 nm.',
    seeReads: [
      ['mos.phiF', 0.40620292],
      ['mos.wmax', 1.0249758e-7],
      ['mos.psi', 0.56841139],
      [(x) => 2 * x.mos.phiF, 0.81240584],
    ],
    try: [
      {
        say: 'Set the gate to −2 V. The surface goes into accumulation, the bending falls to zero, and the capacitance reads the oxide’s own 345.3 nF/cm².',
        set: { vg: -2 },
        reads: [
          ['mos.psi', 0],
          ['mos.c', 3.4531332e-3],
          ['mos.regime', 'accumulation'],
        ],
      },
      {
        say: 'Set it to 0 V. The surface has bent 568.4 mV, a depletion layer 85.74 nm deep has appeared, and the capacitance has fallen to 89.51 nF/cm².',
        set: { vg: 0 },
        reads: [
          ['mos.psi', 0.56841139],
          ['mos.w', 8.5735065e-8],
          ['mos.c', 8.9509603e-4],
        ],
      },
      {
        say: 'Set it to 2 V. The surface has reached 812.4 mV, inversion has started, and the layer has stopped at 102.5 nm however much further the gate goes.',
        set: { vg: 2 },
        reads: [
          ['mos.psi', 0.81240584],
          ['mos.w', 1.0249758e-7],
          ['mos.regime', 'inversion'],
        ],
      },
    ],
    why:
      'Each regime is a condition on one number, the surface potential. Below zero the majority carriers are at ' +
      'the surface and there is nothing for the gate to deplete. Between zero and twice the bulk potential the ' +
      'gate voltage divides between the oxide and a growing depletion layer, and that division is a quadratic ' +
      'in √ψ_s with an exact root. Above twice the bulk potential the surface holds more electrons than the ' +
      'bulk holds holes. Every further electron the gate asks for arrives in that thin layer rather than by ' +
      'widening the depletion layer, so the layer stops at W_max. The gate voltage that gets there is the ' +
      'threshold voltage, and C5 takes it apart. The thin layer itself is the channel a transistor conducts ' +
      'through, which is Group D.',
  },

  c3: {
    see:
      'Capacitance against gate voltage is what the industry measures, because its shape reads the process. ' +
      'This curve falls from 345.3 nF/cm² to a floor of 78.19 nF/cm², and the ratio between them is 0.2264. ' +
      'That ratio depends on the substrate doping alone.',
    seeReads: [
      ['mos.cox', 3.4531332e-3],
      ['mos.cmin', 7.8185576e-4],
      ['mos.ratio', 0.22641923],
    ],
    try: [
      {
        say: 'Drop the substrate to 10¹⁵ cm⁻³. The depletion layer gets much deeper, so the floor falls and the ratio reads 0.03364.',
        set: { na: 1e21 },
        reads: [['mos.ratio', 0.033640573]],
      },
      {
        say: 'Set it to 10¹⁶ cm⁻³. The ratio reads 0.09106, between the two.',
        set: { na: 1e22 },
        reads: [['mos.ratio', 0.091064676]],
      },
      {
        say: 'Set it to 10¹⁸ cm⁻³. The ratio climbs to 0.4636, because a heavily doped substrate needs very little depth to hold the charge.',
        set: { na: 1e24 },
        reads: [['mos.ratio', 0.46363304]],
      },
    ],
    why:
      'The floor is the oxide in series with the widest the depletion layer ever gets, and W_max is set by the ' +
      'substrate doping alone. So the ratio of the floor to the top is a reading of that doping, and one ' +
      'root-find inverts it. The pane does that and prints the doping it recovers, which at this process is ' +
      '10¹⁷ cm⁻³ again. This is why a C–V curve is on every process line. One sweep gives three things. The ' +
      'oxide thickness comes from the top of the curve, the substrate doping from the bottom, and the fixed ' +
      'charge in the oxide from where the whole curve sits along the voltage axis. Nothing has to be cut open.',
    whyReads: [['mos.dopingRead', 1e23]],
  },

  c4: {
    see:
      'In inversion the two curves part company. At high frequency the minority carriers cannot be made fast ' +
      'enough to follow, so the depletion layer carries the response and the capacitance floors at ' +
      '78.19 nF/cm². At low frequency they keep up and it returns to 345.3 nF/cm², a factor of 4.417.',
    seeReads: [
      ['mos.cHigh', 7.8185576e-4],
      ['mos.cLow', 3.4531332e-3],
      ['mos.inversionFactor', 4.416586],
    ],
    try: [
      {
        say: 'Switch the measurement to low frequency. The readout follows the other curve and reads 345.3 nF/cm² at this gate voltage.',
        set: { freq: 'low' },
        reads: [['mos.c', 3.4531332e-3]],
      },
      {
        say: 'Set the gate to 0 V, which is inside depletion. Both curves read 89.51 nF/cm² there, because outside inversion they are one curve.',
        set: { vg: 0 },
        reads: [
          ['mos.cHigh', 8.9509603e-4],
          ['mos.cLow', 8.9509603e-4],
        ],
      },
      {
        say: 'Set the gate to −2 V. Both read the oxide’s 345.3 nF/cm², because an accumulated surface is a plate whichever way it is measured.',
        set: { vg: -2 },
        reads: [
          ['mos.cHigh', 3.4531332e-3],
          ['mos.cLow', 3.4531332e-3],
        ],
      },
    ],
    why:
      'The inversion layer is made of minority carriers, and minority carriers have to be generated. That takes ' +
      'time. A signal faster than the generation rate finds the inversion charge unable to change, so the only ' +
      'thing that can respond is the depletion edge, and the capacitance sits at its floor. A slower signal ' +
      'finds the layer able to follow, and the semiconductor behaves as a plate again. Which curve a ' +
      'measurement shows therefore depends on the sweep rate against the generation rate, and this lab names ' +
      'that comparison without modelling it. Outside inversion the two agree exactly, because both branches ' +
      'come from the same depletion approximation. The model puts the whole transition at one gate voltage, ' +
      'where a measured curve turns over across a few tenths of a volt.',
  },

  c5: {
    see:
      'The threshold voltage is four terms added up. The flat-band voltage is −966.2 mV, twice the bulk ' +
      'potential is 812.4 mV, and the depletion charge costs 475.6 mV. Together they give 321.8 mV, which is ' +
      'not the 700.0 mV the Electronics Lab’s transistor was given.',
    seeReads: [
      ['mos.vfb', -0.96620292],
      ['mos.depTerm', 0.47556586],
      ['mos.vt', 0.32176878],
      [(x) => 2 * x.mos.phiF, 0.81240584],
      // The threshold the implant of the first step lands on, which is the
      // number the Electronics Lab's transistor was handed.
      [(x, p, again) => again({ implant: 8.15193e15 }).mos.vt, 0.70000011],
    ],
    try: [
      {
        say: 'Add a threshold implant of 8.152 × 10¹¹ cm⁻². It is worth 378.2 mV, and the threshold lands on 700.0 mV.',
        set: { implant: 8.15193e15 },
        reads: [
          ['mos.implantTerm', 0.37823133],
          ['mos.vt', 0.70000011],
        ],
      },
      {
        say: 'Clear the implant and put 2.155 × 10¹¹ cm⁻² of fixed charge in the oxide. It shifts the flat-band voltage 100.0 mV down, and the threshold with it, to 221.8 mV.',
        set: { qf: 2.15528e15 },
        reads: [
          ['mos.oxideShift', 0.10000017],
          ['mos.vt', 0.22176861],
        ],
      },
      {
        say: 'Change the gate to p⁺ polysilicon. The work-function difference reverses to 153.8 mV, and the threshold climbs to 1.442 V.',
        set: { gate: 'p+ poly' },
        reads: [
          ['mos.phims', 0.15379708],
          ['mos.vt', 1.4417688],
        ],
      },
    ],
    why:
      'Each term is something a process controls, and that is the point of writing it as four. The gate ' +
      'material sets the first. The substrate doping sets the second and, with the oxide, most of the third. ' +
      'The oxide thickness divides the third. And the fourth is a dose an implanter fires, which is the only ' +
      'one that can be changed after the rest of the process is fixed. The Electronics Lab’s transistor has a ' +
      '700 mV threshold as a device fact, and the gap between that and the 321.8 mV this process gives is not ' +
      'an error in either lab. It is 8.152 × 10¹¹ cm⁻² of implant, and a cross-lab test fails if the two ' +
      'numbers stop agreeing.',
    whyReads: [
      ['mos.vt', 0.32176878],
      [(x, p, again) => again({ implant: 8.15193e15 }).mos.vt, 0.70000011],
    ],
  },
}
