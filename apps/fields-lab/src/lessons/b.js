// Group B's three registers. Every capacitance here is a closed form, so no
// note hedges and none of them carries a guard.

export const LESSONS_B = {
  b1: {
    see:
      'Two plates of 100 mm² a millimetre apart hold 0.8854 pF in air. The field between them is uniform at ' +
      '10.00 kV/m for 10 V across, and this is the only uniform field in the lab. The profile draws it as a flat ' +
      'line across the gap.',
    seeReads: [['C.value', 8.8542e-13], ['E.peak', 10000]],
    try: [
      {
        say: 'Set the dielectric to 3.9, which is glass epoxy. The capacitance rises to 3.453 pF.',
        set: { epsr: 3.9 },
        reads: [['C.value', 3.4531e-12]],
      },
      {
        say: 'Halve the gap to 0.5 mm. The capacitance doubles to 1.771 pF and the field doubles to 20.00 kV/m.',
        set: { gap: 0.5e-3 },
        reads: [['C.value', 1.7708e-12], ['E.peak', 20000]],
      },
      {
        say: 'Double the area to 200 mm² instead. The capacitance is 1.771 pF again, and the field has not moved.',
        set: { area: 2e-4 },
        reads: [['C.value', 1.7708e-12], ['E.peak', 10000]],
      },
    ],
    why:
      'A capacitance is charge over voltage, and for a parallel plate both follow from a uniform field. Put charge ' +
      'density σ on each plate and Gauss gives E = σ/ε. Multiply by the gap for the voltage and by the area for the ' +
      'charge, and C = εA/d falls out. The last two steps show the two ways to reach the same capacitance, and they ' +
      'are not the same object. Halving the gap doubles the field and brings the plates nearer breakdown. Doubling ' +
      'the area leaves the field alone. This formula neglects the fringing field beyond the plate edges, which C1 ' +
      'and C5 are about.',
  },

  b2: {
    see:
      'RG-58 coaxial cable, with a 0.45 mm inner conductor inside a 1.475 mm shield and a dielectric of 2.25. It ' +
      'holds 105.4 pF/m. The field is largest at the inner conductor, 187.2 kV/m at 100 V, and falls as one over r ' +
      'across the dielectric.',
    seeReads: [['C.perMetre', 1.0544e-10], ['E.peak', 187190]],
    try: [
      {
        say: 'Widen the shield to 3 mm. The capacitance falls to 65.98 pF/m, because the logarithm has grown.',
        set: { b: 3e-3 },
        reads: [['C.perMetre', 6.5981e-11]],
      },
      {
        say: 'Set the dielectric to 1. The capacitance falls to 46.86 pF/m, in the ratio of the two permittivities.',
        set: { epsr: 1 },
        reads: [['C.perMetre', 4.6862e-11]],
      },
      {
        say: 'Widen the inner conductor to 0.9 mm. The capacitance rises to 253.4 pF/m and the peak field to 224.9 kV/m.',
        set: { a: 0.9e-3 },
        reads: [['C.perMetre', 2.5338e-10], ['E.peak', 224910]],
      },
    ],
    why:
      'Gauss’s law in a cylinder gives the field directly. The charge on a metre of inner conductor is λ, the ' +
      'cylinder’s area at radius r is 2πr, so E = λ/2πεr. Integrating that from a to b gives the voltage, and ' +
      'C′ = λ/V is 2πε over ln(b/a). The logarithm is why a coaxial cable’s capacitance changes so little for a ' +
      'large change in the shield. The field is largest at the inner conductor, which is where a real cable breaks ' +
      'down, so the last step raises both the capacitance and the risk.',
  },

  b3: {
    see:
      'A 50 mm sphere inside a 60 mm shell holds 33.38 pF. The field falls as one over r squared between them, ' +
      'faster than the coaxial case, and it is 12.00 kV/m at the inner sphere for 100 V.',
    seeReads: [['C.value', 3.338e-11], ['E.peak', 12000]],
    try: [
      {
        say: 'Move the shell out to 1 km. The capacitance settles at 5.564 pF, which is the isolated sphere.',
        set: { b: 1000 },
        reads: [['C.value', 5.5635e-12]],
      },
      {
        say: 'Bring the shell in to 55 mm instead. The capacitance rises to 61.20 pF as the gap halves.',
        set: { b: 0.055 },
        reads: [['C.value', 6.1196e-11]],
      },
    ],
    why:
      'The spherical form is 4πε ab over (b − a). Send b to infinity and it becomes 4πεa, which is the ' +
      'capacitance of a sphere with no second conductor anywhere. That number is real, and it is why a charged ' +
      'object has a voltage at all. The other conductor in that case is the rest of the universe. This is the one ' +
      'geometry in the group that neglects nothing, because a closed shell has no field outside it and so no ' +
      'fringing to leave out.',
  },

  b4: {
    see:
      'Two wires of 0.4 mm radius, 6 mm between their centres, hold 10.29 pF/m. The map shows the field crowding ' +
      'on the facing sides of the two wires, where it reaches 52.87 kV/m at 100 V.',
    seeReads: [['C.perMetre', 1.0289e-11], ['E.peak', 52872]],
    try: [
      {
        say: 'Move the wires to 12 mm apart. The capacitance falls to 8.181 pF/m.',
        set: { d: 12e-3 },
        reads: [['C.perMetre', 8.181e-12]],
      },
      {
        say: 'Set the wire radius to 0.8 mm instead. The capacitance rises to 13.93 pF/m.',
        set: { a: 0.8e-3 },
        reads: [['C.perMetre', 1.3932e-11]],
      },
    ],
    why:
      'Two charged round wires do not carry uniform charge, because each one attracts the other’s charge round to ' +
      'its near side. The trick is to replace each wire by a line charge placed not at its centre but offset ' +
      'towards the other, at a distance whose square is (d/2)² − a². Those two line charges make circles of constant ' +
      'potential that fall exactly on the two wire surfaces, so the answer is exact at any spacing. It is ' +
      'πε over arccosh(d/2a). The πε over ln(d/a) that older books give is the wide-spacing limit of it, and at ' +
      'these dimensions the two differ by about a fifth of a per cent.',
  },

  b5: {
    see:
      'One metre of RG-58 at 100 V stores 0.5272 µJ. That energy is not on the conductors. It is spread through the ' +
      'dielectric, densest at the inner conductor where the field is largest, at 0.3490 J/m³.',
    seeReads: [['W.total', 5.2719e-7], ['W.density', 0.34902]],
    try: [
      {
        say: 'Double the voltage to 200 V. The energy quadruples to 2.109 µJ, because it follows the square.',
        set: { V: 200 },
        reads: [['W.total', 2.1088e-6]],
      },
      {
        say: 'Set the dielectric to 1. The energy falls to 0.2343 µJ, in the ratio of the two permittivities.',
        set: { epsr: 1 },
        reads: [['W.total', 2.3431e-7]],
      },
    ],
    why:
      'A capacitor’s energy is CV²/2, and integrating εE²/2 over the dielectric gives the same number. Those are ' +
      'two descriptions of one thing, and the second says where the energy is. It is in the field. The energy ' +
      'density is largest where the field is largest, so a coaxial cable stores most of its energy in the thin ' +
      'shell of dielectric next to the inner conductor. That is also where it fails, and a cable rated for a ' +
      'voltage is rated by that peak field and not by the average one.',
  },
}
