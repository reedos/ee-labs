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

/**
 * A value with its unit in engineering notation. Noise snaps to 0, and
 * infinity is spelled.
 *
 * A reading with no unit takes no prefix letter. An engineering prefix on a
 * bare number puts a letter where a unit goes, so a numerical aperture of
 * 0.12461 comes out as "124.61 m" and a reader has been handed a length. A
 * unitless reading is printed in plain digits, or as a mantissa and a power of
 * ten where plain digits run out, which is the notation Group D's prose
 * already uses. A percentage takes no prefix either, for the same reason.
 */
export function num(v, unit = '', sig = 5, scale = 0) {
  if (v === Infinity) return '∞'
  if (v === -Infinity) return '−∞'
  if (!Number.isFinite(v)) return '—'
  const value = isNoise(v, scale) ? 0 : v
  if (!unit) return bare(value, sig)
  if (unit === '%') return `${Number(Number(value).toPrecision(sig))} %`
  // Past the prefix table's own ends there is no prefix to use, and forcing one
  // gives nine digits in front of a tera. A photon density of 4.9793e20 per
  // cubic metre is not "497930000 Tm⁻³": it is a mantissa and a power of ten,
  // which is how every carrier and photon density in Group D is written.
  const mag = Math.abs(value)
  if (mag >= 1e15 || (mag > 0 && mag < 1e-15)) return `${bare(value, sig)} ${unit}`
  return fmt(value, unit, sig)
}

/** The digits of a superscript exponent, so a power of ten reads as one. */
const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }

/** A unitless reading, with no prefix letter for a reader to mistake for a unit. */
export function bare(v, sig = 5) {
  if (v === 0) return '0'
  const mag = Math.abs(v)
  if (mag >= 1e-4 && mag < 1e6) return String(Number(Number(v).toPrecision(sig)))
  const e = Math.floor(Math.log10(mag))
  const mantissa = Number(Number(v / 10 ** e).toPrecision(sig))
  const power = String(e)
    .split('')
    .map((c) => SUPERSCRIPT[c])
    .join('')
  return `${mantissa} × 10${power}`
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
export const plain = (v) => (Number.isFinite(v) ? bare(v, 5) : '—')

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
