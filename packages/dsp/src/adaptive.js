// Filters that change their own coefficients, and the one thing they are not.
//
// Every filter in this package so far is fixed. Its coefficients are decided at
// design time, it has an H(z), and the whole apparatus of poles, zeros and
// frequency response applies. An adaptive filter has none of that. Its
// coefficients change at every sample, driven by the error between what it
// produced and what was wanted, so it is time-varying by construction.
//
// CORE_SCOPE decides what may be claimed about it. A time-varying filter is not
// a rational function of z, so it is not admitted to the transfer-function
// currency and no H(z) is offered for it. What is offered instead is the
// sequence of filters it passes through: the weight vector at each sample is a
// perfectly ordinary FIR, and `history` keeps every one of them so the view can
// show the sequence rather than a single curve that does not exist.
//
// Two things about it ARE exact and are stated without hedge:
//
//   - The Wiener solution. For a stationary input the best fixed filter of the
//     same length is the solution of R w = p, where R is the input's
//     autocorrelation matrix and p its cross-correlation with the wanted signal.
//     That is a linear system with one answer, and `wiener()` returns it.
//   - The step-size bound and the misadjustment. LMS converges in the mean
//     square only while mu < 2/(3 N Px), and it then sits above the Wiener
//     error by a fraction M = mu N Px / 2. Both are stated with the assumptions
//     they rest on, and both are measured in the tests.

/** Autocorrelation of x at lags 0..n-1, biased (divided by the full length). */
export function autocorr(x, n) {
  const out = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    let acc = 0
    for (let i = k; i < x.length; i++) acc += x[i] * x[i - k]
    out[k] = acc / x.length
  }
  return out
}

/** Cross-correlation p[k] = E{d[n] x[n-k]}, k = 0..n-1, on the same convention. */
export function crosscorr(x, d, n) {
  const out = new Float64Array(n)
  const len = Math.min(x.length, d.length)
  for (let k = 0; k < n; k++) {
    let acc = 0
    for (let i = k; i < len; i++) acc += d[i] * x[i - k]
    out[k] = acc / len
  }
  return out
}

/** Solve a small dense system by Gaussian elimination with partial pivoting. */
function gauss(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    if (Math.abs(M[piv][c]) < 1e-300) return null
    const t = M[c]
    M[c] = M[piv]
    M[piv] = t
    const d = M[c][c]
    for (let k = c; k <= n; k++) M[c][k] /= d
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c]
      if (f === 0) continue
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return Float64Array.from(M.map((row) => row[n]))
}

/**
 * The Wiener filter: the best fixed N-tap filter, in the mean-square sense, for
 * producing `d` from `x`.
 *
 * Solves the normal equations R w = p, where R is Toeplitz from the input's
 * autocorrelation and p is the cross-correlation with the wanted signal. This
 * is a linear system with one solution, so the answer is exact and carries no
 * hedge. What the adaptive algorithms below do is find this vector without ever
 * forming R.
 */
export function wiener(x, d, taps) {
  const N = Math.max(1, Math.round(taps))
  const r = autocorr(x, N)
  const p = crosscorr(x, d, N)
  const A = []
  for (let i = 0; i < N; i++) {
    const row = new Array(N)
    for (let j = 0; j < N; j++) row[j] = r[Math.abs(i - j)]
    A.push(row)
  }
  const w = gauss(A, Array.from(p))
  return { w: w ?? new Float64Array(N), r, p, singular: w == null }
}

/**
 * The largest step size at which LMS converges in the mean square.
 *
 *   mu_max = 2 / (3 N Px)
 *
 * Px is the input power per sample and N the number of taps, so N·Px is the
 * energy in the delay line. The looser bound 2/(N Px) governs the mean of the
 * weights and the tighter one above governs their mean square, which is what a
 * reader watching the error actually sees. Both rest on the input being
 * stationary and on the weights being independent of the input, and that second
 * assumption is an approximation with a name (the independence assumption).
 */
export function lmsStepBound({ taps, inputPower }) {
  const N = Math.max(1, Math.round(taps))
  return { mean: 2 / (N * inputPower), meanSquare: 2 / (3 * N * inputPower), tapEnergy: N * inputPower }
}

/**
 * The excess mean-square error LMS settles at, as a fraction of the Wiener
 * minimum.
 *
 *   M = mu N Px / 2
 *
 * A gradient estimated from one sample is noisy, so the weights never stop
 * moving and the error never reaches the Wiener floor. Halving mu halves the
 * misadjustment and doubles the time constant, which is the trade this number
 * exists to make visible.
 */
export function misadjustment({ mu, taps, inputPower }) {
  return (mu * Math.max(1, Math.round(taps)) * inputPower) / 2
}

/**
 * Least mean squares, in the form it is always written:
 *
 *   y[n] = w' x[n],   e[n] = d[n] - y[n],   w <- w + mu e[n] x[n]
 *
 * One multiply-accumulate per tap for the output and one more for the update, so
 * 2N per sample, which is the reason it is the algorithm everything else is
 * compared against. `leak` subtracts a small fraction of the weight each step,
 * which stops a weight drifting when the input stops exciting it.
 */
export function makeLms({ taps, mu, leak = 0 }) {
  const N = Math.max(1, Math.round(taps))
  const w = new Float64Array(N)
  const line = new Float64Array(N)
  return {
    w,
    update(x, d) {
      for (let i = N - 1; i > 0; i--) line[i] = line[i - 1]
      line[0] = x
      let y = 0
      for (let i = 0; i < N; i++) y += w[i] * line[i]
      const e = d - y
      const g = mu * e
      for (let i = 0; i < N; i++) w[i] = (1 - leak) * w[i] + g * line[i]
      return { y, e }
    },
  }
}

/**
 * Normalised LMS: the same update divided by the energy in the delay line.
 *
 *   w <- w + mu e[n] x[n] / (eps + x'x)
 *
 * The division makes the step size dimensionless, so the stability bound becomes
 * 0 < mu < 2 whatever the input level is. That is the whole point: plain LMS has
 * to be retuned when the signal gets louder, and this one does not.
 */
export function makeNlms({ taps, mu, eps = 1e-6 }) {
  const N = Math.max(1, Math.round(taps))
  const w = new Float64Array(N)
  const line = new Float64Array(N)
  let energy = 0
  return {
    w,
    update(x, d) {
      const dropped = line[N - 1]
      for (let i = N - 1; i > 0; i--) line[i] = line[i - 1]
      line[0] = x
      energy += x * x - dropped * dropped
      if (energy < 0) energy = 0
      let y = 0
      for (let i = 0; i < N; i++) y += w[i] * line[i]
      const e = d - y
      const g = (mu * e) / (eps + energy)
      for (let i = 0; i < N; i++) w[i] += g * line[i]
      return { y, e }
    },
  }
}

/**
 * Recursive least squares: the exact least-squares solution over an
 * exponentially weighted window, updated one sample at a time.
 *
 * Where LMS follows a noisy gradient, this one keeps the inverse correlation
 * matrix P and applies the matrix inversion lemma, so at every sample the
 * weights are the exact minimiser of sum lambda^(n-i) e[i]^2. It converges in
 * about 2N samples rather than the thousands LMS needs, and it costs O(N^2) per
 * sample instead of O(N). `delta` sets the initial P = I/delta, and a small
 * delta means a confident, fast, and initially noisy start.
 */
export function makeRls({ taps, lambda = 0.999, delta = 0.01 }) {
  const N = Math.max(1, Math.round(taps))
  const w = new Float64Array(N)
  const line = new Float64Array(N)
  const P = []
  for (let i = 0; i < N; i++) {
    const row = new Float64Array(N)
    row[i] = 1 / delta
    P.push(row)
  }
  const k = new Float64Array(N)
  const Px = new Float64Array(N)
  return {
    w,
    update(x, d) {
      for (let i = N - 1; i > 0; i--) line[i] = line[i - 1]
      line[0] = x

      // Px = P u, then the gain k = Px / (lambda + u' P u).
      let denom = lambda
      for (let i = 0; i < N; i++) {
        let acc = 0
        const row = P[i]
        for (let j = 0; j < N; j++) acc += row[j] * line[j]
        Px[i] = acc
      }
      for (let i = 0; i < N; i++) denom += line[i] * Px[i]
      for (let i = 0; i < N; i++) k[i] = Px[i] / denom

      let y = 0
      for (let i = 0; i < N; i++) y += w[i] * line[i]
      const e = d - y
      for (let i = 0; i < N; i++) w[i] += k[i] * e

      // P <- (P - k (P u)') / lambda, symmetrised so rounding cannot make it
      // asymmetric and then indefinite, which is how an RLS blows up.
      for (let i = 0; i < N; i++) {
        const row = P[i]
        for (let j = 0; j < N; j++) row[j] = (row[j] - k[i] * Px[j]) / lambda
      }
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const m = (P[i][j] + P[j][i]) / 2
          P[i][j] = m
          P[j][i] = m
        }
      }
      return { y, e }
    },
  }
}

export const ADAPTIVE_ALGORITHMS = ['lms', 'nlms', 'rls']

/** One of the three, by name. */
export function makeAdaptive({ algorithm = 'lms', taps, mu = 0.01, leak = 0, eps = 1e-6, lambda = 0.999, delta = 0.01 }) {
  if (algorithm === 'nlms') return makeNlms({ taps, mu, eps })
  if (algorithm === 'rls') return makeRls({ taps, lambda, delta })
  return makeLms({ taps, mu, leak })
}

/**
 * Run an adaptive filter over a whole signal and keep everything the views need.
 *
 * Returns the output, the error, the final weights, and `history`: the weight
 * vector at every `stride`-th sample. That array is the honest description of a
 * time-varying filter. Each row is an FIR with its own response, and watching
 * the rows arrive at the plant's taps is what convergence looks like.
 *
 * `plant` is the unknown system the filter is trying to match. `noise` is added
 * to the wanted signal, and it is the floor the error cannot go below: a filter
 * cannot cancel what is not correlated with its input.
 */
export function runAdaptive({ x, plant, algorithm = 'lms', taps, mu = 0.01, lambda = 0.999, delta = 0.01, eps = 1e-6, leak = 0, noise = null, stride = 1 }) {
  const N = Math.max(1, Math.round(taps))
  const f = makeAdaptive({ algorithm, taps: N, mu, leak, eps, lambda, delta })
  const n = x.length
  const y = new Float64Array(n)
  const e = new Float64Array(n)
  const d = new Float64Array(n)
  const history = []
  const P = plant.length
  for (let i = 0; i < n; i++) {
    let want = 0
    for (let k = 0; k < P; k++) {
      const j = i - k
      if (j < 0) break
      want += plant[k] * x[j]
    }
    if (noise) want += noise[i]
    d[i] = want
    // Recorded BEFORE the update, so history[0] is the vector the run started
    // from. A row is then the filter that produced that sample's output, which
    // is what a view stepping through the run needs.
    if (i % stride === 0) history.push(Float64Array.from(f.w))
    const r = f.update(x[i], want)
    y[i] = r.y
    e[i] = r.e
  }
  history.push(Float64Array.from(f.w))
  return { y, e, d, w: Float64Array.from(f.w), history, stride }
}

/**
 * The distance from the current weights to a target vector, as a fraction of the
 * target's own size. Zero is an exact match, and this is what a convergence
 * curve plots.
 */
export function weightError(w, target) {
  let num = 0
  let den = 0
  const n = Math.max(w.length, target.length)
  for (let i = 0; i < n; i++) {
    const a = i < w.length ? w[i] : 0
    const b = i < target.length ? target[i] : 0
    num += (a - b) * (a - b)
    den += b * b
  }
  return den > 0 ? Math.sqrt(num / den) : Math.sqrt(num)
}

/** Mean square of the last `n` samples of a signal, the settled error power. */
export function tailPower(buf, n) {
  const start = Math.max(0, buf.length - n)
  let acc = 0
  for (let i = start; i < buf.length; i++) acc += buf[i] * buf[i]
  return acc / Math.max(1, buf.length - start)
}
