// Noise as a signal, and the two closed forms that pin it.
//
// This module is the seam with the Electronics Lab. Its Group O opens on "a
// random signal has a density, not a spectrum", and O2 closes on `kT/C`. Both
// need a seeded white generator whose density is a stated number rather than a
// measured one, and both are checked here against the same formulas the
// Electronics Lab will print. The Electronics Lab imports this module rather
// than writing a second generator, so the two labs cannot disagree.
//
// `kT/C` is the result worth the whole group. One resistor charging one
// capacitor holds a mean-square noise voltage of `kT/C`, whatever the
// resistance is. Raising R raises the density as `sqrt(R)` and narrows the
// bandwidth as `1/R`, and the product is constant. The bandwidth in question is
// the noise bandwidth, `(pi/2) f_c` for a first-order stage, not `f_c`.

import { rng } from './prng.js'

/** Boltzmann's constant, joules per kelvin. Exact by the 2019 SI definition. */
export const BOLTZMANN = 1.380649e-23

/** The elementary charge, coulombs. Exact by the same definition. */
export const ELEMENTARY_CHARGE = 1.602176634e-19

/** Room temperature as this suite uses it, kelvin. */
export const T_ROOM = 300

/**
 * A resistor's thermal noise voltage density, volts per root hertz.
 * `sqrt(4 k T R)`, one-sided.
 */
export function thermalDensity(R, T = T_ROOM) {
  return Math.sqrt(4 * BOLTZMANN * T * R)
}

/**
 * A junction's shot noise current density, amps per root hertz.
 * `sqrt(2 q I)`, one-sided.
 */
export function shotDensity(I) {
  return Math.sqrt(2 * ELEMENTARY_CHARGE * Math.abs(I))
}

/**
 * The equivalent noise bandwidth of a first-order low-pass with corner `fc`.
 *
 * `ENB = (pi/2) f_c`, exactly. It is the width of the brick wall that would pass
 * the same noise power as `1/(1 + jf/f_c)`, and it is 57 % wider than the corner
 * because the roll-off keeps passing power above it.
 */
export function noiseBandwidthFirstOrder(fc) {
  return (Math.PI / 2) * fc
}

/**
 * The `kT/C` result: the rms noise voltage on a capacitor charged through any
 * resistance, volts.
 *
 * Returns the whole chain of numbers rather than the answer alone, so a pane can
 * show why the resistance cancels: the density rises as `sqrt(R)` and the noise
 * bandwidth falls as `1/R`.
 *
 * @returns {{ rms, ktc, density, fc, enb, R, C, T, viaBandwidth }}
 *   `ktc` is `sqrt(kT/C)`, the closed form. `viaBandwidth` is
 *   `density * sqrt(enb)`, the same number reached through the filter. The two
 *   are equal identically, and `noise.test.js` measures that they are.
 */
export function capacitorNoise({ R, C, T = T_ROOM }) {
  const density = thermalDensity(R, T)
  const fc = 1 / (2 * Math.PI * R * C)
  const enb = noiseBandwidthFirstOrder(fc)
  const ktc = Math.sqrt((BOLTZMANN * T) / C)
  return { rms: ktc, ktc, density, fc, enb, R, C, T, viaBandwidth: density * Math.sqrt(enb) }
}

/**
 * Seeded white Gaussian noise with a stated one-sided density.
 *
 * The density and the sample variance are two views of one number:
 * `sigma^2 = S * f_s / 2`. A caller states whichever it has.
 *
 * @param {object} o
 * @param {number} o.n            samples
 * @param {number} o.sampleRate   hertz
 * @param {number} [o.density]    one-sided, signal units per root hertz
 * @param {number} [o.rms]        signal units, an alternative to `density`
 * @param {number} [o.seed=1]
 * @returns {{ x: Float64Array, rms: number, density: number, variance: number, seed }}
 */
export function whiteNoise({ n, sampleRate, density, rms, seed = 1 }) {
  if (density === undefined && rms === undefined) {
    throw new Error('whiteNoise: give either a density or an rms')
  }
  const sigma = rms !== undefined ? rms : density * Math.sqrt(sampleRate / 2)
  const d = density !== undefined ? density : sigma / Math.sqrt(sampleRate / 2)
  const r = rng(seed)
  const x = new Float64Array(n)
  for (let i = 0; i < n; i++) x[i] = r.normal(0, sigma)
  return { x, rms: sigma, density: d, variance: sigma * sigma, seed, sampleRate }
}

/**
 * The magnitude of a first-order low-pass at `f`, for the filtered-noise
 * experiments. `|H| = 1 / sqrt(1 + (f/f_c)^2)`.
 */
export function firstOrderMagnitude(f, fc) {
  const x = f / fc
  return 1 / Math.sqrt(1 + x * x)
}

/**
 * A first-order low-pass as a one-pole recursion, matched to `firstOrderMagnitude`
 * through the bilinear transform's prewarped corner.
 *
 * The impulse-invariant one-pole `y += a (x - y)` has a corner that drifts from
 * `f_c` as the corner approaches Nyquist, and a noise experiment that compares a
 * measured output density against `|H|^2 S` would then be comparing two
 * different filters. The bilinear form makes the two agree exactly at every
 * frequency, and `noise.test.js` measures the agreement rather than assuming it.
 *
 * The filter's own noise bandwidth has a closed form, and it is not `(pi/2) f_c`.
 * With `K = tan(pi f_c/f_s)` the impulse response sums to `sum h^2 = K/(K+1)`
 * exactly, so the noise bandwidth is `(f_s/2) K/(K+1)`. That number approaches
 * `(pi/2) f_c` as the corner falls away from Nyquist and is 11 % below it at
 * `f_c = f_s/24`, because this filter has a null at Nyquist and the analogue one
 * does not. The lab prints both and `enbRatio` between them, which is the guard
 * required for treating the analogue formula as a description of this filter.
 *
 * @returns {{ b, a, K, magnitude, run, noiseGain, enb, analogueEnb, enbRatio }}
 */
export function firstOrderLowpass(fc, sampleRate) {
  if (!(fc > 0 && fc < sampleRate / 2)) {
    throw new Error(`firstOrderLowpass: corner ${fc} Hz must lie in (0, ${sampleRate / 2})`)
  }
  const k = Math.tan((Math.PI * fc) / sampleRate)
  const norm = 1 / (1 + 1 / k)
  const b0 = norm
  const b1 = norm
  const a1 = (1 - 1 / k) * norm
  const noiseGain = k / (k + 1)
  const enb = (sampleRate / 2) * noiseGain
  const analogueEnb = noiseBandwidthFirstOrder(fc)
  return {
    b: [b0, b1],
    a: [1, a1],
    K: k,
    /** `sum h[n]^2`, the variance this filter passes from unit-variance white noise. */
    noiseGain,
    /** This filter's own noise bandwidth, hertz, exact. */
    enb,
    /** The analogue single pole's `(pi/2) f_c`, for comparison. */
    analogueEnb,
    /** `enb / analogueEnb`. One in the limit, and the guard on quoting the analogue value. */
    enbRatio: enb / analogueEnb,
    magnitude(f) {
      const w = (2 * Math.PI * f) / sampleRate
      const cr = Math.cos(w)
      const ci = -Math.sin(w)
      const nr = b0 + b1 * cr
      const ni = b1 * ci
      const dr = 1 + a1 * cr
      const di = a1 * ci
      return Math.hypot(nr, ni) / Math.hypot(dr, di)
    },
    run(x) {
      const y = new Float64Array(x.length)
      let x1 = 0
      let y1 = 0
      for (let i = 0; i < x.length; i++) {
        const v = b0 * x[i] + b1 * x1 - a1 * y1
        y[i] = v
        x1 = x[i]
        y1 = v
      }
      return y
    },
  }
}
