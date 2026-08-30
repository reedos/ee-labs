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
 * Round a raw value to something a human would have typed.
 *
 * On a log scale that means constant *relative* precision — 250, 251 … 1000, 1010 —
 * which is what makes a log slider feel right. Rounding to a fixed decimal instead
 * would give absurd resolution at the bottom and none at the top.
 */
export function snap(value, { scale, min, max, step = 1 }) {
  switch (scale) {
    case 'pow2':
      return clamp(Math.pow(2, Math.round(log2(value))), min, max)
    case 'log':
      return clamp(Number(value.toPrecision(3)), min, max)
    default: {
      const s = step > 0 ? step : 1
      return clamp(Math.round(value / s) * s, min, max)
    }
  }
}

/** Are two values close enough to call a preset chip "active"? */
export function near(a, b, { scale, step = 1 }) {
  if (scale === 'log' || scale === 'pow2') {
    return b !== 0 && Math.abs(a - b) / Math.abs(b) < 0.001
  }
  return Math.abs(a - b) < (step > 0 ? step : 1) / 2
}
