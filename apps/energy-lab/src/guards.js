/**
 * The three sentences this lab's models are not allowed to be read without.
 *
 * Two of them are Rule 3 guards from `CORE_SCOPE.md`: a quantity this model
 * gets approximately right, printed with the bound it is right inside. The
 * third is the labelling that keeps data from being read as physics.
 *
 *   the reverse branch — a shaded cell driven backwards has only the shunt
 *     resistance to conduct through, because the model has no breakdown, so
 *     the reverse voltage is the model's rather than a real cell's
 *     (ENERGY_LAB_PLAN.md §2.4, and §11 names it as the lab's first risk);
 *   the fit's band — the open-circuit voltage rises linearly with the state
 *     of charge only from z = 0.1 to z = 0.9, and the knobs can leave it
 *     (§2.7). The circuit is still solvable outside, so the panel warns
 *     rather than refusing;
 *   the day's profiles — irradiance, cell temperature and household load are
 *     twenty-four hourly numbers each, and they are data (§2.8).
 *
 * Each takes the analysis and returns `{ level, text }` or null, so a pane
 * cannot print a guarded number without the sentence that bounds it, and the
 * sentence is written once rather than once per pane.
 */

import { fmt } from '@ee-labs/ui'

/**
 * About where a real silicon cell avalanches, in volts across one junction.
 * Below this the model and a real cell part company, and the guard says so.
 */
export const BREAKDOWN = -15

/** A shaded cell driven backwards, and how far past the model's bound it is. */
export function reverseGuard(x) {
  if (!x || !x.cells || !x.cells.length) return null
  const rev = x.cells.filter((r) => r.reverse)
  if (!rev.length) return null
  const worst = rev.reduce((a, r) => (r.v < a.v ? r : a))
  const heat = Math.abs(worst.v * x.at.i)
  const past = worst.v < BREAKDOWN
  return {
    level: past ? 'warn' : 'note',
    text:
      `Cell ${worst.k + 1} is driven backwards to ${fmt(worst.v, 'V', 5)} and turns ${fmt(heat, 'W', 4)} into heat. ` +
      'The only reverse path this model has is the shunt resistance, because it has no breakdown. ' +
      (past
        ? `A real cell avalanches somewhere near ${fmt(BREAKDOWN, 'V', 2)} and conducts, which caps the voltage. Take the size of the heat and its mechanism from this reading, and not the exact volts.`
        : `That holds down to about ${fmt(BREAKDOWN, 'V', 2)}, and this reading is inside it.`),
  }
}

/** Whether a battery run stayed inside the band the open-circuit fit holds over. */
export function bandGuard(x) {
  if (!x || x.kind !== 'battery' || !x.trace || !x.trace.length) return null
  const zs = x.trace.map((s) => s.z)
  const lo = Math.min(...zs)
  const hi = Math.max(...zs)
  const [a, b] = x.fit.band
  const out = lo < a || hi > b
  const reached = lo < a ? lo : hi
  return {
    level: out ? 'warn' : 'note',
    text:
      'The open-circuit voltage against state of charge is a straight-line fit, and it is labelled data rather than physics. ' +
      `It holds from ${a.toFixed(2)} to ${b.toFixed(2)}. ` +
      (out
        ? `This run reaches ${reached.toFixed(5)}, outside that band, where a real cell's curve turns over and this fit does not. The circuit still solves, so the panel says so rather than refusing.`
        : `This run stays between ${lo.toFixed(5)} and ${hi.toFixed(5)}, inside it.`),
  }
}

/** The day's three rows, named as what they are. */
export function dataGuard(x) {
  if (!x || x.kind !== 'day') return null
  return {
    level: 'note',
    text:
      'The three profiles are labelled data. They are one clear day of irradiance, cell temperature and household load, ' +
      'twenty-four hourly figures each, and they are not a measurement of any real place. ' +
      'What the balance does with them is arithmetic on exact solves, and every number below is one of those.',
  }
}

/** Every guard that applies to an analysis, in the order a pane should print them. */
export function guardsFor(x) {
  return [dataGuard(x), reverseGuard(x), bandGuard(x)].filter(Boolean)
}
