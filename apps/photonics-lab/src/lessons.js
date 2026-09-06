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
 *   photon.<eV|joules|frequency|flux>      group A
 *   R, cutoff, level                       group A
 *   pd.<current|iph|dark|reverse>          group A
 *   speed.<area|cj0|cj|corner|collected|areaBandwidth>   group A
 *   att.<db|ratio|out|outDbm|km>           group E
 *   disp.<spread|beta2>                    group E
 *   limit.<rate|product|criterion>         group E
 *   geo.<na|angle|delta|v|modes|single>    group E
 *   budget.<total|received|margin>         group E
 *   reach.<length|dispersion|binds|forFibre>   group E
 *   j.<current|forward|across|iters>       group C
 *   led.<power|slope|volts>                group C
 *   band.<f3db|tauC|perDecade|perOctave>   group C
 *   laser.<power|slope|spontaneousSlope|slopeRatio|stimulated|spontaneous|above>   group C
 *   ith, nth, tauP, volts                  groups C and D
 *   cavity.<tauP|mirror|mirrorPerCm|fsr|finesse>   group C
 *   n, s, current, above                   group D
 *   sm.<fr|frText|gamma|zeta|peakDb|peakHz|f3db|dc>   group D
 *   textFactor                             group D
 *   guard.<error|depth|warn|decline|measured|predicted|ratio>   group D
 *   fsr, fsrWavelength, finesse, linewidth, facet, mirrorLoss   group F
 *   contrast.<ratio|db>                    group F
 *   grid.width, band.<width|channels>, widthRatio   group F
 *   headline                               any
 *
 * A path that names something the analysis does not carry throws, so a lesson
 * cannot quietly read undefined and pass.
 */

import { LESSONS_A } from './lessons/a.js'
import { LESSONS_C } from './lessons/c.js'
import { LESSONS_D } from './lessons/d.js'
import { LESSONS_E } from './lessons/e.js'
import { LESSONS_F } from './lessons/f.js'

export const LESSONS = {
  ...LESSONS_A,
  ...LESSONS_C,
  ...LESSONS_D,
  ...LESSONS_E,
  ...LESSONS_F,
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
  if (parts[0] === 'headline') return need(x.headline.value, path)
  return need(walk(x, parts), path)
}
