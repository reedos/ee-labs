import { describe, it, expect } from 'vitest'
import { POS_MAX, clamp, commitValue, fromPos, near, snap, toPos } from './scale.js'
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

  it('derives a default step from the range for the SLIDER GRID, instead of rounding to whole units', () => {
    // This is snap()'s own job now: the grid fromPos() puts a DRAG onto, so
    // the 1000 positions under the slider are spread sensibly across
    // whatever range the knob covers, rather than landing on whole units (the
    // original bug — see defaultLinearStep's doc comment). A typed value no
    // longer goes through this function at all; NumField.jsx's commit() and
    // bump() call commitValue() instead (see the 'commitValue' describe
    // block below), specifically because this grid is still too coarse to
    // hand a typed value through unchanged on a wide knob — the ±24 V case
    // that block covers. `step` is omitted here on purpose, matching what
    // circuit-elements-lab/src/App.jsx actually passes to NumField (no step
    // at all).
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

describe('commitValue', () => {
  // This is what NumField.jsx's commit() (typing then Enter/blur) and bump()
  // (arrow keys, wheel, the +/- buttons) call — direct entry, never a drag.
  // The opts below deliberately omit `step`, the same way circuit-elements-lab's
  // App.jsx calls NumField (grep confirms no `step` prop on either NumField
  // there): that is the shape every regression the grader found shares.

  it('keeps a typed −1 mV on a ±24 V knob instead of rounding it to 0 (E3, the comparator)', () => {
    // Reported as a complete miss: E3's lesson types E to −0.001 V and reads
    // v_out ≈ −100 V; the old grid-snapping default (span/POS_MAX ≈ 0.048 V)
    // committed exactly 0 instead, so the comparator's output stayed 0 V.
    const vs = { scale: 'linear', min: -24, max: 24 }
    expect(commitValue(-0.001, vs)).toBe(-0.001)
    expect(commitValue(-0.001, vs)).not.toBe(0)
  })

  it('keeps 0.5 typed into a wide knob (I3)', () => {
    const wide = { scale: 'linear', min: -24, max: 24 }
    expect(commitValue(0.5, wide)).toBe(0.5)
  })

  it('keeps −10 typed into a ±24 V knob (A3)', () => {
    const vs = { scale: 'linear', min: -24, max: 24 }
    expect(commitValue(-10, vs)).toBe(-10)
  })

  it('still clamps a value outside the range, and only clamps it', () => {
    const vs = { scale: 'linear', min: -24, max: 24 }
    expect(commitValue(30, vs)).toBe(24)
    expect(commitValue(-30, vs)).toBe(-24)
    // Not to some grid point past the boundary — exactly the boundary.
    expect(commitValue(24.0001, vs)).toBe(24)
  })

  it('still honours a step the caller actually gave — a real resolution limit, not a UI grid', () => {
    // e.g. an integer count, or a timebase grain the model can't subdivide.
    expect(commitValue(2.6, { scale: 'linear', min: 0, max: 10, step: 1 })).toBe(3)
    expect(commitValue(0.0033, { scale: 'linear', min: -0.1, max: 0.1, step: 0.001 })).toBeCloseTo(0.003, 9)
  })

  it('still rounds a typed value to the nearest power of two — fft() throws on anything else', () => {
    expect(commitValue(300, { scale: 'pow2', min: 512, max: 16384 })).toBe(512)
    expect(commitValue(3000, { scale: 'pow2', min: 512, max: 16384 })).toBe(4096)
  })

  it('a keyboard nudge (bump) lands on value + step exactly, not on the slider grid', () => {
    // bump() in NumField.jsx is `commitValue(value + delta, commitOpts)`. Starting
    // from the committed −0.001 above and stepping by the field's own resolved
    // increment must move by that increment, not snap back onto a coarse grid
    // point the way the old bump()+snap() combination did.
    const vs = { scale: 'linear', min: -24, max: 24 }
    const increment = 0.048 // defaultLinearStep(-24, 24) = 48/1000
    expect(commitValue(-0.001 + increment, vs)).toBeCloseTo(-0.001 + increment, 9)
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
