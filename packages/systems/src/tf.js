// Continuous-time transfer functions.
//
// A transfer function is the currency this whole suite trades in. A circuit
// gives you one, a control loop gives you one, and a digital filter is one after
// a change of variable. Everything below — frequency response, poles, step
// response, stability — is written once here so that each tool describes its own
// subject and then hands the analysis over.
//
// Representation: { b, a }, numerator and denominator coefficients in s, HIGHEST
// power first, matching how the polynomials are written on paper.
//
//            b[0] s^m + b[1] s^(m-1) + ... + b[m]
//   H(s) =  -------------------------------------
//            a[0] s^n + a[1] s^(n-1) + ... + a[n]

/** Complex helpers, kept local: this is the only file that needs them. */
const cAdd = (x, y) => [x[0] + y[0], x[1] + y[1]]
const cSub = (x, y) => [x[0] - y[0], x[1] - y[1]]
const cMul = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]]
const cDiv = (x, y) => {
  const d = y[0] * y[0] + y[1] * y[1]
  return [(x[0] * y[0] + x[1] * y[1]) / d, (x[1] * y[0] - x[0] * y[1]) / d]
}
const cAbs = (x) => Math.hypot(x[0], x[1])

/** Evaluate a polynomial at a complex point, by Horner's method. */
function polyEval(coeffs, s) {
  let acc = [0, 0]
  for (const c of coeffs) acc = cAdd(cMul(acc, s), [c, 0])
  return acc
}

/** H(s) at an arbitrary complex s. */
export function evalAt(tf, s) {
  return cDiv(polyEval(tf.b, s), polyEval(tf.a, s))
}

/** H(j2*pi*f), as [re, im]. */
export function evalAtFreq(tf, f) {
  return evalAt(tf, [0, 2 * Math.PI * f])
}

/** |H| at a frequency in Hz. */
export const magnitudeAt = (tf, f) => cAbs(evalAtFreq(tf, f))

/** Angle of H at a frequency in Hz, in radians, wrapped to (-pi, pi]. */
export function phaseAt(tf, f) {
  const h = evalAtFreq(tf, f)
  return Math.atan2(h[1], h[0])
}

/** Gain at DC: the ratio of the constant terms. */
export function dcGain(tf) {
  const bn = tf.b[tf.b.length - 1]
  const an = tf.a[tf.a.length - 1]
  if (an === 0) return bn === 0 ? NaN : Infinity
  return bn / an
}

/**
 * Magnitude and phase over a list of frequencies.
 *
 * The phase is unwrapped, because atan2 jumps by 2*pi at its branch cut and
 * those jumps read as though the system did something abrupt, which it did not.
 * Where |H| is exactly zero the angle is undefined and atan2 answers 0, which
 * would plant a spurious spike on the axis; those points are filled from their
 * neighbours instead.
 */
export function bode(tf, freqs) {
  const mag = new Float64Array(freqs.length)
  const phase = new Float64Array(freqs.length)
  const known = new Array(freqs.length).fill(false)

  for (let i = 0; i < freqs.length; i++) {
    const h = evalAtFreq(tf, freqs[i])
    mag[i] = cAbs(h)
    if (mag[i] > 1e-300) {
      phase[i] = Math.atan2(h[1], h[0])
      known[i] = true
    }
  }
  let last = null
  for (let i = 0; i < freqs.length; i++) {
    if (known[i]) last = phase[i]
    else if (last != null) phase[i] = last
  }
  for (let i = freqs.length - 1; i >= 0; i--) {
    if (known[i]) last = phase[i]
    else if (last != null) phase[i] = last
  }
  for (let i = 1; i < freqs.length; i++) {
    while (phase[i] - phase[i - 1] > Math.PI) phase[i] -= 2 * Math.PI
    while (phase[i] - phase[i - 1] < -Math.PI) phase[i] += 2 * Math.PI
  }
  return { mag, phase }
}

/**
 * Roots of a polynomial, by Durand-Kerner.
 *
 * Every root is refined simultaneously against all the others, which converges
 * for the low orders here and, unlike deflation, does not accumulate error by
 * dividing the polynomial down as it goes.
 */
export function roots(coeffs) {
  // Drop leading zeros; they are not roots, they are a lower-order polynomial.
  let c = [...coeffs]
  while (c.length && Math.abs(c[0]) < 1e-14) c.shift()
  const n = c.length - 1
  if (n < 1) return []

  const monic = c.map((v) => v / c[0])
  // Trailing zeros are roots at the origin exactly; peel them off so the
  // iteration below never has to converge onto a repeated root at zero.
  let atOrigin = 0
  while (monic.length > 1 && Math.abs(monic[monic.length - 1]) < 1e-14) {
    monic.pop()
    atOrigin++
  }
  const deg = monic.length - 1
  if (deg < 1) return Array.from({ length: atOrigin }, () => [0, 0])

  // Spread the starting guesses around a circle, off the real axis, so a
  // polynomial with real roots does not start with every guess identical.
  let z = Array.from({ length: deg }, (_, k) => {
    const r = 1 + Math.abs(monic[deg])
    const th = (2 * Math.PI * k) / deg + 0.35
    return [r * Math.cos(th), r * Math.sin(th)]
  })

  for (let iter = 0; iter < 500; iter++) {
    let moved = 0
    for (let i = 0; i < deg; i++) {
      let denom = [1, 0]
      for (let j = 0; j < deg; j++) if (j !== i) denom = cMul(denom, cSub(z[i], z[j]))
      const step = cDiv(polyEval(monic, z[i]), denom)
      z[i] = cSub(z[i], step)
      moved = Math.max(moved, cAbs(step))
    }
    if (moved < 1e-14) break
  }

  // Snap near-real roots onto the real axis: a conjugate pair whose imaginary
  // part is 1e-16 is a numerical artefact, and it changes how the pole is drawn
  // and described.
  const out = z.map(([re, im]) => (Math.abs(im) < 1e-9 * Math.max(1, Math.abs(re)) ? [re, 0] : [re, im]))
  for (let i = 0; i < atOrigin; i++) out.push([0, 0])
  return out
}

/** Poles and zeros, as [re, im] pairs. */
export function polesZeros(tf) {
  return { poles: roots(tf.a), zeros: roots(tf.b) }
}

/** Continuous-time stability: every pole strictly in the left half plane. */
export function isStable(tf) {
  const p = roots(tf.a)
  return p.length > 0 && p.every(([re]) => re < -1e-12)
}

/**
 * Controllable canonical state space, for simulating in the time domain.
 *
 * Partial fractions would need special cases for repeated and complex poles;
 * integrating the state equations needs none, and works at any order.
 */
export function toStateSpace(tf) {
  const a = [...tf.a]
  while (a.length && Math.abs(a[0]) < 1e-14) a.shift()
  const n = a.length - 1
  if (n < 1) {
    // A purely resistive network stores no energy, so it has no state at all.
    // That is a legitimate circuit, not an error: the response is instantaneous
    // and the output is the input times a constant.
    const num = tf.b[tf.b.length - 1] ?? 0
    return { A: [], B: [], C: [], D: num / a[0], n: 0 }
  }

  const an = a.map((v) => v / a[0])
  // Pad the numerator to the same length so b0 is the direct feedthrough.
  const b = new Array(n + 1).fill(0)
  const bs = tf.b.map((v) => v / a[0])
  for (let i = 0; i < bs.length; i++) b[n + 1 - bs.length + i] = bs[i]

  const A = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => (r < n - 1 ? (c === r + 1 ? 1 : 0) : -an[n - c])),
  )
  const B = Array.from({ length: n }, (_, r) => (r === n - 1 ? 1 : 0))
  const D = b[0]
  const C = Array.from({ length: n }, (_, k) => b[n - k] - D * an[n - k])
  return { A, B, C, D, n }
}

/**
 * Response to an input function, by fourth-order Runge-Kutta.
 *
 * `u(t)` supplies the input, so the same routine gives the step response, the
 * impulse response (as a narrow pulse) or the response to anything else.
 */
export function simulate(tf, u, { duration, points = 800 }) {
  const { A, B, C, D, n } = toStateSpace(tf)

  if (n === 0) {
    // Memoryless: nothing to integrate, and the answer follows the input exactly.
    const t = Float64Array.from({ length: points }, (_, i) => (duration * i) / (points - 1))
    const y = Float64Array.from(t, (tv) => D * u(tv))
    return { t, y }
  }

  const dt = duration / (points - 1)
  // Sub-stepping keeps a fast pole from destabilising the integrator when the
  // requested output grid is coarse compared with the system's own time scale.
  const fastest = Math.max(...roots(tf.a).map(([re, im]) => Math.hypot(re, im)), 1e-9)
  const sub = Math.max(1, Math.ceil((dt * fastest) / 0.08))
  const h = dt / sub

  let x = new Array(n).fill(0)
  const t = new Float64Array(points)
  const y = new Float64Array(points)

  const deriv = (xv, tv) => {
    const uu = u(tv)
    const out = new Array(n)
    for (let r = 0; r < n; r++) {
      let s = 0
      for (let c = 0; c < n; c++) s += A[r][c] * xv[c]
      out[r] = s + B[r] * uu
    }
    return out
  }
  const out = (xv, tv) => {
    let s = D * u(tv)
    for (let k = 0; k < n; k++) s += C[k] * xv[k]
    return s
  }

  let time = 0
  for (let i = 0; i < points; i++) {
    t[i] = time
    y[i] = out(x, time)
    for (let k = 0; k < sub && i < points - 1; k++) {
      const k1 = deriv(x, time)
      const x2 = x.map((v, j) => v + (h / 2) * k1[j])
      const k2 = deriv(x2, time + h / 2)
      const x3 = x.map((v, j) => v + (h / 2) * k2[j])
      const k3 = deriv(x3, time + h / 2)
      const x4 = x.map((v, j) => v + h * k3[j])
      const k4 = deriv(x4, time + h)
      x = x.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]))
      time += h
    }
  }
  return { t, y }
}

/** Unit step response. */
export const stepResponse = (tf, opts) => simulate(tf, () => 1, opts)

/**
 * Natural frequency, damping and the quantities that follow, for a system whose
 * denominator is second order.
 *
 * Returns null for anything else rather than inventing a number: "the" damping
 * ratio of a third-order system is not a well-defined thing.
 */
export function secondOrderMetrics(tf) {
  const a = [...tf.a]
  while (a.length && Math.abs(a[0]) < 1e-14) a.shift()
  if (a.length !== 3) return null
  const [a0, a1, a2] = a
  const wn = Math.sqrt(a2 / a0)
  const zeta = a1 / (2 * Math.sqrt(a0 * a2))
  const q = zeta > 0 ? 1 / (2 * zeta) : Infinity
  const overshoot =
    zeta < 1 && zeta > 0 ? Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)) : 0
  return {
    wn,
    f0: wn / (2 * Math.PI),
    zeta,
    q,
    overshoot,
    damped: zeta >= 1 ? 'overdamped or critical' : 'underdamped',
    // Time to stay inside 2% of the final value, the usual convention.
    settling: zeta > 0 ? 4 / (zeta * wn) : Infinity,
    ringing: zeta < 1 ? (wn * Math.sqrt(1 - zeta * zeta)) / (2 * Math.PI) : 0,
  }
}

/**
 * Bilinear transform to a digital filter, with the cutoff pre-warped.
 *
 * This is the bridge to the discrete tools: an RLC network designed here can be
 * handed to a sampled system and behave the same way near the frequency that
 * matters. Without pre-warping, the whole axis is compressed towards Nyquist and
 * the corner lands in the wrong place.
 */
export function bilinear(tf, sampleRate, prewarpHz = null) {
  const n = Math.max(tf.a.length, tf.b.length) - 1
  const k =
    prewarpHz && prewarpHz > 0
      ? (2 * Math.PI * prewarpHz) / Math.tan((Math.PI * prewarpHz) / sampleRate)
      : 2 * sampleRate

  // Substitute s = k (1 - z^-1) / (1 + z^-1) by expanding each power.
  const pad = (c) => [...new Array(n + 1 - c.length).fill(0), ...c]
  const B = pad(tf.b)
  const A = pad(tf.a)

  const conv = (p, q) => {
    const r = new Array(p.length + q.length - 1).fill(0)
    for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) r[i + j] += p[i] * q[j]
    return r
  }
  const powerOf = (base, e) => {
    let r = [1]
    for (let i = 0; i < e; i++) r = conv(r, base)
    return r
  }

  const num = new Array(n + 1).fill(0)
  const den = new Array(n + 1).fill(0)
  for (let i = 0; i <= n; i++) {
    const e = n - i // power of s on this term
    const term = conv(powerOf([k, -k], e), powerOf([1, 1], n - e))
    for (let j = 0; j < term.length; j++) {
      num[j] += B[i] * term[j]
      den[j] += A[i] * term[j]
    }
  }
  const g = den[0]
  return { b: num.map((v) => v / g), a: den.map((v) => v / g) }
}
