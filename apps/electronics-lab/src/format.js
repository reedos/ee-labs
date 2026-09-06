import { fmt } from '@ee-labs/ui'

// Every number a student reads in this lab comes through here.
//
// The solver works in doubles, so a sum that should be zero comes out as a few
// parts in 1e16 of its largest term — 8.7e-19 A at a node carrying 12 mA.
// Engineering notation prints that faithfully as "0.00087 fA", which is true
// and reads as a fault. A value below one part in 1e9 of the scale it belongs
// to is the arithmetic's noise, not the circuit's, and prints as 0; with no
// scale given, nothing under a femto prints either.
const REL = 1e-9
const ABS = 1e-15

/** Whether `v` is arithmetic noise against `scale` (the largest value of its kind on screen). */
export const isNoise = (v, scale = 0) => Math.abs(v) < Math.max(REL * Math.abs(scale), ABS)

/** A value with its unit in engineering notation — noise snapped to 0, ∞ and NaN spelled out. */
export function num(v, unit = '', sig = 4, scale = 0) {
  if (v === Infinity) return '∞'
  if (v === -Infinity) return '−∞'
  if (!Number.isFinite(v)) return '—'
  return fmt(isNoise(v, scale) ? 0 : v, unit, sig)
}

/** The largest magnitude among some readings: the scale their noise is measured against. */
export const scaleOf = (values) => Math.max(0, ...Object.values(values).filter(Number.isFinite).map(Math.abs))

// The math panel prints each row at four decimals and falls back to exponent
// notation outside 1e-3…1e4. A first course never reads 1.000e-4 A; it reads
// 100 µA. So before an entry reaches the panel its rows are rescaled into the
// SI prefix their leading value calls for, unit and tolerance moving with it.
const PREFIXES = [
  [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''],
  [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'],
]
const PREFIXABLE = new Set(['A', 'V', 'W', 'J', 's', 'Ω', 'Hz', 'F', 'H', 'VA', 'var', 'rad/s'])
// Rates and ratios have no prefix a student would write, so they get words:
// 20 000 per second is 20 per millisecond; a power gain of 9e8 is 898 million ×.
const PER_TIME = { '1/s': (pre) => `1/${pre}s`, '1/s²': (pre) => `1/${pre}s²` }
const TIME_DOWN = [[1e3, 'm'], [1e6, 'µ'], [1e9, 'n']]
const WORDS = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]

/** The multiplier and unit that put |v| into a range the panel prints plainly. */
export function prefixFor(v, unit) {
  if (!Number.isFinite(v) || v === 0) return [1, unit]
  const a = Math.abs(v)
  // 1591.5 Hz stays as written; the panel only turns exponential from 1e4.
  if (a >= 1 && a < 1e4) return [1, unit]
  if (PREFIXABLE.has(unit)) {
    const [m, pre] = PREFIXES.find(([m]) => a >= m) || PREFIXES[PREFIXES.length - 1]
    return [m, pre + unit]
  }
  if (PER_TIME[unit] && a >= 1e4) {
    const [m, pre] = TIME_DOWN.find(([m]) => a / m < 1e4) || TIME_DOWN[TIME_DOWN.length - 1]
    return [m, PER_TIME[unit](pre)]
  }
  if (unit === '×' && a >= 1e4) {
    const [m, word] = WORDS.find(([m]) => a >= m)
    return [m, `${word} ×`]
  }
  return [1, unit]
}

/** One theory/measured row, rescaled; a zero prediction met within its floor reads 0. */
export function readableCheck(r) {
  let { predicted, measured } = r
  // A prediction below the row's own floor is zero as far as the row can tell:
  // ½Cv² at the end of three whole cycles comes out as 2.7e-37 J from cos(6π).
  if (Number.isFinite(predicted) && Math.abs(predicted) < (r.abs || 0)) predicted = 0
  // A row that predicts zero and is met (|measured| within its own floor)
  // shows the zero it predicted: 1.4e-11 at four decimals is 0.0000, and
  // exponent notation would only dress the arithmetic's residue as a reading.
  if (predicted === 0 && Number.isFinite(measured) && Math.abs(measured) <= (r.abs || 0) && Math.abs(measured) < 5e-5) measured = 0
  const lead = Number.isFinite(predicted) && predicted !== 0 ? predicted : measured
  const [m, unit] = prefixFor(lead, r.unit)
  if (m === 1) return measured === r.measured && predicted === r.predicted ? r : { ...r, predicted, measured }
  return { ...r, predicted: predicted / m, measured: measured / m, abs: (r.abs || 0) / m, unit }
}

/** One computed value row, rescaled. */
export function readableValue(r) {
  const [m, unit] = prefixFor(r.value, r.unit)
  return m === 1 ? r : { ...r, value: r.value / m, unit }
}

/** A math entry with every table row in a readable unit. */
export function forReading(entry) {
  if (!entry || !entry.blocks) return entry
  return {
    ...entry,
    blocks: entry.blocks.map((b) => {
      if (b.kind === 'check') return { ...b, rows: b.rows.map(readableCheck) }
      if (b.kind === 'values') return { ...b, rows: b.rows.map(readableValue) }
      return b
    }),
  }
}
