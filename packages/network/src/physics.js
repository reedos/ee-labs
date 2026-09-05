// The handful of constants and numerical guards every nonlinear device needs.
//
// They lived in diode.js while the diode was the only curve in the package.
// The transistors need the same thermal voltage and the same junction limiter,
// and diode.js has to reach into bjt.js for the region dispatch, so the shared
// half moves here where nothing imports anything. diode.js and pwl.js re-export
// what they always exported, so no consumer notices.

/** Boltzmann's constant and the elementary charge, SI. */
export const K_B = 1.380649e-23
export const Q_E = 1.602176634e-19
/** Room temperature, the 300 K a textbook rounds to. */
export const T_ROOM = 300

/** The thermal voltage kT/q — 25.852 mV at 300 K, the number every junction rule of thumb is built on. */
export function thermalVoltage(T = T_ROOM) {
  return (K_B * T) / Q_E
}

export const VT = thermalVoltage()

/**
 * SPICE's GMIN: the smallest conductance a junction is allowed to have. Twenty
 * volts the wrong way round makes e^(v/nV_T) underflow to nothing, and a node
 * connected to the circuit by a conductance of exactly zero is not connected at
 * all — the matrix says so. A real junction leaks; a picosiemens is less than
 * any of them and enough to keep the node attached.
 */
export const GMIN = 1e-12

/**
 * SPICE's junction limiting: an exponential rises so fast that an unguarded
 * Newton step overflows on the first iteration. This is the standard damping —
 * beyond the critical voltage the step is taken in the log, not in volts.
 */
export function pnjlim(vnew, vold, vt, vcrit) {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt
      return arg > 0 ? vold + vt * Math.log(arg) : vcrit
    }
    return vnew > 0 ? vt * Math.log(vnew / vt) : vnew
  }
  return vnew
}

/** The voltage above which the exponential is steeper than the limiter allows. */
export const vcrit = (nvt, is) => nvt * Math.log(nvt / (Math.SQRT2 * is))

/**
 * The step limiter every companion element uses on a junction voltage, and a
 * plain cap on a voltage that has no junction behind it (a MOSFET's v_DS).
 * Keeping both here means the Newton loop applies one rule and the device
 * decides what that rule is.
 */
export const limitTo = (vnew, vold, span) => (Math.abs(vnew - vold) > span ? vold + Math.sign(vnew - vold) * span : vnew)
