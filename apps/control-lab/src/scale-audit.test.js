import { it, expect } from 'vitest'
import { oscillationOf, plantInverted } from './verdict.js'

it.each([1e-14, 1, 1e8])('does not call imaginary-axis roundoff a positive pole at scale %s', (w) => {
  // (s+w)(s²+w²) has the exact poles -w and ±jw.
  expect(plantInverted({ plant: { b: [1], a: [1, w, w * w, w ** 3] } })).toBe(false)
})

it.each([1e-14, 1, 1e8])('retains a resolved slow-growing oscillation at scale %s', (w) => {
  const growth = w * 1e-10
  expect(plantInverted({ plant: { b: [1], a: [1, -2 * growth, growth * growth + w * w] } })).toBe(true)
})

it.each([1e-14, 1, 1e8])('preserves pole signs and oscillation frequency at scale %s', (w) => {
  expect(plantInverted({ plant: { b: [w], a: [1, -w] } })).toBe(true)
  expect(plantInverted({ plant: { b: [w], a: [1, w] } })).toBe(false)
  expect(oscillationOf({ b: [w * w], a: [1, 0, w * w] }) / w).toBeCloseTo(1, 6)
})
