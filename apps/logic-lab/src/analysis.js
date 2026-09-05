// One call from an experiment to the engine, and everything a pane or a lesson
// can read off the result.
//
// An experiment is a netlist as a function of its knobs, plus which of the
// engine's analyses it wants. `analyse` runs them once and every pane reads the
// same object, so the timing diagram and the topbar can never disagree about
// when an event happened.

import { criticalPath, EventsError, fMax, initialValue, minimalCover, mtbf, normalize, primeImplicants, pulsesOf, simulate, timingPaths, truthTable } from '@ee-labs/events'

/**
 * The same netlist with every driven source held still.
 *
 * A truth table needs inputs it can hold, and half the experiments here step
 * one of theirs to make the timing visible. Holding the stepped source at the
 * value it starts from turns the run's netlist into the one the table is of,
 * with nothing else about it changed. The table then enumerates that input like
 * any other, so the timing view and the table view are views of one circuit.
 */
export function heldOf(norm) {
  const sources = norm.sources.map((s) => (s.kind === 'input' ? s : { id: s.id, out: s.out, kind: 'input', value: initialValue(s) }))
  return normalize({
    name: norm.name,
    unit: norm.unit,
    lib: norm.lib,
    cells: norm.cells,
    delayMode: norm.delayMode,
    resolve: Object.fromEntries(norm.resolve),
    sources,
    gates: norm.gates,
    wires: norm.wires,
    flops: norm.flops,
    outputs: norm.outputs,
  })
}

/**
 * Run one experiment at one setting.
 *
 * @returns {{
 *   net, norm, res,          // the netlist, its normal form, and the run
 *   table, paths, closing,   // the truth table, the arrivals, and f_max, where they apply
 *   minimise,                // the prime implicants and the minimum cover, where asked for
 *   rate,                    // the metastability model, where asked for
 *   refusal                  // the EventsError an experiment expects, or null
 * }}
 */
export function analyse(exp, p) {
  const net = exp.net(p)
  const out = { net, exp, p, refusal: null, table: null, paths: null, closing: null, minimise: null, rate: null }
  try {
    out.norm = normalize(net)
  } catch (e) {
    if (!(e instanceof EventsError)) throw e
    out.refusal = e
    return out
  }
  out.res = simulate(out.norm, { tEnd: exp.tEnd(p) })
  const wants = exp.wants || []
  for (const want of wants) {
    try {
      if (want === 'table') out.table = truthTable(out.held || (out.held = heldOf(out.norm)))
      if (want === 'paths') {
        out.paths = timingPaths(out.norm)
        out.critical = criticalPath(out.norm)
      }
      if (want === 'closing') out.closing = fMax(out.norm, { skew: p.skew || 0 })
      if (want === 'minimise') out.minimise = minimiseOf(out.held || (out.held = heldOf(out.norm)), exp.minimiseOf || (out.norm.outputs || [])[0])
      if (want === 'rate') out.rate = mtbf(exp.rate(p))
    } catch (e) {
      if (!(e instanceof EventsError)) throw e
      // A refusal an experiment is about (E1's ring) is the answer, not a
      // failure, and the pane renders it.
      out.refusal = e
    }
  }
  return out
}

/** The prime implicants and the minimum cover of one output of a combinational netlist. */
export function minimiseOf(net, output) {
  const norm = net.drivers ? net : normalize(net)
  const t = truthTable(norm)
  const n = t.inputs.length
  const minterms = t.minterms[output] || []
  const primes = primeImplicants(minterms, n)
  const cover = minterms.length ? minimalCover(minterms, primes, n) : { cover: [], essential: [], literals: 0, cubes: 0 }
  // The canonical form is one term per minterm, each naming every input, so its
  // two counts are arithmetic on the table rather than a second minimisation.
  const canonical = { cubes: minterms.length, literals: minterms.length * n }
  return { table: t, output, names: t.inputs, minterms, primes, canonical, ...cover }
}

/** How many gates deep the netlist is, counting from its inputs. */
export function levelsOf(norm) {
  const depth = new Map(norm.sources.map((s) => [s.id, 0]))
  for (const f of norm.flops) depth.set(f.id, 0)
  let changed = true
  const cells = [...norm.gates, ...norm.wires]
  for (let pass = 0; pass < cells.length + 1 && changed; pass++) {
    changed = false
    for (const c of cells) {
      const ins = c.kind === 'wire' ? [c.from] : c.in
      const d = 1 + Math.max(...ins.map((s) => depth.get(s) ?? 0))
      if (d !== depth.get(c.id)) {
        depth.set(c.id, d)
        changed = true
      }
    }
  }
  return Math.max(0, ...[...depth.values()])
}

/** The value of `signal` at time `t`, read off the run's waveform. */
export function valueOf(x, signal, t) {
  const w = x.res.waves[signal]
  if (!w) throw new Error(`this experiment has no signal called "${signal}"`)
  let v = w.v[0]
  for (let k = 0; k < w.t.length; k++) if (w.t[k] <= t) v = w.v[k]
  return v
}

/** Every transition of `signal`, as `{ t, from, to }`. */
export const edgesOn = (x, signal) => x.res.events.filter((e) => e.signal === signal).map((e) => ({ t: e.t, from: e.from, to: e.to }))

/** The first pulse on `signal`, or null. */
export const firstPulse = (x, signal) => pulsesOf(x.res, signal)[0] || null

/** The netlist's gate count, counting wires as the interconnect they are. */
export const gateCount = (x) => x.norm.gates.length
