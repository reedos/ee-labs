import { describe, expect, it } from 'vitest'
import { agrees } from '@ee-labs/explain'
import { expectPlain } from '@ee-labs/prose/testing'
import { CARD, CU, DEFAULTS, RU, transfer } from './model.js'
import { analyse } from './experiments.js'
import { DEFAULT_AXES, fitAxis, logicReadings, scopePoints, timingComparison } from './presentation.js'
import { workedMath } from './math.js'

const reference = analyse(DEFAULTS)

describe('held physical axes', () => {
  it('shows load and width changes at the same time coordinates, through the whole held window', () => {
    const baseline = scopePoints(reference.response, DEFAULT_AXES.scope)
    for (const fanout of [0, 4, 8]) for (const wp of [1, 2, 4]) for (const edge of ['rise', 'fall']) {
      const p = { ...DEFAULTS, fanout, wp, edge }
      const response = analyse(p).response
      const points = scopePoints(response, DEFAULT_AXES.scope)
      expect(points.map(([t]) => t)).toEqual(baseline.map(([t]) => t))
      const resistance = edge === 'fall' ? RU : 2 * RU / wp
      const tau = resistance * (1 + wp + 3 * fanout) * CU
      for (const [time, voltage] of points) {
        const decay = Math.exp(-time * 1e-12 / tau)
        expect(voltage).toBeCloseTo(CARD.vdd * (edge === 'fall' ? decay : 1 - decay), 10)
      }
    }
    const loaded = scopePoints(analyse({ ...DEFAULTS, fanout: 8 }).response, DEFAULT_AXES.scope)
    const at50 = baseline.findIndex(([t]) => t >= 50)
    expect(loaded[at50][1] - baseline[at50][1]).toBeGreaterThan(0.8)
  })

  it('fits both traces without mutating the default ranges or reference data', () => {
    const before = JSON.stringify(reference.fanouts)
    for (const wp of [1, 4]) for (const stages of [1, 8]) {
      const current = analyse({ ...DEFAULTS, fanout: 8, wp, stages, edge: 'rise' })
      expect(fitAxis('scope', current, reference)).toBeGreaterThanOrEqual(Math.max(current.response.tEnd, reference.response.tEnd) * 1e12)
      expect(fitAxis('timing', current, reference)).toBeGreaterThanOrEqual(Math.max(current.chain.res.tEnd, reference.chain.res.tEnd))
      for (const f of [...current.fanouts, ...reference.fanouts]) {
        expect(fitAxis('fanout', current, reference)).toBeGreaterThan(Math.max(f.tpHL, f.tpLH) * 1e12)
      }
    }
    expect(Object.isFrozen(DEFAULT_AXES)).toBe(true)
    expect(JSON.stringify(reference.fanouts)).toBe(before)
  })
})

it('resolves the fastest allowed edge even in a previously fitted slow window', () => {
  const slow = analyse({ ...DEFAULTS, wp: 1, fanout: 8, edge: 'rise' })
  const held = fitAxis('scope', slow, reference)
  for (const edge of ['rise', 'fall']) {
    const fast = analyse({ ...DEFAULTS, wp: 1, fanout: 0, edge }).response
    const points = scopePoints(fast, held)
    const tau = (edge === 'fall' ? RU : 2 * RU) * 2 * CU
    for (let i = 1; i < points.length; i++) {
      const [t0, v0] = points[i - 1]
      const [t1, v1] = points[i]
      const decay = Math.exp(-(t0 + t1) / 2 * 1e-12 / tau)
      const exact = CARD.vdd * (edge === 'fall' ? decay : 1 - decay)
      expect(Math.abs((v0 + v1) / 2 - exact)).toBeLessThan(0.002)
    }
  }
})

it('reads every logic transition at the live cursor and preserves the default chain comparison', () => {
  const current = analyse({ ...DEFAULTS, fanout: 8, stages: 8 }).chain
  expect(current.res.signals.length).toBe(9)
  for (const event of current.res.events) {
    const before = logicReadings(current, event.t - 1).find((r) => r.signal === event.signal)
    const after = logicReadings(current, event.t).find((r) => r.signal === event.signal)
    expect(after.value).not.toBe(before.value)
  }
  const compared = timingComparison(current, reference.chain, true)
  expect(compared.signals).toHaveLength(current.res.signals.length + 1)
  expect(compared.waves['default q3']).toBe(reference.chain.res.waves.q3)
  expect(current.res.waves['default q3']).toBeUndefined()
  expect(timingComparison(current, reference.chain, false)).toBe(current.res)
})

it('keeps worked checks tied to independent crossings and numerical DC slopes', () => {
  const dc = transfer()
  let checks = 0
  for (const wp of [1, 2, 4]) for (const edge of ['rise', 'fall']) for (const view of ['scope', 'timing', 'fanout', 'transfer']) {
    const p = { ...DEFAULTS, wp, edge, fanout: 4 }
    const x = analyse(p, view === 'transfer' ? dc : null)
    for (const block of workedMath(x, p, view).blocks) {
      if (block.kind === 'check') for (const row of block.rows) { expect(agrees(row)).toBe(true); checks++ }
      if (block.kind === 'text') expectPlain(block.text, 'why')
    }
  }
  expect(checks).toBe(48)
})
