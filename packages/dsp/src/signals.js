// Waveform generators.
//
// These are NAIVE (not band-limited) on purpose. A naive square or sawtooth
// has harmonics running to infinity, so sampling it folds everything above
// Nyquist back down as aliasing. That is a real effect worth seeing rather
// than hiding: push a sawtooth's frequency up and watch the spectrum fill
// with lines that should not be there.

export const WAVEFORMS = ['sine', 'square', 'triangle', 'sawtooth', 'noise', 'impulse', 'step']

/**
 * Waveforms with no repeating period, so nothing to count cycles of.
 *
 * The scope measures its span in cycles of the fundamental, which is what keeps
 * the view stable when you change frequency. These have no fundamental, so it
 * falls back to milliseconds.
 */
export const APERIODIC = new Set(['noise', 'impulse', 'step'])

/**
 * Stateless hash of an integer to [0, 1) — the mulberry32 mixing step.
 *
 * Noise has to be *addressable*, not a stream. Math.random() would give the scope
 * buffer and the FFT frame different noise (so the plot shimmers and no two views
 * agree), and filter pre-roll would generate a third, unrelated sequence ahead of
 * the frame it is supposed to be continuous with. Hashing the absolute sample index
 * keeps sample() a pure function of time.
 */
export function hash01(n, seed = 0) {
  let x = (n + Math.imul(seed, 0x9e3779b9)) >>> 0
  x = Math.imul(x ^ (x >>> 15), x | 1)
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}

/**
 * One cycle-accurate sample of `type` at time `t` seconds.
 * `phase` is in radians. `index` is the absolute sample number and `seed`
 * distinguishes one noise source from another; both are only used by noise.
 */
export function sample(type, t, freq, amp, phase, index = 0, seed = 0) {
  const theta = 2 * Math.PI * freq * t + phase
  switch (type) {
    case 'sine':
      return amp * Math.sin(theta)
    case 'square': {
      // Decided from the fractional phase, NOT from sign(sin(theta)), and NOT
      // from theta/(2*pi) either.
      //
      // At an exact half period sin() returns about 1e-16 rather than 0, with a
      // sign that depends on rounding, so the transition sample fell on
      // whichever side floating point happened to land. At 32 samples per
      // period that gave 17 samples high and 15 low — a DC offset of 0.0039 and
      // a full set of EVEN harmonics at -39.5 dB, on the one waveform whose
      // entire lesson is that it has none.
      //
      // Recovering the phase as theta/(2*pi) does not fix it: the round trip
      // through 2*pi reintroduces the same ambiguity at the boundary and left
      // 161 samples wrong. Computing the phase directly, without ever forming
      // theta, reproduces an exactly-constructed square with zero mismatches.
      const p = freq * t + phase / (2 * Math.PI)
      return amp * (p - Math.floor(p) < 0.5 ? 1 : -1)
    }
    case 'triangle':
      // (2/pi)*asin(sin x) is a unit triangle, peak 1, continuous.
      return amp * (2 / Math.PI) * Math.asin(Math.sin(theta))
    case 'sawtooth': {
      // Rising ramp in [-1, 1), period 1 in normalized phase — decided from
      // the fractional phase computed directly, for the square's reason: the
      // round trip through theta/(2*pi) reintroduces the boundary ambiguity,
      // and the discontinuity sample fell on whichever side floating point
      // happened to land (measured: the wrong side in 41% of periods at
      // 1 kHz / 48 kHz, which raised the inter-harmonic floor by 60+ dB).
      const u = freq * t + phase / (2 * Math.PI) + 0.5
      return amp * 2 * (u - Math.floor(u) - 0.5)
    }
    case 'noise':
      // Uniform white noise. `amp` is the peak, so RMS is amp/sqrt(3).
      return amp * (2 * hash01(index, seed) - 1)

    // The next two are the only sources keyed to absolute sample zero rather
    // than to a repeating phase, which is exactly what makes them useful: the
    // filter pre-roll runs at negative indices, so the chain is provably at
    // rest before the event arrives and what follows is its response and
    // nothing else.
    case 'impulse':
      // A single sample. Its spectrum is flat, so whatever shape the spectrum
      // then has was put there by the chain: the transfer function, measured.
      // Meanwhile the time view is drawing the impulse response. One object,
      // both domains, side by side.
      return index === 0 ? amp : 0

    case 'step':
      // Everything a filter does to a sudden change: rise time, overshoot and
      // ringing. It is what Q feels like in the time domain, where a resonance
      // is easier to recognize than it is as a bump on a curve.
      return index >= 0 ? amp : 0
    default:
      throw new Error(`unknown waveform: ${type}`)
  }
}

/**
 * Render the sum of `sources` into a Float64Array of `n` samples.
 * Disabled sources are skipped. Time starts at `t0` seconds.
 */
export function render(sources, n, sampleRate, t0 = 0) {
  const out = new Float64Array(n)
  // Absolute sample index, so noise is continuous across a pre-roll boundary.
  const n0 = Math.round(t0 * sampleRate)
  for (const s of sources) {
    if (!s.enabled) continue
    const seed = s.id ?? 0
    for (let i = 0; i < n; i++) {
      // Time comes from the ABSOLUTE sample index, not from t0 + i/sampleRate.
      //
      // Those differ in the last bit, and the difference depends on how much
      // pre-roll ran ahead of this frame — which depends on an unrelated
      // filter's Q. Every generator here is meant to be a pure function of
      // time, and the warm-up scheme depends on the pre-roll being the same
      // signal continued backwards; computing t from the local index quietly
      // broke that. For a sine the error is 1e-16 and invisible. For a square
      // it moves samples across the decision threshold, so a filtered square
      // was being compared against a *different* unfiltered square, and its
      // measured attenuation missed the filter's true response by up to 10%.
      const t = (n0 + i) / sampleRate
      out[i] += sample(s.type, t, s.freq, s.amp, s.phase, n0 + i, seed)
    }
  }
  return out
}

/** Root mean square of a buffer. */
export function rms(buf) {
  let acc = 0
  for (let i = 0; i < buf.length; i++) acc += buf[i] * buf[i]
  return Math.sqrt(acc / buf.length)
}

/** Largest absolute sample. */
export function peak(buf) {
  let m = 0
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i])
    if (a > m) m = a
  }
  return m
}
