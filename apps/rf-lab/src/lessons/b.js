// Group B's three registers. Every number here was measured by
// scripts/readings.mjs before it was written, and experiments.test.js
// recomputes each one at the setting its step names.

export const LESSONS_B = {
  b1: {
    see:
      'A 100 Ω load on a 50 Ω line is z = 2 in normalised units. The map Γ = (z − 1)/(z + 1) puts it at 0.3333 ' +
      'on the real axis, a third of the way from the centre to the edge. The Smith chart is that map, and every ' +
      'passive load lands inside its unit circle.',
    seeReads: [['z.re', 2], ['gamma.mag', 0.333333], ['gamma.deg', 0], ['point.open.re', 1], ['point.short.re', -1], ['point.match.mag', 0]],
    try: [
      {
        say: 'Set the load resistance to zero. The point moves to the left edge, at 1.000 and 180.00°, because a short reflects everything with the sign reversed.',
        set: { RL: 0 },
        reads: [['gamma.mag', 1], ['gamma.deg', 180]],
      },
      {
        say: 'Set the load to 0 Ω with 50 Ω of reactance. The point sits on the edge at 90.00°, because a pure reactance stores the energy and returns all of it.',
        set: { RL: 0, XL: 50 },
        reads: [['gamma.mag', 1], ['gamma.deg', 90], ['z.im', 1]],
      },
      {
        say: 'Set the load to 150 Ω with 100 Ω of reactance. That is z = 3 + j2, and the point reads 0.6325 at 18.43°.',
        set: { RL: 150, XL: 100 },
        reads: [['z.re', 3], ['z.im', 2], ['gamma.mag', 0.632456], ['gamma.deg', 18.4349]],
      },
    ],
    why:
      'The map sends the right half of the impedance plane onto the unit disc, one point for one point. Every ' +
      'passive load has a positive resistance, so every passive load lands inside. An open circuit is at 1, a ' +
      'short is at −1, and a matched load is at the centre. A whole infinite half plane fits in a picture the ' +
      'size of a coin, which is the reason for drawing it at all. A Möbius map sends lines and circles to lines ' +
      'and circles, so the grid arrives as circles rather than as a rectangular mesh. B2 computes those circles. ' +
      'The distance from the centre is the magnitude of Γ, which A2 already had. The angle around the centre is ' +
      'what A2 threw away.',
  },

  b2: {
    see:
      'The constant-resistance circle for r = 1 is centred at 0.5000 on the real axis with radius 0.5000. The ' +
      'constant-reactance arc for x = 1 is centred one unit to the right and 1.000 above the axis, with radius ' +
      '1.000. The app computes both from the map, and neither is traced from a chart image.',
    seeReads: [['circle.r.cx', 0.5], ['circle.r.radius', 0.5], ['circle.x.cx', 1], ['circle.x.cy', 1], ['circle.x.radius', 1], ['onCircle.r', 0], ['onCircle.x', 0]],
    try: [
      {
        say: 'Set the normalised resistance to 2. The circle’s centre moves out to 0.6667 and its radius falls to 0.3333.',
        set: { r: 2 },
        reads: [['circle.r.cx', 0.666667], ['circle.r.radius', 0.333333]],
      },
      {
        say: 'Set the normalised resistance to 0. The circle becomes the boundary itself, centred at 0 with radius 1.000, which is where every purely reactive load sits.',
        set: { r: 0 },
        reads: [['circle.r.cx', 0], ['circle.r.radius', 1]],
      },
      {
        say: 'Set the normalised reactance to 2. The arc’s centre drops to 0.5000 above the axis and its radius falls to 0.5000.',
        set: { x: 2 },
        reads: [['circle.x.cy', 0.5], ['circle.x.radius', 0.5]],
      },
      {
        say: 'Set the normalised reactance to −1. The arc moves below the axis, centred at −1.000 with radius 1.000, which is where a capacitive load sits.',
        set: { x: -1 },
        reads: [['circle.x.cy', -1], ['circle.x.radius', 1]],
      },
    ],
    why:
      'A line of constant resistance in the impedance plane is vertical. Its image under (z − 1)/(z + 1) is the ' +
      'circle of centre r/(1 + r) and radius 1/(1 + r), and both fall out of the map with nothing fitted. A line ' +
      'of constant reactance is horizontal, and its image is the circle of centre (1, 1/x) and radius the size of ' +
      '1/x. Every one of them passes through Γ = 1, because an infinite resistance and an infinite reactance are ' +
      'both the open circuit. The app hands centres and radii to the canvas and the canvas draws them. The test ' +
      'puts points on each circle, maps them back through the formula, and checks the resistance and the ' +
      'reactance against the label. A chart drawn as a picture cannot be checked that way.',
  },

  b3: {
    see:
      'A quarter wave of line turns the point 180.00° clockwise. The magnitude does not move on a lossless line, ' +
      'so the path is an arc of the standing-wave circle of radius 0.3333. Every load with this standing-wave ' +
      'ratio sits on that circle, whatever its angle.',
    seeReads: [['turn.deg', 180], ['circle.vswr.radius', 0.333333], ['locus.mag', 0.333333], ['gamma.mag', 0.333333]],
    try: [
      {
        say: 'Set the length to 10.34 cm, which is a half wave. The point turns 360.00° and arrives exactly where it started.',
        set: { len: 0.10343822510819459 },
        reads: [['turn.deg', 360], ['locus.deg', 0]],
      },
      {
        say: 'Set the length to 2.586 cm, an eighth of a wave. The point turns 90.00° and lands at −90.00°, on the capacitive half of the chart.',
        set: { len: 0.025859556277048647 },
        reads: [['turn.deg', 90], ['locus.deg', -90]],
      },
      {
        say: 'Set the attenuation to 0.5 Np/m. The arc becomes a spiral inwards, and the magnitude falls from 0.3333 to 0.3165.',
        set: { alpha: 0.5 },
        reads: [['locus.mag', 0.316532], ['gamma.mag', 0.333333]],
      },
    ],
    why:
      'Moving away from the load, which a chart calls towards the generator, adds phase to the wave in both ' +
      'directions. The reflection coefficient a distance d back is therefore the load’s own times exp(−2jβd). The ' +
      'factor is twice β rather than β because the reflected wave covers the same distance again. One half ' +
      'wavelength is a full turn, which is why a half-wave section presents its load unchanged. That is A3’s ' +
      'second reading, drawn rather than computed. Add loss and the same expression carries exp(−2αd), so the arc ' +
      'becomes a spiral inwards and the ratio falls as the line gets longer. Reading back from a measured input ' +
      'impedance towards the load turns anticlockwise. Both directions are marked on a printed chart, and taking ' +
      'one for the other moves the point the wrong way.',
  },

  b4: {
    see:
      'The 100 Ω load is z = 2, so its admittance is y = 0.5000. On the impedance chart the point is at 0.3333, ' +
      'and on the admittance chart it is at −0.3333. The two charts are one picture turned half a turn, which is ' +
      'why the app draws them overlaid rather than side by side.',
    seeReads: [['y.re', 0.5], ['z.re', 2], ['gamma.re', 0.333333], ['circle.g.cx', -0.333333], ['circle.g.radius', 0.666667]],
    try: [
      {
        say: 'Add 0.5 of shunt susceptance. The point moves to 0.2000 − j0.4000 and stays on the same circle of constant conductance.',
        set: { b: 0.5 },
        reads: [['shunt.re', 0.2], ['shunt.im', -0.4], ['onCircle.g', 0]],
      },
      {
        say: 'Add 1 of shunt susceptance. The point reads −0.07692 − j0.6154, and it is still on that circle.',
        set: { b: 1 },
        reads: [['shunt.re', -0.0769231], ['shunt.im', -0.615385], ['onCircle.g', 0]],
      },
      {
        say: 'Set the susceptance to −0.5. The point moves to 0.2000 + j0.4000, which is the mirror of the first step.',
        set: { b: -0.5 },
        reads: [['shunt.re', 0.2], ['shunt.im', 0.4]],
      },
    ],
    why:
      'Admittance is one over impedance, and the map turns that reciprocal into a rotation. If y is 1/z then Γ ' +
      'for the admittance is minus Γ for the impedance, because (1/z − 1)/(1/z + 1) is (1 − z)/(1 + z). So the ' +
      'admittance chart is the impedance chart turned half a turn. The circle of constant conductance g is the ' +
      'circle of constant resistance for the same number, reflected through the origin, which puts its centre at ' +
      '−0.3333 for this load. That matters because a shunt element adds susceptance and leaves conductance alone, ' +
      'so its path is a constant-conductance circle. A series element adds reactance and leaves resistance alone. ' +
      'Group C builds a matching network out of both, and both paths have to be visible at once.',
  },
}
