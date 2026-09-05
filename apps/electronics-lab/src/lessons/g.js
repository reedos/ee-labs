// Group G's three registers. Every number is a reading off the port it
// describes, and the two experiments measure resistance the same way: apply a
// known signal at a pair of terminals and divide the voltage by the current.

export const LESSONS_G = {
  g1: {
    see:
      'A 1.00 mA test current pushed into the port makes 90.9 mV across it, so the port reads 90.9 Ω. The ' +
      'resistor on its own is 1.00 kΩ. The dependent source carries 909 µA of the current pushed in, and only ' +
      '90.9 µA is left for the resistor.',
    seeReads: [
      ['v.x', 0.0909090909],
      ['gain', 90.9090909],
      ['i.G1', 0.000909090909],
      ['i.R1', 0.0000909090909],
    ],
    try: [
      {
        say: 'Set g to zero. The dependent source carries nothing and the port reads 1.00 kΩ, which is the answer from killing the sources and adding up resistors.',
        set: { g: 0 },
        reads: [['gain', 1000]],
      },
      {
        say: 'Set g to −10.0 mA/V. The port reads −111.1 Ω, and the scope shows the voltage running backwards against the current pushed in.',
        set: { g: -0.01 },
        reads: [
          ['gain', -111.111111],
          ['v.x', -0.111111111],
        ],
      },
      {
        say: 'Raise R₁ to 10.0 kΩ. The port barely moves, to 99.0 Ω, because 1 + gR₁ has grown by nearly as much as R₁ did.',
        set: { R1: 10000 },
        reads: [['gain', 99.009901]],
      },
    ],
    whyReads: [['gain', 90.9090909]],
    why:
      'Killing the independent sources leaves the dependent one alive, and the dependent one is what makes ' +
      'this port 90.9 Ω rather than 1.00 kΩ. The test source states the definition instead of working around ' +
      'it. Push a known current in, read the voltage, and divide. The dependent source takes gv_x out of the ' +
      'port, so the resistor is left with i − gv_x, and v_x is iR/(1 + gR). Flip the sign of g and that ' +
      'denominator falls below one, then below zero. A port whose voltage runs the other way is a negative ' +
      'resistance, and it is what starts an oscillator. Every input and output resistance in the rest of this ' +
      'lab is measured the way this one is.',
  },

  g2: {
    see:
      'The box is three numbers. Looking in at its input, 9.09 mV sits across a current of 909 nA, so R_in ' +
      'reads 10.0 kΩ. With nothing on the output the source inside would deliver 90.9 mV, and the 1.00 kΩ ' +
      'load takes exactly half of that. The gain from the source is 4.545.',
    seeReads: [
      ['v.p', 0.00909090909],
      ['i.Rs', 9.09090909e-7],
      [(x) => x.sol.v.p / x.sol.i.Rs, 10000],
      ['v.o', 0.0909090909],
      ['gain', 4.54545455],
    ],
    try: [
      {
        say: 'Raise the load to 1.00 MΩ. The output rises to 90.9 mV, within a tenth of a per cent of what the source inside makes, because R_out now drops almost nothing.',
        set: { RL: 1e6 },
        reads: [
          ['v.out', 0.0908182729],
          ['v.o', 0.0909090909],
        ],
      },
      {
        say: 'Set the load to 10.0 kΩ. The output is 82.6 mV, ten elevenths of the open-circuit value, which is the divider R_L/(R_L + R_out).',
        set: { RL: 10000 },
        reads: [['v.out', 0.0826446281]],
      },
      {
        say: 'Raise R_s to 10.0 kΩ instead. The gain falls to 2.500, because the source resistance and R_in now split the input evenly.',
        set: { Rs: 10000 },
        reads: [
          ['gain', 2.5],
          [(x) => x.sol.v.p / x.sol.v.in, 0.5],
        ],
      },
    ],
    whyReads: [
      [(x) => x.sol.v.p / x.sol.v.in, 0.909090909],
      [(x) => x.sol.v.out / x.sol.v.o, 0.5],
    ],
    why:
      'A two-port is the whole of what an amplifier does to the circuit around it. Three numbers, and the ' +
      'loading rule applied at each end. The source resistance and R_in divide the input in the ratio ' +
      'R_in/(R_in + R_s), which is 0.909 here. R_out and the load divide the output in the ratio ' +
      'R_L/(R_L + R_out), which is 0.500 at this load. The gain from source to load is the open-circuit gain ' +
      'times both fractions. R_out is measured from that second fraction rather than from inside the box. The ' +
      'load that halves the open-circuit output is R_out itself, and 1.00 kΩ is what halves it here.',
  },
}
