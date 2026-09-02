// Forward simulation, period by period, from any state — the converter as
// an oscilloscope sees it switched on: on for DT, off until the diode blocks
// or the period ends, dead for the rest, and again.
//
// The steady-state solver finds a fixed point of the period map
// algebraically, and every other test starts from the solver's own answer.
// A fixed point found wrong — an orbit the bisection settled on that the
// circuit never visits — is invisible to all of them. Walking from rest and
// arriving at the same state is the one check that can see it, so this
// walker knows nothing of the answer.
//
// Two exact paths meet here on purpose. The on interval and a full off
// interval step by the solver's own propagator (the augmented-matrix
// exponential, cached once per walk since their durations never change).
// The diode's blocking instant is searched with the two-state closed form
// instead — e^{At} by cosh/cos and sinh/sin, φ₁ by A⁻¹(e^{At} − I), which the
// off topology always allows (its A couples L to C and is never singular).
// The search evaluates the state fifty times a period, and the closed form
// costs a few transcendentals where the series costs a 4×4 exponential; the
// two are held to agree in expm.test.js.

import { propagator01, expm2Closed } from './expm.js'
import { matVec, vecAdd } from './linalg.js'

/** x(t) on a segment ẋ = A x + f, by the closed form, A invertible. */
function closedForm(A, f) {
  const [[a, b], [c, d]] = A
  const det = a * d - b * c
  if (!(Math.abs(det) > 0)) throw new Error('closedForm: singular A')
  const Ai = [
    [d / det, -b / det],
    [-c / det, a / det],
  ]
  // A⁻¹ f once; then x(t) = E x0 + (E − I) A⁻¹ f.
  const g = matVec(Ai, f)
  return (x0, t) => {
    const E = expm2Closed(A, t)
    const y = [x0[0] + g[0], x0[1] + g[1]]
    const Ey = matVec(E, y)
    return [Ey[0] - g[0], Ey[1] - g[1]]
  }
}

// First instant in (0, T] at which x[0] falls through zero under `at`, or
// null: a scan for the bracket, bisection to close it.
function crossing(at, x0, T, { scan = 48, tol = 1e-13 } = {}) {
  const dt = T / scan
  let prev = x0[0]
  for (let k = 1; k <= scan; k++) {
    const t = k === scan ? T : k * dt
    const cur = at(x0, t)[0]
    if (prev >= 0 && cur < 0) {
      let lo = (k - 1) * dt
      let hi = t
      const target = tol * T
      while (hi - lo > target) {
        const mid = (lo + hi) / 2
        if (at(x0, mid)[0] < 0) hi = mid
        else lo = mid
      }
      return (lo + hi) / 2
    }
    prev = cur
  }
  return null
}

/**
 * Run up to `periods` switching periods from x0, returning the state at the
 * end of the last one. With `settle` > 0 the walk stops early once the state
 * at the start of a period has moved by less than `settle` of its own scale
 * over each of two consecutive periods — the circuit has arrived.
 */
export function runPeriods(conv, x0 = [0, 0], { periods = 1, settle = 0 } = {}) {
  const { T, states } = conv
  const tOn = conv.p.D * T
  const tOff = T - tOn
  const Pon = propagator01(states.on.A, tOn)
  const onDrive = matVec(Pon.phi1, states.on.f)
  const Poff = propagator01(states.off.A, tOff)
  const offDrive = matVec(Poff.phi1, states.off.f)
  const offAt = conv.hasDead ? closedForm(states.off.A, states.off.f) : null
  // The dead interval has no drive; its A is diagonal with the inductor row
  // zero, and e^{At} handles that without an inverse.
  const deadAt = (x, t) => matVec(expm2Closed(states.dead.A, t), x)

  let x = x0
  let n = 0
  let mode = 'CCM'
  let td = tOff
  let scaleI = 0
  let scaleV = 0
  let quiet = 0
  while (n < periods) {
    const start = x
    x = vecAdd(matVec(Pon.phi0, x), onDrive)
    scaleI = Math.max(scaleI, Math.abs(x[0]))
    scaleV = Math.max(scaleV, Math.abs(x[1]))
    // The diode blocks the instant the current would reverse — at once if
    // the switch handed it a negative current, part-way through the off
    // interval otherwise — and the capacitor alone carries the load until
    // the next period. A synchronous switch has no dead interval.
    const cross = !conv.hasDead ? null : x[0] < 0 ? 0 : crossing(offAt, x, tOff)
    if (cross === null) {
      x = vecAdd(matVec(Poff.phi0, x), offDrive)
      mode = 'CCM'
      td = tOff
    } else {
      const xd = cross === 0 ? x : offAt(x, cross)
      x = deadAt([0, xd[1]], tOff - cross)
      mode = 'DCM'
      td = cross
    }
    // Scale is taken at both switching instants: a buck-boost whose RC is
    // far shorter than the on interval has a capacitor nearly empty at
    // turn-off yet full at turn-on.
    scaleI = Math.max(scaleI, Math.abs(x[0]))
    scaleV = Math.max(scaleV, Math.abs(x[1]))
    n++
    if (settle > 0) {
      const di = Math.abs(x[0] - start[0])
      const dv = Math.abs(x[1] - start[1])
      quiet = di <= settle * scaleI && dv <= settle * scaleV ? quiet + 1 : 0
      if (quiet >= 2) break
    }
  }
  return { x, periods: n, mode, td, scale: [scaleI, scaleV] }
}
