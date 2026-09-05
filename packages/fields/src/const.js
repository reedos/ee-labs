// The four constants every other module in this package is written from.
//
// SI 2019 fixes c and the elementary charge exactly, and mu0 is then a
// measured quantity rather than 4pi x 1e-7 exactly. The difference is 1.5
// parts in 10^10, far below anything a lesson quotes, but the definitions
// below follow the current SI so that a reader who checks against a modern
// table finds the same digits.
//
// Every formula in this package takes permittivity and permeability as
// absolute values, epsilon = EPS0 * epsr and mu = MU0 * mur. No function
// takes a relative value and a absolute value for the same quantity.

/** Speed of light in vacuum, metres per second. Exact by definition. */
export const C0 = 299792458

/** Vacuum magnetic permeability, henries per metre (CODATA 2018). */
export const MU0 = 1.25663706212e-6

/** Vacuum electric permittivity, farads per metre. Derived from c and mu0. */
export const EPS0 = 1 / (MU0 * C0 * C0)

/** Wave impedance of free space, ohms. Derived, about 376.730 ohms. */
export const ETA0 = MU0 * C0

/** Conductivity of annealed copper at 20 degrees Celsius, siemens per metre. */
export const SIGMA_CU = 5.8e7

/** Conductivity of aluminium at 20 degrees Celsius, siemens per metre. */
export const SIGMA_AL = 3.5e7

/** The error every function in this package throws, so a caller can catch one type. */
export class FieldsError extends Error {
  constructor(message, detail = {}) {
    super(message)
    this.name = 'FieldsError'
    Object.assign(this, detail)
  }
}

/** Throw a FieldsError unless `ok`. The message is what a reader sees, so it names the quantity. */
export function require_(ok, message, detail) {
  if (!ok) throw new FieldsError(message, detail)
}

/** A finite positive number, or a FieldsError naming the field. */
export function positive(value, name) {
  require_(Number.isFinite(value) && value > 0, `${name} must be a positive number, and it is ${value}.`, { field: name })
  return value
}

/** A finite number that may be zero or negative, or a FieldsError naming the field. */
export function finite(value, name) {
  require_(Number.isFinite(value), `${name} must be a finite number, and it is ${value}.`, { field: name })
  return value
}

/** A finite number at or above zero, or a FieldsError naming the field. */
export function nonNegative(value, name) {
  require_(Number.isFinite(value) && value >= 0, `${name} must be zero or a positive number, and it is ${value}.`, { field: name })
  return value
}
