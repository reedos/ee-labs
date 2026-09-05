// Group E's three registers. E5 and E6 are the seam to the Power Lab, whose
// group D assumes exactly the magnetic circuit E5 builds.

export const LESSONS_E = {
  e1: {
    see:
      'A 50 mm loop carrying 3 A. Biot-Savart is summed over 720 straight pieces of it, and at the centre that ' +
      'gives 37.70 µT. The closed form for a circular loop gives the same number to six figures.',
    seeReads: [['B.probe', 3.7699e-5], ['closed', 3.7699e-5]],
    try: [
      {
        say: 'Move the probe to 50 mm up the axis. The field falls to 13.33 µT, and the two routes still agree.',
        set: { z: 0.05 },
        reads: [['B.probe', 1.3329e-5], ['closed', 1.3329e-5]],
      },
      {
        say: 'Cut the loop into 12 sides. The sum gives 38.59 µT against the circle’s 37.70 µT, a 2.3 per cent error.',
        set: { sides: 12 },
        reads: [['B.probe', 3.8585e-5], ['closed', 3.7699e-5]],
      },
      {
        say: 'Halve the loop radius to 25 mm. The centre field doubles to 75.40 µT.',
        set: { a: 0.025 },
        reads: [['B.probe', 7.5399e-5]],
      },
    ],
    why:
      'Biot-Savart says each short piece of current makes a field that falls as one over the square of the ' +
      'distance and points at right angles to both the piece and the line to the field point. A whole wire is the ' +
      'sum of its pieces, and one straight piece has a closed form. So the app draws any shape as a polyline and ' +
      'adds. A polygon of s sides differs from the circle it stands for by a term of order one over s squared, ' +
      'which is why 12 sides is 2.3 per cent out and 720 sides is not. Nothing here is a special case for a loop.',
  },

  e2: {
    see:
      'A long straight wire carrying 10 A. The field at 20 mm is 100.0 µT and it circles the wire. Integrate that ' +
      'field around a circular contour of 20 mm and the result says the contour encloses 10.00 A.',
    seeReads: [['B.probe', 1e-4], ['ampere.enclosed', 10]],
    try: [
      {
        say: 'Widen the contour to 40 mm. The field there has halved, and the contour still measures 10.00 A.',
        set: { r: 0.04 },
        reads: [['B.probe', 5e-5], ['ampere.enclosed', 10]],
      },
      {
        say: 'Move the contour 60 mm to one side, off the wire. It now encloses nothing and measures 0 A.',
        set: { off: 0.06 },
        reads: [['ampere.enclosed', 0]],
      },
    ],
    why:
      'Ampère’s law is the magnetic twin of Gauss’s law. The line integral of B around any closed loop is µ₀ ' +
      'times the current threading it, whatever the shape of the loop and wherever inside it the current runs. A ' +
      'wider contour sees a weaker field over a longer path, and the product does not change. It is used here the ' +
      'way Gauss’s law was used in group A. Where a geometry is symmetric enough it hands over the field in one ' +
      'line. Everywhere else it is a check on a field found by summing Biot-Savart.',
  },

  e3: {
    see:
      'A solenoid, 400 turns over 200 mm on a 10 mm bore, carrying 2 A. On the axis at the centre it gives ' +
      '5.002 mT. An infinitely long solenoid of the same turns per metre would give 5.027 mT, so this one reaches ' +
      '99.50 per cent of that.',
    seeReads: [['solenoid.B', 0.0050016], ['solenoid.fraction', 0.99504]],
    try: [
      {
        say: 'Move to the end of the winding, 100 mm out. The field is 2.510 mT, about half the middle value.',
        set: { z: 0.1 },
        reads: [['solenoid.B', 0.0025101]],
      },
      {
        say: 'Shorten the coil to 50 mm with the same 400 turns. The field rises to 18.67 mT, now 92.85 per cent of the limit.',
        set: { len: 0.05 },
        reads: [['solenoid.B', 0.018668], ['solenoid.fraction', 0.92848]],
      },
    ],
    why:
      'Ampère’s law on a long solenoid gives B = µnI inside and nothing outside, where n is turns per metre. A ' +
      'real coil is not long, so the field at a point on the axis is set by the angles the two ends subtend there. ' +
      'At the centre of a long coil those angles are nearly straight and the answer is nearly the limit. At the end ' +
      'of a long coil one end has moved to a right angle, and the field is half. The fraction on the panel says how ' +
      'far the coil in hand is from the textbook one.',
  },

  e4: {
    see:
      'The RG-58 geometry once more, now for its inductance. The field between the conductors gives 237.4 nH/m. ' +
      'Together with the 105.4 pF/m of B2 that is everything a transmission line needs, which is where group I ' +
      'starts.',
    seeReads: [['L.perMetre', 2.3743e-7]],
    try: [
      {
        say: 'Set the internal knob to 1, which counts the field inside the inner conductor. It adds 50.00 nH/m.',
        set: { internal: 1 },
        reads: [['L.perMetre', 2.8743e-7]],
      },
      {
        say: 'Set the relative permeability to 100. The inductance rises a hundredfold to 23.74 µH/m.',
        set: { mur: 100 },
        reads: [['L.perMetre', 2.3743e-5]],
      },
    ],
    why:
      'Inductance is flux linkage over current. Ampère gives B = µI/2πr between the conductors, and integrating ' +
      'that from a to b gives the flux one metre of line links, so L′ is µ/2π times ln(b/a). The internal term is ' +
      'the flux inside the solid inner conductor, which links only part of the current. It works out to µ₀/8π ' +
      'exactly, 50 nH/m, whatever the wire’s radius. At any frequency where the current has crowded to the surface ' +
      'that term has gone, which is what F4 is about, so it is off by default.',
  },

  e5: {
    see:
      'A core of relative permeability 2000, a 200 mm path, 400 mm² of iron, and a 1 mm air gap. Two hundred turns ' +
      'at 1 A give 18.29 mH. The gap is half a per cent of the path and takes 90.95 per cent of the drive.',
    seeReads: [['circuit.inductance', 0.018287], ['circuit.gapShare', 0.9095]],
    try: [
      {
        say: 'Close the gap. The inductance rises to 201.1 mH, eleven times what it was.',
        set: { gap: 0 },
        reads: [['circuit.inductance', 0.20106]],
      },
      {
        say: 'Open the gap to 8 mm. The inductance falls to 2.484 mH, and the fringing guard now refuses the figure.',
        set: { gap: 8e-3 },
        reads: [['circuit.inductance', 0.0024835], ['circuit.guard.ok', false]],
      },
    ],
    why:
      'A magnetic circuit is the electric one with three words changed. Magnetomotive force NI stands for voltage, ' +
      'flux for current, and reluctance l/µA for resistance. Reluctances in series add, so the flux is NI over the ' +
      'total. Air has a permeability 2000 times smaller than the core here, so a millimetre of it out-reluctances ' +
      '199 mm of iron. That is why a gapped inductor stores energy in the gap and why its inductance is set by the ' +
      'gap and not by the iron. Closing the gap here drives the core to 2.5 T, where a real one would have ' +
      'saturated, and this model has no saturation in it.',
  },

  e6: {
    see:
      'Two windings on that core, 200 turns and 50. Each one’s inductance is its turns squared over the ' +
      'reluctance, so they are 205.2 mH and 12.82 mH. The mutual inductance is 50.27 mH and the coupling ' +
      'coefficient 0.9800.',
    seeReads: [['xfmr.L1', 0.20517], ['xfmr.L2', 0.012823], ['xfmr.M', 0.050265], ['xfmr.k', 0.98]],
    try: [
      {
        say: 'Set the leakage to zero. The coupling becomes exactly 1, and L₁L₂ equals M squared.',
        set: { leakage: 0 },
        reads: [['xfmr.k', 1], ['xfmr.L1', 0.20106]],
      },
      {
        say: 'Set the secondary to 200 turns. Both inductances read 205.2 mH and the mutual reads 201.1 mH.',
        set: { n2: 200 },
        reads: [['xfmr.L1', 0.20517], ['xfmr.L2', 0.20517], ['xfmr.M', 0.20106]],
      },
    ],
    why:
      'A transformer is two windings sharing one magnetic circuit. Each winding’s self-inductance is its own turns ' +
      'squared over the reluctance it sees, and the mutual inductance is the product of the two turns over the ' +
      'reluctance they share. With every flux line linking both windings those three numbers satisfy M² = L₁L₂ ' +
      'exactly, and the coupling coefficient is one. Real windings leak some flux past each other, and the ' +
      'coupling coefficient falls to one minus that fraction. A short-circuit test measures the leakage ' +
      'inductance directly, which is what a datasheet quotes.',
  },
}
