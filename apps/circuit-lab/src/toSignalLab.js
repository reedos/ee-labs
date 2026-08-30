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
 * The sample rate has to be well above the circuit's own frequency or the
 * discrete version is not the same filter in any useful sense — a corner at
 * half of Nyquist is warped badly enough that the correspondence stops being
 * the point. Twenty times is comfortable.
 */
export function asDigitalFilter(tf, { sampleRate = 48000 } = {}) {
  const m = secondOrderMetrics(tf)
  if (!m) return null
  const shape = shapeOf(tf)
  const f0 = m.f0
  if (!(f0 > 0) || !Number.isFinite(f0)) return null

  const gain = shape === 'lowpass' ? dcGain(tf) : magnitudeAt(tf, f0) / (m.q || 1)
  const digital = bilinear(tf, sampleRate, f0)

  return {
    shape,
    f0,
    q: m.q,
    zeta: m.zeta,
    gain,
    sampleRate,
    digital,
    // Below about twenty samples per cycle the bilinear warp starts to matter
    // enough that "the same filter" needs qualifying.
    ratio: sampleRate / f0,
    tooFast: sampleRate / f0 < 20,
    link:
      shape && f0 > 0
        ? buildLink({
            rate: sampleRate,
            sources: [{ type: 'noise', freq: 100, amp: 0.6 }],
            blocks: [{ type: shape, params: [f0, m.q] }],
          })
        : null,
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
