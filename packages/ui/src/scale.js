// Slider position <-> value mapping.
//
// Every scale uses the same integer position domain, so the <input type="range">
// underneath a NumField always has the same min/max/step and there is exactly one
// code path for pointer drag, touch and arrow keys.

export const POS_MAX = 1000

const log2 = (v) => Math.log(v) / Math.LN2

/** Clamp helper shared by the field and the scales. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v
}

/**
 * `scale` is 'linear' | 'log' | 'pow2'.
 *
 * log requires min > 0. pow2 snaps to exact powers of two, which the FFT needs —
 * fft() throws on anything else.
 */
export function toPos(value, { scale, min, max }) {
  const v = clamp(value, min, max)
  let f
  switch (scale) {
    case 'log':
      f = Math.log(v / min) / Math.log(max / min)
      break
    case 'pow2':
      f = (log2(v) - log2(min)) / (log2(max) - log2(min))
      break
    default:
      f = (v - min) / (max - min)
  }
  return Math.round(clamp(f, 0, 1) * POS_MAX)
}

export function fromPos(pos, opts) {
  const { scale, min, max } = opts
  const f = clamp(pos / POS_MAX, 0, 1)
  switch (scale) {
    case 'log':
      return snap(min * Math.pow(max / min, f), opts)
    case 'pow2':
      return snap(Math.pow(2, log2(min) + f * (log2(max) - log2(min))), opts)
    default:
      return snap(min + f * (max - min), opts)
  }
}

/**
 * The step a linear knob uses when nothing sensible was given for one.
 *
 * A flat `1` is only safe by accident: right for a knob spanning tens or
 * hundreds of units, and silently destructive for one spanning a fraction of
 * a unit — a ±0.1 A current source rounds every typed entry to the nearest
 * whole ampere, i.e. to 0. There is no unit-independent constant that works
 * for every knob, but the slider underneath every NumField already carries
 * POS_MAX positions across min..max, so matching that grid gives a typed
 * value the same resolution a drag already has, and it scales with the
 * knob's own span instead of guessing at absolute units. A step that IS
 * given, however small or large, is still trusted as-is — this only fills
 * the gap when the caller passed none.
 */
export function defaultLinearStep(min, max) {
  const span = max - min
  return Number.isFinite(span) && span > 0 ? span / POS_MAX : 1
}

/**
 * Round a raw value to something a human would have typed.
 *
 * On a log scale that means constant *relative* precision — 250, 251 … 1000, 1010 —
 * which is what makes a log slider feel right. Rounding to a fixed decimal instead
 * would give absurd resolution at the bottom and none at the top.
 */
export function snap(value, { scale, min, max, step }) {
  switch (scale) {
    case 'pow2':
      return clamp(Math.pow(2, Math.round(log2(value))), min, max)
    case 'log':
      // Four figures, not three: a student who types the boundary gain 11.25
      // must read 11.25 back, or the chip, the field and the readout disagree
      // about whether they did what the note said.
      return clamp(Number(value.toPrecision(4)), min, max)
    default: {
      const s = step > 0 ? step : defaultLinearStep(min, max)
      return clamp(Math.round(value / s) * s, min, max)
    }
  }
}

/** Are two values close enough to call a preset chip "active"? */
export function near(a, b, { scale, min, max, step }) {
  if (scale === 'log' || scale === 'pow2') {
    return b !== 0 && Math.abs(a - b) / Math.abs(b) < 0.001
  }
  return Math.abs(a - b) < (step > 0 ? step : defaultLinearStep(min, max)) / 2
}
