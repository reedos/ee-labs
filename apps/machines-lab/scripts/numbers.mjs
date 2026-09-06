// Every number the plan and the lessons quote, printed from the engine.
//
//   npm run numbers --workspace apps/machines-lab
//
// Run it before writing a lesson, and again after changing a default. A figure
// in `MACHINES_LAB_PLAN.md` §4.3 or §5, or in a `see` or a `try` line, that
// this script does not print is a figure nobody computed.
//
// The output is a table per experiment: the experiment's own analysis at its
// defaults, read through the same quantity paths the lessons use.

import { EXPERIMENTS } from '../src/experiments.js'
import { analyse, defaultsOf } from '../src/analysis.js'
import { readQuantity } from '../src/quantities.js'

/** The paths worth printing for each kind, in the order a lesson reads them. */
const PATHS = {
  dc: [
    'line.stall',
    'line.noLoad',
    'line.noLoadRpm',
    'line.slope',
    'line.free',
    'op.omega',
    'op.rpm',
    'op.ia',
    'op.torque',
    'op.emf',
    'op.pIn',
    'op.pCu',
    'op.pFriction',
    'op.pShaft',
    'op.efficiency',
    'mech.ra',
    'tau.e',
    'tau.m',
    'tau.separated',
    'root.0',
    'root.1',
  ],
  transformer: [
    'xf.vp',
    'xf.vs',
    'xf.vOut',
    'xf.vNoLoad',
    'xf.iLoad',
    'xf.iPrim',
    'xf.pOut',
    'xf.pCu',
    'xf.pCore',
    'xf.pIn',
    'xf.efficiency',
    'xf.regulation',
    'xf.bestX',
    'xf.Req',
    'xf.Xeq',
    'xf.reflectedZL',
    'xf.Zoc',
    'xf.Ioc',
    'xf.Poc',
    'xf.Zsc',
  ],
  im: [
    'im.rpmSync',
    'im.slip',
    'im.rpm',
    'im.rotorHz',
    'im.torque',
    'im.I1',
    'im.I2',
    'im.pGap',
    'im.pRotorCu',
    'im.pMech',
    'im.sMax',
    'im.tMax',
    'im.rpmMax',
    'im.tStart',
    'im.iStart',
    'im.Vth',
    'im.Rth',
    'im.Xth',
  ],
  field: ['field.amplitude', 'field.rpmSync', 'field.omegaSync', 'field.peak'],
  sync: [
    'sync.delta',
    'sync.P',
    'sync.field',
    'sync.reluctance',
    'sync.torque',
    'sync.I',
    'sync.Q',
    'sync.pf',
    'sync.pullOut',
    'sync.pullOutDeg',
    'sync.margin',
    'sync.rpmSync',
  ],
  dq: ['dq.d', 'dq.q', 'dq.zero', 'dq.radius', 'dq.otherRadius', 'dq.pAbc', 'dq.pDq'],
  pmsm: ['pmsm.kT', 'pmsm.tauElec', 'pmsm.tauMech', 'pmsm.separation', 'pmsm.torque', 'pmsm.gainI', 'pmsm.gainW'],
  losses: [
    'loss.pOut',
    'loss.pCu',
    'loss.pCore',
    'loss.pFriction',
    'loss.pStray',
    'loss.total',
    'loss.pIn',
    'loss.efficiency',
    'loss.bestX',
    'loss.bestEff',
    'heat.rise',
    'heat.final',
    'heat.tau',
    'heat.tauMin',
    'heat.headroom',
    'heat.limitLoss',
    'heat.overload',
    'heat.timeTo100',
  ],
  sat: ['sat.lambda', 'sat.L', 'sat.iKnee', 'sat.linear'],
}

const EXTRA = {
  a1: ['A.0.0', 'A.0.1', 'A.1.0', 'A.1.1'],
  a3: ['audit.gap', 'audit.coupled', 'audit.supplied'],
  a5: ['mech.peak', 'mech.peakAt'],
  a6: ['mech.stored'],
  a7: [0, 1, 2].flatMap((k) => [`control.armature.${k}.noLoadRpm`, `control.armature.${k}.rpm`, `control.armature.${k}.slope`]),
  a8: [0, 1, 2].flatMap((k) => [`control.field.${k}.noLoadRpm`, `control.field.${k}.stall`, `control.field.${k}.ia`]),
  c6: ['im.settled', 'im.error'],
  d3: [0, 1, 2, 3].flatMap((k) => [`vcurve.${k}.Imag`, `vcurve.${k}.pf`, `vcurve.${k}.Q`]),
  d6: ['pmsm.A.0.1', 'pmsm.A.1.0', 'pmsm.c.1'],
}

const fmt = (v) =>
  typeof v !== 'number' ? String(v) : Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(5) : v.toPrecision(7)

let printed = 0
for (const exp of EXPERIMENTS) {
  const x = analyse(exp, defaultsOf(exp))
  console.log(`\n${exp.id.toUpperCase()} · ${exp.name}  [${exp.kind}]`)
  for (const path of [...(PATHS[exp.kind] || []), ...(EXTRA[exp.id] || [])]) {
    let value
    try {
      value = readQuantity(x, path)
    } catch (err) {
      value = `— ${err.message}`
    }
    console.log(`  ${path.padEnd(30)} ${fmt(value)}`)
    printed++
  }
  if (x.runUp) console.log(`  ${'runUp.says'.padEnd(30)} ${x.runUp.says}`)
  if (x.label) console.log(`  ${'saturation.label'.padEnd(30)} ${x.label}`)
}
console.log(`\n${printed} quantities over ${EXPERIMENTS.length} experiments.`)
