// Group B's three registers.
//
// The whole group is one structure read at different biases, so the bias knob
// is the one that carries the group. Every number is a reading of the profile,
// and where two routes give the same number the lesson names both.

export const LESSONS_B = {
  b1: {
    see:
      'Where the two dopings meet, the carriers have left and the dopant charge stays. That zone is the ' +
      'depletion region, 327.3 nm wide here. It is not centred. It reaches 297.5 nm into the lightly doped side ' +
      'and 29.75 nm into the heavy one, because each side has to expose the same charge.',
    seeReads: [
      ['j.w', 3.2725489e-7],
      ['j.xn', 2.9750445e-7],
      ['j.xp', 2.9750445e-8],
    ],
    try: [
      {
        say: 'Raise the acceptors to 10¹⁹ cm⁻³. The heavy side now gives up 0.3356 nm and the light side 335.6 nm, a ratio of a thousand.',
        set: { na: 1e25 },
        reads: [
          ['j.xp', 3.3562278e-10],
          ['j.xn', 3.3562278e-7],
        ],
      },
      {
        say: 'Dope both sides at 10¹⁷ cm⁻³ instead. The region splits evenly, 72.48 nm each way, and the whole of it narrows to 145.0 nm.',
        set: { nd: 1e23 },
        reads: [
          ['j.xp', 7.2476735e-8],
          ['j.xn', 7.2476735e-8],
          ['j.w', 1.4495347e-7],
        ],
      },
      {
        say: 'Return the doping and reverse-bias to −5 V. Both edges move out together, to 822.4 nm and 82.24 nm, and the ratio of ten is unchanged.',
        set: { v: -5 },
        reads: [
          ['j.xn', 8.2238161e-7],
          ['j.xp', 8.2238161e-8],
        ],
      },
    ],
    why:
      'The rule is charge neutrality, and it is the strongest statement in this group. The p side exposes ' +
      'acceptors with no holes on them, and the n side exposes donors with no electrons. Nothing outside has ' +
      'moved, so the two amounts have to match, which is N_A x_p = N_D x_n. A side of this step junction doped ' +
      'ten times more heavily gives up a tenth of the width. That is why a one-sided junction is almost ' +
      'entirely in the lighter material, and why the light side sets everything downstream. Calling the ' +
      'region empty is a model, not a fact. The carriers thin out over a few Debye lengths at each edge rather ' +
      'than stopping, and here those two tails are 16.4 per cent of the width.',
    whyReads: [['j.modelError', 0.16443871]],
  },

  b2: {
    see:
      'Integrating the step charge once gives the field, and a step integrates to a triangle. Its peak is at ' +
      'the boundary, and it reads 46.01 kV/cm here. The field is zero at both edges, which is Gauss’s law over ' +
      'the whole region. The area under the triangle is the barrier.',
    seeReads: [
      ['j.byCharge', 4601180.5],
      ['j.byQuadrature', 4601180.5],
    ],
    try: [
      {
        say: 'Reverse-bias to −5 V. The triangle grows both taller and wider, and the peak reads 127.2 kV/cm.',
        set: { v: -5 },
        reads: [['j.emax', 12718889]],
      },
      {
        say: 'Push to −10 V. The peak is 173.9 kV/cm, which is 3.78 times the peak at zero bias for 14.3 times the barrier.',
        set: { v: -10 },
        reads: [['j.emax', 17388773]],
      },
      {
        say: 'Forward-bias to +0.5 V. The barrier is 253 mV of what it was, and the peak falls to 26.67 kV/cm.',
        set: { v: 0.5 },
        reads: [
          ['j.emax', 2666633.3],
          ['j.vj', 0.25287941],
        ],
      },
    ],
    why:
      'Poisson’s equation says the slope of the field is the charge density over the permittivity. A charge ' +
      'density that is one constant on the left and another on the right therefore gives a field made of two ' +
      'straight lines, meeting at the boundary. The peak there can be written two ways, and the pane prints ' +
      'both. It is q N_A x_p/ε_s from the charge one side exposes, and it is 2V_j/W from the area under a ' +
      'triangle being the barrier. They are the same number to floating point at every doping and every bias, ' +
      'and a test checks that rather than restating one of them. The peak field is what decides where this ' +
      'junction stops working, and B6 is where that becomes a rating.',
  },

  b3: {
    see:
      'Integrating again gives the potential, so two straight lines become two parabolas that meet. The total ' +
      'climb is the built-in potential, 752.9 mV, and the doping alone sets it. Reverse bias adds to it and ' +
      'forward bias subtracts, and the width follows the square root of what is left.',
    seeReads: [
      ['j.v0', 0.75287941],
      ['j.w', 3.2725489e-7],
    ],
    try: [
      {
        say: 'Reverse-bias to −5 V. The junction now holds 5.753 V across it, and the region has widened to 904.6 nm.',
        set: { v: -5 },
        reads: [
          ['j.vj', 5.7528794],
          ['j.w', 9.0461977e-7],
        ],
      },
      {
        say: 'Go to −10 V. The barrier is 10.75 V and the width 1.237 µm, which is 1.916 times the width at −1 V.',
        set: { v: -10 },
        reads: [
          ['j.vj', 10.752879],
          ['j.w', 1.2367611e-6],
        ],
      },
      {
        say: 'Try a forward bias of 1 V, past the barrier the doping built. The closed forms decline, because there is no emptied region left to describe.',
        set: { v: 1 },
        refuses: true,
      },
    ],
    why:
      'The barrier is V_T ln(N_A N_D/n_i²), and every term in it is a property of the material and the process. ' +
      'No applied voltage reaches it. Forward bias subtracts from it and the region narrows, and at the moment ' +
      'the two are equal there is nothing left that the depletion approximation describes. The formula does not ' +
      'return a small number there. It declines, and the reason is on the pane. Two decades of doping on one ' +
      'side are worth 119.1 mV of barrier, because the logarithm takes the product. That is why the barrier of ' +
      'a real junction lands in a narrow band whatever the process does, and why the diode drop a ' +
      'circuit course quotes is so nearly a constant.',
    whyReads: [[(x, p, again) => again({ na: 1e25 }).j.v0 - x.j.v0, 0.11905286]],
  },

  b4: {
    see:
      'Lowering the barrier by v multiplies the carriers that get over it by e^{v/V_T}, and that is Shockley’s ' +
      'law with a reason behind it. The one constant in it comes from the geometry. This junction has an ' +
      'I_S of 1.422 fA, so 1 mA needs 705.2 mV across it.',
    seeReads: [
      ['j.is', 1.4217868e-15],
      ['j.vAt1mA', 0.70521946],
      // The law read back at that voltage returns the current the sentence names.
      [(x) => x.j.is * Math.exp(x.j.vAt1mA / x.j.vt), 1e-3],
    ],
    try: [
      {
        say: 'Cut both lifetimes to 100 ns. The diffusion lengths fall to 10.79 µm and 16.86 µm, I_S climbs to 4.496 fA, and 1 mA now needs 675.5 mV.',
        set: { taup: 1e-7, taun: 1e-7 },
        reads: [
          ['j.lp', 1.0785824e-5],
          ['j.ln', 1.6863333e-5],
          ['j.is', 4.4960848e-15],
          ['j.vAt1mA', 0.67545625],
          [(x) => x.j.is * Math.exp(x.j.vAt1mA / x.j.vt), 1e-3],
        ],
      },
      {
        say: 'Raise the acceptors to 10¹⁹ cm⁻³. The electron term nearly vanishes, I_S falls to 1.231 fA, and the voltage at 1 mA rises to 708.9 mV.',
        set: { na: 1e25 },
        reads: [
          ['j.is', 1.2314725e-15],
          ['j.vAt1mA', 0.70893449],
          [(x) => x.j.is * Math.exp(x.j.vAt1mA / x.j.vt), 1e-3],
        ],
      },
      {
        say: 'Halve the hole mobility to 0.02 m²/V·s. Einstein’s relation halves D_p with it, I_S falls to 1.012 fA, and 1 mA needs 714.0 mV.',
        set: { mup: 0.02 },
        reads: [
          ['j.dp', 5.1704e-4],
          ['j.is', 1.0119368e-15],
          ['j.vAt1mA', 0.71401039],
          [(x) => x.j.is * Math.exp(x.j.vAt1mA / x.j.vt), 1e-3],
        ],
      },
    ],
    why:
      'The Electronics Lab was handed the saturation current as a property of a part. Here it is q A n_i² ' +
      'times one term for each ' +
      'side, and every factor in those terms is a number a process sets. The area scales it directly. The ' +
      'doping of a side divides its term, so the lightly doped side carries almost all of the current. And the ' +
      'diffusion lengths, which are √(Dτ), say how much of the injected charge survives to be collected. The ' +
      'Electronics Lab uses 10⁻¹⁴ A, which needs 654.8 mV at 1 mA. This geometry needs 705.2 mV instead, and ' +
      'the two differ by less than one decade of current. One decade is 59.53 mV, and that number is the same ' +
      'kT ln 10 the Fermi level moved by in A4.',
    whyReads: [
      ['j.decade', 0.059526429],
      [(x, p) => x.j.vt * Math.log(1e-3 / 1e-14), 0.65479072],
      [(x) => x.j.is * Math.exp(x.j.vAt1mA / x.j.vt), 1e-3],
      [(x) => 1e-14, 1e-14],
    ],
  },

  b5: {
    see:
      'The depletion region is a gap between two charged plates, so it has a capacitance. It is ε_s/W per unit ' +
      'area, which is 11.45 nF/cm² at this bias of −5 V. The same number comes from the square-root law an ' +
      'electronics course states, and both are printed.',
    seeReads: [
      ['j.byArea', 1.1451662e-4],
      ['j.byLaw', 1.1451662e-4],
    ],
    try: [
      {
        say: 'Remove the bias. The region narrows to 327.3 nm and the junction capacitance rises to 31.66 nF/cm².',
        set: { v: 0 },
        reads: [
          ['j.w', 3.2725489e-7],
          ['j.cj', 3.1655446e-4],
        ],
      },
      {
        say: 'Push the reverse bias to −10 V. The gap is wider still and the capacitance falls to 8.376 nF/cm².',
        set: { v: -10 },
        reads: [['j.cj', 8.3762333e-5]],
      },
      {
        say: 'Forward-bias to +0.5 V instead. The capacitance climbs to 54.62 nF/cm², heading for the point where the formula has nothing left to describe.',
        set: { v: 0.5 },
        reads: [['j.cj', 5.4620342e-4]],
      },
    ],
    why:
      'Two routes, one number. Take the stored depletion charge and differentiate it against the bias, and the ' +
      'answer is ε_s/W. Take C_j0/√(1 − v/V₀), which is what a course states, and the answer is the same to ' +
      'floating point. They agree because the square root in the width and the square root in the law are the ' +
      'same square root. This is the transistor’s C_μ under another name, and it is why a reverse-biased ' +
      'collector junction gets faster as its voltage rises. The exponent is one half because the doping changes ' +
      'abruptly. A junction graded gradually gives a cube root instead, and the pane takes the exponent as a ' +
      'parameter rather than assuming it.',
  },

  b6: {
    see:
      'Breakdown is the peak field reaching a number the material sets. Avalanche runs away near 300 kV/cm, and ' +
      'this junction at 10¹⁵ cm⁻³ needs 291.0 V across it to get there. That is 290.2 V of applied reverse ' +
      'bias, because the doping had already built 812.4 mV of it.',
    seeReads: [
      ['j.vbr', 290.99139],
      ['j.vbrApplied', -290.17898],
      ['j.v0', 0.81240584],
    ],
    try: [
      {
        say: 'Raise the light side to 10¹⁶ cm⁻³. The rating falls a decade with the doping, to 29.13 V.',
        set: { nd: 1e22 },
        reads: [['j.vbr', 29.125326]],
      },
      {
        say: 'Raise it again to 10¹⁷ cm⁻³. The rating is 2.939 V, and the pane now names tunnelling rather than avalanche.',
        set: { nd: 1e23 },
        reads: [
          ['j.vbr', 2.9387192],
          ['j.mechanism', 'tunnelling'],
        ],
      },
      {
        say: 'Set the light side to 10¹⁸ cm⁻³ and the critical field to 1 MV/cm. The peak already reads 1059 kV/cm at −3 V, in a layer 75.35 nm thick.',
        set: { nd: 1e24, ecrit: 1e8 },
        reads: [
          ['j.emax', 1.0593674e8],
          ['j.w', 7.5346571e-8],
          ['j.vbrApplied', -2.5652207],
        ],
      },
    ],
    why:
      'A Zener diode’s rating is a doping, and this is the arithmetic. The junction potential at breakdown is ' +
      'ε_sE_crit²(1/N_A + 1/N_D)/2q, so on a one-sided junction it falls one decade for every decade the light ' +
      'side is doped. The two mechanisms are different physics with the same symptom. Avalanche needs a carrier ' +
      'to accelerate far enough to knock a pair loose, so it needs width, and it belongs to lightly doped ' +
      'junctions. Tunnelling needs a barrier thin enough to cross without going over, which needs about ' +
      '1 MV/cm and two heavily doped sides. A part rated below about six volts is tunnelling and one rated ' +
      'above it is avalanching. The two have opposite temperature coefficients, which is how a datasheet ' +
      'tells them apart.',
  },
}
