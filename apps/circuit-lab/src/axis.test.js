import { describe, expect, it } from 'vitest'
import { SPAN_DECADES, axisFreqs, stickyCentre } from './axis.js'

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
