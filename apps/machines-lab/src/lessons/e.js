/** Efficiency at a load fraction, from the budget the experiment is set to. */
const effAt = (x, f) => {
  const m = x.machine
  const out = f * m.pOut
  const variable = f * f * (m.pCuFull + m.strayFraction * m.pOut)
  return (100 * out) / (out + variable + m.pCore + m.pFriction)
}

export const LESSONS = {
  e1: {
    see:
      'Group C’s machine at full load. It delivers 3000 W and takes 3429 W, so 429 W is lost. Of that, ' +
      '252 W is copper, 116 W is core, 46 W is friction and windage, and 15 W is the stray allowance. Only ' +
      'the first and the last move with the load.',
    seeReads: [
      ['loss.pOut', 3000],
      ['loss.pIn', 3429],
      ['loss.total', 429],
      ['loss.pCu', 252],
      ['loss.pCore', 116],
      ['loss.pFriction', 46],
      ['loss.pStray', 15],
    ],
    try: [
      {
        say: 'Halve the load. The copper loss falls fourfold to 63 W, the core and friction do not move, and the total falls only to 228.8 W.',
        set: { x: 0.5 },
        reads: [
          ['loss.pCu', 63],
          ['loss.total', 228.75],
        ],
      },
      {
        say: 'Take the load to 1.5 times rated. The copper loss climbs to 567 W and the total to 762.8 W, more than the machine can shed.',
        set: { x: 1.5 },
        reads: [
          ['loss.pCu', 567],
          ['loss.total', 762.75],
        ],
      },
    ],
    why:
      'Four losses, and they behave differently. Copper is I squared R, so it goes as the square of the ' +
      'load. Core loss is set by the flux and the frequency, both fixed by the supply, so it stands still. ' +
      'Friction and windage are set by the speed, which barely moves. Stray load loss is what the other ' +
      'three do not account for, taken as a fixed fraction of the output by convention. Naming it as a ' +
      'convention is more useful than pretending the sum is exact. The numbers here are Group C’s own ' +
      'split at its operating point, so this is that machine audited rather than a new one.',
  },

  e2: {
    see:
      'Efficiency is 87.49 % at full load, 86.77 % at half and 80.76 % at a quarter. The peak is not at ' +
      'full load. It sits at 77.89 % of it, at 87.82 %, where the loss that grows with the load equals the ' +
      'loss that does not.',
    seeReads: [
      [(x) => x.split.efficiency * 100, 87.489],
      [(x) => effAt(x, 0.5), 86.768],
      [(x) => effAt(x, 0.25), 80.759],
      [(x) => x.best.x * 100, 77.894],
      [(x) => x.best.efficiency * 100, 87.823],
      [(x) => x.best.variable / x.best.fixed, 1],
    ],
    try: [
      {
        say: 'Set the load to a quarter of rated. The efficiency falls to 80.76 %, because the fixed loss is now a large share of a small output.',
        set: { x: 0.25 },
        reads: [[(x) => x.split.efficiency * 100, 80.759]],
      },
      {
        say: 'Raise the core loss to 252 W, equal to the full-load copper loss. The peak moves up to 105.6 % of rated load, past where the machine may run.',
        set: { pCore: 252 },
        reads: [
          [(x) => x.best.x * 100, 105.646],
          [(x) => x.best.efficiency * 100, 84.172],
        ],
      },
    ],
    why:
      'Write the loss as a fixed part plus a part that goes as the square of the load fraction. ' +
      'Differentiate the efficiency and the maximum lands exactly where the two parts are equal, at the ' +
      'square root of the fixed loss over the full-load variable loss. The designer picks where the peak ' +
      'goes by choosing how much iron to buy against how much copper. A machine that spends its life at ' +
      'half load is built with its peak near half load. One that runs at its rating is built with the peak ' +
      'near the rating.',
  },

  e3: {
    see:
      'The loss is a current, the thermal resistance is a resistance, and the temperature rise is a node ' +
      'voltage. 429 W into 0.17 K/W settles at a rise of 72.93 K, which is 112.9 °C from a 40 °C ambient. ' +
      'The time constant is 17 minutes, so after one of them the rise has reached 46.1 K.',
    seeReads: [
      ['loss.total', 429],
      ['heat.rise', 72.93],
      ['heat.final', 112.93],
      ['heat.tauMin', 17],
      [(x, p) => p.Rth, 0.17],
      [(x, p) => p.ambient, 40],
    ],
    try: [
      {
        say: 'Move the cursor to a fifth of the window, which is one time constant. The rise reads 46.1 K, which is 63 % of the way to its final value.',
        set: { cursor: 0.2 },
        reads: [
          ['heat.riseNow', 46.1006],
          [() => (1 - Math.exp(-1)) * 100, 63.212],
        ],
      },
      {
        say: 'Double the thermal capacitance. The final rise does not change and the time constant doubles to 34 minutes, so the machine takes twice as long to get there.',
        set: { Cth: 12000 },
        reads: [
          ['heat.tauMin', 34],
          ['heat.rise', 72.93],
        ],
      },
    ],
    why:
      'Heat flowing out of a machine is proportional to how much hotter it is than its surroundings, which ' +
      'is the same law a resistor obeys. The heat stored in its mass is proportional to how hot it is, ' +
      'which is the law a capacitor obeys. So the thermal model is an R and a C, and the transient engine ' +
      'draws it with the same solver the armature used. The steady rise is loss times resistance and the ' +
      'time constant is resistance times capacitance. Nothing here is new physics. It is Elements F3 in ' +
      'kelvins.',
  },

  e4: {
    see:
      'Class F insulation is rated to 155 °C. From a 40 °C ambient that leaves 115 K of rise, so the ' +
      'machine may dissipate 676.5 W. At its rated load it dissipates 429 W and reaches 112.9 °C, leaving ' +
      '42.07 K in hand. It could carry 1.388 times rated load before it reaches the limit.',
    seeReads: [
      [(x, p) => p.classLimit, 155],
      [(x, p) => p.ambient, 40],
      [(x, p) => p.classLimit - p.ambient, 115],
      ['heat.limitLoss', 676.471],
      ['loss.total', 429],
      ['heat.final', 112.93],
      ['heat.headroom', 42.07],
      ['heat.overload', 1.38811],
    ],
    try: [
      {
        say: 'Drop the ambient to 20 °C. The allowed loss rises to 794.1 W, the headroom to 62.07 K, and the machine may now carry 1.539 times its rated load.',
        set: { ambient: 20 },
        reads: [
          ['heat.limitLoss', 794.118],
          ['heat.headroom', 62.07],
          ['heat.overload', 1.53866],
        ],
      },
      {
        say: 'Put the ambient back and specify class H insulation at 180 °C. The allowed loss rises to 823.5 W and the overload to 1.574 times rated.',
        set: { classLimit: 180 },
        reads: [
          ['heat.limitLoss', 823.529],
          ['heat.overload', 1.57405],
        ],
      },
    ],
    why:
      'A machine is not rated by its magnetics or its bearings. It is rated by how much heat it can shed ' +
      'while its winding insulation stays under the temperature that insulation is made for. Everything ' +
      'else follows. A cooler room raises the rating. Better insulation raises it. A blocked fan lowers it, ' +
      'by raising the thermal resistance. The time constant is 17 minutes, so an overload that would be ' +
      'fatal after an hour is harmless for a minute. That is why a short-time rating is a different number ' +
      'from a continuous one.',
    whyReads: [['heat.tauMin', 17]],
  },

  e5: {
    see:
      'With the toggle set to linear, every number in this lab is exact. Set it to the knee model and the ' +
      'magnetising inductance collapses past 0.15 A, from 8 H to 0.4 H. At 0.45 A the flux linkage is ' +
      '1.32 Wb where a linear model predicted 3.6 Wb. The label under the plot names the model that ' +
      'produced those numbers.',
    seeReads: [
      ['sat.iKnee', 0.15],
      ['sat.L', 0.4],
      ['sat.lambda', 1.32],
      ['sat.linear', 3.6],
      [(x, p) => p.L0, 8],
      [(x, p) => p.i, 0.45],
    ],
    try: [
      {
        say: 'Drop the current to 0.1 A, below the knee. The inductance reads the full 8 H again and the flux is 0.8 Wb, which is what the linear model gives.',
        set: { i: 0.1 },
        reads: [
          ['sat.L', 8],
          ['sat.lambda', 0.8],
        ],
      },
      {
        say: 'Switch to the arctangent curve. The flux at 0.45 A reads 1.04 Wb and the incremental inductance 0.345 H, and the label changes to name that curve.',
        set: { model: 'atan' },
        reads: [
          ['sat.lambda', 1.04026],
          ['sat.L', 0.344729],
        ],
      },
    ],
    why:
      'Iron holds only so much flux. Past that point more current buys almost none, so the incremental ' +
      'inductance falls and a transformer draws a current spike near the peak of each half cycle. There is ' +
      'no exact law to admit here, only measured curves, so this lab offers named models and prints the ' +
      'name beside every number they produce. The knee model is piecewise-linear, so it is exact inside ' +
      'each piece and its corner is an event the engine can place. The arctangent curve fits a real core ' +
      'better and has no piecewise-exact solution, so it is offered for the plot and declined for a ' +
      'transient.',
  },
}
