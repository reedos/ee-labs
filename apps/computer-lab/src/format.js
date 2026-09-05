// Numbers for a reader.
//
// Every time in the engine is a whole number of the 10 fs grid the model card
// declares. A reader reads picoseconds up to a nanosecond and nanoseconds
// above it, and never reads 0.0000000005346 s. One module, so the topbar, a
// canvas label and a lesson's quoted number always print the same value the
// same way.

import { fmt } from '@ee-labs/ui'
import { psOf } from './engine/card.js'

/** A time in grid units, as text with its unit. */
export function time(units) {
  if (units == null || !Number.isFinite(units)) return '—'
  return ps(psOf(units))
}

/** A time in picoseconds, as text with its unit. */
export function ps(t) {
  if (t == null || !Number.isFinite(t)) return '—'
  const sign = t < 0 ? '−' : ''
  const a = Math.abs(t)
  if (a < 1000) return `${sign}${trim(a)} ps`
  if (a < 1e6) return `${sign}${trim(a / 1000)} ns`
  return `${sign}${trim(a / 1e6)} µs`
}

/** A frequency in hertz, in engineering notation. */
export const hz = (f) => (Number.isFinite(f) ? fmt(f, 'Hz', 4) : '—')

/** A fraction as a percentage, with the digits a rate deserves. */
export const pct = (x, digits = 2) => (Number.isFinite(x) ? `${(100 * x).toFixed(digits)} %` : '—')

/** A count of cycles, with the word. */
export const cycles = (n) => (Number.isFinite(n) ? `${trim(n)} cycle${n === 1 ? '' : 's'}` : '—')

/** A number of bytes, in the unit a cache or a page table is quoted in. */
export function bytes(n) {
  if (!Number.isFinite(n)) return '—'
  if (n >= 2 ** 20) return `${trim(n / 2 ** 20)} MB`
  if (n >= 1024) return `${trim(n / 1024)} kB`
  return `${n} B`
}

/** A 32-bit word in hexadecimal, as the machine holds it. */
export const hex = (v) => `0x${(v >>> 0).toString(16).padStart(8, '0')}`

/** A number of gate delays, which is the unit a lesson compares in. */
export const gateDelays = (n) => (Number.isFinite(n) ? `${trim(n)} gate delay${n === 1 ? '' : 's'}` : '—')

const trim = (v) => String(Number(v.toPrecision(6)))

/** A plain number with the digits a reading deserves. */
export const num = (v, digits = 3) => (Number.isFinite(v) ? String(Number(v.toFixed(digits))) : '—')
