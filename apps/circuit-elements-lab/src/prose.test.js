import { describe, it } from 'vitest'
import { EXPERIMENTS } from './experiments.js'
import { TERMS } from './terms.js'
import { expectPlain } from '@ee-labs/prose/testing'

// The house style, measured (STYLE.md).
//
// experiments.test.js already measures what a lesson CLAIMS: every number in
// see, try and why is a value the solver produces. This file measures how the
// claim is written — one claim a sentence, no dash for emphasis, no colon
// reveal, no personified solver — so 58 experiments stay in one voice.
//
// The lessons are read off EXPERIMENTS rather than LESSONS: experiments.js
// merges each lesson onto its experiment at load, and importing lessons.js
// first leaves that merge half done.

describe('every lesson reads plainly', () => {
  for (const e of EXPERIMENTS) {
    it(`${e.id} ${e.name}`, () => {
      expectPlain(e.name, 'title', `${e.id} name`)
      if (e.see) expectPlain(e.see, 'see', `${e.id} see`)
      if (e.why) expectPlain(e.why, 'why', `${e.id} why`)
      ;(e.try || []).forEach((t, i) => expectPlain(t.say, 'try', `${e.id} try[${i}]`))
    })
  }
})

describe('every term reads plainly', () => {
  for (const [id, t] of Object.entries(TERMS)) {
    it(id, () => expectPlain(t.def, 'term', `${id} def`))
  }
})
