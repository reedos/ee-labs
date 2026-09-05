// The induction machine, per phase.
//
// The rotating field of dq.js turns at ω_s. The rotor turns slower, by the
// slip s = (ω_s − ω_m)/ω_s, and that difference is the whole machine. The
// rotor sees the field at slip frequency, its induced current is proportional
// to s, and its impedance rises with s. Divide both by s and the rotor bars
// become one resistance R₂/s at the STATOR's frequency: the per-phase
// equivalent circuit, which is exact for the model it is.
//
//     V₁ ──R₁──jX₁──┬── R_c ── gnd
//                   ├── jX_m ── gnd
//                   └── jX₂ ── R₂/s ── gnd
//
// R₂/s splits into R₂, the rotor's own copper loss, and R₂(1−s)/s, which is
// not a resistance at all. It is the mechanical power, in ohms, and that split
// is where the torque comes from. The air-gap power is 3 I₂² R₂/s and the
// torque is that over ω_s, never over ω_m.
//
// -------------------------------------------------------- what is admitted
//
// The phasor circuit is exact and so is every number read off it. The torque
// curve is a closed form, derived by Thévenin from the same circuit, and
// `torqueOfSlip` and a `solveAC` of `perPhase` agree to floating point, which
// is invariant 6. The breakdown point is a closed form too: differentiate the
// torque with respect to R₂/s and the maximum is where R₂/s equals |Z_th + jX₂|.
//
// What is declined. The machine's dq model with the rotor speed as a state is
// bilinear, so it is not a linear state space and has no transfer function.
// This package does not offer one. `runUp` gives the quasi-static picture a
// drives course uses instead, where the electrical transient is assumed over
// before the speed has moved, and it is labelled as that approximation with
// the time-constant ratio as its guard.

import { GROUND } from '@ee-labs/network'
import { integrate } from './integrate.js'

/** A 4-pole 400 V 50 Hz 3 kW cage machine, filled in by `imOf`. */
export const IM_DEFAULTS = {
  V: 400 / Math.sqrt(3), // phase voltage, rms V
  f: 50,
  poles: 4,
  R1: 1.4, // stator resistance, Ω per phase
  X1: 2.4, // stator leakage reactance, Ω per phase
  R2: 1.2, // rotor resistance referred to the stator, Ω per phase
  X2: 2.4, // rotor leakage reactance referred, Ω per phase
  Xm: 65, // magnetising reactance, Ω per phase
  Rc: 1200, // core-loss resistance, Ω per phase. Infinity to leave it out
  J: 0.05, // rotor and load inertia, kg·m²
  B: 0.002, // viscous friction, N·m·s/rad
  TL: 20, // load torque, N·m
  loadB: 0, // load torque per unit speed
}

export function imOf(spec = {}) {
  const m = { ...IM_DEFAULTS, ...spec }
  for (const key of ['R1', 'R2', 'Xm']) if (!(m[key] > 0)) throw new Error(`${key}: must be positive`)
  if (!(m.poles >= 2) || m.poles % 2) throw new Error('poles: an even number of poles, two or more')
  m.omega = 2 * Math.PI * m.f
  m.omegaSync = (2 * m.omega) / m.poles
  m.rpmSync = (120 * m.f) / m.poles
  return m
}

// ------------------------------------------------------------ complex helpers
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
const div = (a, b) => {
  const d = b[0] * b[0] + b[1] * b[1]
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]
}
const abs = (a) => Math.hypot(a[0], a[1])
const inv = (a) => div([1, 0], a)

/**
 * The per-phase circuit as a netlist for `solveAC`, at one slip.
 *
 * The source is a phase voltage of `V` rms, so its amplitude is V√2 and every
 * magnitude read back divides by √2 to become an rms value. R₂/s is one
 * resistor, which is why the circuit is linear at a fixed slip and why the
 * slip is a knob rather than a state.
 */
export function perPhase(spec = {}, s = 0.04) {
  const m = imOf(spec)
  if (!(s > 0)) throw new Error('slip: the per-phase circuit needs a positive slip; at s = 0 the rotor branch is open')
  const w = m.omega
  const elements = [
    { type: 'V', id: 'V1', nodes: ['a', GROUND], value: 0, wave: { kind: 'sine', amp: m.V * Math.SQRT2, freq: m.f } },
    { type: 'R', id: 'R1', nodes: ['a', 'b'], value: m.R1 },
    { type: 'L', id: 'X1', nodes: ['b', 'g'], value: m.X1 / w },
    { type: 'L', id: 'Xm', nodes: ['g', GROUND], value: m.Xm / w },
    { type: 'L', id: 'X2', nodes: ['g', 'r'], value: m.X2 / w },
    { type: 'R', id: 'R2s', nodes: ['r', GROUND], value: m.R2 / s },
  ]
  if (Number.isFinite(m.Rc)) elements.splice(4, 0, { type: 'R', id: 'Rc', nodes: ['g', GROUND], value: m.Rc })
  return { elements, machine: m, slip: s }
}

/**
 * The Thévenin equivalent the rotor branch sees: the stator impedance and the
 * shunt branch reduced to one source and one impedance. Exact.
 */
export function imThevenin(spec = {}) {
  const m = imOf(spec)
  const Z1 = [m.R1, m.X1]
  const Ysh = add(Number.isFinite(m.Rc) ? [1 / m.Rc, 0] : [0, 0], [0, -1 / m.Xm])
  const Zsh = inv(Ysh)
  const Vth = mul([m.V, 0], div(Zsh, add(Z1, Zsh)))
  const Zth = div(mul(Z1, Zsh), add(Z1, Zsh))
  return { machine: m, Vth, Zth, Rth: Zth[0], Xth: Zth[1], Vmag: abs(Vth), Zsh, Z1 }
}

/**
 * The torque at a slip, in closed form.
 *
 *     T(s) = (3 / ω_s) · |V_th|² (R₂/s) / [ (R_th + R₂/s)² + (X_th + X₂)² ]
 *
 * At s = 0 the rotor branch is an open circuit, no current crosses the gap and
 * the torque is exactly zero. At s = 1 the machine is at standstill and the
 * value is the starting torque. Negative slip is a generator, and the formula
 * carries straight through to it.
 */
export function torqueOfSlip(spec = {}, s) {
  const th = imThevenin(spec)
  const m = th.machine
  if (s === 0) return 0
  const rs = m.R2 / s
  const den = (th.Rth + rs) ** 2 + (th.Xth + m.X2) ** 2
  return (3 * th.Vmag * th.Vmag * rs) / (m.omegaSync * den)
}

/**
 * The breakdown point: the largest torque the machine can make, and the slip
 * at which it makes it.
 *
 * Differentiating T with respect to R₂/s and setting it to zero gives
 * R₂/s = |Z_th + jX₂|, so
 *
 *     s_max = R₂ / √(R_th² + (X_th + X₂)²)
 *     T_max = 3|V_th|² / (2 ω_s [ R_th + √(R_th² + (X_th + X₂)²) ])
 *
 * T_max does not contain R₂. Rotor resistance moves the breakdown along the
 * slip axis and does not change its height, which is the whole of C8.
 */
export function breakdown(spec = {}) {
  const th = imThevenin(spec)
  const m = th.machine
  const root = Math.hypot(th.Rth, th.Xth + m.X2)
  const sMax = m.R2 / root
  const tMax = (3 * th.Vmag * th.Vmag) / (2 * m.omegaSync * (th.Rth + root))
  return { sMax, tMax, root, thevenin: th, speedAt: (1 - sMax) * m.omegaSync }
}

/** The rotor resistance that puts breakdown at a wanted slip. R₂ = s·|Z_th + jX₂|. */
export function rotorResistanceFor(spec = {}, sWanted) {
  if (!(sWanted > 0 && sWanted <= 1)) throw new Error('slip: the wanted breakdown slip is between 0 and 1')
  const th = imThevenin(spec)
  return sWanted * Math.hypot(th.Rth, th.Xth + th.machine.X2)
}

/** The torque curve over a slip range, for the plot and for the tests. */
export function torqueCurve(spec = {}, { from = 1, to = 0, points = 401 } = {}) {
  const slip = []
  const torque = []
  const speed = []
  const m = imOf(spec)
  for (let k = 0; k < points; k++) {
    const s = from + ((to - from) * k) / (points - 1)
    slip.push(s)
    torque.push(torqueOfSlip(spec, s))
    speed.push((1 - s) * m.omegaSync)
  }
  return { slip, torque, speed, machine: m }
}

/**
 * The slip at which the machine makes a wanted torque, on the stable side of
 * breakdown (below s_max) unless `branch` says otherwise. Bisection on the
 * closed form, so the answer is a root of the torque curve and not a sample
 * of it.
 */
export function slipFor(spec = {}, T, { branch = 'stable' } = {}) {
  const bd = breakdown(spec)
  if (T > bd.tMax)
    throw new Error(
      `The load asks ${T.toPrecision(4)} N·m and this machine's breakdown torque is ${bd.tMax.toPrecision(4)} N·m. It would stall.`,
    )
  let lo = branch === 'stable' ? 1e-12 : bd.sMax
  let hi = branch === 'stable' ? bd.sMax : 1
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    const t = torqueOfSlip(spec, mid)
    if (branch === 'stable' ? t < T : t > T) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * The operating point: where the torque curve crosses the load, and the powers
 * on both sides of the air gap.
 *
 * The load is T_L + B ω + B_L ω, so the crossing is a root of one scalar
 * equation and bisection finds it on the closed form. Every power below comes
 * from the phasor circuit at that slip, so the split is the model's own and
 * not a second set of formulas that could disagree with it.
 */
export function imOperating(spec = {}, solveAC) {
  const m = imOf(spec)
  const bd = breakdown(spec)
  const loadAt = (s) => m.TL + (m.B + m.loadB) * (1 - s) * m.omegaSync
  let lo = 1e-12
  let hi = bd.sMax
  if (torqueOfSlip(spec, hi) < loadAt(hi))
    throw new Error(
      `The load asks more than this machine's breakdown torque of ${bd.tMax.toPrecision(4)} N·m at every slip up to ${bd.sMax.toPrecision(3)}. It would stall.`,
    )
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    if (torqueOfSlip(spec, mid) < loadAt(mid)) lo = mid
    else hi = mid
  }
  const s = (lo + hi) / 2
  const omega = (1 - s) * m.omegaSync
  const T = torqueOfSlip(spec, s)
  const pGap = T * m.omegaSync
  const pRotorCu = s * pGap
  const pMechGross = (1 - s) * pGap
  const pFriction = (m.B + m.loadB) * omega * omega
  const out = { machine: m, slip: s, omega, rpm: (omega * 60) / (2 * Math.PI), torque: T, pGap, pRotorCu, pMechGross, pFriction, pShaft: pMechGross - pFriction }
  if (solveAC) {
    const ac = solveAC(perPhase(spec, s), m.omega)
    const I1 = Math.hypot(ac.i.R1[0], ac.i.R1[1]) / Math.SQRT2
    const I2 = Math.hypot(ac.i.R2s[0], ac.i.R2s[1]) / Math.SQRT2
    out.I1 = I1
    out.I2 = I2
    out.pStatorCu = 3 * I1 * I1 * m.R1
    out.pCore = Number.isFinite(m.Rc) ? 3 * (Math.hypot(ac.volt.Rc[0], ac.volt.Rc[1]) / Math.SQRT2) ** 2 / m.Rc : 0
    out.pIn = -3 * ac.s.V1[0]
    out.pf = out.pIn / (3 * m.V * I1)
    out.efficiency = out.pShaft / out.pIn
  }
  return out
}

/**
 * The run-up: the speed against time from standstill to the operating point.
 *
 * J dω/dt = T(s(ω)) − T_L − (B + B_L) ω, with T from the closed form. The
 * torque is not linear in ω, so this is the one thing in the package that is
 * integrated rather than solved. `integrate` reports the error and refuses
 * when it is too large to state, per CORE_SCOPE Rule 3.
 *
 * The model behind it is quasi-static: the stator transient is assumed over
 * before the speed has moved. `separated` is the ratio of the mechanical time
 * constant to the stator's, and `guardMet` is whether it clears ten.
 */
export function runUp(spec = {}, { tEnd, steps = 2000, tol } = {}) {
  const m = imOf(spec)
  const bd = breakdown(spec)
  const tauE = (m.X1 + m.X2) / (m.omega * (m.R1 + m.R2))
  const tauM = (m.J * m.omegaSync) / Math.max(bd.tMax, 1e-12)
  const f = (t, y) => [(torqueOfSlip(spec, 1 - y[0] / m.omegaSync) - m.TL - (m.B + m.loadB) * y[0]) / m.J]
  const span = tEnd ?? 12 * tauM
  const run = integrate(f, [0], span, { steps, tol })
  return {
    ...run,
    machine: m,
    omega: run.y.map((y) => y[0]),
    slip: run.y.map((y) => 1 - y[0] / m.omegaSync),
    tauE,
    tauM,
    separated: tauM / tauE,
    guardMet: tauM / tauE >= 10,
    says: `${run.says} The quasi-static model needs the mechanical time constant well above the stator's; here the ratio is ${(tauM / tauE).toPrecision(3)}.`,
  }
}
