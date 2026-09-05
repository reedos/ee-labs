// What the step pane's readout says about the drawn trace.
//
// A pure function rather than JSX, because the numbers it prints are claims:
// "overshoot 60.5%" beside "final 0" was one of them, and it was nonsense —
// overshoot is a fraction OF the final value, undefined when that value is 0
// (a band-pass, a high-pass, the tank's impedance). What a reader can use
// there is the peak the trace actually reaches, measured off the trace.
//
// "Settles ... to within 2%" has the same disease: second.settling is
// 4/(ζωₙ), the time to stay inside ±2% of the FINAL value, which is not a
// number at all when that value is 0 — "settles in 800 µs to within 2%" of
// zero was still printing. There the trace decays toward 0 from its own
// peak instead, so diesAway measures, off the drawn trace, how long it
// takes to fall within 2% of THAT peak and stay there.

/**
 * @param {{ y: Float64Array|number[], t: Float64Array|number[] }|null} step   the drawn trace (null: too stiff)
 * @param {number} gain   dcGain(tf) — the final value, or ±Infinity/NaN
 * @param {object|null} second   secondOrderMetrics(tf), or null for first order
 * @param {string} [unit]   'Ω' for an impedance output, '' otherwise
 * @param {{b:number[],a:number[]}|null} [tf]   the transfer function, for h(0)
 */
export function stepReadout(step, gain, second, unit = '', tf = null) {
  const finite = Number.isFinite(gain)
  const finalIsZero = finite && Math.abs(gain) < 1e-9
  let peak = null
  if (step && finalIsZero) {
    let m = 0
    for (let i = 0; i < step.y.length; i++) m = Math.max(m, Math.abs(step.y[i]))
    peak = m
  }
  // The last moment the trace was still outside ±2% of its own peak — read
  // straight off the samples, not from a formula that assumes a nonzero
  // final value.
  let diesAway = null
  if (finalIsZero && step && peak > 0) {
    const band = 0.02 * peak
    let last = 0
    for (let i = 0; i < step.y.length; i++) if (Math.abs(step.y[i]) > band) last = i
    diesAway = step.t[last]
  }
  return {
    final: finite ? gain : null,
    finalText: finite ? null : 'never settles',
    unit,
    // Only against a non-zero final value, and only when it clears 0.05% —
    // below that (the 632 Ω near-critical build's 1e-36) it prints as
    // "overshoot 0.0%", a number too small to have been worth measuring.
    overshoot: !finalIsZero && second && second.overshoot > 5e-4 ? second.overshoot : null,
    peak,
    settling: !finalIsZero && second && Number.isFinite(second.settling) ? second.settling : null,
    diesAway,
    slope0: initialSlope(tf),
  }
}

/** Coefficients with the leading zeros dropped, so the degree is the degree. */
function trimLeading(c) {
  const out = Array.from(c || [])
  while (out.length > 1 && out[0] === 0) out.shift()
  return out
}

/**
 * h(0⁺), which is the drawn step's slope at t = 0.
 *
 * The impulse response is the step response's derivative, so the number the
 * "impulse response" lesson asks a reader to check — 1/τ = 10 000 s⁻¹ for a
 * 100 µs RC — is a slope they can see on the trace in front of them. It was
 * claimed in the note and printed nowhere.
 *
 * It is a finite, non-trivial number only when the denominator's degree
 * exceeds the numerator's by exactly one, where h(0⁺) = lim s·H(s) = b₀/a₀:
 *
 * - excess 0 (a divider, a high-pass): the output jumps at t = 0. h carries a
 *   delta there and the drawn curve has no slope to compare it with.
 * - excess ≥ 2 (Sallen–Key, the RLC across C): h(0⁺) is 0. True, and it says
 *   nothing about the curve.
 *
 * Both are declined by returning null rather than printed as a number that
 * does not mean what the row's label says.
 */
export function initialSlope(tf) {
  if (!tf || !tf.b || !tf.a) return null
  const b = trimLeading(tf.b)
  const a = trimLeading(tf.a)
  if (!b.length || !a.length || !a[0]) return null
  if (a.length - b.length !== 1) return null
  return b[0] / a[0]
}

/**
 * The step pane's y-axis title.
 *
 * The axis said "Output" and nothing else, while the readout under it said
 * "peak 308 Ω" — the tank's step response is an impedance, and its axis ran
 * 200 / 0 / −200 with no unit at all. Every other axis in the lab names its
 * unit, so this one does too, in the same unit the readout prints.
 */
export function stepYTitle(unit = '') {
  return unit ? `Output (${unit})` : 'Output (V/V)'
}

/**
 * Which damping word a ζ earns. 632.46 Ω (the try line's own value) gives
 * ζ = 1.000007; the natural rounding a student types, 632 Ω, gives ζ =
 * 0.9992797 — a second defect the three-decimal band (±0.0005) still missed,
 * reading "underdamped" beside a pane that had just said ζ = 1 for the
 * unrounded value. The band is now |ζ − 1| < 0.005: wide enough that any R
 * a person would actually type for "the critical value" lands the same word,
 * narrow enough that 600 Ω (ζ ≈ 0.949, a genuinely different circuit) still
 * reads underdamped.
 */
export function dampingWord(zeta) {
  if (!Number.isFinite(zeta)) return ''
  if (zeta < 1 - 5e-3) return 'underdamped'
  if (zeta > 1 + 5e-3) return 'overdamped'
  return 'critically damped'
}
