/**
 * What the student reads, per experiment, in three registers:
 *
 *   see — what the picture shows at the defaults, in a few lines;
 *   try — knob moves with the reading each one produces;
 *   why — the reasoning, for after the picture has made its point.
 *
 * Every number a step quotes is a measurement. A step's `set` is applied on top
 * of the defaults, and each `reads` pair is a quantity path (or a function of
 * the analysis) with the value the sentence quotes. experiments.test.js solves
 * each step and checks both the pair and every number-with-unit in the sentence
 * against it.
 *
 * The paths are in quantities.js. A path that file cannot resolve fails the
 * test, so a lesson cannot quote a number nothing computes.
 */

import { LESSONS as A } from './lessons/a.js'
import { LESSONS as B } from './lessons/b.js'
import { LESSONS as C } from './lessons/c.js'
import { LESSONS as D } from './lessons/d.js'
import { LESSONS as E } from './lessons/e.js'

export const LESSONS = { ...A, ...B, ...C, ...D, ...E }
