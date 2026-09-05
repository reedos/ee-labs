// The readings each experiment produces at its defaults, and at a few knob
// moves, so a lesson can be written from measurements rather than from memory.
//
//   node apps/fields-lab/scripts/readings.mjs [id ...]
//
// This is a working tool, not a deliverable. `numbers.mjs` is the script the
// plan's figures come from and it stands on its own. This one exists because a
// try step quotes a reading at a setting, and the setting has to be solved
// before the sentence can be written.

import { EXPERIMENTS, byId, defaultsOf } from '../src/experiments.js'
import { analyse } from '../src/math.js'

const only = process.argv.slice(2)
const list = only.length ? only.map((id) => byId[id]) : EXPERIMENTS
const sig = (x, n = 5) => (typeof x === 'number' ? (Number.isFinite(x) ? Number(x).toPrecision(n) : String(x)) : String(x))

const show = (exp, over = {}) => {
  const p = { ...defaultsOf(exp.id), ...over }
  const x = analyse(exp, p)
  const label = Object.keys(over).length ? `  with ${JSON.stringify(over)}` : '  at the defaults'
  console.log(label)
  console.log(`    headline ${sig(x.headline.value)} ${x.headline.unit} (${x.headline.label})`)
  const rows = collect(x)
  for (const [k, v] of rows) console.log(`    ${k.padEnd(28)} ${sig(v)}`)
}

function collect(x) {
  const out = []
  const add = (k, v) => {
    if (typeof v === 'number' && Number.isFinite(v)) out.push([k, v])
  }
  if (x.force !== undefined) add('force', x.force)
  if (x.atProbe) add('E.probe', Math.hypot(...x.atProbe))
  if (x.vAtProbe !== undefined) add('V.probe', x.vAtProbe)
  if (x.gauss) {
    add('gauss.implied', x.gauss.impliedCharge)
    add('gauss.enclosed', x.gauss.enclosed)
    add('gauss.error', x.gauss.error)
  }
  if (x.lineField !== undefined) add('line.field', x.lineField)
  if (x.sheetField !== undefined) add('sheet.field', x.sheetField)
  if (x.curve) {
    add('curve.level', x.curve.level)
    add('curve.worst', x.curve.worstRelative)
    add('curve.points', x.curve.points.length)
  }
  for (const key of ['C', 'L', 'R']) {
    if (x[key]) {
      add(`${key}.value`, x[key].value)
      if (x[key].perMetre !== null && x[key].perMetre !== undefined) add(`${key}.perMetre`, x[key].perMetre)
    }
  }
  if (x.peakField !== undefined) add('E.peak', x.peakField)
  if (x.energy) {
    add('W.total', x.energy.W)
    add('W.density', x.energy.density)
  }
  if (x.grid) {
    add('grid.value', x.grid.value)
    add('grid.change', x.grid.change)
    add('grid.order', x.grid.order)
    add('grid.band', x.grid.band)
    add('grid.staircase', x.grid.staircase)
    console.log(`    guard: ${x.grid.says}`)
    console.log(`    levels: ${x.grid.levels.map((l) => `${l.n}:${sig(l.value, 7)}`).join('  ')}`)
  }
  if (x.compare) add('compare.value', x.compare.value)
  if (x.flux) {
    add('flux.value', x.flux.value)
    add('flux.inside', x.flux.inside)
  }
  if (x.bar) {
    add('bar.R', x.bar.R)
    add('bar.I', x.bar.I)
    add('bar.J', x.bar.J)
    add('bar.E', x.bar.E)
  }
  if (x.rc !== undefined) add('rc', x.rc)
  if (x.fourPoint) {
    add('fourPoint.resistivity', x.fourPoint.resistivity)
    add('fourPoint.sheet', x.fourPoint.sheetResistance)
    add('fourPoint.bulk', x.fourPoint.bulkResistivity)
    add('fourPoint.ratio', x.fourPoint.tOverS)
    console.log(`    regime: ${x.fourPoint.regime}`)
  }
  if (x.magProbe !== undefined) add('B.probe', x.magProbe)
  if (x.closed !== undefined) add('closed', x.closed)
  if (x.ampere) {
    add('ampere.enclosed', x.ampere.enclosed)
    add('ampere.integral', x.ampere.integral)
  }
  if (x.solenoid) {
    add('solenoid.B', x.solenoid.B)
    add('solenoid.fraction', x.solenoid.fraction)
    add('solenoid.infinite', x.solenoid.infinite)
  }
  if (x.circuit) {
    add('circuit.inductance', x.circuit.inductance)
    add('circuit.flux', x.circuit.flux)
    add('circuit.Bcore', x.circuit.Bcore)
    add('circuit.gapShare', x.circuit.gapShare)
    add('circuit.reluctance.total', x.circuit.reluctance.total)
    add('circuit.reluctance.core', x.circuit.reluctance.core)
    add('circuit.reluctance.gap', x.circuit.reluctance.gap)
    console.log(`    guard: ${x.circuit.guard.says}`)
  }
  if (x.xfmr) {
    add('xfmr.L1', x.xfmr.L1)
    add('xfmr.L2', x.xfmr.L2)
    add('xfmr.M', x.xfmr.M)
    add('xfmr.k', x.xfmr.k)
  }
  if (x.emf) {
    add('emf.rms', x.emf.rms)
    add('emf.peak', x.emf.peak)
    add('emf.coefficient', x.emf.coefficient)
    add('emf.fluxPeak', x.emf.fluxPeak)
  }
  if (x.moving) add('moving.emf', x.moving.emf)
  if (x.eddy) {
    add('eddy.P', x.eddy.P)
    add('eddy.delta', x.eddy.delta)
    console.log(`    guard: ${x.eddy.guard.says}`)
  }
  if (x.skin) add('skin.delta', x.skin.delta)
  if (x.wire) {
    add('wire.ratio', x.wire.ratio)
    add('wire.R', x.wire.R)
    add('wire.Rdc', x.wire.Rdc)
    add('wire.Lint', x.wire.Lint)
  }
  if (x.tube) {
    add('tube.R', x.tube.R)
    add('tube.error', x.tube.error)
    console.log(`    guard: ${x.tube.guard.says}`)
  }
  return out
}

/** Extra settings worth solving for each experiment, named by id. */
const MOVES = {
  a1: [{ d: 0.02 }, { q2: -1e-9 }],
  a2: [{ q2: 1e-9 }, { y: 0.005 }],
  a3: [{ off: 0.02 }, { outside: 1 }],
  a4: [{ r: 0.02 }, { lambda: 2e-9 }],
  a5: [{ start: 0.004 }, { step: 1e-4 }],
  b1: [{ epsr: 3.9 }, { gap: 0.5e-3 }, { area: 2e-4 }],
  b2: [{ b: 3e-3 }, { epsr: 1 }, { a: 0.9e-3 }],
  b3: [{ b: 1000 }, { b: 0.055 }],
  b4: [{ d: 12e-3 }, { a: 0.8e-3 }],
  b5: [{ V: 200 }, { epsr: 1 }],
  c1: [{ px: 0.05, py: 0.05 }, { n: 30 }],
  c2: [{ n: 12 }],
  c3: [{ b: 7e-3 }],
  c4: [{ box: 0.3 }],
  c5: [{ a: 3e-3 }],
  d1: [{ area: 2e-6 }, { len: 2 }],
  d2: [{ sigma: 1e-11 }],
  d3: [{ epsr: 1 }, { sigma: 1e-10 }],
  d4: [{ t: 1e-6 }, { t: 1e-3 }, { s: 1e-2, t: 1e-6 }],
  e1: [{ z: 0.05 }, { sides: 12 }, { a: 0.025 }],
  e2: [{ r: 0.04 }, { off: 0.06 }],
  e3: [{ z: 0.1 }, { len: 0.05 }],
  e4: [{ internal: 1 }, { mur: 100 }],
  e5: [{ gap: 0 }, { gap: 8e-3 }],
  e6: [{ leakage: 0 }, { n2: 200 }],
  f1: [{ f: 60 }, { N: 400 }],
  f2: [{ angle: 0 }, { angle: 30 }],
  f3: [{ t: 0.175e-3 }, { f: 100 }],
  f4: [{ f: 1e4 }, { f: 1e8 }, { f: 50 }],
}

for (const exp of list) {
  console.log(`\n=== ${exp.id.toUpperCase()} ${exp.name} ===`)
  show(exp)
  for (const move of MOVES[exp.id] || []) show(exp, move)
}
