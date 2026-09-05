// Group A: entropy and source coding.
//
// The first five screens of the lab. A source has an entropy, a coder tries to
// reach it, and the gap between the two is a number on the screen at every
// step.

import { blockedHuffman, entropy } from '@ee-labs/codes'
import { Choice, Count, GROUPS, Probability, SOURCES, SOURCE_NAMES } from './shared.js'

const SOURCE_CHOICE = (def) =>
  Choice(
    'source',
    'Source',
    def,
    Object.keys(SOURCES).map((id) => ({ value: id, label: SOURCE_NAMES[id] })),
  )

/** A tilt moves probability from the first symbol to the last, keeping the total at one. */
const TILT = (max = 0.4) => Probability('tilt', 'Moved to the last', 0, 'How much probability moves from the first symbol to the last one.', 0, max)

/** The source at this setting: the named distribution with the tilt applied. */
export const tilted = (p) => {
  const base = [...SOURCES[p.source]]
  const t = Math.min(p.tilt, base[0])
  base[0] -= t
  base[base.length - 1] += t
  return base
}

export const A = [
  {
    id: 'a1',
    group: GROUPS[0],
    name: 'Entropy is a number a source has',
    terms: ['entropy', 'source', 'bit', 'uniform'],
    params: [SOURCE_CHOICE('S5'), TILT()],
    source: tilted,
    curve: (p) => ({
      xLabel: 'probability moved to the last symbol',
      yLabel: 'entropy, bit per symbol',
      points: steps(0, 0.4, 41).map((t) => ({ x: t, y: entropy(tilted({ ...p, tilt: t })) })),
      mark: { x: p.tilt, y: entropy(tilted(p)) },
    }),
    view: 'source',
    views: ['source', 'curve'],
  },
  {
    id: 'a2',
    group: GROUPS[0],
    name: 'Huffman reaches within one bit',
    terms: ['huffman', 'codeword', 'prefixcode', 'redundancy', 'kraft'],
    params: [SOURCE_CHOICE('S5'), TILT()],
    source: tilted,
    view: 'tree',
    views: ['tree', 'source'],
  },
  {
    id: 'a3',
    group: GROUPS[0],
    name: 'When Huffman is exact, and when it is worst',
    terms: ['dyadic', 'huffman', 'entropy', 'redundancy'],
    params: [SOURCE_CHOICE('S4d'), TILT(0.25)],
    source: tilted,
    view: 'source',
    views: ['source', 'tree'],
  },
  {
    id: 'a4',
    group: GROUPS[0],
    name: 'Blocking recovers the gap',
    terms: ['block', 'huffman', 'entropy', 'redundancy'],
    params: [Probability('p', 'First symbol', 0.9, 'The probability of the first of the two symbols.', 0.5, 0.95), Count('block', 'Symbols per block', 2, 1, 4)],
    source: (p) => [p.p, 1 - p.p],
    blocks: () => [1, 2, 3, 4],
    curve: (p) => ({
      xLabel: 'symbols per block',
      yLabel: 'code length, bit per symbol',
      points: [1, 2, 3, 4].map((n) => ({ x: n, y: blockedHuffman([p.p, 1 - p.p], n).meanLength })),
      floor: entropy([p.p, 1 - p.p]),
      floorLabel: 'entropy',
      mark: { x: p.block, y: blockedHuffman([p.p, 1 - p.p], p.block).meanLength },
    }),
    view: 'curve',
    views: ['curve', 'tree', 'source'],
  },
  {
    id: 'a5',
    group: GROUPS[0],
    name: 'Arithmetic coding needs no blocks',
    terms: ['arithmetic', 'interval', 'entropy', 'kraft'],
    params: [
      Count('tenths', 'First symbol, in tenths', 9, 5, 9),
      Choice('n', 'Symbols coded', 100, [
        { value: 10, label: '10' },
        { value: 100, label: '100' },
        { value: 1000, label: '1000' },
      ]),
    ],
    source: (p) => [p.tenths / 10, 1 - p.tenths / 10],
    arith: (p) => ({ counts: [p.tenths, 10 - p.tenths], n: p.n }),
    curve: (p) => ({
      xLabel: 'symbols coded',
      yLabel: 'bits per symbol, at the bound',
      points: [10, 100, 1000].map((n) => ({ x: n, y: (n * entropy([p.tenths / 10, 1 - p.tenths / 10]) + 2) / n })),
      floor: entropy([p.tenths / 10, 1 - p.tenths / 10]),
      floorLabel: 'entropy',
      logX: true,
      mark: { x: p.n, y: (p.n * entropy([p.tenths / 10, 1 - p.tenths / 10]) + 2) / p.n },
    }),
    view: 'tree',
    views: ['tree', 'curve', 'source'],
  },
]

/** `count` values from `lo` to `hi`, for a curve that a knob moves along. */
export const steps = (lo, hi, count) => Array.from({ length: count }, (_, i) => lo + ((hi - lo) * i) / (count - 1))
