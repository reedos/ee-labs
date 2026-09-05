/**
 * What the student reads, per experiment, in three registers:
 *
 *   see — what the picture shows at the defaults, in a few lines;
 *   try — knob moves with the reading each one produces;
 *   why — the reasoning, for after the picture has made its point.
 *
 * Every number a register quotes is a measurement. A step's `set` is applied
 * on top of the defaults, and each `reads` pair is a quantity path (or a
 * function of the analysis) with the value the sentence quotes.
 * `experiments.test.js` solves each step and checks both the pair and every
 * number-with-unit in the sentence against it.
 *
 * The paths are `AGENT_BRIEF.md` §4. A pair may also be a function of
 * `(x, p, again, exp)`, where `again(over)` re-solves the experiment with
 * those knobs changed. That is how a note compares two settings without
 * quoting a constant.
 */

import { LESSONS_A } from './lessons/a.js'
import { LESSONS_B } from './lessons/b.js'
import { LESSONS_C } from './lessons/c.js'
import { LESSONS_D } from './lessons/d.js'
import { LESSONS_E } from './lessons/e.js'
import { LESSONS_F } from './lessons/f.js'
import { LESSONS_G } from './lessons/g.js'
import { LESSONS_H } from './lessons/h.js'
import { LESSONS_I } from './lessons/i.js'
import { LESSONS_J } from './lessons/j.js'

export const LESSONS = {
  ...LESSONS_A,
  ...LESSONS_B,
  ...LESSONS_C,
  ...LESSONS_D,
  ...LESSONS_E,
  ...LESSONS_F,
  ...LESSONS_G,
  ...LESSONS_H,
  ...LESSONS_I,
  ...LESSONS_J,
}
