import { describe, it, expect } from 'vitest'
import { scopeYStep } from './ScopeCanvas.jsx'

// Playbook #4: an axis with one label is not an axis.
//
// The scope already asks the frame for a step whenever the round choice would
// leave fewer than three ticks. The Kernel pane did not, and at 390x844 it is
// about 100 px of plot for a kernel that peaks at 0.083 — a twelve-tap moving
// average's own weight, 1/12. drawFrame's round step for that range is 0.1,
// which lands exactly one tick, "0". A student reading "the 31 stems are the
// filter" had no scale to read their height against.
//
// These pin the same rule for the kernel's own numbers. `area.h` is the plot
// height in device pixels, and `k` is drawFrame's own chrome scale, 1 below 4K.

const ticksOf = (yLimit, step) => {
  const out = []
  for (let v = Math.ceil(-yLimit / step) * step; v <= yLimit + step * 1e-6; v += step) out.push(v)
  return out
}

describe('the kernel pane y-axis', () => {
  // yMax as ImpulseCanvas computes it: the peak with 15% headroom.
  const limitFor = (peak) => Math.max(peak * 1.15, 1e-6)

  it('a phone-height pane gets three ticks for a twelve-tap average', () => {
    const yLimit = limitFor(1 / 12)
    const step = scopeYStep(yLimit, 100, 1)
    expect(step).not.toBe(null)
    const ticks = ticksOf(yLimit, step)
    expect(ticks.length).toBeGreaterThanOrEqual(3)
    expect(ticks).toContain(0)
  })

  it('the same pane drew exactly one label before, which is the defect', () => {
    // The round choice drawFrame makes on its own, reproduced: one tick.
    const yLimit = limitFor(1 / 12)
    const roundStep = 0.1
    const ticks = ticksOf(yLimit, roundStep)
    expect(ticks).toHaveLength(1)
    expect(ticks[0]).toBeCloseTo(0, 12)
  })

  it('the outer ticks bracket the tallest tap, so the peak can be read', () => {
    for (const peak of [1 / 12, 0.083, 0.24, 0.47]) {
      const yLimit = limitFor(peak)
      const step = scopeYStep(yLimit, 100, 1) ?? 0.1
      const ticks = ticksOf(yLimit, step)
      if (ticks.length >= 3) expect(Math.max(...ticks)).toBeGreaterThanOrEqual(peak)
    }
  })

  it('leaves a laptop-height pane alone — it already had three', () => {
    // 365 px of plot for the same kernel gives a 0.05 step and five ticks.
    expect(scopeYStep(limitFor(1 / 12), 365, 1)).toBe(null)
  })
})
