// The netlist of gates, checked and turned into the graph the simulator walks.
//
// A **net** is a wire with a name. A **driver** is a source, a gate, a wire or
// a flip-flop, and it drives one net. A driver's `out` names that net, and
// defaults to the driver's own id, so the common case reads as "the gate `p`
// drives the signal `p`" with nothing extra written down.
//
// A net may have more than one driver, and then its `resolve` rule says what
// the net does about it. An open-drain bus is exactly that: every driver either
// pulls the net low or releases it, and the net is the conjunction of what they
// all do. The rules are `wired-and`, `wired-or`, and `single`, which is the
// default and reports a conflict as an event rather than picking a winner.
//
// Times are integers throughout, counted in the unit the netlist declares. The
// unit is an exact rational number of seconds, so a lab whose natural time is
// 1/9600 of a second can have that as a whole number of units and so can a
// 30 ps gate beside it (see `unitOf`).

import { KINDS, WIRE_DELAY, FLOP, PS_UNIT, libDelay, kindsOf } from './library.js'

export class EventsError extends Error {
  constructor(code, message, detail = {}) {
    super(message)
    this.name = 'EventsError'
    this.code = code
    this.detail = detail
  }
}

const SOURCE_KINDS = ['input', 'step', 'clock', 'pattern']
export const RESOLUTIONS = ['single', 'wired-and', 'wired-or']

/** Times must be whole units: the package's exactness rests on it. */
const whole = (t, what) => {
  if (!Number.isInteger(t)) throw new EventsError('fractional-time', `${what} is ${t}, and a time in this engine is a whole number of units`, { t })
  return t
}
const bit = (v, what) => {
  if (v !== 0 && v !== 1) throw new EventsError('not-a-bit', `${what} is ${v}, and a signal in this engine is 0 or 1`, { v })
  return v
}

/**
 * The time unit of a netlist, as an exact rational number of seconds.
 * `{ num: 1, den: 1e12 }` is one picosecond, which is the default.
 */
export function unitOf(net) {
  const u = net.unit || PS_UNIT
  const num = u.num ?? 1
  const den = u.den ?? 1
  if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) throw new EventsError('bad-unit', `the time unit ${num}/${den} is not a positive rational number of seconds`, { unit: u })
  return { num, den }
}

/** `t` units in seconds. The only place this package leaves integer time. */
export const secondsOf = (unit, t) => (t * unit.num) / unit.den

/** How the drivers of one net combine. */
export function resolveValues(rule, values) {
  if (values.length === 1) return { value: values[0], conflict: false }
  if (rule === 'wired-and') return { value: values.reduce((a, b) => a & b), conflict: false }
  if (rule === 'wired-or') return { value: values.reduce((a, b) => a | b), conflict: false }
  const first = values[0]
  const agree = values.every((v) => v === first)
  return { value: first, conflict: !agree }
}

/**
 * Check a netlist and build the graph.
 *
 * @returns {{
 *   sources, gates, wires, flops,
 *   drivers: Map<net, Driver[]>,       // one or more things driving that net
 *   resolve: Map<net, string>,         // how they combine
 *   readers: Map<net, string[]>,       // the driver ids that read that net
 *   nets: string[], signals: string[], // every net, sources first, in declaration order
 *   inputs: string[], outputs: string[],
 *   unit: { num, den }, delayMode, cells,
 *   combinational: boolean, loop: string[] | null
 * }}
 */
export function normalize(net) {
  if (!net || typeof net !== 'object') throw new EventsError('no-netlist', 'a netlist is an object with sources, gates and outputs')
  const lib = net.lib || {}
  const cells = kindsOf(net.cells)
  const unit = unitOf(net)
  const delayMode = net.delayMode || 'transport'
  if (delayMode !== 'transport' && delayMode !== 'inertial')
    throw new EventsError('unknown-delay-mode', `delayMode is "${delayMode}", and this engine has transport and inertial`, { delayMode })

  const drivers = new Map()
  const resolve = new Map()
  const nets = []
  const claim = (id, out, driver) => {
    if (!id || typeof id !== 'string') throw new EventsError('unnamed', 'every source, gate, wire and flip-flop needs an id')
    if (!drivers.has(out)) {
      drivers.set(out, [])
      nets.push(out)
      resolve.set(out, (net.resolve && net.resolve[out]) || 'single')
    }
    drivers.get(out).push(driver)
  }
  for (const [name, rule] of Object.entries(net.resolve || {}))
    if (!RESOLUTIONS.includes(rule)) throw new EventsError('unknown-resolution', `net "${name}" resolves by "${rule}", and this engine has ${RESOLUTIONS.join(', ')}`, { name, rule })

  const seen = new Set()
  const unique = (id) => {
    if (seen.has(id)) throw new EventsError('two-drivers', `two things are called "${id}", and an id in this engine names one driver`, { id })
    seen.add(id)
  }

  const sources = (net.sources || []).map((s) => {
    const kind = s.kind || 'input'
    if (!SOURCE_KINDS.includes(kind)) throw new EventsError('unknown-source', `source "${s.id}" is a ${kind}, and the kinds are ${SOURCE_KINDS.join(', ')}`, { id: s.id, kind })
    const out = { ...s, kind, id: s.id, out: s.out || s.id, role: 'source' }
    if (kind === 'input') out.value = bit(s.value ?? 0, `input "${s.id}"`)
    if (kind === 'step') {
      out.to = bit(s.to ?? 1, `step "${s.id}" to`)
      out.from = bit(s.from ?? out.to ^ 1, `step "${s.id}" from`)
      out.at = whole(s.at ?? 0, `step "${s.id}" at`)
    }
    if (kind === 'clock') {
      out.period = whole(s.period, `clock "${s.id}" period`)
      if (out.period < 2) throw new EventsError('short-period', `clock "${s.id}" has a period of ${out.period} units, and a period is at least 2`, { id: s.id })
      out.high = whole(s.high ?? out.period / 2, `clock "${s.id}" high time`)
      if (out.high < 1 || out.high > out.period - 1)
        throw new EventsError('bad-duty', `clock "${s.id}" is high for ${out.high} of ${out.period} units, and both halves need at least 1`, { id: s.id })
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
    unique(out.id)
    claim(out.id, out.out, out)
    return out
  })

  const gates = (net.gates || []).map((g) => {
    const spec = cells[g.kind]
    if (!spec) throw new EventsError('unknown-gate', `gate "${g.id}" is a ${g.kind}, and this netlist has ${Object.keys(cells).join(', ')}`, { id: g.id, kind: g.kind })
    const ins = g.in || []
    const [lo, hi] = spec.fanIn
    if (ins.length < lo || ins.length > hi)
      throw new EventsError('fan-in', `${spec.name} "${g.id}" has ${ins.length} inputs, and the library holds ${lo} to ${hi}`, { id: g.id, kind: g.kind, fanIn: ins.length })
    const base = g.delay ?? g.tpLH ?? libDelay(g.kind, ins.length, lib, cells)
    if (base == null) throw new EventsError('no-delay', `the library has no delay for a ${ins.length}-input ${spec.name}`, { id: g.id, kind: g.kind })
    const tr = whole(g.tr ?? g.tpLH ?? base, `gate "${g.id}" rise delay`)
    const tf = whole(g.tf ?? g.tpHL ?? base, `gate "${g.id}" fall delay`)
    if (tr < 1 || tf < 1)
      throw new EventsError('zero-delay', `gate "${g.id}" has a delay of ${Math.min(tr, tf)}, and this engine has no zero-delay gate: a ring with no delay has no waveform`, { id: g.id })
    const out = {
      id: g.id,
      role: 'gate',
      kind: g.kind,
      fn: spec.fn,
      in: [...ins],
      out: g.out || g.id,
      delay: whole(base, `gate "${g.id}" delay`),
      tr,
      tf,
      init: g.init == null ? null : bit(g.init, `gate "${g.id}" init`),
    }
    unique(out.id)
    claim(out.id, out.out, out)
    return out
  })

  const wires = (net.wires || []).map((w) => {
    const d = whole(w.delay ?? WIRE_DELAY, `wire "${w.id}" delay`)
    if (d < 1) throw new EventsError('zero-delay', `wire "${w.id}" has a delay of ${d}, and this engine has no zero-delay wire`, { id: w.id })
    const out = {
      id: w.id,
      role: 'wire',
      kind: 'wire',
      in: [w.from],
      from: w.from,
      out: w.out || w.id,
      delay: d,
      tr: d,
      tf: d,
      init: w.init == null ? null : bit(w.init, `wire "${w.id}" init`),
    }
    unique(out.id)
    claim(out.id, out.out, out)
    return out
  })

  const flops = (net.flops || []).map((f) => {
    const out = {
      id: f.id,
      role: 'flop',
      kind: 'dff',
      d: f.d,
      clk: f.clk,
      out: f.out || f.q || f.id,
      edge: f.edge || 'rising',
      tcq: whole(f.tcq ?? f.tPcq ?? FLOP.tcq, `flip-flop "${f.id}" clock-to-Q`),
      tsu: whole(f.tsu ?? f.tSetup ?? FLOP.tsu, `flip-flop "${f.id}" setup time`),
      th: whole(f.th ?? f.tHold ?? FLOP.th, `flip-flop "${f.id}" hold time`),
      init: bit(f.init ?? 0, `flip-flop "${f.id}" init`),
    }
    if (out.edge !== 'rising' && out.edge !== 'falling') throw new EventsError('unknown-edge', `flip-flop "${out.id}" triggers on a ${out.edge} edge, and this engine has rising and falling`, { id: out.id })
    if (out.tcq < 1) throw new EventsError('zero-delay', `flip-flop "${out.id}" has a clock-to-Q of ${out.tcq}, and this engine has none`, { id: out.id })
    unique(out.id)
    claim(out.id, out.out, out)
    return out
  })

  // Every input names a net something drives.
  const readers = new Map()
  const reads = (reader, name, what) => {
    if (!drivers.has(name)) throw new EventsError('undriven', `${what} reads "${name}", and nothing drives it`, { reader, net: name })
    if (!readers.has(name)) readers.set(name, [])
    readers.get(name).push(reader)
  }
  for (const g of gates) g.in.forEach((s, i) => reads(g.id, s, `${cells[g.kind].name} "${g.id}" input ${i + 1}`))
  for (const w of wires) reads(w.id, w.from, `wire "${w.id}"`)
  for (const f of flops) {
    reads(f.id, f.d, `flip-flop "${f.id}" D`)
    reads(f.id, f.clk, `flip-flop "${f.id}" clock`)
  }

  const outputs = net.outputs || []
  for (const o of outputs) if (!drivers.has(o)) throw new EventsError('undriven', `the netlist names "${o}" as an output, and nothing drives it`, { net: o })

  const inputs = sources.filter((s) => s.kind === 'input').map((s) => s.out)

  return {
    name: net.name || '',
    lib,
    cells,
    unit,
    delayMode,
    sources,
    gates,
    wires,
    flops,
    drivers,
    resolve,
    readers,
    nets,
    signals: nets,
    inputs,
    outputs,
    combinational: flops.length === 0,
    loop: findLoop(gates, wires, drivers),
  }
}

/** Every driver of `name` that is a gate or a wire. */
const cellsDriving = (drivers, name) => (drivers.get(name) || []).filter((d) => d.role === 'gate' || d.role === 'wire')

/**
 * One cycle among the gates and wires, as the list of ids around it, or null.
 *
 * A cycle is not an error. An SR latch is two NOR gates in a cycle, and it is
 * the whole point of the sequential group. It is what `truthTable` and
 * `criticalPath` decline, with the cycle named as the reason.
 */
export function findLoop(gates, wires, drivers) {
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
    for (const src of cell.in) for (const up of cellsDriving(drivers, src)) walk(up.id)
    stack.pop()
    state.set(id, 'done')
  }
  for (const c of cells) walk(c.id)
  return found
}

/**
 * The gates and wires in an order where every cell comes after the cells whose
 * nets it reads. Throws `combinational-loop` on a cycle, with the cycle in the
 * detail so the app can draw it.
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
    for (const src of byId.get(id).in) for (const up of cellsDriving(norm.drivers, src)) walk(up.id)
    out.push(byId.get(id))
  }
  for (const c of cells) walk(c.id)
  return out
}
