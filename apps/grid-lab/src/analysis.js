// From an experiment and its knobs to everything the panes draw.
//
// `@ee-labs/grid` holds the models. This file holds the one analysis each
// experiment needs, so a pane, a note and a test all read the same numbers
// from the same call. Nothing here computes physics of its own. Where a
// number looks like arithmetic it is arithmetic on what the engine returned,
// and `readQuantity` is the only path a lesson may name a value by.
//
// Every experiment has a `kind`, and each kind has one analysis. The kinds
// follow the plan's groups: `base` is per unit, `phase` is three phase, `line`
// is the line and the transformer, `flow` is the power flow and its linear
// approximation, `seq` is symmetrical components, `fault` is the four faults,
// `relay` is protection, `swing` is stability, and `dispatch` is the last two.

import {
  DISPATCH_UNITS,
  FAULT_NETWORK,
  MACHINE,
  apparentZ,
  assumptionCost,
  bases,
  branchFlows,
  changeBase,
  coordinate,
  costCurves,
  crossoverRatio,
  curvePoints,
  DC_REFUSE_DEG,
  DC_RX_LIMIT,
  DC_V_BAND,
  DC_WARN_DEG,
  LONG_LINE_KM,
  dcCompare,
  dcFlow,
  dcGuard,
  deltaLoad,
  deltaToWye,
  dispatch,
  distanceZones,
  faultStudy,
  faultTable,
  iecTime,
  injections,
  instantaneousPower,
  lineConstants,
  lineModel,
  lineToNeutral,
  loadFromPf,
  lossAudit,
  marginalCost,
  neutral,
  nominalPi,
  openEndRise,
  phaseVoltages,
  phasors,
  powerFlow,
  PowerFlowError,
  pvCurve,
  reactiveBalance,
  sequenceImpedances,
  sets,
  stability,
  surgeLoading,
  threeBus,
  toPhase,
  toSequence,
  twoBus,
  unbalanceFactor,
  wyeLoad,
  ybus,
  zipModels,
  zoneBases,
  zoneOf,
  cx,
} from '@ee-labs/grid'

const { cabs, carg, deg, polar, rad } = cx

/** The system base every experiment is written on, unless a knob moves it. */
export const BASE = { Sbase: 100e6, Vbase: 230e3 }

/** The reference line of the plan's §4.3, in ohms and siemens per kilometre. */
export const LINE = { r: 0.05, x: 0.4, b: 3.0e-6, f: 60 }

// ------------------------------------------------------------ the cache
//
// A P–V curve is sixty power flows and a swing run is two thousand RK4 steps,
// and both are asked for again on every render. The cache is keyed by the
// whole call, so a knob move invalidates everything, which is the correct
// behaviour and also the simple one.

const cache = new Map()
const memo = (key, make) => {
  if (cache.has(key)) return cache.get(key)
  const value = make()
  if (cache.size > 400) cache.clear()
  cache.set(key, value)
  return value
}

/** The library network an experiment opens on, at its knobs. */
export function networkOfExperiment(exp, p) {
  if (exp.network === 'twoBus') return twoBus({ x: p.X ?? 0.1, P: p.Pload ?? 0.8, Q: p.Qload ?? 0.6, tap: 1 / (p.tap ?? 1), Bsh: p.Bsh ?? 0 })
  return threeBus({ load: p.load ?? 1, Qmax: p.Qmax ?? Infinity, V2: p.V2 ?? 1 })
}

/** A solved power flow, or the refusal that took its place. */
export function solveFlow(net, key) {
  return memo(`flow:${key}`, () => {
    try {
      return { sol: powerFlow(net), refusal: null }
    } catch (err) {
      if (!(err instanceof PowerFlowError)) throw err
      return { sol: null, refusal: err.message }
    }
  })
}

// ------------------------------------------------------------ the analyses

function analyseBase(exp, p) {
  const b = bases({ Sbase: (p.Sbase ?? 100) * 1e6, Vbase: (p.Vbase ?? 230) * 1e3 })
  const low = zoneBases(b, (p.VbaseLow ?? 13.8) * 1e3)
  const gen = changeBase(p.zGen ?? 0.2, { Sold: (p.Sgen ?? 90) * 1e6, Vold: b.Vbase, Snew: b.Sbase, Vnew: b.Vbase })
  const tx = changeBase(p.zTx ?? 0.1, { Sold: (p.Stx ?? 150) * 1e6, Vold: b.Vbase, Snew: b.Sbase, Vnew: b.Vbase })
  const load = loadFromPf((p.Pmw ?? 60) * 1e6, p.pf ?? 0.85)
  const pu = { P: load.P / b.Sbase, Q: load.Q / b.Sbase }
  const zip = zipModels(pu)
  const at = zip.power(p.Vpu ?? 0.9)
  // The same impedance seen from either side of the transformer, in ohms and
  // in per unit, which is A2's whole claim.
  const zOhmHigh = (p.zTx ?? 0.1) * b.Zbase
  const zOhmLow = zOhmHigh * (low.Vbase / b.Vbase) ** 2
  return {
    kind: 'base',
    b,
    low,
    gen,
    tx,
    load,
    pu,
    zip,
    at,
    zOhmHigh,
    zOhmLow,
    puFromLow: zOhmLow / low.Zbase,
    puFromHigh: zOhmHigh / b.Zbase,
    // The fault current a wrong base gives: the same reactance read on the
    // device's own rating rather than the system's.
    faultRight: 1 / gen,
    faultWrong: 1 / (p.zGen ?? 0.2),
  }
}

function analysePhase(exp, p) {
  const Vll = (p.Vll ?? 230) * 1e3
  const load = wyeLoad({ R: p.R ?? 100, X: p.X ?? 50, Vll })
  const inst = instantaneousPower(load)
  const v = phaseVoltages(load.Vln)
  const del = deltaLoad({ R: p.Rdelta ?? 300, X: p.Xdelta ?? 0, Vll })
  const abc = [polar(p.Ia ?? 10, rad(p.angA ?? 0)), polar(p.Ib ?? 6, rad(p.angB ?? -150)), polar(p.Ic ?? 8, rad(p.angC ?? 100))]
  const seq = toSequence(abc)
  return {
    kind: 'phase',
    load,
    inst,
    ratio: lineToNeutral(Vll),
    phasors: v,
    delta: del,
    wyeOfDelta: deltaToWye(p.Rdelta ?? 300),
    abc,
    seq,
    sets: sets(abc),
    neutral: neutral(abc),
    unbalance: unbalanceFactor(seq),
  }
}

function analyseLine(exp, p) {
  const km = p.km ?? 100
  const b = bases(BASE)
  const spec = { ...LINE, r: p.lossless ? 0 : LINE.r }
  const pi = nominalPi(spec, km)
  const model = lineModel(spec, km)
  const surge = surgeLoading(spec, b.Vbase)
  const rise = openEndRise({ ...spec, r: 0 }, km)
  const balance = reactiveBalance(spec, km, b.Vbase, (p.loading ?? 1) * surge.sil)
  // The transformer half of the group runs on the two-bus network, so the drop
  // is a solve rather than a formula.
  // The knob is the ratio by which the tap changer raises the receiving bus,
  // and the branch's own ratio is its reciprocal, because the stamp puts the
  // ratio on the sending side.
  const net = twoBus({ x: p.X ?? 0.1, P: p.Pload ?? 0.8, Q: p.Qload ?? 0.6, tap: 1 / (p.tap ?? 1), Bsh: p.Bsh ?? 0 })
  const key = `tx:${p.X ?? 0.1}:${p.Pload ?? 0.8}:${p.Qload ?? 0.6}:${p.tap ?? 1}:${p.Bsh ?? 0}`
  const { sol, refusal } = solveFlow(net, key)
  const Vr = sol ? sol.byId.recv.V : NaN
  const drop = 1 - Vr
  const estimate = ((p.Qload ?? 0.6) * (p.X ?? 0.1)) / 1
  // The tap that puts the receiving bus back at 1.00 pu, and the shunt that
  // does the same job with reactive power instead.
  const tapNeeded = tapForUnity(p)
  const shunt = shuntForUnity(p)
  const lengths = [100, 200, 400, 800].map((L) => openEndRise({ ...LINE, r: 0 }, L))
  return { kind: 'line', km, b, pi, model, surge, rise, balance, lengths, sol, refusal, Vr, drop, estimate, tapNeeded, shunt, spec }
}

/**
 * The tap ratio that holds the receiving bus at 1.00 pu, by bisection.
 * The ratio is not simply one over the untapped voltage, because raising the
 * ratio raises the current through the reactance as well.
 */
function tapForUnity(p) {
  const x = p.X ?? 0.1
  const P = p.Pload ?? 0.8
  const Q = p.Qload ?? 0.6
  const at = (t) => solveFlow(twoBus({ x, P, Q, tap: 1 / t }), `tx:${x}:${P}:${Q}:${1 / t}:0`).sol?.byId.recv.V ?? 0
  let lo = 1
  let hi = 1.6
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    if (at(mid) < 1) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** The shunt susceptance that holds the receiving bus at 1.00 pu, by bisection. */
function shuntForUnity(p) {
  const x = p.X ?? 0.1
  const P = p.Pload ?? 0.8
  const Q = p.Qload ?? 0.6
  const at = (B) => solveFlow(twoBus({ x, P, Q, Bsh: B }), `tx:${x}:${P}:${Q}:1:${B}`).sol?.byId.recv.V ?? 0
  let lo = 0
  let hi = 2
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2
    if (at(mid) < 1) lo = mid
    else hi = mid
  }
  const B = (lo + hi) / 2
  return { B, mvar: B * 100, V: at(B) }
}

function analyseFlow(exp, p) {
  const net = networkOfExperiment(exp, p)
  const key = `${exp.network || 'threeBus'}:${p.load ?? 1}:${p.Qmax ?? 'free'}:${p.V2 ?? 1}`
  const { sol, refusal } = solveFlow(net, key)
  const b = bases(BASE)
  const dc = dcFlow(net)
  const compare = sol ? dcCompare(net, { ac: sol }) : null
  const guard = sol ? dcGuard(sol) : null
  const cost = sol ? memo(`cost:${key}`, () => assumptionCost(net, sol)) : null
  // The nose curve walks the same knob the pane does, so the loading it stops
  // at is the loading the reader can reach. `pvCurve` scales only the load
  // buses, and this lab's loading knob moves the generation with them.
  const nose = exp.claim && exp.claim.nose ? memo(`nose:${p.Qmax ?? 'free'}`, () => noseCurve(p.Qmax ?? Infinity)) : null
  // What a load takes at three assumed voltages, which is D1's measurement of
  // why the problem is nonlinear at all.
  const pq = net.buses.find((b) => b.type === 'pq') || { P: -1.6, Q: -0.8 }
  const guesses = [1, 0.95, 0.9].map((V) => ({ V, I: Math.hypot(pq.P, pq.Q) / V, P: -pq.P, Q: -pq.Q }))
  return { kind: 'flow', net, sol, refusal, b, dc, compare, guard, cost, nose, guesses, key }
}

/** The P–V curve of the three-bus system, to the last loading that has one. */
function noseCurve(Qmax = Infinity) {
  const points = []
  let last = null
  let reason = null
  for (let k = 0; k <= 80; k++) {
    const alpha = 1 + 0.05 * k
    try {
      const s = powerFlow(threeBus({ load: alpha, Qmax }))
      points.push({ alpha, V: s.byId.bus3.V, P: -s.byId.bus3.P })
      last = alpha
    } catch (err) {
      if (!(err instanceof PowerFlowError)) throw err
      reason = err.message
      break
    }
  }
  return { points, lastSolved: last, reason, nose: points[points.length - 1] }
}

function analyseSeq(exp, p) {
  const abc = [polar(p.Ia ?? 10, rad(p.angA ?? 0)), polar(p.Ib ?? 6, rad(p.angB ?? -150)), polar(p.Ic ?? 8, rad(p.angC ?? 100))]
  const seq = toSequence(abc)
  const spec = faultSpec(p)
  const z = sequenceImpedances(spec)
  const zWye = sequenceImpedances({ ...spec, transformer: { ...spec.transformer, connection: 'wyeg-wyeg' } })
  const zNeutral = sequenceImpedances({
    ...spec,
    generator: { ...spec.generator, Zn: 0.1 },
    transformer: { ...spec.transformer, connection: 'wyeg-wyeg' },
  })
  // The same network with the star point solidly earthed, so the factor of
  // three a grounding impedance carries is a difference and not a constant.
  const zSolid = sequenceImpedances({ ...spec, generator: { ...spec.generator, Zn: 0 } })
  return {
    kind: 'seq',
    abc,
    seq,
    sets: sets(abc),
    neutral: neutral(abc),
    unbalance: unbalanceFactor(seq),
    rebuilt: toPhase(seq),
    z,
    zWye,
    zNeutral,
    zSolid,
    spec,
  }
}

/** The fault network at the knobs, with the winding connection as a choice. */
function faultSpec(p) {
  return {
    generator: { X1: p.Xg ?? 0.15, X2: p.Xg ?? 0.15, X0: p.Xg0 ?? 0.05, Zn: p.Zn ?? 0 },
    transformer: { X: p.Xt ?? 0.1, connection: p.connection ?? 'delta-wyeg' },
    line: { X1: p.Xl ?? 0.2, X2: p.Xl ?? 0.2, X0: p.Xl0 ?? 0.6 },
    prefault: p.E ?? 1,
  }
}

function analyseFault(exp, p) {
  const spec = faultSpec(p)
  const b = bases(BASE)
  const kind = p.fault ?? exp.fault ?? '3ph'
  const study = faultStudy(spec, { kind, Zf: p.Zf ?? 0 })
  const table = faultTable(spec, { Zf: p.Zf ?? 0 })
  const cross = memo(`cross:${p.Xg ?? 0.15}:${p.Xt ?? 0.1}:${p.Xl ?? 0.2}`, () => crossoverRatio(spec))
  return {
    kind: 'fault',
    spec,
    b,
    study,
    table,
    z: sequenceImpedances(spec),
    cross,
    amps: (pu) => pu * b.Ibase,
  }
}

function analyseRelay(exp, p) {
  const setting = { pickup: p.pickup ?? 400, tds: p.tds ?? 0.1, curve: p.curve ?? 'veryInverse' }
  const I = p.Ifault ?? 1600
  const down = iecTime(setting, I)
  const up = coordinate({ pickup: setting.pickup, curve: setting.curve }, I, down, p.margin ?? 0.3)
  const zones = distanceZones({ Zline: p.Zline ?? 40 })
  const z = apparentZ({ ohmPerKm: p.ohmPerKm ?? 0.4, km: p.faultKm ?? 60, tapKm: p.tapKm ?? null, infeed: p.infeed ?? 0 })
  const zNo = apparentZ({ ohmPerKm: p.ohmPerKm ?? 0.4, km: p.faultKm ?? 60 })
  return {
    kind: 'relay',
    setting,
    I,
    down,
    up,
    curve: curvePoints(setting),
    curveUp: curvePoints({ ...setting, tds: up.tds }),
    zones,
    z,
    zNo,
    zone: zoneOf(zones, z.Z),
    zoneNo: zoneOf(zones, zNo.Z),
    threshold: z.infeedForReach(zones.zone1),
    times: [800, 1600, 4000].map((amp) => ({ I: amp, t: iecTime(setting, amp) })),
  }
}

function analyseSwing(exp, p) {
  const machine = { ...MACHINE, H: p.H ?? 4, Pm: p.Pm ?? 1 }
  const key = `sw:${machine.H}:${machine.Pm}:${p.pre ?? 2}:${p.during ?? 0.5}:${p.post ?? 1.5}`
  const st = memo(key, () => stability(machine, { pre: p.pre ?? 2, during: p.during ?? 0.5, post: p.post ?? 1.5 }))
  const tc = p.tc ?? 0.15
  const run = memo(`${key}:${tc}:${p.step ?? 0}`, () => st.clearAt(tc, p.step ? { step: p.step } : {}))
  const closed = memo(`${key}:closed`, () => st.closedFormTime())
  const transfer = (delta) => (p.pre ?? 2) * Math.sin(delta)
  return { kind: 'swing', machine, st, tc, run, closed, curves: st.curves(181), transfer }
}

/** The angle at which the transfer before the fault is largest, from the curve. */
function peakOf(curves) {
  let best = 0
  curves.pre.forEach((v, k) => {
    if (v > curves.pre[best]) best = k
  })
  return deg(curves.delta[best])
}

function analyseDispatch(exp, p) {
  const units = DISPATCH_UNITS.map((u) => (u.id === 'unit1' ? { ...u, max: p.cap1 ?? u.max } : u))
  const demand = p.demand ?? 800
  const d = dispatch(units, demand)
  return {
    kind: 'dispatch',
    units,
    demand,
    d,
    marginal: marginalCost(units, demand),
    curves: costCurves(units),
    equal: units.map((u) => ({ id: u.id, P: demand / units.length })),
  }
}

const ANALYSES = {
  base: analyseBase,
  phase: analysePhase,
  line: analyseLine,
  flow: analyseFlow,
  seq: analyseSeq,
  fault: analyseFault,
  relay: analyseRelay,
  swing: analyseSwing,
  dispatch: analyseDispatch,
}

/** The one analysis this experiment needs, at these knobs. */
export function analyse(exp, p) {
  const make = ANALYSES[exp.kind]
  if (!make) throw new Error(`no analysis for kind "${exp.kind}"`)
  const x = make(exp, p)
  x.exp = exp
  x.p = p
  return x
}

// ------------------------------------------------------------ the paths

/** The last Newton pass, which is the one that carries the regions in force. */
const last = (sol) => sol.iters[sol.iters.length - 1]

/** A branch or bus by id, from a solved flow. */
const busOf = (x, id) => (x.sol ? x.sol.byId[id] : null)
const branchOf = (x, id) => (x.sol ? x.sol.flows.find((f) => f.id === id) : null)

/**
 * The value a lesson names by path. A path this does not know is an error
 * rather than an undefined, so a note cannot quote a number nothing measures.
 */
export function readQuantity(x, p, path, exp) {
  const [head, ...rest] = path.split('.')
  const value = resolve(x, p, head, rest, exp)
  if (value === undefined) throw new Error(`unknown quantity path "${path}"`)
  return value
}

function resolve(x, p, head, rest, exp) {
  switch (head) {
    case 'base': {
      const b = x.b || x.base || bases(BASE)
      if (rest[0] === 'low') return x.low ? x.low[rest[1]] : undefined
      if (rest[0] === 'genPu') return x.gen
      if (rest[0] === 'txPu') return x.tx
      if (rest[0] === 'Qload') return x.load ? x.load.Q : undefined
      if (rest[0] === 'Ppu') return x.pu ? x.pu.P : undefined
      if (rest[0] === 'Qpu') return x.pu ? x.pu.Q : undefined
      if (rest[0] === 'Zconstant') return x.zip ? x.zip.Zmag : undefined
      if (rest[0] === 'Pat') return x.at ? x.at.constantImpedance.P : undefined
      if (rest[0] === 'Pconstant') return x.at ? x.at.constantPower.P : undefined
      if (rest[0] === 'MVA') return x.b.Sbase / 1e6
      if (rest[0] === 'kV') return x.b.Vbase / 1e3
      if (rest[0] === 'puFromLow') return x.puFromLow
      if (rest[0] === 'puFromHigh') return x.puFromHigh
      if (rest[0] === 'faultRight') return x.faultRight
      if (rest[0] === 'faultWrong') return x.faultWrong
      return b[rest[0]]
    }
    case 'phase': {
      if (!x.load) return undefined
      const map = {
        I: x.load.I,
        P: x.load.P,
        Q: x.load.Q,
        pf: x.load.pf,
        Vln: x.load.Vln,
        Vll: x.load.Vll,
        Pline: x.load.Pline,
        Pphase: x.load.Pphase,
        ratio: x.ratio ? x.ratio.ratio : undefined,
        sum: x.phasors ? x.phasors.sumMag : undefined,
        ripple: x.inst ? Math.abs(x.inst.rippleThree) : undefined,
        min: x.inst ? x.inst.min : undefined,
        max: x.inst ? x.inst.max : undefined,
        mean: x.inst ? x.inst.mean : undefined,
        onePhaseRipple: x.inst ? x.inst.ripple : undefined,
        wye: x.wyeOfDelta,
        Iphase: x.delta ? x.delta.Iphase : undefined,
        Iline: x.delta ? x.delta.Iline : undefined,
        deltaP: x.delta ? x.delta.P : undefined,
        sameLine: x.delta ? x.delta.sameLineCurrent : undefined,
      }
      return map[rest[0]]
    }
    case 'seq': {
      const s = x.seq
      if (!s) return undefined
      if (rest[0] === 'neutral') return x.neutral.mag
      if (rest[0] === 'unbalance') return x.unbalance
      if (rest[0] === 'rebuild') return rebuildError(x)
      const index = { zero: 0, positive: 1, negative: 2 }[rest[0]]
      if (index === undefined) return undefined
      if (rest[1] === 'mag') return s.mag[index]
      if (rest[1] === 'ang') return deg(s.ang[index])
      return undefined
    }
    case 'z': {
      const z = x.z
      if (!z) return undefined
      if (rest[0] === 'wye0') return x.zWye ? x.zWye.Z0[1] : undefined
      if (rest[0] === 'neutral0') return x.zNeutral ? x.zNeutral.Z0[1] : undefined
      if (rest[0] === 'solid0') return x.zSolid ? x.zSolid.Z0[1] : undefined
      return z[rest[0]] ? z[rest[0]][1] : undefined
    }
    case 'bus': {
      const b = busOf(x, rest[0])
      if (!b) return undefined
      if (rest[1] === 'rows') return last(x.sol).rows.filter((r) => r.bus === rest[0]).length
      if (rest[1] === 'deg') return b.thetaDeg
      if (rest[1] === 'kV') return b.V * x.b.Vbase
      if (rest[1] === 'kA') return undefined
      return b[rest[1]]
    }
    case 'branch': {
      const f = branchOf(x, rest[0])
      if (!f) return undefined
      if (rest[1] === 'angle') return deg(f.angle)
      if (rest[1] === 'MW') return f.Pf * 100
      if (rest[1] === 'I') return f.Imag
      if (rest[1] === 'loss') return f.Ploss
      return f[rest[1]]
    }
    case 'flow': {
      if (!x.sol) return undefined
      if (rest[0] === 'loss') return x.sol.Ploss
      if (rest[0] === 'lossMW') return x.sol.Ploss * 100
      if (rest[0] === 'slackP') return x.sol.slack.P
      if (rest[0] === 'slackQ') return x.sol.slack.Q
      if (rest[0] === 'iterations') return x.sol.iterations
      if (rest[0] === 'mismatch') return x.sol.mismatches[+rest[1]]
      if (rest[0] === 'conversion') return x.sol.conversions.length ? x.sol.conversions[0].iteration : undefined
      if (rest[0] === 'branchLoss') return lossAudit(x.net, x.sol.Vc).branchLoss[0]
      if (rest[0] === 'auditGap') return Math.abs(lossAudit(x.net, x.sol.Vc).injected[0] - lossAudit(x.net, x.sol.Vc).branchLoss[0])
      if (rest[0] === 'guessI') return x.guesses[+rest[1]] ? x.guesses[+rest[1]].I : undefined
      if (rest[0] === 'guessV') return x.guesses[+rest[1]] ? x.guesses[+rest[1]].V : undefined
      if (rest[0] === 'loadP') return x.guesses[0].P
      if (rest[0] === 'loadQ') return x.guesses[0].Q
      if (rest[0] === 'genP') return x.net.buses.filter((b) => b.type === 'pv').reduce((s2, b) => s2 + b.P, 0)
      if (rest[0] === 'equations') return last(x.sol).rows.length
      if (rest[0] === 'unknowns') return last(x.sol).J.length ? last(x.sol).J[0].length : 0
      if (rest[0] === 'lastLoading') return x.nose ? x.nose.lastSolved : undefined
      if (rest[0] === 'noseV') return x.nose ? x.nose.nose.V : undefined
      return undefined
    }
    case 'dc': {
      if (!x.dc) return undefined
      if (rest[0] === 'theta') {
        const k = x.net.buses.findIndex((b) => b.id === rest[1])
        return k < 0 ? undefined : deg(x.dc.theta[k])
      }
      if (rest[0] === 'flow') {
        const f = x.dc.flows.find((r) => r.id === rest[1])
        return f ? f.Pf : undefined
      }
      if (rest[0] === 'flowError') {
        const r = x.compare.branches.find((b) => b.id === rest[1])
        return r ? 100 * r.error : undefined
      }
      if (rest[0] === 'angleError') return deg(x.compare.maxAngleError)
      if (rest[0] === 'maxFlowError') return 100 * x.compare.maxError
      if (rest[0] === 'maxAngle') return deg(x.guard.maxAngle)
      if (rest[0] === 'minV') return x.guard.minV
      if (rest[0] === 'rx') return x.guard.rx
      if (rest[0] === 'warnDeg') return DC_WARN_DEG
      if (rest[0] === 'refuseDeg') return DC_REFUSE_DEG
      if (rest[0] === 'bandLow') return DC_V_BAND[0]
      if (rest[0] === 'bandHigh') return DC_V_BAND[1]
      if (rest[0] === 'rxLimit') return DC_RX_LIMIT
      if (rest[0] === 'smallAngle') return x.cost ? 100 * x.cost.smallAngleError : undefined
      if (rest[0] === 'sinTheta') return x.cost ? x.cost.sinTheta : undefined
      if (rest[0] === 'thetaRad') return x.cost ? x.cost.maxAngle : undefined
      if (rest[0] === 'losslessError') return x.cost ? 100 * x.cost.withoutResistance : undefined
      return undefined
    }
    case 'fault': {
      const s = x.study
      if (!s) return undefined
      if (rest[0] === 'seq') {
        const index = { zero: 0, positive: 1, negative: 2 }[rest[1]]
        return index === undefined ? undefined : s.seqMag[index]
      }
      if (rest[0] === 'phaseA') return s.phaseMag[0]
      if (rest[0] === 'phaseB') return s.phaseMag[1]
      if (rest[0] === 'phaseC') return s.phaseMag[2]
      if (rest[0] === 'ground') return s.groundMag
      if (rest[0] === 'level') return s.seqMag[1] * 100
      if (rest[0] === 'amps') return x.amps(s.phaseMag[0])
      if (rest[0] === 'ampsB') return x.amps(s.phaseMag[1])
      if (rest[0] === 'groundAmps') return x.amps(s.groundMag)
      if (rest[0] === 'crossover') return x.cross.ratio
      if (rest[0] === 'of') {
        const row = x.table.find((f) => f.kind === rest[1])
        if (!row) return undefined
        return rest[2] === 'ground' ? row.groundMag : Math.max(...row.phaseMag)
      }
      return undefined
    }
    case 'relay': {
      if (rest[0] === 'time') return x.down
      if (rest[0] === 'at') {
        const row = x.times.find((r) => r.I === +rest[1])
        return row ? row.t : undefined
      }
      if (rest[0] === 'current') {
        const row = x.times.find((r) => r.I === +rest[1])
        return row ? row.I : undefined
      }
      if (rest[0] === 'upstream') return x.up.time
      if (rest[0] === 'tds') return x.up.tds
      if (rest[0] === 'margin') return x.up.time - x.down
      if (rest[0] === 'reach1') return x.zones.zone1
      if (rest[0] === 'reach2') return x.zones.zone2
      if (rest[0] === 'Z') return x.z.Z
      if (rest[0] === 'Zno') return x.zNo.Z
      if (rest[0] === 'zone') return x.zone.zone
      if (rest[0] === 'zoneNo') return x.zoneNo.zone
      if (rest[0] === 'threshold') return x.threshold
      if (rest[0] === 'wait') return x.zone.time
      return undefined
    }
    case 'swing': {
      const st = x.st
      if (!st) return undefined
      const map = {
        M: st.M,
        delta0: deg(st.delta0),
        deltaMax: deg(st.deltaMax),
        deltaCr: deg(st.deltaCr),
        areaAccel: st.areaAccel,
        areaDecel: st.areaDecel,
        areaError: st.areaError,
        tcr: st.tcr,
        cycles: st.cycles,
        fn: st.fnPost,
        period: st.periodPost,
        K: st.Kpost,
        closed: x.closed.tcr,
        closedAngle: deg(x.closed.deltaCr),
        peak: x.run.stable ? deg(x.run.peak) : NaN,
        peakExact: x.run.stable ? deg(x.run.peakExact) : NaN,
        peakGap: x.run.stable ? Math.abs(deg(x.run.peak) - deg(x.run.peakExact)) : NaN,
        step: x.run.step,
        firstTry: x.run.tries ? x.run.tries[0].error : NaN,
        transfer: x.transfer(rad(p.deltaProbe ?? 90)),
        f: x.machine.f,
        peakAngle: peakOf(x.curves),
      }
      return map[rest[0]]
    }
    case 'dispatch': {
      if (rest[0] === 'lambda') return x.d.lambda
      if (rest[0] === 'cost') return x.d.cost
      if (rest[0] === 'equalCost') return x.d.equalCost
      if (rest[0] === 'saving') return x.d.saving
      if (rest[0] === 'marginal') return x.marginal
      if (rest[0] === 'unit') {
        const u = x.d.units.find((r) => r.id === rest[1])
        return u ? (rest[2] === 'incremental' ? u.incremental : u.P) : undefined
      }
      return undefined
    }
    case 'line': {
      if (rest[0] === 'Zc') return x.surge.Zc
      if (rest[0] === 'sil') return x.surge.sil
      if (rest[0] === 'silMW') return x.surge.sil / 1e6
      if (rest[0] === 'R') return x.pi.Z[0]
      if (rest[0] === 'X') return x.pi.Z[1]
      if (rest[0] === 'Rpu') return x.pi.Z[0] / x.b.Zbase
      if (rest[0] === 'Xpu') return x.pi.Z[1] / x.b.Zbase
      if (rest[0] === 'charging') return x.pi.Y[1] * x.b.Zbase
      if (rest[0] === 'chargingA') return x.pi.Y[1] * (x.b.Vbase / Math.sqrt(3))
      if (rest[0] === 'exact') return x.rise.exact
      if (rest[0] === 'nominal') return x.rise.nominal
      if (rest[0] === 'error') return 100 * Math.abs(x.rise.error)
      if (rest[0] === 'at') {
        const row = x.lengths.find((r) => r.km === +rest[1])
        if (!row) return undefined
        return rest[2] === 'error' ? 100 * Math.abs(row.error) : rest[2] === 'nominal' ? row.nominal : row.exact
      }
      if (rest[0] === 'absorbed') return x.balance.absorbed / 1e6
      if (rest[0] === 'produced') return x.balance.produced / 1e6
      if (rest[0] === 'net') return x.balance.net / 1e6
      if (rest[0] === 'long') return x.model.long ? 1 : 0
      if (rest[0] === 'guardKm') return LONG_LINE_KM
      if (rest[0] === 'kmOf') return x.lengths.find((r) => r.km === +rest[1]) ? +rest[1] : undefined
      return undefined
    }
    case 'tx': {
      if (rest[0] === 'V') return x.Vr
      if (rest[0] === 'drop') return x.drop
      if (rest[0] === 'estimate') return x.estimate
      if (rest[0] === 'estimateError') return Math.abs(x.estimate - x.drop)
      if (rest[0] === 'tap') return x.tapNeeded
      if (rest[0] === 'mvar') return x.shunt.mvar
      if (rest[0] === 'shuntV') return x.shunt.V
      return undefined
    }
    default:
      return undefined
  }
}

/** The largest error in rebuilding the phase currents from the sequence ones. */
function rebuildError(x) {
  return x.abc.reduce((m, z, k) => Math.max(m, cabs([z[0] - x.rebuilt.abc[k][0], z[1] - x.rebuilt.abc[k][1]])), 0)
}

export { deg, rad, polar, cabs, carg }
