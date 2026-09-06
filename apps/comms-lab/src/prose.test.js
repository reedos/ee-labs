import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, VIEWS, GROUPS } from './experiments.js'
import { LESSONS } from './lessons.js'
import { TERMS } from './terms.js'
import { DEFAULTS } from './analysis.js'
import { expectPlain, expectAllPlain } from '@ee-labs/prose/testing'

// The house style, measured (STYLE.md).
//
// Every word a reader can see on this lab's screens goes through a budget: the
// three lesson registers, the experiment names, the group headers, the view
// labels and every term definition. The register cannot drift back one
// experiment at a time when each string is measured.

describe('every lesson reads plainly', () => {
  for (const e of EXPERIMENTS) {
    const lesson = LESSONS[e.id]
    it(`${e.id} ${e.name}`, () => {
      expectPlain(e.name, 'title', `${e.id} name`)
      expectPlain(lesson.see, 'see', `${e.id} see`)
      expectPlain(lesson.why, 'why', `${e.id} why`)
      expectAllPlain(
        lesson.try.map((t) => t.say),
        'try',
        (_, i) => `${e.id} try[${i}]`,
      )
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

describe('the chrome reads plainly', () => {
  it('the view labels are short noun phrases', () => {
    for (const [id, label] of Object.entries(VIEWS)) expectPlain(label, 'label', `view ${id}`)
  })

  it('the group headers name what is under them', () => {
    for (const g of GROUPS) expectPlain(g, 'title', `group "${g}"`)
  })
})

describe('the lesson structure', () => {
  it('gives every experiment a see, a try and a why', () => {
    for (const e of EXPERIMENTS) {
      const l = LESSONS[e.id]
      expect(l.see, `${e.id} see`).toBeTruthy()
      expect(l.why, `${e.id} why`).toBeTruthy()
      expect(l.try.length, `${e.id} try`).toBeGreaterThanOrEqual(1)
    }
  })

  it('gives every try step a setting to apply, or none at all', () => {
    for (const e of EXPERIMENTS) {
      for (const step of LESSONS[e.id].try) {
        expect(typeof step.set, `${e.id}`).toBe('object')
      }
    }
  })

  it('sets only parameters the analysis reads, so no step moves nothing', () => {
    const known = Object.keys(DEFAULTS)
    for (const e of EXPERIMENTS) {
      for (const step of LESSONS[e.id].try) {
        for (const k of Object.keys(step.set)) {
          expect(known.concat(Object.keys(e.params)), `${e.id} sets ${k}`).toContain(k)
        }
      }
    }
  })
})
