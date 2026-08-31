import { BLOCK_TYPES } from './dsp/blocks.js'

// The lessons.
//
// Each preset is a question worth answering by looking at both plots at once,
// and each `note` makes a claim about physics. presets.test.js renders every one
// and measures whether the claim actually holds — two of them were wrong before
// that existed, and a confidently wrong explanation is worse here than a missing
// feature, because someone learns it and has no way to catch it.
//
// Grouped as a rough curriculum. Order within a group is the order to read them.

const mk = (id, type, freq, amp, phase = 0) => ({ id, type, freq, amp, phase, enabled: true })

const bk = (id, type, params) => ({
  id,
  type,
  bypass: false,
  params: { ...BLOCK_TYPES[type].defaults, ...params },
})

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
    patch: { sources: [mk(1, 'sine', 250, 1)], sampleRate: 8000, timeSpanMs: 20, spanCycles: 5 },
  },
  {
    group: 'Signals and Fourier',
    name: 'Square = odd harmonics',
    terms: ['harmonic', 'nyquist'],
    note:
      'A square wave is a sum of odd harmonics at 4A/(kπ). Turn on harmonic markers and count: ' +
      '1st, 3rd, 5th — and nothing between them. The flattening above 2 kHz is real, not a ' +
      'glitch: harmonics past Nyquist fold back and land on top of the ones below.',
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
      'has alone — while the spectrum shows two clean lines, each at exactly its own source’s ' +
      'amplitude, as if the other were not there. That is superposition, and it is why the ' +
      'sidebar can treat sources as independent: adding signals adds spectra, line by line. ' +
      'Untick one source and the other’s line does not move. It survives every LINEAR block ' +
      'too — filter this pair and each line is scaled by |H| at its own frequency — and it is ' +
      'precisely what nonlinear blocks break: see "Two tones, one nonlinearity", where a ' +
      'clipper makes this pair breed children at new frequencies.',
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
    terms: ['lti', 'superposition'],
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
    name: 'Aliasing',
    terms: ['sampled', 'aliasing', 'nyquist'],
    note:
      'A 3.4 kHz tone at 8 kHz behaves. Drag it past 4 kHz — or click the "alias" chip — and the ' +
      'peak turns around and walks back down. The signal is gone and an impostor took its place.',
    patch: { sources: [mk(1, 'sine', 3400, 1)], sampleRate: 8000, timeSpanMs: 5, spanCycles: 6 },
  },
  {
    group: 'Sampling',
    name: 'Exactly at Nyquist',
    terms: ['sampled', 'nyquist', 'phase'],
    note:
      'A 4 kHz tone sampled at 8 kHz: exactly two samples per cycle, the limit the sampling ' +
      'theorem allows. Now drag the phase. At 90° the samples land on the peaks and it reads ' +
      'full amplitude; at 0° they land on the zero crossings and the signal vanishes entirely. ' +
      'Same frequency, same amplitude, any answer you like — which is why "up to half the ' +
      'sample rate" is a bound you approach, not one you sit on. (The bright dots are the ' +
      'samples — the only thing that exists after sampling. The straight lines joining them ' +
      'are just the scope’s interpolation, which is why a sine at this extreme draws as a ' +
      'triangle.)',
    patch: {
      sources: [mk(1, 'sine', 4000, 1, Math.PI / 2)],
      sampleRate: 8000,
      timeSpanMs: 3,
      spanCycles: 8,
    },
  },
  {
    group: 'Sampling',
    name: 'Resolution needs time',
    terms: ['bin'],
    note:
      'Two tones 15 Hz apart, in a 512-point frame whose bins are 15.6 Hz wide. They fall in the ' +
      'same bin and read as one peak. Raise the FFT size in the top bar and they separate — ' +
      'telling two frequencies apart requires listening for long enough, and the frame length ' +
      'IS that listening time.',
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
      'at each harmonic IS the blue response curve: the 3rd is barely touched, the 5th is down ' +
      '11 dB, and in the time view the corners round off. (The peaks do not sit ON the curve — ' +
      "a square's harmonics already fall as 4/kπ before the filter sees them. Try \"Resonance " +
      'is Q", where the input is flat and they do.)',
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
    patch: {
      sources: [mk(1, 'square', 250, 1)],
      blocks: [bk(1, 'highpass', { freq: 700, q: Math.SQRT1_2 })],
      sampleRate: 8000,
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
    note:
      'The title is the claim, literally: the RESONANCE — that peak standing at the cutoff — ' +
      'has height exactly equal to Q. Not proportional to it; equal. At Q=10 it stands 20 dB ' +
      '(×10) above the flat passband; drag Q and watch the peak BE the number. The source is ' +
      'white noise on purpose: it holds every frequency equally, so the spectrum paints the ' +
      'whole filter shape at once and the orange trace lies on the blue curve. Then open the ' +
      'block and use its type select to switch it to band-pass: the peak stays pinned at 0 dB ' +
      'however hard you drag, because a band-pass is normalized to 1 at its centre — there Q ' +
      'sets the WIDTH instead. Same knob, two meanings; the low-pass is where peak height and ' +
      'Q are the same thing.',
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
      'was put there by the filter — the orange trace and the blue curve are the same curve. ' +
      'Meanwhile the time view is drawing the impulse response itself. h(t) and H(f) are one ' +
      'object seen from two sides, and this is the only preset that shows you both at once.',
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
      'frequency response and still overshoots by 4.3%, because flat in frequency and clean in ' +
      'time are two different requests.',
    patch: {
      sources: [mk(1, 'step', 250, 1)],
      blocks: [bk(1, 'lowpass', { freq: 400, q: 5 })],
      sampleRate: 8000,
      timeSpanMs: 40,
    },
  },

  // ---------------------------------------------------------- Nonlinearity
  {
    group: 'Nonlinearity',
    name: 'Clipping makes harmonics',
    note:
      'Hard-clip a pure sine and odd harmonics appear at 4c/(kπ) — no filter involved, the ' +
      'nonlinearity manufactures them. The response curve goes dashed because no transfer ' +
      'function can describe this: a nonlinear block does not have one.',
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
      'new ones. Clipping 250 Hz and 400 Hz together produces 900 Hz (2×400−250) and 50 Hz ' +
      '(3×250−2×400) — not harmonics of either input, but sums and differences of their ' +
      'harmonics. Bypass the clipper and every one of them disappears. This is intermodulation, ' +
      'and avoiding it is most of why linearity is worth paying for.',
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
    name: 'Comb',
    note:
      'Add a delayed copy of the signal to itself and it cancels at every frequency where the ' +
      'delay is half a period — notches every 1/D, evenly spaced. Switch it to feedback and the ' +
      'notches become resonances.',
    patch: {
      sources: [mk(1, 'noise', 100, 0.6)],
      blocks: [bk(1, 'comb', { delayMs: 4, g: 0.9, mode: 'feedforward' })],
      sampleRate: 8000,
      timeSpanMs: 20,
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
      'group-delay overlay reports. The math below says why the two names must coincide — and ' +
      'that it takes LTI to make them.',
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
    terms: ['zplane'],
    note:
      'The bottom pane now shows the z-plane. For a sampled filter the frequency axis is not a ' +
      'line — it is the unit circle, running from DC at z = 1 anticlockwise to Nyquist at ' +
      'z = −1, and that circle is the whole spectrum. The 11 circles are this filter’s zeros, ' +
      'and they sit exactly ON the rim, evenly spaced. A zero on the circle means the response ' +
      'at that angle is exactly zero — so the ring of marks and the comb of nulls in the ' +
      'spectrum are the same fact drawn twice. Add a resonant low-pass and its poles appear as ' +
      'crosses, pulled toward the rim as Q rises.',
    patch: {
      sources: [mk(1, 'noise', 100, 0.6)],
      blocks: [bk(1, 'movingavg', { taps: 12 })],
      sampleRate: 8000,
      timeSpanMs: 20,
      freqView: 'zplane',
    },
  },

  {
    group: 'FIR and the z-plane',
    name: 'Convolution, watched',
    terms: ['convolution', 'kernel', 'lti'],
    note:
      'A square through an 8-tap moving average, with the time pane switched to the ' +
      'convolution view. Drag the scrubber or press play: the kernel rides along the input ' +
      'FLIPPED — h[n−m], the one detail everyone trips on — and each output sample is the sum ' +
      'of the shaded products under it. Where the window sits wholly inside a half-period the ' +
      'average is exactly the amplitude, which is why the output has flat tops; the ramps ' +
      'between them are the window straddling an edge, and they are exactly N−1 samples wide. ' +
      'The first few samples ramp too — that is filter warm-up, seen for what it is: partial ' +
      'overlap.',
    patch: {
      sources: [mk(1, 'square', 250, 0.8)],
      blocks: [bk(1, 'movingavg', { taps: 8 })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 3,
      timeView: 'conv',
    },
  },

  {
    group: 'Nonlinearity',
    name: '4 bits',
    note:
      'Quantize to 4 bits and the error is correlated with the signal, so you get discrete spurs ' +
      'rather than a noise floor. Raise it to 12 and they smear into the flat floor that ' +
      '6.02N + 1.76 dB predicts. Tick dither at 4 bits to trade the spurs for honest noise.',
    patch: {
      sources: [mk(1, 'sine', 250, 1)],
      blocks: [bk(1, 'quantize', { bits: 4, dither: false })],
      sampleRate: 8000,
      timeSpanMs: 20,
      spanCycles: 5,
    },
  },
]
