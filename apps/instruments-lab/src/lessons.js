/**
 * What the student reads, per experiment, in three registers:
 *
 *   see — what the picture shows at the defaults, in a few lines;
 *   try — knob moves with the reading each one produces;
 *   why — the reasoning, for after the picture has made its point.
 *
 * Every number a step quotes is a measurement. A step's `set` is applied on top
 * of the defaults, its `at` moves the cursor, and each `reads` pair is a
 * quantity path (or a function of the analysis) with the value the sentence
 * quotes. experiments.test.js solves each step and checks both the pair and
 * every number-with-unit in the sentence against it.
 *
 * Paths: v.<node>, volt.<id>, i.<id>, p.<id>, vd.<a>.<b> (node a minus node b),
 * mag.<q>.<id> and deg.<q>.<id> (phasor length and angle), omega, period,
 * H.<mag|db|deg> and Z.<mag|deg> at the drive frequency, corner (the −3 dB
 * frequency of the sweep), ratio.<dc|hf>, risetime, alias, zin.<mag|deg>,
 * detect.<mean|rms>, rbw, fzero, qfactor, meter.<true|read|shown|step|spec|pct|error>,
 * and sens.<key|quad|worst>.
 */
import { complex as cx } from '@ee-labs/network'
import { aliasOf, atDrive, bandOf, cornerSolve, envelopeAt, riseTime } from './math.js'
import { LESSONS_A } from './lessons/a.js'
import { LESSONS_B } from './lessons/b.js'
import { LESSONS_C } from './lessons/c.js'
import { LESSONS_D } from './lessons/d.js'
import { LESSONS_E } from './lessons/e.js'
import { LESSONS_F } from './lessons/f.js'

const DEG = 180 / Math.PI

export const LESSONS = { ...LESSONS_A, ...LESSONS_B, ...LESSONS_C, ...LESSONS_D, ...LESSONS_E, ...LESSONS_F }

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
    case 'mag':
      return cx.cabs(x.ac[rest[0]][rest[1]])
    case 'deg':
      return cx.carg(x.ac[rest[0]][rest[1]]) * DEG
    case 'omega':
      return x.omega
    case 'period':
      return (2 * Math.PI) / x.omega
    case 'zin':
      return rest[0] === 'deg' ? cx.carg(x.ac.v.in) * DEG - 90 : cx.cabs(x.ac.v.in) / p.I
    case 'H': {
      const at = atDrive(exp, x)
      if (rest[0] === 'mag') return cx.cabs(at.H)
      if (rest[0] === 'db') return 20 * Math.log10(cx.cabs(at.H))
      return cx.carg(at.H) * DEG
    }
    case 'Z': {
      const at = atDrive(exp, x)
      return rest[0] === 'deg' ? cx.carg(at.Z) * DEG : cx.cabs(at.Z)
    }
    case 'corner':
      return cornerSolve(exp, p)
    case 'ratio':
      return rest[0] === 'hf' ? p.C1 / (p.C1 + p.C2) : p.R2 / (p.R1 + p.R2)
    case 'risetime':
      return riseTime(x.tr, (s) => s.v.in).tr
    case 'alias':
      return aliasOf(p.f, p.fs).f
    case 'detect':
      return x.detector[rest[0]]
    case 'rbw':
      return bandOf(exp, p).bw
    case 'fzero':
      return bandOf(exp, p).f0
    case 'qfactor': {
      const b = bandOf(exp, p)
      return b.f0 / b.bw
    }
    case 'meter':
      return x.meter[rest[0]]
    case 'sens': {
      if (rest[0] === 'quad') return x.sens.quad
      if (rest[0] === 'worst') return x.sens.worst
      return x.sens.rows.find((r) => r.key === rest[0]).s
    }
    default:
      throw new Error(`unknown quantity path "${path}"`)
  }
}
