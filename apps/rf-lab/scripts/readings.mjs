// Every reading a lesson quotes, at the setting the step names.
//
//   node apps/rf-lab/scripts/readings.mjs
//
// `pins.mjs` computes the plan's numbers from the engine. This script computes
// the LESSONS' numbers from the app, through the same `analyse` and the same
// `readQuantity` that `experiments.test.js` uses, so a sentence is written from
// the reading rather than the reading checked against a sentence afterwards.

import { EXPERIMENTS, byId, defaultsOf } from '../src/experiments.js'
import { readQuantity } from '../src/lessons.js'
import { analyse } from '../src/math.js'

const sig = (x, n = 6) => (typeof x === 'number' ? (Number.isFinite(x) ? Number(x).toPrecision(n) : String(x)) : String(x))

/** The steps each experiment is written from, as [label, overrides, paths]. */
const PLAN = {
  a1: [
    ['defaults', {}, ['gamma.re', 'gamma.im', 'gamma.mag', 'gamma.deg', 'zl.re']],
    ['25 ohm load', { RL: 25 }, ['gamma.re', 'gamma.mag', 'gamma.deg']],
    ['matched', { RL: 50 }, ['gamma.mag']],
    ['30 - j40', { RL: 30, XL: -40 }, ['gamma.re', 'gamma.im', 'gamma.mag', 'gamma.deg']],
    ['75 ohm reference', { z0: 75 }, ['gamma.re', 'gamma.mag']],
  ],
  a2: [
    ['defaults', {}, ['vswr', 'returnLoss', 'mismatchLoss', 'accepted', 'gamma.mag']],
    ['25 ohm load', { RL: 25 }, ['vswr', 'returnLoss', 'gamma.mag']],
    ['30 - j40', { RL: 30, XL: -40 }, ['vswr', 'returnLoss', 'mismatchLoss', 'accepted']],
    ['200 ohm load', { RL: 200 }, ['vswr', 'returnLoss', 'mismatchLoss']],
  ],
  a3: [
    ['defaults', {}, ['line.lambda', 'line.degrees', 'line.vp', 'line.fraction', 'zin.re', 'zin.im', 'gamma.mag', 'line.length', 'line.delay']],
    ['500 MHz', { f: 5e8 }, ['line.degrees', 'zin.re', 'zin.im', 'source.mag']],
    ['2 GHz', { f: 2e9 }, ['line.degrees', 'zin.re', 'zin.im']],
    ['25 ohm load', { RL: 25 }, ['zin.re', 'gamma.mag']],
    ['air line', { epsr: 1 }, ['line.lambda', 'line.degrees', 'zin.re', 'zin.im']],
  ],
  a4: [
    ['defaults', {}, ['loss.alphaDb', 'loss.oneWay', 'loss.roundTrip', 'zin.re', 'zin.im', 'gamma.mag', 'source.mag', 'source.vswr', 'wave.firstG', 'wave.lastG']],
    ['lossless', { alpha: 0 }, ['zin.re', 'source.mag', 'loss.roundTrip']],
    ['one neper a metre', { alpha: 1 }, ['loss.alphaDb', 'loss.roundTrip', 'source.mag', 'zin.re']],
    ['ten quarter waves', { len: 0.517191, alpha: 0.05 }, ['loss.oneWay', 'source.mag', 'loss.roundTrip']],
  ],
  a5: [
    ['defaults', {}, ['sweep.points', 'sweep.spacing', 'line.repeat', 'sweep.spread', 'line.delay', 'handOver.ok']],
    ['481 points', { points: 481 }, ['sweep.points', 'sweep.spacing']],
    ['twice as long', { len: 0.10343822510819459 }, ['line.repeat', 'line.degrees', 'line.delay']],
    ['with loss', { alpha: 0.05 }, ['line.repeat', 'handOver.ok', 'sweep.spread']],
  ],
  b1: [
    ['defaults', {}, ['z.re', 'gamma.re', 'gamma.mag', 'gamma.deg', 'point.open.re', 'point.short.re', 'point.match.mag', 'point.inductor.mag', 'point.inductor.deg']],
    ['short', { RL: 0 }, ['gamma.re', 'gamma.mag', 'gamma.deg']],
    ['pure inductor', { RL: 0, XL: 50 }, ['gamma.mag', 'gamma.deg', 'z.im']],
    ['150 + j100', { RL: 150, XL: 100 }, ['z.re', 'z.im', 'gamma.re', 'gamma.im', 'gamma.mag', 'gamma.deg']],
  ],
  b2: [
    ['defaults', {}, ['circle.r.cx', 'circle.r.radius', 'circle.x.cx', 'circle.x.cy', 'circle.x.radius', 'onCircle.r', 'onCircle.x']],
    ['r = 2', { r: 2 }, ['circle.r.cx', 'circle.r.radius']],
    ['r = 0', { r: 0 }, ['circle.r.cx', 'circle.r.radius']],
    ['x = 2', { x: 2 }, ['circle.x.cy', 'circle.x.radius']],
    ['x = -1', { x: -1 }, ['circle.x.cy', 'circle.x.radius']],
  ],
  b3: [
    ['defaults', {}, ['turn.deg', 'circle.vswr.radius', 'locus.mag', 'locus.deg', 'gamma.mag', 'line.degrees']],
    ['half a wave', { len: 0.10343822510819459 }, ['turn.deg', 'locus.mag', 'locus.deg']],
    ['an eighth', { len: 0.025859556277048647 }, ['turn.deg', 'locus.deg']],
    ['with loss', { alpha: 0.5 }, ['locus.mag', 'turn.shrink', 'circle.vswr.radius']],
  ],
  b4: [
    ['defaults', {}, ['y.re', 'y.im', 'gamma.re', 'circle.g.cx', 'circle.g.radius', 'shunt.re', 'shunt.im', 'onCircle.g']],
    ['b = 0.5', { b: 0.5 }, ['shunt.re', 'shunt.im', 'shunt.mag', 'onCircle.g']],
    ['b = 1', { b: 1 }, ['shunt.re', 'shunt.im', 'onCircle.g']],
    ['b = -0.5', { b: -0.5 }, ['shunt.re', 'shunt.im']],
  ],
}

for (const e of EXPERIMENTS) {
  console.log(`\n=== ${e.id.toUpperCase()} · ${e.name} ===`)
  for (const [label, over, paths] of PLAN[e.id] || []) {
    const p = { ...defaultsOf(e.id), ...over }
    const x = analyse(byId[e.id], p)
    const set = Object.entries(over).map(([k, v]) => `${k}=${sig(v, 8)}`).join(' ')
    console.log(`  ${label.padEnd(20)} ${set}`)
    console.log(`    headline ${sig(x.headline.value)} ${x.headline.unit}`)
    for (const path of paths) console.log(`    ${path.padEnd(22)} ${sig(readQuantity(x, p, path))}`)
  }
}
