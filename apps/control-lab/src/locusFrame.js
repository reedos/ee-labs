import { stickyDuration } from './stepAxis.js'

// How much of the s-plane the root locus shows.
//
// The shared PoleZeroCanvas frames EVERY point it is given, and the locus
// sweeps the gain over four decades — so the far branches, heading for
// infinity, set a ±300 rad/s frame around an unstable-plant loop whose poles
// live inside ±4: the exhibit was a dot. The frame should fit what the
// reader is looking at — the open-loop poles and zeros the branches leave
// from, and the closed-loop poles at THIS gain — and let the branches run
// off the edge, which is what branches to infinity do. Quantized to the same
// 1–2–5 ladder the step axis uses, with the same hold rule, so dragging Kp
// moves the pink crosses and not the axes.

/**
 * The two axis titles, which must carry the SAME unit.
 *
 * They did not: the real axis read "(1/s)" and the imaginary axis "(rad/s)"
 * on one plane drawn at 1:1, so a reader measuring the distance from the
 * origin — which is the natural frequency ωn, and is what the damping angle
 * is read against — was combining two different units. s = σ + jω is one
 * quantity with one unit, and the unit the rest of this lab uses for it is
 * rad/s: the lead network's own pole and zero fields are in rad/s, and so is
 * the crossover the Bode readout prints beside its hertz. σ is a decay rate
 * rather than an angular frequency, which is the argument the split labels
 * were making, and it is not worth two units on one square plane.
 */
export const LOCUS_UNIT = 'rad/s'
export const LOCUS_X_TITLE = `Real  σ  (${LOCUS_UNIT})`
export const LOCUS_Y_TITLE = `Imaginary  jω  (${LOCUS_UNIT})`

/** The largest 1-2-5 step not exceeding v. */
function stepDown(v) {
  if (!(v > 0)) return 1
  const d = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [5, 2, 1]) if (m * d <= v * (1 + 1e-12)) return m * d
  return d / 2
}

/** The smallest 1-2-5 step not below v. */
function stepUp(v) {
  if (!(v > 0)) return 1
  const d = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 2, 5]) if (m * d >= v * (1 - 1e-12)) return m * d
  return 10 * d
}

/**
 * The tick step for both axes of the s-plane.
 *
 * The shared frame picks its own step from the pane's size, and on a short
 * pane that rule left the plot with no scale at all. Measured at 390x844 on
 * "Watch the poles cross": one tick on each axis, both labelled 0, on the one
 * view whose whole subject is WHERE the poles are. The height allowed two
 * divisions over a ±8 range, which rounds to a step of 10, and both 10 and
 * −10 fall outside the frame. Zero was the only label left, and an axis with
 * one number on it is an axis with none.
 *
 * So the density rule stays and gains a floor. `step` is the finer of what
 * each axis's own size asks for, and never coarser than the SHORT axis's own
 * half-range — which is what guarantees a labelled tick either side of zero
 * on the axis that has the least room. A wide pane is unaffected, because
 * the density rule is already finer there than the floor.
 *
 * One step for both axes, not two: the plane is drawn at 1:1, so a square
 * grid is the honest one.
 */
export function locusTickStep(xHalf, yHalf, areaW, areaH, k = 1) {
  const divisions = (px, per) => Math.max(2, Math.floor(px / (per * k)))
  const byWidth = stepUp((2 * xHalf) / divisions(areaW, 90))
  const byHeight = stepUp((2 * yHalf) / divisions(areaH, 46))
  const dense = Math.min(byWidth, byHeight)
  const floor = stepDown(Math.min(xHalf, yHalf))
  return Math.min(dense, floor)
}

/**
 * The half-extent the content needs: 1.35 × the farthest OPEN- or
 * CLOSED-loop POLE. A zero never sets the scale.
 *
 * The rule, stated once: a branch STARTS at an open-loop pole and the
 * closed-loop poles are where it stands at the CURRENT gain, so both belong
 * in the frame. A zero is only where a branch would END, and the sweep this
 * app draws only reaches 100x gain — a branch can sit far short of its zero
 * at the gain on screen, so letting the zero set the scale stretched the
 * axis to a point the picture never actually reaches. Three lags × PI and ×
 * PID put their integral zero past every pole in the loop, which squeezed
 * the actual pole cluster into a sliver of a mostly-empty canvas — the
 * defect this rule removes. A far zero is still drawn, just at the edge
 * (LocusCanvas), not used to size the picture.
 *
 * openZeros is still taken (not dropped from the signature) so a caller
 * reads the same three arguments LocusCanvas itself needs to draw the
 * poles, the zeros and the edge markers for the ones the frame excludes.
 */
export function locusExtent(openPoles, openZeros, closedPoles) {
  let r = 0
  for (const [re, im] of [...openPoles, ...closedPoles]) {
    const m = Math.hypot(re, im)
    if (Number.isFinite(m) && m > r) r = m
  }
  return Math.max(1e-3, 1.35 * r)
}

/** The frame to draw: the ladder value for the content, held while it still fits. */
export function stickyExtent(prev, natural) {
  return stickyDuration(prev, natural)
}
