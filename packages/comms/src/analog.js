// Analog modulation, on the real chain.
//
// Group A runs where Signal Lab's Nonlinearity group stops. Four of its five
// blocks already exist there. What is added here is the index and the deviation
// as knobs, the Bessel series behind an FM spectrum, and the figures of merit
// that say what each modulation buys.

/**
 * The Bessel function of the first kind, by its series.
 *
 * `J_n(x) = sum_m (-1)^m / (m! (m+n)!) (x/2)^(2m+n)`. The series converges for
 * every x, and terms are built by recurrence rather than by forming factorials,
 * which keeps the whole sum inside a double for the arguments this lab uses.
 */
export function besselJ(order, x) {
  const n = Math.trunc(order)
  if (n < 0) return (n % 2 === 0 ? 1 : -1) * besselJ(-n, x)
  const half = x / 2
  // term_0 = (x/2)^n / n!
  let term = 1
  for (let i = 1; i <= n; i++) term *= half / i
  let sum = term
  for (let m = 1; m < 80; m++) {
    term *= (-(half * half)) / (m * (m + n))
    sum += term
    if (Math.abs(term) < 1e-18 * Math.max(1, Math.abs(sum))) break
  }
  return sum
}

/** The first zero of `J0`, where the carrier line vanishes. Bisection. */
export function firstZeroJ0() {
  let lo = 2
  let hi = 3
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2
    if (besselJ(0, m) > 0) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

/** The FM spectrum's line amplitudes, `J_n(beta)` for n = 0 to `order`. */
export function fmLines({ beta = 2, order = 8 }) {
  const out = new Float64Array(order + 1)
  for (let n = 0; n <= order; n++) out[n] = besselJ(n, beta)
  return out
}

/**
 * The fraction of the power inside Carson's bandwidth, `2(df + fm)`.
 *
 * Carson's rule is a rule of thumb, so the lab measures what it holds rather
 * than asserting that it holds everything. The bandwidth reaches the line at
 * `n = beta + 1`, and the power inside is the sum of the squared coefficients
 * up to there.
 */
export function carsonFraction({ beta = 2 }) {
  const nMax = Math.floor(beta + 1)
  let inside = besselJ(0, beta) ** 2
  for (let n = 1; n <= nMax; n++) inside += 2 * besselJ(n, beta) ** 2
  return inside
}

/** Carson's bandwidth in hertz, `2(df + fm)`. */
export function carsonBandwidth({ deviation, message }) {
  return 2 * (deviation + message)
}

/** The AM sideband level relative to the carrier, `20 log10(m/2)`. */
export function amSidebandDb(m) {
  return 20 * Math.log10(m / 2)
}

/** The fraction of the transmitted power the two sidebands carry. */
export function amSidebandPower(m) {
  return (m * m) / (2 + m * m)
}

/**
 * The figure of merit at the detector, referred to a suppressed carrier at one.
 *
 * AM spends most of its power on a carrier that carries no information, so its
 * figure is the sideband fraction. FM spreads the message over a wider band and
 * buys `1.5 beta^2` for it. The bandwidth that buys it is stated beside it,
 * because the two numbers are one statement.
 */
export function meritAm(m) {
  return amSidebandPower(m)
}

export function meritFm(beta) {
  return 1.5 * beta * beta
}

/** Any figure of merit in decibels. */
export const meritDb = (x) => 10 * Math.log10(x)

/**
 * An AM waveform on the real chain, at one carrier and one message tone.
 * `m` is the index, and above 1 the envelope folds through zero, which is what
 * A3 measures as distortion.
 */
export function amWaveform({ n, sampleRate, carrier, message, m, t0 = 0 }) {
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const t = t0 + i / sampleRate
    out[i] = (1 + m * Math.cos(2 * Math.PI * message * t)) * Math.cos(2 * Math.PI * carrier * t)
  }
  return out
}

/** A double-sideband suppressed-carrier waveform, which is the ring modulator. */
export function dsbWaveform({ n, sampleRate, carrier, message, t0 = 0 }) {
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const t = t0 + i / sampleRate
    out[i] = Math.cos(2 * Math.PI * message * t) * Math.cos(2 * Math.PI * carrier * t)
  }
  return out
}

/** An FM waveform, the phase integral of the message. */
export function fmWaveform({ n, sampleRate, carrier, message, deviation, t0 = 0 }) {
  const beta = deviation / message
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const t = t0 + i / sampleRate
    out[i] = Math.cos(2 * Math.PI * carrier * t + beta * Math.sin(2 * Math.PI * message * t))
  }
  return out
}

/**
 * The envelope detector: rectify, then low-pass. Both halves already exist in
 * Signal Lab, and this is the pair applied to one buffer.
 */
export function envelopeDetect(buf, { sampleRate, cutoff }) {
  const a = Math.exp((-2 * Math.PI * cutoff) / sampleRate)
  const out = new Float64Array(buf.length)
  let y = 0
  for (let i = 0; i < buf.length; i++) {
    y = (1 - a) * Math.abs(buf[i]) + a * y
    out[i] = y
  }
  return out
}

/** The coherent detector: multiply by a local carrier, then low-pass. */
export function coherentDetect(buf, { sampleRate, carrier, cutoff, phaseDeg = 0, t0 = 0 }) {
  const th = (phaseDeg * Math.PI) / 180
  const a = Math.exp((-2 * Math.PI * cutoff) / sampleRate)
  const out = new Float64Array(buf.length)
  let y = 0
  for (let i = 0; i < buf.length; i++) {
    const t = t0 + i / sampleRate
    const v = 2 * buf[i] * Math.cos(2 * Math.PI * carrier * t + th)
    y = (1 - a) * v + a * y
    out[i] = y
  }
  return out
}

/**
 * Total harmonic distortion of a recovered message, measured from the spectrum
 * the lab already draws. `fundamental` is the message frequency.
 */
export function thd(amps, freqs, fundamental, harmonics = 5, tolerance = 0.5) {
  const near = (f) => {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < freqs.length; i++) {
      const d = Math.abs(freqs[i] - f)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return bestD <= tolerance * (freqs[1] - freqs[0]) + 1e-9 ? amps[best] : 0
  }
  const a1 = near(fundamental)
  let rest = 0
  for (let k = 2; k <= harmonics; k++) rest += near(k * fundamental) ** 2
  return a1 > 0 ? Math.sqrt(rest) / a1 : 0
}
