// Every quantity path an experiment can read, at its defaults and at a few
// knob moves. This is where the numbers in `lessons/` come from.
//
//   node apps/grid-lab/scripts/readings.mjs [id]

import { analyse, readQuantity } from '../src/analysis.js'
import { GROUP_A } from '../src/groups/a.js'
import { GROUP_B } from '../src/groups/b.js'
import { GROUP_C } from '../src/groups/c.js'
import { GROUP_D } from '../src/groups/d.js'
import { GROUP_E } from '../src/groups/e.js'
import { GROUP_F } from '../src/groups/f.js'
import { GROUP_G } from '../src/groups/g.js'
import { GROUP_H } from '../src/groups/h.js'
import { GROUP_I } from '../src/groups/i.js'
import { GROUP_J } from '../src/groups/j.js'

// The lessons are what this script exists to write, so it reads the groups
// directly rather than through experiments.js, which merges the two.
const EXPERIMENTS = [...GROUP_A, ...GROUP_B, ...GROUP_C, ...GROUP_D, ...GROUP_E, ...GROUP_F, ...GROUP_G, ...GROUP_H, ...GROUP_I, ...GROUP_J]
const defaultsOf = (e) => Object.fromEntries(e.params.map((k) => [k.key, k.default]))

const PATHS = {
  base: [
    'base.Zbase',
    'base.Ibase',
    'base.VbaseLN',
    'base.low.Zbase',
    'base.low.Ibase',
    'base.genPu',
    'base.txPu',
    'base.Qload',
    'base.Ppu',
    'base.Qpu',
    'base.Zconstant',
    'base.Pat',
    'base.Pconstant',
    'base.puFromLow',
    'base.puFromHigh',
    'base.faultRight',
    'base.faultWrong',
  ],
  phase: [
    'phase.I',
    'phase.P',
    'phase.Q',
    'phase.pf',
    'phase.Vln',
    'phase.Pline',
    'phase.Pphase',
    'phase.ratio',
    'phase.sum',
    'phase.ripple',
    'phase.min',
    'phase.max',
    'phase.mean',
    'phase.wye',
    'phase.Iphase',
    'phase.Iline',
    'phase.sameLine',
    'seq.zero.mag',
    'seq.zero.ang',
    'seq.positive.mag',
    'seq.positive.ang',
    'seq.negative.mag',
    'seq.negative.ang',
    'seq.neutral',
    'seq.unbalance',
  ],
  line: [
    'line.Zc',
    'line.silMW',
    'line.R',
    'line.X',
    'line.Rpu',
    'line.Xpu',
    'line.charging',
    'line.exact',
    'line.nominal',
    'line.error',
    'line.at.200.error',
    'line.at.800.error',
    'line.at.200.exact',
    'line.at.800.exact',
    'line.at.200.nominal',
    'line.at.800.nominal',
    'line.absorbed',
    'line.produced',
    'line.net',
    'tx.V',
    'tx.drop',
    'tx.estimate',
    'tx.tap',
    'tx.mvar',
    'tx.shuntV',
  ],
  flow: [
    'bus.bus2.V',
    'bus.bus2.deg',
    'bus.bus3.V',
    'bus.bus3.deg',
    'bus.bus2.Q',
    'flow.slackP',
    'flow.slackQ',
    'flow.loss',
    'flow.lossMW',
    'flow.iterations',
    'flow.mismatch.0',
    'flow.mismatch.1',
    'flow.mismatch.2',
    'flow.mismatch.3',
    'flow.mismatch.4',
    'flow.branchLoss',
    'flow.lastLoading',
    'flow.noseV',
    'branch.br12.Pf',
    'branch.br12.Qf',
    'branch.br13.Pf',
    'branch.br23.Pf',
    'branch.br12.loss',
    'branch.br13.loss',
    'branch.br23.loss',
    'dc.theta.bus2',
    'dc.theta.bus3',
    'dc.flowError.br12',
    'dc.flowError.br13',
    'dc.flowError.br23',
    'dc.angleError',
    'dc.maxFlowError',
    'dc.maxAngle',
    'dc.minV',
    'dc.smallAngle',
    'dc.losslessError',
  ],
  seq: ['seq.zero.mag', 'seq.positive.mag', 'seq.negative.mag', 'seq.neutral', 'seq.unbalance', 'seq.rebuild', 'z.Z1', 'z.Z2', 'z.Z0', 'z.wye0', 'z.neutral0'],
  fault: [
    'fault.seq.zero',
    'fault.seq.positive',
    'fault.seq.negative',
    'fault.phaseA',
    'fault.phaseB',
    'fault.phaseC',
    'fault.ground',
    'fault.level',
    'fault.amps',
    'fault.ampsB',
    'fault.groundAmps',
    'fault.crossover',
    'fault.of.3ph.phase',
    'fault.of.slg.phase',
    'fault.of.ll.phase',
    'fault.of.dlg.phase',
    'fault.of.slg.ground',
    'fault.of.dlg.ground',
    'z.Z1',
    'z.Z0',
  ],
  relay: ['relay.time', 'relay.at.800', 'relay.at.1600', 'relay.at.4000', 'relay.upstream', 'relay.tds', 'relay.margin', 'relay.reach1', 'relay.reach2', 'relay.Z', 'relay.Zno', 'relay.zone', 'relay.zoneNo', 'relay.threshold', 'relay.wait'],
  swing: [
    'swing.M',
    'swing.delta0',
    'swing.deltaMax',
    'swing.deltaCr',
    'swing.areaAccel',
    'swing.areaDecel',
    'swing.tcr',
    'swing.cycles',
    'swing.fn',
    'swing.period',
    'swing.K',
    'swing.closed',
    'swing.closedAngle',
    'swing.peak',
    'swing.peakExact',
    'swing.peakGap',
    'swing.step',
    'swing.transfer',
  ],
  dispatch: ['dispatch.lambda', 'dispatch.cost', 'dispatch.equalCost', 'dispatch.saving', 'dispatch.marginal', 'dispatch.unit.unit1.P', 'dispatch.unit.unit2.P', 'dispatch.unit.unit3.P', 'dispatch.unit.unit1.incremental'],
}

const only = process.argv[2]
for (const e of EXPERIMENTS) {
  if (only && e.id !== only) continue
  const p = defaultsOf(e)
  const x = analyse(e, p)
  console.log(`\n=== ${e.id} ${e.name}  (${e.kind})  knobs ${JSON.stringify(p)}`)
  for (const path of PATHS[e.kind] || []) {
    let v
    try {
      v = readQuantity(x, p, path, e)
    } catch (err) {
      continue
    }
    if (Number.isFinite(v)) console.log(`  ${path} = ${+v.toPrecision(7)}`)
  }
}
