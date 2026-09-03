// What the step pane's readout says about the drawn trace.
//
// A pure function rather than JSX, because the numbers it prints are claims:
// "overshoot 60.5%" beside "final 0" was one of them, and it was nonsense —
// overshoot is a fraction OF the final value, undefined when that value is 0
// (a band-pass, a high-pass, the tank's impedance). What a reader can use
// there is the peak the trace actually reaches, measured off the trace.

/**
 * @param {{ y: Float64Array|number[] }|null} step   the drawn trace (null: too stiff)
 * @param {number} gain   dcGain(tf) — the final value, or ±Infinity/NaN
 * @param {object|null} second   secondOrderMetrics(tf), or null for first order
 * @param {string} [unit]   'Ω' for an impedance output, '' otherwise
 */
export function stepReadout(step, gain, second, unit = '') {
  const finite = Number.isFinite(gain)
  const finalIsZero = finite && Math.abs(gain) < 1e-9
  let peak = null
  if (step && finalIsZero) {
    let m = 0
    for (let i = 0; i < step.y.length; i++) m = Math.max(m, Math.abs(step.y[i]))
    peak = m
  }
  return {
    final: finite ? gain : null,
    finalText: finite ? null : 'never settles',
    unit,
    // Only against a non-zero final value, and only when there is some.
    overshoot: !finalIsZero && second && second.overshoot > 0 ? second.overshoot : null,
    peak,
    settling: second && Number.isFinite(second.settling) ? second.settling : null,
  }
}

/**
 * Which damping word a ζ earns, judged at the three decimals the pane
 * prints: 632.46 Ω gives ζ = 1.000007, and calling that "underdamped" beside
 * a try line saying ζ = 1 was a defect. Within ±0.0005 of 1 it is critically
 * damped — the readout and the printed digits agree.
 */
export function dampingWord(zeta) {
  if (!Number.isFinite(zeta)) return ''
  if (zeta < 1 - 5e-4) return 'underdamped'
  if (zeta > 1 + 5e-4) return 'overdamped'
  return 'critically damped'
}
