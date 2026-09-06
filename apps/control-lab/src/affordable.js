import { isUndefinedTf, UNDEFINED_PLANT_REASON } from './systems.js'

// The reasons a time simulation is declined, shared by the step and watch
// panes and by the window sizing that runs a coarse simulation of its own.
//
// Affordability: RK4 sub-steps scale as duration × the fastest closed pole,
// and the two ends of that product are set independently — a slow pole
// stretches the window while a fast one shrinks the sub-step, and
// slider-interior values reached 6.4 s per keystroke (extremes: hours).
// Degeneracy: a custom plant with an all-zero denominator is not a system,
// and simulating it painted NaN strips. The frequency panes are exact
// regardless; only the time simulations need declining, with the reason.
// isUndefinedTf/UNDEFINED_PLANT_REASON (systems.js) are the one place that
// reason is decided — buildLoop refuses the SAME way before this ever runs,
// so this check and the badge/math/Nyquist/locus panes can never disagree
// about what counts as undefined.

export const STEP_BUDGET = 2.5e6

export function simCost(poles, duration, points = 900) {
  const fastest = Math.max(0, ...poles.map(([re, im]) => Math.hypot(re, im)))
  return (duration * fastest) / 0.08 + points
}

/** Null when the simulation can run; otherwise the sentence the pane shows instead. */
export function simBlockReason(open, poles, duration, points = 900) {
  if (isUndefinedTf(open)) {
    return UNDEFINED_PLANT_REASON
  }
  if (simCost(poles, duration, points) > STEP_BUDGET) {
    return (
      'Too stiff to simulate: this loop mixes a pole fast enough to set the integration ' +
      'step with one slow enough to set the window, and the product is millions of steps ' +
      'per frame. The frequency views above are exact regardless — they need no integration.'
    )
  }
  return null
}
