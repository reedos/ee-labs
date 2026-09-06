// Group H's three registers. One boundary, met three ways. The last of them is
// where this lab declines a case rather than approximating it, and H3's third
// step is that refusal.

export const LESSONS_H = {
  h1: {
    see:
      'A wave in air meeting a dielectric of permittivity 4. The second medium’s impedance is half the first’s, ' +
      'so a third of the field comes back. A third of the field is 11.11 per cent of the power, the rest goes ' +
      'through, and the two fractions add to one.',
    seeReads: [
      ['refl.mag', 0.333333],
      ['refl.powerReflected', 0.111111],
      ['refl.powerTransmitted', 0.888889],
      ['refl.wave2.etaMag', 188.3652],
    ],
    try: [
      {
        say: 'Set the second permittivity to 9. The reflected field rises to 0.5000 and the reflected power to 25.00 per cent.',
        set: { epsr2: 9 },
        reads: [['refl.mag', 0.5], ['refl.powerReflected', 0.25]],
      },
      {
        say: 'Set it to 1 instead. There is no boundary left, nothing reflects, and the whole wave goes through.',
        set: { epsr2: 1 },
        reads: [['refl.mag', 0], ['refl.powerTransmitted', 1]],
      },
      {
        say: 'Swap the media, going from the dielectric out into air. The same third comes back, and its sign has changed.',
        set: { epsr1: 4, epsr2: 1 },
        reads: [['refl.mag', 0.333333], ['refl.deg', 0]],
      },
    ],
    why:
      'Two conditions hold where two media meet. The tangential E on one side equals the tangential E on the other, ' +
      'and the same is true of H. One incident wave cannot satisfy both, so a reflected wave and a transmitted ' +
      'wave are what the boundary requires rather than what it happens to produce. Solving the pair gives the ' +
      'reflection coefficient as the difference of the two impedances over their sum. Going into a lower ' +
      'impedance makes it negative, which is a half-cycle turn on the way back. The power fractions add to one ' +
      'because no energy is stored at a boundary of zero thickness.',
  },

  h2: {
    see:
      'The same boundary, with the incident and reflected waves drawn together. Where they agree the field is ' +
      '1.333 of one wave alone, and where they oppose it is 0.6667, a ratio of 2.000. The pattern repeats every ' +
      '149.9 mm, which is half a wavelength.',
    seeReads: [
      ['standing.swr', 2.0],
      ['standing.max', 1.33333],
      ['standing.min', 0.666667],
      ['standing.period', 0.1498962],
      ['standing.firstMinAt', 0],
    ],
    try: [
      {
        say: 'Set the second permittivity to 2.25. The ratio falls to 1.500, because less of the wave comes back to interfere with it.',
        set: { epsr2: 2.25 },
        reads: [['standing.swr', 1.5], ['refl.mag', 0.2]],
      },
      {
        say: 'Set the frequency to 2 GHz. The ratio has not moved and the pattern now repeats every 74.95 mm.',
        set: { f: 2e9 },
        reads: [['standing.swr', 2.0], ['standing.period', 0.0749481]],
      },
      {
        say: 'Swap the media at 2 GHz. The ratio is 2.000 still, and the first minimum has moved off the boundary to 18.74 mm.',
        set: { epsr1: 4, epsr2: 1, f: 2e9 },
        reads: [['standing.swr', 2.0], ['standing.firstMinAt', 0.0187370]],
      },
    ],
    why:
      'The incident wave and the reflected wave are in the same place at the same time, so what a probe reads is ' +
      'their sum. The two run in opposite directions, so their relative phase turns twice as fast as either, and ' +
      'the sum runs between the sum and the difference of the amplitudes every half wavelength. The ratio of ' +
      'those two is what a standing-wave meter reads, and it gives the size of the reflection without needing to ' +
      'separate the waves. The position of the first minimum gives its phase. Together they fix the reflection ' +
      'coefficient, which is how a load is measured through a length of line.',
  },

  h3: {
    see:
      'The same pair of media met at 45 degrees, with the electric field in the plane of incidence. The wave ' +
      'reflects 0.2038 of the field and refracts to 20.70 degrees on the far side. The curve shows both ' +
      'polarisations against the angle, and they are not the same law.',
    seeReads: [
      ['oblique.parallel.mag', 0.203777],
      ['oblique.perpendicular.mag', 0.451416],
      ['oblique.transmittedDeg', 20.7048],
      ['oblique.brewsterDeg', 63.4349],
    ],
    try: [
      {
        say: 'Sit at the Brewster angle, 63.43 degrees. The parallel polarisation reflects nothing at all, while the perpendicular one still reflects 0.6000.',
        set: { brewster: 1 },
        reads: [['oblique.thetaDeg', 63.43495], ['oblique.parallel.mag', 0], ['oblique.perpendicular.mag', 0.6]],
      },
      {
        say: 'Swap the media and stay at 45 degrees. That is past the critical angle of 30 degrees, so the magnitude is exactly 1.000 and nothing is transmitted.',
        set: { epsr1: 4, epsr2: 1 },
        reads: [['oblique.mag', 1], ['oblique.criticalDeg', 30], ['oblique.total', true]],
      },
      {
        say: 'Make the second medium sea water. The lab declines the case, because the transmitted angle is no longer an angle.',
        set: { lossy: 1 },
        refuses: true,
      },
    ],
    why:
      'At an angle the boundary conditions are applied to the components along the surface, and how much of E ' +
      'lies along the surface depends on which way it points. So the wave splits into two problems. With E in ' +
      'the plane of incidence there is one angle where the reflected and transmitted directions are at right ' +
      'angles. The reflected wave would then have to radiate along the axis of a dipole, and nothing does that, ' +
      'so nothing comes back. That is the Brewster angle, and it is why polarised sunglasses cut glare off ' +
      'water. Going the other way the transmitted angle reaches 90 degrees at the critical angle. Past it no ' +
      'power crosses at all and everything is reflected.',
  },
}
