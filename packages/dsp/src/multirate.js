import { designFir } from './fir.js'

// Changing the rate: decimation, interpolation, polyphase, and the noble identities.
//
// Everything above this file runs at one rate. A second course runs at two, and
// the whole subject follows from two operations and what they do to a spectrum.
//
//   Downsampling by M keeps every Mth sample. The spectrum is stretched by M and
//   the copies at multiples of the new rate fold on top of each other, so
//   anything above fs/(2M) arrives as an alias and cannot be removed afterwards.
//
//   Upsampling by L writes L-1 zeros after every sample. The spectrum is not
//   changed at all: it is the same function of frequency, now read against a
//   rate L times higher, so L-1 images of the original band appear below the new
//   Nyquist and have to be filtered out.
//
// Neither operation is shift-invariant. Delay the input of a decimator by one
// sample and the output is not the old output delayed by anything, because a
// different set of samples is kept. So a rate changer has no H(z) and gets no
// transfer-function claim, which is the CORE_SCOPE boundary this file sits on.
// The filters around it are ordinary LTI filters and are stated exactly.

/**
 * y[n] = sum_k h[k] x[n-k], with x taken as zero before the start.
 *
 * Same length as the input, and the sum runs over k ascending, which is the
 * order makeFir() uses. Two routes that add the same products in the same order
 * agree to the last bit, and several identities below are tested that way.
 */
export function convolveFir(x, h) {
  const n = x.length
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let acc = 0
    for (let k = 0; k < h.length; k++) {
      const j = i - k
      if (j < 0) break
      acc += h[k] * x[j]
    }
    out[i] = acc
  }
  return out
}

/** Keep every Mth sample, starting at index 0. */
export function downsample(x, M) {
  const m = Math.max(1, Math.round(M))
  const n = Math.ceil(x.length / m)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = x[i * m]
  return out
}

/** Write L-1 zeros after every sample. The output is L times as long. */
export function upsample(x, L) {
  const l = Math.max(1, Math.round(L))
  const out = new Float64Array(x.length * l)
  for (let i = 0; i < x.length; i++) out[i * l] = x[i]
  return out
}

/**
 * H(z^L): the same taps with L-1 zeros between them.
 *
 * A filter whose impulse response is stretched by L has a response that repeats
 * L times around the unit circle. Both noble identities are statements about
 * this filter, and both are exact.
 */
export function expandTaps(h, L) {
  const l = Math.max(1, Math.round(L))
  if (l === 1) return Float64Array.from(h)
  const out = new Float64Array((h.length - 1) * l + 1)
  for (let k = 0; k < h.length; k++) out[k * l] = h[k]
  return out
}

/** Filter with h, then keep every Mth sample. */
export function decimate(x, M, h) {
  return downsample(h && h.length ? convolveFir(x, h) : x, M)
}

/** Write L-1 zeros after every sample, then filter with h. */
export function interpolate(x, L, h) {
  const v = upsample(x, L)
  return h && h.length ? convolveFir(v, h) : v
}

/**
 * The polyphase components of h at rate M: E_p[q] = h[qM + p].
 *
 * The taps are dealt out to M subfilters like cards. Nothing is lost and nothing
 * is added, which is why every polyphase form is an identity rather than an
 * approximation.
 */
export function polyphase(h, M) {
  const m = Math.max(1, Math.round(M))
  const parts = []
  for (let p = 0; p < m; p++) {
    const len = Math.max(0, Math.ceil((h.length - p) / m))
    const e = new Float64Array(len)
    for (let q = 0; q < len; q++) e[q] = h[q * m + p]
    parts.push(e)
  }
  return parts
}

/**
 * Decimation by the commutator, which computes only the samples it keeps.
 *
 * The direct route filters at the input rate and throws M-1 of every M outputs
 * away. This one never computes them. The saving is exactly M, and the answer is
 * the same sum of the same products:
 *
 *   y[n] = sum_k h[k] x[nM - k],  k = qM + p,  so  y[n] = sum_p sum_q E_p[q] x[nM - qM - p]
 *
 * The terms are grouped differently, so with arbitrary coefficients the two
 * agree to rounding rather than to the last bit. With coefficients that are
 * exact binary fractions they agree bit for bit, and both facts are tested.
 */
export function polyphaseDecimate(x, M, h) {
  const m = Math.max(1, Math.round(M))
  const E = polyphase(h, m)
  const n = Math.ceil(x.length / m)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let acc = 0
    for (let p = 0; p < m; p++) {
      const e = E[p]
      const base = i * m - p
      for (let q = 0; q < e.length; q++) {
        const j = base - q * m
        if (j < 0) break
        acc += e[q] * x[j]
      }
    }
    out[i] = acc
  }
  return out
}

/**
 * Interpolation by the commutator: each output phase is its own short filter run
 * at the LOW rate, and the M outputs are interleaved.
 *
 *   y[nL + p] = sum_q R_p[q] x[n - q]
 *
 * No multiplication by a stuffed zero happens at all, which is the whole saving.
 */
export function polyphaseInterpolate(x, L, h) {
  const l = Math.max(1, Math.round(L))
  const R = polyphase(h, l)
  const out = new Float64Array(x.length * l)
  for (let i = 0; i < x.length; i++) {
    for (let p = 0; p < l; p++) {
      const r = R[p]
      let acc = 0
      for (let q = 0; q < r.length; q++) {
        const j = i - q
        if (j < 0) break
        acc += r[q] * x[j]
      }
      out[i * l + p] = acc
    }
  }
  return out
}

/**
 * The anti-alias filter a decimator by M needs, as a windowed sinc.
 *
 * The band that survives is 0 to fs/(2M). `edge` places the cutoff inside it, so
 * the transition band has somewhere to live: at edge = 0.8 the passband reaches
 * 0.8 fs/(2M) and the filter has 0.2 fs/(2M) to fall in.
 */
export function designDecimationFir({ M, taps = 63, window = 'hamming', edge = 0.8 }, sampleRate) {
  const m = Math.max(1, Math.round(M))
  return designFir({ mode: 'lowpass', taps, window, freq: (edge * sampleRate) / (2 * m) }, sampleRate)
}

/**
 * The image-rejection filter an interpolator by L needs.
 *
 * Same shape as the decimation filter and one difference: the taps are scaled by
 * L. Zero stuffing puts L-1 zeros in every L samples, so the average falls by L,
 * and the filter has to put the gain back for the interpolated signal to sit at
 * the amplitude it had.
 */
export function designInterpolationFir({ L, taps = 63, window = 'hamming', edge = 0.8 }, sampleRate) {
  const l = Math.max(1, Math.round(L))
  const h = designFir(
    { mode: 'lowpass', taps, window, freq: (edge * sampleRate) / (2 * l) },
    sampleRate,
  )
  const out = new Float64Array(h.length)
  for (let k = 0; k < h.length; k++) out[k] = h[k] * l
  return out
}

/**
 * How many multiplies a second each route costs, for the plan's cost rows.
 *
 * The direct decimator runs an N-tap filter at the input rate and discards M-1
 * of every M results. The polyphase decimator runs the same N taps once per
 * output. The ratio is exactly M, whatever N is.
 */
export function multirateCost({ taps, factor, sampleRate }) {
  const N = Math.max(1, Math.round(taps))
  const M = Math.max(1, Math.round(factor))
  return {
    direct: N * sampleRate,
    polyphase: (N * sampleRate) / M,
    ratio: M,
  }
}

/**
 * A decimator that stays on the input's time axis, so one scope and one spectrum
 * can hold both signals.
 *
 * Filter, keep every Mth sample, and hold it for M samples. The held output is
 * the decimated signal reconstructed by a zero-order hold, which is what a
 * converter does, and every alias the decimation created is visible in the
 * spectrum at the rate the display already uses.
 *
 * With `antialias` off, the fold is the lesson. With it on, the fold is gone and
 * the band above the new Nyquist is gone with it. Both are the same picture with
 * one filter added.
 */
export function makeDecimateHold({ M, h = null }) {
  const m = Math.max(1, Math.round(M))
  const N = h ? h.length : 0
  const buf = N ? new Float64Array(N) : null
  let bi = 0
  let phase = 0
  let held = 0
  return {
    process: (x) => {
      let v = x
      if (buf) {
        buf[bi] = x
        let acc = 0
        let j = bi
        for (let k = 0; k < N; k++) {
          acc += h[k] * buf[j]
          j = j === 0 ? N - 1 : j - 1
        }
        bi = bi === N - 1 ? 0 : bi + 1
        v = acc
      }
      if (phase === 0) held = v
      phase = phase === m - 1 ? 0 : phase + 1
      return held
    },
    settle: N ? N - 1 + m : m,
  }
}

/**
 * An interpolator on the same time axis: read the signal on a grid L times
 * coarser, then rebuild it at the display rate.
 *
 * `fill` decides what goes between the kept samples. `zeros` is the raw
 * zero-stuffed signal, whose spectrum carries L-1 images. `hold` repeats the
 * sample, which is a converter's zero-order hold and its sinc droop. `filter`
 * runs the interpolation filter, and the images go.
 */
export function makeInterpolateFill({ L, fill = 'filter', h = null }) {
  const l = Math.max(1, Math.round(L))
  const N = fill === 'filter' && h ? h.length : 0
  const buf = N ? new Float64Array(N) : null
  let bi = 0
  let phase = 0
  let kept = 0
  return {
    process: (x) => {
      if (phase === 0) kept = x
      const stuffed = fill === 'hold' ? kept : phase === 0 ? kept : 0
      phase = phase === l - 1 ? 0 : phase + 1
      if (!buf) return stuffed
      buf[bi] = stuffed
      let acc = 0
      let j = bi
      for (let k = 0; k < N; k++) {
        acc += h[k] * buf[j]
        j = j === 0 ? N - 1 : j - 1
      }
      bi = bi === N - 1 ? 0 : bi + 1
      return acc
    },
    settle: N ? N - 1 + l : l,
  }
}
