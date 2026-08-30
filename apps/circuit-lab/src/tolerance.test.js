import { describe, expect, it } from 'vitest'
import { responseBand, stepBand, toleranceCloud, tolsOf, spreadPct } from './tolerance.js'
import { CIRCUITS, transferOf } from './circuits.js'
import { bode, stepResponse } from '@ee-labs/systems'

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

// Per-part tolerances: which spec suffers depends on which part wobbles, and
// the sharpest version of that claim is a spec that CANNOT move — f₀ has no R
// in its formula, so an R-only tolerance must leave it exactly put.
describe('per-part tolerances', () => {
  it('normalises a lazy spec: scalar for all, object for some, junk for none', () => {
    expect(tolsOf('rlcSeries', 0.05)).toEqual({ r: 0.05, l: 0.05, c: 0.05 })
    expect(tolsOf('rlcSeries', { r: 0.1 })).toEqual({ r: 0.1, l: 0, c: 0 })
    expect(tolsOf('rlcSeries', null)).toEqual({ r: 0, l: 0, c: 0 })
  })

  it('R alone at ±10% cannot move f₀ — the poles stay pinned to the ω₀ circle', () => {
    const { f0, q, cloud } = toleranceCloud('rlcSeries', RLC, 'c', { r: 0.1 })
    // Not "barely moves": does not move. 1/(2π√LC) contains no R.
    expect(f0.hi).toBeCloseTo(F0, 6)
    expect(f0.lo).toBeCloseTo(F0, 6)
    // Q takes the entire hit. The worst corner is R at −10%: 1/0.9 ≈ +11.1%.
    const qs = spreadPct(q, Q0)
    expect(qs).toBeGreaterThan(7)
    expect(qs).toBeLessThanOrEqual(11.2)
    // Every sampled pole keeps |s| = ω₀ exactly: the scatter is an arc.
    const w0 = 2 * Math.PI * F0
    for (const [re, im] of cloud) {
      expect(Math.hypot(re, im) / w0).toBeCloseTo(1, 9)
    }
  })

  it('C alone at ±10% moves f₀ — the contrast that makes the arc a lesson', () => {
    const { f0 } = toleranceCloud('rlcSeries', RLC, 'c', { c: 0.1 })
    expect(spreadPct(f0, F0)).toBeGreaterThan(3)
  })
})

describe('responseBand', () => {
  const freqs = [F0 / 100, F0 / 10, F0 / 2, F0, F0 * 2, F0 * 10, F0 * 100]

  it('is null when every part is exact, and deterministic when not', () => {
    expect(responseBand('rlcSeries', RLC, 'c', 0, freqs)).toBeNull()
    expect(responseBand('rlcSeries', RLC, 'c', {}, freqs)).toBeNull()
    const a = responseBand('rlcSeries', RLC, 'c', 0.05, freqs)
    const b = responseBand('rlcSeries', RLC, 'c', 0.05, freqs)
    expect(a.magLo).toEqual(b.magLo)
    expect(a.phaseHi).toEqual(b.phaseHi)
  })

  it('brackets the nominal response at every frequency', () => {
    const band = responseBand('rlcSeries', RLC, 'c', 0.05, freqs)
    const nom = bode(transferOf('rlcSeries', RLC, 'c'), freqs)
    for (let k = 0; k < freqs.length; k++) {
      expect(band.magLo[k], `mag lo @${freqs[k]}`).toBeLessThanOrEqual(nom.mag[k] + 1e-12)
      expect(band.magHi[k], `mag hi @${freqs[k]}`).toBeGreaterThanOrEqual(nom.mag[k] - 1e-12)
      expect(band.phaseLo[k], `ph lo @${freqs[k]}`).toBeLessThanOrEqual(nom.phase[k] + 1e-12)
      expect(band.phaseHi[k], `ph hi @${freqs[k]}`).toBeGreaterThanOrEqual(nom.phase[k] - 1e-12)
    }
    // And it is genuinely a band, not a re-drawn line: wide at the peak,
    // where ±5% parts move a Q=3 resonance by whole dB.
    expect(band.magHi[3] / band.magLo[3]).toBeGreaterThan(1.1)
  })

  it('an R-only band pinches shut at DC, where R cancels out of H', () => {
    // H(0) = 1 across C whatever R is — so at the lowest frequency the R-only
    // band must be hairline while the same band at f₀ is wide open.
    const band = responseBand('rlcSeries', RLC, 'c', { r: 0.1 }, freqs)
    expect(band.magHi[0] / band.magLo[0]).toBeLessThan(1.0001)
    expect(band.magHi[3] / band.magLo[3]).toBeGreaterThan(1.15)
  })
})

describe('stepBand', () => {
  it('shares the duration, brackets the nominal trace, and is null when exact', () => {
    const duration = 2e-3
    expect(stepBand('rlcSeries', RLC, 'c', 0, duration)).toBeNull()
    const band = stepBand('rlcSeries', RLC, 'c', 0.05, duration, 200)
    const nom = stepResponse(transferOf('rlcSeries', RLC, 'c'), { duration, points: 200 })
    expect(band.t[band.t.length - 1]).toBeCloseTo(duration, 12)
    for (let k = 0; k < 200; k++) {
      expect(band.lo[k], `t=${nom.t[k]}`).toBeLessThanOrEqual(nom.y[k] + 1e-9)
      expect(band.hi[k], `t=${nom.t[k]}`).toBeGreaterThanOrEqual(nom.y[k] - 1e-9)
    }
    // The ringing phase disagrees between builds, so the band has real width
    // somewhere past the first rise.
    let width = 0
    for (let k = 20; k < 200; k++) width = Math.max(width, band.hi[k] - band.lo[k])
    expect(width).toBeGreaterThan(0.05)
  })
})
