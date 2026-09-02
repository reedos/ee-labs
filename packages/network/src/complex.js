// Complex numbers as [re, im] pairs — the form linalg.js's solveComplex takes.
//
// No class, no operator overloading: a handful of functions and a convention
// that the sine-reference phasor X stands for the signal x(t) = Im{X e^{jωt}},
// so a source of amp·sin(ωt + φ) has the phasor amp∠φ and the rotating arrow's
// VERTICAL projection is the waveform on the scope. Every ratio — impedance,
// transfer function, power — is the same under either reference; only the
// projection differs, and the sine reference is the one whose picture matches
// the source that was typed in.

export const C = (re, im = 0) => [re, im]
export const cadd = (x, y) => [x[0] + y[0], x[1] + y[1]]
export const csub = (x, y) => [x[0] - y[0], x[1] - y[1]]
export const cmul = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]]
export const cscale = (x, k) => [x[0] * k, x[1] * k]
export const conj = (x) => [x[0], -x[1]]
export const cabs = (x) => Math.hypot(x[0], x[1])
export const carg = (x) => Math.atan2(x[1], x[0])
export const cexpj = (theta) => [Math.cos(theta), Math.sin(theta)]
/** r∠θ. */
export const polar = (r, theta) => [r * Math.cos(theta), r * Math.sin(theta)]
export function cdiv(x, y) {
  const d = y[0] * y[0] + y[1] * y[1]
  return [(x[0] * y[0] + x[1] * y[1]) / d, (x[1] * y[0] - x[0] * y[1]) / d]
}
/** Accept a real number where a phasor is expected. */
export const asComplex = (v) => (Array.isArray(v) ? v : [Number(v), 0])
/** The instantaneous value of phasor X at time t: Im{X e^{jωt}}. */
export const instant = (X, omega, t) => X[0] * Math.sin(omega * t) + X[1] * Math.cos(omega * t)
