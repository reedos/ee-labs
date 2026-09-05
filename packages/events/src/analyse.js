// What the run means: the truth table it should have obeyed, the pulses it
// should not have made, the path that sets the clock period.
//
// Everything here is exact arithmetic on the netlist or on the event list. The
// truth table is a static evaluation with no delays at all, which is what makes
// it independent evidence: `fuzz.test.js` requires the simulator's settled
// state to equal it for every input vector, and neither one is derived from
// the other.

import { EventsError, normalize, resolveValues, topoOrder } from './netlist.js'
import { simulate } from './simulate.js'

/**
 * The steady state of a combinational netlist for one input vector, by
 * evaluating each gate once in topological order and resolving each net from
 * everything driving it. No time, no events.
 *
 * @param vector  { [input]: 0 | 1 }
 * @returns { [net]: 0 | 1 }
 */
export function evaluate(net, vector) {
  const norm = net.drivers ? net : normalize(net)
  if (norm.flops.length) throw new EventsError('has-memory', `this netlist has ${norm.flops.length} flip-flops, and a flip-flop's output depends on when, not only on what`, { flops: norm.flops.map((f) => f.id) })
  const order = topoOrder(norm)
  const contrib = new Map(norm.nets.map((n) => [n, new Map()]))
  const v = {}
  const settle = (name) => {
    const r = resolveValues(norm.resolve.get(name), [...contrib.get(name).values()])
    if (r.conflict) throw new EventsError('driver-conflict', `the drivers of "${name}" disagree, and it resolves as "single"`, { net: name, drivers: [...contrib.get(name).keys()] })
    v[name] = r.value
  }
  for (const s of norm.sources) {
    if (s.kind !== 'input') throw new EventsError('driven-input', `"${s.id}" is a ${s.kind} source, and a truth table needs inputs it can hold still`, { id: s.id, kind: s.kind })
    contrib.get(s.out).set(s.id, vector[s.out] ?? s.value)
  }
  for (const name of norm.nets) if (contrib.get(name).size) settle(name)
  for (const c of order) {
    contrib.get(c.out).set(c.id, c.kind === 'wire' ? v[c.from] : c.fn(c.in.map((s) => v[s])))
    settle(c.out)
  }
  return v
}

/**
 * The whole truth table of a combinational netlist.
 *
 * @returns {{
 *   inputs: string[], outputs: string[],
 *   rows: Array<{ index: number, in: number[], out: number[] }>,   // index counts with inputs[0] as the high bit
 *   minterms: { [output]: number[] }
 * }}
 */
export function truthTable(net, opts = {}) {
  const norm = net.drivers ? net : normalize(net)
  if (norm.flops.length)
    throw new EventsError('has-memory', `this netlist has ${norm.flops.length} flip-flops, and a flip-flop's output depends on when, not only on what`, { flops: norm.flops.map((f) => f.id) })
  const inputs = opts.inputs || norm.inputs
  const outputs = opts.outputs || norm.outputs
  if (!inputs.length) throw new EventsError('no-inputs', 'a truth table needs at least one input, and this netlist declares none')
  if (inputs.length > 16) throw new EventsError('too-wide', `${inputs.length} inputs is ${2 ** inputs.length} rows, and this engine tables up to 16`, { inputs: inputs.length })
  const rows = []
  const minterms = Object.fromEntries(outputs.map((o) => [o, []]))
  const n = inputs.length
  for (let i = 0; i < 2 ** n; i++) {
    const bits = inputs.map((_, k) => (i >> (n - 1 - k)) & 1)
    const v = evaluate(norm, Object.fromEntries(inputs.map((s, k) => [s, bits[k]])))
    const out = outputs.map((o) => v[o])
    rows.push({ index: i, in: bits, out })
    outputs.forEach((o, k) => {
      if (out[k] === 1) minterms[o].push(i)
    })
  }
  return { inputs, outputs, rows, minterms }
}

/**
 * Every pulse on `signal`: a change followed by a change back, with the width
 * between them.
 *
 * A pulse is not by itself a defect. It is a glitch when the value on both
 * sides of it is the same value the truth table asks for, which is what
 * `hazardOf` measures.
 */
export function pulsesOf(res, signal) {
  const es = res.events.filter((e) => e.signal === signal)
  const out = []
  for (let i = 0; i + 1 < es.length; i++) if (es[i].to !== es[i + 1].to) out.push({ from: es[i].t, to: es[i + 1].t, width: es[i + 1].t - es[i].t, value: es[i].to })
  return out
}

/**
 * One input change on a combinational netlist, and what the output did.
 *
 * `input` is the source to move and `from`/`to` its two values. The truth
 * table says what the output is before and after. When those agree and the
 * output pulsed anyway, the pulse is a static hazard, and its width is the
 * difference between the two paths that reconverge on it.
 *
 * @returns {{
 *   before: number, after: number, static: boolean,
 *   pulses: Array<{ from, to, width, value }>, hazard: null | { width, at, value },
 *   result: object                                    // the run, for a timing diagram
 * }}
 */
export function hazardOf(net, { input, from, to, output, at = 100, tEnd }) {
  const norm = net.drivers ? net : normalize(net)
  const hold = Object.fromEntries(norm.sources.filter((s) => s.kind === 'input').map((s) => [s.id, s.value]))
  const table = (v) => {
    const vec = { ...hold, [input]: v }
    return evaluate(norm, vec)[output]
  }
  const before = table(from)
  const after = table(to)
  const stepped = {
    ...norm,
    sources: norm.sources.map((s) => (s.id === input ? { ...s, kind: 'step', at, from, to } : s)),
    drivers: new Map([...norm.drivers].map(([name, ds]) => [name, ds.map((d) => (d.id === input ? { ...d, kind: 'step', at, from, to } : d))])),
  }
  const result = simulate(stepped, { tEnd: tEnd ?? at + 20 * maxDelay(norm) + 100 })
  const pulses = pulsesOf(result, output).filter((p) => p.from >= at)
  const glitch = before === after ? pulses.find((p) => p.value !== before) : null
  return { before, after, static: before === after, pulses, hazard: glitch ? { width: glitch.width, at: glitch.from, value: glitch.value } : null, result }
}

const maxDelay = (norm) => [...norm.gates, ...norm.wires].reduce((m, c) => Math.max(m, c.tr, c.tf), 1)

/**
 * The longest and shortest combinational delay from a startpoint to an
 * endpoint, in picoseconds.
 *
 * Startpoints are the primary inputs and the flip-flop outputs. Endpoints are
 * the declared outputs and the flip-flop D inputs. Each cell contributes the
 * larger of its rise and fall delay to the long path and the smaller to the
 * short one, because the critical path is the worst case over both directions
 * and the hold path is the best case.
 *
 * @returns {{
 *   long: { delay, path: string[], from, to },
 *   short: { delay, path: string[], from, to },
 *   arrival: { [signal]: { long, short, viaLong, viaShort } },
 *   endpoints: Array<{ signal, kind, long, short, path }>
 * }}
 */
export function timingPaths(net, opts = {}) {
  const norm = net.drivers ? net : normalize(net)
  const order = topoOrder(norm)
  const arrival = {}
  // `starts: 'flops'` times the register-to-register paths only. A primary
  // input then has no arrival at all, so a path that comes in from outside the
  // clocked design is left out rather than counted as arriving at zero. That
  // is what a clock period is about, and it is what `fMax` asks for.
  const outside = opts.starts === 'flops'
  // A net's arrival is the latest of everything driving it, and its shortest is
  // the earliest, so a wired bus is timed the way a reader would time it.
  const merge = (name, a) => {
    const had = arrival[name]
    if (!had) {
      arrival[name] = a
      return
    }
    arrival[name] = {
      long: Math.max(had.long, a.long),
      short: Math.min(had.short, a.short),
      viaLong: a.long > had.long ? a.viaLong : had.viaLong,
      viaShort: a.short < had.short ? a.viaShort : had.viaShort,
    }
  }
  for (const s of norm.sources) merge(s.out, outside ? { long: -Infinity, short: Infinity, viaLong: null, viaShort: null } : { long: 0, short: 0, viaLong: null, viaShort: null })
  for (const f of norm.flops) merge(f.out, { long: f.tcq, short: f.tcq, viaLong: null, viaShort: null })
  for (const c of order) {
    const ins = c.kind === 'wire' ? [c.from] : c.in
    const up = Math.max(c.tr, c.tf)
    const dn = Math.min(c.tr, c.tf)
    let long = -Infinity
    let short = Infinity
    let viaLong = null
    let viaShort = null
    for (const s of ins) {
      const a = arrival[s]
      if (a.long + up > long) {
        long = a.long + up
        viaLong = s
      }
      if (a.short + dn < short) {
        short = a.short + dn
        viaShort = s
      }
    }
    merge(c.out, { long, short, viaLong, viaShort })
  }
  const trace = (signal, key) => {
    const path = [signal]
    let s = signal
    while (arrival[s] && arrival[s][key]) {
      s = arrival[s][key]
      path.unshift(s)
    }
    return path
  }
  const ends = [
    ...norm.outputs.map((o) => ({ signal: o, kind: 'output' })),
    ...norm.flops.map((f) => ({ signal: f.d, kind: 'flop', flop: f.id })),
  ]
  const endpoints = ends
    .map((e) => ({ ...e, long: arrival[e.signal].long, short: arrival[e.signal].short, path: trace(e.signal, 'viaLong'), shortPath: trace(e.signal, 'viaShort') }))
    .filter((e) => Number.isFinite(e.long) && Number.isFinite(e.short))
  if (!endpoints.length)
    throw new EventsError(
      'no-endpoints',
      outside ? 'no path in this netlist runs from one flip-flop to another' : 'this netlist declares no outputs and has no flip-flops, so there is no path to time',
    )
  const worst = endpoints.reduce((a, b) => (b.long > a.long ? b : a))
  const best = endpoints.reduce((a, b) => (b.short < a.short ? b : a))
  return {
    long: { delay: worst.long, path: worst.path, from: worst.path[0], to: worst.signal },
    short: { delay: best.short, path: trace(best.signal, 'viaShort'), from: trace(best.signal, 'viaShort')[0], to: best.signal },
    arrival,
    endpoints,
  }
}

/** The longest path, as `{ delay, path, from, to }`. */
export const criticalPath = (net) => timingPaths(net).long

/**
 * The clock period a synchronous design closes at, and the terms of it.
 *
 * Setup:  T ≥ t_cq + t_pd + t_su − t_skew, where skew is how much later the
 *         capturing clock arrives than the launching one.
 * Hold:   t_cq + t_pd(min) ≥ t_h + t_skew, which does not involve T at all.
 *         A hold failure is not fixed by slowing the clock, and that is the
 *         lesson the number carries.
 *
 * @returns {{ tMin, fMax, terms: { tcq, tpd, tsu, skew }, holdSlack, tpdShort, path }}
 */
export function fMax(net, opts = {}) {
  const norm = net.drivers ? net : normalize(net)
  if (!norm.flops.length) throw new EventsError('no-flops', 'a maximum clock frequency needs flip-flops, and this netlist has none')
  const skew = opts.skew ?? 0
  const paths = timingPaths(norm, { starts: 'flops' })
  // Only a path that ends at a flip-flop's D constrains the clock. A primary
  // output has a clock-to-output time, and that is a different number.
  const ends = paths.endpoints.filter((e) => e.kind === 'flop')
  if (!ends.length) throw new EventsError('no-endpoints', 'no path in this netlist runs from one flip-flop to another')
  const worst = ends.reduce((a, b) => (b.long > a.long ? b : a))
  const best = ends.reduce((a, b) => (b.short < a.short ? b : a))
  const tcq = Math.max(...norm.flops.map((f) => f.tcq))
  const tsu = Math.max(...norm.flops.map((f) => f.tsu))
  const th = Math.max(...norm.flops.map((f) => f.th))
  // The path arrival already carries the launching flip-flop's clock-to-Q, so
  // the sum is the arrival at D plus the setup time, less the skew. The logic's
  // own delay is what is left after the launching flip-flop's share.
  const launcher = norm.flops.find((f) => f.id === worst.path[0])
  const tpd = worst.long - (launcher ? launcher.tcq : 0)
  const tMin = worst.long + tsu - skew
  const holdSlack = best.short - th - skew
  return {
    tMin,
    fMax: 1 / (tMin * 1e-12),
    terms: { tcq, tpd, tsu, skew },
    holdSlack,
    tpdShort: best.short,
    path: { delay: worst.long, path: worst.path, from: worst.path[0], to: worst.signal },
    shortPath: { delay: best.short, path: best.shortPath, from: best.shortPath[0], to: best.signal },
  }
}
