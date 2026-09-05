// The transmission line: the π model, where it stops, and the exact form past
// it.
//
// A line has resistance, series inductance and shunt capacitance spread along
// its length. The nominal π model lumps the whole series impedance in the
// middle and half the shunt admittance at each end. That is one circuit made
// of elements `packages/network` already stamps, so a transmission network
// needs no new element.
//
// The lumping is an approximation, and GRID_LAB_PLAN.md §2.7 gives it the
// guard Rule 3 of CORE_SCOPE.md requires. The exact steady-state solution of a
// uniform line is the two-port
//
//     V_s = V_r cosh γl + I_r Z_c sinh γl
//     I_s = V_r sinh(γl)/Z_c + I_r cosh γl
//
// with γ = √(zy) and Z_c = √(z/y) per unit length. `exactPi` turns that into
// the same π shape by the correction factors sinh(γl)/(γl) and
// tanh(γl/2)/(γl/2), so both models are read through one interface. Below
// 250 km the two agree to better than a tenth of a percent and the nominal
// model is used. Above it `guard` says so and the exact form is used instead.
//
// The surge impedance is √(L/C), a real number for a lossless line, and the
// surge impedance loading V²/Z_c is the loading at which the line's own
// charging exactly supplies its own reactive absorption. Both are exact for
// the lossless line and are stated without a hedge.

import { cabs, cadd, ccosh, cdiv, cmul, cscale, csinh, csqrt } from './cx.js'

/** The length past which the nominal π model is replaced by the exact form. */
export const LONG_LINE_KM = 250


/**
 * A line's distributed constants at one frequency, per kilometre.
 *
 * @param r  series resistance, Ω/km
 * @param x  series reactance, Ω/km at `f`
 * @param b  shunt susceptance, S/km at `f`
 */
export function lineConstants({ r = 0.05, x = 0.4, b = 3.0e-6, f = 60 } = {}) {
  if (!(x > 0)) throw new Error('x: a line needs a positive series reactance')
  if (!(b > 0)) throw new Error('b: a line needs a positive shunt susceptance')
  const omega = 2 * Math.PI * f
  const L = x / omega
  const C = b / omega
  // The surge impedance and the phase constant are the lossless line's, which
  // is the pair every textbook quotes and the pair the reactive balance uses.
  const Zc = Math.sqrt(L / C)
  const beta = omega * Math.sqrt(L * C)
  return { r, x, b, f, omega, L, C, Zc, beta, velocity: omega / beta }
}

/** Surge impedance loading: the three-phase power at which the balance closes. */
export function surgeLoading(spec, Vbase) {
  const c = lineConstants(spec)
  return { Zc: c.Zc, sil: (Vbase * Vbase) / c.Zc, constants: c }
}

/**
 * The nominal π model of `km` kilometres, in ohms and siemens.
 * `Z` is the whole series impedance and `Y` the whole shunt admittance, so
 * each end carries `Y/2`.
 */
export function nominalPi(spec, km) {
  const c = lineConstants(spec)
  if (!(km > 0)) throw new Error('km: a line has a positive length')
  return { Z: [c.r * km, c.x * km], Y: [0, c.b * km], km, constants: c, model: 'nominal' }
}

/**
 * The exact equivalent π of the same line, from the hyperbolic two-port.
 * Every entry is the distributed solution, so the model carries no error of
 * its own and needs no guard.
 */
export function exactPi(spec, km) {
  const c = lineConstants(spec)
  const z = [c.r, c.x]
  const y = [0, c.b]
  const gamma = cscale(csqrt(cmul(z, y)), km) // γl
  const Zc = csqrt(cdiv(z, y))
  const Zprime = cmul(Zc, csinh(gamma))
  // Y'/2 = tanh(γl/2)/Z_c
  const half = cscale(gamma, 0.5)
  const Yhalf = cdiv(csinh(half), cmul(Zc, ccosh(half)))
  return { Z: Zprime, Y: cscale(Yhalf, 2), km, constants: c, gamma, Zc, model: 'exact' }
}

/**
 * The model in force at this length, with the sentence that says which.
 * Past `LONG_LINE_KM` the nominal π model is replaced rather than warned
 * about, because the exact form costs one hyperbolic evaluation.
 */
export function lineModel(spec, km) {
  const long = km > LONG_LINE_KM
  const model = long ? exactPi(spec, km) : nominalPi(spec, km)
  return {
    ...model,
    long,
    guard: long
      ? `Past ${LONG_LINE_KM} km the lumped π model errs by more than a tenth of a percent, so this line uses the exact hyperbolic form.`
      : `Below ${LONG_LINE_KM} km the lumped π model and the exact form agree to better than a tenth of a percent, so this line uses the lumped model.`,
  }
}

/**
 * The voltage rise at the open far end of a line, both ways.
 *
 * Exact, the receiving voltage is `V_s / cosh γl`, which for a lossless line
 * is `V_s / cos βl`. Through a π model the far end sees only its own shunt
 * half, so the rise is `1/(1 + ZY/2)`. C3 puts the two against each other.
 */
export function openEndRise(spec, km) {
  const c = lineConstants(spec)
  const pi = nominalPi(spec, km)
  const gamma = cscale(csqrt(cmul([c.r, c.x], [0, c.b])), km)
  const exact = 1 / cabs(ccosh(gamma))
  const lossless = 1 / Math.cos(c.beta * km)
  const nominal = 1 / cabs(cadd([1, 0], cscale(cmul(pi.Z, pi.Y), 0.5)))
  return {
    km,
    exact,
    lossless,
    nominal,
    error: (nominal - exact) / exact,
    betaL: c.beta * km,
    long: km > LONG_LINE_KM,
  }
}

/**
 * The reactive balance on a line carrying `P` at unity power factor, in per
 * unit of the surge impedance loading. Below the surge impedance loading the
 * line produces reactive power, above it the line absorbs it, and at it the
 * two cancel.
 */
export function reactiveBalance(spec, km, V, P) {
  const c = lineConstants(spec)
  const X = c.x * km
  const B = c.b * km
  const I = P / V
  const absorbed = I * I * X
  const produced = V * V * B
  return { absorbed, produced, net: absorbed - produced, sil: (V * V) / c.Zc }
}

/** The π model as a `packages/network` element list between two nodes. */
export function piElements({ Z, Y }, from, to, id = 'line') {
  const omega = 1
  const els = []
  const R = Z[0]
  const X = Z[1]
  const mid = `${id}.m`
  if (R > 0) {
    els.push({ type: 'R', id: `${id}.R`, nodes: [from, mid], value: R })
    els.push({ type: 'L', id: `${id}.L`, nodes: [mid, to], value: X / omega })
  } else {
    els.push({ type: 'L', id: `${id}.L`, nodes: [from, to], value: X / omega })
  }
  const half = Y[1] / 2
  if (half > 0) {
    els.push({ type: 'C', id: `${id}.Cf`, nodes: [from, 'gnd'], value: half / omega })
    els.push({ type: 'C', id: `${id}.Ct`, nodes: [to, 'gnd'], value: half / omega })
  }
  return els
}
