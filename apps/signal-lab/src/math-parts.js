import { render, rms, peak, spectrum } from '@ee-labs/dsp'
import { applyChain } from './dsp/chain.js'
import { BLOCK_TYPES } from './dsp/blocks.js'
import { biquadPolesZeros, biquadResponse, butterworthQs, designBiquad, designFirstOrder, designFir, poleRadius, isStable } from '@ee-labs/dsp'

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

/** 1st, 3rd, 5th, 11th — the ordinal suffix, for naming a harmonic. */
const ord = (n) => {
  const t = n % 100
  if (t >= 11 && t <= 13) return 'th'
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'
}

/** The largest odd number not exceeding n — a square stops only on odd terms. */
const oddAtOrBelow = (n) => (n < 1 ? 0 : n % 2 === 1 ? n : n - 1)

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
    // The continuous Fourier-series amplitude of harmonic k, per unit A —
    // what the infinite series above assigns, before sampling folds it.
    coeff: (k) => 4 / (k * Math.PI),
    kStep: 2,
    harmonics:
      'Odd harmonics only, falling as 1/k. The wave is antisymmetric about half a period, and an ' +
      'even harmonic could not survive that flip.',
  },
  triangle: {
    tex: 'x(t) = \\frac{8A}{\\pi^{2}}\\sum_{m=0}^{\\infty}\\frac{(-1)^{m}\\sin\\bigl(2\\pi(2m+1)f_0t\\bigr)}{(2m+1)^{2}}',
    rms: (a) => a / Math.sqrt(3),
    crest: Math.sqrt(3),
    coeff: (k) => 8 / (k * k * Math.PI * Math.PI),
    kStep: 2,
    harmonics:
      'Odd harmonics again, but falling as 1/k². The wave itself has no jumps — only its slope ' +
      'does — and one extra degree of smoothness costs one extra power of k.',
  },
  sawtooth: {
    tex: 'x(t) = \\frac{2A}{\\pi}\\sum_{k=1}^{\\infty}\\frac{(-1)^{k+1}\\sin(2\\pi k f_0 t)}{k}',
    rms: (a) => a / Math.sqrt(3),
    crest: Math.sqrt(3),
    coeff: (k) => 2 / (k * Math.PI),
    kStep: 1,
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
  const base = WAVE_MATH[source.type]
  if (!base) return null

  // A band-limited square is a different object from the naive one and its
  // arithmetic follows: the series stops, so the RMS is the root-sum-square
  // of the harmonics that are actually there rather than A, and there is no
  // tail left to fold. Its PEAK has no elementary closed form — truncating
  // the series is what produces Gibbs overshoot — so the crest row states
  // that instead of predicting it.
  // K is the highest odd harmonic kept, so the series holds (K+1)/2 terms.
  const K = source.type === 'square' ? oddAtOrBelow(Math.round(Number(source.topHarmonic) || 0)) : 0
  const terms = (K + 1) / 2
  const w =
    K > 0
      ? {
          ...base,
          tex: `x(t) = \\frac{4A}{\\pi}\\sum_{\\substack{k=1\\\\k\\text{ odd}}}^{${K}}\\frac{\\sin(2\\pi k f_0 t)}{k}`,
          rms: (a) => {
            let acc = 0
            for (let k = 1; k <= K; k += 2) acc += 1 / (k * k)
            return a * (4 / Math.PI) * Math.sqrt(acc / 2)
          },
          crest: null,
          // Nothing exists above the last harmonic, so nothing folds from there.
          coeff: null,
          harmonics:
            `The same series as a square, stopped at the ${K}${ord(K)} harmonic — ${terms} term` +
            `${terms === 1 ? '' : 's'}, since only the odd ones are there. Its highest component is ` +
            `therefore exactly ${K}·f₀, a finite number where a real square's is infinite. That is ` +
            'what makes it the one waveform here whose sampling requirement can be met rather than ' +
            'merely approached: clear twice that frequency and the samples describe it perfectly, ' +
            'with nothing left over to fold.',
        }
      : base

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
    N < 2
      ? 'Fewer than two samples per cycle: the waveform is undersampled outright, and the continuous RMS does not apply.'
      : N === 2
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
          unchecked:
            w.crest == null
              ? 'A truncated series overshoots at each edge — Gibbs — and that peak has no elementary closed form to predict, so it is measured and not claimed.'
              : coarse,
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
        // Counted only for waveforms that HAVE a harmonic series, and only
        // the harmonics their series contains: a sine got "15" here once —
        // fifteen empty slots — and a square was credited with the even
        // harmonics its own lesson says it lacks.
        ...(source.type === 'sine'
          ? []
          : [
              (() => {
                const K = Math.max(0, Math.floor((sampleRate / 2 - 1e-9) / f0))
                const odd = source.type !== 'sawtooth'
                return {
                  label: odd ? 'odd harmonics below Nyquist' : 'harmonics below Nyquist',
                  value: odd ? Math.ceil(K / 2) : K,
                }
              })(),
            ]),
      ]),
    )
  }

  // ---- continuous vs sampled: what the infinite series above cannot keep ----
  //
  // The series in the header is the CONTINUOUS ideal: harmonics forever. This
  // generator computes that ideal's samples directly (no band-limiting on
  // purpose — see signals.js), and a sampled world cannot hold anything above
  // Nyquist, so the tail does not vanish: it folds. Where it folds is exact
  // arithmetic; whether it is VISIBLE depends on fs/f0 — an integer puts every
  // fold exactly on a lower harmonic, shifting amplitudes instead of adding
  // lines. Both cases are named, and the amplitude check carries the folded
  // tail in its tolerance rather than pretending the ideal survives sampling.
  const nyq = sampleRate / 2
  const foldOf = (f) => Math.abs(f - sampleRate * Math.round(f / sampleRate))
  const measured = f0 > 0 && hasPeriod ? spectrum(buf, sampleRate) : null
  const measBin = sampleRate / 4096
  const centred = Math.abs(f0 / measBin - Math.round(f0 / measBin)) < 1e-9
  const ampNear = (f) => {
    const i = Math.round(f / measBin)
    let best = 0
    for (let j = Math.max(0, i - 1); j <= Math.min(measured.amps.length - 1, i + 1); j++)
      best = Math.max(best, measured.amps[j])
    return best
  }

  // The band-limited square is the only source here that can SATISFY the
  // sampling theorem rather than approach it, so the panel says what it costs
  // and then checks that it was paid.
  if (K > 0 && f0 > 0) {
    const top = K * f0
    const need = 2 * top
    const clears = sampleRate > need
    const onBin = Math.abs(top / measBin - Math.round(top / measBin)) < 1e-6
    blocks.push(
      T(
        'A signal built from a finite set of harmonics has a highest one, and the sampling ' +
          'theorem asks for a rate STRICTLY above twice it. Meet that and the samples carry the ' +
          'whole signal: the reconstruction through them is not an approximation of this ' +
          'waveform, it is this waveform. Miss it and the harmonics that no longer fit fold ' +
          'down and land on top of the ones that do.',
      ),
      F('f_s > 2f_{\\max}, \\qquad f_{\\max} = k_{\\max} f_0'),
      V([
        { label: `highest harmonic (${K}·f₀)`, value: top, unit: 'Hz' },
        { label: 'rate this demands', value: need, unit: 'Hz', note: 'strictly above' },
        {
          label: 'rate in use',
          value: sampleRate,
          unit: 'Hz',
          note: clears
            ? 'clears it — nothing folds'
            : sampleRate === need
              ? 'exactly twice it, which is the one case the inequality excludes: two ' +
                'samples per cycle land at a fixed phase of that harmonic, and depending ' +
                'on which phase, they read anything from its full amplitude down to zero'
              : `short by ${sig(need - sampleRate, 4)} Hz — the top harmonics fold`,
        },
      ]),
      C([
        {
          label: `amplitude of the ${K}${ord(K)} harmonic, 4A/${K}π`,
          predicted: (4 * A) / (K * Math.PI),
          measured: measured ? ampNear(top) : NaN,
          tol: 0.03,
          unchecked: !measured
            ? 'No periodic measurement available for this source.'
            : !clears
              ? 'This harmonic is above Nyquist at the current rate: it has folded down onto a lower one, so there is no line at its own frequency to read.'
              : !onBin
                ? 'This harmonic does not land on a bin centre in the measuring frame, so the window reads its peak low.'
                : null,
        },
      ]),
    )
  }

  if (measured && w.coeff && f0 < nyq * 0.95) {
    const kFold = (() => {
      let k = 1
      while (k * f0 <= nyq) k += w.kStep
      return k
    })()
    const foldF = foldOf(kFold * f0)
    // Does the fold land on the comb of harmonics that are actually present?
    let onComb = false
    for (let k = 1; k * f0 < nyq; k += w.kStep) {
      if (Math.abs(foldF - k * f0) < 2.5 * measBin) onComb = true
    }
    blocks.push(
      T(
        'The series above is the continuous ideal — harmonics forever. Sampling keeps nothing ' +
          'above Nyquist, and this generator samples the ideal shape directly, so the tail ' +
          'folds back instead of disappearing:',
      ),
      F(
        'f_{\\text{fold}} = \\left|\\,k f_0 - f_s\\,\\operatorname{round}\\!\\left(\\frac{k f_0}{f_s}\\right)\\right|',
        'where each harmonic k above Nyquist lands',
      ),
      V([
        { label: 'first harmonic past Nyquist', value: kFold },
        {
          label: 'it folds back to',
          value: foldF,
          unit: 'Hz',
          note: onComb
            ? `exactly onto a lower harmonic — fₛ/f₀ = ${sig(sampleRate / f0, 5)} puts every fold on the comb, so amplitudes shift rather than new lines appearing`
            : 'between harmonics — visible in the spectrum as its own line',
        },
      ]),
      C([
        {
          label: 'k = 1 amplitude (± folded tail)',
          predicted: A * w.coeff(1),
          measured: ampNear(f0),
          tol: 0.02,
          // The folds land somewhere, and when they land on k = 1 they move
          // it: the honest tolerance is the first folded coefficient, not a
          // pretence that the continuous value survives sampling untouched.
          abs: 1.5 * A * w.coeff(kFold),
          unchecked: centred
            ? null
            : 'this tone leaks in the measuring frame, smearing the peak — retune to a bin centre to see the comparison',
        },
      ]),
    )
  }

  if (measured && source.type === 'sine' && f0 > nyq) {
    // The single-line waveform makes the fold a clean position measurement:
    // the spectrum's biggest line IS the alias, nothing else is present.
    let argmax = 1
    for (let i = 2; i < measured.amps.length; i++) {
      if (measured.amps[i] > measured.amps[argmax]) argmax = i
    }
    blocks.push(
      T(
        `This sine is above Nyquist (${sig(nyq, 5)} Hz): its samples are indistinguishable from ` +
          'those of a lower sine, and the spectrum shows that lower sine — the alias. The ' +
          'continuous signal is not attenuated; it is misread.',
      ),
      C([
        {
          label: 'appears folded to (Hz)',
          predicted: foldOf(f0),
          measured: measured.freqs[argmax],
          tol: 0,
          abs: 3 * measBin,
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
              {
                label: 'flat spectrum level 2A/N',
                value: flat,
                // The impulse sits at the frame edge, where every taper is
                // zero (or nearly) — under the default Hann the on-screen
                // spectrum reads the floor, not 2A/N. Say so, or the panel
                // promises a level the plot visibly does not show.
                note: 'every bin, equally — with the analysis window set to "none"; a taper is zero at the frame edge where this impulse sits',
              },
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
        // fftSize/2 + 1, counting DC and Nyquist — the same count the
        // spectrum draws, which is the one this row should agree with.
        { label: 'bins in the frame', value: Math.floor(fftSize / 2) + 1 },
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
/**
 * A biquad's roots, made explicit: the factored H(z), plus one row per root
 * translating position into behavior — radius into decay, angle into the
 * frequency the root acts at (f = θ·fs/2π on the unit circle's clock).
 */
function rootStory(pz, sampleRate) {
  const texOf = (roots) => {
    if (!roots.length) return '1'
    const parts = []
    const seen = new Set()
    for (const [re, im] of roots) {
      const key = `${re.toFixed(6)}|${Math.abs(im).toFixed(6)}`
      if (Math.abs(im) > 1e-12 && seen.has(key)) continue
      seen.add(key)
      if (Math.abs(im) < 1e-12) parts.push(`(z ${re < 0 ? '+' : '-'} ${sig(Math.abs(re), 4)})`)
      else {
        const r = Math.hypot(re, im)
        const th = (Math.abs(Math.atan2(im, re)) * 180) / Math.PI
        parts.push(`(z - ${sig(r, 4)}\\,e^{\\pm j${sig(th, 4)}^\\circ})`)
      }
    }
    return parts.join('')
  }
  const rows = []
  const seen = new Set()
  const describe = (kind, [re, im]) => {
    const r = Math.hypot(re, im)
    const th = Math.abs(Math.atan2(im, re))
    const f = (th * sampleRate) / (2 * Math.PI)
    if (Math.abs(im) < 1e-12) {
      rows.push({
        label: `${kind} at z = ${sig(re, 4)}`,
        value: r,
        note:
          kind === 'pole'
            ? re >= 0
              ? 'real axis: decays as r^n, no ringing'
              : `real axis at ±180 — acts at Nyquist`
            : Math.abs(re + 1) < 1e-6
              ? 'exactly on the circle at Nyquist — an exact null there'
              : Math.abs(re - 1) < 1e-6
                ? 'exactly on the circle at DC — an exact null there'
                : 'real axis',
      })
      return
    }
    const key = `${kind}|${re.toFixed(6)}|${Math.abs(im).toFixed(6)}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push({
      label: `${kind} pair at r = ${sig(r, 4)}, ±${sig((th * 180) / Math.PI, 4)}°`,
      value: f,
      unit: 'Hz',
      note:
        kind === 'pole'
          ? `rings at this frequency, dying as ${sig(r, 3)}^n`
          : Math.abs(r - 1) < 1e-6
            ? 'ON the circle — an exact null at this frequency'
            : 'pulls the response down near this frequency',
    })
  }
  for (const root of pz.poles) describe('pole', root)
  for (const root of pz.zeros) describe('zero', root)
  return { texNum: texOf(pz.zeros), texDen: texOf(pz.poles), rows }
}

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
    // The high-pass is NOT the low-pass formula: same pole, but the zero moves
    // from z = −1 to z = +1 (DC), and H(s) carries the s in its numerator.
    // This branch once printed the low-pass transfer function for both — the
    // check rows passed, because they use the real design, around a wrong
    // formula on display.
    const hp = block.type === 'highpass'
    return {
      blocks: [
        T(
          `One pole, from the bilinear transform of ${hp ? '(s/ω_c)/(1 + s/ω_c)' : '1/(1 + s/ω_c)'}. ` +
            'The least a filter can be — and the reason there is no Q control: resonance takes ' +
            'two poles trading energy, and this section only has the one.',
        ),
        F(
          hp
            ? 'H(s) = \\frac{s/\\omega_c}{1 + s/\\omega_c} \\;\\longrightarrow\\; ' +
              'H(z) = \\frac{1 - z^{-1}}{(K{+}1) + (K{-}1)z^{-1}}, \\quad K = \\tan(\\pi f_c/f_s)'
            : 'H(s) = \\frac{1}{1 + s/\\omega_c} \\;\\longrightarrow\\; ' +
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
            ...rootStory(biquadPolesZeros(p), sampleRate).rows.filter((row) =>
              row.label.startsWith('pole'),
            ),
          ]),
        ],
      }
    }
    const r = poleRadius(p)
    const pz = biquadPolesZeros(p)
    const story = rootStory(pz, sampleRate)
    // A zero ON the unit circle is not just a printed number - it is a
    // measurable promise: the response there is exactly zero. Promote those
    // to check rows, impulse-measured like everything else.
    const nullRows = pz.zeros
      .filter(([re, im], i, all) => {
        if (Math.abs(Math.hypot(re, im) - 1) > 1e-6) return false
        // one row per conjugate pair
        return im >= 0
      })
      .map(([re, im]) => {
        const f = (Math.abs(Math.atan2(im, re)) * sampleRate) / (2 * Math.PI)
        return {
          label: `|H| at the on-circle zero, ${sig(f, 5)} Hz`,
          predicted: 0,
          measured: measuredResponse(block, sampleRate, [f])[0],
          abs: 1e-6,
        }
      })
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
        T(
          'Factored, the same five numbers ARE poles and zeros - solved from the two ' +
            'quadratics, not sketched:',
        ),
        F(`H(z) = ${sig(p.b0)}\\,\\frac{${story.texNum}}{${story.texDen}}`),
        T(
          'Each root, translated: radius is decay (how fast that part of the response dies, ' +
            'as r^n), angle is frequency (where on the unit circle’s DC-to-Nyquist clock ' +
            'it acts).',
        ),
        V(story.rows),
        V([
          { label: 'pole radius r (largest)', value: r, note: 'stable (r < 1)' },
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
        ...(nullRows.length
          ? [
              T(
                'A zero sitting ON the circle is a promise, not a picture: the response at ' +
                  'its angle is exactly zero. Measured:',
              ),
              C(nullRows),
            ]
          : []),
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
          {
            label: 'zeros',
            value: N - 1,
            note:
              p.window === 'hann' || p.window === 'blackman'
                ? 'a few fewer are drawn: this window’s end taps are exactly zero, and a zero tap carries no root'
                : '',
          },
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
            ? 'The delayed copy reinforces itself wherever the delay is a whole number of periods ' +
              '(for positive g — negative g moves the teeth to odd half-periods), so the comb’s ' +
              'teeth point up: peaks every fₛ/D, of height 1/(1−|g|).'
            : 'The two paths oppose wherever the delay is an odd number of half periods (for ' +
              'positive g — negative g moves the notches to whole periods), dipping to 1−|g| — a ' +
              'full cancel only as |g| reaches 1. The comb’s teeth point down: notches every fₛ/D.',
        ),
        V([
          { label: 'delay D', value: D, unit: 'samples' },
          { label: 'delay', value: (1000 * D) / sampleRate, unit: 'ms' },
          { label: 'tooth spacing', value: sampleRate / D, unit: 'Hz' },
          // |g|, not g: for negative g the un-absed formula printed the
          // response MINIMUM and called it the peak.
          ...(fb
            ? [{ label: 'peak height 1/(1−|g|)', value: 1 / (1 - Math.min(0.999, Math.abs(p.g))) }]
            : [{ label: 'notch floor 1−|g|', value: 1 - Math.min(0.999, Math.abs(p.g)) }]),
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
            'Δ²/12 and the signal-to-noise ratio for a full-scale sine would be',
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
