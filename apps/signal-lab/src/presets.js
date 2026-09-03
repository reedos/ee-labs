import { BLOCK_TYPES } from './dsp/blocks.js'

// The lessons.
//
// Each preset is a question worth answering by looking at both plots at once,
// and each `note` makes a claim about physics. presets.test.js renders every one
// and measures whether the claim actually holds — two of them were wrong before
// that existed, and a confidently wrong explanation is worse here than a missing
// feature, because someone learns it and has no way to catch it.
//
// A note is ONE claim: at most 55 words and three sentences, with no
// imperatives (those belong to the try line). try.test.js enforces all three
// for every preset. Everything a longer note used to say lives on in the
// experiment's math panel, where the numbers are live — nothing was thrown
// away when the notes were cut, only moved below the knobs. The cold walk
// measured why: a ten-sentence note pushed the featured knob 200 px below a
// 1440×900 fold, and the try line with it.
//
// Each preset also carries:
//   try      — one imperative: the knob to touch and what should happen. Every
//              number in it is measured by presets.test.js, like the note's.
//   chips    — one-click settings (partial patches, see chips.js) so "set Q
//              to 1" is a click, not a search.
//   featured — the control the try line names, rendered under it so it is on
//              screen without scrolling (the fold probe in verify.mjs holds
//              this for all 35 at laptop sizes). `{ source: id, field }` or
//              `{ block: id, field }`.
//   terms    — the vocabulary the note, try and chips lean on (terms.js).
//              presets.test.js scans the text and refuses a word whose term
//              is not listed.
//
// Grouped as a curriculum, and the array is in sidebar order — group by group,
// as PRESET_GROUPS lists them — so "n of 35" in the lesson nav is the position
// the student sees. presets.test.js pins that.

const mk = (id, type, freq, amp, phase = 0, extra = null) => ({
  id,
  type,
  freq,
  amp,
  phase,
  enabled: true,
  ...extra,
})

const bk = (id, type, params) => ({
  id,
  type,
  bypass: false,
  params: { ...BLOCK_TYPES[type].defaults, ...params },
})

/** A chip that sets fields on the first source. */
const src1 = (label, fields, title) => ({ label, patch: { sources: [fields] }, title })
/** A chip that sets params on the first block. */
const blk1 = (label, params, title) => ({ label, patch: { blocks: [{ params }] }, title })

export const PRESET_GROUPS = [
  'Signals and Fourier',
  'Sampling',
  'Filters',
  'FIR and the z-plane',
  'Nonlinearity',
]

export const PRESETS = [
  // --------------------------------------------------- Signals and Fourier
  {
    group: 'Signals and Fourier',
    name: 'Single tone',
    terms: ['db', 'rms', 'harmonic'],
    note: 'One sine, one line. The baseline everything else is read against.',
    try: 'This is the baseline. Next: Square adds only odd harmonics.',
    patch: { sources: [mk(1, 'sine', 250, 1)], sampleRate: 8000, timeSpanMs: 20, spanCycles: 5 },
  },
  {
    group: 'Signals and Fourier',
    name: 'Square = odd harmonics',
    terms: ['harmonic', 'nyquist', 'fold'],
    // The markers are already on when this loads — the old note said "turn
    // on harmonic markers", which the walk read as a control it could not
    // find.
    note:
      'A square wave is a sum of odd harmonics falling as 1/k — 4A/(kπ), plus the small ' +
      'sampling correction the math panel carries. The harmonic markers are on: count 1st, ' +
      '3rd, 5th, and nothing between them. The flattening above 2 kHz is harmonics past ' +
      'Nyquist folding back onto the ones below.',
    try: 'Click 3, then 9 — more odd lines appear, and nothing lands between them.',
    chips: [
      src1('3', { topHarmonic: 3 }, 'Two terms: the fundamental and the 3rd'),
      src1('9', { topHarmonic: 9 }, 'Five terms, up to the 9th'),
      src1('ideal', { topHarmonic: 0 }, 'The true square: harmonics forever'),
    ],
    featured: [{ source: 1, field: 'topHarmonic' }],
    patch: {
      sources: [mk(1, 'square', 250, 1)],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
      showHarmonics: true,
    },
  },
  {
    group: 'Signals and Fourier',
    name: 'Corners make harmonics',
    terms: ['harmonic'],
    // "close to a ninth (8.8 measured here)": the continuous law says 9; the
    // sampled triangle's own correction reads 8.77 at 32 samples per period,
    // and the walk caught the note claiming the round number.
    note:
      'A triangle has the same period as a square but no sudden jumps, so its harmonics fall ' +
      'as 1/k² instead of 1/k: the 3rd is close to a ninth of the fundamental (8.8 measured ' +
      'here) rather than a third. The sharper the corner, the more high-frequency content it ' +
      'takes to build it.',
    try: 'Switch the source to square — the 3rd harmonic rises from 1/9 to 1/3 of the fundamental.',
    chips: [
      src1('triangle', { type: 'triangle' }),
      src1('square', { type: 'square' }),
      src1('sawtooth', { type: 'sawtooth' }),
    ],
    patch: {
      sources: [mk(1, 'triangle', 250, 1)],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
      showHarmonics: true,
    },
  },
  {
    group: 'Signals and Fourier',
    name: 'Build a square',
    terms: ['harmonic', 'gibbs'],
    // Every number here is measured on the continuous partial sum (fine grid),
    // not on the 32-per-period samples the readout's "peak" reads — those
    // miss the overshoot lobe. The math panel carries both, side by side.
    note:
      'Three odd harmonics at 1, 1/3 and 1/5 add up to a square of height π/4 = 0.785, ' +
      'already square-ish. The Gibbs overshoot at each corner is 9.4% of the jump with three ' +
      'terms, 9.1% with five, and 8.95% in the limit — it narrows as terms are added, never ' +
      'shrinks away.',
    try: 'Click add 7th and 9th — the edges steepen; the overshoot narrows toward 9% of the jump.',
    chips: [
      {
        label: 'add 7th and 9th',
        title: 'Two more terms: 1750 Hz at 1/7 and 2250 Hz at 1/9',
        patch: {
          sources: [{}, {}, {}, mk(4, 'sine', 1750, 1 / 7), mk(5, 'sine', 2250, 1 / 9)],
        },
      },
    ],
    patch: {
      sources: [mk(1, 'sine', 250, 1), mk(2, 'sine', 750, 1 / 3), mk(3, 'sine', 1250, 1 / 5)],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
    },
  },
  {
    group: 'Signals and Fourier',
    name: 'Sources simply add',
    terms: ['superposition', 'scalloping'],
    note:
      'Two tones, nothing else. The scope shows their sample-by-sample sum, a shape neither ' +
      'has alone, while the spectrum shows two clean lines, each at its own source’s ' +
      'amplitude as if the other were not there. That is superposition: adding signals adds ' +
      'spectra, line by line.',
    try: 'Untick source 2 — the 300 Hz line does not move.',
    chips: [
      { label: 'source 2 off', patch: { sources: [{}, { enabled: false }] } },
      { label: 'both on', patch: { sources: [{ enabled: true }, { enabled: true }] } },
    ],
    patch: {
      sources: [mk(1, 'sine', 300, 0.7), mk(2, 'sine', 1800, 0.4)],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 6,
    },
  },
  {
    group: 'Signals and Fourier',
    name: 'Sines in, sines out',
    // 'sampled' because this preset's span is zoomed far enough in that the
    // scope switches to sample dots and its (sin x)/x reconstruction — the
    // caption for that appears on the canvas, so the definition behind it
    // should be one click away here as it is in the sampling lessons.
    terms: ['lti', 'superposition', 'sampled', 'phase', 'scalloping'],
    note:
      'This chain is LINEAR — superposition plus scaling — and TIME-INVARIANT: shift the ' +
      'input, the output shifts identically. Any such system can do exactly one thing to a ' +
      'sine: scale it and shift it, never change its frequency or add new ones. One line in, ' +
      'one line out, through a strongly resonant filter.',
    try: 'Drag Phase to 180° — the filtered wave is exactly inverted; its spectrum line stays put.',
    chips: [
      src1('0°', { phase: 0 }),
      src1('90°', { phase: Math.PI / 2 }),
      src1('180°', { phase: Math.PI }),
    ],
    featured: [{ source: 1, field: 'phase' }],
    patch: {
      sources: [mk(1, 'sine', 700, 0.8)],
      blocks: [bk(1, 'lowpass', { freq: 800, q: 6 })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
      showGhost: true,
    },
  },
  {
    group: 'Signals and Fourier',
    name: 'Beating',
    terms: ['bin', 'frame', 'envelope'],
    note:
      'Two tones 5 Hz apart. The spectrum shows two lines because the frame is 8192 samples ' +
      'long (bins under 1 Hz) and the axis is zoomed to 500 Hz; the scope shows the other ' +
      'truth, one tone whose envelope pulses at the 5 Hz difference. Same signal, two ' +
      'descriptions.',
    try: 'Set FFT to 2048 in the top bar — the two lines merge into one peak.',
    chips: [
      { label: 'FFT 2048', patch: { fftSize: 2048 }, title: '3.9 Hz bins: the pair is 1.3 bins apart' },
      { label: 'FFT 8192', patch: { fftSize: 8192 }, title: '0.98 Hz bins: the pair resolves' },
    ],
    patch: {
      sources: [mk(1, 'sine', 250, 0.5), mk(2, 'sine', 255, 0.5)],
      sampleRate: 8000,
      fftSize: 8192,
      specMax: 500,
      timeSpanMs: 200,
      spanCycles: 50,
    },
  },

  // -------------------------------------------------------------- Sampling
  {
    group: 'Sampling',
    name: 'Coarse, not undersampled',
    terms: ['sampled', 'nyquist', 'sinc', 'reconstruction', 'interpolation', 'fold', 'scalloping'],
    // One claim. The interpolation-versus-information framing, the fraying
    // at the pane edges and the envelope wobble moved to the math panel.
    note:
      'A 3.4 kHz sine at 8 kHz: 2.35 samples per cycle. Dot-to-dot it looks mangled, yet RMS ' +
      'still reads 0.707 — nothing was lost. More than two samples per cycle is enough: the ' +
      'scope’s sin(x)/x curve through the dots IS the one signal they describe.',
    try: 'Drag Frequency to 3900 Hz — 2.05 samples per cycle, and the curve is still the sine.',
    // Each chip also sets the span so the visible window is a WHOLE number
    // of samples: 17 cycles of 3400 Hz is exactly 40 samples, 39 cycles of
    // 3900 Hz exactly 80. Otherwise the readout's RMS — averaged over the
    // visible span — read 0.750 at 3900 under a note promising 0.707.
    chips: [
      { label: '3400 Hz', patch: { sources: [{ freq: 3400 }], spanCycles: 17 }, title: '2.35 samples per cycle' },
      { label: '3900 Hz', patch: { sources: [{ freq: 3900 }], spanCycles: 39 }, title: '2.05 samples per cycle — 100 Hz from the fold' },
    ],
    featured: [{ source: 1, field: 'freq' }],
    patch: { sources: [mk(1, 'sine', 3400, 1)], sampleRate: 8000, timeSpanMs: 5, spanCycles: 17 },
  },
  {
    group: 'Sampling',
    name: 'Aliasing',
    terms: ['sampled', 'aliasing', 'nyquist', 'fold', 'scalloping'],
    note:
      'A 3.4 kHz tone at 8 kHz behaves. Past 4 kHz — dragged there, or by a chip — the ' +
      'peak turns around and walks back down. The signal is gone and an impostor took its place.',
    try: 'Click 6000 Hz — the peak lands at 2000 Hz. Click 4600 — 3400 Hz, where it started.',
    // Whole-sample spans, as in Coarse: 40 samples every time (17 cycles of
    // 3400, 23 of 4600, 30 of 6000), so RMS reads 0.707 at every chip and
    // "indistinguishable from the start" holds for the readout too.
    chips: [
      { label: '3400 Hz', patch: { sources: [{ freq: 3400 }], spanCycles: 17 }, title: 'Below Nyquist: its own representative' },
      { label: '4600 Hz', patch: { sources: [{ freq: 4600 }], spanCycles: 23 }, title: '600 Hz past the fold — reads 3400, indistinguishable from the start' },
      { label: '6000 Hz', patch: { sources: [{ freq: 6000 }], spanCycles: 30 }, title: '2000 Hz past the fold — reads 2000' },
    ],
    featured: [{ source: 1, field: 'freq' }],
    patch: { sources: [mk(1, 'sine', 3400, 1)], sampleRate: 8000, timeSpanMs: 5, spanCycles: 17 },
  },
  {
    group: 'Sampling',
    name: 'Turn the rate down',
    terms: ['sampled', 'aliasing', 'nyquist', 'fold'],
    note:
      'This one moves the RATE, the knob you usually have. Three sines at 625, 1875 and 3125 Hz ' +
      'sampled at 16 kHz all sit well below Nyquist, so the dots describe exactly this signal. ' +
      'At 4 kHz the 3125 Hz component no longer fits and folds to 875 Hz, a line the signal ' +
      'never contained.',
    try: 'Set Rate to 4 kHz — the 3125 Hz line folds to 875 Hz.',
    chips: [
      { label: '16 kHz', patch: { sampleRate: 16000 } },
      { label: '8 kHz', patch: { sampleRate: 8000 } },
      { label: '4 kHz', patch: { sampleRate: 4000 }, title: '3125 folds to 875' },
      { label: '2 kHz', patch: { sampleRate: 2000 }, title: '1875 folds to 125 as well' },
    ],
    patch: {
      // 625 Hz and its odd harmonics land on an FFT bin centre at 16, 8, 4 and
      // 2 kHz alike (fs/2048 divides 625 at every one), so the lines stay
      // sharp as the rate is halved and the folding is the only thing moving.
      sources: [mk(1, 'sine', 625, 1), mk(2, 'sine', 1875, 1 / 3), mk(3, 'sine', 3125, 1 / 5)],
      sampleRate: 16000,
      fftSize: 2048,
      specMax: 4000,
      timeSpanMs: 5,
      spanCycles: 3,
    },
  },
  {
    group: 'Sampling',
    name: 'Exactly at Nyquist',
    terms: ['sampled', 'nyquist', 'phase', 'sinc'],
    // One claim. "A bound you approach, not one you sit on" and what the
    // reconstruction does at each phase moved to the math panel.
    note:
      'A 4 kHz tone sampled at 8 kHz: exactly two samples per cycle, the limit the theorem ' +
      'allows. The bright dots are the samples; the smooth curve is the scope’s sin(x)/x ' +
      'reconstruction through them. Same frequency, same amplitude — where the samples fall ' +
      'in the cycle decides what you read.',
    try: 'Drag Phase to 0° — the samples land on the zero crossings and the tone vanishes.',
    chips: [
      src1('0°', { phase: 0 }, 'Samples on the zero crossings: nothing'),
      src1('45°', { phase: Math.PI / 4 }, 'Reads 0.707'),
      src1('90°', { phase: Math.PI / 2 }, 'Samples on the peaks: full amplitude'),
    ],
    featured: [{ source: 1, field: 'phase' }],
    patch: {
      sources: [mk(1, 'sine', 4000, 1, Math.PI / 2)],
      sampleRate: 8000,
      timeSpanMs: 3,
      spanCycles: 8,
    },
  },
  {
    group: 'Sampling',
    name: 'A square that fits',
    terms: ['sampled', 'nyquist', 'harmonic', 'aliasing', 'fold', 'bandlimited'],
    // One claim. The 15th-harmonic fold and the ideal square's deceptively
    // clean trace moved to the math panel, where the numbers are live.
    note:
      'Highest harmonic 9: the square’s odd series stopped after five terms, topping out at ' +
      '2531 Hz. That is a highest frequency, and 8 kHz is more than twice it. Five lines, ' +
      'nothing above the 9th, no floor between them: these samples are not an approximation ' +
      'of this signal — they ARE it.',
    try: 'Click 15 — the 15th harmonic folds from 4219 Hz to 3781 Hz, between the lines.',
    chips: [
      src1('9', { topHarmonic: 9 }, 'Five terms, all below Nyquist'),
      src1('15', { topHarmonic: 15 }, 'The 15th lands past Nyquist and folds back'),
      src1('ideal', { topHarmonic: 0 }, 'The true square: a forest of folded lines, and a cleaner-looking trace'),
    ],
    featured: [{ source: 1, field: 'topHarmonic' }],
    patch: {
      // 281.25 Hz is bin 72 of 8000/2048, so every harmonic lands on a bin
      // centre and the lines are sharp. fs/f0 = 28.44 is deliberately NOT an
      // integer: the folds then land BETWEEN harmonics and are visible as
      // their own lines, rather than hiding on top of the comb.
      sources: [mk(1, 'square', 281.25, 1, 0, { topHarmonic: 9 })],
      sampleRate: 8000,
      fftSize: 2048,
      timeSpanMs: 12,
      spanCycles: 3,
      showHarmonics: true,
    },
  },
  {
    group: 'Sampling',
    name: 'Resolution needs time',
    terms: ['bin', 'frame', 'window', 'envelope'],
    // "and a low one, 0.25": at 512 points the frame is 64 ms, one beat
    // period, and the Hann window weights its middle — which is where the
    // two tones cancel. The math panel measures it; the walk read 0.253
    // against two 0.5 sources and had nothing to explain it.
    note:
      'Two tones 15 Hz apart in a 512-point frame whose bins are 15.6 Hz wide: closer than ' +
      'one bin, they read as one peak (and a low one, 0.25 — the math panel says why). ' +
      'Telling two frequencies apart requires listening for long enough, and the frame ' +
      'length IS that listening time.',
    try: 'Set FFT to 2048 in the top bar — one peak splits into 250 and 265 Hz.',
    chips: [
      { label: 'FFT 512', patch: { fftSize: 512 }, title: '15.6 Hz bins: one peak' },
      { label: 'FFT 2048', patch: { fftSize: 2048 }, title: '3.9 Hz bins: two' },
    ],
    patch: {
      sources: [mk(1, 'sine', 250, 0.5), mk(2, 'sine', 265, 0.5)],
      sampleRate: 8000,
      fftSize: 512,
      timeSpanMs: 100,
      spanCycles: 25,
    },
  },
  {
    group: 'Sampling',
    name: 'Spectral leakage',
    terms: ['leakage', 'window', 'windownames', 'frame', 'bin', 'dft', 'sidelobe', 'scalloping', 'db'],
    // The floor is dropped to −160 dB for this preset alone: the Hann floor
    // at 1 kHz sits near −147 dB, which the default −100 dB axis could not
    // show, so "below −140" was a number the student had to take on trust.
    note:
      'Window is set to "none". A tone that does not complete whole cycles in the frame ' +
      'smears across every bin; with Hann it collapses back to a line, and the floor here is ' +
      'dropped to −160 dB so the collapse is visible.',
    try: 'Set Window to hann — 1 kHz’s smear drops from −56 dB to below −140 dB.',
    chips: [
      { label: 'none', patch: { window: 'none' } },
      { label: 'hann', patch: { window: 'hann' } },
    ],
    patch: {
      sources: [mk(1, 'sine', 263, 1)],
      sampleRate: 8000,
      fftSize: 2048,
      window: 'none',
      floorDb: -160,
      timeSpanMs: 20,
      spanCycles: 5,
    },
  },

  // --------------------------------------------------------------- Filters
  {
    group: 'Filters',
    name: 'Low-pass a square',
    terms: ['harmonic', 'db', 'cutoff', 'transfer'],
    note:
      'Dim trace: the square before the filter; solid: after. The gap between them at each ' +
      'harmonic IS the blue response curve — the 3rd gives up 3.7 dB, the 5th 11 dB, and the ' +
      'corners round off. The peaks do not sit ON the curve, since a square’s harmonics ' +
      'already fall as 4/kπ.',
    try: 'Drag Cutoff to 300 Hz: the 3rd harmonic drops 24 dB below the fundamental.',
    chips: [
      blk1('300 Hz', { freq: 300 }, 'Only the fundamental gets through: nearly a sine'),
      blk1('700 Hz', { freq: 700 }),
      blk1('2 kHz', { freq: 2000 }, 'The square survives almost whole'),
    ],
    featured: [{ block: 1, field: 'freq' }],
    patch: {
      sources: [mk(1, 'square', 250, 1)],
      blocks: [bk(1, 'lowpass', { freq: 700, q: Math.SQRT1_2 })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
      showHarmonics: true,
      showGhost: true,
    },
  },
  {
    group: 'Filters',
    name: 'High-pass a square',
    terms: ['harmonic', 'cutoff'],
    note:
      'Same square, same 700 Hz corner as Low-pass a square, opposite survivor list: the ' +
      'fundamental is cut, the upper harmonics pass. On the scope the flat tops sag toward ' +
      'zero (a plateau is low frequency) while each edge survives as a sharp spike (an edge ' +
      'is the fastest change there is).',
    try: 'Drag Cutoff to 2 kHz — the plateaus flatten to zero; only the edge spikes remain.',
    chips: [blk1('700 Hz', { freq: 700 }), blk1('2 kHz', { freq: 2000 })],
    featured: [{ block: 1, field: 'freq' }],
    patch: {
      sources: [mk(1, 'square', 250, 1)],
      blocks: [bk(1, 'highpass', { freq: 700, q: Math.SQRT1_2 })],
      // 16 kHz, not 8: a high-pass lifts a square's upper harmonics, and at
      // 8 kHz the ones folded down from above Nyquist rode on the plateaus at
      // 22% of the sag this note asks the reader to look at. Doubling the rate
      // halves that (10%, and 3% at 32k) and leaves every precondition intact
      // — 250 Hz still divides the rate and still lands on a bin centre.
      sampleRate: 16000,
      timeSpanMs: 20,
      spanCycles: 3,
      showHarmonics: true,
      showGhost: true,
    },
  },
  {
    group: 'Filters',
    name: 'Resonance is Q',
    terms: ['q', 'cutoff', 'passband', 'db', 'butterworth'],
    // One claim. The band-pass switch (peak pinned at 0 dB, Q sets the width)
    // and the noise-trace-parallel-to-curve remark moved to the math panel.
    note:
      'The title is the claim: the resonant peak at the cutoff has height exactly Q — not ' +
      'proportional to it, equal. At Q = 10 it stands 20 dB (×10) above the passband. The ' +
      'source is white noise on purpose: it holds every frequency equally, so the spectrum ' +
      'paints the whole filter shape at once.',
    try: 'Drag Q to 1 — the peak flattens into the shoulder; at 20 it stands 26 dB.',
    chips: [
      blk1('0.707', { q: Math.SQRT1_2 }, 'Butterworth: −3 dB at the corner, no peak'),
      blk1('1', { q: 1 }, '0 dB at the corner: level with the passband'),
      blk1('10', { q: 10 }, '+20 dB'),
      blk1('20', { q: 20 }, '+26 dB'),
    ],
    featured: [{ block: 1, field: 'q' }],
    patch: {
      sources: [mk(1, 'noise', 100, 0.6)],
      blocks: [bk(1, 'lowpass', { freq: 800, q: 10 })],
      sampleRate: 8000,
      timeSpanMs: 20,
    },
  },
  {
    group: 'Filters',
    name: 'Phase is invisible here',
    terms: ['phase', 'groupdelay', 'allpass'],
    note:
      'An all-pass changes the scope waveform completely and leaves the spectrum untouched: ' +
      '|H| = 1 at every frequency, and the FFT throws phase away. The violet curve sweeps a ' +
      'full 360° while the magnitude never moves — that sweep is the entire content of this ' +
      'block.',
    try: 'Switch the overlay to delay — near 400 Hz the chain holds components up 26 samples.',
    chips: [
      { label: 'phase overlay', patch: { overlay: 'phase' } },
      { label: 'delay overlay', patch: { overlay: 'delay' } },
    ],
    patch: {
      sources: [mk(1, 'sine', 250, 0.6), mk(2, 'sine', 750, 0.3), mk(3, 'sine', 1250, 0.2)],
      blocks: [bk(1, 'allpass', { freq: 400, q: 2 })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
      overlay: 'phase',
    },
  },
  {
    group: 'Filters',
    name: 'Two filters are steeper',
    terms: ['order', 'cascade', 'attenuation', 'bypass', 'db'],
    note:
      'Two identical low-passes in series. Cascading multiplies the magnitudes, so the second ' +
      'section squares the response and doubles the attenuation in dB at every frequency — ' +
      'bypass one and the curve halves its slope. Noise is the source because it probes ' +
      'every frequency at once.',
    try: 'Bypass block 2 — at 3200 Hz, −78 dB becomes −39 dB: exactly half.',
    chips: [
      { label: 'one section', patch: { blocks: [{}, { bypass: true }] } },
      { label: 'both sections', patch: { blocks: [{ bypass: false }, { bypass: false }] } },
    ],
    patch: {
      sources: [mk(1, 'noise', 100, 0.6)],
      blocks: [
        bk(1, 'lowpass', { freq: 800, q: Math.SQRT1_2 }),
        bk(2, 'lowpass', { freq: 800, q: Math.SQRT1_2 }),
      ],
      sampleRate: 8000,
      timeSpanMs: 20,
    },
  },
  {
    group: 'Filters',
    name: 'Order is a choice',
    terms: ['order', 'q', 'butterworth', 'cascade', 'cutoff', 'db', 'octave'],
    note:
      'These two cascaded sections make a real 4th-order Butterworth: the Qs are 0.541 and ' +
      '1.307, NOT 0.707 twice. With both at 0.707 it is still 4th order with the same far ' +
      'slope — 24 dB/octave (80 dB/decade) — but the corner sags from −3 dB to −6, because a ' +
      'Butterworth needs a particular Q per section.',
    try: 'Set both Q to 0.707 — the corner sags from −3 dB to −6 dB.',
    chips: [
      {
        label: 'Butterworth 0.541 / 1.307',
        patch: { blocks: [{ params: { q: 0.5412 } }, { params: { q: 1.3066 } }] },
      },
      {
        label: '0.707 twice',
        patch: { blocks: [{ params: { q: Math.SQRT1_2 } }, { params: { q: Math.SQRT1_2 } }] },
      },
    ],
    featured: [
      { block: 1, field: 'q' },
      { block: 2, field: 'q' },
    ],
    patch: {
      sources: [mk(1, 'noise', 100, 0.6)],
      blocks: [
        bk(1, 'lowpass', { freq: 800, q: 0.5412 }),
        bk(2, 'lowpass', { freq: 800, q: 1.3066 }),
      ],
      sampleRate: 8000,
      timeSpanMs: 20,
    },
  },
  {
    group: 'Filters',
    name: 'Impulse response',
    terms: ['impulse', 'hH', 'delta', 'kernel', 'q', 'db'],
    note:
      'One sample, then silence. Its spectrum is flat, so whatever shape the spectrum has now ' +
      'was put there by the filter: the orange trace is the blue curve redrawn at the ' +
      'impulse’s own 2/N level, 60 dB down. The time view draws the impulse response itself ' +
      '— h(t) and H(f), one object from two sides.',
    try: 'Drag Q to 1 — the ringing dies within one cycle and the peak drops 12 dB.',
    chips: [blk1('1', { q: 1 }), blk1('4', { q: 4 }), blk1('10', { q: 10 })],
    featured: [{ block: 1, field: 'q' }],
    patch: {
      sources: [mk(1, 'impulse', 250, 1)],
      blocks: [bk(1, 'lowpass', { freq: 800, q: 4 })],
      sampleRate: 8000,
      window: 'none',
      timeSpanMs: 15,
      // The flat pre-chain spectrum is half the lesson: the gap between it and
      // the shaped trace IS |H(f)|.
      showGhost: true,
    },
  },
  {
    group: 'Filters',
    name: 'Step response and ringing',
    terms: ['q', 'cutoff', 'settling', 'damping', 'butterworth'],
    note:
      'A sudden jump, held. A gentle filter rounds the corner; a resonant one overshoots and ' +
      'rings at its cutoff before settling — this is what Q feels like in time. The overshoot ' +
      'stops at Q = 0.5 (critical damping), not at 0.707: the Butterworth Q is flattest in ' +
      'frequency yet still overshoots (4.3% ideal, 4.4% here).',
    try: 'Drag Q to 0.5 — the overshoot vanishes; at 0.707 it is still 4.4%.',
    chips: [
      blk1('0.5', { q: 0.5 }, 'Critical damping: no overshoot at all'),
      blk1('0.707', { q: Math.SQRT1_2 }, 'Butterworth: flattest in frequency, 4.4% over in time'),
      blk1('5', { q: 5 }),
    ],
    featured: [{ block: 1, field: 'q' }],
    patch: {
      sources: [mk(1, 'step', 250, 1)],
      blocks: [bk(1, 'lowpass', { freq: 400, q: 5 })],
      sampleRate: 8000,
      timeSpanMs: 40,
    },
  },

  // ----------------------------------------------------- FIR and the z-plane
  {
    group: 'FIR and the z-plane',
    name: 'A moving average is a filter',
    terms: ['kernel', 'taps', 'fir', 'notch'],
    note:
      'Average the last 8 samples and you have built a low-pass, no design needed. Noise ' +
      'makes its shape visible: deep nulls every 1000 Hz, the sample rate over 8. Summing a ' +
      'whole number of cycles of a sine gives exactly zero, so every frequency fitting whole ' +
      'cycles into the average is cancelled completely.',
    try: 'Drag Taps N to 16 — the nulls move in to every 500 Hz.',
    chips: [
      blk1('4', { taps: 4 }, 'Nulls every 2000 Hz'),
      blk1('8', { taps: 8 }, 'Nulls every 1000 Hz'),
      blk1('16', { taps: 16 }, 'Nulls every 500 Hz'),
    ],
    featured: [{ block: 1, field: 'taps' }],
    patch: {
      sources: [mk(1, 'noise', 100, 0.6)],
      blocks: [bk(1, 'movingavg', { taps: 8 })],
      sampleRate: 8000,
      timeSpanMs: 20,
    },
  },
  {
    group: 'FIR and the z-plane',
    name: 'Everything arrives together',
    terms: ['groupdelay', 'order', 'fir', 'taps', 'feedback', 'cutoff'],
    note:
      'A 61-tap FIR with the overlay on group delay: a flat line at exactly 30 samples. ' +
      'Every frequency is held up by the same amount, so the signal comes out late and ' +
      'otherwise unchanged; a biquad’s delay instead peaks sharply at the corner, which is ' +
      'why a filtered square rings there.',
    try: 'Drag Taps N to 121 — the delay line rises to exactly 60 samples, still flat.',
    chips: [
      blk1('31', { taps: 31 }, '15 samples'),
      blk1('61', { taps: 61 }, '30 samples'),
      blk1('121', { taps: 121 }, '60 samples'),
    ],
    featured: [{ block: 1, field: 'taps' }],
    patch: {
      sources: [mk(1, 'square', 250, 0.8)],
      blocks: [bk(1, 'fir', { taps: 61, freq: 1000, mode: 'lowpass', window: 'hamming' })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 3,
      overlay: 'delay',
    },
  },
  {
    group: 'FIR and the z-plane',
    name: 'The kernel is the filter',
    terms: ['kernel', 'convolution', 'lti', 'fir', 'taps', 'groupdelay', 'impulse', 'scalloping'],
    // The group-delay overlay is loaded, not merely mentioned: the old note
    // pointed at "the delay the overlay reports" with the overlay set to none.
    note:
      'The top pane is the Kernel view: the impulse response, two names for ONE sequence — ' +
      'what comes out when a single 1 goes in, and the weights convolution applies to the ' +
      'recent past. For an FIR the 31 stems ARE the filter. Its symmetry centre, tap 15, is ' +
      'exactly the delay the group-delay overlay reports.',
    try: 'Drag Taps N to 61 — the symmetry centre, and the delay, move to 30.',
    chips: [blk1('31', { taps: 31 }, 'Centre at tap 15'), blk1('61', { taps: 61 }, 'Centre at tap 30')],
    featured: [{ block: 1, field: 'taps' }],
    patch: {
      sources: [mk(1, 'sine', 300, 0.8), mk(2, 'sine', 1800, 0.5)],
      blocks: [bk(1, 'fir', { taps: 31, freq: 900, mode: 'lowpass', window: 'blackman' })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 4,
      timeView: 'impulse',
      overlay: 'delay',
    },
  },
  {
    group: 'FIR and the z-plane',
    name: 'Cut it off abruptly and it rings',
    terms: ['window', 'windownames', 'sinc', 'windowedsinc', 'brickwall', 'leakage', 'ripple', 'gibbs', 'taps', 'cutoff'],
    // Loads on the LINEAR amplitude scale: the 8% ripple is 0.7 dB — two
    // pixels on the dB axis — and the walk could not see the thing the
    // lesson exists to show.
    note:
      'The same design with the window set to none, on a linear scale. The ideal filter is a ' +
      'sinc running to infinity, so it is cut short — and cutting short IS a rectangular ' +
      'window, whose leakage puts 8% of overshoot beside the corner. More taps make the ' +
      'ripple narrower, never shorter: Gibbs again.',
    try: 'Set Taps N to 201 — the ripple narrows, not shorter. Set Window to hamming — gone.',
    chips: [
      blk1('101 taps', { taps: 101 }),
      blk1('201 taps', { taps: 201 }, 'Twice the taps: the same overshoot, half as wide'),
      blk1('hamming', { window: 'hamming' }, 'Taper the ends and the overshoot goes'),
    ],
    featured: [{ block: 1, field: 'taps' }],
    patch: {
      sources: [mk(1, 'noise', 100, 0.6)],
      blocks: [bk(1, 'fir', { taps: 101, freq: 1000, mode: 'lowpass', window: 'none' })],
      sampleRate: 8000,
      timeSpanMs: 20,
      scale: 'linear',
    },
  },
  {
    group: 'FIR and the z-plane',
    name: 'Zeros on the circle',
    terms: ['zplane', 'poles', 'kernel', 'taps', 'nyquist', 'rootsofunity'],
    // The time pane shows the KERNEL, not noise through the average: the
    // z-plane is the lesson, and twelve equal taps beside their twelve roots
    // is the pairing — a scribble of filtered noise was not (Reed's review).
    note:
      'The bottom pane is the z-plane: for a sampled filter the frequency axis is the unit ' +
      'circle, DC at z = 1 round to Nyquist at z = −1. The 11 circles are this 12-tap ' +
      'average’s zeros, exactly ON the rim, evenly spaced — each one an exact null. Above it, ' +
      'the kernel: 12 equal taps of 1/12.',
    try: 'Drag Taps N to 6 — five zeros, 60° apart. Add a low-pass: poles, as crosses.',
    // "Add a low-pass" is a chip, not a scroll to the Chain section: the
    // walk had to leave the lesson to do what the try line said.
    chips: [
      blk1('6', { taps: 6 }, 'Five zeros, 60° apart'),
      blk1('12', { taps: 12 }, 'Eleven zeros, 30° apart'),
      {
        label: 'add a low-pass',
        title: 'A resonant low-pass after the average: two poles appear as crosses, and the kernel grows a ringing tail',
        patch: { blocks: [{}, bk(2, 'lowpass', { freq: 800, q: 4 })] },
      },
    ],
    featured: [{ block: 1, field: 'taps' }],
    patch: {
      sources: [mk(1, 'noise', 100, 0.6)],
      blocks: [bk(1, 'movingavg', { taps: 12 })],
      sampleRate: 8000,
      timeSpanMs: 20,
      timeView: 'impulse',
      freqView: 'zplane',
    },
  },
  {
    // Lives here, not under Nonlinearity: a comb is LTI — it has an H(z) and
    // draws a solid curve — and its ring of roots is this group's climax.
    // Filed with the effects once, it sat as a counterexample inside a section
    // whose header says "where transfer functions stop working".
    group: 'FIR and the z-plane',
    name: 'Comb',
    terms: ['comb', 'notch', 'feedback', 'zplane', 'poles'],
    // τ is the delay in seconds, D the same delay in samples: the old note
    // used one letter for both and the walk could not tell 1/D Hz from 1/D
    // samples.
    note:
      'A delayed copy of the signal, added to itself, nearly cancels wherever the delay τ ' +
      'is an odd number of half-periods: notches every 1/τ = 250 Hz for τ = 4 ms (D = 32 ' +
      'samples), dipping to 1−g. In feedback mode the same delay resonates instead, peaks at ' +
      'the whole-period frequencies, midway between where the notches were.',
    try: 'Switch Type to feedback — the notches become peaks, midway between where they were.',
    chips: [
      blk1('feedforward', { mode: 'feedforward' }, 'Notches, dipping to 1−g'),
      blk1('feedback', { mode: 'feedback' }, 'Peaks of 1/(1−g), midway between the old notches'),
    ],
    featured: [{ block: 1, field: 'mode' }],
    patch: {
      sources: [mk(1, 'noise', 100, 0.6)],
      blocks: [bk(1, 'comb', { delayMs: 4, g: 0.9, mode: 'feedforward' })],
      sampleRate: 8000,
      timeSpanMs: 20,
    },
  },
  {
    group: 'FIR and the z-plane',
    name: 'Convolution, watched',
    terms: ['convolution', 'kernel', 'lti', 'taps'],
    // One claim, and it names the two strips the canvas now labels too.
    // Flat tops, ramp widths and warm-up moved to the math panel.
    note:
      'A square through an 8-tap moving average, one output sample at a time. Top strip: the ' +
      'input, with the kernel riding along FLIPPED — h[n−m], the detail everyone trips on; ' +
      'bottom: the output built so far, each dot one sum of the shaded products under the ' +
      'kernel.',
    try: 'Press play — inside each flat top the output sits at exactly 0.8, the amplitude.',
    chips: [
      blk1('4 taps', { taps: 4 }, 'Ramps 3 samples wide'),
      blk1('8 taps', { taps: 8 }, 'Ramps 7 samples wide'),
    ],
    patch: {
      sources: [mk(1, 'square', 250, 0.8)],
      blocks: [bk(1, 'movingavg', { taps: 8 })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 3,
      timeView: 'conv',
    },
  },

  // ---------------------------------------------------------- Nonlinearity
  {
    group: 'Nonlinearity',
    name: 'Clipping makes harmonics',
    terms: ['harmonic', 'transfer', 'memoryless', 'lti'],
    note:
      'Hard-clip a pure sine and odd harmonics appear — approaching 4c/(kπ) in the deep-clip ' +
      'limit, falling away faster at a clip this gentle. No filter is involved: the ' +
      'nonlinearity manufactures them. The response curve goes dashed because no transfer ' +
      'function can describe this block.',
    try: 'Drag Threshold to 1 — the clip never bites and every harmonic vanishes.',
    chips: [
      blk1('0.1', { threshold: 0.1 }, 'Deep clip: nearly a square'),
      blk1('0.3', { threshold: 0.3 }),
      blk1('1', { threshold: 1 }, 'The sine peaks at 1, so nothing is cut'),
    ],
    featured: [{ block: 1, field: 'threshold' }],
    patch: {
      sources: [mk(1, 'sine', 250, 1)],
      blocks: [bk(1, 'clip', { threshold: 0.3 })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
      showHarmonics: true,
    },
  },
  {
    group: 'Nonlinearity',
    name: 'DC breaks the symmetry',
    terms: ['harmonic', 'operatingpoint', 'memoryless'],
    note:
      'Same clipper, but the signal is offset first. A symmetric clip makes only odd ' +
      'harmonics; asymmetry brings in the even ones.',
    try: 'Drag DC offset to 0 — the even harmonics vanish.',
    chips: [blk1('0', { dcOffset: 0 }, 'Symmetric: odd harmonics only'), blk1('0.3', { dcOffset: 0.3 })],
    featured: [{ block: 1, field: 'dcOffset' }],
    patch: {
      sources: [mk(1, 'sine', 250, 1)],
      blocks: [bk(1, 'gain', { gainDb: 0, dcOffset: 0.3 }), bk(2, 'clip', { threshold: 0.4 })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
      showHarmonics: true,
    },
  },
  {
    group: 'Nonlinearity',
    name: 'Two tones, one nonlinearity',
    terms: ['intermod', 'harmonic', 'lti', 'bypass', 'order'],
    // The products named are the ones that are actually loudest. The old note
    // named 550, 900 and 50 Hz; the walk measured 100 Hz (−23.5 dB) and
    // 1050 Hz (−22.7 dB) as strong as those two and 50 Hz (−35.9 dB) as a
    // fifth-order afterthought. try.test.js measures all four now.
    note:
      'A linear block can only change how much of a frequency there is; a nonlinear one ' +
      'invents new ones. Clipping 250 and 400 Hz together makes 100 Hz (2·250−400), 550 ' +
      '(2·400−250), 900 (2·250+400) and 1050 Hz (2·400+250): third-order intermodulation ' +
      'products, harmonics of neither input. Avoiding them is most of why linearity is worth ' +
      'paying for.',
    try: 'Bypass the clipper — 100, 550, 900 and 1050 Hz all disappear.',
    chips: [
      { label: 'clipper bypassed', patch: { blocks: [{ bypass: true }] } },
      { label: 'clipper on', patch: { blocks: [{ bypass: false }] } },
    ],
    patch: {
      sources: [mk(1, 'sine', 250, 0.6), mk(2, 'sine', 400, 0.6)],
      blocks: [bk(1, 'clip', { threshold: 0.5 })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
    },
  },
  {
    group: 'Nonlinearity',
    name: 'Ring modulator',
    terms: ['carrier', 'sidebands'],
    note:
      'Multiply two signals and you get their sum and difference — 250 × 1000 gives 750 and ' +
      '1250, and neither original frequency survives. Nothing was filtered; the frequencies ' +
      'were moved.',
    try: 'Drag Carrier to 500 Hz — the lines move to 250 and 750 Hz.',
    chips: [blk1('500 Hz', { freq: 500 }, '250 and 750'), blk1('1000 Hz', { freq: 1000 }, '750 and 1250')],
    featured: [{ block: 1, field: 'freq' }],
    patch: {
      sources: [mk(1, 'sine', 250, 1)],
      blocks: [bk(1, 'ringmod', { freq: 1000 })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
    },
  },
  {
    group: 'Nonlinearity',
    name: 'AM: the carrier returns',
    terms: ['carrier', 'sidebands', 'dsbsc', 'modindex', 'envelope'],
    note:
      'The ring modulator alone is suppressed-carrier: the 1000 Hz carrier is missing from ' +
      'between its own sidebands. A DC offset before it brings the carrier back, because a ' +
      'constant multiplied by the carrier IS the carrier — the whole difference between ' +
      'broadcast AM and DSB-SC.',
    try: 'Drag DC offset to 0 — the 1000 Hz carrier leaves; 750 and 1250 Hz stay.',
    chips: [blk1('0', { dcOffset: 0 }, 'DSB-SC: sidebands only'), blk1('0.5', { dcOffset: 0.5 }, 'AM: the carrier is back')],
    featured: [{ block: 1, field: 'dcOffset' }],
    patch: {
      sources: [mk(1, 'sine', 250, 1)],
      blocks: [bk(1, 'gain', { gainDb: 0, dcOffset: 0.5 }), bk(2, 'ringmod', { freq: 1000 })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
    },
  },
  {
    group: 'Nonlinearity',
    name: '4 bits',
    terms: ['quantize', 'spurs', 'dither', 'snr', 'fullscale', 'db', 'harmonic'],
    note:
      'Quantize to 4 bits and the error is correlated with the signal: discrete spurs, not a ' +
      'noise floor. At 12 bits they sink but stay discrete, because this tone divides the ' +
      'sample rate exactly and the error repeats with it. Only dither breaks that grip: the ' +
      'spurs become the flat floor 6.02N + 1.76 dB assumed.',
    try: 'Drag Bits to 12 — the spurs sink but stay discrete; tick Dither — a flat floor.',
    chips: [
      blk1('4 bits', { bits: 4 }),
      blk1('12 bits', { bits: 12 }, 'Smaller spurs, still discrete'),
      blk1('dither', { dither: true }, 'The spurs become a flat floor'),
    ],
    featured: [{ block: 1, field: 'bits' }],
    patch: {
      sources: [mk(1, 'sine', 250, 1)],
      blocks: [bk(1, 'quantize', { bits: 4, dither: false })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
    },
  },
]
