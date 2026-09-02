// Periodic steady state of a converter, and what is measured on it.
//
// Continuous conduction (CCM): the switching pattern is fixed — on for DT,
// off for (1−D)T — so one period is an affine map x(T) = Φ x(0) + d and the
// periodic state is the solution of (I − Φ) x0 = d. No time-stepping, no
// "run until it settles".
//
// Discontinuous conduction (DCM): the diode blocks at an instant t_d inside
// the off interval that depends on the state, so the pattern is on / off /
// dead with t_d unknown. Because the period then starts with i_L = 0, the
// unknowns are t_d and v_C(0). For a trial t_d the period map is affine in
// v_C(0), so periodicity gives v_C(0) directly, and the mismatch left is
// whether i_L actually reaches zero at that t_d. That scalar residual is
// bisected to 1e-13 of the period.

import { propagator } from './expm.js'
import { eye, matMul, matVec, matAdd, vecAdd, solve } from './linalg.js'
import { integral, quadrature, sample, stateAt, firstDownCrossing, bisect } from './segment.js'
import { SIGNALS, evalSignal } from './topologies.js'

function chain(conv, plan, x0) {
  // Propagate x0 through a list of (state, duration), returning the segments.
  const segs = []
  let x = x0
  let t0 = 0
  for (const { state, T } of plan) {
    const seg = { name: state.name, state, A: state.A, f: state.f, x0: x, T, t0 }
    segs.push(seg)
    if (T > 0) {
      const { phi0, phi1 } = propagator(state.A, T)
      x = vecAdd(matVec(phi0, x), matVec(phi1, state.f))
    }
    t0 += T
  }
  return { segs, xEnd: x }
}

export function steadyState(conv) {
  const { T, states } = conv
  const tOn = conv.p.D * T
  const tOff = T - tOn

  // CCM candidate.
  const Pon = propagator(states.on.A, tOn)
  const Poff = propagator(states.off.A, tOff)
  const Phi = matMul(Poff.phi0, Pon.phi0)
  const d = vecAdd(matVec(Poff.phi0, matVec(Pon.phi1, states.on.f)), matVec(Poff.phi1, states.off.f))
  const x0 = solve(matAdd(eye(2), Phi, -1), d)
  const ccmPlan = [
    { state: states.on, T: tOn },
    { state: states.off, T: tOff },
  ]
  const ccm = chain(conv, ccmPlan, x0)

  let dcm = false
  if (conv.hasDead) {
    const offSeg = ccm.segs[1]
    dcm = x0[0] < 0 || (offSeg.T > 0 && firstDownCrossing(offSeg, 0) !== null)
  }
  if (!dcm) {
    return { mode: 'CCM', conv, T, tOn, tOff, td: tOff, x0, segments: ccm.segs }
  }

  // DCM: bisect the diode-off instant. The on-segment propagator is fixed;
  // each trial costs the off and dead propagators once, and the affine period
  // map in v_C(0) is read off them.
  const onDrive = matVec(Pon.phi1, states.on.f)
  const trial = (td) => {
    const Po = propagator(states.off.A, td)
    const Pd = propagator(states.dead.A, tOff - td)
    const offDrive = matVec(Po.phi1, states.off.f)
    // x2 = Po.phi0 (Pon.phi0 x0 + onDrive) + offDrive, x3 = Pd.phi0 x2 (dead has no drive).
    const x2of = (x0) => vecAdd(matVec(Po.phi0, vecAdd(matVec(Pon.phi0, x0), onDrive)), offDrive)
    const b2 = x2of([0, 0])
    const b = matVec(Pd.phi0, b2)[1]
    const a = matVec(Pd.phi0, x2of([0, 1]))[1] - b
    const v0 = b / (1 - a)
    const x2 = x2of([0, v0])
    return { v0, r: x2[0] }
  }
  const td = bisect((t) => trial(t).r, 0, tOff, 1e-13 * T)
  const { v0 } = trial(td)
  const run = chain(conv, [
    { state: states.on, T: tOn },
    { state: states.off, T: td },
    { state: states.dead, T: tOff - td },
  ], [0, v0])
  // Pin the dead segment's current at exactly zero — that is the model.
  run.segs[2].x0 = [0, run.segs[2].x0[1]]
  return { mode: 'DCM', conv, T, tOn, tOff, td, x0: [0, v0], segments: run.segs }
}

// x(T) from x0 through the steady-state segments; equals x0 when it is steady.
export function periodMap(ss) {
  let x = ss.x0
  for (const seg of ss.segments) {
    if (seg.T <= 0) continue
    x = stateAt({ ...seg, x0: x }, seg.T)
  }
  return x
}

// Scope traces over `periods` periods, about `n` points per period, both
// ends of every segment included so switching edges plot vertical.
export function waveforms(ss, { periods = 2, n = 240 } = {}) {
  const names = ss.conv.signals || SIGNALS
  const t = []
  const sig = Object.fromEntries(names.map((s) => [s, []]))
  const edges = []
  for (let k = 0; k < periods; k++) {
    const base = k * ss.T
    for (const seg of ss.segments) {
      if (seg.T <= 0) continue
      const m = Math.max(8, Math.round((n * seg.T) / ss.T))
      const pts = sample(seg, m)
      const dt = seg.T / m
      for (let i = 0; i <= m; i++) {
        t.push(base + seg.t0 + i * dt)
        for (const s of names) sig[s].push(evalSignal(seg.state, s, pts[i]))
      }
      edges.push({ t: base + seg.t0, name: seg.name })
    }
  }
  return { t, sig, edges, T: ss.T }
}

// ∫ y dt over one segment for a signal, exactly (the signal is linear in the
// state within a segment).
export function signalIntegral(seg, name, ix = integral(seg)) {
  const s = seg.state.signals[name]
  let y = s.d * seg.T
  for (let i = 0; i < s.c.length; i++) y += s.c[i] * ix[i]
  return y
}

// The period average of a signal — the cheap measure, for sweeps.
export function average(ss, name) {
  let acc = 0
  for (const seg of ss.segments) if (seg.T > 0) acc += signalIntegral(seg, name)
  return acc / ss.T
}

export function measures(ss) {
  const { conv, T } = ss
  const p = conv.p
  const live = ss.segments.filter((s) => s.T > 0)
  const ints = live.map((seg) => ({ seg, ix: integral(seg) }))
  const avgOf = (name) => ints.reduce((acc, { seg, ix }) => acc + signalIntegral(seg, name, ix), 0) / T
  const meanSq = (name) =>
    live.reduce((acc, seg) => acc + quadrature(seg, (x) => evalSignal(seg.state, name, x) ** 2), 0) / T
  const meanProd = (a, b) =>
    live.reduce(
      (acc, seg) =>
        acc + quadrature(seg, (x) => evalSignal(seg.state, a, x) * evalSignal(seg.state, b, x)),
      0,
    ) / T

  const out = {}
  const dense = live.map((seg) => ({ seg, pts: sample(seg, 256) }))
  for (const name of SIGNALS) {
    let min = Infinity
    let max = -Infinity
    for (const { seg, pts } of dense) {
      for (const x of pts) {
        const y = evalSignal(seg.state, name, x)
        if (y < min) min = y
        if (y > max) max = y
      }
    }
    const ms = meanSq(name)
    out[name] = { avg: avgOf(name), rms: Math.sqrt(Math.max(0, ms)), min, max, pp: max - min }
  }

  const Pin = p.Vin * out.iin.avg
  const Pout = meanSq('vout') / p.R
  const iQ2 = meanSq('iQ')
  const iD2 = meanSq('iD')
  const loss = {
    switch: p.Ron * iQ2,
    diode: p.sync ? p.Ron * iD2 : p.Vf * out.iD.avg + p.rd * iD2,
    inductor: p.RL * meanSq('iL'),
    esr: p.ESR * meanSq('iC'),
  }
  const Pcond = loss.switch + loss.diode + loss.inductor + loss.esr
  // Switching loss model: half the blocked voltage times the current being
  // commutated, over the transition time, once per edge per period. The
  // magnitude, because a synchronous converter can commutate a negative
  // current and that still costs energy.
  const iTurnOn = ss.x0[0]
  const iTurnOff = stateAt(ss.segments[0], ss.tOn)[0]
  const Vblk = conv.blocking(out.vout.avg)
  loss.switching = 0.5 * Vblk * (Math.abs(iTurnOn) * p.tr + Math.abs(iTurnOff) * p.tf) * p.fs
  const Ploss = Pcond + loss.switching
  return {
    sig: out,
    Pin,
    Pout,
    loss,
    Pcond,
    Ploss,
    // The circuit's own books: source power in equals load plus conduction
    // losses, exactly, in periodic steady state. Switching loss is a model
    // added on top, so it is charged to the input separately.
    balance: Pin - Pout - Pcond,
    eta: Pout / (Pin + loss.switching),
    M: out.vout.avg / p.Vin,
    Iout: out.vout.avg / p.R,
    mode: ss.mode,
    td: ss.td,
    iTurnOn,
    iTurnOff,
    Vblk,
    meanProd,
  }
}
