// System identification: a model fitted to a measured step, and the residual
// that says how much of the measurement the model missed.
//
// ── ADMISSION (Rule 1 of /CORE_SCOPE.md) ──
//
// A fitted first- or second-order model is exactly rational, so the object this
// file returns is admissible without a hedge. What is NOT exact is the claim
// that the fitted model IS the system the data came from. That claim is the
// approximation, and its guard is the residual.
//
// So there is no code path here that returns a model without its residual. Every
// routine returns `residual` (root mean square, in the units of the data) and
// `relResidual` (the same, divided by the fitted final value). A pane that
// prints the fitted time constant prints the residual beside it. A fit whose
// residual is one per cent of the step and a fit whose residual is thirty per
// cent look identical on a plot at the wrong zoom, and only the number
// separates them.
//
// Two stages, because each does what the other cannot.
//
//   1. The integral method gives a first estimate by linear least squares.
//      Integrating the model's own differential equation twice removes the
//      derivatives of the data, which is what makes the estimate usable on a
//      noisy trace at all. It is biased when the data carries noise, and that
//      bias is a lesson rather than a defect.
//   2. Nelder-Mead then minimises the residual on the RESPONSE, starting from
//      that estimate. The number this file prints is therefore the smallest
//      residual the model shape can reach on this data, not the residual of
//      whatever the regression happened to land on.

import { roots } from './tf.js'

/**
 * The largest damping ratio the second-order fit will report.
 *
 * A second-order model with a very large zeta IS a first-order model: one pole
 * runs off to minus infinity carrying none of the response, and the other sits
 * at the first-order pole. Left unbounded the search walks out along that ridge
 * and reports a natural frequency in the tens of thousands for a plain RC step,
 * which is arithmetically right and useless to read. Twenty puts the fast pole
 * 1600 times out from the slow one, past any separation a measurement can
 * distinguish, and the fit reports the pair rather than a runaway.
 */
export const ZETA_MAX = 20

/** Thrown where the data cannot support a fit at all. */
export class IdentError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'IdentError'
    this.code = code
  }
}

/** The unit step response of K / (1 + tau s), exactly. */
export const firstOrderStep = (t, tau) => 1 - Math.exp(-t / tau)

/**
 * The unit step response of wn^2 / (s^2 + 2 zeta wn s + wn^2), exactly, in all
 * three damping cases. The critically damped case has its own form because the
 * underdamped one divides by sqrt(1 - zeta^2).
 */
export function secondOrderStep(t, wn, zeta) {
  if (t <= 0) return 0
  if (Math.abs(zeta - 1) < 1e-9) {
    return 1 - Math.exp(-wn * t) * (1 + wn * t)
  }
  if (zeta < 1) {
    const wd = wn * Math.sqrt(1 - zeta * zeta)
    return 1 - Math.exp(-zeta * wn * t) * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t))
  }
  const root = wn * Math.sqrt(zeta * zeta - 1)
  const r1 = -wn * zeta + root
  const r2 = -wn * zeta - root
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1)
}

/** Cumulative trapezoidal integral of y against t. */
function cumTrapz(t, y) {
  const out = new Float64Array(y.length)
  for (let i = 1; i < y.length; i++) out[i] = out[i - 1] + ((y[i] + y[i - 1]) / 2) * (t[i] - t[i - 1])
  return out
}

/** Least squares for a small overdetermined system, by the normal equations. */
function leastSquares(cols, rhs) {
  const p = cols.length
  const n = rhs.length
  const M = Array.from({ length: p }, () => new Array(p + 1).fill(0))
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < p; b++) {
      let s = 0
      for (let i = 0; i < n; i++) s += cols[a][i] * cols[b][i]
      M[a][b] = s
    }
    let s = 0
    for (let i = 0; i < n; i++) s += cols[a][i] * rhs[i]
    M[a][p] = s
  }
  for (let c = 0; c < p; c++) {
    let piv = c
    for (let r = c + 1; r < p; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    if (Math.abs(M[piv][c]) < 1e-300) return null
    if (piv !== c) {
      const tmp = M[piv]
      M[piv] = M[c]
      M[c] = tmp
    }
    for (let r = c + 1; r < p; r++) {
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= p; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = new Array(p).fill(0)
  for (let r = p - 1; r >= 0; r--) {
    let s = M[r][p]
    for (let k = r + 1; k < p; k++) s -= M[r][k] * x[k]
    x[r] = s / M[r][r]
  }
  return x
}

/** Nelder-Mead on a small number of parameters, kept local and deterministic. */
function nelderMead(f, start, step, iterations = 400) {
  const n = start.length
  const pts = [start.slice()]
  for (let i = 0; i < n; i++) {
    const p = start.slice()
    p[i] += step[i]
    pts.push(p)
  }
  let vals = pts.map(f)
  for (let iter = 0; iter < iterations; iter++) {
    const order = pts.map((_, i) => i).sort((a, b) => vals[a] - vals[b])
    const best = order[0]
    const worst = order[n]
    const second = order[n - 1]
    const centroid = new Array(n).fill(0)
    for (const i of order.slice(0, n)) for (let k = 0; k < n; k++) centroid[k] += pts[i][k] / n
    const reflect = centroid.map((c, k) => c + (c - pts[worst][k]))
    const fr = f(reflect)
    if (fr < vals[best]) {
      const expand = centroid.map((c, k) => c + 2 * (c - pts[worst][k]))
      const fe = f(expand)
      if (fe < fr) {
        pts[worst] = expand
        vals[worst] = fe
      } else {
        pts[worst] = reflect
        vals[worst] = fr
      }
    } else if (fr < vals[second]) {
      pts[worst] = reflect
      vals[worst] = fr
    } else {
      const contract = centroid.map((c, k) => c + 0.5 * (pts[worst][k] - c))
      const fc = f(contract)
      if (fc < vals[worst]) {
        pts[worst] = contract
        vals[worst] = fc
      } else {
        for (const i of order.slice(1)) {
          pts[i] = pts[i].map((v, k) => pts[best][k] + 0.5 * (v - pts[best][k]))
          vals[i] = f(pts[i])
        }
      }
    }
    let spread = 0
    for (let i = 0; i <= n; i++) for (let k = 0; k < n; k++) spread = Math.max(spread, Math.abs(pts[i][k] - pts[0][k]))
    if (spread < 1e-12) break
  }
  const bestIndex = vals.indexOf(Math.min(...vals))
  return { x: pts[bestIndex], f: vals[bestIndex] }
}

/** The gain that best scales a fixed shape onto the data, solved in closed form. */
function bestGain(shape, y) {
  let num = 0
  let den = 0
  for (let i = 0; i < y.length; i++) {
    num += shape[i] * y[i]
    den += shape[i] * shape[i]
  }
  return den > 0 ? num / den : 0
}

function residualOf(model, y) {
  let s = 0
  for (let i = 0; i < y.length; i++) {
    const d = model[i] - y[i]
    s += d * d
  }
  return Math.sqrt(s / y.length)
}

function checkData(t, y) {
  if (!t || !y || t.length !== y.length) throw new IdentError('The time and data arrays must be the same length.', 'shape')
  if (t.length < 8) throw new IdentError('A step fit needs at least eight samples.', 'too-short')
  let span = 0
  for (let i = 0; i < y.length; i++) span = Math.max(span, Math.abs(y[i]))
  if (!(span > 0)) throw new IdentError('The data is flat at zero, so there is no step in it to fit.', 'no-step')
  return span
}

/**
 * Fit K / (1 + tau s) to a measured unit-step response.
 *
 * @returns {{ tf, K, tau, residual, relResidual, model, method }}
 *   `model` is the fitted response on the same time grid, so a pane can draw
 *   the fit over the data and a reader can see what the residual is measuring.
 */
export function fitFirstOrder(t, y) {
  checkData(t, y)
  // The integral method: integrating tau y' + y = K u once gives
  // tau y(t) + I1(t) = K t, which is linear in tau and K.
  const I1 = cumTrapz(t, y)
  const est = leastSquares([Array.from(y), Array.from(t, (v) => -v)], Array.from(I1, (v) => -v))
  let tau0 = est && est[0] > 0 ? est[0] : (t[t.length - 1] - t[0]) / 4
  if (!(tau0 > 0) || !Number.isFinite(tau0)) tau0 = (t[t.length - 1] - t[0]) / 4

  const sse = (p) => {
    const tau = Math.exp(p[0])
    if (!(tau > 0) || !Number.isFinite(tau)) return Infinity
    const shape = Array.from(t, (tv) => firstOrderStep(tv, tau))
    const K = bestGain(shape, y)
    return residualOf(shape.map((v) => v * K), y)
  }
  const best = nelderMead(sse, [Math.log(tau0)], [0.35])
  const tau = Math.exp(best.x[0])
  const shape = Array.from(t, (tv) => firstOrderStep(tv, tau))
  const K = bestGain(shape, y)
  const model = shape.map((v) => v * K)
  const residual = residualOf(model, y)
  return {
    tf: { b: [K], a: [tau, 1] },
    K,
    tau,
    poles: [[-1 / tau, 0]],
    order: 1,
    residual,
    relResidual: Math.abs(K) > 0 ? residual / Math.abs(K) : Infinity,
    model,
    method: 'integral estimate, then least squares on the response',
  }
}

/**
 * Fit K wn^2 / (s^2 + 2 zeta wn s + wn^2) to a measured unit-step response.
 *
 * The integral method's estimate comes from integrating the model's equation
 * twice, which gives a2 y + a1 I1 + I2 = K t^2 / 2, linear in the three
 * unknowns. The refinement then minimises the residual on the response itself.
 */
export function fitSecondOrder(t, y) {
  checkData(t, y)
  const I1 = cumTrapz(t, y)
  const I2 = cumTrapz(t, I1)
  const est = leastSquares(
    [Array.from(y), Array.from(I1), Array.from(t, (v) => (-v * v) / 2)],
    Array.from(I2, (v) => -v),
  )
  let wn0 = 1
  let zeta0 = 0.7
  if (est && est[0] > 0 && est[2] > 0) {
    // a2 s^2 + a1 s + 1, so wn = 1/sqrt(a2) and zeta = a1 / (2 sqrt(a2)).
    wn0 = 1 / Math.sqrt(est[0])
    zeta0 = est[1] / (2 * Math.sqrt(est[0]))
  }
  if (!(wn0 > 0) || !Number.isFinite(wn0)) wn0 = 4 / Math.max(t[t.length - 1] - t[0], 1e-12)
  if (!(zeta0 > 0.02) || !Number.isFinite(zeta0)) zeta0 = 0.5

  // zeta is searched through a logistic so it stays inside (0, ZETA_MAX)
  // without a hard edge for the simplex to stick against.
  const zetaOf = (p) => ZETA_MAX / (1 + Math.exp(-p))
  const zetaTo = (z) => Math.log(z / (ZETA_MAX - z))
  const sse = (p) => {
    const wn = Math.exp(p[0])
    const zeta = zetaOf(p[1])
    if (!Number.isFinite(wn) || !Number.isFinite(zeta) || wn <= 0 || zeta <= 0) return Infinity
    const shape = Array.from(t, (tv) => secondOrderStep(tv, wn, zeta))
    const K = bestGain(shape, y)
    return residualOf(shape.map((v) => v * K), y)
  }
  const start = Math.min(Math.max(zeta0, 0.02), ZETA_MAX * 0.98)
  const best = nelderMead(sse, [Math.log(wn0), zetaTo(start)], [0.3, 0.6])
  const wn = Math.exp(best.x[0])
  const zeta = zetaOf(best.x[1])
  const shape = Array.from(t, (tv) => secondOrderStep(tv, wn, zeta))
  const K = bestGain(shape, y)
  const model = shape.map((v) => v * K)
  const residual = residualOf(model, y)
  return {
    tf: { b: [K * wn * wn], a: [1, 2 * zeta * wn, wn * wn] },
    K,
    wn,
    zeta,
    poles: roots([1, 2 * zeta * wn, wn * wn]),
    order: 2,
    residual,
    relResidual: Math.abs(K) > 0 ? residual / Math.abs(K) : Infinity,
    model,
    method: 'integral estimate, then least squares on the response',
  }
}

/**
 * Fit both orders and report both, with the improvement the second order buys.
 *
 * The pane shows both rows. Choosing the higher order because its residual is
 * lower is always available and is not always right, so the comparison prints
 * the ratio and leaves the reading to the reader. A second-order fit to
 * first-order data lands on a heavily damped pair whose residual barely
 * improves, and that is the shape of the answer "the data does not support it".
 */
export function fitStep(t, y) {
  const first = fitFirstOrder(t, y)
  const second = fitSecondOrder(t, y)
  return {
    first,
    second,
    improvement: first.residual > 0 ? second.residual / first.residual : 0,
    // The residual is never hidden, and neither is the comparison behind a
    // choice. Both fits come back on every call.
  }
}
