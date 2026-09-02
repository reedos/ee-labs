/**
 * The course's shape (student review, Phase 6): one sentence for each group,
 * and the thread through the experiments — what each builds on and so what it
 * leads to. course.test.js keeps every intro under thirty words, every
 * experiment but the first building on something earlier, and every pointer
 * aimed at an experiment that exists.
 */
import { EXPERIMENTS, GROUPS } from './experiments.js'

/** One sentence per group, keyed by its letter: what the group is for, in the student's words. */
export const GROUP_INTRO = {
  A: 'Four elements and a sign rule. A source decides a voltage or a current; a resistor turns one into the other; every number needs a + to be written.',
  B: 'Two laws are the whole of circuit analysis: current in equals current out at every junction, and voltages round any loop add to zero. Power follows.',
  C: 'The two laws applied to the two ways elements can sit together — one current shared, or one voltage shared — give the divider, the bridge and the loading problem.',
  D: 'Methods for circuits too tangled to read off: write the laws as equations, or replace everything you are not looking at with one source and one resistor.',
  E: 'A dependent source with huge gain, tamed by feedback: the op-amp. Five circuits built from one rule — the inputs are held equal — and one that breaks it.',
  F: 'Capacitors and inductors remember: their state cannot jump, so every switch starts a curve. One time constant describes every such circuit.',
  G: 'Two states in one loop give a second-order equation, and its two roots decide everything: creep, ring or swing for ever. Damping is the number that says which.',
  H: 'Drive with a sine and every voltage is a sine at the same frequency: a length and an angle. Phasors make Ohm’s law work for capacitors and inductors.',
  I: 'A diode passes current one way only, so the circuit changes shape as the signal moves. Every earlier method still applies — one region at a time.',
}

/** The letter of a group name ("C · Series and parallel" → "C"). */
export const letterOf = (group) => group[0]

/** The group intro for an experiment. */
export const introFor = (exp) => GROUP_INTRO[letterOf(exp.group)]

/** Whether an experiment opens its group. */
export const opensGroup = (exp) => EXPERIMENTS.find((e) => e.group === exp.group) === exp

/**
 * What each experiment builds on — the earlier experiments whose idea it
 * uses directly, most important first. Read the other way this is what each
 * one leads to.
 */
export const BUILDS = {
  a2: ['a1'],
  a3: ['a1'],
  a4: ['a1'],
  b1: ['a3'],
  b2: ['a4', 'a1'],
  b3: ['a4', 'b2'],
  b4: ['b2', 'b3'],
  c1: ['b2', 'a1'],
  c2: ['b1'],
  c3: ['c1', 'c2'],
  c4: ['c1', 'b2'],
  d1: ['b1', 'a3'],
  d2: ['d1'],
  d3: ['b2', 'd1'],
  d4: ['d1'],
  d5: ['d4', 'c3'],
  d6: ['d5', 'b3'],
  e1: ['a2', 'b3'],
  e2: ['e1'],
  e3: ['e2'],
  e4: ['e3', 'c1'],
  e5: ['e4', 'b1'],
  e6: ['e5'],
  e7: ['e5', 'e4'],
  e8: ['c3', 'e4'],
  f1: ['a1'],
  f2: ['f1'],
  f3: ['f1', 'b2'],
  f4: ['f3', 'd5'],
  f5: ['f3', 'b3'],
  f6: ['f2', 'f3'],
  f7: ['e5', 'f1'],
  g1: ['f3', 'f2'],
  g2: ['g1'],
  g3: ['g2'],
  g4: ['g2'],
  g5: ['g4'],
  g6: ['g4', 'f3'],
  g7: ['g4', 'f2'],
  h1: ['f3'],
  h2: ['h1'],
  h3: ['h2', 'a1'],
  h4: ['h3', 'g1'],
  h5: ['h3', 'b3'],
  h6: ['h3'],
  e9: ['e3', 'e4'],
  i1: ['a1', 'e3'],
  i2: ['i1', 'd5'],
  i3: ['i1', 'd1'],
  i4: ['i3', 'h1'],
  i5: ['i4'],
  i6: ['i5', 'f3'],
  i7: ['i3', 'i4'],
  i8: ['i3', 'd6'],
}

/** The experiments this one builds on, in course order. */
export const buildsOn = (id) => BUILDS[id] || []

/** The experiments that build on this one, in course order. */
export const leadsTo = (id) => EXPERIMENTS.filter((e) => buildsOn(e.id).includes(id)).map((e) => e.id)

/** The eight group letters, in order. */
export const LETTERS = GROUPS.map(letterOf)
