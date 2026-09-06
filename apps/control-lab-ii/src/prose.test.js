import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS } from './experiments.js'
import { TERMS } from './terms.js'
import { expectPlain } from '@ee-labs/prose/testing'
import { PLANTS, CONTROLLERS, NONLINEARITIES } from './systems.js'

// The house style, measured (STYLE.md).
//
// Every word a reader sees, against the budget for the field it appears in.
// The three registers have three different budgets because they are read at
// three different paces: the `see` is glanced at, a try step is obeyed, and
// the `why` is read slowly with the picture in front of you.

describe('every experiment reads plainly', () => {
  for (const e of EXPERIMENTS) {
    it(`${e.id} ${e.name}`, () => {
      expectPlain(e.name, 'title', `${e.id} name`)
      expectPlain(e.see, 'see', `${e.id} see`)
      expectPlain(e.why, 'why', `${e.id} why`)
      e.try.forEach((s, i) => expectPlain(s.say, 'try', `${e.id} try[${i}]`))
    })
  }
})

describe('every definition reads plainly', () => {
  for (const [id, t] of Object.entries(TERMS)) {
    it(id, () => {
      expectPlain(t.def, 'term', `${id} def`)
      expectPlain(t.name, 'label', `${id} name`)
    })
  }
})

describe('the chrome reads plainly', () => {
  for (const [id, p] of Object.entries(PLANTS)) {
    it(`plant ${id}`, () => {
      expectPlain(p.name, 'label', `${id} name`)
      expectPlain(p.hint, 'why', `${id} hint`)
      for (const q of p.params) expectPlain(q.label, 'label', `${id}.${q.key} label`)
    })
  }
  for (const [id, c] of Object.entries(CONTROLLERS)) {
    it(`controller ${id}`, () => {
      expectPlain(c.name, 'label', `${id} name`)
      expectPlain(c.hint, 'why', `${id} hint`)
    })
  }
  for (const [id, n] of Object.entries(NONLINEARITIES)) {
    it(`nonlinearity ${id}`, () => {
      expectPlain(n.name, 'label', `${id} name`)
      expectPlain(n.hint, 'why', `${id} hint`)
    })
  }
  it('the group headings are noun phrases', () => {
    for (const g of GROUPS) expectPlain(g, 'label', `group "${g}"`)
  })
})

describe('the shape of an entry', () => {
  it('every experiment has an id, a group, a name, three registers and a patch', () => {
    const seen = new Set()
    for (const e of EXPERIMENTS) {
      expect(e.id, 'an experiment with no id').toBeTruthy()
      expect(seen.has(e.id), `${e.id} appears twice`).toBe(false)
      seen.add(e.id)
      expect(GROUPS, `${e.id} is in an unlisted group`).toContain(e.group)
      expect(e.see.length, `${e.id} see`).toBeGreaterThan(40)
      expect(e.why.length, `${e.id} why`).toBeGreaterThan(80)
      expect(e.try.length, `${e.id} has no try step`).toBeGreaterThan(0)
      expect(typeof e.claim, `${e.id} claim`).toBe('function')
      expect(e.patch.plantId, `${e.id} patch`).toBeTruthy()
    }
  })

  it('the ids run in the plan\'s order, with no gaps inside a group', () => {
    for (const g of GROUPS) {
      const ids = EXPERIMENTS.filter((e) => e.group === g).map((e) => e.id)
      const letter = ids[0][0]
      expect(ids, `${g} is not numbered from 1`).toEqual(ids.map((_, i) => `${letter}${i + 1}`))
    }
  })

  it('every try step names a setting, so a chip can apply it in one click', () => {
    for (const e of EXPERIMENTS) {
      for (const [i, s] of e.try.entries()) {
        expect(s.set && Object.keys(s.set).length, `${e.id} try[${i}] sets nothing`).toBeGreaterThan(0)
      }
    }
  })
})
