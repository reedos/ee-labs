import { fmt } from '@ee-labs/ui'

// Every number a reader sees in this lab comes through here.
//
// Two rules, and the second is this lab's own.
//
// A value far below the scale of the reading it belongs to is the arithmetic's
// noise and not the light. A photocurrent read across a large load from a large
// supply is the difference of two voltages that agree to six figures, so its
// last digits are the supply's rounding. `isNoise` snaps those to zero rather
// than printing a picoamp a reader would take for a measurement.
//
// A quantity a datasheet states in its own unit is printed in that unit and not
// converted. Attenuation is decibels a kilometre, dispersion is picoseconds per
// nanometre per kilometre, and an optical level is dBm. Engineering notation on
// any of the three produces a number nobody in the field would recognise.

const REL = 1e-9
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

/** A level in dBm, to three decimals, which is what a budget is read to. */
export const dbm = (v) => (v === -Infinity ? '−∞ dBm' : Number.isFinite(v) ? `${v.toFixed(3)} dBm` : '—')

/** A loss or a ratio in decibels, to three decimals. */
export const db = (v) => (v === Infinity ? '∞ dB' : Number.isFinite(v) ? `${v.toFixed(3)} dB` : '—')

/** An angle in degrees, to four significant figures, with its sign kept. */
export const deg = (v) => (Number.isFinite(v) ? `${Number(v).toPrecision(4)}°` : '—')

/** A ratio as a percentage, to four significant figures. */
export const pct = (v) => (Number.isFinite(v) ? `${Number(100 * v).toPrecision(4)} %` : '—')

/** A plain ratio or count, to five significant figures. */
export const plain = (v) => (Number.isFinite(v) ? String(Number(Number(v).toPrecision(5))) : '—')

/** A wavelength in nanometres, which is the only unit a fibre reader uses for one. */
export const nm = (v) => (Number.isFinite(v) ? `${Number(v * 1e9).toPrecision(5)} nm` : '—')

/** A length of fibre in kilometres, or in metres under one. */
export const span = (v) => {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) < 1000) return `${Number(v).toPrecision(4)} m`
  return `${Number(v / 1000).toPrecision(5)} km`
}

/** The largest magnitude among some readings: the scale their noise is measured against. */
export const scaleOf = (values) => Math.max(0, ...Object.values(values).filter(Number.isFinite).map(Math.abs))
