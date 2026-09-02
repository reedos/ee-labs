// Axis ranges that hold still while a knob moves.
//
// Auto-ranging hides the very thing a knob is being turned to show: fit the
// axis to the data every time and the curve keeps its shape and size while
// only the numbers beside it move, so the ripple you just halved looks
// identical. The frame here is anchored on a reference — the experiment at
// its defaults — and gives way only when the present signal would otherwise
// run off it, in one snapped step rather than a drift. It is what a bench
// scope does with its volts-per-division, and for the same reason.

import { niceStep } from './plot.js'

/**
 * Axis bounds snapped out to a round grid. Snapping holds the frame still
 * across small changes and lets it give way in one clean jump.
 */
export function niceBounds(lo, hi, divisions = 5) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [lo, hi]
  const step = niceStep(hi - lo, divisions)
  if (!(step > 0)) return [lo, hi]
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step]
}

/**
 * The padded extent of some traces on one waveform (`source.sig[key]` are
 * arrays of samples).
 */
export function traceExtent(source, keys) {
  let lo = Infinity
  let hi = -Infinity
  for (const key of keys)
    for (const v of source.sig[key] || []) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  if (!Number.isFinite(lo)) return [0, 1]
  if (hi - lo < 1e-12 * Math.max(1, Math.abs(hi))) {
    // A flat trace: give it a band a tenth of its value tall (or ±1 at zero) so
    // it draws as a line across the middle rather than filling the axis with
    // rounding.
    const e = hi === 0 ? 1 : Math.abs(hi) * 0.1
    lo -= e
    hi += e
  }
  // A steady level with a little ripple on it — the buck's output is 5 V and
  // 3.65 mV — fills the frame edge to edge if the axis is fitted to the ripple
  // alone, and reads as a huge oscillation. Where the excursion is a small
  // fraction of the level it sits on, give it room above and below equal to
  // itself: it takes a third of the strip, big enough to see, small enough to
  // read as the small thing it is.
  const span = hi - lo
  const level = Math.abs((hi + lo) / 2)
  const rides = level > 0 && span < 0.05 * level
  const pad = span * (rides ? 1.0 : 0.08)
  return [lo - pad, hi + pad]
}

/**
 * A scope axis: framed on the reference waveform (the experiment's defaults),
 * widened only if the present waveform will not fit inside it.
 */
export function scopeRange(wf, baseWf, keys) {
  if (!keys.length) return [0, 1]
  const [lo, hi] = traceExtent(wf, keys)
  const [bLo, bHi] = baseWf ? traceExtent(baseWf, keys) : [lo, hi]
  return niceBounds(Math.min(lo, bLo), Math.max(hi, bHi))
}

/**
 * The same idea for a curve: the range of `values` and of the reference
 * `baseValues`, together, padded a little and snapped. A declared `lo`/`hi`
 * frames the usual case (a duty runs 0–1, an efficiency 0–100 %); data outside
 * it still has to fit, so the bound gives way rather than the curve. `log`
 * ranges are in decades of the values.
 */
export function anchoredRange(values, baseValues = [], { lo: dLo = null, hi: dHi = null, log = false, floor = null } = {}) {
  const keep = (v) => Number.isFinite(v) && (!log || v > 0)
  const all = [...values.filter(keep), ...baseValues.filter(keep)]
  if (!all.length) return [0, 1]
  const dataLo = Math.min(...all)
  const dataHi = Math.max(...all)
  if (log) return [Math.log10(dataLo) - 0.15, Math.log10(dataHi) + 0.15]
  // Padding is added outward, in units of the span, so a negative axis grows
  // the way a positive one does.
  const span = Math.max(dataHi - dataLo, Math.abs(dataHi) * 0.1, 1e-12)
  let lo = Number.isFinite(dLo) && dataLo >= dLo ? dLo : dataLo - span * 0.06
  let hi = Number.isFinite(dHi) && dataHi <= dHi ? dHi : dataHi + span * 0.06
  // A reference level the curve is read against (M's unity line) stays on the chart.
  if (Number.isFinite(floor) && dataHi > 0) hi = Math.max(hi, floor)
  return niceBounds(lo, hi)
}
