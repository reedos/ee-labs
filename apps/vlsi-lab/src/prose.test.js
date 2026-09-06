import { it } from 'vitest'
import { expectPlain } from '@ee-labs/prose/testing'
import { EXPERIMENTS, analyse } from './experiments.js'
import { transfer } from './model.js'
import { TERMS } from './terms.js'
import { EVENT_GUARD, EXTRACTION_SCOPE } from './extract.js'

const dc = transfer()
for (const e of EXPERIMENTS) it(`${e.id} follows the prose budgets at defaults and every try step`, () => {
  expectPlain(e.name, 'title')
  expectPlain(e.shortName, 'title')
  expectPlain(e.why, 'why')
  let p = { ...e.defaults }
  for (const step of [{ set: {} }, ...e.try]) {
    p = { ...p, ...step.set }
    expectPlain(e.see(analyse(p, dc), p), 'see')
    if (step.say) expectPlain(step.say, 'try')
  }
})
it('defines terms and states boundaries plainly', () => {
  for (const term of Object.values(TERMS)) expectPlain(term.def, 'term')
  expectPlain(EVENT_GUARD, 'note')
  expectPlain(EXTRACTION_SCOPE, 'note')
})
