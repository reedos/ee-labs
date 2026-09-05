// Group F: coding gain measured, and B4 with it.
//
// The lab's conclusion, and its only dependency on another lab. Each experiment
// is two curves and the distance between them. The uncoded curve is the
// Communications Lab's `berClosed`, the limit is this lab's `entropy.js`, and
// the gain is what a bisection finds between them
// (INFORMATION_LAB_PLAN.md §5, Group F).

import { CONV_CODES, encoder, freeDistance, golayCode, hammingCode, weightSpectrum } from '@ee-labs/codes'
import { bitsPerSymbol } from '@ee-labs/comms'
import { CODES, CODE_NAMES, Choice, Decibels, GROUPS } from './shared.js'

/** The error rate every gain in this group is read at. */
const TARGET = (def = 1e-5) =>
  Choice('target', 'Error rate read at', def, [
    { value: 1e-3, label: '10⁻³' },
    { value: 1e-4, label: '10⁻⁴' },
    { value: 1e-5, label: '10⁻⁵' },
    { value: 1e-6, label: '10⁻⁶' },
  ])

/** The schemes B4 draws, each with the spectral efficiency its limit is taken at. */
export const SCHEMES = ['bpsk', 'qpsk', 'qam16', 'qam64']
const SCHEME_NAMES = { bpsk: 'BPSK', qpsk: 'QPSK', qam16: '16-QAM', qam64: '64-QAM' }

/** The convolutional codes F3 offers, with their spectra computed once. */
const CONV = Object.fromEntries(
  Object.entries(CONV_CODES).map(([name, spec]) => {
    const enc = encoder(spec)
    const dFree = freeDistance(enc)
    return [name, { enc, dFree, spectrum: weightSpectrum(enc, dFree + 7) }]
  }),
)

export const B4 = {
  id: 'b4',
  group: GROUPS[1],
  name: 'The limit drawn on the error rate plot',
  terms: ['shannonlimit', 'ebn0', 'efficiency', 'uncoded', 'codinggain'],
  params: [
    Choice(
      'scheme',
      'Scheme',
      'bpsk',
      SCHEMES.map((id) => ({ value: id, label: SCHEME_NAMES[id] })),
    ),
    TARGET(),
  ],
  gain: (p) => ({ scheme: p.scheme, efficiency: bitsPerSymbol(p.scheme), target: p.target, coded: null }),
  capacity: (p) => ({ efficiency: bitsPerSymbol(p.scheme) }),
  view: 'gain',
  views: ['gain', 'channel'],
}

export const F = [
  {
    id: 'f1',
    group: GROUPS[5],
    name: 'The coded curve, against the uncoded one',
    terms: ['codinggain', 'uncoded', 'harddecision', 'rate', 'radius'],
    params: [
      Choice(
        'code',
        'Code',
        'H74',
        ['H74', 'H15', 'G23'].map((id) => ({ value: id, label: CODE_NAMES[id] })),
      ),
      TARGET(),
    ],
    gain: (p) => ({ block: CODES[p.code](), decision: 'hard', target: p.target, scheme: 'bpsk', efficiency: 1 }),
    view: 'gain',
    views: ['gain', 'weights', 'table'],
  },
  {
    id: 'f2',
    group: GROUPS[5],
    name: 'Below the crossover a code loses',
    terms: ['crossoverpoint', 'codinggain', 'rate', 'uncoded'],
    params: [
      Choice(
        'code',
        'Code',
        'H74',
        ['H74', 'H15', 'G23'].map((id) => ({ value: id, label: CODE_NAMES[id] })),
      ),
      Decibels('ebN0Db', 'Energy per bit', 4, 0, 12, 'Where the two curves are read, in decibels.'),
    ],
    gain: (p) => ({ block: CODES[p.code](), decision: 'hard', target: 1e-5, at: p.ebN0Db, scheme: 'bpsk', efficiency: 1 }),
    view: 'gain',
    views: ['gain', 'weights'],
  },
  {
    id: 'f3',
    group: GROUPS[5],
    name: 'Soft decisions are worth more than a decibel',
    terms: ['softdecision', 'harddecision', 'threshold', 'unionbound', 'codinggain'],
    params: [
      Choice(
        'K',
        'Constraint length',
        'K3',
        Object.keys(CONV).map((id) => ({ value: id, label: id.slice(1) })),
      ),
      Choice('decision', 'Decisions', 'soft', [
        { value: 'soft', label: 'soft' },
        { value: 'hard', label: 'hard' },
      ]),
      TARGET(),
    ],
    gain: (p) => ({ conv: CONV[p.K], decision: p.decision, target: p.target, scheme: 'bpsk', efficiency: 1, both: true }),
    capacity: () => ({ thresholds: 0.5 }),
    chain: (p) => ({ K: p.K, ebN0Db: 1, seed: 21, bits: 600 }),
    view: 'gain',
    views: ['gain', 'decode', 'weights'],
  },
]
