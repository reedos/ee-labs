// The knobs, the code library, and the names every group shares.
//
// Every object below is fixed by name (INFORMATION_LAB_PLAN.md §3), so a
// lesson, a test and a view refer to the same thing. Each is built from its own
// construction rather than stored as a matrix, so the (7,4) code the code table
// draws is the code the engine derives from x³ + x + 1.

import { CONV_CODES, codeFromParity, encoder, golayCode, hammingCode, L12, parityCheckCode, repetitionCode, rsCode } from '@ee-labs/codes'

export const GROUPS = [
  'A · Entropy and source coding',
  'B · Capacity and the Shannon limit',
  'C · Block codes',
  'D · Convolutional codes and Viterbi',
  'E · LDPC and belief propagation',
  'F · Coding gain measured',
]

/** The block codes, by the names the plan gives them. */
export const CODES = {
  P54: () => parityCheckCode(4),
  H74: () => hammingCode(3),
  H15: () => hammingCode(4),
  H63: () => hammingCode(6),
  H31: () => hammingCode(2),
  G23: () => golayCode(),
  R5: () => repetitionCode(5),
  L12: () => codeFromParity(L12(), { name: '(12,5) LDPC' }),
}

/** What each code is called on screen. One name per thing (STYLE.md S11). */
export const CODE_NAMES = {
  P54: '(5,4) parity check',
  H74: '(7,4) Hamming',
  H15: '(15,11) Hamming',
  H63: '(63,57) Hamming',
  H31: '(3,1) Hamming',
  G23: '(23,12) Golay',
  R5: '(5,1) repetition',
  L12: '(12,5) LDPC',
}

/** The sources of the plan's §3, and the two extremes A1 opens with. */
export const SOURCES = {
  S5: [0.4, 0.2, 0.2, 0.1, 0.1],
  S5u: [0.2, 0.2, 0.2, 0.2, 0.2],
  S5c: [1, 0, 0, 0, 0],
  S4d: [0.5, 0.25, 0.125, 0.125],
  S2: [0.9, 0.1],
}

export const SOURCE_NAMES = {
  S5: 'five symbols, uneven',
  S5u: 'five symbols, uniform',
  S5c: 'one certain symbol',
  S4d: 'four symbols, dyadic',
  S2: 'two symbols, p = 0.9',
}

/** The convolutional encoders, built from the plan's constraint lengths. */
export const ENCODERS = Object.fromEntries(Object.entries(CONV_CODES).map(([name, spec]) => [name, () => encoder(spec)]))

/** Reed-Solomon over GF(2⁴), the code C5 draws. */
export const RS15 = () => rsCode(4, 15, 11)

// ---------- knobs ----------

/** A choice of one named object, drawn as a segmented control. */
export const Choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })

/** A whole word of `bits` bits, entered as the number it stands for. */
export const Word = (key, label, def, bits, hint) => ({ key, label, unit: '', min: 0, max: 2 ** bits - 1, step: 1, scale: 'linear', decimals: 0, default: def, hint, bits })

/** A bit position, counting from 1, where 0 means no bit at all. */
export const Position = (key, label, def, n, hint) => ({ key, label, unit: '', min: 0, max: n, step: 1, scale: 'linear', decimals: 0, default: def, hint })

/** A plain count. */
export const Count = (key, label, def, min, max, hint) => ({ key, label, unit: '', min, max, step: 1, scale: 'linear', decimals: 0, default: def, hint })

/** A probability, in hundredths so that the field steps by one part in a hundred. */
export const Probability = (key, label, def, hint, min = 0, max = 0.5) => ({ key, label, unit: '', min, max, step: 0.01, scale: 'linear', decimals: 3, default: def, hint })

/** A ratio in decibels. */
export const Decibels = (key, label, def, min, max, hint) => ({ key, label, unit: 'dB', min, max, step: 0.5, scale: 'linear', decimals: 2, default: def, hint })

/** A rate in bits per second per hertz. */
export const Efficiency = (key, label, def, hint) => ({ key, label, unit: 'bit/s/Hz', min: 0.125, max: 8, step: 0.125, scale: 'linear', decimals: 3, default: def, hint })

/** A seed, which is a whole number and nothing else. */
export const Seed = (key, label, def, max = 40, hint) => ({ key, label, unit: '', min: 1, max, step: 1, scale: 'linear', decimals: 0, default: def, hint })

/** The message word of a code, as a vector of `k` bits. */
export const messageBits = (value, k) => Array.from({ length: k }, (_, i) => (value >> (k - 1 - i)) & 1)

/** An error pattern from up to two flipped positions, each counting from 1. */
export function errorPattern(n, positions) {
  const e = new Array(n).fill(0)
  for (const p of positions) if (p >= 1 && p <= n) e[p - 1] ^= 1
  return e
}
