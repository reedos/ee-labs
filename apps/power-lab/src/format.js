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

// The anchored axis ranges — niceBounds, traceExtent, scopeRange — grew up
// here and now live in @ee-labs/ui (anchor.js) for every lab's scope; they are
// re-exported so this lab's callers and tests keep their import.
export { niceBounds, traceExtent, scopeRange, anchoredRange } from '@ee-labs/ui'
