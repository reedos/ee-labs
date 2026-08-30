import { describe, it, expect } from 'vitest'
import { nextFrame } from './frame.js'

// The axis-fidget rule, pinned: tuning holds the frame, structure changes
// and large drifts re-frame it. The numbers below assume a ±log10(300)
// window with a 1.5-decade guard band — update them together with frame.js.

describe('the sticky frequency window', () => {
  const start = () => nextFrame(null, 'motor|p', 1)

  it('holds the exact same frame while the centre wanders inside the guard', () => {
    const f = start()
    for (const centre of [1, 2, 0.5, 8, 0.13]) {
      expect(nextFrame(f, 'motor|p', centre)).toBe(f)
    }
  })

  it('re-frames when the centre drifts within a decade and a half of an edge', () => {
    const f = start()
    const drifted = nextFrame(f, 'motor|p', 100)
    expect(drifted).not.toBe(f)
    // ...and the new frame is centred where the loop now lives.
    expect((drifted.lo + drifted.hi) / 2).toBeCloseTo(2, 9)
  })

  it('re-frames the moment the loop structure changes, even at the same centre', () => {
    const f = start()
    const other = nextFrame(f, 'motor|pi', 1)
    expect(other).not.toBe(f)
    expect(other.key).toBe('motor|pi')
  })

  it('a fresh frame spans centre ×/÷ 300', () => {
    const f = nextFrame(null, 'x', 10)
    expect(Math.pow(10, f.lo)).toBeCloseTo(10 / 300, 6)
    expect(Math.pow(10, f.hi)).toBeCloseTo(10 * 300, 4)
  })
})
