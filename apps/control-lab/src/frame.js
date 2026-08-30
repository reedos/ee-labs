/**
 * The frequency window for the sweep, sticky while parameters are tuned.
 *
 * The sweep centres on the geometric mean of the loop's poles and zeros, but
 * re-centring on every slider tick makes the axis labels crawl while the
 * reader is trying to watch the CURVE move — the fidgeting-axis defect from
 * the review playbook, the same one Signal Lab shipped and fixed. So the
 * window re-frames only when:
 *
 *   - the loop's structure changes (a different plant or controller), or
 *   - the centre has drifted to within GUARD decades of the window's edge,
 *     where features would start to fall off screen.
 *
 * Inside those bounds the previous frame is returned AS IS (same object, so
 * the caller can keep its cached frequency grid), and the curve moves against
 * a still axis.
 */

const SPAN = Math.log10(300) // half-width, decades: the window is centre ×/÷ 300
const GUARD = 1.5 // re-frame when the centre gets this close to an edge

export function nextFrame(prev, key, centre) {
  const lc = Math.log10(centre)
  if (
    prev &&
    prev.key === key &&
    Number.isFinite(lc) &&
    lc > prev.lo + GUARD &&
    lc < prev.hi - GUARD
  ) {
    return prev
  }
  return { key, lo: lc - SPAN, hi: lc + SPAN }
}
