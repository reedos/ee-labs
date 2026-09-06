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

/**
 * What a DIRECTLY ENTERED value becomes: typed then Enter/blur, nudged with
 * the arrow keys, wheel, or the +/- spinner buttons. None of those are a
 * drag — the student never passed through the slider's intermediate
 * positions, so pulling the result onto the slider's POS_MAX grid (what
 * `snap()` does for `fromPos`) is not rounding to a real limit, it's
 * rounding to a UI convenience that has nothing to do with what was asked
 * for. A ±24 V knob's grid step is ~0.048 V; committing a typed −1 mV
 * through it lands on exactly 0 — the value the student explicitly rejected.
 *
 * The only things allowed to move a directly-entered value away from what
 * was typed:
 *   - the knob's own min/max (clamp — always applies)
 *   - a caller-given `step` — that is the knob author's own resolution
 *     limit (an integer channel count, a 10 ms timebase grain), not a
 *     derived slider convenience, so it is honoured exactly as `snap()`
 *     honours it
 *   - pow2's rounding to the nearest power of two, which is not a UI grid
 *     either: fft() throws on anything else, so it is a hard requirement
 *     of the thing being modelled
 *   - log's 4-significant-figure rounding: also not a UI-grid artifact but
 *     a cross-component agreement — apps/control-lab's LoopDiagram
 *     independently redraws the same live number elsewhere and its own
 *     doc comment records that it depends on the field having already
 *     settled to 4 figures (see LoopDiagram.jsx). Changing that needs a
 *     coordinated edit on that side, out of scope here.
 *
 * A MISSING linear step, by contrast, is purely `defaultLinearStep`'s
 * slider-drag convenience and must NOT apply here — that default existing
 * at all is what let 5 mA and −1 mV get quantised away in the first place.
 */
export function commitValue(value, { scale, min, max, step }) {
  switch (scale) {
    case 'pow2':
      return clamp(Math.pow(2, Math.round(log2(value))), min, max)
    case 'log':
      return clamp(Number(value.toPrecision(4)), min, max)
    default:
      return step > 0 ? clamp(Math.round(value / step) * step, min, max) : clamp(value, min, max)
  }
}

/** Are two values close enough to call a preset chip "active"? */
export function near(a, b, { scale, min, max, step }) {
  if (scale === 'log' || scale === 'pow2') {
    return b !== 0 && Math.abs(a - b) / Math.abs(b) < 0.001
  }
  return Math.abs(a - b) < (step > 0 ? step : defaultLinearStep(min, max)) / 2
}
