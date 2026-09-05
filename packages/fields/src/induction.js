// Faraday's law and what follows from it: the transformer equation, the moving
// conductor, eddy-current loss, and the skin effect.
//
// Two of the four are exact and two are approximations with guards, and the
// split is the point of the group. The transformer equation and the motional
// emf are exact for the idealisation stated. The eddy-current sheet formula
// assumes the field is not pushed out of the sheet, so it carries the
// thickness-over-skin-depth guard. The round wire's high-frequency resistance
// assumes the current has crowded into a thin annulus, so it carries the
// radius-over-skin-depth guard, and its guard is measured against an exact
// solve of the same wire rather than against a rule of thumb.
//
// That exact solve is `wireImpedance`. The current density in a round wire
// obeys the Bessel equation J'' + J'/r + k^2 J = 0 with k^2 = -j omega mu
// sigma. The module integrates it outward from the axis in complex arithmetic
// with fourth-order Runge-Kutta, which is stable because the physical solution
// is the growing one in that direction, then forms Z = E_z(a) / I from the
// result. No Bessel function is tabulated and none is approximated.

import { MU0, positive, nonNegative } from './const.js'

const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]]
const csub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
const cscale = (a, k) => [a[0] * k, a[1] * k]
const cdiv = (a, b) => {
  const d = b[0] * b[0] + b[1] * b[1]
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]
}

/**
 * The skin depth, metres: delta = sqrt(2 / (omega mu sigma)).
 *
 * The depth at which the current density has fallen to 1/e of its surface
 * value in a conductor filling a half space. At zero frequency it is infinite,
 * and the function says so rather than dividing by zero.
 */
export function skinDepth(f, { mur = 1, sigma } = {}) {
  positive(sigma, 'sigma')
  nonNegative(f, 'f')
  if (f === 0) return Infinity
  return 1 / Math.sqrt(Math.PI * f * MU0 * mur * sigma)
}

/**
 * The surface impedance of a conducting half space, ohms per square:
 * Zs = (1 + j) / (sigma delta).
 *
 * Exact for a plane wave entering a conductor whose thickness is many skin
 * depths. The resistance and the reactance are equal, which is the fact the
 * lesson turns on, and the phase is 45 degrees at every frequency.
 */
export function surfaceImpedance(f, { mur = 1, sigma } = {}) {
  const delta = skinDepth(f, { mur, sigma })
  const r = 1 / (sigma * delta)
  return { R: r, X: r, mag: Math.SQRT2 * r, phaseDeg: 45, delta }
}

/**
 * The current density a depth z into a conducting half space, relative to its
 * surface value: J = J0 exp(-z/delta) exp(-j z/delta).
 *
 * Returns the magnitude and the phase lag in degrees. One skin depth in, the
 * magnitude is 1/e and the phase has slipped one radian.
 */
export function planarCurrent(z, f, material) {
  const delta = skinDepth(f, material)
  const u = z / delta
  return { mag: Math.exp(-u), phaseDeg: (-u * 180) / Math.PI, u, delta }
}

/**
 * The impedance per metre of a solid round wire of radius `a` at frequency `f`,
 * solved exactly.
 *
 * Returns `{ R, L, Rdc, ratio, Lint, delta, q, steps }`. `R` is the resistance
 * per metre, `L` the internal inductance per metre, `ratio` the ratio of R to
 * the direct-current value, and `q = sqrt(2) a / delta` the parameter the
 * textbooks tabulate against.
 *
 * At low frequency the ratio approaches 1 and the internal inductance
 * approaches mu / 8 pi, which is the number the coaxial line's closed form
 * adds when its `internal` option is set. Both limits are checked in
 * induction.test.js, and they are the reason this solve is trusted to guard
 * the high-frequency form below.
 */
export function wireImpedance(a, f, { mur = 1, sigma, steps } = {}) {
  positive(a, 'a')
  positive(sigma, 'sigma')
  nonNegative(f, 'f')
  const mu = MU0 * mur
  const Rdc = 1 / (sigma * Math.PI * a * a)
  const delta = skinDepth(f, { mur, sigma })
  const q = f === 0 ? 0 : (Math.SQRT2 * a) / delta
  if (f === 0) return { R: Rdc, L: mu / (8 * Math.PI), Rdc, ratio: 1, Lint: mu / (8 * Math.PI), delta, q, steps: 0 }
  const omega = 2 * Math.PI * f
  // k^2 = -j omega mu sigma.
  const k2 = [0, -omega * mu * sigma]
  // Enough steps to resolve the skin depth, and never fewer than 2000.
  const n = steps || Math.max(2000, Math.ceil((40 * a) / Math.min(delta, a)))
  const h = a / n
  // Series start, to step off the singular point at r = 0.
  const r0 = h * 1e-3
  // The state is [J, dJ/dr, I], with the current integral carried as a third
  // equation rather than accumulated beside the solve. Integrating it with the
  // same Runge-Kutta makes it fourth order too. A trapezoid rule alongside
  // would be second order, and at a hundred steps to the skin depth that put
  // five parts in a million into the answer, which is more than the ODE itself
  // carries.
  let y = [csub([1, 0], cscale(k2, (r0 * r0) / 4)), cscale(k2, -r0 / 2), [0, 0]]
  const deriv = (r, v) => [v[1], csub(cscale(v[1], -1 / r), cmul(k2, v[0])), cscale(v[0], 2 * Math.PI * r)]
  const advance = (v, k, f) => [cadd(v[0], cscale(k[0], f)), cadd(v[1], cscale(k[1], f)), cadd(v[2], cscale(k[2], f))]
  for (let s = 0; s < n; s++) {
    const r = r0 + s * h
    const k1 = deriv(r, y)
    const kk2 = deriv(r + h / 2, advance(y, k1, h / 2))
    const kk3 = deriv(r + h / 2, advance(y, kk2, h / 2))
    const kk4 = deriv(r + h, advance(y, kk3, h))
    const step = (i) => cscale(cadd(cadd(k1[i], cscale(kk2[i], 2)), cadd(cscale(kk3[i], 2), kk4[i])), h / 6)
    y = [cadd(y[0], step(0)), cadd(y[1], step(1)), cadd(y[2], step(2))]
  }
  const J = y[0]
  const I = y[2]
  // E_z at the surface is J(a) / sigma, and Z = E_z / I.
  const Z = cdiv(cscale(J, 1 / sigma), I)
  const Lint = Z[1] / omega
  return { R: Z[0], L: Lint, Rdc, ratio: Z[0] / Rdc, Lint, delta, q, steps: n, Z }
}

/**
 * The high-frequency resistance per metre of a round wire, and its guard.
 *
 * Once the current has crowded into an annulus one skin depth thick, the wire
 * behaves as a tube of that thickness:
 *
 *   R ~ 1 / (sigma 2 pi a delta)
 *
 * The guard is the ratio of the radius to the skin depth, with a threshold of
 * 3. Below it the current has not crowded and the approximation is wrong by
 * more than a few per cent, so the app shows the exact solve instead. `error`
 * is measured against `wireImpedance`, not estimated.
 */
export function wireHighFrequency(a, f, material) {
  const exact = wireImpedance(a, f, material)
  const approx = 1 / (material.sigma * 2 * Math.PI * a * exact.delta)
  const ratio = a / exact.delta
  const error = Math.abs(approx - exact.R) / exact.R
  return {
    R: approx,
    exact: exact.R,
    error,
    guard: {
      quantity: 'wire radius over skin depth',
      value: ratio,
      threshold: 3,
      ok: ratio >= 3,
      says:
        ratio >= 3
          ? `The radius is ${ratio.toPrecision(3)} skin depths, past the threshold of 3, and the tube formula is high by ${(100 * error).toPrecision(2)} per cent.`
          : `The radius is only ${ratio.toPrecision(3)} skin depths, short of the threshold of 3. The current has not crowded into a thin annulus, and the tube formula is wrong by ${(100 * error).toPrecision(2)} per cent, so the exact solve is shown instead.`,
    },
  }
}

/**
 * Eddy-current loss in a thin lamination, watts per cubic metre.
 *
 *   P = pi^2 B^2 f^2 d^2 / (6 rho)
 *
 * for a sheet of thickness d in a field B sin(omega t) parallel to its surface.
 * The derivation assumes the induced currents do not themselves push the field
 * out of the sheet, which holds while the thickness is small against the skin
 * depth. That is the guard, with a threshold of one half.
 *
 * The d-squared in the numerator is why a transformer core is laminated, and
 * `perLamination` reports the loss of a stack of the same total thickness so a
 * lesson can show the fourfold drop from halving d.
 */
export function eddyLossSheet({ thickness, Bpeak, f, rho, mur = 1 }) {
  const d = positive(thickness, 'thickness')
  const B = nonNegative(Bpeak, 'Bpeak')
  const freq = nonNegative(f, 'f')
  const r = positive(rho, 'rho')
  const P = (Math.PI * Math.PI * B * B * freq * freq * d * d) / (6 * r)
  const delta = skinDepth(freq, { mur, sigma: 1 / r })
  const ratio = d / delta
  return {
    P,
    delta,
    guard: {
      quantity: 'lamination thickness over skin depth',
      value: ratio,
      threshold: 0.5,
      ok: freq === 0 || ratio <= 0.5,
      says:
        ratio <= 0.5
          ? `The lamination is ${ratio.toPrecision(3)} skin depths thick, inside the threshold of 0.5, so the field is uniform across it.`
          : `The lamination is ${ratio.toPrecision(3)} skin depths thick, past the threshold of 0.5. The induced currents screen the interior, the field is no longer uniform across the sheet, and this formula is high.`,
    },
  }
}

/**
 * The transformer equation: the root-mean-square emf a sinusoidal flux induces.
 *
 *   E_rms = 2 pi f N Phi_peak / sqrt(2) = 4.443 f N Phi_peak
 *
 * Exact for a sinusoidal flux fully linking every turn. The familiar 4.44 is
 * 2 pi / sqrt(2) rounded, and the function returns the exact coefficient so a
 * test can pin it rather than the rounded one.
 */
export function faradayEmf({ turns, area, Bpeak, f }) {
  const N = positive(turns, 'turns')
  const A = positive(area, 'area')
  const B = nonNegative(Bpeak, 'Bpeak')
  const freq = nonNegative(f, 'f')
  const fluxPeak = B * A
  const peak = 2 * Math.PI * freq * N * fluxPeak
  return { fluxPeak, peak, rms: peak / Math.SQRT2, coefficient: (2 * Math.PI) / Math.SQRT2 }
}

/**
 * The emf a conductor of length l generates moving at speed v across a field B,
 * volts: emf = B l v when the three are mutually perpendicular.
 *
 * `angleDeg` is the angle between the velocity and the field, and the emf
 * carries its sine, so a bar moving along the field lines generates nothing.
 */
export function motionalEmf({ B, length, speed, angleDeg = 90 }) {
  const l = positive(length, 'length')
  const emf = B * l * speed * Math.sin((angleDeg * Math.PI) / 180)
  return { emf, force: (I) => B * l * I * Math.sin((angleDeg * Math.PI) / 180) }
}

/**
 * The flux through a flat loop of area A whose normal makes an angle with a
 * uniform field, and the emf when the loop turns at a steady rate.
 *
 * This is the generator: Phi = B A cos(omega t), so emf = B A omega sin(omega t)
 * and its peak is B A omega. Exact.
 */
export function rotatingLoop({ B, area, f, turns = 1 }) {
  const A = positive(area, 'area')
  const N = positive(turns, 'turns')
  const omega = 2 * Math.PI * nonNegative(f, 'f')
  const peak = N * B * A * omega
  return { omega, fluxPeak: B * A, peak, rms: peak / Math.SQRT2, at: (t) => peak * Math.sin(omega * t) }
}

/** MU0 re-exported so a caller building a material does not import two modules. */
export { MU0 }

/** A guard's message, for a caller that renders one without knowing which it has. */
export const guardText = (g) => (g && g.says) || ''
