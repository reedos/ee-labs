// Group A: per unit. Every number here is read off `perUnit.js`.

export const LESSONS_A = {
  a1: {
    see:
      'Pick 100 MVA and 230 kV and every other base follows. The impedance base is 529 Ω, the current ' +
      'base is 251.022 A, and the base voltage to neutral is 132.791 kV. Move the base voltage and every ' +
      'meter moves with it. The circuit underneath does not change at all.',
    seeReads: [
      ['base.Zbase', 529],
      ['base.Ibase', 251.022],
      ['base.VbaseLN', 132790.6],
    ],
    try: [
      {
        say: 'Raise the base voltage to 345 kV. The impedance base rises to 1190.25 Ω and the current base falls to 167.348 A.',
        set: { Vbase: 345 },
        reads: [
          ['base.Zbase', 1190.25],
          ['base.Ibase', 167.348],
        ],
      },
      {
        say: 'Halve the base power to 50 MVA. The impedance base doubles to 1058 Ω and the current base halves to 125.511 A.',
        set: { Sbase: 50 },
        reads: [
          ['base.Zbase', 1058],
          ['base.Ibase', 125.511],
        ],
      },
      {
        say: 'Lower the power factor to 0.75. The load takes 52.915 Mvar, which is 0.529150 pu on this base.',
        set: { pf: 0.75 },
        reads: [
          ['base.Qload', 52.915e6],
          ['base.Qpu', 0.52915],
        ],
      },
    ],
    why:
      'One base power and one base voltage settle every other base. The impedance base is V_b² over S_b ' +
      'and the current base is S_b over √3 V_b, and both follow from the two numbers above them. Dividing ' +
      'every quantity by its own base scales the equations by constants, so nothing is lost and nothing is ' +
      'approximated. Per unit is a change of variables rather than a model, and that is why it carries no ' +
      'guard anywhere in this lab. The reason the subject is written this way is the transformer, and A2 is ' +
      'where its turns ratio disappears. A second reason is that a per-unit impedance is nearly the same ' +
      'number for machines of very different sizes, so a value out of range shows up at a glance.',
    whyReads: [
      [(x) => x.b.Zbase - (230e3 * 230e3) / 100e6, 0, 1e-9],
      [(x) => x.b.Ibase - 100e6 / (Math.sqrt(3) * 230e3), 0, 1e-9],
    ],
  },

  a2: {
    see:
      'A transformer between two zones has two voltage bases in its own turns ratio. On the 13.8 kV side ' +
      'the impedance base is 1.9044 Ω and the current base is 4183.70 A. The 0.1 pu reactance reads the ' +
      'same from either side, so the turns ratio has left the per-unit circuit.',
    seeReads: [
      ['base.low.Zbase', 1.9044],
      ['base.low.Ibase', 4183.7],
      ['base.puFromHigh', 0.1],
      ['base.puFromLow', 0.1],
    ],
    try: [
      {
        say: 'Set the low-side base to 24 kV. The impedance base there rises to 5.76 Ω and the current base falls to 2405.63 A.',
        set: { VbaseLow: 24 },
        reads: [
          ['base.low.Zbase', 5.76],
          ['base.low.Ibase', 2405.63],
        ],
      },
      {
        say: 'Set the transformer reactance to 0.2 pu. Both readings move together, and both still say 0.2 pu.',
        set: { zTx: 0.2 },
        reads: [
          ['base.puFromHigh', 0.2],
          ['base.puFromLow', 0.2],
        ],
      },
      {
        say: 'Raise the high-side base to 500 kV. The two impedance bases stay in the square of the two base voltages.',
        set: { Vbase: 500 },
        reads: [
          [(x) => x.low.Zbase / x.b.Zbase - (13.8 / 500) ** 2, 0, 1e-12],
          ['base.Zbase', 2500],
        ],
      },
    ],
    why:
      'The base power does not change across a transformer, because a transformer passes power through. ' +
      'The base voltages do change, and they change in the turns ratio. So the two impedance bases stand ' +
      'in the square of that ratio, which is exactly the factor an impedance picks up when it is referred ' +
      'from one winding to the other. The two factors cancel. A reader who has referred impedances by hand ' +
      'has done this arithmetic once per element. In per unit it is done once, in the choice of bases, and ' +
      'never again. Nothing is approximated here, so the reactance seen from the two sides agrees to ' +
      'floating point rather than nearly.',
    whyReads: [[(x) => Math.abs(x.puFromHigh - x.puFromLow), 0, 1e-15]],
  },

  a3: {
    see:
      'A generator marked 0.2 pu on its own 90 MVA rating is 0.222222 pu on a 100 MVA system base. A ' +
      'transformer marked 0.1 pu on 150 MVA is 0.0666667 pu. Both conversions are one formula, and the ' +
      'ratio of the base powers is the whole of it here, because both devices sit at the same voltage.',
    seeReads: [
      ['base.genPu', 0.222222],
      ['base.txPu', 0.0666667],
    ],
    try: [
      {
        say: 'Set the generator rating to 200 MVA. Its reactance on the system base falls to 0.1 pu, because the same reactance now belongs to a bigger machine.',
        set: { Sgen: 200 },
        reads: [['base.genPu', 0.1]],
      },
      {
        say: 'Set the system base to 200 MVA. The generator now reads 0.444444 pu and the transformer 0.133333 pu.',
        set: { Sbase: 200 },
        reads: [
          ['base.genPu', 0.444444],
          ['base.txPu', 0.133333],
        ],
      },
      {
        say: 'Read the fault current both ways. On the right base a bolted fault behind the generator is 4.5 pu, and on the nameplate value it looks like 5 pu.',
        set: {},
        reads: [
          ['base.faultRight', 4.5],
          ['base.faultWrong', 5],
        ],
      },
    ],
    why:
      'An impedance in per unit is an impedance in ohms divided by a base that depends on the rating it ' +
      'was quoted against. Move to another base and the ohms do not change, so the per-unit number must. ' +
      'The formula is Z_new = Z_old times the ratio of the base powers times the square of the ratio of ' +
      'the base voltages. Both factors are exact, and the conversion is its own inverse. The cost of ' +
      'getting it wrong is not a small error. A nameplate reactance used unconverted here overstates the ' +
      'fault current by an eighth, and a study that sizes a breaker on that number has sized it wrongly.',
    whyReads: [[(x) => x.faultWrong / x.faultRight, 1.11111]],
  },

  a4: {
    see:
      'A 60 MW load at 0.85 lagging takes 37.1847 Mvar as well, which is 0.6 + j0.371847 pu on a 100 MVA ' +
      'base. As a constant impedance the same load is 1.41667 pu. The two models agree at 1.00 pu of ' +
      'voltage and nowhere else.',
    seeReads: [
      ['base.Qload', 37.1847e6],
      ['base.Ppu', 0.6],
      ['base.Qpu', 0.371847],
      ['base.Zconstant', 1.41667],
      [(x) => x.zip.Vref, 1],
    ],
    try: [
      {
        say: 'Read the two models at 0.90 pu. The constant-power load still takes 0.6 pu and the constant-impedance load takes 0.486 pu.',
        set: { Vpu: 0.9 },
        reads: [
          ['base.Pconstant', 0.6],
          ['base.Pat', 0.486],
        ],
      },
      {
        say: 'Move the reading voltage to 1.00 pu. Now both models take 0.6 pu, which is the voltage the conversion was made at.',
        set: { Vpu: 1 },
        reads: [
          ['base.Pat', 0.6],
          ['base.Pconstant', 0.6],
        ],
      },
      {
        say: 'Raise the power factor to unity. The reactive power goes to zero and the equivalent impedance falls to 1.66667 pu.',
        set: { pf: 1 },
        reads: [
          ['base.Qpu', 0],
          ['base.Zconstant', 1.66667],
        ],
      },
    ],
    why:
      'A load is a model, and which model is in force decides the answer. A constant-power load takes the ' +
      'same P and Q whatever the terminal voltage, which is what a motor with a speed controller does. A ' +
      'constant-impedance load takes power in proportion to the square of the voltage, which is what a ' +
      'heater does. At 0.90 pu the two differ by a fifth of the real power. Group D solves the network ' +
      'with the constant-power model, because that is the model that makes the problem nonlinear and so ' +
      'the model power flow was invented for. The mix of the two in a real feeder is the ZIP model, and ' +
      'the difference above is why it exists.',
    whyReads: [[(x) => 1 - x.at.constantImpedance.P / x.at.constantPower.P, 0.19]],
  },
}
