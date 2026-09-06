import { describe, it, expect } from 'vitest'
import { EXPERIMENTS } from './experiments.js'
import { TERMS } from './terms.js'

// Definitions on contact (REVIEW_PLAYBOOK §8). Every term a lesson leans on is
// defined, every definition is reached by at least one experiment, and no
// definition leans on a term this registry does not also carry.

const used = new Set(EXPERIMENTS.flatMap((e) => e.terms || []))

describe('the term registry', () => {
  it('defines every term an experiment names', () => {
    for (const t of used) expect(TERMS[t], `missing definition for ${t}`).toBeDefined()
  })

  it('has no definition no experiment reaches', () => {
    for (const id of Object.keys(TERMS)) expect(used.has(id), `${id} is defined and never offered`).toBe(true)
  })

  it('gives every definition a name and a body', () => {
    for (const [id, t] of Object.entries(TERMS)) {
      expect(typeof t.name, id).toBe('string')
      expect(t.name.length, id).toBeGreaterThan(2)
      expect(t.def.trim().length, id).toBeGreaterThan(60)
      expect(t.def.trim().endsWith('.'), `${id} does not end in a full stop`).toBe(true)
    }
  })

  it('offers at least two terms on every experiment', () => {
    for (const e of EXPERIMENTS) expect((e.terms || []).length, `${e.id}`).toBeGreaterThanOrEqual(2)
  })
})
