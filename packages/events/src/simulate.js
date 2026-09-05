// The simulator: exact delays, no continuous state, and a waveform that is a
// list of instants rather than a list of samples.
//
// Between two events nothing in this engine changes, so there is nothing to
// integrate and nothing to step. A waveform is the times it changed and the
// values it took, and every one of those times is a whole number of units
// reached by adding integers. That is the sense in which the engine is exact,
// and it is why a race shows as the order of two events rather than as a
// numerical accident.
//
// One instant, in order:
//
//   1. Every event at time t is applied at once, and each net is resolved from
//      what all of its drivers are now holding. Nothing evaluates first.
//   2. Each flip-flop whose clock has an edge at t samples D as it stood
//      before t, and checks setup against the same instant.
//   3. Every gate and wire that reads a net which changed at t is evaluated
//      once, against the state after step 1, and schedules its output for t
//      plus the delay for the direction it is going.
//
// Step 1 before step 3 is the whole determinism argument. The gates do not see
// each other's order within an instant, because there is no order within an
// instant.

import { EventsError, normalize, resolveValues } from './netlist.js'
import { EventQueue } from './queue.js'
import { initialValue, transitions } from './sources.js'

/** How long a run goes when the caller does not say: enough for the sources to finish. */
function defaultEnd(norm) {
  let t = 1000
  for (const s of norm.sources) {
    if (s.kind === 'step') t = Math.max(t, s.at * 2 + 1000)
    if (s.kind === 'clock') t = Math.max(t, s.phase + 4 * s.period)
    if (s.kind === 'pattern') t = Math.max(t, s.at + (s.bits.length + 1) * s.period)
  }
  return t
}

/** What a gate, a wire or a source is holding, given the state of the nets. */
const driveOf = (d, value) => {
  if (d.role === 'wire') return value.get(d.from)
  if (d.role === 'gate') return d.fn(d.in.map((s) => value.get(s)))
  return null
}

/**
 * The state every net holds at t = 0.
 *
 * A gate given an `init` is held at it: that is how a latch is told which of
 * its two stable states it is in, and how a ring of inverters is told where the
 * wave starts. Every other gate is updated from the same snapshot as all the
 * others, over and over, until nothing moves. Simultaneous update rather than
 * one gate at a time, so the answer does not depend on the netlist's order.
 *
 * `settled` says whether every gate then agrees with its own inputs. A ring of
 * an odd number of inverters does not, and this reports that rather than
 * pretending.
 */
export function relax(norm) {
  const cells = [...norm.gates, ...norm.wires]
  const contrib = new Map()
  const value = new Map()
  const put = (netName, driverId, v) => {
    if (!contrib.has(netName)) contrib.set(netName, new Map())
    contrib.get(netName).set(driverId, v)
  }
  const settle = (netName) => {
    const vs = [...contrib.get(netName).values()]
    const r = resolveValues(norm.resolve.get(netName), vs)
    value.set(netName, r.value)
    return r
  }
  for (const s of norm.sources) put(s.out, s.id, initialValue(s))
  for (const f of norm.flops) put(f.out, f.id, f.init)
  for (const c of cells) put(c.out, c.id, c.init == null ? 0 : c.init)
  for (const netName of norm.nets) settle(netName)

  const free = cells.filter((c) => c.init == null)
  for (let k = 0; k < free.length + 2; k++) {
    const next = free.map((c) => driveOf(c, value))
    let moved = false
    free.forEach((c, i) => {
      if (contrib.get(c.out).get(c.id) !== next[i]) moved = true
      contrib.get(c.out).set(c.id, next[i])
    })
    for (const netName of norm.nets) settle(netName)
    if (!moved) break
  }
  const conflicts = norm.nets.filter((n) => settle(n).conflict)
  return { value, contrib, settled: cells.every((c) => driveOf(c, value) === contrib.get(c.out).get(c.id)), conflicts }
}

/**
 * Run `net` from 0 to `tEnd`.
 *
 * Two call shapes, so the labs downstream can use whichever reads better:
 *
 *   simulate(net, { tEnd })
 *   simulate(design, stim, { until })      // stim is [{ t, net, value }]
 *
 * @returns {{
 *   tEnd, unit, signals, nets,
 *   events: [{ t, signal, net, from, to, value, by, delay, cause }],
 *   waves: { [net]: { t: number[], v: number[] } },
 *   at: (t) => Record<net, 0|1>,
 *   waveform: (net) => [{ t, value }],
 *   final, violations, swallowed, conflicts, settled, steps
 * }}
 */
export function simulate(net, arg2 = {}, arg3 = {}) {
  const stim = Array.isArray(arg2) ? arg2 : []
  const opts = Array.isArray(arg2) ? arg3 : arg2
  const norm = net.drivers ? net : normalize(net)
  const tEnd = opts.tEnd ?? opts.until ?? defaultEnd(norm)
  if (!Number.isInteger(tEnd) || tEnd < 0) throw new EventsError('fractional-time', `tEnd is ${tEnd}, and a time in this engine is a whole number of units`, { tEnd })
  const maxEvents = opts.maxEvents ?? 200000

  const start = relax(norm)
  const value = start.value
  const contrib = start.contrib
  const lastChange = new Map(norm.nets.map((s) => [s, null]))
  const waves = {}
  for (const s of norm.nets) waves[s] = { t: [0], v: [value.get(s)] }
  const events = []
  const violations = []
  const swallowed = []
  const conflicts = start.conflicts.map((netName) => ({ t: 0, net: netName, drivers: [...contrib.get(netName).keys()], values: [...contrib.get(netName).values()] }))

  const queue = new EventQueue()
  // The events already scheduled by each driver, in time order. The simulator
  // owns this list, and the queue only orders it in time.
  const pending = new Map()
  const pendingOf = (id) => {
    if (!pending.has(id)) pending.set(id, [])
    return pending.get(id)
  }
  const finalOf = (driver) => {
    const p = pendingOf(driver.id)
    return p.length ? p[p.length - 1].value : contrib.get(driver.out).get(driver.id)
  }
  const schedule = (t, driver, v, delay, cause) => {
    const ev = { net: driver.out, by: driver.id, value: v, delay, cause }
    queue.push(t, ev)
    const p = pendingOf(driver.id)
    p.push({ t, value: v, ev })
    p.sort((a, b) => a.t - b.t)
    return ev
  }
  /** Take back every event this driver has scheduled at or after `from`. */
  const cancelFrom = (driver, from) => {
    const p = pendingOf(driver.id)
    const dropped = []
    for (let i = p.length - 1; i >= 0; i--) {
      if (p[i].t < from) continue
      queue.remove(p[i].t, p[i].ev)
      dropped.unshift({ t: p[i].t, value: p[i].value })
      p.splice(i, 1)
    }
    return dropped
  }

  // The sources' whole waveforms, known before anything runs.
  for (const s of norm.sources) for (const tr of transitions(s, tEnd)) schedule(tr.t, s, tr.value, 0, null)
  // An explicit stimulus list drives the nets it names, on top of the sources.
  for (const s of stim) {
    const driver = (norm.drivers.get(s.net) || [])[0]
    if (!driver) throw new EventsError('undriven', `the stimulus drives "${s.net}", and the netlist has no such net`, { net: s.net })
    schedule(s.t, driver, s.value, 0, null)
  }

  // Any gate that disagrees with its own inputs at t = 0 schedules the
  // correction. In a settled netlist there are none.
  const cells = [...norm.gates, ...norm.wires]
  for (const c of cells) {
    const want = driveOf(c, value)
    if (want === contrib.get(c.out).get(c.id)) continue
    const delay = want === 1 ? c.tr : c.tf
    schedule(delay, c, want, delay, { signal: c.in[0], t: 0 })
  }

  const lastEdge = new Map(norm.flops.map((f) => [f.id, null]))
  const readersOf = (name) => norm.readers.get(name) || []
  const byId = new Map([...norm.gates, ...norm.wires].map((c) => [c.id, c]))
  let steps = 0

  while (true) {
    const batch = queue.popBatch()
    if (!batch || batch.t > tEnd) break
    const t = batch.t
    steps++
    if (events.length > maxEvents) throw new EventsError('runaway', `more than ${maxEvents} events before ${tEnd}: the netlist oscillates faster than the run can hold`, { tEnd, events: events.length })

    // 1. The whole instant is applied, then every touched net is resolved.
    const prev = new Map(value)
    const prevChange = new Map(lastChange)
    const touched = new Map()
    for (const ev of batch.events) {
      const p = pendingOf(ev.by)
      const i = p.findIndex((x) => x.ev === ev)
      if (i >= 0) p.splice(i, 1)
      contrib.get(ev.net).set(ev.by, ev.value)
      if (!touched.has(ev.net)) touched.set(ev.net, [])
      touched.get(ev.net).push(ev)
    }
    const changed = []
    for (const [netName, evs] of touched) {
      const r = resolveValues(norm.resolve.get(netName), [...contrib.get(netName).values()])
      if (r.conflict) conflicts.push({ t, net: netName, drivers: [...contrib.get(netName).keys()], values: [...contrib.get(netName).values()] })
      const from = value.get(netName)
      if (from === r.value) continue
      value.set(netName, r.value)
      lastChange.set(netName, t)
      const w = waves[netName]
      // A source that moves at t = 0 rewrites the opening value rather than
      // adding a second point at the same instant.
      if (t === 0) w.v[0] = r.value
      else {
        w.t.push(t)
        w.v.push(r.value)
      }
      const lead = evs[evs.length - 1]
      events.push({ t, signal: netName, net: netName, from, to: r.value, value: r.value, by: lead.by, delay: lead.delay, cause: lead.cause })
      changed.push(netName)
    }
    if (!changed.length) continue
    const moved = new Set(changed)

    // 2. Flip-flops sample the D that stood before this instant.
    for (const f of norm.flops) {
      if (moved.has(f.d) && lastEdge.get(f.id) !== null) {
        const held = t - lastEdge.get(f.id)
        if (held < f.th) violations.push({ kind: 'hold', flop: f.id, t: lastEdge.get(f.id), actual: held, required: f.th, slack: held - f.th, d: f.d })
      }
      if (!moved.has(f.clk)) continue
      const rose = value.get(f.clk) === 1
      if ((f.edge === 'rising') !== rose) continue
      lastEdge.set(f.id, t)
      // How long D had been still when the edge arrived. D moving at the edge
      // itself was still for no time at all, whatever it did before.
      const stable = moved.has(f.d) ? 0 : prevChange.get(f.d) === null ? Infinity : t - prevChange.get(f.d)
      if (stable < f.tsu) violations.push({ kind: 'setup', flop: f.id, t, actual: stable, required: f.tsu, slack: stable - f.tsu, d: f.d })
      if (moved.has(f.d)) violations.push({ kind: 'hold', flop: f.id, t, actual: 0, required: f.th, slack: -f.th, d: f.d })
      const sampled = prev.get(f.d)
      if (sampled !== finalOf(f)) schedule(t + f.tcq, f, sampled, f.tcq, { signal: f.clk, t })
    }

    // 3. Every gate that reads something which moved, evaluated once.
    const affected = new Set()
    for (const s of changed) for (const r of readersOf(s)) affected.add(r)
    for (const c of cells) {
      if (!affected.has(c.id) || !byId.has(c.id)) continue
      const want = driveOf(c, value)
      const delay = want === 1 ? c.tr : c.tf
      const at = t + delay
      // A gate whose rise and fall delays differ can send a later input change
      // to an earlier instant. What it overtakes never reaches the net. An
      // inertial gate does the same to everything pending, which is how it
      // rejects a pulse shorter than its own delay. Either way the reader is
      // told what was swallowed.
      if (want === finalOf(c) && norm.delayMode !== 'inertial') continue
      const dropped = cancelFrom(c, norm.delayMode === 'inertial' ? 0 : at)
      if (dropped.length) swallowed.push({ signal: c.out, net: c.out, by: c.id, at, to: want, width: at - dropped[0].t, mode: norm.delayMode, dropped })
      if (want === finalOf(c)) continue
      schedule(at, c, want, delay, { signal: c.in.find((s) => moved.has(s)) ?? c.in[0], t })
    }
  }

  const final = {}
  for (const s of norm.nets) final[s] = value.get(s)
  const waveform = (name) => {
    const w = waves[name]
    if (!w) throw new EventsError('no-signal', `this run has no net called "${name}"`, { net: name })
    return w.t.map((t, i) => ({ t, value: w.v[i] }))
  }
  const res = {
    tEnd,
    unit: norm.unit,
    net: norm,
    signals: norm.nets,
    nets: norm.nets,
    events,
    waves,
    final,
    violations,
    swallowed,
    conflicts,
    settled: start.settled,
    steps,
    waveform,
  }
  res.at = (t) => Object.fromEntries(norm.nets.map((s) => [s, valueAt(res, s, t)]))
  return res
}

/** The value of `signal` at time `t`, read off its waveform. */
export function valueAt(res, signal, t) {
  const w = res.waves[signal]
  if (!w) throw new EventsError('no-signal', `this run has no net called "${signal}"`, { signal })
  let v = w.v[0]
  for (let i = 0; i < w.t.length; i++) {
    if (w.t[i] > t) break
    v = w.v[i]
  }
  return v
}

/** Every transition of `signal`, as `{ t, from, to }`. */
export function edgesOf(res, signal) {
  return res.events.filter((e) => e.signal === signal).map((e) => ({ t: e.t, from: e.from, to: e.to }))
}
