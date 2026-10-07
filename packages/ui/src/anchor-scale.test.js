import { it, expect } from 'vitest'
import { anchoredRange, traceExtent } from './anchor.js'

it.each([1e-18, 1e-12, 1, 1e12])('preserves waveform and curve height at amplitude %s', (amplitude) => {
  const samples = [-1, 0, 0.5, 1]
  const expectedTrace = traceExtent({ sig: { v: samples } }, ['v'])
  const expectedCurve = anchoredRange(samples)
  const scaled = samples.map(v => amplitude * v)
  const actualTrace = traceExtent({ sig: { v: scaled } }, ['v'])
  const actualCurve = anchoredRange(scaled)
  for (let i = 0; i < 2; i++) {
    expect(actualTrace[i] / amplitude).toBeCloseTo(expectedTrace[i], 10)
    expect(actualCurve[i] / amplitude).toBeCloseTo(expectedCurve[i], 10)
  }
})

it('still gives an all-zero trace and curve a finite visible range', () => {
  for (const range of [traceExtent({ sig: { v: [0, 0] } }, ['v']), anchoredRange([0, 0])]) {
    expect(range[0]).toBeLessThan(0)
    expect(range[1]).toBeGreaterThan(0)
    expect(range.every(Number.isFinite)).toBe(true)
  }
})
