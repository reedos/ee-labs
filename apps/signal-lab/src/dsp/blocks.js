import {
  BIQUAD_MODES,
  biquadPhase,
  isStable,
  biquadPolesZeros,
  biquadResponse,
  butterworthQs,
  designBiquad,
  designCascade,
  designFir,
  firPhase,
  firResponse,
  firZeros,
  makeBiquad,
  makeFir,
  movingAverage,
  settleSamples,
} from '@ee-labs/dsp'
import { hash01 } from '@ee-labs/dsp'
import { fmtDb, fmtHz } from '@ee-labs/ui'

// Processing blocks, as data.
//
// Each type declares its parameter schema, so one card component in the UI renders
// every block and adding a type touches this file only. `make()` returns a fresh
// processor closure holding whatever private state the block needs; `response()`
// returns |H(f)| for linear blocks and null for the rest, so the spectrum overlay
// knows when it would be lying.

const nyq = ({ nyquist }) => nyquist

/** Resolve a schema field that may be a function of { sampleRate, nyquist }. */
export function resolve(x, ctx) {
  return typeof x === 'function' ? x(ctx) : x
}

const Q_PRESETS = [
  0.5,
  { value: Math.SQRT1_2, label: '0.707', title: 'Butterworth — maximally flat' },
  1,
  2,
  5,
  10,
]

const cutoff = (label = 'Cutoff') => ({
  key: 'freq',
  label,
  unit: 'Hz',
  scale: 'log',
  min: 20,
  // The designs clamp at 0.499 fs (see FREQ_MAX_RATIO), so the slider stops
  // where the filter stops: a knob reading 4000 Hz over a corner quietly held
  // at 3992 Hz would be the slider lying by eight hertz.
  max: ({ nyquist }) => Math.floor(nyquist * 0.998),
  step: 1,
  presets: ({ nyquist }) => [
    100,
    500,
    1000,
    { value: Math.round(nyquist / 2), label: 'Nyq/2' },
  ],
})

const qParam = {
  key: 'q',
  label: 'Q (resonance)',
  scale: 'log',
  min: 0.1,
  // Wide enough to hold what a hand-over can name: a series RLC crosses with
  // Q = (1/R)√(L/C), which passes 20 at everyday component values. The design
  // functions clamp at the same 100 (Q_MAX), so knob and filter agree; past
  // it, Circuit Lab's emitter drops to raw coefficients rather than letting
  // this knob lie about the filter that arrived.
  max: 100,
  step: 0.01,
  presets: Q_PRESETS,
  hint: 'For a low-pass the peak height at the cutoff is exactly Q.',
  // Only a second-order section has a Q to set. First order cannot resonate,
  // and at fourth order the mathematics chooses the section Qs (Butterworth),
  // not the knob — so the knob leaves rather than sitting there ignored.
  when: (p) => Number(p.order ?? 2) === 2,
  // ...but a control that vanishes silently reads as a bug (Reed: "why is
  // there no Q control?"). When hidden, this line stands in its place.
  whenHint: (p) =>
    Number(p.order ?? 2) === 1
      ? 'No Q at 1st order: resonance takes two poles trading energy, and this section has one.'
      : 'No Q knob at 4th order: a Butterworth’s section Qs are dictated by the math — 0.541 and 1.307 here.',
}

const orderParam = {
  key: 'order',
  label: 'Order',
  kind: 'select',
  options: ['1', '2', '4'],
  hint:
    '1st: one pole, 6 dB per octave, cannot resonate. 2nd: this section, with its Q. ' +
    '4th: a true Butterworth — two sections whose Qs (0.541 and 1.307) the math dictates.',
}

/**
 * A biquad entry, one per RBJ mode.
 *
 * Low-pass and high-pass additionally carry an ORDER select: 1 is a true
 * one-pole (no Q exists), 2 the RBJ section with its Q, 4 a genuine
 * Butterworth cascade whose section Qs the math dictates. Everything below is
 * written over the section LIST from designCascade, which for the other modes
 * is always one section — so nothing changes for them.
 */
function biquadType(mode, label, hint, extra = []) {
  const ordered = mode === 'lowpass' || mode === 'highpass'
  const sections = (p, sampleRate) =>
    ordered
      ? designCascade({ mode, ...p }, sampleRate)
      : [designBiquad({ mode, ...p }, sampleRate)]
  return {
    label,
    group: 'Filter',
    hint,
    nonlinear: false,
    defaults: ordered
      ? { freq: 1000, q: Math.SQRT1_2, gainDb: 0, order: '2' }
      : { freq: 1000, q: Math.SQRT1_2, gainDb: 0 },
    params: [
      cutoff(mode === 'bandpass' || mode === 'notch' ? 'Centre' : 'Cutoff'),
      ...(ordered ? [orderParam] : []),
      qParam,
      ...extra,
    ],
    summary: (p) => {
      const n = Number(p.order ?? 2)
      const head = ordered && n !== 2 ? `${n === 1 ? '1st' : '4th Btw'} · ` : ''
      const q = ordered && n !== 2 ? '' : ` · Q ${Number(p.q.toPrecision(3))}`
      return `${head}${fmtHz(p.freq)}${q}` + (mode === 'peaking' ? ` · ${fmtDb(p.gainDb)}` : '')
    },
    make: (p, sampleRate) => {
      const secs = sections(p, sampleRate)
      const steps = secs.map(makeBiquad)
      let settle = 0
      for (const c of secs) {
        const s = settleSamples(c)
        settle += Number.isFinite(s) ? s : 0
      }
      return {
        process: (x) => {
          let v = x
          for (const step of steps) v = step(v)
          return v
        },
        settle,
      }
    },
    // Cascaded magnitudes multiply, phases add, roots collect.
    response: (p, f, sampleRate) => {
      let m = 1
      for (const c of sections(p, sampleRate)) m *= biquadResponse(c, f, sampleRate)
      return m
    },
    // The half a magnitude plot cannot show. An allpass is the extreme case:
    // |H| is 1.0000 at every frequency while the phase swings through 180
    // degrees, so on the spectrum alone the block appears to do nothing at all.
    phase: (p, f, sampleRate) => {
      let a = 0
      for (const c of sections(p, sampleRate)) a += biquadPhase(c, f, sampleRate)
      return a
    },
    pz: (p, sampleRate) => {
      const poles = []
      const zeros = []
      for (const c of sections(p, sampleRate)) {
        const r = biquadPolesZeros(c)
        poles.push(...r.poles)
        zeros.push(...r.zeros)
      }
      return { poles, zeros }
    },
  }
}

export const BLOCK_TYPES = {
  lowpass: biquadType(
    'lowpass',
    'Low-pass',
    // Lead with the first-order rule, then multiply — and say what happens to
    // phase, which a magnitude-only hint leaves out. The 45°-per-order figure
    // at the cutoff is exact for these sections, not a rule of thumb (see the
    // phase-at-cutoff test).
    // The phase-slope figure is the Bode STRAIGHT-LINE rule and is labelled as
    // such: the true slope at the cutoff depends on each section's Q (−191°
    // per decade for one Q = 0.707 biquad, not 2 × 66°), so only the
    // approximation has a simple per-order number.
    (p) => {
      const n = Number(p?.order ?? 2)
      return (
        `A 1st-order low-pass rolls off at 6 dB per octave (20 dB per decade). ` +
        `This one is order ${n}: ${6 * n} dB per octave (${20 * n} dB per decade). ` +
        `Phase lags too — exactly ${45 * n}° at the cutoff, sweeping from 0° to ${90 * n}° over ` +
        `roughly the two decades around it (the Bode straight-line rule: ` +
        `${45 * n}° per decade, about ${Number((13.5 * n).toPrecision(3))}° per octave, through the transition).`
      )
    },
  ),
  highpass: biquadType(
    'highpass',
    'High-pass',
    (p) => {
      const n = Number(p?.order ?? 2)
      return (
        `The low-pass mirrored: everything below the cutoff is removed. A 1st-order slope is ` +
        `6 dB per octave (20 dB per decade); this one is order ${n}: ${6 * n} dB per octave ` +
        `(${20 * n} dB per decade). Phase LEADS here — exactly +${45 * n}° at the cutoff, ` +
        `sweeping from +${90 * n}° at DC to 0° far above, again about ${45 * n}° per decade ` +
        `(${Number((13.5 * n).toPrecision(3))}° per octave) through the transition.`
      )
    },
  ),
  bandpass: biquadType(
    'bandpass',
    'Band-pass',
    'Keeps a band around the centre frequency and rejects the rest. Q sets how narrow that band is.',
  ),
  notch: biquadType(
    'notch',
    'Notch',
    'Removes one frequency and leaves everything else. The response is exactly zero at the centre.',
  ),
  peaking: biquadType(
    'peaking',
    'Peaking EQ',
    'Boosts or cuts one band and leaves the rest alone — one band of a graphic equaliser.',
    [
      { key: 'gainDb', label: 'Boost / cut', unit: 'dB', scale: 'linear', min: -24, max: 24, step: 0.5, presets: [-12, -6, 0, 6, 12] },
    ],
  ),
  allpass: biquadType(
    'allpass',
    'All-pass',
    'Passes every frequency at full amplitude and changes only their phase. The waveform ' +
      'changes shape; the spectrum does not move at all.',
  ),

  // The general second-order section, by its raw coefficients.
  //
  // The named modes above are particular recipes for these five numbers; this
  // block accepts the numbers themselves, which makes it the universal
  // RECEIVER for hand-overs: any order-2 circuit — twin-T included, which no
  // named mode can express — arrives here bilinear-exactly as
  // b=biquad:b0:b1:b2:a1:a2. It is also the one block where instability is
  // reachable from the controls, so it says so instead of quietly exploding.
  biquad: {
    label: 'Biquad — raw coefficients',
    group: 'Filter',
    hint:
      'The five numbers every second-order digital filter reduces to. The named filter blocks ' +
      'are recipes for choosing them; here you (or a hand-over from Circuit Lab) set them ' +
      'directly. y[n] = b₀x[n] + b₁x[n−1] + b₂x[n−2] − a₁y[n−1] − a₂y[n−2]. Stable only ' +
      'while the poles stay inside the unit circle: |a₂| < 1 and |a₁| < 1 + a₂.',
    nonlinear: false,
    defaults: { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 },
    params: ['b0', 'b1', 'b2', 'a1', 'a2'].map((key) => ({
      key,
      label: key === 'b0' ? 'b₀' : key === 'b1' ? 'b₁' : key === 'b2' ? 'b₂' : key === 'a1' ? 'a₁' : 'a₂',
      scale: 'linear',
      min: -3.999,
      max: 3.999,
      step: 0.0001,
      decimals: 4,
    })),
    summary: (p) =>
      isStable(p) ? `[${['b0', 'b1', 'b2'].map((k) => Number(p[k].toPrecision(3))).join(', ')}]` : 'UNSTABLE',
    make: (p, sampleRate) => {
      // An unstable section would overflow every buffer downstream and take
      // both plots with it. Passing the input through unchanged, with the
      // summary and hint shouting, is the honest failure mode for a sandbox.
      if (!isStable(p)) return { process: (x) => x, settle: 0 }
      const step = makeBiquad(p)
      // settleSamples floors at the section's two-tap state depth itself now;
      // the finite check only guards against NaN coefficients sneaking in.
      const st = settleSamples(p)
      return { process: (x) => step(x), settle: Number.isFinite(st) ? st : 2 }
    },
    response: (p, f, sampleRate) => (isStable(p) ? biquadResponse(p, f, sampleRate) : null),
    phase: (p, f, sampleRate) => (isStable(p) ? biquadPhase(p, f, sampleRate) : undefined),
    pz: (p) => biquadPolesZeros(p),
  },

  // ------------------------------------------------------------- FIR
  //
  // Everything above has feedback and therefore poles. These two have neither,
  // and the contrast is the point of putting them in the same rack: an FIR
  // cannot be unstable, forgets in exactly N samples, and — being symmetric —
  // delays every frequency by the same amount, which no IIR can do.

  movingavg: {
    label: 'Moving average',
    group: 'FIR',
    hint:
      'Averages the last N samples, and nothing more. The simplest filter that does anything, ' +
      'and the only one whose nulls you can work out in your head: averaging N samples exactly ' +
      'cancels every frequency that fits a whole number of cycles into the window, so the nulls ' +
      'sit at every multiple of the sample rate over N.',
    nonlinear: false,
    defaults: { taps: 8 },
    params: [
      {
        key: 'taps',
        label: 'Taps N',
        scale: 'linear',
        min: 2,
        max: 64,
        step: 1,
        decimals: 0,
        presets: [2, 4, 8, 16, 32],
        hint: 'Nulls land at every multiple of fs / N.',
      },
    ],
    summary: (p, ctx) =>
      `${p.taps} taps · nulls every ${fmtHz((ctx?.sampleRate ?? 8000) / p.taps)}`,
    make: (p) => {
      const h = movingAverage(p.taps)
      const step = makeFir(h)
      // Exact, not estimated. After N samples every tap multiplies a sample the
      // filter has actually seen, so there is no initial condition left.
      return { process: (x) => step(x), settle: h.length - 1 }
    },
    response: (p, f, sampleRate) => firResponse(movingAverage(p.taps), f, sampleRate),
    phase: (p, f, sampleRate) => firPhase(movingAverage(p.taps), f, sampleRate),
    pz: (p) => {
      const zs = firZeros(movingAverage(p.taps))
      // null = the solver could not certify its roots; declining to draw is
      // reported as tooMany so the view says "not drawn" instead of lying.
      return zs ? { poles: [], zeros: zs } : { poles: [], zeros: [], tooMany: p.taps - 1 }
    },
    kernel: (p) => movingAverage(p.taps),
  },

  fir: {
    label: 'FIR (windowed sinc)',
    group: 'FIR',
    hint:
      'A designed FIR: the ideal brick-wall filter is a sinc that runs forever, so it gets cut ' +
      'off and tapered. Cutting it off abruptly is itself a rectangular window, and the ripple ' +
      'that produces does not shrink as taps are added — only narrows. Set the window to none ' +
      'to see it. The phase is exactly linear whatever you choose.',
    nonlinear: false,
    defaults: { taps: 41, freq: 1000, mode: 'lowpass', window: 'hamming' },
    params: [
      {
        key: 'taps',
        label: 'Taps N',
        scale: 'log',
        min: 3,
        max: 201,
        step: 2,
        decimals: 0,
        presets: [11, 31, 61, 121, 201],
        hint: 'Forced odd, so the kernel has a centre tap and delays by exactly (N-1)/2 samples.',
      },
      cutoff(),
      { key: 'mode', label: 'Shape', kind: 'select', options: ['lowpass', 'highpass'] },
      {
        key: 'window',
        label: 'Window',
        kind: 'select',
        options: ['none', 'hann', 'hamming', 'blackman'],
        hint: 'Trades transition width against stopband depth. "none" is the untapered cut.',
      },
    ],
    summary: (p) =>
      `${p.mode === 'highpass' ? 'HP' : 'LP'} ${fmtHz(p.freq)} · ${p.taps} taps · ${p.window}`,
    make: (p, sampleRate) => {
      const h = designFir(p, sampleRate)
      const step = makeFir(h)
      return { process: (x) => step(x), settle: h.length - 1 }
    },
    response: (p, f, sampleRate) => firResponse(designFir(p, sampleRate), f, sampleRate),
    phase: (p, f, sampleRate) => firPhase(designFir(p, sampleRate), f, sampleRate),
    // No poles at all, anywhere but the origin — and those only account for the
    // delay. That absence IS the difference from everything in the Filter group.
    pz: (p, sampleRate) => {
      const h = designFir(p, sampleRate)
      const zs = firZeros(h)
      // See movingavg.pz: a null from the solver becomes a stated refusal.
      return zs ? { poles: [], zeros: zs } : { poles: [], zeros: [], tooMany: h.length - 1 }
    },
    kernel: (p, sampleRate) => designFir(p, sampleRate),
  },

  gain: {
    label: 'Gain / DC',
    group: 'Level',
    hint: 'Scales the signal, and can add a constant that shifts it off centre.',
    nonlinear: false,
    defaults: { gainDb: 0, dcOffset: 0 },
    params: [
      // ±126 dB, not an audio-taste ±60/+24: this block is also the carrier
      // for a hand-over's in-band gain, and Circuit Lab's component ranges
      // reach ×10⁶ (a 1 MΩ tank's resonant impedance, a divider at one part
      // per million) — exactly 120 dB, kept with margin so the boundary
      // never clamps. The presets still cover the audio range.
      { key: 'gainDb', label: 'Gain', unit: 'dB', scale: 'linear', min: -126, max: 126, step: 0.5, presets: [-12, -6, 0, 6] },
      // DC lives here so it can sit before a clipper: symmetric clipping makes odd
      // harmonics, and offsetting the signal first breaks that symmetry and brings
      // the even ones in.
      { key: 'dcOffset', label: 'DC offset', scale: 'linear', min: -1, max: 1, step: 0.01, presets: [-0.3, 0, 0.3], hint: 'A constant added to every sample. Appears as a spike at 0 Hz.' },
    ],
    summary: (p) => `${fmtDb(p.gainDb)}${p.dcOffset ? ` · DC ${p.dcOffset}` : ''}`,
    // Linear only while the offset is zero. With DC the block is AFFINE, and
    // an affine block has no impulse response to convolve with: the measured
    // "kernel" would carry the offset in every tap, and the convolution view's
    // "y = x ∗ h" would re-add it once per overlapped sample — measured 5x off
    // while the label claimed exact equality. So the exactness machinery asks
    // this predicate instead of the static flag.
    lti: (p) => p.dcOffset === 0,
    make: (p) => {
      const g = Math.pow(10, p.gainDb / 20)
      const dc = p.dcOffset
      return { process: (x) => x * g + dc, settle: 0 }
    },
    // Affine, not linear — the DC term shows up as a bin-0 spike in the measured
    // trace. The magnitude response of the gain part is flat.
    response: (p) => Math.pow(10, p.gainDb / 20),
    // A positive real scaling shifts nothing.
    phase: () => 0,
    // A constant has no roots. Not "none found" — none exist, so a chain of
    // nothing but gain blocks correctly shows an empty z-plane.
    pz: () => ({ poles: [], zeros: [] }),
  },

  clip: {
    label: 'Hard clip',
    group: 'Nonlinear',
    hint:
      'Flattens anything past the threshold. Clipping a symmetric signal makes only ODD ' +
      'harmonics; put a DC offset before it and the even ones appear.',
    nonlinear: true,
    defaults: { threshold: 0.5 },
    params: [
      { key: 'threshold', label: 'Threshold', scale: 'linear', min: 0.01, max: 1.5, step: 0.01, presets: [0.1, 0.3, 0.5, 1] },
    ],
    summary: (p) => `±${p.threshold}`,
    make: (p) => {
      const c = p.threshold
      return { process: (x) => (x > c ? c : x < -c ? -c : x), settle: 0 }
    },
    response: () => null,
  },

  comb: {
    label: 'Comb / delay',
    // A comb is LTI — it has an H(z), draws a solid response curve, and its
    // rack home says so. It sat under Nonlinear once, which undercut that
    // group's whole storyline of dashed curves and manufactured harmonics.
    group: 'Filter',
    hint:
      'Adds the signal to a delayed copy of itself, cancelling deepest where the delay is half a ' +
      'period — evenly spaced notches. Feed-forward is an FIR filter, feedback an IIR one: ' +
      'the same control, two very different behaviors.',
    nonlinear: false,
    defaults: { delayMs: 4, g: 0.7, mode: 'feedforward' },
    params: [
      { key: 'delayMs', label: 'Delay', unit: 'ms', scale: 'log', min: 0.1, max: 100, step: 0.1, presets: [0.5, 1, 4, 20] },
      // "Delayed-copy gain", not "Feedback": in feed-forward mode nothing is
      // fed back — the same knob is the echo's strength in both modes.
      { key: 'g', label: 'Delay gain g', scale: 'linear', min: -0.95, max: 0.95, step: 0.01, presets: [-0.7, 0.5, 0.7, 0.9] },
      { key: 'mode', label: 'Type', kind: 'select', options: ['feedforward', 'feedback'] },
    ],
    summary: (p) => `${p.delayMs} ms · g ${p.g} · ${p.mode === 'feedback' ? 'IIR' : 'FIR'}`,
    make: (p, sampleRate) => {
      const D = Math.max(1, Math.round((p.delayMs / 1000) * sampleRate))
      const g = Math.max(-0.999, Math.min(0.999, p.g))
      const buf = new Float64Array(D)
      let i = 0
      if (p.mode === 'feedback') {
        return {
          process: (x) => {
            const y = x + g * buf[i]
            buf[i] = y
            i = (i + 1) % D
            return y
          },
          settle: D * Math.ceil(Math.log(1e-6) / Math.log(Math.abs(g) || 1e-9)),
        }
      }
      return {
        process: (x) => {
          const y = x + g * buf[i]
          buf[i] = x
          i = (i + 1) % D
          return y
        },
        settle: D,
      }
    },
    response: (p, f, sampleRate) => {
      const D = Math.max(1, Math.round((p.delayMs / 1000) * sampleRate))
      const g = Math.max(-0.999, Math.min(0.999, p.g))
      const w = (2 * Math.PI * f * D) / sampleRate
      // Feed-forward: |1 + g e^{-jwD}|.  Feedback: 1/|1 - g e^{-jwD}|.
      const re = 1 + (p.mode === 'feedback' ? -g : g) * Math.cos(w)
      const im = (p.mode === 'feedback' ? g : -g) * Math.sin(w)
      const m = Math.hypot(re, im)
      return p.mode === 'feedback' ? 1 / m : m
    },
    phase: (p, f, sampleRate) => {
      const D = Math.max(1, Math.round((p.delayMs / 1000) * sampleRate))
      const g = Math.max(-0.999, Math.min(0.999, p.g))
      const w = (2 * Math.PI * f * D) / sampleRate
      const fb = p.mode === 'feedback'
      // Same complex value as above; for feedback it is the denominator, so its
      // angle is negated.
      const re = 1 + (fb ? -g : g) * Math.cos(w)
      const im = (fb ? g : -g) * Math.sin(w)
      const a = Math.atan2(im, re)
      return fb ? -a : a
    },
    // The prettiest picture in the z-plane view, and the clearest statement of
    // what "comb" means. H(z) = 1 + g z^-D has z^D = -g, so its D roots are
    // evenly spaced around a circle of radius |g|^(1/D) — a ring of marks whose
    // angles are the notch frequencies. Feedback puts the same ring in the
    // denominator, which is why the same control produces peaks instead of
    // notches, and why g -> 1 pushes them onto the circle and rings forever.
    pz: (p, sampleRate) => {
      const D = Math.max(1, Math.round((p.delayMs / 1000) * sampleRate))
      // A long delay at a high rate is thousands of roots. Past a few hundred
      // the ring is a solid circle and says nothing more, so decline rather than
      // grind — the caller reports it as too many to draw.
      if (D > 256) return { poles: [], zeros: [], tooMany: D }
      const g = Math.max(-0.999, Math.min(0.999, p.g))
      const r = Math.pow(Math.abs(g), 1 / D)
      const marks = []
      // z^D = -g for feed-forward, +g for feedback.
      const target = p.mode === 'feedback' ? g : -g
      const base = target < 0 ? Math.PI / D : 0
      for (let k = 0; k < D; k++) {
        const ang = base + (2 * Math.PI * k) / D
        marks.push([r * Math.cos(ang), r * Math.sin(ang)])
      }
      return p.mode === 'feedback' ? { poles: marks, zeros: [] } : { poles: [], zeros: marks }
    },
  },

  ringmod: {
    label: 'Ring modulator',
    group: 'Nonlinear',
    hint:
      'Multiplies the signal by a sine. Every input frequency becomes a pair at ' +
      '(carrier + input) and (carrier - input), and neither original survives.',
    nonlinear: true,
    defaults: { freq: 800 },
    params: [
      { key: 'freq', label: 'Carrier', unit: 'Hz', scale: 'log', min: 1, max: nyq, step: 1, presets: [100, 250, 800, 1000] },
    ],
    summary: (p) => `× ${fmtHz(p.freq)}`,
    make: (p) => {
      const w = 2 * Math.PI * p.freq
      // Absolute t, so the carrier phase does not depend on how much pre-roll an
      // unrelated filter earlier in the chain happened to ask for.
      return { process: (x, t) => x * Math.sin(w * t), settle: 0 }
    },
    response: () => null,
  },

  quantize: {
    label: 'Bit crusher',
    group: 'Nonlinear',
    hint:
      'Rounds every sample to one of 2^bits levels, as an analogue-to-digital converter does. ' +
      'Undithered, the error tracks the signal and appears as discrete spurious tones; ' +
      'dither decorrelates it into a smooth noise floor.',
    nonlinear: true,
    defaults: { bits: 8, dither: false },
    params: [
      { key: 'bits', label: 'Bits', scale: 'linear', min: 1, max: 16, step: 1, decimals: 0, presets: [4, 8, 12, 16], hint: 'Signal-to-noise ratio is about 6.02 x bits + 1.76 dB for a full-scale sine.' },
      { key: 'dither', label: 'Dither', kind: 'check' },
    ],
    summary: (p) => `${p.bits} bit${p.dither ? ' · dithered' : ''}`,
    make: (p, sampleRate) => {
      const levels = Math.pow(2, p.bits)
      const delta = 2 / levels
      // A b-bit converter has 2^b codes, not 2^b + 1: midtread rounding over
      // a symmetric range includes BOTH rails, which handed a "1-bit" crusher
      // three levels. The top code is dropped, the standard ADC convention
      // (-2^(b-1) .. 2^(b-1)-1 in codes), so the count comes out exact.
      const top = 1 - delta
      const dither = p.dither
      return {
        // Dither is keyed to the ABSOLUTE sample index, like the noise source
        // and the ring modulator's carrier — a local counter would give the
        // scope buffer and the FFT frame different realizations whenever their
        // pre-roll lengths differ. TPDF (two uniforms summed, ±1 LSB), which
        // is what actually decorrelates the error; a single uniform leaves
        // its variance tracking the signal.
        process: (x, t) => {
          const n = Math.round(t * sampleRate)
          const d = dither ? (hash01(n, 0xd1) + hash01(n, 0x7e2) - 1) * delta : 0
          const y = Math.round((x + d) / delta) * delta
          return y > top ? top : y < -1 ? -1 : y
        },
        settle: 0,
      }
    },
    response: () => null,
  },

  rectify: {
    label: 'Rectifier',
    group: 'Nonlinear',
    hint:
      'Flips the negative half upwards. Doubles the frequency, leaves only even harmonics, ' +
      'and adds a large DC component.',
    nonlinear: true,
    defaults: {},
    params: [],
    summary: () => 'full wave',
    make: () => ({ process: (x) => Math.abs(x), settle: 0 }),
    response: () => null,
  },
}

export const BLOCK_GROUPS = ['Filter', 'FIR', 'Level', 'Nonlinear']

/** A new block record of `type`, with its defaults. */
export function makeBlockRecord(type, id) {
  return { id, type, bypass: false, params: { ...BLOCK_TYPES[type].defaults } }
}

export { BIQUAD_MODES }
