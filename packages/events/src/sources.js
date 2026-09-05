// What a source does, as the list of transitions it makes.
//
// A source is a known function of time, so its whole waveform is scheduled
// before the simulation starts rather than generated as it goes. That keeps
// the main loop about logic, and it makes a clock's edges exact integers
// however long the run.

import { EventsError } from './netlist.js'

/**
 * The value a source holds before any transition it schedules. A step starts
 * at `from`, a clock at `init`, a pattern at its first bit. A transition
 * scheduled at t = 0 then moves it in the first batch, so a clock with phase 0
 * and init 0 rises at 0 and the rise is an event a lesson can point at.
 */
export function initialValue(s) {
  switch (s.kind) {
    case 'input':
      return s.value
    case 'step':
      return s.from
    case 'clock':
      return s.init
    case 'pattern':
      return s.bits[0]
    default:
      throw new EventsError('unknown-source', `a ${s.kind} source has no initial value`, { kind: s.kind })
  }
}

/**
 * Every transition `s` makes in [0, tEnd], as `{ t, value }` in time order,
 * including one at t = 0 where the source starts at a value the initial state
 * does not already hold.
 *
 * A clock runs `init` until `phase`, then toggles: high for `high` ps, low for
 * `period - high`. The first edge is at `phase`, so a clock with `phase = 0`
 * and `init = 0` rises at 0.
 */
export function transitions(s, tEnd) {
  const out = []
  if (s.kind === 'input') return out
  if (s.kind === 'step') {
    if (s.at <= tEnd && s.to !== s.from) out.push({ t: s.at, value: s.to })
    return out
  }
  if (s.kind === 'clock') {
    let t = s.phase
    let v = s.init
    while (t <= tEnd) {
      const next = v ^ 1
      out.push({ t, value: next })
      v = next
      t += next === 1 ? s.high : s.period - s.high
    }
    return out
  }
  if (s.kind === 'pattern') {
    let v = s.bits[0]
    const n = s.bits.length
    for (let k = 1; ; k++) {
      const t = s.at + k * s.period
      if (t > tEnd) break
      if (!s.repeat && k >= n) break
      const bit = s.bits[k % n]
      if (bit !== v) out.push({ t, value: bit })
      v = bit
    }
    return out
  }
  throw new EventsError('unknown-source', `a ${s.kind} source has no transitions`, { kind: s.kind })
}
