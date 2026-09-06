import { BLOCK_TYPES } from '../blocks.js'

// Group C: filters that learn.
//
// Data only. The prose lives in lessons/c.js and the definitions in terms/c.js.
//
// The frame is 8192 rather than the lab's 4096. Every number in this group is a
// count of samples or an average over a settled tail, and at 4096 the slowest
// step size spends a third of the record converging, which leaves too little
// behind it for the tail to be an average of anything. At 8192 the slowest run
// converges in 1325 samples and settles over the 2048 that follow.

export const GROUP = 'Filters that learn'

const mk = (id, type, freq, amp) => ({ id, type, freq, amp, phase: 0, enabled: true })

const bk = (id, type, params) => ({
  id,
  type,
  bypass: false,
  params: { ...BLOCK_TYPES[type].defaults, ...params },
})

const FRAME = { sampleRate: 48000, fftSize: 8192, window: 'hann', floorDb: -120, timeSpanMs: 8 }

/** The eight-tap plant every experiment but C7 tries to match. */
export const PLANT = '0.4,-0.3,0.25,0.1,-0.05,0.02,0.01,0'

/** The echo path C7 learns: three samples of bulk delay and then nine taps. */
export const ECHO_PATH = '0,0,0,0.6,0.3,-0.2,0.1,0.05,-0.03,0.02,-0.01,0.005'

/** The step sizes C4 walks, each twice the one before it after the first. */
export const STEPS = [0.005, 0.01, 0.02, 0.05]

const white = (amp) => [mk(1, 'noise', 0, amp)]

export const EXPERIMENTS = [
  {
    id: 'c1',
    group: GROUP,
    name: 'The best fixed filter, and the equations that find it',
    terms: ['adaptivefilter', 'unknownplant', 'wiener'],
    patch: {
      ...FRAME,
      sources: white(1),
      blocks: [bk(1, 'adaptive', { algorithm: 'lms', taps: 8, mu: 0.02, plant: PLANT, noiseAmp: 0 })],
      timeView: 'weights',
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'taps' }],
    chips: [
      { label: '4 taps', patch: { blocks: [{ params: { taps: 4 } }] } },
      { label: '8 taps', patch: { blocks: [{ params: { taps: 8 } }] } },
      { label: '16 taps', patch: { blocks: [{ params: { taps: 16 } }] } },
      { label: 'noise on', patch: { blocks: [{ params: { noiseAmp: 0.05 } }] } },
    ],
    claims: [
      { path: 'lms.rdiag', label: 'The diagonal of R' },
      { path: 'lms.power', label: 'The input power a sample' },
      { path: 'lms.wiener', label: 'The Wiener answer against the plant' },
    ],
  },
  {
    id: 'c2',
    group: GROUP,
    name: 'LMS, the update in one line',
    terms: ['lms', 'stepsize', 'unknownplant', 'adaptivefilter'],
    patch: {
      ...FRAME,
      sources: white(1),
      blocks: [bk(1, 'adaptive', { algorithm: 'lms', taps: 8, mu: 0.02, plant: PLANT, noiseAmp: 0 })],
      timeView: 'weights',
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'mu' }],
    chips: [
      { label: 'output error', patch: { blocks: [{ params: { output: 'error' } }] } },
      { label: 'output est', patch: { blocks: [{ params: { output: 'estimate' } }] } },
      { label: 'output want', patch: { blocks: [{ params: { output: 'wanted' } }] } },
      { label: 'mu = 0.05', patch: { blocks: [{ params: { mu: 0.05 } }] } },
    ],
    claims: [
      { path: 'lms.reach', label: 'Samples to a tenth of the plant' },
      { path: 'lms.error', label: 'The weights against the plant' },
      { path: 'lms.cost', label: 'Multiplies a sample' },
    ],
  },
  {
    id: 'c3',
    group: GROUP,
    name: 'The step size, and the bound it cannot cross',
    terms: ['stepsize', 'lms', 'convergence', 'unknownplant'],
    patch: {
      ...FRAME,
      sources: white(1),
      blocks: [bk(1, 'adaptive', { algorithm: 'lms', taps: 8, mu: 0.02, plant: PLANT, noiseAmp: 0 })],
      timeView: 'weights',
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'mu' }],
    chips: [
      { label: 'mu = 0.02', patch: { blocks: [{ params: { mu: 0.02 } }] } },
      { label: 'mu = 0.25', patch: { blocks: [{ params: { mu: 0.25 } }] } },
      { label: 'mu = 0.5', patch: { blocks: [{ params: { mu: 0.5 } }] } },
      { label: 'mu = 0.99', patch: { blocks: [{ params: { mu: 0.99 } }] } },
    ],
    claims: [
      { path: 'lms.boundMean', label: 'The bound on the mean' },
      { path: 'lms.bound', label: 'The bound on the mean square' },
      { path: 'lms.reach', label: 'Samples to a tenth of the plant' },
      { path: 'lms.converged', label: 'Reached the plant' },
    ],
  },
  {
    id: 'c4',
    group: GROUP,
    name: 'Misadjustment, the price of a fast step',
    terms: ['misadjustment', 'stepsize', 'lms', 'convergence', 'unknownplant'],
    patch: {
      ...FRAME,
      sources: white(1),
      blocks: [
        bk(1, 'adaptive', { algorithm: 'lms', taps: 8, mu: 0.02, plant: PLANT, noiseAmp: 0.05 }),
      ],
      timeView: 'weights',
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'mu' }],
    chips: [
      { label: 'mu = 0.005', patch: { blocks: [{ params: { mu: 0.005 } }] } },
      { label: 'mu = 0.01', patch: { blocks: [{ params: { mu: 0.01 } }] } },
      { label: 'mu = 0.02', patch: { blocks: [{ params: { mu: 0.02 } }] } },
      { label: 'mu = 0.05', patch: { blocks: [{ params: { mu: 0.05 } }] } },
    ],
    claims: [
      { path: 'lms.reach', label: 'Samples to a tenth of the plant' },
      { path: 'lms.floor', label: 'The floor no filter can cancel' },
      { path: 'lms.ratio', label: 'Settled error over the floor' },
      { path: 'lms.misadjustment', label: 'The excess the bound predicts' },
    ],
  },
  {
    id: 'c5',
    group: GROUP,
    name: 'NLMS, and the step size made dimensionless',
    terms: ['nlms', 'lms', 'stepsize', 'convergence', 'unknownplant'],
    patch: {
      ...FRAME,
      sources: white(10),
      blocks: [
        bk(1, 'adaptive', { algorithm: 'nlms', taps: 8, mu: 0.5, plant: PLANT, noiseAmp: 0 }),
      ],
      timeView: 'weights',
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'algorithm' }],
    chips: [
      { label: 'amplitude 1', patch: { sources: [{ amp: 1 }] } },
      { label: 'amplitude 10', patch: { sources: [{ amp: 10 }] } },
      { label: 'NLMS', patch: { blocks: [{ params: { algorithm: 'nlms', mu: 0.5 } }] } },
      { label: 'LMS', patch: { blocks: [{ params: { algorithm: 'lms', mu: 0.02 } }] } },
    ],
    claims: [
      { path: 'lms.power', label: 'The input power a sample' },
      { path: 'lms.reach', label: 'Samples to a tenth of the plant' },
      { path: 'lms.converged', label: 'Reached the plant' },
    ],
  },
  {
    id: 'c6',
    group: GROUP,
    name: 'RLS, and what N squared buys',
    terms: ['rls', 'nlms', 'lms', 'convergence', 'unknownplant'],
    patch: {
      ...FRAME,
      sources: white(1),
      blocks: [
        bk(1, 'adaptive', {
          algorithm: 'rls',
          taps: 8,
          lambda: 0.999,
          delta: 0.01,
          plant: PLANT,
          noiseAmp: 0,
        }),
      ],
      timeView: 'weights',
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'algorithm' }],
    chips: [
      { label: 'LMS', patch: { blocks: [{ params: { algorithm: 'lms', mu: 0.02 } }] } },
      { label: 'NLMS', patch: { blocks: [{ params: { algorithm: 'nlms', mu: 0.5 } }] } },
      { label: 'RLS', patch: { blocks: [{ params: { algorithm: 'rls' } }] } },
      { label: '16 taps', patch: { blocks: [{ params: { taps: 16 } }] } },
    ],
    claims: [
      { path: 'lms.reach', label: 'Samples to a tenth of the plant' },
      { path: 'lms.cost', label: 'Multiplies a sample' },
      { path: 'lms.error', label: 'The weights against the plant' },
    ],
  },
  {
    id: 'c7',
    group: GROUP,
    name: 'The echo canceller',
    terms: ['erle', 'nlms', 'unknownplant', 'adaptivefilter'],
    patch: {
      ...FRAME,
      sources: white(1),
      blocks: [
        bk(1, 'adaptive', {
          algorithm: 'nlms',
          taps: 12,
          mu: 0.5,
          plant: ECHO_PATH,
          nearAmp: 0.1,
          nearFreq: 300,
        }),
      ],
      timeView: 'weights',
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'nearAmp' }],
    chips: [
      { label: 'talker off', patch: { blocks: [{ params: { nearAmp: 0 } }] } },
      { label: 'talker on', patch: { blocks: [{ params: { nearAmp: 0.1 } }] } },
      { label: '8 taps', patch: { blocks: [{ params: { taps: 8 } }] } },
      { label: '12 taps', patch: { blocks: [{ params: { taps: 12 } }] } },
    ],
    claims: [
      { path: 'lms.echo', label: 'Echo power before' },
      { path: 'lms.residual', label: 'What is left after' },
      { path: 'lms.erle', label: 'Echo return loss enhancement', unit: 'dB' },
      { path: 'lms.near', label: 'The near-end talker' },
    ],
  },
]
