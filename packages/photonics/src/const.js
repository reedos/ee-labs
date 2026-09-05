// The constants and the guards every other module in this package is written
// from.
//
// SI 2019 fixes the speed of light, Planck's constant and the elementary charge
// exactly, so the three numbers below are definitions and not measurements.
// `C0` is imported from @ee-labs/fields rather than retyped, because a suite
// with two speeds of light in it would disagree with itself in the sixteenth
// digit and nobody would find out where.
//
// One derived constant does most of the work. `h c / q` is 1.239842 eV µm, so a
// photon's energy in electronvolts is that number divided by the wavelength in
// micrometres, and a detector's responsivity in amps per watt is the quantum
// efficiency times the wavelength in micrometres divided by it. Both forms are
// exact rearrangements of the same product.
//
// Units, stated once. Wavelengths and cavity lengths are in metres. Fibre
// lengths are in kilometres and fibre attenuation is in dB/km, because that is
// how a fibre is specified and a lesson that converted them would quote numbers
// no datasheet carries. Dispersion is in ps/(nm km) for the same reason. Every
// function's own comment names the units it takes.

import { C0 } from '@ee-labs/fields'

export { C0 }

/** Planck's constant, joule seconds. Exact by the SI 2019 definition. */
export const H_PLANCK = 6.62607015e-34

/** The elementary charge, coulombs. Exact by the same definition. */
export const Q_E = 1.602176634e-19

/** Boltzmann's constant, joules per kelvin. Exact by the same definition. */
export const K_B = 1.380649e-23

/** Room temperature, the 300 K a textbook rounds to. */
export const T_ROOM = 300

/**
 * `h c / q` in electronvolt micrometres, 1.239842. A photon at one micrometre
 * carries this many electronvolts, and every energy, responsivity and cut-off
 * in this package is this constant divided by a wavelength.
 */
export const EV_UM = ((H_PLANCK * C0) / Q_E) * 1e6

/** Metres in a kilometre, so a conversion is named rather than typed. */
export const M_PER_KM = 1e3

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

/**
 * A number from zero to one, which is what a quantum efficiency, a reflectance
 * and a confinement factor each are. The upper end is included, because a
 * mirror of reflectance one is a case the cavity module has an answer for.
 */
export function fraction(value, name, { max = 1 } = {}) {
  require_(
    Number.isFinite(value) && value >= 0 && value <= max,
    `${name} must be between 0 and ${max}, and it is ${value}.`,
    { field: name },
  )
  return value
}

/** An optical power in watts written in dBm, one milliwatt being 0 dBm. */
export function dbm(watts) {
  positive(watts, 'optical power')
  return 10 * Math.log10(watts / 1e-3)
}

/** The inverse: watts from dBm. */
export function wattsOf(dbmValue) {
  finite(dbmValue, 'optical power in dBm')
  return 1e-3 * Math.pow(10, dbmValue / 10)
}
