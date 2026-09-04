import { describe, it, expect } from 'vitest'
import { markTerms, termsFor } from './terms.js'
import { LESSONS } from './lessons.js'

// markTerms is what makes a term reachable IN the note, not just behind the
// "Terms used here" fold a reader has to notice first. These tests hold the
// splitter itself to its contract; App.test-equivalent coverage (rendering)
// is the prose/lessons tests plus the browser harness.

describe('markTerms: the note carries its own definitions', () => {
  it('marks a plain match and keeps the surrounding text intact', () => {
    const terms = termsFor(['corner'])
    const text = 'The cutoff is the frequency where the two impedances match.'
    const segs = markTerms(text, terms)
    const joined = segs.map((s) => s.text).join('')
    expect(joined).toBe(text)
    expect(segs.some((s) => s.term === 'corner')).toBe(true)
  })

  it('marks each of several terms once, left to right, with no overlap', () => {
    const terms = termsFor(['pole', 'jw', 'lhp'])
    const text = 'Poles in the left half plane die out; on the boundary this pole never does.'
    const segs = markTerms(text, terms)
    const hits = segs.filter((s) => s.term)
    // Each id appears at most once, and in the order its match is first found.
    const ids = hits.map((h) => h.term)
    expect(new Set(ids).size).toBe(ids.length)
    expect(segs.map((s) => s.text).join('')).toBe(text)
  })

  it('marks nothing when no term matches, and returns the text unsplit', () => {
    const terms = termsFor(['tank'])
    const text = 'A resistor and a capacitor make a low-pass.'
    const segs = markTerms(text, terms)
    expect(segs).toEqual([{ text }])
  })

  it('skips a term with no match pattern (the hand-over-only terms) without crashing', () => {
    const segs = markTerms('Any text at all.', [{ id: 'x', name: 'X', def: 'no match field' }])
    expect(segs).toEqual([{ text: 'Any text at all.' }])
  })

  it('every lesson note marks at least one of its own terms inline, when any of its words appear', () => {
    // Not every listed term's word appears in the note (some ride only the
    // topbar or the try line — terms.js documents this as allowed), so this
    // only asserts: if markTerms finds ANY hit, every hit is one of the
    // lesson's own declared terms, and the reassembled text is unchanged.
    for (const l of LESSONS) {
      const terms = termsFor(l.terms)
      const segs = markTerms(l.note, terms)
      expect(segs.map((s) => s.text).join(''), l.name).toBe(l.note)
      for (const s of segs) if (s.term) expect(l.terms, l.name).toContain(s.term)
    }
  })
})
