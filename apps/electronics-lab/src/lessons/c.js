// Group C's three registers. Every number here is a reading, checked against
// the solver by experiments.test.js, and every knob move names a setting the
// knob can reach. The four closed forms are junction.js's; nothing here is
// typed in from a datasheet.

export const LESSONS_C = {
  c1: {
    see:
      'Two doped regions meet, and the charge their doping leaves behind builds a barrier. It reads 752.88 mV, ' +
      'from the doping alone. With no bias applied the depletion region reaches 327 nm into the crystal, drawn ' +
      'to scale beside the number.',
    seeReads: [
      ['junction.v0', 0.75287941],
      ['junction.w', 3.2725489e-7],
    ],
    try: [
      {
        say: 'Reverse-bias the junction to −5 V. The barrier is 5.75 V of total height now, and the depletion region widens to 905 nm.',
        set: { vsrc: -5 },
        reads: [
          ['junction.w', 9.0461977e-7],
          [(x, p) => x.junction.v0 - p.vsrc, 5.7529],
        ],
      },
      {
        say: 'Push it to −10 V. The width keeps climbing, to 1.237 µm, the square root in the formula and not a straight line.',
        set: { vsrc: -10 },
        reads: [['junction.w', 1.2367611e-6]],
      },
      {
        say: 'Raise the acceptor doping tenfold. More doping means a taller barrier, so V₀ climbs to 812.4 mV.',
        set: { na: 1e24 },
        reads: [['junction.v0', 0.81240584]],
      },
    ],
    why:
      'Every later default in this lab that is not a resistor value traces back to this barrier. Two pieces of ' +
      'the same silicon, doped opposite ways, are pushed together. Carriers cross the boundary and leave their ' +
      'donors and acceptors exposed, and the resulting field stops the rest. That field is the built-in ' +
      'potential, V₀ = V_T ln(N_A N_D/n_i²), a fact about the doping and nothing else. The zone the carriers ' +
      'have vacated is the depletion region, and its width is the one length scale a course in devices needs. ' +
      'Narrow it and the junction is fast, which is Group K’s C_μ. Reverse bias only ever adds to the barrier ' +
      'the doping already built. It never overtakes it, and the formula below refuses past the point where it ' +
      'would have to.',
  },

  c2: {
    see:
      'The depletion region is a gap between two charged plates, and a gap between plates is a capacitance. ' +
      'This is the junction capacitance, C_j. Reverse-biased to −5 V it reads 0.7235 pF, down from the ' +
      '2.00 pF it carries with no bias at all.',
    seeReads: [['junction.cj', 7.2351922e-13]],
    try: [
      {
        say: 'Remove the bias entirely. The capacitance returns to exactly C_j0, 2.00 pF, the value the formula reduces to at v = 0.',
        set: { vsrc: 0 },
        reads: [['junction.cj', 2e-12]],
      },
      {
        say: 'Push the reverse bias to −10 V. The gap is wider still and the capacitance falls further, to 0.5292 pF.',
        set: { vsrc: -10 },
        reads: [['junction.cj', 5.2921277e-13]],
      },
      {
        say: 'Raise C_j0 itself to 10.0 pF, a bigger junction. Every reading it sets scales with it, so at −5 V the capacitance is now 3.618 pF.',
        set: { cj0: 10e-12 },
        reads: [['junction.cj', 3.6175961e-12]],
      },
    ],
    why:
      'This is the transistor’s C_μ under another name. It is why a reverse-biased collector junction gets ' +
      'faster as the collector voltage rises, because the same square root that thins the picture beside it ' +
      'thins the capacitance loading the node. The exponent is one half for a step junction, where the doping ' +
      'changes abruptly at the boundary. A junction graded gradually gives a different power, a refinement ' +
      'this lab does not need. What the formula cannot do is describe a junction forward-biased past its ' +
      'built-in potential. There the depletion approximation has nothing left to empty, and the diffusion ' +
      'capacitance of C3 takes over instead.',
  },

  c3: {
    see:
      'A forward junction stores charge in transit. The store’s slope against voltage is the diffusion ' +
      'capacitance, τ_F g_m. At 1.00 mA it reads 19.34 pF, most of a transistor’s C_π. The transition ' +
      'frequency it sets is 279.3 MHz, climbing toward a ceiling of 318.3 MHz.',
    seeReads: [
      ['junction.cd', 1.9340864e-11],
      ['junction.fT', 279317010],
      ['junction.fTlimit', 318309890],
    ],
    try: [
      {
        say: 'Quadruple the current to 4.00 mA. C_d rises with it, to 77.36 pF, and f_T climbs nearer the ceiling, 307.6 MHz.',
        set: { i: 4e-3 },
        reads: [
          ['junction.cd', 7.7363454e-11],
          ['junction.fT', 307575440],
        ],
      },
      {
        say: 'Cut the current to 0.250 mA instead. C_d falls to 4.835 pF, and f_T falls with it, to 204.3 MHz, the same ceiling reached from further below.',
        set: { i: 0.25e-3 },
        reads: [
          ['junction.cd', 4.8352159e-12],
          ['junction.fT', 204253870],
        ],
      },
      {
        say: 'Quadruple the transit time τ_F to 2.00 ns. The ceiling itself falls fourfold, to 79.58 MHz, a slower device whatever the current does.',
        set: { tauF: 2e-9 },
        reads: [['junction.fTlimit', 79577472]],
      },
    ],
    why:
      'Forward bias floods the junction with carriers bound for the other side, and they take a real time, ' +
      'τ_F, to cross before they are collected. The charge waiting to cross at any instant is that time times ' +
      'the current. Its slope against voltage, a capacitance, is therefore the same time times the ' +
      'transconductance. This is most of a transistor’s C_π, and it is why f_T rises with bias current. The ' +
      'transconductance grows linearly with current, and C_d grows with it too, so the ratio climbs only ' +
      'while C_π’s fixed part, C_je, still matters. Once C_d dominates, f_T stops rising and settles at ' +
      '1/(2π τ_F), a property of the device’s geometry and not of how hard it is driven.',
  },

  c4: {
    see:
      'The saturation current climbs with temperature, and at a fixed current the junction needs less voltage ' +
      'to match it. At 700.1 mV, with a bias current of 5.77 mA, the slope reads −1.658 mV/K.',
    seeReads: [
      ['junction.v', 0.7001008],
      ['junction.slope', -0.001658184],
    ],
    try: [
      {
        say: 'Cut the current to 0.120 mA instead. The junction settles at 600.0 mV, and the slope steepens to −1.992 mV/K.',
        set: { i: 0.12e-3 },
        reads: [
          ['junction.v', 0.59997767],
          ['junction.slope', -0.0019919278],
        ],
      },
      {
        say: 'Set it to 1.00 mA. V_BE settles at 654.8 mV and the slope reads −1.809 mV/K, between the other two.',
        set: { i: 1e-3 },
        reads: [
          ['junction.v', 0.65479072],
          ['junction.slope', -0.0018092176],
        ],
      },
      {
        say: 'Raise the ambient to 350 K. The doubling interval widens to 6.147 K, because I_S was already larger there.',
        set: { T: 350 },
        reads: [['junction.doubling', 6.1468678]],
      },
    ],
    whyReads: [
      ['junction.doubling', 4.5541],
      ['junction.v', 0.7001008],
      [(x, p, again) => again({ i: 0.12e-3 }).junction.v, 0.59997767],
    ],
    why:
      'Both effects come from the same law, I_S(T) ∝ T³e^{−E_g/kT}, read two different ways. Read as how much ' +
      'warmer doubles the current at a fixed voltage, it gives the doubling interval. That interval is about ' +
      '4.55 K near room temperature, because the exponential so completely dominates the polynomial in front of ' +
      'it. Read as how much voltage keeps the current fixed while the temperature moves, it gives the slope, ' +
      '(V_BE − E_g − 3V_T)/T. That slope is more negative at the lower of two voltages, because a junction ' +
      'working at 600 mV sits proportionately closer to E_g than one at 700 mV. Both are why a junction left ' +
      'to itself, biased with no compensation, runs hotter, draws more, and runs hotter still. The same law ' +
      'inside a transistor sets how far its bias point drifts with temperature.',
  },
}
