// The photon, and the photodiode that counts it.
//
// Everything in this file is EXACT, and none of it is hedged. Photon energy,
// responsivity, the cut-off wavelength and the photon flux are four
// rearrangements of `h c / λ`, and the last of them is a division. There is no
// approximation to guard and nothing to decline.
//
// The photodiode is the exception in kind rather than in exactness. It is not a
// formula here: `photodiodeNet` returns a netlist that @ee-labs/network solves
// with the same Newton iteration that solves any other diode circuit. A
// photodiode is a reverse-biased junction with two current sources across it,
// the photocurrent and the dark current, and this module builds it out of
// elements the solver already stamps rather than asking for a new one.
//
// Wavelengths are in metres, powers in watts, currents in amps.

import { thermalVoltage } from '@ee-labs/network'
import { C0, EV_UM, H_PLANCK, Q_E, fraction, nonNegative, positive } from './const.js'

/** A wavelength in micrometres, which is the unit the eV form is written in. */
const um = (lambda) => positive(lambda, 'wavelength') * 1e6

/** Photon energy in joules, `h c / λ`. */
export function photonEnergy(lambda) {
  return (H_PLANCK * C0) / positive(lambda, 'wavelength')
}

/**
 * Photon energy in electronvolts, `1.239842 / λ` with λ in micrometres.
 * At 1550 nm it is 0.79990 eV, which is also the volts a laser's slope
 * efficiency is written over.
 */
export function photonEnergyEv(lambda) {
  return EV_UM / um(lambda)
}

/** The optical frequency `c / λ`, hertz. 193.41 THz at 1550 nm. */
export function opticalFrequency(lambda) {
  return C0 / positive(lambda, 'wavelength')
}

/** The wavelength of a given optical frequency, metres. The inverse of `opticalFrequency`. */
export function wavelengthOf(freq) {
  return C0 / positive(freq, 'optical frequency')
}

/**
 * Responsivity in amps per watt, `η q λ / (h c)`, which is `η λ / 1.239842`
 * with λ in micrometres. One carrier per absorbed photon is `η = 1`, and that
 * is the ceiling invariant 1 checks.
 */
export function responsivity({ eta = 1, lambda }) {
  fraction(eta, 'quantum efficiency')
  return (eta * um(lambda)) / EV_UM
}

/** The responsivity a quantum efficiency of one would give, the ceiling for that wavelength. */
export const idealResponsivity = (lambda) => responsivity({ eta: 1, lambda })

/** The quantum efficiency a measured responsivity implies at this wavelength. */
export function quantumEfficiencyOf({ responsivity: r, lambda }) {
  nonNegative(r, 'responsivity')
  return (r * EV_UM) / um(lambda)
}

/**
 * The longest wavelength a material of bandgap `egEv` electronvolts absorbs,
 * `h c / E_g`, in metres. Silicon's 1.12 eV stops at 1107.0 nm, which is why a
 * 1550 nm receiver is built from InGaAs.
 */
export function cutoffWavelength(egEv) {
  return (EV_UM * 1e-6) / positive(egEv, 'bandgap')
}

/** The bandgap whose cut-off is this wavelength, electronvolts. The inverse of `cutoffWavelength`. */
export const bandgapOf = (lambda) => EV_UM / um(lambda)

/** Photons a second in an optical power, `P / (h c / λ)`. */
export function photonFlux({ power, lambda }) {
  nonNegative(power, 'optical power')
  return power / photonEnergy(lambda)
}

/**
 * The current a photodiode delivers as a closed form: `R P_opt` plus the dark
 * current. `photodiodeNet` solves the same detector as a circuit, and invariant
 * 2 holds the two answers together.
 */
export function photocurrent({ eta = 1, lambda, power, dark = 0 }) {
  nonNegative(power, 'optical power')
  nonNegative(dark, 'dark current')
  return responsivity({ eta, lambda }) * power + dark
}

/**
 * The optical power at which the photocurrent equals the dark current. Below it
 * the detector reads its own leakage, above it the light.
 */
export function darkCrossover({ eta = 1, lambda, dark }) {
  positive(dark, 'dark current')
  return dark / responsivity({ eta, lambda })
}

/** The junction capacitance of a detector of this area, farads, from a capacitance per unit area. */
export function detectorCapacitance({ area, cPerArea }) {
  return positive(area, 'detector area') * positive(cPerArea, 'capacitance per unit area')
}

/** The optical power a detector of this area collects from an irradiance in W/m². */
export function collectedPower({ irradiance, area }) {
  return nonNegative(irradiance, 'irradiance') * positive(area, 'detector area')
}

/**
 * The corner of the first-order lag a detector capacitance makes into a load,
 * `1 / (2π R C)`, hertz. The capacitance grows with the detector's area and the
 * collected power grows with it too, so their product does not depend on area.
 * A5 measures that.
 */
export function detectorCorner({ load, capacitance }) {
  return 1 / (2 * Math.PI * positive(load, 'load resistance') * positive(capacitance, 'junction capacitance'))
}

/**
 * The photodiode as a circuit, for @ee-labs/network to solve.
 *
 * A bias source drives a load resistor into the detector node, and the detector
 * is an exponential junction with the photocurrent and the dark current across
 * it. The node names are fixed, because a lesson's meter reads them:
 *
 *   `bias`  the top of the bias source
 *   `k`     the cathode, where the load meets the junction
 *
 * Sign convention: an `I` element carries its value out of its first node and
 * into its second, so `['k', gnd]` is a current drawn from the cathode, which
 * is the way a photocurrent flows.
 */
export function photodiodeNet({ eta = 1, lambda, power, dark = 0, bias, load, is = 1e-14, n = 1 }) {
  nonNegative(bias, 'reverse bias')
  positive(load, 'load resistance')
  positive(is, 'saturation current')
  const iph = responsivity({ eta, lambda }) * nonNegative(power, 'optical power')
  return {
    iph,
    dark: nonNegative(dark, 'dark current'),
    elements: [
      { type: 'V', id: 'VB', nodes: ['bias', 'gnd'], value: bias },
      { type: 'R', id: 'RL', nodes: ['bias', 'k'], value: load },
      { type: 'D', id: 'D1', nodes: ['gnd', 'k'], model: 'exp', is, n },
      { type: 'I', id: 'Iph', nodes: ['k', 'gnd'], value: iph },
      { type: 'I', id: 'Idark', nodes: ['k', 'gnd'], value: dark },
    ],
  }
}

/**
 * The junction's own current at a solved detector node, amps, positive when it
 * flows the forward way. A reverse-biased junction returns very nearly minus
 * its saturation current, and that is what the load sees taken back off the
 * photocurrent.
 */
export function junctionCurrent({ v, is = 1e-14, n = 1, T = 300 }) {
  return is * (Math.exp(v / (n * thermalVoltage(T))) - 1)
}

export { Q_E }
