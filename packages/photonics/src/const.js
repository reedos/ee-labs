// The constants every other module in this package is written from.
//
// SI 2019 fixes the Planck constant, the speed of light, the elementary charge
// and the Boltzmann constant exactly, so the four numbers below are definitions
// and not measurements. Every photonic quantity in this package is built from
// them, and nothing in a lesson quotes a rounded constant of its own.
//
// One combination earns its own name. `hc/q` is 1.239841984... eV micrometre,
// which is the number a photonics reader carries in their head. A photon at one
// micrometre carries 1.2398 eV, and the responsivity of a detector of quantum
// efficiency one is lambda over that, in amps per watt.

/** Planck constant, joule seconds. Exact by definition (SI 2019). */
export const H_PLANCK = 6.62607015e-34

/** Speed of light in vacuum, metres per second. Exact by definition. */
export const C0 = 299792458

/** Elementary charge, coulombs. Exact by definition (SI 2019). */
export const Q_E = 1.602176634e-19

/** Boltzmann constant, joules per kelvin. Exact by definition (SI 2019). */
export const K_B = 1.380649e-23

/** Room temperature, kelvin, the temperature every noise figure here is quoted at. */
export const T_ROOM = 300

/**
 * `h c / q` in electronvolt metres, so that a photon of wavelength `lambda`
 * carries `HC_EV / lambda` electronvolts. Divided by 1e-6 it is the 1.23984
 * eV micrometre a datasheet uses.
 */
export const HC_EV = (H_PLANCK * C0) / Q_E

/** The error every function in this package throws, so a caller can catch one type. */
export class PhotonicsError extends Error {
  constructor(message, detail = {}) {
    super(message)
    this.name = 'PhotonicsError'
    Object.assign(this, detail)
  }
}

/** Throw a PhotonicsError unless `ok`. The message is what a reader sees, so it names the quantity. */
export function require_(ok, message, detail) {
  if (!ok) throw new PhotonicsError(message, detail)
}

/** A finite positive number, or a PhotonicsError naming the field. */
export function positive(value, name) {
  require_(
    Number.isFinite(value) && value > 0,
    `${name} must be a positive number, and it is ${value}.`,
    { field: name },
  )
  return value
}

/** A finite number that may be zero or negative, or a PhotonicsError naming the field. */
export function finite(value, name) {
  require_(Number.isFinite(value), `${name} must be a finite number, and it is ${value}.`, { field: name })
  return value
}

/** A finite number at or above zero, or a PhotonicsError naming the field. */
export function nonNegative(value, name) {
  require_(
    Number.isFinite(value) && value >= 0,
    `${name} must be zero or a positive number, and it is ${value}.`,
    { field: name },
  )
  return value
}

/** A fraction in [0, 1], for a quantum efficiency or a reflectance. */
export function fraction(value, name) {
  require_(
    Number.isFinite(value) && value >= 0 && value <= 1,
    `${name} must be between 0 and 1, and it is ${value}.`,
    { field: name },
  )
  return value
}

/**
 * Optical power in dBm, referred to one milliwatt.
 *
 * Zero power has no decibel value. It returns negative infinity rather than a
 * floor chosen for the plot, because a floor is a number a reader would take
 * for a measurement.
 */
export const toDbm = (watts) => (nonNegative(watts, 'power') === 0 ? -Infinity : 10 * Math.log10(watts / 1e-3))

/** Watts from dBm. */
export const fromDbm = (dbm) => (dbm === -Infinity ? 0 : 1e-3 * Math.pow(10, finite(dbm, 'dbm') / 10))

/** A power ratio in decibels. */
export const toDb = (ratio) => (nonNegative(ratio, 'ratio') === 0 ? -Infinity : 10 * Math.log10(ratio))

/** A power ratio from decibels. */
export const fromDb = (db) => (db === -Infinity ? 0 : Math.pow(10, finite(db, 'db') / 10))
