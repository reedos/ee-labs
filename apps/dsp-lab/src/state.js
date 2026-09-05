// The lab's state as an experiment produces it.
//
// INITIAL is the whole state at first load, and `experimentState` is what
// clicking an experiment does to it. Both live here rather than in App.jsx so
// the tests can run the exact sequence a student runs and read what the readout
// would read.

export const INITIAL = {
  sources: [{ id: 1, type: 'sine', freq: 1500, amp: 1, phase: 0, enabled: true }],
  blocks: [],
  // 48 kHz and a 4096-point frame, so a bin is 11.72 Hz and every lesson
  // frequency is a multiple of 375 Hz, which is a bin centre exactly
  // (DSP_LAB_PLAN.md Decision 2).
  sampleRate: 48000,
  fftSize: 4096,
  window: 'hann',
  timeSpanMs: 4,
  spanCycles: 6,
  scale: 'db',
  // The dB floor. A 60 dB stopband needs more room than Signal Lab's -100
  // default gives once the specification asks for 80, so an experiment that
  // states a deeper specification lowers it.
  floorDb: -120,
  showGhost: false,
  overlay: 'none',
  specMax: null,
  showTransient: false,
  timeView: 'signal',
  freqView: 'spectrum',
  // The estimator the density view uses, and its segment count.
  estimator: 'periodogram',
  segments: 16,
  experimentId: 'a1',
}

/**
 * The state an experiment loads.
 *
 * Every field is re-pinned to its default before the patch lands, or settings
 * from the previous experiment leak into this one. Signal Lab learned that with
 * a frame length carried over: after an 8192-point lesson, the next one read
 * 3999.0 Hz for a 4 kHz tone.
 */
export function experimentState(exp) {
  return { ...INITIAL, ...exp.patch, experimentId: exp.id }
}
