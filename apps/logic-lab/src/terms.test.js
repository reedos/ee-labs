import { describe, it, expect } from 'vitest'
import { FLOP, KIND_ORDER, WIRE_DELAY, libDelay } from '@ee-labs/events'
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
    // The set below is built from the library rather than typed out: every
    // cell at every fan-in it has, the wire, the flip-flop's three times, and
    // the sums the curriculum quotes. Change the inverter and this set moves.
    const cell = (k, n) => libDelay(k, n)
    const carryBit = cell('and', 2) + cell('or', 2)
    const known = new Set([
      // Every cell in the library, at every fan-in it has.
      ...KIND_ORDER.flatMap((k) => [1, 2, 3, 4].map((n) => cell(k, n))).filter((d) => d != null),
      WIRE_DELAY,
      // The flip-flop's three times, and the window the two of them make.
      FLOP.tcq,
      FLOP.tsu,
      FLOP.th,
      FLOP.tsu + FLOP.th,
      // The sums the curriculum quotes, each written as the sum it is.
      carryBit,
      cell('nand', 2) + cell('not', 1),
      3 * cell('nand', 2),
      cell('not', 1) + cell('and', 2) + cell('or', 2),
      2 * cell('nor', 2),
      2 * cell('nand', 2),
      FLOP.tcq + FLOP.tsu,
      FLOP.tcq + carryBit + FLOP.tsu,
      FLOP.tcq + cell('xor', 2) + 2 * carryBit + FLOP.tsu,
      FLOP.tcq + cell('xor', 2) + 4 * carryBit + FLOP.tsu,
    ])
    const quoted = Object.entries(TERMS).flatMap(([id, t]) => [...t.def.matchAll(/(\d+)\s*ps/g)].map((m) => ({ id, ps: +m[1] })))
    for (const q of quoted) expect(known.has(q.ps), `${q.id} quotes ${q.ps} ps, which is not one of this lab's numbers`).toBe(true)
    expect(quoted.length).toBeGreaterThan(8)
  })
})
