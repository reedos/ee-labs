// Group C: the line and the transformer.

export const LESSONS_C = {
  c1: {
    see:
      'One hundred kilometres of this line is 5 Ω of resistance and 40 Ω of reactance in series, which is ' +
      '0.00945180 pu and 0.0756144 pu on a 230 kV base. Its charging is 0.1587 pu, and half of it is ' +
      'stamped at each end. That is a π model made of elements the circuit solver already has.',
    seeReads: [
      ['line.R', 5],
      ['line.X', 40],
      ['line.Rpu', 0.0094518],
      ['line.Xpu', 0.0756144],
      ['line.charging', 0.1587],
      ['base.kV', 230],
    ],
    try: [
      {
        say: 'Set the length to 150 km. Every entry scales with it, so the series impedance is 7.5 Ω and 60 Ω and the charging is 0.23805 pu.',
        set: { km: 150 },
        reads: [
          ['line.R', 7.5],
          ['line.X', 60],
          ['line.charging', 0.23805],
        ],
      },
      {
        say: 'Set the length to 40 km. The reactance falls to 16 Ω and the charging to 0.06348 pu.',
        set: { km: 40 },
        reads: [
          ['line.X', 16],
          ['line.charging', 0.06348],
        ],
      },
      {
        say: 'Read the no-load charging current at 100 km. The shunt draws 39.8372 A with nothing at the far end.',
        set: { km: 100 },
        reads: [['line.chargingA', 39.8372]],
      },
    ],
    why:
      'A line has its resistance, inductance and capacitance spread along its length. The nominal π model ' +
      'lumps the whole series impedance in the middle and half the shunt at each end. Every element in ' +
      'that model is one the circuit solver already stamps, so a transmission network needs no new ' +
      'element type. The charging is the part a reader coming from lumped circuits misses. A line with ' +
      'nothing connected at the far end still draws current, and on a long line that current raises the ' +
      'far-end voltage above the sending end. C3 measures where the lumping stops being good enough.',
    whyReads: [
      [(x) => x.pi.Z[0] / x.km, 0.05],
      [(x) => x.pi.Z[1] / x.km, 0.4],
    ],
  },

  c2: {
    see:
      'The surge impedance of this line is 365.148 Ω, and at 230 kV that makes the surge impedance loading ' +
      '144.873 MW. Carrying exactly that, 200 km of line absorbs 31.74 Mvar in its series reactance and ' +
      'produces 31.74 Mvar in its charging. The two cancel.',
    seeReads: [
      ['line.Zc', 365.148],
      ['line.silMW', 144.873],
      ['line.absorbed', 31.74],
      ['line.produced', 31.74],
      ['line.net', 0, 1e-9],
      ['base.kV', 230],
    ],
    try: [
      {
        say: 'Halve the loading. The line now absorbs 7.935 Mvar and still produces 31.74 Mvar, so it gives 23.805 Mvar back to the network.',
        set: { loading: 0.5 },
        reads: [
          ['line.absorbed', 7.935],
          ['line.produced', 31.74],
          ['line.net', -23.805],
        ],
      },
      {
        say: 'Double the loading. The line absorbs 126.96 Mvar against the same 31.74 Mvar of charging, so it takes 95.22 Mvar from the network.',
        set: { loading: 2 },
        reads: [
          ['line.absorbed', 126.96],
          ['line.produced', 31.74],
          ['line.net', 95.22],
        ],
      },
      {
        say: 'Set the length to 400 km at the surge impedance loading. Both halves double, and the balance still closes.',
        set: { km: 400, loading: 1 },
        reads: [
          ['line.absorbed', 63.48],
          ['line.net', 0, 1e-9],
        ],
      },
    ],
    why:
      'The series reactance absorbs I²X and the shunt capacitance produces V²B, and both are exact for a ' +
      'lossless line. Setting them equal gives a current of V times the square root of B over X, which is ' +
      'a power of V² over the square root of X over B. That square root is the surge impedance, and the ' +
      'power is the surge impedance loading. A line at that loading needs no reactive support at all. ' +
      'Below it a line is a capacitor and raises voltages, which is why a lightly loaded line is switched ' +
      'out or fitted with a reactor. Above it a line is an inductor, which is what C4 then has to fix.',
    whyReads: [[(x) => x.surge.Zc - Math.sqrt(0.4 / 3e-6), 0, 1e-9]],
  },

  c3: {
    see:
      'An open-ended line rises at its far end. At 200 km the exact rise is 1.02449 and the lumped π ' +
      'model says 1.02459, an error of 0.00982 %. At 800 km the exact rise is 1.56261 and the lumped ' +
      'model says 1.62338, which is wrong by 3.88886 %.',
    seeReads: [
      ['line.at.200.exact', 1.02449],
      ['line.at.200.nominal', 1.02459],
      ['line.at.200.error', 0.00982],
      ['line.at.800.exact', 1.562609],
      ['line.at.800.nominal', 1.623377],
      ['line.at.800.error', 3.888865],
      ['line.kmOf.800', 800],
    ],
    try: [
      {
        say: 'Set the length to 100 km. The two models now differ by 0.000603380 %, which is nothing at all.',
        set: { km: 100 },
        reads: [['line.error', 0.00060338]],
      },
      {
        say: 'Set the length to 240 km, just inside the guard. The lumped model is still in force and errs by 0.0205717 %.',
        set: { km: 240 },
        reads: [
          ['line.long', 0],
          ['line.error', 0.0205717],
        ],
      },
      {
        say: 'Set the length to 260 km, just outside it. The guard fires and the exact hyperbolic form takes over.',
        set: { km: 260 },
        reads: [['line.long', 1]],
      },
    ],
    why:
      'The exact steady-state solution of a uniform line is hyperbolic in the propagation constant times ' +
      'the length. Open at the far end, the receiving voltage is the sending voltage divided by the ' +
      'hyperbolic cosine of that product, which for a lossless line is a plain cosine. The π model ' +
      'replaces that cosine with the first two terms of its series, so the error grows with the fourth ' +
      'power of the length. Past 250 km it passes a tenth of a percent, and this lab switches models ' +
      'there rather than warning about a number it could compute exactly. The pane says which model is in ' +
      'force at every length.',
    whyReads: [
      [(x) => x.rise.exact - 1 / Math.cos(x.rise.betaL), 0, 1e-9],
      ['line.guardKm', 250],
    ],
  },

  c4: {
    see:
      'A transformer of 0.1 pu reactance feeding 0.8 + j0.6 pu leaves 0.931926 pu at the far end. The ' +
      'drop is 0.0680742 pu. The estimate that reactive power times reactance over voltage is the drop ' +
      'gives 0.06 pu, which is short by 0.00807420 pu.',
    seeReads: [
      ['tx.V', 0.931926],
      ['tx.drop', 0.0680742],
      ['tx.estimate', 0.06],
      ['tx.estimateError', 0.0080742],
    ],
    try: [
      {
        say: 'Set the tap to 1.075. The receiving bus rises to 1.01286 pu, so a tap of 1.06301 would put it exactly at one.',
        set: { tap: 1.075 },
        reads: [
          ['tx.V', 1.01286],
          ['tx.tap', 1.063015],
        ],
      },
      {
        say: 'Set the tap back to one and add 0.65 pu of shunt capacitance. The receiving bus reaches 1.00191 pu, and 63.2051 Mvar puts it exactly at one.',
        set: { tap: 1, Bsh: 0.65 },
        reads: [
          ['tx.V', 1.00191],
          ['tx.mvar', 63.2051],
        ],
      },
      {
        say: 'Set the load’s reactive power to zero. The drop falls to 0.00322595 pu, because nearly all of it was reactive.',
        set: { Qload: 0 },
        reads: [['tx.drop', 0.00322595]],
      },
    ],
    why:
      'Current through a reactance makes a voltage across it, and the part of that voltage in line with ' +
      'the terminal voltage is what changes the magnitude. Reactive current is the part in line, which is ' +
      'why the estimate uses Q and not P. The estimate drops the term in P, and here that term costs ' +
      'another 0.00807420 pu. Two controls fix the drop and they fix it differently. A tap changer moves ' +
      'the ratio, which raises the far end and lowers nothing. A capacitor bank supplies the reactive ' +
      'power locally, so the current through the reactance falls and the drop falls with it. The core the ' +
      'winding sits on is Power Lab D1.',
    whyReads: [[(x) => x.drop - x.estimate, 0.0080742]],
  },
}
