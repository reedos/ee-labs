// The netlist of gates, checked and turned into the graph the simulator walks.
//
// One driver per signal, and the signal carries the driver's name. A gate
// named `p` drives the signal `p`, and any gate that lists `p` among its
// inputs reads it. That removes the whole question of what a wire is called,
// and it makes the fan-out graph a fan-out of names.
//
// A `wire` is a driver with no logic: it copies one signal to another after a
// delay. Clock skew is a wire, and so is a long interconnect. Nothing else in
// the package needs to know the difference.

import { KINDS, WIRE_DELAY, FLOP, libDelay } from './library.js'

export class EventsError extends Error {
  constructor(code, message, detail = {}) {
    super(message)
    this.name = 'EventsError'
    this.code = code
    this.detail = detail
  }
}

const SOURCE_KINDS = ['input', 'step', 'clock', 'pattern']
/** Times must be whole picoseconds: the package's exactness rests on it. */
const whole = (t, what) => {
  if (!Number.isInteger(t)) throw new EventsError('fractional-time', `${what} is ${t} ps, and times are whole picoseconds in this engine`, { t })
  return t
}
const bit = (v, what) => {
  if (v !== 0 && v !== 1) throw new EventsError('not-a-bit', `${what} is ${v}, and a signal in this engine is 0 or 1`, { v })
  return v
}

/**
 * Check a netlist and build the graph.
 *
 * @returns {{
 *   sources: Array<Source>, gates: Array<Gate>, wires: Array<Wire>, flops: Array<Flop>,
 *   drivers: Map<string, Driver>,      // signal name to the one thing that drives it
 *   readers: Map<string, string[]>,    // signal name to the ids that read it
 *   signals: string[],                 // every signal, sources first, in declaration order
 *   inputs: string[],                  // the enumerable primary inputs, in declaration order
 *   outputs: string[],
 *   delayMode: 'transport' | 'inertial',
 *   combinational: boolean,            // no flops
 *   loop: string[] | null              // one combinational cycle, if there is one
 * }}
 */
export function normalize(net) {
  if (!net || typeof net !== 'object') throw new EventsError('no-netlist', 'a netlist is an object with sources, gates and outputs')
  const lib = net.lib || {}
  const delayMode = net.delayMode || 'transport'
  if (delayMode !== 'transport' && delayMode !== 'inertial')
    throw new EventsError('unknown-delay-mode', `delayMode is "${delayMode}", and this engine has transport and inertial`, { delayMode })

  const drivers = new Map()
  const claim = (id, driver) => {
    if (!id || typeof id !== 'string') throw new EventsError('unnamed', 'every source, gate, wire and flip-flop needs an id, which is also its signal name')
    if (drivers.has(id)) throw new EventsError('two-drivers', `two things drive the signal "${id}", and a signal in this engine has one driver`, { id })
    drivers.set(id, driver)
  }

  const sources = (net.sources || []).map((s) => {
    const kind = s.kind || 'input'
    if (!SOURCE_KINDS.includes(kind)) throw new EventsError('unknown-source', `source "${s.id}" is a ${kind}, and the kinds are ${SOURCE_KINDS.join(', ')}`, { id: s.id, kind })
    const out = { ...s, kind, id: s.id }
    if (kind === 'input') out.value = bit(s.value ?? 0, `input "${s.id}"`)
    if (kind === 'step') {
      out.to = bit(s.to ?? 1, `step "${s.id}" to`)
      out.from = bit(s.from ?? out.to ^ 1, `step "${s.id}" from`)
      out.at = whole(s.at ?? 0, `step "${s.id}" at`)
    }
    if (kind === 'clock') {
      out.period = whole(s.period, `clock "${s.id}" period`)
      if (out.period < 2) throw new EventsError('short-period', `clock "${s.id}" has a period of ${out.period} ps, and a period is at least 2 ps`, { id: s.id })
      out.high = whole(s.high ?? out.period / 2, `clock "${s.id}" high time`)
      if (out.high < 1 || out.high > out.period - 1)
        throw new EventsError('bad-duty', `clock "${s.id}" is high for ${out.high} ps of ${out.period} ps, and both halves need at least 1 ps`, { id: s.id })
      out.phase = whole(s.phase ?? 0, `clock "${s.id}" phase`)
      out.init = bit(s.init ?? 0, `clock "${s.id}" init`)
    }
    if (kind === 'pattern') {
      out.bits = (s.bits || []).map((b, i) => bit(b, `pattern "${s.id}" bit ${i}`))
      if (out.bits.length < 1) throw new EventsError('empty-pattern', `pattern "${s.id}" has no bits`, { id: s.id })
      out.period = whole(s.period, `pattern "${s.id}" period`)
      out.at = whole(s.at ?? 0, `pattern "${s.id}" at`)
      out.repeat = !!s.repeat
    }
    claim(out.id, { ...out, role: 'source' })
    return out
  })

  const gates = (net.gates || []).map((g) => {
    const spec = KINDS[g.kind]
    if (!spec) throw new EventsError('unknown-gate', `gate "${g.id}" is a ${g.kind}, and the library has ${Object.keys(KINDS).join(', ')}`, { id: g.id, kind: g.kind })
    const ins = g.in || []
    const [lo, hi] = spec.fanIn
    if (ins.length < lo || ins.length > hi)
      throw new EventsError('fan-in', `${spec.name} "${g.id}" has ${ins.length} inputs, and the library holds ${lo} to ${hi}`, { id: g.id, kind: g.kind, fanIn: ins.length })
    const base = g.delay ?? libDelay(g.kind, ins.length, lib)
    if (base == null) throw new EventsError('no-delay', `the library has no delay for a ${ins.length}-input ${spec.name}`, { id: g.id, kind: g.kind })
    const tr = whole(g.tr ?? base, `gate "${g.id}" rise delay`)
    const tf = whole(g.tf ?? base, `gate "${g.id}" fall delay`)
    if (tr < 1 || tf < 1)
      throw new EventsError('zero-delay', `gate "${g.id}" has a delay of ${Math.min(tr, tf)} ps, and this engine has no zero-delay gate: a zero-delay loop has no waveform`, { id: g.id })
    const out = { id: g.id, kind: g.kind, in: [...ins], delay: whole(base, `gate "${g.id}" delay`), tr, tf, init: g.init == null ? null : bit(g.init, `gate "${g.id}" init`) }
    claim(out.id, { ...out, role: 'gate' })
    return out
  })

  const wires = (net.wires || []).map((w) => {
    const d = whole(w.delay ?? WIRE_DELAY, `wire "${w.id}" delay`)
    if (d < 1) throw new EventsError('zero-delay', `wire "${w.id}" has a delay of ${d} ps, and this engine has no zero-delay wire`, { id: w.id })
    const out = { id: w.id, kind: 'wire', in: [w.from], from: w.from, delay: d, tr: d, tf: d, init: w.init == null ? null : bit(w.init, `wire "${w.id}" init`) }
    claim(out.id, { ...out, role: 'wire' })
    return out
  })

  const flops = (net.flops || []).map((f) => {
    const out = {
      id: f.id,
      kind: 'dff',
      d: f.d,
      clk: f.clk,
      edge: f.edge || 'rising',
      tcq: whole(f.tcq ?? FLOP.tcq, `flip-flop "${f.id}" clock-to-Q`),
      tsu: whole(f.tsu ?? FLOP.tsu, `flip-flop "${f.id}" setup time`),
      th: whole(f.th ?? FLOP.th, `flip-flop "${f.id}" hold time`),
      init: bit(f.init ?? 0, `flip-flop "${f.id}" init`),
    }
    if (out.edge !== 'rising' && out.edge !== 'falling') throw new EventsError('unknown-edge', `flip-flop "${out.id}" triggers on a ${out.edge} edge, and this engine has rising and falling`, { id: out.id })
    if (out.tcq < 1) throw new EventsError('zero-delay', `flip-flop "${out.id}" has a clock-to-Q of ${out.tcq} ps, and this engine has none`, { id: out.id })
    claim(out.id, { ...out, role: 'flop' })
    return out
  })

  // Every input names a signal something drives.
  const readers = new Map()
  const reads = (reader, signal, what) => {
    if (!drivers.has(signal)) throw new EventsError('undriven', `${what} reads "${signal}", and nothing drives it`, { reader, signal })
    if (!readers.has(signal)) readers.set(signal, [])
    readers.get(signal).push(reader)
  }
  for (const g of gates) g.in.forEach((s, i) => reads(g.id, s, `${KINDS[g.kind].name} "${g.id}" input ${i + 1}`))
  for (const w of wires) reads(w.id, w.from, `wire "${w.id}"`)
  for (const f of flops) {
    reads(f.id, f.d, `flip-flop "${f.id}" D`)
    reads(f.id, f.clk, `flip-flop "${f.id}" clock`)
  }

  const outputs = net.outputs || []
  for (const o of outputs) if (!drivers.has(o)) throw new EventsError('undriven', `the netlist names "${o}" as an output, and nothing drives it`, { signal: o })

  const signals = [...sources.map((s) => s.id), ...gates.map((g) => g.id), ...wires.map((w) => w.id), ...flops.map((f) => f.id)]
  const inputs = sources.filter((s) => s.kind === 'input').map((s) => s.id)

  return {
    name: net.name || '',
    lib,
    delayMode,
    sources,
    gates,
    wires,
    flops,
    drivers,
    readers,
    signals,
    inputs,
    outputs,
    combinational: flops.length === 0,
    loop: findLoop(gates, wires),
  }
}

/**
 * One cycle among the gates and wires, as the list of ids around it, or null.
 * A cycle is not an error: an SR latch is two NOR gates in a cycle, and it is
 * the whole point of the sequential group. It is what `truthTable` and
 * `criticalPath` decline, with the cycle named as the reason.
 */
export function findLoop(gates, wires) {
  const cells = [...gates, ...wires]
  const byId = new Map(cells.map((c) => [c.id, c]))
  const state = new Map()
  const stack = []
  let found = null
  const walk = (id) => {
    if (found) return
    const cell = byId.get(id)
    if (!cell) return
    const s = state.get(id)
    if (s === 'done') return
    if (s === 'open') {
      found = stack.slice(stack.indexOf(id))
      return
    }
    state.set(id, 'open')
    stack.push(id)
    for (const src of cell.in) walk(src)
    stack.pop()
    state.set(id, 'done')
  }
  for (const c of cells) walk(c.id)
  return found
}

/**
 * The gates and wires in an order where every cell comes after the cells it
 * reads. Throws `combinational-loop` when there is a cycle, with the cycle in
 * the detail so the app can draw it.
 */
export function topoOrder(norm) {
  if (norm.loop) throw new EventsError('combinational-loop', `these gates feed each other in a ring: ${norm.loop.join(' to ')}. A ring has no truth table, and it is a latch`, { loop: norm.loop })
  const cells = [...norm.gates, ...norm.wires]
  const byId = new Map(cells.map((c) => [c.id, c]))
  const out = []
  const seen = new Set()
  const walk = (id) => {
    if (seen.has(id) || !byId.has(id)) return
    seen.add(id)
    for (const src of byId.get(id).in) walk(src)
    out.push(byId.get(id))
  }
  for (const c of cells) walk(c.id)
  return out
}
