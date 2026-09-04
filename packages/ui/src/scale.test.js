import { describe, it, expect } from 'vitest'
import { POS_MAX, clamp, fromPos, near, snap, toPos } from './scale.js'
import { fmtHz } from './format.js'

const lin = { scale: 'linear', min: 0, max: 2, step: 0.01 }
const log = { scale: 'log', min: 1, max: 8000, step: 1 }
const p2 = { scale: 'pow2', min: 512, max: 16384 }

describe('clamp', () => {
  it('bounds both ends', () => {
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
    expect(clamp(5, 0, 10)).toBe(5)
  })
})

describe('linear scale', () => {
  it('maps endpoints to the position domain', () => {
    expect(toPos(0, lin)).toBe(0)
    expect(toPos(2, lin)).toBe(POS_MAX)
    expect(toPos(1, lin)).toBe(POS_MAX / 2)
  })

  it('round-trips', () => {
    for (const v of [0, 0.25, 0.5, 1, 1.5, 2]) {
      expect(fromPos(toPos(v, lin), lin)).toBeCloseTo(v, 6)
    }
  })

  it('snaps to the step', () => {
    expect(snap(0.1234, lin)).toBeCloseTo(0.12, 10)
  })

  it('derives a default step from the range instead of rounding to whole units when none is given', () => {
    // Circuit Elements Lab's D4: a current source spanning ±0.1 A, no step
    // passed. The old flat default of 1 rounded every typed entry to the
    // nearest whole ampere — 5 mA became 0 A, and the node it feeds read 0 V
    // instead of the 2.5 V the lesson claims. `step` is omitted here on
    // purpose, matching what circuit-elements-lab/src/App.jsx actually
    // passes to NumField (no step at all).
    const current = { scale: 'linear', min: -0.1, max: 0.1 }
    expect(snap(0.005, current)).toBeCloseTo(0.005, 9)
    expect(snap(0.005, current)).not.toBe(0)
    // The derived step still respects the knob's own resolution: nothing
    // snaps outside min..max, and the extremes remain reachable.
    expect(snap(0.1, current)).toBeCloseTo(0.1, 9)
    expect(snap(-0.1, current)).toBeCloseTo(-0.1, 9)
  })

  it('still honours an explicit step over the derived default', () => {
    expect(snap(0.0033, { scale: 'linear', min: -0.1, max: 0.1, step: 0.001 })).toBeCloseTo(0.003, 9)
  })

  it('falls back to 1 when the range itself is degenerate (no span to derive from)', () => {
    expect(snap(5, { scale: 'linear', min: 0, max: 0 })).toBe(0)
    expect(snap(5.4, { scale: 'linear' })).toBe(5)
  })
})

describe('log scale', () => {
  it('maps endpoints to the position domain', () => {
    expect(toPos(1, log)).toBe(0)
    expect(toPos(8000, log)).toBe(POS_MAX)
  })

  it('puts the geometric mean at the midpoint', () => {
    // This is the whole point: 89 Hz is the *middle* of 1..8000 on a log slider,
    // where a linear slider would put 4000.
    expect(toPos(Math.sqrt(8000), log)).toBe(POS_MAX / 2)
  })

  it('gives the low decades real travel', () => {
    // The original complaint: on a linear 1..8000 slider, everything under 100 Hz
    // lived in the first 1.2% of travel. On log it gets a third of the slider.
    const decade = toPos(100, log) - toPos(10, log)
    expect(decade).toBeGreaterThan(240)
    expect(toPos(100, log)).toBeGreaterThan(490)
  })

  it('round-trips within the slider quantum', () => {
    // 1000 integer positions across 1..8000 means each position is a ratio of
    // 8000^(1/1000) = 1.009, so a slider round-trip is inherently good to ~0.9%,
    // not exact. That is the tradeoff a fixed-resolution slider makes, and it is
    // exactly why the typed box exists alongside it.
    for (const v of [1, 10, 100, 440, 1000, 8000]) {
      const back = fromPos(toPos(v, log), log)
      expect(Math.abs(back - v) / v).toBeLessThan(0.01)
    }
  })

  it('snaps to constant relative precision', () => {
    expect(snap(249.3178, log)).toBe(249.3)
    expect(snap(1010.4, log)).toBe(1010)
    expect(snap(4.5678, log)).toBe(4.568)
  })

  it('never leaves the range', () => {
    for (let p = 0; p <= POS_MAX; p += 7) {
      const v = fromPos(p, log)
      expect(v).toBeGreaterThanOrEqual(log.min)
      expect(v).toBeLessThanOrEqual(log.max)
    }
  })
})

describe('pow2 scale', () => {
  it('only ever produces exact powers of two', () => {
    // fft() throws on anything else, so this is a hard requirement.
    for (let p = 0; p <= POS_MAX; p += 3) {
      const v = fromPos(p, p2)
      expect(Number.isInteger(Math.log2(v))).toBe(true)
      expect(v).toBeGreaterThanOrEqual(512)
      expect(v).toBeLessThanOrEqual(16384)
    }
  })

  it('snaps a typed value to the nearest power of two in log space', () => {
    // The boundary between 2048 and 4096 is their GEOMETRIC mean (2896), not the
    // linear midpoint (3072) — rounding happens on log2. This has to match how
    // fromPos interpolates, or typing and dragging would disagree about what
    // "nearest" means.
    expect(snap(2800, p2)).toBe(2048)
    expect(snap(3000, p2)).toBe(4096)
    expect(snap(700, p2)).toBe(512)
    expect(snap(1e9, p2)).toBe(16384) // clamped, not extrapolated
  })

  it('round-trips every power in range', () => {
    for (const v of [512, 1024, 2048, 4096, 8192, 16384]) {
      expect(fromPos(toPos(v, p2), p2)).toBe(v)
    }
  })
})

describe('near', () => {
  it('matches chips on a linear scale within half a step', () => {
    expect(near(0.5, 0.5, lin)).toBe(true)
    expect(near(0.502, 0.5, lin)).toBe(true)
    expect(near(0.52, 0.5, lin)).toBe(false)
  })

  it('matches chips on a log scale by relative error', () => {
    expect(near(440, 440, log)).toBe(true)
    expect(near(440.1, 440, log)).toBe(true)
    expect(near(450, 440, log)).toBe(false)
  })
})

describe('fmtHz', () => {
  it('formats below and above a kilohertz', () => {
    expect(fmtHz(440)).toBe('440')
    expect(fmtHz(1000)).toBe('1k')
    expect(fmtHz(22050)).toBe('22.05k')
    expect(fmtHz(1200)).toBe('1.2k')
  })
})
