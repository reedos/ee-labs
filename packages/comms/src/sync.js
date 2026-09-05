// Carrier and symbol timing recovery, written as loops.
//
// Both are second-order discrete loops with a zero-order hold, which is Control
// Lab II's subject. This file does not duplicate that lab. It computes the
// gains from the parameters a designer uses, returns the loop's `H(z)` and its
// poles so E2 can print them, and measures what the loop actually does. The
// mapping to a discrete loop is exact and carries no hedge.

import { rng } from '@ee-labs/random'
import { at } from './chain.js'

/**
 * A proportional-plus-integral loop filter, from the normalised loop bandwidth
 * and the damping ratio.
 *
 * `Bn T` and `zeta` are what a designer sets. The relation between them and the
 * natural frequency is `Bn = wn (zeta + 1/(4 zeta)) / 2`, so `wn` follows, and
 * the two gains follow from `wn` and `zeta`. Nothing here is tuned by hand.
 */
export function loopFilter({ bnT = 0.02, zeta = 0.707, symbolRate = 1000 }) {
  const T = 1 / symbolRate
  const bn = bnT * symbolRate
  const wn = (2 * bn) / (zeta + 1 / (4 * zeta))
  const wnT = wn * T
  // The standard digital phase-locked loop gains for a unit-gain detector.
  const kp = (4 * zeta * wnT) / (1 + 2 * zeta * wnT + wnT * wnT)
  const ki = (4 * wnT * wnT) / (1 + 2 * zeta * wnT + wnT * wnT)
  // The closed loop, as the denominator of H(z) = (kp + ki) z^-1 ... over
  // 1 - (2 - kp - ki) z^-1 + (1 - kp) z^-2.
  const a1 = -(2 - kp - ki)
  const a2 = 1 - kp
  const disc = a1 * a1 - 4 * a2
  const poles =
    disc >= 0
      ? [
          [(-a1 + Math.sqrt(disc)) / 2, 0],
          [(-a1 - Math.sqrt(disc)) / 2, 0],
        ]
      : [
          [-a1 / 2, Math.sqrt(-disc) / 2],
          [-a1 / 2, -Math.sqrt(-disc) / 2],
        ]
  const radius = Math.hypot(poles[0][0], poles[0][1])
  return {
    bnT,
    zeta,
    bn,
    wn,
    kp,
    ki,
    numerator: [0, kp + ki, -kp],
    denominator: [1, a1, a2],
    poles,
    poleRadius: radius,
    stable: radius < 1,
    // The continuous second-order envelope decays as e^{-zeta wn t}, so the
    // time to fall inside a band of `x` is ln(1/x) / (zeta wn).
    settleTo: (x) => Math.log(1 / x) / (zeta * wn),
    settleSymbols: (x) => Math.ceil((Math.log(1 / x) / (zeta * wn)) * symbolRate),
  }
}

/**
 * A Costas loop over a symbol stream.
 *
 * The error signal is the product of the two arms for BPSK, and the
 * four-quadrant version for QPSK. `order` selects the loop, and a first-order
 * loop is the one that cannot follow a frequency offset. E3 is that comparison,
 * and `staticError` is the number it reads.
 */
export function costasRun({
  symbols = 2000,
  phaseOffsetDeg = 40,
  freqOffsetHz = 0,
  symbolRate = 1000,
  bnT = 0.02,
  zeta = 0.707,
  order = 2,
  scheme = 'bpsk',
  ebN0Db = null,
  seed = 1,
}) {
  const f = loopFilter({ bnT, zeta, symbolRate })
  const r = rng(seed)
  const sigma = ebN0Db === null ? 0 : Math.sqrt(1 / (2 * 10 ** (ebN0Db / 10)))
  const dphi = (2 * Math.PI * freqOffsetHz) / symbolRate
  const err = new Float64Array(symbols)
  const phase = new Float64Array(symbols)
  let est = 0
  let integ = 0
  let truth = (phaseOffsetDeg * Math.PI) / 180
  for (let i = 0; i < symbols; i++) {
    const bit = r.uniform() < 0.5 ? -1 : 1
    const q = scheme === 'qpsk' ? (r.uniform() < 0.5 ? -1 : 1) : 0
    const scale = scheme === 'qpsk' ? Math.SQRT1_2 : 1
    const sr = bit * scale
    const si = q * scale
    // The error the DETECTOR sees, recorded before the correction rather than
    // after it. Recording it after leaves one step of the loop's own advance in
    // the reading, which reads as a static error a type-two loop does not have.
    const theta = truth - est
    phase[i] = (theta * 180) / Math.PI
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    const yr = sr * c - si * s + (sigma ? r.normal(0, sigma) : 0)
    const yi = sr * s + si * c + (sigma ? r.normal(0, sigma) : 0)
    const e = scheme === 'qpsk' ? yi * Math.sign(yr) - yr * Math.sign(yi) : yr * yi
    err[i] = e
    integ += f.ki * e
    est += f.kp * e + (order === 2 ? integ : 0)
    truth += dphi
  }
  // The residual is read over the last tenth of the run, after any transient.
  const tail = Math.max(1, Math.floor(symbols / 10))
  let sum = 0
  let sumSq = 0
  for (let i = symbols - tail; i < symbols; i++) {
    sum += phase[i]
    sumSq += phase[i] * phase[i]
  }
  const mean = sum / tail
  const variance = sumSq / tail - mean * mean
  // Where the error last left a half degree band, which is the acquisition.
  let settledAt = symbols
  for (let i = symbols - 1; i >= 0; i--) {
    if (Math.abs(phase[i] - mean) > 0.5) {
      settledAt = i + 1
      break
    }
  }
  return {
    phase,
    err,
    filter: f,
    residualDeg: Math.abs(mean),
    jitterDeg: Math.sqrt(Math.max(0, variance)),
    staticErrorDeg: Math.abs(mean),
    settledAt,
    settledMs: (settledAt / symbolRate) * 1000,
  }
}

/**
 * The early-late gate's S-curve.
 *
 * Two correlations taken half a symbol either side of the decision instant.
 * Their difference is zero at the right instant, and its sign says which way to
 * move. The curve's slope at zero is the detector gain.
 */
export function earlyLate({ h, sps = 8, spacing = 0.5, span = 1.5, points = 121 }) {
  // The cascade of the transmit and receive filters, which is what the gate
  // sees, sampled at every offset inside `span` symbols either side.
  const n = h.length
  const c = new Float64Array(2 * n - 1)
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[i + j] += h[i] * h[j]
  const mid = (c.length - 1) / 2
  const half = (spacing * sps) / 2
  const offsets = new Float64Array(points)
  const curve = new Float64Array(points)
  const peak = c[mid]
  for (let k = 0; k < points; k++) {
    const off = ((2 * k) / (points - 1) - 1) * span * sps
    offsets[k] = off / sps
    const early = interp(c, mid + off - half)
    const late = interp(c, mid + off + half)
    curve[k] = (Math.abs(early) - Math.abs(late)) / peak
  }
  const centre = (points - 1) / 2
  // The detector gain, by a central difference over the two neighbouring points.
  const slope = (curve[centre + 1] - curve[centre - 1]) / (offsets[centre + 1] - offsets[centre - 1])
  // Where the curve turns over. Past that offset a larger error produces a
  // smaller correction, so this is the edge of the range the loop pulls in from.
  let peakAt = 0
  let peakValue = 0
  for (let k = centre + 1; k < points; k++) {
    if (curve[k] > peakValue) {
      peakValue = curve[k]
      peakAt = offsets[k]
    }
  }
  // The next zero, if there is one inside the window. There is not always, and
  // `null` says so rather than a zero that would read as an offset of nothing.
  let zeroAt = null
  for (let k = centre + 1; k < points; k++) {
    if (curve[k] * curve[centre + 1] < 0) {
      zeroAt = offsets[k]
      break
    }
  }
  return { offsets, curve, slope, peakAt, peakValue, zeroAt, spacing, gateSamples: spacing * sps }
}

/** Linear interpolation into a buffer at a fractional index. */
function interp(buf, x) {
  if (x <= 0) return buf[0]
  if (x >= buf.length - 1) return buf[buf.length - 1]
  const i = Math.floor(x)
  const f = x - i
  return buf[i] * (1 - f) + buf[i + 1] * f
}

/**
 * The loop signal-to-noise ratio, `1 / (2 Bn T)` for a unit-power reference.
 * Narrowing the loop buys this and costs acquisition time, which is E5.
 */
export function loopSnrDb(bnT) {
  return 10 * Math.log10(1 / (2 * bnT))
}

/** A constant phase error scales the wanted component by its cosine. */
export function phaseErrorLossDb(degrees) {
  const c = Math.cos((degrees * Math.PI) / 180)
  // At a quarter turn nothing of the wanted component is left, and the cosine
  // of a quarter turn is not exactly zero in floating point. The comparison is
  // against a floor rather than against zero, so the answer there is infinite
  // rather than 324 dB.
  return Math.abs(c) > 1e-12 ? -20 * Math.log10(Math.abs(c)) : Infinity
}

/** How far the constellation turns under a phase error, in degrees. */
export function rotationDeg(syms, degrees) {
  const th = (degrees * Math.PI) / 180
  const out = new Float64Array(syms.length)
  for (let i = 0; i < syms.length / 2; i++) {
    const v = at(syms, i)
    out[2 * i] = v[0] * Math.cos(th) - v[1] * Math.sin(th)
    out[2 * i + 1] = v[0] * Math.sin(th) + v[1] * Math.cos(th)
  }
  return out
}
