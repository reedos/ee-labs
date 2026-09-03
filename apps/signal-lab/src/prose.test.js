import { describe, it } from 'vitest'
import { PRESETS } from './presets.js'
import { TERMS } from './terms.js'
import { expectPlain } from '@ee-labs/prose/testing'

// The house style, measured (STYLE.md).
//
// try.test.js already holds every note to one claim: 55 words, three sentences,
// no imperative sentence. This file holds the same strings to the rest of the
// rules, so the register cannot drift back one preset at a time.

describe('every preset reads plainly', () => {
  for (const p of PRESETS) {
    it(p.name, () => {
      expectPlain(p.note, 'note', `${p.name} note`)
      if (p.try) expectPlain(p.try, 'tryText', `${p.name} try`)
      expectPlain(p.name, 'title', `${p.name} name`)
    })
  }
})

describe('every term reads plainly', () => {
  for (const [id, t] of Object.entries(TERMS)) {
    it(id, () => expectPlain(t.def || t.definition, 'term', `${id} def`))
  }
})
