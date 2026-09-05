// Every number GRID_LAB_PLAN.md quotes, computed from the engine.
//
//   node packages/grid/scripts/numbers.mjs
//
// The plan's rule is that a quoted number is computed by a script before it is
// written. This is that script, and it is the one place the figures in the
// plan, the lessons and the tests all come from.

import { bases, changeBase, loadFromPf, zipModels } from '../src/perUnit.js'
import { lineConstants, nominalPi, openEndRise, reactiveBalance, surgeLoading } from '../src/line.js'
import { threeBus, twoBus, FAULT_NETWORK, DISPATCH_UNITS, MACHINE } from '../src/library.js'
import { powerFlow, jacobianCheck, pvCurve } from '../src/powerFlow.js'
import { ybus } from '../src/network.js'
import { dcFlow, dcGuard, dcCompare } from '../src/dcFlow.js'
import { toSequence, toPhase, unbalanceFactor } from '../src/sequence.js'
import { faultStudy, sequenceImpedances } from '../src/faults.js'
import { iecTime, distanceZones, apparentZ, coordinate } from '../src/relay.js'
import { dispatch, marginalCost } from '../src/dispatch.js'
import { stability } from '../src/swing.js'
import { wyeLoad, deltaToWye, instantaneousPower } from '../src/threePhase.js'
import { deg } from '../src/cx.js'

const p = (...a) => console.log(...a)
const f = (x, n = 6) => (typeof x === 'number' ? +x.toPrecision(n) : x)

p('--- A · bases')
const b = bases({ Sbase: 100e6, Vbase: 230e3 })
p('Zbase', f(b.Zbase), 'Ibase', f(b.Ibase), 'VLN', f(b.VbaseLN))
const b13 = bases({ Sbase: 100e6, Vbase: 13.8e3 })
p('13.8 kV: Zbase', f(b13.Zbase), 'Ibase', f(b13.Ibase))
p('gen 0.20 on 90 MVA ->', f(changeBase(0.2, { Sold: 90e6, Vold: 230e3, Snew: 100e6, Vnew: 230e3 })))
p('tx 0.10 on 150 MVA ->', f(changeBase(0.1, { Sold: 150e6, Vold: 230e3, Snew: 100e6, Vnew: 230e3 })))
const ld = loadFromPf(60e6, 0.85)
p('60 MW at 0.85 ->', f(ld.Q / 1e6), 'Mvar, pu', f(ld.P / 100e6), f(ld.Q / 100e6))
const zip = zipModels({ P: 0.6, Q: ld.Q / 100e6 })
p('as constant impedance |Z| =', f(zip.Zmag), 'at 0.90 pu P =', f(zip.power(0.9).constantImpedance.P))

p('--- B · three phase')
const wye = wyeLoad({ R: 100, X: 50, Vll: 230e3 })
p('I', f(wye.I), 'P3', f(wye.P / 1e6), 'Q3', f(wye.Q / 1e6), 'pf', f(wye.pf))
const ip = instantaneousPower(wye)
p('three-phase ripple', f(ip.rippleThree, 3), 'one phase', f(ip.min / 1e6), 'to', f(ip.max / 1e6), 'MW')
p('delta 300 -> wye', f(deltaToWye(300)))
const seq = toSequence([
  [10, 0],
  [6 * Math.cos((-150 * Math.PI) / 180), 6 * Math.sin((-150 * Math.PI) / 180)],
  [8 * Math.cos((100 * Math.PI) / 180), 8 * Math.sin((100 * Math.PI) / 180)],
])
p('I0', f(seq.mag[0]), f(deg(seq.ang[0])), 'I1', f(seq.mag[1]), f(deg(seq.ang[1])), 'I2', f(seq.mag[2]), f(deg(seq.ang[2])))
p('neutral 3I0', f(3 * seq.mag[0]), 'unbalance', f(100 * unbalanceFactor(seq)))

p('--- C · the line')
const lc = lineConstants()
p('Zc', f(lc.Zc), 'SIL', f(surgeLoading({}, 230e3).sil / 1e6), 'MW')
const pi100 = nominalPi({}, 100)
p('100 km Z', f(pi100.Z[0]), f(pi100.Z[1]), 'pu', f(pi100.Z[0] / b.Zbase), f(pi100.Z[1] / b.Zbase), 'B', f(pi100.Y[1] * b.Zbase))
for (const km of [100, 200, 400, 800]) {
  const r = openEndRise({ r: 0 }, km)
  p(`open end ${km} km exact ${f(r.exact)} nominal ${f(r.nominal)} error ${f(100 * r.error, 4)} %`)
}
const half = reactiveBalance({}, 200, 230e3, surgeLoading({}, 230e3).sil / 2)
p('at half SIL net Q', f(half.net / 1e6), 'Mvar')

p('--- D · power flow')
const net = threeBus()
const Y = ybus(net)
p('Y11', f(Y[0][0][0]), f(Y[0][0][1]), 'Y12', f(Y[0][1][0]), f(Y[0][1][1]), 'Y13', f(Y[0][2][0]), f(Y[0][2][1]))
p('Y22', f(Y[1][1][0]), f(Y[1][1][1]), 'Y23', f(Y[1][2][0]), f(Y[1][2][1]), 'Y33', f(Y[2][2][0]), f(Y[2][2][1]))
const sol = powerFlow(net)
p('V2', f(sol.byId.bus2.V), f(sol.byId.bus2.thetaDeg), 'V3', f(sol.byId.bus3.V), f(sol.byId.bus3.thetaDeg))
p('slack', f(sol.slack.P), f(sol.slack.Q), 'bus2 Q', f(sol.byId.bus2.Q), 'loss', f(sol.Ploss))
p('iterations', sol.iterations, 'mismatches', sol.mismatches.map((m) => f(m, 4)))
p('J0', sol.iters[0].J.map((r) => r.map((v) => f(v, 6))))
p('flows', sol.flows.map((fl) => `${fl.id} ${f(fl.Pf)} ${f(fl.Qf)}`))
p('jacobian vs finite difference', f(jacobianCheck(net), 3))

p('--- E · the DC flow')
const dc = dcFlow(net)
p('theta', dc.theta.map((t) => f(deg(t), 6)))
const cmp = dcCompare(net)
p('flow errors %', cmp.branches.map((r) => f(100 * r.error, 4)))
for (const alpha of [0.5, 1, 1.5, 2, 2.5]) {
  const nl = threeBus({ load: alpha })
  const s = powerFlow(nl)
  const c = dcCompare(nl)
  const g = dcGuard(s)
  p(
    `loading ${alpha} maxAngle ${f(deg(g.maxAngle), 4)} minV ${f(g.minV, 5)} maxAngleErr ${f(deg(c.maxAngleError), 4)} maxFlowErr ${f(100 * c.maxError, 4)} % warn ${g.warn} refuse ${g.refuse}`,
  )
}
const nose = pvCurve(threeBus(), 'bus3', { from: 1, to: 3, steps: 40 })
p('last loading with a solution', f(nose.lastSolved), 'V there', f(nose.nose.V))

p('--- F, G · sequence and faults')
const z = sequenceImpedances(FAULT_NETWORK)
p('Z1', f(z.Z1[1]), 'Z2', f(z.Z2[1]), 'Z0', f(z.Z0[1]))
p('Yg-Yg Z0', f(sequenceImpedances({ ...FAULT_NETWORK, transformer: { X: 0.1, connection: 'wyeg-wyeg' } }).Z0[1]))
p(
  'Yg-Yg with Zn 0.1 Z0',
  f(sequenceImpedances({ ...FAULT_NETWORK, generator: { ...FAULT_NETWORK.generator, Zn: 0.1 }, transformer: { X: 0.1, connection: 'wyeg-wyeg' } }).Z0[1]),
)
for (const kind of ['3ph', 'slg', 'll', 'dlg']) {
  const s = faultStudy(FAULT_NETWORK, { kind })
  p(kind, 'phases', s.phaseMag.map((v) => f(v)), 'ground', f(s.groundMag), 'seq', s.seqMag.map((v) => f(v)), 'A', f(s.phaseMag[0] * b.Ibase), f(s.groundMag * b.Ibase))
}
p('3ph MVA', f((1 / 0.45) * 100))

p('--- H · protection')
for (const I of [800, 1600, 4000]) p(`IEC very inverse at ${I} A`, f(iecTime({ pickup: 400, tds: 0.1, curve: 'veryInverse' }, I)))
p('coordination TDS', f(coordinate({ pickup: 400, curve: 'veryInverse' }, 1600, 0.45, 0.3).tds), 'time', f(coordinate({ pickup: 400, curve: 'veryInverse' }, 1600, 0.45, 0.3).time))
const zones = distanceZones({ Zline: 40 })
p('zones', f(zones.zone1), f(zones.zone2))
p('60 km', f(apparentZ({ ohmPerKm: 0.4, km: 60 }).Z), 'with tap 30 km and infeed 1.0', f(apparentZ({ ohmPerKm: 0.4, km: 60, tapKm: 30, infeed: 1 }).Z))
p('infeed at which zone 1 stops reaching', f(apparentZ({ ohmPerKm: 0.4, km: 60, tapKm: 30 }).infeedForReach(zones.zone1)))

p('--- I · stability')
const st = stability(MACHINE, { pre: 2, during: 0.5, post: 1.5 })
p('delta0', f(deg(st.delta0)), 'deltaMax', f(deg(st.deltaMax)), 'deltaCr', f(deg(st.deltaCr), 7))
p('areas', f(st.areaAccel, 9), f(st.areaDecel, 9), 'diff', st.areaAccel - st.areaDecel)
p('M', f(st.M), 'fn after', f(st.fnPost), 'period', f(st.periodPost))
p('tcr', f(st.tcr, 7), 'cycles', f(st.tcr * 60, 6))
p('tcr to zero transfer', f(stability(MACHINE, { pre: 2, during: 0, post: 1.5 }).tcr, 7))
for (const tc of [0.05, 0.1, 0.15, 0.2, 0.25]) {
  const sw = st.clearAt(tc)
  p(`clear ${tc}s peak ${sw.stable ? f(deg(sw.peak)) : 'no turn back'} closed form ${sw.stable ? f(deg(sw.peakExact)) : '-'} step ${sw.step}`)
}
p('1 ms step at 0.15 s', f(deg(st.clearAt(0.15, { step: 1e-3, guard: false }).peak)))
p('synchronising coefficient after', f(st.Kpost))

p('--- J · dispatch')
const d = dispatch(DISPATCH_UNITS, 800)
p('lambda', f(d.lambda), 'outputs', d.units.map((u) => f(u.P)), 'cost', f(d.cost, 8))
p('equal shares cost', f(d.equalCost, 8), 'saving', f(d.saving, 6))
p('marginal', f(marginalCost(DISPATCH_UNITS, 800), 8))
const pinned = dispatch(DISPATCH_UNITS.map((u) => (u.id === 'unit1' ? { ...u, max: 300 } : u)), 800)
p('with unit 1 capped at 300: lambda', f(pinned.lambda), 'outputs', pinned.units.map((u) => f(u.P)))
