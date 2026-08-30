import { render, rms, peak } from '@ee-labs/dsp'
import { applyChain } from './dsp/chain.js'
import { BLOCK_TYPES } from './dsp/blocks.js'
import { biquadResponse, butterworthQs, designBiquad, designFirstOrder, designFir, poleRadius, isStable } from '@ee-labs/dsp'

// The math for one source, and for one block.
//
// The preset panels only fire when a preset is loaded, which leaves the whole
// tool silent the moment someone builds their own chain — exactly the point at
// which they are most likely to want an explanation. These attach to the source
// and block cards instead, so every configuration is explained, not just the
// twenty-odd we shipped.
//
// Same rule as the preset panels: a two-column comparison only appears when the
// measured side is genuinely computed from the signal rather than restated from
// the formula. Anything else is a derived value with no tick.

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })

/** Enough digits to reproduce the arithmetic, not so many it becomes noise. */
const sig = (v, n = 6) => Number(v.toPrecision(n))

/** Signed, for writing a difference equation without "+ -0.7". */
const signed = (v, n = 6) => (v < 0 ? `- ${Math.abs(sig(v, n))}` : `+ ${sig(v, n)}`)

// ---------------------------------------------------------------- sources

const WAVE_MATH = {
  sine: {
    tex: 'x(t) = A\\sin(2\\pi f_0 t + \\varphi)',
    rms: (a) => a / Math.SQRT2,
    crest: Math.SQRT2,
    harmonics: 'A single frequency, and nothing else. Every other waveform here is read against it.',
  },
  square: {
    tex: 'x(t) = \\frac{4A}{\\pi}\\sum_{m=0}^{\\infty}\\frac{\\sin\\bigl(2\\pi(2m+1)f_0t\\bigr)}{2m+1}',
    rms: (a) => a,
    crest: 1,
    harmonics:
      'Odd harmonics only, falling as 1/k. The wave is antisymmetric about half a period, and an ' +
      'even harmonic could not survive that flip.',
  },
  triangle: {
    tex: 'x(t) = \\frac{8A}{\\pi^{2}}\\sum_{m=0}^{\\infty}\\frac{(-1)^{m}\\sin\\bigl(2\\pi(2m+1)f_0t\\bigr)}{(2m+1)^{2}}',
    rms: (a) => a / Math.sqrt(3),
    crest: Math.sqrt(3),
    harmonics:
      'Odd harmonics again, but falling as 1/k². The wave itself has no jumps — only its slope ' +
      'does — and one extra degree of smoothness costs one extra power of k.',
  },
  sawtooth: {
    tex: 'x(t) = \\frac{2A}{\\pi}\\sum_{k=1}^{\\infty}\\frac{(-1)^{k+1}\\sin(2\\pi k f_0 t)}{k}',
    rms: (a) => a / Math.sqrt(3),
    crest: Math.sqrt(3),
    harmonics:
      'Every harmonic, even and odd, falling as 1/k. It jumps like a square, so it decays like ' +
      'one — but it is not antisymmetric about half a period, so the even harmonics survive.',
  },
  noise: {
    tex: 'x[n] \\sim \\mathcal{U}(-A,\\,A), \\qquad S(f) = \\text{constant}',
    rms: (a) => a / Math.sqrt(3),
    crest: Math.sqrt(3),
    harmonics:
      'Uniform white noise: every frequency present in equal measure, on average. That flatness ' +
      'is what makes it useful — put it through a filter and it paints the filter’s shape.',
  },
  impulse: {
    tex: 'x[n] = A\\,\\delta[n], \\qquad |X(f)| = \\text{constant}',
    rms: null,
    crest: null,
    harmonics:
      'One sample, then silence. Its spectrum is perfectly flat, so anything the spectrum shows ' +
      'downstream was put there by the chain. Meanwhile the time view is drawing h[n] itself.',
  },
  step: {
    tex: 'x[n] = A\\,u[n], \\qquad |X(f)| \\sim \\frac{1}{f}',
    rms: null,
    crest: null,
    harmonics:
      'A jump, held. Mostly low-frequency energy falling as 1/f, plus a large DC term — which is ' +
      'why it shows what a filter does to a sudden change rather than to a steady tone.',
  },
}

/**
 * Math for one source, with its own numbers substituted.
 *
 * The RMS row is a genuine check: the left side is a closed form, the right is
 * computed by squaring and summing the samples this generator actually produces.
 * Different code paths, and it would catch a generator that drifted from its own
 * definition — which is exactly the bug the square wave had.
 */
export function sourceMath(source, ctx) {
  const w = WAVE_MATH[source.type]
  if (!w) return null

  const { sampleRate, fftSize } = ctx
  const A = source.amp
  const f0 = source.freq
  const N = f0 > 0 ? sampleRate / f0 : Infinity
  const binHz = sampleRate / fftSize
  const periodic = w.rms != null
  // Noise has a well-defined RMS but no period at all — the generator does not
  // even read `freq` — so anything counted per period is meaningless for it.
  const hasPeriod = periodic && source.type !== 'noise'

  // Measure this source on its own, ignoring the rest of the patch.
  const buf = render([{ ...source, enabled: true }], 4096, sampleRate, 0)
  const measuredRms = rms(buf)
  const measuredPeak = peak(buf)

  // A sine and a square hit their continuous RMS exactly at any sample rate:
  // the sum of sin² over whole periods is exactly N/2, and a square is |A|
  // everywhere. A triangle and a sawtooth do not — their samples miss the
  // extremes — and converge only as the grid gets finer: 6% out at eight
  // samples per period, 1.6% at sixteen.
  const slowConverging = source.type === 'triangle' || source.type === 'sawtooth'
  // ...and at exactly two samples per cycle every shape is degenerate: the
  // samples only ever land on two phases, so the RMS becomes A|sin(phase)| and
  // the crest factor collapses to 1. That is the same failure the sampling
  // theorem warns about for amplitude, showing up in the power instead.
  const coarse =
    N <= 2
      ? 'Exactly two samples per cycle: the samples only ever land on two phases, so RMS depends on phase — A·|sin φ| — rather than on the shape. The continuous value does not apply.'
      : slowConverging && N < 16
        ? `Only ${Number(N.toFixed(2))} samples per period: the sampled values do not yet match the continuous integral for this shape.`
        : null

  const blocks = [F(w.tex), T(w.harmonics)]

  if (periodic) {
    blocks.push(
      T(
        'Root-mean-square is the amplitude a DC value would need to deliver the same power, and ' +
          'crest factor is how far the peak sits above it. They depend on the SHAPE, not the ' +
          'frequency: a square spends all its time at full amplitude and so has a crest factor ' +
          'of 1, while a triangle spends most of its time near zero.',
      ),
      F('x_{\\text{rms}} = \\sqrt{\\frac{1}{T}\\int_0^{T}\\! x(t)^2\\,dt}, \\qquad \\text{crest} = \\frac{x_{\\text{peak}}}{x_{\\text{rms}}}'),
      C([
        {
          label: 'RMS',
          predicted: w.rms(A),
          measured: measuredRms,
          tol: 0.02,
          unchecked: coarse,
        },
        {
          label: 'crest factor',
          predicted: w.crest,
          measured: measuredPeak / (measuredRms || 1e-12),
          tol: 0.05,
          unchecked: coarse,
        },
      ]),
    )
  }

  if (f0 > 0 && hasPeriod) {
    blocks.push(
      V([
        { label: 'samples per period', value: N, note: N < 4 ? 'very coarse' : '' },
        { label: 'bin width', value: binHz, unit: 'Hz' },
        {
          label: 'bins per period',
          value: f0 / binHz,
          note:
            Math.abs(f0 / binHz - Math.round(f0 / binHz)) < 1e-6
              ? 'a whole number, so no leakage'
              : 'not a whole number, so this tone leaks',
        },
        {
          label: 'harmonics below Nyquist',
          value: Math.max(0, Math.floor((sampleRate / 2 - 1e-9) / f0)),
        },
      ]),
    )
  }

  if (source.type === 'impulse' || source.type === 'step') {
    // These two have no period, so RMS and crest say nothing about them. What
    // does characterise them is how their energy is spread across the spectrum.
    const flat = (2 * A) / fftSize
    blocks.push(
      V(
        source.type === 'impulse'
          ? [
              { label: 'total energy A²', value: A * A },
              { label: 'flat spectrum level 2A/N', value: flat, note: 'every bin, equally' },
              { label: 'in dB', value: 20 * Math.log10(flat), unit: 'dB' },
              { label: 'frame length N', value: fftSize, unit: 'samples' },
            ]
          : [
              { label: 'final value', value: A },
              { label: 'mean over the frame', value: A, note: 'the step is held' },
              { label: 'bin width', value: binHz, unit: 'Hz' },
            ],
      ),
      T(
        source.type === 'impulse'
          ? 'One sample of energy shared across every bin, so the flat level sits low on the dB ' +
              'axis — 2A/N for an N-point frame. It is the SHAPE the chain gives that spectrum ' +
              'that matters here, not its height.'
          : 'Almost all of a step’s energy is at low frequency, falling as 1/f, so it drives a ' +
              'filter hard where the filter is doing most of its work. That is what makes ' +
              'overshoot and ringing visible.',
      ),
    )
  }

  if (source.type === 'noise') {
    blocks.push(
      V([
        { label: 'bin width', value: binHz, unit: 'Hz' },
        { label: 'bins in the frame', value: Math.floor(fftSize / 2) },
      ]),
      T(
        'The frequency control does nothing for noise — there is no period to set. Amplitude is ' +
          'the half-width of the uniform distribution, so the RMS is A/√3 and the spectrum is ' +
          'flat on average, with each bin fluctuating around that average from frame to frame.',
      ),
    )
  }

  if (f0 >= sampleRate / 2 && hasPeriod) {
    blocks.push(
      T(
        'This source is at or above Nyquist, so what you see is an alias — a lower frequency ' +
          'standing in for it. Nothing here can recover the original.',
      ),
    )
  }

  return { blocks }
}

// ----------------------------------------------------------------- blocks

/**
 * Measure a block's own magnitude response by running an impulse through it.
 *
 * Deliberately NOT biquadResponse: that is the same formula the block card is
 * already printing, and comparing a formula against itself proves nothing. An
 * impulse through the actual difference equation, transformed, is an
 * independent path — it checks that the code implements the transfer function
 * rather than merely that the algebra was retyped consistently.
 */
function measuredResponse(block, sampleRate, freqs) {
  const def = BLOCK_TYPES[block.type]
  const p = { ...def.defaults, ...block.params }
  // Long enough that the ring has died away; a truncated impulse response would
  // smear its own spectrum and blunt exactly the sharp features being checked.
  const { settle } = def.make(p, sampleRate)
  const n = Math.min(65536, Math.max(4096, Math.ceil((settle || 0) * 4)))

  const imp = new Float64Array(n)
  imp[0] = 1
  const h = applyChain([{ ...block, bypass: false }], imp, sampleRate, 0)

  // Evaluate the transform at exactly the frequencies asked for, rather than
  // reading an FFT bin grid. A notch is infinitely narrow, and the nearest bin
  // to its centre sits on the skirt beside the null — which read 0.063 where
  // the answer is 0, and looked like a broken filter rather than a blunt ruler.
  return freqs.map((f) => {
    const w = (-2 * Math.PI * f) / sampleRate
    let re = 0
    let im = 0
    for (let i = 0; i < n; i++) {
      const a = w * i
      re += h[i] * Math.cos(a)
      im += h[i] * Math.sin(a)
    }
    return Math.hypot(re, im)
  })
}

const BIQUAD_NAMES = {
  lowpass: 'Low-pass',
  highpass: 'High-pass',
  bandpass: 'Band-pass',
  notch: 'Notch',
  peaking: 'Peaking',
  allpass: 'All-pass',
}

/** |H| at the corner frequency, as an identity rather than an evaluation. */
const CORNER_IDENTITY = {
  lowpass: (p) => ({ value: p.q, tex: '|H(f_0)| = Q' }),
  highpass: (p) => ({ value: p.q, tex: '|H(f_0)| = Q' }),
  bandpass: () => ({ value: 1, tex: '|H(f_0)| = 1 \\quad\\text{for every } Q' }),
  notch: () => ({ value: 0, tex: '|H(f_0)| = 0' }),
  peaking: (p) => ({
    value: Math.pow(10, p.gainDb / 20),
    tex: '|H(f_0)| = 10^{G/20}',
  }),
  allpass: () => ({ value: 1, tex: '|H(f)| = 1 \\quad\\text{at every } f' }),
}

/**
 * Math for one block, with its own coefficients substituted.
 *
 * The point of showing the actual numbers is that a biquad is four multiply-adds
 * and nothing else. Seeing the difference equation with real coefficients in it
 * is what turns "a filter" from a black box into five numbers you could work out
 * by hand.
 */
export function blockMath(block, ctx) {
  const def = BLOCK_TYPES[block.type]
  if (!def) return null
  const { sampleRate } = ctx
  const p = { ...def.defaults, ...block.params }

  // Order 1 and 4 are different animals from the RBJ section: no Q exists at
  // first order, and at fourth the section Qs are Butterworth's, not the
  // knob's. Each gets its own panel, because the |H(f0)| = Q identity below is
  // an ORDER-2 fact and printing it against a cascade would mark correct
  // physics wrong.
  const order = Number(p.order ?? 2)
  if (BIQUAD_NAMES[block.type] && order === 1) {
    const meas = measuredResponse(block, sampleRate, [p.freq, 4 * p.freq])
    return {
      blocks: [
        T(
          'One pole, from the bilinear transform of 1/(1 + s/ω_c). The least a filter can be — ' +
            'and the reason there is no Q control: resonance takes two poles trading energy, ' +
            'and this section only has the one.',
        ),
        F(
          'H(s) = \\frac{1}{1 + s/\\omega_c} \\;\\longrightarrow\\; ' +
            'H(z) = \\frac{K + Kz^{-1}}{(K{+}1) + (K{-}1)z^{-1}}, \\quad K = \\tan(\\pi f_c/f_s)',
        ),
        C([
          {
            label: `|H| at f_c = ${sig(p.freq, 5)} Hz`,
            predicted: Math.SQRT1_2,
            measured: meas[0],
            tol: 0.02,
          },
          {
            // Predicted from the digital section's own closed form, not the
            // analog asymptote: the bilinear zero at Nyquist steepens the
            // curve well below it, and the analog ratio would mark a correct
            // filter wrong once 4 f_c gets anywhere near f_s/2. The measured
            // side still comes the independent way, impulse through the real
            // processor.
            label: '|H(f_c)| / |H(4f_c)| — two octaves of rolloff',
            predicted: (() => {
              const co = designFirstOrder({ mode: block.type, freq: p.freq }, sampleRate)
              return (
                biquadResponse(co, p.freq, sampleRate) /
                (biquadResponse(co, 4 * p.freq, sampleRate) || 1e-12)
              )
            })(),
            measured: meas[0] / (meas[1] || 1e-12),
            tol: 0.02,
            unchecked:
              4 * p.freq >= sampleRate * 0.499
                ? 'The octave probe would land beyond Nyquist at this cutoff.'
                : null,
          },
        ]),
        V([
          { label: 'order', value: 1 },
          { label: 'rolloff', value: 6, unit: 'dB/octave', note: '= 20 dB/decade; ×1 for order 1' },
          { label: 'poles', value: 1, note: 'so it cannot ring' },
        ]),
      ],
    }
  }
  if (BIQUAD_NAMES[block.type] && order === 4) {
    const qs = butterworthQs(4)
    const meas = measuredResponse(block, sampleRate, [p.freq])
    return {
      blocks: [
        T(
          'A true 4th-order Butterworth: two second-order sections in series, with the section ' +
            'Qs chosen by the mathematics — NOT the same Q twice. That choice is what keeps the ' +
            'passband maximally flat and the corner at exactly −3.01 dB.',
        ),
        F(
          `Q_k = \\frac{1}{2\\cos\\left(\\frac{(2k+1)\\pi}{8}\\right)} ` +
            `\\;\\Rightarrow\\; Q_1 = ${sig(qs[0], 4)}, \\; Q_2 = ${sig(qs[1], 4)}`,
        ),
        C([
          {
            label: `|H| at f_c = ${sig(p.freq, 5)} Hz`,
            predicted: Math.SQRT1_2,
            measured: meas[0],
            tol: 0.02,
          },
        ]),
        T(
          'Every true Butterworth passes −3.01 dB at its cutoff whatever its order. Two ' +
            'identical Q = 0.707 sections would instead sag to −6.02 dB there — same far ' +
            'slope, different filter. The "Order is a choice" preset puts the two side by side.',
        ),
        V([
          { label: 'order', value: 4 },
          { label: 'rolloff', value: 24, unit: 'dB/octave', note: '= 80 dB/decade; 6 dB/oct × order 4' },
          { label: 'section Qs', value: Number(qs[0].toPrecision(4)), note: `and ${Number(qs[1].toPrecision(4))}` },
        ]),
      ],
    }
  }

  if (BIQUAD_NAMES[block.type]) {
    const co = designBiquad({ mode: block.type, ...p }, sampleRate)
    const r = poleRadius(co)
    const ident = CORNER_IDENTITY[block.type](p)
    const probes = [p.freq, sampleRate / 4, sampleRate / 2 - 1]
    const meas = measuredResponse(block, sampleRate, probes)

    return {
      blocks: [
        T(
          'A biquad is a second-order section: two samples of memory on the input, two on the ' +
            'output, and five coefficients. Everything a filter of this kind can do lives here.',
        ),
        F(
          'H(z) = \\frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{1 + a_1 z^{-1} + a_2 z^{-2}}',
        ),
        T('With the current settings the coefficients are'),
        F(
          `H(z) = \\frac{${sig(co.b0)} ${signed(co.b1)}z^{-1} ${signed(co.b2)}z^{-2}}` +
            `{1 ${signed(co.a1)}z^{-1} ${signed(co.a2)}z^{-2}}`,
        ),
        T('which the code runs as a difference equation, one multiply-add per coefficient:'),
        F(
          `y[n] = ${sig(co.b0)}\\,x[n] ${signed(co.b1)}\\,x[n{-}1] ${signed(co.b2)}\\,x[n{-}2] ` +
            `${signed(-co.a1)}\\,y[n{-}1] ${signed(-co.a2)}\\,y[n{-}2]`,
        ),
        T(
          'The poles sit at radius r from the origin. Inside the unit circle the filter is ' +
            'stable and its ringing dies away as rⁿ; at r = 1 it would ring forever, and beyond ' +
            'it the output would grow without limit.',
        ),
        V([
          { label: 'pole radius r', value: r, note: isStable(co) ? 'stable (r < 1)' : 'UNSTABLE' },
          {
            label: 'ring decays to 1e-6 in',
            value: r > 0 && r < 1 ? Math.round(Math.log(1e-6) / Math.log(r)) : Infinity,
            unit: 'samples',
          },
          { label: 'cutoff as a fraction of Nyquist', value: p.freq / (sampleRate / 2) },
          { label: 'order of this section', value: 2 },
          { label: 'rolloff', value: 12, unit: 'dB/octave', note: '= 40 dB/decade; 6 dB/oct × order 2' },
        ]),
        T(
          'Second order is this block, not filters in general. A filter can be any order, and ' +
            'order is what sets how fast it rolls off: about 6 dB per octave for each order, so ' +
            '12 for this one. Nothing here is limited to second order — you raise the order by ' +
            'putting sections in series, and two of these in a row is a fourth-order filter.',
        ),
        F('\\text{rolloff} \\to 6N\\ \\text{dB/octave} \\quad (N = \\text{order})'),
        T(
          'The catch is that cascading identical sections does NOT give a named filter. A ' +
            'Butterworth — the maximally flat one — needs a specific Q for each section, and ' +
            'only the second-order case is 0.707:',
        ),
        F(
          'Q_k = \\frac{1}{2\\cos\\!\\left(\\frac{(2k+1)\\pi}{2N}\\right)}, ' +
            '\\qquad k = 0 \\ldots \\tfrac{N}{2}-1',
        ),
        T(
          'Order 4 wants Q = 0.541 and 1.307; order 6 wants 0.518, 0.707 and 1.932. Use 0.707 ' +
            'twice instead and the order is still 4 and the far slope is unchanged, but the ' +
            'corner sags to −6 dB where a Butterworth holds −3. The preset "Order is a choice" ' +
            'has both side by side.',
        ),
        T(`At the corner frequency this mode has a defining value, ${BIQUAD_NAMES[block.type]}:`),
        F(ident.tex),
        T(
          'The measured column below is not that formula evaluated again — it is an impulse sent ' +
            'through the difference equation above and transformed back. If the code did not ' +
            'implement the algebra, these two would part company.',
        ),
        C([
          {
            label: `|H| at f₀ = ${sig(p.freq, 5)} Hz`,
            predicted: ident.value,
            measured: meas[0],
            tol: 0.03,
            abs: 0.02,
          },
          {
            label: `|H| at ${sig(sampleRate / 4, 5)} Hz`,
            predicted: def.response(p, sampleRate / 4, sampleRate),
            measured: meas[1],
            tol: 0.03,
            abs: 0.01,
          },
          {
            label: '|H| just below Nyquist',
            predicted: def.response(p, sampleRate / 2 - 1, sampleRate),
            measured: meas[2],
            tol: 0.05,
            abs: 0.01,
          },
        ]),
      ],
    }
  }

  if (block.type === 'gain') {
    const g = Math.pow(10, p.gainDb / 20)
    return {
      blocks: [
        T('A scaling and an offset — the only affine thing in the chain.'),
        F(`y[n] = g\\,x[n] + d, \\qquad g = 10^{G/20} = ${sig(g)}, \\quad d = ${sig(p.dcOffset)}`),
        T(
          'Decibels are logarithmic, so 20 dB is a factor of ten in amplitude and 6.02 dB is a ' +
            'factor of two. The offset is not a gain at all: it adds a constant, which appears ' +
            'as a spike in the 0 Hz bin and shifts the waveform off centre.',
        ),
        T(
          'That offset matters most in front of something nonlinear. A symmetric clipper makes ' +
            'only odd harmonics; move the signal off centre first and the even ones appear.',
        ),
        V([
          { label: 'amplitude gain', value: g, unit: '×' },
          { label: 'power gain', value: g * g, unit: '×' },
          { label: 'DC offset', value: p.dcOffset },
        ]),
      ],
    }
  }

  if (block.type === 'clip') {
    const c = p.threshold
    return {
      blocks: [
        T('Memoryless, and flat beyond the threshold in both directions.'),
        F(`y = \\max(-c,\\ \\min(c,\\ x)), \\qquad c = ${sig(c)}`),
        T(
          'This is not expressible as H(f)·X(f) for any H, which is what "nonlinear" means here ' +
            'and why the response curve on the spectrum turns dashed. In the hard limit, where a ' +
            'sine is flattened almost into a square, the harmonics approach',
        ),
        F('A_k = \\frac{4c}{k\\pi}, \\qquad k \\text{ odd}'),
        T(
          'Odd only, because clipping is an odd function: f(−x) = −f(x). Break that symmetry ' +
            'with a DC offset upstream and the even harmonics arrive.',
        ),
      ],
    }
  }

  if (block.type === 'biquad') {
    if (!isStable(p)) {
      return {
        blocks: [
          T(
            'These coefficients put a pole ON or OUTSIDE the unit circle, so the section would ' +
              'grow its own output without bound. The block is passing the signal through ' +
              'untouched until the poles come back inside: |a₂| < 1 and |a₁| < 1 + a₂.',
          ),
          F('|a_2| < 1 \\quad\\text{and}\\quad |a_1| < 1 + a_2'),
          V([
            { label: 'pole radius r', value: poleRadius(p), note: 'must be < 1' },
          ]),
        ],
      }
    }
    const r = poleRadius(p)
    const probes = [sampleRate / 16, sampleRate / 8, sampleRate / 4]
    const meas = measuredResponse(block, sampleRate, probes)
    return {
      blocks: [
        T(
          'The five numbers themselves — what every named filter block reduces to, and what a ' +
            'hand-over from Circuit Lab delivers bilinear-exactly. The code runs them as one ' +
            'multiply-add per coefficient:',
        ),
        F(
          `y[n] = ${sig(p.b0)}\\,x[n] ${signed(p.b1)}\\,x[n{-}1] ${signed(p.b2)}\\,x[n{-}2] ` +
            `${signed(-p.a1)}\\,y[n{-}1] ${signed(-p.a2)}\\,y[n{-}2]`,
        ),
        T(
          'The measured column below is an impulse pushed through that difference equation and ' +
            'transformed back — an independent path from the closed form it is checked against.',
        ),
        C(
          probes.map((f, i) => ({
            label: `|H| at ${sig(f, 5)} Hz`,
            predicted: biquadResponse(p, f, sampleRate),
            measured: meas[i],
            tol: 0.02,
          })),
        ),
        V([
          { label: 'pole radius r', value: r, note: 'stable (r < 1)' },
          {
            label: 'ring decays to 1e-6 in',
            value: r > 0 && r < 1 ? Math.round(Math.log(1e-6) / Math.log(r)) : 2,
            unit: 'samples',
          },
          {
            // The section HOLDS two of everything, but the filter's order is
            // what its trailing coefficients say: a first-order RC arrives
            // with b2 = a2 = 0 and printing "2" for it was a frozen sentence.
            label: 'order of this filter',
            value: Math.abs(p.a2) > 1e-12 || Math.abs(p.b2) > 1e-12 ? 2 : Math.abs(p.a1) > 1e-12 || Math.abs(p.b1) > 1e-12 ? 1 : 0,
            note: 'read from the highest nonzero coefficient',
          },
        ]),
      ],
    }
  }

  if (block.type === 'movingavg') {
    const N = p.taps
    const spacing = sampleRate / N
    // DC, then the first two nulls. Measured by impulse through the real filter.
    const probes = [0, spacing, 2 * spacing].filter((f) => f < sampleRate / 2)
    const meas = measuredResponse(block, sampleRate, probes)

    return {
      blocks: [
        T(
          'Add up the last N samples and divide by N. There is no feedback anywhere in it, so ' +
            'the coefficients ARE the filter — all N of them equal to 1/N.',
        ),
        F(`y[n] = \\frac{1}{N}\\sum_{k=0}^{N-1} x[n-k], \\qquad N = ${N}`),
        T(
          'Summing a whole number of cycles of a sine gives exactly zero, so every frequency ' +
            'that fits a whole number of cycles into the window is removed completely. That is ' +
            'the entire explanation for where the nulls are:',
        ),
        F(`|H(f)| = \\left|\\frac{\\sin(\\pi f N / f_s)}{N\\,\\sin(\\pi f / f_s)}\\right|`),
        C([
          { label: '|H| at DC', predicted: 1, measured: meas[0], tol: 1e-6 },
          ...(probes.length > 1
            ? [
                {
                  label: `|H| at fₛ/N = ${sig(spacing, 5)} Hz`,
                  predicted: 0,
                  measured: meas[1],
                  abs: 1e-9,
                },
              ]
            : []),
          ...(probes.length > 2
            ? [
                {
                  label: `|H| at 2fₛ/N = ${sig(2 * spacing, 5)} Hz`,
                  predicted: 0,
                  measured: meas[2],
                  abs: 1e-9,
                },
              ]
            : []),
        ]),
        T(
          'Because the taps are all the same they are trivially symmetric, and a symmetric ' +
            'kernel delays every frequency by the same amount. Nothing is smeared: the output ' +
            'is the filtered signal, late by half the window and not otherwise reshaped.',
        ),
        V([
          { label: 'taps N', value: N },
          { label: 'null spacing fₛ/N', value: spacing, unit: 'Hz' },
          { label: 'group delay (N−1)/2', value: (N - 1) / 2, unit: 'samples' },
          { label: 'settles in exactly', value: N - 1, unit: 'samples' },
          { label: 'zeros on the unit circle', value: N - 1 },
        ]),
      ],
    }
  }

  if (block.type === 'fir') {
    const h = designFir(p, sampleRate)
    const N = h.length
    const M = (N - 1) / 2
    const hp = p.mode === 'highpass'
    // The largest disagreement between a tap and its mirror. Read off the
    // kernel the designer actually produced, so it can genuinely fail.
    let asym = 0
    for (let k = 0, j = N - 1; k < j; k++, j--) asym = Math.max(asym, Math.abs(h[k] - h[j]))
    const meas = measuredResponse(block, sampleRate, [0])

    return {
      blocks: [
        T(
          'The ideal filter is a rectangle in frequency, and the inverse transform of a ' +
            'rectangle is a sinc running to infinity in both directions. You cannot store that, ' +
            'so it is cut to N taps and tapered by a window.',
        ),
        F(
          `h[k] = w[k]\\;\\frac{\\sin\\bigl(2\\pi f_c (k - M)/f_s\\bigr)}{\\pi (k - M)}, ` +
            `\\qquad M = \\frac{N-1}{2} = ${M}`,
        ),
        T(
          hp
            ? 'For the high-pass the low-pass is subtracted from an all-pass delayed by the same ' +
              'M samples, so the two line up before they cancel. That makes the null at DC exact ' +
              'rather than approximate:'
            : 'The taps are scaled so they sum to one, which makes the DC gain exactly one rather ' +
              'than approximately one:',
        ),
        C([
          {
            label: '|H| at DC',
            predicted: hp ? 0 : 1,
            measured: meas[0],
            tol: 1e-6,
            abs: 1e-9,
          },
          {
            label: 'largest h[k] − h[N−1−k]',
            predicted: 0,
            measured: asym,
            abs: 1e-15,
          },
        ]),
        T(
          'That second row is the whole reason to reach for an FIR. A symmetric kernel has ' +
            'exactly linear phase, so every frequency is held up by the same M samples and the ' +
            'waveform arrives late but undistorted. No amount of feedback can achieve that, ' +
            'which is why no biquad in this rack has a flat group delay.',
        ),
        F('H(\\omega) = A(\\omega)\\,e^{-j\\omega M}, \\qquad A(\\omega)\\ \\text{real}'),
        T(
          p.window === 'none'
            ? 'With no window the cut is abrupt, and an abrupt cut is itself a rectangular ' +
              'window whose leakage puts about 9% of overshoot beside the corner. Adding taps ' +
              'makes that ripple NARROWER but no shorter — Gibbs again. Choose a taper to remove ' +
              'it.'
            : 'The window trades transition width against stopband depth. A wider taper reaches ' +
              'deeper but takes longer to get there, which is why the choice exists at all.',
        ),
        V([
          { label: 'taps N', value: N, note: 'forced odd' },
          { label: 'group delay (N−1)/2', value: M, unit: 'samples' },
          { label: 'group delay', value: (1000 * M) / sampleRate, unit: 'ms' },
          { label: 'settles in exactly', value: N - 1, unit: 'samples' },
          { label: 'zeros', value: N - 1 },
          { label: 'poles away from the origin', value: 0, note: 'so it cannot be unstable' },
          {
            label: 'multiply-adds per sample',
            value: N,
            note: 'a biquad needs 5',
          },
        ]),
      ],
    }
  }

  if (block.type === 'comb') {
    const D = Math.max(1, Math.round((p.delayMs / 1000) * sampleRate))
    const fb = p.mode === 'feedback'
    return {
      blocks: [
        T(
          fb
            ? 'Feeding the delayed copy back makes this an IIR filter: its response never quite ends.'
            : 'Adding a delayed copy makes this an FIR filter: its response is exactly D+1 samples long.',
        ),
        F(
          fb
            ? `H(z) = \\frac{1}{1 - g\\,z^{-D}}, \\qquad g = ${sig(p.g)}, \\quad D = ${D}`
            : `H(z) = 1 + g\\,z^{-D}, \\qquad g = ${sig(p.g)}, \\quad D = ${D}`,
        ),
        T(
          fb
            ? 'The delayed copy reinforces itself wherever the delay is a whole number of periods, ' +
              'so the comb’s teeth point up: peaks every fₛ/D, of height 1/(1−g).'
            : 'The two paths cancel wherever the delay is an odd number of half periods, so the ' +
              'comb’s teeth point down: nulls every fₛ/D.',
        ),
        V([
          { label: 'delay D', value: D, unit: 'samples' },
          { label: 'delay', value: (1000 * D) / sampleRate, unit: 'ms' },
          { label: 'tooth spacing', value: sampleRate / D, unit: 'Hz' },
          ...(fb ? [{ label: 'peak height 1/(1−g)', value: 1 / (1 - Math.min(0.999, p.g)) }] : []),
        ]),
      ],
    }
  }

  if (block.type === 'ringmod') {
    return {
      blocks: [
        T('Multiplication by a sine, sample by sample.'),
        F(`y(t) = x(t)\\,\\sin(2\\pi f_c t), \\qquad f_c = ${sig(p.freq, 5)}\\ \\text{Hz}`),
        T('For a single input tone the product identity says exactly what comes out:'),
        F(
          '\\cos(2\\pi f_1 t)\\cos(2\\pi f_c t) = \\tfrac{1}{2}\\cos\\bigl(2\\pi(f_c - f_1)t\\bigr)' +
            ' + \\tfrac{1}{2}\\cos\\bigl(2\\pi(f_c + f_1)t\\bigr)',
        ),
        T(
          'Neither f₁ nor f_c appears on the right, which is why both inputs vanish. More ' +
            'generally, multiplying in time is convolving in frequency, and convolving with a ' +
            'pair of impulses at ±f_c is what copies the spectrum up around the carrier.',
        ),
        F('x(t)\\,c(t) \\;\\longleftrightarrow\\; X(f) * C(f)'),
      ],
    }
  }

  if (block.type === 'quantize') {
    const bits = p.bits
    return {
      blocks: [
        T('Rounding to a fixed grid — what an analogue-to-digital converter does.'),
        F(`\\Delta = \\frac{2}{2^{N}} = ${sig(2 / Math.pow(2, bits))}, \\qquad N = ${bits}\\ \\text{bits}`),
        T(
          'If the rounding error were random and independent of the signal, its power would be ' +
            'Δ²/12 and the signal-to-noise ratio would be',
        ),
        F('\\text{SNR} \\approx 6.02N + 1.76\\ \\text{dB}'),
        T(
          'It is neither random nor independent. For a periodic input the error repeats with the ' +
            'signal, so it lands on harmonics — the spurs you can see. Dither adds a small random ' +
            'offset before rounding, which decorrelates the error and turns the spurs into the ' +
            'smooth floor the formula assumed all along.',
        ),
        V([
          { label: 'levels', value: Math.pow(2, bits) },
          { label: 'step Δ', value: 2 / Math.pow(2, bits) },
          { label: 'ideal SNR', value: 6.02 * bits + 1.76, unit: 'dB' },
          { label: 'dither', value: p.dither ? 1 : 0, note: p.dither ? 'on' : 'off' },
        ]),
      ],
    }
  }

  if (block.type === 'rectify') {
    return {
      blocks: [
        T('Absolute value: the negative half is folded upwards.'),
        F('y = |x|'),
        T(
          'For a sine this halves the period, so the output is built entirely from EVEN ' +
            'harmonics of the original, plus a large DC term:',
        ),
        F('|A\\sin\\omega t| = \\frac{2A}{\\pi} - \\frac{4A}{\\pi}\\sum_{m=1}^{\\infty}\\frac{\\cos(2m\\omega t)}{4m^{2}-1}'),
        T(
          'The 2A/π is the DC average, and the fundamental is entirely absent — the one frequency ' +
            'that went in is the one frequency missing from what comes out.',
        ),
        V([{ label: 'DC term 2A/π (for A = 1)', value: 2 / Math.PI }]),
      ],
    }
  }

  return null
}
