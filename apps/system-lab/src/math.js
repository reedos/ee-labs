// One analysis per experiment, and every view and every lesson reads from it.
//
// `analyse(exp, p)` builds the experiment's chain from the knob values, walks
// it once, and walks it again in decibels. Nothing else in the app calls the
// engine. That is what makes `experiments.test.js` able to recompute every
// number a lesson quotes: it calls the same function with the same settings.
//
// The two walks are `cascade` and `levels` from `@ee-labs/rf`. `cascade` gives
// the four totals and each block's share of each. `levels` gives the signal,
// the noise and their ratio at every node, against a stated input level and a
// stated noise bandwidth.

import { RfError, cascade, levels } from '@ee-labs/rf'
import { REFERENCE_INPUT } from './groups/a.js'

/**
 * The analysis for one experiment at one set of knob values.
 *
 * Every return carries `kind`, `exp`, `p`, `blocks`, `c`, `v` and a `headline`,
 * which is the one number the experiment is about with its unit and its label.
 * `readQuantity` in lessons.js knows the paths into it.
 */
export function analyse(exp, p) {
  let out
  try {
    const blocks = exp.chain(p)
    const input = { ...REFERENCE_INPUT, ...(exp.input ? exp.input(p) : {}) }
    const c = cascade(blocks)
    const v = levels(blocks, input)
    out = { kind: exp.kind, exp, p, blocks, input, c, v }
  } catch (err) {
    if (err && err.name === 'RfError') return declined(exp, p, err)
    throw err
  }
  return { ...out, headline: exp.headline(out, p) }
}

/**
 * A setting the engine will not describe.
 *
 * A passive block with gain above zero has no noise figure of the form the
 * budget uses, and a bandwidth at or below zero has no floor. The app shows the
 * engine's own sentence where the headline would be, so a knob taken past what
 * an object allows reads as a refusal and not as a number.
 */
function declined(exp, p, err) {
  return {
    kind: exp.kind,
    exp,
    p,
    declined: { says: err.message, field: err.field },
    headline: { value: NaN, unit: '', label: 'Declined' },
  }
}

/**
 * The guard the aligned-phase rule carries, as a sentence for the pane.
 *
 * `SYSTEM_LAB_PLAN.md` §2.2 admits the cascaded input IP3 with one assumption:
 * every stage's third-order product adds as a voltage with its phase aligned.
 * That is the worst case rather than the answer, so the number is never shown
 * without the rule beside it and without the power-addition total it brackets.
 * With one contributing stage the two rules agree exactly, and the sentence
 * says so rather than warning about a spread of zero.
 */
export function ip3Guard(x) {
  if (x.declined || !x.c) return null
  const contributing = x.c.blocks.filter((b) => b.ip3Term > 0).length
  if (contributing === 0) return 'No block in this chain makes a third-order product, so the chain has no input IP3 to quote.'
  if (contributing === 1)
    return (
      'One stage makes the whole of the third-order product, so the worst case and the power sum are the same number. ' +
      'A chain with two contributing stages separates them.'
    )
  const spread = x.c.iip3PowerDbm - x.c.iip3Dbm
  return (
    `The input IP3 column adds every stage's product as a voltage with its phase aligned, which is the worst case. ` +
    `Adding the same products as powers gives ${x.c.iip3PowerDbm.toPrecision(5)} dBm, which is ${spread.toPrecision(4)} dB higher. ` +
    'The budget quotes the worst case.'
  )
}

/** The refusal a pane prints where its numbers would be, or null. */
export const refusalOf = (x) => (x.declined ? x.declined.says : null)

export { RfError }
