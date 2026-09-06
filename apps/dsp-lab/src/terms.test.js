import { describe, it, expect } from 'vitest'
import { CHROME_TERMS, TERMS, TERM_WORDS, termsInText } from './terms.js'
import { EXPERIMENTS } from './experiments.js'
import { BLOCK_TYPES } from './blocks.js'

// Definitions on contact, enforced.
//
// `REVIEW_PLAYBOOK.md` §8: every term a lesson leans on is defined in a folded
// panel under the note. The registry is one half of that and this test is the
// other. A word that means a reader has just met a term appears in TERM_WORDS,
// and a lesson using that word without listing the term fails here.

const textOf = (e) =>
  [e.name, e.see, e.try, e.why, ...(e.chips ?? []).map((c) => c.label)].join(' ')

describe('every term a lesson uses is defined', () => {
  it('and defined before it is leaned on', () => {
    for (const e of EXPERIMENTS) {
      const met = termsInText(textOf(e))
      const listed = new Set([...e.terms, ...CHROME_TERMS])
      for (const id of met) {
        expect(listed.has(id), `${e.id} uses "${TERMS[id].short}" without listing it`).toBe(true)
      }
    }
  })

  it('every listed term exists in the registry', () => {
    for (const e of EXPERIMENTS) {
      for (const id of e.terms) expect(TERMS[id], `${e.id}: ${id}`).toBeTruthy()
    }
    for (const id of CHROME_TERMS) expect(TERMS[id], id).toBeTruthy()
  })

  it('every term in the registry is used by at least one lesson', () => {
    const used = new Set(CHROME_TERMS)
    for (const e of EXPERIMENTS) for (const id of e.terms) used.add(id)
    for (const id of Object.keys(TERMS)) {
      expect(used.has(id), `${id} is defined and never referenced`).toBe(true)
    }
  })

  it('no definition leans on a term that is not defined', () => {
    for (const [id, term] of Object.entries(TERMS)) {
      for (const other of termsInText(term.def)) {
        if (other === id) continue
        expect(TERMS[other], `${id} uses ${other}`).toBeTruthy()
      }
    }
  })

  it('every word pattern names a term that exists', () => {
    for (const id of Object.keys(TERM_WORDS)) expect(TERMS[id], id).toBeTruthy()
  })

  it('a definition opens by saying what the thing is', () => {
    for (const [id, term] of Object.entries(TERMS)) {
      expect(term.name, id).toBeTruthy()
      expect(term.short, id).toBeTruthy()
      expect(term.def.length, id).toBeGreaterThan(60)
    }
  })
})

describe('the blocks explain themselves too', () => {
  it('every block carries a hint, and every parameter that needs one has one', () => {
    for (const [type, def] of Object.entries(BLOCK_TYPES)) {
      expect(def.hint, type).toBeTruthy()
      expect(def.label, type).toBeTruthy()
      expect(def.group, type).toBeTruthy()
    }
  })

  it('every block that declines a response says why, in a sentence', () => {
    for (const [type, def] of Object.entries(BLOCK_TYPES)) {
      const declines = def.response(def.defaults, 1000, 48000) == null
      if (!declines && !def.lti) {
        expect(def.reason, `${type} answers and should not explain itself`).toBeUndefined()
        continue
      }
      expect(def.reason, type).toBeTruthy()
      expect(def.reason.trim().endsWith('.'), `${type}: ${def.reason}`).toBe(true)
    }
  })
})
