// Whole numbers, for the quantities that are counts.
//
// Runs, symbols, errors, bins, lags and sample indices are counts. A count has
// no significant figures to choose, so `fmtNum(v, 0)` is the wrong tool for it.
// `Number.prototype.toPrecision` accepts 1 to 100 and throws a RangeError on 0,
// and every call that asked for zero digits took the whole app down with it.
//
// `fmtInt` is the formatter counts use. `Closed` in components/panes.jsx reads
// `sig = 0` as a request for it, which is what the call sites already meant.

/** A count, rounded to a whole number. Non-finite values print as an em rule. */
export function fmtInt(v) {
  if (!Number.isFinite(v)) return '—'
  return String(Math.round(v))
}
