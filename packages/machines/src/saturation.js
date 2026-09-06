// Magnetic saturation, as a labelled toggle.
//
// Iron holds only so much flux. Past the knee, more current buys almost no
// more flux, the incremental inductance collapses, and the current that a
// linear model said would be 10 A is 60 A. That is a real effect and a machine
// is designed around it.
//
// It is also a curve, and CORE_SCOPE.md is clear about curves. There is no
// exact law here to admit. What this file offers is two named MODELS of the
// curve, and every result it produces carries the model's name. The toggle is
// off by default, and when it is off the machine is linear and every number in
// the package is exact. When it is on, the app says which curve it is using
// and that a curve is what it is. Power Lab's Group D takes the same stance.
//
//   'linear'    no saturation. The default, and the only exact setting.
//   'knee'      piecewise-linear. L is L₀ below the knee flux and L₀/`hard`
//               above it. Exact inside each piece, and the piece boundary is
//               an event the network engine can place, which is why this is
//               the model the app uses.
//   'atan'      λ = λ_sat·(2/π)·atan(π L₀ i / (2 λ_sat)). Smooth, matches a
//               measured curve better, and has no piecewise-exact solution.
//               Offered for the plot and refused for a transient.

export const SATURATION_MODELS = {
  linear: { name: 'no saturation', exact: true, transient: true },
  knee: { name: 'piecewise-linear knee', exact: false, transient: true },
  atan: { name: 'arctangent curve', exact: false, transient: false },
}

/** Defaults for the magnetising branch of the lab's transformer. */
export const SATURATION_DEFAULTS = {
  model: 'linear',
  L0: 8, // unsaturated inductance, H
  lambdaSat: 1.2, // knee flux linkage, Wb
  hard: 20, // how much smaller L is past the knee, 'knee' model only
}

export function saturationOf(spec = {}) {
  const m = { ...SATURATION_DEFAULTS, ...spec }
  if (!SATURATION_MODELS[m.model]) throw new Error(`unknown saturation model "${m.model}"`)
  if (!(m.L0 > 0)) throw new Error('L0: an inductance must be positive')
  if (!(m.lambdaSat > 0)) throw new Error('lambdaSat: a knee flux must be positive')
  if (!(m.hard >= 1)) throw new Error('hard: the saturated inductance cannot be larger than the unsaturated one')
  return m
}

/**
 * Flux linkage and incremental inductance at a current, in the chosen model.
 * `exact` is false for every model but 'linear', and stays in the result so a
 * caller cannot lose it.
 */
export function saturate(spec = {}, i) {
  const m = saturationOf(spec)
  const iKnee = m.lambdaSat / m.L0
  if (m.model === 'linear') return { lambda: m.L0 * i, L: m.L0, model: m.model, exact: true, saturated: false }
  if (m.model === 'knee') {
    const s = Math.sign(i) || 1
    const a = Math.abs(i)
    const over = a > iKnee
    const lambda = s * (over ? m.lambdaSat + ((a - iKnee) * m.L0) / m.hard : m.L0 * a)
    return { lambda, L: over ? m.L0 / m.hard : m.L0, model: m.model, exact: false, saturated: over, iKnee }
  }
  const k = (Math.PI * m.L0) / (2 * m.lambdaSat)
  const lambda = ((2 * m.lambdaSat) / Math.PI) * Math.atan(k * i)
  return { lambda, L: m.L0 / (1 + (k * i) ** 2), model: m.model, exact: false, saturated: Math.abs(i) > iKnee, iKnee }
}

/** The sentence the app prints whenever a saturation model is anything but linear. */
export function saturationLabel(spec = {}) {
  const m = saturationOf(spec)
  const info = SATURATION_MODELS[m.model]
  if (m.model === 'linear') return 'Linear magnetics. Every number on this screen is exact for the circuit as drawn.'
  return `Saturation model: ${info.name}. The knee is at ${m.lambdaSat} Wb. A curve is a model of iron, not a law, so the numbers below describe this model and not a particular core.`
}
