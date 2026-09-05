// The simulator: exact delays, no continuous state, and a waveform that is a
// list of instants rather than a list of samples.
//
// Between two events nothing in this engine changes, so there is nothing to
// integrate and nothing to step. A waveform is the times it changed and the
// values it took, and every one of those times is a whole number of
// picoseconds reached by adding integers. That is the sense in which the
// engine is exact, and it is why a race shows as the order of two events
// rather than as a numerical accident.
//
// One instant, in order:
//
//   1. Every event at time t is applied at once. Nothing evaluates first.
//   2. Each flip-flop whose clock has an edge at t samples D as it stood
//      *before* t, and checks setup against the same instant.
//   3. Every gate and wire that reads a signal which changed at t is
//      evaluated once, against the state after step 1, and schedules its
//      output for t plus the delay for the direction it is going.
//
// Step 1 before step 3 is the whole determinism argument. The gates do not see
// each other's order within an instant, because there is no order within an
// instant.

import { EventsError, normalize } from './netlist.js'
import { EventQueue } from './queue.js'
import { evalKind } from './library.js'
import { initialValue, transitions } from './sources.js'

/** How long a run goes when the caller does not say: enough for the sources to finish, and a little more. */
function defaultEnd(norm) {
  let t = 1000
  for (const s of norm.sources) {
    if (s.kind === 'step') t = Math.max(t, s.at * 2 + 1000)
    if (s.kind === 'clock') t = Math.max(t, s.phase + 4 * s.period)
    if (s.kind === 'pattern') t = Math.max(t, s.at + (s.bits.length + 1) * s.period)
  }
  return t
}

/**
 * The state every signal holds at t = 0.
 *
 * A gate given an `init` is held at it: that is how a latch is told which of
 * its two stable states it is in, and how a ring of inverters is told where
 * the wave starts. Every other gate is updated from the same snapshot as all
 * the others, over and over, until nothing moves. Simultaneous update rather
 * than one gate at a time, so the answer does not depend on the netlist's
 * order.
 *
 * `settled` says whether every gate then agrees with its own inputs. A ring of
 * an odd number of inverters does not, and this reports that rather than
 * pretending. The simulation starts anyway, finds the gate that disagrees, and
 * schedules its correction. That is a ring oscillator, and it is the right
 * answer.
 */
export function relax(norm) {
  const value = new Map()
  for (const s of norm.sources) value.set(s.id, initialValue(s))
  for (const f of norm.flops) value.set(f.id, f.init)
  const cells = [...norm.gates, ...norm.wires]
  for (const c of cells) value.set(c.id, c.init == null ? 0 : c.init)
  const of = (c, from) => (c.kind === 'wire' ? from.get(c.from) : evalKind(c.kind, c.in.map((s) => from.get(s))))
  const free = cells.filter((c) => c.init == null)
  for (let k = 0; k < free.length + 2; k++) {
    const next = new Map(value)
    for (const c of free) next.set(c.id, of(c, value))
    if (free.every((c) => next.get(c.id) === value.get(c.id))) break
    for (const c of free) value.set(c.id, next.get(c.id))
  }
  return { value, settled: cells.every((c) => of(c, value) === value.get(c.id)) }
}

/**
 * Run `net` from 0 to `tEnd` picoseconds.
 *
 * @param net  a netlist (see `netlist.js`)
 * @param opts { tEnd } in picoseconds; defaults to the sources' own span
 * @returns {{
 *   tEnd: number,
 *   signals: string[],
 *   events: Array<{ t, signal, from, to, by, delay, cause }>,   // cause is { signal, t } or null for a source
 *   waves: { [signal]: { t: number[], v: number[] } },          // v[i] holds from t[i] to t[i+1]
 *   final: { [signal]: 0 | 1 },
 *   violations: Array<{ kind: 'setup' | 'hold', flop, t, actual, required, slack, d }>,
 *   swallowed: Array<{ signal, at, to, width, mode, dropped }>,
 *   settled: boolean,                                            // the state at t = 0 was consistent
 *   steps: number
 * }}
 */
export function simulate(net, opts = {}) {
  const norm = net.drivers ? net : normalize(net)
  const tEnd = opts.tEnd == null ? defaultEnd(norm) : opts.tEnd
  if (!Number.isInteger(tEnd) || tEnd < 0) throw new EventsError('fractional-time', `tEnd is ${tEnd} ps, and times are whole picoseconds in this engine`, { tEnd })
  const maxEvents = opts.maxEvents ?? 200000

  const { value, settled } = relax(norm)
  const lastChange = new Map(norm.signals.map((s) => [s, null]))
  const waves = {}
  for (const s of norm.signals) waves[s] = { t: [0], v: [value.get(s)] }
  const events = []
  const violations = []
  const swallowed = []

  const queue = new EventQueue()
  // The events already scheduled on each signal, in time order. The simulator
  // owns this list; the queue only orders it in time.
  const pending = new Map(norm.signals.map((s) => [s, []]))
  const finalOf = (signal) => {
    const p = pending.get(signal)
    return p.length ? p[p.length - 1].value : value.get(signal)
  }
  const schedule = (t, signal, v, by, delay, cause) => {
    const ev = { signal, value: v, by, delay, cause }
    queue.push(t, ev)
    const p = pending.get(signal)
    p.push({ t, value: v, ev })
    p.sort((a, b) => a.t - b.t)
    return ev
  }
  /** Take back every scheduled event on `signal` at or after `from`, and return them. */
  const cancelFrom = (signal, from) => {
    const p = pending.get(signal)
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
  for (const s of norm.sources) for (const tr of transitions(s, tEnd)) schedule(tr.t, s.id, tr.value, s.id, 0, null)

  // Any gate that disagrees with its own inputs at t = 0 schedules the
  // correction. In a settled netlist there are none.
  const cells = [...norm.gates, ...norm.wires]
  for (const c of cells) {
    const want = c.kind === 'wire' ? value.get(c.from) : evalKind(c.kind, c.in.map((s) => value.get(s)))
    if (want === value.get(c.id)) continue
    const delay = want === 1 ? c.tr : c.tf
    schedule(delay, c.id, want, c.id, delay, { signal: c.in[0], t: 0 })
  }

  // Each flip-flop's most recent triggering edge, for the hold check.
  const lastEdge = new Map(norm.flops.map((f) => [f.id, null]))
  const readersOf = (signal) => norm.readers.get(signal) || []
  let steps = 0

  while (true) {
    const batch = queue.popBatch()
    if (!batch || batch.t > tEnd) break
    const t = batch.t
    steps++
    if (events.length > maxEvents) throw new EventsError('runaway', `more than ${maxEvents} events before ${tEnd} ps: the netlist oscillates faster than the run can hold`, { tEnd, events: events.length })

    // 1. The whole instant is applied before anything is evaluated.
    const prev = new Map(value)
    const prevChange = new Map(lastChange)
    const changed = []
    for (const ev of batch.events) {
      const p = pending.get(ev.signal)
      const i = p.findIndex((x) => x.ev === ev)
      if (i >= 0) p.splice(i, 1)
      const from = value.get(ev.signal)
      if (from === ev.value) continue
      value.set(ev.signal, ev.value)
      lastChange.set(ev.signal, t)
      const w = waves[ev.signal]
      // A source that moves at t = 0 rewrites the opening value rather than
      // adding a second point at the same instant.
      if (t === 0) w.v[0] = ev.value
      else {
        w.t.push(t)
        w.v.push(ev.value)
      }
      events.push({ t, signal: ev.signal, from, to: ev.value, by: ev.by, delay: ev.delay, cause: ev.cause })
      changed.push(ev.signal)
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
      if (sampled !== finalOf(f.id)) schedule(t + f.tcq, f.id, sampled, f.id, f.tcq, { signal: f.clk, t })
    }

    // 3. Every gate that reads something which moved, evaluated once.
    const affected = new Set()
    for (const s of changed) for (const r of readersOf(s)) affected.add(r)
    for (const c of cells) {
      if (!affected.has(c.id)) continue
      const want = c.kind === 'wire' ? value.get(c.from) : evalKind(c.kind, c.in.map((s) => value.get(s)))
      if (want === finalOf(c.id)) continue
      const delay = want === 1 ? c.tr : c.tf
      const at = t + delay
      // A gate whose rise and fall delays differ can send a later input change
      // to an earlier instant. What it overtakes never reaches the output. An
      // inertial gate does the same to everything pending, which is how it
      // rejects a pulse shorter than its own delay. Either way the reader is
      // told what was swallowed.
      const dropped = cancelFrom(c.id, norm.delayMode === 'inertial' ? 0 : at)
      if (dropped.length) swallowed.push({ signal: c.id, at, to: want, width: at - dropped[0].t, mode: norm.delayMode, dropped })
      if (want === finalOf(c.id)) continue
      schedule(at, c.id, want, c.id, delay, { signal: c.in.find((s) => moved.has(s)) ?? c.in[0], t })
    }
  }

  const final = {}
  for (const s of norm.signals) final[s] = value.get(s)
  return { tEnd, net: norm, signals: norm.signals, events, waves, final, violations, swallowed, settled, steps }
}

/** The value of `signal` at time `t`, read off its waveform. */
export function valueAt(res, signal, t) {
  const w = res.waves[signal]
  if (!w) throw new EventsError('no-signal', `this run has no signal called "${signal}"`, { signal })
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
