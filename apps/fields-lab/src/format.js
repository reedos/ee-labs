import { fmt } from '@ee-labs/ui'
import { figuresOf } from '@ee-labs/fields'

// Every number a reader sees in this lab comes through here.
//
// Two rules, and the second is this lab's own.
//
// A value far below the scale of the reading it belongs to is the arithmetic's
// noise and not the field's. The flux through a contour that encloses nothing
// comes out as 1e-27 coulombs per metre, which engineering notation would print
// as "1 ronto-coulomb" and a reader would take for a measurement.
//
// A number a GRID produced is quoted to the figures its guard allows and no
// more. `gridNum` takes the convergence report and rounds to three figures when
// the guard is met and two when it is not, so a caption cannot over-claim by
// formatting. A number a closed form produced has no such limit and is quoted
// to four figures, because a closed form is exact.

const REL = 1e-9
const ABS = 1e-30

/** Whether `v` is arithmetic noise against `scale`, the largest value of its kind on screen. */
export const isNoise = (v, scale = 0) => Math.abs(v) < Math.max(REL * Math.abs(scale), ABS)

/** A value with its unit in engineering notation. Noise snaps to 0, and infinity is spelled. */
export function num(v, unit = '', sig = 4, scale = 0) {
  if (v === Infinity) return '∞'
  if (v === -Infinity) return '−∞'
  if (!Number.isFinite(v)) return '—'
  return fmt(isNoise(v, scale) ? 0 : v, unit, sig)
}

/**
 * A number the grid produced, quoted to the figures its guard allows.
 *
 * This is the only way a grid answer reaches the screen. Passing a report is
 * not optional, because a grid answer without its guard is a number with no
 * warrant behind it.
 */
export function gridNum(report, value, unit = '') {
  if (!report) return num(value, unit)
  return num(value, unit, figuresOf(report))
}

/** An angle in degrees, to one decimal, with its sign kept. */
export const deg = (v) => (Number.isFinite(v) ? `${v.toFixed(1)}°` : '—')

/** A ratio as a percentage, to three significant figures. */
export const pct = (v) => (Number.isFinite(v) ? `${Number(100 * v).toPrecision(3)} %` : '—')

/** A decibel figure, to one decimal. */
export const db = (v) => (v === Infinity ? '∞ dB' : Number.isFinite(v) ? `${v.toFixed(1)} dB` : '—')

/** A complex impedance as "50.0 Ω ∠ −8.8°". */
export function impedance(z) {
  if (z === Infinity) return '∞'
  if (!Array.isArray(z)) return num(z, 'Ω')
  const m = Math.hypot(z[0], z[1])
  const a = (Math.atan2(z[1], z[0]) * 180) / Math.PI
  return `${num(m, 'Ω')} ∠ ${a.toFixed(1)}°`
}

/** A complex impedance as "50.0 − j8.8 Ω", for a reader who wants the parts. */
export function rectangular(z) {
  if (z === Infinity) return '∞'
  if (!Array.isArray(z)) return num(z, 'Ω')
  const sign = z[1] < 0 ? '−' : '+'
  return `${num(z[0], '')} ${sign} j${num(Math.abs(z[1]), '')} Ω`
}

/** The largest magnitude among some readings: the scale their noise is measured against. */
export const scaleOf = (values) => Math.max(0, ...Object.values(values).filter(Number.isFinite).map(Math.abs))

/** Metres in the unit a reader of this lab writes: millimetres under a centimetre, metres above. */
export function length(v) {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) < 1e-2) return num(v, 'm')
  return `${Number(v).toPrecision(4)} m`
}
