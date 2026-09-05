/**
 * What the student reads, per experiment, in three registers:
 *
 *   see — what the picture shows at the defaults, in a few lines;
 *   try — knob moves with the reading each one produces;
 *   why — the reasoning, for after the picture has made its point.
 *
 * Every number a step quotes is a measurement. A step's `set` is applied on top
 * of the defaults, and each `reads` pair is a quantity path with the value the
 * sentence quotes. experiments.test.js runs each step and checks both the pair
 * and every number-with-unit in the sentence against it.
 *
 * A `see` or a `why` that compares two settings carries `seeAlso` or `whyAlso`,
 * a list of `{ set, reads }`. Those readings are measured at that setting, so a
 * sentence about the other position of a knob is measured there and not taken
 * on trust.
 *
 * Paths, all times in picoseconds and all frequencies in hertz:
 *
 *   final.<signal>                     the settled value, 0 or 1
 *   at.<signal>.<t>                    the value at time t
 *   edge.<signal>.<k>                  the time of the k-th transition, k from 1
 *   edges.<signal>                     how many times it changed
 *   first.<signal>  last.<signal>      the first and last transition times
 *   pulse.<signal>.<width|from|to>     the first pulse on that signal
 *   path.<long|short>                  the longest and shortest arrival
 *   arrive.<net>                       that net's longest arrival
 *   gates  levels  rows  inputs        counts from the netlist and the table
 *   table.<row>.<output>               one cell of the truth table
 *   minterms.<output>                  how many minterms
 *   primes  cubes  literals            the minimisation's counts
 *   canon.<cubes|literals>             the same two for the canonical form
 *   swallowed  swallow.<k>.<width>     the pulses the delay model rejected
 *   refusal                            the code of the refusal, as a string
 */
import { levelsOf, valueOf } from './analysis.js'
import { A_LESSONS } from './lessons/a.js'
import { B_LESSONS } from './lessons/b.js'
import { C_LESSONS } from './lessons/c.js'
import { D_LESSONS } from './lessons/d.js'

export const LESSONS = { ...A_LESSONS, ...B_LESSONS, ...C_LESSONS, ...D_LESSONS }

const edges = (x, signal) => x.res.events.filter((e) => e.signal === signal)

/** One reading of an analysis, by path. */
export function readQuantity(x, p, path, exp) {
  const [head, ...rest] = path.split('.')
  switch (head) {
    case 'final':
      return need(x.res.final[rest[0]], path)
    case 'at':
      return valueOf(x, rest[0], Number(rest[1]))
    case 'edge': {
      const e = edges(x, rest[0])[Number(rest[1]) - 1]
      if (!e) throw new Error(`${path}: ${rest[0]} changed ${edges(x, rest[0]).length} times`)
      return e.t
    }
    case 'edges':
      return edges(x, rest[0]).length
    case 'first': {
      const e = edges(x, rest[0])[0]
      if (!e) throw new Error(`${path}: ${rest[0]} never changed`)
      return e.t
    }
    case 'last': {
      const es = edges(x, rest[0])
      if (!es.length) throw new Error(`${path}: ${rest[0]} never changed`)
      return es[es.length - 1].t
    }
    case 'pulse': {
      const es = edges(x, rest[0])
      const k = es.findIndex((e, i) => es[i + 1] && es[i + 1].to !== e.to)
      if (k < 0) throw new Error(`${path}: ${rest[0]} has no pulse`)
      const [a, b] = [es[k], es[k + 1]]
      return rest[1] === 'width' ? b.t - a.t : rest[1] === 'from' ? a.t : b.t
    }
    case 'path':
      return need(x.paths && x.paths[rest[0]] && x.paths[rest[0]].delay, path)
    case 'arrive': {
      const a = x.paths && x.paths.arrival[rest[0]]
      if (!a) throw new Error(`${path}: ${rest[0]} is not a net of this netlist`)
      return a.long
    }
    case 'gates':
      return x.norm.gates.length
    case 'levels':
      return levelsOf(x.norm)
    case 'rows':
      return need(x.table && x.table.rows.length, path)
    case 'inputs':
      return need(x.table && x.table.inputs.length, path)
    case 'table': {
      const row = need(x.table && x.table.rows[Number(rest[0])], path)
      const k = x.table.outputs.indexOf(rest[1])
      if (k < 0) throw new Error(`${path}: this netlist has no output called "${rest[1]}"`)
      return row.out[k]
    }
    case 'minterms':
      return need(x.table && x.table.minterms[rest[0]], path).length
    case 'primes':
      return need(x.minimise && x.minimise.primes, path).length
    case 'cubes':
      return need(x.minimise && x.minimise.cubes, path)
    case 'literals':
      return need(x.minimise && x.minimise.literals, path)
    case 'canon':
      return need(x.minimise && x.minimise.canonical && x.minimise.canonical[rest[0]], path)
    case 'swallowed':
      return x.res.swallowed.length
    case 'swallow': {
      const s = x.res.swallowed[Number(rest[0]) - 1]
      if (!s) throw new Error(`${path}: this run swallowed ${x.res.swallowed.length} pulses`)
      return s[rest[1]]
    }
    case 'refusal':
      return x.refusal ? x.refusal.code : null
    default:
      throw new Error(`unknown quantity path: ${path}`)
  }
}

const need = (v, path) => {
  if (v == null) throw new Error(`${path}: this experiment did not ask for that analysis`)
  return v
}
