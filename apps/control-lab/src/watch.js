import { errorLoop, simulate, stepResponse } from '@ee-labs/systems'
import { CONTROLLERS } from './systems.js'

// The loop's internal signals over time, for watching.
//
// The step view shows the OUTPUT of the loop; this computes what happens on
// the way — the error the controller actually sees, and the effort it answers
// with, split into the parts the gains name. It is Signal Lab's convolution
// scrubber translated into this domain: there you watch the kernel build each
// output sample, here you watch the error drive the controller — the
// proportional part shrinking with the gap, the integrator winding up until
// nothing is left to wind on, the derivative answering the slope.
//
// Every trace comes from a PROPER transfer function or a running integral of
// one, never from differentiating the output curve — with one honest
// exception. An ideal derivative term fed a reference STEP produces an
// impulse at t = 0 (the "derivative kick": e jumps, ė is a delta). An impulse
// has no height to plot, so the smooth part of Kd·ė is drawn and the kick is
// returned as a fact for the canvas to mark, not as a fake spike.

/**
 * The vertical range of a watch pane.
 *
 * A stable loop frames its WHOLE story once and the axis never moves — the
 * sticky-axis rule. A diverging loop cannot be framed whole: fitting the full
 * runaway crushes the early mechanism (the first cut clamped to ±4 instead,
 * and both traces simply left the picture — noticed immediately). So a
 * runaway frames what has happened UP TO THE CURSOR, quantized to a doubling
 * ladder: the axis zooms out in steps as the story runs away — which is what
 * instability looks like — and small scrub moves land on the same rung, so
 * the frame does not crawl underneath the reader.
 */
export function paneRange(arrs, { floor = 1, upTo = null, diverges = false } = {}) {
  const last = arrs[0].length - 1
  const n = diverges && upTo != null ? Math.max(2, Math.min(upTo, last)) : last
  let lo = 0
  let hi = floor
  for (const a of arrs) {
    for (let i = 0; i <= n; i++) {
      if (a[i] < lo) lo = a[i]
      if (a[i] > hi) hi = a[i]
    }
  }
  if (diverges) {
    const rung = (v) => floor * Math.pow(2, Math.max(0, Math.ceil(Math.log2(v / floor))))
    if (hi > 0) hi = rung(hi)
    if (lo < 0) lo = -rung(-lo)
  }
  const pad = (hi - lo) * 0.14 || 0.2
  return { lo: lo - pad, hi: hi + pad }
}

/** Trapezoid running integral of a sampled signal. */
const cumtrapz = (t, y) => {
  const out = new Float64Array(y.length)
  for (let i = 1; i < y.length; i++) {
    out[i] = out[i - 1] + ((y[i] + y[i - 1]) / 2) * (t[i] - t[i - 1])
  }
  return out
}

/** Central-difference derivative of a sampled signal, endpoints copied. */
const diff = (t, y) => {
  const out = new Float64Array(y.length)
  for (let i = 1; i < y.length - 1; i++) {
    out[i] = (y[i + 1] - y[i - 1]) / (t[i + 1] - t[i - 1])
  }
  out[0] = out[1] ?? 0
  out[out.length - 1] = out[out.length - 2] ?? 0
  return out
}

/** Linear interpolation of a sampled signal, as the function simulate() wants. */
const interp = (t, y) => (tv) => {
  if (tv <= t[0]) return y[0]
  const last = t.length - 1
  if (tv >= t[last]) return y[last]
  // Uniform grid, so the bracketing index is arithmetic, not a search.
  const f = (tv - t[0]) / (t[last] - t[0])
  const i = Math.min(last - 1, Math.floor(f * last))
  const w = (tv - t[i]) / (t[i + 1] - t[i])
  return y[i] + w * (y[i + 1] - y[i])
}

/**
 * All the signals of the loop answering a unit step at `stepInput`.
 *
 * Returns { t, input, y, e, u, parts, kick }:
 *   input — the step itself (r for 'ref', the shove d for 'dist')
 *   y     — the output, same curve the step view draws
 *   e     — the error r − y, simulated through S = 1/(1+L), NOT computed as
 *           r − y: two independent paths that the tests then require to agree
 *   parts — the controller's effort split by gain: [{ key, label, y }]
 *   u     — the total effort (the sum of parts, or the lead's own output)
 *   kick  — { weight } when an ideal derivative met the step edge and its
 *           impulse belongs at t = 0, or null
 */
export function watchSignals(loop, ctrlId, ctrlP, stepInput, { duration, points = 600 }) {
  const dist = stepInput === 'dist'

  // The error path: S for a reference step; for a shove at the plant input
  // the reference is zero, so e = −y and the path is −Gd.
  const S = errorLoop(loop.open)
  const eTf = dist ? { b: loop.disturbance.b.map((v) => -v), a: loop.disturbance.a } : S
  const { t, y: e } = stepResponse(eTf, { duration, points })
  const { y } = stepResponse(dist ? loop.disturbance : loop.closed, { duration, points })
  const input = Float64Array.from(t, () => 1)

  // Each part carries the RAW signal its gain acts on — e, ∫e, or ė — so the
  // canvas can draw input and answer on one strip and the gain reads as the
  // vertical stretch between them: the multiplication, visible.
  const parts = []
  let u
  let kick = null
  if (ctrlId === 'lead') {
    // Lead is a proper system of its own; its effort is one signal, not a sum.
    u = simulate(CONTROLLERS.lead.tf(ctrlP), interp(t, e), { duration, points }).y
    parts.push({ key: 'u', label: 'u = lead(e)', y: u, raw: e, rawLabel: 'the error e' })
  } else {
    const pTerm = Float64Array.from(e, (v) => ctrlP.kp * v)
    parts.push({ key: 'p', label: 'Kp·e', y: pTerm, raw: e, rawLabel: 'the error e' })
    let iTerm = null
    let dTerm = null
    if (ctrlId === 'pi' || ctrlId === 'pid') {
      const eInt = cumtrapz(t, e)
      iTerm = Float64Array.from(eInt, (v) => ctrlP.ki * v)
      parts.push({ key: 'i', label: 'Ki·∫e', y: iTerm, raw: eInt, rawLabel: '∫e — the shaded area above' })
    }
    if (ctrlId === 'pid') {
      const eDot = diff(t, e)
      dTerm = Float64Array.from(eDot, (v) => ctrlP.kd * v)
      parts.push({ key: 'd', label: 'Kd·ė', y: dTerm, raw: eDot, rawLabel: "ė — the error's slope" })
      // A reference step arrives at the derivative as a jump in e; the ideal
      // Kd·ė is then an impulse of weight Kd at t = 0. A shove at the plant
      // input does not jump e (the plant integrates first), so no kick.
      if (!dist) kick = { weight: ctrlP.kd }
    }
    u = Float64Array.from(e, (_, i) => pTerm[i] + (iTerm ? iTerm[i] : 0) + (dTerm ? dTerm[i] : 0))
  }

  return { t, input, y, e, u, parts, kick }
}
