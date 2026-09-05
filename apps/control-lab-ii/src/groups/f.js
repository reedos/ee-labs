import { defaultsOf, PLANTS } from '../systems.js'

// Group F: the Kalman filter, deterministic half.
//
// The observer of Group A chose its gain by placing poles. This one chooses it
// from how much the model and the measurement are each worth. Decision 4 of
// the plan splits the group: the steady-state gain is the dual of the LQR and
// needs no new package, so it ships now. The covariance recursion and the
// ensemble need a noise model with a variance, which is the Random Signals
// Lab's, and they wait in `BACKLOG.md`.
//
// No text in this file names that lab, per the plan's Decision 4, because a
// lesson pointing at something a reader cannot open is worse than a lesson
// that stops.

const pp = (id, over = {}) => ({ ...defaultsOf(PLANTS[id]), ...over })

export const GROUP_F = 'The Kalman filter'

const filterOf = (over = {}) => ({
  mode: 'filter',
  plantId: 'motor',
  plantP: pp('motor'),
  ctrlId: 'p',
  ctrlP: { kp: 1 },
  view: 'state',
  design: { qw: 1, rv: 1 },
  ...over,
})

export default [
  {
    id: 'F1',
    group: GROUP_F,
    name: 'The observer that weighs its measurement',
    see:
      'The same motor and the same observer structure as A6, with the gain from a Riccati equation instead ' +
      'of a chosen pole pair. Two weights go in, the trust in the model and the trust in the measurement, ' +
      'and L = [1.0777, 0.0807] comes out. The error poles land at −1.176 and −1.902.',
    try: [
      { say: 'Multiply both weights by ten. L does not move, because only the ratio counts.', set: { qw: 10, rv: 10 } },
      { say: 'Raise the model weight to 100. L rises to [10.20, 1.970] and the estimate chases harder.', set: { qw: 100, rv: 1 } },
      { say: 'Raise the measurement weight instead. L falls and the estimate trusts its model.', set: { qw: 1, rv: 100 } },
    ],
    why:
      'An observer decides, at every instant, what to make of the difference between what it measured and ' +
      'what it expected. Some of that difference is the model being wrong and some is the sensor. A6 made ' +
      'that decision by choosing where the error poles should go. That is a designer’s judgement dressed as ' +
      'a specification. This makes it by pricing the two, and the price is the only input. Scale both prices ' +
      'together and nothing changes, because the answer depends on the ratio alone. A noisier sensor buys a ' +
      'slower, calmer estimate, and a worse model buys a faster, twitchier one.',
    terms: ['kalman', 'observer', 'riccati', 'statespace', 'duality'],
    patch: filterOf(),
    claim: (a) => {
      const f = a.filter
      return [
        { name: 'the first gain', value: f.L[0], want: 1.077684, tol: 1e-6 },
        { name: 'the second gain', value: f.L[1], want: 0.080701, tol: 1e-6 },
        // Two routes to the same eigenvalues. The dual's own closed loop, and
        // A - LC built from the gain and factored separately.
        { name: 'the error poles agree by both routes', value: Math.max(...f.obsPoles.map((p, i) => Math.abs(p[0] - f.poles[i][0]))), wantBelow: 1e-9 },
        { name: 'and both are strictly stable', value: Math.max(...f.obsPoles.map(([re]) => re)), wantBelow: 0 },
        { name: 'the slower error pole', value: Math.max(...f.obsPoles.map(([re]) => re)), want: -1.175571, tol: 1e-6 },
        { name: 'the Riccati residual is at the floor', value: f.relResidual, wantBelow: 1e-12 },
      ]
    },
    sweep: {
      knob: 'design',
      at: [{ qw: 10, rv: 10 }, { qw: 0.01, rv: 0.01 }],
      claim: (a) => [
        // The law: only the ratio counts. Scaling both weights leaves the gain
        // exactly where it was, which is a claim about the equation rather
        // than about these two numbers.
        { name: 'scaling both weights leaves the first gain alone', value: a.filter.L[0], want: 1.077684, tol: 1e-6 },
        { name: 'and the second', value: a.filter.L[1], want: 0.080701, tol: 1e-6 },
        { name: 'and the ratio is unchanged', value: a.filter.ratio, want: 1, tol: 1e-12 },
      ],
    },
  },

  {
    id: 'F2',
    group: GROUP_F,
    name: 'The filter is the regulator, backwards',
    see:
      'The gain came out of the regulator’s equation, solved on the transposed system. The pane checks that ' +
      'the P it produced also solves the filter’s own equation, A·P + P·Aᵀ − P·Cᵀ·R⁻¹·C·P + Q = 0. That is a ' +
      'different equation with different matrices in it, and the residual is 2e-16.',
    try: [
      { say: 'Raise the model weight to 25. Both equations still hold to the same floor.', set: { qw: 25, rv: 1 } },
      { say: 'Raise the measurement weight to 25 instead. Still the same floor.', set: { qw: 1, rv: 25 } },
    ],
    why:
      'Reaching a state and seeing one are the same problem written twice. Controllability of (A, B) is ' +
      'observability of (Aᵀ, Cᵀ), and the two Riccati equations map onto each other under the same swap. So ' +
      'one routine serves both, which is why this suite has an LQR and no separate filter solver. The check ' +
      'worth making is not that L equals K, since L was assigned from K. It is that the P behind them ' +
      'satisfies the other equation as well, and that is measured here rather than asserted.',
    terms: ['duality', 'kalman', 'riccati', 'lqr', 'observability', 'controllability', 'residual'],
    patch: filterOf(),
    claim: (a) => {
      const f = a.filter
      return [
        // The measurement. P solved the regulator's equation on the transposed
        // system; this asks whether it also solves the filter's.
        { name: "P solves the filter's own Riccati equation", value: f.filterResidual.relative, wantBelow: 1e-12 },
        { name: 'and the regulator\'s, on the transposed system', value: f.relResidual, wantBelow: 1e-12 },
        { name: 'P is symmetric, as a covariance must be', value: Math.abs(f.P[0][1] - f.P[1][0]), wantBelow: 1e-14 },
        { name: 'and positive on its diagonal', value: Math.min(f.P[0][0], f.P[1][1]), wantAbove: 0 },
        // The dual system is the transpose, entry by entry.
        { name: 'the dual system is the transpose', value: Math.abs(f.dual.A[0][1] - f.ss.A[1][0]) + Math.abs(f.dual.A[1][0] - f.ss.A[0][1]), wantBelow: 1e-15 },
        { name: 'its drive is the measurement row', value: Math.abs(f.dual.B[0] - f.ss.C[0]) + Math.abs(f.dual.B[1] - f.ss.C[1]), wantBelow: 1e-15 },
      ]
    },
    sweep: {
      knob: 'design',
      at: [{ qw: 25, rv: 1 }, { qw: 1, rv: 25 }, { qw: 100, rv: 100 }],
      claim: (a) => [
        { name: 'both equations hold at every weighting', value: Math.max(a.filter.filterResidual.relative, a.filter.relResidual), wantBelow: 1e-12 },
      ],
    },
  },
]
