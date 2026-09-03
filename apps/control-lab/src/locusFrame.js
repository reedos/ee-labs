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
