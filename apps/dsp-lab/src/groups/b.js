import { BLOCK_TYPES } from '../blocks.js'

// Group B: designing to a specification.
//
// One specification runs through the whole group, so eight experiments compare
// eight answers to the same question rather than eight unrelated filters. It is
// the reference of DSP_LAB_PLAN.md §4.4: passband to 4 kHz within 1 dB,
// stopband from 6 kHz below 60 dB, at 48 kHz.

export const GROUP = 'Designing to a specification'

const mk = (id, type, freq, amp, extra = null) => ({
  id,
  type,
  freq,
  amp,
  phase: 0,
  enabled: true,
  ...extra,
})

const bk = (id, type, params) => ({
  id,
  type,
  bypass: false,
  params: { ...BLOCK_TYPES[type].defaults, ...params },
})

const FRAME = { sampleRate: 48000, fftSize: 4096, window: 'hann', floorDb: -120, timeSpanMs: 4 }
export const SPEC = { fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 60 }

/** White noise, so the spectrum shows the filter's shape rather than a line. */
const NOISE = [mk(1, 'noise', 0, 1)]

export const EXPERIMENTS = [
  {
    id: 'b1',
    group: GROUP,
    name: 'The specification, as a mask',
    terms: ['specification', 'passband', 'stopband', 'margin', 'transition'],
    patch: {
      ...FRAME,
      sources: NOISE,
      blocks: [bk(1, 'firspec', { ...SPEC, method: 'remez' })],
      freqView: 'spectrum',
      showSpec: true,
    },
    featured: [{ block: 1, field: 'stopDb' }],
    chips: [
      { label: '40 dB', patch: { blocks: [{ params: { stopDb: 40 } }] } },
      { label: '60 dB', patch: { blocks: [{ params: { stopDb: 60 } }] } },
      { label: '80 dB', patch: { blocks: [{ params: { stopDb: 80 } }] } },
    ],
    claims: [
      { path: 'spec.pass.marginDb', label: 'Passband margin', unit: 'dB' },
      { path: 'spec.stop.marginDb', label: 'Stopband margin', unit: 'dB' },
      { path: 'design.taps', label: 'Taps it took' },
    ],
  },
  {
    id: 'b2',
    group: GROUP,
    name: 'The transition width a window gives',
    terms: ['window', 'transition', 'specification'],
    patch: {
      ...FRAME,
      sources: NOISE,
      blocks: [bk(1, 'firspec', { ...SPEC, stopDb: 40, method: 'window', window: 'hann' })],
      freqView: 'spectrum',
      showSpec: true,
    },
    featured: [{ block: 1, field: 'window' }],
    chips: [
      { label: 'none', patch: { blocks: [{ params: { window: 'none' } }] } },
      { label: 'hann', patch: { blocks: [{ params: { window: 'hann' } }] } },
      { label: 'hamming', patch: { blocks: [{ params: { window: 'hamming' } }] } },
      { label: 'blackman', patch: { blocks: [{ params: { window: 'blackman' } }] } },
    ],
    claims: [
      { path: 'design.taps', label: 'Taps the window needs' },
      { path: 'spec.stop.marginDb', label: 'Stopband margin', unit: 'dB' },
    ],
  },
  {
    id: 'b3',
    group: GROUP,
    name: 'The stopband depth length cannot change',
    terms: ['window', 'stopband', 'sidelobe', 'transition'],
    patch: {
      ...FRAME,
      sources: NOISE,
      blocks: [bk(1, 'firspec', { ...SPEC, stopDb: 45, method: 'window', window: 'hamming' })],
      freqView: 'spectrum',
      showSpec: true,
    },
    featured: [{ block: 1, field: 'window' }],
    chips: [
      { label: '45 dB', patch: { blocks: [{ params: { stopDb: 45 } }] } },
      { label: '50 dB', patch: { blocks: [{ params: { stopDb: 50 } }] } },
      { label: 'blackman', patch: { blocks: [{ params: { window: 'blackman' } }] } },
      { label: 'hamming', patch: { blocks: [{ params: { window: 'hamming' } }] } },
    ],
    claims: [
      { path: 'design.taps', label: 'Taps it took' },
      { path: 'spec.stop.maxDb', label: 'Worst stopband level', unit: 'dB' },
    ],
  },
  {
    id: 'b4',
    group: GROUP,
    name: 'A window that cannot reach the depth',
    terms: ['window', 'stopband', 'refusal', 'sidelobe'],
    patch: {
      ...FRAME,
      sources: NOISE,
      blocks: [bk(1, 'firspec', { ...SPEC, method: 'window', window: 'hamming' })],
      freqView: 'spectrum',
      showSpec: true,
    },
    featured: [{ block: 1, field: 'window' }],
    chips: [
      { label: 'hamming', patch: { blocks: [{ params: { window: 'hamming' } }] } },
      { label: 'blackman', patch: { blocks: [{ params: { window: 'blackman' } }] } },
    ],
    claims: [
      { path: 'design.met', label: 'Meets the specification' },
      { path: 'spec.stop.marginDb', label: 'Stopband margin', unit: 'dB' },
    ],
  },
  {
    id: 'b5',
    group: GROUP,
    name: 'Parks-McClellan, and equal ripple',
    terms: ['equiripple', 'alternation', 'specification', 'stopband', 'window'],
    patch: {
      ...FRAME,
      sources: NOISE,
      blocks: [bk(1, 'firspec', { ...SPEC, method: 'remez' })],
      freqView: 'spectrum',
      showSpec: true,
    },
    featured: [{ block: 1, field: 'method' }],
    chips: [
      { label: 'window', patch: { blocks: [{ params: { method: 'window', window: 'blackman' } }] } },
      { label: 'remez', patch: { blocks: [{ params: { method: 'remez' } }] } },
    ],
    claims: [
      { path: 'design.taps', label: 'Taps' },
      { path: 'design.delta', label: 'Peak weighted error' },
      { path: 'spec.stop.maxDb', label: 'Every stopband lobe at', unit: 'dB' },
    ],
  },
  {
    id: 'b6',
    group: GROUP,
    name: 'The order estimate, and what the search adds',
    terms: ['equiripple', 'specification', 'transition', 'stopband'],
    patch: {
      ...FRAME,
      sources: NOISE,
      blocks: [bk(1, 'firspec', { ...SPEC, method: 'remez' })],
      freqView: 'spectrum',
      showSpec: true,
    },
    featured: [{ block: 1, field: 'fstop' }],
    chips: [
      { label: 'stop 5 kHz', patch: { blocks: [{ params: { fstop: 5000 } }] } },
      { label: 'stop 6 kHz', patch: { blocks: [{ params: { fstop: 6000 } }] } },
      { label: 'stop 9 kHz', patch: { blocks: [{ params: { fstop: 9000 } }] } },
    ],
    claims: [
      { path: 'design.estimate', label: 'The formula asked for' },
      { path: 'design.taps', label: 'The search settled on' },
      { path: 'design.grew', label: 'Times it grew' },
    ],
  },
  {
    id: 'b7',
    group: GROUP,
    name: 'The bilinear transform, and prewarping',
    terms: ['bilinear', 'prewarp', 'butterworth', 'chebyshev', 'passband'],
    patch: {
      ...FRAME,
      sources: NOISE,
      blocks: [bk(1, 'iirspec', { ...SPEC, prototype: 'butterworth' })],
      freqView: 'zplane',
      showSpec: true,
    },
    featured: [{ block: 1, field: 'prototype' }],
    chips: [
      { label: 'butterworth', patch: { blocks: [{ params: { prototype: 'butterworth' } }] } },
      { label: 'chebyshev1', patch: { blocks: [{ params: { prototype: 'chebyshev1' } }] } },
      { label: '0.1 dB', patch: { blocks: [{ params: { ripplePassDb: 0.1 } }] } },
      { label: '1 dB', patch: { blocks: [{ params: { ripplePassDb: 1 } }] } },
    ],
    claims: [
      { path: 'design.order', label: 'Order' },
      { path: 'design.coefficients', label: 'Coefficients' },
      { path: 'spec.pass.minDb', label: 'Passband floor', unit: 'dB' },
    ],
  },
  {
    id: 'b8',
    group: GROUP,
    name: 'One specification, four filters',
    terms: ['specification', 'groupdelay', 'equiripple', 'chebyshev', 'decimation', 'passband', 'window', 'butterworth'],
    patch: {
      ...FRAME,
      sources: NOISE,
      blocks: [bk(1, 'iirspec', { ...SPEC, prototype: 'chebyshev1' })],
      freqView: 'spectrum',
      showSpec: true,
    },
    featured: [{ block: 1, field: 'prototype' }],
    chips: [
      { label: 'chebyshev1', patch: { blocks: [{ params: { prototype: 'chebyshev1' } }] } },
      { label: 'butterworth', patch: { blocks: [{ params: { prototype: 'butterworth' } }] } },
    ],
    claims: [
      { path: 'design.order', label: 'Order' },
      { path: 'design.coefficients', label: 'Coefficients' },
      { path: 'spec.worst', label: 'Tightest margin', unit: 'dB' },
    ],
  },
]
