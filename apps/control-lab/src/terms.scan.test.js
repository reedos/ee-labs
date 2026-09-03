import { describe, it, expect } from 'vitest'
import { LESSONS } from './lessons.js'
import { CUES, TERMS, TOPBAR_TERMS, termsFor } from './terms.js'

// Definitions on contact: a cue word used in a lesson's own prose (note or
// try line) must bring its definition with it — the reader should never
// meet "handoff" or "rings" mid-lesson with no way to look it up right
// there. This is the automated half of that rule; lessons.test.js/
// lessons.chips.test.js check the rest (every declared term is defined,
// every definition is surfaced by some lesson).

describe('CUES — the cue table itself', () => {
  it('every cue id names a real, defined term', () => {
    for (const id of Object.keys(CUES)) {
      expect(TERMS[id], id).toBeTruthy()
    }
  })

  it('the top bar terms are all defined', () => {
    for (const id of TOPBAR_TERMS) expect(TERMS[id], id).toBeTruthy()
  })
})

describe('every lesson defines the words it leans on', () => {
  it('a cue word in the note or try line has its term in that lesson\'s list', () => {
    for (const l of LESSONS) {
      const text = `${l.note} ${l.try}`
      for (const [id, re] of Object.entries(CUES)) {
        if (re.test(text)) {
          expect(l.terms, `${l.name}: text uses the "${id}" cue`).toContain(id)
        }
      }
    }
  })

  it('every lesson carries the top bar\'s own terms — it is on screen throughout', () => {
    for (const l of LESSONS) {
      for (const id of TOPBAR_TERMS) {
        expect(l.terms, `${l.name}: missing top bar term "${id}"`).toContain(id)
      }
    }
  })

  it('every term a lesson declares is actually surfaced (termsFor resolves it)', () => {
    for (const l of LESSONS) {
      const resolved = termsFor(l.terms)
      expect(resolved.length, l.name).toBe(l.terms.length)
    }
  })
})
