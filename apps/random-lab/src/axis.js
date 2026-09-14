// Tick intervals and tick labels, for axes whose range comes from the data.
//
// Two defects on the screen sent this file here, both from REVIEW_PLAYBOOK
// section 4: an axis is named, united, and sized to its content.
//
// The first is an axis with one tick. `niceStep` rounds the interval UP to the
// next round number, and the Kalman run spans about 8.6 units, which asks for
// 2.15 and gets 5. The only multiple of 5 inside the range is zero, so the
// whole y-axis read "0" and told a reader nothing about the scale. `tickStep`
// takes the widest interval on the same ladder that still puts three ticks
// inside the range, so an axis always carries a scale.
//
// The second is duplicated labels. A Rayleigh histogram runs 0 to 4.6 and ticks
// every 0.5, and two significant figures printed those as 0, 0.5, 1, 2, 2, 3,
// 3, 4, 4. `tickLabel` reads the decimals it needs from the interval, so
// neighbouring ticks never print the same string.

/** The ladder of round intervals, in the order a reader accepts them. */
const LADDER = [10, 5, 2.5, 2, 1]

/** How many ticks an axis of `size` device pixels has room for. */
export function tickTarget(size, k = 1, per = 46) {
  return Math.max(2, Math.floor(size / (per * k)))
}

/** Ticks of `step` that land inside [lo, hi], counted the way drawFrame draws them. */
export function tickCount(lo, hi, step) {
  const first = Math.ceil(lo / step - 1e-9)
  const last = Math.floor(hi / step + 1e-9)
  return Math.max(0, last - first + 1)
}

/**
 * A round tick interval for [lo, hi]: the one on the 1, 2, 2.5, 5, 10 ladder
 * nearest to `span / target`, widened or narrowed only to keep at least three
 * ticks on the axis.
 *
 * The shared `niceStep` rounds UP and then caps at the largest round number
 * that fits the range, which is how an 8.6-unit axis came to be ticked every 5
 * and to carry one label.
 */
export function tickStep(lo, hi, target = 4) {
  const span = hi - lo
  if (!(span > 0) || !Number.isFinite(span)) return 1
  const ideal = span / Math.max(1, target)
  const mag = Math.pow(10, Math.floor(Math.log10(ideal)))
  const candidates = []
  for (const scale of [100, 10, 1, 0.1, 0.01]) {
    for (const m of LADDER) candidates.push(m * mag * scale)
  }
  candidates.sort((a, b) => a - b)
  // Nearest in ratio, which is what "round number near the ideal" means on a
  // ladder that steps by factors rather than by amounts.
  let best = candidates[0]
  for (const step of candidates) {
    if (Math.abs(Math.log(step / ideal)) < Math.abs(Math.log(best / ideal))) best = step
  }
  // Then narrow, if the nearest interval leaves the axis without a scale.
  let i = candidates.indexOf(best)
  while (i > 0 && tickCount(lo, hi, candidates[i]) < 3) i -= 1
  return candidates[i]
}

/** The decimal places `step` needs to be written exactly, up to eight. */
function decimalsOf(step) {
  const s = Math.abs(step)
  if (!(s > 0) || !Number.isFinite(s)) return 0
  for (let d = 0; d <= 8; d++) {
    const scaled = s * Math.pow(10, d)
    if (Math.abs(scaled - Math.round(scaled)) <= 1e-9 * Math.max(1, scaled)) return d
  }
  return 8
}

/**
 * The label formatter for an axis ticked at `step`. Enough decimals to write
 * the tick exactly, and no more, so no label names a value its tick is not at.
 *
 * The ladder carries 2.5 as well as 1, 2 and 5, so a step of 0.25 needs two
 * decimals. Taking the decimals from the step's magnitude alone gave one, and
 * the correlation axis read 1, 0.8, 0.5, 0.3, 0, -0.3 for ticks a quarter
 * apart.
 *
 * A value that is not finite prints as an em rule rather than as "NaN".
 */
export function tickLabel(step) {
  const decimals = decimalsOf(step)
  return (v) => {
    if (!Number.isFinite(v)) return '—'
    const fixed = v.toFixed(decimals)
    if (Number(fixed) === 0) return '0'
    if (decimals === 0) return fixed
    return fixed.replace(/0+$/, '').replace(/\.$/, '')
  }
}

/**
 * Both axes of one frame at once: the intervals and the labels that go with
 * them. Pass the result straight into `drawFrame`, which then draws the ticks
 * these labels were sized for.
 */
export function frameTicks(area, xMin, xMax, yMin, yMax) {
  const xStep = tickStep(xMin, xMax, tickTarget(area.w, area.k, 90))
  const yStep = tickStep(yMin, yMax, tickTarget(area.h, area.k, 46))
  return { xStep, yStep, fmtX: tickLabel(xStep), fmtY: tickLabel(yStep) }
}
