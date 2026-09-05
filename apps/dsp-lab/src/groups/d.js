import { BLOCK_TYPES } from '../blocks.js'

// Group D: estimating a spectrum.
//
// Data only. The prose lives in lessons/d.js and the definitions in terms/d.js.
//
// The source is noise in every experiment but the last two, and noise has no
// lines to read. What it has is a density, so the view these lessons open on is
// the density view rather than the spectrum, and the window is switched off
// where a scatter is being measured: a Hann window correlates neighbouring bins,
// and the scatter across bins is exactly what D1 to D4 are counting.

export const GROUP = 'Estimating a spectrum'

const mk = (id, type, freq, amp) => ({ id, type, freq, amp, phase: 0, enabled: true })

const bk = (id, type, params) => ({
  id,
  type,
  bypass: false,
  params: { ...BLOCK_TYPES[type].defaults, ...params },
})

const FRAME = { sampleRate: 48000, window: 'none', floorDb: -60, timeSpanMs: 8, freqView: 'density' }

/** The record lengths D1 and D2 walk, a factor of sixteen apart end to end. */
export const RECORDS = [1024, 4096, 16384]

/** The segment counts D3 walks, each four times the one before. */
export const SEGMENTS = [4, 16, 64, 256]

/** The two-pole process D6 and D7 fit a model to. Its poles sit at 0.9487. */
export const PROCESS = { a1: -1.6, a2: 0.9 }

/** Two tones 120 Hz apart, which D5 resolves and then merges. */
export const TONE_GAP = 120

const white = [mk(1, 'noise', 0, 1)]

export const EXPERIMENTS = [
  {
    id: 'd1',
    group: GROUP,
    name: 'The periodogram, and what it does not do',
    terms: ['density', 'periodogram', 'scatter', 'window'],
    patch: { ...FRAME, fftSize: 4096, sources: white, blocks: [], estimator: 'periodogram' },
    chips: [
      { label: '1024', patch: { fftSize: 1024 } },
      { label: '4096', patch: { fftSize: 4096 } },
      { label: '16384', patch: { fftSize: 16384 } },
      { label: 'spectrum', patch: { freqView: 'spectrum' } },
    ],
    claims: [
      { path: 'psd.true', label: 'The density the source has' },
      { path: 'psd.mean', label: 'The density the estimate reads' },
      { path: 'psd.cv', label: 'Its scatter over its mean' },
      { path: 'psd.df', label: 'One bin', unit: 'Hz' },
    ],
  },
  {
    id: 'd2',
    group: GROUP,
    name: 'What a longer record buys',
    terms: ['density', 'periodogram', 'scatter', 'resolution'],
    patch: { ...FRAME, fftSize: 16384, sources: white, blocks: [], estimator: 'periodogram' },
    chips: [
      { label: '1024', patch: { fftSize: 1024 } },
      { label: '4096', patch: { fftSize: 4096 } },
      { label: '16384', patch: { fftSize: 16384 } },
      { label: 'average 16', patch: { estimator: 'bartlett', segments: 16 } },
    ],
    claims: [
      { path: 'psd.n', label: 'The record, in samples' },
      { path: 'psd.df', label: 'One bin', unit: 'Hz' },
      { path: 'psd.cv', label: 'Its scatter over its mean' },
    ],
  },
  {
    id: 'd3',
    group: GROUP,
    name: 'Bartlett, and the root of K',
    terms: ['bartlett', 'density', 'scatter', 'resolution', 'periodogram'],
    patch: {
      ...FRAME,
      fftSize: 16384,
      sources: white,
      blocks: [],
      estimator: 'bartlett',
      segments: 16,
    },
    chips: SEGMENTS.map((k) => ({ label: `K = ${k}`, patch: { segments: k } })),
    claims: [
      { path: 'psd.segments', label: 'Segments averaged' },
      { path: 'psd.cv', label: 'Its scatter over its mean' },
      { path: 'psd.predicted', label: 'One over the root of K' },
      { path: 'psd.df', label: 'One bin', unit: 'Hz' },
    ],
  },
  {
    id: 'd4',
    group: GROUP,
    name: 'Welch, and why the segments overlap',
    terms: ['welch', 'bartlett', 'scatter', 'window', 'density'],
    patch: {
      ...FRAME,
      fftSize: 16384,
      sources: white,
      blocks: [],
      estimator: 'welch',
      segments: 16,
    },
    chips: [
      { label: 'Bartlett', patch: { estimator: 'bartlett' } },
      { label: 'Welch', patch: { estimator: 'welch' } },
      { label: 'K = 16', patch: { segments: 16 } },
      { label: 'K = 64', patch: { segments: 64 } },
    ],
    claims: [
      { path: 'psd.segments', label: 'Segments averaged' },
      { path: 'psd.used', label: 'Samples the estimate read' },
      { path: 'psd.cv', label: 'Its scatter over its mean' },
      { path: 'psd.df', label: 'One bin', unit: 'Hz' },
    ],
  },
  {
    id: 'd5',
    group: GROUP,
    name: 'What the averaging costs',
    terms: ['resolution', 'bartlett', 'density', 'periodogram'],
    patch: {
      ...FRAME,
      fftSize: 16384,
      window: 'hann',
      sources: [mk(1, 'sine', 4380, 1), mk(2, 'sine', 4380 + TONE_GAP, 1)],
      blocks: [],
      estimator: 'periodogram',
      segments: 1,
    },
    chips: [
      { label: 'one segment', patch: { estimator: 'periodogram', segments: 1 } },
      { label: 'K = 16', patch: { estimator: 'bartlett', segments: 16 } },
      { label: 'K = 64', patch: { estimator: 'bartlett', segments: 64 } },
      { label: 'K = 256', patch: { estimator: 'bartlett', segments: 256 } },
    ],
    claims: [
      { path: 'psd.df', label: 'One bin', unit: 'Hz' },
      { path: 'psd.peaks.4000.5000', label: 'Lines between 4 and 5 kHz' },
      { path: 'psd.resolved.4000.5000', label: 'The two are separate' },
    ],
  },
  {
    id: 'd6',
    group: GROUP,
    name: 'The model instead of the average',
    terms: ['armodel', 'density', 'resolution', 'poleradius'],
    patch: {
      ...FRAME,
      fftSize: 16384,
      sources: white,
      blocks: [bk(1, 'allpole', PROCESS)],
      estimator: 'periodogram',
      arOrder: 2,
    },
    featured: [{ block: 1, field: 'a2' }],
    chips: [
      { label: '1024', patch: { fftSize: 1024 } },
      { label: '4096', patch: { fftSize: 4096 } },
      { label: '16384', patch: { fftSize: 16384 } },
      { label: 'z-plane', patch: { freqView: 'zplane' } },
    ],
    claims: [
      { path: 'ar.a1', label: 'a1, fitted' },
      { path: 'ar.a2', label: 'a2, fitted' },
      { path: 'ar.peak', label: 'Where the model peaks', unit: 'Hz' },
      { path: 'ar.sigma2', label: 'The prediction error' },
    ],
  },
  {
    id: 'd7',
    group: GROUP,
    name: 'Choosing the order',
    terms: ['armodel', 'ordercriterion', 'density'],
    patch: {
      ...FRAME,
      fftSize: 4096,
      sources: white,
      blocks: [bk(1, 'allpole', PROCESS)],
      estimator: 'periodogram',
      arOrder: 2,
      arMaxOrder: 12,
    },
    featured: [{ block: 1, field: 'a1' }],
    chips: [
      { label: 'order 2', patch: { arOrder: 2 } },
      { label: 'order 6', patch: { arOrder: 6 } },
      { label: 'order 12', patch: { arOrder: 12 } },
      { label: '16384', patch: { fftSize: 16384 } },
    ],
    claims: [
      { path: 'ar.sigma2', label: 'The prediction error at this order' },
      { path: 'ar.aic', label: 'The order Akaike picks' },
      { path: 'ar.mdl', label: 'The order the description length picks' },
    ],
  },
]
