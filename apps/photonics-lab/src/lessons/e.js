// Group E's three registers. Every number here was computed by
// scripts/pins.mjs before it was written, and experiments.test.js recomputes
// each one at the setting its step names.

export const LESSONS_E = {
  e1: {
    see:
      'Standard fibre loses 0.2 dB every kilometre at 1550 nm. Over 80 km that is 16.000 dB, so 1 mW arrives as ' +
      '−16.000 dBm. The curve draws the power falling along the length, with the far end marked.',
    seeReads: [
      ['att.db', 16.0],
      ['att.outDbm', -16.0],
    ],
    try: [
      {
        say: 'Set the attenuation to 0.35 dB/km and the wavelength to 1310 nm. The loss over the same span is 28.000 dB.',
        set: { alphaDb: 0.35, lambda: 1310e-9 },
        reads: [['att.db', 28.0]],
      },
      {
        say: 'Set the attenuation to 2 dB/km and the wavelength to 850 nm. The loss is 160.00 dB, which is why no long link runs there.',
        set: { alphaDb: 2, lambda: 850e-9 },
        reads: [
          ['att.db', 160.0],
          ['att.ratio', 1e-16],
        ],
      },
      {
        say: 'Set the length to 40 km. The loss halves to 8.0000 dB, because decibels add along the fibre.',
        set: { length: 40e3 },
        reads: [['att.db', 8.0]],
      },
    ],
    why:
      'A fibre takes the same fraction of the power out of every kilometre, so the loss in decibels is proportional ' +
      'to length. That is what makes a power budget a sum. Two spans in series cost the sum of their losses, and ' +
      'their power ratios multiply. Silica has three low-loss windows, and the attenuation knob is where a reader ' +
      'states which one the fibre is in. Those figures are properties of the glass and are stated rather than ' +
      'derived here. Rayleigh scattering sets the short-wavelength edge of the low-loss region and an infrared ' +
      'absorption band sets the long one, which leaves 1550 nm as the quietest place to put a long link.',
  },

  e2: {
    see:
      'A 1 nm source over 80 km of fibre with a dispersion parameter of 17 spreads a pulse by 1360.0 ps. The pulse ' +
      'view draws the pulse going in and the same pulse coming out. Both widths are printed under them.',
    seeReads: [['disp.spread', 1360.0e-12]],
    try: [
      {
        say: 'Set the source width to 0.1 nm. The spread falls to 136.00 ps, ten times narrower for ten times fewer colours.',
        set: { dLambda: 0.1e-9 },
        reads: [['disp.spread', 136.0e-12]],
      },
      {
        say: 'Set the length to 40 km. The spread is 680.00 ps, half of what it was over twice the distance.',
        set: { length: 40e3 },
        reads: [['disp.spread', 680.0e-12]],
      },
      {
        say: 'Set the dispersion parameter to 2. The spread falls to 160.00 ps at the same length and source width.',
        set: { D: 2 },
        reads: [['disp.spread', 160.0e-12]],
      },
    ],
    why:
      'Different colours travel at different speeds in glass. A source is not one colour, so the parts of a pulse ' +
      'arrive at different times and the pulse comes out wider than it went in. The spread is the dispersion ' +
      'parameter times the length times the source width, which is exact for the first-order model this lab uses. ' +
      'Written the other way the same fibre has a group-velocity dispersion of −21.683 ps² a kilometre at 1550 nm. ' +
      'The sign flips between the two forms and both describe one fibre. Narrowing the source is the cheapest of ' +
      'the ways to buy bandwidth, and it is most of what a laser buys over a light-emitting diode.',
    whyReads: [['disp.beta2ps', -21.683]],
  },

  e3: {
    see:
      'Under a criterion of 0.25 a 1 nm source over 80 km is limited to 0.18382 Gbit/s. The criterion is a choice, ' +
      'and the pane names the one in use. The bandwidth-distance product at this source width is 14.706 Gbit/s km.',
    seeReads: [
      ['limit.rate', 0.18382e9],
      ['limit.product', 14.706e12],
    ],
    try: [
      {
        say: 'Set the source width to 0.1 nm. The limit rises to 1.8382 Gbit/s over the same 80 km.',
        set: { dLambda: 0.1e-9 },
        reads: [['limit.rate', 1.8382e9]],
      },
      {
        say: 'Set the length to 8 km and keep the 1 nm source. The limit is 1.8382 Gbit/s again, because only the product is fixed.',
        set: { length: 8e3 },
        reads: [['limit.rate', 1.8382e9]],
      },
      {
        say: 'Set the criterion to 0.5. The same fibre now allows 0.36765 Gbit/s, and neither number is more correct.',
        set: { criterion: 0.5 },
        reads: [['limit.rate', 0.36765e9]],
      },
    ],
    why:
      'A spread pulse runs into its neighbours. How much spread is too much is a choice, and this lab holds the ' +
      'spread to a quarter of a bit period. Another criterion gives another number, so the pane prints the one it ' +
      'used. The spread is proportional to length and to source width, so the rate a fibre allows is inversely ' +
      'proportional to both. Multiply the rate by the length and the answer stops depending on either, which is ' +
      'why a fibre is specified by a bandwidth-distance product rather than by a bandwidth. Halve the length and ' +
      'the rate doubles. Narrow the source by ten and the rate rises by ten.',
  },

  e4: {
    see:
      'A core index of 1.4675 against a cladding of 1.4622 gives a numerical aperture of 0.12461 and an acceptance ' +
      'angle of 7.1582 degrees. At 1550 nm the core has to be under 9.5224 µm across to carry one mode. The curve ' +
      'draws V against core radius.',
    seeReads: [
      ['geo.na', 0.12461],
      ['geo.angle', 7.1582],
      ['geo.single', 9.5224e-6],
    ],
    try: [
      {
        say: 'Set the core radius to 25 µm and the wavelength to 850 nm. V rises to 23.028 and the core carries about 265 modes.',
        set: { a: 25e-6, lambda: 850e-9 },
        reads: [
          ['geo.v', 23.028],
          ['geo.modes', 265],
        ],
      },
      {
        say: 'Set the core radius back to 4.5 µm. V is 2.2731, under the single-mode limit, so one mode propagates.',
        set: { a: 4.5e-6 },
        reads: [
          ['geo.v', 2.2731],
          ['geo.modes', 1],
        ],
      },
      {
        say: 'Set the cladding index to 1.44. The numerical aperture rises to 0.28277 and the angle to 16.425 degrees.',
        set: { n2: 1.44 },
        reads: [
          ['geo.na', 0.28277],
          ['geo.angle', 16.425],
        ],
      },
    ],
    why:
      'Light stays in the core when it meets the boundary past the critical angle. The numerical aperture is the ' +
      'sine of the largest angle in air that still does, and it is the square root of the difference of the two ' +
      'squared indices. A wider acceptance cone takes more light from a source and carries more modes, and each ' +
      'mode arrives at its own time. The normalised frequency V gathers the core radius, the aperture and the ' +
      'wavelength into one number, and below 2.405 only one mode propagates. Above that the count is about V ' +
      'squared over two, which is an estimate and the pane labels it as one. The wave equation these come from is ' +
      'the Fields Lab’s.',
    whyReads: [['geo.vLimit', 2.405]],
  },

  e5: {
    see:
      'A −3 dBm transmitter over 80 km of 0.2 dB/km fibre loses 18.400 dB in all, so −21.400 dBm reaches a receiver ' +
      'that hears −28 dBm. The margin is 6.600 dB. The waterfall draws every line item, including the three set to ' +
      'zero.',
    seeReads: [
      ['budget.total', 18.4],
      ['budget.received', -21.4],
      ['budget.margin', 6.6],
    ],
    try: [
      {
        say: 'Set the length to 120 km. The total loss is 26.400 dB and the margin falls to −1.4000 dB, so the link no longer closes.',
        set: { length: 120e3 },
        reads: [
          ['budget.total', 26.4],
          ['budget.margin', -1.4],
        ],
      },
      {
        say: 'Read the two reaches. Loss allows 98.000 km with 3 dB reserved, and dispersion allows 1.4706 km at 10 Gbit/s.',
        reads: [
          ['reach.length', 98.0e3],
          ['reach.dispersion', 1.4706e3],
          ['reach.binds', 'dispersion'],
        ],
      },
      {
        say: 'Set the bit rate to 100 Mbit/s. Dispersion now allows 147.06 km, so loss binds instead.',
        set: { rate: 1e8 },
        reads: [
          ['reach.dispersion', 147.06e3],
          ['reach.binds', 'loss'],
        ],
      },
    ],
    why:
      'A link budget is a sum of decibels. The transmitter’s power goes in at the top, every loss comes off it, and ' +
      'what is left has to clear the receiver’s sensitivity. The margin is what remains, and a link with none of it ' +
      'fails the first time a connector is dirty. Every loss this model leaves out is a line item set to zero ' +
      'rather than a line item missing. The waterfall therefore shows modal noise, the reflection penalty and ' +
      'mode-partition noise as decisions a reader can see. A link is stopped by one of two limits. Loss says how ' +
      'far the power reaches and dispersion says how far the pulse stays clean, and the shorter of the two ' +
      'reaches is the answer.',
  },
}
