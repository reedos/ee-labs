// The Fabry-Perot cavity: two mirrors, one round trip, and a response that is
// exact at every frequency and rational at none.
//
// Which class each object is in, in `CORE_SCOPE.md`'s three:
//
//   EXACT, and never hedged: the Airy transmission as a function of the
//   round-trip phase; the free spectral range in frequency and in wavelength;
//   the finesse; the linewidth; the peak-to-valley contrast; the facet
//   reflectance of a step in refractive index; the mirror loss; and the photon
//   lifetime that follows from it.
//
//   DECLINED, with the reason as content: the hand-over of this cavity to
//   @ee-labs/systems. The round trip carries the factor `e^{−j2βL}`, which is
//   transcendental and has no finite poles or zeros, exactly as a transmission
//   line's `e^{−γl}` does. `refuseRational` throws with that reason and
//   `rationalAvailable` returns it as a sentence. The response itself is exact
//   at every frequency, and the message says so.
//
// Lengths are in metres, frequencies in hertz, wavelengths in metres.

import { C0, PhotonicsError, finite, fraction, nonNegative, positive, require_ } from './const.js'

/** The finesse at which the standard linewidth becomes the half-power width, within one per cent. */
export const LINEWIDTH_GUARD = 10

/**
 * The reflectance of a step from `n0` to `n`, `((n − n₀)/(n + n₀))²`. A
 * semiconductor facet against air is a mirror nobody deposited: 3.5 against 1
 * gives 0.30864.
 */
export function facetReflectance({ n, n0 = 1 }) {
  positive(n, 'refractive index')
  positive(n0, 'index outside the cavity')
  const r = (n - n0) / (n + n0)
  return r * r
}

/** The free spectral range `c / (2 n L)`, hertz. */
export function freeSpectralRange({ n, length }) {
  positive(n, 'refractive index')
  positive(length, 'cavity length')
  return C0 / (2 * n * length)
}

/** The same spacing in wavelength at `lambda`, `λ² / (2 n L)`, metres. */
export function fsrWavelength({ n, length, lambda }) {
  positive(lambda, 'wavelength')
  return (lambda * lambda) / (2 * positive(n, 'refractive index') * positive(length, 'cavity length'))
}

/**
 * The round trip's amplitude factor, `√(R₁ R₂) e^{−α_i L}`. Everything else in
 * this module is a function of it.
 */
export function roundTrip({ R1, R2 = R1, lossInternal = 0, length = 0 }) {
  fraction(R1, 'front reflectance')
  fraction(R2, 'back reflectance')
  nonNegative(lossInternal, 'internal loss')
  nonNegative(length, 'cavity length')
  return Math.sqrt(R1 * R2) * Math.exp(-lossInternal * length)
}

/**
 * The finesse `π √r / (1 − r)` with `r` the round-trip amplitude factor. For
 * two equal lossless mirrors that is `π √R / (1 − R)`, which is 2.5245 at a
 * bare semiconductor facet and 312.58 at a coated one.
 */
export function finesse(spec) {
  const r = roundTrip(spec)
  require_(
    r < 1,
    'A round trip that loses nothing has an infinite finesse and no linewidth. Lower a reflectance ' +
      'below one, or give the cavity an internal loss.',
    { field: 'R1' },
  )
  return (Math.PI * Math.sqrt(r)) / (1 - r)
}

/** The width of one resonance, the free spectral range divided by the finesse, hertz. */
export function linewidth(spec) {
  return freeSpectralRange(spec) / finesse(spec)
}

/**
 * The exact full width at half maximum of one resonance, hertz, taken from the
 * Airy form itself. Half the peak is where `4 r sin²(φ/2) = (1 − r)²`, so the
 * width in phase is `4 asin((1 − r) / (2√r))` and the width in frequency is
 * that fraction of a free spectral range.
 */
export function halfPowerWidth(spec) {
  const r = roundTrip(spec)
  require_(r < 1, 'A round trip that loses nothing has no width to measure.', { field: 'R1' })
  const phase = 4 * Math.asin(Math.min(1, (1 - r) / (2 * Math.sqrt(r))))
  return (freeSpectralRange(spec) * phase) / (2 * Math.PI)
}

/**
 * The guard on `linewidth`. The standard free-spectral-range-over-finesse form
 * is the half-power width in the limit of a round trip that loses little, and
 * it is narrow at a low finesse. This compares the two and gives the verdict at
 * a finesse of 10.
 */
export function linewidthGuard(spec) {
  const f = finesse(spec)
  const quoted = linewidth(spec)
  const exact = halfPowerWidth(spec)
  const error = Math.abs(exact - quoted) / exact
  const ok = f >= LINEWIDTH_GUARD
  return {
    quantity: 'finesse',
    threshold: LINEWIDTH_GUARD,
    value: f,
    quoted,
    exact,
    error,
    ok,
    says: ok
      ? `The finesse is ${f.toPrecision(4)}, at or above 10, so the free spectral range over the finesse ` +
        `is the half-power width to within ${(100 * error).toPrecision(2)} per cent.`
      : `The finesse is ${f.toPrecision(4)}, below 10. The free spectral range over the finesse is ` +
        `${(100 * error).toPrecision(3)} per cent narrower than the half-power width of the drawn peak.`,
  }
}

/**
 * The ratio of the peak transmission to the valley between two peaks,
 * `((1 + r)/(1 − r))²`, and the same ratio in decibels.
 */
export function contrast(spec) {
  const r = roundTrip(spec)
  const ratio = Math.pow((1 + r) / (1 - r), 2)
  return { ratio, db: 10 * Math.log10(ratio) }
}

/**
 * The round-trip phase `2 β L = 4π n L f / c`, radians. This is the argument
 * everything below is periodic in, and the reason none of it is rational.
 */
export function roundTripPhase({ n, length, freq }) {
  positive(n, 'refractive index')
  positive(length, 'cavity length')
  nonNegative(freq, 'frequency')
  return (4 * Math.PI * n * length * freq) / C0
}

/**
 * The Airy transmission at a round-trip phase, normalised to one at a peak:
 * `(1 − r)² / ((1 − r)² + 4 r sin²(φ/2))`.
 */
export function airy({ phase, ...spec }) {
  const r = roundTrip(spec)
  finite(phase, 'round-trip phase')
  const s = Math.sin(phase / 2)
  return Math.pow(1 - r, 2) / (Math.pow(1 - r, 2) + 4 * r * s * s)
}

/** The transmission of a cavity at an optical frequency, the two forms joined. */
export function transmissionAt({ n, length, freq, ...spec }) {
  return airy({ phase: roundTripPhase({ n, length, freq }), ...spec, length })
}

/**
 * The transmission across a span of frequencies, with the peaks marked. Returns
 * `{ points, peaks, fsr, finesse, linewidth }`, where a peak is a frequency at
 * which the round-trip phase is a whole number of turns.
 */
export function spectrum({ n, length, centre, span, points = 401, ...spec }) {
  positive(centre, 'centre frequency')
  positive(span, 'frequency span')
  require_(points >= 3 && Number.isFinite(points), `A spectrum needs at least three points, and it has ${points}.`, {
    field: 'points',
  })
  const fsr = freeSpectralRange({ n, length })
  const from = centre - span / 2
  const to = centre + span / 2
  const out = []
  for (let k = 0; k < points; k++) {
    const freq = from + ((to - from) * k) / (points - 1)
    out.push({ freq, t: transmissionAt({ n, length, freq, ...spec }) })
  }
  // A peak sits where the round-trip phase is a whole number of turns, so the
  // peaks are found from the order rather than by searching the samples.
  const first = Math.ceil(from / fsr)
  const last = Math.floor(to / fsr)
  const peaks = []
  for (let m = first; m <= last; m++) peaks.push({ order: m, freq: m * fsr })
  return { points: out, peaks, fsr, finesse: finesse({ ...spec, length }), linewidth: linewidth({ n, length, ...spec }) }
}

/**
 * The mirror loss `α_m = (1 / 2L) ln(1 / R)`, per metre, with `R` the geometric
 * mean of the two facets. This is the number the photon lifetime comes from, so
 * a reader who turns the facet reflectance moves both the cavity's linewidth and
 * a laser's threshold. At a bare facet of 0.30864 over 300 µm it is 19.593 per
 * centimetre.
 */
export function mirrorLoss({ R1, R2 = R1, length }) {
  fraction(R1, 'front reflectance')
  fraction(R2, 'back reflectance')
  positive(length, 'cavity length')
  const r = Math.sqrt(R1 * R2)
  require_(r > 0, 'A mirror of zero reflectance loses everything in one pass, and the loss is unbounded.', { field: 'R1' })
  return Math.log(1 / r) / (2 * length)
}

/**
 * The photon lifetime `n / (c (α_i + α_m))`, seconds. It is the time a photon
 * stays in the cavity, and it is what the laser's threshold in Group D is
 * built on.
 */
export function photonLifetime({ n, length, R1, R2 = R1, lossInternal = 0 }) {
  positive(n, 'refractive index')
  const am = mirrorLoss({ R1, R2, length })
  const total = nonNegative(lossInternal, 'internal loss') + am
  positive(total, 'cavity loss')
  return n / (C0 * total)
}

/** The sentence the `systems` hand-over declines with, so a pane can print it without catching. */
export function rationalAvailable() {
  return {
    ok: false,
    says:
      'This cavity has no rational transfer function. One round trip carries the factor e^(−j2βL), ' +
      'which is transcendental and has no finite poles or zeros, the same reason a transmission line ' +
      'has none. The transmission itself is exact at every frequency, and the plot draws it there.',
  }
}

/** The hand-over to @ee-labs/systems, declined with the reason above. */
export function refuseRational() {
  throw new PhotonicsError(rationalAvailable().says, { object: 'Fabry-Perot cavity', factor: 'e^(-j2betaL)' })
}
