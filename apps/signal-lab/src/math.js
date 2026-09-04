import { render, rms, sincInterp } from '@ee-labs/dsp'
import { applyChain, chainGroupDelay, chainImpulse, convKernel } from './dsp/chain.js'
import { BLOCK_TYPES } from './dsp/blocks.js'

// What is actually happening, for the preset currently loaded.
//
// Every entry may pair a formula with the number this tool just measured. That
// pairing is the point: a formula on its own is something to take on trust,
// while a formula beside a live measurement is something you can check — and if
// they ever stop agreeing, the panel says so instead of continuing to assert it.
//
// Entries are functions of the live context, not static text, so the numbers
// follow the sliders.

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })

// Values worked out from the current settings. NOT a check, and deliberately
// rendered without a tick: nothing is being compared, so a tick would be a
// tautology dressed as verification. Half this panel used to do exactly that —
// printing one number in both columns and marking it correct.
const V = (rows) => ({ kind: 'values', rows })

/** Enough digits to reproduce the arithmetic, not so many it becomes noise. */
const sig = (v, n = 6) => Number(v.toPrecision(n))

/** 1st, 3rd, 5th, 11th — the ordinal suffix, for naming a harmonic. */
const ord = (n) => {
  const t = n % 100
  if (t >= 11 && t <= 13) return 'th'
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'
}

/** The largest odd number not exceeding n — a square stops only on odd terms. */
const oddAtOrBelow = (n) => (n < 1 ? 0 : n % 2 === 1 ? n : n - 1)

/** Amplitude of a discrete square/triangle harmonic, including the sampling correction. */
const discreteBoost = (k, N) => (k * Math.PI) / N / Math.sin((k * Math.PI) / N)

// A predicted harmonic amplitude is only comparable against what is on screen
// when three things hold, and one slider can break any of them. When that
// happens the honest answer is to name the condition that broke — not to print
// a cross against a formula that is still perfectly correct.
//
//   1. The harmonic is below Nyquist. Above it there is no line to read, and
//      asking for one returns whatever happens to sit at the end of the axis.
//   2. f_s/f_0 is a whole number. The closed form sums a fixed number of
//      samples per period; with 13.33 of them it does not apply at all.
//   3. The harmonic sits on a bin centre. Otherwise the window straddles two
//      bins and reads the peak up to 1.4 dB low — scalloping loss, the same
//      effect the leakage preset exists to show.
const NOTE_ALIASED =
  'Above Nyquist: this harmonic has folded back onto a lower bin, so there is no line here to measure.'
const NOTE_NON_INTEGER =
  'fₛ/f₀ is not a whole number of samples per period, so the sampled closed form does not apply.'
const NOTE_OFF_BIN =
  'Not centered on an FFT bin, so the window reads this peak low — scalloping loss, not a wrong prediction.'
const NOTE_COARSE =
  'Fewer than 16 samples per period: the sampled waveform’s own correction differs between these two harmonics and skews the ratio away from the continuous law.'

/**
 * A row built from a block's response only holds while that block is
 * actually running. `chainResponse`/`respAt` follow bypass honestly — a
 * bypassed block contributes a flat |H| = 1 — so a row still comparing
 * against the block's OWN formula would print a cross against correct
 * physics the instant a student clicks its power button. Every |H|-shaped
 * check row that reads `ctx.respAt` for a single block gates on this first.
 */
const bypassNote = (b) =>
  b && b.bypass
    ? 'This block is bypassed — the chain passes the signal through untouched, so |H| reads 1 (0 dB) everywhere, not this row’s formula.'
    : null

/**
 * The Gibbs numbers for a hand-built square: the sources' partial sum
 * evaluated on a grid 64× finer than the sample rate, against the samples the
 * readout sees. Exported for try.test.js, which pins the note's 9.4 / 9.1 /
 * 8.95.
 */
export function gibbsOf(sources, sampleRate, over = 64) {
  const on = (sources || []).filter((s) => s.enabled && s.type === 'sine')
  const A = on.length ? on[0].amp : 1
  const f0 = on.length ? on[0].freq : 250
  const n = Math.max(2, Math.round(sampleRate / f0))
  const fine = render(on, n * over, sampleRate * over, 0)
  const coarse = render(on, n, sampleRate, 0)
  let finePeak = 0
  let samplePeak = 0
  for (const v of fine) finePeak = Math.max(finePeak, v)
  for (const v of coarse) samplePeak = Math.max(samplePeak, v)
  const plateau = (Math.PI / 4) * A
  return {
    terms: on.length,
    plateau,
    finePeak,
    samplePeak,
    overshootPct: ((finePeak - plateau) / (2 * plateau)) * 100,
  }
}

function harmonicCheck(ctx, k) {
  const f0 = ctx.sourceFreq
  const f = k * f0
  const N = ctx.sampleRate / f0
  const binHz = ctx.sampleRate / ctx.fftSize
  if (!(f0 > 0)) return NOTE_NON_INTEGER
  if (f >= ctx.sampleRate / 2) return NOTE_ALIASED
  if (Math.abs(N - Math.round(N)) > 1e-9) return NOTE_NON_INTEGER
  if (Math.abs(f / binHz - Math.round(f / binHz)) > 1e-6) return NOTE_OFF_BIN
  return null
}

// |H| at the first odd harmonics, measured as the RATIO of the two traces.
// Predicted through the block's own response() — which follows the ORDER
// select — not through designBiquad directly, which is order-2 only and
// would mark a 4th-order filter's correct physics wrong.
const harmonicRatioRows = (ctx) => {
  const b = ctx.blocks[0]
  if (!b) return []
  const def = BLOCK_TYPES[b.type]
  const noSource = !ctx.sources.some((s) => s.enabled)
  return [1, 3, 5].map((k) => {
    const f = (ctx.sourceFreq || 250) * k
    return {
      label: `|H| at ${f} Hz`,
      // Numerator and denominator are the same bin of the same window, so
      // scalloping divides straight out and only Nyquist can spoil this.
      unchecked:
        f >= ctx.sampleRate / 2
          ? NOTE_ALIASED
          : bypassNote(b) ||
            (noSource
              ? 'No source is enabled, so there is no line at this harmonic in either trace to take a ratio of.'
              : null),
      predicted: def.response(b.params, f, ctx.sampleRate),
      measured: ctx.dryAt ? ctx.at(f) / (ctx.dryAt(f) || 1e-12) : NaN,
      tol: 0.08,
    }
  })
}


const ENTRIES = {
  'Single tone': () => ({
    blocks: [
      T(
        'A sine has energy at exactly one frequency. Everything else in this tool is read ' +
          'against that fact.',
      ),
      F('x(t) = A\\sin(2\\pi f_0 t + \\varphi)'),
      T(
        'The spectrum plots amplitude in dB relative to 1.0, so an amplitude of 1 reads as ' +
          '0 dB. Phase does not appear at all — the FFT magnitude discards it.',
      ),
      F('\\text{dB} = 20\\log_{10}(A)'),
    ],
  }),

  'Sources simply add': (ctx) => {
    const [s1, s2] = ctx.sources
    // The try line says "untick source 2". A row whose premise is that source
    // must then footnote, not print ✗ against 1.4e-9 (the cold walk): the
    // line is absent because the student removed it, which is the lesson.
    const off = (s, i) =>
      s && s.enabled === false
        ? `Source ${i} is unticked, so there is no line at its frequency to read — the other line did not move, which is the point.`
        : null
    // Off a bin centre the Hann window reads the line a little low —
    // scalloping, not a broken sum. Named on the row rather than hidden in a
    // 3% tolerance, since the readout above the plot prints the low number.
    const binHz = ctx.sampleRate / ctx.fftSize
    const scallop = (s) =>
      s && Math.abs(s.freq / binHz - Math.round(s.freq / binHz)) > 0.15
        ? 'This tone sits between bin centres, so the tallest bin reads it a few percent low — scalloping loss; the row allows for it.'
        : null
    const row = (s, i) =>
      s
        ? {
            label: `line at ${sig(s.freq, 4)} Hz = source ${i}’s amplitude`,
            predicted: s.amp,
            measured: ctx.at(s.freq),
            tol: 0.04,
            unchecked: off(s, i),
          }
        : null
    return {
      blocks: [
        T('Adding signals is exact, sample by sample, and the Fourier transform is linear:'),
        F(
          'x[n] = x_1[n] + x_2[n] \\;\\Longrightarrow\\; X(f) = X_1(f) + X_2(f)',
        ),
        T(
          'So each line in the spectrum sits at its own source’s amplitude, untouched by the ' +
            'other — measured here, not assumed. This is the property every linear block ' +
            'preserves and every nonlinear one destroys.',
        ),
        C([row(s1, 1), row(s2, 2)].filter(Boolean)),
        ...(scallop(s1) || scallop(s2) ? [T(scallop(s1) || scallop(s2))] : []),
        V([
          {
            label: 'peak of the summed waveform can reach',
            value: (s1 ? s1.amp : 0) + (s2 && s2.enabled !== false ? s2.amp : 0),
            note: 'when the crests align, amplitudes add in time as well',
          },
        ]),
        // What the note used to say, now beside the numbers.
        T(
          'Untick one source and the other’s line does not move. Superposition survives every ' +
            'LINEAR block too — filter this pair and each line is scaled by |H| at its own ' +
            'frequency — and it is precisely what nonlinear blocks break: see "Two tones, one ' +
            'nonlinearity", where a clipper makes this pair breed children at new frequencies.',
        ),
      ],
    }
  },

  'Sines in, sines out': (ctx) => {
    const src = ctx.sources[0] || { freq: 700, amp: 0.8, phase: 0 }
    const fs = ctx.sampleRate

    // Claim 1, eigenfunction: through an LTI chain, ALL output energy stays at
    // the input's own frequency. Measured from the rendered spectrum: the
    // biggest line anywhere AWAY from f0 (and its skirt) against the line at f0.
    const at0 = ctx.at(src.freq)
    let worstOther = 0
    const binHz = fs / ctx.fftSize
    for (let f = binHz * 4; f < fs / 2; f += binHz * 2) {
      // Skip the line's own window skirt: a Hann mainlobe-plus-sidelobes
      // occupies a dozen bins around a strong line, and reading them as "new
      // frequencies" would blame the filter for the analysis window.
      if (Math.abs(f - src.freq) < binHz * 12) continue
      const v = ctx.at(f)
      if (v > worstOther) worstOther = v
    }

    // Claim 2, time-invariance: shift the input by a quarter period and the
    // output is the same waveform shifted by exactly the same amount. Measured
    // by rendering both through the real chain and comparing sample ranges.
    const period = fs / src.freq
    const shiftSamples = Math.round(period / 4)
    const shiftPhase = (2 * Math.PI * shiftSamples) / period
    const N = 1024
    const a = applyChain(ctx.blocks, render([{ ...src }], N + shiftSamples, fs, 0), fs, 0)
    const b = applyChain(
      ctx.blocks,
      render([{ ...src, phase: (src.phase || 0) + shiftPhase }], N + shiftSamples, fs, 0),
      fs,
      0,
    )
    // Compare well past the start-up transient (the two runs' transients differ
    // by the shift itself, and the residual decays as the pole radius to the
    // n-th): from sample 700 the comparison is machine-exact.
    let err = 0
    let scale = 1e-12
    for (let i = 700; i < N; i++) {
      err = Math.max(err, Math.abs(b[i] - a[i + shiftSamples]))
      scale = Math.max(scale, Math.abs(a[i + shiftSamples]))
    }

    // Linearity, measured as its two halves — in Reed's preferred names:
    // SUPERPOSITION (the response to a sum is the sum of the responses) and
    // SCALING (scale the input, the output scales by the same factor). Both
    // are machine-exact for this chain, because the arithmetic inside it is
    // nothing but multiplies and adds of the input.
    const x1 = render([{ ...src }], 400, fs, 0)
    const x2 = render([{ ...src, freq: src.freq * 1.7, phase: 1.1 }], 400, fs, 0)
    const xsum = new Float64Array(400)
    const xdouble = new Float64Array(400)
    for (let i = 0; i < 400; i++) {
      xsum[i] = x1[i] + x2[i]
      xdouble[i] = 2 * x1[i]
    }
    const y1 = applyChain(ctx.blocks, x1, fs, 0)
    const y2 = applyChain(ctx.blocks, x2, fs, 0)
    const ysum = applyChain(ctx.blocks, xsum, fs, 0)
    const ydouble = applyChain(ctx.blocks, xdouble, fs, 0)
    let addErr = 0
    let sclErr = 0
    let yScale = 1e-12
    for (let i = 0; i < 400; i++) {
      addErr = Math.max(addErr, Math.abs(ysum[i] - (y1[i] + y2[i])))
      sclErr = Math.max(sclErr, Math.abs(ydouble[i] - 2 * y1[i]))
      yScale = Math.max(yScale, Math.abs(y1[i]))
    }

    return {
      blocks: [
        T(
          '1. LINEAR, which is two promises. Superposition: feed a sum, get the sum of the ' +
            'individual responses. Scaling: double the input, get exactly double the output. ' +
            'Together:',
        ),
        F('x_1 \\to y_1,\\; x_2 \\to y_2 \\;\\Longrightarrow\\; a\\,x_1 + b\\,x_2 \\to a\\,y_1 + b\\,y_2'),
        T(
          'Why it matters: it is the licence to take a signal APART. Any signal is a sum of ' +
            'sines; linearity says you may push each sine through alone and add the answers — ' +
            'which is what reading a spectrum line by line, or multiplying by a response ' +
            'curve, quietly does. No linearity, no decomposition.',
        ),
        C([
          {
            label: 'superposition: |chain(x₁+x₂) − (y₁+y₂)|, worst sample',
            predicted: 0,
            measured: addErr / yScale,
            abs: 1e-12,
          },
          {
            label: 'scaling: |chain(2x) − 2y|, worst sample',
            predicted: 0,
            measured: sclErr / yScale,
            abs: 1e-12,
          },
        ]),
        T(
          '2. TIME-INVARIANT: the system has no clock of its own. Shift the input by k ' +
            'samples and the output shifts by exactly k samples, unchanged:',
        ),
        F('x[n] \\to y[n] \\;\\Longrightarrow\\; x[n-k] \\to y[n-k]'),
        T(
          'Why it matters: it makes |H(f)| a fixed property rather than a moment’s mood. A ' +
            'filter that treated Tuesday differently from Wednesday could not be summarized by ' +
            'one curve, and a sine pushed through it would not come out a sine.',
        ),
        C([
          {
            label: `time-invariance: shift input by ${shiftSamples} samples → output shifts by the same`,
            predicted: 0,
            measured: err / scale,
            abs: 1e-9,
          },
        ]),
        T(
          'Put the two together and a sine has nowhere to go. It must come out at its own ' +
            'frequency, merely scaled and shifted:',
        ),
        F(
          'A\\sin(2\\pi f t) \\;\\longrightarrow\\; |H(f)|\\,A\\sin\\bigl(2\\pi f t + \\angle H(f)\\bigr)',
        ),
        T(
          'Same frequency out, always — scaled by |H(f)|, shifted by the phase. Sines are the ' +
            'EIGENFUNCTIONS of LTI systems, and that is the entire reason frequency is the ' +
            'right language in this tool: describe what happens to each sine and you have ' +
            'described the system completely. Measured on this very chain:',
        ),
        C([
          {
            // The floor here is the WINDOW's sidelobes (about -55 dB for
            // Hann), not the chain: an LTI chain contributes exactly nothing.
            label: 'largest output away from the input frequency (window sidelobes set the floor)',
            predicted: 0,
            measured: worstOther / (at0 || 1e-12),
            abs: 0.005,
          },
        ]),
        T(
          'Every row above is exact to rounding (the last is limited only by the analysis ' +
            'window). Add a clipper and the FIRST two are what break — chain(2x) is no longer ' +
            '2·chain(x), and new lines appear at frequencies the input never contained.',
        ),
        // What the note used to say.
        T(
          'Drag the source’s Phase slider and watch the filtered wave slide without changing ' +
            'shape: that is time-invariance, seen. And because an LTI chain can only scale and ' +
            'shift a sine, a response curve fully describes a filter, spectra can be read line ' +
            'by line, and convolution works. Every block in the Nonlinearity group is ' +
            'interesting precisely because it breaks this.',
        ),
      ],
    }
  },

  'Square = odd harmonics': (ctx) => {
    const f0 = ctx.sourceFreq || 250
    const N = ctx.sampleRate / f0
    // The formula says 4A/kπ and the prediction must follow BOTH exposed
    // controls: the amplitude slider (this hard-coded A = 1 once, so halving
    // the amp crossed every row against correct physics) and the type select.
    const A = ctx.sourceAmp || 1
    const notSquare =
      ctx.sourceType !== 'square'
        ? 'The source is no longer a square wave, so the square-wave series does not apply.'
        : null
    // "3" and "9" band-limit the square to its first few terms (topHarmonic
    // in the source, the try line's own chips) — a harmonic above that cap is
    // not merely small, it is absent from the signal entirely, and the full
    // series' 4A/kπ would be a cross against a signal that was never built.
    const firstSrc = ctx.sources.find((s) => s.enabled)
    const topHarmonic = firstSrc ? firstSrc.topHarmonic || 0 : 0
    const rows = [1, 3, 5].map((k) => ({
      label: `harmonic ${k} (${k * f0} Hz)`,
      predicted: ((4 * A) / (k * Math.PI)) * discreteBoost(k, N),
      measured: ctx.at(k * f0),
      tol: 0.05,
      unchecked:
        notSquare ||
        harmonicCheck(ctx, k) ||
        (topHarmonic > 0 && k > topHarmonic
          ? `The source is band-limited to the ${topHarmonic}${ord(topHarmonic)} harmonic — this one was never built, so the full series' prediction does not apply.`
          : null),
    }))
    // Predicted exactly zero, so a relative tolerance cannot judge it. -80 dB
    // against a fundamental of 1.27 is unambiguously absent; what is actually
    // measured is nearer -134 dB.
    rows.push({
      label: 'harmonic 2 (absent)',
      predicted: 0,
      measured: ctx.at(2 * f0),
      abs: 1e-4 * Math.max(A, 0.1),
      unchecked: notSquare || harmonicCheck(ctx, 2),
    })
    return {
      blocks: [
        T('A square wave is an infinite sum of odd harmonics, falling as 1/k.'),
        F(
          'x(t) = \\frac{4A}{\\pi}\\sum_{m=0}^{\\infty} \\frac{\\sin\\bigl(2\\pi(2m+1)f_0 t\\bigr)}{2m+1}',
        ),
        T(
          'The even harmonics vanish because the wave is antisymmetric about half a period: ' +
            'x(t + T/2) = −x(t). Any component that repeated twice per period would have to ' +
            'survive that flip, and none can.',
        ),
        T(
          'A SAMPLED square is not quite the continuous series, though. Summing N samples per ' +
            'period instead of integrating multiplies each harmonic by a small factor' +
            // Live numbers, not the N = 32 values baked into prose: at other
            // sample rates or frequencies "0.2% and 4%" were simply wrong.
            (Number.isFinite(discreteBoost(1, N)) && Number.isFinite(discreteBoost(5, N)) && N > 5
              ? ` — ${sig((discreteBoost(1, N) - 1) * 100, 2)}% at the fundamental, ` +
                `${sig((discreteBoost(5, N) - 1) * 100, 2)}% by the fifth:`
              : ', growing with k:'),
        ),
        F('\\hat{A}_k = \\frac{4A}{k\\pi}\\cdot\\frac{k\\pi/N}{\\sin(k\\pi/N)}, \\qquad N = f_s/f_0'),
        T(
          `At ${f0} Hz there are ${Number(N.toFixed(3))} samples per period, and only ` +
            `harmonics below ${ctx.sampleRate / 2} Hz get a line of their own. Anything above ` +
            'that has folded back and is already counted inside the lines below — which is why ' +
            'the remaining values still match while the higher harmonics have no row.',
        ),
        C(rows),
      ],
    }
  },

  'Corners make harmonics': (ctx) => {
    const f0 = ctx.sourceFreq || 250
    return {
      blocks: [
        T(
          'How fast a waveform’s harmonics die away is set by how smooth it is. A jump in the ' +
            'wave itself gives 1/k; a jump only in its slope gives 1/k².',
        ),
        F(
          '\\text{square: } \\frac{4A}{k\\pi}\\;(k \\text{ odd}) \\qquad ' +
            '\\text{triangle: } \\frac{8A}{k^2\\pi^2}\\;(k \\text{ odd})',
        ),
        T(
          'So the ratio of the fundamental to the third harmonic is 3 for a square and 9 for a ' +
            'triangle. A sawtooth has 1/k like the square but keeps the even harmonics too, ' +
            'because it is not antisymmetric about half a period.',
        ),
        C([
          {
            label: 'fundamental / 3rd',
            predicted: ctx.sourceType === 'triangle' ? 9 : 3,
            measured: ctx.at(f0) / (ctx.at(3 * f0) || 1e-12),
            tol: 0.15,
            // Two different frequencies, so scalloping does not divide out —
            // both have to be cleanly measurable — and 3 and 9 are limits of
            // the CONTINUOUS series. With few samples per period the sampled
            // wave's own (k(pi)/N)/sin(k(pi)/N) correction differs between the
            // fundamental and the third and skews the ratio: 20% out for a
            // square at eight samples per period, 35% for a triangle.
            // And the law belongs to waveforms with corners: a sine has no
            // third harmonic at all, so the ratio there measures the noise
            // floor rather than anything this formula predicts.
            unchecked:
              (ctx.sourceType !== 'square' &&
              ctx.sourceType !== 'triangle' &&
              ctx.sourceType !== 'sawtooth'
                ? 'This source has no harmonic series for the decay law to describe — pick a square, triangle or sawtooth.'
                : null) ||
              harmonicCheck(ctx, 1) ||
              harmonicCheck(ctx, 3) ||
              (ctx.sampleRate / f0 < 16 ? NOTE_COARSE : null),
          },
        ]),
      ],
    }
  },

  'Build a square': (ctx) => {
    const g = gibbsOf(ctx.sources, ctx.sampleRate)
    return {
      blocks: [
        T(
          'Adding the first three odd harmonics at 1, 1/3 and 1/5 already gives something ' +
            'square-ish. The series converges, but not uniformly: the overshoot at each corner ' +
            'stays about 9% of the jump no matter how many terms you add, and merely gets ' +
            'narrower. That is the Gibbs phenomenon.',
        ),
        F('S_M(t) = \\frac{4A}{\\pi}\\sum_{m=0}^{M} \\frac{\\sin\\bigl(2\\pi(2m+1)f_0t\\bigr)}{2m+1}'),
        // (2/π)·Si(π) = 1.17898…: the partial sums overshoot the +A plateau by
        // 8.95% OF THE 2A JUMP, i.e. 0.179·A. The old line printed A·1.0895 —
        // the 8.95% applied to the wrong base, off by a factor of two, and
        // contradicting the "9% of the jump" sentence above it.
        F(
          '\\lim_{M\\to\\infty} \\max_t S_M(t) = \\frac{2A}{\\pi}\\,\\mathrm{Si}(\\pi) = A\\cdot 1.17898\\ldots',
        ),
        T(
          'The sources here carry 1, 1/3, 1/5 without the 4/π, so the square they build has ' +
            'height π/4 = 0.785 and the jump is twice that. Measured on the continuous sum, ' +
            'evaluated 64 times per sample — the readout’s "peak" reads the 32 samples per ' +
            'period the scope holds, and those miss the top of the overshoot lobe:',
        ),
        V([
          { label: 'plateau height (π/4)·A', value: g.plateau },
          { label: 'peak of the continuous sum (fine grid)', value: g.finePeak },
          { label: 'peak of the samples (the readout)', value: g.samplePeak, note: 'the lobe is narrower than a sample' },
          { label: 'overshoot, % of the jump', value: g.overshootPct, unit: '%', note: `${g.terms} term${g.terms === 1 ? '' : 's'}` },
          { label: 'Gibbs limit', value: 8.95, unit: '%', note: 'as the number of terms grows' },
        ]),
      ],
    }
  },

  Beating: (ctx) => {
    const fs = ctx.sources.filter((s) => s.enabled).map((s) => s.freq)
    const beat = fs.length >= 2 ? Math.abs(fs[0] - fs[1]) : 0
    return {
      blocks: [
        T('Two tones of equal amplitude add to a single tone at their mean, amplitude-modulated ' +
          'at half their difference:'),
        F(
          '\\sin(2\\pi f_1 t) + \\sin(2\\pi f_2 t) = ' +
            '2\\cos\\!\\left(2\\pi \\tfrac{f_1-f_2}{2} t\\right)\\sin\\!\\left(2\\pi \\tfrac{f_1+f_2}{2} t\\right)',
        ),
        T(
          'The envelope you see is that cosine, and because the ear (and the eye) responds to ' +
            'its magnitude, the loudness peaks twice per cycle of it — so the beat rate is the ' +
            'full difference, not half of it.',
        ),
        V([
          { label: 'beat rate', value: beat, unit: 'Hz' },
          { label: 'beat period', value: beat ? 1000 / beat : NaN, unit: 'ms' },
        ]),
      ],
    }
  },

  'Coarse, not undersampled': (ctx) => {
    const src = ctx.sources.find((x) => x.enabled)
    const f = src ? src.freq : 0
    const fs = ctx.sampleRate
    const nyq = fs / 2
    // The strongest claim on the page, measured live: reconstruct the signal
    // BETWEEN its samples and land on the continuous sine. An off-grid
    // instant at the centre of the frame, so the sinc window is two-sided —
    // and a 1024-sample window either side, because the truncated sum
    // converges slowly this close to the fold: at 3900 Hz a 256-sample window
    // missed by 0.010 against a 0.005 tolerance and printed ✗ (the cold
    // walk), where 1024 lands within 0.0025.
    const buf = render(ctx.sources.filter((x) => x.enabled), 4096, fs, 0)
    const t = 2048.37
    const truth = src ? src.amp * Math.sin((2 * Math.PI * f * t) / fs + src.phase) : 0
    const above = f >= nyq
    // The readout's RMS averages the VISIBLE span. The note promises 0.707,
    // which holds only when that span is a whole number of samples — the
    // chips keep it so (17 cycles of 3400 Hz = 40 samples); a dragged
    // frequency need not, and then the row says why instead of crossing.
    const span = ctx.state && ctx.state.spanCycles
    const nSpan = span && f > 0 ? (span / f) * fs : NaN
    const whole = Number.isFinite(nSpan) && Math.abs(nSpan - Math.round(nSpan)) < 1e-6
    const spanRms = whole ? rms(render(ctx.sources.filter((x) => x.enabled), Math.round(nSpan), fs, 0)) : NaN
    return {
      blocks: [
        T(
          'The sampling theorem’s promise, run forwards: for a signal with nothing above ' +
            'fₛ/2, MORE than two samples per cycle determines it completely. The samples do ' +
            'not store the shape — the shape is the only bandlimited curve through them:',
        ),
        F(
          'x(t) = \\sum_{n} x[n]\\,\\operatorname{sinc}\\!\\left(\\frac{t - nT}{T}\\right)',
          'Whittaker–Shannon reconstruction — the scope’s sin(x)/x curve',
        ),
        V([
          { label: 'samples per cycle', value: f > 0 ? fs / f : Infinity },
          { label: 'margin to the fold', value: nyq - f, unit: 'Hz' },
        ]),
        C([
          {
            label: `x(t) between samples, t = ${t} samples (sinc sum over ±1024)`,
            predicted: truth,
            measured: sincInterp(buf, t, 1024),
            tol: 0.01,
            abs: 0.005,
            unchecked: above
              ? 'at or above the fold the reconstruction lands on the alias instead — the Aliasing experiment takes it from here'
              : null,
          },
          {
            label: 'spectrum peak',
            predicted: above ? Math.abs(f - fs * Math.round(f / fs)) : f,
            measured: ctx.peakFreq,
            unit: 'Hz',
            tol: 0.02,
          },
          {
            label: `RMS over the visible span (${span || '?'} cycles${whole ? `, ${Math.round(nSpan)} samples` : ''})`,
            predicted: src ? src.amp * Math.SQRT1_2 : 0,
            measured: spanRms,
            tol: 0.002,
            unchecked: !Number.isFinite(nSpan)
              ? 'No periodic source, so no span in cycles.'
              : !whole
                ? `${span} cycles at this frequency is ${sig(nSpan, 4)} samples — a fraction of one, so the readout averages a partial cycle and reads off 0.707. The chips choose spans that are whole samples.`
                : null,
          },
        ]),
        // The rest of what the note used to say, now beside the numbers.
        T(
          'Coarse is an interpolation problem; undersampled — fewer than two samples per ' +
            'cycle — is an information problem. The sin(x)/x curve is exact mid-pane and frays ' +
            'only at the edges, where the sum runs out of neighbours. The slow wobble in the ' +
            'dots’ envelope is the sampling phase creeping toward the fold, the margin above ' +
            'away — Aliasing and Exactly at Nyquist take the story from there.',
        ),
      ],
    }
  },

  Aliasing: (ctx) => {
    const f = ctx.sourceFreq || 0
    const fs = ctx.sampleRate
    const folded = Math.abs(f - fs * Math.round(f / fs))
    return {
      blocks: [
        T(
          'Sampling cannot tell two frequencies apart if they agree at every sample instant. ' +
            'Every frequency therefore has an infinite family of impostors:',
        ),
        F('f_{\\text{apparent}} = \\left| f - f_s\\cdot\\operatorname{round}(f/f_s) \\right|'),
        T(
          'Below f_s/2 the tone is its own representative. Above it, the apparent frequency ' +
            'turns around and walks back down — which is why pushing the source up moves the ' +
            'peak the wrong way.',
        ),
        V([{ label: 'Nyquist', value: fs / 2, unit: 'Hz' }]),
        C([
          {
            label: 'apparent frequency',
            predicted: folded,
            measured: ctx.peakFreq,
            unit: 'Hz',
            tol: 0.02,
          },
        ]),
      ],
    }
  },

  'Turn the rate down': (ctx) => {
    const fs = ctx.sampleRate
    const nyq = fs / 2
    const binHz = fs / ctx.fftSize
    const on = ctx.sources.filter((s) => s.enabled)
    // Where a component appears once the rate can no longer hold it: the
    // nearest multiple of fs is subtracted off, and what is left is the
    // distance to it. Below Nyquist that distance IS the frequency, which is
    // why the same formula covers the honest case and the folded one.
    const fold = (f) => Math.abs(f - fs * Math.round(f / fs))
    const rows = on.map((s) => {
      const f = fold(s.freq)
      const under = s.freq < nyq
      // Two components can land in one bin at some rates, and a fold onto DC
      // or exactly Nyquist changes what a single-sided spectrum counts. Both
      // are true physics the row cannot read, so both are named.
      const collides = on.some((o) => o !== s && Math.abs(fold(o.freq) - f) < 2 * binHz)
      const edge = f < 2 * binHz || Math.abs(f - nyq) < 2 * binHz
      return {
        label: under
          ? `${sig(s.freq, 4)} Hz — under Nyquist, still itself`
          : `${sig(s.freq, 4)} Hz folds down to ${sig(f, 4)} Hz`,
        predicted: s.amp,
        measured: ctx.at(f),
        tol: 0.06,
        unchecked: collides
          ? 'Two components land in the same bin at this rate, so the line there is their sum and not either one alone.'
          : edge
            ? 'This one lands on DC or exactly on Nyquist, where a single-sided spectrum counts amplitude differently.'
            : null,
      }
    })
    return {
      blocks: [
        T(
          'Sampling cannot tell a frequency from that same frequency plus any whole number of ' +
            'sample rates: both produce identical samples. So a component above Nyquist does not ' +
            'go missing, it comes back wearing the identity of a lower one.',
        ),
        F('f_{\\text{apparent}} = \\bigl|\\,f - f_s\\cdot\\mathrm{round}(f/f_s)\\,\\bigr|'),
        T(
          'While every component sits below Nyquist that expression returns the frequency ' +
            'itself, nothing has been lost, and the reconstruction through the samples is the ' +
            'signal exactly. The moment one crosses, its line moves — and the samples carry no ' +
            'record of where it came from.',
        ),
        C(rows),
        // What the note used to say.
        T(
          'Nothing here is approximate at 16 kHz: the dots describe exactly this signal and ' +
            'the curve through them IS it. At 2 kHz the 1875 folds to 125 as well, and only ' +
            'the fundamental is left where it started. Notice what did NOT fail: the ' +
            'reconstruction draws the samples faithfully at every rate. What failed is that ' +
            'the samples stopped describing the signal you began with — and nothing in them ' +
            'can tell you a folded line is an impostor.',
        ),
        V([
          { label: 'sample rate', value: fs, unit: 'Hz' },
          { label: 'Nyquist', value: nyq, unit: 'Hz' },
          {
            label: 'components still under it',
            value: on.filter((s) => s.freq < nyq).length,
            note: `of ${on.length}`,
          },
          { label: 'highest component', value: Math.max(...on.map((s) => s.freq)), unit: 'Hz' },
          {
            label: 'rate needed to keep them all',
            value: 2 * Math.max(...on.map((s) => s.freq)),
            unit: 'Hz',
            note: 'twice the highest, the sampling theorem, as a shopping list',
          },
        ]),
      ],
    }
  },

  'A square that fits': (ctx) => {
    const src = ctx.sources.find((s) => s.enabled && s.type === 'square')
    // K is the highest odd harmonic kept; the series holds (K+1)/2 terms.
    const K = src ? oddAtOrBelow(Math.round(Number(src.topHarmonic) || 0)) : 0
    const f0 = src ? src.freq : ctx.sourceFreq || 0
    const A = src ? src.amp : 1
    const fs = ctx.sampleRate
    const nyq = fs / 2
    const binHz = fs / ctx.fftSize
    const top = K * f0
    const fold = (f) => Math.abs(f - fs * Math.round(f / fs))

    if (!src || K <= 0) {
      // The reader has set it back to the ideal square, which the note asks
      // for.
      // The band-limited arithmetic does not describe this signal, so the
      // panel says what changed rather than printing rows about a series
      // that no longer terminates.
      return {
        blocks: [
          T(
            'The source is a full square wave again — the series runs to infinity, so there is ' +
              'no highest frequency to sample twice and no rate that makes this exact. Every ' +
              'harmonic above Nyquist folds down and lands somewhere in the spectrum below, ' +
              'which is the floor now filling the gaps between the lines.',
          ),
          F(
            'x(t) = \\frac{4A}{\\pi}\\sum_{m=0}^{\\infty} \\frac{\\sin\\bigl(2\\pi(2m+1)f_0 t\\bigr)}{2m+1}',
          ),
          T(
            'Now look at the TRACE: it got cleaner, not rougher — corners sharp, tops flat — ' +
              'while the spectrum filled with a forest of folded lines. That is not fewer ' +
              'harmonics, it is more. The ideal generator samples the shape itself rather than ' +
              'summing terms, so every sample sits exactly on ±A and all that folded content ' +
              'hides inside a trace with nothing visibly wrong with it. Which is the real ' +
              'lesson: aliasing is not something you can count on seeing.',
          ),
          T(
            'Set "Highest harmonic" to a number and the sum stops there. That is the only ' +
              'difference between a signal the sampling theorem can serve and one it cannot.',
          ),
        ],
      }
    }

    // The first odd harmonic that no longer fits: raise the field to it and
    // it folds back between the lines. Computed from the live settings, so
    // the number is right at any fundamental or rate.
    let kFold = 1
    while (kFold * f0 <= nyq && kFold < 10001) kFold += 2
    const fFold = kFold * f0

    // Every harmonic in the series, checked where it actually lands.
    const rows = []
    for (let k = 1; k <= K; k += 2) {
      const f = k * f0
      const above = f > nyq
      const at = fold(f)
      // A fold landing on another harmonic adds to it rather than appearing
      // alone, and then neither line is either one by itself.
      let collides = false
      for (let kj = 1; kj <= K; kj += 2) {
        if (kj !== k && Math.abs(fold(kj * f0) - at) < 2 * binHz) collides = true
      }
      rows.push({
        label: above
          ? `harmonic ${k} (${sig(f, 5)} Hz) — folds to ${sig(at, 5)} Hz`
          : `harmonic ${k} (${sig(f, 5)} Hz)`,
        // The generator sums sines exactly, so there is no sampled-square
        // correction here: the coefficient is the continuous one.
        predicted: (4 * A) / (k * Math.PI),
        measured: ctx.at(at),
        tol: 0.05,
        unchecked: collides
          ? 'This one folds onto another harmonic, so the line there is their sum and not either alone.'
          : at < 2 * binHz || Math.abs(at - nyq) < 2 * binHz
            ? 'Lands on DC or exactly on Nyquist, where a single-sided spectrum counts amplitude differently.'
            : Math.abs(at / binHz - Math.round(at / binHz)) > 1e-6
              ? NOTE_OFF_BIN
              : null,
      })
    }
    // The claim that makes this preset different from every other one: past
    // the last harmonic there is nothing, and nothing is a measurable value.
    if (top < nyq) {
      let mx = 0
      for (let i = 0; i < ctx.freqs.length; i++) {
        if (ctx.freqs[i] > top + 4 * binHz && ctx.amps[i] > mx) mx = ctx.amps[i]
      }
      rows.push({
        label: `everything above ${sig(top, 5)} Hz (nothing)`,
        predicted: 0,
        measured: mx,
        abs: 1e-4 * Math.max(A, 0.1),
      })
    }

    return {
      blocks: [
        T(
          `Stop the square's series at the ${K}${ord(K)} harmonic and it becomes a different ` +
            'kind of object: one with a highest frequency. That is the property the sampling ' +
            'theorem is actually about — not smoothness, not shape, just whether there is a ' +
            'frequency above which the signal is silent.',
        ),
        F(
          `x(t) = \\frac{4A}{\\pi}\\sum_{\\substack{k=1\\\\k\\text{ odd}}}^{${K}} ` +
            '\\frac{\\sin(2\\pi k f_0 t)}{k}, \\qquad f_{\\max} = k_{\\max} f_0',
        ),
        T(
          'And the theorem is an inequality, strictly: at exactly twice the highest frequency ' +
            'the samples land at one fixed phase of it and can read anything from full ' +
            'amplitude down to zero, which is what "Exactly at Nyquist" demonstrates.',
        ),
        F('f_s > 2f_{\\max}'),
        T(
          top < nyq
            ? `Raise the highest harmonic to ${kFold}: that harmonic lands at ${sig(fFold, 5)} Hz, ` +
                `past the ${sig(nyq, 5)} Hz Nyquist, and reappears at ${sig(fold(fFold), 5)} Hz — ` +
                'between harmonics, where nothing belongs, and no measurement of the samples can ' +
                'tell you it does not. Then press "ideal" for the real square and watch the trace ' +
                'get cleaner as the spectrum fills.'
            : 'The top of this series is already past Nyquist: the rows below say where each ' +
                'harmonic that no longer fits has landed. Press "ideal" for the real square and ' +
                'watch the trace get cleaner as the spectrum fills.',
        ),
        V([
          {
            label: 'highest harmonic kept',
            value: K,
            note: `${(K + 1) / 2} term${K === 1 ? '' : 's'} — the odd harmonics 1 through ${K}`,
          },
          { label: 'highest frequency present', value: top, unit: 'Hz' },
          { label: 'rate this demands', value: 2 * top, unit: 'Hz', note: 'strictly above' },
          {
            label: 'rate in use',
            value: fs,
            unit: 'Hz',
            note:
              fs > 2 * top
                ? 'clears it — the samples describe this signal exactly, and the curve through them is it'
                : fs === 2 * top
                  ? 'exactly twice it: the excluded case, where the answer depends on sampling phase'
                  : `short by ${sig(2 * top - fs, 4)} Hz — the top harmonics have folded`,
          },
        ]),
        C(rows),
      ],
    }
  },

  'Exactly at Nyquist': (ctx) => {
    const src = ctx.sources.find((s) => s.enabled)
    const phi = src ? src.phase : 0
    return {
      blocks: [
        T(
          'At exactly two samples per cycle, consecutive samples are half a period apart. The ' +
            'sampled sequence is then',
        ),
        F('x[n] = A\\sin(\\pi n + \\varphi) = A\\,(-1)^n \\sin\\varphi'),
        T(
          'The measured amplitude is A·|sin φ|, so it depends entirely on where the samples ' +
            'happen to fall. At φ = 90° they hit the peaks and you recover A; at φ = 0° they ' +
            'hit the zero crossings and the tone disappears completely. The sampling theorem ' +
            'requires f strictly below f_s/2 for exactly this reason.',
        ),
        V([
          { label: 'samples per cycle', value: src && src.freq > 0 ? ctx.sampleRate / src.freq : Infinity },
          { label: 'phase φ', value: (phi * 180) / Math.PI, unit: '°' },
        ]),
        C([
          {
            label: 'A·|sin φ|',
            predicted: Math.abs(Math.sin(phi)) * (src ? src.amp : 1),
            measured: ctx.at(ctx.sampleRate / 2),
            tol: 0.05,
            // At φ = 0° the theory is exactly 0 and the measurement is
            // rounding dust (3.7e-13). A relative tolerance of zero is no
            // tolerance; the floor is set by the signal's own scale — one
            // part in a thousand of A — not by an unrelated constant.
            abs: 1e-3 * (src ? src.amp : 1),
          },
        ]),
        // What the note used to add: the bound, and what the scope draws.
        T(
          'Same frequency, same amplitude, any answer you like — which is why "up to half the ' +
            'sample rate" is a bound you approach, not one you sit on. The scope’s sin(x)/x ' +
            'reconstruction through the dots follows the phase honestly: full height at 90°, ' +
            'a flat line at 0°. The dots are the only thing that exists after sampling; the ' +
            'curve is the scope’s own reading of them.',
        ),
      ],
    }
  },

  'Resolution needs time': (ctx) => {
    const binHz = ctx.sampleRate / ctx.fftSize
    const fs = ctx.sources.filter((s) => s.enabled).map((s) => s.freq)
    const sep = fs.length >= 2 ? Math.abs(fs[0] - fs[1]) : 0
    const frameMs = (1000 * ctx.fftSize) / ctx.sampleRate
    const beatMs = sep ? 1000 / sep : Infinity
    // The merged peak's height, live. At 512 points the frame (64 ms) is
    // almost exactly one beat period (66.7 ms), and the Hann window weights
    // the middle of the frame — where the two tones are in antiphase and
    // cancel. So the one peak reads 0.25 for two 0.5 sources, and the walk
    // had nothing to explain it. Named here, measured.
    let top = 0
    for (let i = 0; i < ctx.amps.length; i++) if (ctx.amps[i] > top) top = ctx.amps[i]
    const nearBeat = Number.isFinite(beatMs) && Math.abs(frameMs - beatMs) < 0.15 * beatMs
    return {
      blocks: [
        T('A frame of N samples at rate f_s lasts T = N/f_s seconds, and its bins are'),
        F('\\Delta f = \\frac{f_s}{N} = \\frac{1}{T}'),
        T(
          'Two tones closer than about one bin cannot be separated, however you window the ' +
            'frame. Frequency resolution is not a property of the algorithm — it is a property ' +
            'of how long you looked. To resolve 15 Hz you must observe for at least 1/15 s.',
        ),
        V([
          { label: 'bin width', value: binHz, unit: 'Hz' },
          { label: 'frame length', value: frameMs, unit: 'ms' },
          { label: 'tone separation', value: sep, unit: 'Hz' },
          { label: 'bins between them', value: sep / binHz },
          { label: 'beat period 1/Δf', value: beatMs, unit: 'ms' },
          {
            label: 'height of the tallest peak',
            value: top,
            note: nearBeat
              ? 'low: the frame is one beat period, and the Hann window weights its middle — where the two tones are in antiphase and cancel'
              : 'each tone at its own amplitude once the frame holds several beats',
          },
        ]),
      ],
    }
  },

  'Spectral leakage': (ctx) => ({
    blocks: [
      T(
        'The DFT assumes the frame repeats forever. A tone that does not fit a whole number of ' +
          'cycles therefore has a step at the joint, and that step is broadband — it lands in ' +
          'every bin.',
      ),
      F('k = \\frac{f_0 N}{f_s} \\quad\\text{integer} \\iff \\text{no leakage}'),
      T(
        'A window tapers the frame to zero at both ends so there is no step to smear. It costs ' +
          'resolution — the main lobe widens — and buys enormous sidelobe rejection: about ' +
          '−31 dB for Hann against −13 dB for no window at all.',
      ),
      V([
        {
          label: 'cycles in the frame',
          value: (ctx.sourceFreq * ctx.fftSize) / ctx.sampleRate,
          note: 'a whole number means no leakage',
        },
      ]),
    ],
  }),

  'High-pass a square': (ctx) => {
    const rows = harmonicRatioRows(ctx)
    return {
      blocks: [
        T(
          'The same multiplication as the low-pass lesson, mirrored: the output spectrum is ' +
            'the input spectrum times the filter, bin by bin — and this filter keeps the TOP ' +
            'of the series instead of the bottom.',
        ),
        // Double backslash, or JS eats it and the page typesets a literal
        // comma: "Y(f) = H(f),X(f)". A test now greps the source for the
        // single-backslash form of every spacing macro.
        F('Y(f) = H(f)\\,X(f)'),
        T(
          'The time view is the real lesson. A plateau is a stretch of not-changing — low ' +
            'frequency — so the flat tops die toward zero. An edge is the fastest change the ' +
            'signal has — built from the high harmonics — so the transitions survive as ' +
            'alternating spikes. A high-pass answers “where does the signal CHANGE?”, which ' +
            'is why its cousins live in edge detectors.',
        ),
        C(rows),
        // What the note used to say.
        T(
          'Compare the ghost: the square is still there in dim, and the gap between the ' +
            'traces at each harmonic IS the response curve.',
        ),
      ],
    }
  },

  'Low-pass a square': (ctx) => {
    const rows = harmonicRatioRows(ctx)
    return {
      blocks: [
        T('The output spectrum is the input spectrum multiplied by the filter, bin by bin:'),
        F('Y(f) = H(f)\\,X(f)'),
        T(
          'So the measured peaks do NOT sit on the response curve — they sit on the input ' +
            'spectrum times the curve, and a square’s input spectrum is already sloping down ' +
            'as 4/kπ. What equals |H(f)| is the RATIO of the two traces, which is why the ' +
            'pre-chain ghost is switched on here.',
        ),
        F('|H(f)| = \\frac{|Y(f)|}{|X(f)|} \\quad\\text{(the gap between the traces)}'),
        C(rows),
        // What the note used to say.
        T(
          'Try "Resonance is Q", where a flat (noise) input lets the trace draw the curve’s ' +
            'exact shape instead of the input spectrum times it.',
        ),
      ],
    }
  },

  'Resonance is Q': (ctx) => {
    const b = ctx.blocks[0]
    const rows = []
    if (b) {
      // Read off the blue curve the app is actually drawing, rather than
      // recomputing biquadResponse here. Recomputing would still compare two
      // different code paths — the Q setting against the RBJ design — but it
      // would not be checking anything the reader can see, and a row whose
      // "measured" side is invisible is halfway to a tautology already.
      //
      // And the prediction follows the block's OWN controls — the note tells
      // the reader to switch the type to band-pass, and the order select is
      // three lines below the Q. Each variant is a different true claim, not
      // the second-order one marked wrong.
      const peak = ctx.respAt(b.params.freq)
      const order = Number(b.params.order ?? 2)
      const cornered = (b.type === 'lowpass' || b.type === 'highpass') && order !== 2
      const expect =
        b.type === 'bandpass'
          ? { v: 1, why: 'band-pass: pinned at 1 whatever Q says — Q sets the width here' }
          : b.type === 'notch'
            ? { v: 0, why: 'notch: exactly zero at the centre', abs: 0.02 }
            : b.type === 'allpass'
              ? { v: 1, why: 'all-pass: |H| is 1 everywhere — only the phase moves, whatever Q says' }
              : b.type === 'peaking'
                ? {
                    v: Math.pow(10, (b.params.gainDb || 0) / 20),
                    why: 'peaking: the peak is the GAIN setting, not Q, Q sets the width here',
                  }
                : cornered
                  ? {
                      v: Math.SQRT1_2,
                      why:
                        order === 1
                          ? 'order 1: one pole cannot resonate — the corner sits at −3.01 dB'
                          : 'order 4 Butterworth: −3.01 dB at the corner, whatever the order',
                    }
                  : b.type === 'lowpass' || b.type === 'highpass'
                    ? { v: b.params.q, why: null }
                    : null
      if (b.bypass) {
        // A bypassed block passes the signal through untouched (see
        // "bypass" in terms.js), so the chain's own |H| reads flat 1 (0 dB)
        // no matter what Q says — the peak-equals-Q claim is about the
        // ACTIVE block, and turning it off does not make that claim false,
        // only unmeasurable from a chain that is not running it.
        rows.push({
          label: 'peak |H| at cutoff',
          predicted: NaN,
          measured: NaN,
          unchecked: bypassNote(b),
        })
      } else if (expect) {
      rows.push({
        label: expect.why ? `|H| at the corner — ${expect.why}` : 'peak |H| at cutoff',
        predicted: expect.v,
        measured: peak,
        tol: 0.02,
        abs: expect.abs || 0,
      })
      if (!expect.why) {
        rows.push({
          label: 'peak in dB',
          predicted: 20 * Math.log10(b.params.q),
          measured: 20 * Math.log10(peak),
          unit: 'dB',
          // A dB figure is already a log, so its honest tolerance is
          // ABSOLUTE: the 2% the linear row allows is 0.17 dB, whatever the
          // level. A relative 5% of "0 dB" at Q = 1 was a tolerance of
          // nothing, and −0.009 dB printed ✗ under a ✓ on the same number.
          abs: 0.2,
        })
      }
      } else {
        // A block this panel has no closed-form peak for (raw coefficients,
        // an FIR, a comb): the curve is still drawn, but there is no single
        // "peak = Q" claim to check, and pretending Q predicts it would print
        // a cross against correct physics.
        rows.push({
          label: '|H| at this block’s peak',
          predicted: NaN,
          measured: NaN,
          unchecked:
            'This block type has no single peak-equals-Q claim; read the response curve directly.',
        })
      }
    }
    return {
      blocks: [
        T('A second-order low-pass has the transfer function'),
        F('H(s) = \\frac{\\omega_0^{2}}{s^{2} + \\dfrac{\\omega_0}{Q}s + \\omega_0^{2}}'),
        // The careful student's own complaint: s and j never get a gloss
        // anywhere in this lab, so the substitution below reads as a magic
        // trick rather than a step they could redo. One sentence names both,
        // and says plainly that redoing the algebra is optional — the check
        // table under it measures the same conclusion directly.
        T(
          'Here s is the complex frequency of Laplace analysis, and j is the imaginary unit, ' +
            '√−1. Following the substitution below is optional: the check table beneath it ' +
            'measures the same conclusion directly, that the peak equals Q.',
        ),
        T('At s = jω₀ the first and last terms cancel exactly, leaving'),
        F('|H(j\\omega_0)| = \\frac{\\omega_0^{2}}{\\dfrac{\\omega_0}{Q}\\,\\omega_0} = Q'),
        T(
          'That is the whole definition. It is specific to the low-pass (and high-pass): a ' +
            'band-pass is normalized so |H(jω₀)| = 1 whatever Q is, and there Q sets the ' +
            'bandwidth instead, as ω₀/Q.',
        ),
        C(rows),
        // What the note used to add, beside the row that checks it.
        T(
          'Drag Q and watch the peak BE the number. Then open the block and use its type ' +
            'select to switch it to band-pass: the peak stays pinned at 0 dB however hard you ' +
            'drag, because a band-pass is normalized to 1 at its centre — there Q sets the ' +
            'WIDTH instead. Same knob, two meanings; the low-pass is where peak height and Q ' +
            'are the same thing. With white noise as the source, the orange trace runs ' +
            'parallel to the blue curve — every bump and slope matching — from the noise ' +
            'floor’s own height below it.',
        ),
      ],
    }
  },

  'A moving average is a filter': (ctx) => {
    const N = ctx.blocks[0] ? ctx.blocks[0].params.taps : 8
    const fs = ctx.sampleRate
    const spacing = fs / N
    // The Dirichlet kernel where it is neither 1 nor 0, so the row reads the
    // curve's actual shape rather than one of its two easy points.
    const mid = spacing * 1.5
    const dirichlet = (f) => {
      const w = (2 * Math.PI * f) / fs
      return Math.abs(Math.sin((N * w) / 2) / (N * Math.sin(w / 2)))
    }
    return {
      blocks: [
        T('Averaging the last N samples is a filter whose coefficients are all the same:'),
        F(`y[n] = \\frac{1}{N}\\sum_{k=0}^{N-1} x[n-k], \\qquad N = ${N}`),
        T(
          'Summing that geometric series of e^{-j\\omega k} in closed form gives the Dirichlet ' +
            'kernel, and the whole shape follows from it:',
        ),
        F('|H(f)| = \\left|\\frac{\\sin(\\pi f N / f_s)}{N \\sin(\\pi f / f_s)}\\right|'),
        T(
          'The numerator vanishes whenever fN/fₛ is a whole number and the denominator does ' +
            'not — so there is an exact null at every multiple of fₛ/N, with no approximation ' +
            'anywhere in the statement.',
        ),
        C([
          {
            label: `|H| at ${sig(mid, 4)} Hz, between two nulls`,
            predicted: dirichlet(mid),
            measured: ctx.respAt(mid),
            tol: 0.03,
            unchecked: bypassNote(ctx.blocks[0]),
          },
          {
            label: `|H| at the first null, ${sig(spacing, 4)} Hz`,
            predicted: 0,
            measured: ctx.respAt(spacing),
            abs: 0.02,
            unchecked: bypassNote(ctx.blocks[0]),
          },
        ]),
        V([
          { label: 'null spacing fₛ/N', value: spacing, unit: 'Hz' },
          {
            label: 'nulls below Nyquist',
            // Strictly below: for even N the N/2-th null lands exactly AT
            // Nyquist, and floor() was counting it.
            value: Math.ceil(fs / 2 / spacing) - 1,
            note: N % 2 === 0 ? 'plus one exactly at Nyquist' : '',
          },
          { label: 'group delay (N−1)/2', value: (N - 1) / 2, unit: 'samples' },
        ]),
      ],
    }
  },

  'Everything arrives together': (ctx) => {
    const b = ctx.blocks[0]
    const N = b ? b.params.taps : 61
    const M = (N - 1) / 2
    const fc = b ? b.params.freq : 1000
    return {
      blocks: [
        T(
          'A kernel symmetric about its centre tap factors into a real amplitude times a pure ' +
            'delay — and a pure delay is the one operation that changes no shape at all:',
        ),
        F('H(\\omega) = A(\\omega)\\,e^{-j\\omega M}, \\qquad A(\\omega)\\ \\text{real}'),
        T('Group delay is the derivative of that phase, so it is constant whatever A does:'),
        F(
          `\\tau_g(\\omega) = -\\frac{d}{d\\omega}\\bigl(-\\omega M\\bigr) = M = \\frac{N-1}{2} = ${M}` +
            `\\ \\text{samples}`,
        ),
        T(
          'The design also puts its corner at the HALF-amplitude point rather than the −3 dB ' +
            'point a biquad uses. A windowed sinc truncates an ideal rectangle, and the ' +
            'truncation rounds that edge symmetrically about f_c, leaving the response there at ' +
            '0.5 — which is −6 dB, not −3.',
        ),
        C([
          {
            label: `|H| at the cutoff, ${sig(fc, 4)} Hz`,
            predicted: 0.5,
            measured: ctx.respAt(fc),
            tol: 0.04,
            unchecked: bypassNote(b),
          },
        ]),
        V([
          { label: 'group delay', value: M, unit: 'samples' },
          { label: 'group delay', value: (1000 * M) / ctx.sampleRate, unit: 'ms' },
          { label: 'cutoff in dB', value: -6.02, unit: 'dB', note: 'a Q = 0.707 biquad’s is −3.01' },
          { label: 'multiply-adds per sample', value: N, note: 'a biquad needs 5' },
        ]),
        // What the note used to say.
        T(
          'No filter with feedback can have a flat group delay, and no FIR with a symmetric ' +
            `kernel can fail to. That is the entire trade: ${N} multiply-adds per sample ` +
            'against a biquad’s 5.',
        ),
      ],
    }
  },

  'The kernel is the filter': (ctx) => {
    const N = ctx.blocks[0] ? ctx.blocks[0].params.taps : 31
    // The DC row must follow the mode select, not assume the preset's low-pass:
    // flipped to high-pass, the null at DC is exact and 1 would be a ✗ against
    // correct physics.
    const hp = ctx.blocks[0] && ctx.blocks[0].params.mode === 'highpass'
    return {
      blocks: [
        T(
          'Two names, one sequence. "Impulse response" says how it is measured: feed a single ' +
            '1 followed by silence and record what comes out. "Kernel" says what it is for: the ' +
            'weights the convolution sum applies to the recent past. For an FIR that sequence ' +
            'is the coefficient list itself — the stems in the top pane ARE h[k].',
        ),
        F('y[n] = \\sum_{k} h[k]\\,x[n-k]'),
        T(
          'That the two are the SAME sequence is a theorem, not a definition. Any input is a ' +
            'train of scaled, shifted impulses — x[0] worth at time 0, x[1] worth at time 1, ' +
            'and so on. If the system is linear (responses add) and time-invariant (a shifted ' +
            'impulse gives a shifted copy of the same response), the output must be the sum of ' +
            'scaled, shifted impulse responses — and that sum is exactly the convolution above. ' +
            'LTI is the hypothesis: a clipper has a perfectly measurable impulse response that ' +
            'predicts nothing about its response to anything else, so there the two names come ' +
            'apart. The convolution view shows that happening.',
        ),
        T(
          'Convolution in time is multiplication in frequency, which is why one object explains ' +
            'both panes at once:',
        ),
        F('y[n] = (h * x)[n] \\quad \\Longleftrightarrow \\quad Y(\\omega) = H(\\omega)\\,X(\\omega)'),
        T(
          hp
            ? 'As a high-pass the low-pass kernel is subtracted from a delayed impulse, so the ' +
              'null at DC is exact — the taps sum to exactly zero:'
            : 'The taps are scaled to sum to one. Summing the taps IS the response at DC, since ' +
              'every e^{-j\\omega k} equals 1 there — so unit DC gain is arithmetic rather than a ' +
              'tolerance:',
        ),
        C([
          {
            label: '|H| at DC',
            predicted: hp ? 0 : 1,
            measured: ctx.respAt(0),
            tol: 0.01,
            abs: 0.01,
            unchecked: bypassNote(ctx.blocks[0]),
          },
        ]),
        V([
          { label: 'taps N', value: N },
          { label: 'symmetry centre', value: (N - 1) / 2, unit: 'samples' },
          { label: 'exactly zero after', value: N - 1, unit: 'samples', note: 'no tail at all' },
        ]),
        // What the note used to say.
        T(
          'The stems are not a picture OF the filter — for an FIR they are the filter, the ' +
            'numbers the design produced. And the baseline dots after the last tap are samples ' +
            'too: exactly zero, which is the point. An FIR forgets COMPLETELY, where an IIR’s ' +
            'baseline dots would be ringing too small to see.',
        ),
      ],
    }
  },

  'Cut it off abruptly and it rings': (ctx) => {
    const b = ctx.blocks[0]
    const fc = b ? b.params.freq : 1000
    // The 8.9% prediction is a claim about the UNTAPERED cut. The window
    // control is right there in the block card, and switching it to hamming is
    // the natural experiment — after which the overshoot is gone and a ✗
    // against 1.085 would be marking correct physics wrong. Footnote instead.
    const tapered = b && b.params.window !== 'none'
    // The overshoot as it appears on the curve the app is drawing: the largest
    // value anywhere in the passband.
    let top = 0
    for (let f = 0; f < fc; f += fc / 200) {
      const v = ctx.respAt(f)
      if (Number.isFinite(v) && v > top) top = v
    }
    return {
      blocks: [
        T(
          'The ideal low-pass is a rectangle in frequency, and its inverse transform is a sinc ' +
            'that never ends, so a real filter keeps a finite piece of it:',
        ),
        F(
          'h_{\\text{ideal}}[k] = 2\\frac{f_c}{f_s}\\,' +
            '\\operatorname{sinc}\\!\\left(2\\frac{f_c}{f_s}(k-M)\\right)',
        ),
        T(
          'Keeping a finite piece is multiplying by a rectangular window, and multiplying in ' +
            'time is convolving in frequency — so the brick wall gets convolved with that ' +
            'window’s transform, a sinc with substantial side lobes. The overshoot beside the ' +
            'corner IS that convolution.',
        ),
        C([
          {
            // The limit is the Gibbs constant 1 + 0.0895 (of the unit step),
            // approached from below as taps grow: 101 taps measures 1.0799.
            // The old prediction printed 1.085 — a number that is neither the
            // limit nor any finite-tap value, passing only by tolerance.
            label: 'largest |H| in the passband (→ 1.0895 as taps grow)',
            predicted: 1.0895,
            measured: top,
            tol: 0.05,
            unchecked:
              bypassNote(b) ||
              (tapered
                ? 'Holds for the untapered cut. Set the window back to none — with a taper the overshoot is (by design) gone.'
                : null),
          },
        ]),
        T(
          'More taps make the ripple narrower and never shorter, because it converges to a ' +
            'constant fraction of the step — the same Gibbs behaviour as a truncated Fourier ' +
            'series overshooting a square wave, seen in the other domain. Only tapering the ' +
            'window’s ends removes it.',
        ),
        V([
          { label: 'overshoot above the passband', value: (top - 1) * 100, unit: '%' },
          { label: 'Gibbs limit for a step', value: 8.95, unit: '%' },
        ]),
      ],
    }
  },

  'Zeros on the circle': (ctx) => {
    const N = ctx.blocks[0] ? ctx.blocks[0].params.taps : 12
    const fs = ctx.sampleRate
    const spacing = fs / N
    const mid = spacing * 0.5
    const dirichlet = (f) => {
      const w = (2 * Math.PI * f) / fs
      return Math.abs(Math.sin((N * w) / 2) / (N * Math.sin(w / 2)))
    }
    // The Dirichlet formula describes the moving average ALONE. "Add a
    // low-pass" (the try line's own chip) puts a second block in series, and
    // the chain's own |H| — what ctx.respAt reads — is then their product,
    // not just this kernel's.
    const extraBlocks = ctx.blocks.length > 1
      ? 'This describes the moving average alone — a second block has been added after it, so the chain’s |H| is now their product, not just the Dirichlet kernel above.'
      : null
    return {
      blocks: [
        T(
          'Sum the moving average’s geometric series and its transfer function becomes a ratio ' +
            'whose roots can be read off by inspection:',
        ),
        F(
          'H(z) = \\frac{1}{N}\\sum_{k=0}^{N-1} z^{-k} = ' +
            '\\frac{1}{N}\\,\\frac{z^{N}-1}{z^{N-1}(z-1)}',
        ),
        // z⁻¹ is unglossed at this point in the lesson, and the jump from a
        // sum to a ratio with roots is the one step this panel asked a
        // student to take on faith. One sentence closes both gaps: z⁻¹ is
        // the same one-sample delay as the difference equation, and the
        // familiar finite geometric series is what turns the sum into a
        // ratio whose roots are the zeros plotted below.
        T(
          'Here z⁻¹ means one sample late, so this sum is last experiment’s average, one delay ' +
            'at a time. Summing that finite geometric series gives the ratio above, and the ' +
            'ratio’s roots are exactly the zeros plotted below.',
        ),
        T(
          'The numerator vanishes at the N-th roots of unity. One of them, z = 1, is cancelled ' +
            'by the denominator — which is why DC survives untouched — and the other N−1 are ' +
            'the zeros drawn below, sitting exactly on the unit circle at evenly spaced angles:',
        ),
        F(`z_k = e^{\\,j 2\\pi k / N}, \\qquad k = 1 \\ldots ${N - 1}`),
        T(
          'A point at angle ω on that circle IS the frequency ωfₛ/2π, so a zero sitting on it ' +
            'means an exact null there. The evenly spaced ring and the evenly spaced comb of ' +
            'nulls are one fact drawn twice.',
        ),
        C([
          {
            label: `|H| halfway to the first null, ${sig(mid, 4)} Hz`,
            predicted: dirichlet(mid),
            measured: ctx.respAt(mid),
            tol: 0.03,
            unchecked: bypassNote(ctx.blocks[0]) || extraBlocks,
          },
          {
            label: `a zero lands on the null at ${sig(spacing, 4)} Hz`,
            predicted: 0,
            measured: ctx.respAt(spacing),
            abs: 0.02,
            unchecked: bypassNote(ctx.blocks[0]) || extraBlocks,
          },
        ]),
        V([
          { label: 'zeros on the circle', value: N - 1 },
          { label: 'angle between them', value: 360 / N, unit: '°' },
          { label: 'poles away from the origin', value: 0, note: 'so it cannot be unstable' },
          { label: 'kernel taps, each 1/N', value: N, note: 'the stems in the time pane' },
        ]),
        T(
          'The time pane shows the kernel — N equal taps — which is the same object as the ' +
            'ring of zeros: the polynomial whose coefficients are those taps has those roots. ' +
            'Add a resonant low-pass and its poles appear as crosses, pulled toward the rim ' +
            'as Q rises, and the kernel grows a ringing tail to match.',
        ),
      ],
    }
  },

  'Convolution, watched': (ctx) => {
    const N = (ctx.blocks[0] && ctx.blocks[0].params.taps) || 8
    const fs = ctx.sampleRate
    const src = ctx.sources[0] || { freq: 250, amp: 0.8 }
    // Two genuinely different paths to the same sample: the chain's stateful
    // processors, and a dot product against the kernel measured by impulse.
    // For an LTI chain they must agree to rounding — that agreement is the
    // entire content of the word "convolution". The kernel is sized by the
    // chain's own ring time (convKernel), so a block swapped for an IIR does
    // not silently truncate the sum.
    const n = Math.max(N, Math.round(fs / src.freq / 4) - 1) // mid flat top
    const x = render(ctx.sources, n + 1, fs, 0)
    const y = applyChain(ctx.blocks, x, fs, 0)
    const { h, exact } = chainImpulse(ctx.blocks, convKernel(ctx.blocks, fs).n, fs)
    let dot = 0
    for (let k = 0; k < h.length && k <= n; k++) dot += h[k] * x[n - k]
    // The flat-top row's own preconditions, both movable from the controls:
    // a square wave, whose half-period holds at least N samples.
    const half = fs / src.freq / 2
    const flatTopNote =
      ctx.sourceType !== 'square'
        ? 'The source is not a square wave, so there is no flat top for the average to sit on.'
        : half < N
          ? 'The half-period is shorter than the kernel, so the window never sees a whole flat top.'
          : null
    return {
      blocks: [
        T('Every output sample is one number: the kernel times the recent past, summed.'),
        F('y[n] = \\sum_{k=0}^{N-1} h[k]\\,x[n-k]'),
        T(
          'The kernel rides along the input FLIPPED — h[n−m] against m — because x[n−k] walks ' +
            'backwards as k walks forwards. That flip is not a convention; without it the sum ' +
            'would weight the newest sample by the oldest tap.',
        ),
        C([
          {
            label: `chain output vs the sum, at n = ${n}`,
            predicted: dot,
            measured: y[n],
            tol: 1e-9,
            abs: 1e-9,
            unchecked: exact
              ? null
              : 'The chain is not LTI here, and the two paths deliberately disagree — that disagreement is the lesson.',
          },
          {
            label: 'on a flat top the average IS the amplitude',
            predicted: src.amp,
            measured: y[n],
            tol: 0.001,
            unchecked: flatTopNote,
          },
        ]),
        T(
          'The first row is computed twice on purpose: once by the running filter, once as this ' +
            'sum against the kernel measured from an impulse. Only for a linear, time-invariant ' +
            'chain do the two agree — add a clipper and watch them separate.',
        ),
        // What the note used to say about the picture, and what the canvas
        // used to caption: the strips, the flat tops, the ramps, the warm-up.
        T(
          'Top strip: the input x[m], with the kernel flipped and slid to n. Bottom strip: the ' +
            'output y = x ∗ h so far. Where the window sits wholly inside a half-period the ' +
            'average is exactly the amplitude — the flat tops. The ramps between them are the ' +
            'window straddling an edge, and they are exactly N−1 samples wide. The first few ' +
            'samples ramp too: that is filter warm-up, seen for what it is — partial overlap. ' +
            'Every dot down there is one completed sum; the smooth curve those samples describe ' +
            'belongs to the Signal view, after the arithmetic is done.',
        ),
        V([
          { label: 'kernel length N', value: N, unit: 'samples' },
          { label: 'ramps between flat tops', value: N - 1, unit: 'samples' },
          {
            label: 'flat top needs a half-period of at least',
            value: N,
            unit: 'samples',
            note: `a half-period is ${Number((fs / src.freq / 2).toPrecision(4))} here`,
          },
        ]),
      ],
    }
  },

  'Phase is invisible here': (ctx) => {
    // The try line quotes this row's own numbers (380 Hz, 25.7764 samples)
    // rather than a separate figure read off the picture — it used to say
    // "400 Hz" and "26 samples", a guess that did not match what this panel
    // measures. Measured here too, so the number stays live if freq or Q
    // move, rather than sitting in prose as a value nothing recomputes.
    let peakDelay = 0
    let peakFreq = 0
    const b = ctx.blocks[0]
    if (b) {
      const scanFreqs = Float64Array.from({ length: 200 }, (_, i) => ((i + 1) * ctx.sampleRate) / 2 / 200)
      const { delay, any } = chainGroupDelay(ctx.blocks, scanFreqs, ctx.sampleRate)
      if (any) {
        for (let i = 0; i < scanFreqs.length; i++) {
          if (delay[i] > peakDelay) {
            peakDelay = delay[i]
            peakFreq = scanFreqs[i]
          }
        }
      }
    }
    return {
      blocks: [
        T(
          'An all-pass places each pole and zero as a mirror pair about the unit circle, so every ' +
            'magnitude cancels and only the angle survives:',
        ),
        F('H(z) = \\frac{z^{-2} + a_1 z^{-1} + a_2}{1 + a_1 z^{-1} + a_2 z^{-2}}, \\qquad |H| = 1'),
        // z is unglossed at every earlier stop, and this is the first ENTRIES
        // panel to print H(z) directly. One sentence names z⁻¹, matching the
        // wording the block card already uses for a biquad's own H(z).
        T('Here z⁻¹ means one sample late, so z⁻² means two samples late.'),
        T(
          'The numerator is the denominator with its coefficients reversed, which is exactly the ' +
            'condition for the magnitudes to divide out at every frequency. A second-order ' +
            'section sweeps a full 360° of phase.',
        ),
        T(
          'The FFT magnitude cannot see any of this. What phase does change is the relative ' +
            'timing of the components, and since they are no longer aligned as they were, the ' +
            'waveform is a different shape with an identical spectrum.',
        ),
        // What the note used to say.
        T(
          'Switch the overlay to group delay to see the same fact as a time. The components ' +
            'near 380 Hz are held up well past the rest, read directly off that curve against ' +
            'its own right-hand axis, which is precisely why the waveform changes shape while ' +
            'its spectrum does not.',
        ),
        V([
          {
            label: 'peak group delay',
            value: peakDelay,
            unit: 'samples',
            note: `at ${sig(peakFreq, 3)} Hz — the curve's own peak, the number the try line names`,
          },
        ]),
      ],
    }
  },

  'Two filters are steeper': (ctx) => {
    const rows = []
    if (ctx.blocks.length >= 2) {
      const [b1, b2] = ctx.blocks
      const def = BLOCK_TYPES[b1.type]
      // Predicted through the block's own response() — which follows the
      // ORDER select — not through designBiquad, which is order-2 only and
      // marked an order-4 cascade's correct physics wrong (the very trap the
      // harmonicRatioRows comment warns about).
      const same = b1.type === b2.type && JSON.stringify(b1.params) === JSON.stringify(b2.params)
      // The try line says "bypass block 2". The theory must follow the power
      // buttons: with one section bypassed the chain IS one section, |H|,
      // and the row says so — it printed |H|² against |H| and crossed the
      // student for doing what they were told (the cold walk).
      const live = [b1, b2].filter((b) => !b.bypass).length
      for (const f of [1600, 3200]) {
        const h = def.response ? def.response(b1.params, f, ctx.sampleRate) : NaN
        rows.push({
          label: live === 2 ? `|H|² at ${f} Hz — both sections` : `|H| at ${f} Hz — one section bypassed`,
          predicted: live === 2 ? h * h : live === 1 ? h : 1,
          measured: ctx.respAt(f),
          tol: 0.02,
          unchecked:
            live === 0
              ? 'Both sections are bypassed, so the chain does nothing here.'
              : same
                ? null
                : 'The two blocks are no longer identical, so the chain is H₁·H₂ rather than a square.',
        })
      }
      if (live === 2 && same) {
        const h = def.response ? def.response(b1.params, 3200, ctx.sampleRate) : NaN
        rows.push({
          label: 'attenuation at 3200 Hz doubles in dB',
          predicted: 2 * 20 * Math.log10(h),
          measured: 20 * Math.log10(ctx.respAt(3200)),
          unit: 'dB',
          abs: 0.3,
        })
      }
    }
    return {
      blocks: [
        T('Cascaded LTI blocks multiply their responses, so identical sections square:'),
        F('H_{\\text{total}}(f) = H_1(f)\\,H_2(f) \\;\\Rightarrow\\; |H|^{2}'),
        T('In decibels multiplication becomes addition, so the attenuation simply doubles:'),
        F('20\\log_{10}|H|^{2} = 2\\cdot 20\\log_{10}|H|'),
        T(
          'Phases add rather than multiply, which is why the group delay doubles too — a real ' +
            'cost of the steeper skirt, and the reason filter order is a trade rather than a ' +
            'free win.',
        ),
        C(rows),
        // What the note used to say.
        T(
          'The curve also steepens near 4 kHz for a separate reason: a digital filter has a ' +
            'zero at Nyquist that the textbook analogue prototype does not. Two sections is a ' +
            '4th-order filter — but not a 4th-order Butterworth, which needs a different Q in ' +
            'each; see "Order is a choice". With noise as the source the doubling shows across ' +
            'the whole curve, not at one point.',
        ),
      ],
    }
  },

  'Order is a choice': (ctx) => {
    const qs = ctx.blocks.map((b) => b.params.q)
    const fc = ctx.blocks.length ? ctx.blocks[0].params.freq : 0
    // Read the cascade off the response curve the app draws, rather than
    // multiplying biquadResponse here — that would be the same formula twice.
    const prod = ctx.respAt(fc)
    // Butterworth section Qs for order N, from the pole angles.
    const bw = (N) =>
      Array.from({ length: N / 2 }, (_, k) => 1 / (2 * Math.cos(((2 * k + 1) * Math.PI) / (2 * N))))
    // The Butterworth claim needs BOTH knobs honest: the Q pair, and each
    // block still being a single second-order section. Flip either block's
    // order select to 4 and the chain is 8th order — |H(fc)| = 0.5, and
    // −3.01 dB would be a cross against correct physics.
    const isBw =
      qs.length === 2 &&
      ctx.blocks.every((b) => !b.bypass && b.type === 'lowpass' && Number(b.params.order ?? 2) === 2) &&
      bw(4).every((q, i) => Math.abs(qs[i] - q) < 0.01)

    // The "0.707 twice" chip's own claim: with both sections at ONE shared Q
    // the Butterworth row above rightly blanks, and the sagged corner was
    // otherwise left to be read off gridlines. Predicted from each section's
    // own response() at its own cutoff, squared for the cascade — a
    // different path than ctx.respAt, which reads the drawn curve.
    const sameSection =
      qs.length === 2 &&
      ctx.blocks.every((b) => !b.bypass && b.type === 'lowpass' && Number(b.params.order ?? 2) === 2) &&
      Math.abs(qs[0] - qs[1]) < 1e-9
    const perSection = sameSection
      ? BLOCK_TYPES[ctx.blocks[0].type].response(ctx.blocks[0].params, fc, ctx.sampleRate)
      : NaN

    return {
      blocks: [
        T(
          'Order counts the sections. Each biquad is second order, so two in series is fourth ' +
            'order, three is sixth, and the rolloff far above the cutoff approaches 6 dB per ' +
            'octave for every order:',
        ),
        F('\\text{rolloff} \\to 6N\\ \\text{dB/octave}'),
        T(
          'But order alone does not name a filter. A Butterworth is the one that is maximally ' +
            'flat in the passband, and getting it requires a specific Q for each section — the ' +
            'poles have to sit evenly around a semicircle:',
        ),
        F(
          'Q_k = \\frac{1}{2\\cos\\!\\left(\\frac{(2k+1)\\pi}{2N}\\right)}, ' +
            '\\qquad k = 0 \\ldots \\tfrac{N}{2}-1',
        ),
        V([
          { label: 'order 2 wants Q', value: bw(2)[0] },
          { label: 'order 4 wants Q', value: bw(4)[0], note: `and ${bw(4)[1].toFixed(4)}` },
          {
            label: 'order 6 wants Q',
            value: bw(6)[0],
            note: `and ${bw(6)[1].toFixed(4)}, ${bw(6)[2].toFixed(4)}`,
          },
        ]),
        T(
          'Only the second-order case is 0.707, which is why that value is famous and why ' +
            'cascading two of them is a common mistake. The giveaway is at the cutoff: every ' +
            'true Butterworth passes exactly −3.01 dB there, whatever its order, because that ' +
            'is where the definition pins it. Two identical 0.707 sections give −6.02 dB — each ' +
            'contributing its own −3.01 — and sag well before the corner.',
        ),
        F('|H(f_c)| = \\tfrac{1}{\\sqrt{2}} \\quad\\text{for a Butterworth of any order}'),
        C([
          {
            label: `|H| at f_c = ${fc} Hz`,
            predicted: Math.SQRT1_2,
            measured: prod,
            tol: 0.02,
            unchecked: isBw
              ? null
              : 'This is no longer the pair of second-order Butterworth sections (a Q or the order select moved, or a section is bypassed), so −3.01 dB is not what this cascade is aiming for.',
          },
          ...(sameSection
            ? [
                {
                  label: `|H| at f_c = ${fc} Hz — one shared Q = ${sig(qs[0], 4)}, squared`,
                  predicted: perSection * perSection,
                  measured: prod,
                  tol: 0.02,
                },
              ]
            : []),
        ]),
        // What the note used to say.
        T(
          'The low-pass block also has an Order select: bypass one section and set the other ' +
            'to 4th for this exact Butterworth built into one block — or to 1st, one bare pole ' +
            'that cannot resonate at all. The source is noise so the whole curve is measured ' +
            'at once; a single tone would only probe one point of it.',
        ),
      ],
    }
  },

  'Impulse response': (ctx) => ({
    blocks: [
      T(
        'The impulse response and the transfer function are the same object. One is the Fourier ' +
          'transform of the other:',
      ),
      F('H(f) = \\sum_{n=0}^{\\infty} h[n]\\,e^{-j2\\pi f n / f_s}'),
      // e^{jθ} is unglossed everywhere else in the lab, and this sum is its
      // first appearance in the panel a student reads before the FIR and
      // z-plane group. One sentence names it, and says plainly that following
      // the exponent is optional — the row below measures the same flat
      // spectrum directly.
      T(
        'Here e^(−jθ) is Euler’s formula, cos θ − j sin θ: a point on the unit circle, one turn ' +
          'per cycle. Following that exponent is optional. The row below measures the flat ' +
          'spectrum it predicts directly.',
      ),
      T(
        'A unit sample has a perfectly flat spectrum, because it is the sum of every frequency ' +
          'in equal measure. Feed it in and the output spectrum IS |H(f)|, while the time view ' +
          'draws h[n] directly.',
      ),
      F('x[n] = \\delta[n] \\;\\Rightarrow\\; y[n] = h[n], \\qquad |X(f)| = \\text{constant}'),
      T(
        'That flat level sits low on the dB axis, at 2/N for an N-point frame read without an ' +
          'analysis window, because one sample of energy is being shared out across every bin. ' +
          'It is the shape that matters, not the height.',
      ),
      V([
        { label: 'flat level 2/N', value: 2 / ctx.fftSize },
        { label: 'in dB', value: 20 * Math.log10(2 / ctx.fftSize), unit: 'dB', note: 'the note’s "60 dB down"' },
      ]),
      C([
        {
          label: 'flat input level (2/N)',
          predicted: 2 / ctx.fftSize,
          measured: ctx.dryAt ? ctx.dryAt(ctx.sampleRate / 4) : NaN,
          tol: 0.1,
          // 2/N is the RECTANGULAR-window value. Every taper is zero (or
          // nearly) at the frame edge, which is exactly where this impulse
          // sits — under Hann the measured level is literally 0, and a ✗
          // there would be marking the window's own arithmetic wrong.
          unchecked: !ctx.dryAt
            ? 'Turn on "show pre-chain spectrum" to measure the input level.'
            : !ctx.sources.some((s) => s.enabled)
              ? 'No source is enabled, so there is no impulse feeding the chain to measure.'
              : ctx.state.window !== 'none'
                ? 'The 2/N level holds for the rectangular window ("none"); the current window tapers to zero at the frame edge, where this impulse sits.'
                : null,
        },
      ]),
    ],
  }),

  'Step response and ringing': (ctx) => {
    const b = ctx.blocks[0]
    const q = b ? b.params.q : 0
    const zeta = q ? 1 / (2 * q) : 0
    const over = zeta < 1 ? Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)) : 0
    return {
      blocks: [
        T(
          'A second-order low-pass is the standard damped oscillator, and Q is its damping in ' +
            'disguise:',
        ),
        F('\\zeta = \\frac{1}{2Q}'),
        T('Driven by a step, its overshoot above the final value is'),
        F('M_p = \\exp\\!\\left(\\frac{-\\pi\\zeta}{\\sqrt{1-\\zeta^{2}}}\\right), \\qquad \\zeta < 1'),
        T(
          'At ζ = 1/√2, meaning Q = 0.707, the step still overshoots — by 4.3%, as the row ' +
            'below computes. Truly overshoot-free needs ζ ≥ 1, which is Q ≤ 0.5. What ' +
            'Q = 0.707 buys instead is the flattest possible passband — the Butterworth ' +
            'condition — at the price of that last few percent of ringing. Flat in frequency ' +
            'and clean in time are two different requests.',
        ),
        V([
          { label: 'damping ζ = 1/2Q', value: zeta },
          { label: 'predicted overshoot', value: over, unit: '×' },
        ]),
      ],
    }
  },

  'Clipping makes harmonics': (ctx) => ({
    blocks: [
      T(
        'Clipping is memoryless but not proportional, so it cannot be written as H(f)·X(f) for ' +
          'any H. In the hard limit, where the sine is flattened almost to a square, the output ' +
          'harmonics approach',
      ),
      F('A_k = \\frac{4c}{k\\pi}, \\qquad k \\text{ odd}'),
      T(
        'Only odd harmonics appear because the clipper is an odd function: f(−x) = −f(x). That ' +
          'symmetry is preserved through the nonlinearity, and an even harmonic would break it.',
      ),
      T(
        'This is why the blue response curve turns dashed. It still describes the linear blocks ' +
          'in the chain, but no curve can describe this one, and drawing a solid line would be ' +
          'claiming otherwise.',
      ),
    ],
  }),

  'DC breaks the symmetry': () => ({
    blocks: [
      T(
        'Expand any memoryless nonlinearity as a power series about the operating point. Odd ' +
          'terms generate odd harmonics, even terms generate even ones:',
      ),
      F('y = a_1x + a_2x^{2} + a_3x^{3} + \\ldots'),
      F(
        'x^{2} = \\tfrac{1}{2}\\bigl(1 - \\cos 2\\omega t\\bigr) \\quad\\text{(for } x = \\sin\\omega t\\text{: second harmonic, and DC)}',
      ),
      T(
        'A symmetric clipper has only odd terms, so a₂ = 0 and the even harmonics never appear. ' +
          'Adding an offset moves the operating point to where the curve is no longer symmetric ' +
          'about it, a₂ becomes non-zero, and the even harmonics arrive.',
      ),
      T(
        'The same reasoning explains the intermodulation preset: a symmetric nonlinearity ' +
          'produces odd-order products only.',
      ),
    ],
  }),

  'Two tones, one nonlinearity': (ctx) => {
    const on = ctx.sources.filter((s) => s.enabled)
    const f1 = on[0] ? on[0].freq : 250
    const f2 = on[1] ? on[1].freq : 400
    const live = ctx.blocks.some((b) => !b.bypass)
    const dB = (f) => 20 * Math.log10(Math.max(ctx.at(f), 1e-12))
    // The products, by order, measured live — the walk found the note naming
    // 550, 900 and 50 Hz while 100 and 1050 Hz stood just as tall and 50 Hz
    // sat 12 dB lower (it is fifth order).
    const products = [
      { label: '2f₁ − f₂', f: Math.abs(2 * f1 - f2), order: 3 },
      { label: '2f₂ − f₁', f: Math.abs(2 * f2 - f1), order: 3 },
      { label: '2f₁ + f₂', f: 2 * f1 + f2, order: 3 },
      { label: '2f₂ + f₁', f: 2 * f2 + f1, order: 3 },
      { label: 'f₂ − f₁', f: Math.abs(f2 - f1), order: 2 },
      { label: 'f₂ + f₁', f: f2 + f1, order: 2 },
      { label: '3f₁ − 2f₂', f: Math.abs(3 * f1 - 2 * f2), order: 5 },
    ]
    return {
      blocks: [
        // Led with the measured table, on the review's own reading: the note
        // above already explains the idea in plain English, and the table is
        // the clear part. The cubic expansion and the set-membership formula
        // that used to open this panel are unglossed notation with nothing
        // above them to lean on, so the set notation is cut in favour of
        // plain English, and the cubic expansion moves below the table,
        // marked optional.
        T(
          live
            ? 'Measured on this spectrum, product by product. A symmetric clipper has only odd ' +
              'terms in its series, so the second-order products stay far down; the ' +
              'third-order four stand together, and the fifth-order one is well below them:'
            : 'The clipper is bypassed, so every product below reads the window floor — the ' +
              'chain is linear again and nothing new is made:',
        ),
        V(
          products
            .filter((p) => p.f > 0 && p.f < ctx.sampleRate / 2)
            .map((p) => ({
              label: `${p.label} = ${sig(p.f, 5)} Hz`,
              value: dB(p.f),
              unit: 'dB',
              note: `order ${p.order}`,
            })),
        ),
        T(
          'Every product above sits at a whole-number combination of the two source frequencies, ' +
            'm·f₁ ± n·f₂, with order m + n. Third-order products are the troublesome ones. 2f₂ − f₁ ' +
            'lands close to the originals, so no filter can remove it without removing the signal ' +
            'too. That single fact sets the linearity requirement for most radio and optical front ' +
            'ends.',
        ),
        T(
          'The algebra behind that is optional. Cubing a sum of cosines multiplies pairs and ' +
            'triples of them together, which is where these combinations come from:',
        ),
        F(
          '(\\cos\\omega_1 t + \\cos\\omega_2 t)^{3} \\;\\longrightarrow\\; ' +
            '\\cos(2\\omega_1 \\pm \\omega_2)t,\\; \\cos(2\\omega_2 \\pm \\omega_1)t,\\;\\ldots',
        ),
        T(
          'A linear system can only scale and delay the frequencies already present. Creating new ' +
            'ones is the definition of nonlinearity, and it is what this preset makes visible.',
        ),
      ],
    }
  },

  'Ring modulator': () => ({
    blocks: [
      T('Multiplying in time is the same as shifting in frequency, by the product identity'),
      F(
        '\\cos(2\\pi f_1 t)\\cos(2\\pi f_2 t) = ' +
          '\\tfrac{1}{2}\\cos\\bigl(2\\pi(f_1-f_2)t\\bigr) + \\tfrac{1}{2}\\cos\\bigl(2\\pi(f_1+f_2)t\\bigr)',
      ),
      T(
        'There is no term at f₁ or f₂ on the right-hand side, which is why neither input ' +
          'survives. More generally, multiplication in one domain is convolution in the other:',
      ),
      F('x(t)\\,c(t) \\;\\longleftrightarrow\\; X(f) * C(f)'),
      T(
        'The double arrow marks a Fourier transform pair, a signal beside its own spectrum, and ' +
          'the asterisk marks convolution, not multiplication. Convolving with a pair of impulses ' +
          'at ±f_c is exactly what copies the spectrum up to sit around the carrier.',
      ),
    ],
  }),

  'AM: the carrier returns': () => ({
    blocks: [
      T('Adding a constant before the multiplier changes what is being shifted:'),
      F(
        '\\bigl(1 + m\\,x(t)\\bigr)\\cos\\omega_c t = ' +
          '\\underbrace{\\cos\\omega_c t}_{\\text{carrier}} + ' +
          '\\underbrace{m\\,x(t)\\cos\\omega_c t}_{\\text{sidebands}}',
      ),
      T(
        'The constant term multiplied by the carrier is simply the carrier, so it reappears ' +
          'between the sidebands. With no offset the leading 1 is absent and you have ' +
          'double-sideband suppressed-carrier.',
      ),
      T(
        'The carrier conveys no information at all, and for a modulation index of 1 it consumes ' +
          'two thirds of the transmitted power. Broadcast AM pays that price anyway, because a ' +
          'receiver can then recover the envelope with a diode and a capacitor instead of ' +
          'regenerating a phase-locked carrier.',
      ),
    ],
  }),

  Comb: (ctx) => {
    const b = ctx.blocks[0]
    const D = b ? Math.max(1, Math.round((b.params.delayMs / 1000) * ctx.sampleRate)) : 1
    const g = b ? Math.max(-0.95, Math.min(0.95, b.params.g)) : 0.9
    const spacing = ctx.sampleRate / D
    const tauMs = (1000 * D) / ctx.sampleRate
    // Two symbols for one delay: τ in seconds (so the notch spacing is 1/τ
    // in hertz) and D in samples (so z^{-D} is a whole number of delays).
    // One letter for both was the walk's complaint.
    return {
      blocks: [
        T(
          'Adding a delayed copy gives a transfer function with evenly spaced notches. The ' +
            'delay is τ seconds, which is D = τ·fₛ samples:',
        ),
        F('H(z) = 1 + g\\,z^{-D} \\qquad |H(f)| = \\bigl|1 + g\\,e^{-j2\\pi f\\tau}\\bigr|, \\quad D = \\tau f_s'),
        // z⁻¹ already means "one sample late" by this point in the lesson.
        // What is new here is only that the exponent counts: D of them, one
        // per sample of delay — the same D the time equation names.
        T('z⁻ᴰ is that same one-sample delay repeated D times: D samples late, not one.'),
        T(
          'For positive g the two terms oppose wherever the delay is an odd number of half ' +
            'periods — every 1/τ = fₛ/D hertz — dipping to 1 − g, a full cancel only at g = 1. ' +
            '(Negative g swaps the pattern: the notches move to whole periods.) Feeding the ' +
            'output back instead puts the same comb in the DENOMINATOR, and a dip downstairs ' +
            'is a peak upstairs — so the peaks land at multiples of 1/τ, midway between ' +
            'where the feed-forward notches were, not on top of them:',
        ),
        F('H(z) = \\frac{1}{1 - g\\,z^{-D}}'),
        V([
          { label: 'delay τ', value: tauMs, unit: 'ms' },
          { label: 'delay D = τ·fₛ', value: D, unit: 'samples' },
          { label: 'notch spacing 1/τ', value: spacing, unit: 'Hz' },
          { label: 'feed-forward notch floor |1 − |g||', value: Math.abs(1 - Math.abs(g)) },
          { label: 'feedback peak height 1/(1 − |g|)', value: 1 / (1 - Math.abs(g)) },
        ]),
        // What the note used to say.
        T(
          `Open the z-plane view: this is "Zeros on the circle" again — D = ${D} of them in a ` +
            `ring pulled just inside the rim at radius |g|^(1/D) = ${sig(Math.pow(Math.abs(g), 1 / D), 4)}, ` +
            'and in feedback mode the same ring is poles.',
        ),
      ],
    }
  },

  '4 bits': (ctx) => {
    const b = ctx.blocks[0]
    const bits = b ? b.params.bits : 8
    return {
      blocks: [
        T(
          'Rounding to a grid of step Δ leaves an error bounded by half a step (except right ' +
            'at +full scale, where a converter’s top code sits one step shy):',
        ),
        F('\\Delta = \\frac{2}{2^{N}}, \\qquad |e| \\le \\frac{\\Delta}{2}'),
        T(
          'If that error were uniformly distributed and independent of the signal, its power ' +
            'would be Δ²/12, giving the familiar result',
        ),
        F('\\text{SNR} \\approx 6.02N + 1.76 \\ \\text{dB}'),
        T(
          'But it is neither. For a periodic input the error is a deterministic function of the ' +
            'signal, so it lands on harmonics rather than spreading out — those are the spurs. ' +
            'Dither adds a small random offset before rounding, which decorrelates the error ' +
            'and converts the spurs into the smooth floor the formula assumes.',
        ),
        V([
          { label: 'step Δ', value: 2 / Math.pow(2, bits) },
          { label: 'ideal SNR', value: 6.02 * bits + 1.76, unit: 'dB' },
        ]),
      ],
    }
  },
}

/** The math panel for the active preset, or null if it has none. */
export function mathFor(name, ctx) {
  const fn = ENTRIES[name]
  if (!fn) return null
  try {
    return fn(ctx)
  } catch {
    return null
  }
}

/**
 * Everything an entry needs to state a prediction and check it against what is
 * on screen.
 *
 * Lives here rather than in App so that math.test.js can build the identical
 * context and verify each panel's own claims. A check row that quietly stopped
 * agreeing would otherwise be invisible until someone read it.
 */
export function mathContext({ state, freqs, amps, ghostAmps, resp, peakFreq }) {
  const nearest = (f) => {
    let bi = 0
    for (let i = 1; i < freqs.length; i++) {
      if (Math.abs(freqs[i] - f) < Math.abs(freqs[bi] - f)) bi = i
    }
    return bi
  }
  // Peak over a few bins: a window spreads a line over about three of them.
  const peakNear = (arr) => (f) => {
    const bi = nearest(f)
    let m = 0
    for (let i = Math.max(0, bi - 2); i <= Math.min(arr.length - 1, bi + 2); i++) {
      if (arr[i] > m) m = arr[i]
    }
    return m
  }
  const first = state.sources.find((s) => s.enabled)
  return {
    state,
    sources: state.sources,
    blocks: state.blocks,
    sampleRate: state.sampleRate,
    fftSize: state.fftSize,
    sourceFreq: first ? first.freq : 0,
    sourceType: first ? first.type : 'sine',
    sourceAmp: first ? first.amp : 1,
    peakFreq,
    // The raw spectrum, for the one claim that is about the ABSENCE of lines
    // rather than the height of one: "nothing above the top harmonic" cannot
    // be checked by sampling a frequency, only by sweeping the axis.
    freqs,
    amps,
    at: peakNear(amps),
    dryAt: ghostAmps ? peakNear(ghostAmps) : null,
    respAt: (f) => (resp ? resp.mag[nearest(f)] : NaN),
  }
}
