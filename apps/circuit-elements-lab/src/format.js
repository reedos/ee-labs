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

// Rates whose DENOMINATOR takes the SI prefix instead of the numerator.
//
// 20000 V/s is arithmetically "20 kV/s", the way `fmt` prefixes any number.
// But this lab's circuits run in µs, and a large prefix on the numerator
// buries that: a reader has to hold "20 k" against a "per second" denominator
// while the cursor and time constant right beside it read in µs. The fix
// scales the TIME UNIT instead — s, ms, µs, ns — so the numerator prints
// plain: 20 V/ms, -100 ms⁻¹. Only three unit spellings opt in: 's⁻¹', 'V/s'
// and 'A/s'. 'rad/s' deliberately does not: krad/s is the natural frequency
// every textbook already writes, because rad/s is itself a named unit, not a
// quantity-per-time split the way V/s is.
const TIME_DENOMS = [
  { mult: 1, pre: '' },
  { mult: 1e-3, pre: 'm' },
  { mult: 1e-6, pre: 'µ' },
  { mult: 1e-9, pre: 'n' },
]
const RATE_UNITS = new Set(['s⁻¹', 'V/s', 'A/s'])

/** Rewrite the time part of a rate unit: 'V/s' -> 'V/ms', 's⁻¹' -> 'ms⁻¹'. */
const withTimePrefix = (unit, pre) => (unit === 's⁻¹' ? `${pre}s⁻¹` : unit.replace('/s', `/${pre}s`))

/**
 * The time unit (s, ms, µs, ns, in that order) that lands `magnitude` in
 * [1, 1000) once scaled — the window `fmt` already prints with no prefix.
 * Returns null when none does: a rate too slow for even the second itself to
 * read under 1 only gets slower with a smaller time unit, so nothing helps.
 */
function pickTimeStep(magnitude, sig) {
  for (const step of TIME_DENOMS) {
    const mag = Math.abs(Number((magnitude * step.mult).toPrecision(sig)))
    if (mag >= 1 && mag < 1000) return step
  }
  return null
}

/**
 * Scale a per-time rate ('s⁻¹', 'V/s' or 'A/s') so its time unit, not its
 * numerator, carries the SI prefix. Returns `{ value, unit }` rescaled, or
 * null when the unit does not opt in, or when the rate is slow enough that no
 * time unit down to ns brings it into [1, 1000) — the fallback case, where
 * prefixing the numerator (0.01 V/s -> 10 mV/s) is still the right call.
 */
export function rateScale(value, unit, sig = 4) {
  if (!RATE_UNITS.has(unit) || !Number.isFinite(value) || value === 0) return null
  const step = pickTimeStep(Math.abs(value), sig)
  return step ? { value: value * step.mult, unit: withTimePrefix(unit, step.pre) } : null
}

/**
 * A rate ('s⁻¹', 'V/s' or 'A/s'), formatted with its time unit scaled when
 * that reads better and falling back to `fmt`'s ordinary numerator prefix
 * otherwise — the one entry point every rate reading in this lab goes
 * through, the rate counterpart to `num`.
 */
export function rate(v, unit = '', sig = 4, scale = 0) {
  if (v === Infinity) return '∞'
  if (v === -Infinity) return '−∞'
  if (!Number.isFinite(v)) return '—'
  const vv = isNoise(v, scale) ? 0 : v
  const r = rateScale(vv, unit, sig)
  return r ? fmt(r.value, r.unit, sig) : fmt(vv, unit, sig)
}

// A bare number at `sig` significant figures, with no SI prefix of its own —
// `fmt` cannot be reused here, because it would pick a fresh prefix for
// whichever of a root's two parts came out small once already scaled by the
// shared step below, gluing a second, unrelated prefix onto a number that is
// meant to carry none.
const plainNum = (v, sig) => String(Number(v.toPrecision(sig)))

/**
 * A root, real or complex, formatted in 's⁻¹' with one shared time-unit
 * prefix for both parts — a conjugate pair must read as one unit, not two
 * different prefixes glued to the same j. The shared scale is chosen from
 * whichever part is larger, so a real part much smaller than ω_d does not
 * force a prefix too coarse for its own digits (or the reverse).
 */
export function rootRate(re, im, sig = 4) {
  const step = pickTimeStep(Math.max(Math.abs(re), Math.abs(im)), sig) || { mult: 1, pre: '' }
  const unit = withTimePrefix('s⁻¹', step.pre)
  const reStr = plainNum(re * step.mult, sig)
  if (!im) return `${reStr} ${unit}`
  const imStr = plainNum(Math.abs(im) * step.mult, sig)
  return `${reStr} ${im > 0 ? '+' : '−'} j${imStr} ${unit}`
}

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
  // 'V/s' and 'A/s' rows (math.js's slope A/RC among them) go through the
  // same denominator-scaling as the state pane's rate() calls, ahead of the
  // generic checks below, so the same 20000 V/s reads "20 V/ms" wherever it
  // is shown rather than sitting unscaled here up to 1e4.
  const r = rateScale(v, unit)
  if (r) return [v / r.value, r.unit]
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
