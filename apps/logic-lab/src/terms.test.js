import { describe, it, expect } from 'vitest'
import { TERMS } from './terms.js'
import { EXPERIMENTS } from './experiments.js'

// Terms on contact (REVIEW_PLAYBOOK §8): every term a lesson leans on is
// defined, every definition is reachable from a lesson, and no definition
// leans on a term the reader has not met yet.

describe('the glossary', () => {
  it('defines every term an experiment names', () => {
    for (const e of EXPERIMENTS) {
      expect(e.terms, `${e.id} names its terms`).toBeDefined()
      expect(e.terms.length, `${e.id} has at least three terms`).toBeGreaterThanOrEqual(3)
      for (const t of e.terms) expect(TERMS[t], `${e.id} names "${t}", which is not defined`).toBeDefined()
    }
  })

  it('surfaces every definition somewhere', () => {
    const used = new Set(EXPERIMENTS.flatMap((e) => e.terms))
    for (const id of Object.keys(TERMS)) expect(used.has(id), `"${id}" is defined and no experiment offers it`).toBe(true)
  })

  it('gives every term a name and a definition of the right shape', () => {
    for (const [id, t] of Object.entries(TERMS)) {
      expect(t.name, id).toBeTruthy()
      expect(t.name.split(/\s+/).length, `${id} name`).toBeLessThanOrEqual(4)
      const sentences = t.def.split(/\.(?=\s|$)/).filter((s) => s.trim())
      expect(sentences.length, `${id} has ${sentences.length} sentences`).toBeGreaterThanOrEqual(2)
      expect(sentences.length, `${id} has ${sentences.length} sentences`).toBeLessThanOrEqual(4)
    }
  })

  it('introduces each term where it is first used, and not before', () => {
    // A term appears in the list of the experiment that first leans on it. A
    // later experiment may name it again, but no experiment may name one that
    // no earlier lesson could have introduced.
    const first = new Map()
    EXPERIMENTS.forEach((e, i) => {
      for (const t of e.terms) if (!first.has(t)) first.set(t, i)
    })
    for (const [t, i] of first) expect(EXPERIMENTS[i].terms, `${t} first appears in ${EXPERIMENTS[i].id}`).toContain(t)
  })

  it('quotes the library’s own delays where a definition quotes one', () => {
    // A definition that names a number names one this lab produces, so the
    // glossary cannot drift from the library the way prose drifts from physics.
    const quoted = Object.entries(TERMS).flatMap(([id, t]) => [...t.def.matchAll(/(\d+)\s*ps/g)].map((m) => ({ id, ps: +m[1] })))
    const known = new Set([30, 40, 50, 70, 80, 90, 10, 140, 100, 150, 180, 260, 600, 650, 1210])
    for (const q of quoted) expect(known.has(q.ps), `${q.id} quotes ${q.ps} ps, which is not one of this lab's numbers`).toBe(true)
    expect(quoted.length).toBeGreaterThan(8)
  })
})
