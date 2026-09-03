// The lab's state as a preset produces it.
//
// INITIAL is the whole state at first load; presetState is what "click a
// preset" does to it. Both live here rather than in App.jsx so the tests can
// run the exact sequence a student runs — Beating, then Exactly at Nyquist —
// and read what the readout would read.

export const INITIAL = {
  sources: [{ id: 1, type: 'sine', freq: 250, amp: 1, phase: 0, enabled: true }],
  blocks: [],
  sampleRate: 8000,
  fftSize: 2048,
  window: 'hann',
  timeSpanMs: 20,
  spanCycles: 5,
  scale: 'db',
  showHarmonics: false,
  showGhost: false,
  // Phase and group delay share one right-hand axis, so they are a choice
  // rather than two toggles. See SpectrumCanvas.
  overlay: 'none',
  // Zoom for the spectrum's x-axis; null means the full span to Nyquist.
  specMax: null,
  showTransient: false,
  // Each pane can show the chain from a different side. The signal and its
  // spectrum are the default pair; the impulse response and the z-plane are the
  // same filter described by its kernel and by its roots.
  timeView: 'signal',
  freqView: 'spectrum',
  presetName: 'Single tone',
}

/**
 * The state a preset loads.
 *
 * Every toggle is re-pinned to its default before the patch lands, or
 * settings from the previous preset leak into this one. That used to carry
 * fftSize over on purpose — and after Beating's 8192-point frame, Exactly at
 * Nyquist read 3999.0 Hz for a 4 kHz tone. A preset that does not name a
 * frame length gets the default one, the same as a fresh load.
 */
export function presetState(preset) {
  return { ...INITIAL, ...preset.patch, presetName: preset.name }
}
