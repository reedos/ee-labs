// Numbers as a reader should see them, on top of @ee-labs/ui's `fmt`.
//
// This lab holds per-unit numbers near one and ampere numbers near a thousand
// in the same pane, so the two readings are formatted differently and the
// topbar toggle decides which is on screen.

import { fmt } from '@ee-labs/ui'

/** Below a billionth of `scale`, a value is the arithmetic's own residue. */
export function nz(value, scale) {
  if (!Number.isFinite(value)) return value
  const s = Math.abs(scale)
  return s > 0 && Math.abs(value) < 1e-9 * s ? 0 : value
}

/** A per-unit number, to a fixed number of figures rather than in engineering form. */
export const pu = (v, digits = 4) => (Number.isFinite(v) ? `${nz(v, 1).toFixed(digits)} pu` : '—')

/** An angle in degrees. */
export const ang = (rad, digits = 3) => (Number.isFinite(rad) ? `${((rad * 180) / Math.PI).toFixed(digits)}°` : '—')

/** A degrees value already in degrees. */
export const degText = (d, digits = 3) => (Number.isFinite(d) ? `${d.toFixed(digits)}°` : '—')

/** A percentage. */
export const pct = (v, digits = 3) => (Number.isFinite(v) ? `${(100 * v).toFixed(digits)} %` : '—')

/** Money, which has two decimal places and a symbol in front. */
export const money = (v, digits = 2) => (Number.isFinite(v) ? `$${v.toFixed(digits)}` : '—')

/**
 * One quantity in whichever units the topbar is set to.
 * `si` is the multiplier from per unit to SI, and `unit` is the SI unit.
 */
export function both(v, { units, si = 1, unit = '', digits = 4 }) {
  if (!Number.isFinite(v)) return '—'
  return units === 'si' ? fmt(v * si, unit, 4) : `${nz(v, 1).toFixed(digits)} pu`
}

export { fmt }
