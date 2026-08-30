import {
  BIQUAD_MODES,
  biquadPhase,
  biquadResponse,
  designBiquad,
  makeBiquad,
  settleSamples,
} from './biquad.js'
import { hash01 } from './signals.js'
import { fmtDb, fmtHz } from '../format.js'

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
  max: nyq,
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
  max: 20,
  step: 0.01,
  presets: Q_PRESETS,
  hint: 'For a low-pass the peak height at the cutoff is exactly Q.',
}

/** A biquad entry, one per RBJ mode. */
function biquadType(mode, label, hint, extra = []) {
  return {
    label,
    group: 'Filter',
    hint,
    nonlinear: false,
    defaults: { freq: 1000, q: Math.SQRT1_2, gainDb: 0 },
    params: [cutoff(mode === 'bandpass' || mode === 'notch' ? 'Centre' : 'Cutoff'), qParam, ...extra],
    summary: (p) =>
      `${fmtHz(p.freq)} · Q ${Number(p.q.toPrecision(3))}` +
      (mode === 'peaking' ? ` · ${fmtDb(p.gainDb)}` : ''),
    make: (p, sampleRate) => {
      const coeffs = designBiquad({ mode, ...p }, sampleRate)
      const step = makeBiquad(coeffs)
      return { process: (x) => step(x), settle: settleSamples(coeffs) }
    },
    response: (p, f, sampleRate) =>
      biquadResponse(designBiquad({ mode, ...p }, sampleRate), f, sampleRate),
    // The half a magnitude plot cannot show. An allpass is the extreme case:
    // |H| is 1.0000 at every frequency while the phase swings through 180
    // degrees, so on the spectrum alone the block appears to do nothing at all.
    phase: (p, f, sampleRate) =>
      biquadPhase(designBiquad({ mode, ...p }, sampleRate), f, sampleRate),
  }
}

export const BLOCK_TYPES = {
  lowpass: biquadType(
    'lowpass',
    'Low-pass',
    'Passes what is below the cutoff and rolls off above it at 12 dB per octave.',
  ),
  highpass: biquadType(
    'highpass',
    'High-pass',
    'The mirror image of the low-pass: everything below the cutoff is removed.',
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

  gain: {
    label: 'Gain / DC',
    group: 'Level',
    hint: 'Scales the signal, and can add a constant that shifts it off centre.',
    nonlinear: false,
    defaults: { gainDb: 0, dcOffset: 0 },
    params: [
      { key: 'gainDb', label: 'Gain', unit: 'dB', scale: 'linear', min: -60, max: 24, step: 0.5, presets: [-12, -6, 0, 6] },
      // DC lives here so it can sit before a clipper: symmetric clipping makes odd
      // harmonics, and offsetting the signal first breaks that symmetry and brings
      // the even ones in.
      { key: 'dcOffset', label: 'DC offset', scale: 'linear', min: -1, max: 1, step: 0.01, presets: [-0.3, 0, 0.3], hint: 'A constant added to every sample. Appears as a spike at 0 Hz.' },
    ],
    summary: (p) => `${fmtDb(p.gainDb)}${p.dcOffset ? ` · DC ${p.dcOffset}` : ''}`,
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
    group: 'Nonlinear',
    hint:
      'Adds the signal to a delayed copy of itself, canceling wherever the delay is half a ' +
      'period — evenly spaced notches. Feed-forward is an FIR filter, feedback an IIR one: ' +
      'the same control, two very different behaviors.',
    nonlinear: false,
    defaults: { delayMs: 4, g: 0.7, mode: 'feedforward' },
    params: [
      { key: 'delayMs', label: 'Delay', unit: 'ms', scale: 'log', min: 0.1, max: 100, step: 0.1, presets: [0.5, 1, 4, 20] },
      { key: 'g', label: 'Feedback', scale: 'linear', min: -0.95, max: 0.95, step: 0.01, presets: [-0.7, 0.5, 0.7, 0.9] },
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
      'Rounds every sample to a coarse grid, as an analogue-to-digital converter does. ' +
      'Undithered, the error tracks the signal and appears as discrete spurious tones; ' +
      'dither turns those into a smooth noise floor.',
    nonlinear: true,
    defaults: { bits: 8, dither: false },
    params: [
      { key: 'bits', label: 'Bits', scale: 'linear', min: 1, max: 16, step: 1, decimals: 0, presets: [4, 8, 12, 16], hint: 'Signal-to-noise ratio is about 6.02 x bits + 1.76 dB.' },
      { key: 'dither', label: 'Dither', kind: 'check' },
    ],
    summary: (p) => `${p.bits} bit${p.dither ? ' · dithered' : ''}`,
    make: (p) => {
      const levels = Math.pow(2, p.bits)
      const delta = 2 / levels
      const dither = p.dither
      let n = 0
      return {
        process: (x) => {
          const d = dither ? (hash01(n++, 0xd1) - 0.5) * delta : 0
          return Math.round((x + d) / delta) * delta
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

export const BLOCK_GROUPS = ['Filter', 'Level', 'Nonlinear']

/** A new block record of `type`, with its defaults. */
export function makeBlockRecord(type, id) {
  return { id, type, bypass: false, params: { ...BLOCK_TYPES[type].defaults } }
}

export { BIQUAD_MODES }
