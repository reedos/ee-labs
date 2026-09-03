import { BLOCK_TYPES } from './dsp/blocks.js'

// The lessons.
//
// Each preset is a question worth answering by looking at both plots at once,
// and each `note` makes a claim about physics. presets.test.js renders every one
// and measures whether the claim actually holds — two of them were wrong before
// that existed, and a confidently wrong explanation is worse here than a missing
// feature, because someone learns it and has no way to catch it.
//
// Each preset also carries:
//   try      — one imperative: the knob to touch and what should happen. Every
//              number in it is measured by presets.test.js, like the note's.
//   chips    — one-click settings (partial patches, see chips.js) so "set Q
//              to 1" is a click, not a search.
//   featured — the control the try line names, rendered under it so it is on
//              screen without scrolling (the fold probe in verify.mjs holds
//              this at laptop sizes). `{ source: id, field }` or
//              `{ block: id, field }`.
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
    terms: ['db', 'rms'],
    note: 'One sine, one line. The baseline everything else is read against.',
    try: 'This is the baseline. Next: Square adds only odd harmonics.',
    patch: { sources: [mk(1, 'sine', 250, 1)], sampleRate: 8000, timeSpanMs: 20, spanCycles: 5 },
  },
  {
    group: 'Signals and Fourier',
    name: 'Square = odd harmonics',
    terms: ['harmonic', 'nyquist'],
    note:
      'A square wave is a sum of odd harmonics falling as 1/k — 4A/(kπ), plus the small ' +
      'sampling correction the math panel carries. Turn on harmonic markers and count: ' +
      '1st, 3rd, 5th — and nothing between them. The flattening above 2 kHz is real, not a ' +
      'glitch: harmonics past Nyquist fold back and land on top of the ones below.',
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
    note:
      'A triangle has the same period as a square but no sudden jumps, and its harmonics fall ' +
      'as 1/k² instead of 1/k — the 3rd is a ninth of the fundamental rather than a third. ' +
      'Switch the source between triangle, square and sawtooth: the sharper the corner, the ' +
      'more high-frequency content it takes to build it.',
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
    note:
      'Three odd harmonics at 1, 1/3, 1/5 of the amplitude. Already square-ish. Add the 7th and ' +
      '9th to sharpen the corners — the Fourier series assembled by hand.',
    try: 'Click add 7th and 9th — the edges steepen; the overshoot narrows, never below 9%.',
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
    terms: ['superposition'],
    note:
      'Two tones, nothing else. The scope shows their sample-by-sample sum — a shape neither ' +
      'has alone — while the spectrum shows two clean lines, each at its own source’s ' +
      'amplitude, as if the other were not there. That is superposition, and it is why the ' +
      'sidebar can treat sources as independent: adding signals adds spectra, line by line. ' +
      'Untick one source and the other’s line does not move. It survives every LINEAR block ' +
      'too — filter this pair and each line is scaled by |H| at its own frequency — and it is ' +
      'precisely what nonlinear blocks break: see "Two tones, one nonlinearity", where a ' +
      'clipper makes this pair breed children at new frequencies.',
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
    terms: ['lti', 'superposition', 'sampled'],
    note:
      'The quiet assumption under this whole tool, made loud. This chain is LINEAR — meaning ' +
      'superposition (sums in give sums out, the previous preset) plus scaling (double the ' +
      'input, double the output) — and TIME-INVARIANT (shift the input in time, the output ' +
      'shifts identically: drag the source’s Phase slider and watch the filtered wave slide without ' +
      'changing shape). Any system with those two properties can do exactly ' +
      'one thing to a sine: scale it and shift it. It CANNOT change its frequency or add new ' +
      'ones — look at the spectrum: one line in, one line out, at the same place, through a ' +
      'strongly resonant filter. That is why a response curve fully describes a filter, why ' +
      'spectra can be read line by line, and why convolution works. Every block in the ' +
      'Nonlinearity group is interesting precisely because it breaks this.',
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
    terms: ['bin'],
    note:
      'Two tones 5 Hz apart. The spectrum shows two lines — the axis is zoomed to 500 Hz and ' +
      'the frame stretched to 8192 samples, because telling 250 from 255 takes both: a long ' +
      'enough look (bins under 1 Hz) and a close enough one (at full width the pair is one ' +
      'pixel). The scope shows the other truth: one tone whose envelope pulses at the 5 Hz ' +
      'difference. Same signal, two descriptions.',
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
    terms: ['sampled', 'nyquist'],
    // One claim. The interpolation-versus-information framing, the fraying
    // at the pane edges and the envelope wobble moved to the math panel.
    note:
      'A 3.4 kHz sine at 8 kHz: 2.35 samples per cycle. Dot-to-dot it looks mangled, yet RMS ' +
      'still reads 0.707 — nothing was lost. More than two samples per cycle is enough: the ' +
      'scope’s sin(x)/x curve through the dots IS the one signal they describe.',
    try: 'Drag Frequency to 3900 Hz — 2.05 samples per cycle, and the curve is still the sine.',
    chips: [
      src1('3400 Hz', { freq: 3400 }, '2.35 samples per cycle'),
      src1('3900 Hz', { freq: 3900 }, '2.05 samples per cycle — 100 Hz from the fold'),
    ],
    featured: [{ source: 1, field: 'freq' }],
    // 17 cycles = exactly 40 samples at this ratio, so the visible-span RMS
    // the readout actually averages lands on 0.7071 as the note promises. Six
    // cycles was 14.1 — a fractional cycle, and the readout said 0.671.
    patch: { sources: [mk(1, 'sine', 3400, 1)], sampleRate: 8000, timeSpanMs: 5, spanCycles: 17 },
  },
  {
    group: 'Sampling',
    name: 'Aliasing',
    terms: ['sampled', 'aliasing', 'nyquist'],
    note:
      'A 3.4 kHz tone at 8 kHz behaves. Drag it past 4 kHz — or click a chip — and the ' +
      'peak turns around and walks back down. The signal is gone and an impostor took its place.',
    try: 'Click 6000 Hz — the peak lands at 2000 Hz. Click 4600 — 3400 Hz, where it started.',
    chips: [
      src1('3400 Hz', { freq: 3400 }, 'Below Nyquist: its own representative'),
      src1('4600 Hz', { freq: 4600 }, '600 Hz past the fold — reads 3400, indistinguishable from the start'),
      src1('6000 Hz', { freq: 6000 }, '2000 Hz past the fold — reads 2000'),
    ],
    featured: [{ source: 1, field: 'freq' }],
    patch: { sources: [mk(1, 'sine', 3400, 1)], sampleRate: 8000, timeSpanMs: 5, spanCycles: 6 },
  },
  {
    group: 'Sampling',
    name: 'Turn the rate down',
    terms: ['sampled', 'aliasing', 'nyquist'],
    note:
      'The other lessons move the signal; this one moves the RATE, which is the knob you ' +
      'usually have. Three sines at 625, 1875 and 3125 Hz — an odd-harmonic stack — sampled at ' +
      '16 kHz, where all three sit well below Nyquist. Nothing here is approximate: the dots ' +
      'describe exactly this signal and the curve through them IS it. Now halve the rate in the ' +
      'top bar, and halve it again. At 4 kHz the 3125 Hz component no longer fits beneath ' +
      'Nyquist and folds to 875 Hz — a line at a frequency the signal never contained, and ' +
      'nothing in the samples can tell you it is an impostor. At 2 kHz the 1875 folds to 125 as ' +
      'well, and only the fundamental is left where it started. Notice what did NOT fail: the ' +
      'reconstruction draws the samples faithfully at every rate. What failed is that the ' +
      'samples stopped describing the signal you began with.',
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
    terms: ['sampled', 'nyquist', 'phase'],
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
    terms: ['sampled', 'nyquist', 'harmonic', 'aliasing'],
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
    terms: ['bin'],
    note:
      'Two tones 15 Hz apart, in a 512-point frame whose bins are 15.6 Hz wide. Closer together ' +
      'than one bin, they read as one peak. Raise the FFT size in the top bar and they separate — ' +
      'telling two frequencies apart requires listening for long enough, and the frame length ' +
      'IS that listening time.',
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
    terms: ['leakage', 'window'],
    note:
      'Window is set to "none". A tone that does not complete whole cycles in the frame smears ' +
      'across every bin. Switch to Hann in the top bar and watch it collapse back to a line.',
    try: 'Set Window to hann — the smear at 1 kHz drops from −56 dB to below −140.',
    chips: [
      { label: 'none', patch: { window: 'none' } },
      { label: 'hann', patch: { window: 'hann' } },
    ],
    patch: {
      sources: [mk(1, 'sine', 263, 1)],
      sampleRate: 8000,
      fftSize: 2048,
      window: 'none',
      timeSpanMs: 20,
      spanCycles: 5,
    },
  },

  // --------------------------------------------------------------- Filters
  {
    group: 'Filters',
    name: 'Low-pass a square',
    terms: ['harmonic', 'db'],
    note:
      'The dim trace is the square before the filter, the solid one after. The gap between them ' +
      'at each harmonic IS the blue response curve: the 3rd gives up 3.7 dB — a third of its ' +
      'amplitude — the 5th is down 11, and in the time view the corners round off. (The peaks ' +
      'do not sit ON the curve — ' +
      "a square's harmonics already fall as 4/kπ before the filter sees them. Try \"Resonance " +
      'is Q", where a flat input lets the trace draw the curve’s exact shape.)',
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
    terms: ['harmonic'],
    note:
      'The mirror of “Low-pass a square”: same square, same 700 Hz corner, opposite ' +
      'survivor list. The fundamental is cut, the upper harmonics pass — and the scope shows ' +
      'what that MEANS: the flat tops sag away toward zero (a plateau is low frequency — a ' +
      'stretch of not-changing), while each edge survives as a sharp alternating spike (an ' +
      'edge is the fastest change the signal has, built from the harmonics this filter ' +
      'keeps). A high-pass answers “where does the signal change?”. Compare the ghost: ' +
      'the square is still there in dim, and the gap between the traces at each harmonic IS ' +
      'the response curve.',
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
    terms: ['q'],
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
    terms: ['phase', 'groupdelay'],
    note:
      'An all-pass changes the scope waveform completely and leaves the spectrum untouched — ' +
      '|H| = 1 at every frequency, and the FFT throws phase away. The violet curve sweeps a ' +
      'full 360° while the magnitude never moves. That sweep is the entire content of this ' +
      'block. Switch the overlay to group delay to see the same fact as a time: the components ' +
      'near 400 Hz are held up by several samples more than the rest, which is precisely why ' +
      'the waveform changes shape while its spectrum does not.',
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
    terms: ['order'],
    note:
      'Two identical low-passes in series. Cascading multiplies the magnitudes, so the second ' +
      'one squares the response and doubles the attenuation in dB at every frequency. Bypass ' +
      'one with its power button and watch the curve halve its slope. (It also steepens near ' +
      '4 kHz for a separate reason: a digital filter has a zero at Nyquist that the textbook ' +
      'analogue prototype does not.) Two sections is a 4th-order filter — but not a 4th-order ' +
      'Butterworth, which needs a different Q in each. See "Order is a choice". Noise is the ' +
      'source because it probes every frequency at once — the doubling shows across the whole ' +
      'curve, not at one point.',
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
    terms: ['order', 'q'],
    note:
      'These two cascaded sections make a real 4th-order Butterworth: the Qs are 0.541 and ' +
      '1.307, NOT 0.707 twice. Set them both to 0.707 — still 4th order, still the same far ' +
      'slope, but the corner sags from −3 dB to −6, because a Butterworth needs a particular ' +
      'Q per section. The low-pass block also has an Order select now: bypass one section ' +
      'and set the other to 4th for this exact Butterworth built in — or to 1st, one bare ' +
      'pole that cannot resonate at all. The source is noise so the whole curve is measured ' +
      'at once; a single tone would only probe one point of it.',
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
    note:
      'One sample, then silence. Its spectrum is flat, so whatever shape the spectrum now has ' +
      'was put there by the filter — the orange trace is the blue curve redrawn at the ' +
      'impulse’s own low 2/N level, the same shape 60 dB down. ' +
      'Meanwhile the time view is drawing the impulse response itself. h(t) and H(f) are one ' +
      'object seen from two sides, here side by side.',
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
    note:
      'A sudden jump, held. A gentle filter rounds the corner; a resonant one overshoots and ' +
      'rings at its cutoff before settling. Drag Q down from 5 — this is what Q feels like in ' +
      'time, and it is easier to recognize here than as a bump on a curve. Note where the ' +
      'overshoot actually stops: at Q = 0.5, not at 0.707. The Butterworth Q gives the flattest ' +
      'frequency response and still overshoots — 4.3% in the ideal continuous prototype, a ' +
      'shade more as sampled here — because flat in frequency and clean in ' +
      'time are two different requests.',
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
    terms: ['kernel'],
    note:
      'Average the last 8 samples and you have built a low-pass — no design, no coefficients to ' +
      'look up. Noise makes its shape visible: deep nulls every 1000 Hz, which is the sample ' +
      'rate over 8. The reason needs no algebra. Summing a whole number of cycles of a sine ' +
      'gives exactly zero, so every frequency that fits a whole number of cycles into the ' +
      'window is cancelled completely. Drag N and watch the nulls move as fₛ/N.',
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
    terms: ['groupdelay', 'order'],
    note:
      'A 61-tap FIR, with the overlay switched to group delay: a flat line at exactly 30 ' +
      'samples. Every frequency is held up by the same amount, so the signal comes out late ' +
      'and otherwise unchanged. Now compare a biquad — its delay peaks sharply at the corner, ' +
      'which is why a filtered square rings there. No filter with feedback can have a flat ' +
      'group delay, and no FIR with a symmetric kernel can fail to. That is the entire trade: ' +
      '61 multiply-adds per sample against a biquad’s 5.',
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
    terms: ['kernel', 'convolution', 'lti'],
    note:
      'The top pane shows the Kernel view — the impulse response, and those are two names for ' +
      'ONE sequence: what comes out when a single 1 goes in, and the weights the convolution ' +
      'sum applies to the recent past. The stems are not a picture OF the filter — for an FIR ' +
      'they are the filter, the 31 numbers the design produced. Every output sample is this ' +
      'kernel flipped, slid to the current position, multiplied by the input underneath it and ' +
      'summed. That is convolution, the only description of filtering that covers FIR and IIR ' +
      'at once. Note where the symmetry centre falls: at tap 15, exactly the delay the ' +
      'group-delay overlay reports. And the baseline dots after the last tap are samples too — ' +
      'exactly zero, which is the point: an FIR forgets COMPLETELY, where an IIR’s baseline ' +
      'dots would be ringing too small to see. The math below says why the two names must ' +
      'coincide — and that it takes LTI to make them.',
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
    },
  },
  {
    group: 'FIR and the z-plane',
    name: 'Cut it off abruptly and it rings',
    terms: ['window'],
    note:
      'The same design with the window set to none. The ideal filter is a sinc running to ' +
      'infinity, so it has to be cut short — and cutting it short IS a rectangular window, ' +
      'whose leakage puts about 8% of overshoot beside the corner. Raise the taps to 201: the ' +
      'ripple gets NARROWER and no shorter, because it converges to a constant fraction of the ' +
      'step. This is Gibbs, the same phenomenon as the overshoot on a truncated square-wave ' +
      'series, seen in the other domain. Adding taps never fixes it; tapering the ends does.',
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
    },
  },
  {
    group: 'FIR and the z-plane',
    name: 'Zeros on the circle',
    terms: ['zplane', 'kernel'],
    // The time pane shows the KERNEL, not noise through the average: the
    // z-plane is the lesson, and twelve equal taps beside their twelve roots
    // is the pairing — a scribble of filtered noise was not (Reed's review).
    note:
      'The bottom pane is the z-plane: for a sampled filter the frequency axis is the unit ' +
      'circle, DC at z = 1 round to Nyquist at z = −1. The 11 circles are this 12-tap ' +
      'average’s zeros, exactly ON the rim, evenly spaced — each one an exact null. Above it, ' +
      'the kernel: 12 equal taps of 1/12.',
    try: 'Drag Taps N to 6 — five zeros, 60° apart. Add a low-pass: poles appear as crosses.',
    chips: [blk1('6', { taps: 6 }, 'Five zeros, 60° apart'), blk1('12', { taps: 12 }, 'Eleven zeros, 30° apart')],
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
    terms: ['zplane'],
    note:
      'Add a delayed copy of the signal to itself and it nearly cancels wherever the delay is ' +
      'an odd number of half-periods — notches every 1/D, evenly spaced, dipping to 1−g (a ' +
      'full null only at g = 1). Switch it to feedback and the same delay resonates instead — ' +
      'peaks at the whole-period frequencies, midway between where the notches were, because ' +
      'the comb has moved into the denominator. Open the z-plane view: this is "Zeros on the ' +
      'circle" again, D of them in a ring pulled just inside the rim at radius |g|^(1/D) — ' +
      'and in feedback mode the same ring is poles.',
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
    terms: ['convolution', 'kernel', 'lti'],
    // One claim, and it names the two strips the canvas no longer captions.
    // Flat tops, ramp widths and warm-up moved to the math panel.
    note:
      'A square through an 8-tap moving average, one output sample at a time. Top strip: the ' +
      'input, with the kernel riding along FLIPPED — h[n−m], the detail everyone trips on. ' +
      'Bottom: the output built so far. Each output dot is one sum of the shaded products ' +
      'under the kernel.',
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
    note:
      'Hard-clip a pure sine and odd harmonics appear — approaching 4c/(kπ) in the deep-clip ' +
      'limit, falling away faster at a clip this gentle — no filter involved, the ' +
      'nonlinearity manufactures them. The response curve goes dashed because no transfer ' +
      'function can describe this: a nonlinear block does not have one.',
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
    note:
      'Same clipper, but offset the signal first. A symmetric clip makes only odd harmonics; ' +
      'asymmetry brings in the even ones. Drag the DC offset to zero and watch them vanish.',
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
    note:
      'A linear block can only change how much of a frequency there is. A nonlinear one invents ' +
      'new ones. Clipping 250 Hz and 400 Hz together produces 550 Hz (2×400−250), 900 Hz ' +
      '(2×250+400) and 50 Hz (3×250−2×400) — not harmonics of either input, but sums and ' +
      'differences of their ' +
      'harmonics. Bypass the clipper and every one of them disappears. This is intermodulation, ' +
      'and avoiding it is most of why linearity is worth paying for.',
    try: 'Bypass the clipper — 550, 900 and 50 Hz all disappear.',
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
    note:
      'The ring modulator on its own is suppressed-carrier: the 1000 Hz carrier is missing from ' +
      'between its own sidebands. Add a DC offset before it and the carrier comes back, because ' +
      'a constant multiplied by the carrier IS the carrier. That is the whole difference ' +
      'between broadcast AM and DSB-SC. Drag the offset to zero and watch the middle line go.',
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
    note:
      'Quantize to 4 bits and the error is correlated with the signal, so you get discrete spurs ' +
      'rather than a noise floor. Raise it to 12 and the spurs shrink toward the bottom of the ' +
      'view — but they stay discrete and harmonic-locked, because this tone divides the sample ' +
      'rate exactly and the error repeats with it at any bit depth. Only dither breaks that ' +
      'grip: tick it and the spurs become the honest flat floor that 6.02N + 1.76 dB assumed ' +
      'all along.',
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
