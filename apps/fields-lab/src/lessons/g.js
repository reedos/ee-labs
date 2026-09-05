// Group G's three registers. This is the group where the first half's four
// separate laws become one set, so every note here points back at one of them
// and forward at the wave they make together.

export const LESSONS_G = {
  g1: {
    see:
      'A square centimetre of plate at 1 mm spacing, charging at a million volts a second. The wire into it ' +
      'carries 885.4 nA. Nothing crosses the gap between the plates, and yet the displacement current there is ' +
      '885.4 nA as well, so both surfaces count the same current.',
    seeReads: [
      ['displacement.conduction', 8.8542e-7],
      ['displacement.through', 8.8542e-7],
      ['displacement.difference', 0],
    ],
    try: [
      {
        say: 'Set the dielectric to 3.9. The current rises to 3.453 µA, because the same field now moves more charge.',
        set: { epsr: 3.9 },
        reads: [['displacement.conduction', 3.4531e-6]],
      },
      {
        say: 'Raise the rate to a billion volts a second. The current rises to 885.4 µA, a thousandfold, in step with it.',
        set: { rate: 1e9 },
        reads: [['displacement.conduction', 8.8542e-4]],
      },
      {
        say: 'Halve the spacing to 0.5 mm. The current doubles to 1.771 µA, since halving the gap doubles the capacitance.',
        set: { gap: 5e-4 },
        reads: [['displacement.conduction', 1.7708e-6]],
      },
    ],
    why:
      'Ampère wrote that the line integral of H round a loop equals the current through any surface that loop ' +
      'bounds. Stretch the surface so it passes between the plates instead of cutting the wire. No conduction ' +
      'current crosses it, so one loop would enclose two different currents, which cannot be. Maxwell’s term ' +
      'removes the contradiction. A changing electric field is itself a current density, ε dE/dt, and the ' +
      'displacement current through the gap equals the conduction current in the wire exactly. Charge ' +
      'conservation needs that term, and so does everything after it in this lab. A changing E makes an H, that ' +
      'H changes and makes an E, and the pair travels.',
  },

  g2: {
    see:
      'A plane wave in free space at 1 GHz. E and H sit at right angles to each other and to the direction of ' +
      'travel, they rise and fall together, and their ratio is 376.7 Ω. The wavelength is 299.8 mm and the wave ' +
      'moves at the speed of light.',
    seeReads: [
      ['wave.etaMag', 376.7303],
      ['wave.lambda', 0.2997925],
      ['wave.vp', 299792458],
      ['wave.alpha', 0],
    ],
    try: [
      {
        say: 'Set the permittivity to 4. The impedance halves to 188.4 Ω and the wavelength to 149.9 mm, since both carry one over its square root.',
        set: { epsr: 4 },
        reads: [['wave.etaMag', 188.3652], ['wave.lambda', 0.1498962]],
      },
      {
        say: 'Set the frequency to 2.4 GHz. The wavelength falls to 124.9 mm and the impedance has not moved.',
        set: { f: 2.4e9 },
        reads: [['wave.lambda', 0.1249135], ['wave.etaMag', 376.7303]],
      },
      {
        say: 'Set the permeability to 4 instead. The impedance doubles to 753.5 Ω while the speed halves as before.',
        set: { mur: 4 },
        reads: [['wave.etaMag', 753.4606], ['wave.vp', 1.4989623e8]],
      },
    ],
    why:
      'With the displacement current in place, the four equations give a wave equation for E on its own and ' +
      'another for H. A solution travelling one way has E across the direction of travel, H across both, and the ' +
      'two in step everywhere. Their ratio is the square root of µ over ε, which is 376.7 Ω in vacuum and is ' +
      'called the intrinsic impedance. The speed is one over the square root of µε. Neither depends on how strong ' +
      'the wave is or on what made it. Raising the permittivity slows the wave and lowers the impedance together, ' +
      'while raising the permeability slows it and raises the impedance, which is how the two are told apart.',
  },

  g3: {
    see:
      'This is sea water at 1 MHz. Its conduction current is 887.7 times its displacement current, so the ' +
      'medium is a good conductor here. The wave falls by 3.972 nepers a metre and is down to a third of itself ' +
      'after 25.18 cm. The impedance leans 44.97 degrees, close to the 45 of a perfect conductor.',
    seeReads: [
      ['wave.lossTangent', 887.66],
      ['wave.alpha', 3.9716],
      ['wave.penetration', 0.2517878],
      ['wave.etaDeg', 44.9677],
    ],
    try: [
      {
        say: 'Set the frequency to 1 GHz. The loss tangent falls to 0.8877, the wave penetrates 1.291 cm, and the impedance angle drops to 20.80 degrees.',
        set: { f: 1e9 },
        reads: [['wave.lossTangent', 0.88766], ['wave.penetration', 0.0129125], ['wave.etaDeg', 20.7971]],
      },
      {
        say: 'Set the conductivity to 100 µS/m, which is fresh water. The loss tangent falls to 0.02219 and the wave penetrates 477.8 m.',
        set: { sigma: 1e-4 },
        reads: [['wave.lossTangent', 0.0221915], ['wave.penetration', 477.82]],
      },
      {
        say: 'Put the conductivity back and set the permittivity to 1. The loss tangent rises eighty-one times, since only the displacement current fell.',
        set: { epsr: 1 },
        reads: [['wave.lossTangent', 71900.4]],
      },
    ],
    why:
      'A medium with conductivity carries two currents when a wave passes through it. The conduction current σE ' +
      'follows Ohm’s law and the displacement current ε dE/dt follows Maxwell’s term, and the loss tangent is the ' +
      'ratio of their sizes. Well above one the medium behaves as a conductor and well below one as a ' +
      'dielectric. The crossing moves with frequency, because only the displacement current grows with it. In the ' +
      'conducting limit the intrinsic impedance leans towards 45 degrees and the attenuation equals the phase ' +
      'constant, which is F4’s skin depth seen as a wave. This is why a submarine is reached at very low ' +
      'frequencies and not at broadcast ones.',
  },

  g4: {
    see:
      'Two components of one wave, equal in size, a quarter cycle apart in phase. The tip of the field vector ' +
      'traces a circle once a cycle, so the axial ratio is 1.000 and the wave is circularly polarised. Which way it ' +
      'turns is the sign of that quarter cycle, and here it is left hand.',
    seeReads: [
      ['pol.axialRatio', 1.0],
      ['pol.axialRatioDb', 0],
      ['pol.kind', 'circular'],
      ['pol.sense', 'left hand'],
    ],
    try: [
      {
        say: 'Halve the up component to 0.5. The ellipse is two to one, an axial ratio of 6.021 dB, and the wave is elliptical.',
        set: { ay: 0.5 },
        reads: [['pol.axialRatio', 2], ['pol.axialRatioDb', 6.0206], ['pol.kind', 'elliptical']],
      },
      {
        say: 'Set the phase to zero. The two components now rise and fall together, the tip runs along a line, and the polarisation is linear.',
        set: { phase: 0 },
        reads: [['pol.kind', 'linear']],
      },
      {
        say: 'Set the phase to 270 degrees. The circle is a circle still, and the sense has turned from left hand to right hand.',
        set: { phase: 270 },
        reads: [['pol.kind', 'circular'], ['pol.sense', 'right hand']],
      },
    ],
    why:
      'A plane wave has two transverse components and nothing makes them keep step. Write each as an amplitude ' +
      'with a phase between them, and over one cycle the tip of the field vector traces an ellipse. Equal ' +
      'amplitudes a quarter cycle apart give a circle. A whole number of half cycles gives a line, and ' +
      'everything between is an ellipse. The axial ratio is the long axis over the short one. It is quoted in ' +
      'decibels because a receiver built for one sense loses that much of a wave of the other. Polarisation ' +
      'belongs to the wave and not to the medium, so it survives the journey unless something along it turns it.',
  },
}
