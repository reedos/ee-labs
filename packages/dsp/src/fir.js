import { windowFn } from './spectrum.js'

// Finite impulse response filters — the other half of the subject.
//
// Everything in biquad.js has feedback: each output sample is fed back into the
// next one, so the impulse response goes on forever and stability is a question
// you have to ask. An FIR has no feedback at all. Its output is a weighted sum
// of the last N inputs and nothing else:
//
//   y[n] = sum_k h[k] * x[n-k]
//
// which is the definition of convolution, and it is the whole filter. Three
// consequences follow immediately, and each is worth seeing rather than being
// told:
//
//   - It cannot be unstable. There is no pole to put anywhere; a bounded input
//     gives a bounded output for any coefficients whatsoever.
//   - It forgets completely after N samples. `settle` is exactly N-1, not an
//     estimate from a decay rate the way settleSamples() has to be for an IIR.
//   - If h is symmetric, the phase is EXACTLY linear, so every frequency is
//     delayed by the same (N-1)/2 samples. No IIR can do that, and it is the
//     reason FIRs are used where waveform shape matters.
//
// The cost is order: matching a 3-coefficient biquad's skirt can take a hundred
// taps. That trade is the point of having both in the same rack.

export const FIR_MODES = ['lowpass', 'highpass']

export const TAPS_MIN = 2
export const TAPS_MAX = 201

/** sin(pi x)/(pi x), with the removable singularity filled in. */
export function sinc(x) {
  if (x === 0) return 1
  const px = Math.PI * x
  return Math.sin(px) / px
}

/**
 * The N-tap moving average: h[k] = 1/N.
 *
 * The simplest filter that does anything, and the one whose response is worth
 * knowing by heart. Summing N samples and dividing puts an exact null wherever
 * a whole number of cycles fits in the window — at every multiple of fs/N — so
 * the nulls are evenly spaced and their positions are a property of N alone.
 */
export function movingAverage(taps) {
  const n = clampTaps(taps)
  return new Float64Array(n).fill(1 / n)
}

const clampTaps = (n) =>
  Math.max(TAPS_MIN, Math.min(TAPS_MAX, Math.round(Number(n) || TAPS_MIN)))

/** Force an odd length, so a symmetric kernel has a real centre tap. */
const oddTaps = (n) => {
  const c = clampTaps(n)
  return c % 2 === 0 ? c + 1 : c
}

/**
 * A windowed-sinc kernel, normalized to unit gain in the passband.
 *
 * The ideal low-pass is a rectangle in frequency, and the inverse transform of a
 * rectangle is a sinc that runs to infinity in both directions. You cannot have
 * that, so you cut it off — and cutting it off abruptly is itself a rectangular
 * window, whose leaky transform is what produces the ripple either side of the
 * corner. That ripple does not shrink as taps are added; it only gets narrower.
 * Gibbs again, and the same fix: taper the ends.
 *
 * The window choice is therefore not a detail. It is the transition-width versus
 * stopband-depth trade, and `window: 'none'` is worth clicking precisely because
 * it is the one that looks wrong.
 *
 * Length is forced odd so the kernel is Type I: symmetric about a real centre
 * tap, giving exactly linear phase and an INTEGER group delay of (N-1)/2.
 */
export function designFir({ mode = 'lowpass', taps = 31, freq = 1000, window = 'hamming' }, sampleRate) {
  const N = oddTaps(taps)
  const M = (N - 1) / 2
  // Away from the edges by a hair: fc = 0 or fc = fs/2 gives an all-zero kernel
  // that no normalization can rescue.
  const fc = Math.min(Math.max(freq, 1), sampleRate * 0.499)
  const fn = fc / sampleRate // cycles per sample
  const w = windowFn(window, N)

  const h = new Float64Array(N)
  let sum = 0
  for (let k = 0; k < N; k++) {
    h[k] = 2 * fn * sinc(2 * fn * (k - M)) * w[k]
    sum += h[k]
  }
  // Normalize on the low-pass, where the passband is DC and the sum of the taps
  // IS H(0). Doing it here rather than after the inversion below keeps the
  // high-pass's DC null exact.
  if (sum !== 0) for (let k = 0; k < N; k++) h[k] /= sum

  if (mode === 'highpass') {
    // Spectral inversion: subtract the low-pass from an all-pass delayed by the
    // same M samples, so the two line up in time before they cancel. Needs the
    // odd length above to have a centre tap to put the impulse on.
    for (let k = 0; k < N; k++) h[k] = -h[k]
    h[M] += 1
  }

  return h
}

/** H(e^{jw}) = sum_k h[k] e^{-jwk}, as `{ re, im }`. */
export function firAt(h, f, sampleRate) {
  const w = (2 * Math.PI * f) / sampleRate
  let re = 0
  let im = 0
  for (let k = 0; k < h.length; k++) {
    const a = w * k
    re += h[k] * Math.cos(a)
    im -= h[k] * Math.sin(a)
  }
  return { re, im }
}

export function firResponse(h, f, sampleRate) {
  const { re, im } = firAt(h, f, sampleRate)
  return Math.hypot(re, im)
}

export function firPhase(h, f, sampleRate) {
  const { re, im } = firAt(h, f, sampleRate)
  return Math.atan2(im, re)
}

/** True when h[k] == h[N-1-k] to within `eps` — the linear-phase condition. */
export function isSymmetric(h, eps = 1e-12) {
  for (let k = 0, j = h.length - 1; k < j; k++, j--) {
    if (Math.abs(h[k] - h[j]) > eps) return false
  }
  return true
}

/**
 * Group delay in samples — of a SYMMETRIC (linear-phase) kernel, which is the
 * only kind this package designs: exactly (N-1)/2 at every frequency, meaning
 * the filter delays the whole signal and distorts its shape not at all. For an
 * asymmetric kernel the true group delay varies with frequency and this
 * closed form does not apply; check isSymmetric() first if the kernel could be.
 */
export function firGroupDelay(h) {
  return (h.length - 1) / 2
}

/**
 * A stateful FIR, as a delay line and a dot product — literally the convolution
 * sum, one output sample at a time.
 */
export function makeFir(h) {
  const N = h.length
  const buf = new Float64Array(N)
  let i = 0
  return (x) => {
    buf[i] = x
    let y = 0
    // Walk backwards from the newest sample, so buf[i-k] is x[n-k].
    let j = i
    for (let k = 0; k < N; k++) {
      y += h[k] * buf[j]
      j = j === 0 ? N - 1 : j - 1
    }
    i = i === N - 1 ? 0 : i + 1
    return y
  }
}

/**
 * Zeros of an FIR, as points on the z-plane.
 *
 * H(z) = sum h[k] z^-k = z^-(N-1) * (h[0] z^(N-1) + ... + h[N-1]), so the zeros
 * are the roots of that polynomial in z and there are exactly N-1 of them. An
 * FIR has no poles anywhere except a pile of them at the origin, which is only
 * bookkeeping for the delay and is not drawn.
 *
 * Durand-Kerner, the same solver packages/systems uses for continuous-time
 * roots — a polynomial does not care which plane it is being read in.
 */
export function firZeros(h) {
  // Leading coefficient first, in z. End taps are trimmed RELATIVE to the
  // kernel's own scale: a windowed sinc's outermost taps can be ~1e-18 while
  // the centre tap is ~0.2, and normalizing the polynomial by such a leading
  // coefficient blows the remaining coefficients up by 17 orders of magnitude.
  // Those taps are the window's taper reaching zero, not information.
  let peak = 0
  for (let i = 0; i < h.length; i++) peak = Math.max(peak, Math.abs(h[i]))
  if (!(peak > 0)) return []
  const tiny = peak * 1e-12
  const c = Array.from(h)
  while (c.length > 1 && Math.abs(c[c.length - 1]) < tiny) c.pop() // trailing zeros in z^-1
  while (c.length > 1 && Math.abs(c[0]) < tiny) c.shift()
  const n = c.length - 1
  if (n < 1) return []

  const a = c.map((v) => v / c[0])

  // Durand-Kerner wants starting points with DIFFERENT moduli — a symmetric
  // kernel's zeros come in reciprocal pairs, and seeding every guess on one
  // circle let the iteration stagnate symmetrically. The classic (0.4+0.9i)^k
  // spiral varies both angle and radius.
  let re = []
  let im = []
  {
    let sr = 1
    let si = 0
    for (let k = 0; k < n; k++) {
      const nr = sr * 0.4 - si * 0.9
      const ni = sr * 0.9 + si * 0.4
      sr = nr
      si = ni
      re.push(sr)
      im.push(si)
    }
  }

  const evalPoly = (x, y) => {
    let pr = 1
    let pi = 0
    for (let k = 1; k <= n; k++) {
      const nr = pr * x - pi * y + a[k]
      const ni = pr * y + pi * x
      pr = nr
      pi = ni
    }
    return [pr, pi]
  }

  // Two numerical hazards at high degree, both fatal in the naive form:
  //
  //   - An iterate that escapes the unit circle's neighbourhood overflows
  //     evalPoly (1000^200 is Infinity), and one NaN then spreads to every
  //     root through the denominator product. The LEASH pulls runaways back;
  //     zeros of a relatively-trimmed FIR live near the circle, and anything
  //     beyond |z| = 8 is off every canvas regardless.
  //   - The denominator is a product of ~n root separations. Two hundred
  //     factors underflow 1e-308 long before the roots have separated, and
  //     "skip the update when den is tiny" — the old guard — froze every root
  //     for good. So the correction is computed in log-magnitude and angle,
  //     where the product is a sum and cannot under- or overflow.
  const LEASH = 8
  const MAX_STEP = 2
  const iters = Math.max(500, 12 * n)
  for (let iter = 0; iter < iters; iter++) {
    let moved = 0
    for (let k = 0; k < n; k++) {
      const [pr, pi] = evalPoly(re[k], im[k])
      const pMag = Math.hypot(pr, pi)
      if (pMag === 0) continue // sitting exactly on a root
      let lnDen = 0
      let angDen = 0
      let collided = false
      for (let j = 0; j < n; j++) {
        if (j === k) continue
        const xr = re[k] - re[j]
        const xi = im[k] - im[j]
        const m = Math.hypot(xr, xi)
        if (m < 1e-30) {
          collided = true
          break
        }
        lnDen += Math.log(m)
        angDen += Math.atan2(xi, xr)
      }
      if (collided) {
        // Two guesses landed on top of each other: separate them and let the
        // next sweep sort out which root each one owns.
        re[k] += 1e-6 * (k + 1)
        im[k] -= 1e-6
        moved = Math.max(moved, 1)
        continue
      }
      let qMag = Math.exp(Math.log(pMag) - lnDen)
      const qAng = Math.atan2(pi, pr) - angDen
      if (!Number.isFinite(qMag)) continue
      if (qMag > MAX_STEP) qMag = MAX_STEP
      const qr = qMag * Math.cos(qAng)
      const qi = qMag * Math.sin(qAng)
      let zr = re[k] - qr
      let zi = im[k] - qi
      const mag = Math.hypot(zr, zi)
      if (mag > LEASH) {
        zr *= LEASH / mag
        zi *= LEASH / mag
      }
      re[k] = zr
      im[k] = zi
      moved = Math.max(moved, qMag)
    }
    if (moved < 1e-14) break
  }

  // Better no marks than wrong marks: verify every root actually sits on a
  // zero, with the residual scaled to the polynomial's own size at that point.
  // A failure returns null, and the caller declines to draw — saying why —
  // instead of presenting marks that do not reproduce the response.
  for (let k = 0; k < n; k++) {
    const [pr, pi] = evalPoly(re[k], im[k])
    const zMag = Math.hypot(re[k], im[k])
    let scale = 1
    let zp = 1
    for (let j = 1; j <= n; j++) {
      zp *= zMag
      scale += Math.abs(a[j]) * zp
      if (!Number.isFinite(scale)) break
    }
    if (!(Math.hypot(pr, pi) / Math.min(scale, Number.MAX_VALUE) < 1e-8)) return null
  }

  return re.map((r, k) => [r, im[k]])
}
