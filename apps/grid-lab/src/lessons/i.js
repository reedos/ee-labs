// Group I: the machine on the grid, and stability.

export const LESSONS_I = {
  i1: {
    see:
      'The machine sits behind its transient reactance, and the power it delivers is the maximum transfer ' +
      'times the sine of the rotor angle. With 2 pu of transfer and 1 pu of mechanical power the rotor ' +
      'settles at 30.0000°. The most this network could carry is 2 pu, at 90°.',
    seeReads: [
      ['swing.delta0', 30],
      ['swing.transfer', 2],
      ['swing.peakAngle', 90],
    ],
    try: [
      {
        say: 'Set the transfer before the fault to 1.5 pu. The rotor has to work harder for the same power, so it settles at 41.8103°.',
        set: { pre: 1.5 },
        reads: [['swing.delta0', 41.8103]],
      },
      {
        say: 'Set the mechanical power to 1.4 pu. The angle rises to 44.4270°, because more power needs more angle.',
        set: { Pm: 1.4 },
        reads: [['swing.delta0', 44.427]],
      },
      {
        say: 'Read the angle the machine may not pass after the fault clears. With 1.5 pu of transfer left it is 138.190°.',
        set: {},
        reads: [['swing.deltaMax', 138.19]],
      },
    ],
    why:
      'In steady state a synchronous machine is an internal voltage behind a reactance. The angle ' +
      'between that voltage and the network’s is the machine’s whole control variable. The power ' +
      'transferred is the product of the two voltages over the reactance, times the sine of the angle. ' +
      'Its maximum is at 90°. The machine model comes from the Machines Lab, which measures the same ' +
      'power-angle relation on a bench. What this lab adds is a network on the other side and a fault ' +
      'that changes the reactance, so the maximum transfer moves while the mechanical power does not.',
    whyReads: [
      [(x, p) => Math.sin(x.st.delta0) * p.pre, 1, 1e-12],
      ['swing.peakAngle', 90],
    ],
  },

  i2: {
    see:
      'The swing equation is the rotor’s inertia times its acceleration, against the mechanical power ' +
      'less the electrical power. Here the inertia constant is 0.0212207 pu·s² per radian. Disturbed ' +
      'after the trip, the machine swings at 1.15523 Hz, a period of 0.865629 s.',
    seeReads: [
      ['swing.M', 0.0212207],
      ['swing.fn', 1.15523],
      ['swing.period', 0.865629],
      ['swing.K', 1.118034],
    ],
    try: [
      {
        say: 'Double the inertia constant to 8 s. The swing frequency falls to 0.816871 Hz, by the square root of two.',
        set: { H: 8 },
        reads: [['swing.fn', 0.816871]],
      },
      {
        say: 'Set the transfer after the fault to 2 pu. The machine is stiffer, the synchronising coefficient rises to 1.73205 pu per radian, and it swings at 1.43800 Hz.',
        set: { post: 2 },
        reads: [
          ['swing.K', 1.73205],
          ['swing.fn', 1.438],
        ],
      },
      {
        say: 'Set the mechanical power to 1.4 pu against 1.5 pu of transfer. The angle is near the peak, the coefficient falls to 0.538516 pu per radian, and the swing slows to 0.801766 Hz.',
        set: { Pm: 1.4 },
        reads: [
          ['swing.K', 0.538516],
          ['swing.fn', 0.801766],
        ],
      },
    ],
    why:
      'The inertia constant M is twice the stored energy constant H over the synchronous electrical ' +
      'speed, which puts it in per unit seconds squared per radian. Linearising the swing equation about ' +
      'its equilibrium gives a second-order system whose stiffness is the slope of the power-angle curve ' +
      'there, and that slope is the synchronising coefficient. The natural frequency is the square root ' +
      'of the coefficient over the inertia, so a heavier machine swings slower and a stiffer network ' +
      'swings faster. The linearisation is exact as a linearisation, so it crosses to Control Lab as a ' +
      'second-order plant with no hedge. A governor adds damping, and that loop is Control Lab’s subject.',
    whyReads: [[(x) => x.st.fnPost - Math.sqrt(x.st.Kpost / x.st.M) / (2 * Math.PI), 0, 1e-12]],
  },

  i3: {
    see:
      'A fault cuts the transfer to 0.5 pu and clearing leaves 1.5 pu. The machine accelerates from ' +
      '30.0000° and must finish decelerating by 138.190°. The two areas are equal at a clearing angle of ' +
      '70.2924°, and each area is 0.438833 pu·rad.',
    seeReads: [
      ['swing.delta0', 30],
      ['swing.deltaMax', 138.19],
      ['swing.deltaCr', 70.2924],
      ['swing.areaAccel', 0.438833],
      ['swing.areaDecel', 0.438833],
    ],
    try: [
      {
        say: 'Set the transfer during the fault to 0.2 pu. Less is left to hold the machine, so the critical angle falls to 62.6612°.',
        set: { during: 0.2 },
        reads: [['swing.deltaCr', 62.6612]],
      },
      {
        say: 'Set the transfer after the fault to 1.9 pu. More is left to stop it, so the critical angle rises to 89.3792°.',
        set: { post: 1.9 },
        reads: [['swing.deltaCr', 89.3792]],
      },
      {
        say: 'Set the transfer during the fault to 0.9 pu. The fault is mild, the critical angle reaches 90.8777°, and the areas are still equal.',
        set: { during: 0.9 },
        reads: [
          ['swing.deltaCr', 90.8777],
          ['swing.areaError', 0, 1e-10],
        ],
      },
    ],
    why:
      'Multiply the swing equation by the angular speed and integrate once. What comes out is an energy ' +
      'relation with nothing dropped from it. The area between the mechanical power and the electrical ' +
      'power, taken over the angle, is the kinetic energy the rotor gains while the fault is on and loses ' +
      'after it clears. If the second area can equal the first before the angle reaches the point where ' +
      'the electrical power falls below the mechanical power again, the machine turns back. The clearing ' +
      'angle at which the two are exactly equal is the critical one. Both areas here come from ' +
      'quadrature rather than from the formula that produced the angle, so the agreement is a measurement.',
    whyReads: [[(x) => x.st.areaError, 0, 1e-10]],
  },

  i4: {
    see:
      'The critical clearing angle is a closed form. The critical clearing time is not, so it comes from ' +
      'integrating the swing equation until the angle reaches it. Here that is 0.206114 s, which is ' +
      '12.3669 cycles at 60 Hz. Had the fault removed the transfer entirely, the closed form would give ' +
      '0.146827 s.',
    seeReads: [
      ['swing.tcr', 0.206114],
      ['swing.cycles', 12.3669],
      ['swing.closed', 0.146827],
      ['swing.closedAngle', 59.1035],
      ['swing.f', 60],
    ],
    try: [
      {
        say: 'Set the transfer during the fault to 0.2 pu. Less holds the machine back, so the critical time falls to 0.165371 s.',
        set: { during: 0.2 },
        reads: [['swing.tcr', 0.165371]],
      },
      {
        say: 'Double the inertia constant to 8 s. The rotor is heavier and takes 0.291500 s to reach the same angle.',
        set: { H: 8 },
        reads: [['swing.tcr', 0.2915]],
      },
      {
        say: 'Set the transfer after the fault to 1.9 pu. The critical angle is further away, so the critical time rises to 0.253647 s.',
        set: { post: 1.9 },
        reads: [['swing.tcr', 0.253647]],
      },
    ],
    why:
      'Turning an angle into a time needs the angle as a function of time, and that needs the swing ' +
      'equation integrated. It is not linear and it is not a circuit, so the exact matrix exponential the ' +
      'circuit package uses cannot solve it. This lab uses fixed-step Runge–Kutta of fourth order, names ' +
      'the method and the step on the pane, and checks itself against the energy relation. There is one ' +
      'case with a closed form. A fault that removes the transfer entirely leaves a constant ' +
      'acceleration, so the angle is quadratic in time and the clearing time follows from the angle with ' +
      'no integration at all.',
    whyReads: [[(x) => x.closed.tcr - Math.sqrt((2 * x.st.M * (x.closed.deltaCr - x.st.delta0)) / x.st.Pm), 0, 1e-12]],
  },

  i5: {
    see:
      'Clear at 0.15 s and the rotor swings to 89.7763° before it turns back. The energy relation puts ' +
      'the same peak at 89.7763°, and the two differ by 1.17166 × 10⁻⁵ degrees. The pane names the ' +
      'method and the step it used.',
    seeReads: [
      ['swing.peak', 89.7763],
      ['swing.peakExact', 89.7763],
      ['swing.peakGap', 1.17166e-5],
      ['swing.step', 0.001],
    ],
    try: [
      {
        say: 'Clear at 0.05 s. The rotor barely moves, peaking at 59.4938°, and the two answers still agree.',
        set: { tc: 0.05 },
        reads: [
          ['swing.peak', 59.4938],
          ['swing.peakExact', 59.4938],
        ],
      },
      {
        say: 'Clear at 0.2 s, just short of critical. The peak reaches 122.922°, which is close to the 138.190° it may not pass.',
        set: { tc: 0.2 },
        reads: [
          ['swing.peak', 122.922],
          ['swing.deltaMax', 138.19],
        ],
      },
      {
        say: 'Set the integrator step to 0.05 s. The first pass misses the energy relation by 0.0282463 degrees, so the guard halves the step to 0.025 s and the gap falls to 0.00122736 degrees.',
        set: { step: 0.05 },
        reads: [
          ['swing.firstTry', 0.0282463],
          ['swing.step', 0.025],
          ['swing.peakGap', 0.00122736],
        ],
      },
    ],
    why:
      'The energy relation gives the peak of the first swing without integrating anything, because it ' +
      'only needs the angle and the speed at the instant of clearing. The integrator gives the whole ' +
      'trajectory, and the peak is one point on it. Comparing the two is the guard. The integrated peak ' +
      'has to match the closed form to a hundredth of a degree, and the step halves until it does. At a ' +
      'coarse step the guard fires and the run repeats at half of it, where it passes. Clear late enough ' +
      'and there is no peak at all. The rotor passes the point where the electrical power falls below the ' +
      'mechanical power and never turns back.',
    whyReads: [[(x) => (x.run.stable ? 1 : 0), 1]],
  },
}
