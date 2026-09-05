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
 *   gap.<a>.<i>.<b>.<j>                how long after b's j-th transition a's
 *                                      i-th happened, which is the delay from
 *                                      one signal to another
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
 *   flops                              how many flip-flops
 *   flop.<tcq|tsu|th|window>           the first flip-flop's own three times,
 *                                      and the two of them that make a window
 *   word.<prefix>.<n>.<t>              q(n-1)..q0 at time t, as the number
 *   tmin  fmax  holdslack              the clock period in ps, f_max in hertz
 *   period  setupslack                 the period this run is clocked at
 *   violations                         how many setup or hold violations
 *   violation.<k>.<kind|slack|actual|required|t>
 *   states  srows  sbits  unused       the state machine's counts
 *   machine                            Moore or Mealy, as the word
 *   expr.<name>                        one minimised equation, as its text
 *   eqliterals.<name>  eqcubes.<name>  one equation's literal and cube counts
 *   mtbf  settling                     both in picoseconds, like every time
 *   mtbfyears                          the same mean time, in years
 *   window.<width|first|last>          the swept knob values that report a
 *                                      violation, and the two ends of them
 *
 * Every time a path returns is in picoseconds, the mean time between failures
 * included, because the register test reads every quoted time in the netlist's
 * own unit. A sentence that says "16.93 years" reads `mtbfyears` instead.
 */
import { analyse, levelsOf, valueOf } from './analysis.js'
import { A_LESSONS } from './lessons/a.js'
import { B_LESSONS } from './lessons/b.js'
import { C_LESSONS } from './lessons/c.js'
import { D_LESSONS } from './lessons/d.js'
import { E_LESSONS } from './lessons/e.js'
import { F_LESSONS } from './lessons/f.js'
import { G_LESSONS } from './lessons/g.js'
import { H_LESSONS } from './lessons/h.js'

export const LESSONS = { ...A_LESSONS, ...B_LESSONS, ...C_LESSONS, ...D_LESSONS, ...E_LESSONS, ...F_LESSONS, ...G_LESSONS, ...H_LESSONS }

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
    case 'gap': {
      const one = edges(x, rest[0])[Number(rest[1]) - 1]
      const two = edges(x, rest[2])[Number(rest[3]) - 1]
      if (!one) throw new Error(`${path}: ${rest[0]} changed ${edges(x, rest[0]).length} times`)
      if (!two) throw new Error(`${path}: ${rest[2]} changed ${edges(x, rest[2]).length} times`)
      return one.t - two.t
    }
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
    case 'flops':
      return x.norm.flops.length
    case 'flop': {
      const f = x.norm.flops[0]
      if (!f) throw new Error(`${path}: this netlist has no flip-flop`)
      return rest[0] === 'window' ? f.tsu + f.th : need(f[rest[0]], path)
    }
    case 'word': {
      const n = Number(rest[1])
      const t = Number(rest[2])
      let acc = 0
      for (let i = n - 1; i >= 0; i--) acc = acc * 2 + valueOf(x, `${rest[0]}${i}`, t)
      return acc
    }
    case 'tmin':
      return need(x.closing && x.closing.tMin, path)
    case 'fmax':
      return need(x.closing && x.closing.fMax, path)
    case 'holdslack':
      return needNumber(x.closing && x.closing.holdSlack, path)
    case 'period':
      return need(x.closing && x.closing.period, path)
    case 'setupslack':
      return needNumber(x.closing && x.closing.setupSlack, path)
    case 'violations':
      return x.res.violations.length
    case 'violation': {
      const v = x.res.violations[Number(rest[0]) - 1]
      if (!v) throw new Error(`${path}: this run reported ${x.res.violations.length} violations`)
      return rest[1] === 'kind' ? v.kind : need(v[rest[1]], path)
    }
    case 'states':
      return need(x.fsm && x.fsm.table.states.length, path)
    case 'srows':
      return need(x.fsm && x.fsm.table.rows.length, path)
    case 'sbits':
      return need(x.fsm && x.fsm.table.bits, path)
    case 'unused':
      return needNumber(x.fsm && x.fsm.table.unused, path)
    case 'machine':
      return need(x.fsm && x.fsm.table.type, path)
    case 'expr':
      return need(x.fsm && x.fsm.equations[rest[0]] && x.fsm.equations[rest[0]].expression, path)
    case 'eqliterals':
      return need(x.fsm && x.fsm.equations[rest[0]] && x.fsm.equations[rest[0]].literals, path)
    case 'eqcubes':
      return need(x.fsm && x.fsm.equations[rest[0]] && x.fsm.equations[rest[0]].cubes, path)
    case 'mtbf':
      return need(x.rate && x.rate.mtbf, path) * 1e12
    case 'mtbfyears':
      return need(x.rate && x.rate.mtbf, path) / (365.25 * 24 * 3600)
    case 'settling':
      return need(x.settling, path)
    case 'window': {
      // The one reading that is a sweep rather than a run. An experiment that
      // asks for it names the knob to sweep and the range, and this walks that
      // range one whole unit at a time and collects the settings that report a
      // violation. So the window's width is measured on the same engine that
      // draws it, and it moves when the flip-flop's two times move.
      if (!exp || !exp.sweep) throw new Error(`${path}: this experiment names no knob to sweep`)
      const [lo, hi] = exp.sweepRange(p)
      const hits = []
      for (let v = lo; v <= hi; v++) if (analyse(exp, { ...p, [exp.sweep]: v }).res.violations.length) hits.push(v)
      if (!hits.length) throw new Error(`${path}: nothing between ${lo} and ${hi} reports a violation`)
      if (rest[0] === 'first') return hits[0]
      if (rest[0] === 'last') return hits[hits.length - 1]
      if (rest[0] === 'width') return hits.length
      throw new Error(`${path}: a window reads its width, its first or its last`)
    }
    default:
      throw new Error(`unknown quantity path: ${path}`)
  }
}

const need = (v, path) => {
  if (v == null) throw new Error(`${path}: this experiment did not ask for that analysis`)
  return v
}

/** The same, for a reading whose right answer can be 0 or negative. */
const needNumber = (v, path) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${path}: this experiment did not ask for that analysis`)
  return v
}
