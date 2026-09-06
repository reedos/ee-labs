// Group A's three registers. Every number here was computed by
// scripts/pins.mjs before it was written, and experiments.test.js recomputes
// each one at the setting its step names.

export const LESSONS_A = {
  a1: {
    see:
      'Light at 1550 nm arrives in photons of 0.79990 eV each. The curve draws that energy against wavelength, ' +
      'and the marker sits at the setting. A shorter wave carries a larger quantum, so the curve falls to the right.',
    seeReads: [['photon.eV', 0.7999]],
    try: [
      {
        say: 'Set the wavelength to 1310 nm. One photon carries 0.94644 eV, and the light oscillates at 228.85 THz.',
        set: { lambda: 1310e-9 },
        reads: [
          ['photon.eV', 0.94644],
          ['photon.frequency', 228.85e12],
        ],
      },
      {
        say: 'Set the wavelength to 850 nm. The energy rises to 1.4586 eV, because a shorter wave carries more.',
        set: { lambda: 850e-9 },
        reads: [['photon.eV', 1.4586]],
      },
      {
        say: 'Read the flux at 1 mW and 1550 nm. The beam delivers 7.8 × 10¹⁵ photons a second.',
        reads: [['photon.flux', 7.8029e15]],
      },
    ],
    why:
      'Light is quantised, and one photon carries hc over its wavelength. Dividing hc by the charge on an electron ' +
      'gives 1.23984 electronvolt micrometres, so a wavelength in micrometres divides into that constant to give ' +
      'the energy in electronvolts. A 1550 nm photon therefore carries 0.79990 eV. The power in a beam is the flux ' +
      'times that energy, so the same milliwatt at a longer wavelength is more photons a second. Every conversion ' +
      'in this lab between optical power and current passes through this one constant.',
    whyReads: [
      ['hc', 1.23984],
      ['photon.eV', 0.7999],
    ],
  },

  a2: {
    see:
      'A photodiode is a reverse-biased junction with light on it. At 1 µW and 1550 nm it carries 1.0011 µA into ' +
      'the load, and 4.9990 V of the 5 V supply is still across the junction. The circuit view shows the four ' +
      'elements the solver was given.',
    seeReads: [
      ['pd.current', 1.0011e-6],
      ['pd.reverse', 4.999],
    ],
    try: [
      {
        say: 'Set the reverse bias to 20 V. The current still reads 1.0011 µA, because the junction already collects every carrier.',
        set: { bias: 20 },
        reads: [['pd.current', 1.0011e-6]],
      },
      {
        say: 'Set the reverse bias to 2 V. The current is 1.0011 µA again, and 1.9990 V is left across the junction.',
        set: { bias: 2 },
        reads: [
          ['pd.current', 1.0011e-6],
          ['pd.reverse', 1.999],
        ],
      },
      {
        say: 'Set the power to 1 mW and the load to 100 kΩ. The current falls to 53.557 µA and the junction turns forward at −0.35574 V.',
        set: { power: 1e-3, load: 100000 },
        reads: [
          ['pd.current', 53.557e-6],
          ['pd.reverse', -0.35574],
        ],
      },
    ],
    why:
      'The photodiode is not a formula in this lab. It is a junction, a load and a current source the light sets, ' +
      'and the app solves the four together with the same Newton iteration every other diode in the suite is ' +
      'solved by. The photocurrent is the responsivity times the optical power. It flows whatever the reverse ' +
      'voltage, because the junction sweeps out every carrier as fast as the light makes one. That is the flat part ' +
      'of the curve, and the load line crosses it. Raise the current until the load needs more volts than the ' +
      'supply has, and no reverse bias is left. The junction then turns forward and the reading stops following ' +
      'the light.',
  },

  a3: {
    see:
      'Responsivity is amps of photocurrent for each watt of light. At a quantum efficiency of 0.8 and 1550 nm it ' +
      'reads 1.0001 A/W. The curve rises with wavelength up to the detector’s cut-off, where it falls to zero.',
    seeReads: [['R', 1.0001]],
    try: [
      {
        say: 'Set the wavelength to 850 nm. The responsivity falls to 0.54846 A/W, because each photon costs more energy.',
        set: { lambda: 850e-9 },
        reads: [['R', 0.54846]],
      },
      {
        say: 'Set the bandgap to 1.12 eV, which is silicon. The cut-off moves to 1107.0 nm and the reading at 1550 nm is 0 A/W.',
        set: { eg: 1.12 },
        reads: [
          ['cutoff', 1107.0e-9],
          ['R', 0],
        ],
      },
      {
        say: 'Keep silicon and set the wavelength to 1000 nm. The responsivity is 0.64524 A/W, inside the band it does see.',
        set: { eg: 1.12, lambda: 1000e-9 },
        reads: [['R', 0.64524]],
      },
    ],
    why:
      'One absorbed photon makes at most one electron-hole pair, so the current is the flux times the charge on an ' +
      'electron. The flux is the power divided by the photon energy, which leaves the responsivity as the quantum ' +
      'efficiency times the wavelength divided by 1.23984. It rises with wavelength because a watt at a longer ' +
      'wavelength is more photons. A photon whose energy is below the bandgap cannot lift an electron across it, ' +
      'so it passes straight through and the responsivity is exactly zero rather than small. Silicon stops at ' +
      '1107.0 nm, which is the reason a 1550 nm receiver is made of indium gallium arsenide.',
    whyAt: { eg: 1.12 },
    whyReads: [
      ['cutoff', 1107.0e-9],
      ['hc', 1.23984],
    ],
  },

  a4: {
    see:
      'Turn the light off and the junction’s own reverse current remains. At 1 µW the load carries 1.0011 µA, of ' +
      'which 1.0000 nA is dark current. The curve draws the total against optical power, with the level where the ' +
      'two are equal marked.',
    seeReads: [
      ['pd.current', 1.0011e-6],
      ['pd.dark', 1.0e-9],
    ],
    try: [
      {
        say: 'Set the optical power to 1 nW. The photocurrent is 1.0001 nA and the total reads 2.0001 nA.',
        set: { power: 1e-9 },
        reads: [
          ['pd.iph', 1.0001e-9],
          ['pd.current', 2.0001e-9],
        ],
      },
      {
        say: 'Set the optical power to 1 pW. The reading is 1.0010 nA, and almost all of it is the diode.',
        set: { power: 1e-12 },
        reads: [['pd.current', 1.001e-9]],
      },
      {
        say: 'Read the level where the two currents are equal. It is 0.99987 nW at this responsivity.',
        reads: [['level', 0.99987e-9]],
      },
    ],
    why:
      'The dark current is the junction’s reverse saturation current, and it is there with no light at all. This ' +
      'lab adds no second source for it. The diode in the netlist carries a saturation current of 1 nA, so turning ' +
      'the light off leaves exactly that. Against a microamp of photocurrent it is one part in a thousand and ' +
      'changes nothing. Against a nanoamp it doubles the reading. The optical power where the two are equal is the ' +
      'dark current divided by the responsivity, which is 0.99987 nW here. Below that level a reading is the diode ' +
      'rather than the light, and a receiver design starts by getting the dark current under the signal.',
    whyReads: [['level', 0.99987e-9]],
  },

  a5: {
    see:
      'A 100 µm detector into 1 kΩ has 0.17455 pF of junction capacitance, which gives a corner at 911.80 MHz. ' +
      'The same detector collects 7.8540 nW from an irradiance of 1 W/m². The curve carries both against diameter.',
    seeReads: [
      ['speed.cj', 0.17455e-12],
      ['speed.corner', 911.8e6],
      ['speed.collected', 7.854e-9],
    ],
    try: [
      {
        say: 'Set the diameter to 200 µm. The capacitance is 0.69820 pF and the corner falls to 227.95 MHz.',
        set: { d: 200e-6 },
        reads: [
          ['speed.cj', 0.6982e-12],
          ['speed.corner', 227.95e6],
        ],
      },
      {
        say: 'Set the diameter to 50 µm. The corner rises to 3.6472 GHz and the collected power falls to 1.9635 nW.',
        set: { d: 50e-6 },
        reads: [
          ['speed.corner', 3.6472e9],
          ['speed.collected', 1.9635e-9],
        ],
      },
      {
        say: 'Read the area bandwidth product at any diameter. It holds at 7.1613 square metres a second.',
        reads: [['speed.areaBandwidth', 7.1613]],
      },
    ],
    why:
      'A larger detector catches more light and is slower, and those are one fact. Capacitance is the permittivity ' +
      'times the area over the depletion width, so it rises with area. That capacitance and the load make a ' +
      'first-order lag whose corner is one over two pi R C, so the corner falls as the capacitance rises. Multiply ' +
      'the two and the area cancels, leaving a number set by the material, the depletion width and the load. That ' +
      'product is what a detector is chosen on. Reverse bias widens the depletion region and is the other way to ' +
      'buy speed, and the junction capacitance law under it is the Electronics Lab’s, unchanged.',
  },
}
