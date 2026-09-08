/**
 * What the student reads, per experiment, in three registers:
 *
 *   see — what the picture shows at the defaults, in a few lines;
 *   try — knob moves with the reading each one produces;
 *   why — the reasoning, for after the picture has made its point.
 *
 * Every number a step quotes is a measurement. A step's `set` is applied on top
 * of the defaults, and each `reads` pair is a quantity path with the value the
 * sentence quotes. `experiments.test.js` analyses each step and checks both the
 * pair and every number-with-unit in the sentence against it.
 *
 * The paths, by kind:
 *
 *   gamma.<re|im|mag|deg>                 the reflection coefficient
 *   vswr  returnLoss  mismatchLoss  accepted    the same number, other costumes
 *   zl.<re|im|mag|deg>                    the load, in ohms
 *   zin.<re|im|mag|deg>                   looking into the line
 *   z.<re|im>  y.<re|im>                  normalised, and its reciprocal
 *   line.<lambda|degrees|wavelengths|beta|vp|Z0|length|delay|repeat|fraction>
 *   loss.<alphaDb|oneWay|roundTrip>       decibels, from alpha and the length
 *   source.<mag|vswr|deg>                 the reflection seen back at the source
 *   turn.<deg|perMetre|shrink>            what a length of line does on the chart
 *   locus.<mag|deg>                       where that path ends
 *   wave.<vmax|vmin|swr|dMax|dMin|quarter|firstG|lastG>
 *   circle.<r|x|g|b|vswr>.<cx|cy|radius>  the families, by name
 *   onCircle.<r|x|g>                      how far a point is off the circle it should be on
 *   point.<name>.<re|im|mag|deg>          a landmark on the chart, by name
 *   shunt.<re|im|mag|deg>                 where a shunt element moved the point
 *   sweep.<points|spacing|first|last|worst>
 *   handOver.<ok>                         whether the rational hand-over is offered
 *
 * The list above is the one `readQuantity` has a case for. Groups C and D read
 * off the analysis by their own path through the default branch, so
 * `design.Q`, `element.series.value`, `bw.fractional`, `s.21.db`, `conv.count`
 * and `power.sum` need no case here. `apps/rf-lab/AGENT_BRIEF.md` §4 lists
 * every one of them, beside the list above.
 *
 * A path that names something the analysis does not carry throws, so a lesson
 * cannot quietly read undefined and pass.
 */

import { LESSONS_A } from './lessons/a.js'
import { LESSONS_B } from './lessons/b.js'
import { LESSONS_C } from './lessons/c.js'
import { LESSONS_D } from './lessons/d.js'

export const LESSONS = { ...LESSONS_A, ...LESSONS_B, ...LESSONS_C, ...LESSONS_D }

/** Walk an object by a list of keys, stopping at the first thing that is not there. */
const walk = (obj, keys) => keys.reduce((v, k) => (v == null ? undefined : v[k]), obj)

const need = (v, path) => {
  if (v === undefined) throw new Error(`No quantity at path ${path}`)
  return v
}

/** The four ways a complex pair is read, so every path that names one reads the same. */
function complexPart(z, part, path) {
  if (z === Infinity) return part === 'mag' ? Infinity : need(undefined, path)
  const [re, im] = Array.isArray(z) ? z : [z, 0]
  if (part === 're' || part === undefined) return re
  if (part === 'im') return im
  if (part === 'mag') return Math.hypot(re, im)
  if (part === 'deg') return (Math.atan2(im, re) * 180) / Math.PI
  return need(undefined, path)
}

/** Read one quantity of an analysis by path. See the module comment for the list. */
export function readQuantity(x, p, path) {
  const parts = path.split('.')
  const [head, ...rest] = parts
  switch (head) {
    case 'gamma':
      return complexPart((x.m || x.load || {}).gamma ?? x.gamma, rest[0], path)
    case 'vswr':
      return need((x.m || x.load || {}).vswr, path)
    case 'returnLoss':
      return need((x.m || x.load || {}).returnLossDb, path)
    case 'mismatchLoss':
      return need((x.m || x.load || {}).mismatchLossDb, path)
    case 'accepted':
      return need((x.m || x.load || {}).powerAccepted, path)
    case 'zl':
      return complexPart(x.ZL === 0 ? [0, 0] : x.ZL, rest[0], path)
    case 'zin':
      return complexPart(need(x.zin, path).Z, rest[0], path)
    case 'z':
      return complexPart(x.z ?? need(x.place, path).z, rest[0], path)
    case 'y':
      return complexPart(need(x.y, path), rest[0], path)
    case 'line': {
      const el = need(x.el, path)
      if (rest[0] === 'delay') return x.delay
      if (rest[0] === 'repeat') return x.repeat
      if (rest[0] === 'fraction') return el.vp / 299792458
      return need(el[rest[0]], path)
    }
    case 'loss':
      return need(need(x.loss, path)[rest[0]], path)
    case 'source':
      if (rest[0] === 'mag') return need(x.source, path).mag
      if (rest[0] === 'vswr') return need(x.source, path).vswr
      if (rest[0] === 'deg') return need(x.source, path).deg
      return need(undefined, path)
    case 'turn':
      return need(need(x.turn, path)[rest[0]], path)
    case 'locus': {
      const end = need(x.locus, path).at(-1)
      return complexPart(end, rest[0] || 'mag', path)
    }
    case 'wave': {
      const w = need(x.wave, path)
      if (rest[0] === 'firstG') return w.samples[0].g
      if (rest[0] === 'lastG') return w.samples.at(-1).g
      return need(w[rest[0]], path)
    }
    case 'circle': {
      const named = { ...(x.circles || {}), ...(x.gCircle ? { g: x.gCircle } : {}), ...(x.vswrCircle ? { vswr: x.vswrCircle } : {}) }
      const family = need(named[rest[0]], path)
      return need(family[rest[1] === 'cx' ? 'cx' : rest[1] === 'cy' ? 'cy' : 'radius'], path)
    }
    case 'onCircle':
      return need(rest[0] === 'g' ? x.offCircle : walk(x.onCircle || {}, rest), path)
    case 'point': {
      const found = need((x.landmarks || []).find((l) => l.name === rest[0]), path)
      return complexPart(found.gamma, rest[1] || 'mag', path)
    }
    case 'shunt':
      if (rest[0] === 'y') return complexPart(need(x.shunt, path).y, rest[1] || 're', path)
      return complexPart(need(x.shunt, path).gamma, rest[0] || 'mag', path)
    case 'sweep': {
      const s = need(x.sweep, path)
      if (rest[0] === 'points') return s.length
      if (rest[0] === 'spacing') return (x.sweepRange.to - x.sweepRange.from) / (s.length - 1)
      if (rest[0] === 'first') return s[0].mag
      if (rest[0] === 'last') return s.at(-1).mag
      // The largest and the smallest reflection magnitude anywhere in the
      // sweep. On a lossless line they are equal, which is the point.
      if (rest[0] === 'spread') return Math.max(...s.map((q) => q.mag)) - Math.min(...s.map((q) => q.mag))
      return need(undefined, path)
    }
    case 'handOver':
      return need(need(x.handOver, path)[rest[0] || 'ok'], path)
    case 'headline':
      return need(x.headline, path).value
    default:
      // Anything else is read off the analysis by its own path, so a lane that
      // needs a quantity nobody named above is not blocked on this file. It
      // still throws when the path names nothing, which is the point.
      return need(walk(x, parts), path)
  }
}
