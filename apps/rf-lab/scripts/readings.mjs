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
  c1: [
    ['defaults', {}, ['design.Q', 'element.series.value', 'element.series.X', 'element.shunt.value', 'element.shunt.X', 'at.mag', 'zin.re', 'zin.im', 'design.Xs', 'design.Xp']],
    ['high-pass pick', { pick: 'highpass' }, ['element.series.value', 'element.series.X', 'element.shunt.value', 'element.shunt.X', 'at.mag']],
    ['5 to 50 ohm', { RS: 5, RL: 50 }, ['design.Q', 'element.series.value', 'element.shunt.value', 'at.mag']],
    ['50 to 200 ohm', { RL: 200 }, ['design.Q', 'design.Xs', 'design.Xp', 'element.series.value', 'element.shunt.value']],
    ['already matched', { RL: 50 }, ['design.Q', 'count', 'at.mag']],
  ],
  c2: [
    ['defaults', {}, ['count', 'away.0.twice', 'away.1.twice', 'design.Q']],
    ['high-pass pick', { pick: 'highpass' }, ['count', 'at.mag']],
    ['load below the source', { RL: 5 }, ['count', 'design.Q', 'chosen.orientation']],
    ['5 to 50 ohm', { RS: 5, RL: 50 }, ['count', 'design.Q']],
  ],
  c3: [
    ['defaults', {}, ['design.Q', 'bw.fractional', 'bw.lower', 'bw.upper', 'oneOverQ']],
    ['5 to 50 ohm', { RS: 5, RL: 50 }, ['design.Q', 'bw.fractional', 'oneOverQ']],
    ['to a ratio of two', { target: 2 }, ['bw.bounded', 'bw.upper']],
    ['to a ratio of 1.2222', { target: 1.2222 }, ['bw.fractional']],
    ['50 to 200 ohm', { RL: 200 }, ['design.Q', 'bw.fractional', 'oneOverQ']],
  ],
  c4: [
    ['defaults', {}, ['qw.Z0', 'qw.len', 'el.degrees', 'bw.fractional', 'lumpedBw.fractional', 'wider', 'repeat', 'line.lambda']],
    ['to a ratio of 1.5', { target: 1.5 }, ['bw.fractional', 'lumpedBw.fractional', 'wider']],
    ['50 to 200 ohm', { RL: 200 }, ['qw.Z0', 'bw.fractional', 'lumpedBw.fractional']],
    ['air instead of PTFE', { epsr: 1 }, ['qw.len', 'qw.Z0', 'bw.fractional']],
  ],
  c5: [
    ['defaults', {}, ['design.Q', 'design.X', 'cancel.X', 'cancel.value', 'element.series.X', 'element.series.value', 'element.shunt.value', 'element.shunt.X', 'at.mag', 'chosen.elements.length']],
    ['no reactance', { XL: 0 }, ['design.Q', 'chosen.elements.length', 'at.mag']],
    ['an inductive load', { XL: 40 }, ['cancel.X', 'element.series.X', 'chosen.elements.length']],
    ['high-pass pick', { pick: 'highpass' }, ['element.series.X', 'element.shunt.X', 'chosen.elements.length']],
  ],
  d1: [
    ['defaults', {}, ['gamma.re', 'gamma.mag', 'solvedMag', 'agree', 'waves.a', 'waves.b', 'vswr']],
    ['25 ohm', { RL: 25 }, ['gamma.re', 'solvedMag', 'agree']],
    ['30 - j40', { RL: 30, XL: -40 }, ['gamma.im', 'gamma.mag', 'solvedMag', 'agree']],
    ['75 ohm reference', { z0: 75 }, ['gamma.mag', 'waves.a']],
  ],
  d2: [
    ['defaults', {}, ['s.11.mag', 's.21.mag', 's.21.db', 's.12.db', 's.22.mag', 'agree', 'built.pad.series', 'built.pad.shunt']],
    ['1 dB', { db: 1 }, ['built.pad.series', 'built.pad.shunt', 's.21.db', 's.11.mag']],
    ['10 dB', { db: 10 }, ['built.pad.series', 'built.pad.shunt', 's.21.db', 's.21.mag']],
    ['20 dB', { db: 20 }, ['built.pad.series', 'built.pad.shunt', 's.21.db']],
    ['at 4 GHz', { f: 4e9 }, ['s.21.db', 's.11.mag']],
  ],
  d3: [
    ['defaults', {}, ['conv.count', 'conv.roundTrip.error', 's.11.mag', 's.21.mag']],
    ['the transformer', { object: 'transformer' }, ['conv.count', 's.11.mag', 's.21.mag', 's.11.re']],
    ['a transformer of ratio 3', { object: 'transformer', n: 3 }, ['conv.count', 's.11.mag', 's.21.mag']],
    ['no path through', { object: 'blocked' }, ['conv.count', 's.11.mag', 's.21.mag']],
  ],
  d4: [
    ['defaults', {}, ['s.21.db', 's.11.mag', 'agree', 'power.sum']],
    ['one pad', { stages: 1 }, ['s.21.db', 's.11.mag']],
    ['four pads', { stages: 4 }, ['s.21.db', 's.11.mag']],
    ['the section', { chain: 'section' }, ['s.11.mag', 's.21.mag', 'power.sum', 'agree']],
    ['the section to 200 ohm', { chain: 'section', RL: 200 }, ['s.11.mag', 's.21.mag', 'power.sum']],
  ],
  d5: [
    ['defaults', {}, ['s.11.mag', 's.21.mag', 'power.sum', 'power.dissipated', 'power.reciprocity', 'power.unitarity', 'power.largest']],
    ['one ohm', { Rs: 1 }, ['power.sum', 'power.dissipated', 'power.unitarity', 'power.reciprocity']],
    ['five ohms', { Rs: 5 }, ['power.sum', 'power.dissipated', 's.21.mag']],
    ['twenty-five ohms', { Rs: 25 }, ['power.sum', 'power.dissipated', 's.21.db']],
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
