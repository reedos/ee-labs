import { describe, it, expect } from 'vitest'
import { margins } from '@ee-labs/systems'
import { checkFailures, rowsOf } from '@ee-labs/explain/testing'
import { PLANTS, CONTROLLERS, buildLoop, defaultsOf } from './systems.js'
import { circuitFor } from './toCircuitLab.js'
import { loopMath } from './math.js'

// Round-four grading: `if (plant.circuit) {...} else if (plant.circuitNote)`
// let a bench circuit's own branch win outright for every plant that carries
// both fields — integrator, motor and threePole — so the catalogue's refusal
// (systems.js, `circuitNote`) never printed for them: dead code, silently,
// across the six lessons (46% of the course) that use motor or three lags.
// The Math tab showed a fully verified circuit and three ticks and never
// said the catalogue has no match for it. This file pins the fix directly
// against loopMath's own output, the same way phase.test.js already does.

const logspace = (lo, hi, n) =>
  Float64Array.from(
    { length: n },
    (_, i) => Math.pow(10, Math.log10(lo) + ((Math.log10(hi) - Math.log10(lo)) * i) / (n - 1)),
  )
const GRID = logspace(1e-6, 1e6, 4000)

const entryFor = (plantId, ctrlId = 'p', plantOver = {}, ctrlOver = {}) => {
  const plantP = { ...defaultsOf(PLANTS[plantId]), ...plantOver }
  const ctrlP = { ...defaultsOf(CONTROLLERS[ctrlId]), ...ctrlOver }
  const loop = buildLoop(plantId, plantP, ctrlId, ctrlP)
  const marg = margins(loop.open, GRID)
  return loopMath(plantId, plantP, ctrlId, ctrlP, loop, marg, GRID)
}

const textOf = (entry) => entry.blocks.filter((b) => b.kind === 'text').map((b) => b.text).join(' ')

describe('the Math tab prints the catalogue refusal beside a bench circuit that still has no link', () => {
  it.each(['integrator', 'motor', 'threePole'])(
    '%s carries both a `circuit` and a `circuitNote` (the shape of the defect)',
    (plantId) => {
      // The defect was possible only because both fields are actually set —
      // pinned here so a future edit that removes one silently cannot bring
      // this test back to a false positive.
      expect(PLANTS[plantId].circuit, plantId).toBeTruthy()
      expect(PLANTS[plantId].circuitNote, plantId).toBeTruthy()
      expect(circuitFor(plantId, defaultsOf(PLANTS[plantId])), plantId).toBeNull()
    },
  )

  it.each(['integrator', 'motor', 'threePole'])(
    '%s prints the bench circuit (with its ✓ checks) AND the catalogue refusal',
    (plantId) => {
      const entry = entryFor(plantId)
      expect(entry).toBeTruthy()
      const texts = textOf(entry)
      // The bench circuit is still there, unweakened — the fix must not
      // trade the checks away to make room for the refusal.
      expect(texts).toContain('Where a plant like this comes from on a bench')
      expect(checkFailures(entry, plantId)).toEqual([])
      const checkLabels = rowsOf(entry, 'check').map((r) => r.label)
      expect(checkLabels.filter((l) => l.includes('|circuit| = |P|')).length, `${plantId}: the |circuit|=|P| row`).toBe(1)
      expect(checkLabels.some((l) => l.startsWith('…and at')), `${plantId}: the second-frequency row`).toBe(true)
      expect(checkLabels.some((l) => l === '∠circuit = ∠P'), `${plantId}: the ∠circuit=∠P row`).toBe(true)
      // And now, also, the reason the catalogue still has no link for it —
      // reused verbatim, not reworded.
      expect(texts).toContain(PLANTS[plantId].circuitNote)
    },
  )

  it('a plant with a genuine catalogue link prints the circuit and no refusal', () => {
    // secondOrder at these values IS the series RLC, exactly (toCircuitLab.js
    // pins the same fixture as "not null").
    const plantP = { k: 1, wn: 10000, zeta: 0.3 }
    expect(circuitFor('secondOrder', plantP)).not.toBeNull()
    const entry = entryFor('secondOrder', 'p', plantP)
    const texts = textOf(entry)
    expect(texts).toContain('Where a plant like this comes from on a bench')
    expect(texts).not.toMatch(/No catalogue circuit matches this plant/)
    expect(PLANTS.secondOrder.circuitNote).toBeUndefined()
  })

  it('a plant with neither field (custom) prints neither block', () => {
    const entry = entryFor('custom', 'p', { b2: 0, b1: 0, b0: 1, a2: 0, a1: 1, a0: 1 })
    const texts = textOf(entry)
    expect(texts).not.toContain('Where a plant like this comes from on a bench')
    // custom has no bench `circuit`, only `circuitNote` — the refusal alone
    // must still print, exactly as it did before this fix (the else-if
    // branch this replaces already handled the "circuit-less" plants
    // correctly; this pins that the rewrite did not lose that case).
    expect(texts).toContain(PLANTS.custom.circuitNote)
  })

  it('unstable (circuitNote with no bench circuit) is unaffected by the fix', () => {
    const entry = entryFor('unstable')
    const texts = textOf(entry)
    expect(texts).not.toContain('Where a plant like this comes from on a bench')
    expect(texts).toContain(PLANTS.unstable.circuitNote)
  })
})
