import { describe, it, expect } from 'vitest'
import { EXPERIMENTS } from './experiments.js'
import { MATCH, TERMS, termsFor } from './terms.js'

// Definitions on contact (`REVIEW_PLAYBOOK.md` §8).
//
// A term is defined where it first does work, and nowhere earlier. The rule has
// two halves and this file measures both. Every term an experiment lists is
// defined, and no experiment before its introducer uses the word at all, so a
// reader never meets a word the sidebar has not yet been willing to explain.
//
// `MATCH` is how a word is recognised in prose. It is a pattern per term rather
// than the term's own id, because the prose says "dark current" where the id is
// `darkcurrent`, and a rule that only caught the id would pass every lesson.

/** The prose of one experiment, as [field, text] pairs, in reading order. */
const proseOf = (e) => [
  ['name', e.name],
  ['see', e.see || ''],
  ...e.try.map((t, i) => [`try[${i}]`, t.say]),
  ['why', e.why || ''],
]

const usesWord = (e, id) => proseOf(e).some(([, text]) => MATCH[id].test(text))

/**
 * Naming a later experiment is how a note points ahead, and a note that points
 * ahead may say the word it is pointing at. "which is E2's requirement seen
 * from the other side" is a signpost rather than an undefined term: the reader
 * is told where the word is explained. A use with no such signpost is not
 * excused.
 */
const pointsAt = (e, intro) => {
  const id = intro.id.toUpperCase()
  const group = `Group ${intro.group.slice(0, 1)}`
  return proseOf(e).some(([, text]) => text.includes(id) || text.includes(group))
}

/**
 * The terms whose introducer shows the thing without naming it.
 *
 * A term whose own introducer never says the word rides as a named chip under
 * the note rather than as a marked word in it. That is allowed where the
 * QUANTITY is on screen while the name is not. F2 draws the whole grid of
 * channels down one fibre without ever calling the practice wavelength
 * multiplexing. The list is written out so that a second such term fails this
 * test and has to be argued for rather than added.
 */
const CHIPS = ['multiplexing@f2']

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
  })

  it('no experiment uses a word before the one that defines it', () => {
    const early = []
    for (const id of Object.keys(TERMS)) {
      const intro = introducedIn(id)
      const before = EXPERIMENTS.slice(0, EXPERIMENTS.indexOf(intro))
      for (const e of before) if (usesWord(e, id) && !pointsAt(e, intro)) early.push(`${e.id} uses ${id}, defined at ${intro.id}`)
    }
    expect(early).toEqual([])
  })

  it('each term is spelled out where it is introduced, or rides as a named chip', () => {
    const silent = []
    for (const id of Object.keys(TERMS)) {
      const intro = introducedIn(id)
      if (!usesWord(intro, id)) silent.push(`${id}@${intro.id}`)
    }
    expect(silent).toEqual(CHIPS)
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
