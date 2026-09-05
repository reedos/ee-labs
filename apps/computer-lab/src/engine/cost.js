// What the machine costs, as arithmetic over the model card.
//
// Two numbers in this lab carry the name "cycles per instruction". One is a
// count from a run, and `datapath.js` and `pipeline.js` produce it. The other
// is arithmetic over a stated mix and stated hazard rates, and it is here.
// They agree when a program's mix matches the stated one, and E4 is the lesson
// about what happens when it does not. Both are on screen together wherever
// either appears (plan §2.5), which is the guard.

import { CARD, psOf, secondsOf } from './card.js'

/**
 * Cycles per instruction from the stated mix.
 *
 * @param opts { forwarding, resolve: 'execute' | 'decode', accuracy }
 * @returns each term beside the total, because the total is a sum and not a
 *          measurement
 */
export function cpiOf({ forwarding = true, resolve = 'execute', accuracy = null, card = CARD } = {}) {
  const { mix, rates } = card
  const flush = resolve === 'execute' ? 2 : 1
  const missRate = accuracy == null ? rates.taken : 1 - accuracy
  const terms = {
    base: 1,
    loadUse: mix.load * rates.loadUse,
    data: forwarding ? 0 : rates.dep1 * 2 + rates.dep2,
    branch: mix.branch * missRate * flush,
    jump: mix.jump,
  }
  const cpi = Object.values(terms).reduce((a, b) => a + b, 0)
  return { terms, cpi, forwarding, resolve, accuracy, flush, missRate, mix, rates }
}

/** Two settings of the same arithmetic, and what the change is worth. */
export function worthOf(a, b) {
  return { from: a.cpi, to: b.cpi, saved: a.cpi - b.cpi, share: (a.cpi - b.cpi) / a.cpi }
}

/**
 * Amdahl's law: the speed-up of the whole from a speed-up of a part.
 *
 * `p` is the share of the time the part takes, and `s` is how much faster it
 * becomes. The bound is what an infinitely fast part would give, and it is the
 * number G3 exists to show.
 */
export function amdahl(p, s) {
  return { p, s, speedup: 1 / (1 - p + p / s), bound: 1 / (1 - p) }
}

/**
 * A bus transfer, as an address phase and a data phase.
 *
 * Four separate transfers of one word each pay for four address phases. One
 * burst pays for one, and the saving is the three it does not send.
 */
export function busOf({ lineBytes = 16, wordBytes = 4, period, addressCycles = 1, dataCycles = 1 }) {
  const words = lineBytes / wordBytes
  const single = words * (addressCycles + dataCycles)
  const burst = addressCycles + words * dataCycles
  return {
    words,
    lineBytes,
    single,
    burst,
    saved: single - burst,
    share: (single - burst) / single,
    singleTime: single * period,
    burstTime: burst * period,
  }
}

/**
 * What an interrupt costs the pipeline: the stages it throws away, the
 * registers it saves, and the vector it fetches.
 */
export function interruptOf({ stages = 5, saves = 16, vector = 2, period, rate = 1e4 }) {
  const cycles = stages + saves + vector
  const time = cycles * period
  return { stages, saves, vector, cycles, period, time, rate, share: rate * secondsOf(time) }
}

/** A time in grid units as nanoseconds, for the two numbers Group G quotes. */
export const nsOf = (units) => psOf(units) / 1000
