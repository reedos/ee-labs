// Numbers for a reader.
//
// This lab counts in bits, in bits per second per hertz, and in decibels. One
// module, so the topbar, a pane and a lesson's quoted number always print the
// same value the same way.

import { fmt } from '@ee-labs/ui'

const MINUS = '−'

/** A number of bits, to four decimal places, with its unit. */
export function fmtBits(v, unit = 'bit') {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${sign(v)}${Math.abs(v).toFixed(4)} ${unit}`
}

/** A ratio in decibels, to three decimal places. */
export function fmtDb(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${sign(v)}${Math.abs(v).toFixed(3)} dB`
}

/** A fraction as a percentage. */
export function fmtPercent(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${(100 * v).toFixed(2)} %`
}

/** A rate as a plain fraction, to four places. */
export const fmtRate = (v) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(4))

/** A count, with the thing it counts. */
export const fmtCount = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** A vector of bits as a string, most significant first. */
export const bitsText = (v) => (v ? v.join('') : '—')

/** A field element as its binary digits, for a pane that prints GF(2^m). */
export const symbolText = (v, m) => v.toString(2).padStart(m, '0')

/** A number in engineering notation, where a pane wants one. */
export const eng = (v, unit) => (Number.isFinite(v) ? fmt(v, unit, 4) : '—')

const sign = (v) => (v < 0 ? MINUS : '')
