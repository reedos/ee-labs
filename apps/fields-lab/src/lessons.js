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
 * The paths, by group:
 *
 *   force, E.probe, V.probe            group A
 *   gauss.<implied|enclosed|error>     group A
 *   ring.<closed|byParts>              group A
 *   line.field, sheet.field            group A
 *   curve.<level|worst|points>         group A
 *   C.<value|perMetre>, L.<...>, R.<...>   groups B, D, E
 *   E.peak, W.<total|density>          groups B
 *   grid.<value|change|order|band|staircase|ok>   group C
 *   flux.<value|inside>, compare.value  group C
 *   bar.<R|I|J|E>                      group D
 *   rc                                 group D
 *   fourPoint.<resistivity|sheet|bulk|ratio>   group D
 *   B.probe, closed, ampere.<enclosed|integral>   group E
 *   solenoid.<B|fraction>              group E
 *   circuit.<inductance|flux|Bcore|gapShare|reluctance>   group E
 *   xfmr.<L1|L2|M|k|turnsRatio>        group E
 *   emf.<rms|peak|coefficient>         group F
 *   moving.emf                         group F
 *   eddy.P                             group F
 *   skin.delta, wire.<ratio|R|Lint>, tube.<R|error>   group F
 *
 * A path that names something the analysis does not carry throws, so a lesson
 * cannot quietly read undefined and pass.
 */

import { LESSONS_A } from './lessons/a.js'
import { LESSONS_B } from './lessons/b.js'
import { LESSONS_C } from './lessons/c.js'
import { LESSONS_D } from './lessons/d.js'
import { LESSONS_E } from './lessons/e.js'
import { LESSONS_F } from './lessons/f.js'
import { LESSONS_G } from './lessons/g.js'
import { LESSONS_H } from './lessons/h.js'
import { LESSONS_I } from './lessons/i.js'
import { LESSONS_J } from './lessons/j.js'
import { LESSONS_K } from './lessons/k.js'
import { LESSONS_L } from './lessons/l.js'

export const LESSONS = {
  ...LESSONS_A,
  ...LESSONS_B,
  ...LESSONS_C,
  ...LESSONS_D,
  ...LESSONS_E,
  ...LESSONS_F,
  ...LESSONS_G,
  ...LESSONS_H,
  ...LESSONS_I,
  ...LESSONS_J,
  ...LESSONS_K,
  ...LESSONS_L,
}

/** Walk an object by a list of keys, stopping at the first thing that is not there. */
const walk = (obj, keys) => keys.reduce((v, k) => (v == null ? undefined : v[k]), obj)

const need = (v, path) => {
  if (v === undefined) throw new Error(`No quantity at path ${path}`)
  return v
}

/** Read one quantity of an analysis by path. See the module comment for the list. */
export function readQuantity(x, p, path) {
  const parts = path.split('.')
  const [head, ...rest] = parts
  switch (head) {
    case 'force':
      return need(x.force, path)
    case 'E':
      if (rest[0] === 'probe') return Math.hypot(...x.atProbe)
      if (rest[0] === 'peak') return need(x.peakField, path)
      if (rest[0] === 'x') return x.atProbe[0]
      if (rest[0] === 'y') return x.atProbe[1]
      return need(undefined, path)
    case 'V':
      if (rest[0] === 'probe') return need(x.vAtProbe, path)
      return need(undefined, path)
    case 'gauss':
      if (rest[0] === 'implied') return need(x.gauss.impliedCharge, path)
      if (rest[0] === 'enclosed') return need(x.gauss.enclosed, path)
      if (rest[0] === 'error') return need(x.gauss.error, path)
      if (rest[0] === 'flux') return need(x.gauss.flux, path)
      return need(undefined, path)
    case 'ring':
      return need(x.ring[rest[0]], path)
    case 'line':
      // Group A's line of charge, and groups I and J's transmission line. The
      // two never appear in one analysis, so the head is read against whichever
      // the experiment has.
      if (rest[0] === 'field') return need(x.lineField, path)
      if (x.at && x.at[rest[0]] !== undefined) return x.at[rest[0]]
      return need(x.line && x.line[rest[0]], path)
    case 'sheet':
      if (rest[0] === 'field') return need(x.sheetField, path)
      return need(undefined, path)
    case 'curve':
      if (rest[0] === 'level') return need(x.curve.level, path)
      if (rest[0] === 'worst') return need(x.curve.worstRelative, path)
      if (rest[0] === 'points') return need(x.curve.points.length, path)
      return need(undefined, path)
    case 'C':
    case 'L':
    case 'R':
      return need(x[head] && x[head][rest[0] || 'value'], path)
    case 'W':
      if (rest[0] === 'total') return need(x.energy.W, path)
      if (rest[0] === 'density') return need(x.energy.density, path)
      return need(undefined, path)
    case 'grid':
      return need(x.grid[rest[0]], path)
    case 'flux':
      return need(x.flux[rest[0]], path)
    case 'compare':
      return need(x.compare[rest[0] || 'value'], path)
    case 'bar':
      return need(x.bar[rest[0]], path)
    case 'rc':
      return need(x.rc, path)
    case 'fourPoint':
      if (rest[0] === 'sheet') return need(x.fourPoint.sheetResistance, path)
      if (rest[0] === 'ratio') return need(x.fourPoint.tOverS, path)
      if (rest[0] === 'bulk') return need(x.fourPoint.bulkResistivity, path)
      return need(x.fourPoint[rest[0]], path)
    case 'B':
      if (rest[0] === 'probe') return need(x.magProbe, path)
      return need(undefined, path)
    case 'closed':
      return need(x.closed, path)
    case 'ampere':
      return need(x.ampere[rest[0]], path)
    case 'solenoid':
      return need(x.solenoid[rest[0]], path)
    case 'circuit':
      if (rest[0] === 'reluctance') return need(x.circuit.reluctance[rest[1]], path)
      if (rest[0] === 'guard') return need(x.circuit.guard[rest[1]], path)
      return need(x.circuit[rest[0]], path)
    case 'xfmr':
      return need(x.xfmr[rest[0]], path)
    case 'emf':
      return need(x.emf[rest[0]], path)
    case 'moving':
      return need(x.moving[rest[0]], path)
    case 'eddy':
      return need(x.eddy[rest[0]], path)
    case 'skin':
      return need(x.skin[rest[0]], path)
    case 'wire':
      return need(x.wire[rest[0]], path)
    case 'tube':
      return need(x.tube[rest[0]], path)
    case 'headline':
      return need(x.headline.value, path)

    // ------------------------------------------------------- the second half

    case 'wave':
      return need(walk(x.wave, rest), path)
    case 'pol':
      return need(walk(x.pol, rest), path)
    case 'refl':
      // `reflectNormal` keeps the two media's waves under `wave1` and `wave2`,
      // so 'refl.wave2.etaMag' reads the impedance the reflection came from.
      return need(walk(x.refl, rest), path)
    case 'standing':
      return need(walk(x.standing, rest), path)
    case 'oblique':
      // `reflectOblique` keeps the two polarisations under their own names, so
      // 'oblique.parallel.mag' reads the one the lesson is talking about.
      return need(walk(x.oblique, rest), path)
    case 'zin': {
      const Z = x.zin.Z
      const [re, im] = Array.isArray(Z) ? Z : [Z, 0]
      if (rest[0] === 're') return re
      if (rest[0] === 'im') return im
      if (rest[0] === 'mag') return Math.hypot(re, im)
      if (rest[0] === 'deg') return (Math.atan2(im, re) * 180) / Math.PI
      return need(walk(x.zin, rest), path)
    }
    case 'gamma': {
      const [re, im] = x.gamma
      if (rest[0] === 'mag') return Math.hypot(re, im)
      if (rest[0] === 'deg') return (Math.atan2(im, re) * 180) / Math.PI
      if (rest[0] === 're') return re
      if (rest[0] === 'im') return im
      return need(undefined, path)
    }
    case 'sw':
      return need(x.sw[rest[0]], path)
    case 'qw':
      return need(x.qw[rest[0]], path)
    case 'bounce':
      return need(walk(x.diagram, rest), path)
    case 'guide':
      // The described guide, then the mode at this frequency, then the band.
      if (x.mode && x.mode[rest[0]] !== undefined) return x.mode[rest[0]]
      if (x.band && x.band[rest[0]] !== undefined) return x.band[rest[0]]
      return need(walk(x.guide, rest), path)
    case 'cavity':
      return need(walk(x.cavity, rest), path)
    case 'ant':
      // Whichever antenna this experiment is about: the two never overlap.
      for (const holder of [x.dipole, x.hertzian, x.array, x.gain]) {
        if (holder && holder[rest[0]] !== undefined) return holder[rest[0]]
      }
      return need(undefined, path)
    case 'array':
      return need(walk(x.array, rest), path)
    case 'friis':
      return need(walk(x.friis, rest), path)

    default:
      // Anything else is read off the analysis by its own path, so a lane that
      // needs a quantity nobody named above is not blocked on this file. It
      // still throws when the path names nothing, which is the point.
      return need(walk(x, parts), path)
  }
}
