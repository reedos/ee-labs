import { describe, it, expect } from 'vitest'
import { EXPERIMENTS } from './experiments.js'
import { MATCH, TERMS, termsFor } from './terms.js'

// Definitions on contact (`REVIEW_PLAYBOOK.md` §8).
//
// A term is defined where it first does work, and nowhere earlier. The rule has
// two halves and this file measures both. Every term an experiment lists is
// defined, and its definition is offered by the first experiment whose prose
// uses the word. No experiment before that one uses it at all, so a reader
// never meets a word the sidebar has not yet been willing to explain.
//
// `MATCH` is how a word is recognised in prose. It is a pattern per term rather
// than the term's own headword, because a note says "cascaded" where the term
// is "cascade", and a rule that caught only the headword would pass a lesson
// that never says it.

/** The prose of one experiment, as [field, text] pairs, in reading order. */
const proseOf = (e) => [
  ['name', e.name],
  ['see', e.see || ''],
  ...(e.try || []).map((t, i) => [`try[${i}]`, t.say]),
  ['why', e.why || ''],
]

const usesWord = (e, id) => proseOf(e).some(([, text]) => MATCH[id].test(text))

/** The first experiment that lists a term, in reading order. */
const introducedIn = (id) => EXPERIMENTS.find((e) => (e.terms || []).includes(id))

describe('terms where they first do work', () => {
  it('every term has a pattern and every pattern a term', () => {
    expect(Object.keys(MATCH).sort()).toEqual(Object.keys(TERMS).sort())
  })

  it('every definition names the thing and says why it matters here', () => {
    for (const [id, t] of Object.entries(TERMS)) {
      expect(t.name, `${id} has no name`).toBeTruthy()
      expect(t.def.length, `${id} definition is ${t.def.length} characters`).toBeGreaterThan(80)
      const sentences = t.def.split(/(?<=[.!?])\s+/).filter((s) => s.trim())
      expect(sentences.length, `${id} is ${sentences.length} sentences`).toBeGreaterThanOrEqual(2)
      expect(sentences.length, `${id} is ${sentences.length} sentences`).toBeLessThanOrEqual(4)
    }
  })

  it('every term some experiment lists is defined, and every definition is listed once', () => {
    const listed = EXPERIMENTS.flatMap((e) => e.terms || [])
    for (const id of listed) expect(TERMS[id], `an experiment lists ${id}, which is not defined`).toBeDefined()
    for (const id of Object.keys(TERMS)) expect(introducedIn(id), `${id} is defined and never listed`).toBeDefined()
    expect(listed.length, 'a term is listed by two experiments').toBe(new Set(listed).size)
  })

  it('no experiment uses a word before the one that defines it', () => {
    const early = []
    for (const id of Object.keys(TERMS)) {
      const intro = introducedIn(id)
      const before = EXPERIMENTS.slice(0, EXPERIMENTS.indexOf(intro))
      for (const e of before) if (usesWord(e, id)) early.push(`${e.id} uses ${id}, defined at ${intro.id}`)
    }
    expect(early).toEqual([])
  })

  it('each term is spelled out in the prose of the experiment that introduces it', () => {
    // Group A defines eleven terms and every one of them is said aloud where it
    // is offered. Fields Lab keeps a list of terms whose introducer shows the
    // symbol without saying the name; this lab has none, and a twelfth term
    // that needs one has to be argued for rather than added.
    const silent = []
    for (const id of Object.keys(TERMS)) if (!usesWord(introducedIn(id), id)) silent.push(`${id}@${introducedIn(id).id}`)
    expect(silent).toEqual([])
  })

  it('the sidebar offers an experiment its own terms, in the order it lists them', () => {
    for (const e of EXPERIMENTS) {
      const offered = termsFor(e.terms)
      expect(
        offered.map((t) => t.id),
        `${e.id} terms`,
      ).toEqual(e.terms || [])
      for (const t of offered) expect(t.def, `${e.id} offers ${t.id} with no definition`).toBeTruthy()
    }
  })
})
