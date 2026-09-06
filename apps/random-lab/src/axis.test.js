import { describe, it, expect } from 'vitest'
import { tickStep, tickLabel, tickCount, frameTicks } from './axis.js'
import { analyse } from './analysis.js'
import { byId } from './experiments.js'

// The two axis defects a screenshot found, each with the case that found it.

describe('an axis always carries a scale', () => {
  it('never leaves fewer than three ticks on a range that has room for them', () => {
    for (let i = 0; i < 400; i++) {
      const lo = (i % 17) - 8.5 + i / 400
      const hi = lo + 0.05 * (1 + i) ** 1.3
      const step = tickStep(lo, hi, 4)
      expect(tickCount(lo, hi, step), `[${lo}, ${hi}] stepped by ${step}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('the Kalman run, which used to draw one tick reading "0"', () => {
    // The state and its measurements span about -3.8 to 4.8. `niceStep` rounds
    // 8.6 / 4 up into the 5 bucket, and zero is the only multiple of 5 inside.
    const k = analyse(byId('I2').params).kalman()
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < k.x.length; i++) {
      for (const v of [k.truth[i], k.z[i]]) {
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
    const pad = (hi - lo) * 0.1
    const step = tickStep(lo - pad, hi + pad, 4)
    expect(tickCount(lo - pad, hi + pad, step)).toBeGreaterThanOrEqual(3)
  })

  it('and a range with no width does not divide by zero', () => {
    expect(tickStep(1, 1, 4)).toBeGreaterThan(0)
    expect(tickStep(0, NaN, 4)).toBeGreaterThan(0)
  })
})

describe('every tick label names the value its tick is at', () => {
  const ticksOf = (lo, hi, target = 4) => {
    const step = tickStep(lo, hi, target)
    const fmt = tickLabel(step)
    const out = []
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) {
      out.push({ v, label: fmt(v) })
    }
    return { step, ticks: out }
  }
  const labelsOf = (lo, hi, target = 4) => ticksOf(lo, hi, target).ticks.map((t) => t.label)

  it('reads back as the tick, on the correlation axis that printed a quarter as 0.3', () => {
    // The lag axis runs -0.3 to 1.1 and ticks every 0.25. One decimal turned
    // -0.25 into "-0.3" and 0.75 into "0.8", so three of six labels named a
    // value the tick was not at.
    const { step, ticks } = ticksOf(-0.3, 1.1, 4)
    expect(step).toBe(0.25)
    for (const t of ticks) {
      expect(Math.abs(Number(t.label) - t.v), `${t.label} for ${t.v}`).toBeLessThanOrEqual(step * 1e-6)
    }
  })

  it('reads back as the tick over four hundred ranges', () => {
    for (let i = 0; i < 400; i++) {
      const mag = 10 ** (((i % 13) - 6) / 2)
      const lo = -mag * (i % 5)
      const hi = lo + mag * (1 + (i % 9))
      const { step, ticks } = ticksOf(lo, hi, 4 + (i % 8))
      for (const t of ticks) {
        expect(Math.abs(Number(t.label) - t.v), `${t.label} for ${t.v}`).toBeLessThanOrEqual(
          Math.abs(step) * 1e-6,
        )
      }
    }
  })

  it('on the Rayleigh histogram, which printed 0, 0.5, 1, 2, 2, 3, 3, 4, 4', () => {
    const h = analyse(byId('B2').params).hist()
    // The tick target a 1280 px frame asks for, which is where the duplicates
    // appeared: ten ticks over a range of 4.6 is a step of 0.5.
    const labels = labelsOf(h.lo, h.hi, 10)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toContain('0.5')
  })

  it('over four hundred ranges of every magnitude', () => {
    for (let i = 0; i < 400; i++) {
      const mag = 10 ** (((i % 13) - 6) / 2)
      const lo = -mag * (i % 5)
      const hi = lo + mag * (1 + (i % 9))
      const labels = labelsOf(lo, hi)
      expect(new Set(labels).size, `[${lo}, ${hi}]`).toBe(labels.length)
    }
  })

  it('and minus zero prints as zero', () => {
    expect(tickLabel(0.5)(-0)).toBe('0')
    expect(tickLabel(1)(-0)).toBe('0')
  })
})

describe('frameTicks sizes both axes from the plot it is given', () => {
  it('asks for more ticks on a wider frame', () => {
    const narrow = frameTicks({ w: 200, h: 120, k: 1 }, 0, 100, 0, 10)
    const wide = frameTicks({ w: 1200, h: 600, k: 1 }, 0, 100, 0, 10)
    expect(wide.xStep).toBeLessThanOrEqual(narrow.xStep)
    expect(wide.yStep).toBeLessThanOrEqual(narrow.yStep)
  })
})
