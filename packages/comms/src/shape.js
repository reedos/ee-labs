// Pulse shapers, as kernels for `makeFir` in @ee-labs/dsp.
//
// A pulse shaper is an ordinary FIR block. It has a response, a group delay and
// a set of zeros, and Signal Lab's z-plane view draws all three unchanged. This
// file builds the kernels and measures what truncating them leaves behind.
//
// The raised cosine is exact at the symbol instants and carries no hedge. The
// root raised cosine pair is exact in continuous time and truncated in the app,
// so it carries the guard CORE_SCOPE Rule 3 requires. `residualIsi` is that
// guard, and `SPAN_GUARD` is its threshold.

/** Below this span the pane warns, because 4.76e-2 of ISI is visible in the eye. */
export const SPAN_GUARD = 6

export const SHAPES = ['rc', 'rrc', 'rect']

export const SHAPE_NAMES = {
  rc: 'Raised cosine',
  rrc: 'Root raised cosine',
  rect: 'Rectangular',
}

/**
 * The raised cosine at `t` symbol periods.
 *
 * At `t = 0` it is 1 and at every other integer it is 0, which is Nyquist's
 * criterion in the time domain. Two removable singularities are handled by
 * their limits: `t = 0`, and `|2 beta t| = 1` where the denominator vanishes.
 */
export function raisedCosine(t, beta) {
  if (Math.abs(t) < 1e-12) return 1
  if (beta > 0 && Math.abs(Math.abs(2 * beta * t) - 1) < 1e-9) {
    const a = Math.PI / (2 * beta)
    return (Math.PI / 4) * (Math.sin(a) / a)
  }
  const s = Math.sin(Math.PI * t) / (Math.PI * t)
  return (s * Math.cos(Math.PI * beta * t)) / (1 - (2 * beta * t) ** 2)
}

/**
 * The root raised cosine at `t` symbol periods.
 *
 * Its own samples at the symbol instants are not zero. Only the cascade of two
 * of them is a Nyquist pulse, which is the fact C6 is about.
 */
export function rootRaisedCosine(t, beta) {
  if (Math.abs(t) < 1e-12) return 1 - beta + (4 * beta) / Math.PI
  if (beta > 0 && Math.abs(Math.abs(4 * beta * t) - 1) < 1e-9) {
    const a = (1 + 2 / Math.PI) * Math.sin(Math.PI / (4 * beta))
    const b = (1 - 2 / Math.PI) * Math.cos(Math.PI / (4 * beta))
    return (beta / Math.SQRT2) * (a + b)
  }
  const num =
    Math.sin(Math.PI * t * (1 - beta)) + 4 * beta * t * Math.cos(Math.PI * t * (1 + beta))
  const den = Math.PI * t * (1 - (4 * beta * t) ** 2)
  return num / den
}

/**
 * A shaping kernel, `span * sps + 1` taps, normalised to unit energy.
 *
 * Unit energy rather than unit peak, because the matched filter's output ratio
 * is `2E/N0` and a kernel of unit energy makes that reading direct.
 */
export function shapeTaps({ kind = 'rrc', beta = 0.35, span = 12, sps = 8 }) {
  if (kind === 'rect') {
    const h = new Float64Array(sps).fill(1 / Math.sqrt(sps))
    return h
  }
  const n = span * sps + 1
  const h = new Float64Array(n)
  const f = kind === 'rc' ? raisedCosine : rootRaisedCosine
  for (let i = 0; i < n; i++) h[i] = f((i - (n - 1) / 2) / sps, beta)
  let e = 0
  for (let i = 0; i < n; i++) e += h[i] * h[i]
  const s = 1 / Math.sqrt(e)
  for (let i = 0; i < n; i++) h[i] *= s
  return h
}

/** The full convolution of two kernels. */
export function convolve(a, b) {
  const out = new Float64Array(a.length + b.length - 1)
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j]
  }
  return out
}

/**
 * What a truncated root raised cosine pair leaves behind, measured three ways.
 *
 * The three differ by more than an order of magnitude at a span of 12, so a
 * pane that prints one of them names which.
 *
 *   near  the largest residual from the two nearest neighbours on each side.
 *         This is the interference a two-period eye shows, it falls with the
 *         span, and it is the figure the plan quotes.
 *   peak  the largest over every non-zero symbol lag. Its worst lag is the
 *         truncation edge at half the span, where the two windows half overlap,
 *         and it does not fall with the span.
 *   sum   the peak distortion, every residual added, which is the worst case a
 *         random stream can produce at the decision instant.
 */
export function residualIsi(h, sps, near = 2) {
  const c = convolve(h, h)
  const mid = (c.length - 1) / 2
  const peakTap = c[mid]
  const lags = Math.floor(mid / sps)
  let nearMax = 0
  let peakMax = 0
  let sum = 0
  const taps = new Float64Array(lags)
  for (let k = 1; k <= lags; k++) {
    const v = Math.abs(c[mid + k * sps] / peakTap)
    taps[k - 1] = v
    sum += 2 * v
    if (v > peakMax) peakMax = v
    if (k <= near && v > nearMax) nearMax = v
  }
  return { near: nearMax, peak: peakMax, sum, taps, lags }
}

/** The baseband bandwidth of the shaped signal, `(1 + beta) Rs / 2`. */
export function shapedBandwidth(beta, symbolRate) {
  return ((1 + beta) * symbolRate) / 2
}

/**
 * The worst-case peak of a shaped random stream, over the whole symbol.
 *
 * At `beta = 0` the raised cosine's tail decays as `1/t`, so the sum of its
 * absolute values over a long stream is large and grows with the window. C3 is
 * that fact, and the window it is measured over is stated with the number.
 */
export function streamPeak(beta, window = 40, steps = 200) {
  let best = 0
  for (let i = 0; i <= steps; i++) {
    const t = i / (2 * steps)
    let s = 0
    for (let k = -window; k <= window; k++) s += Math.abs(raisedCosine(t + k, beta))
    if (s > best) best = s
  }
  return { peak: best, db: 20 * Math.log10(best), window }
}

/**
 * The worst-case eye opening at a timing offset of `eps` symbol periods.
 *
 * The wanted sample less every interfering one, taken with the sign that hurts
 * most. A negative answer means the eye is closed, which is what happens at
 * `beta = 0` and an offset of 0.20 T.
 */
export function eyeOpening(beta, eps, window = 40) {
  let isi = 0
  for (let k = -window; k <= window; k++) {
    if (k === 0) continue
    isi += Math.abs(raisedCosine(k + eps, beta))
  }
  return Math.abs(raisedCosine(eps, beta)) - isi
}
