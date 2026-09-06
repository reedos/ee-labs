import { fmtNum } from '@ee-labs/ui'

// The top bar's four readings, and the rule this lab adds to the house style.
//
// **An approximation is never on screen without its guard beside it.** The top
// bar is where that rule is kept, because it is the one pane on screen in every
// experiment. `guardOf` returns the guard for whichever mode is loaded, with
// its threshold, its measured value and its verdict, and returns null only
// where the view has no approximation in it at all.
//
// A pane that shows an emulated controller shows `approximate`. A pane that
// shows a predicted limit-cycle amplitude shows the harmonic ratio and the
// measured amplitude beside it. A pane that shows a fit shows its residual.
// None of those is optional, and none of them is computed here: this file only
// says how to read the numbers `analysis.js` already produced.

/** The stability verdict, as a word and the class that colours it. */
export function verdictBadge(word) {
  if (word === 'unstable') return { word: 'unstable', tone: 'bad' }
  if (word === 'marginal') return { word: 'marginal', tone: 'warn' }
  return { word: 'stable', tone: 'good' }
}

/** Phase and gain margin, or the reason there is none to quote. */
export function presentMargins(marg) {
  const out = {}
  out.phase =
    marg.phaseMargin == null
      ? { text: 'no crossover', note: 'The gain never passes 1, so there is no frequency at which to read a phase margin.' }
      : { text: `${fmtNum(marg.phaseMargin, 3)}°`, note: null }
  out.gain =
    marg.gainMargin == null || !Number.isFinite(marg.gainMargin)
      ? { text: 'none', note: 'The phase never reaches −180°, so no amount of extra gain brings this loop to the edge.' }
      : { text: `${fmtNum(marg.gainMargin, 3)}×`, note: null }
  return out
}

/**
 * The guard that applies to the view on screen, or null where none does.
 *
 * Three guards, one per approximation the lab ships. Each carries the measured
 * quantity, the threshold it is judged against, and whether it holds. The
 * `reason` is the engine's own text wherever the engine has one, so the words
 * a reader sees are the words a test pinned.
 */
export function guardOf(a) {
  if (a.sampled && a.sampled.controllerZ?.approximate) {
    const g = a.sampled.guard
    return {
      kind: 'samples',
      label: 'Samples a cycle at crossover',
      value: g.samplesPerCycle == null ? null : fmtNum(g.samplesPerCycle, 3),
      threshold: `${g.threshold}`,
      holds: g.holds,
      approximate: true,
      reason: g.reason,
      // Always a sentence. A loop with no crossover has no rate to judge, and
      // saying so is more use than an empty line where a number should be.
      beside:
        g.phaseLagDeg == null
          ? 'The loop has no gain crossover, so there is no frequency at which to judge the rate.'
          : `The hold alone costs ${fmtNum(g.phaseLagDeg, 3)}° at crossover.`,
    }
  }
  if (a.nonlinear?.predicted) {
    const p = a.nonlinear.predicted
    const m = a.nonlinear.measured
    const e = a.nonlinear.error
    return {
      kind: 'harmonic',
      label: 'Third harmonic returning',
      value: `${fmtNum(100 * p.harmonicRatio, 3)} %`,
      threshold: `${fmtNum(100 * p.threshold, 3)} %`,
      holds: p.holds,
      approximate: true,
      reason: p.reason,
      // The rule, in one line. The predicted amplitude never appears without
      // the measured one and the difference between them.
      beside:
        p.predicted && m
          ? `Predicted ${fmtNum(p.amplitude, 4)}, measured ${fmtNum(m.amplitude, 4)}, off by ${fmtNum(100 * Math.abs(e.amplitude), 3)} %.`
          : null,
    }
  }
  if (a.fit) {
    const f = a.fit.first
    return {
      kind: 'residual',
      label: 'Residual of the first-order fit',
      value: `${fmtNum(100 * f.relResidual, 3)} %`,
      threshold: null,
      holds: true,
      approximate: true,
      reason: null,
      beside: `The second order leaves ${fmtNum(100 * a.fit.second.relResidual, 3)} %.`,
    }
  }
  if (a.state_?.lqr) {
    // Not an approximation, an iteration. The residual says whether the
    // iteration converged, and a gain whose residual is not small is not the
    // optimal gain.
    return {
      kind: 'riccati',
      label: 'Riccati residual',
      value: a.state_.lqr.relResidual.toExponential(1),
      threshold: '1e-8',
      holds: a.state_.lqr.relResidual < 1e-8,
      approximate: false,
      reason: null,
      beside: null,
    }
  }
  return null
}

/**
 * What the top bar reads, for one analysis. One object, so the pane and the
 * test read the same words.
 */
export function topbar(a) {
  const discrete = !!a.sampled
  const verdict = discrete ? a.sampled.zVerdict : a.verdict
  return {
    verdict: verdictBadge(verdict),
    where: discrete ? 'inside the unit circle' : 'in the left half plane',
    margins: presentMargins(a.margins),
    guard: guardOf(a),
  }
}
