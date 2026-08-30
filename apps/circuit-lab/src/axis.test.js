import { describe, expect, it } from 'vitest'
import { SPAN_DECADES, axisFreqs, ensureSampled, stickyCentre } from './axis.js'
import { transferOf, defaultsOf } from './circuits.js'
import { magnitudeAt } from '@ee-labs/systems'

// The behaviour Reed asked for by name: tuning a component should move the
// CURVE across a fixed axis, not slide the axis labels under a fixed curve.

describe('stickyCentre', () => {
  it('adopts the natural centre when there is no previous one', () => {
    expect(stickyCentre(0, 5000)).toBe(5000)
    expect(stickyCentre(NaN, 5000)).toBe(5000)
  })

  it('holds while the corner is tuned anywhere within two decades', () => {
    // A 100x component sweep in either direction stays on the same axis.
    for (const nat of [50.4, 160, 5000, 50000, 499000]) {
      expect(stickyCentre(5000, nat)).toBe(5000)
    }
  })

  it('re-centres when the corner nears the edge of the view', () => {
    expect(stickyCentre(5000, 5000 * 101)).toBe(5000 * 101)
    expect(stickyCentre(5000, 5000 / 101)).toBe(5000 / 101)
  })

  it('snaps immediately on force, as when the circuit changes', () => {
    expect(stickyCentre(5000, 5100, true)).toBe(5100)
  })

  it('falls back to 1 kHz when the circuit has no scale of its own', () => {
    expect(stickyCentre(0, NaN)).toBe(1000)
    expect(stickyCentre(0, 0)).toBe(1000)
    // ...but does not abandon an existing axis for the fallback: a divider has
    // no corner, and switching the output should not yank the view to 1 kHz.
    expect(stickyCentre(5000, NaN)).toBe(5000)
  })
})

describe('axisFreqs', () => {
  it('spans exactly ±SPAN_DECADES around the centre, log-spaced', () => {
    const f = axisFreqs(1000, 301)
    expect(f[0]).toBeCloseTo(1000 / 10 ** SPAN_DECADES, 6)
    expect(f[300]).toBeCloseTo(1000 * 10 ** SPAN_DECADES, 3)
    // Log-spaced: constant ratio between neighbours.
    const r = f[1] / f[0]
    expect(f[151] / f[150]).toBeCloseTo(r, 9)
  })
})

describe('ensureSampled', () => {
  it('splices an interior frequency into sorted position, once', () => {
    const grid = axisFreqs(1000, 101)
    const out = ensureSampled(grid, 1234.5)
    expect(out.length).toBe(102)
    expect(out).toContain(1234.5)
    for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThan(out[i - 1])
    // Idempotent when the frequency is already a grid point.
    expect(ensureSampled(out, 1234.5).length).toBe(102)
  })

  it('leaves the grid alone when the frequency is outside it', () => {
    const grid = axisFreqs(1000, 101)
    expect(ensureSampled(grid, 0.5)).toBe(grid)
    expect(ensureSampled(grid, 1e9)).toBe(grid)
    expect(ensureSampled(grid, NaN)).toBe(grid)
  })

  it('makes the drawn peak the true peak: Q = 316 is on the plain grid nowhere', () => {
    // The defect this exists for: at R = 1 Ω the series RLC's peak is far
    // narrower than the 600-point grid's spacing, so the tallest plotted
    // sample sits several dB below the Q the topbar states. With the exact
    // resonance spliced in, the drawn maximum IS Q.
    const p = { ...defaultsOf('rlcSeries'), r: 1 }
    const f0 = 1 / (2 * Math.PI * Math.sqrt(p.l * p.c))
    const q = (1 / p.r) * Math.sqrt(p.l / p.c)
    const tf = transferOf('rlcSeries', p, 'c')
    const plain = axisFreqs(f0, 600)
    const maxOn = (grid) => Math.max(...Array.from(grid, (f) => magnitudeAt(tf, f)))
    expect(maxOn(plain)).toBeLessThan(q * 0.9)
    expect(maxOn(ensureSampled(plain, f0))).toBeCloseTo(q, 6)
  })
})
