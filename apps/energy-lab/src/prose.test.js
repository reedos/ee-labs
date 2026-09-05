import { describe, it } from 'vitest'
import { EXPERIMENTS, GROUP_INTROS, VIEW_LABELS } from './experiments.js'
import { TERMS } from './terms.js'
import { expectPlain, expectAllPlain } from '@ee-labs/prose/testing'

// The house style, measured (STYLE.md).
//
// experiments.test.js already holds every note to its physics. This file holds
// the same strings to the rest of the rules — no dash for emphasis, no colon
// reveal, no personified solver — so the voice cannot drift back one lesson at
// a time.

describe('every lesson reads plainly', () => {
  for (const e of EXPERIMENTS) {
    it(`${e.id} ${e.name}`, () => {
      expectPlain(e.see, 'see', `${e.id} see`)
      expectPlain(e.why, 'why', `${e.id} why`)
      expectPlain(e.name, 'title', `${e.id} name`)
      expectAllPlain(
        e.try.map((t) => t.say),
        'try',
        (_, i) => `${e.id} try ${i + 1}`,
      )
    })
  }
})

describe('every term reads plainly', () => {
  for (const [id, t] of Object.entries(TERMS)) {
    it(id, () => {
      expectPlain(t.def, 'term', `${id} def`)
    })
  }
})

describe('the chrome reads plainly', () => {
  it('the view labels are noun phrases', () => {
    expectAllPlain(
      Object.values(VIEW_LABELS).map((v) => v.label),
      'label',
      (v) => `view label "${v}"`,
    )
  })

  it('a group intro is two sentences at the reading level of a note', () => {
    expectAllPlain(Object.values(GROUP_INTROS), 'noteGroupFirst', (_, i) => `group intro ${i + 1}`)
  })
})
