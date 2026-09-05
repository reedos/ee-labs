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

export const LESSONS = {
  ...LESSONS_A,
  ...LESSONS_B,
  ...LESSONS_C,
  ...LESSONS_D,
  ...LESSONS_E,
  ...LESSONS_F,
}

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
      if (rest[0] === 'field') return need(x.lineField, path)
      return need(undefined, path)
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
    default:
      return need(undefined, path)
  }
}
