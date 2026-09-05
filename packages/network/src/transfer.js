// Exact transfer functions from a linear netlist.
//
// `sweepAC` gives H at a list of frequencies, which draws a Bode plot and
// nothing else. Feedback, compensation and the hand-over to Control Lab need
// H(s) as two polynomials: poles as numbers, margins as numbers, a step
// response with an overshoot that can be measured rather than eyeballed.
//
// The route is the one the Elements plan already built half of. dynamics.js
// turns the netlist into (A, B) exactly, by the substitution theorem; the same
// resistive solve gives (C, D) for whatever output is asked for; and
// Faddeev–LeVerrier converts the state space into two polynomials without ever
// computing an eigenvalue:
//
//   det(sI − A) = s^n + c₁s^{n−1} + … + c_n            (charPoly, already here)
//   adj(sI − A) = Σ_k s^{n−1−k} M_k,  M₀ = I, M_k = A M_{k−1} + c_k I
//   H(s) = [C adj(sI − A) B + D det(sI − A)] / det(sI − A)
//
// The result is exactly rational, which is the currency `@ee-labs/systems`
// trades in, so it crosses the boundary with no hedge (CORE_SCOPE's
// counter-rule).
//
// The risk is conditioning, not correctness. A two-stage op-amp is six states
// with a gain of 10⁵, and the recurrence is known to lose digits there. So the
// polynomials are checked against `solveAC` at 241 points before they are
// returned, and a set that fails the check is refused with the reason rather
// than shipped.

import { NetworkError, normalize } from './netlist.js'
import { dynamics } from './dynamics.js'
import { charPoly, eye, matAdd, matMul, matScale, matVecMul } from './expm.js'
import { solveAC } from './phasor.js'
import { cabs, cdiv, csub } from './complex.js'

/** The number of sweep points the conditioning check uses, and the band it uses them over. */
export const CHECK_POINTS = 241
export const CHECK_BAND = [1, 1e9]
export const CHECK_TOL = 1e-9

/**
 * Read one quantity off a resistive solution. `output` is a node name, or
 * `{ across: [a, b] }` for a difference, or `{ through: id }` for a current.
 */
export function readOutput(sol, output) {
  if (typeof output === 'string') return sol.v[output]
  if (output.across) return sol.v[output.across[0]] - sol.v[output.across[1]]
  if (output.through) return sol.i[output.through]
  throw new NetworkError('value', 'An output is a node name, { across: [a, b] } or { through: id }')
}

/** The same quantity off a phasor solution, as [re, im]. */
export function readOutputAC(ac, output) {
  if (typeof output === 'string') return ac.v[output]
  if (output.across) return csub(ac.v[output.across[0]], ac.v[output.across[1]])
  if (output.through) return ac.i[output.through]
  throw new NetworkError('value', 'An output is a node name, { across: [a, b] } or { through: id }')
}

/**
 * H(s) from `input` (the id of a V or I source) to `output`, as polynomials in
 * the form `@ee-labs/systems` takes: highest power first, a[0] = 1.
 *
 * `check` is the largest relative disagreement between the polynomials and
 * `solveAC` over the band. Pass `{ check: false }` to skip the sweep where the
 * caller has already done it.
 */
export function transferOf(net, { input, output, check = true, points = CHECK_POINTS, band = CHECK_BAND, tol = CHECK_TOL } = {}) {
  const norm = net.nodeNames ? net : normalize(net)
  const dyn = dynamics(norm)
  const j = dyn.inputs.indexOf(input)
  if (j < 0) throw new NetworkError('value', `${input} is not an independent source in this circuit`)
  const n = dyn.n
  const zeroX = new Array(n).fill(0)
  const zeroU = new Array(dyn.m).fill(0)
  const ex = (len, k) => {
    const v = new Array(len).fill(0)
    v[k] = 1
    return v
  }
  // (C, D) are read off the same resistive solve (A, B) were, one column at a
  // time, with the affine part of a conducting diode subtracted out exactly as
  // dynamics.js subtracts it.
  const y0 = readOutput(dyn.solveAt(zeroX, zeroU), output)
  const C = []
  for (let k = 0; k < n; k++) C.push(readOutput(dyn.solveAt(ex(n, k), zeroU), output) - y0)
  const D = readOutput(dyn.solveAt(zeroX, ex(dyn.m, j)), output) - y0
  const B = dyn.B.map((row) => row[j])

  let b
  let a
  if (n === 0) {
    a = [1]
    b = [D]
  } else {
    a = charPoly(dyn.A)
    // Faddeev–LeVerrier for the adjugate, one matrix per power of s.
    let M = eye(n)
    const num = new Array(n).fill(0)
    for (let k = 0; k < n; k++) {
      const MB = matVecMul(M, B)
      num[k] = C.reduce((s, c, i) => s + c * MB[i], 0)
      M = matAdd(matMul(dyn.A, M), matScale(eye(n), a[k + 1]))
    }
    // b(s) = C adj(sI − A) B + D det(sI − A), both written to degree n.
    b = [0, ...num].map((v, i) => v + D * a[i])
  }
  const tf = { b: trim(b), a, states: dyn.states.map((s) => s.id), input, output, n }
  if (!check) return { ...tf, check: null }
  const worst = compare(norm, tf, { input, output, points, band })
  if (!(worst <= tol))
    throw new NetworkError(
      'transfer-conditioning',
      `The polynomials of this transfer function disagree with the phasor solve by ${worst.toPrecision(3)} at its worst, past the ${tol} the recurrence is trusted to. ${n} states with this spread of magnitudes lose digits in Faddeev–LeVerrier. Read the response from sweepAC, or scale the circuit so its states are nearer each other in size.`,
      { check: worst, states: tf.states },
    )
  return { ...tf, check: worst }
}

/** Drop leading zeros, so a numerator of lower degree says so. */
function trim(b) {
  let k = 0
  const scale = Math.max(...b.map((v) => Math.abs(v)), 0)
  while (k < b.length - 1 && Math.abs(b[k]) <= 1e-14 * scale) k++
  return b.slice(k)
}

/** H(s) at a complex s, by Horner on both polynomials. */
export function evalTF(tf, s) {
  const poly = (c) => c.reduce((acc, k) => [acc[0] * s[0] - acc[1] * s[1] + k, acc[0] * s[1] + acc[1] * s[0]], [0, 0])
  return cdiv(poly(tf.b), poly(tf.a))
}

/**
 * The largest relative disagreement between the polynomials and the phasor
 * solve, over a log grid. This is invariant 3, and it runs before the
 * polynomials are handed to anyone.
 */
export function compare(net, tf, { input, output, points = CHECK_POINTS, band = CHECK_BAND } = {}) {
  const norm = net.nodeNames ? net : normalize(net)
  const sources = {}
  for (const e of norm.elements) if (e.type === 'V' || e.type === 'I') sources[e.id] = e.id === input ? [1, 0] : [0, 0]
  let worst = 0
  let scale = 0
  const got = []
  for (let k = 0; k < points; k++) {
    const w = band[0] * Math.pow(band[1] / band[0], k / (points - 1))
    const h = readOutputAC(solveAC(norm, w, { sources }), output)
    got.push([w, h])
    scale = Math.max(scale, cabs(h))
  }
  for (const [w, h] of got) {
    const want = evalTF(tf, [0, w])
    worst = Math.max(worst, cabs(csub(want, h)) / Math.max(cabs(h), 1e-12 * scale))
  }
  return worst
}

/** The poles and zeros of a transfer function, in hertz, largest first is not assumed. */
export function polesOf(tf) {
  return rootsOf(tf.a).map((r) => ({ re: r[0], im: r[1], hz: Math.hypot(r[0], r[1]) / (2 * Math.PI) }))
}
export function zerosOf(tf) {
  return rootsOf(tf.b).map((r) => ({ re: r[0], im: r[1], hz: Math.hypot(r[0], r[1]) / (2 * Math.PI) }))
}

/**
 * The roots of a real polynomial, by Durand–Kerner.
 *
 * An amplifier's poles run from ten hertz to a gigahertz, so the variable is
 * scaled before the iteration starts: with s = Rz and R the geometric mean of
 * the root magnitudes, the roots of the scaled polynomial sit around the unit
 * circle where the iteration is well behaved, and are multiplied back after.
 * Roots at the origin are counted off first, since the iteration has nothing
 * to divide by there.
 */
export function rootsOf(coeffs) {
  const c = coeffs.slice()
  while (c.length > 1 && c[0] === 0) c.shift()
  let atOrigin = 0
  while (c.length > 1 && c[c.length - 1] === 0) {
    c.pop()
    atOrigin++
  }
  const out = Array.from({ length: atOrigin }, () => [0, 0])
  const n = c.length - 1
  if (n < 1) return out
  const a = c.map((v) => v / c[0])
  const R = Math.abs(a[n]) > 0 ? Math.abs(a[n]) ** (1 / n) : 1
  const q = a.map((v, k) => v / R ** k)
  const evalQ = (z) => q.reduce((acc, k) => [acc[0] * z[0] - acc[1] * z[1] + k, acc[0] * z[1] + acc[1] * z[0]], [0, 0])
  let roots = Array.from({ length: n }, (_, k) => {
    const th = (2 * Math.PI * k) / n + 0.4
    return [Math.cos(th), Math.sin(th)]
  })
  for (let it = 0; it < 800; it++) {
    let move = 0
    for (let i = 0; i < n; i++) {
      let den = [1, 0]
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const d = csub(roots[i], roots[j])
        den = [den[0] * d[0] - den[1] * d[1], den[0] * d[1] + den[1] * d[0]]
      }
      if (cabs(den) === 0) continue
      const step = cdiv(evalQ(roots[i]), den)
      roots[i] = csub(roots[i], step)
      move = Math.max(move, cabs(step))
    }
    if (move < 1e-15) break
  }
  return [...roots.map(([re, im]) => [re * R, im * R]), ...out]
}

/** The −3 dB corners of a response: the frequencies where |H| falls to 1/√2 of its band value. */
export function corners(tf, { lo = 1e-3, hi = 1e12, at = null } = {}) {
  const mag = (w) => cabs(evalTF(tf, [0, w]))
  const mid = at != null ? at : Math.sqrt(lo * hi)
  const peak = mag(mid)
  const target = peak / Math.SQRT2
  const find = (from, dir) => {
    let a = from
    let b = from
    for (let k = 0; k < 400; k++) {
      b = a * (dir > 0 ? 1.05 : 1 / 1.05)
      if (b > hi || b < lo) return null
      if (mag(b) < target) break
      a = b
    }
    if (mag(b) >= target) return null
    for (let k = 0; k < 200; k++) {
      const m = Math.sqrt(a * b)
      if (mag(m) > target) a = m
      else b = m
    }
    return Math.sqrt(a * b) / (2 * Math.PI)
  }
  return { high: find(mid, +1), low: find(mid, -1), band: peak }
}
