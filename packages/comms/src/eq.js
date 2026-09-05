// Equalisers.
//
// A zero-forcing equaliser is the channel's inverse truncated to a finite
// kernel, which is an FIR, so Signal Lab's z-plane view draws its zeros
// unchanged. An MMSE equaliser is the same length of kernel solved against a
// stated noise variance. Both are exact solutions of the linear systems they
// state, and both are admitted in full. The adaptive equaliser is a sequence of
// filters rather than one filter, and it is labelled as such where it is used.

/** Solve a symmetric positive-definite system by Gaussian elimination. */
function solve(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    const t = M[c]
    M[c] = M[p]
    M[p] = t
    const piv = M[c][c]
    if (Math.abs(piv) < 1e-300) throw new Error('equaliser: the system is singular')
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / piv
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = new Array(n)
  for (let i = 0; i < n; i++) x[i] = M[i][n] / M[i][i]
  return x
}

/**
 * A linear equaliser of `taps` taps for a real channel, at a stated delay.
 *
 * `noiseVariance` of zero gives the zero-forcing solution, which inverts the
 * channel and pays for it wherever the channel has a notch. A positive variance
 * gives the minimum mean-square solution, which trades residual interference
 * for noise and wins where the notch is deep. G4 is that comparison.
 */
export function linearEqualiser({ channel, taps = 41, delay = null, noiseVariance = 0 }) {
  const m = channel.length
  // The delay is part of the design. A minimum-phase channel has a causal
  // inverse and wants a delay of nothing, and a channel with a zero outside the
  // unit circle wants one. Searching for it costs one solve per candidate and
  // removes a knob nobody could set from first principles.
  if (delay === null) {
    let best = null
    for (let d = 0; d < taps + m - 1; d++) {
      const trial = linearEqualiser({ channel, taps, delay: d, noiseVariance })
      const q = equaliserQuality({ channel, w: trial.taps, delay: d })
      if (!best || q.residual < best.q.residual) best = { trial, q }
    }
    return best.trial
  }
  const d = delay
  // The autocorrelation of the channel, and its cross-correlation with the
  // wanted response, which is a single one at the chosen delay.
  const R = []
  for (let i = 0; i < taps; i++) {
    const row = new Array(taps).fill(0)
    for (let j = 0; j < taps; j++) {
      let s = 0
      for (let k = 0; k < m; k++) {
        const a = k + i - j
        if (a >= 0 && a < m) s += channel[k] * channel[a]
      }
      row[j] = s + (i === j ? noiseVariance : 0)
    }
    R.push(row)
  }
  const p = new Array(taps).fill(0)
  for (let i = 0; i < taps; i++) {
    const k = d - i
    p[i] = k >= 0 && k < m ? channel[k] : 0
  }
  const w = solve(R, p)
  return { taps: Float64Array.from(w), delay: d, noiseVariance }
}

/** The cascade of a channel and an equaliser, which is what a symbol sees. */
export function cascade(channel, w) {
  const out = new Float64Array(channel.length + w.length - 1)
  for (let i = 0; i < channel.length; i++) {
    for (let j = 0; j < w.length; j++) out[i + j] += channel[i] * w[j]
  }
  return out
}

/**
 * What the equaliser leaves, and what it costs.
 *
 * `residual` is the largest interference left at any symbol instant other than
 * the wanted one. `noiseGainDb` is the amplification the equaliser applies to
 * white noise, which is the price of inverting a notch. G3 reads the first and
 * G4 reads the second.
 */
export function equaliserQuality({ channel, w, delay, sps = 1 }) {
  const c = cascade(channel, w)
  const peak = c[delay]
  let residual = 0
  for (let k = 0; k < c.length; k += sps) {
    if (k === delay) continue
    residual = Math.max(residual, Math.abs(c[k] / peak))
  }
  let gain = 0
  for (let i = 0; i < w.length; i++) gain += w[i] * w[i]
  return {
    cascade: c,
    peak,
    residual,
    noiseGain: gain / (peak * peak),
    noiseGainDb: 10 * Math.log10(gain / (peak * peak)),
  }
}

/**
 * The least-mean-square equaliser, as a sequence of filters.
 *
 * The algorithm belongs to the DSP Lab's adaptive group, and G5 names it there
 * rather than restating it. What this returns is the learning curve, because
 * the curve is what the experiment is about. Above a step size of `2 / (taps
 * times the input power)` the recursion does not converge, and `diverged` says
 * so rather than returning a kernel of infinities.
 */
export function lmsEqualiser({ channel, taps = 21, mu = 0.01, symbols = 2000, seed = 1, delay = null, rng }) {
  const d = delay === null ? Math.floor((taps + channel.length - 2) / 2) : delay
  const w = new Float64Array(taps)
  const line = new Float64Array(taps)
  const curve = new Float64Array(symbols)
  // The learning curve, as a block mean square rather than one sample's error.
  // A single sample is as likely to be small by luck as by convergence.
  const block = Math.max(1, Math.floor(symbols / 40))
  const history = []
  let blockSum = 0
  let blockCount = 0
  let diverged = false
  const train = new Float64Array(symbols + channel.length)
  for (let i = 0; i < train.length; i++) train[i] = rng.uniform() < 0.5 ? -1 : 1
  for (let n = 0; n < symbols; n++) {
    // One channel output sample.
    let x = 0
    for (let k = 0; k < channel.length; k++) if (n - k >= 0) x += channel[k] * train[n - k]
    for (let i = taps - 1; i > 0; i--) line[i] = line[i - 1]
    line[0] = x
    let y = 0
    for (let i = 0; i < taps; i++) y += w[i] * line[i]
    const want = n - d >= 0 ? train[n - d] : 0
    const e = want - y
    curve[n] = e * e
    if (!Number.isFinite(e) || Math.abs(e) > 1e6) {
      diverged = true
      break
    }
    for (let i = 0; i < taps; i++) w[i] += mu * e * line[i]
    blockSum += e * e
    blockCount++
    if (blockCount === block) {
      history.push(blockSum / blockCount)
      blockSum = 0
      blockCount = 0
    }
  }
  // The mean square error over the last tenth of the run.
  const tail = Math.max(1, Math.floor(symbols / 10))
  let mse = 0
  for (let i = symbols - tail; i < symbols; i++) mse += curve[i] || 0
  return { taps: w, curve, history, mse: mse / tail, diverged, delay: d, mu }
}

/** The step size above which the recursion does not converge. */
export function lmsStable(taps, inputPower = 1) {
  return 2 / (taps * inputPower)
}
