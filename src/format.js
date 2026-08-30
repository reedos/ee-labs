import { eng } from './units.js'

/**
 * 1200 -> "1.2k", 224e9 -> "224G", 1.792e12 -> "1.792T".
 *
 * Full engineering prefixes rather than kilo only: this tool runs to terahertz,
 * and dividing by a thousand exactly once produced labels like "1760000000k".
 */
export function fmtHz(v) {
  const { num, prefix } = eng(v)
  return `${num}${prefix}`
}

/** Signed decibels, for block summaries. */
export function fmtDb(v) {
  return `${v > 0 ? '+' : ''}${Number(v.toFixed(1))} dB`
}
