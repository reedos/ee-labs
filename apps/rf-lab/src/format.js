import { fmt } from '@ee-labs/ui'

// Every number a reader sees in this lab comes through here.
//
// One rule, and it is the Fields Lab's. A value far below the scale of the
// reading it belongs to is the arithmetic's noise and not the circuit's. The
// reactance of a matched load comes out as 2e-15 ohms, which engineering
// notation would print as "2 femto-ohms" and a reader would take for a
// measurement. Everything this lab computes is a closed form, so four
// significant figures is the quote and there is no guard to shorten it.

const REL = 1e-9
const ABS = 1e-30

/** Whether `v` is arithmetic noise against `scale`, the largest value of its kind on screen. */
export const isNoise = (v, scale = 0) => Math.abs(v) < Math.max(REL * Math.abs(scale), ABS)

/**
 * A value with its unit in engineering notation. Noise snaps to 0, and
 * infinity is spelled.
 *
 * A quantity with no unit takes no prefix. Engineering notation printed a
 * reflection magnitude of 0.3333 as "333.3 m", which a reader takes for
 * millimetres, and the two quantities this lab prints without a unit are a
 * reflection magnitude and a standing-wave ratio. So an empty unit gets the
 * plain figure at the same number of significant figures.
 */
export function num(v, unit = '', sig = 4, scale = 0) {
  if (v === Infinity) return '∞'
  if (v === -Infinity) return '−∞'
  if (!Number.isFinite(v)) return '—'
  const value = isNoise(v, scale) ? 0 : v
  if (!unit) return Number(Number(value).toPrecision(sig)).toString()
  return fmt(value, unit, sig)
}

/** An angle in degrees, to two decimals, with its sign kept. */
export const deg = (v) => (Number.isFinite(v) ? `${v.toFixed(2)}°` : '—')

/** A ratio as a percentage, to four significant figures. */
export const pct = (v) => (Number.isFinite(v) ? `${Number(100 * v).toPrecision(4)} %` : '—')

/** A decibel figure, to four significant figures, with infinity spelled. */
export const db = (v) => (v === Infinity ? '∞ dB' : Number.isFinite(v) ? `${Number(v).toPrecision(4)} dB` : '—')

/** A dimensionless number, such as a reflection magnitude or a standing-wave ratio. */
export const plain = (v, sig = 5) => (v === Infinity ? '∞' : Number.isFinite(v) ? Number(Number(v).toPrecision(sig)).toString() : '—')

/**
 * A complex impedance as "50.00 − j8.80 Ω", which is how this lab writes one.
 *
 * Every complex number a reader sees comes through here, and the two reasons
 * are in the two lines below the scale. The sign belongs in front of the j, so
 * that a negative reactance reads as a subtraction rather than as "+ j−8.80".
 * And a part far below the scale of the pair is the arithmetic's noise: the
 * quarter wave's input impedance solves to 25 − j2.3e-15 Ω, and A3's note beside
 * it says the answer is exactly 25.000 Ω.
 */
export function rectangular(z, unit = 'Ω', sig = 4) {
  if (z === Infinity) return 'open'
  if (!Array.isArray(z)) return num(z, unit, sig)
  const scale = Math.max(Math.abs(z[0]), Math.abs(z[1]))
  const re = isNoise(z[0], scale) ? 0 : z[0]
  const im = isNoise(z[1], scale) ? 0 : z[1]
  const sign = im < 0 ? '−' : '+'
  return `${Number(re).toPrecision(sig)} ${sign} j${Number(Math.abs(im)).toPrecision(sig)}${unit ? ' ' + unit : ''}`
}

/** A complex number as "0.3333 ∠ 0.00°", which is how a reflection coefficient is read. */
export function polar(z, unit = '') {
  if (z === Infinity) return 'open'
  const [re, im] = Array.isArray(z) ? z : [z, 0]
  const m = Math.hypot(re, im)
  const a = (Math.atan2(im, re) * 180) / Math.PI
  return `${plain(m)}${unit ? ' ' + unit : ''} ∠ ${(m === 0 ? 0 : a).toFixed(2)}°`
}

/** A length in the unit a reader of this lab writes: millimetres, centimetres or metres. */
export function length(v) {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) < 1e-2) return num(v, 'm')
  if (Math.abs(v) < 1) return `${Number(100 * v).toPrecision(5)} cm`
  return `${Number(v).toPrecision(5)} m`
}

/** The largest magnitude among some readings: the scale their noise is measured against. */
export const scaleOf = (values) => Math.max(0, ...Object.values(values).filter(Number.isFinite).map(Math.abs))
