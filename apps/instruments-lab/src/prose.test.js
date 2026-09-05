import { describe, it } from 'vitest'
import { EXPERIMENTS } from './experiments.js'
import { GROUP_INTRO } from './course.js'
import { TERMS } from './terms.js'
import { VIEW_LABELS } from './kit.js'
import { expectPlain } from '@ee-labs/prose/testing'

// The house style, measured (STYLE.md).
//
// experiments.test.js measures what a lesson CLAIMS: every number in see, try
// and why is a value the solver produced. This file measures how the claim is
// written — one claim a sentence, no dash for emphasis, no colon reveal, no
// personified instrument — so twenty-five experiments stay in one voice.
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

describe('the chrome reads plainly', () => {
  it('each group’s intro is a note a reader meets first', () => {
    for (const [letter, text] of Object.entries(GROUP_INTRO)) expectPlain(text, 'noteGroupFirst', `group ${letter}`)
  })

  it('each view has a label of a few words and a sentence of hover text', () => {
    for (const [view, { label, title }] of Object.entries(VIEW_LABELS)) {
      expectPlain(label, 'label', `${view} label`)
      expectPlain(title, 'tooltip', `${view} title`)
    }
  })

  it('each knob’s hint is a phrase, not a paragraph', () => {
    for (const e of EXPERIMENTS) {
      for (const k of e.params) {
        expectPlain(k.label, 'label', `${e.id}.${k.key} label`)
        if (k.hint) expectPlain(k.hint, 'tooltip', `${e.id}.${k.key} hint`)
      }
    }
  })
})
