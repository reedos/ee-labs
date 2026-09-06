// Group C: block codes.
//
// One parity bit, then the syndrome that names an error, then the distance that
// decides what a code can do at all. C4 shows the same code as polynomial
// division, and C5 leaves the bits for the symbols of GF(2⁴).

import { CODES, CODE_NAMES, Choice, Count, GROUPS, Position, RS15, Word } from './shared.js'

const CODE_CHOICE = (key, def, list) =>
  Choice(
    key,
    'Code',
    def,
    list.map((id) => ({ value: id, label: CODE_NAMES[id] })),
  )

export const C = [
  {
    id: 'c1',
    group: GROUPS[2],
    name: 'A parity bit detects one error',
    terms: ['parity', 'gf2', 'codeword', 'syndrome', 'linearcode'],
    params: [Word('message', 'Message', 0b1011, 4), Position('flip1', 'First bit flipped', 1, 5), Position('flip2', 'Second bit flipped', 0, 5)],
    code: () => CODES.P54(),
    message: (p) => p.message,
    flips: (p) => [p.flip1, p.flip2],
    view: 'decode',
    views: ['decode', 'table', 'weights'],
  },
  {
    id: 'c2',
    group: GROUPS[2],
    name: 'The syndrome names the error',
    terms: ['syndrome', 'paritycheck', 'hamming', 'coset', 'generator'],
    params: [Word('message', 'Message', 0b1011, 4), Position('flip1', 'First bit flipped', 3, 7), Position('flip2', 'Second bit flipped', 0, 7)],
    code: () => CODES.H74(),
    message: (p) => p.message,
    flips: (p) => [p.flip1, p.flip2],
    view: 'table',
    views: ['table', 'decode', 'weights'],
  },
  {
    id: 'c3',
    group: GROUPS[2],
    name: 'Distance decides what a code can do',
    terms: ['distance', 'weight', 'radius', 'perfect', 'rate'],
    params: [CODE_CHOICE('code', 'H74', ['P54', 'H74', 'H15', 'G23', 'R5']), Position('flip1', 'First bit flipped', 0, 23), Position('flip2', 'Second bit flipped', 0, 23)],
    code: (p) => CODES[p.code](),
    message: () => 0b1011,
    flips: (p) => [p.flip1, p.flip2],
    view: 'weights',
    views: ['weights', 'table', 'decode'],
  },
  {
    id: 'c4',
    group: GROUPS[2],
    name: 'A cyclic code is polynomial division',
    terms: ['cyclic', 'generatorpoly', 'remainder', 'golay'],
    params: [CODE_CHOICE('code', 'H74', ['H74', 'H15', 'G23']), Word('message', 'Message', 0b1011, 12), Position('flip1', 'Bit flipped', 3, 23)],
    code: (p) => CODES[p.code](),
    message: (p) => p.message,
    flips: (p) => [p.flip1],
    view: 'decode',
    views: ['decode', 'table', 'weights'],
  },
  {
    id: 'c5',
    group: GROUPS[2],
    name: 'Symbols instead of bits',
    terms: ['gfm', 'primitive', 'reedsolomon', 'erasure', 'singleton'],
    params: [Count('erasures', 'Symbols erased', 4, 0, 5)],
    field: () => RS15(),
    erasures: (p) => p.erasures,
    view: 'field',
    views: ['field', 'decode'],
  },
]
