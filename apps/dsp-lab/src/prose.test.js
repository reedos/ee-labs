import { describe, it, expect } from 'vitest'
import { BUDGETS, violations } from '@ee-labs/prose'
import { EXPERIMENTS } from './experiments.js'
import { TERMS } from './terms.js'
import { BLOCK_TYPES } from './blocks.js'

// Every word a reader can see, against STYLE.md's budgets.
//
// The physics is measured by experiments.test.js and the words are measured
// here. One claim a sentence, no dash doing a colon's work, no personification
// of a filter, and labels that name what they label.

describe('the lessons', () => {
  it('every see, try and why is within its budget', () => {
    const found = []
    for (const e of EXPERIMENTS) {
      found.push(...violations(e.see, BUDGETS.see, `${e.id} see`))
      found.push(...violations(e.try, BUDGETS.try, `${e.id} try`))
      found.push(...violations(e.why, BUDGETS.why, `${e.id} why`))
      found.push(...violations(e.name, BUDGETS.title, `${e.id} name`))
    }
    expect(found).toEqual([])
  })

  it('every try line starts with a verb, as an instruction does', () => {
    const VERB = /^(Set|Switch|Turn|Click|Drag|Raise|Lower|Move|Read|Add|Remove|Open|Close|Choose|Load|Press|Watch|Type)\b/
    for (const e of EXPERIMENTS) {
      expect(VERB.test(e.try), `${e.id}: ${e.try}`).toBe(true)
    }
  })

  it('every term definition is within its budget', () => {
    const found = []
    for (const [id, t] of Object.entries(TERMS)) {
      found.push(...violations(t.def, BUDGETS.term, `${id} def`))
      found.push(...violations(t.name, BUDGETS.label, `${id} name`))
    }
    expect(found).toEqual([])
  })
})

describe('the chrome', () => {
  it('every block label is a short noun phrase', () => {
    const found = []
    for (const [type, def] of Object.entries(BLOCK_TYPES)) {
      found.push(...violations(def.label, BUDGETS.label, `${type} label`))
    }
    expect(found).toEqual([])
  })

  it('every parameter label and hint reads as the suite writes', () => {
    const found = []
    for (const [type, def] of Object.entries(BLOCK_TYPES)) {
      for (const p of def.params) {
        found.push(...violations(p.label, BUDGETS.label, `${type}.${p.key} label`))
        if (p.hint) found.push(...violations(p.hint, BUDGETS.note, `${type}.${p.key} hint`))
      }
      found.push(...violations(def.hint, BUDGETS.note, `${type} hint`))
      if (def.reason) found.push(...violations(def.reason, BUDGETS.note, `${type} reason`))
    }
    expect(found).toEqual([])
  })

  it('every chip label is short enough to sit in a row of them', () => {
    for (const e of EXPERIMENTS) {
      for (const c of e.chips ?? []) {
        expect(c.label.length, `${e.id} chip "${c.label}"`).toBeLessThanOrEqual(14)
      }
    }
  })

  it('every readout label names its quantity', () => {
    const found = []
    for (const e of EXPERIMENTS) {
      for (const c of e.claims) {
        found.push(...violations(c.label, BUDGETS.caption, `${e.id} ${c.path}`))
      }
    }
    expect(found).toEqual([])
  })
})
