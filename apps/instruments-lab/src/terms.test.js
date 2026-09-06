import { describe, expect, test } from 'vitest'
import { EXPERIMENTS } from './experiments.js'
import { MATCH, TERMS } from './terms.js'

// The shape of a definition, from terms.js's own house rules: two to four
// sentences, the first saying what the thing IS, concrete numbers over
// abstraction, and no term defined using a term this lab has not defined yet.

const sentences = (s) => s.split(/[.!?](?=\s+(?![a-z])|\s*$)/).map((x) => x.trim()).filter(Boolean)

describe('every definition', () => {
  test('has a name of at most four words and a definition of two to four sentences', () => {
    for (const [id, t] of Object.entries(TERMS)) {
      expect(t.name, id).toBeTruthy()
      expect(t.name.split(/\s+/).length, `${id} name`).toBeLessThanOrEqual(4)
      expect(t.name[0], `${id} name starts capital`).toBe(t.name[0].toUpperCase())
      const ss = sentences(t.def)
      expect(ss.length, `${id} has ${ss.length} sentences`).toBeGreaterThanOrEqual(2)
      expect(ss.length, `${id} has ${ss.length} sentences`).toBeLessThanOrEqual(4)
      expect(t.def.trim().endsWith('.'), `${id} ends in a full stop`).toBe(true)
    }
  })

  test('carries a number where the term is a number', () => {
    // A definition that says "the impedance an instrument shows" and stops is a
    // dictionary entry. These say 1 MΩ, 15 pF, 1999 counts, 128.7 nV/√Hz.
    const numeric = ['inputz', 'probe', 'bandwidth', 'risetime', 'samplerate', 'shunt', 'count', 'accuracy', 'sensitivity', 'noisefloor', 'rbw', 'enbw']
    for (const id of numeric) expect(/\d/.test(TERMS[id].def), `${id} has no number in it`).toBe(true)
  })

  test('is defined only in terms this lab has already defined', () => {
    // A definition may use a term introduced at or before its own experiment.
    const order = EXPERIMENTS.map((e) => e.id)
    const at = (id) => order.indexOf((EXPERIMENTS.find((e) => (e.terms || []).includes(id)) || {}).id)
    const out = []
    for (const [id, t] of Object.entries(TERMS)) {
      for (const [other, re] of Object.entries(MATCH)) {
        if (other === id || !re.test(t.def)) continue
        if (at(other) > at(id)) out.push(`${id} uses ${other}, which arrives later`)
      }
    }
    expect(out).toEqual([])
  })

  test('every term is one an experiment lists, and every listed term is defined', () => {
    const listed = new Set(EXPERIMENTS.flatMap((e) => e.terms || []))
    expect([...listed].sort()).toEqual(Object.keys(TERMS).sort())
  })
})
