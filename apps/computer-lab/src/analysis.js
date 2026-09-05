// One call from an experiment to the engine, and everything a pane or a lesson
// can read off the result.
//
// An experiment says what it wants run. `analyse` runs it once, and every pane
// reads the same object, so the datapath view, the schedule and the topbar can
// never disagree about a cycle.
//
// The model card is a parameter rather than an import here. `experiments.test.js`
// runs every experiment twice, once at the card and once at a card with every
// delay doubled, and requires every time to double and every count to stay
// where it is. A number typed into a group file instead of computed from the
// engine fails that test.

import { normalize, simulate, timingPaths } from '@ee-labs/events'
import { CARD, psOf, timingOf } from './engine/card.js'
import { runDatapath } from './engine/datapath.js'
import { runPipeline, predictorRun, loopPattern } from './engine/pipeline.js'
import { cacheRun, amat, amat2, pagingOf } from './engine/cache.js'
import { multicycleOf, controlTable, stateMachine, walkOf } from './engine/control.js'
import { amdahl, busOf, cpiOf, interruptOf, worthOf } from './engine/cost.js'
import { programOf } from './engine/programs.js'
import { assemble } from './engine/datapath.js'

/**
 * Run one experiment at one setting.
 *
 * @returns {{
 *   exp, p, card, timing,          // the model card's numbers, always
 *   net, norm, res, paths,         // a netlist, its run and its arrivals
 *   alt,                           // a second netlist, where an experiment compares two
 *   run, pipe, ref,                // the one-cycle machine, the five-stage one, and the reference
 *   cache, sweep,                  // a cache over a trace, and a sweep of one knob
 *   control, machine, multi,       // the control table, the state machine, the multicycle count
 *   cost, predict,                 // the arithmetic over the stated mix, and the predictors
 *   q                              // every quantity a lesson may read, by path
 * }}
 */
export function analyse(exp, p, base = CARD) {
  // An experiment may turn one entry of the model card, such as the memory's
  // access time. It changes the card rather than the number it produces, so
  // every quantity downstream moves with it and none of them is edited twice.
  const card = exp.card ? exp.card(p, base) : base
  const x = { exp, p, card, base, timing: timingOf(card) }
  const wants = exp.wants || []

  if (exp.net) {
    x.net = exp.net(p, card)
    x.norm = normalize(x.net)
    x.res = simulate(x.norm, { tEnd: exp.tEnd ? exp.tEnd(p, card) : 200 * card.gate })
    x.paths = timingPaths(x.norm)
  }
  if (exp.alt) {
    const net = exp.alt(p, card)
    const norm = normalize(net)
    x.alt = { net, norm, paths: timingPaths(norm), res: simulate(norm, { tEnd: exp.tEnd ? exp.tEnd(p, card) : 200 * card.gate }) }
  }
  if (exp.program) {
    const prog = programOf(exp.program(p), exp.over ? exp.over(p) : {})
    x.program = prog
    x.code = assemble(prog.code)
    const opts = { regs: prog.regs, mem: prog.mem, cycles: 4000 }
    if (wants.includes('run')) x.run = runDatapath(prog.code, opts)
    if (wants.includes('pipe')) {
      x.pipe = runPipeline(prog.code, { ...opts, forwarding: p.forwarding !== 0, resolve: p.resolve || 'execute' })
      x.pipeOther = runPipeline(prog.code, { ...opts, forwarding: p.forwarding === 0, resolve: p.resolve || 'execute' })
    }
    if (wants.includes('multi')) x.walk = walkOf(x.code)
  }
  if (wants.includes('cache')) {
    const trace = exp.trace(p, x)
    const cfg = exp.cfg(p)
    x.trace = trace
    x.cache = cacheRun(trace, cfg)
    if (exp.against) x.against = cacheRun(trace, exp.against(p))
    if (exp.against2) x.against2 = cacheRun(trace, exp.against2(p))
    if (exp.sweep) x.sweep = exp.sweep(p).map((cfgOf) => ({ cfg: cfgOf, run: cacheRun(exp.sweepTrace ? exp.sweepTrace(p, x) : trace, cfgOf) }))
    if (exp.amat) x.amat = exp.amat(p, x)
    if (exp.pages) x.pages = pagingOf(exp.pages(p))
  }
  if (wants.includes('control')) x.control = controlTable()
  if (wants.includes('machine')) {
    x.machine = stateMachine()
    x.multi = multicycleOf(card)
  }
  if (wants.includes('cost')) {
    x.cost = {
      on: cpiOf({ card }),
      off: cpiOf({ card, forwarding: false }),
      early: cpiOf({ card, resolve: 'decode' }),
      predicted: cpiOf({ card, accuracy: p.accuracy ?? 0.9 }),
      here: cpiOf({ card, forwarding: p.forwarding !== 0, resolve: p.resolve || 'execute' }),
    }
    x.cost.worth = worthOf(x.cost.off, x.cost.on)
  }
  if (wants.includes('predict')) {
    const pattern = loopPattern(p.iterations ?? 4, p.repeats ?? 10)
    x.pattern = pattern
    x.predict = Object.fromEntries(['always', 'one', 'two', 'correlate'].map((k) => [k, predictorRun(pattern, k)]))
    x.predictLong = Object.fromEntries(['always', 'one', 'two', 'correlate'].map((k) => [k, predictorRun(loopPattern(8, p.repeats ?? 10), k)]))
  }
  if (wants.includes('world')) {
    x.bus = busOf({ period: x.timing.pipePeriod, lineBytes: p.lineBytes ?? 16 })
    x.interrupt = interruptOf({ period: x.timing.pipePeriod, saves: p.saves ?? 16, rate: p.rate ?? 1e4 })
    x.amdahl = {
      adder: amdahl(card.profile.adder, p.speedup ?? 3),
      memory: amdahl(card.profile.memory, 2),
      branch: amdahl(cpiOf({ card }).terms.branch / cpiOf({ card }).cpi, Infinity),
    }
  }
  x.q = exp.quantities ? exp.quantities(x) : {}
  return x
}

/** The value one quantity path names, in the unit a lesson quotes it in. */
export function readQuantity(x, path) {
  const entry = x.q[path]
  if (!entry) throw new Error(`${path}: this experiment does not produce that quantity (it has ${Object.keys(x.q).join(', ')})`)
  return valueOf(path, entry.value)
}

/** Grid units read as picoseconds, and everything else read as it is. */
export function valueOf(path, value) {
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) throw new Error(`${path}: the engine produced ${value}`)
  return path.startsWith('ps.') ? psOf(value) : value
}

/** The kind of a quantity path, which says how to print it. */
export const kindOf = (path) => path.split('.')[0]

/** Every quantity an experiment produces, in the order it declared them. */
export const quantitiesOf = (x) => Object.entries(x.q).map(([path, entry]) => ({ path, ...entry, read: valueOf(path, entry.value) }))
