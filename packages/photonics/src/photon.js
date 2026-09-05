// The photon, and the photodiode that counts them.
//
// CORE_SCOPE.md class, restated where the work happens.
//
//   EXACT, never hedged: the photon's energy hc/lambda, the photon flux P/E,
//   the responsivity eta q lambda / hc, and the cut-off wavelength hc/E_g of a
//   material of that bandgap. Each is algebra over the four defined constants
//   in const.js and nothing else.
//
//   EXACT, and solved rather than stated: the photodiode's operating point.
//   The photodiode is not a formula here. It is an ordinary two-terminal
//   element of @ee-labs/network, a junction with a current source of R P_opt
//   across it, and its current comes out of the same Newton iteration that
//   solves every other diode in the suite. That is why a load line has a
//   crossing point rather than an assumed one.
//
//   Nothing in this module is approximated, and nothing is declined.
//
// The one modelling choice worth naming is that the responsivity is zero past
// the cut-off wavelength rather than small. A photon below the bandgap does not
// make a carrier at all, so a silicon detector at 1550 nm reads zero and not a
// tail. `responsivity` takes the bandgap as an option and returns exactly zero
// past hc/E_g.

import { junctionCap, newtonDC } from '@ee-labs/network'
import { C0, HC_EV, H_PLANCK, Q_E, fraction, nonNegative, positive, require_ } from './const.js'

/**
 * A photon's energy at wavelength `lambda`, in metres.
 *
 * Returns the energy in joules and in electronvolts, and the optical frequency.
 * At 1550 nm a photon carries 0.7999 eV and the light oscillates at 193.4 THz.
 */
export function photonEnergy(lambda) {
  positive(lambda, 'lambda')
  return {
    lambda,
    joules: (H_PLANCK * C0) / lambda,
    eV: HC_EV / lambda,
    frequency: C0 / lambda,
  }
}

/** The wavelength whose photon carries `eV` electronvolts. The inverse of `photonEnergy`. */
export const wavelengthOf = (eV) => HC_EV / positive(eV, 'eV')

/**
 * The longest wavelength a material of bandgap `eg` (electronvolts) detects.
 *
 * A photon below the bandgap cannot lift an electron across it, so it passes
 * through. Silicon's 1.12 eV stops at 1107 nm, which is the whole reason a
 * 1550 nm receiver is made of indium gallium arsenide.
 */
export const cutoffWavelength = (eg) => HC_EV / positive(eg, 'eg')

/**
 * Photons a second in `power` watts at `lambda`.
 *
 * A milliwatt at 1550 nm is 7.80e15 photons a second, which is the number the
 * quantum limit is counted against.
 */
export const photonFlux = (power, lambda) => nonNegative(power, 'power') / photonEnergy(lambda).joules

/**
 * The responsivity of a detector, in amps per watt.
 *
 *   R = eta q lambda / (h c) = eta lambda / 1.23984 with lambda in micrometres
 *
 * One electron per absorbed photon is eta = 1, and then R rises with wavelength
 * because a longer wavelength puts more photons in the same watt. Past the
 * material's cut-off the answer is exactly zero, not small.
 */
export function responsivity({ eta = 1, lambda, eg = null }) {
  fraction(eta, 'eta')
  positive(lambda, 'lambda')
  if (eg !== null && lambda > cutoffWavelength(eg)) return 0
  return (eta * Q_E * lambda) / (H_PLANCK * C0)
}

/** The quantum efficiency behind a measured responsivity at a wavelength. */
export function quantumEfficiency({ responsivity: r, lambda }) {
  nonNegative(r, 'responsivity')
  return (r * H_PLANCK * C0) / (Q_E * positive(lambda, 'lambda'))
}

/** The current `power` watts makes in a detector of this responsivity. */
export const photocurrent = ({ eta = 1, lambda, eg = null, power }) =>
  responsivity({ eta, lambda, eg }) * nonNegative(power, 'power')

/**
 * The optical power at which the dark current equals the photocurrent.
 *
 * Below it the reading is the diode's own leakage and not the light. This is
 * the level A4 is about, and it is a division rather than a threshold anybody
 * chose.
 */
export function darkEqualsLight({ eta = 1, lambda, eg = null, dark }) {
  const r = responsivity({ eta, lambda, eg })
  require_(r > 0, `A detector with no responsivity at ${(lambda * 1e9).toPrecision(4)} nm never reaches its own dark current.`, { field: 'lambda' })
  return nonNegative(dark, 'dark') / r
}

// ------------------------------------------------------- the photodiode as a circuit

/** The defaults every photodiode netlist fills in, so a caller states only what it changes. */
export const PD_DEFAULTS = {
  bias: 5, // volts of reverse bias on the supply
  load: 1000, // the load resistance the current is read across, ohms
  dark: 1e-9, // the junction's reverse saturation current, amps
  n: 1, // the junction's ideality factor
  eta: 0.8,
  lambda: 1550e-9,
  eg: null,
  power: 1e-6,
}

/**
 * The photodiode circuit, as a netlist @ee-labs/network solves.
 *
 * Four elements and three nodes. The supply `Vb` holds the reverse bias, the
 * load `RL` carries the current from the supply to the cathode, the junction
 * `D1` sits from ground (anode) to the cathode so that a positive supply
 * reverse-biases it, and `Iph` is the photocurrent, drawn from the cathode to
 * the anode, which is the direction light drives current through a junction.
 *
 * The junction's own saturation current is the dark current, so no separate
 * source carries it. Turn the light off and what remains is the diode.
 */
export function photodiodeNet(spec = {}) {
  const s = { ...PD_DEFAULTS, ...spec }
  positive(s.load, 'load')
  nonNegative(s.bias, 'bias')
  positive(s.dark, 'dark')
  const iph = photocurrent(s)
  return {
    elements: [
      { type: 'V', id: 'Vb', nodes: ['vb', 'gnd'], value: s.bias },
      { type: 'R', id: 'RL', nodes: ['vb', 'c'], value: s.load },
      { type: 'D', id: 'D1', nodes: ['gnd', 'c'], model: 'exp', is: s.dark, n: s.n },
      { type: 'I', id: 'Iph', nodes: ['c', 'gnd'], value: iph },
    ],
    iph,
    spec: s,
  }
}

/**
 * The photodiode's operating point, from the same Newton iteration every other
 * diode in the suite is solved by.
 *
 * Returns the current the load carries, the reverse voltage left across the
 * junction, the photocurrent that drove it and the dark current the junction
 * contributed. Nothing here is computed outside the solver: `current` is the
 * solver's own reading of the load resistor, so KCL at the cathode is the
 * solver's to keep.
 *
 * One numerical note, because a lesson quotes this current. Reading a
 * microamp across a kilohm from a twenty-volt supply is the difference of two
 * voltages that agree to six figures, so the answer carries the supply's last
 * bits as noise. `floor` is that noise as a current, and it is returned rather
 * than hidden: a reading below it is arithmetic and not light.
 */
export function photodiode(spec = {}) {
  const net = photodiodeNet(spec)
  const r = newtonDC(net)
  const vc = r.sol.v.c
  const load = net.spec.load
  return {
    spec: net.spec,
    iph: net.iph,
    current: r.sol.i.RL, // the solver's reading of the load resistor
    reverse: vc, // the reverse bias left across the junction
    dark: -r.sol.i.D1, // the junction's own current, positive out of the cathode
    across: vc - net.spec.bias, // volts across the load, negative by its own sign convention
    floor: (64 * Number.EPSILON * Math.max(net.spec.bias, Math.abs(vc))) / load,
    iters: r.iters.length,
  }
}

/**
 * The current a photodiode carries at each of a list of reverse bias voltages,
 * with everything else held. This is the load line's other axis, and it is what
 * shows the current flat against bias.
 */
export const photodiodeSweep = (spec, biases) => biases.map((bias) => ({ bias, ...photodiode({ ...spec, bias }) }))

// ------------------------------------------------------------------ area and speed

/**
 * The capacitance per unit area of a junction at zero bias, farads a square
 * metre, from the material's permittivity and the depletion width.
 *
 * Indium gallium arsenide has a relative permittivity of 13.9, and a detector
 * grown for speed has a depletion region a couple of micrometres deep. Both are
 * material facts rather than knobs, and they are stated here once.
 */
export const EPS_0 = 8.8541878128e-12
export const EPS_INGAAS = 13.9 * EPS_0
export const DEPLETION_0 = 2e-6

/** Zero-bias capacitance per square metre, from the permittivity and the depletion width. */
export const capPerArea = ({ eps = EPS_INGAAS, w0 = DEPLETION_0 } = {}) => eps / positive(w0, 'w0')

/** The area of a round detector of diameter `d`, in metres. */
export const detectorArea = (d) => (Math.PI / 4) * positive(d, 'd') ** 2

/**
 * A detector's area, its capacitance and the corner frequency it makes into a
 * load, at one reverse bias.
 *
 * The capacitance comes from `junctionCap` in @ee-labs/network, which is
 * Electronics C2's closed form, so a reader who turns the bias here sees the
 * same law that lab teaches. The corner is the ordinary first-order one,
 * 1/(2 pi R C).
 *
 * `areaBandwidth` is the product the last sentence of A5 is about. Capacitance
 * rises with area and the corner falls with capacitance, so the product does
 * not move with area at all. It is the figure of merit a detector is chosen on.
 */
export function detectorSpeed({ d, load, bias = 0, v0 = 0.75, m = 0.5, eps = EPS_INGAAS, w0 = DEPLETION_0 }) {
  positive(load, 'load')
  nonNegative(bias, 'bias')
  const area = detectorArea(d)
  const cj0 = capPerArea({ eps, w0 }) * area
  const cj = junctionCap({ cj0, v0, m }, -bias)
  const corner = 1 / (2 * Math.PI * load * cj)
  return { area, cj0, cj, corner, areaBandwidth: area * corner }
}

/** The optical power a detector of this area collects from an even irradiance, in watts. */
export const collectedPower = ({ d, irradiance }) => detectorArea(d) * nonNegative(irradiance, 'irradiance')
