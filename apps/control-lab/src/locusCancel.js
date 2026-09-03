// Whether an open-loop pole and zero on the root locus are close enough to
// call a genuine cancellation — and, separately, whether two points the
// cancellation test correctly calls DIFFERENT still merge into one mark once
// this particular frame is drawn.
//
// Those are two different questions with two different right answers about
// the frame. The FIRST must never look at it: cancelEps used to be
// `extent * 0.02`, so a lead controller's own far pole (10-20 rad/s) could
// blow the frame's half-extent out to 15-30, making the tolerance 0.3-0.6 —
// wide enough that a zero dragged to 1.3 or 1.5 against a plant pole at -1
// (a 30-50% mismatch, on purpose, the point of the lesson) still drew as
// "pole and zero cancel exactly". An unrelated point on the far side of the
// plot was deciding whether two NEARBY points read as coincident. The SECOND
// question is the opposite: two data-distinct points that are not a
// cancellation can still land within a mark's own radius of each other in
// PIXELS, purely because this frame happens to be wide — and there the frame
// is exactly what should decide, because "wide frame, everything looks
// closer together" is what a wide frame IS.

/**
 * The line between "the same point" and "two nearby points" — a fraction of
 * the pair's own shared magnitude, dimensionless. A controller zero placed
 * ON a plant pole on purpose lands within a fraction of a percent of it
 * (float rounding, the smallest step a slider takes); a zero moved to make a
 * DIFFERENT point — 5% away is still visually the same mark on most plots,
 * 30% away is a different one, the two values the walk's own probe used —
 * sits well clear of 10%. Halfway between those two, in log terms, and
 * comfortably clear of both: chosen once, here, so a reader can hold it
 * against the two examples above and agree or disagree with a number instead
 * of a feeling.
 */
export const CANCEL_REL_TOL = 0.1

/** Is this pole/zero pair a genuine cancellation? Never looks at any frame. */
export function isCancelling(pole, zero) {
  // The floor only matters for a pair sitting AT the origin (both magnitudes
  // zero); it is not a frame measurement, just a guard against 0/0.
  const scale = (Math.hypot(pole[0], pole[1]) + Math.hypot(zero[0], zero[1])) / 2 || 1e-9
  return Math.hypot(pole[0] - zero[0], pole[1] - zero[1]) / scale <= CANCEL_REL_TOL
}

/**
 * Greedy pole/zero pairing for exact cancellation: each pole claims the
 * first not-yet-claimed zero within CANCEL_REL_TOL of it. Takes no frame and
 * no extent — there is nowhere in the signature for either to enter, which
 * is the actual fix; locusCancel.test.js pins the OLD failure mode (a
 * tolerance derived from the frame) by running the same pairs through two
 * very different frames and requiring the identical answer.
 */
export function findCancellations(poles, zeros) {
  const usedZero = new Set()
  const cancelling = []
  poles.forEach((p) => {
    const zi = zeros.findIndex((z, j) => !usedZero.has(j) && isCancelling(p, z))
    if (zi >= 0) {
      usedZero.add(zi)
      cancelling.push(p)
    }
  })
  return { cancelling, usedZero }
}

/**
 * Pairs left over after findCancellations that would still draw as one mark
 * on screen: a pole and a zero within `mergeDist` PIXELS of each other, in
 * whatever frame `toScreen` (data -> {x, y}) represents right now. Unlike
 * isCancelling, this ONE is meant to depend on the frame — a wide frame
 * merges pairs a tight one would not, correctly, because that is what a
 * wide frame does to everything in it.
 *
 * Excludes zeros already claimed by a cancellation (`usedZero`) and zeros
 * outside the frame's own edge (`isOffFrame`) — those already get a legible
 * treatment of their own (an edge arrow) and must not also compete here.
 */
export function findNearMerges(poles, zeros, cancelling, usedZero, toScreen, mergeDist, isOffFrame) {
  const usedZeroNear = new Set()
  const near = []
  poles.forEach((p) => {
    if (cancelling.some(([pr, pi]) => pr === p[0] && pi === p[1])) return
    const zi = zeros.findIndex((z, j) => {
      if (usedZero.has(j) || usedZeroNear.has(j) || isOffFrame(z[0], z[1])) return false
      const a = toScreen(p[0], p[1])
      const b = toScreen(z[0], z[1])
      return Math.hypot(a.x - b.x, a.y - b.y) <= mergeDist
    })
    if (zi >= 0) {
      usedZeroNear.add(zi)
      near.push([p, zeros[zi]])
    }
  })
  return { near, usedZeroNear }
}
