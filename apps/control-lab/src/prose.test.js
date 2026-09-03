import { describe, it } from 'vitest'
import { LESSONS } from './lessons.js'
import { TERMS } from './terms.js'
import { PLANT_DEF, CONTROLLER_DEF } from './chrome.js'
import { expectPlain } from '@ee-labs/prose/testing'

// The house style, measured (STYLE.md).
//
// lessons.chips.test.js already caps a note at 55 words and a try line at 40,
// and terms.scan.test.js requires a cue word to have its term. This file adds
// the rest of the rules to the same strings.

describe('every lesson reads plainly', () => {
  for (const l of LESSONS) {
    it(l.name, () => {
      expectPlain(l.note, 'note', `${l.name} note`)
      if (l.try) expectPlain(typeof l.try === 'string' ? l.try : l.try.text, 'try', `${l.name} try`)
      expectPlain(l.name, 'title', `${l.name} name`)
    })
  }
})

describe('every term reads plainly', () => {
  for (const [id, t] of Object.entries(TERMS)) {
    it(id, () => expectPlain(t.def, 'term', `${id} def`))
  }
})

// The two section-header definitions (item 3, student review): on screen
// under every lesson and every picker state, so they carry the same budget
// a note does.
describe('the section-header definitions read plainly', () => {
  it('plant', () => expectPlain(PLANT_DEF, 'note', 'PLANT_DEF'))
  it('controller', () => expectPlain(CONTROLLER_DEF, 'note', 'CONTROLLER_DEF'))
})
