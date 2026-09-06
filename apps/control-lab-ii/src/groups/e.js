import { defaultsOf, PLANTS } from '../systems.js'

// Group E: identification.
//
// The plant nobody wrote down. A step goes in, a trace comes out, and a model
// is fitted to it. The residual is the whole of the honesty in this group, and
// it is on screen in every one of these five, because a fitted model without
// its residual is a claim with nothing behind it.
//
// The noise is seeded, so the residual a reader sees is the residual a test
// pinned. A fit whose number changed between two loads would be a number
// nobody could quote.

const pp = (id, over = {}) => ({ ...defaultsOf(PLANTS[id]), ...over })

export const GROUP_E = 'Identification'

const fitOf = (plantId, plantP, over = {}) => ({
  mode: 'fit',
  plantId,
  plantP,
  ctrlId: 'p',
  ctrlP: { kp: 1 },
  duration: 6,
  points: 400,
  noise: 0,
  seed: 1234,
  view: 'fit',
  ...over,
})

export default [
  {
    id: 'E1',
    group: GROUP_E,
    name: 'Fitting a first-order model',
    see:
      'A lag with a gain of 2.5 and a time constant of 0.8 s, measured with no noise on it. The fit returns ' +
      'both to eight figures and leaves a relative residual of 3e-14. The model is drawn over the data and ' +
      'the difference between them is drawn below, at its own scale.',
    try: [
      { say: 'Set the gain to 4. The fit follows it and the residual does not move.', set: { k: 4 } },
      { say: 'Set the time constant to 0.3 s. The fit follows that too.', set: { tau: 0.3 } },
    ],
    why:
      'The fit runs in two stages. The first is a linear least squares on the integrated equation, which ' +
      'works on a noisy trace because integrating twice removes the derivatives of the data rather than ' +
      'estimating them. The second is a direct search on the response itself, so the number printed is the ' +
      'smallest residual that model shape can reach on that data. On clean data from a first-order plant ' +
      'that shape can reach the data exactly, and the residual falls to the arithmetic’s own floor.',
    terms: ['identification', 'fit', 'residual', 'order'],
    patch: fitOf('firstOrder', pp('firstOrder', { k: 2.5, tau: 0.8 })),
    claim: (a) => {
      const f = a.fit.first
      return [
        { name: 'the gain', value: f.K, want: a.state.plantP.k, tol: 1e-8 },
        { name: 'the time constant', value: f.tau, want: a.state.plantP.tau, tol: 1e-8 },
        { name: 'the residual is at the floating-point floor', value: f.relResidual, wantBelow: 1e-12 },
        { name: 'and the model has a point for every sample', value: f.model.length, want: a.state.points, tol: 0 },
      ]
    },
    sweep: {
      knob: 'tau',
      at: [0.3, 1.4, 3],
      claim: (a) => [
        { name: 'the fit follows the time constant', value: a.fit.first.tau, want: a.state.plantP.tau, tol: 1e-6 },
        { name: 'and stays at the floor', value: a.fit.first.relResidual, wantBelow: 1e-8 },
      ],
    },
  },

  {
    id: 'E2',
    group: GROUP_E,
    name: 'What a wrong order looks like',
    see:
      'A resonant plant at ωₙ = 3 rad/s and ζ = 0.35, which overshoots its own step. The second-order fit ' +
      'returns all three parameters exactly. The first-order fit returns 0.3615 s and leaves 13.4 per cent of ' +
      'the gain behind, because a first-order model has no way to overshoot.',
    try: [
      { say: 'Raise ζ to 1. The overshoot goes and the first-order residual falls to 3.6 per cent.', set: { zeta: 1 } },
      { say: 'Lower ζ to 0.2. The ringing grows and so does the residual.', set: { zeta: 0.2 } },
    ],
    why:
      'A model shape decides what the model can say. One pole gives a monotone rise and nothing else, so ' +
      'fitting it to a ringing step is asking for the best straight answer to a curved question. The fit ' +
      'splits the difference and the residual reports how much difference there was. Two poles can ring, and ' +
      'on this data the second-order residual is eight orders smaller. That ratio is what says the data ' +
      'wanted two poles rather than one, and it is a stronger statement than either residual alone.',
    terms: ['fit', 'residual', 'order', 'overshoot', 'zeta', 'wn'],
    patch: fitOf('resonant', pp('resonant', { k: 1, wn: 3, zeta: 0.35 }), { duration: 5 }),
    claim: (a) => {
      const p = a.state.plantP
      return [
        { name: 'the second order recovers the natural frequency', value: a.fit.second.wn, want: p.wn, tol: 1e-6 },
        { name: 'and the damping', value: a.fit.second.zeta, want: p.zeta, tol: 1e-6 },
        { name: 'and the gain', value: a.fit.second.K, want: p.k, tol: 1e-6 },
        { name: 'the first order settles on 0.3615 s', value: a.fit.first.tau, want: 0.3615, tol: 1e-3 },
        { name: 'and leaves 13.4 per cent of the gain', value: a.fit.first.relResidual, want: 0.1337, tol: 1e-3 },
        { name: 'the second order leaves eight orders less', value: a.fit.second.relResidual / a.fit.first.relResidual, wantBelow: 1e-7 },
      ]
    },
  },

  {
    id: 'E3',
    group: GROUP_E,
    name: 'Which order the data supports',
    see:
      'The same lag as E1, with noise added at 1, 2 and 5 per cent of the gain. The residual lands on the ' +
      'noise every time, at 1.03, 2.05 and 5.13 per cent. Adding a second pole takes almost nothing off it, ' +
      'because there is nothing left for the extra pole to explain.',
    try: [
      { say: 'Raise the noise to 2 per cent. The residual follows it to 2.05.', set: { noise: 0.02 } },
      { say: 'Raise it to 5 per cent. The residual follows to 5.13.', set: { noise: 0.05 } },
    ],
    why:
      'A fit that has taken out everything its shape can explain is left with what no model can explain, ' +
      'which here is the noise. So a residual landing on the noise level is what a good fit looks like, and a ' +
      'residual well below it means the model has started fitting the noise rather than the plant. The second ' +
      'pole is the test of that. On genuinely second-order data it buys eight orders, as E2 shows. Here it ' +
      'buys a thousandth, which is the data saying it has no second pole to give.',
    terms: ['residual', 'noise', 'order', 'fit'],
    patch: fitOf('firstOrder', pp('firstOrder', { k: 2.5, tau: 0.8 }), { noise: 0.01 }),
    claim: (a) => [
      // The residual is the noise. Not near it, ON it, to within a few per
      // cent of itself, which is what makes it a reading rather than a hint.
      { name: 'the residual lands on the noise', value: a.fit.first.relResidual / a.state.noise, want: 1, tol: 0.06, relative: false },
      { name: 'and it is 1.03 per cent at one per cent of noise', value: a.fit.first.relResidual, want: 0.01025, tol: 1e-4 },
      { name: 'the second pole buys nothing', value: a.fit.improvement, wantAbove: 0.999 },
      { name: 'the fitted time constant is still close', value: a.fit.first.tau, want: a.state.plantP.tau, tol: 0.02 },
    ],
    sweep: {
      knob: 'noise',
      at: [0.02, 0.05],
      claim: (a) => [
        { name: 'the residual is the noise at every level', value: a.fit.first.relResidual / a.state.noise, want: 1, tol: 0.06, relative: false },
        { name: 'and the second pole still buys nothing', value: a.fit.improvement, wantAbove: 0.999 },
      ],
    },
  },

  {
    id: 'E4',
    group: GROUP_E,
    name: 'How much to trust the number',
    see:
      'Forty runs of the same measurement, each with its own noise. At 2 per cent the fitted time constant ' +
      'averages 0.7987 s against a true 0.8, with a spread of 0.0054 s. Halve the noise and the spread ' +
      'halves with it.',
    try: [
      { say: 'Halve the noise to 1 per cent. The spread halves to 0.0027 s.', set: { noise: 0.01 } },
      { say: 'Double it to 4 per cent. The spread doubles to 0.0109 s.', set: { noise: 0.04 } },
    ],
    why:
      'One fit gives a number. Forty give the number and how much to trust it. That is the more useful ' +
      'answer, and it is the one a residual on its own cannot supply. The average sits within two parts in a ' +
      'thousand of the truth, so the estimate is not biased. The spread is proportional to the noise, so a ' +
      'measurement twice as clean is an estimate twice as sharp. Quoting a fitted time constant to six ' +
      'figures when the spread is in the third is the error this experiment exists to prevent.',
    terms: ['fit', 'noise', 'residual', 'identification'],
    patch: fitOf('firstOrder', pp('firstOrder', { k: 2.5, tau: 0.8 }), { noise: 0.02, seeds: 40 }),
    claim: (a) => {
      const e = a.fit.ensemble
      const tau = a.state.plantP.tau
      return [
        { name: 'forty runs', value: e.n, want: 40, tol: 0 },
        { name: 'the mean is 0.7987 s', value: e.mean, want: 0.79873, tol: 1e-4 },
        { name: 'which is within two parts in a thousand of the truth', value: Math.abs(e.mean - tau) / tau, wantBelow: 2e-3 },
        { name: 'the spread is 0.0054 s', value: e.spread, want: 0.005447, tol: 1e-5 },
        // The spread is the thing the residual cannot tell you, so its size
        // relative to the quoted value is the claim worth making.
        { name: 'and it is about seven parts in a thousand of the estimate', value: e.spread / e.mean, want: 0.00682, tol: 1e-4 },
      ]
    },
    sweep: {
      knob: 'noise',
      at: [0.01, 0.02, 0.04],
      claim: (a) => [
        {
          name: 'the spread is proportional to the noise',
          value: a.fit.ensemble.spread / a.state.noise,
          want: 0.2723,
          tol: 2e-3,
        },
        { name: 'and the estimate stays unbiased', value: Math.abs(a.fit.ensemble.mean - a.state.plantP.tau), wantBelow: 0.004 },
      ],
    },
  },

  {
    id: 'E5',
    group: GROUP_E,
    name: 'Identify, then control',
    see:
      'Two lags at 0.7 s and 0.13 s. The second-order fit recovers both poles exactly, at −1.4286 and ' +
      '−7.6923. The first-order fit gives 0.875 s with a residual of 2.37 per cent, which looks small. Design ' +
      'a PI on each for a crossing at 8 rad/s, and the two designs do not behave alike.',
    try: [
      { say: 'Move the crossing to 4 rad/s. Both designs improve and the gap narrows.', set: { crossover: 4 } },
      { say: 'Move it to 12 rad/s. The gap widens and the first design rings harder.', set: { crossover: 12 } },
    ],
    why:
      'The design from the first-order fit cancels a pole the plant does not have. On its own model it ' +
      'predicts a bare integrator, 90 degrees of margin and no overshoot. Run it on the real plant and the ' +
      'second pole it never knew about spends 41 degrees of that margin. It puts 17.7 per cent of overshoot ' +
      'on the step as well. The design from the second-order fit predicts 43.9 degrees and 24.5 per cent, ' +
      'and gets them, because its model is the plant. A residual of 2.37 per cent looked small on the trace ' +
      'and was not small in the design.',
    terms: ['identification', 'fit', 'residual', 'order', 'phasemargin', 'overshoot', 'crossover'],
    patch: fitOf('twoLag', pp('twoLag', { k: 1, t1: 0.7, t2: 0.13 }), {
      duration: 5,
      design: { crossover: 8 },
    }),
    claim: (a) => {
      const d = a.fit.design
      const { t1, t2 } = a.state.plantP
      const poles = a.fit.second.poles.map(([re]) => re).sort((x, y) => y - x)
      return [
        // The second-order fit recovers the plant's own poles, computed here
        // from the time constants rather than quoted.
        { name: 'the slow pole', value: poles[0], want: -1 / t1, tol: 1e-6 },
        { name: 'the fast pole', value: poles[1], want: -1 / t2, tol: 1e-6 },
        { name: 'the first-order fit gives 0.875 s', value: a.fit.first.tau, want: 0.8751, tol: 1e-3 },
        { name: 'with a residual of 2.37 per cent', value: a.fit.first.relResidual, want: 0.02368, tol: 1e-4 },
        // The first design, predicted and measured. A pole-cancelling PI on a
        // one-pole model leaves a bare integrator, whose margin is exactly 90.
        { name: 'the first design predicts a bare integrator', value: d.first.predicted.phaseMargin, want: 90, tol: 1e-6 },
        { name: 'and predicts no overshoot', value: d.first.predicted.overshoot, want: 0, tol: 1e-4, relative: false },
        { name: 'on the plant it gets 49.3 degrees', value: d.first.measured.phaseMargin, want: 49.27, tol: 1e-2 },
        { name: 'and 17.7 per cent of overshoot', value: d.first.measured.overshoot, want: 0.1769, tol: 1e-3 },
        // The second design, where prediction and measurement are the same
        // picture because the model is the plant.
        { name: 'the second design predicts 43.9 degrees', value: d.second.predicted.phaseMargin, want: 43.877, tol: 1e-2 },
        // To six figures rather than to the bit. The fitted model reproduces
        // the plant to about 1e-9, so the two designs are the same design to
        // that accuracy and no further, which is worth saying rather than
        // hiding behind a loose tolerance.
        { name: 'and gets the same, to six figures', value: d.second.measured.phaseMargin, want: d.second.predicted.phaseMargin, tol: 1e-6 },
        { name: 'with the overshoot it predicted', value: d.second.measured.overshoot, want: d.second.predicted.overshoot, tol: 1e-6 },
        { name: 'and the crossing it asked for', value: d.second.measured.crossover, want: a.state.design.crossover, tol: 1e-4 },
      ]
    },
    sweep: {
      knob: 'design',
      at: [{ crossover: 4 }, { crossover: 12 }],
      claim: (a) => [
        {
          name: 'the second design always lands where it aimed',
          value: a.fit.design.second.measured.crossover,
          want: a.state.design.crossover,
          tol: 1e-4,
        },
        {
          name: 'and the first always loses margin it did not expect to lose',
          value: a.fit.design.first.predicted.phaseMargin - a.fit.design.first.measured.phaseMargin,
          wantAbove: 0,
        },
      ],
    },
  },
]
