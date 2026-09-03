// "H = 1/2", not "H = 0.5": a divider's gain is a ratio of two resistors, and
// the plot's caption should say it as one when it is one.

/**
 * A short fraction for x when one with a small denominator is exact (to
 * float precision), else null. `1/2`, `3/4`, `2/3`; 0.4142 gets null.
 */
export function asFraction(x, maxDen = 12) {
  if (!Number.isFinite(x)) return null
  for (let d = 1; d <= maxDen; d++) {
    const n = Math.round(x * d)
    if (Math.abs(n / d - x) < 1e-9 * Math.max(1, Math.abs(x))) {
      return d === 1 ? String(n) : `${n}/${d}`
    }
  }
  return null
}
