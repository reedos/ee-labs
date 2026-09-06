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
 * The paths:
 *
 *   total.<gainDb|gain|nfDb|f|excess|iip3Dbm|iip3PowerDbm|oip3Dbm|powerMw|n>
 *   cum.<k>.<gain|nf|iip3>         the running totals after block k, one-based
 *   block.<id>.<gainDb|nfDb|iip3Dbm|powerMw|tempK>
 *   share.<id>.<noise|ip3|power>   that block's share of one budget
 *   level.<k>.<signal|noise|snr|drive>  the node after block k, 0 the input
 *   floor.<dbm|bandwidth>          the noise floor, and the width it is counted over
 *   snr.<in|out>                   the ratio at the two ends
 *   limits.<backoffDb|id|name>     how far the nearest block is from its own IP3
 *   headline                       the one number the experiment is about
 *   p.<knob>                       a knob value, for a step that names one
 *
 * A path that names something the analysis does not carry throws, so a lesson
 * cannot quietly read undefined and pass.
 */

import { LESSONS_A } from './lessons/a.js'

export const LESSONS = { ...LESSONS_A }

/** Walk an object by a list of keys, stopping at the first thing that is not there. */
const walk = (obj, keys) => keys.reduce((v, k) => (v == null ? undefined : v[k]), obj)

const need = (v, path) => {
  if (v === undefined) throw new Error(`No quantity at path ${path}`)
  return v
}

/** One block of the walked cascade, by id. */
const blockOf = (x, id, path) => need((x.c?.blocks || []).find((b) => b.id === id), path)

/** Read one quantity of an analysis by path. See the module comment for the list. */
export function readQuantity(x, p, path) {
  const parts = path.split('.')
  const [head, ...rest] = parts
  switch (head) {
    case 'total':
      return need(need(x.c, path)[rest[0]], path)
    case 'cum': {
      const b = need(need(x.c, path).blocks[Number(rest[0]) - 1], path)
      if (rest[1] === 'gain') return b.cumGainDb
      if (rest[1] === 'nf') return b.cumNfDb
      if (rest[1] === 'iip3') return b.cumIip3Dbm
      return need(undefined, path)
    }
    case 'block':
      return need(blockOf(x, rest[0], path)[rest[1]], path)
    case 'share': {
      const b = blockOf(x, rest[0], path)
      if (rest[1] === 'noise') return b.noiseShare
      if (rest[1] === 'ip3') return b.ip3Share
      if (rest[1] === 'power') return b.powerShare
      return need(undefined, path)
    }
    case 'level': {
      const node = need(need(x.v, path).nodes[Number(rest[0])], path)
      if (rest[1] === 'signal') return node.signalDbm
      if (rest[1] === 'noise') return node.noiseDbm
      if (rest[1] === 'snr') return node.snrDb
      if (rest[1] === 'drive') return node.driveDbm
      return need(undefined, path)
    }
    case 'floor': {
      const v = need(x.v, path)
      if (rest[0] === 'dbm' || rest[0] === undefined) return v.floorDbm
      if (rest[0] === 'bandwidth') return v.bandwidthHz
      return need(undefined, path)
    }
    case 'snr': {
      const v = need(x.v, path)
      if (rest[0] === 'in') return v.snrInDb
      if (rest[0] === 'out') return v.snrOutDb
      return need(undefined, path)
    }
    case 'limits':
      return need(need(x.v, path).limits[rest[0] || 'backoffDb'], path)
    case 'headline':
      return need(x.headline, path).value
    default:
      // Anything else is read off the analysis by its own path, so a lane that
      // needs a quantity nobody named above is not blocked on this file. It
      // still throws when the path names nothing, which is the point.
      return need(walk(x, parts), path)
  }
}
