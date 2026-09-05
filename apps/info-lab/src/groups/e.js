// Group E: LDPC and belief propagation.
//
// The code is a graph, the decoder passes one number along each edge, and the
// syndrome weight after each iteration says how far the word still is from a
// codeword. E3 shows both ends of that: iterations that buy error rate, and a
// decode that never converges at all.

import { L102, L12, symmetric } from '@ee-labs/codes'
import { iterationCurve } from '../analysis.js'
import { Choice, Count, Decibels, GROUPS, Position, Probability, Seed } from './shared.js'

/** The 102-bit code, built once. Its Tanner graph has no four-cycle. */
const LARGE = L102()

export const E = [
  {
    id: 'e1',
    group: GROUPS[4],
    name: 'The code is a graph',
    terms: ['ldpc', 'tanner', 'variablenode', 'checknode', 'girth'],
    params: [Position('flip1', 'First bit flipped', 5, 12), Position('flip2', 'Second bit flipped', 0, 12)],
    ldpc: () => L12(),
    message: () => 0b10110,
    flips: (p) => [p.flip1, p.flip2],
    distance: true,
    view: 'tanner',
    views: ['tanner', 'table', 'decode'],
  },
  {
    id: 'e2',
    group: GROUPS[4],
    name: 'Belief propagation passes messages',
    terms: ['beliefpropagation', 'llr', 'iteration', 'syndromeweight'],
    params: [Seed('seed', 'Channel seed', 9), Probability('crossover', 'Crossover probability', 0.1, undefined, 0, 0.5), Count('iterations', 'Iterations run', 6, 1, 20)],
    ldpc: () => L12(),
    message: () => 0b10110,
    distance: true,
    channel: (p, { bits }) => {
      const ch = symmetric(bits, { p: p.crossover, seed: p.seed })
      return { received: ch.bits, llr: ch.llr, flips: ch.flips }
    },
    iterations: (p) => p.iterations,
    view: 'tanner',
    views: ['tanner', 'decode', 'table'],
  },
  {
    id: 'e3',
    group: GROUPS[4],
    name: 'Iterations buy error rate, and then stop',
    terms: ['iteration', 'convergence', 'cycle', 'maximumlikelihood'],
    params: [
      Choice('case', 'What is decoded', 'many', [
        { value: 'many', label: '20 blocks of 102 bits' },
        { value: 'stuck', label: 'one decode that sticks' },
      ]),
      Decibels('ebN0Db', 'Energy per bit', 4, 1, 8, 'The energy per message bit over the noise density, in decibels.'),
      Count('iterations', 'Iterations run', 12, 1, 25),
    ],
    ldpc: (p) => (p.case === 'many' ? LARGE.H : L12()),
    message: (p) => (p.case === 'many' ? null : 0b10110),
    channel: (p, { bits }) => {
      if (p.case === 'many') return null
      // The one decode that sticks: two flips on the twelve-bit code, at the
      // seed that leaves the syndrome weight at two for ever.
      const ch = symmetric(bits, { p: 0.1, seed: 12 })
      return { received: ch.bits, llr: ch.llr, flips: ch.flips }
    },
    iterations: (p) => (p.case === 'many' ? null : p.iterations),
    curve: (p, out) => {
      if (p.case === 'stuck') {
        const bp = out.ldpc.bp
        return {
          xLabel: 'iteration',
          yLabel: 'checks the word fails',
          points: bp.syndromeWeights.map((w, i) => ({ x: i + 1, y: w })),
          mark: { x: bp.syndromeWeights.length, y: bp.syndromeWeights[bp.syndromeWeights.length - 1] },
          integer: true,
        }
      }
      const curve = iterationCurve({ H: LARGE.H, ebN0Db: p.ebN0Db, rate: 0.5, blocks: 20, iterations: p.iterations })
      return {
        xLabel: 'iteration',
        yLabel: 'bits wrong of 2040',
        points: curve.totals.map((t, i) => ({ x: i, y: t })),
        mark: { x: p.iterations, y: curve.totals[p.iterations] },
        integer: true,
        counts: curve,
      }
    },
    view: 'curve',
    views: ['curve', 'tanner', 'decode'],
  },
]

/** The larger code, for the test that pins E3's numbers. */
export const E3_CODE = LARGE
