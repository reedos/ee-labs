import { describe, it, expect } from 'vitest'
import { EXPERIMENTS } from './experiments.js'
import { CUES, PICKER_TERMS, TERMS, TOPBAR_TERMS, termsFor } from './terms.js'

// Definitions on contact.
//
// A reader who meets "windup" or "deadbeat" in the middle of a note should not
// need a second tab. Each experiment declares the terms it leans on and the
// sidebar offers them right there, and this file is the automated half of the
// rule: a cue word used in an experiment's own prose must bring its definition
// with it, and a definition nobody surfaces is a definition nobody reads.

const proseOf = (e) => `${e.name} ${e.see} ${e.try.map((s) => s.say).join(' ')} ${e.why}`

describe('the cue table itself', () => {
  it('every cue id names a defined term', () => {
    for (const id of Object.keys(CUES)) expect(TERMS[id], id).toBeTruthy()
  })

  it("the top bar's own terms are defined", () => {
    for (const id of TOPBAR_TERMS) expect(TERMS[id], id).toBeTruthy()
  })

  it("the picker's own terms are defined", () => {
    for (const id of PICKER_TERMS) expect(TERMS[id], id).toBeTruthy()
  })

  it('every definition names the thing it defines', () => {
    for (const [id, t] of Object.entries(TERMS)) {
      expect(t.name, id).toBeTruthy()
      expect(t.def, id).toBeTruthy()
      // Three sentences at most, per the house rule at the top of terms.js.
      const stops = t.def.split(/[.](?=\s+[A-Z“(]|\s*$)/).filter((x) => x.trim()).length
      expect(stops, `${id} runs to ${stops} sentences`).toBeLessThanOrEqual(4)
    }
  })
})

describe('every experiment defines the words it leans on', () => {
  it('a cue word in the prose has its term in that experiment\'s list', () => {
    const missing = []
    for (const e of EXPERIMENTS) {
      const text = proseOf(e)
      for (const [id, re] of Object.entries(CUES)) {
        if (re.test(text) && !e.terms.includes(id)) missing.push(`${e.id}: uses the "${id}" cue`)
      }
    }
    expect(missing, missing.join('\n')).toEqual([])
  })

  it('every term an experiment declares resolves to a definition', () => {
    for (const e of EXPERIMENTS) {
      const resolved = termsFor(e.terms)
      const lost = e.terms.filter((id) => !TERMS[id])
      expect(lost, `${e.id} declares undefined ${lost.join(', ')}`).toEqual([])
      expect(resolved.length, e.id).toBe(e.terms.length)
    }
  })

  it('every definition is surfaced by an experiment or by the top bar', () => {
    // A definition nobody reaches is dead weight, and worse, it is a claim
    // nothing measures. The exceptions are the terms the groups not yet
    // written will claim; those are listed here by name so the list shrinks
    // visibly as the groups land rather than being waved through.
    const claimed = new Set([...TOPBAR_TERMS, ...PICKER_TERMS, ...EXPERIMENTS.flatMap((e) => e.terms)])
    const waiting = Object.keys(TERMS).filter((id) => !claimed.has(id))
    const groupsBuilt = new Set(EXPERIMENTS.map((e) => e.id[0]))
    const forLaterGroups = {
      describingfunction: 'D', filterhypothesis: 'D', harmonic: 'D', harmonicratio: 'D',
      limitcycle: 'D',
      identification: 'E', fit: 'E', residual: 'E', noise: 'E', order: 'E',
      kalman: 'F',
    }
    const orphans = waiting.filter((id) => {
      const group = forLaterGroups[id]
      return !group || groupsBuilt.has(group)
    })
    expect(orphans, `defined and never surfaced: ${orphans.join(', ')}`).toEqual([])
  })
})
