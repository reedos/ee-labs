// The LED and the laser: one junction, one photon energy, two ways of using it.
//
// CORE_SCOPE.md class, restated where the work happens.
//
//   EXACT, never hedged: the electrical port. Both devices are forward-biased
//   junctions, and `driveNet` hands the same three elements to
//   @ee-labs/network that a diode experiment in any other lab hands it. The
//   current is the solver's, not a formula's, and the voltage across the
//   junction is the solver's too.
//
//   EXACT FOR A STATED MODEL, with the model named where the number is shown:
//   the optical port. An LED's output is a fixed internal efficiency times the
//   photon energy times the current, which is a linear model of recombination
//   and is what a datasheet's L-I line means. Its modulation bandwidth is one
//   pole at 1/(2 pi tau_c), which is a single carrier lifetime standing for
//   every recombination path. The laser's output above threshold is a fixed
//   differential efficiency on the current above threshold, and the threshold
//   itself is rate.js's, not a number typed here. `MODEL` names each of the
//   three on the pane that prints it.
//
//   DECLINED: nothing. Everything this module states is algebra over the
//   junction the solver returned and the photon energy the wavelength sets.
//
// One quantity ties the two ports together and it earns its own name.
// `voltsPerPhoton`, h nu / q, is the volts an electron would have to fall
// through to carry one photon's energy. At 1550 nm it is 0.79990 V. Optical
// power is that voltage times a current times an efficiency, every time, so a
// milliamp at 1550 nm is at most 0.79990 mW of light and the efficiency says
// how much of it is real.

import { newtonDC } from '@ee-labs/network'
import { C0, H_PLANCK, Q_E, fraction, nonNegative, positive, require_ } from './const.js'
import { photonEnergy } from './photon.js'

/** The three models this module ships, named where a pane prints their numbers. */
export const MODEL = {
  led: 'a fixed internal efficiency on every electron, which is what an L-I line means',
  bandwidth: 'one pole at one carrier lifetime, standing for every recombination path',
  laser: 'a fixed differential efficiency on the current above the threshold rate.js returns',
}

/**
 * The volts an electron falls through to carry one photon of wavelength
 * `lambda`, h nu / q. At 1550 nm it is 0.79990 V and at 850 nm it is 1.4586 V.
 *
 * It is the photon's energy in electronvolts read as a voltage, so an optical
 * power is this times a current times an efficiency.
 */
export const voltsPerPhoton = (lambda) => photonEnergy(lambda).eV

/** The thermal voltage at the room temperature this package quotes every noise figure at. */
export const VT_ROOM = 0.025851999786435013

/** The defaults a source netlist fills in, so a caller states only what it changes. */
export const SOURCE_DEFAULTS = {
  drive: 2.5, // the supply behind the series resistor, volts
  series: 68, // the series resistor that sets the current, ohms
  is: 1e-12, // the junction's reverse saturation current, amps
  n: 2, // the ideality factor a wide-gap junction runs at
}

/**
 * The forward-biased junction, as a netlist @ee-labs/network solves.
 *
 * Three elements and two nodes, and the same shape a diode experiment in any
 * other lab loads. `Vd` is the supply, `Rs` sets the current, and `D1` is the
 * junction, anode at node `a` and cathode at ground, so a positive supply
 * drives it forward.
 *
 * The LED and the laser share this netlist exactly. Nothing electrical
 * distinguishes them in this lab, which is C1's claim. What differs is where
 * the recombined carriers go, not what the junction does with the volts.
 */
export function driveNet(spec = {}) {
  const s = { ...SOURCE_DEFAULTS, ...spec }
  positive(s.series, 'series')
  nonNegative(s.drive, 'drive')
  positive(s.is, 'is')
  positive(s.n, 'n')
  return {
    elements: [
      { type: 'V', id: 'Vd', nodes: ['vd', 'gnd'], value: s.drive },
      { type: 'R', id: 'Rs', nodes: ['vd', 'a'], value: s.series },
      { type: 'D', id: 'D1', nodes: ['a', 'gnd'], model: 'exp', is: s.is, n: s.n },
    ],
    spec: s,
  }
}

/**
 * The junction's operating point, from the same Newton iteration every other
 * diode in the suite is solved by.
 *
 * `current` is the solver's reading of the series resistor and `forward` is the
 * node voltage the solver left on the anode. Nothing is computed outside the
 * solve, so KCL at node `a` is the solver's to keep and the test measures it
 * there rather than re-deriving it.
 */
export function drive(spec = {}) {
  const net = driveNet(spec)
  const r = newtonDC(net)
  const va = r.sol.v.a
  return {
    spec: net.spec,
    current: r.sol.i.Rs,
    forward: va,
    across: net.spec.drive - va, // what the series resistor took
    // The reading's own arithmetic floor. A current read as the difference of
    // two node voltages carries the supply's last bits, so a comparison uses
    // this rather than a chosen epsilon.
    floor: (64 * Number.EPSILON * Math.max(net.spec.drive, Math.abs(va))) / net.spec.series,
    iters: r.iters.length,
    sol: r.sol,
    elements: net.elements,
  }
}

/** The junction's current at each of a list of supply voltages, everything else held. */
export const driveSweep = (spec, drives) => drives.map((d) => ({ drive: d, ...drive({ ...spec, drive: d }) }))

/**
 * Shockley's law read backwards: the forward voltage a junction sits at when a
 * current source pushes `current` through it.
 *
 * C2 to C5 drive the device from a current, because an L-I curve is measured
 * from a current source. This is what that current costs in volts, so the
 * electrical port stays on the pane.
 */
export function forwardVoltage({ current, is = SOURCE_DEFAULTS.is, n = SOURCE_DEFAULTS.n, vt = VT_ROOM }) {
  nonNegative(current, 'current')
  positive(is, 'is')
  positive(n, 'n')
  return n * vt * Math.log1p(current / is)
}

// ------------------------------------------------------------------- the LED

/**
 * The LED's optical power, P = eta_int (h nu / q) I.
 *
 * Linear in current, which is the model MODEL.led names. Every electron that
 * recombines either makes a photon or does not, and the internal efficiency is
 * the fraction that does. At 1550 nm and an efficiency of one, a milliamp buys
 * 0.79990 mW.
 */
export function ledOutput({ etaInt = 1, lambda, current }) {
  fraction(etaInt, 'etaInt')
  nonNegative(current, 'current')
  const volts = voltsPerPhoton(lambda)
  const slope = etaInt * volts
  return { power: slope * current, slope, volts, current, etaInt, model: MODEL.led }
}

/**
 * The LED's modulation bandwidth, 1/(2 pi tau_c).
 *
 * One carrier lifetime gives one pole, which is the model MODEL.bandwidth
 * names. At 5.0 ns that is 31.831 MHz, at 1.0 ns it is 159.15 MHz and at
 * 20.0 ns it is 7.9577 MHz. This is the number that sends a fibre link past a
 * hundred megabits to a laser.
 */
export function ledBandwidth({ tauC }) {
  positive(tauC, 'tauC')
  return { f3db: 1 / (2 * Math.PI * tauC), tauC, model: MODEL.bandwidth }
}

/** The magnitude of the LED's one-pole response at a frequency, against its low-frequency value. */
export function ledResponse({ tauC, f }) {
  const { f3db } = ledBandwidth({ tauC })
  return 1 / Math.hypot(1, nonNegative(f, 'f') / f3db)
}

// ----------------------------------------------------------------- the laser

/**
 * The slope efficiency of a laser above threshold, eta_d h nu / q, in watts an
 * amp.
 *
 * At 1550 nm, where h nu / q is 0.79990 V, an eta_d of 0.4 gives 0.31996 W/A,
 * which is 0.31996 mW/mA. The unit is the same number twice, which is why a
 * datasheet quotes it in milliwatts a milliamp.
 */
export function slopeEfficiency({ etaD, lambda }) {
  fraction(etaD, 'etaD')
  const volts = voltsPerPhoton(lambda)
  return { slope: etaD * volts, volts, etaD }
}

/**
 * The laser's output power at a current, given the threshold rate.js returned.
 *
 * Above threshold the output rises at the slope efficiency, on the current
 * above threshold. Below it the stimulated output is zero, and what leaves the
 * facet is spontaneous at the much smaller efficiency `etaSp`. Both slopes are
 * returned, because C4's claim is the ratio between them.
 *
 * `ith` is required rather than defaulted. The threshold current belongs to the
 * rate equations, and a source module that invented one would let two panes
 * disagree about the same laser.
 */
export function laserOutput({ etaD, lambda, current, ith, etaSp = 0 }) {
  nonNegative(current, 'current')
  positive(ith, 'ith')
  fraction(etaSp, 'etaSp')
  const { slope, volts } = slopeEfficiency({ etaD, lambda })
  const spontaneousSlope = etaSp * volts
  const above = current > ith
  const stimulated = above ? slope * (current - ith) : 0
  const spontaneous = spontaneousSlope * Math.min(current, ith)
  return {
    power: stimulated + spontaneous,
    stimulated,
    spontaneous,
    slope,
    spontaneousSlope,
    // How much steeper the device gets at threshold. This is the kink as a
    // number, and it is what C4 measures.
    slopeRatio: spontaneousSlope > 0 ? slope / spontaneousSlope : Infinity,
    volts,
    above,
    ith,
    current,
    model: MODEL.laser,
  }
}

/**
 * The wall-plug efficiency: optical power out over electrical power in.
 *
 * It needs the forward voltage as well as the current, which is why the
 * electrical port stays on the pane. A laser at twice threshold turns a few
 * tens of per cent of its supply into light, and the rest into heat.
 */
export function wallPlug({ power, current, forward }) {
  nonNegative(power, 'power')
  positive(current, 'current')
  positive(forward, 'forward')
  return power / (current * forward)
}

/** The photon energy in joules at a wavelength, for a caller counting quanta. */
export const quantumOf = (lambda) => (H_PLANCK * C0) / positive(lambda, 'lambda')

/** The charge on the electron, re-exported so a caller counting electrons has it. */
export { Q_E }

/**
 * The spectral width of a source in metres, from its width in frequency.
 *
 * A source's width is quoted both ways, and the conversion is lambda squared
 * times the frequency width over the speed of light. It is here because C3 and
 * F2 both need it and neither owns it.
 */
export function widthInWavelength({ lambda, dNu }) {
  positive(lambda, 'lambda')
  nonNegative(dNu, 'dNu')
  require_(Number.isFinite(dNu), 'A spectral width in frequency must be a finite number.', { field: 'dNu' })
  return (lambda * lambda * dNu) / C0
}
