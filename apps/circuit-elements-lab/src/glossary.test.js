import { describe, expect, test } from 'vitest'
import { EXPERIMENTS, byId } from './experiments.js'
import { TERMS, MATCH } from './terms.js'
import { introducedIn, firstUses, pointsAhead, earlyUses, proseOf } from './glossary.js'

describe('terms where they first do work', () => {
  test('every term has a pattern and every pattern a term', () => {
    expect(Object.keys(MATCH).sort()).toEqual(Object.keys(TERMS).sort())
  })

  test('every term some experiment lists is introduced there, and no earlier experiment uses the word', () => {
    const listed = new Set(EXPERIMENTS.flatMap((e) => e.terms || []))
    for (const id of listed) expect(introducedIn(id), id).toBeDefined()
    expect(earlyUses()).toEqual([])
  })

  test('every listed term is known', () => {
    for (const e of EXPERIMENTS) for (const id of e.terms || []) expect(TERMS[id], `${e.id} lists ${id}`).toBeDefined()
  })

  test('each pattern fires somewhere in the prose of the experiment that introduces it', () => {
    // A term whose own introducer never spells it out would be a chip everywhere — the fold in disguise.
    // KCL and KVL are the exception by design: Group A's prose never names them (the entry-level
    // rule), but the solver's working under the equations writes "KCL at in" from A1 on, so
    // their definitions ride as chips there (experiments.test.js holds Group A to carrying them).
    const silent = []
    for (const id of Object.keys(TERMS)) {
      const intro = introducedIn(id)
      if (!intro) continue
      if (!proseOf(intro).some(([, text]) => MATCH[id].test(text))) silent.push(`${id}@${intro.id}`)
    }
    expect(silent).toEqual(['kcl@a1', 'kvl@a1'])
  })

  test('first uses are placed once, in reading order, without overlap, and most terms are placed', () => {
    let placed = 0
    let total = 0
    for (const e of EXPERIMENTS) {
      const uses = firstUses(e)
      const seen = new Set()
      for (const [field, marks] of Object.entries(uses)) {
        if (field === 'unplaced') continue
        const sorted = [...marks].sort((a, b) => a.start - b.start)
        expect(marks, `${e.id}.${field} sorted`).toEqual(sorted)
        for (let i = 1; i < marks.length; i++) expect(marks[i].start, `${e.id}.${field} overlap`).toBeGreaterThanOrEqual(marks[i - 1].end)
        for (const m of marks) {
          expect(seen.has(m.id), `${e.id} places ${m.id} twice`).toBe(false)
          seen.add(m.id)
          const text = proseOf(e).find(([k]) => k === field)[1]
          expect(MATCH[m.id].test(text.slice(m.start, m.end)), `${e.id}.${field} ${m.id} slice`).toBe(true)
        }
      }
      placed += seen.size
      total += (e.terms || []).length
      for (const id of uses.unplaced) expect(seen.has(id)).toBe(false)
    }
    // Three in four listed terms are marked in the prose itself; the rest are chips under the note.
    expect(placed / total).toBeGreaterThan(0.75)
  })

  test('the note marks the words a student meets first: A1 marks voltage, current and resistor', () => {
    const uses = firstUses(byId.a1)
    const ids = Object.entries(uses).filter(([k]) => k !== 'unplaced').flatMap(([, m]) => m.map((x) => x.id))
    expect(ids).toEqual(expect.arrayContaining(['voltage', 'current', 'resistor']))
  })

  test('pointing ahead: naming a later experiment or its group is allowed in the why, nothing else is', () => {
    const e2 = byId.e2
    expect(pointsAhead('which is exactly what an op-amp (E2) is.', e2)).toBe(true)
    expect(pointsAhead('Group E’s op-amps lean on them.', e2)).toBe(true)
    expect(pointsAhead('as in A3, the reference node', e2)).toBe(false)
    expect(pointsAhead('the op-amp holds its inputs equal', e2)).toBe(false)
  })
})
