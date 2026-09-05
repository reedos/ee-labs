// Group A's three registers. Every number here was measured by
// scripts/readings.mjs before it was written, and experiments.test.js
// recomputes each one at the setting its step names.

export const LESSONS_A = {
  a1: {
    see:
      'Two 1 nC charges sit 10 mm apart. Coulomb’s law puts 89.88 µN of force between them, along the line ' +
      'joining them. Both charges are positive, so they push apart. The map shows the field the pair makes, and the ' +
      'probe sits above the midpoint.',
    seeReads: [['force', 8.9876e-5]],
    try: [
      {
        say: 'Set the separation to 20 mm. The force falls to 22.47 µN, a quarter of what it was.',
        set: { d: 0.02 },
        reads: [['force', 2.2469e-5]],
      },
      {
        say: 'Set the second charge to −1 nC. The force reads −89.88 µN, the same size pulling instead of pushing.',
        set: { q2: -1e-9 },
        reads: [['force', -8.9876e-5]],
      },
      {
        say: 'Read the probe above the midpoint. The field there is 254.2 kV/m at the defaults.',
        reads: [['E.probe', 254210]],
      },
    ],
    why:
      'Coulomb’s law says the force between two point charges is q₁q₂ over 4πε₀r². The square in the ' +
      'denominator is what makes doubling the distance quarter the force. The sign of the product decides the ' +
      'direction, so two like charges push and two unlike charges pull. Dividing that force by the second charge ' +
      'leaves the field of the first, in volts per metre, which is what the map draws. A field is a property of the ' +
      'space around a charge, and it is there whether or not a second charge is present to feel it.',
  },

  a2: {
    see:
      'A positive charge on the left and a negative one on the right, 10 mm apart. The probe sits 1 mm above the ' +
      'midpoint and reads 677.9 kV/m. The two contributions point the same way there, so they add.',
    seeReads: [['E.probe', 677920]],
    try: [
      {
        say: 'Set the right charge to +1 nC. The probe reads 135.6 kV/m, because the two contributions now oppose.',
        set: { q2: 1e-9 },
        reads: [['E.probe', 135580]],
      },
      {
        say: 'Raise the probe to 5 mm. The field falls to 254.2 kV/m as the pair looks smaller from further away.',
        set: { y: 0.005 },
        reads: [['E.probe', 254210]],
      },
    ],
    why:
      'Superposition is the whole of this group. The field of several charges is the vector sum of the field each ' +
      'would make alone, and no charge changes what another one does. On the midplane between an opposed pair the ' +
      'two contributions point the same way, so they add to twice one of them. Turn the right charge positive and ' +
      'the horizontal parts cancel instead. That is why the reading falls by a factor of five rather than staying ' +
      'put. Superposition holds because Maxwell’s equations are linear in the sources.',
  },

  a3: {
    see:
      'A 2 nC charge sits a little off the centre of a 50 mm sphere. The flux out of that sphere implies 2.000 nC ' +
      'of charge inside, which is what is there. Gauss’s law does not care where inside the surface the charge sits.',
    seeReads: [['gauss.implied', 2e-9]],
    try: [
      {
        say: 'Move the charge to 20 mm off centre. The implied charge still reads 2.000 nC.',
        set: { off: 0.02 },
        reads: [['gauss.implied', 2e-9]],
      },
      {
        say: 'Set the outside knob to 1, which puts the charge beyond the sphere. The flux falls to nothing.',
        set: { outside: 1 },
        reads: [['gauss.enclosed', 0]],
      },
    ],
    why:
      'Gauss’s law says the flux of E out of any closed surface is the charge inside divided by ε₀. The ' +
      'shape of the surface does not enter it, and neither does where inside the charge sits. A charge outside ' +
      'contributes flux inward on one side and outward on the other, and the two cancel exactly. This lab uses the ' +
      'law twice. Where a geometry has enough symmetry it gives the field in one line, as it does for the coaxial ' +
      'cable in B2. Everywhere else it is a check on a field found another way, which is what C4 does to the grid.',
  },

  a4: {
    see:
      'A line of charge at 1 nC/m gives 1798 V/m at 10 mm. A sheet at 1 nC/m² gives 56.47 V/m, and it gives the ' +
      'same 56.47 V/m at every distance. The profile draws all three laws against distance.',
    seeReads: [['line.field', 1797.5], ['sheet.field', 56.47]],
    try: [
      {
        say: 'Set the distance to 20 mm. The line reads 898.8 V/m, half of what it was, while the sheet has not moved.',
        set: { r: 0.02 },
        reads: [['line.field', 898.76], ['sheet.field', 56.47]],
      },
      {
        say: 'Double the line charge to 2 nC/m. The line reads 3595 V/m, because the field follows the charge.',
        set: { lambda: 2e-9 },
        reads: [['line.field', 3595]],
      },
    ],
    why:
      'The three fall-off laws come from the same Gauss’s law applied to three surfaces. Around a point charge ' +
      'the surface is a sphere whose area grows as r², so the field falls as one over r². Around a line the ' +
      'surface is a cylinder whose area grows as r, so the field falls as one over r. Beside a sheet the surface is ' +
      'a box whose area does not grow at all, so the field does not fall. Each geometry spreads the same flux over ' +
      'a different area, and the area is what sets the law.',
  },

  a5: {
    see:
      'Two opposed 2 nC charges, 20 mm apart. The curve is traced by walking at right angles to the field, so the ' +
      'potential along it does not change. It holds 1712 V all the way round, to about one part in a thousand ' +
      'million.',
    seeReads: [['curve.level', 1711.9]],
    try: [
      {
        say: 'Set the start to 4 mm from the left charge. The curve moves to the 3370 V level and tightens around it.',
        set: { start: 0.004 },
        reads: [['curve.level', 3370.3]],
      },
      {
        say: 'Set the step to 0.1 mm. The curve is drawn from 436 points instead of 872, and it holds the same level.',
        set: { step: 1e-4 },
        reads: [['curve.points', 436], ['curve.level', 1711.9]],
      },
    ],
    why:
      'The potential is a scalar, one number at each point, and the field is minus its gradient. A gradient points ' +
      'along the steepest rise, so the field is perpendicular to every surface of constant potential. That is why ' +
      'the field lines and the equipotentials on the map cross at right angles everywhere. Walking at right angles ' +
      'to the field therefore keeps the potential fixed, which is how the curve is traced. Every solver in this lab ' +
      'solves for the potential and differentiates afterwards, because one number per point is easier to relax than ' +
      'two.',
  },
}
