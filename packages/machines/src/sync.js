// Synchronous and permanent-magnet machines.
//
// A synchronous machine's rotor carries its own field and turns at exactly the
// speed of the stator's rotating field. Nothing slips. What varies instead is
// the ANGLE between the rotor's flux and the stator's, and that angle is the
// machine's whole control variable.
//
// Per phase, with the armature reactance X_s and the excitation EMF E:
//
//     V = E + j X_s I     (motor convention: current into the machine)
//
// so I = (V − E)/(R_a + jX_s), and with R_a neglected the three-phase power is
//
//     P = 3 V E sin δ / X_s
//
// exactly, where δ is the angle by which E lags V. The maximum is at δ = 90°
// and is the pull-out power. Past it there is no steady state, and the machine
// loses synchronism. That is not a numerical failure, and `pullOut` names it.
//
// A salient-pole rotor has two reactances, X_d along the field and X_q across
// it, and the difference adds a second term that needs no field at all:
//
//     P = 3 V E sin δ / X_d + 3 V² (X_d − X_q) sin 2δ / (2 X_d X_q)
//
// The second term is reluctance torque, and a synchronous reluctance machine
// is the first term set to zero.
//
// ---------------------------------------------------------------- the PMSM
//
// A permanent-magnet machine is the same object with E fixed by a magnet. In
// dq coordinates (dq.js) its two current equations are
//
//     v_d = R i_d + L_d di_d/dt − ω_e L_q i_q
//     v_q = R i_q + L_q di_q/dt + ω_e (L_d i_d + λ_m)
//
// At a fixed electrical speed those are LINEAR in the two currents. The state
// matrix is exact, `pmsmState` returns it, and the transient engine solves it
// with no step. That is the reason field-oriented control is built on this
// frame: it turns a machine into a plant Control Lab already knows how to
// close a loop around. `focPlant` hands over the two loops as rational
// transfer functions with no hedge.
//
// The torque is stated in the amplitude-invariant convention, where
//
//     T_e = (3/2) p_pairs [ λ_m i_q + (L_d − L_q) i_d i_q ]
//
// The 3/2 belongs to the convention and not to the physics. In the
// power-invariant frame of dq.js the same torque is p_pairs[λ i_q + …] with
// no 3/2, and `pmsmTorque` says which frame it was handed.

import { CONVENTIONS } from './dq.js'

/**
 * A 400 V 50 Hz 4-pole round-rotor synchronous motor, filled in by `syncOf`.
 *
 * The four reactances past `Xq` are for a machine on a network rather than a
 * machine on a bench. A fault or a switching event is not a steady state, and
 * the flux trapped in the rotor's windings holds the internal voltage up for a
 * while. So the machine is drawn behind a different reactance depending on how
 * long after the event the question is asked. `reactance()` names the four.
 *
 *   Xd    steady state, seconds after the event
 *   Xdp   transient, the first cycles, behind which the swing equation runs
 *   Xdpp  subtransient, the first cycle, which is what a breaker sees
 *   X2    negative sequence, for an unbalanced fault
 *   X0    zero sequence, for a fault involving the ground
 *
 * `H` is the inertia constant in MJ/MVA, which is seconds, and `Pm` is the
 * mechanical power in per unit on the machine's own base. Both are the swing
 * model's, and `swing()` is where they are used.
 */
export const SYNC_DEFAULTS = {
  V: 400 / Math.sqrt(3), // phase voltage, rms V
  f: 50,
  poles: 4,
  E: 260, // excitation EMF per phase, rms V
  Xs: 8, // synchronous reactance, Ω per phase (round rotor)
  Xd: 8, // direct-axis reactance, Ω. Salient rotor: Xd > Xq
  Xq: 5,
  Ra: 0, // armature resistance, Ω per phase
  salient: false,
  delta: (20 * Math.PI) / 180, // power angle, radians
  // The network model. Per unit on the machine's own base, or ohms, as long as
  // one unit is used throughout. The defaults are a common set for a generator.
  Xdp: 0.3, // transient reactance
  Xdpp: 0.2, // subtransient reactance
  X2: 0.2, // negative-sequence reactance
  X0: 0.05, // zero-sequence reactance
  H: 4, // inertia constant, MJ/MVA, which is seconds
  Pm: 1, // mechanical power, pu on the machine's base
  Sbase: 100e6, // VA, three phase
  Vbase: 400, // V, line to line
}

export function syncOf(spec = {}) {
  const m = { ...SYNC_DEFAULTS, ...spec }
  if (!(m.Xs > 0)) throw new Error('Xs: a synchronous reactance must be positive')
  if (!(m.Xd > 0) || !(m.Xq > 0)) throw new Error('Xd and Xq: both reactances must be positive')
  if (!(m.poles >= 2) || m.poles % 2) throw new Error('poles: an even number of poles, two or more')
  for (const key of ['Xdp', 'Xdpp', 'X2', 'X0']) if (!(m[key] > 0)) throw new Error(`${key}: a reactance must be positive`)
  if (!(m.H > 0)) throw new Error('H: an inertia constant must be positive')
  m.omega = 2 * Math.PI * m.f
  // Two synchronous speeds, and they differ by the pole pairs. The mechanical
  // one turns the shaft. The electrical one is the one the swing equation's
  // angle is measured in, and M = 2H/ω_elec because δ is an electrical angle.
  m.omegaElec = m.omega
  m.omegaSync = (2 * m.omega) / m.poles
  m.rpmSync = (120 * m.f) / m.poles
  m.Zbase = (m.Vbase * m.Vbase) / m.Sbase
  m.Ibase = m.Sbase / (Math.sqrt(3) * m.Vbase)
  return m
}

/** The four reactances by name, for the question being asked. */
export const REACTANCES = {
  steady: { key: 'Xd', when: 'seconds after the event' },
  transient: { key: 'Xdp', when: 'the first cycles, and the swing equation' },
  subtransient: { key: 'Xdpp', when: 'the first cycle, and the breaker' },
  negative: { key: 'X2', when: 'an unbalanced fault' },
  zero: { key: 'X0', when: 'a fault through the ground' },
}

/** One of them, with the sentence saying which question it answers. */
export function reactance(spec = {}, kind = 'steady') {
  const r = REACTANCES[kind]
  if (!r) throw new Error(`unknown reactance "${kind}"`)
  const m = syncOf(spec)
  return { kind, value: m[r.key], when: r.when, machine: m }
}

/**
 * The internal voltage behind a chosen reactance, from a terminal condition.
 *
 * Given the terminal voltage `V` and the power `P + jQ` the machine puts into
 * the network, the current is `(P − jQ)/V*` and the internal voltage is
 * `V + jX I`. Everything here is in one consistent unit, per unit or volts and
 * amperes, and the result carries the reactance it was taken behind.
 */
export function internalEmf(spec = {}, { V = 1, P = 1, Q = 0, kind = 'transient' } = {}) {
  const X = reactance(spec, kind).value
  if (!(V > 0)) throw new Error('V: a terminal voltage must be positive')
  const I = [P / V, -Q / V] // V taken on the real axis
  const E = [V - X * I[1], X * I[0]]
  return { E, mag: Math.hypot(E[0], E[1]), delta: Math.atan2(E[1], E[0]), I, X, kind }
}

/**
 * The swing model: one rotor angle, one speed deviation, and the equation
 * between them.
 *
 *     M d²δ/dt² = P_m − P_max sin δ,      M = 2H / ω_elec
 *
 * δ is an electrical angle, which is why `M` divides by the electrical
 * synchronous speed rather than the mechanical one. At `H = 4 MJ/MVA` and
 * 60 Hz, `M` is 0.0212207 pu·s² per radian.
 *
 * Two objects come out, and they are of different kinds. `accel` is the
 * nonlinear equation, for a caller with its own integrator and its own guard.
 * `plant` is its exact linearisation about the equilibrium, a second-order
 * rational transfer function from a small change in mechanical power to a
 * small change in angle, which crosses to Control Lab with no hedge. The
 * synchronising coefficient `K = P_max cos δ₀` is its stiffness, and the
 * small-signal swing frequency is `√(K/M)`.
 *
 * `damping` is `D` in `M δ̈ + D δ̇ = P_m − P_max sin δ`, and it is zero unless
 * a governor or a damper winding is being modelled.
 *
 * @param spec  a machine, for `H` and `f`
 * @param opts  { Pmax, Pm, damping } — the transfer through the network, the
 *              mechanical power, and any damping, all in per unit
 */
export function swing(spec = {}, { Pmax = 2, Pm = null, damping = 0 } = {}) {
  const m = syncOf(spec)
  const P = Pm === null ? m.Pm : Pm
  if (!(Pmax > 0)) throw new Error('Pmax: the transfer through the network must be positive')
  if (damping < 0) throw new Error('damping: cannot be negative')
  const M = (2 * m.H) / m.omegaElec
  const stable = Math.abs(P) <= Pmax
  const delta0 = stable ? Math.asin(P / Pmax) : NaN
  const K = stable ? Pmax * Math.cos(delta0) : NaN
  const wn = stable ? Math.sqrt(K / M) : NaN
  return {
    machine: m,
    H: m.H,
    M,
    Pm: P,
    Pmax,
    damping,
    stable,
    delta0,
    deltaMax: stable ? Math.PI - delta0 : NaN,
    K,
    wn,
    fn: wn / (2 * Math.PI),
    period: (2 * Math.PI) / wn,
    zeta: damping / (2 * Math.sqrt(K * M)),
    /** The nonlinear equation as a first-order pair, [dδ/dt, dω/dt]. */
    accel: (delta, omegaDev = 0, PmNow = P, PmaxNow = Pmax) => [
      omegaDev,
      (PmNow - PmaxNow * Math.sin(delta) - damping * omegaDev) / M,
    ],
    /** The exact linearisation about δ₀, as a plant for Control Lab. */
    plant: { b: [1 / M], a: [1, damping / M, K / M], label: 'Δδ / ΔP_m' },
    /** The energy relation the equal-area criterion integrates, per radian. */
    area: (from, to, PmNow = P, PmaxNow = Pmax) =>
      PmNow * (to - from) + PmaxNow * (Math.cos(to) - Math.cos(from)),
  }
}

/**
 * The phasor diagram at one power angle: the terminal voltage, the excitation
 * EMF, the armature current and the angle between the first and the last.
 *
 * Phasors are [re, im] pairs, rms, with V on the real axis. In the motor
 * convention E lags V by δ and the current flows into the machine.
 */
export function syncPhasor(spec = {}, delta = null) {
  const m = syncOf(spec)
  const d = delta ?? m.delta
  const V = [m.V, 0]
  const E = [m.E * Math.cos(d), -m.E * Math.sin(d)]
  const Z = [m.Ra, m.salient ? m.Xd : m.Xs]
  const dV = [V[0] - E[0], V[1] - E[1]]
  const den = Z[0] * Z[0] + Z[1] * Z[1]
  const I = [(dV[0] * Z[0] + dV[1] * Z[1]) / den, (dV[1] * Z[0] - dV[0] * Z[1]) / den]
  const P = 3 * (V[0] * I[0] + V[1] * I[1])
  const Q = 3 * (V[1] * I[0] - V[0] * I[1])
  const Imag = Math.hypot(I[0], I[1])
  return {
    machine: m,
    delta: d,
    V,
    E,
    I,
    Imag,
    P,
    Q,
    S: 3 * m.V * Imag,
    pf: Imag > 0 ? P / (3 * m.V * Imag) : 1,
    // Under-excited draws lagging current, over-excited leading. The V-curve
    // of D3 is this magnitude swept against E.
    excitation: m.E * Math.cos(d) > m.V ? 'over' : 'under',
  }
}

/**
 * Power against the angle, in closed form, round rotor or salient.
 * The torque is that power over the synchronous mechanical speed.
 */
export function powerAngle(spec = {}, delta = null) {
  const m = syncOf(spec)
  const d = delta ?? m.delta
  const field = (3 * m.V * m.E * Math.sin(d)) / (m.salient ? m.Xd : m.Xs)
  const reluctance = m.salient ? (3 * m.V * m.V * (m.Xd - m.Xq) * Math.sin(2 * d)) / (2 * m.Xd * m.Xq) : 0
  const P = field + reluctance
  return { machine: m, delta: d, field, reluctance, P, torque: P / m.omegaSync }
}

/**
 * Pull-out: the largest power the machine can hold, and the angle at which it
 * holds it. Round rotor, that is δ = 90° and 3VE/X_s. Salient, the reluctance
 * term moves the maximum below 90°, and this finds it on the closed form.
 */
export function pullOut(spec = {}) {
  const m = syncOf(spec)
  if (!m.salient) {
    const P = (3 * m.V * m.E) / m.Xs
    return { machine: m, delta: Math.PI / 2, P, torque: P / m.omegaSync, exact: true }
  }
  // dP/dδ = 3VE cos δ / X_d + 3V²(X_d−X_q) cos 2δ / (X_d X_q) = 0, one root in (0, π/2].
  const dP = (d) =>
    (3 * m.V * m.E * Math.cos(d)) / m.Xd + (3 * m.V * m.V * (m.Xd - m.Xq) * Math.cos(2 * d)) / (m.Xd * m.Xq)
  let lo = 1e-9
  let hi = Math.PI / 2
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    if (dP(mid) > 0) lo = mid
    else hi = mid
  }
  const d = (lo + hi) / 2
  const p = powerAngle(spec, d)
  return { machine: m, delta: d, P: p.P, torque: p.torque, exact: true }
}

/** The power-angle curve, for the plot and for the tests. */
export function syncCurve(spec = {}, { points = 361 } = {}) {
  const delta = []
  const P = []
  const field = []
  const reluctance = []
  for (let k = 0; k < points; k++) {
    const d = (Math.PI * k) / (points - 1)
    const p = powerAngle(spec, d)
    delta.push(d)
    P.push(p.P)
    field.push(p.field)
    reluctance.push(p.reluctance)
  }
  return { delta, P, field, reluctance, machine: syncOf(spec) }
}

// ------------------------------------------------------------------- the PMSM

/** A small surface-magnet servo motor, filled in by `pmsmOf`. */
export const PMSM_DEFAULTS = {
  R: 0.5, // phase resistance, Ω
  Ld: 2e-3, // d-axis inductance, H
  Lq: 2e-3, // q-axis inductance, H. Ld = Lq is a surface-magnet rotor
  lambda: 0.08, // magnet flux linkage, Wb
  pairs: 3, // pole pairs
  J: 5e-4, // kg·m²
  B: 1e-4, // N·m·s/rad
  omegaE: 2 * Math.PI * 100, // electrical speed, rad/s
  convention: 'amplitude-invariant',
}

export function pmsmOf(spec = {}) {
  const m = { ...PMSM_DEFAULTS, ...spec }
  for (const key of ['R', 'Ld', 'Lq', 'lambda', 'J']) if (!(m[key] > 0)) throw new Error(`${key}: must be positive`)
  if (!(m.pairs >= 1)) throw new Error('pairs: at least one pole pair')
  if (!CONVENTIONS[m.convention]) throw new Error(`unknown dq convention "${m.convention}"`)
  m.omegaM = m.omegaE / m.pairs
  return m
}

/**
 * The dq current equations as a state space, at a fixed electrical speed.
 *
 *     d/dt [i_d]   [ −R/L_d      ω_e L_q/L_d ] [i_d]   [1/L_d   0  ] [v_d]   [      0        ]
 *          [i_q] = [ −ω_e L_d/L_q   −R/L_q   ] [i_q] + [  0   1/L_q] [v_q] + [ −ω_e λ/L_q ]
 *
 * Linear, so exact. The affine term is the magnet's own EMF and is a constant
 * at a fixed speed, which is why it appears as `c` and not in A.
 */
export function pmsmState(spec = {}) {
  const m = pmsmOf(spec)
  return {
    machine: m,
    A: [
      [-m.R / m.Ld, (m.omegaE * m.Lq) / m.Ld],
      [(-m.omegaE * m.Ld) / m.Lq, -m.R / m.Lq],
    ],
    B: [
      [1 / m.Ld, 0],
      [0, 1 / m.Lq],
    ],
    c: [0, (-m.omegaE * m.lambda) / m.Lq],
    states: ['i_d', 'i_q'],
    inputs: ['v_d', 'v_q'],
  }
}

/**
 * Torque from the two currents, in the machine's stated convention.
 * The second term is reluctance torque and is zero when L_d = L_q.
 */
export function pmsmTorque(spec = {}, id, iq) {
  const m = pmsmOf(spec)
  const f = CONVENTIONS[m.convention].torqueFactor
  const magnet = f * m.pairs * m.lambda * iq
  const reluctance = f * m.pairs * (m.Ld - m.Lq) * id * iq
  return { magnet, reluctance, torque: magnet + reluctance, convention: m.convention, factor: f }
}

/**
 * The two plants field-oriented control closes loops around, as rational
 * transfer functions in `@ee-labs/systems`' form (highest power first).
 *
 * With i_d held at zero the q-axis current loop is first order, i_q/v_q =
 * 1/(L_q s + R), and the speed loop is ω/T = 1/(J s + B). The torque constant
 * between them, k_T = (3/2) p λ in the amplitude-invariant convention, is the
 * gain that joins the two. Every one of these is exact, so it is handed over
 * with no guard and no hedge.
 *
 * The cross term ω_e L_d i_d that couples the axes is exactly cancelled by the
 * decoupling feed-forward the controller adds, and `decoupled` says so. With
 * the feed-forward off, the two axes are one 2 × 2 plant, and `pmsmState` is
 * that plant.
 */
export function focPlant(spec = {}) {
  const m = pmsmOf(spec)
  const kT = CONVENTIONS[m.convention].torqueFactor * m.pairs * m.lambda
  return {
    machine: m,
    kT,
    current: { b: [1 / m.Lq], a: [1, m.R / m.Lq], label: 'i_q / v_q' },
    speed: { b: [1 / m.J], a: [1, m.B / m.J], label: 'ω / T' },
    tauElec: m.Lq / m.R,
    tauMech: m.J / m.B,
    decoupled: true,
    handOver: 'Control Lab: plant=custom, first order, with the current loop inside the speed loop',
  }
}
