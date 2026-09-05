// Group F: the transform itself.
//
// Data only. The prose lives in lessons/f.js and the definitions in terms/f.js.
//
// Every other group has been calling the transform. This one opens it. There is
// no block to add and no filter to design, so the knobs these five experiments
// turn are the frame, the twiddle the butterfly view draws, and the record a
// non-power-of-two frame asks the transform to pad.

export const GROUP = 'The transform itself'

const mk = (id, type, freq, amp) => ({ id, type, freq, amp, phase: 0, enabled: true })

const FRAME = { sampleRate: 48000, window: 'hann', floorDb: -120, timeSpanMs: 4 }

/** The frame lengths F4 counts the saving at. */
export const LENGTHS = [64, 256, 1024, 4096]

/** The record F5 asks for, which is not a power of two, and the tone in it. */
export const ODD_RECORD = 3000
export const ODD_TONE = 4800

export const EXPERIMENTS = [
  {
    id: 'f1',
    group: GROUP,
    name: 'The sum every spectrum has been using',
    terms: ['dft', 'twiddle', 'butterfly'],
    patch: {
      ...FRAME,
      fftSize: 1024,
      sources: [mk(1, 'sine', 4500, 1)],
      blocks: [],
      freqView: 'spectrum',
    },
    chips: LENGTHS.map((n) => ({ label: `N = ${n}`, patch: { fftSize: n } })),
    claims: [
      { path: 'fft.n', label: 'Points in the frame' },
      { path: 'fft.direct', label: 'Complex multiplies the sum needs' },
      { path: 'fft.butterflies', label: 'Complex multiplies the transform needs' },
    ],
  },
  {
    id: 'f2',
    group: GROUP,
    name: 'The butterfly',
    terms: ['butterfly', 'twiddle'],
    patch: {
      ...FRAME,
      fftSize: 1024,
      sources: [mk(1, 'sine', 4500, 1)],
      blocks: [],
      freqView: 'butterfly',
      twiddleK: 0,
    },
    chips: [
      { label: 'k = 0', patch: { twiddleK: 0 } },
      { label: 'k = N/8', patch: { twiddleK: 128 } },
      { label: 'k = N/4', patch: { twiddleK: 256 } },
      { label: 'k = N/2', patch: { twiddleK: 512 } },
    ],
    claims: [
      { path: 'fft.twiddleRe', label: 'The twiddle, real part' },
      { path: 'fft.twiddleIm', label: 'The twiddle, imaginary part' },
      { path: 'fft.twiddleDeg', label: 'Its angle', unit: 'degrees' },
    ],
  },
  {
    id: 'f3',
    group: GROUP,
    name: 'Bit reversal',
    terms: ['bitreversal', 'butterfly'],
    patch: {
      ...FRAME,
      fftSize: 1024,
      sources: [mk(1, 'sine', 4500, 1)],
      blocks: [],
      freqView: 'butterfly',
      twiddleK: 0,
    },
    chips: LENGTHS.map((n) => ({ label: `N = ${n}`, patch: { fftSize: n } })),
    claims: [
      { path: 'fft.n', label: 'Points in the frame' },
      { path: 'fft.stages', label: 'Stages, which is log two of N' },
    ],
  },
  {
    id: 'f4',
    group: GROUP,
    name: 'The saving, counted',
    terms: ['butterfly', 'dft'],
    patch: {
      ...FRAME,
      fftSize: 1024,
      sources: [mk(1, 'sine', 4500, 1)],
      blocks: [],
      freqView: 'butterfly',
      twiddleK: 0,
    },
    chips: LENGTHS.map((n) => ({ label: `N = ${n}`, patch: { fftSize: n } })),
    claims: [
      { path: 'fft.stages', label: 'Stages, which is log two of N' },
      { path: 'fft.butterflies', label: 'Butterflies in all' },
      { path: 'fft.direct', label: 'Complex multiplies the sum needs' },
      { path: 'fft.ratio', label: 'Times cheaper' },
    ],
  },
  {
    id: 'f5',
    group: GROUP,
    name: 'Why the frame is a power of two',
    terms: ['padding', 'resolution'],
    patch: {
      ...FRAME,
      fftSize: 4096,
      sources: [mk(1, 'sine', ODD_TONE, 1)],
      blocks: [],
      estimator: 'periodogram',
      record: ODD_RECORD,
      freqView: 'density',
    },
    chips: [
      { label: '3000 samples', patch: { record: ODD_RECORD } },
      { label: '4096 samples', patch: { record: null } },
      { label: '2048 samples', patch: { record: 2048 } },
      { label: '1500 samples', patch: { record: 1500 } },
    ],
    claims: [
      { path: 'psd.record', label: 'Samples the record holds' },
      { path: 'psd.naive', label: 'The bin the record suggests', unit: 'Hz' },
      { path: 'psd.padded', label: 'Points the transform ran at' },
      { path: 'psd.df', label: 'The bin it really has', unit: 'Hz' },
      { path: 'psd.peakHz.4000.5600', label: 'Where the line is reported', unit: 'Hz' },
    ],
  },
]
