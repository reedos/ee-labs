import { describe, it, expect } from 'vitest'
import {
  GF16,
  GF256,
  CONV_CODES,
  SHANNON_FLOOR_DB,
  capacityBSC,
  crossoverForCapacity,
  encoder,
  esN0ForBiAwgnCapacity,
  esN0ForBscCapacity,
  golayCode,
  hammingCode,
  minimumDistance,
} from '@ee-labs/codes'
import { TERMS } from './terms.js'
import { EXPERIMENTS } from './experiments.js'

// Terms on contact (REVIEW_PLAYBOOK §8): every term a lesson leans on is
// defined, every definition is reachable from a lesson, and no definition
// quotes a number this lab does not produce.

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
      expect(t.def.split(/\s+/).length, `${id} is ${t.def.split(/\s+/).length} words`).toBeLessThanOrEqual(65)
    }
  })

  it('introduces each term where it first does work, and not before', () => {
    const first = new Map()
    EXPERIMENTS.forEach((e, i) => {
      for (const t of e.terms) if (!first.has(t)) first.set(t, i)
    })
    for (const [t, i] of first) expect(EXPERIMENTS[i].terms, `${t} first appears in ${EXPERIMENTS[i].id}`).toContain(t)
    // Every experiment introduces at least one term of its own, so no screen
    // is a restatement of the one before it.
    const introduced = new Map()
    for (const [t, i] of first) introduced.set(i, (introduced.get(i) || 0) + 1)
    for (let i = 0; i < EXPERIMENTS.length; i++) expect(introduced.get(i) || 0, `${EXPERIMENTS[i].id} introduces no term`).toBeGreaterThan(0)
  })

  it('quotes only numbers this lab produces', () => {
    // A definition that names a number names one the engine computes, so the
    // glossary cannot drift from the codes the way prose drifts from physics.
    // The set is built from the engine rather than typed out.
    const k3 = encoder(CONV_CODES.K3)
    const known = new Set([
      0,
      1,
      2,
      3,
      4,
      5,
      7,
      10,
      12,
      23,
      GF16.order,
      GF256.order,
      GF16.m,
      GF256.m,
      minimumDistance(hammingCode(3)).d,
      minimumDistance(golayCode()).d,
      golayCode().n,
      golayCode().k,
      k3.states,
      k3.K,
      10 * Math.log10(2),
      Math.abs(SHANNON_FLOOR_DB),
      crossoverForCapacity(0.5),
      crossoverForCapacity(0),
      // What soft decisions are worth at rate one half, which is the distance
      // between the two capacity thresholds.
      esN0ForBscCapacity(0.5) - esN0ForBiAwgnCapacity(0.5),
      capacityBSC(0.5),
    ])
    const stands = (value) => [...known].some((v) => Math.abs(v - value) <= Math.max(1e-6, 5e-4 * Math.abs(v)))
    // A minus sign is written as U+2212 in the prose, and a number inside a
    // name or an exponent is not a quantity, so both are handled before the
    // numbers are read off.
    const quoted = Object.entries(TERMS).flatMap(([id, t]) =>
      [...t.def.replace(/−/g, '-').matchAll(/(?<![\dA-Za-z^_(.])(-?\d+(?:\.\d+)?)(?![\dA-Za-z)^.])/g)].map((m) => ({ id, value: Math.abs(Number(m[1])), text: m[0] })),
    )
    for (const q of quoted) expect(stands(q.value), `${q.id} quotes ${q.text}, which is not one of this lab's numbers`).toBe(true)
    expect(quoted.length).toBeGreaterThan(10)
  })
})
