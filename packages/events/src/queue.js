// The event queue, and why its order is not a tie-break.
//
// A simulator that pops one event at a time has to decide what happens when
// two events share an instant, and every such decision is a race the reader
// cannot see. This queue does not decide. It hands back **every** event at the
// earliest time as one batch, and the simulator applies the whole batch before
// it evaluates a single gate. Two signals that change at 140 ps both change at
// 140 ps, and the gate downstream sees both.
//
// So the order within an instant never reaches the model, and the answer does
// not depend on the order the netlist happens to list its gates. That is the
// determinism invariant in `fuzz.test.js`: shuffle the gates and every event
// comes back at the same time with the same value.
//
// Times are whole picoseconds, so the buckets are keyed by an integer and
// nothing rounds. The queue is a map from time to bucket with a scan for the
// minimum. A logic netlist has a few live instants at once, and a scan over
// that costs less than a heap and has no ordering to get wrong.

export class EventQueue {
  constructor() {
    this.buckets = new Map()
    this.count = 0
  }

  /** How many events are waiting. */
  get size() {
    return this.count
  }

  /** Schedule `event` at time `t` (whole picoseconds). */
  push(t, event) {
    let b = this.buckets.get(t)
    if (!b) {
      b = []
      this.buckets.set(t, b)
    }
    b.push(event)
    this.count++
    return event
  }

  /** The earliest time with anything in it, or null when the queue is empty. */
  nextTime() {
    let best = null
    for (const [t, b] of this.buckets) if (b.length && (best === null || t < best)) best = t
    return best
  }

  /** Every event at the earliest time, removed from the queue. */
  popBatch() {
    const t = this.nextTime()
    if (t === null) return null
    const events = this.buckets.get(t)
    this.buckets.delete(t)
    this.count -= events.length
    return { t, events }
  }

  /** Take one scheduled event back out. Returns whether it was there. */
  remove(t, event) {
    const b = this.buckets.get(t)
    if (!b) return false
    const i = b.indexOf(event)
    if (i < 0) return false
    b.splice(i, 1)
    this.count--
    if (!b.length) this.buckets.delete(t)
    return true
  }
}
