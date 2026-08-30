import { secondOrderMetrics, dcGain, magnitudeAt, bilinear } from '@ee-labs/systems'
import { buildLink } from '@ee-labs/ui'

// Which digital filter this circuit is.
//
// The claim the whole suite rests on is that an RLC network and a biquad are the
// same object in two vocabularies. This is where that stops being a claim: it
// works out the filter mode, cutoff and Q that a sampled version of the circuit
// on screen would need, and builds a link that loads exactly that.
//
// It only offers the mapping where it is honest. A second-order section can be
// a low-pass, a band-pass or a high-pass depending on where its zeros are, and
// a circuit whose response is not one of those shapes does not get a biquad
// claimed for it — it gets the raw discretised coefficients instead, which are
// still true and simply less tidy.

/**
 * Classify a second-order response by counting zeros at the origin.
 *
 * H = 1/D is a low-pass, H = s/D a band-pass, H = s²/D a high-pass. That is the
 * entire distinction, and it is readable straight off the numerator.
 */
function shapeOf(tf) {
  const b = [...tf.b]
  while (b.length && Math.abs(b[0]) < 1e-18) b.shift()
  const order = tf.a.length - 1
  const zerosAtOrigin = b.length ? b.length - 1 - lastNonZero(b) : 0
  if (order !== 2) return null
  if (b.length === 1) return 'lowpass'
  if (b.length === 2 && zerosAtOrigin === 1) return 'bandpass'
  if (b.length === 3 && zerosAtOrigin === 2) return 'highpass'
  return null
}

const lastNonZero = (arr) => {
  for (let i = arr.length - 1; i >= 0; i--) if (Math.abs(arr[i]) > 1e-18) return i
  return -1
}

/**
 * What Signal Lab would need to reproduce this circuit, or null.
 *
 * Two tiers, per Reed's full-fidelity rule (NEEDS.md, both directions). A
 * named shape is PREFERRED when it is exact — its f₀ and Q knobs mean
 * something over there. When no named shape fits but the order is ≤ 2, the
 * hand-over does NOT decline: Signal Lab's `biquad` block receives the five
 * raw coefficients bilinear-exactly, which is what carries the twin-T — the
 * filter no named mode can express — whole. `raw: true` marks that tier so
 * the panel can present it honestly as coefficients rather than a recipe.
 *
 * The one reasoned refusal left: a pole exactly at the origin (the op-amp
 * integrator). Its DC gain is unbounded, a sampled copy just counts forever,
 * and every Signal Lab plot would lie — declined, not approximated.
 *
 * The sample rate has to be well above the circuit's own frequency or the
 * discrete version is not the same filter in any useful sense — a corner at
 * half of Nyquist is warped badly enough that the correspondence stops being
 * the point. Twenty times is comfortable.
 */
export function asDigitalFilter(tf, { sampleRate = 48000, from = null } = {}) {
  const strip = (c) => {
    const out = [...c]
    while (out.length > 1 && Math.abs(out[0]) < 1e-18) out.shift()
    return out
  }
  const a = strip(tf.a)
  const order = a.length - 1
  if (order > 2) return null
  // Zero constant term in the denominator = a pole at s = 0.
  if (Math.abs(a[a.length - 1]) < 1e-18) return null

  const m = secondOrderMetrics(tf)
  const shape = shapeOf(tf)
  // The frequency the correspondence is anchored to (pre-warp, rate advice):
  // the resonance when there is one, the pole's own corner for first order,
  // nothing for a resistor network — no dynamics, nothing to warp.
  const fRef =
    m && Number.isFinite(m.f0) && m.f0 > 0
      ? m.f0
      : order === 1
        ? a[1] / a[0] / (2 * Math.PI)
        : null

  const digital = bilinear(tf, sampleRate, fRef)
  // The link wants exactly five numbers; a first-order (or flat) circuit's
  // shorter arrays pad with zeros, which the biquad runs as written.
  const five = (arr) => [...arr, 0, 0].slice(0, 3)
  const [b0, b1, b2] = five(digital.b)
  const [, a1 = 0, a2 = 0] = [...digital.a, 0, 0].slice(0, 3)
  // The receiving block's knobs stop at ±3.999, and Signal Lab clamps an
  // out-of-range arrival (with a warning). Coefficients grow as the rate
  // drops toward the corner, so this is a rate problem with a rate solution
  // — flagged here so the panel can say "raise the rate" BEFORE the link is
  // copied, instead of the other lab saying "clamped" after.
  const clipped = [b0, b1, b2, a1, a2].some((v) => Math.abs(v) > 3.999)

  const gain =
    shape === 'lowpass' ? dcGain(tf) : shape && fRef ? magnitudeAt(tf, fRef) / (m.q || 1) : dcGain(tf)

  return {
    shape,
    raw: !shape,
    clipped,
    f0: fRef,
    q: m ? m.q : null,
    zeta: m ? m.zeta : null,
    gain,
    sampleRate,
    digital,
    // Below about twenty samples per cycle the bilinear warp starts to matter
    // enough that "the same filter" needs qualifying. A flat network has no
    // cycle to sample; its ratio is honestly infinite and never "too fast".
    ratio: fRef ? sampleRate / fRef : Infinity,
    tooFast: fRef ? sampleRate / fRef < 20 : false,
    // Provenance rides along (from=circuit:<id>:<label>) so the receiving
    // lab can say "your RC low-pass" instead of the anonymous name of
    // whatever block it mapped to.
    //
    // The source is a SQUARE at about a fifth of the corner - Reed's call,
    // and the right one: its harmonic comb probes the curve at discrete,
    // checkable points (fundamental in the passband, harmonics marching
    // through the corner) and gives the scope a story - corners rounding,
    // plateaus dying - where noise gave shimmer. And the link carries a
    // zoom= of eight corners, because the exact mapping LOOKED wrong
    // without it: the rate is chosen ~100x above the corner for bilinear
    // headroom, Signal Lab's axis is linear to Nyquist, and a 1.6 kHz
    // corner was arriving crushed into the first 1.7% of the plot.
    link: buildLink({
      rate: sampleRate,
      sources: [
        fRef
          ? { type: 'square', freq: Number((fRef / 5).toPrecision(2)), amp: 0.8 }
          : { type: 'square', freq: 250, amp: 0.8 },
      ],
      blocks: [
        shape && fRef
          ? { type: shape, params: [fRef, m.q] }
          : { type: 'biquad', params: [b0, b1, b2, a1, a2] },
      ],
      ...(fRef ? { zoom: Math.min(8 * fRef, sampleRate / 2) } : {}),
      ...(from ? { from } : {}),
    }),
  }
}

/** A sample rate that leaves plenty of room above the circuit's own frequency. */
export function suggestRate(f0) {
  if (!(f0 > 0)) return 48000
  const wanted = f0 * 100
  for (const r of [8000, 16000, 22050, 44100, 48000, 96000, 192000]) {
    if (r >= wanted) return r
  }
  return 192000
}

// ------------------------------------------------- and as a thing to control

/**
 * The same circuit, expressed as a plant Control Lab can close a loop around.
 *
 * Control Lab's plants are a fixed set with named parameters rather than
 * arbitrary transfer functions, so this only offers a hand-over where the
 * mapping is exact. A series RLC measured across its capacitor IS
 * K*wn^2/(s^2 + 2*zeta*wn*s + wn^2) with wn = 1/sqrt(LC) and zeta = (R/2)sqrt(C/L)
 * — the same two numbers the filter view already reports as f0 and Q.
 *
 * Measured across R or L the numerator has zeros in it, and Control Lab's
 * second-order plant has none. That is a different system, so it is declined
 * rather than approximated: a plant that is nearly right would produce a loop
 * whose margins are confidently wrong.
 */
export function asControlPlant(tf, from = null) {
  const m = secondOrderMetrics(tf)
  const strip = (c) => {
    const out = [...c]
    while (out.length > 1 && Math.abs(out[0]) < 1e-18) out.shift()
    return out
  }

  // Second order with a constant numerator: Control Lab's `secondOrder`.
  if (m && strip(tf.b).length === 1) {
    const k = dcGain(tf)
    if (!Number.isFinite(k)) return null
    return {
      plant: 'secondOrder',
      label: 'a second-order plant',
      params: [k, m.wn, m.zeta],
      detail: { k, wn: m.wn, zeta: m.zeta },
      why:
        `Resonant at ${(m.wn / (2 * Math.PI)).toPrecision(4)} Hz with a damping ratio of ` +
        `${m.zeta.toPrecision(3)} — the same two numbers the filter view calls f₀ and Q.`,
      link: buildLink({
        plant: { type: 'secondOrder', params: [k, m.wn, m.zeta] },
        ctrl: { type: 'p', params: [1] },
        ...(from ? { from } : {}),
      }),
    }
  }

  const a = strip(tf.a)

  // A single pole at the ORIGIN is checked first, because it also looks
  // first-order: an early `return null` in the branch below swallowed the
  // integrator entirely, since its DC gain is infinite and its time constant a
  // division by zero. A branch that cannot handle a case must fall through to
  // the next one, not decide for it.
  if (a.length === 2 && Math.abs(a[1]) < 1e-18) {
    const k = strip(tf.b)[0] / a[0]
    if (Number.isFinite(k)) {
      return {
        plant: 'integrator',
        label: 'an integrator',
        params: [Math.abs(k)],
        detail: { k: Math.abs(k) },
        why:
          'A pole exactly at the origin, so proportional control alone already gives zero ' +
          'steady-state error to a step.',
        link: buildLink({
          plant: { type: 'integrator', params: [Math.abs(k)] },
          ctrl: { type: 'p', params: [1] },
          ...(from ? { from } : {}),
        }),
      }
    }
  }

  // First order with a constant numerator: `firstOrder`, K/(1 + tau s).
  if (a.length === 2 && strip(tf.b).length === 1) {
    const k = dcGain(tf)
    const tau = a[0] / a[1]
    if (Number.isFinite(k) && tau > 0) {
      return {
        plant: 'firstOrder',
        label: 'a first-order lag',
        params: [k, tau],
        detail: { k, tau },
        why:
          `One pole, a time constant of ${tau.toPrecision(4)} s, and no way to be destabilised ` +
          'by any amount of proportional gain.',
        link: buildLink({
          plant: { type: 'firstOrder', params: [k, tau] },
          ctrl: { type: 'p', params: [1] },
          ...(from ? { from } : {}),
        }),
      }
    }
  }

  return null
}
