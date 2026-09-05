// Picoseconds for a reader.
//
// Every time in the engine is a whole number of picoseconds (the plan's
// Decision 2). A reader reads picoseconds up to a nanosecond and nanoseconds
// above it, and never reads 0.00000000065 s. One module, so the topbar, the
// timing diagram's axis and a lesson's quoted number always print the same
// value the same way.

import { fmt } from '@ee-labs/ui'

/** A time in picoseconds, as text with its unit. */
export function ps(t) {
  if (t == null || !Number.isFinite(t)) return '—'
  const sign = t < 0 ? '−' : ''
  const a = Math.abs(t)
  if (a < 1000) return `${sign}${a} ps`
  if (a < 1e6) return `${sign}${trim(a / 1000)} ns`
  return `${sign}${trim(a / 1e6)} µs`
}

/** A frequency in hertz, in engineering notation. */
export const hz = (f) => (Number.isFinite(f) ? fmt(f, 'Hz', 4) : '—')

/** A duration in seconds, as years once it passes one. */
export function span(seconds) {
  if (!Number.isFinite(seconds)) return '—'
  const year = 365.25 * 24 * 3600
  if (seconds >= year) return `${sig(seconds / year)} years`
  if (seconds >= 1) return `${sig(seconds)} s`
  return fmt(seconds, 's', 3)
}

/** A count of bits as a binary word, most significant first. */
export const bits = (values) => values.join('')

/** A word of bits as the number it stands for. */
export const wordOf = (values) => values.reduce((acc, b) => acc * 2 + b, 0)

const trim = (v) => String(Number(v.toPrecision(4)))
const sig = (v) => (v >= 1e5 || v < 1e-3 ? v.toExponential(3) : String(Number(v.toPrecision(4))))
