import { stepResponse } from '@ee-labs/systems'

// How long the step plot should be — measured off the response, not guessed
// from a pole.
//
// The window used to be 12 over the slowest closed-loop pole. That is three
// times the 2% settling time of a plain first-order mode, and far more than
// that whenever the slow pole carries little of the response (a PI zero
// sitting next to it): the student review found the whole rise in the left
// fifth of a 150 s axis, and an overshoot readout that under-read its own
// peak because 900 samples were spread over 40 s of flat line. So the window
// is now sized from the settling time the trace actually shows, and a
// runaway is cut where the growth is already plain to see rather than run
// out to a solid green wall.

/** The band a response must stay inside to count as settled: ±2% of where it ends. */
export const SETTLE_BAND = 0.02
/** The window is this many settling times long, so the settle sits about 60% across. */
export const SETTLE_FILL = 1.6
/**
 * A diverging window ends where |y| first passes this many times the unit
 * step. 2.5 rather than 4: on the three-lag lesson's own "Kp → 12 (diverges)"
 * chip the poles sit at +0.047 ± 3.83j, the first peak is 1.77, and |y| only
 * reaches 4 after 17.6 cycles — a wall of green. 2.5 is one growth past the
 * first peak and arrives at 9.5 cycles, where the envelope is visibly
 * doubling (measured in stepWindow.test.js).
 */
export const RUNAWAY_LIMIT = 2.5

/**
 * The 2% settling time of a sampled step: the moment the trace enters the
 * band around `final` and stays there. Null when it has not settled by the
 * last sample — the readout says so instead of printing a number.
 *
 * The band is relative to the destination, or to the peak when the
 * destination is zero (a disturbance erased by an integrator).
 */
export function settleTime(t, y, final) {
  if (!y.length || !Number.isFinite(final)) return null
  let peak = 0
  for (let i = 0; i < y.length; i++) peak = Math.max(peak, Math.abs(y[i]))
  const size = Math.abs(final) > 1e-12 ? Math.abs(final) : peak
  if (!(size > 0)) return 0
  const band = SETTLE_BAND * size
  if (Math.abs(y[y.length - 1] - final) > band) return null
  let i = y.length - 1
  while (i > 0 && Math.abs(y[i] - final) <= band) i--
  // y[i] is the last sample outside the band; the entry is the next one.
  return i === y.length - 1 ? t[i] : t[i + 1]
}

/** Round up to two significant figures: 15.63 → 16, 2.78 → 2.8. */
export function ceil2(v) {
  if (!(v > 0)) return v
  const m = Math.pow(10, Math.floor(Math.log10(v)) - 1)
  return Math.ceil(v / m - 1e-9) * m
}

/**
 * The window a step plot wants, before the sticky ladder.
 *
 *   settling  1.6 × the measured 2% settling time; falls back to the pole
 *             guess (12 over the slowest pole, capped) when the trace has not
 *             settled inside it — the readout then flags "not there yet".
 *   marginal  a sustained oscillation is framed as eight cycles of it.
 *   runaway   cut where |y| first passes RUNAWAY_LIMIT, so the growth fills
 *             the pane instead of a clipped block.
 *
 * `canSim(duration)` is the affordability rule: the coarse sim is skipped
 * when the guess itself would be too stiff, and the guess stands.
 */
export function naturalWindow(tf, { verdict, slow, grow, osc, cap = 400 }, canSim = () => true) {
  const guess = Number.isFinite(slow) && slow > 0 ? Math.min(12 / slow, cap) : 20
  if (verdict === 'marginal' && osc > 0) return (8 * 2 * Math.PI) / osc
  if (verdict === 'unstable' && grow > 0) {
    const reach = Math.min(25 / grow, cap)
    if (!canSim(reach)) return reach
    const { t, y } = stepResponse(tf, { duration: reach, points: 600 })
    for (let i = 0; i < y.length; i++) {
      if (Math.abs(y[i]) > RUNAWAY_LIMIT) return ceil2(Math.max(t[i], reach / 200))
    }
    return reach
  }
  if (!canSim(guess)) return guess
  const { t, y } = stepResponse(tf, { duration: guess, points: 600 })
  let final = 0
  for (let i = y.length - 20; i < y.length; i++) final += y[i] / 20
  const ts = settleTime(t, y, final)
  return ts == null || !(ts > 0) ? guess : SETTLE_FILL * ts
}

/** Oscillation cycles a sampled trace shows: sign changes about its mean, halved. */
export function cyclesIn(y) {
  if (y.length < 3) return 0
  let mean = 0
  for (let i = 0; i < y.length; i++) mean += y[i] / y.length
  let flips = 0
  let prev = Math.sign(y[0] - mean)
  for (let i = 1; i < y.length; i++) {
    const s = Math.sign(y[i] - mean)
    if (s !== 0 && prev !== 0 && s !== prev) flips++
    if (s !== 0) prev = s
  }
  return flips / 2
}
