import { BLOCK_TYPES } from '../blocks.js'

// Group A: changing the rate.
//
// Data only. The prose lives in lessons/a.js and the two are merged by
// experiments.js, which is what keeps a group's numbers and a group's words in
// separate files with separate owners.
//
// Every frequency here is a multiple of 375 Hz, which is fs/128 at 48 kHz and
// therefore a bin centre of the 4096-point frame. A line on a bin centre reads
// its true amplitude; a line between two of them reads up to 1.4 dB low through
// a Hann window, and a lesson that quotes 0.2500 cannot afford that.

export const GROUP = 'Changing the rate'

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

export const EXPERIMENTS = [
  {
    id: 'a1',
    group: GROUP,
    name: 'Decimation, and the fold it causes',
    terms: ['decimation', 'alias', 'nyquist', 'holddroop'],
    patch: {
      ...FRAME,
      sources: [mk(1, 'sine', 9000, 1)],
      blocks: [bk(1, 'decimate', { M: 4, antialias: false })],
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'M' }],
    chips: [
      { label: 'M = 2', patch: { blocks: [{ params: { M: 2 } }] } },
      { label: 'M = 4', patch: { blocks: [{ params: { M: 4 } }] } },
      { label: '1500 Hz', patch: { sources: [{ freq: 1500 }] } },
      { label: '9 kHz', patch: { sources: [{ freq: 9000 }] } },
    ],
    claims: [
      { path: 'rate.nyquist', label: 'New Nyquist', unit: 'Hz' },
      { path: 'rate.alias', label: 'The 9 kHz tone arrives at', unit: 'Hz' },
      { path: 'line.3000', label: 'Its amplitude there' },
      { path: 'line.9000', label: 'What is left at 9 kHz' },
    ],
  },
  {
    id: 'a2',
    group: GROUP,
    name: 'The filter that has to come first',
    terms: ['antialias', 'decimation', 'alias', 'stopband', 'transition', 'window'],
    patch: {
      ...FRAME,
      sources: [mk(1, 'sine', 9000, 1)],
      blocks: [bk(1, 'decimate', { M: 4, antialias: true, taps: 121, window: 'blackman' })],
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'antialias' }],
    chips: [
      { label: 'filter off', patch: { blocks: [{ params: { antialias: false } }] } },
      { label: 'filter on', patch: { blocks: [{ params: { antialias: true } }] } },
      { label: '31 taps', patch: { blocks: [{ params: { taps: 31 } }] } },
      { label: '121 taps', patch: { blocks: [{ params: { taps: 121 } }] } },
    ],
    claims: [
      { path: 'guard.9000', label: 'The filter at 9 kHz' },
      { path: 'line.3000', label: 'The alias that is left' },
    ],
  },
  {
    id: 'a3',
    group: GROUP,
    name: 'Interpolation, and the images it leaves',
    terms: ['interpolation', 'image', 'zerostuff'],
    patch: {
      ...FRAME,
      sources: [mk(1, 'sine', 1500, 1)],
      blocks: [bk(1, 'interpolate', { L: 4, fill: 'zeros' })],
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'fill' }],
    chips: [
      { label: 'zeros', patch: { blocks: [{ params: { fill: 'zeros' } }] } },
      { label: 'hold', patch: { blocks: [{ params: { fill: 'hold' } }] } },
      { label: 'L = 2', patch: { blocks: [{ params: { L: 2 } }] } },
      { label: 'L = 4', patch: { blocks: [{ params: { L: 4 } }] } },
    ],
    claims: [
      { path: 'rate.grid', label: 'The coarse grid runs at', unit: 'Hz' },
      { path: 'line.1500', label: 'The wanted line' },
      { path: 'line.10500', label: 'Image below the grid rate' },
      { path: 'line.13500', label: 'Image above it' },
      { path: 'line.22500', label: 'Image at twice the grid rate' },
    ],
  },
  {
    id: 'a4',
    group: GROUP,
    name: 'The interpolation filter, and the gain of L',
    terms: ['interpolation', 'image', 'passband', 'zerostuff'],
    patch: {
      ...FRAME,
      sources: [mk(1, 'sine', 1500, 1)],
      blocks: [bk(1, 'interpolate', { L: 4, fill: 'filter', taps: 121, window: 'blackman' })],
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'fill' }],
    chips: [
      { label: 'zeros', patch: { blocks: [{ params: { fill: 'zeros' } }] } },
      { label: 'filter', patch: { blocks: [{ params: { fill: 'filter' } }] } },
    ],
    claims: [
      { path: 'line.1500', label: 'The wanted line, back at full amplitude' },
      { path: 'line.10500', label: 'The image that was 0.25' },
    ],
  },
  {
    id: 'a5',
    group: GROUP,
    name: 'The polyphase decimator, and what it saves',
    terms: ['polyphase', 'decimation'],
    patch: {
      ...FRAME,
      sources: [mk(1, 'noise', 0, 1)],
      blocks: [bk(1, 'decimate', { M: 4, antialias: true, taps: 121, window: 'blackman' })],
      freqView: 'spectrum',
      timeView: 'signal',
    },
    featured: [{ block: 1, field: 'M' }],
    chips: [
      { label: 'M = 2', patch: { blocks: [{ params: { M: 2 } }] } },
      { label: 'M = 4', patch: { blocks: [{ params: { M: 4 } }] } },
      { label: 'M = 8', patch: { blocks: [{ params: { M: 8 } }] } },
    ],
    claims: [
      { path: 'cost.direct', label: 'Direct, multiplies a second' },
      { path: 'cost.polyphase', label: 'Polyphase, multiplies a second' },
      { path: 'cost.ratio', label: 'The saving' },
    ],
  },
  {
    id: 'a6',
    group: GROUP,
    name: 'The polyphase interpolator',
    terms: ['polyphase', 'interpolation', 'decimation', 'zerostuff'],
    patch: {
      ...FRAME,
      sources: [mk(1, 'sine', 1500, 1)],
      blocks: [bk(1, 'interpolate', { L: 4, fill: 'filter', taps: 121, window: 'blackman' })],
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'L' }],
    chips: [
      { label: 'L = 2', patch: { blocks: [{ params: { L: 2 } }] } },
      { label: 'L = 4', patch: { blocks: [{ params: { L: 4 } }] } },
      { label: '241 taps', patch: { blocks: [{ params: { taps: 241 } }] } },
    ],
    claims: [
      { path: 'cost.direct', label: 'Direct, multiplies a second' },
      { path: 'cost.polyphase', label: 'Polyphase, multiplies a second' },
    ],
  },
  {
    id: 'a7',
    group: GROUP,
    name: 'The noble identities',
    terms: ['noble', 'polyphase', 'decimation', 'image'],
    patch: {
      ...FRAME,
      sources: [mk(1, 'noise', 0, 1)],
      blocks: [bk(1, 'decimate', { M: 4, antialias: true, taps: 31, window: 'hamming' })],
      freqView: 'spectrum',
    },
    featured: [{ block: 1, field: 'M' }],
    chips: [
      { label: 'M = 2', patch: { blocks: [{ params: { M: 2 } }] } },
      { label: 'M = 3', patch: { blocks: [{ params: { M: 3 } }] } },
      { label: 'M = 4', patch: { blocks: [{ params: { M: 4 } }] } },
    ],
    claims: [{ path: 'rate.nyquist', label: 'New Nyquist', unit: 'Hz' }],
  },
]
