// Motor drives: a bridge, an armature, and a shaft.
//
// A converter's load has been a resistor until here. A motor is not one. Its
// armature is a resistance and an inductance in series with a voltage the
// rotor makes, e = k·ω, and that voltage moves because the shaft does. So the
// switched circuit gains a second state that is not electrical at all:
//
//     L_a di_a/dt = v_term − (R_a + r) i_a − k ω
//     J   dω/dt   = k i_a − (B + B_L) ω − T_L
//
// Both rows are linear and both are constant within a switch state, so the
// pair is a two-state piecewise-LTI system of exactly the shape `steady.js`
// already solves, and the propagator carries it with no time step. The
// machine's own numbers come from `@ee-labs/machines` (`dcOf` fills and
// checks them, `operating` gives the averaged answer this engine is held
// against), so the two labs describe one motor.
//
// ----------------------------------------------------- the slow state
//
// The mechanical time constant is thousands of switching periods long, which
// is why a drives course freezes ω over one period and steps it between them.
// This engine does not need that approximation for its answer, because the
// periodic steady state carries ω's own ripple exactly. Instead it measures
// it: `driveMeasures` reports the speed ripple beside the current ripple, and
// `timeConstants(...).separated` from `@ee-labs/machines` is the ratio the
// quasi-static picture rests on. `driveRunUp` is that same slow state stepped
// period by period from rest, and it is what checks the fixed point.
//
// ----------------------------------------------------- the three bridges
//
//   dcdrive   one switch and a freewheel diode: one quadrant. The armature
//             current may reach zero at light torque, and then the diode
//             blocks and a dead interval appears, exactly as in a buck.
//   hbridge   four switches: both directions, motoring and braking. Bipolar
//             modulation swings the terminals ±V_dc every period. Unipolar
//             puts two pulses of one sign in each period, so the ripple runs
//             at 2·f_s and is smaller for the same switching.
//   bldc      a brushless machine driven six-step. Two of the three phases
//             conduct at a time, so the circuit is that pair in series: 2·R_s,
//             2·L_s and a line EMF of 2·λ·p·ω. Which pair conducts changes
//             every 60° electrical, and a flat-topped trapezoid makes that
//             change invisible to the loop, so the electrical model is the
//             chopper's again with the pair's own three numbers in it.

import { dcOf, operating, timeConstants, pmsmOf } from '@ee-labs/machines'
import { propagator01 } from './propagator.js'
import { eye, matMul, matVec, vecAdd } from './linalg.js'
import { chainPlan, clockedSteadyState, statsOf } from './clocked.js'
import { quadrature, bisect, firstDownCrossing, stateAt } from './segment.js'
import { evalSignal } from './topologies.js'
import { signalIntegral } from './steady.js'

export const DRIVE_KINDS = ['dcdrive', 'hbridge', 'bldc']

/** Every signal a drive's panes may ask for, in the order they are read. */
export const DRIVE_SIGNALS = ['vsw', 'vemf', 'vL', 'iL', 'iQ', 'iD', 'iin']

export const DRIVE_DEFAULTS = {
  Vdc: 48,
  D: 0.5,
  fs: 20e3,
  // The machine, in @ee-labs/machines' own names.
  Ra: 1.2,
  La: 3e-3,
  k: 0.06,
  J: 2e-4,
  B: 1e-5,
  TL: 0.05,
  loadB: 0,
  // The devices.
  Ron: 0,
  Vf: 0,
  rd: 0,
  // The h-bridge's modulation: 1 is bipolar, 0 unipolar.
  bipolar: 1,
  // The brushless machine, in @ee-labs/machines' PMSM names.
  lambda: 0.02,
  pairs: 4,
  Rs: 0.5,
  Ls: 1.5e-3,
}

const lin = (c1, c2, d = 0) => ({ c: [c1, c2], d })

/**
 * The armature the bridge drives, whichever machine it belongs to.
 *
 * A brushless machine driven six-step presents the pair of conducting phases
 * in series, so its loop is 2·R_s, 2·L_s and 2·λ·p·ω: the same three numbers
 * a brushed armature has. Both go through `dcOf`, which is where a machine's
 * values are checked.
 */
export function armatureOf(kind, p) {
  if (kind !== 'bldc') {
    return dcOf({ Ra: p.Ra, La: p.La, k: p.k, J: p.J, B: p.B, TL: p.TL, loadB: p.loadB })
  }
  const m = pmsmOf({ R: p.Rs, Ld: p.Ls, Lq: p.Ls, lambda: p.lambda, pairs: p.pairs, J: p.J, B: p.B })
  return dcOf({
    Ra: 2 * m.R,
    La: 2 * m.Ld,
    k: 2 * m.lambda * m.pairs,
    J: m.J,
    B: m.B,
    TL: p.TL,
    loadB: p.loadB,
  })
}

/**
 * One switch state: the terminals held at `v` through a series resistance `r`,
 * with an offset drop `vd` opposing a positive current (a diode's). `bus` is
 * what the DC link supplies, as a multiple of the armature current.
 */
function armatureState(name, mach, { v, r, vd = 0, bus = 0 }) {
  const g = mach.B + mach.loadB
  const Rt = mach.Ra + r
  const src = v - vd
  return {
    name,
    A: [
      [-Rt / mach.La, -mach.ke / mach.La],
      [mach.km / mach.J, -g / mach.J],
    ],
    f: [src / mach.La, -mach.TL / mach.J],
    signals: {
      // What the armature terminals sit at, after the devices' own drops.
      vsw: lin(-r, 0, src),
      // The rotor's own voltage, which is where the mechanical power leaves.
      vemf: lin(0, mach.ke),
      vL: lin(-Rt, -mach.ke, src),
      iL: lin(1, 0),
      iQ: lin(name === 'off' || name === 'zero' ? 0 : 1, 0),
      iD: lin(name === 'off' ? 1 : 0, 0),
      iin: lin(bus, 0),
    },
  }
}

/** The dead interval: the diode has blocked, so the armature carries nothing. */
function deadState(mach) {
  const g = mach.B + mach.loadB
  return {
    name: 'dead',
    A: [
      [0, 0],
      [0, -g / mach.J],
    ],
    f: [0, -mach.TL / mach.J],
    signals: {
      vsw: lin(0, mach.ke),
      vemf: lin(0, mach.ke),
      vL: lin(0, 0),
      iL: lin(1, 0),
      iQ: lin(0, 0),
      iD: lin(0, 0),
      iin: lin(0, 0),
    },
  }
}

/**
 * A drive: the machine, the bridge, and the plan of switch states one period
 * holds. The plan is fixed before the state is known for every bridge here,
 * so continuous conduction is a linear solve. The one-quadrant chopper's
 * diode can still block, and `hasDead` says so.
 */
export function drive(kind, params = {}) {
  if (!DRIVE_KINDS.includes(kind)) throw new Error(`unknown drive "${kind}"`)
  const p = { ...DRIVE_DEFAULTS, ...params }
  const mach = armatureOf(kind, p)
  const T = 1 / p.fs
  const D = Math.min(0.98, Math.max(0.02, p.D))
  const { Vdc, Ron, Vf, rd } = p
  if (kind === 'hbridge') {
    // Two devices carry the current in every state of a full bridge.
    const r = 2 * Ron
    const pos = armatureState('pos', mach, { v: Vdc, r, bus: 1 })
    const neg = armatureState('neg', mach, { v: -Vdc, r, bus: -1 })
    const zero = armatureState('zero', mach, { v: 0, r, bus: 0 })
    const bipolar = !!p.bipolar
    // Unipolar: leg A carries the duty and leg B its complement, both centred
    // on the period, so the terminals see two pulses totalling q = |2D − 1|
    // and the ripple runs at twice the switching frequency.
    const q = Math.abs(2 * D - 1)
    const active = 2 * D - 1 >= 0 ? pos : neg
    const plan = bipolar
      ? [
          { state: pos, T: D * T },
          { state: neg, T: (1 - D) * T },
        ]
      : [
          { state: zero, T: ((1 - q) * T) / 4 },
          { state: active, T: (q * T) / 2 },
          { state: zero, T: ((1 - q) * T) / 2 },
          { state: active, T: (q * T) / 2 },
          { state: zero, T: ((1 - q) * T) / 4 },
        ]
    return {
      kind,
      p: { ...p, D },
      T,
      mach,
      plan,
      states: { pos, neg, zero },
      signals: DRIVE_SIGNALS,
      hasDead: false,
      bipolar,
      quadrants: 4,
      pulses: bipolar ? 1 : 2,
      commanded: (2 * D - 1) * Vdc,
      blocking: () => Vdc,
    }
  }
  // The chopper front end, brushed or brushless: one switch, one diode.
  const on = armatureState('on', mach, { v: Vdc, r: Ron, bus: 1 })
  const off = armatureState('off', mach, { v: 0, r: rd, vd: Vf, bus: 0 })
  const dead = deadState(mach)
  const conv = {
    kind,
    p: { ...p, D },
    T,
    mach,
    plan: [
      { state: on, T: D * T },
      { state: off, T: (1 - D) * T },
    ],
    states: { on, off, dead },
    signals: DRIVE_SIGNALS,
    hasDead: true,
    bipolar: false,
    quadrants: 1,
    pulses: 1,
    commanded: D * Vdc,
    blocking: () => Vdc + Vf,
  }
  if (kind === 'bldc') {
    const m = pmsmOf({ R: p.Rs, Ld: p.Ls, Lq: p.Ls, lambda: p.lambda, pairs: p.pairs, J: p.J, B: p.B })
    // Six-step: the rotor turns 60° electrical between commutations, and one
    // electrical revolution is `pairs` fewer mechanical ones.
    conv.machine = m
    conv.sectors = 6
    conv.sectorAngle = Math.PI / 3
  }
  return conv
}

/** Φ and d of a plan: x(T) = Φ x(0) + d. */
function mapOf(plan) {
  let Phi = eye(2)
  let d = [0, 0]
  for (const { state, T } of plan) {
    if (T <= 0) continue
    const { phi0, phi1 } = propagator01(state.A, T)
    Phi = matMul(phi0, Phi)
    d = vecAdd(matVec(phi0, d), matVec(phi1, state.f))
  }
  return { Phi, d }
}

/**
 * The periodic steady state of a drive.
 *
 * Continuous conduction is the fixed pattern's linear solve. When the diode
 * blocks part way through the off interval the pattern gains a dead segment
 * whose length is unknown, and the period then starts with i_a = 0, so the
 * only unknown left in the state is the speed. The shaft's own periodicity
 * gives it directly. The instant the diode blocks is the root of the armature
 * current at the end of the off segment, bisected on the exact solution to
 * 1e-13 of the period.
 */
export function driveSteadyState(conv) {
  const { T, plan } = conv
  const ccm = clockedSteadyState(plan, 2)
  const base = {
    conv,
    T,
    mode: 'CCM',
    x0: ccm.x0,
    segments: ccm.segments,
    tOn: plan[0].T,
    td: plan[plan.length - 1].T,
  }
  if (!conv.hasDead) return base
  const off = ccm.segments[ccm.segments.length - 1]
  const blocks = ccm.x0[0] < 0 || (off && off.T > 0 && firstDownCrossing(off, 0) !== null)
  if (!blocks) return base
  const { on, off: offState, dead } = conv.states
  const tOn = plan[0].T
  const tOff = plan[1].T
  const planAt = (td) => [
    { state: on, T: tOn },
    { state: offState, T: td },
    { state: dead, T: tOff - td },
  ]
  const speedAt = (td) => {
    const { Phi, d } = mapOf(planAt(td))
    // x0 = [0, ω0], and the period ends with the armature still empty, so the
    // only equation left is the shaft's.
    return d[1] / (1 - Phi[1][1])
  }
  const runFrom = (td) => chainPlan(planAt(td), [0, speedAt(td)])
  const residual = (td) => {
    const seg = runFrom(td).segs[1]
    return seg ? stateAt(seg, seg.T)[0] : 0
  }
  const td = bisect(residual, 0, tOff, 1e-13 * T)
  const run = runFrom(td)
  // The dead segment carries no armature current: that is the model, and it
  // is pinned rather than left at the bisection's last bit.
  const last = run.segs[run.segs.length - 1]
  if (last && last.name === 'dead') last.x0 = [0, last.x0[1]]
  return { conv, T, mode: 'DCM', x0: [0, speedAt(td)], segments: run.segs, tOn, td }
}

/** One period from an arbitrary state, with the diode allowed to block. */
export function drivePeriod(conv, x0) {
  const { plan, states, hasDead } = conv
  const run = chainPlan(plan, x0)
  if (!hasDead) return run
  const off = run.segs[run.segs.length - 1]
  const cross = off && off.T > 0 ? firstDownCrossing(off, 0) : null
  if (cross === null) return run
  const alt = chainPlan(
    [
      { state: states.on, T: plan[0].T },
      { state: states.off, T: cross },
      { state: states.dead, T: plan[1].T - cross },
    ],
    x0,
  )
  alt.xEnd = [0, alt.xEnd[1]]
  return alt
}

/**
 * The slow state stepped between switching periods: the drive walked from
 * rest, one period map at a time, knowing nothing of the solver's answer.
 * This is the drives course's own picture, and it is what checks the orbit.
 */
export function driveRunUp(conv, x0 = [0, 0], { periods = 200000, settle = 1e-13 } = {}) {
  let x = x0.slice()
  let scaleI = 1e-12
  let scaleW = 1e-12
  let n = 0
  for (; n < periods; n++) {
    const next = drivePeriod(conv, x).xEnd
    scaleI = Math.max(scaleI, Math.abs(next[0]))
    scaleW = Math.max(scaleW, Math.abs(next[1]))
    const quiet = Math.abs(next[0] - x[0]) <= settle * scaleI && Math.abs(next[1] - x[1]) <= settle * scaleW
    x = next
    if (quiet) {
      n++
      break
    }
  }
  return { x, periods: n, scale: [scaleI, scaleW] }
}

/**
 * What a drive is judged by: the electrical books, the shaft, and the two
 * ripples.
 *
 * The armature's own identity is exact in periodic steady state. Multiply
 * v_term = L di/dt + R i + kω by i and average. The inductor's term is
 * (L/2T)[i²] over a closed period, which is zero, so
 *
 *     ⟨v_term i⟩ = R_a I_rms² + ⟨e i⟩
 *
 * and the airgap power ⟨e·i⟩ is the torque times the speed. Everything the
 * source supplies beyond that is a device's own loss, so the ledger closes
 * with no estimate in it.
 */
export function driveMeasures(ss, { dense = 256 } = {}) {
  const conv = ss.conv
  const p = conv.p
  const mach = conv.mach
  const sig = statsOf(ss, DRIVE_SIGNALS, { dense })
  const live = ss.segments.filter((s) => s.T > 0)
  const meanProd = (a, b) =>
    live.reduce(
      (acc, seg) => acc + quadrature(seg, (x) => evalSignal(seg.state, a, x) * evalSignal(seg.state, b, x)),
      0,
    ) / ss.T
  const meanSq = (a) => live.reduce((acc, seg) => acc + quadrature(seg, (x) => evalSignal(seg.state, a, x) ** 2), 0) / ss.T
  const omega = sig.vemf.avg / mach.ke
  const g = mach.B + mach.loadB
  const Pin = p.Vdc * sig.iin.avg
  const iL2 = meanSq('iL')
  const iQ2 = meanSq('iQ')
  const iD2 = meanSq('iD')
  // Two of a full bridge's four devices carry the armature current in every
  // one of its states, so their conduction is 2·R_on against i_a all period.
  // A chopper's switch carries it only while it is closed.
  const loss = {
    armature: mach.Ra * iL2,
    switch: conv.kind === 'hbridge' ? 2 * p.Ron * iL2 : p.Ron * iQ2,
    diode: conv.kind === 'hbridge' ? 0 : p.Vf * sig.iD.avg + p.rd * iD2,
    friction: (g * meanSq('vemf')) / (mach.ke * mach.ke),
  }
  // The airgap: what crosses from the circuit to the shaft.
  const Pairgap = meanProd('vemf', 'iL')
  const Pshaft = Pairgap - loss.friction
  const Pcond = loss.armature + loss.switch + loss.diode + loss.friction
  const torque = mach.km * sig.iL.avg
  return {
    sig,
    Pin,
    Pout: Pshaft,
    Pairgap,
    loss,
    Pcond,
    Ploss: Pcond,
    // P_in − P_shaft − Σ losses, which the physics makes zero.
    balance: Pin - Pshaft - Pcond,
    eta: Pin !== 0 ? Pshaft / Pin : 0,
    mode: 'drive',
    omega,
    omegaRipple: sig.vemf.pp / mach.ke,
    omegaRms: sig.vemf.rms / mach.ke,
    rpm: (omega * 60) / (2 * Math.PI),
    torque,
    torqueRms: mach.km * sig.iL.rms,
    torqueRipple: mach.km * sig.iL.pp,
    // What the shaft has to be pushing, in steady state.
    torqueLoad: g * omega + mach.TL,
    Iavg: sig.iL.avg,
    Irms: sig.iL.rms,
    ripple: sig.iL.pp,
    // The ripple as the fraction of the torque it modulates.
    rippleShare: sig.iL.avg !== 0 ? sig.iL.pp / Math.abs(sig.iL.avg) : Infinity,
    Vterm: sig.vsw.avg,
    emf: sig.vemf.avg,
    regenerating: sig.iin.avg < 0,
    Iin: sig.iin.avg,
    td: ss.td,
  }
}

/**
 * The averaged model: the same machine fed the terminal voltage the duty
 * commands, solved as one linear equation by `@ee-labs/machines`. It knows
 * nothing of the switching, so where it agrees with the exact waveform is
 * where the quasi-static picture is honest.
 */
export function driveAveraged(conv) {
  const mach = conv.mach
  const p = conv.p
  const D = p.D
  // The devices enter the averaged model the way a first course puts them
  // there: a diode's drop is charged for the share of the period it conducts,
  // and the on-resistances add to the armature's, weighted the same way. With
  // every device ideal this is not an approximation at all, and the averaged
  // answer is the exact waveform's average to floating point.
  const bridge = conv.kind === 'hbridge'
  const Ra = mach.Ra + (bridge ? 2 * p.Ron : D * p.Ron + (1 - D) * p.rd)
  const Va = bridge ? conv.commanded : conv.commanded - (1 - D) * p.Vf
  const spec = { Ra, La: mach.La, k: mach.k, kt: mach.kt, J: mach.J, B: mach.B, TL: mach.TL, loadB: mach.loadB }
  const op = operating({ ...spec, Va })
  const tc = timeConstants(spec)
  return {
    Va,
    Ra,
    omega: op.omega,
    rpm: (op.omega * 60) / (2 * Math.PI),
    ia: op.ia,
    torque: op.torque,
    emf: op.emf,
    pIn: op.pIn,
    pShaft: op.pShaft,
    efficiency: op.efficiency,
    tauE: tc.tauE,
    tauM: tc.tauM,
    // The ratio the quasi-static picture rests on: how many electrical time
    // constants fit inside one mechanical one.
    separated: tc.separated,
    // ...and how many switching periods fit in the electrical one, which is
    // what decides how far the current ripples.
    periodsPerTauE: tc.tauE * conv.p.fs,
  }
}

/**
 * The armature ripple a drives course writes down. The terminal voltage is a
 * square wave and the EMF is the flat number it averages to, so the current
 * ramps by (V_dc − ⟨v⟩)·D·T/L_a. For the one-quadrant chopper that is
 * V_dc·D(1−D)/(L_a f_s), largest at half duty. A bipolar bridge swings twice
 * as far, so its ripple is twice as large. A unipolar one puts two pulses of
 * q = |2D − 1| in each period, so it ripples at 2·f_s by
 * V_dc·q(1−q)/(2 L_a f_s).
 */
export function armatureRipple(kind, { Vdc, D, La, fs, bipolar = true }) {
  if (kind !== 'hbridge') return (Vdc * D * (1 - D)) / (La * fs)
  if (bipolar) return (2 * Vdc * D * (1 - D)) / (La * fs)
  const q = Math.abs(2 * D - 1)
  return (Vdc * q * (1 - q)) / (2 * La * fs)
}

/** How often a six-step bridge commutates, and how much of a sector one switching period is. */
export function commutation(conv, omega) {
  if (conv.kind !== 'bldc') return null
  const m = conv.machine
  const omegaE = Math.abs(omega) * m.pairs
  const sector = omegaE > 0 ? conv.sectorAngle / omegaE : Infinity
  return {
    pairs: m.pairs,
    sectors: conv.sectors,
    angle: (conv.sectorAngle * 180) / Math.PI,
    omegaE,
    fe: omegaE / (2 * Math.PI),
    sector,
    rate: 1 / sector,
    periodsPerSector: sector * conv.p.fs,
    // Each phase carries the link current for two of the six sectors of every
    // half cycle, so it conducts for 120° of each 180° and its RMS is √(2/3)
    // of the link current's.
    phaseShare: Math.sqrt(2 / 3),
  }
}

/** Volt-seconds on the armature and torque-seconds on the inertia, per segment. */
export function driveBalance(ss) {
  const mach = ss.conv.mach
  const g = mach.B + mach.loadB
  const segs = ss.segments
    .filter((s) => s.T > 0)
    .map((seg) => ({
      name: seg.name,
      t0: seg.t0,
      T: seg.T,
      vs: signalIntegral(seg, 'vL'),
      q: quadrature(seg, (x) => mach.km * x[0] - g * x[1] - mach.TL),
    }))
  return {
    segs,
    vsTotal: segs.reduce((a, s) => a + s.vs, 0),
    qTotal: segs.reduce((a, s) => a + s.q, 0),
  }
}
