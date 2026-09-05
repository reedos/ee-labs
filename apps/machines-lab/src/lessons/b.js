export const LESSONS = {
  b1: {
    see:
      'An ideal transformer, two turns to one. The primary sits at 240 V and the secondary at 120 V, ' +
      'exactly half. The load draws 20 A and the primary draws 10 A, exactly half the other way. The power ' +
      'view shows 2400 W going in and 2400 W coming out, and the four coupling elements sum to no power at ' +
      'all.',
    seeReads: [
      ['xf.vp', 240],
      ['xf.vs', 120],
      ['xf.iLoad', 20],
      ['xf.iPrim', 10],
      ['xf.pOut', 2400],
      ['xf.pIn', 2400],
    ],
    try: [
      {
        say: 'Set the turns ratio to four. The secondary falls to 60 V, the load current to 10 A, and the primary current to 2.5 A. Both ratios stay exact.',
        set: { n: 4 },
        reads: [
          ['xf.vs', 60],
          ['xf.iLoad', 10],
          ['xf.iPrim', 2.5],
        ],
      },
      {
        say: 'Put the ratio back and drop the load to 1.5 Ω. The secondary current rises to 80 A, the primary to 40 A, and the output reaches 9600 W.',
        set: { RL: 1.5 },
        reads: [
          ['xf.iLoad', 80],
          ['xf.iPrim', 40],
          ['xf.pOut', 9600],
        ],
      },
    ],
    why:
      'Both windings sit on one core, so they share the same rate of change of flux. Volts per turn are ' +
      'therefore equal, which gives the voltage ratio. An ideal core needs no ampere-turns to carry its ' +
      'flux, so the two windings ampere-turns cancel, which gives the current ratio. Multiply the two and ' +
      'the power is unchanged. The engine has no stamp for a current controlled by a current, so this lab ' +
      'builds one from a resistor and a source that cancels its drop. The pair is a short with a readable ' +
      'current, and the answer does not depend on the resistance chosen.',
  },

  b2: {
    see:
      'The primary sees 24 Ω, which is four times the 6 Ω sitting on the secondary. The load voltage is ' +
      'twice the primary voltage and the load current is half the primary current. The ratio of the two is ' +
      'therefore four times over.',
    seeReads: [
      ['xf.reflectedZL', 24],
      [(x, p) => p.RL, 6],
    ],
    try: [
      {
        say: 'Set the turns ratio to four. The same 6 Ω now looks like 96 Ω, which is sixteen times, because the ratio enters squared.',
        set: { n: 4 },
        reads: [['xf.reflectedZL', 96]],
      },
      {
        say: 'Put the ratio back to two and raise the load to 24 Ω. The primary again sees 96 Ω, because only the product of the two matters.',
        set: { RL: 24 },
        reads: [['xf.reflectedZL', 96]],
      },
    ],
    why:
      'Impedance is voltage over current, and a transformer multiplies one by n while dividing the other by ' +
      'n. So an impedance moves across it by n squared. That is what lets a book draw one series branch ' +
      'instead of two. Refer the secondary resistance and leakage to the primary by the same factor and ' +
      'they add to the primary values. It is also the whole of impedance matching, because a fixed load can ' +
      'be made to look like any resistance a source prefers by choosing the ratio.',
  },

  b3: {
    see:
      'Add the winding resistances, the leakage reactances and the magnetising branch. An ideal 2:1 ' +
      'transformer would put 120 V on the secondary. It reads 116.5 V at the winding and 113.6 V at the ' +
      'load, because the series branch drops the difference. Referred to the primary that branch is 1.2 Ω ' +
      'of resistance and 2.4 Ω of reactance.',
    seeReads: [
      [(x, p) => p.Vp / p.n, 120],
      ['xf.vs', 116.547],
      ['xf.vOut', 113.569],
      ['xf.Req', 1.2],
      ['xf.Xeq', 2.4],
    ],
    try: [
      {
        say: 'Take the load off by setting it to 10 kΩ. The output climbs to 119.8 V, near the ideal 120 V, because almost no current flows to drop anything.',
        set: { RL: 1e4 },
        reads: [['xf.vOut', 119.777]],
      },
      {
        say: 'Double both leakage reactances. The equivalent reactance doubles to 4.8 Ω and the output falls to 111.9 V.',
        set: { X1: 2.4, X2: 0.6 },
        reads: [
          ['xf.Xeq', 4.8],
          ['xf.vOut', 111.904],
        ],
      },
    ],
    why:
      'Three things separate a real transformer from an ideal one. The windings have resistance, which ' +
      'wastes power. Some flux links one winding and not the other, which is leakage and appears as a ' +
      'series reactance. And the core needs current to magnetise it, which is a shunt branch. The first two ' +
      'sit in series with the load and drop voltage under load. The third sits across the supply and draws ' +
      'current whether there is a load or not. Referring the secondary side to the primary puts all of the ' +
      'series parts in one branch.',
  },

  b4: {
    see:
      'Two measurements describe the whole of this model. Open the secondary and the primary draws ' +
      '0.328 A into 732 Ω, with a wattmeter reading 31.9 W, which is the core loss. Short the secondary ' +
      'and the primary sees 2.68 Ω, which is the series branch and nothing else.',
    seeReads: [
      ['xf.Ioc', 0.32769],
      ['xf.Zoc', 732.39],
      ['xf.Poc', 31.947],
      ['xf.Zsc', 2.6808],
    ],
    try: [
      {
        say: 'Set the load to 10 kΩ, which is the open-circuit test on this model. The primary draws 0.33 A and the input power falls to 33.4 W.',
        set: { RL: 1e4 },
        reads: [
          ['xf.iPrim', 0.33017],
          ['xf.pIn', 33.382],
        ],
      },
      {
        say: 'Double the core-loss resistance. The open-circuit power halves to 16 W and the impedance the test reads rises to 782 Ω.',
        set: { Rc: 3600 },
        reads: [
          ['xf.Poc', 16.003],
          ['xf.Zoc', 782.25],
        ],
      },
    ],
    why:
      'With no load current the series branch drops almost nothing, so what the meters see is the shunt ' +
      'branch. With the secondary shorted the shunt branch carries almost nothing beside the short, so what ' +
      'they see is the series branch. Each test isolates half the model, which is why both are run. The ' +
      'open-circuit test is done at rated voltage, because core loss follows the flux and the flux follows ' +
      'the voltage. The short-circuit test is done at rated current on a reduced voltage, for the same ' +
      'reason in reverse.',
  },

  b5: {
    see:
      'The secondary sits at 119.8 V with no load and 113.6 V with one, a fall of 5.47 % of the loaded ' +
      'value. That is the regulation. The phasor view shows the cause. The load current through the series ' +
      'reactance turns the output as well as shortening it.',
    seeReads: [
      ['xf.vNoLoad', 119.78],
      ['xf.vOut', 113.569],
      [(x) => x.regulation * 100, 5.4693],
    ],
    try: [
      {
        say: 'Make the load lagging, with 4.5 Ω of reactance beside its resistance. The output falls to 110.8 V and the regulation worsens to 8.07 %.',
        set: { XL: 4.5 },
        reads: [
          ['xf.vOut', 110.84],
          [(x) => x.regulation * 100, 8.0664],
        ],
      },
      {
        say: 'Take the reactance off and halve the load instead, to 12 Ω. The regulation falls to 2.62 %, because half the current drops half the voltage.',
        set: { RL: 12 },
        reads: [
          [(x) => x.regulation * 100, 2.6192],
          ['xf.vOut', 116.723],
        ],
      },
    ],
    why:
      'The drop is the load current through the series resistance and reactance, and it is a phasor. On a ' +
      'resistive load the reactive drop is nearly at right angles to the output, so it costs little length. ' +
      'On a lagging load it lines up with the output, so almost all of it comes off. That is why the same ' +
      'transformer regulates worse into a motor than into a heater, and why a leading load can raise the ' +
      'output above its no-load value.',
  },

  b6: {
    see:
      'At full load the transformer delivers 2150 W and runs at 93.9 %. It wastes 109 W in copper and ' +
      '30.2 W in the core. Copper loss goes as the square of the load and core loss does not move at all. ' +
      'So the efficiency peaks below full load, at 52.6 % of it.',
    seeReads: [
      ['xf.pOut', 2149.65],
      ['xf.pCu', 109.174],
      ['xf.pCore', 30.185],
      [(x) => x.efficiency * 100, 93.912],
      [(x) => x.bestX * 100, 52.582],
    ],
    try: [
      {
        say: 'Halve the load, to 12 Ω. The copper loss falls fourfold to 29.3 W and the efficiency rises to 95 %.',
        set: { RL: 12 },
        reads: [
          ['xf.pCu', 29.256],
          [(x) => x.efficiency * 100, 94.956],
        ],
      },
      {
        say: 'Halve the core loss by doubling its resistance. The peak moves down to 37.3 % of full load, because there is less fixed loss for the output to cover.',
        set: { Rc: 3600 },
        reads: [
          ['xf.pCore', 15.098],
          [(x) => x.bestX * 100, 37.308],
        ],
      },
    ],
    why:
      'Write the loss as a fixed part and a part that goes as the square of the load. Efficiency is output ' +
      'over output plus loss, and differentiating it puts the maximum exactly where the two parts are ' +
      'equal. So the peak sits at the square root of the fixed loss over the full-load variable loss. A ' +
      'distribution transformer runs most of its life at a fraction of its rating, which is why it is ' +
      'designed with the peak down there rather than at full load.',
  },
}
