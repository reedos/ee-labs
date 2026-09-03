import { describe, it } from 'vitest'
import { EXPERIMENTS, GROUPS } from './experiments.js'
import { TERMS } from './terms.js'
import { expectPlain } from '@ee-labs/prose/testing'

// The house style, measured (STYLE.md).
//
// notes.test.js already holds the notes to a reading level: length, sentence
// average, the try line's sixteen words. This file holds the same strings to the
// rest of the rules — no dash for emphasis, no colon reveal, no personified
// converter — so the voice cannot drift back one lesson at a time.

const groupFirst = new Set(GROUPS.map((g) => EXPERIMENTS.find((e) => e.group === g).id))

describe('every experiment reads plainly', () => {
  for (const e of EXPERIMENTS) {
    it(`${e.id} ${e.name}`, () => {
      expectPlain(e.note, groupFirst.has(e.id) ? 'noteGroupFirst' : 'note', `${e.id} note`)
      expectPlain(e.try.text, 'tryText', `${e.id} try`)
      expectPlain(e.name, 'title', `${e.id} name`)
    })
  }
})

describe('every term reads plainly', () => {
  for (const [id, t] of Object.entries(TERMS)) {
    it(id, () => {
      expectPlain(t.def, 'term', `${id} def`)
      expectPlain(t.name, 'label', `${id} name`)
    })
  }
})
