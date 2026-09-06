// Group F's three registers. Every number here was computed by
// scripts/pins.mjs before it was written, and experiments.test.js recomputes
// each one at the setting its step names.

export const LESSONS_F = {
  f1: {
    see:
      'The cavity is 300 µm of index 3.5 between two facets that reflect 0.30864. Its resonances stand 142.76 GHz ' +
      'apart, which is 1.1440 nm at 1550 nm. The finesse is 2.5245 and each line is 56.549 GHz wide.',
    seeReads: [
      ['fsr', 142.76e9],
      ['fsrWavelength', 1.144e-9],
      ['finesse', 2.5245],
      ['linewidth', 56.549e9],
    ],
    try: [
      {
        say: 'Set the facet reflectance to 0.9. The finesse rises to 29.804 and the linewidth narrows to 4.7899 GHz.',
        set: { r: 0.9 },
        reads: [
          ['finesse', 29.804],
          ['linewidth', 4.7899e9],
        ],
      },
      {
        say: 'Set the facet reflectance to 0.99. The finesse is 312.58 and each peak stands 45.977 dB above the valley beside it.',
        set: { r: 0.99 },
        reads: [
          ['finesse', 312.58],
          ['contrast.db', 45.977],
        ],
      },
      {
        say: 'Set the cavity length to 1 mm. The free spectral range falls to 42.827 GHz, because the round trip is longer.',
        set: { L: 1e-3 },
        reads: [['fsr', 42.827e9]],
      },
    ],
    why:
      'Light that goes once round the cavity and returns in phase adds to itself, so the transmission peaks once ' +
      'every round-trip wavelength. The spacing is the speed of light over twice the optical length, and the ' +
      'finesse says how sharp each peak is against that spacing. Raising the reflectance keeps light inside for ' +
      'more round trips, so the lines narrow and the contrast rises. The response is exact at every frequency and ' +
      'it has no transfer function in s. The round trip carries a factor that is transcendental, so no ratio of ' +
      'polynomials equals it and no finite set of poles describes it. A transmission line meets the same factor, ' +
      'and the suite declines the same hand-over there.',
  },

  f2: {
    see:
      'A 100 GHz grid at 1550 nm is 0.80139 nm wide. The C band runs from 1530 nm to 1565 nm, which is 4.3821 THz, ' +
      'and 43 channels fit on the grid. The source’s own width is drawn beside one channel.',
    seeReads: [
      ['grid.width', 0.80139e-9],
      ['band.width', 4.3821e12],
      ['band.channels', 43],
    ],
    try: [
      {
        say: 'Set the channel spacing to 50 GHz. Each channel is 0.40069 nm wide and 87 of them fit in the band.',
        set: { spacing: 50e9 },
        reads: [
          ['grid.width', 0.40069e-9],
          ['band.channels', 87],
        ],
      },
      {
        say: 'Set the channel spacing to 200 GHz. The channels are 1.6028 nm wide and 21 of them fit.',
        set: { spacing: 200e9 },
        reads: [
          ['grid.width', 1.6028e-9],
          ['band.channels', 21],
        ],
      },
      {
        say: 'Read the source width against the grid. At 0.1 nm the source fills 0.12478 of one channel.',
        reads: [['widthRatio', 0.12478]],
      },
    ],
    why:
      'A grid is stated in frequency because a frequency spacing is the same everywhere in the band, while the ' +
      'same spacing in wavelength is not. The conversion is the wavelength squared times the frequency spacing ' +
      'over the speed of light. A band’s width in frequency is the difference of its two end frequencies, and the ' +
      'channel count is that width divided by the spacing and rounded down. Each channel needs a source narrower ' +
      'than the grid, which is E2’s requirement seen from the other side. Halving the spacing doubles the channel ' +
      'count and halves the width each source is allowed.',
  },
}
