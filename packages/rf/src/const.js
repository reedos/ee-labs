// The package's error type, and the guards every module checks with.
//
// A setting this engine will not describe is refused with a sentence naming the
// field and what it must be, in the register `NetworkError` and `FieldsError`
// already use. The app prints that sentence where the number would be, so a
// knob taken past what an object allows reads as a refusal and not as a value
// that happens to be finite.

export class RfError extends Error {
  constructor(message, detail = {}) {
    super(message)
    this.name = 'RfError'
    this.field = detail.field
    this.kind = detail.kind
    this.detail = detail
  }
}

/** Throw with a reason unless the condition holds. */
export function require_(ok, message, detail = {}) {
  if (!ok) throw new RfError(message, detail)
  return true
}

/** A quantity that must be finite and above zero. */
export function positive(v, name) {
  require_(Number.isFinite(v) && v > 0, `${name} must be a positive number, and it is ${v}.`, { field: name })
  return v
}

/** A quantity that must be finite and at or above zero. */
export function nonNegative(v, name) {
  require_(Number.isFinite(v) && v >= 0, `${name} must be zero or a positive number, and it is ${v}.`, { field: name })
  return v
}

/** Decibels from a magnitude ratio, and back. */
export const dB = (mag) => 20 * Math.log10(mag)
export const fromDb = (db) => Math.pow(10, db / 20)

/** Radians to degrees, and back. */
export const deg = (rad) => (rad * 180) / Math.PI
export const rad = (d) => (d * Math.PI) / 180
