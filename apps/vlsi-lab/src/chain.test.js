import { expect, it } from 'vitest'
import { analogChain } from './chain.js'
import { inverter, CU } from './model.js'
import { edgeResponse, eventChain } from './extract.js'

it('matches the isolated first stage while measuring the distinct connected-chain delay', () => {
  for (const edge of ['rise', 'fall']) for (const stages of [1, 3, 5]) for (const fanout of [1, 4]) {
    const cell = inverter(), load = fanout * 3 * CU
    const chain = analogChain(cell, load, stages, edge, 29)
    const isolated = edgeResponse(cell, load, edge, 17)
    expect(chain.crossings[0] / isolated.measured).toBeCloseTo(1, 10)
    for (const [i, crossing] of chain.crossings.entries()) {
      expect(chain.walk.at(crossing).sol.v[`q${i + 1}`]).toBeCloseTo(cell.vdd / 2, 8)
      if (i) expect(crossing).toBeGreaterThan(chain.crossings[i - 1])
    }
    for (const sample of chain.walk.samples) {
      const t = sample.t
      expect(sample.sol.v.q1).toBeCloseTo(isolated.walk.at(t).sol.v.out, 9)
      for (let i = 1; i <= stages; i++) {
        expect(sample.sol.v[`q${i}`]).toBeGreaterThanOrEqual(-1e-10)
        expect(sample.sol.v[`q${i}`]).toBeLessThanOrEqual(cell.vdd + 1e-10)
      }
    }
    if (stages > 1) {
      const events = eventChain(chain.gate, stages, edge)
      expect(Math.abs(chain.elapsed - events.elapsed)).toBeGreaterThan(events.bound)
    }
  }
})

it('does not depend on plotted sample spacing and rejects an impossible connected load', () => {
  const cell = inverter()
  expect(analogChain(cell, 3 * CU, 3, 'fall', 7).elapsed).toBeCloseTo(analogChain(cell, 3 * CU, 3, 'fall', 401).elapsed, 20)
  expect(() => analogChain(cell, 0)).toThrow(/following gate/)
  expect(() => analogChain(cell, 3 * CU, 0)).toThrow(/1 to 8/)
})
