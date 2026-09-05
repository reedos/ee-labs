import { designFir, firResponse, sinc } from './fir.js'
import { windowFn } from './spectrum.js'

// Designing a filter to a written specification, and measuring what came back.
//
// The first course chooses a filter and looks at what it does. The second one
// starts from four numbers — passband edge, stopband edge, ripple allowed in the
// passband, attenuation required in the stopband — and produces the cheapest
// filter that meets them. Everything here is one of three routes to that:
//
//   - The window method. Truncate the ideal sinc and taper it. The transition
//     width is set by the window and the length, and the stopband depth by the
//     window alone. Adding taps narrows the transition and does not deepen the
//     stopband, which is the fact the window table below makes checkable.
//   - Parks-McClellan (Remez exchange). The best possible Chebyshev fit for a
//     given length: the error ripples between equal bounds and touches them
//     M+2 times. It reaches a given specification in fewer taps than any window.
//   - The bilinear transform of an analog prototype. An IIR filter, so it meets
//     the same specification in a fraction of the coefficients, and pays for it
//     with phase that is not linear.
//
// Every design function returns the filter and, beside it, what it actually
// achieves at each band edge. A design that misses its specification reports the
// miss rather than returning quietly.

// ----------------------------------------------------------------- windows

/**
 * The design estimates for the four windows: transition width as a multiple of
 * fs/N, and the stopband attenuation the window can reach.
 *
 * These are the textbook constants, and they are estimates rather than
 * identities. `measureFir` returns what a particular design achieved, and the
 * two are printed side by side wherever a lesson quotes either.
 *
 * The second column is the one worth reading twice. It does not depend on N at
 * all, so a rectangular window is stuck at about 21 dB whether it holds 11 taps
 * or 1001.
 */
export const WINDOW_SPECS = {
  none: { transition: 0.9, stopbandDb: 21, label: 'Rectangular' },
  hann: { transition: 3.1, stopbandDb: 44, label: 'Hann' },
  hamming: { transition: 3.3, stopbandDb: 53, label: 'Hamming' },
  blackman: { transition: 5.5, stopbandDb: 74, label: 'Blackman' },
}

/** The transition width in hertz that `window` and `taps` are estimated to give. */
export function windowTransition(window, taps, sampleRate) {
  const spec = WINDOW_SPECS[window]
  if (!spec) throw new Error(`unknown window: ${window}`)
  return (spec.transition * sampleRate) / Math.max(1, Math.round(taps))
}

/** The taps that window needs for a transition width of `widthHz`. */
export function windowTaps(window, widthHz, sampleRate) {
  const spec = WINDOW_SPECS[window]
  if (!spec) throw new Error(`unknown window: ${window}`)
  const n = Math.ceil((spec.transition * sampleRate) / widthHz)
  return n % 2 === 0 ? n + 1 : n
}

/**
 * The same windowed sinc `designFir` builds, without the interactive block's
 * length limit.
 *
 * `designFir` clamps at 201 taps, which is the right ceiling for a control a
 * reader drags. Designing to a written specification is not that: a Blackman
 * window at a 1 kHz transition and 48 kHz needs 265 taps before the passband
 * edge is even inside its tolerance, and a design that silently stopped at 201
 * would report a miss that is the clamp's rather than the window's. Below 202
 * taps the two functions return the same kernel to the last bit, and a test
 * pins that.
 */
export function windowedSinc({ mode = 'lowpass', taps = 31, freq = 1000, window = 'hamming' }, sampleRate) {
  let N = Math.max(3, Math.round(taps))
  if (N % 2 === 0) N += 1
  const M = (N - 1) / 2
  const fc = Math.min(Math.max(freq, 1), sampleRate * 0.499)
  const fn = fc / sampleRate
  const w = windowFn(window, N)
  const h = new Float64Array(N)
  let sum = 0
  for (let k = 0; k < N; k++) {
    h[k] = 2 * fn * sinc(2 * fn * (k - M)) * w[k]
    sum += h[k]
  }
  if (sum !== 0) for (let k = 0; k < N; k++) h[k] /= sum
  if (mode === 'highpass') {
    for (let k = 0; k < N; k++) h[k] = -h[k]
    h[M] += 1
  }
  return h
}

// ------------------------------------------------------- measuring a design

/**
 * What a low-pass FIR actually does, measured rather than predicted.
 *
 * `fpass` is where the response first leaves the passband tolerance. `fstop` is
 * the lowest frequency above which it stays below the stopband limit for the
 * rest of the band, so a sidelobe that climbs back over the limit further up
 * pushes the edge out rather than being missed. The width between them is the
 * transition the window table estimates.
 *
 * `rippleDb` is the peak-to-peak variation inside the measured passband.
 */
export function measureFir(h, sampleRate, { passDb = 1, stopDb = 40, points = 4001 } = {}) {
  const nyq = sampleRate / 2
  const passLimit = Math.pow(10, -passDb / 20)
  const stopLimit = Math.pow(10, -stopDb / 20)
  const mag = new Float64Array(points)
  const freq = new Float64Array(points)
  for (let i = 0; i < points; i++) {
    freq[i] = (i * nyq) / (points - 1)
    mag[i] = firResponse(h, freq[i], sampleRate)
  }

  let fpass = 0
  for (let i = 0; i < points; i++) {
    if (mag[i] < passLimit) {
      fpass = freq[i]
      break
    }
  }
  // Walk down from Nyquist: the stopband edge is just above the highest point
  // that still breaks the limit.
  let fstop = fpass
  for (let i = points - 1; i >= 0; i--) {
    if (mag[i] >= stopLimit) {
      fstop = freq[Math.min(points - 1, i + 1)]
      break
    }
  }

  let hi = 0
  let lo = Infinity
  for (let i = 0; i < points && freq[i] <= fpass; i++) {
    hi = Math.max(hi, mag[i])
    lo = Math.min(lo, mag[i])
  }
  return {
    fpass,
    fstop,
    transition: Math.max(0, fstop - fpass),
    rippleDb: 20 * Math.log10(Math.max(1e-300, hi / Math.max(1e-300, lo))),
    taps: h.length,
  }
}

/**
 * The worst response anywhere above `edge`, in decibels below the passband.
 *
 * This is the number the window table's second column estimates, and it is the
 * one that does not improve with length. Measured over a dense grid, because a
 * sidelobe peak sits between the grid points a coarse sweep would use.
 */
export function stopbandDepth(h, edge, sampleRate, { points = 4001 } = {}) {
  const nyq = sampleRate / 2
  let worst = 0
  for (let i = 0; i < points; i++) {
    const f = edge + ((nyq - edge) * i) / (points - 1)
    worst = Math.max(worst, firResponse(h, f, sampleRate))
  }
  return -20 * Math.log10(Math.max(1e-300, worst))
}

// -------------------------------------------------------- the specification

/**
 * A specification is a list of bands. Each band names a frequency range and a
 * bound on the magnitude in it, in dB relative to the filter's reference gain.
 *
 *   { id, label, from, to, max, min }
 *
 * `max` alone is a stopband. `max` and `min` together are a passband with its
 * ripple. Either may be null, which means unbounded on that side.
 *
 * The shape is deliberately not about filters. A band is a range of an
 * independent variable and a bound on a measured quantity, which is what a
 * gain-versus-frequency mask, a noise mask and a supply-rejection mask all are.
 * The Applied Analog Lab's masks are the same object with a different unit.
 */
export function specMargin(bands, evaluate, { points = 257, refDb = 0 } = {}) {
  // A design search that grows an order until the specification is met lands
  // exactly on a band edge, where the margin is zero and float64 puts it a
  // femto-decibel either side. The tolerance is that rounding and nothing more.
  const EPS_DB = 1e-9
  const out = []
  for (const band of bands) {
    const n = Math.max(2, points)
    let maxDb = -Infinity
    let minDb = Infinity
    let atMax = band.from
    let atMin = band.from
    for (let i = 0; i < n; i++) {
      const f = band.from + ((band.to - band.from) * i) / (n - 1)
      const db = 20 * Math.log10(Math.max(1e-300, evaluate(f))) - refDb
      if (db > maxDb) {
        maxDb = db
        atMax = f
      }
      if (db < minDb) {
        minDb = db
        atMin = f
      }
    }
    const upper = band.max == null ? Infinity : band.max - maxDb
    const lower = band.min == null ? Infinity : minDb - band.min
    const marginDb = Math.min(upper, lower)
    out.push({
      id: band.id,
      label: band.label,
      from: band.from,
      to: band.to,
      max: band.max ?? null,
      min: band.min ?? null,
      maxDb,
      minDb,
      atHz: upper <= lower ? atMax : atMin,
      marginDb,
      met: marginDb >= -EPS_DB,
    })
  }
  const worst = out.reduce((a, b) => (b.marginDb < a.marginDb ? b : a), out[0] ?? null)
  return { bands: out, met: out.every((b) => b.met), worstDb: worst ? worst.marginDb : Infinity, worst }
}

/**
 * The four numbers of a low-pass specification, as the band list above.
 *
 * `ripplePassDb` is the peak-to-peak allowance in the passband and `stopDb` the
 * attenuation required above the stopband edge. The transition band carries no
 * bound, which is what makes it a transition band.
 */
export function lowpassSpec({ fpass, fstop, ripplePassDb = 1, stopDb = 40 }, sampleRate) {
  return [
    { id: 'pass', label: 'Passband', from: 0, to: fpass, max: 0, min: -ripplePassDb },
    { id: 'stop', label: 'Stopband', from: fstop, to: sampleRate / 2, max: -stopDb, min: null },
  ]
}

/**
 * The passband peak in decibels, which every bound is measured from.
 *
 * A specification says the passband may vary by 1 dB and the stopband must be
 * 60 dB below it. Both bounds are relative to the passband's own top, so the
 * reference is measured rather than assumed to be unity. A Chebyshev's ripple
 * hangs below its peak and a windowed sinc's straddles unity, and referring both
 * to the peak is what makes them comparable against one specification.
 */
export function passbandRefDb(bands, evaluate, { points = 257 } = {}) {
  const band = bands.find((b) => b.min != null) ?? bands[0]
  let peak = 0
  for (let i = 0; i < points; i++) {
    const f = band.from + ((band.to - band.from) * i) / (points - 1)
    peak = Math.max(peak, evaluate(f))
  }
  return 20 * Math.log10(Math.max(1e-300, peak))
}

/** `specMargin`, with the passband peak taken as the reference. */
export function specMarginRef(bands, evaluate, opts = {}) {
  return specMargin(bands, evaluate, { ...opts, refDb: passbandRefDb(bands, evaluate, opts) })
}

/**
 * Kaiser's estimate of the taps a Parks-McClellan design needs.
 *
 *   N = (-20 log10 sqrt(dp ds) - 13) / (14.6 df) + 1,  df = (fstop - fpass)/fs
 *
 * An estimate, and labelled as one everywhere it appears. `designRemezSpec`
 * starts here and then adds taps until the specification is met, so the number
 * a lesson quotes is the length that was verified rather than the one predicted.
 */
export function remezOrder({ fpass, fstop, ripplePassDb = 1, stopDb = 40 }, sampleRate) {
  const dp = (Math.pow(10, ripplePassDb / 20) - 1) / (Math.pow(10, ripplePassDb / 20) + 1)
  const ds = Math.pow(10, -stopDb / 20)
  const df = (fstop - fpass) / sampleRate
  const n = (-20 * Math.log10(Math.sqrt(dp * ds)) - 13) / (14.6 * df) + 1
  const taps = Math.max(3, Math.ceil(n))
  return { taps: taps % 2 === 0 ? taps + 1 : taps, dp, ds, df }
}

// ------------------------------------------------------- the window method

/**
 * A windowed-sinc low-pass designed to a specification.
 *
 * The cutoff goes in the middle of the transition band, which is where a windowed
 * sinc puts its half-amplitude point, and the length comes from the window's
 * transition constant. The design is then measured, and taps are added until the
 * specification is met or `maxTaps` is reached.
 *
 * Returns the filter, the length the estimate asked for, the length that worked,
 * and the margin at every band edge. A window whose stopband constant is below
 * the requirement can never meet it at any length, and that case comes back with
 * `met: false` and the reason.
 */
export function designFirSpec(
  { fpass, fstop, ripplePassDb = 1, stopDb = 40, window = 'hamming', maxTaps = 501 },
  sampleRate,
) {
  const spec = lowpassSpec({ fpass, fstop, ripplePassDb, stopDb }, sampleRate)
  const fc = (fpass + fstop) / 2
  const estimate = windowTaps(window, fstop - fpass, sampleRate)
  const reachable = WINDOW_SPECS[window].stopbandDb >= stopDb

  let taps = Math.max(3, estimate)
  let h = windowedSinc({ mode: 'lowpass', taps, freq: fc, window }, sampleRate)
  let margin = specMarginRef(spec, (f) => firResponse(h, f, sampleRate))
  let grew = 0
  while (!margin.met && taps + 2 <= maxTaps && reachable) {
    taps += 2
    grew++
    h = windowedSinc({ mode: 'lowpass', taps, freq: fc, window }, sampleRate)
    margin = specMarginRef(spec, (f) => firResponse(h, f, sampleRate))
  }
  return {
    h,
    taps: h.length,
    window,
    fc,
    estimateTaps: estimate,
    grew,
    reachable,
    reason: reachable
      ? null
      : `${WINDOW_SPECS[window].label} reaches about ${WINDOW_SPECS[window].stopbandDb} dB at any length, and this specification asks for ${stopDb} dB`,
    spec,
    margin,
    met: margin.met,
  }
}

// -------------------------------------------------- Parks-McClellan (Remez)

/** Solve A x = b, returning null on a singular system. */
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
  return M.map((row) => row[n])
}

/**
 * Parks-McClellan by the Remez exchange, for a Type I (odd length, symmetric)
 * linear-phase FIR.
 *
 * The amplitude of such a filter is A(w) = sum_{k=0}^{M} a_k cos(k w), a real
 * function of frequency with the delay already taken out. The design problem is
 * then a Chebyshev approximation: choose the a_k so the weighted error
 * W(w)(D(w) - A(w)) has the smallest possible peak.
 *
 * The alternation theorem says the answer is the one whose error reaches that
 * peak, with alternating signs, at M+2 frequencies. So the algorithm is: guess
 * M+2 frequencies, solve for the a_k and the peak d that make the error exactly
 * +d, -d, +d, ... there, look at where the error is actually largest, and move
 * the guesses to those points. Two or three passes is usually enough.
 *
 * `bands` is a list of `{ from, to, gain, weight }` in hertz. Bands must not
 * overlap, and the gaps between them are transition bands with no constraint.
 *
 * Returns `{ h, delta, iterations, converged, extremals }`. `delta` is the peak
 * weighted error, so a stopband of weight 1 comes back at 20 log10(delta) dB.
 */
export function remez({ bands, taps, gridDensity = 20, maxIter = 40, tol = 1e-8 }, sampleRate) {
  const N = Math.max(3, Math.round(taps) % 2 === 0 ? Math.round(taps) + 1 : Math.round(taps))
  const M = (N - 1) / 2
  const r = M + 2 // unknowns: a_0..a_M and delta

  // The grid, in radians per sample, with every band edge on it exactly.
  const grid = []
  const des = []
  const wt = []
  const bandOf = []
  const total = gridDensity * (M + 1)
  const span = bands.reduce((s, b) => s + (b.to - b.from), 0)
  bands.forEach((band, bi) => {
    const n = Math.max(3, Math.round((total * (band.to - band.from)) / span))
    for (let i = 0; i < n; i++) {
      const f = band.from + ((band.to - band.from) * i) / (n - 1)
      grid.push((2 * Math.PI * f) / sampleRate)
      des.push(band.gain)
      wt.push(band.weight ?? 1)
      bandOf.push(bi)
    }
  })
  const L = grid.length

  // Start with M+2 points spread evenly over the grid.
  let ext = []
  for (let i = 0; i < r; i++) ext.push(Math.round((i * (L - 1)) / (r - 1)))

  let a = null
  let delta = 0
  let iterations = 0
  let converged = false

  for (; iterations < maxIter; iterations++) {
    const A = []
    const b = []
    for (let i = 0; i < r; i++) {
      const w = grid[ext[i]]
      const row = new Array(r)
      for (let k = 0; k <= M; k++) row[k] = Math.cos(k * w)
      row[r - 1] = (i % 2 === 0 ? 1 : -1) / wt[ext[i]]
      A.push(row)
      b.push(des[ext[i]])
    }
    const sol = gauss(A, b)
    if (!sol) break
    a = sol.slice(0, M + 1)
    delta = sol[r - 1]

    // The weighted error over the whole grid.
    const err = new Float64Array(L)
    for (let i = 0; i < L; i++) {
      let amp = 0
      for (let k = 0; k <= M; k++) amp += a[k] * Math.cos(k * grid[i])
      err[i] = wt[i] * (des[i] - amp)
    }

    // Every local extremum of the error, band edges included.
    const cand = []
    for (let i = 0; i < L; i++) {
      // A band edge has no neighbour on the far side, and every band edge is a
      // candidate: the error at the edge of a stopband is where a design that
      // misses its specification misses it.
      const left = i === 0 || bandOf[i - 1] !== bandOf[i] ? null : err[i - 1]
      const right = i === L - 1 || bandOf[i + 1] !== bandOf[i] ? null : err[i + 1]
      const e = err[i]
      // A band edge is always a candidate. The error there need not be a local
      // maximum, and the alternation theorem still allows it to carry one of the
      // M+2 alternations. Leaving edges out cost one alternation on every
      // two-band design and stalled the exchange after a single pass.
      const edge = left == null || right == null
      const isPeak =
        edge ||
        (Math.abs(e) >= Math.abs(left) &&
          Math.abs(e) >= Math.abs(right) &&
          (e - left) * (e - right) >= 0)
      if (isPeak && Math.abs(e) > 0) cand.push(i)
    }

    // Collapse runs of the same sign, keeping the largest of each run.
    const kept = []
    for (const i of cand) {
      const last = kept[kept.length - 1]
      if (last != null && Math.sign(err[i]) === Math.sign(err[last])) {
        if (Math.abs(err[i]) > Math.abs(err[last])) kept[kept.length - 1] = i
      } else kept.push(i)
    }
    // Too many alternations: drop from whichever end carries the smaller error.
    while (kept.length > r) {
      if (Math.abs(err[kept[0]]) < Math.abs(err[kept[kept.length - 1]])) kept.shift()
      else kept.pop()
    }
    if (kept.length < r) break

    let peak = 0
    for (const i of kept) peak = Math.max(peak, Math.abs(err[i]))
    if (peak > 0 && (peak - Math.abs(delta)) / peak < tol) {
      ext = kept
      converged = true
      iterations++
      break
    }
    ext = kept
  }

  if (!a) return { h: designFir({ mode: 'lowpass', taps: N, freq: sampleRate / 4 }, sampleRate), delta: NaN, iterations, converged: false, extremals: [] }

  // a_k are the cosine coefficients; the impulse response is symmetric about M.
  const h = new Float64Array(N)
  h[M] = a[0]
  for (let k = 1; k <= M; k++) {
    h[M - k] = a[k] / 2
    h[M + k] = a[k] / 2
  }
  return {
    h,
    delta: Math.abs(delta),
    iterations,
    converged,
    extremals: ext.map((i) => (grid[i] * sampleRate) / (2 * Math.PI)),
  }
}

/**
 * A Parks-McClellan low-pass designed to a specification, starting from Kaiser's
 * estimate and growing until the specification is met.
 *
 * The weights carry the ripple ratio. Asking for 1 dB of passband ripple and
 * 40 dB of stopband means the stopband error must be dp/ds times smaller, so the
 * stopband weight is that ratio and the equiripple design splits its error the
 * way the specification asks.
 */
export function designRemezSpec(
  { fpass, fstop, ripplePassDb = 1, stopDb = 40, maxTaps = 401 },
  sampleRate,
) {
  const spec = lowpassSpec({ fpass, fstop, ripplePassDb, stopDb }, sampleRate)
  const { taps: estimateTaps, dp, ds } = remezOrder({ fpass, fstop, ripplePassDb, stopDb }, sampleRate)
  const bands = [
    { from: 0, to: fpass, gain: 1, weight: 1 },
    { from: fstop, to: sampleRate / 2, gain: 0, weight: dp / ds },
  ]

  let taps = Math.max(3, estimateTaps)
  let out = remez({ bands, taps }, sampleRate)
  let margin = specMarginRef(spec, (f) => firResponse(out.h, f, sampleRate))
  let grew = 0
  while (!margin.met && taps + 2 <= maxTaps) {
    taps += 2
    grew++
    out = remez({ bands, taps }, sampleRate)
    margin = specMarginRef(spec, (f) => firResponse(out.h, f, sampleRate))
  }
  return { ...out, taps: out.h.length, estimateTaps, grew, spec, margin, met: margin.met, bands }
}

// ------------------------------------------ analog prototypes and bilinear

/**
 * The poles of a normalised analog low-pass prototype, cutoff at 1 rad/s.
 *
 * Butterworth: n poles evenly spaced on the left half of the unit circle. The
 * magnitude is maximally flat at DC, meaning its first 2n-1 derivatives there
 * are zero, and it is 3.01 dB down at 1 rad/s for every order.
 *
 * Chebyshev type I: the same angles, squashed onto an ellipse. The passband
 * ripples between 1 and 1/sqrt(1+eps^2) and the stopband falls faster than a
 * Butterworth of the same order. That is the trade the two prototypes make, and
 * it is the whole reason for having both.
 */
export function analogPrototype({ type = 'butterworth', order = 4, rippleDb = 1 }) {
  const n = Math.max(1, Math.round(order))
  const poles = []
  if (type === 'butterworth') {
    for (let k = 0; k < n; k++) {
      const th = ((2 * k + 1) * Math.PI) / (2 * n)
      poles.push([-Math.sin(th), Math.cos(th)])
    }
    return { poles, dcGain: 1, type, order: n }
  }
  if (type === 'chebyshev1') {
    const eps = Math.sqrt(Math.pow(10, rippleDb / 10) - 1)
    const v0 = Math.asinh(1 / eps) / n
    const sh = Math.sinh(v0)
    const ch = Math.cosh(v0)
    for (let k = 0; k < n; k++) {
      const th = ((2 * k + 1) * Math.PI) / (2 * n)
      poles.push([-sh * Math.sin(th), ch * Math.cos(th)])
    }
    // An even-order Chebyshev starts the ripple at the bottom of the band, so
    // its DC gain is the ripple floor rather than one.
    return { poles, dcGain: n % 2 === 0 ? 1 / Math.sqrt(1 + eps * eps) : 1, type, order: n, eps }
  }
  throw new Error(`unknown prototype: ${type}`)
}

/** The order each prototype needs for a low-pass specification. */
export function iirOrderFor(
  { fpass, fstop, ripplePassDb = 1, stopDb = 40, type = 'butterworth' },
  sampleRate,
) {
  // Prewarped analog edges, because the bilinear transform is what will be used.
  const wp = 2 * sampleRate * Math.tan((Math.PI * fpass) / sampleRate)
  const ws = 2 * sampleRate * Math.tan((Math.PI * fstop) / sampleRate)
  const ep2 = Math.pow(10, ripplePassDb / 10) - 1
  const es2 = Math.pow(10, stopDb / 10) - 1
  const ratio = Math.sqrt(es2 / ep2)
  const n =
    type === 'butterworth'
      ? Math.log(ratio) / Math.log(ws / wp)
      : Math.acosh(ratio) / Math.acosh(ws / wp)
  return { order: Math.max(1, Math.ceil(n)), exact: n, wp, ws }
}

/**
 * An IIR low-pass or high-pass by the bilinear transform, as a cascade of the
 * same `{b0,b1,b2,a1,a2}` sections every other part of this package uses.
 *
 * Three steps, each exact. Prewarp the digital corner to the analog frequency
 * that the transform will map back onto it: Wc = 2 fs tan(pi fc / fs). Scale the
 * prototype poles to Wc, and for a high-pass invert them, which is the standard
 * low-pass to high-pass transform. Then map each analog pole p to the digital
 * pole (2fs + p)/(2fs - p) and put the prototype's zeros where the transform
 * sends infinity, which is z = -1 for a low-pass and z = +1 for a high-pass.
 *
 * The result is a rational H(z) with real coefficients, so it is admitted
 * exactly and carries no hedge. The only approximation in the chain is the
 * prototype's own shape, and that is a choice of filter rather than a numerical
 * step.
 */
export function designIir(
  { type = 'butterworth', mode = 'lowpass', order = 4, freq = 1000, rippleDb = 1 },
  sampleRate,
) {
  const proto = analogPrototype({ type, order, rippleDb })
  const fc = Math.min(Math.max(freq, 1e-6), sampleRate * 0.499)
  const Wc = 2 * sampleRate * Math.tan((Math.PI * fc) / sampleRate)
  const K = 2 * sampleRate

  // Scale (low-pass) or invert and scale (high-pass).
  const analog = proto.poles.map(([re, im]) => {
    if (mode === 'lowpass') return [re * Wc, im * Wc]
    const d = re * re + im * im
    return [(Wc * re) / d, (-Wc * im) / d]
  })

  // Bilinear each pole.
  const zp = analog.map(([re, im]) => {
    const nr = K + re
    const ni = im
    const dr = K - re
    const di = -im
    const den = dr * dr + di * di
    return [(nr * dr + ni * di) / den, (ni * dr - nr * di) / den]
  })

  // Pair conjugates, leaving at most one real pole.
  const pairs = []
  const reals = []
  const used = new Array(zp.length).fill(false)
  for (let i = 0; i < zp.length; i++) {
    if (used[i]) continue
    if (Math.abs(zp[i][1]) < 1e-12) {
      used[i] = true
      reals.push(zp[i][0])
      continue
    }
    let best = -1
    for (let j = i + 1; j < zp.length; j++) {
      if (used[j]) continue
      if (Math.abs(zp[j][0] - zp[i][0]) < 1e-9 && Math.abs(zp[j][1] + zp[i][1]) < 1e-9) {
        best = j
        break
      }
    }
    used[i] = true
    if (best >= 0) {
      used[best] = true
      pairs.push(zp[i])
    } else reals.push(zp[i][0])
  }

  const zeroAt = mode === 'lowpass' ? -1 : 1
  const sections = []
  for (const [re, im] of pairs) {
    const a1 = -2 * re
    const a2 = re * re + im * im
    // Zeros: both at z = zeroAt, so the numerator is (1 - zeroAt z^-1)^2.
    const n0 = 1
    const n1 = -2 * zeroAt
    const n2 = zeroAt * zeroAt
    sections.push({ b0: n0, b1: n1, b2: n2, a1, a2 })
  }
  for (const re of reals) {
    sections.push({ b0: 1, b1: -zeroAt, b2: 0, a1: -re, a2: 0 })
  }

  // Normalise the gain where the filter is meant to pass: DC for a low-pass,
  // Nyquist for a high-pass. z = 1 and z = -1 respectively.
  const zEval = mode === 'lowpass' ? 1 : -1
  let g = 1
  for (const s of sections) {
    const num = s.b0 + s.b1 / zEval + s.b2 / (zEval * zEval)
    const den = 1 + s.a1 / zEval + s.a2 / (zEval * zEval)
    g *= num / den
  }
  const want = mode === 'lowpass' ? proto.dcGain : proto.dcGain
  const k = g === 0 ? 1 : want / g
  const first = sections[0]
  first.b0 *= k
  first.b1 *= k
  first.b2 *= k

  return sections
}

/**
 * An IIR designed to a low-pass specification, with the order that meets it.
 *
 * The estimated order comes from the prototype's own formula, and the design is
 * then measured against the same band list a windowed or equiripple FIR is
 * measured against. That is what makes the three routes comparable: one
 * specification, three filters, three coefficient counts.
 */
export function designIirSpec(
  { fpass, fstop, ripplePassDb = 1, stopDb = 40, type = 'butterworth', maxOrder = 24 },
  sampleRate,
  responseOf,
) {
  const spec = lowpassSpec({ fpass, fstop, ripplePassDb, stopDb }, sampleRate)
  const est = iirOrderFor({ fpass, fstop, ripplePassDb, stopDb, type }, sampleRate)

  // Where the corner goes is decided by the prototype rather than by taste. A
  // Chebyshev's ripple band ends exactly at its corner, so the corner is the
  // passband edge. A Butterworth is 3.01 dB down at its corner whatever the
  // order, so a corner at the passband edge would spend three decibels of a
  // one-decibel allowance. Its corner goes where the response is still inside
  // the allowance at the edge:
  //
  //   Wc = Wp / (10^(Ap/10) - 1)^(1/2n)
  //
  // That frequency depends on the order, so it is recomputed as the order grows.
  const corner = (order) => {
    if (type === 'chebyshev1') return fpass
    const wp = 2 * sampleRate * Math.tan((Math.PI * fpass) / sampleRate)
    const wc = wp / Math.pow(Math.pow(10, ripplePassDb / 10) - 1, 1 / (2 * order))
    return (sampleRate / Math.PI) * Math.atan(wc / (2 * sampleRate))
  }

  let order = Math.max(1, est.order)
  let fc = corner(order)
  let sections = designIir({ type, mode: 'lowpass', order, freq: fc, rippleDb: ripplePassDb }, sampleRate)
  let margin = specMarginRef(spec, (f) => responseOf(sections, f, sampleRate))
  let grew = 0
  while (!margin.met && order + 1 <= maxOrder) {
    order++
    grew++
    fc = corner(order)
    sections = designIir({ type, mode: 'lowpass', order, freq: fc, rippleDb: ripplePassDb }, sampleRate)
    margin = specMarginRef(spec, (f) => responseOf(sections, f, sampleRate))
  }
  return {
    sections,
    order,
    estimateOrder: est.order,
    grew,
    fc,
    coefficients: sections.length * 5,
    spec,
    margin,
    met: margin.met,
    type,
  }
}
