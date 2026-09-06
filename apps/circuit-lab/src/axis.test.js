import { describe, expect, it } from 'vitest'
import {
  PHASE_PAD,
  SPAN_DECADES,
  axisFreqs,
  ensureSampled,
  phaseFrame,
  stickyCentre,
  stickyDuration,
  stickyRange,
  stickySpan,
  yStepFor,
} from './axis.js'
import { transferOf, defaultsOf } from './circuits.js'
import { magnitudeAt } from '@ee-labs/systems'
import { niceStep } from '@ee-labs/ui'

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

// The same rule the frequency axis established, applied to the other two
// panes: tuning moves the CURVE (or the poles) across a held frame; the frame
// re-frames only when the content escapes it or gets lost inside it.
describe('sticky step and pole frames', () => {
  it('the time span holds while the arrival stays on screen', () => {
    const framed = stickyDuration(0, 1e-3, true) // 1.35 ms of axis
    expect(framed).toBeCloseTo(1.35e-3, 12)
    // Speeding the circuit up (shorter natural) holds — the arrival slides
    // left across a fixed axis...
    expect(stickyDuration(framed, 0.5e-3)).toBe(framed)
    expect(stickyDuration(framed, 0.3e-3)).toBe(framed)
    // ...until it is crammed into the left fifth, which reframes...
    expect(stickyDuration(framed, 0.1e-3)).toBeCloseTo(0.135e-3, 12)
    // ...and outgrowing the axis reframes immediately: an unsettled curve
    // running off the right edge is the one thing this pane must never show.
    expect(stickyDuration(framed, 2e-3)).toBeCloseTo(2.7e-3, 12)
  })

  it('the y-range expands at once, shrinks reluctantly, holds otherwise', () => {
    const r0 = stickyRange(null, 0, 1.6) // e.g. a 60% overshoot
    expect(r0.lo).toBeCloseTo(-0.192, 9)
    expect(r0.hi).toBeCloseTo(1.792, 9)
    // Less overshoot: the ringing visibly shrinks against the SAME scale.
    expect(stickyRange(r0, 0, 1.3)).toBe(r0)
    // Escaping data reframes immediately — clipping is never acceptable.
    expect(stickyRange(r0, 0, 2.4).hi).toBeGreaterThan(2.4)
    // A curve using under 35% of the frame gets a tighter one.
    expect(stickyRange(r0, 0, 0.5)).not.toBe(r0)
  })

  it('the pole-view span holds while the poles move within it', () => {
    const s0 = stickySpan(0, 44000, true)
    expect(s0).toBeCloseTo(50600, 0)
    expect(stickySpan(s0, 30000)).toBe(s0) // poles slid inward: hold
    expect(stickySpan(s0, 60000)).toBeCloseTo(69000, 0) // escaped: reframe
    expect(stickySpan(s0, 10000)).toBeCloseTo(11500, 0) // lost in the middle
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

// The hold option: while a lesson is loaded the step frame never shrinks, so
// a chip that makes the response ten times smaller draws it ten times
// smaller instead of re-framing to the same pixels (the integrator lesson).
describe('stickyRange with hold', () => {
  it('still expands, but refuses to shrink', () => {
    const big = stickyRange(null, -50, 0)
    expect(stickyRange(big, -5, 0, false, { hold: true })).toBe(big)
    expect(stickyRange(big, -5, 0)).not.toBe(big) // without hold: the old shrink rule
    const grown = stickyRange(big, -80, 0, false, { hold: true })
    expect(grown.lo).toBeLessThan(-80)
  })
})

// An axis with one label has no scale. The browser pass found the tank's step
// response at 390 px drawn against a single tick, the zero line, while the
// readout beside it priced the peak at 308 Ω.
describe('yStepFor', () => {
  const ticks = (lo, hi, step) => Math.floor(hi / step + 1e-6) - Math.ceil(lo / step - 1e-6) + 1

  it('is drawFrame’s own choice where the pane has room', () => {
    // 1080p step pane: 360 px over 0..1 asks for seven labels at one per
    // 46 px, and niceStep rounds that up to 0.2. Unchanged by this rule.
    expect(yStepFor(0, 1, 360)).toBeCloseTo(niceStep(1, 7), 12)
    expect(yStepFor(0, 1, 360)).toBeCloseTo(0.2, 12)
    expect(ticks(0, 1, yStepFor(0, 1, 360))).toBeGreaterThanOrEqual(2)
  })

  it('shrinks the step until two labels land: the tank at 390 px', () => {
    // The defect, to the pixel: ±330 Ω of impedance in 76 px of pane. niceStep
    // returns 500, whose only tick inside the range is 0.
    const lo = -330
    const hi = 330
    const step = yStepFor(lo, hi, 76)
    expect(ticks(lo, hi, step)).toBeGreaterThanOrEqual(2)
    expect(step).toBeLessThan(hi - lo)
  })

  it('never labels a step wider than the range, at any pane height', () => {
    for (const h of [40, 60, 76, 120, 200, 400, 900]) {
      for (const [lo, hi] of [
        [-330, 330],
        [-0.7, 0.7],
        [0, 1],
        [-75.6, 8.1],
        [-1e6, 1e6],
        [0, 2.4e-3],
      ]) {
        const step = yStepFor(lo, hi, h)
        expect(ticks(lo, hi, step), `${lo}..${hi} at ${h} px`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('declines an empty range rather than returning a step of zero', () => {
    expect(yStepFor(0, 0, 100)).toBe(null)
    expect(yStepFor(0, 1, 0)).toBe(null)
  })
})

// A curve that holds an extreme — the integrator's +90° everywhere, a
// two-pole low-pass's −180° — was drawn along the frame's own border.
describe('phaseFrame', () => {
  it('leaves headroom past the labelled bounds, symmetrically', () => {
    const f = phaseFrame(-90, 90)
    expect(f.lo).toBeCloseTo(-90 - 180 * PHASE_PAD, 12)
    expect(f.hi).toBeCloseTo(90 + 180 * PHASE_PAD, 12)
  })

  it('puts an extreme inside the plot: +90° is off the top edge by pixels', () => {
    const h = 300
    const f = phaseFrame(-90, 90)
    const y = (d) => h - ((d - f.lo) / (f.hi - f.lo)) * h
    // Not the border, and far enough in to read as a line rather than a rule.
    expect(y(90)).toBeGreaterThan(3)
    expect(y(-90)).toBeLessThan(h - 3)
    // The labels still sit on their true values, and 0° is still the middle.
    expect(y(0)).toBeCloseTo(h / 2, 9)
  })

  it('scales the headroom with the range a two-pole circuit needs', () => {
    const f = phaseFrame(-180, 90)
    expect(f.hi - f.lo).toBeCloseTo(270 * (1 + 2 * PHASE_PAD), 9)
  })
})
