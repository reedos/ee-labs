import { describe, it } from 'vitest'
import { EXPERIMENTS, VIEW_LABELS } from './experiments.js'
import { TERMS } from './terms.js'
import { expectPlain } from '@ee-labs/prose/testing'

// The house style, measured (STYLE.md).
//
// experiments.test.js already measures what a lesson CLAIMS: every number in
// see, try and why is a value the engine produces. This file measures how the
// claim is written — one claim a sentence, no dash for emphasis, no colon
// reveal, no personified engine — so twenty-four experiments stay in one voice.

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
    it(id, () => {
      expectPlain(t.name, 'label', `${id} name`)
      expectPlain(t.def, 'term', `${id} def`)
    })
  }
})

describe('the chrome reads plainly', () => {
  for (const [view, v] of Object.entries(VIEW_LABELS)) {
    it(view, () => {
      expectPlain(v.label, 'label', `${view} label`)
      expectPlain(v.title, 'tooltip', `${view} title`)
    })
  }
})

describe('every knob label reads plainly', () => {
  for (const e of EXPERIMENTS) {
    it(e.id, () => {
      for (const k of e.params) expectPlain(k.label, 'label', `${e.id}.${k.key}`)
    })
  }
})
