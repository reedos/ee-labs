import { BLOCK_TYPES } from '../blocks.js'

// Group E: the arithmetic a processor has.
//
// Data only. The prose lives in lessons/e.js and the definitions in terms/e.js.
//
// One section runs through the whole group: a low-pass at 600 Hz with a Q of 10,
// whose poles sit at a radius of 0.996085. It is deliberately the hardest case a
// direct form has. Its poles are close to the unit circle and close to the real
// axis, which is the corner of the coefficient grid where the reachable
// positions are furthest apart, so every effect this group is about is large
// enough to read off a plot.

export const GROUP = 'The arithmetic a processor has'

const mk = (id, type, freq, amp) => ({ id, type, freq, amp, phase: 0, enabled: true })

const bk = (id, type, params) => ({
  id,
  type,
  bypass: false,
  params: { ...BLOCK_TYPES[type].defaults, ...params },
})

const FRAME = { sampleRate: 48000, fftSize: 4096, window: 'hann', floorDb: -120, timeSpanMs: 8 }

/** The section every experiment in the group quantises. */
export const SECTION = { mode: 'lowpass', freq: 600, q: 10 }

/** The word lengths E2 walks, from far more than enough to not enough. */
export const WORD_LENGTHS = [20, 16, 12, 10, 8]

/** The state word lengths E4 walks, spanning a factor of 64 in step size. */
export const STATE_LENGTHS = [10, 12, 14, 16]

export const EXPERIMENTS = [
  {
    id: 'e1',
    group: GROUP,
    name: 'The word length, and the grid it makes',
    terms: ['wordlength', 'quantiser'],
    patch: {
      ...FRAME,
      sources: [mk(1, 'sine', 600, 0.25)],
      blocks: [bk(1, 'fixedbiquad', { ...SECTION, coeffBits: 12, coeffInt: 2, stateBits: 0 })],
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'coeffBits' }],
    chips: [
      { label: '12 bits', patch: { blocks: [{ params: { coeffBits: 12 } }] } },
      { label: '16 bits', patch: { blocks: [{ params: { coeffBits: 16 } }] } },
      { label: '1 int bit', patch: { blocks: [{ params: { coeffInt: 1 } }] } },
      { label: '2 int bits', patch: { blocks: [{ params: { coeffInt: 2 } }] } },
    ],
    claims: [
      { path: 'fix.delta', label: 'One step' },
      { path: 'fix.top', label: 'Largest value' },
      { path: 'fix.bottom', label: 'Smallest value' },
    ],
  },
  {
    id: 'e2',
    group: GROUP,
    name: 'Quantised coefficients move the poles',
    terms: ['quantiser', 'poleradius', 'stability', 'wordlength'],
    patch: {
      ...FRAME,
      sources: [mk(1, 'sine', 600, 0.25)],
      blocks: [bk(1, 'fixedbiquad', { ...SECTION, coeffBits: 12, coeffInt: 2, stateBits: 0 })],
      freqView: 'zplane',
    },
    featured: [{ block: 1, field: 'coeffBits' }],
    chips: [
      { label: '20 bits', patch: { blocks: [{ params: { coeffBits: 20 } }] } },
      { label: '16 bits', patch: { blocks: [{ params: { coeffBits: 16 } }] } },
      { label: '10 bits', patch: { blocks: [{ params: { coeffBits: 10 } }] } },
      { label: '8 bits', patch: { blocks: [{ params: { coeffBits: 8 } }] } },
    ],
    claims: [
      { path: 'fix.radius', label: 'Pole radius' },
      { path: 'fix.moved', label: 'How far a pole moved' },
      { path: 'fix.stable', label: 'Still stable' },
    ],
  },
  {
    id: 'e3',
    group: GROUP,
    name: 'The grid the poles can land on',
    terms: ['polegrid', 'poleradius', 'directform', 'quantiser'],
    patch: {
      ...FRAME,
      sources: [mk(1, 'sine', 600, 0.25)],
      blocks: [bk(1, 'fixedbiquad', { ...SECTION, coeffBits: 10, coeffInt: 2, stateBits: 0 })],
      freqView: 'polegrid',
    },
    featured: [{ block: 1, field: 'coeffBits' }],
    chips: [
      { label: '8 bits', patch: { blocks: [{ params: { coeffBits: 8 } }] } },
      { label: '10 bits', patch: { blocks: [{ params: { coeffBits: 10 } }] } },
      { label: '12 bits', patch: { blocks: [{ params: { coeffBits: 12 } }] } },
      { label: '2 kHz', patch: { blocks: [{ params: { freq: 2000 } }] } },
    ],
    claims: [
      { path: 'fix.gridDense', label: 'Positions near 45 degrees' },
      { path: 'fix.gridSparse', label: 'Positions near z of 1' },
      { path: 'fix.gridRatio', label: 'The ratio between them' },
    ],
  },
  {
    id: 'e4',
    group: GROUP,
    name: 'Limit cycles, and the dead band',
    terms: ['limitcycle', 'deadband', 'quantiser', 'wordlength', 'poleradius'],
    patch: {
      ...FRAME,
      timeSpanMs: 60,
      sources: [mk(1, 'impulse', 0, 0.5)],
      blocks: [
        bk(1, 'fixedbiquad', { ...SECTION, coeffBits: 16, coeffInt: 2, stateBits: 12, stateInt: 1 }),
      ],
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'stateBits' }],
    chips: [
      { label: 'float64', patch: { blocks: [{ params: { stateBits: 0 } }] } },
      { label: '10 bits', patch: { blocks: [{ params: { stateBits: 10 } }] } },
      { label: '12 bits', patch: { blocks: [{ params: { stateBits: 12 } }] } },
      { label: '16 bits', patch: { blocks: [{ params: { stateBits: 16 } }] } },
    ],
    claims: [
      { path: 'fix.stateDelta', label: 'One step of the state' },
      { path: 'fix.deadband', label: 'The dead band, in steps' },
      { path: 'fix.deadbandUnits', label: 'The level it sits at' },
    ],
  },
  {
    id: 'e5',
    group: GROUP,
    name: 'Overflow, and the two answers to it',
    terms: ['overflow', 'saturation', 'wrap', 'headroom', 'wordlength'],
    patch: {
      ...FRAME,
      sources: [mk(1, 'sine', 600, 0.25)],
      blocks: [
        bk(1, 'fixedbiquad', {
          ...SECTION,
          coeffBits: 16,
          coeffInt: 2,
          stateBits: 12,
          stateInt: 1,
          overflow: 'saturate',
        }),
      ],
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'overflow' }],
    chips: [
      { label: 'saturate', patch: { blocks: [{ params: { overflow: 'saturate' } }] } },
      { label: 'wrap', patch: { blocks: [{ params: { overflow: 'wrap' } }] } },
      { label: 'inside range', patch: { sources: [{ amp: 0.125 }] } },
      { label: 'past range', patch: { sources: [{ amp: 0.25 }] } },
    ],
    claims: [
      { path: 'fix.over', label: 'What the section asks for' },
      { path: 'fix.top', label: 'Largest value the state holds' },
      { path: 'fix.saturated', label: 'Saturated to' },
      { path: 'fix.wrapped', label: 'Wrapped to' },
      { path: 'line.600', label: 'What comes out at 600 Hz' },
    ],
  },
  {
    id: 'e6',
    group: GROUP,
    name: 'Rounding noise, and the guard on its model',
    terms: ['roundingnoise', 'noisegain', 'quantiser', 'wordlength'],
    patch: {
      ...FRAME,
      sources: [mk(1, 'noise', 0, 0.25)],
      blocks: [
        bk(1, 'fixedbiquad', { ...SECTION, coeffBits: 16, coeffInt: 2, stateBits: 12, stateInt: 1 }),
      ],
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'stateBits' }],
    chips: [
      { label: 'noise in', patch: { sources: [{ type: 'noise', freq: 0, amp: 0.25 }] } },
      { label: 'three codes', patch: { sources: [{ type: 'sine', freq: 375, amp: 0.0012 }] } },
      { label: '10 bits', patch: { blocks: [{ params: { stateBits: 10 } }] } },
      { label: '14 bits', patch: { blocks: [{ params: { stateBits: 14 } }] } },
    ],
    claims: [
      { path: 'fix.rmsIn', label: 'One rounding, rms' },
      { path: 'fix.noiseGain', label: 'The gain the recursion applies' },
      { path: 'fix.rmsOut', label: 'What the model predicts, rms' },
      { path: 'fix.measured', label: 'What came out, rms' },
      { path: 'fix.modelRatio', label: 'Measured over predicted' },
    ],
  },
]
