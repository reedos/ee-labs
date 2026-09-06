import { describe, it, expect } from 'vitest'
import { EXPERIMENTS } from './experiments.js'
import { LESSONS } from './lessons.js'
import { TERMS, TERM_WORDS, CHROME_TERMS, termsFor, termsInText } from './terms.js'

// Definitions on contact (REVIEW_PLAYBOOK section 8).
//
// A student meeting "ergodic" or "degrees of freedom" mid-lesson should not need
// a second tab. Two halves of one contract are checked here. Every term an
// experiment names must be defined, and every word in a lesson that means a term
// has been met must be a term that lesson lists.

describe('the term registry', () => {
  it('gives every term a name, a short form and a definition', () => {
    for (const [id, t] of Object.entries(TERMS)) {
      expect(t.name, `${id} name`).toBeTruthy()
      expect(t.short, `${id} short`).toBeTruthy()
      expect(t.def, `${id} def`).toBeTruthy()
    }
  })

  it('names a word list for every term, so the scanner can find it', () => {
    for (const id of Object.keys(TERMS)) {
      expect(TERM_WORDS[id], `${id} has no words`).toBeTruthy()
      expect(TERM_WORDS[id].length, `${id} words`).toBeGreaterThan(0)
    }
  })

  it('has no word list for a term it does not define', () => {
    for (const id of Object.keys(TERM_WORDS)) expect(TERMS[id], `words for ${id}`).toBeTruthy()
  })

  it('defines every chrome term, since they appear on every screen', () => {
    for (const id of CHROME_TERMS) expect(TERMS[id], `chrome term ${id}`).toBeTruthy()
    expect(termsFor(CHROME_TERMS).length).toBe(CHROME_TERMS.length)
  })

  it('defines no term with a term it has not defined', () => {
    // A definition that leans on undefined vocabulary sends the reader looking
    // for a second tab, which is what this pattern exists to prevent.
    for (const [id, t] of Object.entries(TERMS)) {
      for (const used of termsInText(t.def)) {
        expect(TERMS[used], `${id} uses ${used}`).toBeTruthy()
      }
    }
  })

  it('surfaces every term somewhere, so none is written and never shown', () => {
    const named = new Set(CHROME_TERMS)
    for (const e of EXPERIMENTS) for (const t of e.terms) named.add(t)
    for (const id of Object.keys(TERMS)) {
      expect(named.has(id), `term "${id}" is defined and never surfaced`).toBe(true)
    }
  })
})

describe('every lesson defines the vocabulary it uses', () => {
  for (const e of EXPERIMENTS) {
    it(`${e.id} ${e.name}`, () => {
      const listed = new Set([...e.terms, ...CHROME_TERMS])
      const text = [LESSONS[e.id].see, LESSONS[e.id].why, ...LESSONS[e.id].try.map((t) => t.say)].join(' ')
      const missing = termsInText(text).filter((t) => !listed.has(t))
      expect(missing, `${e.id} uses ${missing.join(', ')} without listing them`).toEqual([])
    })
  }
})

describe('termsFor', () => {
  it('returns the definitions in the order they were named', () => {
    const got = termsFor(['ber', 'seed'])
    expect(got.map((t) => t.id)).toEqual(['ber', 'seed'])
  })

  it('drops an id it does not know rather than rendering an empty entry', () => {
    expect(termsFor(['ber', 'nosuch']).length).toBe(1)
  })
})
