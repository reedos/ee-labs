import { describe, it } from 'vitest'
import { EXPERIMENTS, VIEW_LABELS } from './experiments.js'
import { TERMS } from './terms.js'
import { expectPlain } from '@ee-labs/prose/testing'

// The house style, measured (`STYLE.md`).
//
// `experiments.test.js` measures what a lesson CLAIMS: every number in see, try
// and why is a value the engine produces at the settings the step names. This
// file measures how the claim is written. One claim a sentence, no dash for
// emphasis, no colon reveal, no personified engine, so that this lab reads in
// the same voice as the eight beside it.
//
// The lessons are read off EXPERIMENTS rather than off LESSONS, because
// `experiments.js` merges each lesson onto its experiment at load and importing
// `lessons.js` first would leave that merge half done.

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
  it('every view switch carries a label and a sentence saying what it shows', () => {
    for (const [view, meta] of Object.entries(VIEW_LABELS)) {
      expectPlain(meta.label, 'label', `${view} label`)
      expectPlain(meta.title, 'tooltip', `${view} title`)
    }
  })

  it('every knob is named and hinted plainly', () => {
    for (const e of EXPERIMENTS) {
      for (const k of e.params) {
        expectPlain(k.label, 'label', `${e.id} ${k.key} label`)
        if (k.hint) expectPlain(k.hint, 'tooltip', `${e.id} ${k.key} hint`)
        for (const o of k.options || []) expectPlain(o.label, 'label', `${e.id} ${k.key} option ${o.value}`)
      }
    }
  })

  it('the group headings name their content', () => {
    for (const g of new Set(EXPERIMENTS.map((e) => e.group))) expectPlain(g.slice(4), 'title', `group ${g}`)
  })
})
