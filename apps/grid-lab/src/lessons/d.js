// Group D: power flow.

export const LESSONS_D = {
  d1: {
    see:
      'Bus 3 takes 1.60 + j0.80 pu whatever its voltage is. At 1.00 pu it draws 1.78885 pu of current, at ' +
      '0.95 pu it draws 1.88300 pu, and at 0.90 pu it draws 1.98762 pu. The current depends on the answer, ' +
      'so the network is nonlinear. A flat guess leaves a mismatch of 1.6 pu.',
    seeReads: [
      ['flow.guessI.0', 1.78885],
      ['flow.guessI.1', 1.883],
      ['flow.guessI.2', 1.98762],
      ['flow.mismatch.0', 1.6],
      ['flow.loadP', 1.6],
      ['flow.loadQ', 0.8],
      ['flow.guessV.1', 0.95],
      ['flow.guessV.2', 0.9],
    ],
    try: [
      {
        say: 'Halve the loading. The load now takes 0.8 + j0.4 pu, and the flat guess leaves a mismatch of 0.8 pu.',
        set: { load: 0.5 },
        reads: [
          ['flow.mismatch.0', 0.8],
          ['flow.loadP', 0.8],
          ['flow.loadQ', 0.4],
        ],
      },
      {
        say: 'Set the loading to 2. The mismatch at a flat start doubles to 3.2 pu, because the schedule it is measured against has doubled.',
        set: { load: 2 },
        reads: [['flow.mismatch.0', 3.2]],
      },
      {
        say: 'Read the answer at the defaults. Bus 3 settles at 0.961727 pu, so the current it really draws is 1.85999 pu.',
        set: {},
        reads: [
          ['bus.bus3.V', 0.961727],
          [(x) => Math.hypot(1.6, 0.8) / x.sol.byId.bus3.V, 1.85999],
        ],
      },
    ],
    why:
      'A resistor takes a current in proportion to its voltage, so a network of resistors is one linear ' +
      'solve. A constant-power load takes P and Q whatever the voltage, so its current is the conjugate of ' +
      'the power over the voltage. That is a current that depends on the unknown, which is what makes the ' +
      'power flow nonlinear. The complex solve in the circuit package cannot state this problem, because ' +
      'it wants a source and what is given here is a power. Newton states it as a mismatch to be driven ' +
      'to zero, and D3 watches that mismatch fall. The same object appears in Circuit Elements Lab i2 as a ' +
      'diode, whose current also depends on the answer.',
    whyReads: [[(x) => x.sol.byId.bus3.P, -1.6, 1e-9]],
  },

  d2: {
    see:
      'Bus 1 is the slack. It holds both its angle and its magnitude, and contributes no equation at all. ' +
      'Bus 2 holds its magnitude and contributes one. Bus 3 holds neither and contributes two. That is ' +
      'three equations against three unknowns, which is what a solvable problem looks like.',
    seeReads: [
      ['bus.bus1.rows', 0],
      ['bus.bus2.rows', 1],
      ['bus.bus3.rows', 2],
      ['flow.equations', 3],
      ['flow.unknowns', 3],
    ],
    try: [
      {
        say: 'Set bus 2’s setpoint to 1.02 pu. It holds the new magnitude and its reactive output rises to 0.766675 pu.',
        set: { V2: 1.02 },
        reads: [
          ['bus.bus2.V', 1.02],
          ['bus.bus2.Q', 0.766675],
        ],
      },
      {
        say: 'Set bus 2’s reactive limit to 0.3 pu. The bus can no longer hold its magnitude, so it contributes two equations instead of one.',
        set: { Qmax: 0.3 },
        reads: [
          ['bus.bus2.rows', 2],
          ['flow.equations', 4],
          ['flow.unknowns', 4],
        ],
      },
      {
        say: 'Read the slack’s output at the defaults. It supplies 1.01817 pu without being asked for any of it.',
        set: {},
        reads: [['flow.slackP', 1.018174]],
      },
    ],
    why:
      'Every bus has four quantities: an angle, a magnitude, a real injection and a reactive one. Two are ' +
      'known at each bus and two are solved for, and which two depends on what the bus has attached. A ' +
      'generator with a voltage regulator holds its magnitude and its real output, so its angle and its ' +
      'reactive output are unknowns. A load holds its real and reactive injection, so both its angle and ' +
      'its magnitude are unknowns. One bus has to hold the angle reference and take up whatever the rest ' +
      'of the network does not balance, and that is the slack. Counting this way, the equations and the ' +
      'unknowns always match.',
    whyReads: [[(x) => x.sol.iters[0].rows.length - x.sol.iters[0].J[0].length, 0]],
  },

  d3: {
    see:
      'From a flat start the mismatch falls 1.6 pu, then 0.0689211 pu, then 0.000347981 pu, then ' +
      '8.36676 × 10⁻⁹ pu, and then to the floating-point floor. Four iterations take it from a guess with ' +
      'no information in it to an answer good to twelve figures. The number of correct digits doubles ' +
      'each pass.',
    seeReads: [
      ['flow.mismatch.0', 1.6],
      ['flow.mismatch.1', 0.0689211],
      ['flow.mismatch.2', 0.000347981],
      ['flow.mismatch.3', 8.366755e-9],
      ['flow.iterations', 4],
    ],
    try: [
      {
        say: 'Set the loading to 3. The problem is harder, so the mismatch starts at 4.8 pu and the walk takes five iterations.',
        set: { load: 3 },
        reads: [
          ['flow.mismatch.0', 4.8],
          ['flow.iterations', 5],
        ],
      },
      {
        say: 'Set the loading to 0.4. The flat start is only 0.64 pu away, and four iterations still reach the floor.',
        set: { load: 0.4 },
        reads: [
          ['flow.mismatch.0', 0.64],
          ['flow.iterations', 4],
        ],
      },
      {
        say: 'Read the last mismatch at the defaults. It is below 10⁻¹² pu, which is the tolerance the walk stops on.',
        set: {},
        reads: [[(x) => x.sol.mismatches[4], 0, 1e-12]],
      },
    ],
    why:
      'Each pass replaces every bus’s injection by its tangent at the present guess, solves that linear ' +
      'system, and moves. The tangent is the Jacobian, and each bus contributes its own rows to it. The ' +
      'rows are the derivatives of P and Q with respect to every angle and every free magnitude, and the ' +
      'pane prints them. Because the tangent is exact rather than approximate, the error squares each ' +
      'pass. That squaring is quadratic convergence, and it is why four iterations suffice. A test compares ' +
      'every entry of that Jacobian against a central finite difference of the injection it ' +
      'differentiates, so the printed matrix is measured and not asserted.',
    whyReads: [[(x) => x.sol.mismatches[3] / (x.sol.mismatches[2] * x.sol.mismatches[2]), 0.0691, 0.05]],
  },

  d4: {
    see:
      'Bus 2 needs 0.407676 pu of reactive power to hold 1.00 pu. Limit it to 0.3 pu and it cannot. The ' +
      'bus gives up its magnitude, which falls to 0.993841 pu, and its reactive output pins at the limit. ' +
      'The conversion is recorded at the iteration it happened on.',
    seeReads: [
      ['bus.bus2.Q', 0.3],
      ['bus.bus2.V', 0.993841],
      ['flow.conversion', 1],
      [(x, p, again) => again({ Qmax: 3 }).sol.byId.bus2.Q, 0.407676],
    ],
    try: [
      {
        say: 'Raise the limit to 0.5 pu. The bus holds 1.00 pu again and makes the 0.407676 pu it needs.',
        set: { Qmax: 0.5 },
        reads: [
          ['bus.bus2.V', 1],
          ['bus.bus2.Q', 0.407676],
        ],
      },
      {
        say: 'Lower the limit to 0.15 pu. The magnitude falls further, to 0.987416 pu, and the loss rises to 1.88340 MW.',
        set: { Qmax: 0.15 },
        reads: [
          ['bus.bus2.V', 0.987416],
          ['flow.lossMW', 1.8834],
        ],
      },
      {
        say: 'Read the slack’s reactive output at the 0.3 pu limit. It has risen to 0.135690 pu, because the reactive power has to come from somewhere.',
        set: { Qmax: 0.3 },
        reads: [['flow.slackQ', 0.13569]],
      },
    ],
    why:
      'A generator holds its terminal voltage by adjusting its excitation, and its excitation has a ' +
      'ceiling. Past that ceiling the machine has no way to make more reactive power, so the voltage it ' +
      'was holding falls. In the solve that is a change of bus type. The magnitude stops being a known ' +
      'and becomes an unknown. The reactive injection stops being an unknown and pins at the limit. The ' +
      'bus then contributes two equations rather than one. A transistor crossing out of saturation is the ' +
      'same kind of event, and it is handled the same way. The region in force is recorded at each ' +
      'iteration and printed.',
    whyReads: [[(x) => x.sol.conversions.length, 1]],
  },

  d5: {
    see:
      'The load takes 1.60 pu and bus 2 supplies 0.60 pu of it. The slack supplies the rest, 1.01817 pu, ' +
      'and the extra 0.0181741 pu is loss. That is 1.81741 MW, and the three branch losses add up to the ' +
      'same number.',
    seeReads: [
      ['flow.slackP', 1.018174],
      ['flow.loss', 0.0181741],
      ['flow.lossMW', 1.81741],
      ['flow.branchLoss', 0.0181741],
      ['flow.loadP', 1.6],
      ['flow.genP', 0.6],
    ],
    try: [
      {
        say: 'Read the three branch losses. They are 0.00104253 pu, 0.00830262 pu and 0.00882897 pu.',
        set: {},
        reads: [
          ['branch.br12.loss', 0.00104253],
          ['branch.br13.loss', 0.00830262],
          ['branch.br23.loss', 0.00882897],
        ],
      },
      {
        say: 'Double the loading. Every current roughly doubles, so every loss roughly quadruples and the total reaches 8.53246 MW.',
        set: { load: 2 },
        reads: [['flow.lossMW', 8.53246]],
      },
      {
        say: 'Set bus 2’s setpoint to 1.05 pu. The generator now pushes reactive power into the network, the currents rise, and the loss reaches 2.33557 MW.',
        set: { V2: 1.05 },
        reads: [['flow.lossMW', 2.33557]],
      },
    ],
    why:
      'The slack bus has no schedule. Whatever the rest of the network does not balance appears there, ' +
      'and that is the load nobody else supplies plus every watt of loss. So the slack’s output is not a ' +
      'free number. It is fixed by the answer, and reading it is how a study finds out what the losses ' +
      'were. The audit is worth doing two ways. Summing the injections at every bus and summing the ' +
      'resistive loss in every branch are different calculations on the same solution, and they agree to ' +
      'floating point. A study whose two totals disagree has a modelling error, not a rounding one.',
    whyReads: [[(x) => Math.abs(x.sol.Ploss - x.sol.flows.reduce((s, f) => s + f.Ploss, 0)), 0, 1e-15]],
  },

  d6: {
    see:
      'At twice the base loading bus 3 sits at 0.904568 pu. Raise the loading further and the voltage ' +
      'falls faster than the loading rises. The last loading with an answer is 4.25 times the base, where ' +
      'bus 3 reads 0.611551 pu. Past it the iteration has nothing to settle on.',
    seeReads: [
      ['bus.bus3.V', 0.904568],
      ['flow.lastLoading', 4.25],
      ['flow.noseV', 0.611551],
    ],
    try: [
      {
        say: 'Set the loading to 3. Bus 3 falls to 0.828044 pu, and the fall from here on is much steeper than the fall from 1 to 2.',
        set: { load: 3 },
        reads: [['bus.bus3.V', 0.828044]],
      },
      {
        say: 'Set the loading to 4.25, the last one with an answer. Bus 3 is at 0.611551 pu and the walk needs eight iterations.',
        set: { load: 4.25 },
        reads: [
          ['bus.bus3.V', 0.611551],
          ['flow.iterations', 8],
        ],
      },
      {
        say: 'Set the loading to 4.3. There is no solution, and the pane gives the reason rather than a number.',
        set: { load: 4.3 },
        reads: [[(x) => (x.refusal ? 1 : 0), 1]],
      },
    ],
    why:
      'The curve of voltage against loading has a nose. Above the nose two solutions exist and the higher ' +
      'one is the operating point. At the nose they meet, and past it there is no solution at all, ' +
      'because no voltage lets the network deliver that much power through that much reactance. The ' +
      'Jacobian is singular at the nose, which is why the iteration stops converging as the nose is ' +
      'approached rather than at it. Ramping the schedule up in steps gets closer, and the pane says how ' +
      'far it got. What it will not do is print a voltage for a loading that has none, which is the ' +
      'refusal that Rule 2 of the scope document asks for.',
    whyReads: [[(x) => x.nose.points.length, 66]],
  },
}
