import { describe, expect, it } from 'vitest'
import { toleranceCloud, spreadPct } from './tolerance.js'
import { CIRCUITS } from './circuits.js'

// The tolerance cloud is a claim about real parts, so it is tested against the
// analytic worst cases rather than against itself.

const RLC = { r: 100, l: 10e-3, c: 100e-9 }
const F0 = 1 / (2 * Math.PI * Math.sqrt(RLC.l * RLC.c)) // 5033 Hz
const Q0 = (1 / RLC.r) * Math.sqrt(RLC.l / RLC.c) // 3.162

describe('toleranceCloud', () => {
  it('is deterministic — the same build twice is the same cloud', () => {
    const a = toleranceCloud('rlcSeries', RLC, 'c', 0.05)
    const b = toleranceCloud('rlcSeries', RLC, 'c', 0.05)
    expect(a.cloud).toEqual(b.cloud)
    expect(a.f0).toEqual(b.f0)
  })

  it('is empty at zero tolerance', () => {
    const r = toleranceCloud('rlcSeries', RLC, 'c', 0)
    expect(r.any).toBe(false)
    expect(r.cloud).toHaveLength(0)
  })

  // f0 = 1/(2π√LC): the worst cases are both parts at the same extreme, and
  // the square root halves the damage — ±5% parts move f0 by only about ∓5%
  // in the worst corner, ~±2.5% typically.
  it('keeps f₀ inside the analytic worst-case band, and spreads meaningfully', () => {
    const tol = 0.05
    const { f0 } = toleranceCloud('rlcSeries', RLC, 'c', tol)
    const worstLo = 1 / (2 * Math.PI * Math.sqrt(RLC.l * (1 + tol) * RLC.c * (1 + tol)))
    const worstHi = 1 / (2 * Math.PI * Math.sqrt(RLC.l * (1 - tol) * RLC.c * (1 - tol)))
    expect(f0.lo).toBeGreaterThanOrEqual(worstLo - 1e-9)
    expect(f0.hi).toBeLessThanOrEqual(worstHi + 1e-9)
    // And it genuinely explores the band: at least half of it.
    expect(f0.hi - f0.lo).toBeGreaterThan((worstHi - worstLo) * 0.5)
  })

  // Q = (1/R)√(L/C): three parts contribute and nothing halves R's share, so
  // the same drawer of ±5% parts wobbles Q measurably harder than f₀. This is
  // the lesson's central claim, asserted, not narrated.
  it('wobbles Q harder than f₀ with the same parts', () => {
    const tol = 0.05
    const { f0, q } = toleranceCloud('rlcSeries', RLC, 'c', tol)
    const f0Spread = spreadPct(f0, F0)
    const qSpread = spreadPct(q, Q0)
    expect(qSpread).toBeGreaterThan(f0Spread * 1.3)
    // Worst corner: R low, L high, C low -> (1/0.95)·√(1.05/0.95) ≈ +10.7%.
    expect(qSpread).toBeLessThanOrEqual(10.8)
    expect(qSpread).toBeGreaterThan(5)
  })

  it('every sampled RLC stays stable — tolerance cannot destabilise a passive network', () => {
    const { cloud } = toleranceCloud('rlcSeries', RLC, 'c', 0.1)
    expect(cloud.length).toBeGreaterThan(100)
    for (const [re] of cloud) expect(re).toBeLessThan(0)
  })

  it('works for every circuit in the registry without throwing', () => {
    for (const [id, c] of Object.entries(CIRCUITS)) {
      const params = {}
      for (const p of c.params) params[p.key] = p.value
      const out = c.outputs[0].key
      const r = toleranceCloud(id, params, out, 0.05)
      expect(r.any, id).toBe(true)
      for (const [re, im] of r.cloud) {
        expect(Number.isFinite(re), id).toBe(true)
        expect(Number.isFinite(im), id).toBe(true)
      }
    }
  })
})
