import { defaultsOf, PLANTS, CONTROLLERS } from '../systems.js'

// Group C: the phase plane.
//
// Two states, two axes, and the whole life of the loop as one curve. The loop
// is the first-order plant with a PI controller and a saturating actuator, so
// the states are the integral of the error and the plant's output — exactly
// the pair `nonlinearAnalysis` in analysis.js hands to the phase canvas.
//
// The reference is 1 throughout, because a resting point at the origin would
// hide the very thing Group C is about: what the actuator asks for at rest,
// and what happens when it cannot deliver it.

const pp = (id, over = {}) => ({ ...defaultsOf(PLANTS[id]), ...over })
const cp = (id, over = {}) => ({ ...defaultsOf(CONTROLLERS[id]), ...over })

export const GROUP_C = 'The phase plane'

const loopAt = (delta, over = {}) => ({
  mode: 'phase',
  plantId: 'firstOrder',
  plantP: pp('firstOrder'),
  ctrlId: 'pi',
  ctrlP: cp('pi', { kp: 2, ki: 4 }),
  nlId: 'saturation',
  delta,
  reference: 1,
  duration: 30,
  points: 3001,
  view: 'phase',
  ...over,
})

export default [
  {
    id: 'C1',
    group: GROUP_C,
    name: 'Two states, one picture',
    see:
      'The PI loop with the limit far above anything it asks for — the actuator never notices it is there. ' +
      'The trajectory spirals into a single resting point at (0.25, 1), and the step view beside it shows the ' +
      'same run as a function of time instead of a curve in the plane.',
    try: [
      { say: 'Raise the limit further. The curve does not move — it was never close to it.', set: { delta: 1e6 } },
      { say: 'Bring the limit down to 2. The curve still lands on the same point, barely bent.', set: { delta: 2 } },
    ],
    why:
      'Every point on the curve is the pair (integral of error, output) at one instant, and the arrow at that ' +
      'point is the exact rate the loop moves at next. Where the arrows stop is a resting point: the integral ' +
      'holds still because the error is zero, and the output holds still because the drive exactly balances the ' +
      'plant\'s own decay. Solving both at once gives (0.25, 1) for this loop, and it is where the spiral ends.',
    terms: ['phaseplane', 'state', 'restingpoint', 'trajectory'],
    patch: loopAt(1e9),
    claim: (a) => {
      const nl = a.nonlinear
      const eq = nl.equilibria.find((e) => e.region === 0)
      return [
        { name: 'the resting point, first coordinate', value: eq.point[0], want: 0.25, tol: 1e-9 },
        { name: 'the resting point, second coordinate', value: eq.point[1], want: 1, tol: 1e-9 },
        { name: 'it is a real equilibrium of the region it sits in', value: eq.real ? 1 : 0, want: 1, tol: 0 },
        { name: 'the trajectory arrives there', value: nl.final, want: 1, tol: 1e-6 },
      ]
    },
  },

  {
    id: 'C2',
    group: GROUP_C,
    name: 'The switching lines',
    see:
      'Bring the limit down to 1.5. Two straight lines appear on the plane, where the controller\'s drive first ' +
      'reaches the actuator\'s limit. The field of arrows changes slope exactly where the trajectory crosses one, ' +
      'because the plant sees a different, smaller drive on the far side.',
    try: [
      { say: 'Lower the limit to 1.05. The lines move closer together and the curve crosses one twice.', set: { delta: 1.05 } },
      { say: 'Raise it back to 1.5.', set: { delta: 1.5 } },
    ],
    why:
      'The drive is u = 4·x₁ − 2·x₂ + 2 (the integral gain, the output gain, and the reference\'s own ' +
      'share of it), a straight line\'s worth of state for every value u can take. The two switching lines are ' +
      'where that value reaches ±δ, and every event the engine records lands on one of them, to nine decimals — ' +
      'the trajectory does not approximate the boundary, it meets it exactly.',
    terms: ['switchingline', 'saturation', 'phaseplane', 'region'],
    patch: loopAt(1.5),
    claim: (a) => {
      const nl = a.nonlinear
      const lines = nl.lines
      const upper = lines.find((l) => l.level === 1.5)
      const lower = lines.find((l) => l.level === -1.5)
      const rows = [
        { name: 'the line\'s first coefficient', value: upper.a, want: 4, tol: 1e-9 },
        { name: 'the line\'s second coefficient', value: upper.b, want: -2, tol: 1e-9 },
        { name: 'the two lines are 3 apart in their own constant', value: upper.c - lower.c, want: 3, tol: 1e-9 },
      ]
      // Every event lands on the line its own region change crosses: at the
      // event's own state, a·x1+b·x2 equals the crossed line's c, to a few
      // grid steps' worth of the bisection's own tolerance.
      let worst = 0
      for (const ev of nl.trajectory.events) {
        // Find the state nearest this event's time.
        let best = 0
        let bd = Infinity
        for (let i = 0; i < nl.trajectory.t.length; i++) {
          const d = Math.abs(nl.trajectory.t[i] - ev.t)
          if (d < bd) {
            bd = d
            best = i
          }
        }
        const z = nl.trajectory.x[best]
        const lhs = upper.a * z[0] + upper.b * z[1]
        const distUpper = Math.abs(lhs - upper.c)
        const distLower = Math.abs(lhs - lower.c)
        worst = Math.max(worst, Math.min(distUpper, distLower))
      }
      rows.push({ name: 'every event lands on a switching line', value: worst, wantBelow: 5e-3 })
      return rows
    },
  },

  {
    id: 'C3',
    group: GROUP_C,
    name: 'Windup',
    see:
      'With the limit at 1.5 the output peaks 17.4 per cent past its destination instead of 7.9, and the ' +
      'integrator winds up to 0.451 while the drive is stuck at its limit — instead of the 0.340 it would have ' +
      'reached with the limit far away.',
    try: [
      { say: 'Tighten the limit to 1.2. The wind reaches 0.642.', set: { delta: 1.2 } },
      { say: 'Tighten it to 1.05. The wind reaches 0.848.', set: { delta: 1.05 } },
    ],
    why:
      'While the drive is pinned at its limit the plant sees a constant push rather than the one the error ' +
      'actually calls for, so the integral keeps accumulating error the actuator has no way to answer yet. That ' +
      'accumulation is windup, and it is entirely a property of the trajectory in this plane: the wind is how far ' +
      'the curve travels along x₁ while it is confined to a saturated region.',
    terms: ['windup', 'integrator', 'saturation', 'overshoot'],
    patch: loopAt(1.5),
    claim: (a) => {
      const nl = a.nonlinear
      return [
        { name: 'the peak, at this limit', value: nl.peak, want: 1.1742102887765544, tol: 1e-6 },
        { name: 'the wind, at this limit', value: nl.wind, want: 0.4506933744528816, tol: 1e-6 },
      ]
    },
    sweep: {
      knob: 'delta',
      at: [1e9, 1.5, 1.2, 1.05],
      claim: (a) => [{ name: 'the wind rises as the limit tightens (checked pairwise in the test)', value: a.nonlinear.wind, tol: 0 }],
    },
  },

  {
    id: 'C4',
    group: GROUP_C,
    name: 'The rule that is false at the tight end',
    see:
      'Tighter limit, worse overshoot, is the obvious rule and it holds from 1e9 down to 1.2. At a limit of ' +
      '1.05 the peak falls back near 1.05 while the wind keeps climbing — the actuator now sets how fast the ' +
      'output can approach at all, and a slow approach has nothing left to overshoot with.',
    try: [
      { say: 'Step from 1.2 to 1.05 and watch the peak fall while the wind readout keeps rising.', set: { delta: 1.05 } },
      { say: 'Step back to 1.2. The peak jumps back up.', set: { delta: 1.2 } },
    ],
    why:
      'Overshoot needs the output to arrive fast enough to carry momentum past its destination. Once the limit ' +
      'is tight enough that the actuator is the slowest thing in the loop, the approach itself slows down, and ' +
      'there is no momentum left to overshoot with — even though the integrator, which only cares about the ' +
      'error that is still outstanding, keeps winding the whole time.',
    terms: ['overshoot', 'windup', 'saturation'],
    patch: loopAt(1.05),
    claim: (a) => {
      const nl = a.nonlinear
      return [
        { name: 'the peak at the tight limit', value: nl.peak, want: 1.0499997498505578, tol: 1e-6 },
        { name: 'the wind at the tight limit', value: nl.wind, want: 0.8477733660310743, tol: 1e-6 },
        { name: 'and the wind is larger than at 1.2, even though the peak is smaller', value: nl.wind, wantAbove: 0.6416477963995485 },
      ]
    },
  },

  {
    id: 'C5',
    group: GROUP_C,
    name: 'An actuator with nowhere to rest',
    see:
      'Holding the output at the reference needs a drive of exactly 1. Set the limit to 0.5 and no state of the ' +
      'loop is a resting point any more — the drive that would hold still is bigger than the actuator can give. ' +
      'The output stalls at 0.5 and the integrator ramps forever, reaching 10.5 at 20 s and 20.5 at 40 s.',
    try: [
      { say: 'Run it out to 40 s. The wind has doubled from its 20 s value, less the same offset.', set: { duration: 40 } },
      { say: 'Raise the limit back to 1.5. A resting point returns and the ramp stops.', set: { delta: 1.5, duration: 30 } },
    ],
    why:
      'The resting-point equation for this region has no solution inside the region the saturated drive actually ' +
      'occupies — the engine reports it as a virtual equilibrium, real only if the actuator could exceed its own ' +
      'limit. With no real resting point the output settles wherever the saturated drive alone carries it, ' +
      'K times the limit, and the integrator keeps adding the leftover error forever because nothing ever cancels ' +
      'it.',
    terms: ['equilibrium', 'saturation', 'windup', 'steadystate'],
    patch: loopAt(0.5, { duration: 20 }),
    claim: (a) => {
      const nl = a.nonlinear
      const eq = nl.equilibria.find((e) => e.region === 0)
      const k = a.state.plantP.k
      const delta = a.state.delta
      return [
        { name: 'no real equilibrium', value: eq.real ? 1 : 0, want: 0, tol: 0 },
        { name: 'the output stalls at K times the limit', value: nl.final, want: k * delta, tol: 1e-6 },
        { name: 'the wind at 20 s', value: nl.wind, want: 10.5, tol: 1e-3 },
      ]
    },
    sweep: {
      knob: 'duration',
      at: [40],
      claim: (a) => [{ name: 'the wind at 40 s', value: a.nonlinear.wind, want: 20.5, tol: 1e-3 }],
    },
  },

  {
    id: 'C6',
    group: GROUP_C,
    name: 'A Lyapunov argument',
    see:
      'For the linear region alone, a quadratic V = xᵀPx with P solving AᵀP + PA = −I gives P = ' +
      '[[1.208, −0.125], [−0.125, 0.208]], whose eigenvalues are 1.224 and 0.193 — both positive, so V is a bowl ' +
      'around the origin. Along the trajectory, V falls the whole time it is inside this region.',
    try: [
      { say: 'Raise the limit so the trajectory never leaves the linear region. V falls everywhere it is drawn.', set: { delta: 1e9 } },
      { say: 'Tighten it to 1.2. V still falls inside the shaded region and the pane stops shading outside it.', set: { delta: 1.2 } },
    ],
    why:
      'V̇ = xᵀ(AᵀP + PA)x = −xᵀx is negative everywhere but the origin, which is a Lyapunov argument for the ' +
      'linear dynamics: V never rises, so the state can only approach the origin or hold there. It is an ' +
      'argument about the LINEAR region only. Outside the switching lines the dynamics are the saturated ones, ' +
      'and V̇ there is measured rather than assumed — the pane shades where the guarantee holds and stops ' +
      'exactly at the lines.',
    terms: ['lyapunov', 'stability', 'quadraticform', 'switchingline'],
    patch: loopAt(1e9),
    claim: (a) => {
      const nl = a.nonlinear
      const P = nl.lyapunov.P
      const eig = nl.lyapunov.eigenvalues.map((e) => e[0]).sort((x, y) => y - x)
      const rows = [
        { name: 'P, first entry', value: P[0][0], want: 1.2083333333333335, tol: 1e-9 },
        { name: 'P, off-diagonal', value: P[0][1], want: -0.125, tol: 1e-9 },
        { name: 'P, last entry', value: P[1][1], want: 0.20833333333333334, tol: 1e-9 },
        { name: 'the larger eigenvalue', value: eig[0], want: 1.223721536535541, tol: 1e-6 },
        { name: 'the smaller eigenvalue', value: eig[1], want: 0.19294513013112577, tol: 1e-6 },
      ]
      // V-dot is exactly -x^T x inside the linear region, at every sampled point.
      const insideOnly = nl.lyapunov.along.filter((pt) => pt.region === 0)
      rows.push({ name: 'at least one sampled point lies in the linear region', value: insideOnly.length, wantAbove: 0 })
      rows.push({
        name: 'V-dot is never positive inside the linear region',
        value: Math.max(...insideOnly.map((pt) => pt.Vdot)),
        wantBelow: 1e-9,
      })
      return rows
    },
  },
]
