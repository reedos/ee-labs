import { designBiquad, biquadResponse } from './dsp/biquad.js'

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

  'Square = odd harmonics': (ctx) => {
    const f0 = ctx.sourceFreq || 250
    const N = ctx.sampleRate / f0
    const rows = [1, 3, 5].map((k) => ({
      label: `harmonic ${k} (${k * f0} Hz)`,
      predicted: (4 / (k * Math.PI)) * discreteBoost(k, N),
      measured: ctx.at(k * f0),
      tol: 0.05,
      unchecked: harmonicCheck(ctx, k),
    }))
    // Predicted exactly zero, so a relative tolerance cannot judge it. -80 dB
    // against a fundamental of 1.27 is unambiguously absent; what is actually
    // measured is nearer -134 dB.
    rows.push({
      label: 'harmonic 2 (absent)',
      predicted: 0,
      measured: ctx.at(2 * f0),
      abs: 1e-4,
      unchecked: harmonicCheck(ctx, 2),
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
            'period instead of integrating multiplies each harmonic by a small factor — 0.2% at ' +
            'the fundamental, 4% by the fifth:',
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
            unchecked:
              harmonicCheck(ctx, 1) ||
              harmonicCheck(ctx, 3) ||
              (ctx.sampleRate / f0 < 16 ? NOTE_COARSE : null),
          },
        ]),
      ],
    }
  },

  'Build a square': () => ({
    blocks: [
      T(
        'Adding the first three odd harmonics at 1, 1/3 and 1/5 already gives something ' +
          'square-ish. The series converges, but not uniformly: the overshoot at each corner ' +
          'stays about 9% of the jump no matter how many terms you add, and merely gets ' +
          'narrower. That is the Gibbs phenomenon.',
      ),
      F('S_M(t) = \\frac{4A}{\\pi}\\sum_{m=0}^{M} \\frac{\\sin\\bigl(2\\pi(2m+1)f_0t\\bigr)}{2m+1}'),
      F('\\lim_{M\\to\\infty} \\max_t S_M(t) = A\\cdot 1.0895\\ldots'),
    ],
  }),

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
        C([
          {
            label: 'A·|sin φ|',
            predicted: Math.abs(Math.sin(phi)) * (src ? src.amp : 1),
            measured: ctx.at(ctx.sampleRate / 2),
            tol: 0.05,
          },
        ]),
      ],
    }
  },

  'Resolution needs time': (ctx) => {
    const binHz = ctx.sampleRate / ctx.fftSize
    const fs = ctx.sources.filter((s) => s.enabled).map((s) => s.freq)
    const sep = fs.length >= 2 ? Math.abs(fs[0] - fs[1]) : 0
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
          { label: 'frame length', value: (1000 * ctx.fftSize) / ctx.sampleRate, unit: 'ms' },
          { label: 'tone separation', value: sep, unit: 'Hz' },
          { label: 'bins between them', value: sep / binHz },
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

  'Low-pass a square': (ctx) => {
    const b = ctx.blocks[0]
    const rows = []
    if (b) {
      const co = designBiquad({ mode: b.type, ...b.params }, ctx.sampleRate)
      for (const k of [1, 3, 5]) {
        const f = (ctx.sourceFreq || 250) * k
        rows.push({
          label: `|H| at ${f} Hz`,
          // Numerator and denominator are the same bin of the same window, so
          // scalloping divides straight out and only Nyquist can spoil this.
          unchecked: f >= ctx.sampleRate / 2 ? NOTE_ALIASED : null,
          predicted: biquadResponse(co, f, ctx.sampleRate),
          measured: ctx.dryAt ? ctx.at(f) / (ctx.dryAt(f) || 1e-12) : NaN,
          tol: 0.08,
        })
      }
    }
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
      const peak = ctx.respAt(b.params.freq)
      rows.push({
        label: 'peak |H| at cutoff',
        predicted: b.params.q,
        measured: peak,
        tol: 0.02,
      })
      rows.push({
        label: 'peak in dB',
        predicted: 20 * Math.log10(b.params.q),
        measured: 20 * Math.log10(peak),
        unit: 'dB',
        tol: 0.05,
      })
    }
    return {
      blocks: [
        T('A second-order low-pass has the transfer function'),
        F('H(s) = \\frac{\\omega_0^{2}}{s^{2} + \\dfrac{\\omega_0}{Q}s + \\omega_0^{2}}'),
        T('At s = jω₀ the first and last terms cancel exactly, leaving'),
        F('|H(j\\omega_0)| = \\frac{\\omega_0^{2}}{\\dfrac{\\omega_0}{Q}\\,\\omega_0} = Q'),
        T(
          'That is the whole definition. It is specific to the low-pass (and high-pass): a ' +
            'band-pass is normalized so |H(jω₀)| = 1 whatever Q is, and there Q sets the ' +
            'bandwidth instead, as ω₀/Q.',
        ),
        C(rows),
      ],
    }
  },

  'Phase is invisible here': () => ({
    blocks: [
      T(
        'An all-pass places each pole and zero as a mirror pair about the unit circle, so every ' +
          'magnitude cancels and only the angle survives:',
      ),
      F('H(z) = \\frac{z^{-2} + a_1 z^{-1} + a_2}{1 + a_1 z^{-1} + a_2 z^{-2}}, \\qquad |H| = 1'),
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
    ],
  }),

  'Two filters are steeper': (ctx) => {
    const rows = []
    if (ctx.blocks.length >= 2) {
      const one = designBiquad({ mode: ctx.blocks[0].type, ...ctx.blocks[0].params }, ctx.sampleRate)
      for (const f of [1600, 3200]) {
        const h = biquadResponse(one, f, ctx.sampleRate)
        rows.push({
          label: `|H|² at ${f} Hz`,
          predicted: h * h,
          measured: ctx.respAt(f),
          tol: 0.02,
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
    const isBw =
      qs.length === 2 &&
      bw(4).every((q, i) => Math.abs(qs[i] - q) < 0.01)

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
              : 'The two Q values are no longer the Butterworth pair, so −3.01 dB is not what this cascade is aiming for.',
          },
        ]),
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
      T(
        'A unit sample has a perfectly flat spectrum, because it is the sum of every frequency ' +
          'in equal measure. Feed it in and the output spectrum IS |H(f)|, while the time view ' +
          'draws h[n] directly.',
      ),
      F('x[n] = \\delta[n] \\;\\Rightarrow\\; y[n] = h[n], \\qquad |X(f)| = \\text{constant}'),
      T(
        'That flat level sits low on the dB axis, at 2/N for an N-point frame, because one ' +
          'sample of energy is being shared out across every bin. It is the shape that matters, ' +
          'not the height.',
      ),
      C([
        {
          label: 'flat input level (2/N)',
          predicted: 2 / ctx.fftSize,
          measured: ctx.dryAt ? ctx.dryAt(ctx.sampleRate / 4) : NaN,
          tol: 0.1,
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
          'At ζ = 1/√2, meaning Q = 0.707, the overshoot is essentially gone and the response ' +
            'is as fast as it can be without ringing. That is the same Q that gives the flattest ' +
            'possible passband — the Butterworth condition, arrived at from the time side.',
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
      F('x^{2} = \\tfrac{1}{2}\\bigl(1 - \\cos 2\\omega t\\bigr) \\quad\\text{(second harmonic, and DC)}'),
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

  'Two tones, one nonlinearity': () => ({
    blocks: [
      T('Put two tones through a power series and the cross terms are the whole story:'),
      F(
        '(\\cos\\omega_1 t + \\cos\\omega_2 t)^{3} \\;\\longrightarrow\\; ' +
          '\\cos(2\\omega_1 \\pm \\omega_2)t,\\; \\cos(2\\omega_2 \\pm \\omega_1)t,\\;\\ldots',
      ),
      T('In general every product sits at'),
      F('f = |m f_1 \\pm n f_2|, \\qquad m,n \\in \\mathbb{Z}'),
      T(
        'with order m + n. Third-order products are the troublesome ones: 2f₂ − f₁ lands close ' +
          'to the originals, so no filter can remove it without removing the signal too. That ' +
          'single fact sets the linearity requirement for most radio and optical front ends.',
      ),
      T(
        'A linear system can only scale and delay the frequencies already present. Creating new ' +
          'ones is the definition of nonlinearity, and it is what this preset makes visible.',
      ),
    ],
  }),

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
        'and convolving with a pair of impulses at ±f_c is exactly what copies the spectrum up ' +
          'to sit around the carrier.',
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
    const spacing = ctx.sampleRate / D
    return {
      blocks: [
        T('Adding a delayed copy gives a transfer function with evenly spaced nulls:'),
        F('H(z) = 1 + g\\,z^{-D} \\qquad |H(f)| = \\bigl|1 + g\\,e^{-j2\\pi fD/f_s}\\bigr|'),
        T(
          'The two terms cancel wherever the delay is an odd number of half periods, which ' +
            'happens every f_s/D hertz. Feeding the output back instead inverts the shape — the ' +
            'nulls become resonances, and the filter is now IIR:',
        ),
        F('H(z) = \\frac{1}{1 - g\\,z^{-D}}'),
        V([
          { label: 'delay D', value: D, unit: 'samples' },
          { label: 'notch spacing', value: spacing, unit: 'Hz' },
        ]),
      ],
    }
  },

  '4 bits': (ctx) => {
    const b = ctx.blocks[0]
    const bits = b ? b.params.bits : 8
    return {
      blocks: [
        T('Rounding to a grid of step Δ leaves an error bounded by half a step:'),
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
    peakFreq,
    at: peakNear(amps),
    dryAt: ghostAmps ? peakNear(ghostAmps) : null,
    respAt: (f) => (resp ? resp.mag[nearest(f)] : NaN),
  }
}
