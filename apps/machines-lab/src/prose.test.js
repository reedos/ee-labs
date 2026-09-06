import { describe, it } from 'vitest'
import { EXPERIMENTS, VIEW_LABELS } from './experiments.js'
import { TERMS } from './terms.js'
import { expectPlain } from '@ee-labs/prose/testing'

// The house style, measured (STYLE.md).
//
// experiments.test.js already measures what a lesson CLAIMS: every number in
// see, try and why is a value the model produces. This file measures how the
// claim is written. One claim a sentence, no dash for emphasis, no colon
// reveal, no personified solver, so 35 experiments stay in one voice.
//
// The lessons are read off EXPERIMENTS rather than LESSONS, because
// experiments.js merges each lesson onto its experiment at load.

describe('every lesson reads plainly', () => {
  for (const e of EXPERIMENTS) {
    it(`${e.id} ${e.name}`, () => {
      expectPlain(e.name, 'title', `${e.id} name`)
      expectPlain(e.see, 'see', `${e.id} see`)
      expectPlain(e.why, 'why', `${e.id} why`)
      e.try.forEach((t, i) => expectPlain(t.say, 'try', `${e.id} try[${i}]`))
    })
  }
})

describe('every term reads plainly', () => {
  for (const [id, t] of Object.entries(TERMS)) {
    it(id, () => expectPlain(t.def, 'term', `${id} def`))
  }
})

describe('every knob and view is named plainly', () => {
  it('view labels and their hover text', () => {
    for (const [id, v] of Object.entries(VIEW_LABELS)) {
      expectPlain(v.label, 'label', `${id} label`)
      expectPlain(v.title, 'tooltip', `${id} title`)
    }
  })

  it('knob labels', () => {
    for (const e of EXPERIMENTS) for (const p of e.params) expectPlain(p.label, 'label', `${e.id} ${p.key}`)
  })
})
