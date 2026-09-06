// Group C's three registers. Every number here was computed by
// scripts/pins.mjs before it was written, and experiments.test.js recomputes
// each one at the setting its step names.

export const LESSONS_C = {
  c1: {
    see:
      'The supply pushes 18.778 mA through the junction, and 1.2231 V is left across it. The circuit view shows ' +
      'the three elements the solver was given. As an LED that current makes 3.0041 mW of light. As a laser it ' +
      'makes 1.7458 mW.',
    seeReads: [
      ['j.current', 18.778e-3],
      ['j.forward', 1.2231],
      ['led.power', 3.0041e-3],
      ['laser.power', 1.7458e-3],
    ],
    try: [
      {
        say: 'Set the supply to 3.3 V. The current rises to 30.182 mA and the forward voltage moves only to 1.2476 V.',
        set: { drive: 3.3 },
        reads: [
          ['j.current', 30.182e-3],
          ['j.forward', 1.2476],
        ],
      },
      {
        say: 'Set the series resistor to 150 Ω. The current falls to 8.7749 mA, which is under the threshold current C4 measures.',
        set: { series: 150 },
        reads: [
          ['j.current', 8.7749e-3],
          ['ith', 13.389e-3],
        ],
      },
      {
        say: 'Read the two efficiencies at the default supply. The junction turns 13.080 per cent of its electrical power into light as an LED and 7.6012 per cent as a laser.',
        reads: [
          ['wall.led', 0.1308],
          ['wall.laser', 0.0760116],
        ],
      },
    ],
    why:
      'Both devices are the same object electrically. A forward-biased junction carries current by Shockley’s law, ' +
      'and the solver walks the same Newton iteration it walks for every other diode in the suite. Nothing in the ' +
      'circuit tells an LED from a laser. What separates them is where the recombining carriers go. In an LED ' +
      'every recombination is spontaneous, so the light is linear in current and leaves in all directions. In a ' +
      'laser the carriers recombine into one mode once the drive passes the threshold current C4 measures, so the ' +
      'light rises much faster above that point. At 18.778 mA the same junction makes 3.0041 mW as an LED and ' +
      '1.7458 mW as a laser. Which of the two is larger depends on the drive, because the two follow different laws.',
    whyReads: [
      ['j.current', 18.778e-3],
      ['led.power', 3.0041e-3],
      ['laser.power', 1.7458e-3],
    ],
  },

  c2: {
    see:
      'The LED turns 20 mA into 3.1996 mW at 1550 nm. The curve draws that power against current. Doubling the ' +
      'current doubles the light, because every extra electron gets the same chance to make a photon.',
    seeReads: [['led.power', 3.1996e-3]],
    try: [
      {
        say: 'Set the drive current to 40 mA. The power doubles to 6.3992 mW, because the model is linear in current.',
        set: { current: 40e-3 },
        reads: [['led.power', 6.3992e-3]],
      },
      {
        say: 'Set the internal efficiency to 0.5. The slope rises to 0.39995 mW/mA, and 20 mA now makes 7.9990 mW.',
        set: { etaInt: 0.5 },
        reads: [
          ['led.slope', 0.39995],
          ['led.power', 7.999e-3],
        ],
      },
      {
        say: 'Set the wavelength to 850 nm. The slope rises to 0.29173 mW/mA, because a shorter wave carries a larger quantum.',
        set: { lambda: 850e-9 },
        reads: [['led.slope', 0.29173]],
      },
    ],
    why:
      'The optical power is the internal efficiency times the volts one photon costs times the current. The volts ' +
      'one photon costs is the photon’s energy read as a voltage, which at 1550 nm is 0.79990 V. An efficiency of ' +
      '0.2 therefore buys 0.15998 mW/mA, and nothing in that slope depends on the current. That is why the line ' +
      'is straight. The model is a linear one and the pane names it. A real LED falls below it at high current, ' +
      'because heating takes carriers that would otherwise make light. Correcting for that needs a measured curve ' +
      'rather than physics this lab can state, so the linear model is what it ships.',
    whyReads: [
      ['volts', 0.7999],
      ['led.slope', 0.15998],
    ],
  },

  c3: {
    see:
      'The LED’s output is 3 dB down at 31.831 MHz, and one carrier lifetime of 5.0 ns sets that corner. The ' +
      'curve draws the response in decibels against modulation frequency. Above the corner one pole falls at ' +
      '20 dB a decade.',
    seeReads: [
      ['band.f3db', 31.831e6],
      ['band.atCorner', -3.0103],
      ['band.perDecade', 20.0],
    ],
    try: [
      {
        say: 'Set the carrier lifetime to 1.0 ns. The modulation bandwidth rises to 159.15 MHz, because the corner is one over two pi times the lifetime.',
        set: { tauC: 1e-9 },
        reads: [['band.f3db', 159.15e6]],
      },
      {
        say: 'Set the carrier lifetime to 20 ns. The modulation bandwidth falls to 7.9577 MHz, which is slower than a hundred-megabit link needs.',
        set: { tauC: 20e-9 },
        reads: [['band.f3db', 7.9577e6]],
      },
      {
        say: 'Read the roll-off above the corner. One pole falls 6.0203 dB in an octave, which is the same rate as 20 dB in a decade.',
        reads: [
          ['band.perOctave', 6.0203],
          ['band.perDecade', 20.0],
        ],
      },
    ],
    why:
      'An LED’s light comes from carriers recombining spontaneously, and a carrier lasts about one lifetime ' +
      'before it does. That lifetime is a single pole in the response. The corner is one over two pi times the ' +
      'lifetime, so a 5.0 ns lifetime puts it at 31.831 MHz. Above the corner the output falls at 6.0203 dB an ' +
      'octave and 20 dB a decade, which is the first-order rule applied to this one pole. A shorter lifetime buys ' +
      'bandwidth and costs light, because a carrier that recombines sooner has less chance to be caught. The phase ' +
      'falls with the magnitude, and it lags 45.000 degrees at the corner itself. C4 shows how a laser escapes ' +
      'that trade, and D3 measures how much faster it is.',
    whyReads: [
      ['band.f3db', 31.831e6],
      ['band.perOctave', 6.0203],
      ['band.perDecade', 20.0],
      ['band.phaseAtCorner', -45],
    ],
  },

  c4: {
    see:
      'The threshold current is 13.389 mA. Below it the output is spontaneous and small. Above it the power ' +
      'rises at 0.31996 mW/mA, so 26.777 mA makes 4.3052 mW. The curve marks the threshold, and the lower line ' +
      'is the spontaneous part alone.',
    seeReads: [
      ['ith', 13.389e-3],
      ['laser.slope', 0.31996],
      ['laser.power', 4.3052e-3],
    ],
    try: [
      {
        say: 'Set the drive current to 20 mA. The output falls to 2.1368 mW, because only the current above threshold makes stimulated light.',
        set: { current: 20e-3 },
        reads: [['laser.power', 2.1368e-3]],
      },
      {
        say: 'Set the drive current to 5 mA. The output collapses to 0.0079990 mW, which is the spontaneous path alone.',
        set: { current: 5e-3 },
        reads: [['laser.power', 7.999e-6]],
      },
      {
        say: 'Set the differential efficiency to 0.6. The slope above threshold rises to 0.47994 mW/mA, and the threshold current does not move.',
        set: { etaD: 0.6 },
        reads: [
          ['laser.slope', 0.47994],
          ['ith', 13.389e-3],
        ],
      },
    ],
    why:
      'The gain of the active region grows with the carrier density, and the cavity takes light out at a fixed ' +
      'rate. Threshold is where the two are equal. Below it the density is still climbing and almost nothing ' +
      'leaves the mode, so the output is the spontaneous path at 0.0015998 mW/mA. Above it the density is ' +
      'clamped, because any rise would make the gain exceed the loss. Every extra electron then leaves as ' +
      'stimulated light, at a slope efficiency of 0.31996 mW/mA. The ratio of the two slopes is 200.00, which is ' +
      'why the kink is sharp enough to read off a curve. The threshold current itself is not typed here. It comes ' +
      'out of the rate equations D1 writes down, and D2 derives it.',
    whyReads: [
      ['laser.spontaneousSlope', 0.0015998],
      ['laser.slope', 0.31996],
      ['laser.slopeRatio', 200.0],
    ],
  },

  c5: {
    see:
      'The chip is 100 µm of index 3.5 between two cleaved facets that reflect 0.30864. Those facets lose ' +
      '58.779 per cm, which holds a photon for 1.9862 ps and puts the threshold at 13.389 mA.',
    seeReads: [
      ['cavity.mirrorPerCm', 58.779],
      ['cavity.tauP', 1.9862e-12],
      ['ith', 13.389e-3],
    ],
    try: [
      {
        say: 'Set the facet reflectance to 0.9. The photon lifetime rises to 22.162 ps and the threshold falls to 8.4929 mA.',
        set: { r: 0.9 },
        reads: [
          ['cavity.tauP', 22.162e-12],
          ['ith', 8.4929e-3],
        ],
      },
      {
        say: 'Set the facet reflectance to 0.1. The photon lifetime falls to 1.0141 ps and the threshold rises to 18.544 mA.',
        set: { r: 0.1 },
        reads: [
          ['cavity.tauP', 1.0141e-12],
          ['ith', 18.544e-3],
        ],
      },
      {
        say: 'Set the chip length to 300 µm. The threshold falls to 9.8034 mA, and the same cavity gives F1 its 142.76 GHz.',
        set: { cavityLength: 300e-6 },
        reads: [
          ['ith', 9.8034e-3],
          ['cavity.fsr', 142.76e9],
        ],
      },
    ],
    why:
      'A photon in the cavity leaves through the two ends. The mirror loss stands for that, and it is one over ' +
      'twice the length times the logarithm of one over the reflectance. The photon lifetime is the index over ' +
      'the speed of light times that loss, so a better mirror keeps light in for longer. A longer photon lifetime ' +
      'needs less gain to sustain it, which needs fewer carriers, which needs less current. That is the ' +
      'whole chain from a facet to a threshold. This lab uses the convention where a single pass loses the ' +
      'reflectance, and the numbers pane prints the form it used. Some texts spread the same reflectance over a ' +
      'round trip and quote twice the mirror loss. The cavity here is the object F1 draws, so one reflectance ' +
      'moves a threshold on this pane and a resonance spacing on that one.',
    whyReads: [
      ['cavity.mirrorPerCm', 58.779],
      ['cavity.tauP', 1.9862e-12],
    ],
  },
}
