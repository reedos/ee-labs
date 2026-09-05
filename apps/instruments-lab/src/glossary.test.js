import { describe, expect, test } from 'vitest'
import { EXPERIMENTS, byId } from './experiments.js'
import { MATCH, TERMS } from './terms.js'
import { earlyUses, firstUses, introducedIn, pointsAhead, proseOf } from './glossary.js'

// A term is introduced where it first does work, and nowhere before. The
// definition opens on tap at that first use, so a word that arrives earlier
// than its meaning is a bug in the course order, not a matter of taste.

describe('terms where they first do work', () => {
  test('every term has a pattern and every pattern a term', () => {
    expect(Object.keys(MATCH).sort()).toEqual(Object.keys(TERMS).sort())
  })

  test('every term some experiment lists is introduced there, and no earlier experiment uses the word', () => {
    const listed = new Set(EXPERIMENTS.flatMap((e) => e.terms || []))
    for (const id of listed) expect(introducedIn(id), id).toBeDefined()
    expect(earlyUses()).toEqual([])
  })

  test('every listed term is known, and every known term is listed once', () => {
    for (const e of EXPERIMENTS) for (const id of e.terms || []) expect(TERMS[id], `${e.id} lists ${id}`).toBeDefined()
    for (const id of Object.keys(TERMS)) {
      const owners = EXPERIMENTS.filter((e) => (e.terms || []).includes(id)).map((e) => e.id)
      expect(owners.length, `${id} is listed by ${owners.join(', ') || 'nobody'}`).toBe(1)
    }
  })

  test('each pattern fires somewhere in the prose of the experiment that introduces it', () => {
    // A term whose own introducer never spells it out would be a chip everywhere,
    // which is the folded "terms used here" list this pattern replaces.
    const silent = []
    for (const id of Object.keys(TERMS)) {
      const intro = introducedIn(id)
      if (!intro) continue
      if (!proseOf(intro).some(([, text]) => MATCH[id].test(text))) silent.push(`${id}@${intro.id}`)
    }
    expect(silent).toEqual([])
  })

  test('first uses are placed once, in reading order, without overlap', () => {
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
    // Every listed term is marked in the prose that introduces it, so nothing
    // in this lab has to arrive as a chip.
    expect(placed).toBe(total)
  })

  test('the lesson marks the word where it does its work: A1 input impedance, A3 the probe, C3 the shunt', () => {
    const marked = (id) => {
      const uses = firstUses(byId[id])
      return Object.entries(uses).filter(([k]) => k !== 'unplaced').flatMap(([, m]) => m.map((x) => x.id))
    }
    expect(marked('a1')).toEqual(['inputz'])
    expect(marked('a3')).toEqual(['probe'])
    expect(marked('c3')).toEqual(expect.arrayContaining(['shunt', 'burden']))
    expect(marked('f4')).toEqual(['noisefloor'])
  })

  test('pointing ahead: naming a later experiment or its group is allowed in the why, nothing else is', () => {
    const f2 = byId.f2
    expect(pointsAhead('which is why F3 propagates them separately.', f2)).toBe(true)
    expect(pointsAhead('Group F carries the error bar.', f2)).toBe(true)
    expect(pointsAhead('as C1 measured, the meter reads low', f2)).toBe(false)
    expect(pointsAhead('the specification says nothing about loading', f2)).toBe(false)
  })
})
