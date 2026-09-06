// State space: the same object as a transfer function, written in the time
// domain.
//
// ── ADMISSION (Rule 1 of /CORE_SCOPE.md) ──
//
// A single-input single-output state space with constant real matrices is
// exactly a rational function of s, and the conversion each way is exact. It is
// admitted here without a hedge (the counter-rule). What state space adds is
// not new physics but a second view of the same object: the transfer function
// says what comes out, and the state says what the system is carrying while it
// does. Everything in this file is that one identity, used.
//
// Shape, matching `toStateSpace` in tf.js so the two are one currency:
//
//   { A, B, C, D, n }
//     A  n by n, rows of numbers
//     B  length n, the single input's column
//     C  length n, the single output's row
//     D  a number, the direct feedthrough
//     n  the order, and the number of states
//
// Multi-input and multi-output are not here. Every plant in the suite has one
// drive and one measurement, and a matrix-valued transfer function is not the
// currency `CORE_SCOPE.md` names.

import { polyAdd, polyMul, roots } from './tf.js'
import {
  eye,
  expm,
  faddeev,
  inverse,
  mul,
  mulVec,
  polyOfMatrix,
  rank,
  scale,
  solve,
  transpose,
  vecMul,
  zeros,
} from './matrix.js'

/** Thrown where a state space is asked for something it cannot exactly give. */
export class StateSpaceError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'StateSpaceError'
    this.code = code
  }
}

/**
 * Check and normalise a state space, so every routine below can assume shape.
 *
 * Accepts B and C as flat arrays (the single-input, single-output case) or as
 * one-column and one-row matrices, and returns the flat form.
 */
export function stateSpace({ A, B, C, D = 0 }) {
  const n = A.length
  for (const row of A) {
    if (row.length !== n) throw new StateSpaceError('A must be square, and it is not.', 'shape')
  }
  const flatB = Array.isArray(B[0]) ? B.map((r) => r[0]) : [...B]
  const flatC = Array.isArray(C[0]) ? [...C[0]] : [...C]
  if (flatB.length !== n) throw new StateSpaceError('B must have one entry per state.', 'shape')
  if (flatC.length !== n) throw new StateSpaceError('C must have one entry per state.', 'shape')
  return { A: A.map((r) => [...r]), B: flatB, C: flatC, D, n }
}

/**
 * State space to transfer function, exactly.
 *
 * H(s) = C (sI - A)^-1 B + D. Faddeev-LeVerrier gives the characteristic
 * polynomial and the adjugate's coefficient matrices in one recurrence, so the
 * numerator is C adj_k B term by term and the denominator is the polynomial.
 * No root finding and no matrix inverse, so a system with repeated or complex
 * poles takes the same path as any other.
 *
 * The denominator comes back monic, which is the normalisation the rest of the
 * suite composes loops in.
 */
export function toTransferFunction(ss) {
  const { A, B, C, D, n } = stateSpace(ss)
  if (n === 0) return { b: [D], a: [1] }
  const { poly, adj } = faddeev(A)
  // adj[k] multiplies s^(n - 1 - k), so the numerator of C (sI - A)^-1 B is
  // already in highest-power-first order.
  const num = adj.map((M) => {
    const row = vecMul(C, M)
    return row.reduce((s, v, i) => s + v * B[i], 0)
  })
  return { b: polyAdd(num, poly.map((v) => v * D)), a: poly }
}

/** The characteristic polynomial of A, monic and highest power first. */
export const charPoly = (A) => faddeev(A).poly

/** The eigenvalues of A, as [re, im] pairs. */
export const eigenvalues = (A) => roots(charPoly(A))

/**
 * The controllability matrix and its rank.
 *
 * [B, AB, ..., A^(n-1) B]. Full rank means every state can be reached from the
 * input in finite time, and it is the exact condition under which the poles can
 * be placed anywhere. `condition` is how far the matrix is from losing a rank,
 * which is the number that moves continuously as a plant becomes hard to drive.
 */
export function controllability(ss, relTol = 1e-9) {
  const { A, B, n } = stateSpace(ss)
  const cols = []
  let v = [...B]
  for (let k = 0; k < n; k++) {
    cols.push(v)
    v = mulVec(A, v)
  }
  const M = transpose(cols)
  const r = rank(M, relTol)
  return { matrix: M, ...r, controllable: r.rank === n, n }
}

/**
 * The observability matrix and its rank.
 *
 * [C; CA; ...; C A^(n-1)], stacked as rows. Full rank means the state can be
 * worked out from a finite stretch of the output, which is the exact condition
 * for an observer to exist.
 */
export function observability(ss, relTol = 1e-9) {
  const { A, C, n } = stateSpace(ss)
  const rows = []
  let v = [...C]
  for (let k = 0; k < n; k++) {
    rows.push(v)
    v = vecMul(v, A)
  }
  const r = rank(rows, relTol)
  return { matrix: rows, ...r, observable: r.rank === n, n }
}

/**
 * The real monic polynomial with the given roots.
 *
 * Complex roots must arrive in conjugate pairs, because a state space with real
 * matrices cannot have any other kind. An unpaired complex root is declined
 * with that reason rather than silently having its imaginary part dropped.
 */
export function polyFromRoots(desired) {
  const pts = desired.map((p) => (Array.isArray(p) ? [p[0], p[1]] : [p, 0]))
  const used = new Array(pts.length).fill(false)
  let poly = [1]
  for (let i = 0; i < pts.length; i++) {
    if (used[i]) continue
    const [re, im] = pts[i]
    if (Math.abs(im) < 1e-12 * Math.max(1, Math.abs(re))) {
      used[i] = true
      poly = polyMul(poly, [1, -re])
      continue
    }
    let mate = -1
    for (let j = i + 1; j < pts.length; j++) {
      if (used[j]) continue
      if (Math.abs(pts[j][0] - re) < 1e-9 * Math.max(1, Math.abs(re)) && Math.abs(pts[j][1] + im) < 1e-9 * Math.max(1, Math.abs(im))) {
        mate = j
        break
      }
    }
    if (mate < 0) {
      throw new StateSpaceError(
        `The pole at ${re} ${im >= 0 ? '+' : '-'} ${Math.abs(im)}j has no conjugate in the list. Real matrices only ever have poles in conjugate pairs, so this set cannot be placed.`,
        'unpaired-complex',
      )
    }
    used[i] = true
    used[mate] = true
    poly = polyMul(poly, [1, -2 * re, re * re + im * im])
  }
  return poly
}

/**
 * State feedback u = -K x that puts the closed-loop poles where asked.
 *
 * Ackermann's formula: K = e_n^T Cm^-1 phi(A), where phi is the desired
 * characteristic polynomial and Cm the controllability matrix. Exact for a
 * single input, and it is the formula the lesson derives, so the reader can
 * follow the code back to the page.
 *
 * A plant whose controllability matrix is rank deficient is declined with the
 * reason. That refusal is the content of the controllability experiment: the
 * rank is not a technicality about the algorithm, it is the fact that some
 * modes are not connected to the input.
 *
 * @returns {{ K, achieved, requested, condition }} `achieved` are the poles the
 *   closed loop actually has, found by rooting its characteristic polynomial,
 *   so the caller can print how well the placement landed.
 */
export function placePoles(ss, desired) {
  const s = stateSpace(ss)
  const { A, B, n } = s
  if (desired.length !== n) {
    throw new StateSpaceError(
      `A state feedback sets exactly ${n} poles, and ${desired.length} were asked for.`,
      'wrong-count',
    )
  }
  const ctrl = controllability(s)
  if (!ctrl.controllable) {
    throw new StateSpaceError(
      `The controllability matrix has rank ${ctrl.rank} of ${n}, so ${n - ctrl.rank} of the modes cannot be reached from the input. State feedback cannot move a pole it cannot reach, and this placement is declined rather than approximated.`,
      'uncontrollable',
    )
  }
  const phi = polyFromRoots(desired)
  const phiA = polyOfMatrix(A, phi)
  const Cinv = inverse(ctrl.matrix)
  if (!Cinv) {
    throw new StateSpaceError(
      'The controllability matrix is singular to working precision, so Ackermann has no solution to report.',
      'uncontrollable',
    )
  }
  const eN = new Array(n).fill(0)
  eN[n - 1] = 1
  const K = vecMul(vecMul(eN, Cinv), phiA)
  const Acl = A.map((row, i) => row.map((v, j) => v - B[i] * K[j]))
  return {
    K,
    Acl,
    achieved: roots(charPoly(Acl)),
    requested: desired.map((p) => (Array.isArray(p) ? p : [p, 0])),
    condition: ctrl.condition,
  }
}

/**
 * Observer gain L so that A - L C has the given poles.
 *
 * The dual of pole placement: place on (A transpose, C transpose) and
 * transpose the answer back. The duality is exact, which is why one routine
 * serves both, and it is the point the observer experiment makes.
 */
export function observerGain(ss, desired) {
  const { A, C, n } = stateSpace(ss)
  const dual = { A: transpose(A), B: [...C], C: new Array(n).fill(0).map((_, i) => (i === 0 ? 1 : 0)), D: 0 }
  const obs = observability(ss)
  if (!obs.observable) {
    throw new StateSpaceError(
      `The observability matrix has rank ${obs.rank} of ${n}, so ${n - obs.rank} of the modes leave no trace in the output. No observer can estimate a state it cannot see, and this placement is declined.`,
      'unobservable',
    )
  }
  const placed = placePoles(dual, desired)
  const L = [...placed.K]
  const Aobs = A.map((row, i) => row.map((v, j) => v - L[i] * C[j]))
  return { L, Aobs, achieved: roots(charPoly(Aobs)), requested: placed.requested, condition: obs.condition }
}

/**
 * Solve the continuous Lyapunov equation A^T P + P A + Q = 0 for P.
 *
 * Written out as n squared linear equations in the entries of P and solved
 * directly. At the orders this suite works at that is a sixteen by sixteen
 * system at worst, and the direct solve carries no iteration to converge.
 */
export function lyapunov(A, Q) {
  const n = A.length
  const N = n * n
  const M = zeros(N, N)
  const rhs = new Array(N).fill(0)
  const idx = (i, j) => i * n + j
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const r = idx(i, j)
      for (let a = 0; a < n; a++) M[r][idx(a, j)] += A[a][i]
      for (let b = 0; b < n; b++) M[r][idx(i, b)] += A[b][j]
      rhs[r] = -Q[i][j]
    }
  }
  const x = solve(M, rhs)
  if (!x) return null
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => x[idx(i, j)]))
}

/**
 * The linear quadratic regulator: the state feedback that minimises the
 * integral of x^T Q x + R u^2.
 *
 * Solved by Kleinman's iteration. Start from a stabilising gain, solve one
 * Lyapunov equation, take the new gain from it, repeat. The iteration is
 * Newton's method on the Riccati equation and doubles its correct digits each
 * pass, so the loop below converges in a handful of steps at these orders.
 *
 * `residual` is the largest absolute entry of A^T P + P A - P B R^-1 B^T P + Q,
 * relative to the largest entry of Q. It is returned on every call and there is
 * no variant that omits it. A gain whose Riccati residual is not small is not
 * the optimal gain, and the pane that prints the gain prints this beside it.
 *
 * @param ss a state space
 * @param Q  n by n, symmetric, the price of state
 * @param R  a positive number, the price of drive
 */
export function lqr(ss, Q, R) {
  const s = stateSpace(ss)
  const { A, B, n } = s
  if (!(R > 0)) {
    throw new StateSpaceError('R must be positive. A regulator that charges nothing for drive uses infinite drive.', 'bad-weight')
  }
  const ctrl = controllability(s)
  if (!ctrl.controllable) {
    throw new StateSpaceError(
      `The controllability matrix has rank ${ctrl.rank} of ${n}. An unreachable mode cannot be regulated, and the cost is infinite unless that mode is already stable. The optimal gain is declined rather than approximated.`,
      'uncontrollable',
    )
  }

  // A stabilising start. A stable A needs none, and an unstable one gets its
  // poles placed at spread-out values a little faster than the plant's own.
  const eig = eigenvalues(A)
  const worst = Math.max(...eig.map(([re, im]) => Math.hypot(re, im)), 1)
  let K = new Array(n).fill(0)
  if (eig.some(([re]) => re >= 0)) {
    K = placePoles(s, Array.from({ length: n }, (_, i) => -worst * (1 + 0.37 * i))).K
  }

  let P = null
  for (let iter = 0; iter < 60; iter++) {
    const Acl = A.map((row, i) => row.map((v, j) => v - B[i] * K[j]))
    const Qk = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => Q[i][j] + R * K[i] * K[j]),
    )
    const Pnext = lyapunov(Acl, Qk)
    if (!Pnext) {
      throw new StateSpaceError(
        'The Lyapunov equation on this iterate is singular, so the optimal gain cannot be reported.',
        'lyapunov-singular',
      )
    }
    P = Pnext
    // K = R^-1 B^T P
    const Knext = new Array(n).fill(0)
    for (let j = 0; j < n; j++) {
      let acc = 0
      for (let i = 0; i < n; i++) acc += B[i] * P[i][j]
      Knext[j] = acc / R
    }
    const move = Math.max(...Knext.map((v, i) => Math.abs(v - K[i])))
    const size = Math.max(...Knext.map(Math.abs), 1e-30)
    K = Knext
    if (move <= 1e-14 * size) break
  }

  // The Riccati residual, reported rather than assumed away.
  const BR = B.map((v) => v / R)
  const resid = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let v = Q[i][j]
      for (let k = 0; k < n; k++) v += A[k][i] * P[k][j] + P[i][k] * A[k][j]
      let pb = 0
      let bp = 0
      for (let k = 0; k < n; k++) {
        pb += P[i][k] * BR[k]
        bp += B[k] * P[k][j]
      }
      return v - pb * bp
    }),
  )
  let residual = 0
  let qScale = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      residual = Math.max(residual, Math.abs(resid[i][j]))
      qScale = Math.max(qScale, Math.abs(Q[i][j]))
    }
  }
  const Acl = A.map((row, i) => row.map((v, j) => v - B[i] * K[j]))
  return {
    K,
    P,
    Acl,
    poles: roots(charPoly(Acl)),
    residual,
    relResidual: qScale > 0 ? residual / qScale : residual,
    // The cost the regulator pays from a unit initial state, x0^T P x0 for
    // x0 = e_1: the number the quadratic trade is read on.
    cost: (x0) => {
      let s2 = 0
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s2 += x0[i] * P[i][j] * x0[j]
      return s2
    },
  }
}

/**
 * Series connection of two state spaces: the first drives the second.
 *
 * The combined state is both states stacked, and the algebra is the block form
 * a textbook writes. Exact, and it is what the loop views need in order to keep
 * the controller's state and the plant's state apart on screen.
 */
export function ssSeries(first, second) {
  const f = stateSpace(first)
  const g = stateSpace(second)
  const n = f.n + g.n
  const A = zeros(n)
  for (let i = 0; i < f.n; i++) for (let j = 0; j < f.n; j++) A[i][j] = f.A[i][j]
  for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) A[f.n + i][f.n + j] = g.A[i][j]
  for (let i = 0; i < g.n; i++) for (let j = 0; j < f.n; j++) A[f.n + i][j] = g.B[i] * f.C[j]
  const B = new Array(n).fill(0)
  for (let i = 0; i < f.n; i++) B[i] = f.B[i]
  for (let i = 0; i < g.n; i++) B[f.n + i] = g.B[i] * f.D
  const C = new Array(n).fill(0)
  for (let j = 0; j < f.n; j++) C[j] = g.D * f.C[j]
  for (let j = 0; j < g.n; j++) C[f.n + j] = g.C[j]
  return { A, B, C, D: g.D * f.D, n }
}

/**
 * The state trajectory of a state space under an input, by the exact solution
 * over each step.
 *
 * Between samples the input is held, so the step is x(t + h) = Phi x(t) +
 * Gamma u(t) with Phi and Gamma from one matrix exponential. That is exact for
 * a held input, which is what makes the same routine the sampled loop's
 * simulator rather than an integrator with an error to argue about.
 */
export function ssTrajectory(ss, u, { duration, points = 600, x0 = null }) {
  const { A, B, C, D, n } = stateSpace(ss)
  const t = new Float64Array(points)
  const y = new Float64Array(points)
  const xs = []
  if (n === 0) {
    for (let i = 0; i < points; i++) {
      t[i] = (duration * i) / (points - 1)
      y[i] = D * u(t[i])
      xs.push([])
    }
    return { t, y, x: xs }
  }
  const h = duration / (points - 1)
  const { Phi, Gamma } = expmWithHold(A, B, h)
  let x = x0 ? [...x0] : new Array(n).fill(0)
  for (let i = 0; i < points; i++) {
    const time = h * i
    t[i] = time
    const uu = u(time)
    y[i] = D * uu + C.reduce((s, c, k) => s + c * x[k], 0)
    xs.push([...x])
    x = mulVec(Phi, x).map((v, k) => v + Gamma[k] * uu)
  }
  return { t, y, x: xs }
}

/** e^(A h) and the hold's input map, shared with the discrete module. */
export function expmWithHold(A, B, h) {
  const n = A.length
  const big = zeros(n + 1)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) big[i][j] = A[i][j] * h
    big[i][n] = B[i] * h
  }
  const E = expm(big)
  return {
    Phi: Array.from({ length: n }, (_, i) => E[i].slice(0, n)),
    Gamma: Array.from({ length: n }, (_, i) => E[i][n]),
  }
}

/**
 * A similarity transform x = T z, which changes the coordinates and not the
 * system. The transfer function is invariant under it, and that invariance is
 * what "the state is a choice, the transfer function is not" means.
 */
export function similarity(ss, T) {
  const { A, B, C, D } = stateSpace(ss)
  const Ti = inverse(T)
  if (!Ti) throw new StateSpaceError('The transform is singular, so it is not a change of coordinates.', 'singular-transform')
  return {
    A: mul(Ti, mul(A, T)),
    B: mulVec(Ti, B),
    C: vecMul(C, T),
    D,
    n: A.length,
  }
}

/** Kept so callers can build an identity transform without importing matrix.js. */
export { eye as identityMatrix, scale as scaleMatrix }
