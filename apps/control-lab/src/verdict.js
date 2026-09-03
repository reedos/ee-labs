import { polesZeros, isStable, dcGain } from '@ee-labs/systems'

// The one-word judgement the top bar prints, and the numbers that must agree
// with it.
//
// isStable() answers a yes/no question, and a pole sitting ON the imaginary
// axis is a "no" — so the crossing chip that puts the poles exactly on the
// axis was judged UNSTABLE beside a phase margin of 0.0°, a gain margin of
// 1.00× and a locus readout saying the axis had been "crossed". The student
// review filed all four from one screen. A loop on the boundary is its own
// state: a sustained oscillation that neither settles nor runs away, and
// every pane should call it that.

/** A pole this close to the axis, relative to its own scale, is on it. */
export const MARGINAL_REL = 1e-6
/** …or a gain margin this close to 1×: the loop gain sits at the boundary. */
export const MARGINAL_GM = 1e-3

/**
 * 'stable' | 'marginal' | 'unstable' for a closed loop, with the margins as a
 * second witness: a gain margin within 0.1% of 1× is the boundary too.
 */
export function verdictOf(closed, marg = null) {
  if (!closed.a.length || !closed.a.some((v) => v !== 0)) return 'unstable'
  const { poles } = polesZeros(closed)
  if (!poles.length) return isStable(closed) ? 'stable' : 'unstable'
  const scale = Math.max(...poles.map(([re, im]) => Math.hypot(re, im)), Number.MIN_VALUE)
  let onAxis = false
  let strictlyRight = false
  for (const [re, im] of poles) {
    const tol = MARGINAL_REL * Math.max(Math.abs(im), scale)
    if (Math.abs(re) <= tol) onAxis = true
    else if (re > 0) strictlyRight = true
  }
  const gmAtOne = marg && marg.gainMargin != null && Math.abs(marg.gainMargin - 1) < MARGINAL_GM
  if (onAxis || gmAtOne) return 'marginal'
  if (strictlyRight) return 'unstable'
  return isStable(closed) ? 'stable' : 'unstable'
}

/** The rad/s of the pole pair nearest the axis — the frequency a marginal loop sings at. */
export function oscillationOf(closed) {
  const { poles } = polesZeros(closed)
  let best = null
  for (const [re, im] of poles) {
    if (Math.abs(im) < 1e-12) continue
    if (!best || Math.abs(re) < Math.abs(best[0])) best = [re, im]
  }
  return best ? Math.abs(best[1]) : 0
}

/**
 * The margins as the panes should print them.
 *
 * margins() bisects |L| = 1 on a grid eight decades wide, and a loop whose
 * gain is exactly 1 at DC (a lead whose zero cancels the plant's only pole)
 * hands it a float-noise crossing at nanohertz — "crossover 8.215 nHz, phase
 * margin 180.0°". A crossover below the plotted band with |L(0)| = 1 is not
 * a crossover; it is the gain sitting at 1 forever. Printed as — with the
 * reason, the way a missing margin already is.
 */
export function presentMargins(marg, open, lowestPlotted) {
  const out = { ...marg, crossoverNote: null }
  if (marg.gainCrossover == null) {
    out.crossoverNote = 'gain never reaches 1 — no crossover to measure'
    return out
  }
  const atDc = dcGain(open)
  if (marg.gainCrossover < lowestPlotted && Number.isFinite(atDc) && Math.abs(atDc - 1) < 1e-3) {
    out.gainCrossover = null
    out.phaseMargin = null
    out.crossoverNote = 'gain is 1 at DC — no crossover to measure'
  }
  return out
}

/**
 * What the top bar's "steady error" field shows.
 *
 * e_ss = 1 − T(0): positive when the output falls short of the setpoint,
 * NEGATIVE when it sits above it (the unstable plant under P settles at
 * 1.25, so its error is −25%). A loop that never settles has no steady
 * state, and the field printed "200.0%", "1000.0%" and "−Infinity%" for
 * those before it learned to say so.
 */
export function steadyErrorOf(closed, verdict) {
  if (verdict !== 'stable') {
    return {
      text: '—',
      value: null,
      title:
        verdict === 'marginal'
          ? 'does not settle — the loop oscillates forever at this gain, so it has no steady state'
          : 'does not settle — the loop runs away, so it has no steady state',
    }
  }
  const err = 1 - dcGain(closed)
  const sign = err > 0 ? 'the output falls short of what was asked' : 'the output settles ABOVE what was asked'
  if (Math.abs(err) < 1e-9) {
    return { text: 'none', value: 0, title: 'e_ss = 1 − T(0) = 0: an integrator in the loop erases the error exactly' }
  }
  return {
    text: `${(err * 100).toFixed(1)}%`,
    value: err,
    title: `e_ss = 1 − T(0) = ${(err * 100).toFixed(1)}% of the step — ${sign}; a negative steady error means the output overshoots its destination and stays there`,
  }
}
