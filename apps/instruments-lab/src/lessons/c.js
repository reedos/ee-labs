// Group C's three registers. Every number is a reading the solver produced.

export const LESSONS_C = {
  c1: {
    see:
      'The divider’s true output is 5 V behind 500 kΩ. Put a 10 MΩ voltmeter across it and the reading ' +
      'is 4.762 V, low by 4.762 %. The meter has not made a mistake. It has drawn 476 nA, and that ' +
      'current came out of the divider.',
    seeReads: [
      [(x, p) => (p.E * p.R2) / (p.R1 + p.R2), 5],
      ['thevenin.rth', 500000],
      ['v.out', 4.7619],
      [(x, p) => (100 * (x.sol.v.out - (p.E * p.R2) / (p.R1 + p.R2))) / ((p.E * p.R2) / (p.R1 + p.R2)), -4.7619],
      ['i.Rm', 4.7619e-7],
    ],
    try: [
      {
        say: 'Drop both divider resistors to 10 kΩ. The Thévenin resistance falls to 5 kΩ and the reading rises to 4.998 V, low by only 0.05 %.',
        set: { R1: 1e4, R2: 1e4 },
        reads: [
          ['thevenin.rth', 5000],
          ['v.out', 4.9975],
          [(x, p) => (100 * (x.sol.v.out - (p.E * p.R2) / (p.R1 + p.R2))) / ((p.E * p.R2) / (p.R1 + p.R2)), -0.049975],
        ],
      },
      {
        say: 'Put the meter’s input resistance at 100 MΩ instead, with the megohm divider back. The reading is 4.9751 V, low by 0.4975 %, ten times better than before.',
        set: { Rm: 1e8 },
        reads: [
          ['v.out', 4.97512],
          [(x, p) => (100 * (x.sol.v.out - (p.E * p.R2) / (p.R1 + p.R2))) / ((p.E * p.R2) / (p.R1 + p.R2)), -0.497512],
        ],
      },
      {
        say: 'Drop it to 1 MΩ, which an older meter has. The reading collapses to 3.333 V, low by 33.33 %.',
        set: { Rm: 1e6 },
        reads: [
          ['v.out', 3.33333],
          [(x, p) => (100 * (x.sol.v.out - (p.E * p.R2) / (p.R1 + p.R2))) / ((p.E * p.R2) / (p.R1 + p.R2)), -33.3333],
        ],
      },
    ],
    why:
      'Seen from the meter the circuit is a source of 5 V behind 500 kΩ, which is Elements D5. The ' +
      'meter is a resistor across that port, so the two make a divider and the reading is the true ' +
      'value times R_m/(R_m + R_th). The error depends on the circuit, not only on the meter, and it is ' +
      'systematic, so taking the reading again does not reduce it. The rule of thumb follows: a meter ' +
      'a hundred times the source resistance costs about one per cent.',
    whyReads: [
      [(x, p) => (p.E * p.R2) / (p.R1 + p.R2), 5],
      ['thevenin.rth', 500000],
    ],
  },

  c2: {
    see:
      'The meter’s input is a chain of 10 MΩ, and the range switch chooses where the converter taps it. ' +
      'On the 20 V range the tap is 1 % of the way up, so 20 V at the terminals is 200 mV at the ' +
      'converter. The input resistance is 10 MΩ on every range.',
    seeReads: [
      [(x, p) => p.Rtot, 1e7],
      ['v.tap', 0.2],
      [(x, p) => (100 * p.vfs) / p.range, 1],
      [(x, p) => p.E, 20],
    ],
    try: [
      {
        say: 'Switch to the 2 V range. The tap is now a tenth of the way up, so the same 20 V puts 2 V at the converter, which is ten times its full scale.',
        set: { range: 2 },
        reads: [['v.tap', 2]],
      },
      {
        say: 'Switch to the 200 V range. The tap gives 20 mV, a tenth of full scale, so the reading uses a tenth of the display’s counts.',
        set: { range: 200 },
        reads: [['v.tap', 0.02], [(x, p) => p.range, 200]],
      },
      {
        say: 'Take the buffer out on the 20 V range. The converter’s own 1 MΩ loads the tap, which falls to 182 mV, 9.008 % low.',
        set: { buffer: false },
        reads: [
          ['v.tap', 0.181984],
          [(x, p) => (100 * (x.sol.v.tap - (p.E * p.vfs) / p.range)) / ((p.E * p.vfs) / p.range), -9.00819],
        ],
      },
    ],
    why:
      'A divider’s output resistance is the two legs in parallel, which on the 20 V range is 99 kΩ. A ' +
      'converter of 1 MΩ across that is C1’s problem again, and it costs 9.008 % of the reading. The ' +
      'buffer draws no input current, so the tap sees an open circuit and the divider keeps its ratio. ' +
      'That is why the input resistance is the chain’s and not the converter’s, and why it is the same ' +
      'on every range. Elements E4 builds the same follower.',
    whyReads: [
      [(x, p) => ((p.Rtot - (p.Rtot * p.vfs) / p.range) * ((p.Rtot * p.vfs) / p.range)) / p.Rtot, 99000],
      [
        (x, p) => {
          const bot = (p.Rtot * p.vfs) / p.range
          const top = p.Rtot - bot
          const par = (bot * p.Radc) / (bot + p.Radc)
          return (100 * (par / (top + par) - bot / p.Rtot)) / (bot / p.Rtot)
        },
        -9.00819,
      ],
    ],
  },

  c3: {
    see:
      'A 5 V supply through 50 Ω should carry 100 mA. Put a 1 Ω shunt in the loop to read it and the ' +
      'current becomes 98.04 mA, low by 1.961 %. The 98.04 mV across the shunt is the burden voltage, ' +
      'and it came out of the circuit under test.',
    seeReads: [
      [(x, p) => p.E / p.RL, 0.1],
      ['i.RL', 0.0980392],
      [(x, p) => (100 * (x.sol.i.RL - p.E / p.RL)) / (p.E / p.RL), -1.96078],
      ['v.sh', 0.0980392],
    ],
    try: [
      {
        say: 'Drop the shunt to 0.1 Ω. The reading rises to 99.8 mA and the burden voltage falls to 9.98 mV, so the error is now 0.1996 %.',
        set: { Rsh: 0.1 },
        reads: [
          ['i.RL', 0.0998004],
          ['v.sh', 0.00998004],
          [(x, p) => (100 * (x.sol.i.RL - p.E / p.RL)) / (p.E / p.RL), -0.199601],
        ],
      },
      {
        say: 'Drop it to 10 mΩ. The reading is 99.98 mA and the burden voltage is 999.8 µV, ten times smaller again.',
        set: { Rsh: 0.01 },
        reads: [
          ['i.RL', 0.099980],
          ['v.sh', 0.0009998],
        ],
      },
      {
        say: 'Raise the load to 500 Ω with the 1 Ω shunt back. The same shunt now costs only 0.1996 %, because it is a smaller part of the loop.',
        set: { RL: 500 },
        reads: [[(x, p) => (100 * (x.sol.i.RL - p.E / p.RL)) / (p.E / p.RL), -0.199601]],
      },
    ],
    why:
      'The shunt is in series with the load, so the current is E/(R_L + R_sh) rather than E/R_L, and the ' +
      'error is R_sh/(R_L + R_sh). The voltage the meter reads is that current times the shunt, and it ' +
      'is subtracted from whatever the circuit had. A meter’s range fixes the shunt: 100 mV of full ' +
      'scale for 10 A needs 10 mΩ, which turns 1 W into heat at full scale. Smaller shunts disturb the ' +
      'circuit less and give the converter less to read, and that is the whole trade.',
    whyReads: [
      [(x, p) => p.vfs / p.ifs, 0.01],
      [(x, p) => p.vfs * p.ifs, 1],
      [(x, p) => p.vfs, 0.1],
      [(x, p) => p.ifs, 10],
    ],
  },

  c4: {
    see:
      'Force 1 mA down a pair of leads into a 1 Ω resistor and read the voltage at the instrument. The ' +
      'answer is 1.2 Ω, high by 20 %, because the two 100 mΩ leads carried the same current and are ' +
      'inside the reading.',
    seeReads: [
      [(x, p) => x.sol.v.f1 / p.Itest, 1.2],
      [(x, p) => (100 * (x.sol.v.f1 / p.Itest - p.Rx)) / p.Rx, 20],
      [(x, p) => 2 * p.Rlead, 0.2],
    ],
    try: [
      {
        say: 'Set the resistor to 100 Ω. The reading is 100.2 Ω, and the same 200 mΩ of lead is now an error of 0.2 %.',
        set: { Rx: 100 },
        reads: [
          [(x, p) => x.sol.v.f1 / p.Itest, 100.2],
          [(x, p) => (100 * (x.sol.v.f1 / p.Itest - p.Rx)) / p.Rx, 0.2],
        ],
      },
      {
        say: 'Set it to 10 kΩ. The reading is 9.990 kΩ, low by 0.0979 %, because the meter’s own 10 MΩ now matters more than the leads.',
        set: { Rx: 1e4 },
        reads: [
          [(x, p) => x.sol.v.f1 / p.Itest, 9990.21],
          [(x, p) => (100 * (x.sol.v.f1 / p.Itest - p.Rx)) / p.Rx, -0.0979041],
        ],
      },
      {
        say: 'Put the resistor back at 1 Ω and use better leads, 10 mΩ each. The reading is 1.02 Ω, still 2 % high.',
        set: { Rx: 1, Rlead: 0.01 },
        reads: [
          [(x, p) => x.sol.v.f1 / p.Itest, 1.02],
          [(x, p) => (100 * (x.sol.v.f1 / p.Itest - p.Rx)) / p.Rx, 2],
        ],
      },
    ],
    why:
      'The forcing current runs through one lead, the resistor and the other lead, and the voltmeter is ' +
      'across all three. So the reading is R_x plus twice the lead resistance, whatever R_x is. As an ' +
      'absolute error that is fixed, which makes it invisible on a kilohm resistor and ruinous on a ' +
      'one-ohm one. No better ' +
      'meter fixes it, because the meter is reading exactly what is across its terminals. What has to ' +
      'change is where the voltage is sensed.',
    whyReads: [
      [(x, p) => 2 * p.Rlead, 0.2],
      [(x, p) => p.Rx, 1],
    ],
  },

  c5: {
    see:
      'Force the current down one pair of leads and sense the voltage with another pair. The sense ' +
      'leads carry 100 pA of the 1 mA forced, so their drop is nothing. The reading is 1 Ω, low by ' +
      '0.000012 %, where two wires were 20 % high.',
    seeReads: [
      [(x, p) => (x.sol.v.s1 - x.sol.v.s2) / p.Itest, 0.99999988],
      ['i.Rs1', 1e-10],
      [(x, p) => (100 * ((x.sol.v.s1 - x.sol.v.s2) / p.Itest - p.Rx)) / p.Rx, -1.2e-5],
      [(x, p) => (100 * 2 * p.Rlead) / p.Rx, 20],
    ],
    try: [
      {
        say: 'Make the leads ten times worse, 1 Ω each. The reading is 1 Ω still, low by 0.00003 %, because the sense pair carries almost no current whatever it is made of.',
        set: { Rlead: 1 },
        reads: [
          [(x, p) => (x.sol.v.s1 - x.sol.v.s2) / p.Itest, 0.9999997],
          [(x, p) => (100 * ((x.sol.v.s1 - x.sol.v.s2) / p.Itest - p.Rx)) / p.Rx, -3e-5],
        ],
      },
      {
        say: 'Drop the meter’s input resistance to 100 kΩ with the leads back at 100 mΩ. Now the reading is 999.99 mΩ, low by 0.0012 %, and the meter itself is the error.',
        set: { Rlead: 0.1, Rm: 1e5 },
        reads: [
          [(x, p) => (x.sol.v.s1 - x.sol.v.s2) / p.Itest, 0.99998800],
          [(x, p) => (100 * ((x.sol.v.s1 - x.sol.v.s2) / p.Itest - p.Rx)) / p.Rx, -1.2e-3],
        ],
      },
    ],
    why:
      'The sense pair and the meter sit across the resistor alone, in parallel with it. So the reading ' +
      'is R_x·R_m/(R_x + R_s1 + R_m + R_s2), and the lead resistances appear only beside a ten-megohm ' +
      'meter, where they are one part in ten million. The forcing leads still drop voltage, and it ' +
      'still comes out of the source, but no part of it is inside the answer. This is why any ' +
      'measurement below about an ohm is made with four wires.',
    whyReads: [[(x, p) => p.Rm, 1e7]],
  },
}
