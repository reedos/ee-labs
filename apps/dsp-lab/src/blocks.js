import {
  biquadPolesZeros,
  biquadResponse,
  designBiquad,
  designDecimationFir,
  designFirSpec,
  designInterpolationFir,
  designIir,
  designIirSpec,
  designRemezSpec,
  firPhase,
  firResponse,
  makeAdaptive,
  makeDecimateHold,
  makeFir,
  makeFixedBiquad,
  makeInterpolateFill,
  multirateCost,
  quantizeBiquad,
  quantizer,
  runAdaptive,
  settleSamples,
} from '@ee-labs/dsp'
import { fmtDb, fmtHz } from '@ee-labs/ui'

// The blocks, as data, in the shape `createChain` expects.
//
// Signal Lab's registry is the model and this one follows it exactly: each type
// declares its parameter schema, so one card renders every block and adding a
// type touches this file only. `make()` returns a fresh processor closure, so no
// state outlives a call and the chain stays pure.
//
// The difference from Signal Lab's registry is the honesty each entry has to
// carry. Three of the blocks below are not linear time-invariant systems, and
// none of them may offer a frequency response. Each returns null from
// `response` and carries a `reason` the card prints, which is CORE_SCOPE Rule 2
// applied to a block registry: a refusal with a reason is a finished feature,
// not a gap to fill later.
//
//   - A rate changer keeps a different set of samples when its input is
//     delayed, so it is not shift-invariant and has no H(z) at all.
//   - An adaptive filter's coefficients change every sample, so it is not one
//     filter and has no H(z) either. The weight view shows the sequence.
//   - A fixed-point section with a quantised state is nonlinear inside its own
//     loop. Its quantised COEFFICIENTS do have an exact H(z), which is drawn,
//     and `lti` reports that the drawn curve is then part of the story.

const nyq = ({ nyquist }) => nyquist

/** Resolve a schema field that may be a function of { sampleRate, nyquist }. */
export function resolve(x, ctx) {
  return typeof x === 'function' ? x(ctx) : x
}

/** Cascaded |H(f)| of a list of biquad sections. */
export const cascadeResponse = (sections, f, sampleRate) =>
  sections.reduce((m, c) => m * biquadResponse(c, f, sampleRate), 1)

/**
 * A design is expensive and `make` is called on every render, twice a frame.
 * A Remez exchange at 133 taps is milliseconds, so it is memoised on the
 * parameters that decide it. The cache is small and keyed by value, so two
 * blocks with the same settings share one design, which is also what makes a
 * lesson's "compare these two" comparison exact rather than nearly exact.
 */
function memoise(fn, keyOf) {
  const cache = new Map()
  const wrapped = (...args) => {
    const key = keyOf(...args)
    if (cache.has(key)) return cache.get(key)
    const v = fn(...args)
    if (cache.size > 64) cache.clear()
    cache.set(key, v)
    return v
  }
  wrapped.calls = () => cache.size
  return wrapped
}

const specKey = (p, sampleRate) =>
  [sampleRate, p.fpass, p.fstop, p.ripplePassDb, p.stopDb, p.method, p.window, p.prototype].join('|')

/** The FIR a specification asks for, by whichever method the block names. */
export const firDesign = memoise(
  (p, sampleRate) =>
    p.method === 'window'
      ? designFirSpec(
          { fpass: p.fpass, fstop: p.fstop, ripplePassDb: p.ripplePassDb, stopDb: p.stopDb, window: p.window },
          sampleRate,
        )
      : designRemezSpec(
          { fpass: p.fpass, fstop: p.fstop, ripplePassDb: p.ripplePassDb, stopDb: p.stopDb },
          sampleRate,
        ),
  specKey,
)

/** The IIR a specification asks for, from the named analog prototype. */
export const iirDesign = memoise(
  (p, sampleRate) =>
    designIirSpec(
      {
        fpass: p.fpass,
        fstop: p.fstop,
        ripplePassDb: p.ripplePassDb,
        stopDb: p.stopDb,
        type: p.prototype,
      },
      sampleRate,
      cascadeResponse,
    ),
  specKey,
)

/** A comma-separated tap list, as a Float64Array. */
export function tapsOf(text) {
  const parts = String(text)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map((s) => Number(s))
    .filter((v) => Number.isFinite(v))
  return Float64Array.from(parts.length ? parts : [1])
}

const coeffQ = (p) => quantizer({ bits: p.coeffBits, intBits: p.coeffInt, rounding: p.rounding })
const stateQ = (p) =>
  p.stateBits > 0
    ? quantizer({ bits: p.stateBits, intBits: p.stateInt, rounding: p.rounding, overflow: p.overflow })
    : null

const tapsParam = (max = 401) => ({
  key: 'taps',
  label: 'Filter taps',
  scale: 'log',
  min: 9,
  max,
  step: 2,
  decimals: 0,
  presets: [31, 61, 121, 241],
  hint: 'Forced odd, so the kernel has a centre tap and delays by exactly (N-1)/2 samples.',
})

const windowParam = {
  key: 'window',
  label: 'Window',
  kind: 'select',
  options: ['none', 'hann', 'hamming', 'blackman'],
  hint: 'Trades transition width against stopband depth. The depth does not improve with length.',
}

const specParams = [
  {
    key: 'fpass',
    label: 'Passband edge',
    unit: 'Hz',
    scale: 'log',
    min: 100,
    max: ({ nyquist }) => Math.floor(nyquist * 0.9),
    step: 1,
    presets: [2000, 4000, 8000],
  },
  {
    key: 'fstop',
    label: 'Stopband edge',
    unit: 'Hz',
    scale: 'log',
    min: 200,
    max: ({ nyquist }) => Math.floor(nyquist * 0.98),
    step: 1,
    presets: [5000, 6000, 9000],
  },
  {
    key: 'ripplePassDb',
    label: 'Passband ripple',
    unit: 'dB',
    scale: 'log',
    min: 0.01,
    max: 6,
    step: 0.01,
    presets: [0.1, 0.5, 1, 3],
    hint: 'Measured from the passband peak downwards, which is where both prototypes put it.',
  },
  {
    key: 'stopDb',
    label: 'Stopband depth',
    unit: 'dB',
    scale: 'linear',
    min: 20,
    max: 120,
    step: 1,
    presets: [40, 60, 80, 100],
  },
]

export const BLOCK_TYPES = {
  // ------------------------------------------------------------- Rate

  decimate: {
    label: 'Decimate and hold',
    group: 'Rate',
    hint:
      'Keeps every Mth sample, then holds it for M samples so the result sits on the display rate. ' +
      'The new Nyquist is fs over 2M, and anything above it folds back below it. The anti-alias ' +
      'filter is the only thing that can stop that, and it has to come first.',
    nonlinear: false,
    defaults: { M: 4, antialias: true, taps: 121, window: 'blackman' },
    params: [
      {
        key: 'M',
        label: 'Rate factor M',
        scale: 'linear',
        min: 2,
        max: 16,
        step: 1,
        decimals: 0,
        presets: [2, 3, 4, 8],
        hint: 'The new Nyquist is fs / 2M.',
      },
      { key: 'antialias', label: 'Anti-alias filter', kind: 'check' },
      tapsParam(401),
      windowParam,
    ],
    summary: (p, ctx) =>
      `M ${p.M} · new Nyquist ${fmtHz((ctx?.sampleRate ?? 48000) / (2 * p.M))}${p.antialias ? '' : ' · no filter'}`,
    // Not shift-invariant, so there is no transfer function to draw.
    response: () => null,
    reason:
      'A rate change keeps a different set of samples when its input is delayed, so it is not shift-invariant and has no H(z). The anti-alias filter before it does.',
    make: (p, sampleRate) =>
      makeDecimateHold({
        M: p.M,
        h: p.antialias
          ? designDecimationFir({ M: p.M, taps: p.taps, window: p.window }, sampleRate)
          : null,
      }),
    /** The filter's own response, which is a real H(f) and is drawn separately. */
    guard: (p, sampleRate) =>
      p.antialias ? designDecimationFir({ M: p.M, taps: p.taps, window: p.window }, sampleRate) : null,
    cost: (p, sampleRate) => multirateCost({ taps: p.taps, factor: p.M, sampleRate }),
  },

  interpolate: {
    label: 'Interpolate',
    group: 'Rate',
    hint:
      'Reads the signal on a grid L times coarser, then rebuilds it at the display rate. Zero ' +
      'stuffing leaves the spectrum unchanged, so L-1 images of the band appear below Nyquist. ' +
      'The interpolation filter removes them, and its passband gain of L puts the amplitude back.',
    nonlinear: false,
    defaults: { L: 4, fill: 'filter', taps: 121, window: 'blackman' },
    params: [
      {
        key: 'L',
        label: 'Rate factor L',
        scale: 'linear',
        min: 2,
        max: 16,
        step: 1,
        decimals: 0,
        presets: [2, 3, 4, 8],
        hint: 'The coarse grid runs at fs / L.',
      },
      {
        key: 'fill',
        label: 'Between samples',
        kind: 'select',
        options: ['zeros', 'hold', 'filter'],
        hint: 'Zeros leave the images. Hold is a converter’s staircase. Filter removes them.',
      },
      tapsParam(401),
      windowParam,
    ],
    summary: (p, ctx) => `L ${p.L} · grid ${fmtHz((ctx?.sampleRate ?? 48000) / p.L)} · ${p.fill}`,
    response: () => null,
    reason:
      'Zero stuffing is not shift-invariant either, so this block has no H(z). The images it leaves are what the filter after it removes.',
    make: (p, sampleRate) =>
      makeInterpolateFill({
        L: p.L,
        fill: p.fill,
        h:
          p.fill === 'filter'
            ? designInterpolationFir({ L: p.L, taps: p.taps, window: p.window }, sampleRate)
            : null,
      }),
    guard: (p, sampleRate) =>
      p.fill === 'filter'
        ? designInterpolationFir({ L: p.L, taps: p.taps, window: p.window }, sampleRate)
        : null,
    cost: (p, sampleRate) => multirateCost({ taps: p.taps, factor: p.L, sampleRate }),
  },

  // ----------------------------------------------------------- Design

  firspec: {
    label: 'FIR to a specification',
    group: 'Design',
    hint:
      'Four numbers go in and a filter comes out. The window method truncates the ideal sinc and ' +
      'tapers it, so its depth is the window’s and its width is the length’s. Parks-McClellan ' +
      'finds the best possible fit for a length, whose error ripples between equal bounds.',
    nonlinear: false,
    defaults: {
      fpass: 4000,
      fstop: 6000,
      ripplePassDb: 1,
      stopDb: 60,
      method: 'remez',
      window: 'blackman',
    },
    params: [
      ...specParams,
      {
        key: 'method',
        label: 'Method',
        kind: 'select',
        options: ['window', 'remez'],
        hint: 'The window method reaches a depth its window allows. Parks-McClellan reaches any depth.',
      },
      { ...windowParam, when: (p) => p.method === 'window' },
    ],
    summary: (p, ctx) => {
      const d = firDesign(p, ctx?.sampleRate ?? 48000)
      return `${p.method === 'remez' ? 'Remez' : p.window} · ${d.taps} taps · ${d.met ? 'meets it' : 'misses it'}`
    },
    make: (p, sampleRate) => {
      const h = firDesign(p, sampleRate).h
      const step = makeFir(h)
      return { process: (x) => step(x), settle: h.length - 1 }
    },
    response: (p, f, sampleRate) => firResponse(firDesign(p, sampleRate).h, f, sampleRate),
    phase: (p, f, sampleRate) => firPhase(firDesign(p, sampleRate).h, f, sampleRate),
    kernel: (p, sampleRate) => firDesign(p, sampleRate).h,
    spec: (p, sampleRate) => firDesign(p, sampleRate).margin,
    design: (p, sampleRate) => firDesign(p, sampleRate),
  },

  iirspec: {
    label: 'IIR to a specification',
    group: 'Design',
    hint:
      'The same specification met by an analog prototype mapped through the bilinear transform. It ' +
      'costs a fraction of the coefficients an FIR needs, and its phase is not linear, so a waveform ' +
      'that passes through it changes shape.',
    nonlinear: false,
    defaults: {
      fpass: 4000,
      fstop: 6000,
      ripplePassDb: 1,
      stopDb: 60,
      prototype: 'chebyshev1',
    },
    params: [
      ...specParams,
      {
        key: 'prototype',
        label: 'Prototype',
        kind: 'select',
        options: ['butterworth', 'chebyshev1'],
        hint: 'Butterworth is flat and falls slowly. Chebyshev ripples and falls faster.',
      },
    ],
    summary: (p, ctx) => {
      const d = iirDesign(p, ctx?.sampleRate ?? 48000)
      return `${p.prototype === 'butterworth' ? 'Btw' : 'Cheb'} order ${d.order} · ${d.coefficients} coefficients`
    },
    make: (p, sampleRate) => {
      const secs = iirDesign(p, sampleRate).sections
      const steps = secs.map((c) => {
        let x1 = 0
        let x2 = 0
        let y1 = 0
        let y2 = 0
        return (x) => {
          const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
          x2 = x1
          x1 = x
          y2 = y1
          y1 = y
          return y
        }
      })
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
    response: (p, f, sampleRate) => cascadeResponse(iirDesign(p, sampleRate).sections, f, sampleRate),
    pz: (p, sampleRate) => {
      const poles = []
      const zeros = []
      for (const c of iirDesign(p, sampleRate).sections) {
        const r = biquadPolesZeros(c)
        poles.push(...r.poles)
        zeros.push(...r.zeros)
      }
      return { poles, zeros }
    },
    spec: (p, sampleRate) => iirDesign(p, sampleRate).margin,
    design: (p, sampleRate) => iirDesign(p, sampleRate),
  },

  // --------------------------------------------------------- Adaptive

  plant: {
    label: 'Unknown plant',
    group: 'Adaptive',
    hint:
      'The system an adaptive filter is trying to match. An ordinary FIR, so it keeps its own H(f), ' +
      'and the whole point of the group beside it is that its taps can be recovered without ever ' +
      'being looked at.',
    nonlinear: false,
    defaults: { taps: '0.4,-0.3,0.25,0.1,-0.05,0.02,0.01,0' },
    params: [
      {
        key: 'taps',
        label: 'Impulse response',
        kind: 'text',
        hint: 'Comma-separated tap values, the earliest first.',
      },
    ],
    summary: (p) => `${tapsOf(p.taps).length} taps`,
    make: (p) => {
      const h = tapsOf(p.taps)
      const step = makeFir(h)
      return { process: (x) => step(x), settle: h.length - 1 }
    },
    response: (p, f, sampleRate) => firResponse(tapsOf(p.taps), f, sampleRate),
    phase: (p, f, sampleRate) => firPhase(tapsOf(p.taps), f, sampleRate),
    kernel: (p) => tapsOf(p.taps),
  },

  adaptive: {
    label: 'Adaptive filter',
    group: 'Adaptive',
    hint:
      'Changes its own coefficients at every sample, driven by the error between what it produced ' +
      'and what was wanted. It is not one filter, so it has no H(z). The weight view shows the ' +
      'sequence of filters it passes through, each an ordinary FIR.',
    nonlinear: true,
    defaults: {
      algorithm: 'lms',
      taps: 8,
      mu: 0.02,
      lambda: 0.999,
      delta: 0.01,
      plant: '0.4,-0.3,0.25,0.1,-0.05,0.02,0.01,0',
      noiseAmp: 0,
      nearAmp: 0,
      nearFreq: 300,
      output: 'error',
    },
    params: [
      {
        key: 'algorithm',
        label: 'Algorithm',
        kind: 'select',
        options: ['lms', 'nlms', 'rls'],
        hint: 'Two multiplies a tap, three, or N squared. The cost buys convergence speed.',
      },
      {
        key: 'taps',
        label: 'Filter taps',
        scale: 'linear',
        min: 2,
        max: 64,
        step: 1,
        decimals: 0,
        presets: [4, 8, 16, 32],
      },
      {
        key: 'mu',
        label: 'Step size',
        scale: 'log',
        min: 0.0001,
        max: 1,
        step: 0.0001,
        decimals: 4,
        presets: [0.005, 0.01, 0.02, 0.05],
        when: (p) => p.algorithm !== 'rls',
        whenHint: 'RLS has no step size. Its forgetting factor sets how far back it looks.',
        hint: 'Below 2/(3 N Px) for LMS, and below 2 for NLMS whatever the level is.',
      },
      {
        key: 'lambda',
        label: 'Forgetting factor',
        scale: 'linear',
        min: 0.9,
        max: 1,
        step: 0.0001,
        decimals: 4,
        presets: [0.99, 0.999, 1],
        when: (p) => p.algorithm === 'rls',
      },
      {
        key: 'delta',
        label: 'Regularization',
        scale: 'log',
        min: 0.0001,
        max: 10,
        step: 0.0001,
        decimals: 4,
        presets: [0.001, 0.01, 0.1],
        when: (p) => p.algorithm === 'rls',
        whenHint: 'Only RLS inverts a matrix that needs a starting point away from singular.',
        hint: 'Sets the initial P = I/delta. A small delta starts confident, fast, and initially noisy.',
      },
      { key: 'plant', label: 'Plant taps', kind: 'text' },
      {
        key: 'noiseAmp',
        label: 'Measurement noise',
        scale: 'linear',
        min: 0,
        max: 0.5,
        step: 0.005,
        presets: [0, 0.05, 0.2],
        hint: 'The floor the error cannot go below, because it is not correlated with the input.',
      },
      {
        key: 'nearAmp',
        label: 'Near-end talker',
        scale: 'linear',
        min: 0,
        max: 0.5,
        step: 0.005,
        presets: [0, 0.1, 0.2],
        hint: 'A second voice added to what was wanted. It is not in the input, so no filter of the input can produce it.',
      },
      {
        key: 'nearFreq',
        label: 'Near-end frequency',
        scale: 'log',
        min: 100,
        max: 4000,
        step: 1,
        decimals: 0,
        presets: [300, 1000],
        when: (p) => p.nearAmp > 0,
        whenHint: 'There is no near-end talker to give a frequency to while its amplitude is zero.',
      },
      {
        key: 'output',
        label: 'Output',
        kind: 'select',
        options: ['error', 'estimate', 'wanted'],
      },
    ],
    summary: (p) => `${p.algorithm.toUpperCase()} · ${p.taps} taps · ${p.output}`,
    response: () => null,
    reason:
      'The coefficients change at every sample, so this is not one filter and has no H(z). The weight view shows the sequence of filters it is.',
    make: (p, sampleRate) => {
      // The plant, the noise and the adaptation all run inside this closure, so
      // the block behaves as one processor in the chain while the view reads the
      // whole run through `run` below.
      const plant = tapsOf(p.plant)
      const line = new Float64Array(plant.length)
      let li = 0
      const f = makeAdaptiveFor(p)
      let n = 0
      return {
        process: (x) => {
          line[li] = x
          let want = 0
          let j = li
          for (let k = 0; k < plant.length; k++) {
            want += plant[k] * line[j]
            j = j === 0 ? plant.length - 1 : j - 1
          }
          li = li === plant.length - 1 ? 0 : li + 1
          if (p.noiseAmp > 0) want += p.noiseAmp * (2 * hash(n) - 1)
          if (p.nearAmp > 0) want += p.nearAmp * Math.sin((2 * Math.PI * p.nearFreq * n) / sampleRate)
          n++
          const r = f.update(x, want)
          return p.output === 'estimate' ? r.y : p.output === 'wanted' ? want : r.e
        },
        settle: plant.length,
      }
    },
    /**
     * The whole run, for the weight view. Never the block's own private state.
     *
     * The view wants about 256 rows of weight history and a measurement wants
     * every one, so the stride is an option rather than a constant. `noise` is
     * returned beside the run because the floor the filter cannot cancel is the
     * noise's own power, and a measurement that recomputed it would be using a
     * different sequence from the one the run used.
     */
    run: (p, buf, sampleRate, opts = {}) => {
      // What was wanted carries two things the input cannot explain: a
      // measurement noise floor, and a near-end talker. Both are added to the
      // wanted signal and neither is in the input, so no filter of the input can
      // produce either, and what is left in the error is exactly them.
      const extra =
        p.noiseAmp > 0 || p.nearAmp > 0
          ? Float64Array.from(
              { length: buf.length },
              (_, i) =>
                (p.noiseAmp > 0 ? p.noiseAmp * (2 * hash(i) - 1) : 0) +
                (p.nearAmp > 0
                  ? p.nearAmp * Math.sin((2 * Math.PI * p.nearFreq * i) / sampleRate)
                  : 0),
            )
          : null
      const r = runAdaptive({
        x: buf,
        plant: tapsOf(p.plant),
        algorithm: p.algorithm,
        taps: p.taps,
        mu: p.mu,
        lambda: p.lambda,
        delta: p.delta,
        noise: extra,
        stride: opts.stride ?? Math.max(1, Math.round(buf.length / 256)),
      })
      return { ...r, noise: extra, plant: tapsOf(p.plant) }
    },
  },

  // ------------------------------------------------------ Fixed point

  fixedbiquad: {
    label: 'Fixed-point biquad',
    group: 'Fixed point',
    hint:
      'The same second-order section a processor would run, with the coefficients on a grid and, ' +
      'optionally, the state on one too. Quantised coefficients are a different filter that is ' +
      'still exactly rational. A quantised state makes the recursion nonlinear.',
    nonlinear: false,
    defaults: {
      mode: 'lowpass',
      freq: 600,
      q: 10,
      coeffBits: 16,
      coeffInt: 2,
      stateBits: 0,
      stateInt: 1,
      rounding: 'round',
      overflow: 'saturate',
    },
    params: [
      { key: 'mode', label: 'Shape', kind: 'select', options: ['lowpass', 'highpass', 'bandpass'] },
      {
        key: 'freq',
        label: 'Cutoff',
        unit: 'Hz',
        scale: 'log',
        min: 20,
        max: nyq,
        step: 1,
        presets: [200, 600, 2000],
      },
      {
        key: 'q',
        label: 'Q (resonance)',
        scale: 'log',
        min: 0.5,
        max: 60,
        step: 0.1,
        presets: [0.707, 2, 10, 40],
        hint: 'A high Q puts the poles close to the unit circle, where the coefficient grid is coarsest.',
      },
      {
        key: 'coeffBits',
        label: 'Coefficient bits',
        scale: 'linear',
        min: 6,
        max: 24,
        step: 1,
        decimals: 0,
        presets: [8, 10, 12, 16],
        hint: 'The step is 2^-(bits - 1 - integer bits), and every coefficient lands on it.',
      },
      {
        key: 'coeffInt',
        label: 'Coefficient integer bits',
        scale: 'linear',
        min: 0,
        max: 8,
        step: 1,
        decimals: 0,
        presets: [1, 2, 3],
        hint: 'How many of the coefficient bits sit above the binary point. The rest are the step.',
      },
      {
        key: 'stateBits',
        label: 'State bits',
        scale: 'linear',
        min: 0,
        max: 24,
        step: 1,
        decimals: 0,
        presets: [0, 10, 12, 16],
        hint: 'Zero keeps the state in float64, which is the exactly linear case.',
      },
      {
        key: 'stateInt',
        label: 'State integer bits',
        scale: 'linear',
        min: 0,
        max: 8,
        step: 1,
        decimals: 0,
        presets: [1, 2, 3],
        when: (p) => p.stateBits > 0,
        whenHint: 'The state is float64 while stateBits is 0, so no grid to place a point on.',
        hint: 'How many of the state bits sit above the binary point.',
      },
      { key: 'rounding', label: 'Rounding', kind: 'select', options: ['round', 'truncate'] },
      {
        key: 'overflow',
        label: 'Overflow',
        kind: 'select',
        options: ['saturate', 'wrap'],
        when: (p) => p.stateBits > 0,
      },
    ],
    summary: (p) => {
      const q = quantized(p, 48000)
      return `${p.coeffBits} bit · r ${q.radius.toFixed(4)}${q.stable ? '' : ' · UNSTABLE'}`
    },
    make: (p, sampleRate) => {
      const exact = designBiquad({ mode: p.mode, freq: p.freq, q: p.q }, sampleRate)
      const q = quantizeBiquad(exact, coeffQ(p))
      // An unstable quantised section would take both plots with it. Passing the
      // input through unchanged, with the summary saying so, is the honest
      // failure for a sandbox, and it is the lesson of E2 rather than a bug.
      if (!q.stable) return { process: (x) => x, settle: 0 }
      const step = makeFixedBiquad(exact, { coeffQ: coeffQ(p), stateQ: stateQ(p) })
      const s = settleSamples(q.coeffs)
      return { process: (x) => step(x), settle: Number.isFinite(s) ? s : 2 }
    },
    // The quantised coefficients are exactly rational, so this is their exact
    // response. `lti` says whether it is the whole story.
    response: (p, f, sampleRate) => {
      const q = quantized(p, sampleRate)
      return q.stable ? biquadResponse(q.coeffs, f, sampleRate) : null
    },
    lti: (p) => p.stateBits === 0,
    reason:
      'With the state on a grid the recursion is nonlinear. This curve is the quantised coefficients’ response, and not the whole of what the block does.',
    pz: (p, sampleRate) => {
      const q = quantized(p, sampleRate)
      return { poles: q.poles, zeros: q.zeros, exactPoles: q.exactPoles }
    },
    quantised: (p, sampleRate) => quantized(p, sampleRate),
    quantisers: (p) => ({ coeff: coeffQ(p), state: stateQ(p) }),
  },
}

/** Memoised, because the summary, the response and the z-plane all ask for it. */
const quantized = memoise(
  (p, sampleRate) =>
    quantizeBiquad(designBiquad({ mode: p.mode, freq: p.freq, q: p.q }, sampleRate), coeffQ(p)),
  (p, sampleRate) =>
    [sampleRate, p.mode, p.freq, p.q, p.coeffBits, p.coeffInt, p.rounding].join('|'),
)

/** The adaptive algorithm the block's params name. */
function makeAdaptiveFor(p) {
  return makeAdaptive({
    algorithm: p.algorithm,
    taps: p.taps,
    mu: p.mu,
    lambda: p.lambda,
    delta: p.delta,
  })
}

/** The same addressable noise `signals.js` uses, so a frame and its pre-roll agree. */
function hash(n) {
  let x = n >>> 0
  x = Math.imul(x ^ (x >>> 15), x | 1)
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}

export const BLOCK_GROUPS = ['Rate', 'Design', 'Adaptive', 'Fixed point']

/** A new block record of `type`, with its defaults. */
export function makeBlockRecord(type, id) {
  return { id, type, bypass: false, params: { ...BLOCK_TYPES[type].defaults } }
}
