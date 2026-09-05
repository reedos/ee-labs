import { describe, it, expect } from 'vitest'
import { CARD, gates, psOf } from './engine/card.js'
import { TERMS } from './terms.js'
import { EXPERIMENTS } from './experiments.js'

// Terms on contact (REVIEW_PLAYBOOK §8): every term a lesson leans on is
// defined, every definition is reachable from a lesson, and a definition that
// quotes a number quotes one this lab produces.

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
    const first = new Map()
    EXPERIMENTS.forEach((e, i) => {
      for (const t of e.terms) if (!first.has(t)) first.set(t, i)
    })
    for (const [t, i] of first) expect(EXPERIMENTS[i].terms, `${t} first appears in ${EXPERIMENTS[i].id}`).toContain(t)
  })

  it('quotes the model card’s own numbers where a definition quotes one', () => {
    // A definition that names a delay names one this lab's card produces, so
    // the glossary cannot drift from the machine the way prose drifts from
    // physics. The set below is built from the card rather than typed out.
    const known = new Set([
      psOf(CARD.gate),
      psOf(CARD.inverter),
      psOf(CARD.fo4),
      psOf(CARD.tcq),
      psOf(CARD.tsu),
      psOf(CARD.th),
      psOf(CARD.tcq + CARD.tsu),
      ...Object.values(CARD.blocks).map((n) => psOf(gates(n))),
    ])
    const quoted = Object.entries(TERMS).flatMap(([id, t]) => [...t.def.matchAll(/(\d+(?:\.\d+)?)\s*ps/g)].map((m) => ({ id, ps: +m[1] })))
    for (const q of quoted) expect([...known].some((k) => Math.abs(k - q.ps) < 0.005), `${q.id} quotes ${q.ps} ps, which is not one of this lab's numbers`).toBe(true)
    expect(quoted.length).toBeGreaterThan(3)
  })

  it('quotes the model card’s own block delays where a definition counts gate delays', () => {
    const known = new Set(Object.values(CARD.blocks))
    known.add(2 * 32)
    known.add(2)
    const quoted = Object.entries(TERMS).flatMap(([id, t]) => [...t.def.matchAll(/(\d+)\s+of them|(\d+)\s+gate delays/g)].map((m) => ({ id, n: +(m[1] ?? m[2]) })))
    for (const q of quoted.filter((x) => Number.isFinite(x.n))) expect(known.has(q.n), `${q.id} counts ${q.n} gate delays, which is not one of this card's blocks`).toBe(true)
  })
})
