import { describe, expect, it } from 'vitest'
import { texFailures } from '@ee-labs/explain/testing'
import { analyse } from './pin.js'
import { defaultsOf } from './experiments.js'
import { scopeReading, scopeRun, scopeWindow } from './scope.js'
import { mathEntry, measuredCrossing } from './math.js'

describe('a physical comparison on a held time axis', () => {
  it('quadrupling capacitance changes voltage at the same plotted time', () => {
    const p = defaultsOf('a1')
    const window = scopeWindow(p, 'rise')
    const baseline = scopeRun(p, 'rise', window)
    const loaded = scopeRun({ ...p, cload: 4 * p.cload }, 'rise', window)
    expect(loaded.tEnd).toBe(baseline.tEnd)
    expect(baseline.wave(window / 4) - loaded.wave(window / 4)).toBeGreaterThan(1)
    expect(loaded.tr).toBeNull()
    expect(analyse({ ...p, cload: 4 * p.cload }).rise.tr).toBeCloseTo(4 * analyse(p).rise.tr, 18)
  })
  it('small loads remain resolved on the held frame and never invent a late crossing', () => {
    const p = defaultsOf('a3')
    const end = scopeWindow(p, 'rise')
    const run = scopeRun({ ...p, cload: 10e-12 }, 'rise', end)
    expect(run.samples.filter((s) => s.t < run.segments[0].tau).length).toBeGreaterThan(10)
    expect(run.wave(end)).toBeCloseTo(p.vdd, 9)
  })
  it('cursor voltage, capacitor current and energy share one network state', () => {
    const p = defaultsOf('a1')
    for (const direction of ['rise', 'fall']) {
      const run = scopeRun(p, direction, scopeWindow(p, direction))
      const t = p.ron * p.cload
      const point = scopeReading(run, t, p.cload)
      expect(point.voltage).toBeCloseTo(p.vdd * (direction === 'rise' ? 1 - Math.exp(-1) : Math.exp(-1)), 9)
      expect(point.current).toBeCloseTo((direction === 'rise' ? 1 : -1) * p.vdd / p.ron / Math.E, 9)
      expect(point.energy).toBeCloseTo(p.cload * point.voltage ** 2 / 2, 18)
    }
  })
})

describe('worked math', () => {
  for (const id of ['a1', 'a2', 'a3', 'a4', 'a5']) it(`${id} derives and checks live settings in both directions`, () => {
    for (const direction of ['rise', 'fall']) {
      const p = { ...defaultsOf(id), ron: 40, cload: 200e-12, edgeTime: 20e-9 }
      const x = analyse(p)
      const entry = mathEntry(id, p, x, { direction })
      expect(texFailures(entry)).toEqual([])
      expect(entry.blocks.filter((b) => b.kind === 'text').length).toBeGreaterThanOrEqual(3)
      const checks = entry.blocks.find((b) => b.kind === 'check').rows
      expect(checks.length).toBe(2)
      for (const row of checks) expect(row.measured).toBeCloseTo(row.predicted, 6)
    }
  })
  it('does not claim a crossing outside the displayed window', () => {
    const p = defaultsOf('a1')
    const run = scopeRun(p, 'rise', p.ron * p.cload / 10)
    expect(measuredCrossing(run, p.vdd * 0.9)).toBeNaN()
  })
})
