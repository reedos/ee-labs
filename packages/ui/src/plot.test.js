import { describe, it, expect } from 'vitest'
import { niceStep } from './plot.js'

// How many ticks an axis actually draws for a given step, counting the way
// drawFrame's own loop counts: start at 0, step up, stop past the maximum.
const ticks = (range, step) => Math.floor(range / step) + 1

describe('niceStep', () => {
  it('divides an axis into something near the tick target', () => {
    expect(niceStep(1000, 5)).toBe(200)
    expect(niceStep(10, 5)).toBe(2)
    expect(niceStep(1, 4)).toBe(0.5)
  })

  it('never returns a step wider than the axis it divides', () => {
    // The reproduction: Signal Lab's phone frequency axis. Three presets load
    // an overlay, whose right-hand gutter takes 64px instead of 18, leaving
    // about 230px of plot at 390px wide and a tick target of 2. The rounding
    // used to go up into the 5 bucket and return 5000 for a 4060 Hz axis, so
    // the only label drawn was the origin.
    const step = niceStep(4060, 2)
    expect(step).toBeLessThanOrEqual(4060)
    expect(ticks(4060, step)).toBeGreaterThanOrEqual(3)
  })

  it('draws more than the origin at every width a narrow axis can take', () => {
    // The defect was a boundary case, so sweep the boundary rather than
    // pinning the one value that happened to fail. Every combination here
    // must leave a reader at least one labelled interval to measure against.
    for (const range of [4060, 4096, 5000, 8000, 22050, 1, 0.5, 3.3]) {
      for (const target of [1, 2, 3, 4, 5, 8]) {
        const step = niceStep(range, target)
        expect(step, `range ${range}, target ${target}`).toBeGreaterThan(0)
        expect(step, `range ${range}, target ${target}`).toBeLessThanOrEqual(range)
        expect(ticks(range, step), `range ${range}, target ${target}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('leaves a comfortable axis exactly as it was', () => {
    // The cap only ever bites where the step overshot the range, so the
    // ordinary cases must be untouched.
    expect(niceStep(4060, 5)).toBe(1000)
    expect(niceStep(4060, 8)).toBe(1000)
    expect(niceStep(22050, 5)).toBe(5000)
  })

  it('holds the degenerate range it always held', () => {
    expect(niceStep(0, 5)).toBe(1)
    expect(niceStep(-10, 5)).toBe(1)
  })
})
