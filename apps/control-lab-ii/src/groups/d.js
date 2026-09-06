import { defaultsOf, PLANTS, CONTROLLERS } from '../systems.js'

// Group D: the describing function.
//
// A saturation is not a rational function of s and never becomes one. What the
// describing function does is replace it by the gain it would have for a pure
// sine of a given amplitude. That is an approximation, and this group is built
// so a reader sees exactly how far it gets and exactly how far it is off.
//
// Every experiment here shows four numbers together: the predicted amplitude,
// the amplitude the exact region-by-region walk measures, the difference, and
// the harmonic ratio that predicts that difference. The lab's extra rule is
// that none of those may appear without the others.
//
// The plant is the three lags, whose four states put it past what a phase
// plane can draw, so the views here are the Bode plot and the response in
// time. `phaseField` declines a loop with more than two states by name rather
// than guessing a projection, which is the risk the plan names.

const pp = (id, over = {}) => ({ ...defaultsOf(PLANTS[id]), ...over })
const cp = (id, over = {}) => ({ ...defaultsOf(CONTROLLERS[id]), ...over })

export const GROUP_D = 'The describing function'

// The three lags with a saturating actuator, started just off the origin so
// the oscillation has something to grow from. Three states, because a
// proportional controller carries none of its own.
const sat = (kp, over = {}) => ({
  mode: 'describing',
  plantId: 'threePole',
  plantP: pp('threePole'),
  ctrlId: 'p',
  ctrlP: cp('p', { kp }),
  nlId: 'saturation',
  delta: 1,
  reference: 0,
  duration: 60,
  points: 4001,
  x0: [0.01, 0, 0],
  view: 'bode',
  ...over,
})

export default [
  {
    id: 'D1',
    group: GROUP_D,
    name: 'The gain depends on the amplitude',
    see:
      'N(A) against amplitude, with the third harmonic drawn under it. Below the limit the saturation is a ' +
      'wire and N is 1. Above it N falls, reaching 0.609 at twice the limit and 0.0636 at twenty times. The ' +
      'harmonic climbs the other way, from 6.5 per cent to 33.2 per cent.',
    try: [
      { say: 'Raise the limit to 2. The curve is the same curve, read against A over δ.', set: { delta: 2 } },
      { say: 'Lower it to 0.5. Still the same curve, and the loop below reaches it sooner.', set: { delta: 0.5 } },
    ],
    why:
      'Drive a saturation with A sin(ωt) and the output is a clipped sine. Take its Fourier series and keep ' +
      'the fundamental. The ratio of that fundamental to A is N(A), and for a saturation it is ' +
      '(2/π)(arcsin r + r√(1 − r²)) with r = δ/A. Everything thrown away is in the odd harmonics, and the ' +
      'third is the largest of them. So N is not the whole answer, and the size of what was discarded is the ' +
      'size of the error. That is the number D4 turns into a guard.',
    terms: ['saturation', 'describingfunction', 'harmonic', 'harmonicratio'],
    patch: sat(20),
    claim: (a) => {
      const curve = a.nonlinear.describingCurve
      const at = (r) => curve.reduce((best, row) => (Math.abs(row.ratio - r) < Math.abs(best.ratio - r) ? row : best))
      const delta = a.state.delta
      // The closed form, written out here so the claim measures the engine
      // against the algebra rather than against itself.
      const closed = (r) => {
        const x = 1 / r
        return (2 / Math.PI) * (Math.asin(x) + x * Math.sqrt(1 - x * x))
      }
      const rows = []
      for (const r of [1.2, 2, 5, 20]) {
        const row = at(r)
        rows.push({ name: `N at ${r} times the limit`, value: row.N, want: closed(row.ratio), tol: 1e-9 })
        rows.push({ name: `the amplitude there is ${r} limits`, value: row.amplitude, want: r * delta, tol: 1e-6 })
      }
      rows.push({ name: 'the harmonic at 1.2 limits', value: at(1.2).harmonic, want: 0.0649, tol: 1e-3 })
      rows.push({ name: 'and at 20 limits', value: at(20).harmonic, want: 0.332, tol: 1e-3 })
      rows.push({ name: 'the harmonic rises with the amplitude', value: at(20).harmonic - at(1.2).harmonic, wantAbove: 0.2 })
      rows.push({ name: 'and N falls with it', value: at(1.2).N - at(20).N, wantAbove: 0.8 })
      return rows
    },
  },

  {
    id: 'D2',
    group: GROUP_D,
    name: 'The limit cycle it predicts',
    see:
      'Three lags with a saturating actuator, at Kp = 20. The open loop reaches −180° at √14 = 3.7417 rad/s, ' +
      'where its gain is 11.25 times what it needs to be. The condition N(A)·|L| = 1 gives N = 0.5625, and ' +
      'inverting N gives an amplitude of 2.1816.',
    try: [
      { say: 'Set Kp to 15. The needed N rises to 0.75 and the amplitude falls to 1.576.', set: { kp: 15 } },
      { say: 'Set Kp to 40. N falls to 0.28125 and the amplitude reaches 4.489.', set: { kp: 40 } },
    ],
    why:
      'A linear loop at this gain would grow without bound. This one does not, because the actuator saturates ' +
      'and its effective gain falls as the swing grows. The oscillation settles where the fall is exactly ' +
      'enough to hold the loop on the edge, which is where N(A)·L(jω) = −1. Both sides are real at the ' +
      'frequency where the loop reaches −180°, which leaves one equation and one unknown. The frequency ' +
      'comes from the plant alone and does not depend on the gain, which is why every setting below predicts ' +
      'the same 3.7417 rad/s.',
    terms: ['limitcycle', 'describingfunction', 'saturation', 'gainmargin', 'crossover', 'harmonic'],
    patch: sat(20),
    claim: (a) => {
      const n = a.nonlinear
      const { t1, t2, t3 } = a.state.plantP
      const kp = a.state.ctrlP.kp
      // The frequency where three lags reach -180 degrees, from the algebra.
      const wantOmega = Math.sqrt((t1 + t2 + t3) / (t1 * t2 * t3))
      // And the gain there, which is the plant's own. `crossings` reports the
      // gain of the whole open loop, Kp included, so dividing it back out is
      // what leaves the number the plan quotes.
      const crossingGain = kp / n.predicted.crossings[0].gain
      return [
        { name: 'the crossing frequency', value: n.predicted.omega, want: wantOmega, tol: 1e-6 },
        { name: 'which is the square root of fourteen', value: n.predicted.omega, want: Math.sqrt(14), tol: 1e-9 },
        { name: 'the gain there', value: crossingGain, want: 11.25, tol: 1e-6 },
        { name: 'the describing function it needs', value: n.predicted.N, want: crossingGain / kp, tol: 1e-9 },
        { name: 'and the amplitude that gives it', value: n.predicted.amplitude, want: 2.1816, tol: 1e-3 },
      ]
    },
    sweep: {
      knob: 'kp',
      at: [15, 25, 30, 40],
      claim: (a) => [
        {
          name: 'the needed N is one over the open loop\'s gain at the crossing',
          value: a.nonlinear.predicted.N,
          want: 1 / a.nonlinear.predicted.crossings[0].gain,
          tol: 1e-9,
        },
        {
          name: 'and the frequency does not move, because the plant sets it',
          value: a.nonlinear.predicted.omega,
          want: Math.sqrt(14),
          tol: 1e-9,
        },
      ],
    },
  },

  {
    id: 'D3',
    group: GROUP_D,
    name: 'What the exact simulation says',
    see:
      'The same loop, walked region by region with no describing function anywhere in it. The oscillation ' +
      'settles at 2.2107, at 3.7116 rad/s. The prediction was 2.1816 at 3.7417, so it is 1.32 per cent low in ' +
      'amplitude and 0.81 per cent high in frequency. All four numbers are on screen at once.',
    try: [
      { say: 'Set Kp to 15. The gap narrows to 0.65 per cent.', set: { kp: 15 } },
      { say: 'Set Kp to 40. It widens to 2.26 per cent.', set: { kp: 40 } },
    ],
    why:
      'Inside each of the saturation’s three segments the loop is linear, so the trajectory has a closed form ' +
      'and the only thing left to find is when the state leaves. There is no step size in this calculation ' +
      'and no error that shrinks when the pane asks for more points. That is what makes it a fair judge of ' +
      'the prediction. The prediction is low every time rather than sometimes high and sometimes low, which ' +
      'is a clue that the error has a cause rather than being noise. D4 is where that cause is found.',
    terms: ['limitcycle', 'describingfunction', 'region', 'trajectory', 'saturation'],
    patch: sat(20),
    claim: (a) => {
      const n = a.nonlinear
      return [
        { name: 'the measured amplitude', value: n.measured.amplitude, want: 2.2107, tol: 1e-3 },
        { name: 'the measured frequency', value: n.measured.omega, want: 3.7116, tol: 1e-3 },
        { name: 'the cycle has settled', value: n.measured.settled, wantBelow: 0.01 },
        { name: 'the prediction is low by about one and a third per cent', value: 100 * n.error.amplitude, want: -1.318, tol: 5e-3 },
        { name: 'and high in frequency by about eight tenths', value: 100 * n.error.frequency, want: 0.811, tol: 5e-3 },
        { name: 'the prediction is low rather than high', value: n.error.amplitude, wantBelow: 0 },
      ]
    },
    sweep: {
      knob: 'kp',
      at: [15, 25, 30, 40],
      claim: (a) => [
        { name: 'the prediction is low at every gain', value: a.nonlinear.error.amplitude, wantBelow: 0 },
        { name: 'and the gap widens as the gain rises', value: Math.abs(a.nonlinear.error.amplitude), monotone: 'up' },
      ],
    },
  },

  {
    id: 'D4',
    group: GROUP_D,
    name: 'The filter hypothesis, with its threshold',
    see:
      'The discrepancy is not an accident. At Kp = 20 the third harmonic arrives back at the actuator at 1.43 ' +
      'per cent of the fundamental, and the amplitude is 1.32 per cent wrong. Raise the gain and both numbers ' +
      'rise together, never more than a factor of 1.5 apart.',
    try: [
      { say: 'Set Kp to 13. Both fall, and the error is 0.46 of the ratio.', set: { kp: 13 } },
      { say: 'Set Kp to 40. Both rise together, to 1.83 and 2.26 per cent.', set: { kp: 40 } },
    ],
    why:
      'The approximation is not in the formula for N, which is exact. It is in the hypothesis that the linear ' +
      'part attenuates the harmonics the saturation creates, so only the fundamental returns to it. Three lags ' +
      'attenuate the third harmonic by roughly a factor of 27, which is why the hypothesis nearly holds here. ' +
      'What is left over is the error. So the harmonic ratio predicts the error it is guarding against, and a ' +
      'threshold of five per cent means an amplitude right to within about five per cent. That is a guard ' +
      'chosen from a measurement rather than from a convention. The relation is a size and not an identity. ' +
      'At this limit the error runs from 0.46 of the ratio at the lowest gain to 1.32 at the highest.',
    terms: ['filterhypothesis', 'harmonicratio', 'guard', 'describingfunction', 'harmonic', 'saturation'],
    patch: sat(20),
    claim: (a) => {
      const n = a.nonlinear
      return [
        { name: 'the harmonic ratio', value: n.predicted.harmonicRatio, want: 0.01427, tol: 1e-4 },
        { name: 'the threshold it is judged against', value: n.predicted.threshold, want: 0.05, tol: 0 },
        { name: 'the hypothesis holds on this loop', value: n.predicted.holds ? 1 : 0, want: 1, tol: 0 },
        // The invariant, at this one setting. The sweep below runs it across
        // the group, which is where it stops being a coincidence.
        {
          name: 'the error is the harmonic ratio, within a factor of 1.5',
          value: Math.abs(n.error.amplitude) / n.predicted.harmonicRatio,
          want: 1,
          tol: 0.5,
          relative: false,
        },
      ]
    },
    sweep: {
      knob: 'kp',
      at: [13, 18, 25, 30, 40, 50, 60],
      claim: (a) => {
        const n = a.nonlinear
        const ratio = Math.abs(n.error.amplitude) / n.predicted.harmonicRatio
        return [
          // What holds at this limit across the whole gain range. The tighter
          // 0.7 band is pinned above at the gain the note quotes, and by the
          // engine's own fuzz over gains and limits together.
          { name: 'the error never exceeds 1.5 times the harmonic ratio', value: ratio, wantBelow: 1.5 },
          { name: 'and is never less than 0.4 of it', value: ratio, wantAbove: 0.4 },
          { name: 'the two rise together', value: ratio, monotone: 'up' },
          { name: 'the guard holds the whole way, on three lags', value: n.predicted.holds ? 1 : 0, want: 1, tol: 0 },
        ]
      },
    },
  },

  {
    id: 'D5',
    group: GROUP_D,
    name: 'Where the prediction is not usable',
    see:
      'The same three lags with a lightly damped resonance added at three times the crossing frequency, which ' +
      'is exactly where the third harmonic lands. The harmonic now returns at 67.6 per cent of the ' +
      'fundamental, far past the five per cent threshold. The pane shows the reason in place of an amplitude.',
    try: [
      { say: 'Raise the resonance damping to 0.5. The peak flattens and the guard holds again.', set: { zeta: 0.5 } },
      { say: 'Set it back to 0.01. The guard fails and names its threshold.', set: { zeta: 0.01 } },
    ],
    why:
      'The describing function keeps the fundamental and assumes everything else is filtered away before it ' +
      'gets back to the nonlinearity. A resonance sitting on the third harmonic does the opposite. It ' +
      'amplifies exactly the component the method discarded, so what returns to the actuator is not the sine ' +
      'the derivation assumed. There is no correction to apply here. The honest answer is that this method ' +
      'does not describe this loop, which is what the pane says, with the threshold and the measured ratio ' +
      'beside it.',
    terms: ['filterhypothesis', 'harmonicratio', 'guard', 'describingfunction', 'harmonic'],
    patch: sat(30, {
      plantId: 'threePoleResonant',
      plantP: pp('threePoleResonant'),
      x0: [0, 0, 0, 0, 0],
      duration: 40,
      points: 4001,
    }),
    claim: (a) => {
      const n = a.nonlinear
      return [
        { name: 'the harmonic ratio', value: n.predicted.harmonicRatio, want: 0.676, tol: 2e-3 },
        { name: 'it is past the threshold', value: n.predicted.harmonicRatio, wantAbove: n.predicted.threshold },
        { name: 'the guard fails', value: n.predicted.holds ? 1 : 0, want: 0, tol: 0 },
        // The reason is content. It names the number, the threshold and what
        // went wrong, and it is the engine's own words rather than the app's.
        { name: 'the reason names the measured ratio', value: /67\.6 per cent/.test(n.predicted.reason) ? 1 : 0, want: 1, tol: 0 },
        { name: 'and names the threshold', value: /5 per cent/.test(n.predicted.reason) ? 1 : 0, want: 1, tol: 0 },
        { name: 'and says the returning signal is not a sine', value: /not the sine/.test(n.predicted.reason) ? 1 : 0, want: 1, tol: 0 },
        // The plane is declined for this loop rather than projected, which is
        // the other refusal this experiment exercises.
        { name: 'the loop has more states than a plane has axes', value: n.n, wantAbove: 2 },
        { name: 'so no field is drawn', value: n.field === null ? 1 : 0, want: 1, tol: 0 },
      ]
    },
    sweep: {
      knob: 'zeta',
      at: [0.5],
      claim: (a) => [
        { name: 'damping the resonance brings the guard back', value: a.nonlinear.predicted.holds ? 1 : 0, want: 1, tol: 0 },
      ],
    },
  },
]
