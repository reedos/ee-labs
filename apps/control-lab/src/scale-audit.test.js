import { it, expect } from 'vitest'
import { oscillationOf, plantInverted } from './verdict.js'

it.each([1e-14, 1, 1e8])('preserves pole signs and oscillation frequency at scale %s', (w) => {
  expect(plantInverted({ plant: { b: [w], a: [1, -w] } })).toBe(true)
  expect(plantInverted({ plant: { b: [w], a: [1, w] } })).toBe(false)
  expect(oscillationOf({ b: [w * w], a: [1, 0, w * w] }) / w).toBeCloseTo(1, 6)
})
