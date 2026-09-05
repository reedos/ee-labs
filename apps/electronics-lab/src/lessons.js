/**
 * What the student reads, per experiment, in three registers:
 *
 *   see — what the picture shows at the defaults, in a few lines;
 *   try — knob moves with the reading each one produces;
 *   why — the reasoning, for after the picture has made its point.
 *
 * Every number a step quotes is a measurement. A step's `set` is applied on
 * top of the defaults, its `at` moves the cursor, and each `reads` pair is a
 * quantity path (or a function of the analysis) with the value the sentence
 * quotes. experiments.test.js solves each step and checks both the pair and
 * every number-with-unit in the sentence against it.
 *
 * The paths, on top of Circuit Elements Lab's v, volt, i, p and vd:
 *
 *   op.<id>.<ic|ib|vce|vbe|id_|vds|vgs|region|gm|rpi|ro>
 *   gain                          the small-signal gain, from the polynomials
 *   H.<mag|db|deg>                the response at the cursor frequency
 *   pole.<k>.<hz|re|im>           poles, ordered by frequency, k from 1
 *   zero.<k>.<hz>
 *   corner.<low|high>             the −3 dB frequencies, in hertz
 *   slope                         V/s of the scope's ramp
 *   clip.<high|low>               the scope's flat tops, in volts
 *   peak.<node>  mean.<node>
 *   junction.<v0|w|xp|xn|cj|cd|is|slope|fT|doubling|gm>
 */
import { complex as cx } from '@ee-labs/network'
import { clipOf, meanOf, peakOf, slopeOf } from './math.js'
import { LESSONS_A } from './lessons/a.js'
import { LESSONS_C } from './lessons/c.js'
import { LESSONS_F } from './lessons/f.js'
import { LESSONS_G } from './lessons/g.js'

const DEG = 180 / Math.PI

/** Read one quantity of an analysis by path (see the module comment). */
export function readQuantity(x, p, path, exp) {
  const [head, ...rest] = path.split('.')
  const sol = x.sol
  switch (head) {
    case 'v':
    case 'volt':
    case 'i':
    case 'p':
      return sol[head][rest[0]]
    case 'vd':
      return sol.v[rest[0]] - sol.v[rest[1]]
    case 'op':
      return x.point[rest[0]][rest[1]]
    case 'gain':
      return x.gain
    case 'corner':
      return x.corner[rest[0]]
    case 'pole':
      return x.poles[Number(rest[0]) - 1][rest[1]]
    case 'zero':
      return x.zeros[Number(rest[0]) - 1][rest[1]]
    case 'H': {
      const h = x.hAt
      if (rest[0] === 'mag') return cx.cabs(h)
      if (rest[0] === 'db') return 20 * Math.log10(cx.cabs(h))
      return cx.carg(h) * DEG
    }
    case 'slope':
      return slopeOf(x, rest[0] || 'out')
    case 'clip':
      return clipOf(x, rest[1] || 'out')[rest[0]]
    case 'peak':
      return peakOf(x, rest[0])
    case 'mean':
      return meanOf(x, rest[0])
    case 'junction':
      return x.junction[rest[0]]
    case 'cursor':
      return x.cursor
    default:
      throw new Error(`unknown quantity path ${path}`)
  }
}

export const LESSONS = { ...LESSONS_A, ...LESSONS_C, ...LESSONS_F, ...LESSONS_G }
