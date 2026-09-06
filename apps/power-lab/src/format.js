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

/** How many multiples of `step` fall inside [lo, hi]. */
export const ticksIn = (lo, hi, step) =>
  step > 0 ? Math.floor(hi / step + 1e-9) - Math.ceil(lo / step - 1e-9) + 1 : 0

/**
 * A tick step that puts at least `min` labelled ticks inside [lo, hi].
 *
 * `drawFrame` asks `niceStep` for a step, sized from how much room the plot
 * has, and `niceStep` rounds UP to 1, 2 or 5 times a power of ten. On a short
 * frame the step it returns can be as large as the range itself, and the axis
 * comes out with one label or none. The scope splits its height between two
 * strips, so each strip asked for two divisions and forty of them across the
 * lab ended up with fewer than three ticks: G4's output ran 4.63 to 4.69 V and
 * said "4.65 V" and nothing else, and D1's flux ran ±400 mT and said "0 T". An
 * axis with one tick has a quantity and a unit and no scale.
 *
 * So ask for more divisions until at least `min` ticks land inside the range.
 * The step stays a round number, because it is still `niceStep`'s.
 */
export function tickStep(lo, hi, room, k = 1, { min = 3, spacing = 46 } = {}) {
  const span = Math.abs(hi - lo)
  if (!(span > 0)) return null
  const fits = Math.max(2, Math.floor(room / (spacing * k)))
  for (let target = fits; target <= 24; target++) {
    const step = niceStep(span, target)
    if (ticksIn(lo, hi, step) >= min) return step
  }
  return span / min
}

/**
 * The same rule for an axis plotted in decades, where the step is in decades
 * too. A whole decade is the right step over two or more of them. F4 sweeps
 * its carrier from 300 Hz to 8 kHz, which is 1.43 decades and holds exactly
 * one whole one, so its axis carried the single label "1 kHz". Half a decade
 * puts 320 Hz, 1 kHz and 3.2 kHz on it instead.
 */
export function logTickStep(lo, hi, min = 3) {
  for (const step of [1, 0.5, 0.25, 0.2, 0.1]) if (ticksIn(lo, hi, step) >= min) return step
  return Math.abs(hi - lo) / min
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
