/**
 * What the student reads, per experiment, in three registers:
 *
 *   see — what the picture shows at the defaults, in a few lines;
 *   try — knob moves with the reading each one produces;
 *   why — the reasoning, for after the picture has made its point.
 *
 * Every number a register quotes is a measurement. A step's `set` is applied on
 * top of the defaults, and each `reads` pair is a quantity path with the value
 * the sentence quotes. `experiments.test.js` runs each step and checks both the
 * pair and every number-with-unit in the sentence against it.
 *
 * A `see` or a `why` that compares two settings carries `seeAlso` or `whyAlso`,
 * a list of `{ set, reads }`. Those readings are measured at that setting, so a
 * sentence about the other position of a knob is measured there rather than
 * taken on trust.
 *
 * A quantity path is `<kind>.<name>`, and the kind says the unit the reading is
 * in and the way it is printed:
 *
 *   ps.<name>       a delay or a period, read in picoseconds
 *   ns.<name>       a time long enough to read in nanoseconds
 *   g.<name>        the same delay counted in gate delays
 *   freq.<name>     a frequency in hertz
 *   share.<name>    a fraction of a period, a time or a count
 *   cycles.<name>   a count of clock cycles
 *   bytes.<name>    a size in bytes
 *   n.<name>        a plain count or ratio
 *   word.<name>     a value the machine holds, in decimal
 *   text.<name>     a word rather than a number, checked exactly
 *
 * The names are the experiment's own, and `groups/*.js` computes each one from
 * the engine. The Numbers pane lists every reading an experiment produces with
 * the path a lesson reads it by, so the two can never drift apart.
 */
import { A_LESSONS } from './lessons/a.js'
import { B_LESSONS } from './lessons/b.js'
import { C_LESSONS } from './lessons/c.js'
import { D_LESSONS } from './lessons/d.js'
import { E_LESSONS } from './lessons/e.js'
import { F_LESSONS } from './lessons/f.js'
import { G_LESSONS } from './lessons/g.js'

export const LESSONS = { ...A_LESSONS, ...B_LESSONS, ...C_LESSONS, ...D_LESSONS, ...E_LESSONS, ...F_LESSONS, ...G_LESSONS }

export { readQuantity } from './analysis.js'
