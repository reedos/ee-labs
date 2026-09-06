// Group D: convolutional codes and Viterbi.
//
// The encoder is a shift register, the trellis is that register unrolled in
// time, and Viterbi walks it keeping one path into each state. The walker view
// draws every step of that walk, because the decision at each step is the whole
// lesson.

import { bitStream, errorCount, gaussian, viterbi } from '@ee-labs/codes'
import { Choice, Count, Decibels, ENCODERS, GROUPS, Position, Word, messageBits } from './shared.js'

const K_CHOICE = (def, list = ['K3', 'K5', 'K7', 'K9']) =>
  Choice(
    'K',
    'Constraint length',
    def,
    list.map((id) => ({ value: id, label: id.slice(1) })),
  )

/** The channel D5 runs over: a thousand bits, one seed, and a soft output. */
function softChannel(p, sent) {
  const ch = gaussian(sent.bits, { ebN0Db: p.ebN0Db, rate: 0.5, seed: 31 })
  return { received: ch.y, soft: true, hard: ch.hard, flips: ch.flips, sigma: ch.sigma, esN0Db: ch.esN0Db }
}

export const D = [
  {
    id: 'd1',
    group: GROUPS[3],
    name: 'The encoder has memory',
    terms: ['convolutional', 'constraint', 'state', 'generator', 'impulse'],
    params: [K_CHOICE('K3', ['K3', 'K5']), Word('message', 'Message', 0b10110010, 8)],
    conv: (p) => ENCODERS[p.K](),
    bits: (p) => messageBits(p.message, 8),
    view: 'table',
    views: ['table', 'trellis'],
  },
  {
    id: 'd2',
    group: GROUPS[3],
    name: 'The trellis is the encoder unrolled',
    terms: ['trellis', 'branch', 'path', 'termination'],
    params: [K_CHOICE('K3', ['K3', 'K5']), Word('message', 'Message', 0b101100, 6)],
    conv: (p) => ENCODERS[p.K](),
    bits: (p) => messageBits(p.message, 6),
    view: 'trellis',
    views: ['trellis', 'table'],
  },
  {
    id: 'd3',
    group: GROUPS[3],
    name: 'Viterbi discards half the paths at every step',
    terms: ['viterbi', 'survivor', 'metric', 'acs', 'traceback'],
    params: [Word('message', 'Message', 0b10110010, 8), Position('flip1', 'First bit flipped', 4, 20), Position('flip2', 'Second bit flipped', 9, 20)],
    conv: () => ENCODERS.K3(),
    bits: (p) => messageBits(p.message, 8),
    flips: (p) => [p.flip1, p.flip2],
    view: 'trellis',
    views: ['trellis', 'decode', 'table'],
  },
  {
    id: 'd4',
    group: GROUPS[3],
    name: 'Free distance decides the gain',
    terms: ['freedistance', 'errorevent', 'codinggain', 'unionbound'],
    params: [K_CHOICE('K3')],
    conv: (p) => ENCODERS[p.K](),
    bits: () => messageBits(0b101100, 6),
    spectrum: (p) => (p.K === 'K3' ? 12 : 0),
    view: 'weights',
    views: ['weights', 'trellis', 'table'],
  },
  {
    id: 'd5',
    group: GROUPS[3],
    name: 'Traceback needs depth',
    terms: ['traceback', 'depth', 'softdecision', 'ebn0'],
    params: [Count('depth', 'Traceback depth', 15, 2, 40), Decibels('ebN0Db', 'Energy per bit', 3, 1, 8, 'The energy per message bit over the noise density, in decibels.')],
    conv: () => ENCODERS.K3(),
    bits: () => bitStream(1000, 21),
    channel: softChannel,
    depth: (p) => p.depth,
    curve: (p, out) => {
      const depths = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40]
      const points = depths.map((depth) => ({ x: depth, y: errorsAt(out.conv, depth) }))
      const full = errorsAt(out.conv, null)
      return {
        xLabel: 'traceback depth, steps',
        yLabel: 'bits wrong of 1000',
        points,
        floor: full,
        floorLabel: 'traceback to the start',
        mark: { x: p.depth, y: errorsAt(out.conv, p.depth) },
      }
    },
    view: 'curve',
    views: ['curve', 'trellis', 'decode'],
  },
]

/**
 * How many bits one decode of the same received values gets wrong at this
 * traceback depth. Re-decoding is the whole of what D5 varies, so nothing else
 * about the run moves with the knob.
 */
function errorsAt(conv, depth) {
  const out = viterbi(conv.enc, conv.received, { soft: conv.soft, depth })
  return errorCount(out.bits, conv.bits)
}
