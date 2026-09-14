// The DC machine: an R–L with a speed in it.
//
// The armature is a resistance and an inductance in series with one more
// voltage, the back-EMF e = k ω. The shaft is the port in port.js. Put the two
// together and the machine is one netlist with two states, the armature
// current and the shaft speed, and @ee-labs/network solves it exactly:
//
//     L_a di/dt = v − R_a i − k ω
//     J  dω/dt  = k i − B ω − T_L
//
// Both rows come out of `dynamics(net)` without this file writing a matrix,
// because the coupling is stamped (port.js) rather than assembled by hand.
// `line()` below is the same machine in the steady state, where di/dt and
// dω/dt are zero and the two equations collapse to one straight line in the
// torque–speed plane. Invariant 2 is that the two agree: the settled point of
// the time solution is where the line crosses the load.
//
// k is one constant, not two. The volt-seconds per radian that appear as
// back-EMF and the newton-metres per ampere that appear as torque are the same
// number in SI units, and D2 measures the pair. `kt` may be given separately
// so that an experiment can break the equality on purpose and watch the power
// balance stop closing, which is what invariant 1 is for.

import { GROUND } from '@ee-labs/network'
import { senseBranch, shaft } from './port.js'

/** Defaults for a small permanent-magnet DC motor, filled in by `dcOf`. */
export const DC_DEFAULTS = {
  Va: 24, // armature supply, V
  Ra: 1.2, // armature resistance, Ω
  La: 3e-3, // armature inductance, H
  k: 0.06, // V·s/rad and N·m/A — the same number
  J: 2e-4, // rotor inertia, kg·m²
  B: 1e-5, // viscous friction, N·m·s/rad
  TL: 0, // load torque, N·m
  loadB: 0, // load torque per unit speed, N·m·s/rad
  field: 1, // flux as a fraction of rated: k is scaled by it
  omega0: 0, // the speed the shaft starts at, rad/s. An initial condition
  rs: 1, // sense resistance, Ω. Cancelled, so the answer does not use it
}

/** Fill in every default and check the values a machine cannot have. */
export function dcOf(spec = {}) {
  const m = { ...DC_DEFAULTS, ...spec }
  if (m.kt === undefined) m.kt = m.k
  if (!(m.Ra > 0)) throw new Error('Ra: an armature resistance must be positive')
  if (!(m.La > 0)) throw new Error('La: an armature inductance must be positive')
  if (!(m.J > 0)) throw new Error('J: a rotor inertia must be positive')
  if (!(m.field > 0)) throw new Error('field: the flux must be positive')
  // The flux scales both constants together: halving the field halves the
  // back-EMF per rad/s and the torque per amp, which is F4's experiment.
  m.ke = m.k * m.field
  m.km = m.kt * m.field
  return m
}

/**
 * The machine as a netlist: armature loop, coupling pair, shaft.
 *
 * Nodes. `arm` is the supply's + terminal, `wm` the shaft. The armature runs
 * arm → R_a → L_a → back-EMF → sense → ground, so the sense pair carries i_a
 * and the torque source reads it.
 *
 * `drive` replaces the constant supply with a wave (a step, a chopper's
 * average, a sine) in the netlist's own `wave` form.
 */
export function dcNetlist(spec = {}) {
  const m = dcOf(spec)
  const sen = senseBranch('sen', 'n3', GROUND, m.rs)
  const sh = shaft('wm', { J: m.J, B: m.B, load: m.TL, loadB: m.loadB, omega0: m.omega0 })
  const supply = m.drive
    ? { type: 'V', id: 'Va', nodes: ['arm', GROUND], value: 0, wave: m.drive }
    : { type: 'V', id: 'Va', nodes: ['arm', GROUND], value: m.Va }
  const elements = [
    supply,
    { type: 'R', id: 'Ra', nodes: ['arm', 'n1'], value: m.Ra },
    { type: 'L', id: 'La', nodes: ['n1', 'n2'], value: m.La },
    // The back-EMF: a voltage the shaft sets, opposing the current.
    { type: 'VCVS', id: 'Vemf', nodes: ['n2', 'n3'], ctrl: ['wm', GROUND], gain: m.ke, coupling: 'emf' },
    ...sen.elements,
    // The torque: a current the armature sets, pushed into the shaft node.
    { type: 'VCCS', id: 'Te', nodes: [GROUND, 'wm'], ctrl: sen.sense, gain: sen.gain(m.km), coupling: 'torque' },
    ...sh.elements,
  ]
  return { elements, machine: m, sense: sen, shaft: sh }
}

/**
 * The steady-state torque–speed line, in closed form.
 *
 * With di/dt = 0 the armature current is (V − kω)/R_a, so the torque the
 * machine makes falls linearly with speed:
 *
 *     T_e(ω) = k V / R_a − (k² / R_a) ω
 *
 * It reaches the stall torque at ω = 0 and zero at the no-load speed V/k.
 * The line's slope, −k²/R_a, is the whole of what a reader needs to predict a
 * DC drive, and it is why a low-resistance armature makes a stiff motor.
 */
export function line(spec = {}) {
  const m = dcOf(spec)
  const stall = (m.km * m.Va) / m.Ra
  const noLoad = m.Va / m.ke
  return {
    machine: m,
    stall,
    noLoad,
    slope: -(m.km * m.ke) / m.Ra,
    torqueAt: (w) => (m.km * (m.Va - m.ke * w)) / m.Ra,
    currentAt: (w) => (m.Va - m.ke * w) / m.Ra,
    speedAt: (T) => (m.Va - (T * m.Ra) / m.km) / m.ke,
  }
}

/**
 * Where the line crosses the load, and everything the crossing implies.
 *
 * The load is B ω + B_L ω + T_L, so the balance k(V − kω)/R_a = (B + B_L)ω +
 * T_L is one linear equation. Every quantity below follows from its solution
 * with no further solve, and `operating` is what invariant 2 compares the time
 * solution's settled point against.
 */
export function operating(spec = {}) {
  const m = dcOf(spec)
  const g = m.B + m.loadB
  const w = ((m.km * m.Va) / m.Ra - m.TL) / (g + (m.km * m.ke) / m.Ra)
  const ia = (m.Va - m.ke * w) / m.Ra
  const Te = m.km * ia
  const pIn = m.Va * ia
  const pCu = ia * ia * m.Ra
  const pMechGross = Te * w // across the coupling: k i ω
  const pFriction = g * w * w
  const pShaft = pMechGross - pFriction
  return {
    machine: m,
    omega: w,
    ia,
    torque: Te,
    emf: m.ke * w,
    pIn,
    pCu,
    pMechGross,
    pFriction,
    pShaft,
    efficiency: pIn > 0 ? pShaft / pIn : 0,
  }
}

/**
 * The two time constants, and whether they separate.
 *
 * The electrical one is L_a/R_a and the mechanical one is J R_a / k² when the
 * friction is small beside k²/R_a. The pair are the roots of the second-order
 * characteristic polynomial, which `roots` gives exactly:
 *
 *     s² + (R_a/L_a + (B+B_L)/J) s + (R_a(B+B_L) + k²) / (L_a J) = 0
 *
 * `separated` is the ratio τ_m/τ_e, and the quasi-static picture a drives
 * course uses (speed constant over one electrical transient) is the labelled
 * approximation that ratio guards. Group A states the threshold as 10.
 */
export function timeConstants(spec = {}) {
  const m = dcOf(spec)
  const g = m.B + m.loadB
  const tauE = m.La / m.Ra
  const tauM = (m.J * m.Ra) / (m.km * m.ke + m.Ra * g)
  const a1 = m.Ra / m.La + g / m.J
  const a0 = (m.Ra * g + m.km * m.ke) / (m.La * m.J)
  const disc = a1 * a1 - 4 * a0
  const roots =
    disc >= 0
      ? [(-a1 + Math.sqrt(disc)) / 2, (-a1 - Math.sqrt(disc)) / 2].map((re) => ({ re, im: 0 }))
      : [
          { re: -a1 / 2, im: Math.sqrt(-disc) / 2 },
          { re: -a1 / 2, im: -Math.sqrt(-disc) / 2 },
        ]
  return {
    tauE,
    tauM,
    separated: tauM / tauE,
    a1,
    a0,
    roots,
    zeta: a1 / (2 * Math.sqrt(a0)),
    wn: Math.sqrt(a0),
  }
}

/**
 * Speed control by armature voltage and by field, as the two lines they are.
 *
 * Armature control slides the line sideways: the slope −k²/R_a does not move,
 * so the speed changes and the stiffness does not. Field control rotates it:
 * weakening the field raises the no-load speed as 1/k and lowers the stall
 * torque as k, which is why field weakening buys speed and costs torque.
 */
export function control(spec = {}, { volts = [], fields = [] } = {}) {
  return {
    armature: volts.map((Va) => ({ Va, ...line({ ...spec, Va }), point: operating({ ...spec, Va }) })),
    field: fields.map((field) => ({ field, ...line({ ...spec, field }), point: operating({ ...spec, field }) })),
  }
}

/**
 * Where the power goes, at one instant, from a readout of `dcNetlist`.
 *
 * Every term is physical and named. The sense branch's two elements are paired
 * so their equal and opposite powers cancel to nothing, as they must — a
 * bookkeeping pair, not a loss. The coupling pair is reported as one number,
 * `coupled`, which is zero when k_e = k_t and is the size of the mistake when
 * they are not. `gap` is what does not balance, and it is rounding.
 */
export function powerAudit(sol, spec = {}) {
  const m = dcOf(spec)
  const supplied = -sol.p.Va
  const copper = sol.p.Ra
  const sense = sol.p['sen.rs'] + sol.p['sen.e']
  const friction = sol.p['shaft.B'] ?? 0
  const load = sol.p['shaft.TL'] ?? 0
  const coupled = sol.p.Vemf + sol.p.Te
  const dStored = sol.p.La + sol.p['shaft.J']
  return {
    supplied,
    copper,
    friction,
    load,
    sense,
    coupled,
    dStored,
    ia: sol.i.Ra,
    omega: sol.v.wm,
    torque: m.km * sol.i.Ra,
    gap: supplied - (copper + friction + load + sense + coupled + dStored),
  }
}
