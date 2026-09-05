// The Wiener filter: the best linear estimate, and the error it cannot beat.
//
// The matched filter answers "is the pulse there". The Wiener filter answers
// "what was the waveform", and it is the same idea one step further: choose the
// linear combination that minimises mean-square error, and the answer is the
// normal equations `R w = p` with `R` the input's autocorrelation matrix and `p`
// the cross-correlation between input and target.
//
// Two forms are here. `wienerScalar` is one sample and one weight, where the
// answer is a ratio of variances and needs no linear algebra. `wienerFir` is the
// N-tap filter, solved by Levinson-Durbin because `R` is Toeplitz. Levinson is
// used rather than a general solve for a reason the lab shows: it produces the
// reflection coefficients on the way, and their magnitudes staying below one is
// the same statement as `R` being positive definite.

import { autocorrelation, crossCorrelation } from './corr.js'

/**
 * One sample, one weight. The estimate of `s` from `x = s + n` is `w x` with
 * `w = var(s) / (var(s) + var(n))`, and the error it leaves is
 * `var(s) var(n) / (var(s) + var(n))`, the harmonic combination.
 *
 * The scalar case carries the lesson that the multi-tap case then contradicts.
 * A single weight cannot change a ratio of powers, so `snrOut` equals `snrIn`
 * identically and `gainDb` is zero for every input. What the weight buys is
 * mean-square error and nothing else: it is `mmse` rather than `var(s)` because
 * the estimate is deliberately shrunk towards zero, which is worse as a scaling
 * and better as an estimate. Only a filter with more than one tap, seeing more
 * than one sample, can move the ratio.
 *
 * @returns {{ w, mmse, snrIn, snrOut, gainDb, unfilteredMse }}
 */
export function wienerScalar({ signalVariance, noiseVariance }) {
  const w = signalVariance / (signalVariance + noiseVariance)
  const mmse = (signalVariance * noiseVariance) / (signalVariance + noiseVariance)
  return {
    w,
    mmse,
    // The error left by doing nothing, w = 1. The Wiener weight beats it by the
    // factor w, so the improvement is largest when the noise dominates.
    unfilteredMse: noiseVariance,
    snrIn: signalVariance / noiseVariance,
    snrOut: (signalVariance - mmse) / mmse,
    gainDb: 10 * Math.log10(((signalVariance - mmse) / mmse) / (signalVariance / noiseVariance)),
  }
}

/**
 * Solve the symmetric positive-definite system `R w = p` by Cholesky, where `R`
 * is the Toeplitz matrix with first row `r`.
 *
 * Cholesky rather than a general elimination because the failure mode is the
 * teaching point. `R` is a correlation matrix, so it is positive definite for
 * any sequence that could have come from a real process, and the factorisation
 * fails exactly when it is not. The message names the order at which it failed
 * rather than returning weights from a matrix that has no inverse.
 */
export function solveToeplitz(r, p) {
  const n = p.length
  if (r.length < n) throw new Error('solveToeplitz: the correlation row is shorter than the target')
  const L = []
  for (let i = 0; i < n; i++) L.push(new Float64Array(n))
  const at = (i, j) => r[Math.abs(i - j)]
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = at(i, j)
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]
      if (i === j) {
        if (!(s > 0)) throw new Error(`solveToeplitz: not positive definite at order ${i + 1}`)
        L[i][i] = Math.sqrt(s)
      } else {
        L[i][j] = s / L[j][j]
      }
    }
  }
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let s = p[i]
    for (let k = 0; k < i; k++) s -= L[i][k] * y[k]
    y[i] = s / L[i][i]
  }
  const w = new Float64Array(n)
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]
    for (let k = i + 1; k < n; k++) s -= L[k][i] * w[k]
    w[i] = s / L[i][i]
  }
  return w
}

/**
 * The linear-prediction recursion, for the reflection coefficients.
 *
 * Levinson-Durbin solves the prediction problem `R a = [r1..rp]` in `O(p^2)`,
 * and produces a reflection coefficient at each order on the way. Every one of
 * them having magnitude below one is the same statement as `R` being positive
 * definite, seen from the inside, and it is the number a lesson watches when it
 * asks whether a correlation sequence is a real one.
 *
 * @returns {{ a: Float64Array, reflection: Float64Array, error: number }}
 *   `a` holds the predictor coefficients for lags 1..order. `error` is the
 *   prediction-error power the predictor leaves.
 */
export function levinsonDurbin(r, order) {
  if (!(r[0] > 0)) throw new Error('levinsonDurbin: zero-lag correlation must be positive')
  const a = new Float64Array(order)
  const reflection = new Float64Array(order)
  let e = r[0]
  for (let k = 1; k <= order; k++) {
    let acc = r[k]
    for (let j = 1; j < k; j++) acc -= a[j - 1] * r[k - j]
    const kappa = acc / e
    reflection[k - 1] = kappa
    const prev = Float64Array.from(a.subarray(0, k - 1))
    for (let j = 1; j < k; j++) a[j - 1] = prev[j - 1] - kappa * prev[k - 1 - j]
    a[k - 1] = kappa
    e *= 1 - kappa * kappa
    if (!(e > 0)) throw new Error(`levinsonDurbin: not positive definite at order ${k}`)
  }
  return { a, reflection, error: e }
}

/**
 * The `taps`-tap Wiener filter estimating `d` from `x`, from the records
 * themselves.
 *
 * @returns {{ w, mmse, signalPower, apply, rxx, rxd, reflection }}
 *   `mmse` is `r_dd[0] - w . p`, the minimum mean-square error the weights
 *   reach. `apply(x)` runs the filter over a record.
 */
export function wienerFir({ x, d, taps = 8 }) {
  const rxx = autocorrelation(x, taps - 1, { removeMean: false }).r
  const rxd = crossCorrelation(x, d, taps - 1)
  const w = solveToeplitz(rxx, rxd)
  const { reflection } = levinsonDurbin(rxx, taps - 1)
  let dd = 0
  for (let i = 0; i < d.length; i++) dd += d[i] * d[i]
  const rdd0 = dd / d.length
  let wp = 0
  for (let i = 0; i < taps; i++) wp += w[i] * rxd[i]
  return {
    w,
    reflection,
    mmse: rdd0 - wp,
    signalPower: rdd0,
    rxx,
    rxd,
    apply: (buf) => {
      const y = new Float64Array(buf.length)
      for (let i = 0; i < buf.length; i++) {
        let acc = 0
        for (let k = 0; k < taps; k++) if (i - k >= 0) acc += w[k] * buf[i - k]
        y[i] = acc
      }
      return y
    },
  }
}

/**
 * The frequency-domain Wiener filter, `H = S_ss / (S_ss + S_nn)`.
 *
 * The non-causal solution, and the shape the lab draws: the filter passes a band
 * where the signal dominates and stops one where the noise does, with a smooth
 * transition set by the ratio rather than by a chosen corner. It is exact for
 * the stated densities and carries no hedge. What it is not is causal, and a
 * lesson that wants a causal filter uses `wienerFir` instead.
 */
export function wienerResponse(psdSignal, psdNoise) {
  const h = new Float64Array(psdSignal.length)
  for (let k = 0; k < h.length; k++) {
    const den = psdSignal[k] + psdNoise[k]
    h[k] = den === 0 ? 0 : psdSignal[k] / den
  }
  return h
}
