// Group I: the Wiener and Kalman filters.
//
// I2 is the hand-over to Control Lab II, where the state being estimated is a
// plant's state and the gain is a design choice.

export const GROUP_I = 'The Wiener and Kalman filters'

export default [
  {
    id: 'I1',
    group: GROUP_I,
    name: 'The Wiener filter minimises error, not ratio',
    terms: ['wiener', 'mmse', 'snr', 'estimator', 'variance', 'autocorrelation', 'kalman'],
    params: {
      seed: 61,
      signalVariance: 1,
      wienerNoiseVariance: 0.25,
      taps: 16,
      sweepTaps: [2, 4, 8, 16],
    },
    view: 'wiener',
    views: ['wiener', 'scope'],
    featured: { field: 'wienerNoiseVariance' },
    claims: [
      {
        label: 'the weight is the variance ratio',
        path: 'wiener.w',
        formula: (p) => p.signalVariance / (p.signalVariance + p.wienerNoiseVariance),
        tol: 1e-12,
      },
      {
        label: 'the error it leaves is the harmonic combination',
        path: 'wiener.mmse',
        formula: (p) =>
          (p.signalVariance * p.wienerNoiseVariance) / (p.signalVariance + p.wienerNoiseVariance),
        tol: 1e-12,
      },
      {
        label: 'it beats doing nothing by exactly the weight',
        path: 'wiener.mmse',
        againstScaled: {
          path: 'wiener.unfilteredMse',
          by: (p) => p.signalVariance / (p.signalVariance + p.wienerNoiseVariance),
        },
        tol: 1e-12,
      },
      {
        label: 'and it cannot change the ratio of powers at all',
        path: 'wiener.gainDb',
        formula: () => 0,
        tol: 1e-9,
        absolute: true,
      },
      {
        label: 'sixteen taps beat one weight, because they see more than one sample',
        path: 'wiener.bestMmse',
        atMost: 'wiener.oneWeightMmse',
      },
      {
        label: 'and more taps never do worse than fewer',
        path: 'wiener.sweep.3.mmse',
        atMost: 'wiener.sweep.0.mmse',
      },
    ],
  },
  {
    id: 'I2',
    group: GROUP_I,
    name: 'The Kalman gain is a variance ratio',
    terms: ['kalman', 'gain', 'innovation', 'estimator', 'wiener', 'variance'],
    params: {
      seed: 71,
      kalmanA: 0.9,
      q: 0.1,
      r: 1,
      x0: 500,
      p0: 1e6,
      kalmanSteps: 200,
    },
    view: 'kalman',
    views: ['kalman', 'scope'],
    featured: { field: 'r' },
    claims: [
      {
        label: 'the settled prior variance is the positive root of the Riccati equation',
        path: 'kalman.priorVariance',
        formula: (p) => {
          const b = p.r * (1 - p.kalmanA * p.kalmanA) - p.q
          return (-b + Math.sqrt(b * b + 4 * p.q * p.r)) / 2
        },
        tol: 1e-12,
      },
      {
        label: 'and the gain is that prior over the prior plus the measurement noise',
        path: 'kalman.steadyGain',
        formula: (p) => {
          const b = p.r * (1 - p.kalmanA * p.kalmanA) - p.q
          const prior = (-b + Math.sqrt(b * b + 4 * p.q * p.r)) / 2
          return prior / (prior + p.r)
        },
        tol: 1e-12,
      },
      {
        label: 'the innovation variance is the prior plus the measurement noise',
        path: 'kalman.innovationVariance',
        formula: (p) => {
          const b = p.r * (1 - p.kalmanA * p.kalmanA) - p.q
          return (-b + Math.sqrt(b * b + 4 * p.q * p.r)) / 2 + p.r
        },
        tol: 1e-12,
      },
      {
        label: 'from a start five hundred away the gain settles within ten steps',
        path: 'kalman.settledAt',
        atMostValue: 10,
      },
      {
        label: 'the stationary variance of the process is q over one minus a squared',
        path: 'kalman.stationaryVariance',
        formula: (p) => p.q / (1 - p.kalmanA * p.kalmanA),
        tol: 1e-12,
      },
      {
        label: 'and the recursive estimate beats the one-shot one',
        path: 'kalman.posteriorVariance',
        atMost: 'kalman.oneShotMmse',
      },
      {
        label: 'by leaving the ratio the Riccati root and the scalar Wiener form give',
        path: 'kalman.memoryWorth',
        formula: (p) => {
          const b = p.r * (1 - p.kalmanA * p.kalmanA) - p.q
          const prior = (-b + Math.sqrt(b * b + 4 * p.q * p.r)) / 2
          const posterior = (prior * p.r) / (prior + p.r)
          const varX = p.q / (1 - p.kalmanA * p.kalmanA)
          return posterior / ((varX * p.r) / (varX + p.r))
        },
        tol: 1e-12,
      },
    ],
  },
]
