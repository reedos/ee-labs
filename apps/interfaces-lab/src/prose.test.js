import { describe, it } from 'vitest'
import { expectPlain } from '@ee-labs/prose/testing'
import { analyse } from './pin.js'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { LESSONS } from './lessons.js'
import { TERMS } from './terms.js'
import { mathEntry } from './math.js'

describe('Group A prose', () => {
  for (const exp of EXPERIMENTS) it(`${exp.id} follows the house budgets at every Try setting`, () => {
    const lesson = LESSONS[exp.id]
    expectPlain(lesson.why, 'why')
    for (const step of lesson.try) expectPlain(step.say, 'try')
    for (const patch of [{}, ...lesson.try.map((s) => s.set)]) {
      const p = { ...defaultsOf(exp.id), ...patch }
      expectPlain(lesson.see(analyse(p), p), 'see')
      for (const block of mathEntry(exp.id, p, analyse(p)).blocks) {
        if (block.kind === 'text') expectPlain(block.text, 'why')
        if (block.caption) expectPlain(block.caption, 'caption')
      }
    }
  })
  it('defines terms within budget', () => {
    for (const term of Object.values(TERMS)) expectPlain(term.def, 'term')
  })
})
