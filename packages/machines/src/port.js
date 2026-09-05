// The mechanical port, as a circuit the network engine already solves.
//
// A machine is a circuit with a shaft on it. The shaft obeys
//
//     J dω/dt = T_e − B ω − T_L
//
// and that is the same equation a capacitor obeys, C dv/dt = i_C, once the
// analogy below is fixed. So the rotor is not a new kind of state. It is one
// more node in the same netlist, and @ee-labs/network's `dynamics` reads its
// row of A and B off the same resistive solve as every electrical state.
//
//   speed ω   (rad/s)     ↔  the node voltage at the shaft node
//   torque T  (N·m)       ↔  a current into that node
//   inertia J (kg·m²)     ↔  a capacitance, in farads, at that node
//   friction B (N·m·s)    ↔  a conductance, so a resistor of 1/B ohms
//   load torque T_L       ↔  a current source drawing out of the node
//
// The analogy is exact, not a picture: ½Cv² is ½Jω², the rotor's kinetic
// energy, so the energy ledger the transient engine already keeps closes over
// the shaft without being told what a shaft is. The units are the reader's
// business and the app's, not the solver's, and `MECH` below names the
// conversion in one place so no other file guesses at it.
//
// ---------------------------------------------------------------- the gyrator
//
// The two halves are joined by the electromechanical coupling:
//
//     e = k_e ω        the back-EMF, a voltage set by a speed
//     T_e = k_t i_a    the torque, a current set by a current
//
// The first is a voltage-controlled voltage source, which `mna.js` stamps
// already: a VCVS of gain k_e controlled by the shaft node. The second is
// controlled by a CURRENT, and no stamp takes a current as its control. The
// way round it is `senseBranch` below, and it costs nothing in accuracy.
//
// When k_e = k_t (they are the same number in SI units, and D2 measures it)
// the pair absorbs e·i_a and delivers T_e·ω, and those are equal. The coupling
// is lossless by construction, so Tellegen's theorem over the whole netlist IS
// the machine's power balance. That is invariant 1.

import { GROUND } from '@ee-labs/network'

/** How a mechanical quantity is carried in the electrical netlist. */
export const MECH = {
  speed: { unit: 'rad/s', as: 'V' },
  torque: { unit: 'N·m', as: 'A' },
  inertia: { unit: 'kg·m²', as: 'F' },
  friction: { unit: 'N·m·s/rad', as: 'S' },
  power: { unit: 'W', as: 'W' },
}

/** rad/s from rev/min, and back. */
export const rpmToRad = (n) => (n * 2 * Math.PI) / 60
export const radToRpm = (w) => (w * 60) / (2 * Math.PI)

/**
 * A branch with its current available as a voltage, and no voltage of its own.
 *
 * Insert a sense resistor R_s in the branch and then a VCVS of gain −1 across
 * the same two nodes in series with it. The two drops are i·R_s and −i·R_s, so
 * the pair together is a short: it changes no current and no node voltage
 * outside itself. What it leaves behind is the node pair (sense[0], sense[1])
 * whose difference is exactly i·R_s, which any VCCS can be controlled by.
 *
 * Nothing here is a limit or an approximation. The cancellation is algebraic,
 * so the answer does not depend on R_s at all, and invariant 5 fuzzes exactly
 * that: runs with sense resistances nine decades apart agree to floating point.
 *
 * One practical note, measured in port.test.js rather than assumed. The
 * cancellation is exact in algebra and the LU solve is not. A sense resistance
 * far BELOW the circuit's own puts a huge conductance into the matrix beside
 * small ones, and the solve loses digits to it. At R_s equal to the circuit's
 * resistance the drift is at rounding, 10⁻¹⁶ of the answer. A millionth of it
 * costs seven decades of that. A large R_s costs nothing, because the
 * cancelling source removes its drop before it reaches any other node. So the
 * rule is one line: pick R_s at or above the branch's own resistance, and the
 * defaults here do.
 *
 * @param id     prefix for the two element ids and the internal node
 * @param from   the node the branch comes from
 * @param to     the node the branch goes to
 * @param rs     the sense resistance, ohms. Any positive value.
 * @returns {{ elements, sense: [string, string], rs: number, gain: (k:number)=>number }}
 *   `gain(k)` is the VCCS gain that turns the sensed voltage into k times the
 *   branch current: k / R_s.
 */
export function senseBranch(id, from, to, rs = 1) {
  if (!(rs > 0)) throw new Error(`${id}: a sense resistance must be positive`)
  const mid = `${id}.m`
  return {
    elements: [
      { type: 'R', id: `${id}.rs`, nodes: [from, mid], value: rs, sense: true },
      // The cancelling source: v(mid) − v(to) = −(v(from) − v(mid)) = −i·R_s.
      { type: 'VCVS', id: `${id}.e`, nodes: [mid, to], ctrl: [from, mid], gain: -1, sense: true },
    ],
    sense: [from, mid],
    rs,
    gain: (k) => k / rs,
  }
}

/**
 * The shaft: inertia, viscous friction and the load torque, as three elements
 * on one node.
 *
 * `load` is the load torque in N·m. A constant load is a current source. A
 * load that rises with speed (a fan, a pump) is a conductance, and `loadB`
 * carries it: T_L = T_const + B_L ω. Both are exact and both are linear, so
 * the whole machine stays one linear state space.
 *
 * The starting speed is an initial condition and not something a DC solve can
 * find. A frictionless unloaded shaft has no resistive path to ground at all,
 * and the solver would say so. `omega0` is given instead, and it defaults to
 * rest, which is where a machine starts.
 *
 * @param node  the shaft node's name
 * @param spec  { J, B = 0, load = 0, loadB = 0, omega0 = 0, id = 'shaft' }
 */
export function shaft(node, { J, B = 0, load = 0, loadB = 0, omega0 = 0, id = 'shaft' } = {}) {
  if (!(J > 0)) throw new Error(`${id}: an inertia must be positive`)
  if (B < 0 || loadB < 0) throw new Error(`${id}: a friction coefficient cannot be negative`)
  if (!Number.isFinite(omega0)) throw new Error(`${id}: the starting speed must be a number`)
  const elements = [{ type: 'C', id: `${id}.J`, nodes: [node, GROUND], value: J, x0: omega0, mech: 'inertia' }]
  const g = B + loadB
  if (g > 0) elements.push({ type: 'R', id: `${id}.B`, nodes: [node, GROUND], value: 1 / g, mech: 'friction' })
  if (load !== 0) elements.push({ type: 'I', id: `${id}.TL`, nodes: [node, GROUND], value: load, mech: 'load' })
  return { elements, node, J, B, loadB, load, omega0, hasFriction: g > 0 }
}
