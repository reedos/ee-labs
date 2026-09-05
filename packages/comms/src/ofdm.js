// OFDM: a modulator and a demodulator around the transform in @ee-labs/dsp.
//
// The claim, and the invariant that holds it, is exactness. A cyclic prefix
// turns the channel's linear convolution into a circular one, so the transform
// diagonalises the channel and one complex division per subcarrier recovers the
// symbol. That holds for a channel of `cp + 1` taps and no more, and invariant
// 8 checks both sides of the boundary.

import { fft, ifft } from '@ee-labs/dsp'
import { cdiv } from './chain.js'

/** Split an interleaved buffer into the two arrays `fft` takes. */
function split(buf) {
  const n = buf.length / 2
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    re[i] = buf[2 * i]
    im[i] = buf[2 * i + 1]
  }
  return { re, im }
}

/** Interleave two arrays back into one buffer. */
function join(re, im) {
  const out = new Float64Array(re.length * 2)
  for (let i = 0; i < re.length; i++) {
    out[2 * i] = re[i]
    out[2 * i + 1] = im[i]
  }
  return out
}

/**
 * `n` complex symbols in, `n + cp` samples out.
 *
 * The inverse transform gives the time waveform, and the last `cp` samples of
 * it are prepended. That prefix is a copy rather than a guard interval of
 * zeros, and the copy is what makes the convolution circular.
 */
export function ofdmModulate(syms, { n = 64, cp = 16 }) {
  const { re, im } = split(syms)
  if (re.length !== n) throw new Error(`ofdmModulate: expected ${n} symbols, got ${re.length}`)
  ifft(re, im)
  const out = new Float64Array(2 * (n + cp))
  for (let i = 0; i < cp; i++) {
    out[2 * i] = re[n - cp + i]
    out[2 * i + 1] = im[n - cp + i]
  }
  for (let i = 0; i < n; i++) {
    out[2 * (cp + i)] = re[i]
    out[2 * (cp + i) + 1] = im[i]
  }
  return out
}

/** The channel's response at each of the `n` subcarriers, as an interleaved set. */
export function subcarrierResponse(taps, n) {
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  const m = taps.length / 2
  for (let k = 0; k < Math.min(m, n); k++) {
    re[k] = taps[2 * k]
    im[k] = taps[2 * k + 1]
  }
  fft(re, im)
  return join(re, im)
}

/**
 * Strip the prefix, transform, and divide each subcarrier by the channel there.
 * One complex division a subcarrier is the whole equaliser.
 */
export function ofdmDemodulate(rx, { n = 64, cp = 16, channel = null }) {
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    re[i] = rx[2 * (cp + i)]
    im[i] = rx[2 * (cp + i) + 1]
  }
  fft(re, im)
  if (!channel) return join(re, im)
  const h = channel.length === 2 * n ? channel : subcarrierResponse(channel, n)
  for (let k = 0; k < n; k++) {
    const q = cdiv([re[k], im[k]], [h[2 * k], h[2 * k + 1]])
    re[k] = q[0]
    im[k] = q[1]
  }
  return join(re, im)
}

/** The largest error between two interleaved symbol sets. */
export function worstError(a, b) {
  let worst = 0
  for (let i = 0; i < a.length / 2; i++) {
    const d = Math.hypot(a[2 * i] - b[2 * i], a[2 * i + 1] - b[2 * i + 1])
    if (d > worst) worst = d
  }
  return worst
}

/**
 * One symbol through one channel, end to end. The number invariant 8 measures.
 * `taps` is interleaved, and a channel longer than `cp + 1` taps fails here in
 * a way that is not floating point.
 */
export function ofdmRoundTrip({ syms, taps, n = 64, cp = 16 }) {
  const tx = ofdmModulate(syms, { n, cp })
  // A LINEAR convolution, with nothing before the block. That is what makes the
  // prefix load bearing rather than decorative. Output sample `cp + i` reaches
  // back `m - 1` samples, so it stays inside the block while `m <= cp + 1` and
  // reads zeros the moment the channel is one tap longer.
  const total = n + cp
  const m = taps.length / 2
  const rx = new Float64Array(tx.length)
  for (let i = 0; i < total; i++) {
    let re = 0
    let im = 0
    for (let k = 0; k < m; k++) {
      const j = i - k
      if (j < 0) continue
      re += tx[2 * j] * taps[2 * k] - tx[2 * j + 1] * taps[2 * k + 1]
      im += tx[2 * j] * taps[2 * k + 1] + tx[2 * j + 1] * taps[2 * k]
    }
    rx[2 * i] = re
    rx[2 * i + 1] = im
  }
  const got = ofdmDemodulate(rx, { n, cp, channel: taps })
  return { tx, rx, got, worst: worstError(syms, got) }
}

/** The peak-to-average power ratio of one buffer, in dB. */
export function papr(buf) {
  const n = buf.length / 2
  let peak = 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const p = buf[2 * i] ** 2 + buf[2 * i + 1] ** 2
    sum += p
    if (p > peak) peak = p
  }
  const mean = sum / n
  return mean > 0 ? 10 * Math.log10(peak / mean) : 0
}

/**
 * `Pr(PAPR > gamma)` on the Nyquist-rate samples, `1 - (1 - e^-gamma)^N`.
 *
 * Exact for those samples and labelled as such, because the continuous-time
 * peak sits above them and the pane says so.
 */
export function paprCcdf(gammaDb, n) {
  const g = 10 ** (gammaDb / 10)
  return 1 - (1 - Math.exp(-g)) ** n
}

/** The level exceeded with probability `p`, by bisection on the form above. */
export function paprLevel(p, n) {
  let lo = 0
  let hi = 30
  for (let i = 0; i < 300; i++) {
    const m = (lo + hi) / 2
    if (paprCcdf(m, n) > p) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

/**
 * What the grid costs. Every quantity here is arithmetic on the four knobs,
 * so a reader who lengthens the symbol watches both costs fall.
 */
export function ofdmRate({
  n = 64,
  cp = 16,
  used = 52,
  pilots = 4,
  bitsPerSymbol = 4,
  sampleRate = 8000,
}) {
  const spacing = sampleRate / n
  const usefulMs = (n / sampleRate) * 1000
  const prefixMs = (cp / sampleRate) * 1000
  const symbolMs = usefulMs + prefixMs
  const symbolRate = 1000 / symbolMs
  const data = used - pilots
  return {
    spacing,
    usefulMs,
    prefixMs,
    symbolMs,
    symbolRate,
    occupied: used * spacing,
    dataCarriers: data,
    bitRate: data * bitsPerSymbol * symbolRate,
    prefixCostDb: 10 * Math.log10((n + cp) / n),
    pilotCostDb: 10 * Math.log10(used / data),
    prefixFraction: cp / (n + cp),
    worstPaprDb: 10 * Math.log10(n),
  }
}

/**
 * Two subcarriers correlate to zero over one symbol when their spacing is a
 * whole number of `1 / Tu`. F1 measures that, and the same fact read from the
 * other side is Signal Lab's spectral leakage.
 */
export function subcarrierCorrelation({ spacing, usefulMs, sampleRate = 8000 }) {
  const n = Math.round((usefulMs / 1000) * sampleRate)
  let re = 0
  let im = 0
  for (let i = 0; i < n; i++) {
    const w = (2 * Math.PI * spacing * i) / sampleRate
    re += Math.cos(w)
    im += Math.sin(w)
  }
  return Math.hypot(re, im) / n
}
