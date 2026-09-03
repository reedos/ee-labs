import { describe, it, expect } from 'vitest'
import { settleTime, naturalWindow, ceil2, cyclesIn, SETTLE_FILL, RUNAWAY_LIMIT } from './stepWindow.js'
import { buildLoop } from './systems.js'
import { stepResponse, polesZeros } from '@ee-labs/systems'

describe('ceil2', () => {
  it('rounds up to two significant figures', () => {
    expect(ceil2(15.63)).toBe(16)
    expect(ceil2(2.78)).toBeCloseTo(2.8, 9)
    expect(ceil2(0)).toBe(0)
  })
})

describe('settleTime', () => {
  it('finds the moment a settling trace enters the 2% band and stays', () => {
    const { closed } = buildLoop('firstOrder', { k: 1, tau: 1 }, 'pi', { kp: 1, ki: 0.2 })
    const { t, y } = stepResponse(closed, { duration: 80, points: 4000 })
    const ts = settleTime(t, y, 1)
    expect(ts).not.toBeNull()
    // The ground-truth measurement this lab already carries: Ki = 0.2 on the
    // firstOrder/PI(Kp=1) loop settles (2%) at ~30.5 s.
    expect(ts).toBeCloseTo(30.5, 0)
  })

  it('returns null when the trace has not entered the band by the last sample', () => {
    const { closed } = buildLoop('firstOrder', { k: 1, tau: 1 }, 'pi', { kp: 1, ki: 0.2 })
    const { t, y } = stepResponse(closed, { duration: 5, points: 500 })
    expect(settleTime(t, y, 1)).toBeNull()
  })
})

describe('naturalWindow', () => {
  const canSimAlways = () => true

  it('sizes a stable loop from its measured settling time, filled to about 60%', () => {
    const { closed } = buildLoop('firstOrder', { k: 1, tau: 1 }, 'pi', { kp: 1, ki: 0.2 })
    const pz = polesZeros(closed)
    const slow = Math.min(...pz.poles.filter(([re]) => Math.abs(re) > 1e-9).map(([re]) => Math.abs(re)))
    const w = naturalWindow(closed, { verdict: 'stable', slow, grow: 0, osc: 0 }, canSimAlways)
    // 30.5 x 1.6 ~= 48.8 — well short of the old 12/slow guess for this pole.
    expect(w).toBeCloseTo(SETTLE_FILL * 30.5, 0)
  })

  it('frames a marginal loop as eight cycles of its own oscillation', () => {
    const w = naturalWindow({ b: [1], a: [1, 0, 4] }, { verdict: 'marginal', slow: NaN, grow: 0, osc: 2 })
    expect(w).toBeCloseTo((8 * 2 * Math.PI) / 2, 9)
  })

  it('cuts an unstable window where the growth is already plain to see, not at a fixed cap', () => {
    // The three-lag "Kp -> 12 (diverges)" loop: poles at +0.047 +/- 3.83j,
    // and the old 25/grow cap ran to hundreds of seconds of solid green.
    const { closed } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 12 })
    const pz = polesZeros(closed)
    const grow = Math.max(0, ...pz.poles.map(([re]) => re))
    const w = naturalWindow(closed, { verdict: 'unstable', slow: NaN, grow }, canSimAlways)
    expect(w).toBeGreaterThan(0)
    expect(w).toBeLessThan(25 / grow)
    const { t, y } = stepResponse(closed, { duration: w, points: 600 })
    const peak = Math.max(...y.map(Math.abs))
    expect(peak).toBeGreaterThan(RUNAWAY_LIMIT * 0.9)
  })

  it('falls back to the affordability guess when the coarse sim itself is unaffordable', () => {
    const cap = naturalWindow({ b: [1], a: [1, 1] }, { verdict: 'stable', slow: 1, grow: 0, osc: 0 }, () => false)
    expect(cap).toBe(12)
  })
})

describe('cyclesIn', () => {
  it('counts sign flips about the mean, halved', () => {
    const y = Float64Array.from({ length: 400 }, (_, i) => Math.sin((2 * Math.PI * 3 * i) / 399))
    expect(cyclesIn(y)).toBeCloseTo(3, 0)
  })
})
