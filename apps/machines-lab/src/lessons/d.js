export const LESSONS = {
  d1: {
    see:
      'The terminal voltage, the excitation EMF and the current between them close one triangle. At a ' +
      'power angle of 20 degrees the machine carries 7701 W and draws 11.24 A at a power factor of 0.989. ' +
      'The rotor turns at exactly 1500 rev/min whatever the angle. Only the angle moves.',
    seeReads: [
      ['sync.delta', 20],
      ['sync.P', 7701.15],
      ['sync.I', 11.2408],
      ['sync.pf', 0.98887],
      ['sync.rpmSync', 1500],
    ],
    try: [
      {
        say: 'Open the angle to 45 degrees. The power more than doubles to 15.92 kW, the current rises to 23.72 A, and the torque reaches 101.4 N·m.',
        set: { deltaDeg: 45 },
        reads: [
          ['sync.P', 15921.7],
          ['sync.I', 23.7229],
          ['sync.torque', 101.361],
        ],
      },
      {
        say: 'Put the angle back and drop the excitation to 180 V. The current becomes 10.9 A and lagging, and the machine now takes 5352 var from the supply.',
        set: { E: 180 },
        reads: [
          ['sync.I', 10.9035],
          ['sync.Q', 5351.64],
        ],
      },
    ],
    why:
      'A synchronous machine has no slip. Its rotor is locked to the travelling field, and what changes ' +
      'with load is the angle between the rotor flux and the stator flux. That angle appears directly in ' +
      'the phasor diagram as the angle of the internal EMF behind the terminal voltage. The current is ' +
      'whatever the synchronous reactance passes for the difference between the two, so both the real and ' +
      'the reactive power follow from the triangle. Reading the diagram is the whole skill, and the power ' +
      'expression is what it gives when the armature resistance is dropped.',
  },

  d2: {
    see:
      'Power follows the sine of the angle, so it peaks at 90 degrees. This machine can carry 22.52 kW ' +
      'there against the 7701 W it carries at 20 degrees, a margin of 2.92. Past the peak there is no ' +
      'steady state, and the rotor falls out of step.',
    seeReads: [
      ['sync.pullOut', 22516.7],
      ['sync.pullOutDeg', 90],
      ['sync.P', 7701.15],
      ['sync.margin', 2.9238],
    ],
    try: [
      {
        say: 'Set the angle to 90 degrees. The power reaches 22.52 kW, the margin falls to one, and any more load pushes the machine out of synchronism.',
        set: { deltaDeg: 90 },
        reads: [
          ['sync.P', 22516.7],
          ['sync.margin', 1],
        ],
      },
      {
        say: 'Double the synchronous reactance to 16 Ω. The pull-out halves to 11.26 kW, and the same 20 degrees now carries only 3851 W.',
        set: { Xs: 16 },
        reads: [
          ['sync.pullOut', 11258.3],
          ['sync.P', 3850.58],
        ],
      },
    ],
    why:
      'Between zero and 90 degrees more angle brings more power, so a machine that falls behind pulls ' +
      'itself back. Past 90 degrees more angle brings less power, so a machine that falls behind falls ' +
      'further, and it stops turning with the field. That is loss of synchronism, and it is a stability ' +
      'limit rather than a thermal one. The margin is what carries a machine through a fault or a sudden ' +
      'load. A large synchronous reactance is cheap to build and it lowers the margin, so the two are ' +
      'traded against each other.',
  },

  d3: {
    see:
      'Sweep the excitation and the current traces a V. At 180 V the machine draws 10.9 A lagging and ' +
      'takes 5352 var. At 260 V it draws 11.24 A leading and supplies 1159 var. In between there is a ' +
      'minimum, near 231 V, where the current is 10.03 A and the reactive power is nearly gone.',
    seeReads: [
      ['vcurve.0.Imag', 10.9035],
      ['vcurve.0.Q', 5351.64],
      ['vcurve.1.Imag', 10.0256],
      ['vcurve.2.Imag', 11.2408],
      ['vcurve.2.Q', -1158.74],
      [(x) => -x.vCurve[2].Q, 1158.74],
      [(x) => x.vCurve[1].machine.V, 230.94],
    ],
    try: [
      {
        say: 'Press the 180 V chip. The power factor falls to 0.706 lagging, so the same watts now need more current than at any higher excitation.',
        set: { E: 180 },
        reads: [
          ['sync.pf', 0.70578],
          ['sync.I', 10.9035],
        ],
      },
      {
        say: 'Press 320 V. The current climbs to 16.22 A and the machine supplies 6042 var, which is a synchronous condenser doing its job.',
        set: { E: 320 },
        reads: [
          ['sync.I', 16.2236],
          ['sync.Q', -6041.53],
          [(x) => -x.phasor.Q, 6041.53],
        ],
      },
    ],
    why:
      'The real power is fixed by the shaft, so the in-phase part of the current cannot change. What the ' +
      'excitation changes is the reactive part. Under-excite and the machine draws lagging current, ' +
      'behaving like an inductor. Over-excite and it draws leading current, behaving like a capacitor. ' +
      'Between them the current is purely real and is at its smallest. A grid runs its generators ' +
      'over-excited on purpose, because the loads are inductive and someone has to supply the vars.',
  },

  d4: {
    see:
      'Give the rotor two different reactances, 8 Ω along the field and 5 Ω across it, and a second power ' +
      'term appears. At 20 degrees it is 3857 W beside the field term of 7701 W. It follows the sine of ' +
      'twice the angle, so it peaks at 45 degrees, and it moves the pull-out down to 67.7 degrees.',
    seeReads: [
      ['sync.field', 7701.15],
      ['sync.reluctance', 3856.73],
      ['sync.P', 11557.9],
      ['sync.pullOutDeg', 67.6997],
      [(x, p) => p.Xd, 8],
      [(x, p) => p.Xq, 5],
    ],
    try: [
      {
        say: 'Set the excitation to zero. The field term goes with it and 3857 W remains, made by a rotor with no current in it at all.',
        set: { E: 0 },
        reads: [
          ['sync.field', 0, 1e-9],
          ['sync.reluctance', 3856.73],
          ['sync.P', 3856.73],
        ],
      },
      {
        say: 'Keep the excitation at zero and open the angle to 45 degrees. The reluctance term reaches its own peak of 6000 W, halfway to where the field term would peak.',
        set: { E: 0, deltaDeg: 45 },
        reads: [
          ['sync.reluctance', 6000],
          ['sync.P', 6000],
        ],
      },
    ],
    why:
      'A salient rotor presents an easier magnetic path along its poles than between them. The stator flux ' +
      'pulls the rotor towards the easier alignment, which is a torque and needs no rotor current. It ' +
      'follows the sine of twice the angle because the rotor looks the same after half a turn of the ' +
      'electrical angle. The two terms add with different periods, so the total peaks earlier than 90 ' +
      'degrees. A synchronous reluctance machine is this term alone, with no magnet and no field winding, ' +
      'and it is one reason such machines are cheap to build.',
  },

  d5: {
    see:
      'The three phase voltages at this instant map to two numbers that do not change as time runs. In the ' +
      'power-invariant convention the pair has length 398, which is the 325 V peak times the square root ' +
      'of three halves. In the amplitude-invariant convention the same set has length 325. Both invert ' +
      'exactly, and each carries its own power law.',
    seeReads: [
      ['dq.radius', 398.042],
      ['dq.otherRadius', 325],
      [(x, p) => p.amp, 325],
      [(x) => x.radius / x.other[0], Math.sqrt(1.5)],
      [(x) => x.power.pDq / x.power.pAbc, 1],
      [(x) => Math.max(...x.back.map((v, k) => Math.abs(v - x.abc[k]))), 0, 1e-9],
    ],
    try: [
      {
        say: 'Switch to the amplitude-invariant convention. The pair is now 325 long, matching the peak, and the power law it prints carries a factor of three halves.',
        set: { convention: 'amplitude-invariant' },
        reads: [
          ['dq.radius', 325],
          ['dq.otherRadius', 398.042],
          [(x) => x.power.pDq / x.power.pAbc, 1],
        ],
      },
      {
        say: 'Move time on. The three-phase set has turned but the pair has not moved, because the frame turns with it.',
        set: { t: 0.4 },
        reads: [
          ['dq.radius', 398.042],
          ['dq.q', 0, 1e-9],
        ],
      },
    ],
    why:
      'The transform is a rotation and a scaling, so it is a change of coordinates and nothing is lost. ' +
      'Choose the scaling to make the matrix orthogonal and the inverse is the transpose, and the product ' +
      'of a voltage vector and a current vector is the same number in either frame. Choose it to preserve ' +
      'amplitudes instead and a factor of three halves appears in every power and every torque. Both are ' +
      'exact and both are used. A torque constant quoted in the wrong one is wrong by that factor, which is ' +
      'the commonest mistake in the subject.',
  },

  d6: {
    see:
      'In the dq frame the machine is two states and a linear equation. At 100 Hz electrical the two axes ' +
      'are coupled by 628.3 per second in one direction and the same the other way. The magnet appears as ' +
      'a constant term of −25.13 thousand in the q row, which is its own back-EMF.',
    seeReads: [
      ['pmsm.A.0.1', 628.319],
      ['pmsm.A.1.0', -628.319],
      ['pmsm.c.1', -25132.7],
      [(x, p) => p.fe, 100],
    ],
    try: [
      {
        say: 'Double the electrical frequency to 200 Hz. The coupling doubles to 1257 per second and the magnet term doubles to −50.27 thousand.',
        set: { fe: 200 },
        reads: [
          ['pmsm.A.0.1', 1256.64],
          ['pmsm.c.1', -50265.5],
        ],
      },
      {
        say: 'Put the frequency back and double the quadrature inductance to 4 mH. The current loop slows, and its time constant doubles to 8 ms.',
        set: { Lq: 4e-3 },
        reads: [['pmsm.tauElec', 0.008]],
      },
    ],
    why:
      'The three phase equations have a rotor angle in every coefficient, so they are time-varying. Move to ' +
      'the frame that turns with the rotor and the angle leaves the coefficients entirely. What is left is ' +
      'two first-order equations with constant coefficients at a fixed speed, coupled by speed terms, plus ' +
      'a constant from the magnet. That is a linear state space, so the transient engine solves it with no ' +
      'step. It is also why a current controller for this machine is two ordinary loops rather than ' +
      'anything exotic.',
  },

  d7: {
    see:
      'Hold the direct-axis current at zero and torque is proportional to the quadrature current, ' +
      '0.36 N·m per amp. Ten amps make 3.6 N·m. The current loop is one over L s plus R, with a time ' +
      'constant of 4 ms. The speed loop is one over J s plus B, with 5 s. The two are 1250 apart, which is ' +
      'why one nests inside the other.',
    seeReads: [
      ['pmsm.kT', 0.36],
      ['pmsm.torque', 3.6],
      ['pmsm.tauElec', 0.004],
      ['pmsm.tauMech', 5],
      ['pmsm.separation', 1250],
      [(x, p) => p.iq, 10],
    ],
    try: [
      {
        say: 'Double the magnet flux to 0.16 Wb. The torque constant doubles to 0.72 N·m per amp, and the same 10 A now makes 7.2 N·m.',
        set: { lambda: 0.16 },
        reads: [
          ['pmsm.kT', 0.72],
          ['pmsm.torque', 7.2],
        ],
      },
      {
        say: 'Double the quadrature inductance to 4 mH. The current loop slows to 8 ms and the separation halves to 625, which leaves less room between the two loops.',
        set: { Lq: 4e-3 },
        reads: [
          ['pmsm.tauElec', 0.008],
          ['pmsm.separation', 625],
        ],
      },
    ],
    why:
      'With the direct-axis current held at zero the torque expression loses its product term, so torque is ' +
      'one constant times one current. The controller then has a current loop it can make fast and a speed ' +
      'loop it can make slower, and the inner loop looks like a gain to the outer one. Both plants here are ' +
      'exactly first order. They cross to Control Lab as they are, with no approximation and no guard. ' +
      'The cross-coupling between the axes is cancelled by a feed-forward the controller adds. That ' +
      'cancellation is exact, because the term is known.',
  },
}
