// One experiment plus its knob settings, solved.
//
// Every view, every meter and every pinned number in a lesson reads from the
// object this file returns. Nothing else in the app solves anything, so a
// number on screen and a number in a test come from the same call.
//
// The shape depends on the experiment's `kind`, which names the model it
// opens. Every kind carries `spec`, the machine after the knobs are applied,
// and whatever closed forms and solves that model has.

import { complex as cx, dynamics, energies, solveAC, transient } from '@ee-labs/network'
import * as M from '@ee-labs/machines'
import { DC, IM, LOSS, PM, SAT, SM, XF } from './machines.js'

const BASE = { dc: DC, transformer: XF, im: IM, sync: SM, pmsm: PM, losses: LOSS, field: {}, dq: {}, sat: SAT }

/** rms from a phasor amplitude. */
export const rms = (X) => cx.cabs(X) / Math.SQRT2

/**
 * The machine an experiment runs at, with the knobs merged in.
 *
 * Every knob key goes into the spec. A key the model does not have is ignored
 * by its `*Of`, which spreads its own defaults first, so a view-only knob such
 * as the time window costs nothing. That keeps one rule instead of two lists.
 */
export function specOf(exp, params) {
  return { ...(BASE[exp.kind] || {}), ...(exp.machine || {}), ...params }
}

/** Default knob settings for an experiment. */
export const defaultsOf = (exp) => Object.fromEntries(exp.params.map((p) => [p.key, p.default]))

// --------------------------------------------------------------- the DC motor

function analyseDC(exp, params, spec) {
  const line = M.line(spec)
  const op = M.operating(spec)
  const tc = M.timeConstants(spec)
  const out = { line, op, tc }
  if (exp.time) {
    const rate = Math.min(...tc.roots.map((r) => Math.abs(r.re)))
    const tEnd = (params.window ?? exp.windows ?? 8) / rate
    const net = M.dcNetlist({ ...spec, drive: { kind: 'step', from: 0, to: spec.Va } })
    const tr = transient(net, { tEnd, points: exp.points || 1201 })
    const cursor = (params.cursor ?? exp.cursor ?? 1) * tEnd
    const at = tr.at(cursor)
    out.net = net
    out.tr = tr
    out.tEnd = tEnd
    out.cursor = cursor
    out.sol = at.sol
    out.audit = M.powerAudit(at.sol, spec)
    out.dyn = dynamics(net)
    if (exp.energy) out.energy = energies(tr)
    let peak = 0
    let peakAt = 0
    for (const s of tr.samples)
      if (s.sol.i.Ra > peak) {
        peak = s.sol.i.Ra
        peakAt = s.t
      }
    out.peak = peak
    out.peakAt = peakAt
  } else {
    const net = M.dcNetlist(spec)
    out.net = net
    out.dyn = dynamics(net)
  }
  if (exp.control) out.control = M.control(spec, exp.control)
  return out
}

// -------------------------------------------------------------- the transformer

function analyseTransformer(exp, params, spec) {
  const net = M.transformerNetlist(spec)
  const t = net.transformer
  const ac = solveAC(net, t.omega)
  const open = solveAC(M.transformerNetlist({ ...spec, RL: 1e9 }), t.omega)
  const openNode = M.transformerNetlist({ ...spec, RL: 1e9 }).outNode
  const vOut = rms(ac.v[net.outNode])
  const vNoLoad = rms(open.v[openNode])
  const pOut = ac.s.RL[0]
  const pCu = (ac.s.R1?.[0] ?? 0) + (ac.s.R2?.[0] ?? 0)
  const pCore = ac.s.Rc?.[0] ?? 0
  const pIn = -ac.s.Vs[0]
  return {
    net,
    ac,
    open,
    openNode,
    vOut,
    vNoLoad,
    vp: rms(ac.v.p),
    vs: rms(ac.v.s),
    iLoad: rms(ac.i.RL),
    iPrim: rms(ac.i.Vs),
    ratioV: rms(ac.v[net.stage === 'ideal' ? 'p' : 'p2'] ?? ac.v.p) / rms(ac.v.s),
    pOut,
    pCu,
    pCore,
    pIn,
    efficiency: pIn > 0 ? pOut / pIn : 0,
    regulation: M.regulation(vNoLoad, vOut),
    reflected: M.reflected(spec),
    openShort: M.openShort(spec),
    bestX: pCu > 0 ? Math.sqrt(pCore / pCu) : 0,
  }
}

// --------------------------------------------------------- the induction machine

function analyseIM(exp, params, spec) {
  const m = M.imOf(spec)
  const bd = M.breakdown(spec)
  const th = M.imThevenin(spec)
  const op = M.imOperating(spec, solveAC)
  const slip = params.slip ?? op.slip
  const net = M.perPhase(spec, slip)
  const ac = solveAC(net, m.omega)
  const out = {
    machine: m,
    bd,
    th,
    op,
    slip,
    net,
    ac,
    I1: rms(ac.i.R1),
    I2: rms(ac.i.R2s),
    torque: M.torqueOfSlip(spec, slip),
    curve: M.torqueCurve(spec, { from: 1, to: 1e-4, points: 401 }),
    tStart: M.torqueOfSlip(spec, 1),
    iStart: rms(solveAC(M.perPhase(spec, 1), m.omega).i.R1),
  }
  out.pGap = 3 * out.I2 * out.I2 * (m.R2 / slip)
  out.pRotorCu = slip * out.pGap
  out.pMech = (1 - slip) * out.pGap
  // The terminal side at the same slip, so a lesson reads one operating point
  // rather than two. `op` stays the crossing with the load, for the curve.
  out.omega = (1 - slip) * m.omegaSync
  out.pIn = -3 * ac.s.V1[0]
  out.pf = out.pIn / (3 * m.V * out.I1)
  out.pStatorCu = 3 * out.I1 * out.I1 * m.R1
  out.pCore = ac.s.Rc ? 3 * rms(ac.volt.Rc) ** 2 / m.Rc : 0
  out.pFriction = (m.B + m.loadB) * out.omega * out.omega
  out.pShaft = out.pMech - out.pFriction
  out.efficiency = out.pIn > 0 ? out.pShaft / out.pIn : 0
  if (exp.runUp) out.runUp = M.runUp(spec, { steps: exp.steps || 2000 })
  if (exp.rotorSweep) out.rotorSweep = exp.rotorSweep.map((f) => ({ f, ...M.breakdown({ ...spec, R2: m.R2 * f }) }))
  return out
}

// ----------------------------------------------- the rotating field, on its own

function analyseField(exp, params, spec) {
  const hz = params.f ?? 50
  const f = M.rotatingField({
    amp: params.amp ?? 1,
    omega: 2 * Math.PI * hz,
    poles: params.poles ?? 4,
    turns: params.turns ?? 1,
  })
  // The time knob is in periods, so the picture does the same thing whatever
  // the frequency is set to.
  const t = (params.t ?? 0) / hz
  const points = 361
  const theta = []
  const total = []
  const phase = [[], [], []]
  const TAU3 = (2 * Math.PI) / 3
  for (let k = 0; k < points; k++) {
    const a = (2 * Math.PI * k) / (points - 1)
    theta.push(a)
    total.push(M.fieldAt(f, a, t))
    ;[0, -TAU3, TAU3].forEach((ph, j) => phase[j].push(f.turns * f.amp * Math.cos(f.omega * t + ph) * Math.cos(a - [0, TAU3, -TAU3][j])))
  }
  return { field: f, t, theta, total, phase, exact: (a) => f.amplitude * Math.cos(f.omega * t - a) }
}

// ------------------------------------------- the synchronous and PM machines

function analyseSync(exp, params, spec) {
  // The knob is in degrees, because "500 m°" is nobody's angle. The model
  // takes radians.
  const delta = params.deltaDeg !== undefined ? (params.deltaDeg * Math.PI) / 180 : spec.delta
  const ph = M.syncPhasor(spec, delta)
  const pa = M.powerAngle(spec, delta)
  return {
    spec,
    delta,
    phasor: ph,
    power: pa,
    pullOut: M.pullOut(spec),
    curve: M.syncCurve(spec),
    machine: M.syncOf(spec),
    vCurve: (exp.excitations || []).map((E) => ({ E, ...M.syncPhasor({ ...spec, E }, delta) })),
  }
}

function analysePMSM(exp, params, spec) {
  // The knob is an electrical frequency in hertz. The model takes rad/s.
  if (params.fe !== undefined) spec = { ...spec, omegaE: 2 * Math.PI * params.fe }
  const st = M.pmsmState(spec)
  const foc = M.focPlant(spec)
  const iq = params.iq ?? 10
  const id = params.id_ ?? 0
  const t = M.pmsmTorque(spec, id, iq)
  return { spec, state: st, foc, iq, id, torque: t, machine: M.pmsmOf(spec) }
}

// ------------------------------------------------------------- the dq transform

function analyseDQ(exp, params, spec) {
  const amp = params.amp ?? 325
  const f = params.f ?? 50
  // In periods, as in Group C, so the picture is the same at any frequency.
  const t = (params.t ?? 0) / f
  const theta = 2 * Math.PI * f * t
  const TAU3 = (2 * Math.PI) / 3
  const abc = [0, -TAU3, TAU3].map((p) => amp * Math.cos(2 * Math.PI * f * t + p))
  const iAbc = abc.map((v) => v / 40)
  const conv = params.convention ?? 'power-invariant'
  const dq = M.dq0(abc, theta, conv)
  const back = M.invDq0(dq, theta, conv)
  const p = M.power(abc, iAbc, theta, conv)
  return {
    amp,
    f,
    t,
    theta,
    abc,
    iAbc,
    convention: conv,
    dq,
    back,
    power: p,
    radius: Math.hypot(dq[0], dq[1]),
    other: M.dq0(abc, theta, conv === 'power-invariant' ? 'amplitude-invariant' : 'power-invariant'),
    law: M.CONVENTIONS[conv].power,
  }
}

// -------------------------------------------------------- losses and the heat

function analyseLosses(exp, params, spec) {
  const x = params.x ?? 1
  const split = M.lossSplit(spec, x)
  const best = M.bestEfficiency(spec)
  const heat = M.thermal(spec, split.loss)
  const out = { x, split, best, heat, curve: M.efficiencyCurve(spec, { from: 0.05, to: 1.5, points: 301 }), machine: M.lossesOf(spec) }
  if (exp.time) {
    const net = M.thermalNetlist(spec, split.loss)
    const tr = transient(net, { tEnd: 5 * heat.tau, points: 401 })
    const cursor = (params.cursor ?? exp.cursor ?? 1) * 5 * heat.tau
    out.net = net
    out.tr = tr
    out.tEnd = 5 * heat.tau
    out.cursor = cursor
    out.sol = tr.at(cursor).sol
  }
  const m = M.lossesOf(spec)
  const varFull = m.pCuFull + m.strayFraction * m.pOut
  out.overload = Math.sqrt((heat.limitLoss - m.pCore - m.pFriction) / varFull)
  return out
}

function analyseSaturation(exp, params, spec) {
  const i = params.i ?? 0.45
  const model = params.model ?? spec.model
  const s = M.saturate({ ...spec, model }, i)
  const points = 201
  const curve = { i: [], lambda: [], linear: [] }
  for (let k = 0; k < points; k++) {
    const ii = (-0.6 + (1.2 * k) / (points - 1)) * 1
    curve.i.push(ii)
    curve.lambda.push(M.saturate({ ...spec, model }, ii).lambda)
    curve.linear.push(spec.L0 * ii)
  }
  return { i, model, sat: s, curve, label: M.saturationLabel({ ...spec, model }), iKnee: spec.lambdaSat / spec.L0 }
}

const BY_KIND = {
  dc: analyseDC,
  transformer: analyseTransformer,
  im: analyseIM,
  field: analyseField,
  sync: analyseSync,
  pmsm: analysePMSM,
  dq: analyseDQ,
  losses: analyseLosses,
  sat: analyseSaturation,
}

/** One experiment at one setting, solved. */
export function analyse(exp, params = null) {
  const p = params || defaultsOf(exp)
  const spec = specOf(exp, p)
  const fn = BY_KIND[exp.kind]
  if (!fn) throw new Error(`${exp.id}: unknown experiment kind "${exp.kind}"`)
  return { exp, params: p, spec, kind: exp.kind, ...fn(exp, p, spec) }
}
