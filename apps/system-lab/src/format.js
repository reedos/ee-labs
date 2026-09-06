import { fmt } from '@ee-labs/ui'

// Every number a reader sees in this lab comes through here.
//
// One rule, and it is the RF Lab's. A value far below the scale of the reading
// it belongs to is the arithmetic's noise and not the chain's. A share that
// comes out as 4e-17 would print as "40 atto per cent" and a reader would take
// it for a measurement. Everything this lab computes is a sum or a ratio in
// decibels, so four or five significant figures is the quote.

const REL = 1e-12
const ABS = 1e-30

/** Whether `v` is arithmetic noise against `scale`, the largest value of its kind on screen. */
export const isNoise = (v, scale = 0) => Math.abs(v) < Math.max(REL * Math.abs(scale), ABS)

/** A value with its unit in engineering notation. Noise snaps to 0, and infinity is spelled. */
export function num(v, unit = '', sig = 5, scale = 0) {
  if (v === Infinity) return '∞'
  if (v === -Infinity) return '−∞'
  if (!Number.isFinite(v)) return '—'
  return fmt(isNoise(v, scale) ? 0 : v, unit, sig)
}

/** A figure in decibels, to five significant figures, with infinity spelled. */
export const db = (v) => (v === Infinity ? '∞ dB' : Number.isFinite(v) ? `${Number(v).toPrecision(5)} dB` : '—')

/** A level in dBm, to five significant figures. An infinite input IP3 is what a passive block has. */
export const dbm = (v) => (v === Infinity ? '∞ dBm' : Number.isFinite(v) ? `${Number(v).toPrecision(5)} dBm` : '—')

/** A DC power in milliwatts, or the word for a block that does not state one. */
export const mw = (v) => (v === null ? 'unknown' : Number.isFinite(v) ? `${Number(v).toPrecision(4)} mW` : '—')

/** A share as a percentage, to four significant figures. */
export const pct = (v) => (Number.isFinite(v) ? `${Number(100 * v).toPrecision(4)} %` : '—')

/** A dimensionless ratio, such as the gain written as a power ratio. */
export const plain = (v, sig = 5) => (v === Infinity ? '∞' : Number.isFinite(v) ? Number(Number(v).toPrecision(sig)).toString() : '—')

/** A bandwidth, which is always printed beside a floor because a floor without one means nothing. */
export const bandwidth = (v) => num(v, 'Hz', 4)

/** A temperature in kelvin, to four significant figures. */
export const kelvin = (v) => (Number.isFinite(v) ? `${Number(v).toPrecision(4)} K` : '—')
