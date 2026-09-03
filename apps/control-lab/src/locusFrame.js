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

/** The half-extent the content needs: 1.35 × the farthest relevant point. */
export function locusExtent(openPoles, openZeros, closedPoles) {
  let r = 0
  for (const [re, im] of [...openPoles, ...openZeros, ...closedPoles]) {
    const m = Math.hypot(re, im)
    if (Number.isFinite(m) && m > r) r = m
  }
  return Math.max(1e-3, 1.35 * r)
}

/** The frame to draw: the ladder value for the content, held while it still fits. */
export function stickyExtent(prev, natural) {
  return stickyDuration(prev, natural)
}
