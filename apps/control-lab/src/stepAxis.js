// When the step plot's axes may move — and when they must hold still.
//
// The duration came from 12/slowest-pole and the y-range from the trace, so
// tuning Kp or tau moved the AXES while the curve sat still (Reed's report;
// Circuit Lab's frequency axis had the same disease). The first fix — hold
// until containment forces growth — failed its own probe: growth-on-contain
// TRACKS the peak, so the trace hugs the top at a constant pixel and the
// axis still chases, just monotonically.
//
// The mechanism that actually works is BAND QUANTIZATION: frames snap to a
// 1–2–5-style ladder. Inside a band the frame is bit-identical however the
// curve moves, so motion is visible; crossing a band edge reframes once,
// discretely. Axes move when they need to and only then.

const LADDER = [
  0.1, 0.15, 0.2, 0.3, 0.4, 0.6, 0.8, 1, 1.5, 2, 3, 4, 6, 8, 10, 15, 20, 30,
  40, 60, 80, 100, 150, 200, 300, 400,
]

/** The smallest ladder value ≥ v, scaled by decades outside the table. */
export function ladderUp(v) {
  if (!(v > 0)) return LADDER[0]
  let scale = 1
  let x = v
  while (x > LADDER[LADDER.length - 1]) {
    x /= 10
    scale *= 10
  }
  while (x < LADDER[0]) {
    x *= 10
    scale /= 10
  }
  for (const step of LADDER) if (step >= x - 1e-12) return step * scale
  return LADDER[LADDER.length - 1] * scale
}

/**
 * The next plot duration: the natural need (12 over the slowest pole),
 * quantized up to the ladder. Same band, same frame; the hysteresis below
 * stops a value sitting exactly on a band edge from flapping.
 */
export function stickyDuration(prev, natural, force = false) {
  const hasPrev = Number.isFinite(prev) && prev > 0
  if (!(Number.isFinite(natural) && natural > 0)) return hasPrev && !force ? prev : 20
  const cand = ladderUp(natural)
  if (force || !hasPrev) return cand
  // Hold while the need still fits the held band and is not lost in it.
  if (natural <= prev && natural > prev / 6) return prev
  return cand
}

/**
 * The next y-range: each edge quantized to the ladder (zero stays zero, and
 * an edge that pokes past zero gets its own band on its own side).
 */
export function stickyRange(prev, natural, force = false) {
  const hi = natural.hi > 0.02 ? ladderUp(natural.hi) : 0
  const lo = natural.lo < -0.02 ? -ladderUp(-natural.lo) : 0
  const cand = { lo, hi }
  if (force || !prev || !Number.isFinite(prev.lo) || !Number.isFinite(prev.hi)) return cand
  // Same bands, same frame — identically. This is what makes motion inside a
  // band bit-stable, small zero-crossing wiggles included.
  if (cand.lo === prev.lo && cand.hi === prev.hi) return prev
  const contained = natural.hi <= prev.hi + 1e-12 && natural.lo >= prev.lo - 1e-12
  const span = prev.hi - prev.lo
  const used = natural.hi - natural.lo
  // Hold a larger frame while the trace still fills it usefully.
  if (contained && span > 0 && used / span >= 0.3) return prev
  return cand
}
