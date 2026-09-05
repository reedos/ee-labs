// Group D's three registers. The group where one Laplace solution answers two
// questions, and where a measurement cannot be read without knowing which
// object is under the probe.

export const LESSONS_D = {
  d1: {
    see:
      'A copper bar a metre long and a square millimetre across, with 50 mV along it. It has 17.24 mΩ and carries ' +
      '2.900 A. Inside it the field is 50.00 mV/m and the current density 2.900 MA/m², and those two are Ohm’s law ' +
      'at a point.',
    seeReads: [['bar.R', 0.017241], ['bar.I', 2.9], ['bar.J', 2.9e6], ['bar.E', 0.05]],
    try: [
      {
        say: 'Double the cross-section to 2 mm². The resistance halves to 8.621 mΩ and the current doubles to 5.800 A.',
        set: { area: 2e-6 },
        reads: [['bar.R', 0.0086207], ['bar.I', 5.8]],
      },
      {
        say: 'Double the length to 2 m instead. The resistance doubles to 34.48 mΩ and the field halves to 25.00 mV/m.',
        set: { len: 2 },
        reads: [['bar.R', 0.034483], ['bar.E', 0.025]],
      },
    ],
    why:
      'Ohm’s law has two forms and they say the same thing at two scales. At a point it is J = σE, a statement ' +
      'about the material and nothing else. Over a whole bar it is V = IR, and R = ρl/A carries the geometry. ' +
      'Multiply the field by the length for the voltage and the current density by the area for the current, and ' +
      'the second form falls out of the first. The two steps above separate the geometry from the material. ' +
      'Neither one changes copper, and both change the resistance.',
  },

  d2: {
    see:
      'The RG-58 geometry again, this time with the dielectric leaking at 10⁻¹² S/m. A metre of it has 188.9 GΩ ' +
      'between the conductors. The formula is the capacitance’s with ε replaced by σ and the result turned over.',
    seeReads: [['R.value', 1.8894e11]],
    try: [
      {
        say: 'Raise the conductivity tenfold to 10⁻¹¹ S/m. The resistance falls tenfold to 18.89 GΩ.',
        set: { sigma: 1e-11 },
        reads: [['R.value', 1.8894e10]],
      },
      {
        say: 'Read the capacitance beside it, 105.4 pF/m. The same geometry gives both numbers.',
        reads: [['C.perMetre', 1.0544e-10]],
      },
    ],
    why:
      'In a conductor at steady state the current has nowhere to pile up, so the divergence of J is zero. With ' +
      'J = σE and E = −∇V that is Laplace’s equation for V, the same equation the electrostatic problem obeys. The ' +
      'boundary conditions are the same too, since both conductors are equipotentials. So the field is the same ' +
      'field, and every capacitance formula becomes a conductance formula by swapping ε for σ. This is why the grid ' +
      'solver in group C serves both problems from one solve.',
  },

  d3: {
    see:
      'The same coaxial geometry. Its resistance is 188.9 GΩ and its capacitance 105.4 pF/m, and their product is ' +
      '19.92 s. That product is ε over σ, and it does not depend on the shape at all.',
    seeReads: [['rc', 19.922]],
    try: [
      {
        say: 'Set the dielectric to 1. The product falls to 8.854 s, in the ratio of the two permittivities.',
        set: { epsr: 1 },
        reads: [['rc', 8.8542]],
      },
      {
        say: 'Raise the conductivity a hundredfold to 10⁻¹⁰ S/m. The product falls to 0.1992 s.',
        set: { sigma: 1e-10 },
        reads: [['rc', 0.19922]],
      },
    ],
    why:
      'Because one Laplace solution serves both problems, the geometry cancels when the two answers are ' +
      'multiplied. What is left is ε/σ, which is a property of the material and is called the relaxation time. It ' +
      'is how long a lump of charge placed inside that material takes to fall to 1/e of itself as it spreads to the ' +
      'surface. A leaky capacitor discharges through its own dielectric with exactly that time constant, whatever ' +
      'shape it is built in.',
  },

  d4: {
    see:
      'Four probes in a line, a millimetre apart. Current goes in the outer pair and 5 mV is read across the inner ' +
      'pair. On a 5 mm block that reads 3.142 Ω·cm. The same reading on a thin film would mean something else ' +
      'entirely.',
    seeReads: [['fourPoint.resistivity', 0.031416]],
    try: [
      {
        say: 'Set the thickness to 1 µm. The sample is now a sheet, and the reading is 22.66 Ω per square.',
        set: { t: 1e-6 },
        reads: [['fourPoint.sheet', 22.662]],
      },
      {
        say: 'Set the thickness to 1 mm, one probe spacing. Neither form holds there, and the app quotes neither.',
        set: { t: 1e-3 },
        reads: [['fourPoint.regime', 'between']],
      },
      {
        say: 'Widen the spacing to 10 mm with the film in place. The sheet resistance is still 22.66 Ω per square.',
        set: { s: 1e-2, t: 1e-6 },
        reads: [['fourPoint.sheet', 22.662]],
      },
    ],
    why:
      'The four-point probe forces current through the outer pair and senses voltage on the inner pair, which draws ' +
      'no current and so carries no contact resistance. What that voltage means depends on where the current went. ' +
      'In a thick block it spreads into a hemisphere and the resistivity is 2πs times V/I, which carries the ' +
      'spacing. In a thin film it spreads in the plane, and the sheet resistance is π/ln 2 times V/I, which does ' +
      'not carry the spacing at all. The coefficient 4.532 is the same for every probe ever built. Between the two ' +
      'regimes a correction factor is needed, and this lab quotes neither number rather than the nearer one.',
  },
}
