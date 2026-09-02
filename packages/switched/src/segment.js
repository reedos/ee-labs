// One segment of a switched circuit: a constant topology for a duration.
//
//     { A, f, x0, T }   ẋ = A x + f  on [0, T],  x(0) = x0
//
// where f = B·u is the constant forcing (the source through this topology).
// Everything a segment can be asked for is exact in the sense that the only
// approximation is floating point: the state at any instant and the integral
// of the state over the segment come from the propagator; integrals of
// nonlinear functions of the state (squares for RMS, products for power) use
// Gauss–Legendre on the analytic solution with the step kept short enough
// that its truncation sits far below rounding.

import { propagator, propagator01 } from './propagator.js'
import { matVec, vecAdd, norm1 } from './linalg.js'

export function stateAt(seg, t) {
  const { phi0, phi1 } = propagator01(seg.A, t)
  return vecAdd(matVec(phi0, seg.x0), matVec(phi1, seg.f))
}

export function endState(seg) {
  return stateAt(seg, seg.T)
}

// ∫₀ᵀ x(t) dt, exactly.
export function integral(seg) {
  const { phi1, phi2 } = propagator(seg.A, seg.T)
  return vecAdd(matVec(phi1, seg.x0), matVec(phi2, seg.f))
}

// n+1 samples at equal spacing, both ends included, stepped with one
// propagator so the cost is a matrix-vector product per point.
export function sample(seg, n) {
  const dt = seg.T / n
  const { phi0, phi1 } = propagator01(seg.A, dt)
  const drive = matVec(phi1, seg.f)
  const out = [seg.x0]
  let x = seg.x0
  for (let k = 0; k < n; k++) {
    x = vecAdd(matVec(phi0, x), drive)
    out.push(x)
  }
  return out
}

// 10-point Gauss–Legendre on [−1, 1].
const GL_X = [
  -0.9739065285171717, -0.8650633666889845, -0.6794095682990244, -0.4333953941292472,
  -0.1488743389816312, 0.1488743389816312, 0.4333953941292472, 0.6794095682990244,
  0.8650633666889845, 0.9739065285171717,
]
const GL_W = [
  0.0666713443086881, 0.1494513491505806, 0.219086362515982, 0.2692667193099963,
  0.2955242247147529, 0.2955242247147529, 0.2692667193099963, 0.219086362515982,
  0.1494513491505806, 0.0666713443086881,
]

// ∫₀ᵀ g(x(t), t) dt. The segment is cut into pieces with ‖A‖·h ≤ 1/2 so the
// ten-point rule's truncation (∝ (‖A‖h)²⁰/20!) is below 1e-24 of the
// integrand's scale; the propagator is evaluated once per node offset and
// once per piece, never per node.
export function quadrature(seg, g) {
  if (seg.T <= 0) return 0
  const { h, pts } = quadraturePoints(seg)
  let total = 0
  for (const { t, x, w } of pts) total += w * g(x, t)
  return (total * h) / 2
}

// The states at the quadrature nodes, computed once per segment and kept on
// it: every signal's RMS and every power product reads the same nodes.
const NODE_CACHE = new WeakMap()
function quadraturePoints(seg) {
  const hit = NODE_CACHE.get(seg)
  if (hit) return hit
  const pieces = Math.max(1, Math.ceil((norm1(seg.A) * seg.T) / 0.5))
  const h = seg.T / pieces
  const nodes = GL_X.map((xi) => {
    const tau = (h * (xi + 1)) / 2
    const { phi0, phi1 } = propagator01(seg.A, tau)
    return { tau, phi0, drive: matVec(phi1, seg.f) }
  })
  const step = propagator01(seg.A, h)
  const stepDrive = matVec(step.phi1, seg.f)
  const pts = []
  let xs = seg.x0
  for (let p = 0; p < pieces; p++) {
    const t0 = p * h
    for (let k = 0; k < nodes.length; k++) {
      const nd = nodes[k]
      pts.push({ t: t0 + nd.tau, x: vecAdd(matVec(nd.phi0, xs), nd.drive), w: GL_W[k] })
    }
    xs = vecAdd(matVec(step.phi0, xs), stepDrive)
  }
  const out = { h, pts }
  NODE_CACHE.set(seg, out)
  return out
}

// First instant in (0, T] at which x[comp] falls through zero, or null.
// A coarse scan finds the bracket; bisection on the exact solution closes it
// to `tol` of the segment. Only downward crossings count — that is what a
// diode does, and an upward one from a negative start is not an event the
// engine models.
export function firstDownCrossing(seg, comp, { scan = 64, tol = 1e-13 } = {}) {
  if (seg.T <= 0) return null
  const pts = sample(seg, scan)
  const dt = seg.T / scan
  for (let k = 0; k < scan; k++) {
    const a = pts[k][comp]
    const b = pts[k + 1][comp]
    if (a >= 0 && b < 0) {
      let lo = k * dt
      let hi = (k + 1) * dt
      const target = tol * seg.T
      while (hi - lo > target) {
        const mid = (lo + hi) / 2
        if (stateAt(seg, mid)[comp] < 0) hi = mid
        else lo = mid
      }
      return (lo + hi) / 2
    }
  }
  return null
}

// Scalar bisection for a sign change of r on [lo, hi] (r(lo) and r(hi) of
// opposite sign, r(lo) taken as the positive side) to a width of tol.
export function bisect(r, lo, hi, tol) {
  let rlo = r(lo)
  const sgn = rlo >= 0 ? 1 : -1
  while (hi - lo > tol) {
    const mid = (lo + hi) / 2
    const rm = r(mid)
    if (rm * sgn >= 0) {
      lo = mid
      rlo = rm
    } else hi = mid
  }
  return (lo + hi) / 2
}

// Illinois-modified regula falsi for a root of r on [lo, hi] with r(lo) and
// r(hi) of opposite sign: secant steps that keep the bracket, with the stale
// side's value halved whenever it is kept twice, so a convex residual cannot
// pin one end. Superlinear on smooth residuals, never worse than the bracket.
export function illinois(r, lo, hi, tol, { rlo = r(lo), rhi = r(hi), maxIter = 100 } = {}) {
  if (rlo === 0) return lo
  if (rhi === 0) return hi
  let side = 0
  for (let i = 0; i < maxIter && hi - lo > tol; i++) {
    let m = (lo * rhi - hi * rlo) / (rhi - rlo)
    if (!(m > lo && m < hi)) m = (lo + hi) / 2
    const rm = r(m)
    if (rm === 0) return m
    if (rm * rlo > 0) {
      lo = m
      rlo = rm
      if (side === -1) rhi /= 2
      side = -1
    } else {
      hi = m
      rhi = rm
      if (side === 1) rlo /= 2
      side = 1
    }
  }
  return (lo + hi) / 2
}
