/**
 * The course's shape: one sentence for each group, and the thread through the
 * experiments — what each builds on and so what it leads to. course.test.js
 * keeps every intro under thirty words, every experiment but the first building
 * on something earlier, and every pointer aimed at an experiment that exists.
 */
import { EXPERIMENTS, GROUPS } from './experiments.js'

/** One sentence per group, keyed by its letter: what the group is for. */
export const GROUP_INTRO = {
  A: 'A scope reading is a divider between the circuit and the scope. The input is a resistor and a capacitor, and the probe in front of it is a second pair.',
  B: 'The front end is analog and the display is not. Between samples a digital instrument knows nothing, and two tones can leave the same numbers behind.',
  C: 'A meter is three circuits behind one pair of leads. Each of them changes the thing it measures, and by how much is arithmetic.',
  D: 'An analyser is a tuned filter, a detector and a sweep. The width of a line on its screen belongs to the filter, not to the signal.',
  E: 'Multiply a signal by a reference at its own frequency and one term of the product stops moving. Average that term and the rest goes away.',
  F: 'A reading is not a value. Four numbers stand between them: the last count, the maker’s specification, the tolerances behind the circuit, and the noise floor.',
}

/** The letter of a group name ("C · The multimeter" → "C"). */
export const letterOf = (group) => group[0]

/** The group intro for an experiment. */
export const introFor = (exp) => GROUP_INTRO[letterOf(exp.group)]

/** Whether an experiment opens its group. */
export const opensGroup = (exp) => EXPERIMENTS.find((e) => e.group === exp.group) === exp

/**
 * What each experiment builds on — the earlier experiments whose idea it uses
 * directly, most important first. Read the other way this is what each one
 * leads to.
 */
export const BUILDS = {
  a2: ['a1'],
  a3: ['a1'],
  a4: ['a3'],
  a5: ['a3', 'a2'],
  a6: ['a2'],
  b1: ['a2'],
  b2: ['b1', 'a1'],
  c1: ['a2'],
  c2: ['c1'],
  c3: ['c1'],
  c4: ['c3'],
  c5: ['c4'],
  d1: ['a1'],
  d2: ['d1'],
  d3: ['d2'],
  d4: ['d1'],
  e1: ['d3'],
  e2: ['e1', 'a1'],
  e3: ['e1'],
  e4: ['e2'],
  f1: ['c1'],
  f2: ['f1'],
  f3: ['c1'],
  f4: ['a1', 'f1'],
}

/** The experiments this one builds on, in course order. */
export const buildsOn = (id) => BUILDS[id] || []

/** The experiments that build on this one, in course order. */
export const leadsTo = (id) => EXPERIMENTS.filter((e) => buildsOn(e.id).includes(id)).map((e) => e.id)

/** The six group letters, in order. */
export const LETTERS = GROUPS.map(letterOf)
