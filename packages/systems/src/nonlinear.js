// The piecewise-linear nonlinearities, and the ones this package declines.
//
// ── ADMISSION (Rule 1 of /CORE_SCOPE.md) ──
//
// A nonlinearity is not a transfer function and never becomes one. What is
// admitted here is a nonlinearity made of straight segments, because a system
// that is linear inside each segment has an exact solution inside each segment,
// and the only thing left to compute is when it leaves. That is the same
// argument the switched-converter engine makes, and it is why `phase.js` can
// call its trajectories exact.
//
// A smooth nonlinearity has no segments. Its trajectory has no closed form to
// step between events, so integrating it means choosing a step size and
// carrying an error that depends on it. This package declines that (see
// SMOOTH_DECLINED below) rather than shipping a fixed-step integrator whose
// answer no test can pin.

/** Thrown where a nonlinearity is asked for something this package declines. */
export class NonlinearError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'NonlinearError'
    this.code = code
  }
}

/** The reason a smooth nonlinearity is not integrated in time here. */
export const SMOOTH_DECLINED =
  'A smooth nonlinearity has no straight segments, so there is no interval on which the state equation has a closed-form solution. ' +
  'Stepping through it means choosing a step size, and the answer then depends on that choice. ' +
  'This package integrates piecewise-linear nonlinearities exactly and declines the smooth ones. ' +
  'The available kinds are saturation and deadzone.'

/** The reason an ideal relay is not integrated in time here. */
export const RELAY_DECLINED =
  'An ideal relay jumps between two levels with no segment in between. ' +
  'A trajectory that reaches its switching surface can slide along it, switching at every instant, so the event count is not finite. ' +
  'The available kinds are saturation and deadzone, and a relay with a finite slope is a saturation with a small limit.'

/**
 * The kinds this package integrates exactly.
 *
 * Each is odd, memoryless and made of three straight segments, and each is
 * given by the breakpoint `delta` and the slope of its outer segments.
 *
 *   saturation  slope 1 inside +/- delta, flat outside. The actuator that runs
 *               out of travel, and the one every describing-function lesson
 *               starts from.
 *   deadzone    flat inside +/- delta, slope 1 outside, offset so it is
 *               continuous. Static friction, a valve that does not open, the
 *               quantiser's first step.
 */
export const PWL_KINDS = ['saturation', 'deadzone']

/** The value of a piecewise-linear nonlinearity at u. */
export function pwlValue(kind, u, delta) {
  if (kind === 'saturation') return Math.max(-delta, Math.min(delta, u))
  if (kind === 'deadzone') return u > delta ? u - delta : u < -delta ? u + delta : 0
  if (kind === 'relay') throw new NonlinearError(RELAY_DECLINED, 'relay-declined')
  throw new NonlinearError(SMOOTH_DECLINED, 'smooth-declined')
}

/**
 * The three regions, as the slope and offset of v = slope * u + offset in each.
 *
 * Region -1 is below the lower breakpoint, 0 is the middle, +1 above the upper.
 * The integrator in `phase.js` reads exactly this, so the physics of a kind is
 * stated once.
 */
export function pwlRegions(kind, delta) {
  if (kind === 'saturation') {
    return {
      breakpoints: [-delta, delta],
      segments: {
        '-1': { slope: 0, offset: -delta },
        0: { slope: 1, offset: 0 },
        1: { slope: 0, offset: delta },
      },
    }
  }
  if (kind === 'deadzone') {
    return {
      breakpoints: [-delta, delta],
      segments: {
        '-1': { slope: 1, offset: delta },
        0: { slope: 0, offset: 0 },
        1: { slope: 1, offset: -delta },
      },
    }
  }
  if (kind === 'relay') throw new NonlinearError(RELAY_DECLINED, 'relay-declined')
  throw new NonlinearError(SMOOTH_DECLINED, 'smooth-declined')
}

/** Which region a value of u is in: -1, 0 or 1. */
export function pwlRegionOf(u, delta) {
  if (u > delta) return 1
  if (u < -delta) return -1
  return 0
}
