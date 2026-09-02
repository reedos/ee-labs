// Numbers as a reader should see them.
//
// The engine's integrals come back with the last bits of floating point still
// in them: an inductor's average voltage over a period is zero, and the exact
// arithmetic lands on 6.8e-16 V. `fmt` is honest about that and prints
// "0.6776 fV", which reads as a measurement when it is rounding dust — and it
// pushes a real zero ("0 V", every other row) next to a fake non-zero.
//
// The fix is a *relative* epsilon: dust is only dust next to the scale of the
// thing being measured. An absolute cutoff is the bug this suite has already
// found once in another lab — it works on the numbers you tried it on and
// silently mislabels a circuit run a million times smaller.

import { fmt, niceStep } from '@ee-labs/ui'

/** Below a billionth of `scale`, a value is the arithmetic's residue: report 0. */
export function nz(value, scale) {
  if (!Number.isFinite(value)) return value
  const s = Math.abs(scale)
  return s > 0 && Math.abs(value) < 1e-9 * s ? 0 : value
}

/** `fmt`, with dust relative to `scale` snapped to zero first. */
export function fmtz(value, unit, sig, scale) {
  return fmt(nz(value, scale), unit, sig)
}

/** The scale a signal's own statistics live on. */
export function statScale(s) {
  return Math.max(Math.abs(s.max), Math.abs(s.min), Math.abs(s.avg), s.pp)
}

/**
 * A tick formatter with enough significant figures to tell the ticks apart.
 *
 * The output ripple is 3.65 mV on a 5 V average, so its axis runs 4.998 to
 * 5.002 — and at three significant figures every tick on it reads "5 V". The
 * axis is correct and says nothing. Digits needed is set by how far apart the
 * ticks are relative to how large the numbers are: about five ticks fit, so a
 * step of (hi − lo)/5 has to survive rounding.
 */
export function axisFmt(lo, hi, unit, { ticks = 5, min = 3, max = 7 } = {}) {
  const span = Math.abs(hi - lo)
  const big = Math.max(Math.abs(lo), Math.abs(hi))
  let sig = min
  if (span > 0 && big > 0) {
    sig = Math.ceil(Math.log10(big / (span / ticks))) + 1
    sig = Math.min(max, Math.max(min, sig))
  }
  return (v) => fmt(nz(v, big), unit, sig)
}

/**
 * Room on the left for the tick labels this axis actually needs.
 *
 * The shared frame reserves a fixed gutter, sized for labels like "5 V". An
 * axis zoomed onto a ripple carries "−18.974 V", which runs back over the
 * rotated axis title. Measure the widest label and push the frame right by
 * whatever it overflows by — the plot loses a few pixels, the reader loses
 * nothing.
 */
export function fitLeftAxis(ctx, area, labels, k = 1) {
  ctx.save()
  ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
  const widest = Math.max(0, ...labels.map((t) => ctx.measureText(String(t)).width))
  ctx.restore()
  // 30k clears the title, 8k is the gap the frame leaves between label and axis.
  const need = 30 * k + widest + 8 * k
  const extra = Math.max(0, need - area.x)
  return extra > 0 ? { ...area, x: area.x + extra, w: Math.max(1, area.w - extra) } : area
}

/**
 * Axis bounds snapped out to a round grid.
 *
 * Auto-ranging hides the very thing a knob is being turned to show: fit the
 * axis to the data every time and the curve keeps its shape and size while
 * only the numbers beside it move, so the ripple you just halved looks
 * identical. Snapping the bounds to a round step holds the frame still across
 * small changes — the curve shrinks inside it, visibly — and gives way in one
 * clean jump when the signal outgrows it. It is what a bench scope does with
 * its volts-per-division, and for the same reason.
 */
export function niceBounds(lo, hi, divisions = 5) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [lo, hi]
  const step = niceStep(hi - lo, divisions)
  if (!(step > 0)) return [lo, hi]
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step]
}

/** The padded extent of some traces on one waveform. */
export function traceExtent(source, keys) {
  let lo = Infinity
  let hi = -Infinity
  for (const key of keys) for (const v of source.sig[key] || []) {
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
  // fraction of the level it sits on, give it plenty of room: the wiggle keeps
  // its shape and the eye sees it for the small thing it is.
  const span = hi - lo
  const level = Math.abs((hi + lo) / 2)
  const rides = level > 0 && span < 0.05 * level
  const pad = span * (rides ? 1.8 : 0.08)
  return [lo - pad, hi + pad]
}

/**
 * A scope axis: framed on the experiment's defaults, widened only if the
 * present setting will not fit inside it.
 *
 * Fitting the axis to the current data every time is what makes a knob look
 * like it does nothing — halve the ripple and the curve is redrawn the same
 * size with different numbers beside it, which is the failure the older labs
 * had. Anchoring the frame to the defaults means the curve is what changes:
 * it flattens as the capacitor grows, and the frame gives way only when the
 * signal would otherwise run off it, in one snapped step rather than a drift.
 */
export function scopeRange(wf, baseWf, keys) {
  if (!keys.length) return [0, 1]
  const [lo, hi] = traceExtent(wf, keys)
  const [bLo, bHi] = baseWf ? traceExtent(baseWf, keys) : [lo, hi]
  return niceBounds(Math.min(lo, bLo), Math.max(hi, bHi))
}
